import pathlib,json,subprocess,time,sys
out=pathlib.Path(__file__).parent;root=pathlib.Path('/workspace/agentic-bible');plan=json.loads((out/'reconciled-plan.json').read_text());started=time.monotonic()
for index,step in enumerate(plan['remainingProvisional'][1:],19):
 if time.monotonic()-started>=5400: raise SystemExit('independent continuation 90 minute deadline')
 assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==plan['sourceCommit']
 assert not subprocess.check_output(['git','status','--porcelain=v1'],cwd=root,text=True)
 command=['npm','run',step]
 if step=='release:prepare':command+=['--',str(root/'.git/independent-continuation-912c75f-candidate')]
 print('START',index,step,flush=True)
 result=subprocess.run([sys.executable,str(out/'run.py'),str(index)+'-'+step.replace(':','-'),*command])
 if result.returncode:raise SystemExit(result.returncode)
 print('PASS',index,step,flush=True)
