// Temporary, read-only investigation of this repository's original CI failure.
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {chromium} from '@playwright/test';
const directory=resolve('.git/original-mobile-artifact');mkdirSync(directory,{recursive:true});
execFileSync('gh',['run','download','38990505207','--repo','Leshey-Digital/agentic-bible','--name','browser-evidence','--dir',directory],{stdio:['ignore','pipe','pipe'],timeout:60000});
const selection=JSON.parse(execFileSync('python3',['-c',`
import pathlib,zipfile,json,sys
root=pathlib.Path(sys.argv[1])
paths=[p for p in root.rglob('trace.zip') if 'monitor-source-change' in str(p)]
assert len(paths)==1, 'Original monitoring trace not found'
events=[];resources=[]
with zipfile.ZipFile(paths[0]) as z:
 for name in z.namelist():
  if name.endswith('.trace'):
   events.extend(json.loads(line) for line in z.read(name).decode().splitlines())
  if name.endswith('.network'):
   resources.extend(json.loads(line).get('snapshot',{}) for line in z.read(name).decode().splitlines())
calls=[e for e in events if e.get('type')=='before' and 'scrollWidth' in str(e.get('params',{}))]
assert calls, 'Original overflow evaluation not found'
call=calls[-1];callid=call['callId']
snapshots=[{'name':e['snapshot'].get('snapshotName'),'viewport':e['snapshot'].get('viewport')} for e in events if e.get('type')=='frame-snapshot' and callid in str(e['snapshot'].get('snapshotName',''))]
css=[{'path':r.get('request',{}).get('url','').split('?')[0],'time':r.get('time'),'monotonic':r.get('_monotonicTime'),'started':r.get('startedDateTime'),'status':r.get('response',{}).get('status'),'content':{k:v for k,v in r.get('response',{}).get('content',{}).items() if k in ['mimeType','size','_sha1']},'timings':r.get('timings')} for r in resources if 'editorial.css' in r.get('request',{}).get('url','')]
after=[e for e in events if e.get('type')=='after' and e.get('callId')==callid]
print(json.dumps({'trace':str(paths[0]),'callId':callid,'snapshots':snapshots,'evaluation':{'start':call.get('startTime'),'wall':call.get('wallTime'),'after':[{k:v for k,v in e.items() if k in ['endTime','result','beforeSnapshot','afterSnapshot']} for e in after]},'css':css}))
`,directory],{encoding:'utf8',maxBuffer:1024*1024}));
console.info('Original overflow trace selection: '+JSON.stringify(selection));
const cli=resolve('node_modules/playwright/cli.js');
console.info(execFileSync(process.execPath,[cli,'trace','open',selection.trace],{encoding:'utf8',timeout:30000}).slice(0,2000));
const evidence={run:38990505207,artifact:12084598208,selection,phases:[]};
for(const phase of ['before','after']){
  let child,browser;try{
    const url=await new Promise((done,failed)=>{child=spawn(process.execPath,[cli,'trace','snapshot',selection.callId,'--phase',phase,'--serve'],{stdio:['ignore','pipe','pipe']});let output='';const timer=setTimeout(()=>{child.kill('SIGKILL');failed(Error('snapshot server timeout'));},30000);child.stdout.on('data',chunk=>{output+=chunk;const match=/Serving snapshot at (http:\/\/\S+)/.exec(output);if(match){clearTimeout(timer);done(match[1]);}});child.once('exit',code=>{clearTimeout(timer);failed(Error('snapshot server exited '+code));});child.once('error',failed);});
    browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();await page.goto(url);await page.waitForURL(url=>url.pathname.startsWith('/snapshot/'),{waitUntil:'load'});await page.waitForLoadState('load');let target;
    for(let n=0;n<100&&!target;n++){for(const frame of page.frames())if(await frame.locator('.monitor-controls').count()){target=frame;break;}if(!target)await new Promise(done=>setTimeout(done,100));}
    if(!target)throw Error('monitoring snapshot did not render');
    const geometry=await target.evaluate(()=>({viewport:innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,grid:getComputedStyle(document.querySelector('.monitor-controls')).gridTemplateColumns,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+.1).slice(0,16).map(e=>({tag:e.tagName,className:e.className,text:e.textContent?.slice(0,100),right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width,minWidth:getComputedStyle(e).minWidth,whiteSpace:getComputedStyle(e).whiteSpace,font:getComputedStyle(e).fontFamily}))}));
    const sheets=await target.evaluate(()=>[...document.querySelectorAll('link[rel=stylesheet]')].map(e=>({path:new URL(e.href).pathname,loaded:!!e.sheet})));
    await target.addStyleTag({content:readFileSync('public/editorial.css','utf8')});
    const withOriginalCss=await target.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,grid:getComputedStyle(document.querySelector('.monitor-controls')).gridTemplateColumns,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+.1).slice(0,12).map(e=>({tag:e.tagName,className:e.className,text:e.textContent?.slice(0,100),right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width}))}));
    evidence.phases.push({phase,sheets,geometry,withOriginalCss});
  }catch(error){evidence.phases.push({phase,error:String(error.message).slice(0,300)});}
  finally{if(browser)await browser.close();if(child&&child.exitCode===null){child.kill('SIGTERM');}}
}
console.info('Original mobile snapshot geometry: '+JSON.stringify(evidence));writeFileSync(resolve('.git/original-mobile-geometry.json'),JSON.stringify(evidence,null,2)+'\n');
execFileSync(process.execPath,[cli,'trace','close'],{stdio:'ignore'});
if(!evidence.phases.some(p=>p.geometry))throw Error('Original mobile geometry could not be recovered');
