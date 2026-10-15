const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),babel=require('@babel/core');
function harness(){
 const store=new Map(),modules=new Map();let session=1;
 const api={getAuthSessionVersion:()=>session,apiRequest:async()=>({data:[]}),getSettings:async()=>({data:{data:{brandName:'Live Brand',privateProviderKey:'must-not-persist'}}}),getTrainingCategories:async()=>({data:{data:[]}}),getTrainings:async()=>({data:{data:[]}})};
 const storage={getItem:async k=>store.get(k)||null,setItem:async(k,v)=>{store.set(k,v)},multiRemove:async keys=>keys.forEach(key=>store.delete(key))};
 function load(relative){const file=path.resolve(relative);if(modules.has(file))return modules.get(file).exports;const mod={exports:{}};modules.set(file,mod);
  const {code}=babel.transformSync(fs.readFileSync(file,'utf8'),{filename:file,presets:['module:@react-native/babel-preset']});
  const req=id=>{if(id.startsWith('@babel/'))return require(id);if(id==='./api')return api;if(id==='./storage')return {__esModule:true,default:storage};if(id==='./contentMapper')return {loadCachedMaterialMatches:async()=>[]};if(id.startsWith('.'))return load(path.resolve(path.dirname(file),id+'.js'));throw Error(id)};
  new Function('require','module','exports',code)(req,mod,mod.exports);return mod.exports;
 }
 return {load,api,store,session:()=>{session++},restart:()=>modules.clear()};
}
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}};

test('public display readers share one request and valid empty results are cached',async()=>{
 const h=harness(),cache=h.load('src/services/publicDataCache.js');let calls=0;const wait=deferred();
 const fetcher=async()=>{calls++;await wait.promise;return []};
 const a=cache.loadPublicDisplayData('training-videos',fetcher),b=cache.loadPublicDisplayData('training-videos',fetcher);
 await new Promise(r=>setImmediate(r));assert.equal(calls,1);wait.resolve();assert.deepEqual(await a,[]);assert.deepEqual(await b,[]);
 await cache.loadPublicDisplayData('training-videos',fetcher);assert.equal(calls,1);
});
test('stale display metadata returns before the refresh and delivers fresh data later',async()=>{
 const h=harness();h.store.set('@policybhandar_public_display_v1:settings',JSON.stringify({value:{brandName:'Saved'},savedAt:1}));
 const cache=h.load('src/services/publicDataCache.js'),wait=deferred(),shown=[];
 const result=await cache.loadPublicDisplayData('settings',async()=>{await wait.promise;return {brandName:'Fresh'}},{onUpdate:v=>shown.push(v.brandName)});
 assert.equal(result.brandName,'Saved');assert.deepEqual(shown,['Saved']);wait.resolve();await new Promise(r=>setImmediate(r));assert.deepEqual(shown,['Saved','Fresh']);
});
test('failed refresh preserves saved metadata across restart',async()=>{
 const h=harness(),cache=h.load('src/services/publicDataCache.js');await cache.loadPublicDisplayData('settings',async()=>({brandName:'Saved'}));
 h.restart();const next=h.load('src/services/publicDataCache.js');const result=await next.loadPublicDisplayData('settings',async()=>{throw Error('timeout')},{refresh:true});assert.equal(result.brandName,'Saved');
});
test('display failures back off, explicit refresh can retry, malformed disk does not crash',async()=>{
 const h=harness();h.store.set('@policybhandar_public_display_v1:settings','{broken');const cache=h.load('src/services/publicDataCache.js');let calls=0;const fail=async()=>{calls++;throw Error('offline')};
 await assert.rejects(cache.loadPublicDisplayData('settings',fail));await assert.rejects(cache.loadPublicDisplayData('settings',fail));assert.equal(calls,1);
 await assert.rejects(cache.loadPublicDisplayData('settings',fail,{refresh:true}));assert.equal(calls,2);
});
test('settings cache stores only display fields and does not persist raw provider configuration',async()=>{
 const h=harness();const settings=await h.load('src/services/appData.js').loadAppSettings();assert.equal(settings.brandName,'Live Brand');assert.deepEqual(settings.raw,{});assert.ok(![...h.store.values()].join('').includes('must-not-persist'));
});
test('client timeout stops alternate routes and saved clients are shown before completion',async()=>{
 const h=harness(),wait=deferred();let calls=0;h.store.set('@policybhandar_clients',JSON.stringify([{id:'local',name:'Fixture'}]));
 const service=h.load('src/services/appData.js');await service.loadClients();
 h.api.apiRequest=async()=>{calls++;await wait.promise;throw Error('timeout')};let cached;
 const request=service.loadClients({onCached:v=>{cached=v}});await new Promise(r=>setImmediate(r));assert.equal(cached[0].id,'local');assert.equal(calls,1);wait.resolve();assert.equal((await request)[0].id,'local');assert.equal(calls,1);
});
test('successful empty client response stops endpoint probing',async()=>{
 const h=harness();let calls=0;h.api.apiRequest=async()=>{calls++;return {data:[]}};
 assert.deepEqual(await h.load('src/services/appData.js').loadClients(),[]);assert.equal(calls,1);
});
test('missing client route can fall back, forbidden route cannot',async()=>{
 const h=harness();let calls=0;h.api.apiRequest=async()=>{calls++;const e=Error('absent');e.response={status:calls===1?404:403};throw e};
 await h.load('src/services/appData.js').loadClients();assert.equal(calls,2);
});
test('client refresh cannot write or return data after an account session changes',async()=>{
 const h=harness(),wait=deferred();h.api.apiRequest=async()=>{await wait.promise;return {data:[{_id:'private',name:'Fixture'}]}};
 const request=h.load('src/services/appData.js').loadClients();await new Promise(r=>setImmediate(r));h.session();wait.resolve();assert.deepEqual(await request,[]);assert.ok(!h.store.has('@policybhandar_clients'));
});
test('overlapping notification reads share one request and a valid empty list is authoritative',async()=>{
 const h=harness(),wait=deferred();let calls=0;h.api.apiRequest=async()=>{calls++;await wait.promise;return {data:[]}};
 const service=h.load('src/services/appData.js'),a=service.loadDynamicNotifications(),b=service.loadDynamicNotifications();assert.equal(calls,1);wait.resolve();assert.deepEqual(await a,[]);assert.deepEqual(await b,[]);await service.loadDynamicNotifications();assert.equal(calls,1);
});
test('notification results do not leak from a previous authenticated session',async()=>{
 const h=harness();h.api.apiRequest=async()=>({data:[{_id:'a',title:'Fixture'}]});const service=h.load('src/services/appData.js');assert.equal((await service.loadDynamicNotifications())[0].id,'a');h.session();h.api.apiRequest=async()=>{throw Error('offline')};assert.deepEqual(await service.loadDynamicNotifications(),[]);
});
test('training list cache includes subsequent pages and preserves it on a failed reload',async()=>{
 const h=harness();let calls=0;h.api.getTrainings=async({page})=>{calls++;return {data:{data:page===1?Array.from({length:100},(_,i)=>({_id:String(i)})):[{_id:'last'}]}}};
 const service=h.load('src/services/trainingData.js');assert.equal((await service.loadTrainingVideos()).length,101);assert.equal(calls,2);h.api.getTrainings=async()=>{throw Error('offline')};assert.equal((await service.loadTrainingVideos({refresh:true})).length,101);
});

test('large content is split into small storage rows and survives restart without truncation',async()=>{
 const h=harness();const cache=h.load('src/services/contentCacheStorage.js');const value={data:Array.from({length:420},(_,i)=>({id:String(i),description:'Insurance '.repeat(250)}))};
 await cache.writeContentCache('fixture',value);assert.ok(h.store.size>2);assert.ok([...h.store.values()].every(v=>v.length<=128*1024));h.restart();assert.deepEqual(await h.load('src/services/contentCacheStorage.js').readContentCache('fixture'),value);
});
test('overlapping cache writes are ordered and old chunks are removed after the new manifest commits',async()=>{
 const h=harness(),cache=h.load('src/services/contentCacheStorage.js');const a=cache.writeContentCache('fixture',{text:'a'.repeat(300000)}),b=cache.writeContentCache('fixture',{text:'b'.repeat(300000)});await Promise.all([a,b]);assert.equal((await cache.readContentCache('fixture')).text[0],'b');assert.equal(h.store.size,4);
 await cache.writeContentCache('fixture',{text:'small'});assert.equal(h.store.size,1);assert.deepEqual(await cache.readContentCache('fixture'),{text:'small'});
});

test('unowned legacy client cache is not flashed before a successful current-account response',async()=>{
 const h=harness(),wait=deferred();h.store.set('@policybhandar_clients',JSON.stringify([{id:'legacy-private',name:'Fixture'}]));h.api.apiRequest=async()=>{await wait.promise;return {data:[{_id:'owned',name:'Current'}]}};let called=false;
 const request=h.load('src/services/appData.js').loadClients({onCached:()=>{called=true}});await new Promise(r=>setImmediate(r));assert.equal(called,false);wait.resolve();assert.equal((await request)[0].id,'owned');
});

test('storage chunk boundaries preserve emoji and other supplementary Unicode characters',async()=>{
 const h=harness(),cache=h.load('src/services/contentCacheStorage.js');const value={text:'a'.repeat(128*1024-10)+'😀 End'};await cache.writeContentCache('fixture',value);
 for(const [key,entry] of h.store)h.store.set(key,Buffer.from(entry,'utf8').toString('utf8'));assert.deepEqual(await cache.readContentCache('fixture'),value);
});
