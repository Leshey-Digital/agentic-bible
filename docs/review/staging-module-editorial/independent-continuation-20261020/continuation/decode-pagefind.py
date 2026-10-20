import gzip,struct,pathlib,json

def decode(raw):
 pos=0
 def read():
  nonlocal pos
  lead=raw[pos];pos+=1;major=lead>>5;add=lead&31
  if add<24:n=add
  elif add in (24,25,26,27):
   length=1<<(add-24);n=int.from_bytes(raw[pos:pos+length],'big');pos+=length
  else:raise ValueError(('indefinite or unsupported',pos,lead))
  if major==0:return n
  if major==1:return -1-n
  if major in (2,3):
   v=raw[pos:pos+n];pos+=n;return v.decode() if major==3 else list(v)
  if major==4:return [read() for _ in range(n)]
  if major==5:return {str(read()):read() for _ in range(n)}
  if major==7:return {20:False,21:True,22:None}[n]
  raise ValueError((major,n))
 value=read();assert pos==len(raw);return value

def file(p):
 raw=gzip.decompress(p.read_bytes());assert raw.startswith(b'pagefind_dcd');return decode(raw[len(b'pagefind_dcd'):])
if __name__=='__main__':
 r=pathlib.Path('/workspace/agentic-bible');out=pathlib.Path(__file__).parent
 for label,base in [('frozen',r/'release-recovery/2026-10-20/production-launch/assets/pagefind'),('current',r/'dist/pagefind')]:
  p=next(base.glob('*.pf_meta'));meta=file(p);(out/(label+'-pagefind-meta.json')).write_text(json.dumps(meta,indent=2)+'\n');print(label,'meta',repr(meta))
  for p in (base/'index').glob('*.pf_index'):
   value=file(p);(out/(label+'-'+p.stem+'.json')).write_text(json.dumps(value)+'\n');print(label,p.name,str(value)[:600])
