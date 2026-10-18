import type { EditorialEnv, Session } from '../editorial/contracts.ts';
import { localMode, sameOrigin } from '../editorial/auth.ts';
import { readJson, readLimitedText, InputError } from '../editorial/validation.ts';
import { layout, escape } from '../editorial/views.ts';
import { validateCatalog } from './catalog.ts';
import { MonitorStore } from './store.ts';
import { limits, scenarios, MonitorError, type Scenario } from './contracts.ts';
import { fixtureTransport } from './fixtures.ts';
import { runJob } from './runner.ts';
import { publishQueued } from './publication.ts';
import { BatchError, executeBatch, type BatchAction } from './batch.ts';

const safeHeaders={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff','Vary':'Cookie','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:safeHeaders});
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const hidden=(session:Session,key:string=crypto.randomUUID())=>`<input type="hidden" name="csrf" value="${escape(session.csrf)}"><input type="hidden" name="requestKey" value="${escape(key)}">`;

export async function monitoringRoutes(request:Request,env:EditorialEnv,session:Session):Promise<Response> {
  if(!localMode(request,env)||session.role!=='admin'||!env.EDITORIAL_DB)return json({error:'local_admin_required'},403);
  const url=new URL(request.url);const api=url.pathname.startsWith('/api/');
  const response=await env.ASSETS.fetch(new Request(new URL('/source-catalog.json',url)));
  const raw=await response.text();
  if(!response.ok||raw.length>32768)throw new MonitorError('catalog_unavailable');
  const catalog=await validateCatalog(JSON.parse(raw));const store=new MonitorStore(env.EDITORIAL_DB);await store.seed(catalog);
  let batchRetry:{action:BatchAction;key:string}|undefined;
  async function state() {
    return {mode:'fixture-only',publicRelease:false,sources:await store.sources(),jobs:await store.jobs(),candidates:await store.candidates(),heads:await Promise.all(catalog.articles.map(article=>store.head(article.id))),budget:await store.budget(Date.now()),actions:await store.actions()};
  }
  async function view(notice='',status=200) {
    const data=await state();
    const controls=`<div class="monitor-controls"><form class="review-form" method="post" action="/admin/sources/check/">${hidden(session)}<h2>Check one source</h2><label for="source">Source</label><select id="source" name="sourceId">${catalog.sources.map(source=>`<option value="${source.id}" ${url.searchParams.get('source')===source.id?'selected':''}>${escape(source.title)} — ${escape(new URL(source.url).hostname)}</option>`).join('')}</select><label for="scenario">Synthetic response</label><select id="scenario" name="scenario">${scenarios.map(scenario=>`<option value="${scenario}" ${url.searchParams.get('scenario')===scenario?'selected':''}>${scenario}</option>`).join('')}</select><button type="submit">Run fixture check</button><p>No source URL is fetched. Baseline then change demonstrates automatic local ledger publication.</p></form><section class="monitor-explanation"><h2>Bounded, local work</h2><p>${data.budget.attempts} / ${limits.dailyAttempts} fixture HTTP attempts reserved today. Each response is limited to 32 KiB, each attempt to two seconds, and each job to three attempts. At most four jobs/candidates are processed per pass.</p><form method="post" action="/admin/sources/process/">${hidden(session,batchRetry?.action==='process'?batchRetry.key:undefined)}<button type="submit">Process queued fixture work</button></form><form method="post" action="/admin/sources/schedule/">${hidden(session,batchRetry?.action==='schedule'?batchRetry.key:undefined)}<button type="submit" class="quiet-button">Queue next hourly fixture batch</button></form><p>This callable planner is not live cron. Paid inference and live fetching remain disabled.</p></section></div>`;
    const sources=`<section class="monitor-section"><h2>Source observations</h2><ul class="monitor-source-list">${data.sources.map(source=>`<li><strong>${escape(source.title)}</strong><span>${escape(source.hash?.slice(0,12)??'No baseline')} · content version ${source.version} · fixture</span></li>`).join('')}</ul></section>`;
    const jobs=`<section class="monitor-section"><h2>Recent fixture jobs</h2>${data.jobs.length?`<ol class="inbox-list monitor-jobs">${data.jobs.map(job=>`<li><strong>${escape(job.scenario)} · ${escape(job.state)}</strong><p>${escape(job.result??job.error??'Waiting for a bounded local pass')} · attempts ${job.attempts}/3</p><code>${escape(job.id)}</code></li>`).join('')}</ol>`:'<p>No fixture jobs yet. Start with a baseline above.</p>'}</section>`;
    const candidates=`<section class="monitor-section" id="publication-queue"><h2>Local publication and review queue</h2><p>These are source-observation metadata revisions. Article text, search and public releases are unchanged. Valid candidates publish automatically and then receive review flags.</p>${data.candidates.length?data.candidates.map(candidate=>{
      const head=data.heads.find(head=>head?.articleId===candidate.articleId)!;
      const form=(action:string,label:string)=>`<form method="post" action="/admin/sources/transition/">${hidden(session)}<input type="hidden" name="id" value="${candidate.id}"><input type="hidden" name="action" value="${action}"><input type="hidden" name="headVersion" value="${head.version}"><input type="hidden" name="candidateVersion" value="${candidate.version}"><button type="submit" class="quiet-button">${label}</button></form>`;
      return `<article class="monitor-candidate" data-candidate="${candidate.id}"><p class="kicker">${escape(candidate.articleId)} · local fixture ledger</p><h3>${escape(candidate.state)} · review ${escape(candidate.reviewFlag)}</h3><p>${escape(candidate.reason??'Evidence and technical validation queued')}</p><code>${escape(candidate.id)}</code><div class="monitor-actions">${candidate.state==='published'&&candidate.reviewFlag==='flagged'?form('clear-flag','Clear review flag'):''}${candidate.state==='published'&&head.currentRevision===candidate.id?form('revert','Revert local revision'):''}${candidate.state==='reverted'?form('restore','Restore local revision'):''}</div></article>`;
    }).join(''):'<p>No source-change candidates yet. An initial baseline alone is not evidence of a change.</p>'}</section>`;
    const audit=`<section class="monitor-section"><h2>Publication ledger actions</h2>${data.actions.length?`<ul class="monitor-audit">${data.actions.map(action=>`<li>${escape(action.action)} · ${escape(action.actor)}<br><code>${escape(action.candidateId)}</code></li>`).join('')}</ul>`:'<p>No publication transitions recorded.</p>'}</section>`;
    return new Response(layout('Source monitoring',`<a class="back-editorial" href="/admin/">Back to editorial inbox</a><div class="editorial-intro"><p class="kicker">Local source monitoring</p><h1>Track a source.<br>Keep the evidence.</h1><p>Synthetic HTTP only. No primary source page was fetched and no article was released. Source text is hashed in memory and discarded.</p></div>${notice?`<p class="notice notice-error" role="alert">${escape(notice)}</p>`:''}${controls}${sources}${jobs}${candidates}${audit}`,session),{status,headers:{...safeHeaders,'Content-Type':'text/html; charset=utf-8'}});
  }
  if(request.method==='GET')return ['/admin/sources','/admin/sources/','/api/admin/monitor/state'].includes(url.pathname)?(api?json(await state()):view()):json({error:'route_not_found'},404);
  if(request.method!=='POST')return json({error:'method_not_allowed'},405);
  if(!sameOrigin(request))return json({error:'same_origin_required'},403);
  let value:unknown;
  if(api)value=await readJson(request);
  else {
    if(request.headers.get('Content-Type')?.split(';')[0]!=='application/x-www-form-urlencoded')return json({error:'invalid_form'},415);
    value=Object.fromEntries(new URLSearchParams(await readLimitedText(request)));
  }
  if(!value||typeof value!=='object'||Array.isArray(value))throw new InputError({form:'Use a valid action object.'});
  const fields=value as Record<string,unknown>;
  if((api?request.headers.get('X-CSRF-Token'):fields.csrf)!==session.csrf)return json({error:'csrf_required'},403);
  if(typeof fields.requestKey!=='string'||!uuid.test(fields.requestKey))throw new InputError({form:'Reload the controls to get a request reference.'});
  const action=({'/admin/sources/check/':'check','/api/admin/monitor/run':'check','/admin/sources/schedule/':'schedule','/api/admin/monitor/schedule':'schedule','/admin/sources/process/':'process','/api/admin/monitor/process':'process','/admin/sources/transition/':'transition','/api/admin/monitor/transition':'transition'} as Record<string,string>)[url.pathname];
  let returnTo='/admin/sources/';
  try {
    if(action==='check') {
      if(typeof fields.sourceId!=='string'||!catalog.sources.some(source=>source.id===fields.sourceId))throw new MonitorError('source_not_allowlisted');
      if(!(scenarios as readonly unknown[]).includes(fields.scenario))throw new MonitorError('invalid_scenario');
      const job=await store.enqueue(fields.sourceId,fields.scenario as Scenario,`manual:${fields.requestKey}`,Date.now());
      await runJob(store,catalog,job.id,fixtureTransport);await publishQueued(store,catalog);
      returnTo=`/admin/sources/?source=${encodeURIComponent(job.sourceId)}&scenario=${fields.scenario}`;
    } else if(action==='schedule'||action==='process') {
      if(Object.keys(fields).some(key=>!['requestKey','csrf'].includes(key)))throw new InputError({form:'Batch commands accept only their request reference.'});
      const result=await executeBatch(store,catalog,action,fields.requestKey,state);
      return api?new Response(result,{status:200,headers:{...safeHeaders,'Content-Type':'application/json'}}):new Response(null,{status:303,headers:{...safeHeaders,Location:returnTo}});
    }
    else if(action==='transition') {
      if(typeof fields.id!=='string'||!/^c-[a-f0-9]{32}$/.test(fields.id)||!['revert','restore','clear-flag'].includes(String(fields.action)))throw new MonitorError('invalid_transition');
      const integer=(value:unknown)=>typeof value==='number'?value:typeof value==='string'&&/^\d+$/.test(value)?Number(value):NaN;
      const headVersion=integer(fields.headVersion);const candidateVersion=integer(fields.candidateVersion);
      if(!Number.isSafeInteger(headVersion)||headVersion<0||!Number.isSafeInteger(candidateVersion)||candidateVersion<1)throw new MonitorError('invalid_revision');
      const changed=await store.transition(fields.id,fields.action as 'revert'|'restore'|'clear-flag',headVersion,candidateVersion,fields.requestKey,session.identity,Date.now());
      if(!changed)return api?json({error:'stale_revision'},409):view('This revision changed. Reload the current controls before retrying.',409);
    } else return json({error:'route_not_found'},404);
    return api?json(await state()):new Response(null,{status:303,headers:{...safeHeaders,Location:returnTo}});
  } catch(error) {
    if(error instanceof BatchError){
      if(error.code==='command_in_progress'||error.status===503)batchRetry={action:action as BatchAction,key:fields.requestKey};
      const response=api?json({error:error.code},error.status):await view(error.code.replaceAll('_',' ')+'. Retry the same reference for pending work; reload for a new command.',error.status);
      if(error.code==='command_in_progress')response.headers.set('Retry-After','1');
      return response;
    }
    if(error instanceof MonitorError)return api?json({error:error.code},422):view(error.code.replaceAll('_',' '),422);
    throw error;
  }
}
