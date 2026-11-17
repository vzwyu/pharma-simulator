/* =========================================================
   engine.js — 游戏状态与结算逻辑（周回合制）
   ========================================================= */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => (arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);
const uid = (() => { let n = 0; return () => 'r' + (++n); })();

let S = null;

/* ---------- 基础查询 ---------- */
function termById(id) { return S.terminals.find(t => t.id === id) || null; }
function tacticOf(r) { return TACTICS.find(x => x.id === r.tactic) || TACTICS[0]; }
function moraleOf(r) { return 0.55 + clamp(r.loyalty, 0, 100) / 100 * 0.55; }
function assignIds(r) { return Object.keys(r.assign || {}); }
function covers(r, tid) { return !!(r.assign && r.assign[tid]); }
function playerMod() { return (S && S.player && S.player.mod) || {}; }

/* ---------- 关系 ---------- */
function relOf(group, id) { return (S.rel && S.rel[group] && S.rel[group][id] != null) ? S.rel[group][id] : 50; }
function relMod(group, id) { return (relOf(group, id) - 50) / 50; }
function relAdd(group, id, d) {
  if (!S.rel || !S.rel[group] || S.rel[group][id] == null) return;
  S.rel[group][id] = clamp(S.rel[group][id] + d, 0, 100);
  if (S.relTouch) S.relTouch[group + ':' + id] = S.totalWeek;
}
function relTouched(group, id) { return (S.relTouch && S.relTouch[group + ':' + id]) || 0; }
function diffCfg() { return DIFFICULTY[S.diff] || DIFFICULTY.normal; }

/* ---------- 政策身份 ---------- */
function policyOf(p, type) {
  let mul = 1, access = 1, price = 0;
  (p.pol || []).forEach(k => {
    const d = POLICIES[k];
    if (!d) return;
    let m = d.mul;
    if (k === 'edl' && (type === 'primary' || type === 'retail')) m = d.primary;
    mul *= m; access *= d.access; price += d.price;
  });
  if (!(p.pol || []).length && (type === 'primary' || type === 'retail')) mul *= 0.88;
  return { mul, access, price };
}

function taOf(t, p) { return (t.taAff && t.taAff[p.ta]) || 0.7; }

const STRAT = {
  academic: { aw: 1.15, price: -0.015, access: 1.00 },
  price:    { aw: 0.85, price: 0.040, access: 1.00 },
  channel:  { aw: 0.90, price: 0.000, access: 1.08 },
};

function productShare(pid) {
  const st = computeStats();
  let num = 0, den = 0;
  S.terminals.forEach(t => { num += st.terms[t.id].items[pid].sales; den += t.potential * ((MIX[t.type] || MIX.hospital)[pid] || 0.25); });
  return den > 0 ? num / den : 0;
}

function outputOf(rep) {
  const st = computeStats();
  let out = 0;
  S.terminals.forEach(t => {
    const c = st.terms[t.id];
    const sum = c.reps.reduce((a, x) => a + x.pw, 0) || 1;
    c.reps.forEach(x => { if (x.id === rep.id) out += c.total * (x.pw / sum); });
  });
  return out;
}

/* ---------- 市场部 ---------- */
function marketTask() {
  const pool = MARKET_TASKS.filter(x => (x.minLevel || 0) <= S.level)
    .slice().sort((a, b) => (b.minLevel || 0) - (a.minLevel || 0));
  const t = pool[S.market.idx % pool.length];
  if (!t) return null;
  let cur = 0;
  if (t.metric === 'case') cur = S.market.cnt.case || 0;
  else if (t.metric === 'edu') cur = S.market.cnt.edu || 0;
  else if (t.metric === 'econ') cur = (S.market.cnt.city || 0) + (S.market.cnt.case || 0);
  else if (t.metric === 'kolrel') cur = relOf('external', 'kol') >= 65 ? 1 : 0;
  else if (t.metric === 'brand') cur = PRODUCTS.filter(p => (p.resWeeks || 0) > 0 || productShare(p.id) >= 0.2).length;
  else if (t.metric === 'covered') cur = new Set(S.team.flatMap(r => Object.keys(r.assign))).size;
  else if (t.metric === 'share') cur = Math.max(...PRODUCTS.map(p => productShare(p.id))) >= 0.22 ? 1 : 0;
  return { task: t, cur, need: t.need, done: cur >= t.need };
}

function grantRes(pid, ratio) {
  const p = PRODUCTS.find(x => x.id === pid);
  if (!p) return { ok: false, msg: '品种不存在' };
  if (relOf('internal', 'marketing') < 30) return { ok: false, msg: '市场部对你还没那么熟（好感 < 30）' };
  const r = Math.max(0, Math.min(1, ratio == null ? 0.5 : ratio));
  const full = +(4 * CFG.costScale[S.level]).toFixed(2);
  const c = +(full * r).toFixed(2);
  if (S.cash < c) return { ok: false, msg: '预算不足' };
  S.cash = +(S.cash - c).toFixed(2);
  p.resWeeks = 8;
  const d = +((r - 0.5) * 20).toFixed(1);
  relAdd('internal', 'marketing', d);
  log('good', `${p.name} 学术资源获批（自出 ${Math.round(r * 100)}%，花费 ${c} 万，好感 ${d >= 0 ? '+' : ''}${d}）。`);
  return { ok: true, msg: `${p.name} 学术资源生效 8 周` };
}

/* ---------- 建人 ---------- */
function pickVisible(n, forceId) {
  const out = [];
  if (forceId) {
    const t = VISIBLE_TAGS.find(x => x.id === forceId);
    if (t) out.push(t);
  }
  while (out.length < n) {
    const pool = VISIBLE_TAGS.filter(x => !out.includes(x));
    if (!pool.length) break;
    out.push(weightedPick(pool));
  }
  return out;
}

function makeRep(state, opt) {
  opt = opt || {};
  const visN = opt.traitId ? 2 : (Math.random() < 0.62 ? 2 : 1);
  const vis = pickVisible(visN, opt.traitId);
  const primary = vis[0];

  const hidN = 1 + (Math.random() < 0.55 ? 1 : 0) + (Math.random() < 0.18 ? 1 : 0);
  const hid = [];
  for (let i = 0; i < hidN; i++) {
    const pool = HIDDEN_TAGS.filter(x => !hid.includes(x));
    if (!pool.length) break;
    hid.push(weightedPick(pool));
  }

  const mod = {
    cap: 0, cov: 0, aw: 0, rel: 0, ct: 0, growth: 0, salary: 0,
    exposure: 0, fail: 0, ally: 0, loyalty0: 0, loyalty: 0, rebate: 0, jobhunt: 0,
  };
  vis.concat(hid).forEach(t => {
    Object.keys(t.eff || {}).forEach(k => { mod[k] = (mod[k] || 0) + t.eff[k]; });
  });

  const ability = opt.ability != null ? opt.ability
    : clamp(rnd(primary.ability[0], primary.ability[1]) + (opt.abilityBoost || 0), 20, 95);

  let name, guard = 0;
  do {
    name = pick(NAMES_SURNAME) + pick(NAMES_GIVEN);
    guard++;
  } while (state && state.team.some(r => r.name === name) && guard < 40);

  const role = opt.role || (Math.random() < 0.12 ? '学术专员' : '代表');
  const baseSalary = ROLES[role].salary * CFG.salaryScale[state ? state.level : 0];
  const salary = +(baseSalary * (0.85 + ability / 200) * (1 + mod.salary) * (opt.salaryBoost || 1)).toFixed(2);

  return {
    id: uid(), name, role,
    tags: vis.map(t => t.id),
    hidden: hid.map(t => t.id),
    revealed: [],
    guesses: [],
    mod,
    ability: +ability.toFixed(1),
    loyalty: +clamp(rnd(primary.loyalty[0], primary.loyalty[1]) + mod.loyalty0, 10, 100).toFixed(1),
    ct: +clamp(rnd(primary.ct[0], primary.ct[1]) + mod.ct, 0, 100).toFixed(1),
    exposure: 0,
    salary,
    filed: !!(opt && opt.filed),
    coach: 0,
    wPref: {},
    assign: {},
    tactic: 'standard',
    months: 0,
    lastWeek: { sales: 0, expo: 0 },
  };
}

function weightedPick(arr) {
  const total = arr.reduce((a, b) => a + (b.weight || 1), 0);
  let r = Math.random() * total;
  for (const it of arr) { r -= (it.weight || 1); if (r <= 0) return it; }
  return arr[arr.length - 1];
}

/* ---------- 标签推断 ---------- */
function hiddenMod(r) {
  const m = {};
  (r.hidden || []).forEach(id => {
    const t = HIDDEN_TAGS.find(x => x.id === id);
    if (!t) return;
    Object.keys(t.eff || {}).forEach(k => { m[k] = (m[k] || 0) + t.eff[k]; });
  });
  return m;
}

function observations(r) {
  const m = hiddenMod(r);
  const out = [];
  if (r.mod && r.mod.jobhunt && r.months >= 8) out.push('最近明显心不在焉');
  if (m.cap <= -0.15) out.push('跑动半径明显小于同岗');
  if (m.cap >= 0.2) out.push('跑动范围比同岗大');
  if (m.cov <= -0.03) out.push('实际覆盖达不到能力应有水平');
  if (m.cov >= 0.04) out.push('产出转化率高于同岗');
  if (m.fail >= 0.04) out.push('交办的动作经常出岔子');
  if (m.fail <= -0.03) out.push('执行细致，很少失手');
  if (r.months >= 3 && m.loyalty <= -0.2) out.push('近几个月状态在往下走');
  if (r.months >= 3 && m.loyalty >= 0.25) out.push('很稳，不爱动');
  if (m.exposure >= 0.15) out.push('风险积累比打法预期快');
  if (m.exposure <= -0.2) out.push('做事比同岗保守');
  if (m.rel >= 0.2) out.push('客户关系推进异常顺利');
  if (m.rel <= -0.25) out.push('跟客户始终处不熟');
  if (m.aw >= 0.15) out.push('产品讲得比一般代表清楚');
  if (m.ally >= 0.02) out.push('和地方上的关系网很熟');
  if (m.rebate <= -0.2) out.push('对某些推广方式明显排斥');
  if (m.salary >= 0.1) out.push('要价明显高于同岗');
  if (r.coached) {
    const HINT = {
      cov: '跟他跑店时，明显感觉他抓不住重点客户，成交转化偏低',
      rel: '跟客户吃饭时他几乎不说话，关系全靠你带',
      aw: '讲产品时他能把机制说清楚，医生愿意听',
      cap: '一天跑三家就累，路线安排也有问题',
      loyalty: '聊到公司时他语气很淡，像是在看机会',
      exposure: '他跟客户谈费用的方式，你听着不太放心',
      fail: '交办的动作经常拖到最后一刻，细节容易出错',
      ally: '他跟卫生院那几个人很熟，明显是本地人',
      salary: '他主动提了薪资，对当前水平不太满意',
      jobhunt: '他接了个电话，回避了你',
      rebate: '他对费用和回扣的说法很敏感，明显在防着你',
      nightowl: '他晚上还在跑店，白天状态一般',
      family: '他说家里孩子小，不太愿意出差',
      chronic: '他体力跟不上，一天跑不了几家',
      drinker: '酒桌上他话最多，医生也买账',
      book: '他手里有一批老客户，但不愿意交到系统里',
      moody: '他情绪起伏大，上周还很有劲，这周就蔫了',
      sidegig: '他总有电话要接，说得躲着你',
      niceguy: '他谁都不得罪，但压量的时候顶不住客户',
      paperwork: '他台账做得比谁都细，但跑的店不多',
      perfect: '他做事极细，速度慢，但几乎不出错',
      procrast: '他答应的事总要拖到最后一天',
    };
    const keys = Object.keys(HINT).filter(k => Math.abs(m[k] || 0) > 0).sort((a, b) => Math.abs(m[b]) - Math.abs(m[a]));
    if (keys.length) out.unshift('带队观察：' + HINT[keys[0]]);
  }
  return out.slice(0, r.coached ? 4 : 3);
}

function unknownCount(r) {
  return Math.max(0, (r.hidden || []).length - (r.revealed || []).length);
}

function guessTag(rid, tagId) {
  const r = S.team.find(x => x.id === rid);
  if (!r) return { ok: false, msg: '没有这个人' };
  r.guesses = r.guesses || [];
  if (r.guesses.length >= 2) return { ok: false, msg: '每个人最多猜 2 次' };
  if (r.guesses.some(g => g.tag === tagId)) return { ok: false, msg: '这个已经猜过了' };
  if ((r.revealed || []).includes(tagId)) return { ok: false, msg: '已经确认过' };
  if (S.ap < 1) return { ok: false, msg: '精力不足，猜人也要花时间' };

  const t = HIDDEN_TAGS.find(x => x.id === tagId);
  if (!t) return { ok: false, msg: '标签不存在' };

  S.ap -= 1;
  const hit = (r.hidden || []).includes(tagId);
  r.guesses.push({ tag: tagId, ok: hit });

  if (hit) {
    r.revealed = (r.revealed || []).concat(tagId);
    r.mod.cap += 0.25;
    r.mod.cov += 0.05;
    r.mod.aw += 0.05;
    log('good', `【带人】你看准了 ${r.name} 是「${t.name}」。管理当量上限 +0.25，覆盖 +5%。`);
    return { ok: true, hit: true, tag: t, msg: `猜中了，他确实是「${t.name}」` };
  }

  r.mod.cov -= 0.06;
  r.loyalty = clamp(r.loyalty - 7, 0, 100);
  log('bad', `【带人】你把 ${r.name} 当成「${t.name}」，判断错了。忠诚 -7，覆盖 -6%。`);
  return { ok: true, hit: false, tag: t, msg: `猜错了，他不是「${t.name}」` };
}

/* ---------- 分配 ---------- */
function setAssign(rid, tid, on) {
  const r = S.team.find(x => x.id === rid);
  if (!r) return;
  if (on) PRODUCTS.forEach(p => setCellRep(tid, p.id, rid));
  else delete r.assign[tid];
}

function setCellRep(tid, pid, rid) {
  let prevOwner = null;
  S.team.forEach(r => {
    const a = r.assign[tid];
    if (!a || r.id === rid) return;
    if (a.p.includes(pid)) prevOwner = r;
    a.p = a.p.filter(x => x !== pid);
    if (!a.p.length && !a.pharm) delete r.assign[tid];
  });
  if (rid && prevOwner && prevOwner.id !== rid) {
    const t = termById(tid);
    if (t) t.handover = 2 + Math.floor(Math.random() * 3);
  }
  if (!rid) return;
  const r = S.team.find(x => x.id === rid);
  if (!r) return;
  if (!r.assign[tid]) r.assign[tid] = { p: [], pharm: false };
  if (!r.assign[tid].p.includes(pid)) r.assign[tid].p.push(pid);
}

function setPharmRep(tid, rid) {
  const t = termById(tid);
  if (!t || !t.pharm) return;
  S.team.forEach(r => {
    const a = r.assign[tid];
    if (!a) return;
    a.pharm = false;
    if (!a.p.length) delete r.assign[tid];
  });
  if (!rid) return;
  const r = S.team.find(x => x.id === rid);
  if (!r) return;
  if (!r.assign[tid]) r.assign[tid] = { p: [], pharm: false };
  r.assign[tid].pharm = true;
}

function trimAssignments(maxHosp) {
  let cut = 0;
  S.team.forEach(r => {
    const ids = assignIds(r).filter(id => { const t = termById(id); return t && t.type === 'hospital'; });
    if (ids.length <= maxHosp) return;
    ids.sort((a, b) => (termById(b).potential) - (termById(a).potential));
    ids.slice(maxHosp).forEach(id => { delete r.assign[id]; cut++; });
  });
  return cut;
}

/* ---------- 负荷与功率 ---------- */
function repCapOf(r) { return clamp(CFG.repCap + (r.mod ? r.mod.cap : 0), 0.8, 4); }

function repLoad(r) {
  let L = 0;
  assignIds(r).forEach(tid => {
    const t = termById(tid); if (!t) return;
    const a = r.assign[tid];
    L += (TYPE_COST[t.type] || 1) + 0.08 * Math.max(0, a.p.length - 1) + (a.pharm ? 0.12 : 0);
  });
  (ALLIANCES[S.level] || []).forEach(al => {
    const n = al.members.filter(m => covers(r, m)).length;
    if (n >= 2) L += 0.2 * (n - 1);
  });
  return L;
}

function repBase(r) {
  const pm = playerMod();
  const fileF = r.filed === false ? 0.55 : 1;
  const coachF = (r.coach || 0) > 0 ? 1.25 : 1;
  return (r.ability / 100) * ROLES[r.role].cov * moraleOf(r) * tacticOf(r).cov
    * (1 + (r.mod ? r.mod.cov : 0)) * (1 + (pm.cov || 0)) * fileF * coachF;
}

function tacticMulOf(r) {
  const t = tacticOf(r);
  return t.mul * (t.id === 'rebate' ? (1 + (r.mod ? r.mod.rebate : 0)) : 1);
}

function allyMulOf(t) {
  if (!t.ally) return 1;
  const al = (ALLIANCES[S.level] || []).find(a => a.id === t.ally);
  if (!al) return 1;
  let best = 1;
  S.team.forEach(r => {
    if (!covers(r, t.id)) return;
    const n = al.members.filter(m => covers(r, m)).length;
    if (n >= 2) best = Math.max(best, 1 + 0.06 * (n - 1) + (r.mod ? r.mod.ally : 0));
  });
  return Math.min(1.2, best);
}

function allianceOf(t) {
  if (!t.ally) return null;
  return (ALLIANCES[S.level] || []).find(a => a.id === t.ally) || null;
}

/* ---------- 全量统计 ---------- */
function computeStats() {
  const st = { terms: {}, total: 0, byProduct: {}, pharmTaken: 0, retailEff: 1, retailId: null };
  PRODUCTS.forEach(p => { st.byProduct[p.id] = 0; });

  const retail = S.terminals.find(t => t.type === 'retail');
  let pharmTaken = 0;
  S.terminals.forEach(t => {
    if (t.pharm > 0 && S.team.some(r => covers(r, t.id) && r.assign[t.id].pharm)) pharmTaken += t.pharm;
  });
  st.pharmTaken = pharmTaken;
  if (retail) {
    st.retailId = retail.id;
    st.retailEff = Math.min(1.8, Math.max(1, retail.stores / Math.max(retail.stores * 0.4, retail.stores - pharmTaken)));
  }
  const retailEff = st.retailEff;
  const orderMul = S.orderMul || 1;

  const info = S.team.map(r => {
    const L = repLoad(r);
    const base = repBase(r);
    const cap = repCapOf(r);
    const overload = L > cap ? Math.pow(cap / L, 0.6) : 1;
    return { r, L, base, overload, mul: tacticMulOf(r) };
  });

  S.terminals.forEach(t => {
    const cov = {};
    PRODUCTS.forEach(p => { cov[p.id] = 0; });
    let covAll = 0, mulW = 0, mulS = 0;
    const reps = [];
    info.forEach(({ r, L, base, overload, mul }) => {
      const a = r.assign[t.id];
      if (!a) return;
      const w = TYPE_COST[t.type] || 1;
      let pw = base * (w / Math.max(L, 0.001)) * overload;
      if (t.type === 'retail') pw *= retailEff;
      (a.p || []).forEach(pid => {
        const pref = (r.wPref && r.wPref[pid]) || 0;
        const wm = pref <= -0.5 ? 0 : 1 + pref;
        cov[pid] = (cov[pid] || 0) + pw * wm;
      });
      covAll += pw;
      mulW += pw; mulS += pw * mul;
      reps.push({ id: r.id, name: r.name, pw, p: a.p.slice(), pharm: a.pharm });
    });

    const tmul = mulW > 0 ? mulS / mulW : 1;
    const am = allyMulOf(t);
    const mix = MIX[t.type] || MIX.hospital;
    const items = {};
    let total = 0;

    const wAvg = PRODUCTS.reduce((a, x) => a + (x.w == null ? 50 : x.w), 0) / PRODUCTS.length || 50;
    PRODUCTS.forEach(p => {
      const m = mix[p.id] != null ? mix[p.id] : 0.25;
      const pol = policyOf(p, t.type);
      const taF = taOf(t, p);
      const stg = STRAT[p.strat || 'academic'];
      const pool = Math.max(1, (S.budgetBase || 30) * (p.budget == null ? 25 : p.budget) / 100);
      const overF = (p.spent || 0) > pool ? 0.7 : 1;
      const resF = ((p.resWeeks || 0) > 0 ? 1.3 : 1) * overF;
      const wF = clamp((p.w == null ? 50 : p.w) / wAvg, 0.35, 2.4);
      const avail = 0.02 + 0.98 * Math.pow(clamp(t.access * taF * stg.access, 0, 100) / 100, 0.7) * pol.access;
      const sens = TA_SENS[p.ta] || { aw: 1, rel: 1 };
      let share = p.base
        + t.awareness / 100 * 0.26 * p.awWeight * stg.aw * resF * sens.aw
        + Math.min((cov[p.id] || 0) * wF, 1.7) * 0.115
        + t.relation / 100 * 0.11 * sens.rel
        - t.comp * 0.16
        + p.priceEdge + pol.price + stg.price;
      const tcmF = (p.cls === 'tcm' && t.tcm) ? 1.16 : 1;
      const baseF = (p.pol && p.pol.includes('edl') && t.type === 'primary') ? 1.15 : 1;
      share = clamp(share, 0, 0.75) * avail * tmul * am * orderMul * pol.mul * tcmF * baseF
        * (t.stockBoost > 0 ? 2.0 : 1)
        * (t.stockBoost === 0 && t.stockDrop > 0 ? (t.stockMul || 0.8) : 1)
        * (t.handover > 0 ? 0.88 : 1)
        * (1 - (p.neglect || 0)) * (distOver() > 0 ? 0.95 : 1);
      const sales = t.potential * m * share;
      items[p.id] = { share, sales, cov: cov[p.id] || 0, ta: taF, pol };
      total += sales;
      st.byProduct[p.id] += sales;
    });

    st.terms[t.id] = { cov, covAll, total, items, reps, am, tmul };
    st.total += total;
  });
  return st;
}

function calcTerminal(t) { return computeStats().terms[t.id]; }
function totalSales() { return S.terminals.reduce((a, t) => a + computeStats().terms[t.id].total, 0); }
function marketSize() { return S.terminals.reduce((a, t) => a + t.potential, 0); }

function distCap() { return 40 + relOf('external', 'distributor') * 0.9; }
function distOver() { return Math.max(0, S.dist.stock - distCap()); }

function relocateStock(ratio) {
  const r = Math.max(0.2, Math.min(0.8, ratio == null ? 0.4 : ratio));
  const c = +(r * 2.5 * CFG.costScale[S.level]).toFixed(2);
  if (S.cash < c) return { ok: false, msg: '预算不足' };
  if (S.dist.stock < 5) return { ok: false, msg: '商业公司没多少库存可调' };
  S.cash = +(S.cash - c).toFixed(2);
  const moved = S.dist.stock * r;
  S.dist.stock = +(S.dist.stock - moved).toFixed(1);
  // 调得越狠，越欠人情
  const fav = +(4 - r * 4).toFixed(1);
  relAdd('external', 'distributor', fav);
  log('good', `协调商业公司跨区调货 ${moved.toFixed(1)} 万（调走 ${Math.round(r * 100)}%），人情 ${fav >= 0 ? '+' : ''}${fav}。`);
  return { ok: true, msg: `调走 ${moved.toFixed(1)} 万库存，商业关系 ${fav >= 0 ? '+' : ''}${fav}` };
}

function teamRisk() {
  if (!S.team.length) return clamp(S.riskMod, 0, 100);
  const avg = S.team.reduce((a, r) => a + r.exposure, 0) / S.team.length;
  return clamp(avg + S.riskMod, 0, 100);
}

function salaryTotal() { return S.team.reduce((a, r) => a + r.salary, 0); }

function recentAvg(n) {
  const h = S.history.slice(-n);
  if (!h.length) return 0;
  return h.reduce((a, x) => a + x.sales, 0) / h.length;
}

function apMax() {
  const pm = playerMod();
  let base = CFG.apBase + Math.floor(S.team.length * CFG.apPerRep);
  if (S.team.length >= 10) base += 1;
  if (S.team.length >= 17) base += 1;
  return Math.min(CFG.apCap, base) + (pm.ap || 0);
}

/* ---------- 新游戏 ---------- */
function newGame(playerName, pathId, tagIds, diffId) {
  generateWorld();
  const dc = DIFFICULTY[diffId] || DIFFICULTY.normal;
  const pm = { ap: 0, cov: 0, growth: 0, fail: 0, dev: 0, compliance: 0, cost: 0, eval: 0, exposure: 0 };
  (tagIds || []).forEach(id => {
    const t = PLAYER_TAGS.find(x => x.id === id);
    if (!t) return;
    Object.keys(t.eff).forEach(k => { pm[k] = (pm[k] || 0) + t.eff[k]; });
  });

  S = {
    playerName: playerName || '王磊',
    path: pathId || 'sales',
    diff: diffId || 'normal',
    player: { path: pathId || 'sales', tags: (tagIds || []).slice(), mod: pm },
    rel: {
      internal: { boss: dc.boss, compliance: dc.relBase + 5, finance: dc.relBase, marketing: dc.relBase, medical: dc.relBase, commercial: dc.relBase, hr: dc.relBase },
      external: { hospital: dc.relBase, distributor: dc.relBase, kol: dc.relBase, association: dc.relBase },
    },
    relTouch: {},
    level: 0,
    weekInMonth: 1,
    monthInAct: 1,
    totalWeek: 1,
    totalMonth: 1,
    year: 2026,
    cash: dc.cash,
    ap: 0,
    compliance: 92,
    reputation: 55,
    riskMod: 0,
    team: [],
    terminals: [],
    candidates: [],
    pending: [],
    pendingEvents: [],
    actLog: {},
    market: { idx: 0, cnt: { case: 0, edu: 0, city: 0 }, since: 1 },
    budgetBase: 30,
    ledger: [],
    dist: { stock: 0 },
    offer: null,
    log: [],
    history: [],
    flags: {},
    over: null,
    lastReport: null,
    wk: { sales: 0, gross: 0, salary: 0, resolved: [], incident: null },
    lastMonth: { cash: CFG.startCash, compliance: 92, reputation: 55 },
    weekLog: [],
    order: null,
    orderMul: 1,
    actExtended: false,
    planThisMonth: [],
    lastPlan: [],
    pendingPromotion: null,
  };
  enterAct(0, false);
  const a = makeRep(S, { traitId: 'grinder', ability: 58, role: '代表', filed: true });
  const b = makeRep(S, { traitId: 'scholar', ability: 55, role: '代表', filed: true });
  a.loyalty = clamp(a.loyalty + dc.loyalty, 0, 100);
  b.loyalty = clamp(b.loyalty + dc.loyalty, 0, 100);
  const t0 = S.terminals[0], t1 = S.terminals[1];
  a.assign[t0.id] = { p: PRODUCTS.map(p => p.id), pharm: true };
  b.assign[t1.id] = { p: PRODUCTS.slice(0, 2).map(p => p.id), pharm: false };
  S.team.push(a, b);
  // 个人标签带来的初始关系
  if (pm.relExt) {
    relAdd('external', 'hospital', pm.relExt * 1.2);
    relAdd('external', 'distributor', pm.relExt * 0.8);
    relAdd('external', 'kol', pm.relExt * 0.6);
    relAdd('external', 'association', pm.relExt * 0.4);
  }
  if (pm.relInt) ['boss', 'compliance', 'finance', 'marketing', 'medical', 'commercial', 'hr'].forEach(k => relAdd('internal', k, pm.relInt));
  if (pm.boss) relAdd('internal', 'boss', pm.boss);
  // 初始维护时间基线
  ['internal', 'external'].forEach(g => Object.keys(S.rel[g]).forEach(k => { S.relTouch[g + ':' + k] = S.totalWeek; }));

  S.ap = apMax();
  log('info', `你接手了${WORLD.county}市场。两个代表，两张桌子，100 万预算。`);
  log('sys', '提示：先看「终端」，把代表放到能出量的地方；准入低于 25 的终端几乎不出量。');
  return S;
}

function enterAct(level, carry) {
  const act = ACTS[level];
  if (carry) (S.career = S.career || []).push({ level: S.level, history: S.history });
  S.level = level;
  S.monthInAct = 1;
  S.weekInMonth = 1;
  S.actExtended = false;
  S.history = [];

  const prev = {};
  if (carry) S.terminals.forEach(t => { prev[t.id] = t; });

  S.terminals = TERMINALS[level].map(def => {
    const t = Object.assign({}, def);
    const p = prev[t.id];
    if (p) {
      t.access = p.access; t.awareness = p.awareness; t.relation = p.relation;
      t.comp = p.comp; t.spend = p.spend || 0; t.idle = p.idle || 0;
    } else {
      const dc0 = diffCfg();
      t.access = clamp(t.access + dc0.access, 0, 100);
      t.awareness = clamp(t.awareness + dc0.awareness, 0, 100);
      t.comp = clamp(t.comp + dc0.comp, 0, 0.95);
    }
    return t;
  });

  S.team.forEach(r => {
    const baseSalary = ROLES[r.role].salary * CFG.salaryScale[level];
    r.salary = +(baseSalary * (0.85 + r.ability / 200) * (1 + r.mod.salary)).toFixed(2);
    assignIds(r).forEach(tid => { if (!S.terminals.some(x => x.id === tid)) delete r.assign[tid]; });
  });
  S.pending = [];
  S.terminals.forEach(t => {
    t.phtOpen = 0;
    t.phtNext = 3 + Math.floor(Math.random() * 12);
  });
  S.ap = apMax();
}

/* ---------- 日志 ---------- */
function pushAct(repId, txt, day, time) {
  S.actLog = S.actLog || {};
  S.actLog[repId] = S.actLog[repId] || [];
  S.actLog[repId].push({ m: S.totalMonth, wk: S.weekInMonth, w: S.totalWeek, d: day, t: time, txt });
  if (S.actLog[repId].length > 40) S.actLog[repId].shift();
}

function log(type, text, week) {
  S.log.unshift({ m: S.totalMonth, w: S.weekInMonth, type, text });
  if (S.log.length > 300) S.log.length = 300;
}

/* ---------- 项目效果：按终端类型 / 画像缩放 ---------- */
const TYPE_EFF = {
  hospital: { aw: 1.00, rel: 1.00, dev: 1.00, cs: 1.30, ch: 0 },
  primary: { aw: 0.72, rel: 1.15, dev: 0.90, cs: 0.50, ch: 1.25 },
  retail: { aw: 0.78, rel: 1.25, dev: 0.85, cs: 0.35, ch: 1.30 },
  city: { aw: 1.00, rel: 1.00, dev: 1.00, cs: 1.00, ch: 0.9 },
  region: { aw: 1.00, rel: 1.00, dev: 1.00, cs: 1.00, ch: 0.9 },
};
const PROF_EFF = {
  academic: { aw: 1.3, rel: 0.9, dev: 1.0, ch: 1.0 },
  relation: { aw: 0.9, rel: 1.3, dev: 1.1, ch: 1.0 },
  price: { aw: 0.85, rel: 1.0, dev: 0.95, ch: 1.25 },
};
function tierF(t) {
  if (t.type !== 'hospital') return 1;
  if (t.tier && t.tier.indexOf('三甲') >= 0) return 1.15;
  if (t.tier && t.tier.indexOf('甲') >= 0) return 1.0;
  return 0.9;
}

function effOf(pid, t) {
  const te = TYPE_EFF[t.type] || TYPE_EFF.hospital;
  const pe = PROF_EFF[t.prof] || PROF_EFF.academic;
  const tf = tierF(t);
  const pm = playerMod();
  const pm0 = playerMod();
  const awP = 1 + (pm0.aw || 0), relP = 1 + (pm0.rel || 0);
  const medF = (1 + relMod('internal', 'medical') * 0.15) * awP;
  const comF = 1 + relMod('internal', 'commercial') * 0.18;
  const kolF = 1 + relMod('external', 'kol') * 0.15;
  const hosF = 1 + relMod('external', 'hospital') * 0.12;
  const tightF = (S.flags.tight > 0) ? 0.8 : 1;
  if (pid === 'dept') return { aw: 12 * te.aw * pe.aw * tf * medF * tightF, rel: 4 * te.rel * pe.rel * hosF * relP };
  if (pid === 'case') return { aw: 14 * te.aw * pe.aw * te.cs * tf * medF * kolF, rel: 8 * te.rel * pe.rel * te.cs * hosF * relP };
  if (pid === 'relation') return { rel: 13 * te.rel * pe.rel * tf * hosF * relP };
  if (pid === 'channel') return { access: 8 * (pe.ch || 1) * comF, rel: 5 * te.rel * pe.rel * hosF };
  if (pid === 'dev') {
    const base = 14 + t.relation / 100 * 10;
    return { access: base * te.dev * pe.dev * (1 + (pm.dev || 0)) * allyMulOf(t) * (1 - clamp(t.access, 0, 100) / 140) };
  }
  return {};
}

/* ---------- 项目 ---------- */
function projectCost(p, n) {
  const pm = playerMod();
  let c = p.cost * CFG.costScale[S.level] * n;
  if (p.id === 'dept' && S.flags.filing > 0) c *= 1.2;
  if (p.id === 'relation' && S.flags.lean > 0) c *= 0.8;
  if (p.id === 'city') c *= (1 - relMod('internal', 'marketing') * 0.15);
  if (p.id === 'dept' && S.flags.filing > 0) c *= 1;
  c *= (1 + (pm.cost || 0));
  return +c.toFixed(2);
}

function projectAP(p, n) { return p.ap + Math.floor((n - 1) / 2); }

function failRateOf(p, t) {
  if (!p.fail) return 0;
  const st = computeStats().terms[t.id];
  const pm = playerMod();
  let f = p.fail + (pm.fail || 0);
  if (!st || st.covAll < 0.15) f += 0.12;
  f -= t.relation / 100 * 0.18;
  f += t.comp * 0.12;
  f += teamRisk() / 100 * 0.14;
  if (st) f -= (st.am - 1) * 0.6;
  let bestFail = 0;
  S.team.forEach(r => { if (covers(r, t.id) && r.mod.fail < bestFail) bestFail = r.mod.fail; });
  f += bestFail;
  if (t.idle > 8) f += 0.05;
  if (p.id === 'pushstock') {
    f = 0.62 - t.relation / 100 * 0.25 - relMod('external', 'distributor') * 0.2 + Math.min(0.3, distOver() / 40);
  }
  return clamp(f, 0.03, p.id === 'pushstock' ? 0.85 : 0.7);
}

function launchProject(pid, tids, repId) {
  const p = PROJECTS.find(x => x.id === pid);
  if (!p) return { ok: false, msg: '项目不存在' };
  const dc = diffCfg();
  if (pid === 'dev' && dc.noPht) return { ok: false, msg: '这家医院常年不开药事会，正式开发走不通——用客情、病例、渠道磨进院' };
  if (p.weekOnly && S.weekInMonth !== p.weekOnly) return { ok: false, msg: '压货只能在每月最后一周做' };

  if (p.multi === -2) {
    const r = S.team.find(x => x.id === repId);
    if (!r) return { ok: false, msg: '请选择要协访的代表' };
    const c = projectCost(p, 1);
    if (S.ap < p.ap) return { ok: false, msg: '精力不足' };
    if (S.cash < c) return { ok: false, msg: '预算不足' };
    S.cash = +(S.cash - c).toFixed(2); S.ap -= p.ap;
    const quick = (r.mod.growth || 0) > 0.8 || r.ability < 55;
    r.coach = quick ? 6 : 3;
    if (quick) r.ability = Math.min(100, r.ability + 2);
    r.coached = true;
    r.loyalty = Math.min(100, r.loyalty + 6);
    assignIds(r).forEach(tid => { const t = termById(tid); if (t) { t.relation = Math.min(100, t.relation + 3); t.idle = 0; } });
    relAdd('internal', 'boss', 1); relAdd('internal', 'hr', 1);
    const msg = quick
      ? `协访 ${r.name}：他学得快，覆盖 ×1.25 持续 6 周，能力 +2，忠诚 +6，其 ${assignIds(r).length} 个终端客情 +3。`
      : `协访 ${r.name}：他上手慢，覆盖 ×1.25 只维持 3 周（能力 +0，忠诚 +6），其 ${assignIds(r).length} 个终端客情 +3。`;
    S.planThisMonth.push({ pid, tids: [], repId, msg });
    log('action', msg);
    return { ok: true, msg };
  }


  let list = [];
  if (p.multi === -1) list = [];
  else if (p.multi === 0) list = S.terminals.map(t => t.id);
  else {
    list = (tids || []).filter(id => S.terminals.some(t => t.id === id));
    if (!list.length) return { ok: false, msg: '请选择终端' };
    if (list.length > p.multi) return { ok: false, msg: `最多选择 ${p.multi} 个终端` };
  }

  if (pid === 'channel') {
    list = list.filter(id => ['primary', 'retail', 'city', 'region'].includes(termById(id).type));
    if (!list.length) return { ok: false, msg: '渠道建设只对基层与零售有效' };
  }

  const n = p.multi === -1 ? 1 : list.length;
  const cost = projectCost(p, n);
  const ap = projectAP(p, n);
  if (S.ap < ap) return { ok: false, msg: `精力不足（需要 ${ap} 点）` };
  if (S.cash < cost) return { ok: false, msg: '预算不足' };

  S.cash = +(S.cash - cost).toFixed(2);
  S.ap -= ap;
  if (list.length) {
    const per = cost / list.length;
    const stx = computeStats();
    list.forEach(tid => {
      const t = termById(tid);
      if (!t) return;
      t.spend = +(t.spend + per).toFixed(2); t.idle = 0;
      const c = stx.terms[tid];
      const covered = new Set();
      c.reps.forEach(x => x.p.forEach(pid => covered.add(pid)));
      const ids = [...covered];
      const sumB = ids.reduce((a, pid) => a + ((PRODUCTS.find(x => x.id === pid) || {}).budget || 25), 0) || 1;
      ids.forEach(pid => {
        const pr = PRODUCTS.find(x => x.id === pid);
        if (!pr) return;
        const amt = +(per * (pr.budget / sumB)).toFixed(2);
        pr.spent = +((pr.spent || 0) + amt).toFixed(2);
        S.ledger.push({ m: S.totalMonth, w: S.totalWeek, pid, tid, kind: p.name, amt, total: per, share: +(pr.budget / sumB).toFixed(3) });
      });
    });
  }

  const msgs = [];
  let queued = 0;

  if (p.multi === -1) {
    switch (pid) {
      case 'hire':
        S.candidates.push(makeRep(S), makeRep(S));
        msgs.push('收到 2 份简历，可在「团队」页面试。');
        break;
      case 'train':
        S.team.forEach(r => {
          r.ability = Math.min(100, r.ability + 4 * (1 + (playerMod().growth || 0)));
          r.loyalty = Math.min(100, r.loyalty + 3);
          r.ct = Math.min(100, r.ct + 2);
        });
        msgs.push('团队培训完成，全员能力 +4，忠诚 +3。');
        break;
      case 'compliance':
        S.compliance = Math.min(100, S.compliance + 6);
        S.riskMod = Math.max(-20, S.riskMod - 6);
        S.team.forEach(r => { r.exposure = Math.max(0, r.exposure - 14); });
        msgs.push('合规培训完成，合规分 +6，全员风险 -14。');
        break;
    }
  } else if (p.multi === 0) {
    S.terminals.forEach(t => { t.awareness = Math.min(100, t.awareness + 6); t.idle = 0; });
    S.reputation = Math.min(100, S.reputation + 2);
    msgs.push('区域学术会召开，全终端认知 +6，上级评价 +2。');
  } else if (p.delay > 0) {
    list.forEach(tid => {
      const t = termById(tid);
      const inWin = t && t.phtOpen > 0;
      const mul = pid === 'dev' && t ? (inWin ? 1 + dc.inBonus : 1 + dc.outPenalty) : 1;
      S.pending.push({ pid, tid, at: S.totalWeek + p.delay * CFG.weeksPerMonth, cost: +(cost / n).toFixed(2), mul });
      queued++;
    });
    msgs.push(`${queued} 个终端的${p.name}已提交，${p.delay} 个月后出结果。`);
  } else {
    let ok = 0, failed = 0, queued2 = 0;
    list.forEach(tid => {
      const t = termById(tid);
      let dw = 0;
      if (pid === 'dept') dw = Math.random() < 0.55 ? 0 : (1 + Math.floor(Math.random() * 3));
      if (dw > 0) {
        S.pending.push({ pid, tid, at: S.totalWeek + dw, cost: 0, mul: 1.35 });
        queued2++;
        return;
      }
      const f = failRateOf(p, t);
      const success = Math.random() > f;
      if (success) ok++; else failed++;
      applyEffect(p, t, success);
      if (list.length === 1 && failed) msgs.push(`${p.name}在 ${t.name} 失败（成功率 ${((1 - f) * 100).toFixed(0)}%）。`);
    });
    if (list.length > 1) msgs.push(`${p.name}：${ok} 个终端成功，${failed} 个失败。`);
    if (queued2) msgs.push(`${queued2} 场科室会效果将在 1–3 周后显现。`);
  }

  // 关系变化
  if (pid === 'compliance') relAdd('internal', 'compliance', 5);
  if (pid === 'train') relAdd('internal', 'hr', 1.5);
  if (pid === 'hire') relAdd('internal', 'hr', 1);
  if (pid === 'city') { relAdd('internal', 'marketing', 2); relAdd('internal', 'medical', 1); relAdd('external', 'kol', 2); }
  if (pid === 'channel') { relAdd('internal', 'commercial', 3); relAdd('external', 'distributor', 3); }
  if (pid === 'relation') relAdd('external', 'hospital', 2);
  if (pid === 'case') { relAdd('internal', 'medical', 2); relAdd('external', 'kol', 2); }
  if (pid === 'dept') relAdd('internal', 'medical', 0.8);

  list.forEach(tid => {
    const t = termById(tid);
    if (!t) return;
    const who = S.team.find(r => covers(r, tid));
    if (!who) return;
    const days = ['周一', '周二', '周三', '周四', '周五'];
    const hh = 9 + Math.floor(Math.random() * 7), mm = Math.floor(Math.random() * 60);
    pushAct(who.id, `${p.name} · ${t.name}`, days[Math.floor(Math.random() * 5)],
      `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  });

  if (pid === 'case') S.market.cnt.case++;
  if (pid === 'city') S.market.cnt.city++;
  if (pid === 'dept' || pid === 'patientedu') S.market.cnt.edu++;

  if (!msgs.length) msgs.push(`${p.name}执行完成。`);
  S.planThisMonth.push({ pid, tids: list, msg: msgs[0] });
  msgs.forEach(m => log('action', m));
  return { ok: true, msg: msgs.join(' ') };
}

function applyEffect(p, t, success, extraMul) {
  const k = success ? 1 : 0.35;
  const e = effOf(p.id, t);
  const hard = diffCfg().noPht;
  switch (p.id) {
    case 'dept':
      t.awareness = Math.min(100, t.awareness + (e.aw || 0) * k * (extraMul || 1));
      t.relation = Math.min(100, t.relation + (e.rel || 0) * (success ? 1 : 0.2));
      break;
    case 'case':
      t.awareness = Math.min(100, t.awareness + (e.aw || 0) * k);
      t.relation = Math.min(100, t.relation + (e.rel || 0) * k);
      S.compliance = Math.min(100, S.compliance + 1);
      break;
    case 'relation':
      t.relation = Math.min(100, t.relation + (e.rel || 0) * k);
      S.riskMod = Math.min(60, S.riskMod + (success ? 2 : 1));
      break;
    case 'channel':
      t.access = Math.min(100, t.access + (e.access || 0) * k);
      t.relation = Math.min(100, t.relation + (e.rel || 0) * k);
      break;
    case 'dev':
      t.access = Math.min(100, t.access + (e.access || 0) * (success ? rnd(0.9, 1.15) : 0.45) * (extraMul || 1));
      break;
    case 'pushstock':
      if (success) {
        S.dist.stock = +(S.dist.stock + t.potential * 0.22).toFixed(1);
        const stacked = (t.stockDrop || 0) > 0;
        t.stockBoost = 1;
        t.stockDrop = stacked ? Math.max(2, (t.stockDrop || 0) + 1) : 1 + Math.floor(Math.random() * 3);
        t.stockMul = stacked ? 0.72 : 0.8;
      }
      else { t.relation = Math.max(0, t.relation - 4); }
      break;
    case 'patientedu':
      t.awareness = Math.min(100, t.awareness + 10 * k);
      t.relation = Math.min(100, t.relation + 6 * k);
      break;
    case 'clerktrain':
      t.awareness = Math.min(100, t.awareness + 8 * k);
      t.access = Math.min(100, t.access + 5 * k);
      break;
    case 'display':
      t.access = Math.min(100, t.access + 6 * k);
      t.relation = Math.min(100, t.relation + 4 * k);
      break;
  }
  if (hard) {
    if (p.id === 'relation') t.access = Math.min(100, t.access + 2.5 * k);
    else if (p.id === 'case') t.access = Math.min(100, t.access + 2 * k);
    else if (p.id === 'dept') t.access = Math.min(100, t.access + 0.8 * k);
    else if (p.id === 'channel') t.access = Math.min(100, t.access + 1.5 * k);
  }
  t.idle = 0;
}

/* ---------- 人选 ---------- */
function hireCandidate(cid) {
  const i = S.candidates.findIndex(c => c.id === cid);
  if (i < 0) return { ok: false, msg: '候选人不存在' };
  if (S.team.length >= CFG.teamCap[S.level]) return { ok: false, msg: '编制已满' };
  const c = S.candidates.splice(i, 1)[0];
  c.loyalty = clamp(c.loyalty + relMod('internal', 'hr') * 8, 0, 100);
  S.team.push(c);
  log('good', `${c.name} 入职，任 ${ROLES[c.role].label}，月薪 ${c.salary.toFixed(1)} 万。`);
  return { ok: true, msg: `${c.name} 已入职` };
}

function fileRep(rid) {
  const r = S.team.find(x => x.id === rid);
  if (!r || r.filed) return { ok: false, msg: '已备案' };
  const c = +(0.5 * CFG.costScale[S.level]).toFixed(2);
  if (S.cash < c) return { ok: false, msg: '预算不足' };
  S.cash = +(S.cash - c).toFixed(2);
  r.filed = true;
  relAdd('internal', 'compliance', 1);
  log('good', `${r.name} 完成双备案（国家平台 + 院内登记），可以正常进院了。`);
  return { ok: true, msg: `${r.name} 已备案` };
}

function fileAll() {
  const todo = S.team.filter(r => !r.filed);
  if (!todo.length) return { ok: false, msg: '全员已备案' };
  const c = +(0.5 * CFG.costScale[S.level] * todo.length).toFixed(2);
  if (S.cash < c) return { ok: false, msg: '预算不足' };
  S.cash = +(S.cash - c).toFixed(2);
  todo.forEach(r => { r.filed = true; });
  relAdd('internal', 'compliance', 2);
  log('good', `${todo.length} 名代表完成备案，花费 ${c} 万。`);
  return { ok: true, msg: `${todo.length} 人完成备案` };
}

function fireRep(rid) {
  const r = S.team.find(x => x.id === rid);
  if (!r) return;
  S.team = S.team.filter(x => x.id !== rid);
  S.reputation = Math.max(0, S.reputation - 2);
  log('bad', `${r.name} 办理离职。上级评价 -2。`);
}

/* ---------- 周会要求 ---------- */
function applyOrder(id) {
  const o = WEEKLY_ORDERS.find(x => x.id === id);
  if (!o) return;
  let sum = 0, n = 0;
  S.team.forEach(r => {
    let c = 0.35 + r.loyalty / 160;
    const tg = r.tags || [], hd = r.revealed || [];
    const has = k => tg.includes(k) || hd.includes(k);
    if (has('grinder')) c += 0.1;
    if (has('ironman')) c += 0.12;
    if (has('rookie')) c += 0.08;
    if (has('oldfox')) c -= 0.08;
    if (has('parachute')) c -= 0.1;
    if (r.hidden.includes('procrast')) c -= 0.1;
    if (r.hidden.includes('niceguy')) c += 0.05;
    if (r.hidden.includes('sidegig')) c -= 0.2;
    c = clamp(c, 0, 1.2);
    sum += c; n++;
  });
  const power = n ? sum / n : 0;
  S.order = { id, power };
  S.orderMul = id === 'push' ? 1 + 0.12 * power : id === 'compliance' ? 0.95 : 1;
  log('info', `周会：要求全员「${o.name}」，执行度 ${(power * 100).toFixed(0)}%。`);
}

/* ---------- 周末结算 ---------- */
function monthTarget() {
  const act = ACTS[S.level];
  const ramp = 0.25 + 0.75 * Math.min(1, (S.monthInAct - 1) / 9);
  return act.target * ramp;
}

function resolvePending() {
  const msgs = [];
  const due = S.pending.filter(p => p.at <= S.totalWeek);
  S.pending = S.pending.filter(p => p.at > S.totalWeek);
  due.forEach(item => {
    const p = PROJECTS.find(x => x.id === item.pid);
    const t = termById(item.tid);
    if (!p || !t) return;
    const f = failRateOf(p, t);
    const ok = Math.random() > f;
    applyEffect(p, t, ok, item.mul);
    msgs.push(`${t.name}・${p.name}${ok ? '落地' : '失败'}`);
  });
  return msgs;
}

function endWeek() {
  // 1) 在途项目
  const resolved = resolvePending();
  resolved.forEach(m => log('action', m));

  // 1.2) 政策/延迟事件出结果
  const dueEv = S.pendingEvents.filter(x => x.at <= S.totalWeek);
  S.pendingEvents = S.pendingEvents.filter(x => x.at > S.totalWeek);
  dueEv.forEach(x => {
    const ev = EVENTS.find(e => e.id === x.evId) || MGMT_EVENTS.find(e => e.id === x.evId);
    const opt = ev && ev.options[x.idx];
    if (!opt) return;
    const res = opt.run(S) || { text: '', tone: 'flat' };
    resolved.push(`【${ev.title}】${res.text}`);
    log(res.tone === 'bad' ? 'bad' : res.tone === 'good' ? 'good' : 'info', `【${ev.title}】${res.text}`);
  });

  // 1.5) 市场部任务：完成 / 超时
  const mt = marketTask();
  if (mt && mt.done) {
    relAdd('internal', 'marketing', 6);
    S.market.idx++;
    S.market.since = S.totalWeek;
    log('good', `完成市场部任务「${mt.task.name}」，市场部好感 +6。`);
  } else if (mt && S.totalWeek - (S.market.since || 0) > 8) {
    relAdd('internal', 'marketing', -3);
    S.market.idx++;
    S.market.since = S.totalWeek;
    log('bad', `市场部任务「${mt.task.name}」超时未完成，好感 -3。产品经理在群里点了你的名。`);
  }

  // 2) 周会要求落地
  const order = S.order;
  if (order) {
    S.team.forEach(r => {
      assignIds(r).forEach(tid => {
        const t = termById(tid); if (!t) return;
        if (order.id === 'academic') t.awareness = Math.min(100, t.awareness + 3 * order.power);
        if (order.id === 'relation') t.relation = Math.min(100, t.relation + 3 * order.power);
      });
      if (order.id === 'push') r.exposure = clamp(r.exposure + 2 * order.power, 0, 100);
      if (order.id === 'compliance') r.exposure = Math.max(0, r.exposure - 12 * order.power);
    });
  }

  // 3) 市场自然衰减（按周，闲置越久掉得越快）
  S.terminals.forEach(t => {
    const covered = S.team.some(r => covers(r, t.id));
    const idleF = 1 + Math.min(20, t.idle) * 0.14;
    t.awareness = Math.max(0, t.awareness - (covered ? 1.5 : 2.6) / 4 * idleF);
    t.relation = Math.max(0, t.relation - 1.8 / 4 * idleF);
    if (t.access > 0) t.access = Math.max(0, t.access - 0.3 / 4 * idleF);
    t.comp = Math.min(0.9, t.comp + 0.006 / 4);
    t.idle++;
    if (t.handover > 0) t.handover--;
  });

  // 4) 代表行为（周）
  S.team.forEach(r => {
    r.months += 0.25;
    const tac = tacticOf(r);
    const ids = assignIds(r);
    const L = Math.max(repLoad(r), 0.001);
    const rcap = repCapOf(r);
    const overload = L > rcap ? Math.pow(rcap / L, 0.6) : 1;
    const base = repBase(r);
    ids.forEach(tid => {
      const t = termById(tid); if (!t) return;
      const w = TYPE_COST[t.type] || 1;
      const pw = base * (w / L) * overload;
      t.awareness = Math.min(100, t.awareness + pw * 3.4 / 4 * (1 + r.mod.aw) * tac.aw);
      t.relation = Math.min(100, t.relation + pw * 3.6 / 4 * (1 + r.mod.rel) * tac.rel);
    });
    r.exposure = clamp(r.exposure + tac.exposure / 4 * (1 + r.mod.exposure + (playerMod().exposure || 0)), 0, 100);
    let loy = (tac.loyalty + r.mod.loyalty + (playerMod().loyalty || 0)) / 4 + (r.loyalty < 50 ? -0.3 : 0.075);
    if (r.mod.jobhunt && r.months >= 10) loy -= 0.55;
    r.loyalty = clamp(r.loyalty + loy, 0, 100);
    r.ability = Math.min(100, r.ability + (r.ability < 70 ? 0.55 : 0.22) / 4 * (1 + r.mod.growth + (playerMod().growth || 0)));
    if (r.coach > 0) r.coach--;

    // 每周例行打卡
    const days = ['周一', '周二', '周三', '周四', '周五'];
    const aid = assignIds(r);
    if (aid.length) {
      const tt = termById(aid[Math.floor(Math.random() * aid.length)]);
      if (tt) {
        const hh = 8 + Math.floor(Math.random() * 2);
        const mm = Math.floor(Math.random() * 60);
        pushAct(r.id, `打卡 · ${tt.name} · ${Math.random() < 0.55 ? '早访' : '科室走访'}`,
          days[Math.floor(Math.random() * 5)], `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
      }
    }

    // 对低权重品种的态度：公司自己都不投，代表慢慢就不推了
    r.wPref = r.wPref || {};
    const pids = new Set();
    ids.forEach(tid => { const a = r.assign[tid]; if (a) (a.p || []).forEach(x => pids.add(x)); });
    pids.forEach(pid => {
      const prod = PRODUCTS.find(x => x.id === pid);
      if (!prod) return;
      const w = prod.w == null ? 50 : prod.w;
      const cur = r.wPref[pid] || 0;
      let nv = cur;
      if (w < 20) nv = Math.max(-0.6, cur - 0.04);
      else if (w > 50) nv = Math.min(0.2, cur + 0.02);
      if (nv <= -0.5 && cur > -0.5) {
        r.loyalty = Math.max(0, r.loyalty - 3);
        log('bad', `${r.name} 明确表示不愿意再推 ${prod.name}："这个品种公司自己都不投，我跑断腿也没用。"`);
      }
      r.wPref[pid] = nv;
    });
  });

  // 4.5) 药事会周期推进
  const dc0 = diffCfg();
  if (!dc0.noPht) {
    S.terminals.forEach(t => {
      if (t.phtOpen > 0) { t.phtOpen--; return; }
      t.phtNext = (t.phtNext || 1) - 1;
      if (t.phtNext <= 0) {
        t.phtOpen = dc0.window;
        t.phtNext = dc0.id === 'easy' ? dc0.cycle + rndInt(-1, 1) : 8 + Math.floor(Math.random() * 14);
      }
    });
  }

  // 4.6) 关系：长期不维护才缓慢回落（人与人的关系，比终端慢得多）
  ['internal', 'external'].forEach(g => Object.keys(S.rel[g]).forEach(k => {
    const idle = S.totalWeek - (S.relTouch[g + ':' + k] || 0);
    if (idle <= 12) return;
    const v = S.rel[g][k];
    if (v > 50) S.rel[g][k] = Math.max(50, v - 0.25);
    else if (v < 50) S.rel[g][k] = Math.min(50, v + 0.25);
  }));

  // 4.7) 品种精力分配的长期后果：长期不管的品种会被竞品蚕食
  PRODUCTS.forEach(p => {
    const w = p.w == null ? 50 : p.w;
    if (w < 25) p.neglect = Math.min(0.28, (p.neglect || 0) + 0.012);
    else if (w > 60) p.neglect = Math.max(0, (p.neglect || 0) - 0.008);
  });

  // 5) 销售（周 = 月跑量 / 4）
  const st = computeStats();
  const weekSales = st.total / CFG.weeksPerMonth;
  // 压货效果计时（结算完本周销量后再递减）
  S.terminals.forEach(t => {
    if (t.stockBoost > 0) t.stockBoost--;
    else if (t.stockDrop > 0) t.stockDrop--;
  });
  const gross = weekSales * CFG.grossRate * (1 + relMod('external', 'distributor') * 0.08);

  // 商业公司库存：随实际销售消化；积压则压货更难、关系下降、全渠道受阻
  S.dist.stock = Math.max(0, +(S.dist.stock - weekSales * 0.62).toFixed(1));
  const over = distOver();
  if (over > 0) {
    relAdd('external', 'distributor', -0.8);
    if (S.totalWeek % 4 === 0) log('bad', `商业公司库存积压 ${over.toFixed(1)} 万，配送开始挑单。`);
  }
  const sal = salaryTotal() / CFG.weeksPerMonth;
  S.cash = +(S.cash + gross - sal).toFixed(2);

  // 6) 风险
  S.riskMod = S.riskMod * 0.968;
  S.team.forEach(r => { r.exposure = r.exposure * 0.985; });
  const risk = teamRisk();
  if (risk < 15 && S.compliance < 96) S.compliance = Math.min(96, S.compliance + 0.2);

  // 7) 监管抽查（周概率 = 月概率 / 4）
  let incident = null;
  const p = (0.015 + Math.pow(risk / 100, 2) * 0.5) / 4 * (1 - relMod('internal', 'compliance') * 0.3);
  if (Math.random() < p) incident = resolveInspection(risk);

  // 8) 人员流失
  let leaver = null;
  S.team.forEach(r => {
    if (leaver) return;
    if (r.loyalty < 32 && Math.random() < (32 - r.loyalty) / 600) leaver = r;
  });
  if (leaver) {
    S.team = S.team.filter(x => x.id !== leaver.id);
    log('bad', `${leaver.name} 递了辞职信，去了竞品。忠诚度过低是根因。`);
  }

  // 9) 政策时效
  ['filing', 'lean', 'tight'].forEach(k => { if (S.flags[k] > 0) S.flags[k]--; });
  PRODUCTS.forEach(p => { if (p.resWeeks > 0) p.resWeeks--; });

  // 10) 累计到本月
  S.wk.sales += weekSales;
  S.wk.gross += gross;
  S.wk.salary += sal;
  S.wk.resolved = S.wk.resolved.concat(resolved);
  if (incident) S.wk.incident = incident;

  const snap = {
    month: S.totalMonth,
    week: S.weekInMonth,
    sales: +weekSales.toFixed(1),
    risk: +risk.toFixed(1),
    reps: S.team.map(r => ({ name: r.name, output: 0, expo: r.exposure })),
  };
  // 每名代表的周产出（按其覆盖终端销量占比粗算）
  const byRep = {};
  S.terminals.forEach(t => {
    const c = st.terms[t.id];
    const sum = c.reps.reduce((a, x) => a + x.pw, 0) || 1;
    c.reps.forEach(x => { byRep[x.id] = (byRep[x.id] || 0) + c.total * (x.pw / sum); });
  });
  S.team.forEach(r => {
    const e = snap.reps.find(x => x.name === r.name);
    if (e) e.output = +((byRep[r.id] || 0) / CFG.weeksPerMonth).toFixed(1);
    r.lastWeek = { output: e ? e.output : 0, expo: r.exposure };
  });

  // 11) 推进时间
  S.order = null;
  S.orderMul = 1;
  S.totalWeek++;
  S.weekInMonth++;
  S.ap = apMax();

  let monthReport = null;
  let promotion = null;
  if (S.weekInMonth > CFG.weeksPerMonth) {
    monthReport = rollMonth();
    promotion = checkPromotion();
    S.pendingPromotion = promotion;
  }

  return { week: snap, monthReport, promotion, incident };
}

function rollMonth() {
  const sales = S.wk.sales;
  const prev = S.history.length ? S.history[S.history.length - 1] : null;
  const share = sales / marketSize();
  const st = computeStats();
  const before = S.lastMonth || { compliance: S.compliance, reputation: S.reputation };

  S.history.push({
    m: S.totalMonth, sales: +sales.toFixed(1), share: +share.toFixed(4),
    cash: S.cash, compliance: S.compliance, rep: S.reputation,
    team: S.team.length, risk: +teamRisk().toFixed(1),
    prod: Object.assign({}, st.byProduct),
  });
  if (S.history.length > 40) S.history.shift();

  const target = monthTarget();
  const ratio = sales / target;
  let d = 0;
  if (ratio >= 1.0) d += 2.4;
  else if (ratio >= 0.85) d += 1.0;
  else if (ratio >= 0.65) d -= 1.4;
  else d -= 3.2;
  if (S.compliance >= 85) d += 0.8;
  if (S.compliance < 60) d -= 1.6;
  if (prev && sales > prev.sales) d += 0.5;
  d *= (1 + (playerMod().eval || 0)) * (1 + relMod('internal', 'boss') * 0.25);
  S.reputation = clamp(S.reputation + d, 0, 100);
  S.compliance = Math.min(100, S.compliance + (playerMod().compliance || 0));
  if (S.compliance >= 85) relAdd('internal', 'compliance', 2);
  else if (S.compliance < 60) relAdd('internal', 'compliance', -2);
  if (S.reputation >= 70) ['finance', 'marketing', 'medical', 'commercial', 'hr'].forEach(k => relAdd('internal', k, 0.6));
  if (S.cash < 20) relAdd('internal', 'finance', -1.5);

  const cap = Math.max(200, ACTS[S.level].target * 2.5) * (1 + relMod('internal', 'finance') * 0.12);
  let up = 0;
  if (S.cash > cap) { up = +(S.cash - cap).toFixed(1); S.cash = cap; }

  const report = {
    month: S.totalMonth, year: S.year,
    sales: +sales.toFixed(1),
    delta: prev ? +((sales - prev.sales) / Math.max(prev.sales, 0.1) * 100).toFixed(1) : null,
    share: +(share * 100).toFixed(1),
    gross: +S.wk.gross.toFixed(1), salary: +S.wk.salary.toFixed(1), net: +(S.wk.gross - S.wk.salary).toFixed(1),
    cash: S.cash, cashDelta: +(S.cash - (S.lastMonth ? S.lastMonth.cash : CFG.startCash)).toFixed(1),
    compliance: +S.compliance.toFixed(1), compDelta: +(S.compliance - before.compliance).toFixed(1),
    reputation: +S.reputation.toFixed(1), repDelta: +(S.reputation - before.reputation).toFixed(1),
    risk: +teamRisk().toFixed(1),
    incident: S.wk.incident || null,
    resolved: S.wk.resolved.slice(),
    up, target: +target.toFixed(1), progress: +(sales / target * 100).toFixed(1),
  };
  S.lastReport = report;
  S.lastMonth = { cash: S.cash, compliance: S.compliance, reputation: S.reputation };

  log('sales', `第 ${S.totalMonth} 月结算：销售 ${report.sales.toFixed(1)} 万${report.delta == null ? '' : `（环比 ${report.delta >= 0 ? '+' : ''}${report.delta.toFixed(1)}%）`}，份额 ${report.share.toFixed(1)}%。`);

  S.budgetBase = Math.max(20, +((S.wk.gross) / 4).toFixed(1));
  S.ledger = S.ledger.filter(x => S.totalMonth - x.m < 3);
  PRODUCTS.forEach(p => { p.spent = 0; });
  S.wk = { sales: 0, gross: 0, salary: 0, resolved: [], incident: null };
  S.totalMonth++;
  S.monthInAct++;
  S.weekInMonth = 1;
  if (S.monthInAct > 12) S.year++;
  S.lastPlan = S.planThisMonth.slice();
  S.planThisMonth = [];
  return report;
}

function resolveInspection(risk) {
  const sorted = S.team.slice().sort((a, b) => b.exposure - a.exposure);
  const worst = sorted[0];
  if (!worst || worst.exposure < 18) {
    S.reputation = Math.min(100, S.reputation + 3);
    S.compliance = Math.min(100, S.compliance + 2);
    log('good', '监管抽查，全部合规，无违规记录。上级评价 +3。');
    return { caught: false, name: '监管抽查', text: '抽查通过，无违规记录。', tone: 'good' };
  }
  const exp = worst.exposure;
  let tier = PUNISH[0];
  if (exp >= 75) tier = PUNISH[3];
  else if (exp >= 55) tier = PUNISH[2];
  else if (exp >= 30) tier = PUNISH[1];

  const fine = +(tier.cash * CFG.costScale[S.level] * 0.6).toFixed(1);
  S.cash = +(S.cash - fine).toFixed(2);
  S.compliance = clamp(S.compliance + tier.comp, 0, 100);
  S.reputation = clamp(S.reputation + tier.rep, 0, 100);

  let extra = '';
  if (exp >= 40) {
    S.team = S.team.filter(x => x.id !== worst.id);
    extra = `${worst.name} 被公司解除劳动合同并列入行业黑名单。`;
  } else {
    worst.exposure = 0;
    extra = `${worst.name} 被约谈，记入个人合规档案。`;
  }
  if (exp >= 55) {
    const t = pick(S.terminals);
    if (t) { t.access = Math.max(0, t.access - 25); extra += ` ${t.name} 暂停采购本品 1 个季度。`; }
  }
  const fineStr = fine > 0 ? `，罚款 ${fine.toFixed(1)} 万` : '';
  log('bad', `监管检查：${tier.text}${fineStr}，合规分 ${tier.comp}。${extra}`);
  return {
    caught: true, name: '监管检查', tier: tier.text, fine,
    text: `查出违规带金销售线索。${tier.text}${fine > 0 ? '，罚款 ' + fine.toFixed(1) + ' 万' : ''}，合规分 ${tier.comp}。`,
    extra, tone: 'bad',
  };
}

/* ---------- 晋升 ---------- */
function promotionProgress() {
  const act = ACTS[S.level];
  const avg = recentAvg(3);
  const share = S.history.length ? S.history[S.history.length - 1].share : 0;
  return {
    sales: { cur: avg, need: act.target, ok: avg >= act.target, label: '近 3 月均销售' },
    share: { cur: share * 100, need: act.shareTarget * 100, ok: share >= act.shareTarget, label: '市场份额' },
    compliance: { cur: S.compliance, need: 75, ok: S.compliance >= 75, label: '合规评分' },
    reputation: { cur: S.reputation, need: 60, ok: S.reputation >= 60, label: '上级评价' },
    team: { cur: S.team.length, need: 3, ok: S.team.length >= 3, label: '团队规模' },
  };
}

function checkPromotion() {
  const p = promotionProgress();
  const allOk = Object.values(p).every(x => x.ok);

  if (S.level < 3) {
    if (S.flags.noPromoteUntil && S.monthInAct < S.flags.noPromoteUntil) return null;
    if (allOk && S.monthInAct > 5) return { type: 'promote', level: S.level + 1, progress: p };
    if (S.monthInAct > 12 && !S.actExtended) {
      const avg = recentAvg(3);
      if (avg >= ACTS[S.level].target * 0.8) {
        S.actExtended = true;
        S.reputation = Math.max(0, S.reputation - 4);
        log('bad', '年度考核未达标，但省区同意延期半年。上级评价 -4。');
        return { type: 'extend', progress: p };
      }
      S.over = { win: false, reason: '年度考核不达标，你被调离管理岗。', title: '出局' };
      return { type: 'lose' };
    }
    if (S.monthInAct > 18) {
      S.over = { win: false, reason: '延期考核仍未达标，你被调离管理岗。', title: '出局' };
      return { type: 'lose' };
    }
  } else {
    checkWin();
    if (S.over) return null;
    if (S.monthInAct > 13) {
      S.over = { win: false, reason: '全国指标未达成，董事会换人。', title: '出局' };
      return { type: 'lose' };
    }
  }

  if (S.compliance < 30) { S.over = { win: false, reason: '合规评分跌破安全线，公司启动问责，你被免职。', title: '出局' }; return { type: 'lose' }; }
  if (S.reputation <= 12) { S.over = { win: false, reason: '上级评价见底，你被调离一线。', title: '出局' }; return { type: 'lose' }; }
  if (S.cash < -30) { S.over = { win: false, reason: '连续亏损，费用池彻底穿底，公司终止了你辖区的投入。', title: '出局' }; return { type: 'lose' }; }
  return null;
}

function checkWin() {
  if (S.level === 3 && S.monthInAct > 11 && !S.over) {
    const avg = recentAvg(3);
    if (avg >= ACTS[3].target) {
      S.over = { win: true, title: '通关', reason: '你完成了全国营销体系的年度指标，正式进入公司经营层视野。' };
    }
  }
}

function doPromote() {
  const next = S.level + 1;
  if (next > 3) return;
  enterAct(next, true);
  S.reputation = Math.min(100, S.reputation + 5);
  const add = Math.min(3, CFG.teamCap[next] - S.team.length);
  const newcomers = [];
  for (let i = 0; i < add; i++) { const nr = makeRep(S, { abilityBoost: 6 }); newcomers.push(nr); S.team.push(nr); }
  if (add > 0) {
    // 新区域的代表自动接手没人管的终端
    const covered = new Set();
    S.team.forEach(r => Object.keys(r.assign).forEach(tid => covered.add(tid)));
    const empty = S.terminals.filter(t => !covered.has(t.id)).sort((a, b) => b.potential - a.potential);
    newcomers.forEach((nr, i) => {
      const targets = empty.slice(i * 1, i * 1 + 2);
      targets.forEach(t => { nr.assign[t.id] = { p: PRODUCTS.map(p => p.id), pharm: false }; });
    });
    log('good', `公司从其他区域划转 ${add} 名代表，已自动接手空缺终端。`);
  }
  log('good', `晋升为${ACTS[next].rank}，接手${ACTS[next].region}。`);
}

/* ---------- 事件 ---------- */
function evText(ev) {
  return typeof ev.text === 'function' ? ev.text(S) : ev.text;
}

function rollEvent() {
  if (S.flags.auditAt && S.totalMonth >= S.flags.auditAt) {
    const why = S.flags.auditWhy || '管理要求';
    S.flags.auditAt = 0; S.flags.auditWhy = '';
    return Object.assign({}, AUDIT_EVENT, {
      text: `总部专项核查组进驻，调取近半年的费用凭证、活动台账与拜访记录。起因是${why}那次没有按要求落实。`,
    });
  }
  const all = EVENTS.concat(MGMT_EVENTS);
  const cands = all.filter(e => !e.cond || e.cond(S));
  const uniq = cands.filter(e => !(S.flags['last_' + e.id] > 0));
  const pool = uniq.length > 3 ? uniq : cands;
  const ev = weightedPick(pool.map(e => ({ e, weight: e.weight }))).e;
  S.flags['last_' + ev.id] = 3;
  Object.keys(S.flags).forEach(k => {
    if (k.startsWith('last_') && typeof S.flags[k] === 'number') S.flags[k]--;
  });
  return ev;
}

function applyEventOption(ev, idx) {
  const opt = ev.options[idx];
  if (ev.delay) {
    S.pendingEvents.push({ at: S.totalWeek + ev.delay, evId: ev.id, idx, title: ev.title, label: opt.label });
    log('info', `【${ev.title}】已按「${opt.label}」上报，${Math.round(ev.delay / 4)} 个月后出结果。`);
    return { text: `决策已上报总部。政策类事项不会当月见效——${Math.round(ev.delay / 4)} 个月后出结果。`, tone: 'flat' };
  }
  if (opt.cost) {
    const c = +(opt.cost * CFG.costScale[S.level]).toFixed(2);
    S.cash = +(S.cash - c).toFixed(2);
  }
  if (opt.ap) S.ap = Math.max(0, S.ap - opt.ap);
  const res = opt.run(S) || { text: '', tone: 'flat' };
  log(res.tone === 'bad' ? 'bad' : res.tone === 'good' ? 'good' : 'info', `【${ev.title}】${res.text}`);
  return res;
}
