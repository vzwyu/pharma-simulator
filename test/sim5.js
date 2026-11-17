const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const ctx={console,Math,Date,JSON,Object,Set};vm.createContext(ctx);
['data.js','engine.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(root,'src/js',f),'utf8'),ctx,{filename:f}));
const A=vm.runInContext(`({newGame,endWeek,launchProject,makeRep,computeStats,marketSize,
  salaryTotal,teamRisk,recentAvg,doPromote,applyOrder,S:()=>S,CFG,ACTS,PROJECTS,PRODUCTS,WORLD})`,ctx);

A.newGame('测试','sales',['data','network']);
const S=A.S();
let guard=0, months=[];
while(!S.over && guard++<220){
  while(S.team.length<A.CFG.teamCap[S.level] && S.cash>30) S.team.push(A.makeRep(S));
  vm.runInContext('fileAll()', ctx);
  const terms=S.terminals.slice().sort((a,b)=>b.potential-a.potential);
  S.team.forEach((r,i)=>{
    r.assign={}; r.tactic='standard';
    const a=terms[i%terms.length], b=terms[(i+1)%terms.length];
    r.assign[a.id]={p:A.PRODUCTS.map(p=>p.id),pharm:false};
    if(b.id!==a.id) r.assign[b.id]={p:A.PRODUCTS.map(p=>p.id),pharm:false};
  });
  let g=0;
  while(S.ap>0 && g++<20){
    const sc=A.CFG.costScale[S.level];
    const low=S.terminals.filter(t=>t.access<36).sort((a,b)=>b.potential-a.potential)[0];
    const dev=A.PROJECTS.find(x=>x.id==='dev');
    const need=S.terminals.slice().sort((a,b)=>(b.potential*(1-b.awareness/100))-(a.potential*(1-a.awareness/100)))[0];
    const dept=A.PROJECTS.find(x=>x.id==='dept');
    const r=Math.random();
    if(low && S.cash>dev.cost*sc*3+10 && r<0.5){ A.launchProject('dev',[low.id]); continue; }
    if(need && S.cash>dept.cost*sc*3+8){ A.launchProject('dept',[need.id]); continue; }
    break;
  }
  if(S.cash>40 && S.ap>0 && S.team.some(r=>r.ability<70)) A.launchProject('train',[]);
  const res=A.endWeek();
  if(res.monthReport){
    const r=res.monthReport;
    months.push(r);
    console.log('M'+String(r.month).padStart(2), String(r.sales).padStart(7), (r.share+'%').padStart(6),
      String(r.cash).padStart(7), 'comp',r.compliance, 'rep',r.reputation, 'team',S.team.length, 'L'+S.level);
    if(res.promotion && res.promotion.type==='promote'){
      const pp=res.promotion.progress;
      console.log('  ↗ 晋升 L'+S.level, '| sales', pp.sales.cur.toFixed(1)+'/'+pp.sales.need,
        'share', pp.share.cur.toFixed(1)+'/'+pp.share.need,
        'comp', pp.compliance.cur+'/'+pp.compliance.need,
        'rep', pp.reputation.cur.toFixed(0)+'/'+pp.reputation.need,
        'team', pp.team.cur+'/'+pp.team.need);
      A.doPromote();
    }
    S.pendingPromotion=null;
  }
  // 周会：交替冲量与抓合规
  A.applyOrder(S.totalMonth%3===0?'compliance':'push');
}
console.log('结局', JSON.stringify(S.over), '周数', S.totalWeek);
console.log('--- 终局终端 ---');
S.terminals.forEach(t=>{const c=A.computeStats().terms[t.id];
  console.log(t.name.padEnd(18),'acc',t.access.toFixed(0),'aw',t.awareness.toFixed(0),'rel',t.relation.toFixed(0),'idle',t.idle,'销售',c.total.toFixed(1));});
