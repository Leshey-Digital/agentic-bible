// Test-only proxy: generates a signing key and simulates an already authenticated gateway.
// Production Worker source and verification run unchanged inside actual workerd/D1.
import {createServer} from 'node:http';import {connectedFixture} from '../tests/hosted/connected-fixture.mjs';
const app=await connectedFixture(),local='http://127.0.0.1:8796';
const server=createServer(async(req,res)=>{try{
 if(req.url==='/__controlled/ready'){res.writeHead(200);res.end('ready');return;}
 if(req.url==='/__controlled/state'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({controlledGitHub:true,pullRequests:app.gh.state.pulls.length,canonicalMainUnchanged:app.gh.state.main===app.gh.state.base}));return;}
 const headers=new Headers();for(const[name,value]of Object.entries(req.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(','):value);headers.delete('host');headers.delete('cf-access-jwt-assertion');
 if(headers.get('x-controlled-signed-session')==='authorized')headers.set('cf-access-jwt-assertion',await app.token());headers.delete('x-controlled-signed-session');if(headers.get('origin')===local)headers.set('origin','https://staging.agenticbible.si');
 const chunks=[];for await(const chunk of req)chunks.push(chunk);const response=await app.dispatch(req.url,{method:req.method,headers,body:chunks.length?Buffer.concat(chunks):undefined});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(503);res.end('controlled test server error');}});
server.listen(8796,'127.0.0.1');let closing=false;for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(closing)return;closing=true;server.close();await app.close();process.exit(0);});
