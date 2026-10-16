export {};
const form=document.querySelector('#search-form');
const input=document.querySelector('#search-input');
const status=document.querySelector('#search-status');
const results=document.querySelector('#search-results');
const error=document.querySelector('#search-error');
const base=document.body.dataset.releaseBase;
let sequence=0;let engine;
input.disabled=false;form.querySelector('button').disabled=false;
form.addEventListener('submit',async event=>{
  event.preventDefault();const request=++sequence;const query=input.value.trim();results.replaceChildren();error.hidden=true;
  if(!query){status.textContent='Enter a word or phrase.';return;}
  if(document.body.dataset.entryCount==='0'){status.textContent='0 entries found in this snapshot.';return;}
  status.textContent='Searching this snapshot…';
  try{
    engine??=import(base+'pagefind/pagefind.js').then(async module=>{await module.options({baseUrl:'/'});return module;});const pagefind=await engine;const found=await pagefind.search(query);
    const entries=await Promise.all(found.results.slice(0,20).map(result=>result.data()));if(request!==sequence)return;
    status.textContent=`${found.results.length} ${found.results.length===1?'entry':'entries'} found in this snapshot.`;
    for(const entry of entries){
      const url=new URL(entry.url,location.origin);if(url.origin!==location.origin||!url.pathname.startsWith(base+'articles/'))continue;
      const li=document.createElement('li');const a=document.createElement('a');a.href=url.pathname+url.hash;a.textContent=entry.meta.title??'Local revision';
      const p=document.createElement('p');p.textContent=entry.plain_excerpt??entry.meta.description??'';li.append(a,p);results.append(li);
    }
  }catch{if(request!==sequence)return;engine=undefined;status.textContent='Search could not be completed.';error.hidden=false;}
});
