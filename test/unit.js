const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const ctx={console,Math,Date,JSON,Object,Set};vm.createContext(ctx);
['data.js','engine.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(root,'src/js',f),'utf8'),ctx,{filename:f}));
const A=vm.runInContext(`({newGame,settleMonth,launchProject,makeRep,computeStats,totalSales,
  repLoad,allyMulOf,allianceOf,termById,failRateOf,projectCost,projectAP,S:()=>S,CFG,PROJECTS,PRODUCTS,ALLIANCES})`,ctx);

A.newGame('t');const S=A.S();
const rep=S.team[0];  // 已分配 qy-rm，全品种，pharm
console.log('1) 初始分配');
console.log('  ', JSON.stringify(rep.assign));
console.log('   负荷', A.repLoad(rep).toFixed(2), '(1医院+0品种附加+院边0.12 =', (1+0.16+0.12).toFixed(2),')');

console.log('\n2) 医共体协同');
let st=A.computeStats();
console.log('   qy-rm 医共体', A.allianceOf(S.terminals[0])?.name, '倍率', A.allyMulOf(S.terminals[0]).toFixed(2));
// 让 rep 再负责 cg-wsy（同一医共体 a1）
rep.assign['cg-wsy']={p:['sg','sx','fq'],pharm:false};
st=A.computeStats();
console.log('   加 cg-wsy 后 qy-rm 倍率', A.allyMulOf(S.terminals[0]).toFixed(2), '负荷', A.repLoad(rep).toFixed(2), '(2医院+2*0.16品种+0.12院边+0.2协同)');

console.log('\n3) 院边药店联动');
const retail=S.terminals.find(t=>t.type==='retail');
st=A.computeStats();
console.log('   已分流', st.pharmTaken, '家 / 连锁共', retail.stores, '家 → 连锁效率 ×', st.retailEff.toFixed(2));

console.log('\n4) 延迟项目');
const dev=A.PROJECTS.find(p=>p.id==='dev');
S.ap=9;S.cash=100;
const before=S.terminals[1].access;
const r=A.launchProject('dev',['qy-tcm']);
console.log('   提交:',r.msg,'| pending',S.pending.length,'| 准入未变',S.terminals[1].access===before);
A.settleMonth();
console.log('   结算后 pending',S.pending.length,'| 准入',before.toFixed(1),'→',S.terminals[1].access.toFixed(1));

console.log('\n5) 失败率');
const dept=A.PROJECTS.find(p=>p.id==='dept');
S.terminals.forEach(t=>console.log('  ',t.name.padEnd(16),'科室会失败率',(A.failRateOf(dept,t)*100).toFixed(1)+'%'));

console.log('\n6) 多终端成本');
console.log('   科室会 1/2/3 终端成本',[1,2,3].map(n=>A.projectCost(dept,n).toFixed(1)).join(' / '),
            '| 精力',[1,2,3].map(n=>A.projectAP(dept,n)).join('/'));
