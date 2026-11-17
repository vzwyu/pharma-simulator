/* 无头跑盘 v2：验证多终端 / 多品种 / 医共体 / 延迟项目 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ctx = { console, Math, Date, JSON, Object, Set };
vm.createContext(ctx);
['data.js', 'engine.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, 'src/js', f), 'utf8'), ctx, { filename: f });
});

const A = vm.runInContext(`({
  newGame, settleMonth, launchProject, makeRep, computeStats, totalSales, marketSize,
  salaryTotal, teamRisk, promotionProgress, recentAvg, doPromote, repLoad, S: () => S,
  CFG, ACTS, PROJECTS, PRODUCTS, TACTICS, ALLIANCES, termById, trimAssignments
})`, ctx);

function play(strategy, name) {
  A.newGame('测试');
  const S = A.S();
  let guard = 0;
  const rows = [];

  while (!S.over && guard++ < 70) {
    strategy(S, A);
    const res = A.settleMonth();
    const r = res.report;
    rows.push({
      m: r.month, sales: r.sales, share: r.share, cash: r.cash,
      comp: r.compliance, rep: r.reputation, risk: r.risk,
      team: S.team.length, lvl: S.level, inc: r.incident && r.incident.tier ? r.incident.tier : '',
    });
    if (S.pendingPromotion && S.pendingPromotion.type === 'promote') {
      A.doPromote();
      rows.push({ m: '↗', sales: 0, share: 0, cash: S.cash, comp: S.compliance, rep: S.reputation, risk: 0, team: S.team.length, lvl: S.level, inc: '晋升' });
    }
    S.pendingPromotion = null;
  }
  return { rows, S };
}

const good = (S, A) => {
  while (S.team.length < A.CFG.teamCap[S.level] && S.cash > 30) S.team.push(A.makeRep(S));
  // 每名代表分 2 家医院（含基层），全品种
  const terms = S.terminals.slice().sort((a, b) => b.potential - a.potential);
  S.team.forEach((r, i) => {
    r.assign = {};
    r.tactic = 'standard';
    const a = terms[i % terms.length];
    const b = terms[(i + 1) % terms.length];
    r.assign[a.id] = { p: A.PRODUCTS.map(p => p.id), pharm: false };
    if (b.id !== a.id) r.assign[b.id] = { p: A.PRODUCTS.map(p => p.id), pharm: false };
  });

  let g = 0;
  while (S.ap > 0 && g++ < 25) {
    const low = S.terminals.filter(t => t.access < 38).sort((a, b) => b.potential - a.potential)[0];
    const dev = A.PROJECTS.find(x => x.id === 'dev');
    if (low && S.cash > dev.cost * A.CFG.costScale[S.level] * 2 && S.ap >= 2) {
      A.launchProject('dev', [low.id]); continue;
    }
    const need = S.terminals.slice().sort((a, b) => (b.potential * (1 - b.awareness / 100)) - (a.potential * (1 - a.awareness / 100)))[0];
    const dept = A.PROJECTS.find(x => x.id === 'dept');
    if (need && S.cash > dept.cost * A.CFG.costScale[S.level] * 2) {
      A.launchProject('dept', [need.id]); continue;
    }
    break;
  }
  if (S.cash > 40 && S.ap > 0 && S.team.some(r => r.ability < 70)) A.launchProject('train', []);
  if (A.teamRisk() > 25 && S.cash > 20 && S.ap > 0) A.launchProject('compliance', []);
};

const r = play(good, '稳健');
console.log('月  销售   份额  预算    达标% 人 层 事件');
r.rows.forEach(x => console.log(
  String(x.m).padStart(2), String(x.sales).padStart(6), String(x.share).padStart(5),
  String(x.cash.toFixed(1)).padStart(7), '', String(x.team).padStart(2), String(x.lvl).padStart(2), x.inc || ''
));
console.log('结局', JSON.stringify(r.S.over));
console.log('在途', r.S.pending.length);

// 校验：医共体协同与院边药店
const S = r.S;
console.log('\n--- 医共体检查 ---');
(S.team || []).forEach(rp => {
  const al = A.ALLIANCES[S.level] || [];
  al.forEach(a => {
    const n = a.members.filter(m => rp.assign[m]).length;
    if (n >= 2) console.log(rp.name, '覆盖', a.name, n, '家，当量', A.repLoad(rp).toFixed(2));
  });
});
