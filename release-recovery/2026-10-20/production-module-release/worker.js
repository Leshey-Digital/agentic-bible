import a0 from './data/0.bin';
import a1 from './data/1.bin';
import a2 from './data/2.bin';
import a3 from './data/3.bin';
import a4 from './data/4.bin';
import a5 from './data/5.bin';
import a6 from './data/6.bin';
import a7 from './data/7.bin';
import a8 from './data/8.bin';
import a9 from './data/9.bin';
import a10 from './data/10.bin';
import a11 from './data/11.bin';
import a12 from './data/12.bin';
import a13 from './data/13.bin';
import a14 from './data/14.bin';
import a15 from './data/15.bin';
import a16 from './data/16.bin';
import a17 from './data/17.bin';
import a18 from './data/18.bin';
import a19 from './data/19.bin';
import a20 from './data/20.bin';
import a21 from './data/21.bin';
import a22 from './data/22.bin';
import a23 from './data/23.bin';
import a24 from './data/24.bin';
import a25 from './data/25.bin';
import a26 from './data/26.bin';
import a27 from './data/27.bin';
import a28 from './data/28.bin';
import a29 from './data/29.bin';
import a30 from './data/30.bin';
import a31 from './data/31.bin';
import a32 from './data/32.bin';
import a33 from './data/33.bin';
import a34 from './data/34.bin';
import a35 from './data/35.bin';
import a36 from './data/36.bin';
import a37 from './data/37.bin';
import a38 from './data/38.bin';
import a39 from './data/39.bin';
import a40 from './data/40.bin';
import a41 from './data/41.bin';
import a42 from './data/42.bin';
import a43 from './data/43.bin';
import a44 from './data/44.bin';
import a45 from './data/45.bin';
import a46 from './data/46.bin';
import a47 from './data/47.bin';
import a48 from './data/48.bin';
import a49 from './data/49.bin';
import a50 from './data/50.bin';
import a51 from './data/51.bin';
import a52 from './data/52.bin';
import a53 from './data/53.bin';
import a54 from './data/54.bin';
import a55 from './data/55.bin';
import a56 from './data/56.bin';
import a57 from './data/57.bin';
import a58 from './data/58.bin';
import a59 from './data/59.bin';
import a60 from './data/60.bin';
import a61 from './data/61.bin';
import a62 from './data/62.bin';
import a63 from './data/63.bin';
import a64 from './data/64.bin';
import a65 from './data/65.bin';
import a66 from './data/66.bin';
import a67 from './data/67.bin';
import a68 from './data/68.bin';
import a69 from './data/69.bin';
import a70 from './data/70.bin';
import a71 from './data/71.bin';
import a72 from './data/72.bin';
import a73 from './data/73.bin';
import a74 from './data/74.bin';
import a75 from './data/75.bin';
import a76 from './data/76.bin';
import a77 from './data/77.bin';
import a78 from './data/78.bin';
import a79 from './data/79.bin';
import a80 from './data/80.bin';
function makeServer(files,headerRules) {
 const rules=headerRules.map(([pattern,headers])=>[new RegExp('^'+pattern.split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$'),headers]);
 const headersFor=path=>{const h=new Headers();for(const [match,headers]of rules)if(match.test(path))for(const [key,value]of Object.entries(headers))h.set(key,value);return h;};
 return {fetch(request){
  const url=new URL(request.url);let path;try{if(/%(?:2f|5c|00)/i.test(url.pathname))throw Error();path=decodeURIComponent(url.pathname);if(/[\x00-\x1f\x7f\\]/.test(path))throw Error();}catch{return new Response('Bad Request',{status:400,headers:headersFor(url.pathname)});}
  let h=headersFor(path);if(request.method!=='GET'&&request.method!=='HEAD'){h.set('Allow','GET, HEAD');h.set('Cache-Control','no-store');return new Response(null,{status:405,headers:h});}
  const redirect=destination=>{const u=new URL(request.url);u.pathname=destination;h.set('Location',u.pathname+u.search);h.set('Cache-Control','public, max-age=0, must-revalidate');return new Response(null,{status:301,headers:h});};
  const normalized=path.replace(/\/{2,}/g,'/');if(normalized!==path)return redirect(normalized);
  if(path.endsWith('/index.html'))return redirect(path.slice(0,-10));
  if(path.endsWith('.html')&&path!=='/404.html'&&Object.hasOwn(files,path))return redirect(path.slice(0,-5)+'/');
  let key=path.endsWith('/')?path+'index.html':path;
  if(!Object.hasOwn(files,key)&&!path.endsWith('/')&&Object.hasOwn(files,path+'/index.html'))return redirect(path+'/');
  if(!Object.hasOwn(files,key)&&path.endsWith('/')&&Object.hasOwn(files,path.slice(0,-1)+'.html'))key=path.slice(0,-1)+'.html';
  let status=200;if(!Object.hasOwn(files,key)){key='/404.html';status=404;h.set('X-Robots-Tag','noindex, nofollow');}
  const f=files[key];if(!f)return new Response(null,{status:404,headers:h});
  h.set('Content-Type',f.type);h.set('Cache-Control','public, max-age=0, must-revalidate');h.set('ETag',f.etag);h.set('Accept-Ranges','bytes');h.set('Content-Length',String(f.bytes.byteLength));
  const none=request.headers.get('If-None-Match');if(status===200&&none?.split(',').some(x=>x.trim()==='*'||x.trim().replace(/^W\//,'')===f.etag)){h.delete('Content-Length');return new Response(null,{status:304,headers:h});}
  let body=f.bytes;const range=request.headers.get('Range'),ifRange=request.headers.get('If-Range');if(status===200&&range&&(!ifRange||ifRange===f.etag)){
   const m=/^bytes=(\d*)-(\d*)$/.exec(range);let start=0,end=body.byteLength-1;
   if(m&&(m[1]||m[2])){if(!m[1])start=Math.max(0,body.byteLength-Number(m[2]));else{start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]));}}
   if(!m||(!m[1]&&!m[2])||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=body.byteLength||(!m[1]&&Number(m[2])===0)){h.set('Content-Range','bytes */'+body.byteLength);h.set('Content-Length','0');return new Response(null,{status:416,headers:h});}
   h.set('Content-Range',`bytes ${start}-${end}/${body.byteLength}`);body=body.slice(start,end+1);h.set('Content-Length',String(body.byteLength));status=206;
  }
  return new Response(request.method==='HEAD'?null:body,{status,headers:h});
 }};
}
export default makeServer({"/404.html":{bytes:a0,type:"text/html; charset=utf-8",etag:"\"cda3af26228c6417c96708abf5f31fed33235db1c570cd2ff410d3fce9d4b078\""},"/_astro/Base.DyzAbnuc.css":{bytes:a1,type:"text/css; charset=utf-8",etag:"\"ade6311f07edff2e75a0fc268927817daad33886de2d5c38a36cb907bd899695\""},"/_astro/Base.astro_astro_type_script_index_0_lang.D-1rZP_q.js":{bytes:a2,type:"application/javascript",etag:"\"26769de35cc01c885a94f8376ff2a16c7480fd4b7c0319a7c9d46d7905a96dc5\""},"/_astro/_id_.astro_astro_type_script_index_0_lang.psVNdFbS.js":{bytes:a3,type:"application/javascript",etag:"\"4ec3be3eed0379a1ef4a6e9e6f2198cb468092aaea8421e09426a0e74ed0513a\""},"/_astro/_id_.w1YKO1jA.css":{bytes:a4,type:"text/css; charset=utf-8",etag:"\"a5c38bcfb4ce16711d5ea81d0ae7568760cd81a5100b8a90be2b5d061b0343ce\""},"/_astro/contribute.astro_astro_type_script_index_0_lang.C9ulAwNG.js":{bytes:a5,type:"application/javascript",etag:"\"880dde3dc46f8ac7b904d4e011cca2885f342f4a3114c035dffd0bfc50e209bb\""},"/_astro/history.DRb1QIfT.css":{bytes:a6,type:"text/css; charset=utf-8",etag:"\"02d16a266d3948db7137636c8ab6897a5d374c9036314ca6e165302a3130be57\""},"/_astro/search.astro_astro_type_script_index_0_lang.DMqmczpQ.js":{bytes:a7,type:"application/javascript",etag:"\"5f16b31df5d2c74b42cb90d714f408dadc1a6e1450f3461f3ffea19c20a61046\""},"/about/index.html":{bytes:a8,type:"text/html; charset=utf-8",etag:"\"f92a752737d8a111cad45181133532eb9974f2b6b84813280a78dbc1ab495e48\""},"/articles/agent-budgets/index.html":{bytes:a9,type:"text/html; charset=utf-8",etag:"\"059ecae7d7bcf1c49358f20ee319a8d41952eeeca75cdc88d1704837ef0a0ce1\""},"/articles/agent-evaluation/index.html":{bytes:a10,type:"text/html; charset=utf-8",etag:"\"78570779f49f543c26ae3b0b327855260dbb6f25cf0212280bdc7b8bbeb25c42\""},"/articles/agent-identity/index.html":{bytes:a11,type:"text/html; charset=utf-8",etag:"\"a147c1b127c15c1f420970962e123f51389747560f6595e0056da9b28b90d9a3\""},"/articles/agent-memory/index.html":{bytes:a12,type:"text/html; charset=utf-8",etag:"\"9a9d2fd8aca7f2b6e48f6c8001c618535b96e5d1a417756da039f9be0fbc906c\""},"/articles/agent-observability/index.html":{bytes:a13,type:"text/html; charset=utf-8",etag:"\"93bf2cd9ee7f9bbe842370e92cc9a90fb745853e8b83bd5c1baf68d612f88af6\""},"/articles/agent-orchestration/index.html":{bytes:a14,type:"text/html; charset=utf-8",etag:"\"78154ea8f3b1437f70829a380185d5d952740fccb7f337aa755beba12f3d2d95\""},"/articles/agent-planning/index.html":{bytes:a15,type:"text/html; charset=utf-8",etag:"\"710d9323cceec315b7e84697943fb2d587a7a3ad9787ec9083fb3f78703d351d\""},"/articles/agent-sandboxing/index.html":{bytes:a16,type:"text/html; charset=utf-8",etag:"\"3450037516f0ce439e35f4388488d48fc2c7ad0d0d98b0550ffff747302ee41a\""},"/articles/agent-to-agent-communication/index.html":{bytes:a17,type:"text/html; charset=utf-8",etag:"\"f916b9f54ebc365d3b3d6aa3f98c26a58e17ecdb1b3967bd66e58d73130b1853\""},"/articles/ai-agent/index.html":{bytes:a18,type:"text/html; charset=utf-8",etag:"\"ab00b2202393c55c7504fa63bf911a24ee7fa185f8f013d49df6ad36dc56ab88\""},"/articles/computer-use-agents/index.html":{bytes:a19,type:"text/html; charset=utf-8",etag:"\"257bece8792096e09369fa0c78b0ac75867cb97fc1b1fcb1a1ee8101f078724e\""},"/articles/context-engineering/index.html":{bytes:a20,type:"text/html; charset=utf-8",etag:"\"6ce3a67934bacd7bb2e377efab9db52990e3bd6df0913de2738de3dd409afb54\""},"/articles/durable-agent-execution/index.html":{bytes:a21,type:"text/html; charset=utf-8",etag:"\"51a96fbc5b969b2cb8489e827d21b1eaa954e6a66da9b0fa9438b7d83e1699b2\""},"/articles/human-oversight/index.html":{bytes:a22,type:"text/html; charset=utf-8",etag:"\"be247b239ae63d8080a0a3054016f71c3be73b12e0d9d6c14195b767643012d2\""},"/articles/model-context-protocol/index.html":{bytes:a23,type:"text/html; charset=utf-8",etag:"\"e07329657b1bbdb5cbc3683a499b7c05b202ffc390669b3816c1995790a7871a\""},"/articles/prompt-injection/index.html":{bytes:a24,type:"text/html; charset=utf-8",etag:"\"3d39b58f084a038e7781012b82981b9f7d70af814a531a34509d6167ca8ef6f7\""},"/articles/retrieval-augmented-generation/index.html":{bytes:a25,type:"text/html; charset=utf-8",etag:"\"58396dca9d43587945e054ab1a246a5c559aa15bf608497b7ab8eb19292f7fb5\""},"/articles/structured-outputs/index.html":{bytes:a26,type:"text/html; charset=utf-8",etag:"\"213d3344a19456c98b18221926febe598189b764ec533d6b7711f8a1f7f8dd65\""},"/articles/tool-permissions/index.html":{bytes:a27,type:"text/html; charset=utf-8",etag:"\"ce456a9711e8a8e5ad538631b17f4735b1770897818859c40fefc848d471b73d\""},"/articles/tool-use/index.html":{bytes:a28,type:"text/html; charset=utf-8",etag:"\"9fc35876a0857d053eca18751b99d125f65448e1cefd147ab431c4caea0a70a2\""},"/contribute/index.html":{bytes:a29,type:"text/html; charset=utf-8",etag:"\"2b6073adbd3145a03e33072bffe6b292c19484f63513b3757a11babb49f6b4c3\""},"/editorial.css":{bytes:a30,type:"text/css; charset=utf-8",etag:"\"fb8430a1d0f42d439e0eed76325a144a3422f58d3ed9c7b5f15a3d200b3bbf3d\""},"/favicon.svg":{bytes:a31,type:"image/svg+xml",etag:"\"37ad1c326f180be57cc7f48893ea566cc6b7914659ed0af89f48ccab65b12a3a\""},"/history/index.html":{bytes:a32,type:"text/html; charset=utf-8",etag:"\"23aba9655663bbf492768ddbd762cd664fcf68edec79b796bf94b9a9a60ff2ec\""},"/index.html":{bytes:a33,type:"text/html; charset=utf-8",etag:"\"cd485ccc1b0990c86b6bfc7b8dc5ffa8f802f1dae748586ed2b2389fa3c4367d\""},"/indexing-manifest.json":{bytes:a34,type:"application/json",etag:"\"8625480b5cfe0db24e9ed6fe0fadfa41d0b6e74641bf0943ee26217479641d0f\""},"/maintenance-history.json":{bytes:a35,type:"application/json",etag:"\"f82a21d893f71d8bad773e1bef0ecb7e46e0b9f12a35556023a0337b6eb86cf2\""},"/pagefind/fragment/en_236d6e4.pf_fragment":{bytes:a36,type:"application/octet-stream",etag:"\"b541b9f8c92888776c2bf3030ee4865f02bccf3d74308c1b9561de4d66c632c7\""},"/pagefind/fragment/en_43bdaf5.pf_fragment":{bytes:a37,type:"application/octet-stream",etag:"\"c40f17b076f60287b88a48bfaa417acf26567ebf6f6f576ee4ed84d99eb85a91\""},"/pagefind/fragment/en_4513fe1.pf_fragment":{bytes:a38,type:"application/octet-stream",etag:"\"e02b1a8c2703231b2e5a0729d42174d0c9fe47d98be9248f9c1594d427409940\""},"/pagefind/fragment/en_45ba4a4.pf_fragment":{bytes:a39,type:"application/octet-stream",etag:"\"1d173ad23f34776fe0f06d8f82a43a3f58690fef7e053f5813ce40451a46372e\""},"/pagefind/fragment/en_46176f2.pf_fragment":{bytes:a40,type:"application/octet-stream",etag:"\"fa3fa387d85a31cccecba3c6e76d6ac97a7bfac00aa9c25a3a02f8459f6a5c3b\""},"/pagefind/fragment/en_739e49a.pf_fragment":{bytes:a41,type:"application/octet-stream",etag:"\"8e1cacb964d1f8f2de9782a43c1b4f7874d5068c6cdce1b6c2ffec665475b12e\""},"/pagefind/fragment/en_74942b7.pf_fragment":{bytes:a42,type:"application/octet-stream",etag:"\"2d90f90aa66ae0d7d1323a81c38bae1ed7c338058a6b3485fb169e597d09b947\""},"/pagefind/fragment/en_794a4ec.pf_fragment":{bytes:a43,type:"application/octet-stream",etag:"\"ab9edb0646775b50af80bd2a9a5988eda53d62b0b388b8dbda0f5993945147c2\""},"/pagefind/fragment/en_823590d.pf_fragment":{bytes:a44,type:"application/octet-stream",etag:"\"3ff85de476a4ba30bf72e307e1e7d506afa5453020294a1b66f3561557603282\""},"/pagefind/fragment/en_8b4ae56.pf_fragment":{bytes:a45,type:"application/octet-stream",etag:"\"521bb925cb1f18130c2b34d850983bf6fea7a221c0d3f9d5e027f5e822821683\""},"/pagefind/fragment/en_97656a7.pf_fragment":{bytes:a46,type:"application/octet-stream",etag:"\"540d5182ebf917ba6e3c644d7f17e0e69a76a1030d9d378767a9e818c5153815\""},"/pagefind/fragment/en_9d15f02.pf_fragment":{bytes:a47,type:"application/octet-stream",etag:"\"62e62dd3c05cc0269adf6197186a0ba28b11053894592a4e54afea76236cc918\""},"/pagefind/fragment/en_a37eb2e.pf_fragment":{bytes:a48,type:"application/octet-stream",etag:"\"431818d448355a735699e4bdb01328e358a89247dce3acc3c0bc006f99e47a78\""},"/pagefind/fragment/en_bdba527.pf_fragment":{bytes:a49,type:"application/octet-stream",etag:"\"6cac5e78c3af6f0e369ab2a3a0b716b202e878663c9a5688e3456f18f50848a0\""},"/pagefind/fragment/en_cf368bc.pf_fragment":{bytes:a50,type:"application/octet-stream",etag:"\"055b89947136ec25b5dba8ffad51c123f9bde176ebc84c2cf7e36f071ef5d81a\""},"/pagefind/fragment/en_d1ffe17.pf_fragment":{bytes:a51,type:"application/octet-stream",etag:"\"814aa70a2b37c3c2cf98fbe7eccb5cc09cc12494d53ca30721ef22e24e269d2b\""},"/pagefind/fragment/en_e2cc90b.pf_fragment":{bytes:a52,type:"application/octet-stream",etag:"\"1e3504bb5f12567c5c068d3fc433d5b6b63b6db7d0f2445d60ace90b01ec1712\""},"/pagefind/fragment/en_ea2991b.pf_fragment":{bytes:a53,type:"application/octet-stream",etag:"\"a9e542b16a879fa455ba408b0c642a529f59a7cfdfd27cdec0e3e142bc510235\""},"/pagefind/fragment/en_eadced5.pf_fragment":{bytes:a54,type:"application/octet-stream",etag:"\"25fe25c3225b1dcf1f98c978bd3e5a9ad3aab1cd457f8437656243228611e21b\""},"/pagefind/fragment/en_f11189b.pf_fragment":{bytes:a55,type:"application/octet-stream",etag:"\"6b02d383ef32f7415262746aef10c8e01fd72aec43ebb3403409f4cc1331c948\""},"/pagefind/index/en_708815b.pf_index":{bytes:a56,type:"application/octet-stream",etag:"\"acea79a23243e840173b2839c9618773cbe4cf757bc2b0ba03ef9353600a4f43\""},"/pagefind/index/en_a3d517c.pf_index":{bytes:a57,type:"application/octet-stream",etag:"\"d7f5e9b2550b6b1ac68f269e6aa8d426f978b52fc9af734edb5263838bffe0bf\""},"/pagefind/pagefind-component-ui.css":{bytes:a58,type:"text/css; charset=utf-8",etag:"\"de389c7e5d87d6e2b10d65fb1e36e8989a12a2ad8dd6239b7e070d81fb5d8b0d\""},"/pagefind/pagefind-component-ui.js":{bytes:a59,type:"application/javascript",etag:"\"958620129dd14bd851805daeb12ce708bd63b9287325d1d5ae6f73a04d1723f8\""},"/pagefind/pagefind-entry.json":{bytes:a60,type:"application/json",etag:"\"34815758abdfb06620072f6784c07936a7718e52f40b5e2214a1cec0e28f8724\""},"/pagefind/pagefind-highlight.js":{bytes:a61,type:"application/javascript",etag:"\"04741266a86911636cefc41c8b407e380dda99b7d208724f700f94cdf57e37b5\""},"/pagefind/pagefind-modular-ui.css":{bytes:a62,type:"text/css; charset=utf-8",etag:"\"653ab29e4de5629f6ddf5f6fcdf5d2b3eb539a8c07fff8a56b8ce2156a570788\""},"/pagefind/pagefind-modular-ui.js":{bytes:a63,type:"application/javascript",etag:"\"f3efa0f74b305ccab0bc9edc7c09ab69867180b4c43093d84bb9b508ac4ec32c\""},"/pagefind/pagefind-ui.css":{bytes:a64,type:"text/css; charset=utf-8",etag:"\"e113b816110ed07b017613e901addfe635350f2a5b84990aa76c91a74b158084\""},"/pagefind/pagefind-ui.js":{bytes:a65,type:"application/javascript",etag:"\"2efa93f2e80a199ca742a69bd4cfffabc5c591ebe7763f64f7c655fd00d2209f\""},"/pagefind/pagefind-worker.js":{bytes:a66,type:"application/javascript",etag:"\"4ca50d25bcab9e1c3afbc00ab5f7761114e83c8fc1b83d38655af1558b650c2a\""},"/pagefind/pagefind.en_83825bc69a.pf_meta":{bytes:a67,type:"application/octet-stream",etag:"\"bf69fd4fe229474ef472d1d0302589fed55f0570d558fc6ff948a0eb36e55aa9\""},"/pagefind/pagefind.js":{bytes:a68,type:"application/javascript",etag:"\"252d272bd34d483d19a752060f6a065114d15ab12c42d8f905ca565e2768a009\""},"/pagefind/wasm.en.pagefind":{bytes:a69,type:"application/octet-stream",etag:"\"bb16c9e6d3d214d4d05cccca51df7b487b86b3657318da767f6ca9e0a2e7259d\""},"/pagefind/wasm.unknown.pagefind":{bytes:a70,type:"application/octet-stream",etag:"\"3a74cefceacd066e8d3bc8c52e7bc1c869544ca3d9031b44a9b7136356d5d7f4\""},"/release-source.json":{bytes:a71,type:"application/json",etag:"\"70601c9ce1abbbbf2a93a9e1293cec3fca85ec98d2f3286fc6e5dcd86680b9d2\""},"/review/index.html":{bytes:a72,type:"text/html; charset=utf-8",etag:"\"499d014f1c19ae1d02cd477fa41c346d97187a67c4a86b5cf51a125240829456\""},"/robots.txt":{bytes:a73,type:"text/plain; charset=utf-8",etag:"\"49a3c8932e1627f275468179f5a85126bdedf04374fc4026ed5d8efc1f4da81a\""},"/search/index.html":{bytes:a74,type:"text/html; charset=utf-8",etag:"\"9cf92cb1345fa071d0b39b0f4d180d46dee108d4ca44d849c0c83633e7ead8a4\""},"/sitemap.xml":{bytes:a75,type:"application/xml",etag:"\"4bc60d0371018867e40074d23f5bb7368e0cf49a7e00f6bf849efc34c627155b\""},"/source-catalog.json":{bytes:a76,type:"application/json",etag:"\"70ffc54d7e3af04162e3d7528f62335d553d3a74b12726b58893e276ddbdf419\""},"/topics/capabilities/index.html":{bytes:a77,type:"text/html; charset=utf-8",etag:"\"c58a86c3585980d6b26ffdbd20aa99d3b557829d49320b02dafd0fb8a8e6ef2b\""},"/topics/foundations/index.html":{bytes:a78,type:"text/html; charset=utf-8",etag:"\"6b1bbf629c345f1701d273ddfe79ab5377fe3b7d170314680ea2b41ac53027df\""},"/topics/index.html":{bytes:a79,type:"text/html; charset=utf-8",etag:"\"41350bd024343acb1aa6e9948e41d7576c1e9ee4d04badabff78c8566962245f\""},"/topics/protocols/index.html":{bytes:a80,type:"text/html; charset=utf-8",etag:"\"217b6bfcb0274bf609cabc7792a9ab975ac4596d0f69de4d31d76bd6a8218943\""}},[["/*",{"X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","Permissions-Policy":"camera=(), microphone=(), geolocation=()","Content-Security-Policy":"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"}],["/admin*",{"X-Robots-Tag":"noindex, nofollow"}],["/api*",{"X-Robots-Tag":"noindex, nofollow"}],["/contribute*",{"X-Robots-Tag":"noindex, nofollow"}],["/search*",{"X-Robots-Tag":"noindex, nofollow"}],["/404*",{"X-Robots-Tag":"noindex, nofollow"}],["/history/tool-use/*",{"X-Robots-Tag":"noindex, nofollow"}],["/history/*/*",{"X-Robots-Tag":"noindex, nofollow"}],["/review*",{"X-Robots-Tag":"noindex, nofollow"}],["/local-publications*",{"X-Robots-Tag":"noindex, nofollow"}],["/wiki-snapshots*",{"X-Robots-Tag":"noindex, nofollow"}],["/fixtures*",{"X-Robots-Tag":"noindex, nofollow"}],["/indexing-manifest.json",{"X-Robots-Tag":"noindex, nofollow"}],["/source-catalog.json",{"X-Robots-Tag":"noindex, nofollow"}],["/release-source.json",{"X-Robots-Tag":"noindex, nofollow"}],["/release.json",{"X-Robots-Tag":"noindex, nofollow"}],["/maintenance-history.json",{"X-Robots-Tag":"noindex, nofollow"}]]);
