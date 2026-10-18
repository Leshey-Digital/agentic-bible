import {execFileSync} from 'node:child_process';

// SQLite's own completeness parser retains trigger bodies and quoted semicolons.
// D1 exec() splits on newlines; prepare() needs one complete statement at a time.
const parser=`import json,re,sqlite3,sys
statements=[]
pending=''
for character in sys.stdin.read():
 pending+=character
 if character==';' and sqlite3.complete_statement(pending):
  statements.append(pending.strip())
  pending=''
if re.sub(r'--[^\\n]*|/\\*.*?\\*/','',pending,flags=re.S).strip():
 raise ValueError('incomplete repository migration')
print(json.dumps(statements))
`;
export function migrationStatements(sql){
 if(typeof sql!=='string'||Buffer.byteLength(sql)>1048576)throw Error('migration_input_rejected');
 return JSON.parse(execFileSync('python3',['-c',parser],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:5000,maxBuffer:2097152}));
}
