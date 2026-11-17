const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const ctx={console,Math,Date,JSON,Object,Set};vm.createContext(ctx);
['data.js','engine.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(root,'src/js',f),'utf8'),ctx,{filename:f}));
const A=vm.runInContext(`({newGame,makeRep,repCapOf,repLoad,repBase,tacticMulOf,S:()=>S,VISIBLE_TAGS,HIDDEN_TAGS,PUNISH})`,ctx);
A.newGame('t');const S=A.S();
const reps=[];
for(let i=0;i<400;i++) reps.push(A.makeRep(S));

const visCnt={},hidCnt={},capDist={};
reps.forEach(r=>{
  r.tags.forEach(t=>visCnt[t]=(visCnt[t]||0)+1);
  r.hidden.forEach(t=>hidCnt[t]=(hidCnt[t]||0)+1);
  const c=A.repCapOf(r).toFixed(1);
  capDist[c]=(capDist[c]||0)+1;
});
console.log('可见标签分布', Object.entries(visCnt).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+':'+(v/400*100).toFixed(0)+'%').join('  '));
console.log('标签数分布', [1,2].map(n=>n+'个:'+reps.filter(r=>r.tags.length===n).length).join(' '));
console.log('隐藏个数', [1,2,3].map(n=>n+'个:'+reps.filter(r=>r.hidden.length===n).length).join(' '));
console.log('隐藏标签分布', Object.entries(hidCnt).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+':'+(v/400*100).toFixed(0)+'%').join('  '));
console.log('当量上限分布', Object.entries(capDist).sort((a,b)=>a[0]-b[0]).map(([k,v])=>k+':'+v).join('  '));

// 单标签对照
console.log('\n单标签对照（同能力 60）');
['grinder','scholar','rookie','oldfox','analyst','ironman','parachute'].forEach(id=>{
  const r=A.makeRep(S,{traitId:id,ability:60});
  // 强制只保留主标签以便对照（不改数据，只展示第一个标签的影响）
  console.log(' ',id.padEnd(10),'cap',A.repCapOf(r).toFixed(1),'base',A.repBase(r).toFixed(3),
    'ct',r.ct.toFixed(0),'salary',r.salary.toFixed(2),'tags',r.tags.join('+'),'hid',r.hidden.join('+'));
});
