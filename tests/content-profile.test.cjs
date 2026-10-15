const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');
function harness() {
  const store = new Map();
  let fail = false;
  const modules = new Map();
  const catalog = {materials:[]};
  const seedCatalog = {templateGroups:[]};
  const api = {
    BASE_URL: 'https://api2.primeimpact.in',
    getMaterials: async () => { if (fail) throw Error('offline'); return { data: { data: [{_id: 'banner1', title: 'Birthday', type: 'Banner', categoryId:'cat',subcategoryId:'sub',fileUrl: 'https://cdn.test/banner.jpg'}], total: 1 } }; },
    getMaterialCategories: async () => { if (fail) throw Error('offline'); return {data: [{_id:'cat',name:'Greetings & Festivals'}]}; },
    getMaterialSubcategories: async () => { if (fail) throw Error('offline'); return {data:[{_id:'sub',name:'Birthday',categoryId:'cat'}]}; },
    getAllMaterialSubcategories: async () => { if (fail) throw Error('offline'); return {data:[]}; },
  };
  function load(relative) {
    const filename = path.resolve(__dirname, '..', relative);
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} }; modules.set(filename, module);
    const {code} = babel.transformSync(fs.readFileSync(filename, 'utf8'), {filename,presets:['module:@react-native/babel-preset']});
    const req = (id) => {
      if (id.startsWith('@babel/')) return require(id);
      if (id === './api') return api;
      if (id === './storage') return {__esModule:true,default: {getItem:async k=>store.get(k)||null,setItem:async(k,v)=>store.set(k,v),getAllKeys:async()=>[...store.keys()],multiRemove:async keys=>keys.forEach(key=>store.delete(key))}};
      if (id === './materialServiceTree') return {loadCachedMaterialServiceTree:async()=>[],getDefaultMaterialServiceTree:()=>[]};
      if (id.endsWith('templateSeedCatalog.json')) return seedCatalog;
      if (id.endsWith('materialCatalogSnapshot.json')) return catalog;
      if (id === '../utils/material') return {isImageUrl:u=>/\.jpg|\.png/.test(u),isVideoUrl:u=>/\.mp4/.test(u)};
      if (id.startsWith('.')) return load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(filename),id+'.js')));
      throw Error(id);
    };
    new Function('require','module','exports',code)(req,module,module.exports);
    return module.exports;
  }
  return {load,store,api,catalog,seedCatalog,restart:()=>modules.clear(),offline:()=>{fail=true;}};
}
test('DOB, PIN and branch survive missing or stale server fields and restart serialization',()=>{
  const {load}=harness(); const f=load('src/utils/profileFields.js');
  const saved=f.applySavedProfileFields({_id:'a',profileImage:'photo'}, {dob:'1994-04-12',pinCode:'110001',licBranch:'Delhi'}, {dob:'',pinCode:'',licBranch:''});
  const restarted=JSON.parse(JSON.stringify(saved));
  const refreshed=f.normalizeProfileFields({...restarted,dob:'',pinCode:'old',licBranch:null});
  assert.equal(refreshed.dob,'1994-04-12'); assert.equal(refreshed.pinCode,'110001'); assert.equal(refreshed.licBranch,'Delhi');
  assert.equal(refreshed.profileImage,'photo');
  assert.equal(f.applySavedProfileFields(saved,{dob:'',pinCode:'',licBranch:''}).dob,'');
  assert.equal(f.normalizeProfileFields({_id:'other'}).dob,undefined);
});
test('profile fields recognize nested backend aliases',()=>{
  const f=harness().load('src/utils/profileFields.js');
  const user=f.normalizeProfileFields({profile:{dateOfBirth:'1990-01-02',pincode:'400001',lic_branch:'Mumbai'}});
  assert.equal(user.dob,'1990-01-02'); assert.equal(user.pinCode,'400001'); assert.equal(user.licBranch,'Mumbai');
  assert.equal(f.normalizeProfileFields({pincode:400001}).pinCode,'400001');
});
test('expired saved content survives failed forced refresh and restart',async()=>{
  const h=harness(); const mapper=h.load('src/services/contentMapper.js');
  const first=await mapper.loadHomeContent({}, {includeTaxonomy:false});
  assert.equal(first.source,'backend');
  assert.ok(Object.values(first.sections).some(a=>a.length));
  for (const [key,value] of h.store) { const payload=JSON.parse(value); payload.savedAt=1; h.store.set(key,JSON.stringify(payload)); }
  h.offline();
  h.restart();
  const fallback=await h.load('src/services/contentMapper.js').loadHomeContent({}, {useCached:false,forceFreshMaterials:true});
  assert.equal(fallback.source,'cache'); assert.deepEqual(fallback.sections,first.sections);
});
test('offline first launch is unavailable, not a confirmed empty catalog',async()=>{
  const h=harness(); h.offline();
  assert.equal((await h.load('src/services/contentMapper.js').loadHomeContent()).source,'unavailable');
});
test('forced taxonomy refresh keeps existing taxonomy when connection fails',async()=>{
  const h=harness(); const mapper=h.load('src/services/contentMapper.js');
  const initial=await mapper.loadHomeContent({}, {includeTaxonomy:true,forceFreshTaxonomy:true});
  assert.equal(initial.source,'backend'); h.offline();
  const next=await mapper.loadHomeContent({}, {includeTaxonomy:true,forceFreshTaxonomy:true});
  assert.equal(next.source,'cache'); assert.deepEqual(next.sections,initial.sections);
});

test('saved supplemental fields return after login without leaking to another account',async()=>{
  const h=harness(); const f=h.load('src/utils/profileFields.js'); const s=h.load('src/services/profileSupplement.js');
  await s.persistProfileSupplement(f.applySavedProfileFields({_id:'account-a'},{dob:'1990-01-01',pinCode:'110001',licBranch:'Delhi'}));
  h.restart(); const reloaded=h.load('src/services/profileSupplement.js');
  assert.equal((await reloaded.restoreProfileSupplement({_id:'account-a',dob:''})).dob,'1990-01-01');
  assert.equal((await reloaded.restoreProfileSupplement({_id:'account-b'})).dob,undefined);
});
test('empty folder placeholders do not count as usable cached content',()=>{
  const f=harness().load('src/utils/contentState.js');
  assert.equal(f.sectionsHaveContent({bannerGroups:[{id:'folder',data:[]}]}),false);
  assert.equal(f.sectionsHaveContent({bannerGroups:[{id:'folder',data:[{id:'banner'}]}]}),true);
});

test('menu section shows its saved data before a failed network refresh',async()=>{
  const h=harness(); const mapper=h.load('src/services/contentMapper.js');
  const initial=await mapper.loadMenuSection('greetings','Birthday',{}, {categoryId:'cat',subcategoryId:'sub'});
  assert.ok(initial.data.length);
  h.offline(); h.restart(); let callback;
  const next=await h.load('src/services/contentMapper.js').loadMenuSection('greetings','Birthday',{}, {categoryId:'cat',subcategoryId:'sub',onCached:value=>{callback=value;}});
  assert.deepEqual(callback.data,initial.data); assert.deepEqual(next.data,initial.data);
});
test('scoped content publishes a fast response before remaining requests finish',async()=>{
  const h=harness(); let release;
  const delayed=new Promise(r=>{release=r;});
  const item={_id:'scoped-banner',type:'Banner',fileUrl:'https://cdn.test/banner.jpg',categoryId:'cat',subcategoryId:'sub'};
  h.api.getMaterials=async params=>{ if (params.subcategoryId) await delayed; return {data:{data:[item],total:1}}; };
  const mapper=h.load('src/services/contentMapper.js'); let partial;
  const pending=mapper.loadHomeContent({}, {includeTaxonomy:true,categoryId:'cat',subcategoryId:'sub',onPartial:value=>{partial=value;}});
  await new Promise(r=>setTimeout(r,30));
  try {assert.ok(partial, 'the category response must be visible while the child request is pending');} finally {release();}
  assert.equal((await pending).source,'backend');
});

test('a slow taxonomy response does not block the selected section materials',async()=>{
  const h=harness(); let release; const taxonomy=new Promise(r=>{release=r;});
  h.api.getMaterialCategories=async()=>{await taxonomy;return {data:[]};};
  const mapper=h.load('src/services/contentMapper.js'); let timer;
  try {
    const result=await Promise.race([
      mapper.loadHomeContent({}, {includeTaxonomy:true,categoryId:'cat',subcategoryId:'sub'}),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('materials waited for taxonomy')),150);}),
    ]);
    assert.equal(result.source,'backend');
  } finally {clearTimeout(timer);release();}
});

test('the first materials page is shown and saved before later pages finish',async()=>{
  const h=harness();let release;const laterPage=new Promise(r=>{release=r;});
  const item={_id:'first-page',type:'Banner',categoryId:'cat',subcategoryId:'sub',fileUrl:'https://cdn.test/first.jpg'};
  h.api.getMaterials=async p=>{
    if(!p.subcategoryId)return {data:{data:[],total:0}};
    if(p.page>1){await laterPage;return {data:{data:[],total:320}};}
    return {data:{data:[item],total:320}};
  };
  const mapper=h.load('src/services/contentMapper.js');let partial;
  const pending=mapper.loadHomeContent({}, {categoryId:'cat',subcategoryId:'sub',onPartial:p=>{partial=p;}});
  await new Promise(r=>setTimeout(r,20));
  try {
    assert.ok(partial,'first page should be visible');
    h.restart();h.offline();
    const restored=await h.load('src/services/contentMapper.js').loadCachedScopedHomeContent({categoryId:'cat',subcategoryId:'sub'});
    assert.ok(restored?.sections.banners.length,'an interrupted load must retain its first page on disk');
  } finally {release();await pending;}
});

test('an unavailable content server does not trigger requests for every descendant',async()=>{
  const h=harness();let calls=0;
  h.api.getMaterials=async()=>{calls++;throw Error('server unavailable');};
  const mapper=h.load('src/services/contentMapper.js');
  mapper.primeCategoryMapFromServiceTree([{category:{_id:'cat',name:'Agent'},subcategories:[
    {_id:'root',categoryId:'cat',name:'Motor'},
    ...Array.from({length:12},(_,i)=>({_id:`child-${i}`,categoryId:'cat',parentSubcategoryId:'root',name:`Motor ${i}`})),
  ]}]);
  assert.equal((await mapper.loadHomeContent({}, {categoryId:'cat',subcategoryId:'root',profileRole:'agent'})).source,'unavailable');
  assert.equal(calls,2,'only the parent and category should be attempted when both cannot connect');
});

test('a successful empty response is distinct from an unavailable server',async()=>{
  const h=harness();h.api.getMaterials=async()=>({data:{data:[],total:0}});
  assert.equal((await h.load('src/services/contentMapper.js').loadHomeContent({}, {categoryId:'cat',subcategoryId:'sub'})).source,'empty');
});

test('Home immediately reuses real materials saved by Menu after restart offline',async()=>{
  const h=harness();
  h.store.set('@policybhandar_menu_content_v1:["agent","motor","cat","sub"]',JSON.stringify({title:'Motor',data:[
    {_id:'motor-banner',categoryId:'cat',subcategoryId:'sub',type:'Banner',fileUrl:'https://cdn.test/motor.jpg'},
  ]}));
  h.offline();
  const result=await h.load('src/services/contentMapper.js').loadHomeContent({}, {profileRole:'agent',categoryId:'cat',subcategoryId:'sub',preferCacheFirst:true});
  assert.equal(result.source,'cache');assert.equal(result.sections.banners[0].id,'motor-banner');
});

test('Home does not borrow a different role or unrelated section from Menu cache',async()=>{
  const h=harness();const data=[{_id:'other',categoryId:'cat',subcategoryId:'birthday',type:'Banner',fileUrl:'https://cdn.test/other.jpg'}];
  h.store.set('@policybhandar_menu_content_v1:["agent","birthday","cat","birthday"]',JSON.stringify({data}));
  h.store.set('@policybhandar_menu_content_v1:["leader","motor","cat","motor"]',JSON.stringify({data:[{...data[0],subcategoryId:'motor'}]}));
  h.offline();
  const result=await h.load('src/services/contentMapper.js').loadHomeContent({}, {profileRole:'agent',categoryId:'cat',subcategoryId:'motor',preferCacheFirst:true});
  assert.equal(result.source,'unavailable');assert.equal(result.sections.banners.length,0);
});

test('an empty Menu section does not repeat the same requests through Home',async()=>{
  const h=harness();let calls=0;h.api.getMaterials=async()=>{calls++;return {data:{data:[],total:0}};};
  const result=await h.load('src/services/contentMapper.js').loadMenuSection('motor','Motor',{}, {categoryId:'cat',subcategoryId:'sub'});
  assert.equal(result.source,'empty');assert.equal(calls,2);
});

test('nested list wrappers and pagination do not drop available materials',async()=>{
  const h=harness();const pages=[];
  h.api.getMaterials=async p=>{
    pages.push(p.page);
    return {data:{data:{materials:[{_id:`banner-${p.page}`,categoryId:'cat',subcategoryId:'sub',type:'Banner',fileUrl:`https://cdn.test/${p.page}.jpg`}],pagination:{total:320}}}};
  };
  const result=await h.load('src/services/contentMapper.js').loadHomeContent({}, {categoryId:'cat',subcategoryId:'sub'});
  assert.equal(result.source,'backend');assert.ok(pages.includes(2));assert.equal(result.sections.banners.length,2);
});

test('a 200 HTML or malformed JSON response is unavailable rather than a false empty catalog',async()=>{
  const h=harness();h.api.getMaterials=async()=>({data:'<html>service unavailable</html>'});
  assert.equal((await h.load('src/services/contentMapper.js').loadHomeContent({}, {categoryId:'cat',subcategoryId:'sub'})).source,'unavailable');
});

test('an invalid optional Reel response does not hide valid primary Home content',async()=>{
  const h=harness();const original=h.api.getMaterials;
  h.api.getMaterials=async p=>p.type==='Reel'?{data:'<html>unavailable</html>'}:original(p);
  assert.equal((await h.load('src/services/contentMapper.js').loadHomeContent()).source,'backend');
});

test('a partial refresh cannot erase previously saved pages after a later page fails',async()=>{
  const h=harness();let partialRefresh=false;
  const items=[1,2].map(i=>({_id:`saved-${i}`,categoryId:'cat',subcategoryId:'sub',type:'Banner',fileUrl:`https://cdn.test/${i}.jpg`}));
  h.api.getMaterials=async p=>{
    if(!partialRefresh)return {data:{data:items,total:2}};
    if(p.page>1)throw Error('later page timed out');
    return {data:{data:[items[0]],total:320}};
  };
  const mapper=h.load('src/services/contentMapper.js');
  await mapper.loadHomeContent({}, {categoryId:'cat',subcategoryId:'sub'});
  partialRefresh=true;let partial;
  const refreshed=await mapper.loadHomeContent({}, {categoryId:'cat',subcategoryId:'sub',useCached:false,onPartial:p=>{partial=p;}});
  assert.equal(partial.sections.banners.length,2);assert.equal(refreshed.sections.banners.length,2);
  h.offline();h.restart();
  assert.equal((await h.load('src/services/contentMapper.js').loadCachedScopedHomeContent({categoryId:'cat',subcategoryId:'sub'})).sections.banners.length,2);
});

test('Menu retains saved materials when a refresh has only a partial successful page',async()=>{
  const h=harness();let partialRefresh=false;
  const items=[1,2].map(i=>({_id:`saved-${i}`,categoryId:'cat',subcategoryId:'sub',type:'Banner',fileUrl:`https://cdn.test/${i}.jpg`}));
  h.api.getMaterials=async p=>{
    if(!partialRefresh)return {data:{data:items,total:2}};
    if(p.page>1)throw Error('later page timed out');
    return {data:{data:[items[0]],total:320}};
  };
  const mapper=h.load('src/services/contentMapper.js');
  await mapper.loadMenuSection('motor','Motor',{}, {categoryId:'cat',subcategoryId:'sub'});
  partialRefresh=true;
  assert.equal((await mapper.loadMenuSection('motor','Motor',{}, {categoryId:'cat',subcategoryId:'sub'})).data.length,2);
});

test('new descendants returned by the recursive Motor endpoint survive an older bundled hierarchy',async()=>{
  const h=harness();h.api.getMaterialCategories=async()=>({data:[]});
  h.api.getMaterials=async p=>({data:{data:p.subcategoryId==='motor'?[{
    _id:'motor-content',categoryId:'cat',subcategoryId:'new-motor-leaf',type:'Banner',fileUrl:'https://cdn.test/motor.jpg',
  }]:[],total:p.subcategoryId==='motor'?1:0}});
  const mapper=h.load('src/services/contentMapper.js');
  mapper.primeCategoryMapFromServiceTree([{category:{_id:'cat',name:'Agent'},subcategories:[{_id:'motor',categoryId:'cat',name:'Motor'}]}],{fresh:false});
  const result=await mapper.loadHomeContent({}, {profileRole:'agent',categoryId:'cat',subcategoryId:'motor',includeTaxonomy:true});
  assert.equal(result.source,'backend');assert.equal(result.sections.banners[0].id,'motor-content');
});

test('recursive scope provenance does not accept an unrelated category or reparent a known sibling',async()=>{
  const h=harness();h.api.getMaterialCategories=async()=>({data:[]});
  h.api.getMaterials=async()=>({data:{data:[
    {_id:'wrong-category',categoryId:'other',subcategoryId:'unknown',type:'Banner',fileUrl:'https://cdn.test/other.jpg'},
    {_id:'wrong-sibling',categoryId:'cat',subcategoryId:'birthday',type:'Banner',fileUrl:'https://cdn.test/birthday.jpg'},
  ],total:2}});
  const mapper=h.load('src/services/contentMapper.js');
  mapper.primeCategoryMapFromServiceTree([{category:{_id:'cat',name:'Agent'},subcategories:[
    {_id:'motor',categoryId:'cat',name:'Motor'},{_id:'birthday',categoryId:'cat',name:'Birthday'},
  ]}]);
  const result=await mapper.loadHomeContent({}, {profileRole:'agent',categoryId:'cat',subcategoryId:'motor'});
  assert.equal(result.sections.banners.length,0);
});

test('bundled or stale fallback hierarchy does not suppress the live bulk taxonomy refresh',async()=>{
  const h=harness();let bulkCalls=0,categoryCalls=0;
  h.api.getAllMaterialSubcategories=async()=>{bulkCalls++;return {data:[{_id:'motor',categoryId:'cat',name:'Motor'},{_id:'new-leaf',categoryId:'cat',parentSubcategoryId:'motor',name:'New Motor Leaf'}]};};
  h.api.getMaterialSubcategories=async()=>{categoryCalls++;throw Error('per-category fan-out should not be needed');};
  h.api.getMaterials=async p=>{await new Promise(r=>setTimeout(r,10));return {data:{data:[{_id:'new-content',categoryId:'cat',subcategoryId:'new-leaf',type:'Banner',fileUrl:'https://cdn.test/new.jpg'}],total:1}};};
  const mapper=h.load('src/services/contentMapper.js');
  mapper.primeCategoryMapFromServiceTree([{category:{_id:'cat',name:'Agent'},subcategories:[{_id:'motor',categoryId:'cat',name:'Motor'}]}],{fresh:false});
  const result=await mapper.loadHomeContent({}, {categoryId:'cat',subcategoryId:'motor',includeTaxonomy:true});
  assert.equal(result.source,'backend');assert.equal(bulkCalls,1);assert.equal(categoryCalls,0);
  assert.ok(result.sections.bannerGroups.some(group=>group.title==='New Motor Leaf'));
});

test('a first installation can open its real bundled section without waiting for the API',async()=>{
  const h=harness();let calls=0;
  h.catalog.materials=[{_id:'real-motor',categoryId:'cat',subcategoryId:'motor',type:'Banner',fileUrl:'https://cdn.test/motor.jpg',isPremium:true},
    {_id:'unrelated',categoryId:'other',subcategoryId:'other',type:'Banner',fileUrl:'https://cdn.test/other.jpg'}];
  h.api.getMaterials=async()=>{calls++;throw Error('offline');};
  const mapper=h.load('src/services/contentMapper.js');
  mapper.primeCategoryMapFromServiceTree([{category:{_id:'cat',name:'Agent'},subcategories:[{_id:'motor',categoryId:'cat',name:'Motor'}]}],{fresh:false});
  const result=await mapper.loadHomeContent({}, {profileRole:'agent',categoryId:'cat',subcategoryId:'motor',preferCacheFirst:true});
  assert.equal(result.source,'cache');assert.equal(result.sections.banners.length,1);assert.equal(result.sections.banners[0].id,'real-motor');
  assert.equal(result.sections.banners[0].raw.isPremium,true);assert.equal(calls,0);
});

test('a complete live response replaces older bundled records and persists the update',async()=>{
  const h=harness();h.catalog.materials=[{_id:'old',categoryId:'cat',subcategoryId:'motor',type:'Banner',fileUrl:'https://cdn.test/old.jpg'}];
  h.api.getMaterials=async()=>({data:{data:[{_id:'new',categoryId:'cat',subcategoryId:'motor',type:'Banner',fileUrl:'https://cdn.test/new.jpg'}],total:1}});
  const mapper=h.load('src/services/contentMapper.js');
  await mapper.loadHomeContent({}, {categoryId:'cat',subcategoryId:'motor',preferCacheFirst:true});
  const live=await mapper.loadHomeContent({}, {categoryId:'cat',subcategoryId:'motor',useCached:false});
  assert.equal(live.source,'backend');assert.deepEqual(live.sections.banners.map(item=>item.id),['new']);
  h.offline();h.restart();
  assert.deepEqual((await h.load('src/services/contentMapper.js').loadCachedScopedHomeContent({categoryId:'cat',subcategoryId:'motor'})).sections.banners.map(item=>item.id),['new']);
});

test('search shows all-catalog matches before a slow server and preserves them on failure',async()=>{
 const h=harness();h.catalog.materials=Array.from({length:160},(_,i)=>({_id:`record-${i}`,title:i===159?'Motor Policy':'Other',type:'Banner',fileUrl:`https://cdn.test/${i}.jpg`}));
 let fail;const pending=new Promise((_,reject)=>{fail=reject});let calls=0;h.api.getMaterials=async()=>{calls++;return pending};
 const mapper=h.load('src/services/contentMapper.js');let cached;
 const request=mapper.searchMaterialContent('motor',{onCached:v=>{cached=v}});await new Promise(r=>setImmediate(r));assert.equal(cached[0].id,'record-159');assert.equal(calls,1);fail(Error('offline'));assert.equal((await request)[0].id,'record-159');
});
test('catalog search follows ancestor names and keeps agent and leader content separate',async()=>{
 const h=harness(),mapper=h.load('src/services/contentMapper.js');mapper.primeCategoryMapFromServiceTree([
 {category:{_id:'agent',name:'Agent'},subcategories:[{_id:'root',name:'Motor Insurance',categoryId:'agent'},{_id:'child',name:'Policy Draw',categoryId:'agent',parentSubcategoryId:'root'}]},
 {category:{_id:'leader',name:'Leader'},subcategories:[]},
 ]);
 h.catalog.materials=[{_id:'a',title:'Policy',categoryId:'agent',subcategoryId:'child',fileUrl:'https://cdn.test/a.jpg'},{_id:'l',title:'Motor Insurance',categoryId:'leader',fileUrl:'https://cdn.test/l.jpg'}];
 assert.deepEqual((await mapper.loadCachedMaterialMatches('MOTOR Insurance',{profileRole:'agent'})).map(v=>v.id),['a']);
 assert.deepEqual((await mapper.loadCachedMaterialMatches('motor',{profileRole:'leader'})).map(v=>v.id),['l']);
});
test('new live content is searchable without re-downloading a broad first page',async()=>{
 const h=harness(),mapper=h.load('src/services/contentMapper.js');mapper.normalizeMaterials([{_id:'new',title:'Fresh Catalogue',fileUrl:'https://cdn.test/new.jpg'}]);
 assert.equal((await mapper.loadCachedMaterialMatches('fresh'))[0].id,'new');
 let calls=0;h.api.getMaterials=async()=>{calls++;return {data:[]}};
 assert.deepEqual(await mapper.searchMaterialContent('no-such-title'),[]);assert.equal(calls,1);
});
test('material normalization uses local taxonomy even when network taxonomy never resolves',async()=>{
 const h=harness();h.api.getMaterialCategories=()=>new Promise(()=>{});let timer;
 try {const result=await Promise.race([h.load('src/services/contentMapper.js').normalizeMaterialsForUser([{_id:'x',fileUrl:'https://cdn.test/x.jpg'}],'Materials',{designation:'Agent'}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('taxonomy blocked normalization')),150)})]);assert.equal(result.length,1);}finally{clearTimeout(timer)}
});

test('a global Menu section shows bundled content while its first live request is pending',async()=>{
 const h=harness();h.catalog.materials=[{_id:'birthday',title:'Birthday wishes',type:'Banner',fileUrl:'https://cdn.test/b.jpg'}];let release;const slow=new Promise(r=>{release=r});h.api.getMaterials=async()=>{await slow;throw Error('offline')};
 let cached;const request=h.load('src/services/contentMapper.js').loadMenuSection('greetings','Greetings',{}, {onCached:v=>{cached=v}});await new Promise(r=>setImmediate(r));assert.ok(cached?.data.some(v=>v.id==='birthday'));release();assert.ok((await request).data.some(v=>v.id==='birthday'));
});
test('a partial refresh updates an existing record while retaining other cached records',async()=>{
 const h=harness();h.catalog.materials=[{_id:'same',title:'Old title',categoryId:'cat',subcategoryId:'sub',type:'Banner',fileUrl:'https://cdn.test/a.jpg'},{_id:'other',title:'Keep me',categoryId:'cat',subcategoryId:'sub',type:'Banner',fileUrl:'https://cdn.test/b.jpg'}];
 let release;const later=new Promise(r=>{release=r});h.api.getMaterials=async p=>{if(p.page>1){await later;throw Error('timeout')}return {data:{data:[{...h.catalog.materials[0],title:'New title'}],total:320}}};
 const mapper=h.load('src/services/contentMapper.js');let partial;const request=mapper.loadHomeContent({}, {categoryId:'cat',subcategoryId:'sub',onPartial:p=>{partial=p}});await new Promise(r=>setTimeout(r,20));assert.equal(partial.sections.banners.find(v=>v.id==='same').title,'New title');assert.ok(partial.sections.banners.some(v=>v.id==='other'));release();await request;
});

test('full cached scopes retain items beyond preview limits after restart',async()=>{
 const h=harness();h.catalog.materials=Array.from({length:420},(_,i)=>({_id:`full-${i}`,title:`Document ${i}`,categoryId:'cat',subcategoryId:'leaf',type:'Banner',fileUrl:`https://cdn.test/${i}.jpg`}));
 const mapper=h.load('src/services/contentMapper.js');const options={categoryId:'cat',subcategoryId:'leaf'};
 const first=await mapper.loadCachedScopedHomeContent(options);const ids=s=>new Set(Object.values(s).flat().flatMap(v=>v.data||[v]).map(v=>v.id));assert.equal(ids(first.sections).size,420);await new Promise(r=>setImmediate(r));h.restart();assert.equal(ids((await h.load('src/services/contentMapper.js').loadCachedScopedHomeContent(options)).sections).size,420);
});
test('older truncated cache is enriched from the real catalog without losing its newer records',async()=>{
 const h=harness();h.catalog.materials=[{_id:'bundle',title:'Bundled',type:'Banner',categoryId:'cat',subcategoryId:'leaf',fileUrl:'https://cdn.test/b.jpg'}];const mapper=h.load('src/services/contentMapper.js');await mapper.loadCachedScopedHomeContent({categoryId:'cat',subcategoryId:'leaf'});await new Promise(r=>setImmediate(r));
 for(const [key,value]of h.store){if(!key.includes('home_sections'))continue;const payload=JSON.parse(value);payload.schemaVersion=19;payload.sections.banners=[{id:'newer',title:'Newer',fileUrl:'https://cdn.test/n.jpg'}];payload.sections.bannerGroups=[];h.store.set(key,JSON.stringify(payload))}
 h.restart();const restored=await h.load('src/services/contentMapper.js').loadCachedScopedHomeContent({categoryId:'cat',subcategoryId:'leaf'});assert.ok(restored.sections.banners.some(v=>v.id==='newer'));assert.ok(restored.sections.banners.some(v=>v.id==='bundle'));
});

test('normalizing local fallback samples never adds them to the real material search or scoped catalog',async()=>{
 const h=harness();h.seedCatalog.templateGroups=[{sectionKey:'reels',section:'Reels & Videos',items:[{title:'Local Demo Fixture',fileUrl:'https://cdn.test/demo.mp4'}]}];
 h.catalog.materials=[{_id:'real',title:'Real fixture',type:'Banner',categoryId:'cat',subcategoryId:'leaf',fileUrl:'https://cdn.test/real.jpg'}];const mapper=h.load('src/services/contentMapper.js');assert.deepEqual(await mapper.loadCachedMaterialMatches('Local Demo Fixture'),[]);
 const result=await mapper.loadCachedScopedHomeContent({categoryId:'cat',subcategoryId:'leaf'});const ids=new Set(Object.values(result.sections).flat().flatMap(v=>v.data||[v]).map(v=>v.id));assert.deepEqual([...ids],['real']);
});

test('newly downloaded records stay searchable after restoring Home cache on the next launch',async()=>{
 const h=harness();h.api.getMaterials=async()=>({data:{data:[{_id:'newly-published',title:'Published today',type:'Banner',fileUrl:'https://cdn.test/newly.jpg'}],total:1}});await h.load('src/services/contentMapper.js').loadHomeContent();h.restart();h.offline();const mapper=h.load('src/services/contentMapper.js');await mapper.loadAnyCachedHomeContent();assert.equal((await mapper.loadCachedMaterialMatches('Published today'))[0].id,'newly-published');
});

test('Motor search uses its taxonomy branch without including Non-Motor items from local or live results',async()=>{
 const h=harness(),mapper=h.load('src/services/contentMapper.js');mapper.primeCategoryMapFromServiceTree([{category:{_id:'cat',name:'Agent'},subcategories:[{_id:'motor',name:'Motor Insurance (Done CC)',categoryId:'cat'},{_id:'car',name:'Car',parentSubcategoryId:'motor',categoryId:'cat'},{_id:'nonmotor',name:'Non-Motor Insurance (Done CC)',categoryId:'cat'},{_id:'work',name:'Work Contract',parentSubcategoryId:'nonmotor',categoryId:'cat'}]}]);
 const motor={_id:'car-policy',title:'Car policy',subcategoryId:'car',categoryId:'cat',fileUrl:'https://cdn.test/car.jpg'},nonmotor={_id:'work-policy',title:'Work Contract Policy',subcategoryId:'work',categoryId:'cat',tags:['Motor Insurance'],fileUrl:'https://cdn.test/work.jpg'};h.catalog.materials=[nonmotor,motor];h.api.getMaterials=async()=>({data:[nonmotor,motor]});
 assert.deepEqual((await mapper.loadCachedMaterialMatches('Motor')).map(v=>v.id),['car-policy']);assert.deepEqual((await mapper.searchMaterialContent('Motor Insurance')).map(v=>v.id),['car-policy']);assert.deepEqual((await mapper.loadCachedMaterialMatches('Non-Motor Insurance')).map(v=>v.id),['work-policy']);
});
test('Hindi search preserves letters and vowel marks instead of returning the entire catalog',async()=>{
 const h=harness(),mapper=h.load('src/services/contentMapper.js');h.catalog.materials=[{_id:'hindi',title:'बीमा सुरक्षा',fileUrl:'https://cdn.test/hindi.jpg'},{_id:'other',title:'Birthday Card',fileUrl:'https://cdn.test/other.jpg'}];assert.deepEqual((await mapper.loadCachedMaterialMatches('बीमा')).map(v=>v.id),['hindi']);assert.deepEqual(await mapper.loadCachedMaterialMatches('पेंशन'),[]);
});

test('a broad Festival search also includes named festival branches',async()=>{
 const h=harness(),mapper=h.load('src/services/contentMapper.js');mapper.primeCategoryMapFromServiceTree([{category:{_id:'greetings',name:'Greetings & Festivals'},subcategories:[{_id:'generic',name:'Festival',categoryId:'greetings'},{_id:'diwali',name:'Diwali',categoryId:'greetings'}]}]);h.catalog.materials=[{_id:'a',title:'Festival wishes',categoryId:'greetings',subcategoryId:'generic',fileUrl:'https://cdn.test/a.jpg'},{_id:'b',title:'Diwali Festival',categoryId:'greetings',subcategoryId:'diwali',fileUrl:'https://cdn.test/b.jpg'}];assert.equal((await mapper.loadCachedMaterialMatches('Festival')).length,2);
});
