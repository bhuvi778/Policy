const test=require('node:test'); const assert=require('node:assert/strict');
const fs=require('node:fs'); const path=require('node:path'); const babel=require('@babel/core');
function harness() {
 const store=new Map(), modules=new Map(); let failDisk=false;
 const calls=[];
 const api={BASE_URL:'https://api2.primeimpact.in',updateProfile:async(p,o)=>{calls.push({p,o});throw Error('offline');},getProfile:async()=>({data:{user:{_id:'a',name:'Old'}}})};
 const storage={getItem:async k=>store.get(k)||null,setItem:async(k,v)=>store.set(k,v),setItemDurable:async(k,v)=>{if(failDisk)throw Error('disk full');store.set(k,v)},removeItem:async k=>store.delete(k)};
 function load(relative) {
  const file=path.resolve(__dirname,'..',relative); if(modules.has(file))return modules.get(file).exports;
  const module={exports:{}};modules.set(file,module);
  const {code}=babel.transformSync(fs.readFileSync(file,'utf8'),{filename:file,configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']});
  const req=id=>{if(id==='./api')return api;if(id==='./storage')return {__esModule:true,default:storage};if(id.startsWith('.'))return load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(file),id+'.js')));return require(id)};
  new Function('require','module','exports',code)(req,module,module.exports);return module.exports;
 }
 return {store,calls,api,load,diskFails:()=>{failDisk=true},restart:()=>modules.clear()};
}
const user={_id:'a',name:'Old',email:'old@test.example',designation:'Agent'};
const patch={name:'New Advisor',email:'new@test.example',designation:'Agent',dob:'1990-01-01',pinCode:'110001',licBranch:'Delhi'};
const options={token:'fixture-token',extractUser:d=>d?.user};
test('profile save updates locally before any network call and survives restart after timeout',async()=>{
 const h=harness();let s=h.load('src/services/profileSync.js');const local=await s.queueProfileUpdate(user,patch);
 assert.equal(local.name,patch.name);assert.equal(h.calls.length,0);
 const result=await s.syncQueuedProfile(local,options);assert.equal(result.synced,false);assert.equal(result.user.name,patch.name);
 h.restart();s=h.load('src/services/profileSync.js');const restored=await s.restorePendingProfile(user);
 assert.equal(restored.pinCode,'110001');assert.equal(restored.name,patch.name);assert.ok(restored._pendingProfilePatch);
 assert.equal((await s.restorePendingProfile({_id:'b',name:'Other'})).name,'Other');
});
test('disk failure rejects the save before changing the visible profile',async()=>{
 const h=harness();h.diskFails();await assert.rejects(h.load('src/services/profileSync.js').queueProfileUpdate(user,patch),/disk full/);assert.equal(h.store.size,0);assert.equal(user.name,'Old');
});
test('successful confirmed sync clears only the acknowledged pending revision',async()=>{
 const h=harness();const s=h.load('src/services/profileSync.js');const local=await s.queueProfileUpdate(user,patch);
 h.api.updateProfile=async p=>({data:{user:{...user,...p}}});const synced=await s.syncQueuedProfile(local,options);
 assert.equal(synced.synced,true);assert.equal(synced.user.name,patch.name);assert.equal(synced.user._pendingProfilePatch,undefined);
 assert.equal((await s.restorePendingProfile(user))._pendingProfilePatch,undefined);
});
test('200 with unchanged server values remains pending instead of reporting a false success',async()=>{
 const h=harness();const s=h.load('src/services/profileSync.js');const local=await s.queueProfileUpdate(user,patch);
 h.api.updateProfile=async()=>({data:{user}});const result=await s.syncQueuedProfile(local,options);
 assert.equal(result.synced,false);assert.equal(result.user.name,patch.name);assert.ok(result.user._pendingProfilePatch);
});
test('validation errors remain visible and do not auto-retry the same invalid request',async()=>{
 const h=harness();const s=h.load('src/services/profileSync.js');const local=await s.queueProfileUpdate(user,patch);let count=0;
 h.api.updateProfile=async()=>{count++;const e=Error('Invalid email');e.response={status:422};throw e;};
 const result=await s.syncQueuedProfile(local,options);assert.equal(result.user._profileSyncStatus,'blocked');
 await s.syncQueuedProfile(result.user,options);assert.equal(count,1);
});
test('an older in-flight update cannot erase a newer edit',async()=>{
 const h=harness();const s=h.load('src/services/profileSync.js');const local=await s.queueProfileUpdate(user,patch);let release,started;
 const entered=new Promise(r=>{started=r});const wait=new Promise(r=>{release=r});
 h.api.updateProfile=async p=>{started();await wait;return {data:{user:{...user,...p}}}};
 const syncing=s.syncQueuedProfile(local,options);await entered;
 const newest=await s.queueProfileUpdate(local,{...patch,name:'Newest'});release();assert.equal(await syncing,null);
 assert.equal((await s.restorePendingProfile(user)).name,'Newest');assert.ok(newest._pendingProfilePatch);
});
test('logout during a request cannot commit its response into another session',async()=>{
 const h=harness();const s=h.load('src/services/profileSync.js');const local=await s.queueProfileUpdate(user,patch);let current=true;
 h.api.updateProfile=async p=>{current=false;return {data:{user:{...user,...p}}}};
 assert.equal(await s.syncQueuedProfile(local,{...options,isCurrent:()=>current}),null);
 assert.ok((await s.restorePendingProfile(user))._pendingProfilePatch);
});
