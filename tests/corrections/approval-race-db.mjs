import assert from 'node:assert/strict';
// Preserve actual D1 statements/transactions; control only the independently observed schedule.
export function collisionDatabase(db,wins){
  let initial=0,releaseInitial,releaseWinner,releaseLoser;const initialGate=new Promise(done=>releaseInitial=done),winnerDone=new Promise(done=>releaseWinner=done),loserDone=new Promise(done=>releaseLoser=done),native=Symbol('native'),bound=Symbol('bound'),candidates=[];
  function wrap(statement,sql,values=[]){return {[native]:statement,[bound]:values,
    bind(...args){return wrap(statement.bind(...args),sql,args);},
    async first(...args){const result=await statement.first(...args);if(sql==='SELECT * FROM correction_operations WHERE id=?'&&initial<2){assert.equal(result,null,'both initial lookups must finish before either batch');if(++initial===2)releaseInitial();await initialGate;}return result;},
    all(...args){return statement.all(...args);},run(...args){return statement.run(...args);},
  };}
  return {candidates,prepare(sql){return wrap(db.prepare(sql),sql);},async batch(statements){
    const values=statements[0][bound];candidates.push({fingerprint:values[1],submissionId:values[2],version:values[3],createdAt:values[7]});
    if(wins(values)){let result;try{result=await db.batch(statements.map(s=>s[native]));}finally{releaseWinner();}await loserDone;return result;}
    await winnerDone;try{return await db.batch(statements.map(s=>s[native]));}finally{releaseLoser();}
  }};
}
