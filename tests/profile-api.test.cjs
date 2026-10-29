const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),babel=require('@babel/core');
function loadApi(){const module={exports:{}};const {code}=babel.transformSync(fs.readFileSync('src/services/api.js','utf8'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']});new Function('module','exports',code)(module,module.exports);return module.exports;}
const reply=()=>({ok:true,status:200,headers:{},text:async()=>JSON.stringify({user:{name:'New'}})});
test('text-only profile update sends JSON, including explicit empty fields',async()=>{
 const original=global.fetch;let request;global.fetch=async(u,o)=>{request=o;return reply()};
 try {await loadApi().updateProfile({name:'New',licBranch:''},{token:'fixture-token'});assert.equal(request.method,'PUT');assert.equal(request.headers['Content-Type'],'application/json');assert.deepEqual(JSON.parse(request.body),{name:'New',licBranch:''});}finally{global.fetch=original;}
});
test('profile multipart fallback preserves explicit clearing and uploaded file fields',async()=>{
 const originalFetch=global.fetch,originalForm=global.FormData;let request;
 global.FormData=class{constructor(){this.fields=[]}append(k,v){this.fields.push([k,v])}};
 global.fetch=async(u,o)=>{request=o;return reply()};
 try {const api=loadApi();await api.updateProfile({name:'New',licBranch:''},{multipart:true});assert.ok(request.body.fields.some(([k,v])=>k==='licBranch'&&v===''));await api.updateProfile({name:'New',profileImage:{uri:'file:///photo.png',name:'photo.png',type:'image/png'}});assert.ok(request.body.fields.some(([k,v])=>typeof v==='object'&&v.uri==='file:///photo.png'));assert.equal(request.headers['Content-Type'],undefined);}finally{global.fetch=originalFetch;global.FormData=originalForm;}
});
test('aborted requests carry a timeout code for pending-sync handling',async()=>{
 const original=global.fetch;global.fetch=async()=>{const e=Error('aborted');e.name='AbortError';throw e;};
 try{await assert.rejects(loadApi().apiRequest('/api/auth/profile',{method:'PUT',body:{name:'New'}}),e=>e.code==='REQUEST_TIMEOUT');}finally{global.fetch=original;}
});

test('automatic public reads back off after connection failure while explicit refresh retries',async()=>{
 const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;throw TypeError('network request failed');};
 try {const api=loadApi();const request=()=>api.apiRequest('/api/materials',{token:null});
  await assert.rejects(request());await assert.rejects(request());assert.equal(calls,1);
  await assert.rejects(api.apiRequest('/api/materials',{token:null,cache:false}));assert.equal(calls,2);
 }finally{global.fetch=original;}
});

test('validation errors are not treated as temporary network failures',async()=>{
 const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;return {ok:false,status:400,text:async()=>JSON.stringify({message:'invalid filter'})};};
 try {const api=loadApi();await assert.rejects(api.apiRequest('/api/materials',{token:null}));await assert.rejects(api.apiRequest('/api/materials',{token:null}));assert.equal(calls,2);}finally{global.fetch=original;}
});
