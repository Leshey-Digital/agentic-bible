import type { EditorialEnv, Session } from '../editorial/contracts.ts';
import { localMode, sameOrigin } from '../editorial/auth.ts';
import { InputError, CapacityError, ReplayConflictError, readJson, readLimitedText } from '../editorial/validation.ts';
import { fieldsFor, groups, record, updateInput, type Group } from './contracts.ts';
import { SettingsStore } from './store.ts';
import { settingsView } from './views.ts';
import { SettingsReceiptCapacityError } from './receipts.ts';

const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff','Vary':'Cookie','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
export async function settingsRoutes(request:Request,env:EditorialEnv,session:Session):Promise<Response> {
  if (!localMode(request,env)||session.role!=='admin'||!env.EDITORIAL_DB) return json({error:'local_admin_required'},403);
  const path=new URL(request.url).pathname;
  const api=path==='/api/admin/settings';
  if (!api&&!['/admin/settings','/admin/settings/'].includes(path))return json({error:'route_not_found'},404);
  const store=new SettingsStore(env.EDITORIAL_DB);
  const state=()=>store.state();
  const view=async(notice='',status=200,attempted?:{group:Group;values:Record<string,unknown>},errors:Record<string,string>={})=>new Response(settingsView(await store.read(),await store.audit(),session,notice,attempted,errors),{status,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
  if (request.method==='GET')return api?json(await state()):view(new URL(request.url).searchParams.has('saved')?'Settings saved. Collection remains off.':'');
  if (request.method!==(api?'PATCH':'POST'))return json({error:'method_not_allowed'},405);
  if (!sameOrigin(request))return json({error:'same_origin_required'},403);
  let input:unknown;
  if (api) {
    if (request.headers.get('X-CSRF-Token')!==session.csrf)return json({error:'csrf_required'},403);
    input=await readJson(request);
  } else {
    if (request.headers.get('Content-Type')?.split(';')[0]!=='application/x-www-form-urlencoded')return json({error:'invalid_form'},415);
    const params=new URLSearchParams(await readLimitedText(request));
    if (params.get('csrf')!==session.csrf)return json({error:'csrf_required'},403);
    if ([...params.keys()].some(key=>params.getAll(key).length!==1))throw new InputError({form:'Use one value per setting.'});
    const group=params.get('group') as Group;
    if (!(groups as readonly unknown[]).includes(group))throw new InputError({group:'Choose a settings section.'});
    const allowed=['csrf','group','version','requestKey',...fieldsFor(group)];
    if ([...params.keys()].some(key=>!allowed.includes(key)))throw new InputError({form:'Credentials and raw scripts are not accepted.'});
    input={group,version:params.get('version'),requestKey:params.get('requestKey'),values:Object.fromEntries(fieldsFor(group).map(key=>{const value=params.get(key);return [key,value==='true'?true:value==='false'?false:value];}))};
  }
  try {
    const update=updateInput(input);
    const outcome=await store.commit(update,session.identity,Date.now());const result=outcome.result;
    if (result==='stale')return api?json({error:'stale_revision'},409):view('Another save changed this section. Your valid entered settings are kept below. Review the current revision before saving again.',409,{group:update.group,values:update.values as unknown as Record<string,unknown>},{version:'Review the current revision.'});
    return api?(outcome.response?new Response(outcome.response,{status:200,headers:{...headers,'Content-Type':'application/json'}}):json({...await state(),result})):new Response(null,{status:303,headers:{...headers,Location:'/admin/settings/?saved=1'}});
  } catch(error) {
    if (error instanceof InputError) {
      const attempted=record(input)&&groups.includes(input.group as Group)&&record(input.values)?{group:input.group as Group,values:input.values}:undefined;
      return api?json({error:'invalid_settings',fields:error.fields},error.status):view(Object.values(error.fields).join(' '),error.status,attempted,error.fields);
    }
    if (error instanceof ReplayConflictError)return api?json({error:'request_reference_conflict'},409):view('This request reference was already used. Reload the current section before retrying.',409);
    if (error instanceof SettingsReceiptCapacityError)return api?json({error:'local_settings_receipts_unavailable'},503):view('The local replay receipt capacity was reached. No settings changed. Existing supported retries remain available; try new saves after receipts expire.',503);
    if (error instanceof CapacityError)return api?json({error:'local_settings_history_full'},503):view('The 1,000-change local history limit was reached. No settings changed. Archive deliberately before resuming.',503);
    throw error;
  }
}
