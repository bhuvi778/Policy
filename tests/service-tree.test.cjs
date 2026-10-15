const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const babel = require('@babel/core');

function harness() {
  const store = new Map();
  const api = {
    getMaterialCategories: async () => ({data:[{_id:'cat',name:'Agent'}]}),
    getAllMaterialSubcategories: async () => ({data:[{_id:'motor',categoryId:'cat',name:'Motor'}]}),
    getMaterialSubcategories: async () => ({data:[]}),
  };
  const module = {exports:{}};
  const {code} = babel.transformSync(fs.readFileSync('src/services/materialServiceTree.js','utf8'), {
    filename:'src/services/materialServiceTree.js',presets:['module:@react-native/babel-preset'],
  });
  const req = id => {
    if(id.startsWith('@babel/'))return require(id);
    if(id==='./api')return api;
    if(id==='./storage')return {__esModule:true,default:{getItem:async k=>store.get(k)||null,setItem:async(k,v)=>store.set(k,v)}};
    if(id.endsWith('materialServiceTreeSnapshot.json'))return [];
    throw Error(id);
  };
  new Function('require','module','exports',code)(req,module,module.exports);
  return {api,store,tree:module.exports};
}

test('service categories and the subcategory list start together',async()=>{
  const h=harness();let release,subcategoriesStarted=false;
  const blocked=new Promise(r=>{release=r;});
  h.api.getMaterialCategories=async()=>{await blocked;return {data:[{_id:'cat',name:'Agent'}]};};
  h.api.getAllMaterialSubcategories=async()=>{subcategoriesStarted=true;return {data:[]};};
  const pending=h.tree.fetchMaterialServiceTree({timeout:200});
  await new Promise(r=>setImmediate(r));
  try {assert.equal(subcategoriesStarted,true);}finally{release();await pending;}
});

test('overlapping service tree readers share one request before disk cache resolves',async()=>{
  const h=harness();let categoryCalls=0,subCalls=0,release;
  const blocked=new Promise(r=>{release=r;});
  h.api.getMaterialCategories=async()=>{categoryCalls++;await blocked;return {data:[{_id:'cat',name:'Agent'}]};};
  h.api.getAllMaterialSubcategories=async()=>{subCalls++;return {data:[]};};
  const first=h.tree.fetchMaterialServiceTree({timeout:200});
  const second=h.tree.fetchMaterialServiceTree({timeout:200});
  await new Promise(r=>setImmediate(r));
  try {assert.equal(categoryCalls,1);assert.equal(subCalls,1);}finally{release();await Promise.all([first,second]);}
});

test('an older saved tree remains available while the backend is unreachable',async()=>{
  const h=harness();h.store.set('@policybhandar_material_service_tree_v15',JSON.stringify({savedAt:1,groups:[
    {category:{_id:'cat',name:'Agent'},subcategories:[{_id:'motor',categoryId:'cat',name:'Motor'}]},
  ]}));
  const saved=await h.tree.loadCachedMaterialServiceTree({allowStale:true});
  assert.equal(saved[0].tree[0]._id,'motor');
});

test('a failed subcategory connection does not erase saved options or fan out retries',async()=>{
  const h=harness();let childCalls=0;
  h.store.set('@policybhandar_material_service_tree_v15',JSON.stringify({savedAt:Date.now(),groups:[
    {category:{_id:'cat',name:'Agent'},subcategories:[{_id:'motor',categoryId:'cat',name:'Motor'}]},
  ]}));
  h.api.getAllMaterialSubcategories=async()=>{throw Error('connection timed out');};
  h.api.getMaterialSubcategories=async()=>{childCalls++;return {data:[]};};
  const result=await h.tree.fetchMaterialServiceTree();
  assert.equal(result[0].tree[0]._id,'motor');assert.equal(childCalls,0);
});
