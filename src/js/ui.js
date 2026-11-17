/* =========================================================
   ui.js — 渲染层（周回合制）
   ========================================================= */

let TAB = 'overview';
let SEL = { terminal: null };
let PENDING = null;
let MODAL = null;
let PICKER = null;
let ACT = { pid: null, sel: [] };
let START = { stage: 'path', path: null, name: '王磊', tags: [], diff: 'normal' };
let WEEK_RES = null;

/* ---------- 工具 ---------- */
const f1 = n => (Math.round((n || 0) * 10) / 10).toFixed(1);
const f0 = n => Math.round(n || 0);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function deltaChip(v, unit) {
  if (Math.abs(v) < 0.05) return `<span class="chip flat">—</span>`;
  return `<span class="chip ${v > 0 ? 'up' : 'down'}">${v > 0 ? '+' : ''}${f1(v)}${unit || ''}</span>`;
}

function toast(msg, tone) {
  const root = document.getElementById('toast-root');
  const d = document.createElement('div');
  d.className = 'toast ' + (tone || '');
  d.textContent = msg;
  root.appendChild(d);
  setTimeout(() => { d.style.opacity = '0'; d.style.transition = 'opacity .3s'; }, 2100);
  setTimeout(() => d.remove(), 2500);
}

/* ---------- 图表 ---------- */
function trendChart() {
  const hist = S.history.slice(-12);
  const W = 680, H = 208, PL = 42, PR = 16, PT = 12, PB = 26;
  if (!hist.length) return `<div class="empty">还没有数据，推进第一个月后这里会出现份额曲线。</div>`;
  const act = ACTS[S.level];
  const target = act.shareTarget * 100;
  const vals = hist.map(x => x.share * 100);
  const yMax = Math.ceil(Math.max(target * 1.3, Math.max(...vals) * 1.25, 8) / 4) * 4;
  const iw = W - PL - PR, ih = H - PT - PB;
  const X = i => hist.length === 1 ? PL + iw / 2 : PL + i / (hist.length - 1) * iw;
  const Y = v => PT + ih - (v / yMax) * ih;

  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const y = PT + ih - i / 4 * ih;
    grid += `<line x1="${PL}" y1="${y.toFixed(1)}" x2="${W - PR}" y2="${y.toFixed(1)}" stroke="#EDF1F6"/>`;
    grid += `<text x="${PL - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="9.5" fill="#8494A6">${(yMax * i / 4).toFixed(0)}%</text>`;
  }
  const line = hist.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(x.share * 100).toFixed(1)}`).join(' ');
  const area = `${line} L${X(hist.length - 1).toFixed(1)},${PT + ih} L${X(0).toFixed(1)},${PT + ih} Z`;
  const ty = Y(target);
  let xlab = '';
  hist.forEach((x, i) => {
    if (hist.length > 8 && i % 2 === 1 && i !== hist.length - 1) return;
    xlab += `<text x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="#8494A6">${x.m}月</text>`;
  });
  let dots = '';
  hist.forEach((x, i) => {
    if (i !== hist.length - 1 && i !== 0) return;
    dots += `<circle cx="${X(i).toFixed(1)}" cy="${Y(x.share * 100).toFixed(1)}" r="3.2" fill="#0143B0" stroke="#fff" stroke-width="1.6"/>`;
  });
  const last = hist[hist.length - 1];
  const lx = X(hist.length - 1), ly = Y(last.share * 100);

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
    <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0143B0" stop-opacity=".20"/><stop offset="100%" stop-color="#0143B0" stop-opacity="0"/>
    </linearGradient></defs>
    ${grid}
    <line x1="${PL}" y1="${ty.toFixed(1)}" x2="${W - PR}" y2="${ty.toFixed(1)}" stroke="#C0790C" stroke-width="1" stroke-dasharray="4 4" opacity=".7"/>
    <text x="${W - PR}" y="${(ty - 5).toFixed(1)}" text-anchor="end" font-size="9" fill="#B8730A">晋升线 ${target.toFixed(1)}%</text>
    <path d="${area}" fill="url(#ag)"/>
    <path d="${line}" fill="none" stroke="#0143B0" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    <text x="${lx > W - PR - 46 ? lx - 9 : lx + 9}" y="${ly - 8}" text-anchor="${lx > W - PR - 46 ? 'end' : 'start'}" font-size="10.5" font-weight="600" fill="#0143B0">${(last.share * 100).toFixed(1)}%</text>
    ${xlab}
  </svg>`;
}

function mixChart() {
  const hist = S.history.slice(-6);
  if (!hist.length) return `<div class="empty">结算后显示品种结构。</div>`;
  const W = 340, H = 170, PL = 8, PR = 8, PT = 10, PB = 22;
  const iw = W - PL - PR, ih = H - PT - PB;
  const max = Math.max(...hist.map(h => h.sales)) * 1.1 || 1;
  const bw = Math.min(34, iw / hist.length * 0.55);
  let bars = '', labels = '';
  hist.forEach((h, i) => {
    const cx = PL + (i + 0.5) / hist.length * iw;
    let y = PT + ih;
    const prod = h.prod || {};
    PRODUCTS.forEach(p => {
      const v = prod[p.id] || 0;
      const hh = v / max * ih;
      y -= hh;
      bars += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, hh).toFixed(1)}" fill="${p.color}" rx="1.5"/>`;
    });
    labels += `<text x="${cx.toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="9" fill="#8494A6">${h.m}月</text>`;
  });
  let grid = '';
  for (let i = 0; i <= 3; i++) {
    const y = PT + ih - i / 3 * ih;
    grid += `<line x1="${PL}" y1="${y.toFixed(1)}" x2="${W - PR}" y2="${y.toFixed(1)}" stroke="#F1F4F8"/>`;
  }
  const legend = PRODUCTS.map(p => `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:#4A5C70;margin-right:10px"><i style="width:7px;height:7px;border-radius:2px;background:${p.color};display:inline-block"></i>${p.short}</span>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">${grid}${bars}${labels}</svg>
    <div style="margin-top:4px">${legend}</div>`;
}

/* =========================================================
   顶层
   ========================================================= */
function render() {
  const app = document.getElementById('app');
  if (!S) { app.innerHTML = ''; renderStart(); return; }
  const sy = window.scrollY;
  app.innerHTML = topbar() + `<div class="layout">${nav()}<main class="main">${mainView()}</main></div>`;
  window.scrollTo(0, sy);
  renderModal();
}

function topbar() {
  const st = computeStats();
  const sales = st.total;
  const share = sales / marketSize() * 100;
  const prev = S.history.length ? S.history[S.history.length - 1] : null;
  const dSales = prev ? (sales - prev.sales) : 0;
  const dShare = prev ? (share - prev.share * 100) : 0;
  const act = ACTS[S.level];
  return `<header class="topbar">
    <div class="brand">
      <div class="brand-mark">药</div>
      <div class="brand-t"><b>药企模拟器</b><span>PHARMA SIMULATOR</span></div>
    </div>
    <div class="who">
      <b>${esc(S.playerName)} · ${act.rank}</b>
      <span>${act.org} ｜ 第 ${S.totalMonth} 月 · 第 ${S.weekInMonth} 周</span>
    </div>
    <div class="kpis">
      <div class="kpi"><label>本月销售 · 预计</label><strong>${f1(sales)}<small>万</small></strong>${prev && Math.abs(dSales) >= 0.05 ? `<span class="d ${dSales >= 0 ? 'up' : 'down'}">${dSales >= 0 ? '▲' : '▼'}${f1(Math.abs(dSales))}</span>` : ''}</div>
      <div class="kpi"><label>市场份额</label><strong>${f1(share)}<small>%</small></strong>${prev && Math.abs(dShare) >= 0.05 ? `<span class="d ${dShare >= 0 ? 'up' : 'down'}">${dShare >= 0 ? '▲' : '▼'}${f1(Math.abs(dShare))}</span>` : ''}</div>
      <div class="kpi"><label>可用预算</label><strong>${f1(S.cash)}<small>万</small></strong></div>
      <div class="kpi"><label>合规评分</label><strong style="color:${S.compliance < 60 ? '#B3261E' : S.compliance < 78 ? '#B8730A' : '#17795A'}">${f1(S.compliance)}</strong></div>
      <div class="kpi"><label>上级评价</label><strong>${f1(S.reputation)}</strong></div>
    </div>
    <button class="btn primary turn-btn" onclick="onEndWeek()">推进本周<span class="ap">精力 ${S.ap}/${apMax()}</span></button>
  </header>`;
}

function nav() {
  const items = [
    ['overview', '经营总览', '◫'], ['terminals', '终端', '▤'], ['team', '团队', '◉'],
    ['products', '产品', '◈'], ['actions', '行动', '✦'], ['relations', '关系', '◎'],
    ['compliance', '合规', '⚠'], ['log', '记录', '≡'],
  ];
  const cand = S.candidates.length;
  return `<nav class="sidenav">
    ${items.map(([k, n, i]) => `<div class="navitem ${TAB === k ? 'on' : ''}" onclick="setTab('${k}')"><i>${i}</i>${n}${k === 'team' && cand ? `<span class="badge">${cand}</span>` : ''}</div>`).join('')}
    ${S.offer ? `<div class="navitem offer" onclick="openOffer()">↑ 待处理晋升</div>` : ''}
    <div class="navfoot">
      第 ${S.totalMonth} 月 · ${S.year}年 第 ${S.weekInMonth}/4 周<br>
      ${ACTS[S.level].title.split(' · ')[1]}阶段 第 ${Math.min(S.monthInAct, 12)}/12 月<br>
      ${S.pending.length ? `<span style="color:#B8730A">在途项目 ${S.pending.length} 项</span><br>` : ''}
      <span style="color:#0143B0;cursor:pointer" onclick="showHelp()">怎么玩 →</span>
    </div>
  </nav>`;
}

function setTab(t) { TAB = t; PICKER = null; render(); }

function mainView() {
  switch (TAB) {
    case 'terminals': return viewTerminals();
    case 'team': return viewTeam();
    case 'actions': return viewActions();
    case 'products': return viewProducts();
    case 'relations': return viewRelations();
    case 'compliance': return viewCompliance();
    case 'log': return viewLog();
    default: return viewOverview();
  }
}

/* =========================================================
   总览
   ========================================================= */
function viewOverview() {
  const act = ACTS[S.level];
  const st = computeStats();
  const sales = st.total;
  const share = sales / marketSize() * 100;
  const prev = S.history.length ? S.history[S.history.length - 1] : null;
  const prog = promotionProgress();
  const okCount = Object.values(prog).filter(x => x.ok).length;

  return `
  <div class="pagehead">
    <div><h2>经营总览<span>OPERATIONS OVERVIEW</span></h2>
      <p>${act.region} · ${S.terminals.length} 个终端 · 团队 ${S.team.length}/${CFG.teamCap[S.level]} 人 · 月薪 ${f1(salaryTotal())} 万</p></div>
    <div class="hint" style="text-align:right">本周剩余精力 <b style="font-size:16px;color:#0143B0">${S.ap}</b> / ${apMax()}</div>
  </div>

  <div class="grid-4">
    <div class="stat blue">
      <label>本月销售额<em>SALES</em></label>
      <div class="v">${f1(sales)}<small>万元</small></div>
      <div class="foot">${prev ? deltaChip(sales - prev.sales, ' 万') : '<span class="chip flat">首月</span>'} <span>目标 ${f1(act.target)} 万</span></div>
    </div>
    <div class="stat">
      <label>市场份额<em>MARKET SHARE</em></label>
      <div class="v">${f1(share)}<small>%</small></div>
      <div class="foot">${prev ? deltaChip(share - prev.share * 100, 'pp') : ''} <span>区域容量 ${f1(marketSize())} 万/月</span></div>
    </div>
    <div class="stat ${S.cash < 20 ? 'danger' : ''}">
      <label>可用预算<em>BUDGET</em></label>
      <div class="v">${f1(S.cash)}<small>万元</small></div>
      <div class="foot">周净流入 ${f1(sales * CFG.grossRate / 4 - salaryTotal() / 4)} 万</div>
    </div>
    <div class="stat ${S.compliance < 60 ? 'danger' : S.compliance < 78 ? 'warn' : ''}">
      <label>合规评分<em>COMPLIANCE</em></label>
      <div class="v" style="color:${S.compliance < 60 ? '#B3261E' : S.compliance < 78 ? '#B8730A' : '#17795A'}">${f1(S.compliance)}</div>
      <div class="foot">风险敞口 ${f1(teamRisk())} · 检查概率 ${f1((0.015 + Math.pow(teamRisk() / 100, 2) * 0.5))}%/月</div>
    </div>
  </div>

  <div class="grid-32 mt12">
    <section class="card">
      <div class="card-h"><h3>份额走势<em>MARKET SHARE TREND</em></h3><span class="sub">最近 ${Math.min(S.history.length, 12)} 个月</span></div>
      ${trendChart()}
    </section>
    <section class="card">
      <div class="card-h"><h3>晋升条件<em>PROMOTION</em></h3><span class="sub">${okCount}/5 达成</span></div>
      ${Object.values(prog).map(p => `
        <div class="proline">
          <span class="k ${p.ok ? 'ok' : 'no'}">${p.ok ? '✓' : '·'}</span>
          <span class="n">${p.label}</span>
          <span class="b"><span class="bar thin"><i style="width:${Math.min(100, p.cur / p.need * 100).toFixed(0)}%;background:${p.ok ? '#17795A' : '#0143B0'}"></i></span></span>
          <span class="v">${p.label === '团队规模' ? f0(p.cur) + ' / ' + f0(p.need) + ' 人'
      : p.label === '市场份额' ? f1(p.cur) + '% / ' + f1(p.need) + '%'
        : p.label === '近 3 月均销售' ? f1(p.cur) + ' / ' + f1(p.need) + ' 万'
          : f1(p.cur) + ' / ' + f1(p.need)}</span>
        </div>`).join('')}
      <div class="hint mt12" style="border-top:1px solid #F0F4F8;padding-top:10px">
        最早第 6 个月可晋升；满 12 个月未达标进入年度考核。
      </div>
    </section>
  </div>

  <div class="grid-2 mt12">
    <section class="card">
      <div class="card-h"><h3>品种结构<em>PRODUCT MIX</em></h3><span class="sub">近 6 个月</span></div>
      ${mixChart()}
    </section>
    <section class="card">
      <div class="card-h"><h3>终端贡献<em>TOP ACCOUNTS</em></h3><span class="sub">按本月预计</span></div>
      <table class="tb">
        <thead><tr><th>终端</th><th class="r">份额</th><th class="r">销售</th><th class="r">闲置</th></tr></thead>
        <tbody>
        ${S.terminals.map(t => ({ t, c: st.terms[t.id] })).sort((a, b) => b.c.total - a.c.total).slice(0, 5).map(({ t, c }) => `
          <tr onclick="openTerminal('${t.id}')" style="cursor:pointer">
            <td>${t.name}</td>
            <td class="r">${f1(c.total / t.potential * 100)}%</td>
            <td class="r">${f1(c.total)}</td>
            <td class="r" style="color:${t.idle >= 8 ? '#B3261E' : '#4A5C70'}">${t.idle} 周</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </section>
  </div>

  ${pendingCard()}

  <section class="card mt12">
    <div class="card-h"><h3>近期动态<em>ACTIVITY</em></h3><span class="sub" onclick="setTab('log')" style="cursor:pointer;color:#0143B0">查看全部 →</span></div>
    <div class="loglist">${S.log.slice(0, 5).map(logItem).join('') || '<div class="empty">暂无记录</div>'}</div>
  </section>`;
}

function pendingCard() {
  if (!S.pending.length) return '';
  return `<section class="card mt12">
    <div class="card-h"><h3>在途项目<em>IN PIPELINE</em></h3><span class="sub">${S.pending.length} 项等待结果</span></div>
    <table class="tb">
      <thead><tr><th>终端</th><th>项目</th><th class="r">预计出结果</th></tr></thead>
      <tbody>${S.pending.slice(0, 8).map(x => {
    const t = termById(x.tid), p = PROJECTS.find(y => y.id === x.pid);
    if (!t || !p) return '';
    const n = x.at - S.totalWeek;
    return `<tr><td>${t.name}</td><td>${p.name}</td><td class="r">${n <= 0 ? '本周' : n + ' 周后'}</td></tr>`;
  }).join('')}</tbody>
    </table>
  </section>`;
}

function logItem(l) {
  return `<div class="logi ${l.type}"><span class="t">${l.m}月${l.w ? '·' + l.w + '周' : ''}</span><span class="x">${esc(l.text)}</span></div>`;
}

/* =========================================================
   终端
   ========================================================= */
function openTerminal(id) { SEL.terminal = id; TAB = 'terminals'; render(); }

function allyBadge(t) {
  const al = allianceOf(t);
  if (!al) return '';
  return `<span class="badge-ally">医共体·${al.name.replace(WORLD.county, '').replace(WORLD.city, '')}</span>`;
}

function viewTerminals() {
  const st = computeStats();
  const list = S.terminals.map(t => ({ t, c: st.terms[t.id] })).sort((a, b) => b.c.total - a.c.total);
  if (!SEL.terminal || !S.terminals.some(t => t.id === SEL.terminal)) SEL.terminal = list[0].t.id;
  const cur = termById(SEL.terminal);
  const cu = st.terms[cur.id];

  return `
  <div class="pagehead">
    <div><h2>终端<span>ACCOUNTS</span></h2><p>越久不维护，认知和客情掉得越快。闲置 8 周以上的终端会被标红。</p></div>
  </div>
  <div class="term-layout">
    <div class="term-list">
      ${list.map(({ t, c }) => {
    const reps = c.reps.map(x => x.name);
    const sh = c.total / t.potential * 100;
    return `<div class="term-item ${t.id === SEL.terminal ? 'on' : ''}" onclick="openTerminal('${t.id}')">
          <div class="t1"><b>${t.name}</b><span>${TYPE_LABEL[t.type]}${t.tier ? ' · ' + t.tier : ''}</span></div>
          <div class="t2"><span>份额 ${f1(sh)}%</span><b>${f1(c.total)} 万</b></div>
          <span class="bar thin"><i style="width:${Math.min(100, sh * 2.2)}%"></i></span>
          <div class="t2" style="margin:5px 0 0;font-size:10.5px">
            <span>${reps.length ? reps.join('、') : '<span style="color:#B3261E">无代表驻点</span>'}</span>
            <span>${t.idle >= 8 ? `<span style="color:#B3261E">闲置 ${t.idle} 周</span>` : phtText(t)}</span>
          </div>
        </div>`;
  }).join('')}
    </div>
    <div>${terminalDetail(cur, cu)}</div>
  </div>`;
}

function barRow(label, value, color) {
  const c = color || (value < 25 ? '#B3261E' : value < 55 ? '#B8730A' : '#0143B0');
  return `<div class="detail-row"><span class="lb">${label}</span><span class="bar"><i style="width:${Math.min(100, value)}%;background:${c}"></i></span><span class="vl">${f1(value)}</span></div>`;
}

function phtText(t) {
  const dc = DIFFICULTY[S.diff];
  if (dc.noPht) return '<span style="color:#B8730A">不开药事会</span>';
  if (t.phtOpen > 0) return `<span style="color:#17795A">药事会窗口开放 · 剩 ${t.phtOpen} 周</span>`;
  if (t.phtNext <= 4) return `<span style="color:#B8730A">药事会临近 · 约 ${t.phtNext} 周</span>`;
  return `药事会约 ${t.phtNext} 周后`;
}

function polChips(p) {
  if (!p.pol || !p.pol.length) return '<span class="polchip self">自费</span>';
  return p.pol.map(k => `<span class="polchip ${k}">${POLICIES[k].short}</span>`).join('');
}

function effText(pid, t) {
  const e = effOf(pid, t);
  const parts = [];
  if (e.aw) parts.push('认知 +' + f1(e.aw));
  if (e.rel) parts.push('客情 +' + f1(e.rel));
  if (e.access) parts.push('准入 +' + f1(e.access));
  return parts.join(' · ');
}

function terminalDetail(t, c) {
  const al = allianceOf(t);
  const allyReps = al ? S.team.filter(r => al.members.filter(m => covers(r, m)).length >= 2) : [];
  const pharmRep = S.team.find(r => covers(r, t.id) && r.assign[t.id].pharm);

  const prodRows = PRODUCTS.map(p => {
    const it = c.items[p.id];
    const who = c.reps.filter(x => x.p.includes(p.id)).map(x => x.name);
    const ta = it.ta || 0.7;
    return `<tr><td><i style="display:inline-block;width:7px;height:7px;border-radius:2px;background:${p.color};margin-right:6px"></i>${p.name}
        <span class="tachip">${TA_NAME[p.ta]}</span>${polChips(p)}</td>
      <td class="r" style="color:${ta >= 1.1 ? '#17795A' : ta <= 0.65 ? '#B3261E' : '#8494A6'}">×${ta.toFixed(2)}</td>
      <td class="r">${f1(it.share * 100)}%</td><td class="r">${f1(it.sales)}</td>
      <td style="font-size:11px;color:${who.length ? '#4A5C70' : '#B3261E'}">${who.length ? who.join('、') : '无人负责'}</td></tr>`;
  }).join('');

  const acts = actsFor(t);

  return `<section class="card">
    <div class="card-h">
      <div><h3 style="font-size:16px">${t.name} <em style="font-size:11px;color:#8494A6">${TYPE_LABEL[t.type]}${t.tier ? ' · ' + t.tier : ''}</em> ${allyBadge(t)}</h3>
      <div class="hint">容量 ${f1(t.potential)} 万/月 · 竞品压力 ${f1(t.comp * 100)} · 闲置 ${t.idle} 周${t.idle >= 8 ? '（<span style="color:#B3261E">衰减加速</span>）' : ''} · ${phtText(t)}</div></div>
      <div style="text-align:right"><div style="font-size:24px;font-weight:700;letter-spacing:-.5px">${f1(c.total)}<small style="font-size:11px;font-weight:400;color:#8494A6"> 万/月</small></div>
      <div class="hint">份额 ${f1(c.total / t.potential * 100)}% · 投入 ${f1(t.spend)} 万 · 费效 ${t.spend > 0 ? f1(c.total * 12 / Math.max(t.spend, 0.1)) + ' 倍' : '—'}</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 28px">
      <div>${barRow('准入', t.access)}${barRow('认知度', t.awareness)}${barRow('客情', t.relation)}</div>
      <div>${barRow('覆盖强度', Math.min(100, c.covAll / 1.5 * 100), '#2F6BC9')}
        <div class="detail-row"><span class="lb">竞品压力</span><span class="bar"><i style="width:${t.comp * 100}%;background:#B8730A"></i></span><span class="vl">${f1(t.comp * 100)}</span></div>
        <div class="detail-row"><span class="lb">驻点代表</span><span style="flex:1;font-size:12px;color:${c.reps.length ? '#0F1A26' : '#B3261E'}">${c.reps.length ? c.reps.map(x => x.name + '（' + x.p.length + ' 品种）').join('、') : '空缺'}</span></div>
      </div>
    </div>

    ${t.pharm ? `<div class="ally-note"><b>院边药店 ${t.pharm} 家</b> · ${pharmRep ? `${pharmRep.name} 已承接` : '暂无人承接'}</div>` : ''}

    ${al ? `<div class="ally-note">
      <b>${al.name}</b> · 成员 ${al.members.length} 家
      ${allyReps.length ? `<span style="display:block;color:#17795A">${allyReps.map(r => r.name).join('、')} 跨成员负责，准入开发 ×1.35，份额 ×${(c.am).toFixed(2)}</span>`
      : '<span style="display:block;color:#8494A6">尚无代表跨成员负责。同一人覆盖 ≥2 家成员可享进药加成。</span>'}
    </div>` : ''}

    <div class="card-h mt16" style="margin-bottom:6px"><h3 style="font-size:12px;color:#4A5C70">品种拆分<em>BY PRODUCT</em></h3>
      <span class="sub">效果随终端类型与画像浮动</span></div>
    <table class="tb">
      <thead><tr><th>品种</th><th class="r">领域匹配</th><th class="r">份额</th><th class="r">销售</th><th>负责代表</th></tr></thead>
      <tbody>${prodRows}</tbody>
    </table>

    <div class="card-h mt16" style="margin-bottom:8px"><h3 style="font-size:12px;color:#4A5C70">本终端行动<em>ACTIONS</em></h3>
      <span class="sub">剩余精力 ${S.ap} · 预算 ${f1(S.cash)} 万</span></div>
    <div class="effgrid">
      ${acts.map(([id, name]) => {
    const p = PROJECTS.find(x => x.id === id);
    const real = projectCost(p, 1);
    const fr = failRateOf(p, t);
    const dis = S.ap < p.ap || S.cash < real || (id === 'channel' && !['primary', 'retail', 'city', 'region'].includes(t.type));
    return `<button class="effbtn" ${dis ? 'disabled' : ''} onclick="doProject('${id}','${t.id}')">
          <b>${name}</b><span>${effText(id, t)}</span>
          <em>${f1(real)}万 · 失败 ${f1(fr * 100)}%</em></button>`;
  }).join('')}
    </div>
  </section>`;
}

function actsFor(t) {
  if (t.type === 'retail') return [['patientedu', '患教会'], ['clerktrain', '店员培训'], ['display', '陈列谈判'], ['channel', '渠道建设'], ['relation', '客情维护'], ['pushstock', '压货']];
  if (t.type === 'primary') return [['dept', '科室会'], ['case', '病例征集'], ['channel', '渠道建设'], ['relation', '客情维护'], ['pushstock', '压货'], ['dev', '医院开发']];
  return [['dept', '科室会'], ['case', '病例征集'], ['dev', '医院开发'], ['relation', '客情维护'], ['pushstock', '压货']];
}

function doProject(pid, tid) {
  const r = launchProject(pid, tid ? [tid] : []);
  toast(r.msg, r.ok ? 'good' : 'bad');
  render();
}

/* =========================================================
   团队
   ========================================================= */
function viewTeam() {
  const cap = CFG.teamCap[S.level];
  return `
  <div class="pagehead">
    <div><h2>团队<span>TEAM</span></h2><p>编制 ${S.team.length}/${cap} 人 · 月薪 ${f1(salaryTotal())} 万 · 每周精力 ${apMax()}（随人数增长）</p></div>
    <div class="flex gap8">
      ${S.team.some(r => !r.filed) ? `<button class="btn" onclick="doFileAll()">统一备案（${S.team.filter(r => !r.filed).length} 人 · ${f1(0.5 * CFG.costScale[S.level] * S.team.filter(r => !r.filed).length)}万）</button>` : ''}
      <button class="btn" onclick="openMatrix()">团队明细配置</button>
      <button class="btn" ${S.ap < 1 || S.cash < projectCost(PROJECTS.find(p => p.id === 'hire'), 1) ? 'disabled' : ''} onclick="doProject('hire')">发布招聘（${f1(projectCost(PROJECTS.find(p => p.id === 'hire'), 1))}万）</button>
    </div>
  </div>

  ${S.candidates.length ? `<section class="card mt12" style="border-color:#BFD3EE;background:#FBFDFF">
    <div class="card-h"><h3>候选人<em>CANDIDATES</em></h3><span class="sub">录用前可对比能力与合规倾向</span></div>
    <div class="team-grid">${S.candidates.map(c => candidateCard(c)).join('')}</div>
  </section>` : ''}

  <div class="team-grid mt12">${S.team.map(r => repCard(r)).join('')}</div>
  ${!S.team.length ? '<div class="empty">团队空了。先去「行动」招人。</div>' : ''}

  <section class="card mt12">
    <div class="card-h"><h3>可见标签图鉴<em>TRAITS</em></h3><span class="sub">每人 1–2 个；另有 1–3 个未观测特质不显示</span></div>
    <div class="taggrid">${VISIBLE_TAGS.map(t => `<div><b>${t.name}</b>${t.desc}</div>`).join('')}</div>
    <div class="hint" style="border-top:1px solid #F0F4F8;padding-top:9px;margin-top:10px">
      标签直接改管理当量、覆盖、认知/客情推进、合规倾向、风险积累、失败率与薪资。同名叠加生效。
    </div>
  </section>

  <section class="card mt12">
    <div class="card-h"><h3>团队管理要点<em>NOTES</em></h3></div>
    <div class="hint">
      <b>管理当量</b>：1 家医院 = 1.0，卫生院 = 0.5，连锁 = 0.7，每多一个品种 +0.08，承接院边药店 +0.12。超过本人上限后，所有终端覆盖按超载比例衰减。<br>
      <b>医共体</b>：同一代表跨 ≥2 家成员，准入开发 ×1.35、份额加成，但每多一家成员 +0.2 当量。<br>
      <b>猜标签</b>：每人 2 次机会，用观察到的现象反推隐藏特质。猜中永久加强，猜错扣忠诚和覆盖。
    </div>
  </section>`;
}

function candidateCard(c) {
  return `<div class="rep" style="border-style:dashed">
    <div class="rh"><div class="avatar">${c.name[0]}</div>
      <div style="flex:1"><b>${c.name}</b>${tagChips(c)}
        <div class="meta">${ROLES[c.role].label} · 月薪 ${f1(c.salary)} 万</div></div></div>
    <div class="metrics">
      <div><label>能力</label><b>${f1(c.ability)}</b></div>
      <div><label>忠诚</label><b>${f1(c.loyalty)}</b></div>
      <div><label>合规倾向</label><b style="color:${c.ct < 50 ? '#B3261E' : '#17795A'}">${f1(c.ct)}</b></div>
    </div>
    <button class="btn sm block" onclick="hire('${c.id}')">录用</button>
  </div>`;
}

function tagChips(r) {
  const vis = (r.tags || []).map(id => VISIBLE_TAGS.find(t => t.id === id)).filter(Boolean);
  const rev = (r.revealed || []).map(id => HIDDEN_TAGS.find(t => t.id === id)).filter(Boolean);
  const html = vis.map(t => `<span class="tag tagv" title="${t.desc}">${t.name}</span>`).join('')
    + rev.map(t => `<span class="tag tagx" title="已确认：${t.desc}">${t.name} ✓</span>`).join('');
  const un = unknownCount(r);
  return html + (un ? `<span class="tag ghost" title="未观测特质，会实际影响产出，名字不显示">未知 ×${un}</span>` : '');
}

function obsBlock(r) {
  const o = observations(r);
  if (!o.length) return '';
  return `<div class="observe"><b>观察</b>${o.join('　·　')}</div>`;
}

function repCard(r) {
  const ids = assignIds(r);
  const L = repLoad(r);
  const capR = repCapOf(r);
  const over = L > capR;
  const exp = r.exposure;
  const expColor = exp < 18 ? '#17795A' : exp < 40 ? '#B8730A' : '#B3261E';
  const chips = ids.map(tid => {
    const t = termById(tid); if (!t) return '';
    const a = r.assign[tid];
    return `<span class="chip-term" onclick="openMatrix()">${t.name.replace(WORLD.county, '').replace(WORLD.city, '') || t.name}
      <i>${a.p.length}品</i>${a.pharm ? '<i class="ph">院边</i>' : ''}</span>`;
  }).join('');

  return `<div class="rep">
    <div class="rh">
      <div class="avatar">${r.name[0]}</div>
      <div style="flex:1"><b>${r.name}</b>${tagChips(r)}
        <div class="meta">${ROLES[r.role].label} · 月薪 ${f1(r.salary)} 万 · ${r.months >= 1 ? '在岗 ' + Math.round(r.months) + ' 月' : '本月入职'}
          ${r.filed ? '' : ' · <span style="color:#B3261E">未备案</span>'}</div></div>
      <div style="text-align:right"><div style="font-size:17px;font-weight:700">${f1(r.ability)}</div><div style="font-size:9.5px;color:#8494A6">能力</div></div>
    </div>
    <div class="metrics four">
      <div><label>月产出</label><b>${f1(outputOf(r))}</b></div>
      <div><label>忠诚</label><b style="color:${r.loyalty < 35 ? '#B3261E' : '#0F1A26'}">${f1(r.loyalty)}</b></div>
      <div><label>合规倾向</label><b style="color:${r.ct < 50 ? '#B3261E' : '#17795A'}">${f1(r.ct)}</b></div>
      <div><label>风险敞口</label><b style="color:${expColor}">${f1(exp)}</b></div>
    </div>
    <div class="loadrow">
      <span>管理当量</span>
      <span class="bar thin"><i style="width:${Math.min(100, L / capR * 100)}%;background:${over ? '#B3261E' : L > capR * 0.85 ? '#B8730A' : '#0143B0'}"></i></span>
      <b style="color:${over ? '#B3261E' : '#4A5C70'}">${f1(L)} / ${f1(capR)}</b>
    </div>
    <div class="msel">
      <button class="msel-btn" onclick="togglePicker('${r.id}')"><span>负责终端</span><b>${ids.length}</b><i>▾</i></button>
      ${PICKER === r.id ? `<div class="msel-pop">
        ${S.terminals.map(t => {
    const on = !!r.assign[t.id];
    return `<label class="msel-item" onclick="event.stopPropagation()">
            <input type="checkbox" ${on ? 'checked' : ''} onchange="setAssignUI('${r.id}','${t.id}',this.checked)">
            <span>${t.name}</span><em>${TYPE_LABEL[t.type]}</em></label>`;
  }).join('')}
        <div class="msel-foot" onclick="event.stopPropagation();openMatrix()">按品种精细配置 →</div>
      </div>` : ''}
    </div>
    <div class="chips">${chips || '<span class="hint">未分配终端</span>'}</div>
    ${obsBlock(r)}
    <div class="row">
      ${r.filed ? '' : `<button class="btn sm" onclick="doFile('${r.id}')">办理备案（${f1(0.5 * CFG.costScale[S.level])}万）</button>`}
      ${(r.coach || 0) > 0 ? `<span class="tag tagx">协访中 · 剩 ${r.coach} 周</span>` : ''}
      <button class="btn sm ghost" style="margin-left:-6px" onclick="openGuess('${r.id}')">猜标签<span style="color:#8494A6;margin-left:4px">剩 ${2 - (r.guesses || []).length} 次 · 1 精力</span></button>
    </div>
    <div class="row">
      <div class="pills">
        ${TACTICS.map(x => `<button class="pill ${r.tactic === x.id ? 'on' : ''} ${x.id === 'rebate' ? 'risk' : x.id === 'data' ? 'warn' : ''}" title="${x.desc}" onclick="setTactic('${r.id}','${x.id}')">${x.name}</button>`).join('')}
      </div>
    </div>
  </div>`;
}

function togglePicker(rid) { PICKER = PICKER === rid ? null : rid; render(); }
function setAssignUI(rid, tid, on) {
  const prevOwner = S.team.find(r => r.id !== rid && covers(r, tid) && r.assign[tid].p.length);
  setAssign(rid, tid, on);
  if (on && prevOwner) toast(`该终端原由 ${prevOwner.name} 负责，已整体转给当前代表`, 'bad');
  render();
}
function setTactic(rid, tid) {
  const r = S.team.find(x => x.id === rid);
  if (r) { r.tactic = tid; render(); }
}
function hire(cid) { const r = hireCandidate(cid); toast(r.msg, r.ok ? 'good' : 'bad'); render(); }

/* ---------- 矩阵 ---------- */
const REP_COLORS = ['#0143B0', '#0E7C6B', '#A8551B', '#6B3FA0', '#B3261E', '#1F6FB2', '#6E6100', '#4A5C70'];
function repColor(rid) {
  const i = S.team.findIndex(r => r.id === rid);
  return i < 0 ? '#8494A6' : REP_COLORS[i % REP_COLORS.length];
}
function openMatrix() { PICKER = null; setModal(matrixModal); }
function mxSet(tid, pid, rid) { setCellRep(tid, pid, rid || null); render(); }
function mxSetPharm(tid, rid) { setPharmRep(tid, rid || null); render(); }
function mxRowAll(tid) {
  const t = termById(tid);
  const any = S.team.some(r => covers(r, tid));
  if (any) S.team.forEach(r => { delete r.assign[tid]; });
  else if (S.team.length) {
    const rid = S.team[0].id;
    PRODUCTS.forEach(p => setCellRep(tid, p.id, rid));
    if (t.pharm) setPharmRep(tid, rid);
  }
  render();
}

function mxSelect(tid, pid, owner) {
  const col = owner ? repColor(owner.id) : '';
  const style = owner ? `background:${col}14;border-color:${col}66;color:${col}` : '';
  return `<select class="mxsel" style="${style}" onchange="mxSet('${tid}','${pid}',this.value)">
    <option value="">无人</option>
    ${S.team.map(r => `<option value="${r.id}" ${owner && owner.id === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
  </select>`;
}

function matrixModal() {
  if (!S.team.length) return { title: '团队明细配置', body: '<div class="empty">还没有代表</div>', footer: '<button class="btn" onclick="closeModal()">关闭</button>' };
  const st = computeStats();

  const ordered = S.terminals.slice().sort((a, b) => {
    const A = a.ally || 'zz', B = b.ally || 'zz';
    return A === B ? b.potential - a.potential : A < B ? -1 : 1;
  });
  let lastAlly = '__';
  const rows = ordered.map(t => {
    const c = st.terms[t.id];
    let groupRow = '';
    if ((t.ally || 'zz') !== lastAlly) {
      lastAlly = t.ally || 'zz';
      const al = allianceOf(t);
      groupRow = `<tr class="mxgroup"><td colspan="${PRODUCTS.length + 5}">${al ? `医共体 · ${al.name}（${al.members.length} 家）` : '独立终端'}</td></tr>`;
    }
    const cells = PRODUCTS.map(p => {
      const owner = S.team.find(r => covers(r, t.id) && r.assign[t.id].p.includes(p.id));
      return `<td class="mxcell">${mxSelect(t.id, p.id, owner)}</td>`;
    }).join('');
    const phOwner = S.team.find(r => covers(r, t.id) && r.assign[t.id].pharm);
    const phCell = t.pharm
      ? `<td class="mxcell"><select class="mxsel ph" style="${phOwner ? `background:${repColor(phOwner.id)}14;border-color:${repColor(phOwner.id)}66;color:${repColor(phOwner.id)}` : ''}" onchange="mxSetPharm('${t.id}',this.value)">
          <option value="">无人</option>
          ${S.team.map(r => `<option value="${r.id}" ${phOwner && phOwner.id === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
        </select><span class="mxsub">${t.pharm} 家</span></td>`
      : `<td class="mxcell"><span class="mxsub">—</span></td>`;
    return groupRow + `<tr ${c.reps.length ? '' : 'style="opacity:.55"'}>
      <td class="mxname" onclick="mxRowAll('${t.id}')">
        <b>${t.name}${t.ally ? '<span class="ally-dot"></span>' : ''}</b>
        <span>${TYPE_LABEL[t.type]}${t.pharm ? ' · 院边 ' + t.pharm : ''}${t.idle >= 8 ? ' · 闲置' + t.idle + '周' : ''}</span>
      </td>
      ${cells}${phCell}
      <td class="r mxnum"><b>${f1(c.total)}</b><span>万/月</span></td>
      <td class="r mxnum ${t.spend > 0 ? '' : 'dim'}"><b>${f1(t.spend)}</b><span>万</span></td>
      <td class="r mxnum dim"><b>${t.spend > 0 ? f1(c.total * 12 / Math.max(t.spend, 0.1)) : '—'}</b><span>${t.spend > 0 ? '倍' : ''}</span></td>
    </tr>`;
  }).join('');

  const emptyCells = S.terminals.reduce((a, t) => {
    const c = st.terms[t.id];
    return a + PRODUCTS.filter(p => !c.reps.some(x => x.p.includes(p.id))).length;
  }, 0);
  const overload = S.team.filter(r => repLoad(r) > repCapOf(r));

  const legend = S.team.map(r => {
    const L = repLoad(r);
    return `<span class="lg"><i style="background:${repColor(r.id)}"></i>${r.name}
      <em style="color:${L > repCapOf(r) ? '#B3261E' : '#8494A6'}">${f1(L)}/${f1(repCapOf(r))}</em></span>`;
  }).join('');

  return {
    title: '团队明细配置', en: 'TERRITORY MATRIX · 终端 × 品种', wide: true,
    body: `
      <div class="mxreps">
        <div class="mxlegend">${legend}</div>
        <div class="mxhint">格子里直接选人，颜色区分代表；点终端名可整行清空/指派。</div>
      </div>
      <div class="mxtable-wrap">
        <table class="mxtable">
          <thead><tr><th class="mxname">终端</th>
            ${PRODUCTS.map(p => `<th class="pcol"><i style="background:${p.color}"></i>${p.short}</th>`).join('')}
            <th class="pcol">院边药店</th><th class="r" style="width:78px">本月产出</th><th class="r" style="width:78px">累计投入</th><th class="r" style="width:64px">费效</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="mxsum">
        <div>无人负责 <b style="color:${emptyCells ? '#B8730A' : '#17795A'}">${emptyCells}</b> 个品种格${overload.length ? `　·　<span style="color:#B3261E">${overload.map(r => r.name).join('、')} 已超载</span>` : ''}</div>
        <div>合计产出 <b>${f1(st.total)}</b> 万/月　·　累计投入 <b>${f1(S.terminals.reduce((a, t) => a + t.spend, 0))}</b> 万</div>
      </div>`,
    footer: `<button class="btn primary" onclick="closeModal()">完成</button>`,
  };
}

/* =========================================================
   行动
   ========================================================= */
function viewActions() {
  const scale = CFG.costScale[S.level];
  return `
  <div class="pagehead">
    <div><h2>行动<span>ACTIONS</span></h2><p>每周有 ${apMax()} 点精力。同一项目在不同终端效果不同，成本按终端数叠加。</p></div>
    <div style="text-align:right">
      <div class="hint">剩余精力 <b style="font-size:16px;color:#0143B0">${S.ap}</b> / ${apMax()} ｜ 预算 ${f1(S.cash)} 万</div>
      ${S.lastPlan.length ? `<button class="btn sm mt12" onclick="replayPlan()">沿用上月计划（${S.lastPlan.length} 项）</button>` : ''}
    </div>
  </div>
  <div class="proj-grid">
    ${PROJECTS.map(p => {
    const need = p.multi > 0;
    const cost = projectCost(p, 1);
    const dis = S.ap < p.ap || S.cash < cost;
    return `<div class="proj">
        <h4>${p.name}<em>${p.en}</em></h4>
        <p>${p.desc}<br><span style="color:#8494A6">${p.help}</span></p>
        <div class="pp">
          <span>预算 <b>${f1(cost)}</b> 万${need ? '<i style="color:#8494A6">/终端</i>' : ''}</span>
          <span>精力 <b>${p.ap}</b></span>
          <span>上限 <b>${p.multi === 0 ? '全区域' : p.multi === -1 ? '—' : p.multi === -2 ? '1 人' : p.multi + ' 个'}</b></span>
        </div>
        <div class="pp" style="margin-top:-4px">
          ${p.fail ? `<span>基础失败率 <b style="color:${p.fail >= 0.22 ? '#B3261E' : '#B8730A'}">${f1(p.fail * 100)}%</b></span>` : '<span style="color:#17795A">不判定失败</span>'}
          ${p.delay ? `<span>延迟 <b>${p.delay} 个月</b></span>` : '<span>当周生效</span>'}
        </div>
        <button class="btn ${dis ? '' : 'primary'} sm block" ${dis ? 'disabled' : ''} onclick="openAction('${p.id}')">${p.multi === -1 ? '执行' : p.multi === -2 ? '选择代表' : (p.multi === 0 ? '执行（全区域）' : '选择终端')}</button>
      </div>`;
  }).join('')}
  </div>
  ${pendingCard()}
  <section class="card mt16">
    <div class="card-h"><h3>资源账本<em>LEDGER</em></h3><span class="sub">单终端成本 · 当前层级</span></div>
    <table class="tb">
      <thead><tr><th>项目</th><th class="r">单终端成本</th><th class="r">精力</th><th class="r">失败率</th><th class="r">延迟</th><th>适用</th></tr></thead>
      <tbody>${PROJECTS.map(p => `<tr><td>${p.name}</td><td class="r">${f1(p.cost * scale)} 万</td><td class="r">${p.ap}</td>
        <td class="r">${p.fail ? f1(p.fail * 100) + '%' : '—'}</td><td class="r">${p.delay ? p.delay + ' 个月' : '即时'}</td>
        <td style="color:#8494A6">${p.multi === -1 ? '无需终端' : p.multi === 0 ? '全区域' : '最多 ' + p.multi + ' 个'}</td></tr>`).join('')}</tbody>
    </table>
  </section>`;
}

function openAction(pid) {
  const p = PROJECTS.find(x => x.id === pid);
  if (p.multi === -1) { doProject(pid); return; }
  if (p.multi === -2) { ACT = { pid, sel: [], repId: null }; setModal(coachModal); return; }
  ACT = { pid, sel: p.multi === 0 ? S.terminals.map(t => t.id) : [] };
  setModal(actionModal);
}

function toggleActTarget(tid) {
  const i = ACT.sel.indexOf(tid);
  if (i >= 0) ACT.sel.splice(i, 1); else ACT.sel.push(tid);
  renderModal();
}

function actionModal() {
  const p = PROJECTS.find(x => x.id === ACT.pid);
  const n = p.multi === 0 ? S.terminals.length : ACT.sel.length;
  const cost = projectCost(p, Math.max(1, n));
  const ap = projectAP(p, Math.max(1, n));
  const overLimit = p.multi > 0 && ACT.sel.length > p.multi;
  const dis = !n || overLimit || S.ap < ap || S.cash < cost;

  let avgFail = 0;
  if (p.fail && n) {
    const list = p.multi === 0 ? S.terminals : ACT.sel.map(id => termById(id));
    avgFail = list.reduce((a, t) => a + failRateOf(p, t), 0) / list.length;
  }

  const list = p.multi === 0 ? '' : `<div class="picklist">
    ${S.terminals.map(t => {
    const on = ACT.sel.includes(t.id);
    const fr = p.fail ? failRateOf(p, t) : 0;
    const disabledCh = p.id === 'channel' && !['primary', 'retail', 'city', 'region'].includes(t.type);
    return `<label class="pickitem ${on ? 'on' : ''} ${disabledCh ? 'dis' : ''}">
        <input type="checkbox" ${on ? 'checked' : ''} ${disabledCh ? 'disabled' : ''} onchange="toggleActTarget('${t.id}')">
        <span class="nm">${t.name}</span>
        <span class="mt">${p.id === 'dev' ? phtText(t) : effText(p.id, t)}</span>
        ${p.fail ? `<span class="fr" style="color:${fr > 0.3 ? '#B3261E' : '#B8730A'}">失败 ${f1(fr * 100)}%</span>` : ''}
      </label>`;
  }).join('')}
    </div>`;

  const summary = `<div class="mxsum" style="margin-top:10px">
      <div>已选 <b>${n}</b> 个终端${p.multi > 0 ? `（上限 ${p.multi}）` : ''} · 预算 <b>${f1(cost)}</b> 万 · 精力 <b>${ap}</b></div>
      <div>${p.fail ? `平均失败率 <b style="color:${avgFail > 0.3 ? '#B3261E' : '#B8730A'}">${f1(avgFail * 100)}%</b> · ` : ''}${p.delay ? `<b>${p.delay} 个月后</b>出结果` : '当周生效'}</div>
    </div>
    ${overLimit ? `<div class="warn-line">超出上限，最多选 ${p.multi} 个终端</div>` : ''}`;

  return {
    title: `${p.name} · 选择终端`, en: p.en, wide: true,
    body: `<div class="hint" style="margin-bottom:10px">${p.desc}</div>${list}${summary}`,
    footer: `<button class="btn" onclick="closeModal()">取消</button>
      <button class="btn primary" ${dis ? 'disabled' : ''} onclick="confirmAction()">确认执行</button>`,
  };
}

function coachModal() {
  const p = PROJECTS.find(x => x.id === ACT.pid);
  const cost = projectCost(p, 1);
  const dis = !ACT.repId || S.ap < p.ap || S.cash < cost;
  const list = S.team.map(r => {
    const n = assignIds(r).length;
    const L = repLoad(r);
    return `<label class="pickitem ${ACT.repId === r.id ? 'on' : ''}">
      <input type="radio" name="coachrep" ${ACT.repId === r.id ? 'checked' : ''} onchange="ACT.repId='${r.id}';renderModal()">
      <span class="nm">${r.name}</span>
      <span class="mt">${(r.tags || []).map(id => (VISIBLE_TAGS.find(t => t.id === id) || {}).name).filter(Boolean).join('·')} ｜ ${n} 个终端 · 当量 ${f1(L)} · 忠诚 ${f1(r.loyalty)}${(r.coach || 0) > 0 ? ' · 协访中' : ''}</span>
      <span class="fr" style="color:#8494A6">${r.filed ? '' : '未备案'}</span>
    </label>`;
  }).join('');
  return {
    title: `${p.name} · 选择代表`, en: p.en, wide: true,
    body: `<div class="hint" style="margin-bottom:10px">陪谁跑一周，谁下个月就好过一点。协访同时会提高他的忠诚，也会让他的终端客情更稳。</div>
      <div class="picklist">${list || '<div class="empty">没有代表</div>'}</div>
      <div class="mxsum" style="margin-top:10px"><div>预算 <b>${f1(cost)}</b> 万 · 精力 <b>${p.ap}</b></div><div>效果持续 4 周</div></div>`,
    footer: `<button class="btn" onclick="closeModal()">取消</button>
      <button class="btn primary" ${dis ? 'disabled' : ''} onclick="confirmCoach()">确认协访</button>`,
  };
}

function confirmCoach() {
  const p = PROJECTS.find(x => x.id === ACT.pid);
  const r = launchProject(p.id, [], ACT.repId);
  toast(r.msg, r.ok ? 'good' : 'bad');
  if (r.ok) { MODAL = null; renderModal(); }
  render();
}

function doFile(rid) {
  const r = fileRep(rid);
  toast(r.msg, r.ok ? 'good' : 'bad');
  render();
}
function doFileAll() {
  const r = fileAll();
  toast(r.msg, r.ok ? 'good' : 'bad');
  render();
}

function confirmAction() {
  const p = PROJECTS.find(x => x.id === ACT.pid);
  const r = launchProject(p.id, ACT.sel);
  toast(r.msg, r.ok ? 'good' : 'bad');
  if (r.ok) { MODAL = null; renderModal(); }
  render();
}

function replayPlan() {
  let n = 0;
  S.lastPlan.forEach(it => { const r = launchProject(it.pid, it.tids || [], it.repId); if (r.ok) n++; });
  toast(n ? `已按上月计划执行 ${n} 项` : '精力或预算不足，未能执行', n ? 'good' : 'bad');
  render();
}

/* =========================================================
   产品
   ========================================================= */
function setW(pid, v) { const p = PRODUCTS.find(x => x.id === pid); if (p) { p.w = +v; render(); } }
function setStrat(pid, sid) { const p = PRODUCTS.find(x => x.id === pid); if (p) { p.strat = sid; render(); } }
function doRes(pid) { const r = grantRes(pid); toast(r.msg, r.ok ? 'good' : 'bad'); render(); }

function viewProducts() {
  const st = computeStats();
  const mt = marketTask();
  const mk = relOf('internal', 'marketing');

  return `
  <div class="pagehead">
    <div><h2>产品<span>PRODUCTS</span></h2><p>精力权重决定代表在这条线上分到多少力气；策略决定用学术、价格还是渠道撬。权重不是独立资源——给这条线多了，别的线就少了。</p></div>
    <div class="hint" style="text-align:right">市场部好感 <b style="color:${mk >= 60 ? '#17795A' : mk < 35 ? '#B3261E' : '#0143B0'}">${f1(mk)}</b>（低于 35 无法申请资源）</div>
  </div>

  <div class="prodcards">
    ${PRODUCTS.map(p => {
    const share = productShare(p.id) * 100;
    const sales = st.byProduct[p.id] || 0;
    const w = p.w == null ? 50 : p.w;
    const strat = p.strat || 'academic';
    const canRes = mk >= 35 && (p.resWeeks || 0) <= 0;
    const resCost = f1(4 * CFG.costScale[S.level]);
    return `<section class="card prod">
      <div class="prod-h">
        <i style="background:${p.color}"></i>
        <div style="flex:1"><b>${p.name}</b>
          <div class="hint">${p.kind} · <span class="tachip">${TA_NAME[p.ta]}</span>${polChips(p)}</div></div>
        <div style="text-align:right"><div style="font-size:18px;font-weight:700">${f1(sales)}<small style="font-size:10px;font-weight:400;color:#8494A6"> 万/月</small></div>
          <div class="hint">份额 ${f1(share)}%</div></div>
      </div>
      <div class="prod-row">
        <span class="lb">精力权重</span>
        <input class="wrange" type="range" min="0" max="100" step="5" value="${w}" onchange="setW('${p.id}',this.value)">
        <b style="width:34px;text-align:right">${w}</b>
      </div>
      <div class="prod-row" style="gap:5px">
        <span class="lb">营销策略</span>
        <div class="pills" style="flex:1">
          ${PRODUCT_STRATS.map(x => `<button class="pill ${strat === x.id ? 'on' : ''}" title="${x.desc}" onclick="setStrat('${p.id}','${x.id}')">${x.name}</button>`).join('')}
        </div>
      </div>
      <div class="prod-foot">
        <span class="hint">${(p.resWeeks || 0) > 0 ? `<span style="color:#17795A">学术资源生效中 · 剩 ${p.resWeeks} 周</span>` : `认知推进按 ${PRODUCT_STRATS.find(x => x.id === strat).desc}`}</span>
        <button class="btn sm" ${canRes ? '' : 'disabled'} onclick="doRes('${p.id}')">申请学术资源（${resCost}万 · 好感 -8）</button>
      </div>
    </section>`;
  }).join('')}
  </div>

  <section class="card mt12">
    <div class="card-h"><h3>市场部任务<em>MARKETING TASKS</em></h3><span class="sub">完成 +6 好感，失败不掉</span></div>
    ${mt ? `<div class="taskbox">
      <div class="tk-h"><b>${mt.task.name}</b><span>${mt.cur} / ${mt.need}</span></div>
      <div class="hint">${mt.task.desc}</div>
      <span class="bar"><i style="width:${Math.min(100, mt.cur / mt.need * 100)}%;background:${mt.done ? '#17795A' : '#0143B0'}"></i></span>
    </div>` : '<div class="empty">暂无任务</div>'}
    <div class="hint mt12" style="border-top:1px solid #F0F4F8;padding-top:9px">
      市场部给的任务都很具体：交病例、办活动、做份额、铺覆盖。做完加好感，好感够了才批学术资源。
    </div>
  </section>`;
}

/* =========================================================
   关系
   ========================================================= */
const REL_FX = {
  boss: v => `评价增速 ${(v * 25).toFixed(0)}%`,
  compliance: v => `被抽查概率 ${(v * 30).toFixed(0)}%`,
  finance: v => `费用上限 ${(v * 12).toFixed(0)}%`,
  marketing: v => `区域会成本 ${(-v * 15).toFixed(0)}%`,
  medical: v => `学术认知增益 ${(v * 15).toFixed(0)}%`,
  commercial: v => `渠道准入 ${(v * 18).toFixed(0)}%`,
  hr: v => `新人忠诚 +${(v * 8).toFixed(0)}`,
  hospital: v => `客情 / 进院 ${(v * 12).toFixed(0)}%`,
  distributor: v => `回款与配送 ${(v * 8).toFixed(0)}%`,
  kol: v => `病例 / 会议增益 ${(v * 15).toFixed(0)}%`,
  association: v => `合规冲击缓冲 ${(v * 20).toFixed(0)}%`,
};
const REL_HOW = {
  boss: '完成月度目标 +、事件严格执行 +、协访 +1',
  compliance: '合规评分 ≥85 每月 +2，<60 每月 -2；合规培训 +5',
  finance: '预算低于 20 万会掉；上级评价 ≥70 每月 +0.6',
  marketing: '区域学术会 +2；上级评价 ≥70 每月 +0.6',
  medical: '科室会 +0.8、病例征集 +2、区域会 +1',
  commercial: '渠道建设 +3',
  hr: '招聘 +1、团队培训 +1.5',
  hospital: '客情维护 +2',
  distributor: '渠道建设 +3',
  kol: '病例征集 +2、区域学术会 +2',
  association: 'DRG 特例单议 +3',
};

function relRow(def, group) {
  const v = relOf(group, def.id);
  const m = (v - 50) / 50;
  const color = v >= 70 ? '#17795A' : v >= 45 ? '#0143B0' : v >= 30 ? '#B8730A' : '#B3261E';
  return `<div class="relrow">
    <div class="relhead"><b>${def.name}</b><span style="color:${color}">${f1(v)}</span></div>
    <span class="bar thin"><i style="width:${v}%;background:${color}"></i></span>
    <div class="reldesc">${def.desc}</div>
    <div class="relfx">当前：<b style="color:${color}">${REL_FX[def.id](m)}</b>　·　${REL_HOW[def.id]}</div>
  </div>`;
}

function viewRelations() {
  return `
  <div class="pagehead">
    <div><h2>关系<span>RELATIONSHIPS</span></h2><p>公司内部看部门配合，外部看客户与渠道。关系每星期向 50 回落，要持续经营。</p></div>
  </div>
  <div class="grid-2">
    <section class="card">
      <div class="card-h"><h3>公司内部<em>INTERNAL</em></h3><span class="sub">目标：让流程站在你这边</span></div>
      ${REL_DEFS.internal.map(d => relRow(d, 'internal')).join('')}
    </section>
    <section class="card">
      <div class="card-h"><h3>外部资源<em>EXTERNAL</em></h3><span class="sub">目标：让客户替你说话</span></div>
      ${REL_DEFS.external.map(d => relRow(d, 'external')).join('')}
    </section>
  </div>
  <section class="card mt12">
    <div class="card-h"><h3>关系怎么来<em>HOW IT MOVES</em></h3></div>
    <div class="hint">
      关系不是独立资源：合规做得好，合规部自然给你方便；区域会办得多，市场部和专家网络会记住你。<br>
      开局选「空降兵」会自带一批外部关系，但内部各部门起点更低——空降的人，没人替你说话。
    </div>
  </section>`;
}

/* =========================================================
   合规
   ========================================================= */
function viewCompliance() {
  const risk = teamRisk();
  const p = (0.015 + Math.pow(risk / 100, 2) * 0.5) * 100;
  const zone = risk < 20 ? ['安全', '#17795A'] : risk < 40 ? ['关注', '#B8730A'] : risk < 60 ? ['预警', '#C05621'] : ['高危', '#B3261E'];
  const badLogs = S.log.filter(l => l.type === 'bad').slice(0, 8);

  return `
  <div class="pagehead">
    <div><h2>合规<span>COMPLIANCE</span></h2><p>风险敞口来自每个代表的日常动作。它会累积、会被举报、会在最不该来的时候被查。</p></div>
  </div>
  <div class="grid-4">
    <div class="stat ${S.compliance < 60 ? 'danger' : ''}">
      <label>合规评分<em>SCORE</em></label>
      <div class="v" style="color:${S.compliance < 60 ? '#B3261E' : S.compliance < 78 ? '#B8730A' : '#17795A'}">${f1(S.compliance)}</div>
      <div class="foot">低于 30 将被免职；低于 75 不予晋升</div>
    </div>
    <div class="stat"><label>团队风险敞口<em>RISK</em></label><div class="v">${f1(risk)}</div>
      <div class="foot"><span class="chip" style="background:${zone[1]}18;color:${zone[1]}">${zone[0]}</span></div></div>
    <div class="stat ${p > 12 ? 'danger' : ''}"><label>月被检查概率<em>INSPECTION</em></label>
      <div class="v">${f1(p)}<small>%</small></div><div class="foot">随风险敞口平方增长</div></div>
    <div class="stat"><label>合规经营月度<em>CLEAN</em></label>
      <div class="v">${f0(S.history.filter(h => h.risk < 20).length)}<small>个月</small></div><div class="foot">敞口 &lt; 20 的月份累计</div></div>
  </div>

  <section class="card mt12">
    <div class="card-h"><h3>风险敞口分布<em>EXPOSURE MAP</em></h3><span class="sub">阈值 18：约谈 / 40：解聘 / 55：品种停采 / 75：移交司法</span></div>
    <div class="gauge-wrap">
      <div class="gauge-track">
        <div class="gauge-fill" style="width:${Math.min(100, risk)}%;background:${zone[1]}"></div>
        <div class="gauge-tick" style="left:20%"></div><div class="gauge-tick" style="left:40%"></div>
        <div class="gauge-tick" style="left:60%"></div><div class="gauge-tick" style="left:75%"></div>
      </div>
      <div class="gauge-scale">
        <span style="left:0">0</span><span style="left:20%">20 关注</span><span style="left:40%">40 预警</span>
        <span style="left:60%">60 高危</span><span style="left:75%">75 司法</span>
      </div>
    </div>
    <table class="tb mt12">
      <thead><tr><th style="width:150px">代表</th><th style="width:110px">打法</th><th style="width:100px">合规倾向</th><th class="r" style="width:100px">风险敞口</th><th class="r" style="width:70px">状态</th></tr></thead>
      <tbody>
      ${S.team.length ? S.team.map(r => {
    const e = r.exposure;
    const st = e < 18 ? ['低', '#17795A'] : e < 40 ? ['关注', '#B8730A'] : e < 55 ? ['高', '#C05621'] : ['极高', '#B3261E'];
    return `<tr><td>${r.name}</td><td style="color:#4A5C70">${tacticOf(r).name}</td>
          <td>${f1(r.ct)}</td><td class="r" style="color:${st[1]};font-weight:600">${f1(e)}</td><td class="r" style="color:${st[1]}">${st[0]}</td></tr>`;
  }).join('') : '<tr><td colspan="5" class="empty">无人在岗</td></tr>'}
      </tbody>
    </table>
    <div class="flex gap8 mt12">
      <button class="btn primary sm" ${S.ap < 1 || S.cash < projectCost(PROJECTS.find(x => x.id === 'compliance'), 1) ? 'disabled' : ''} onclick="doProject('compliance')">开展合规培训（${f1(projectCost(PROJECTS.find(x => x.id === 'compliance'), 1))}万）</button>
    </div>
  </section>

  <section class="card mt12">
    <div class="card-h"><h3>合规相关记录<em>INCIDENTS</em></h3></div>
    ${badLogs.length ? badLogs.map(logItem).join('') : '<div class="empty">没有不良记录。保持住。</div>'}
  </section>`;
}

function viewLog() {
  return `<div class="pagehead"><div><h2>记录<span>LOG</span></h2><p>全部决策与结果。共 ${S.log.length} 条。</p></div></div>
  <section class="card"><div class="loglist">${S.log.map(logItem).join('') || '<div class="empty">暂无记录</div>'}</div></section>`;
}

/* =========================================================
   弹窗
   ========================================================= */
function renderModal() {
  const root = document.getElementById('modal-root');
  if (!MODAL) { root.innerHTML = ''; return; }
  const m = MODAL();
  root.innerHTML = `<div class="mask" onclick="${m.dismissible === false ? '' : 'closeModal()'}">
    <div class="modal ${m.wide ? 'wide' : ''}" onclick="event.stopPropagation()">
      <div class="modal-h"><h3>${m.title}</h3>${m.en ? `<div class="en">${m.en}</div>` : ''}</div>
      <div class="modal-b">${m.body}</div>
      <div class="modal-f">${m.footer || ''}</div>
    </div>
  </div>`;
}
function closeModal() { MODAL = null; renderModal(); render(); }
function setModal(builder) { MODAL = builder; renderModal(); }

/* ---------- 开局：成长路线 → 姓名与标签 ---------- */
function renderStart() {
  const app = document.getElementById('app');
  if (START.stage === 'path') {
    app.innerHTML = `<div class="start"><div class="start-inner">
      <div class="kicker">内资药企 · 营销体系模拟</div>
      <h1>药企模拟器<small>PHARMA SIMULATOR</small></h1>
      <div class="lead">先选一条成长路线。三条线的评价标准不同：营销看份额和回款，学术看证据和共识，市场看产品策略和准入。</div>
      <div class="pathgrid">
        ${PATHS.map(p => `<div class="pathcard ${p.ready ? '' : 'off'}" onclick="${p.ready ? `choosePath('${p.id}')` : `toast('${p.name}还在开发中','bad')`}">
          <div class="pcn">${p.name}<em>${p.en}</em></div>
          <div class="pcd">${p.desc}</div>
          <div class="pcb">${p.ready ? '进入 →' : '敬请期待'}</div>
        </div>`).join('')}
      </div>
      <div class="fine">本作为虚构模拟，企业与人物均无对应。游戏中出现的违规操作均设有对应的监管后果。</div>
    </div></div>`;
    return;
  }
  app.innerHTML = `<div class="start"><div class="start-inner">
    <div class="kicker">${PATHS.find(p => p.id === START.path).name} · 个人能力配置</div>
    <h1 style="font-size:36px">你是谁<small>YOUR PROFILE</small></h1>
    <div class="lead" style="margin:12px 0 14px">选 2 个个人标签，它们会一直影响你的管理半径、团队执行和项目成败。难度决定医院药事会的召开方式。</div>
    <div class="namebox" style="margin-bottom:14px">
      <input id="pname" placeholder="输入你的名字" value="${START.name}" maxlength="8" oninput="START.name=this.value">
    </div>
    <div class="diffrow">
      ${['easy', 'normal', 'hard'].map(k => `<div class="diffcard ${START.diff === k ? 'on' : ''}" onclick="START.diff='${k}';renderStart()">
        <b>${DIFFICULTY[k].name}<em>${DIFFICULTY[k].en}</em></b><span>${DIFFICULTY[k].desc}</span></div>`).join('')}
    </div>
    <div class="tagpick">
      ${PLAYER_TAGS.map(t => `<div class="tpick ${START.tags.includes(t.id) ? 'on' : ''}" onclick="togglePlayerTag('${t.id}')">
        <b>${t.name}</b><span>${t.desc}</span></div>`).join('')}
    </div>
    <div class="namebox" style="margin-top:18px">
      <button class="btn-start" onclick="startGame()" ${START.tags.length !== 2 ? 'style="opacity:.5;cursor:not-allowed"' : ''}>进入市场</button>
      <span style="font-size:11px;color:#8FB4E8">已选 ${START.tags.length}/2</span>
    </div>
    <div class="fine">标签可以重复开局尝试，不同组合对早期现金流影响很大。</div>
  </div></div>`;
}

function choosePath(id) {
  START.path = id;
  START.stage = 'setup';
  renderStart();
}
function togglePlayerTag(id) {
  const i = START.tags.indexOf(id);
  if (i >= 0) START.tags.splice(i, 1);
  else if (START.tags.length < 2) START.tags.push(id);
  else toast('最多选 2 个', 'bad');
  renderStart();
}

function startGame() {
  if (START.tags.length !== 2) { toast('请选择 2 个个人标签', 'bad'); return; }
  const el = document.getElementById('pname');
  const name = (el && el.value.trim()) || START.name || '王磊';
  newGame(name, START.path, START.tags, START.diff);
  TAB = 'overview';
  SEL.terminal = S.terminals[0].id;
  render();
  showBrief();
}

function showHelp() {
  setModal(() => ({
    title: '怎么玩', en: 'HOW TO PLAY', wide: true,
    body: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 24px">
        <div>
          <p style="margin-bottom:6px"><b style="color:#0F1A26">一、回合</b><br>一个月 4 周，每周都能行动。每周精力 = 基础 + 团队规模（上限 4，可被个人标签 +1）。周末点「推进本周」结算，并开一次周会。</p>
          <p style="margin-bottom:6px"><b style="color:#0F1A26">二、周会</b><br>每周给团队一个要求：冲量 / 抓学术 / 做客情 / 抓合规。执行度由代表的忠诚和标签决定——老江湖、空降兵会打折扣，铁人、拼命三郎执行得更彻底。</p>
          <p style="margin-bottom:6px"><b style="color:#0F1A26">三、终端维护</b><br>越久不动的终端，认知和客情掉得越快。闲置 8 周以上会额外增加项目失败率。</p>
          <p style="margin-bottom:6px"><b style="color:#0F1A26">四、动作效果</b><br>同一个科室会，在三甲、卫生院、连锁药店里效果完全不同；终端还有学术型/关系型/价格型画像。选终端时能看到实际加成。</p>
        </div>
        <div>
          <p style="margin-bottom:6px"><b style="color:#0F1A26">五、标签</b><br>每人 1–2 个可见标签，另有 1–3 个隐藏特质。卡片上的「观察」是从异常现象反推的线索，每人可猜 2 次。</p>
          <p style="margin-bottom:6px"><b style="color:#0F1A26">六、医共体</b><br>同一代表覆盖 ≥2 家成员，准入开发 ×1.35、份额加成，但管理当量更高。</p>
          <p style="margin-bottom:6px"><b style="color:#0F1A26">七、管理事件</b><br>公司要求分 严格执行 / 选择执行 / 不执行，不执行会在 2–3 个月后引来专项核查。</p>
        </div>
      </div>
      <div class="hint" style="border-top:1px solid #F0F4F8;padding-top:8px;margin-top:2px">
        每局的产品、城市、终端、竞品都是随机生成的。金额单位万元，比率保留 1 位小数。
      </div>`,
    footer: `<button class="btn primary" onclick="closeModal()">知道了</button>`,
  }));
}

function showBrief() {
  const act = ACTS[S.level];
  setModal(() => ({
    title: act.title, en: act.org + ' · ' + act.region,
    body: `<p>${act.brief}</p><p style="color:#0143B0;font-size:12.5px;border-left:2px solid #0143B0;padding-left:10px">${act.quote}</p>
      <div class="hint">目标：12 个月内月均销售 ${f1(act.target)} 万元，区域份额 ${f1(act.shareTarget * 100)}%。本周精力 ${S.ap} 点。</div>`,
    footer: `<button class="btn primary" onclick="closeModal()">开始</button>`,
  }));
}

/* ---------- 推进一周 ---------- */
function onEndWeek() {
  if (S.over) return;
  const res = endWeek();
  WEEK_RES = res;
  if (res.incident) toast(res.incident.name + '：' + res.incident.text, res.incident.caught ? 'bad' : 'good');
  render();
  showWeekMeeting(res);
}

function showWeekMeeting(res) {
  const w = res.week;
  const team = S.team.map(r => {
    const out = r.lastWeek ? r.lastWeek.output : 0;
    const exp = r.exposure;
    return `<div class="wkrow">
      <span class="nm">${r.name}</span>
      <span class="tg">${(r.tags || []).map(id => (VISIBLE_TAGS.find(t => t.id === id) || {}).name).filter(Boolean).join('·')}</span>
      <span class="out">${f1(out)} 万</span>
      <span class="ex" style="color:${exp < 18 ? '#17795A' : exp < 40 ? '#B8730A' : '#B3261E'}">风险 ${f1(exp)}</span>
    </div>`;
  }).join('');

  const power = (function () {
    let sum = 0, n = 0;
    S.team.forEach(r => {
      let c = 0.35 + r.loyalty / 160;
      const has = k => (r.tags || []).includes(k) || (r.revealed || []).includes(k);
      if (has('grinder')) c += 0.1; if (has('ironman')) c += 0.12; if (has('rookie')) c += 0.08;
      if (has('oldfox')) c -= 0.08; if (has('parachute')) c -= 0.1;
      if (r.hidden.includes('procrast')) c -= 0.1;
      if (r.hidden.includes('niceguy')) c += 0.05;
      if (r.hidden.includes('sidegig')) c -= 0.2;
      sum += Math.max(0, Math.min(1.2, c)); n++;
    });
    return n ? sum / n : 0;
  })();

  const opts = WEEKLY_ORDERS.map(o => `<button class="opt" onclick="confirmOrder('${o.id}')">
      <b>${o.name}<span style="color:#8494A6;font-weight:400"> · 预计执行度 ${(power * 100).toFixed(0)}%</span></b>
      <span>${o.desc}</span></button>`).join('');

  setModal(() => ({
    title: `第 ${w.month} 月 · 第 ${w.week} 周 周会`, en: 'WEEKLY REVIEW', dismissible: false, wide: true,
    body: `
      <div class="wkhead">
        <div><span class="hint">本周销售</span><b>${f1(w.sales)} 万</b></div>
        <div><span class="hint">团队风险</span><b>${f1(w.risk)}</b></div>
        <div><span class="hint">剩余预算</span><b>${f1(S.cash)} 万</b></div>
        <div><span class="hint">在途项目</span><b>${S.pending.length} 项</b></div>
      </div>
      <div class="wklist">${team || '<div class="empty">无人在岗</div>'}</div>
      <div class="hint" style="margin:10px 0 6px">给下周定个调子——执行度取决于每个人的忠诚和标签，不会 100% 照做。</div>
      ${opts}`,
    footer: '',
  }));
}

function confirmOrder(id) {
  applyOrder(id);
  MODAL = null; renderModal();
  const res = WEEK_RES;
  if (res && res.monthReport) { showMonthReport(res); return; }
  render();
}

/* ---------- 月报 ---------- */
function showMonthReport(res) {
  const r = res.monthReport;
  const inc = r.incident;
  const incHtml = inc ? `<div style="background:${inc.caught ? '#FBF0EF' : '#EDF7F2'};border:1px solid ${inc.caught ? '#EFD3D0' : '#CFE7DC'};border-radius:9px;padding:11px 13px;margin:10px 0">
      <b style="color:${inc.caught ? '#B3261E' : '#17795A'}">${inc.name}</b>
      <div style="font-size:12px;margin-top:4px;color:${inc.caught ? '#7A3B35' : '#2C6650'}">${inc.text}${inc.extra ? ' ' + inc.extra : ''}</div></div>` : '';
  const resHtml = (r.resolved && r.resolved.length)
    ? `<div style="background:#F4F8FE;border:1px solid #DCE6F5;border-radius:9px;padding:10px 12px;margin:8px 0;font-size:12px;color:#2E4A72"><b>在途项目结算</b><br>${r.resolved.join('；')}</div>` : '';
  const row = (l, v, d, neutral) => `<div class="rep-row"><span>${l}</span><b class="${neutral ? '' : d > 0 ? 'up' : d < 0 ? 'down' : ''}">${v}</b></div>`;

  setModal(() => ({
    title: `第 ${r.month} 个月经营简报`, en: 'MONTHLY REPORT', dismissible: false,
    body: `
      <div style="display:flex;gap:16px;margin-bottom:6px">
        <div style="flex:1"><div class="hint">本月销售</div><div style="font-size:26px;font-weight:700">${f1(r.sales)}<small style="font-size:11px;font-weight:400;color:#8494A6"> 万元</small></div></div>
        <div style="flex:1"><div class="hint">市场份额</div><div style="font-size:26px;font-weight:700">${f1(r.share)}<small style="font-size:11px;font-weight:400;color:#8494A6"> %</small></div></div>
        <div style="flex:1"><div class="hint">达标率</div><div style="font-size:26px;font-weight:700;color:${r.progress >= 100 ? '#17795A' : r.progress >= 80 ? '#B8730A' : '#B3261E'}">${f1(r.progress)}<small style="font-size:11px;font-weight:400;color:#8494A6"> %</small></div></div>
      </div>
      <div style="border-top:1px solid #F0F4F8;margin:8px 0 4px"></div>
      ${r.delta == null ? row('销售环比', '首月', 0, true) : row('销售环比', (r.delta >= 0 ? '+' : '') + f1(r.delta) + '%', r.delta)}
      ${row('毛利贡献（费用池）', '+' + f1(r.gross) + ' 万元', 1, true)}
      ${row('人力成本', '-' + f1(r.salary) + ' 万元', -1, true)}
      ${row('账面净流入', (r.net >= 0 ? '+' : '') + f1(r.net) + ' 万元', r.net)}
      ${row('可用预算余额', f1(r.cash) + ' 万元', r.cashDelta)}
      ${row('合规评分', f1(r.compliance) + '（' + (r.compDelta >= 0 ? '+' : '') + f1(r.compDelta) + '）', r.compDelta, true)}
      ${row('上级评价', f1(r.reputation) + '（' + (r.repDelta >= 0 ? '+' : '') + f1(r.repDelta) + '）', r.repDelta, true)}
      ${r.up ? `<div class="rep-row"><span>超额预算上缴</span><b style="color:#8494A6">-${f1(r.up)} 万元</b></div>` : ''}
      ${resHtml}${incHtml}
      <div class="hint">${r.progress >= 100 ? '本月达标。' : r.progress >= 80 ? '接近目标，再推一把。' : '低于目标 80%，上级开始关注你的周报。'}</div>`,
    footer: `<button class="btn primary" onclick="afterReport()">继续</button>`,
  }));
}

function afterReport() {
  closeModal();
  const pp = S.pendingPromotion;
  S.pendingPromotion = null;
  if (S.over) { if (S.over.win) { winModal(); return; } gameOverModal(); return; }
  if (pp && pp.type === 'promote') { promoteModal(); return; }
  if (pp && pp.type === 'extend') { extendModal(); return; }
  maybeEvent();
}

function extendModal() {
  setModal(() => ({
    title: '延期考核', en: 'EXTENSION',
    body: `<p>年度考核没有达标。省区给了你半年时间，但这句话说得很轻——意思是，没有下一次了。</p>
      <div class="rep-row"><span>近 3 月均销售</span><b>${f1(recentAvg(3))} 万元</b></div>
      <div class="rep-row"><span>目标</span><b>${f1(ACTS[S.level].target)} 万元</b></div>
      <div class="hint mt12">剩余时间：到第 18 个月为止。</div>`,
    footer: `<button class="btn primary" onclick="closeModal();maybeEvent();">继续</button>`,
  }));
}

function promoteModal() {
  const next = S.level + 1;
  if (next > 3) { winModal(); return; }
  const a = ACTS[next];
  setModal(() => ({
    title: `晋升 · ${a.rank}`, en: 'PROMOTION', dismissible: false,
    body: `<p>省区会议上，周立群把你的名字念了出来。会议室里有人在鼓掌，有人在看手机。</p>
      <p style="font-size:13px;color:#0F1A26;font-weight:600">你接手 ${a.org}，区域从 ${ACTS[S.level].region} 扩到 ${a.region}。</p>
      <p>${a.brief}</p>
      <div class="hint">编制扩至 ${CFG.teamCap[next]} 人 · 目标月均 ${f1(a.target)} 万元 · 份额 ${f1(a.shareTarget * 100)}%</div>`,
    footer: `<button class="btn" onclick="thinkPromotion()">考虑一下</button>
      <button class="btn" onclick="refusePromotion()">拒绝</button>
      <button class="btn primary" onclick="doPromoteAndContinue()">接受晋升</button>`,
  }));
}

function openOffer() { if (S.offer) promoteModal(); }

function thinkPromotion() {
  S.offer = { level: S.level + 1 };
  MODAL = null; renderModal();
  toast('晋升邀请已挂起，本回合内随时可以接受', 'flat');
  render();
}

function refusePromotion() {
  S.offer = null;
  S.flags.noPromoteUntil = S.monthInAct + 6;
  S.reputation = Math.max(0, S.reputation - 8);
  relAdd('internal', 'boss', -12);
  log('bad', '你拒绝了晋升。省区总监沉默了三秒，说"再想想"。六个月内不再考虑你的晋升。');
  closeModal();
}
function doPromoteAndContinue() {
  S.offer = null;
  doPromote();
  MODAL = null; renderModal(); render();
  showBrief();
}

function gameOverModal() {
  const o = S.over || { win: false, title: '出局', reason: '年度考核未达标。' };
  const sales = S.history.length ? S.history[S.history.length - 1].sales : 0;
  setModal(() => ({
    title: o.title, en: 'CAREER RESULT', dismissible: false,
    body: `<p style="font-size:14px;color:#0F1A26;font-weight:600">${o.reason}</p>
      <div class="rep-row"><span>最终职级</span><b>${ACTS[S.level].rank}</b></div>
      <div class="rep-row"><span>在任月数</span><b>${S.totalMonth - 1} 个月</b></div>
      <div class="rep-row"><span>最后月销售</span><b>${f1(sales)} 万元</b></div>
      <div class="rep-row"><span>合规评分</span><b>${f1(S.compliance)}</b></div>
      <div class="hint mt12">${o.win ? '你走到了营销总监的位置。这只是开始。' : '换一条路重来：合规经营的增长更慢，但不会在第十个月被人抬走。'}</div>`,
    footer: `<button class="btn" onclick="restart()">重新开始</button>`,
  }));
}

function winModal() {
  setModal(() => ({
    title: '营销总监', en: 'ENDING', dismissible: false,
    body: `<p>你坐在营销中心的会议室主位。桌上摊着六大区的报表，每一张都有你熟悉的数字。</p>
      <p>有人问你，怎么从一个县做到这里。</p>
      <p style="color:#0143B0">"把每个终端算清楚，把每个人放在对的位置上，然后别让任何人替你承担不该承担的代价。"</p>
      <div class="hint">通关。销售额 ${f1(S.history.length ? S.history[S.history.length - 1].sales : 0)} 万 / 月。</div>`,
    footer: `<button class="btn primary" onclick="restart()">再来一局</button>`,
  }));
}

function restart() {
  MODAL = null; renderModal();
  S = null; PICKER = null; SEL = { terminal: null };
  START = { stage: 'path', path: null, name: '王磊', tags: [], diff: 'normal' };
  render();
}

/* ---------- 事件 ---------- */
function maybeEvent() {
  if (S.over) return;
  const ev = rollEvent();
  if (!ev) return;
  PENDING = ev;
  const opts = ev.options.map((o, i) => {
    const c = o.cost ? ` <span style="color:#8494A6">· ${f1(o.cost * CFG.costScale[S.level])} 万</span>` : '';
    const ap = o.ap ? ` <span style="color:#8494A6">· ${o.ap} 精力</span>` : '';
    return `<button class="opt ${ev.mgmt ? 'mgmt' : ''}" onclick="chooseEvent(${i})">
      <b>${o.label}${c}${ap}</b><span>${o.desc || ''}</span></button>`;
  }).join('');
  setModal(() => ({
    title: ev.title, en: ev.en,
    body: `<div class="evtag ${ev.mgmt ? 'mgmt' : ''}">${ev.mgmt ? '来自公司 / 上级' : '市场事件'}</div>
      <p>${evText(ev)}</p>${opts}`, footer: '', dismissible: false,
  }));
}

function chooseEvent(i) {
  const ev = PENDING;
  PENDING = null;
  const res = applyEventOption(ev, i);
  render();
  setModal(() => ({
    title: '结果', en: 'OUTCOME',
    body: `<p style="color:${res.tone === 'bad' ? '#9E2A21' : res.tone === 'good' ? '#14684C' : '#0F1A26'}">${res.text}</p>`,
    footer: `<button class="btn primary" onclick="closeModal()">继续</button>`,
  }));
}

/* ---------- 猜标签 ---------- */
function openGuess(rid) { setModal(() => guessModal(rid)); }

function guessModal(rid) {
  const r = S.team.find(x => x.id === rid);
  if (!r) return { title: '猜标签', body: '<div class="empty">没有这个人</div>', footer: '<button class="btn" onclick="closeModal()">关闭</button>' };
  const used = (r.guesses || []).length;
  const left = 2 - used;
  const obs = observations(r);

  const items = HIDDEN_TAGS.map(t => {
    const guessed = (r.guesses || []).some(g => g.tag === t.id);
    const revealed = (r.revealed || []).includes(t.id);
    const cls = revealed ? 'hit' : guessed ? 'miss' : '';
    const right = revealed ? '<em class="ok">已确认</em>'
      : guessed ? '<em class="no">猜过·未中</em>'
        : `<button class="btn sm" ${left <= 0 || S.ap < 1 ? 'disabled' : ''} onclick="doGuess('${rid}','${t.id}')">就是这个</button>`;
    return `<div class="gitem ${cls}"><div class="gt"><b>${t.name}</b><span>${t.desc}</span></div>${right}</div>`;
  }).join('');

  return {
    title: `猜标签 · ${r.name}`, en: 'READ THE PERSON', wide: true,
    body: `
      <div class="hint" style="margin-bottom:8px">
        每人最多猜 <b>2 次</b>，每次消耗 <b>1 点精力</b>。猜中：永久 +0.25 管理当量、+5% 覆盖；猜错：忠诚 -7、覆盖 -6%。
        剩余 <b style="color:${left ? '#0143B0' : '#B3261E'}">${left}</b> 次。
      </div>
      ${obs.length ? `<div class="observe" style="margin-bottom:10px"><b>观察到的现象</b>${obs.join('　·　')}</div>` : '<div class="observe" style="margin-bottom:10px"><b>观察</b>暂无明显异常，凭判断压</div>'}
      <div class="ggrid">${items}</div>`,
    footer: `<button class="btn" onclick="closeModal()">关闭</button>`,
  };
}

function doGuess(rid, tagId) {
  const res = guessTag(rid, tagId);
  if (!res.ok) { toast(res.msg, 'bad'); return; }
  render();
  const r = S.team.find(x => x.id === rid);
  setModal(() => ({
    title: res.hit ? '判断成立' : '判断失误', en: 'VERDICT',
    body: `<p style="font-size:14px;color:${res.hit ? '#14684C' : '#9E2A21'};font-weight:600">${res.msg}</p>
      <div class="rep-row"><span>标签效果</span><b>${res.tag.desc}</b></div>
      ${res.hit ? '<div class="rep-row"><span>管理加成</span><b class="up">当量 +0.25 · 覆盖 +5%</b></div>'
        : '<div class="rep-row"><span>代价</span><b class="down">忠诚 -7 · 覆盖 -6%</b></div>'}
      <div class="hint mt12">剩余猜测次数：${2 - (r.guesses || []).length}</div>`,
    footer: `<button class="btn primary" onclick="closeModal();openGuess('${rid}')">继续看</button>`,
  }));
}

/* ---------- 全局点击关闭多选 ---------- */
document.addEventListener('click', e => {
  if (PICKER && !e.target.closest('.msel')) { PICKER = null; render(); }
});

window.addEventListener('DOMContentLoaded', () => render());
