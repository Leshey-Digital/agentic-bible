import os,sys,subprocess,time,json,hashlib,pathlib,signal
root=pathlib.Path('/workspace/agentic-bible'); out=pathlib.Path(__file__).parent
label=sys.argv[1]; command=sys.argv[2:]; log=out/(label+'.log'); receipt=out/(label+'.json')
env=dict(os.environ) if label.startswith('setup-') else {k:os.environ[k] for k in ('PATH','HOME') if k in os.environ}
env.update(CI='1',CHROMIUM_PATH='/usr/bin/chromium',PLAYWRIGHT_BROWSERS_PATH=str(root/'.git/playwright'),ASTRO_TELEMETRY_DISABLED='1',WRANGLER_SEND_METRICS='false',CLOUDFLARE_CF_FETCH_ENABLED='false')
started=time.time(); deadline=300 if label.endswith('release-prepare') else 600
with log.open('xb') as stream:
 p=subprocess.Popen(['python3',str(root/'tests/support/process-supervisor.py'),'--parent-pid',str(os.getpid()),'--',*command],cwd=root,env=env,stdout=stream,stderr=subprocess.STDOUT)
 timedout=False
 try: status=p.wait(timeout=deadline)
 except subprocess.TimeoutExpired:
  timedout=True; p.send_signal(signal.SIGTERM); status=p.wait(timeout=30)
 stream.flush();os.fsync(stream.fileno())
raw=log.read_bytes()
record=dict(label=label,command=command,startedAt=started,durationSeconds=time.time()-started,exit=status,deadlineSeconds=deadline,timedOut=timedout,log=log.name,sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw),cleanup='existing Linux subreaper supervisor exited after stop_group and adopted-child reaping',supervisorPid=p.pid,sourceCommit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),sourceStatus=subprocess.check_output(['git','status','--porcelain=v1'],cwd=root,text=True))
with receipt.open('x') as f: json.dump(record,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
print(json.dumps(record),flush=True)
sys.exit(status if status else (124 if timedout else 0))
