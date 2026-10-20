# Read-only comparison of retained manifest-verified bytes and ordinary build.
import pathlib,runpy,json,hashlib
out=pathlib.Path(__file__).parent;decode=runpy.run_path(str(out/'decode-pagefind.py'))['file'];root=pathlib.Path('/workspace/agentic-bible');frozen=root/'release-recovery/2026-10-20/production-launch/assets/pagefind';current=root/'dist/pagefind'
manifest=json.loads((root/'docs/review/staging-module-editorial/local-candidate-manifest.json').read_text())
for module in manifest['modules']:
 path=module.get('sourcePath','')
 if path.startswith('pagefind/'):
  assert hashlib.sha256((frozen/path.removeprefix('pagefind/')).read_bytes()).hexdigest()==module['sha256']
sets=[]
for base in [frozen,current]:
 meta=decode(next(base.glob('*.pf_meta')));terms={}
 for shard in (base/'index').glob('*.pf_index'):
  value=decode(shard);assert len(value)==1
  for word,postings,other in value[0]:
   page=0;normalized=[]
   for delta,positions,fields in postings:
    page+=delta;normalized.append([meta[1][page][0],positions,fields])
   assert word not in terms
   terms[word]=[sorted(normalized),other]
 sets.append({'metadataSorted':sorted(meta[1]),'metadataOther':[meta[0],meta[3:]],'terms':terms})
assert sets[0]==sets[1]
print(json.dumps({'equalAfterDocumentIdentityNormalization':True,'terms':len(sets[0]['terms']),'normalizedSha256':hashlib.sha256(json.dumps(sets[0],sort_keys=True,separators=(',',':')).encode()).hexdigest()}))
