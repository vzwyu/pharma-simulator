/* =========================================================
   药企模拟器 · Pharma Simulator
   data.js — 配置、随机世界生成、标签、项目、事件
   ========================================================= */

const CFG = {
  startCash: 120,         // 起始预算（万元）
  grossRate: 0.58,        // 销售额 → 可支配市场费用
  apBase: 1,              // 每周基础管理精力
  apPerRep: 0.17,         // 每名下属每周额外精力
  apCap: 4,
  teamCap: [6, 10, 15, 22],
  costScale: [1, 1.9, 3.6, 8],
  salaryScale: [1, 1.3, 1.7, 2.2],
  weeksPerMonth: 4,
  repCap: 2.0,
};

/* =========================================================
   随机世界生成
   ========================================================= */
const CH_A = '青安临宁丰平昌江源德兴和顺泰恒瑞嘉益';
const CH_B = '阳川州城溪陵谷坪山水原泉岭浦';

function rndInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function genPlace(suffix) {
  let n, g = 0;
  do { n = pickOne(CH_A) + pickOne(CH_B); g++; } while (g < 3 && WORLD._used[n]);
  WORLD._used[n] = 1;
  return n + suffix;
}

const WORLD = { _used: {} };

const TYPE_LABEL = { hospital: '医院', primary: '基层', retail: '零售', city: '城市市场', region: '大区' };
const TYPE_COST = { hospital: 1.0, primary: 0.5, retail: 0.7, city: 1.0, region: 1.0 };

/* 竞品（虚构） */
const RIVALS = ['瑞和药业', '东岭制药', '长康生物', '博远医药'];

/* ---------------- 治疗领域（参考 ATC 大类） ---------------- */
const TA_LIST = [
  { id: 'C', name: '心血管', en: 'Cardiovascular' },
  { id: 'A', name: '消化代谢', en: 'Alimentary' },
  { id: 'N', name: '神经精神', en: 'Neuro' },
  { id: 'J', name: '抗感染', en: 'Anti-infective' },
  { id: 'R', name: '呼吸', en: 'Respiratory' },
  { id: 'L', name: '抗肿瘤', en: 'Oncology' },
  { id: 'M', name: '免疫骨骼', en: 'Immunology' },
  { id: 'G', name: '泌尿生殖', en: 'Genitourinary' },
];
const TA_NAME = {};
TA_LIST.forEach(t => { TA_NAME[t.id] = t.name; });

/* 政策身份：可以同时拥有多个，也可能一个都没有（自费） */
const POLICIES = {
  nrdl: { id: 'nrdl', name: '医保目录', short: '医保', mul: 1.16, access: 1.10, price: 0, note: '报销身份，院内准入和处方意愿都更好' },
  vbp:  { id: 'vbp',  name: '集采中标', short: '集采', mul: 1.34, access: 1.14, price: -0.05, note: '以价换量，份额高但单价被压' },
  edl:  { id: 'edl',  name: '基药目录', short: '基药', mul: 1.08, access: 1.06, price: 0.01, primary: 1.24, note: '基层配备考核品种，卫生院和连锁最好卖' },
};

/* ---------------- 产品 ---------------- */
const PROD_ARCH = [
  { id: 'herb', kind: '独家中成药', driver: '学术', base: 0.030, awWeight: 1.30, priceEdge: 0.020,
    color: '#0143B0', 医保: '乙类', price: 68, ta: ['C', 'N', 'A'], polWeight: { nrdl: 0.5, edl: 0.15, vbp: 0.02 },
    mix: { hospital: 0.34, primary: 0.06, retail: 0.38, city: 0.34, region: 0.34 },
    note: '高值独家，靠学术证据和专家共识撬动，起量慢、天花板高' },
  { id: 'base', kind: '基药 · 医保甲类', driver: '渠道', base: 0.055, awWeight: 0.80, priceEdge: 0.050,
    color: '#2F6BC9', 医保: '甲类', price: 12, ta: ['A', 'C', 'J'], polWeight: { nrdl: 0.55, edl: 0.55, vbp: 0.25 },
    mix: { hospital: 0.24, primary: 0.56, retail: 0.22, city: 0.24, region: 0.24 },
    note: '基药放量品，吃配送覆盖和基层网络，价格是硬通货' },
  { id: 'bio', kind: '生物制剂', driver: '准入', base: 0.026, awWeight: 1.10, priceEdge: -0.010,
    color: '#0E7C6B', 医保: '乙类（谈判）', price: 1280, ta: ['L', 'M', 'N'], polWeight: { nrdl: 0.3, edl: 0.02, vbp: 0.05 },
    mix: { hospital: 0.26, primary: 0.04, retail: 0.08, city: 0.26, region: 0.26 },
    note: '高值生物药，进院难、谈判门槛高，一旦进院几乎没有替代' },
  { id: 'gen', kind: '仿制化药', driver: '价格', base: 0.045, awWeight: 0.90, priceEdge: -0.030,
    color: '#8A5A00', 医保: '乙类', price: 35, ta: ['R', 'G', 'C'], polWeight: { nrdl: 0.5, edl: 0.2, vbp: 0.4 },
    mix: { hospital: 0.16, primary: 0.34, retail: 0.32, city: 0.16, region: 0.16 },
    note: '多家竞品在拼，没有价格和客情就是陪跑' },
];

const PROD_POOL = {
  herbPre: ['参', '芪', '丹', '葛', '术', '苓', '芍'],
  herbMid: ['通脉', '心宁', '益气', '化瘀', '养阴', '安神'],
  herbForm: ['胶囊', '颗粒', '片'],
  chemPre: ['贝', '洛', '瑞', '沙', '替', '缬', '唑'],
  chemMid: ['格', '米', '维', '普', '拉', '啶'],
  chemForm: ['片', '胶囊', '缓释片'],
};

const PRODUCTS = [];
const MIX = { hospital: {}, primary: {}, retail: {}, city: {}, region: {} };

function genProductNames() {
  const used = {};
  const out = [];
  const nm = (k, f) => { let n, g = 0; do { n = f(); g++; } while (used[n] && g < 6); used[n] = 1; return n; };
  out.push({ id: 'herb', name: nm('h', () => pickOne(PROD_POOL.herbPre) + pickOne(PROD_POOL.herbMid) + pickOne(PROD_POOL.herbForm)) });
  out.push({ id: 'base', name: nm('b', () => pickOne(PROD_POOL.chemPre) + pickOne(PROD_POOL.chemMid) + pickOne(PROD_POOL.chemForm)) });
  out.push({ id: 'bio', name: nm('x', () => '注射用重组人源化单抗 JY-' + rndInt(10, 99)) });
  out.push({ id: 'gen', name: nm('g', () => pickOne(PROD_POOL.chemPre) + pickOne(PROD_POOL.chemMid) + pickOne(PROD_POOL.chemForm)) });
  return out;
}

function buildProducts() {
  const names = genProductNames();
  PRODUCTS.length = 0;
  const usedTa = {};
  PROD_ARCH.forEach((a, i) => {
    const cands = a.ta.filter(x => !usedTa[x]);
    const ta = pickOne(cands.length ? cands : a.ta);
    usedTa[ta] = 1;
    const pol = [];
    Object.keys(a.polWeight).forEach(k => { if (Math.random() < a.polWeight[k]) pol.push(k); });
    if (pol.includes('vbp') && !pol.includes('nrdl') && Math.random() < 0.6) pol.push('nrdl');
    PRODUCTS.push({
      id: a.id, name: names[i].name, short: names[i].name.slice(0, 2),
      kind: a.kind, driver: a.driver, base: a.base, awWeight: a.awWeight,
      priceEdge: a.priceEdge, color: a.color, 医保: a.医保, price: a.price, note: a.note,
      ta, pol,
    });
  });
  // 归一化品种结构
  Object.keys(MIX).forEach(tp => {
    const sum = PROD_ARCH.reduce((s, a) => s + (a.mix[tp] || 0), 0);
    PROD_ARCH.forEach(a => { MIX[tp][a.id] = (a.mix[tp] || 0) / sum; });
  });
}

/* ---------------- 终端模板 ---------------- */
/* [名称, 类型, 潜力, 准入, 认知, 客情, 竞品, 等级, 院边药店, 门店数] */
const TERM_SPECS = [
  [
    ['{county}人民医院', 'hospital', 55, 40, 12, 18, 0.52, '二级甲等', 6, 0],
    ['{county}中医院', 'hospital', 40, 25, 10, 15, 0.50, '二级甲等', 4, 0],
    ['{county}妇幼保健院', 'hospital', 20, 12, 8, 10, 0.45, '二级', 2, 0],
    ['{town1}卫生院', 'primary', 15, 55, 15, 25, 0.32, '一级', 0, 0],
    ['{town2}卫生院', 'primary', 10, 45, 12, 18, 0.30, '一级', 0, 0],
    ['{county}大药房（{stores}家）', 'retail', 28, 30, 18, 30, 0.42, '连锁', 0, 16],
  ],
  [
    ['{city}中心医院', 'hospital', 78, 12, 8, 10, 0.62, '三级甲等', 8, 0],
    ['{city}第一人民医院', 'hospital', 62, 10, 6, 8, 0.60, '三级甲等', 6, 0],
    ['{city}中医院', 'hospital', 48, 18, 12, 15, 0.56, '三级甲等', 5, 0],
    ['{city}妇幼保健院', 'hospital', 32, 8, 6, 8, 0.50, '三级甲等', 3, 0],
    ['{county}人民医院', 'hospital', 55, 62, 38, 45, 0.50, '二级甲等', 6, 0],
    ['{county}中医院', 'hospital', 40, 48, 32, 38, 0.48, '二级甲等', 4, 0],
    ['{county2}人民医院', 'hospital', 42, 22, 10, 14, 0.52, '二级甲等', 4, 0],
    ['{county2}中医院', 'hospital', 30, 18, 8, 12, 0.48, '二级甲等', 3, 0],
    ['{city}连锁药房（{stores2}家）', 'retail', 43, 35, 22, 32, 0.44, '连锁', 0, 96],
    ['{city}基层医疗集团（{stores3}家）', 'primary', 60, 50, 25, 35, 0.36, '基层网络', 0, 0],
  ],
  [
    ['{c1}（省会）', 'city', 420, 6, 4, 5, 0.64, '省会', 0, 0],
    ['{city}', 'city', 490, 30, 18, 24, 0.54, '样板地市', 0, 0],
    ['{c2}', 'city', 240, 8, 5, 6, 0.52, '地市', 0, 0],
    ['{c3}', 'city', 200, 5, 4, 5, 0.50, '地市', 0, 0],
    ['{c4}', 'city', 180, 8, 5, 6, 0.52, '地市', 0, 0],
    ['{c5}', 'city', 160, 6, 4, 5, 0.50, '地市', 0, 0],
    ['{c6}', 'city', 130, 4, 3, 4, 0.48, '地市', 0, 0],
    ['县域基层网络（{stores4}家）', 'region', 180, 22, 12, 16, 0.38, '基层网络', 0, 0],
  ],
  [
    ['华东大区', 'region', 1800, 10, 5, 6, 0.58, '重点', 0, 0],
    ['华南大区', 'region', 1100, 6, 4, 5, 0.55, '成长', 0, 0],
    ['华北大区', 'region', 1400, 8, 4, 5, 0.58, '重点', 0, 0],
    ['华中大区', 'region', 1200, 7, 4, 5, 0.56, '重点', 0, 0],
    ['西南大区', 'region', 950, 5, 3, 4, 0.52, '成长', 0, 0],
    ['西北 · 东北大区', 'region', 750, 4, 3, 4, 0.50, '潜力', 0, 0],
  ],
];

const ALLY_SPECS = [
  [
    { id: 'a1', name: '{county}第一医共体', lead: 0, members: [0, 3, 4] },
    { id: 'a2', name: '{county}中医医共体', lead: 1, members: [1, 2] },
  ],
  [
    { id: 'b1', name: '{city}城区医共体', lead: 0, members: [0, 1, 9] },
    { id: 'b2', name: '{county}医共体', lead: 4, members: [4, 5, 6, 7] },
    { id: 'b3', name: '{city}中医医联体', lead: 2, members: [2, 3] },
  ],
  [],
  [],
];

const TERMINALS = [[], [], [], []];
const ALLIANCES = [[], [], [], []];

function fill(str) {
  return String(str)
    .replace('{county}', WORLD.county)
    .replace('{county2}', WORLD.county2)
    .replace('{city}', WORLD.city)
    .replace('{town1}', WORLD.town1)
    .replace('{town2}', WORLD.town2)
    .replace('{c1}', WORLD.cities[0]).replace('{c2}', WORLD.cities[1])
    .replace('{c3}', WORLD.cities[2]).replace('{c4}', WORLD.cities[3])
    .replace('{c5}', WORLD.cities[4]).replace('{c6}', WORLD.cities[5]);
}

function buildTaAff(type) {
  const aff = {};
  TA_LIST.forEach(t => { aff[t.id] = 0.55 + Math.random() * 0.2; });
  const strong = {
    hospital: ['C', 'A', 'N', 'L'],
    primary: ['R', 'A', 'J', 'C'],
    retail: ['C', 'A', 'R', 'G'],
    city: ['C', 'A', 'N', 'L'],
    region: ['C', 'A', 'N', 'L'],
  }[type] || ['C', 'A'];
  strong.sort(() => Math.random() - 0.5).slice(0, 2).forEach(k => { aff[k] = 1.15 + Math.random() * 0.2; });
  return aff;
}

function buildTerminals() {
  TERM_SPECS.forEach((specs, act) => {
    TERMINALS[act].length = 0;
    specs.forEach((s, i) => {
      const stores = s[2] === 28 ? rndInt(14, 24)
        : s[2] === 43 ? rndInt(80, 160)
          : s[2] === 180 ? rndInt(260, 380) : 0;
      let name = fill(s[0]);
      name = name.replace('{stores}', stores)
        .replace('{stores2}', stores).replace('{stores3}', rndInt(36, 58))
        .replace('{stores4}', stores);
      TERMINALS[act].push({
        id: 't' + act + '-' + i,
        name, type: s[1], potential: s[2], access: s[3],
        awareness: s[4], relation: s[5], comp: s[6], tier: s[7],
        pharm: s[8] || 0, stores: s[9] ? stores : 0,
        ally: null, spend: 0, idle: 0,
        prof: pickOne(['academic', 'relation', 'price']),
        taAff: buildTaAff(s[1]),
        phtNext: 0,
      });
    });
    ALLIANCES[act].length = 0;
    (ALLY_SPECS[act] || []).forEach(a => {
      const members = a.members.map(i => TERMINALS[act][i].id);
      ALLIANCES[act].push({ id: a.id, name: fill(a.name), lead: TERMINALS[act][a.lead].id, members });
      members.forEach(mid => { TERMINALS[act].find(t => t.id === mid).ally = a.id; });
    });
  });
}

/* ---------------- 四幕 ---------------- */
const ACTS = [
  { level: 0, title: '第一幕 · 县域', region: '', org: '', rank: '县区经理', target: 38, shareTarget: 0.20, brief: '', quote: '' },
  { level: 1, title: '第二幕 · 地市', region: '', org: '', rank: '地区经理', target: 90, shareTarget: 0.18, brief: '', quote: '' },
  { level: 2, title: '第三幕 · 省区', region: '', org: '', rank: '大区经理', target: 400, shareTarget: 0.19, brief: '', quote: '' },
  { level: 3, title: '第四幕 · 全国', region: '全国', org: '营销中心', rank: '营销总监', target: 1800, shareTarget: 0.24, brief: '', quote: '' },
];

function buildActs() {
  const co = WORLD.company;
  ACTS[0].region = WORLD.county;
  ACTS[0].org = co + ' · ' + WORLD.city + '办事处';
  ACTS[0].brief = `报到第一天，办事处只有两张桌子、一台打印机和两个还在跑市场的代表。${WORLD.county} 38 万人口，三个县级医院、两个卫生院、一个连锁药房。可支配预算 120 万，编制 6 人。`;
  ACTS[0].quote = '“县域市场没有奇迹，只有一家一家医院啃下来。”——省区总监 周立群';
  ACTS[1].region = WORLD.city;
  ACTS[1].org = co + ' · ' + WORLD.city + '区域';
  ACTS[1].brief = `${WORLD.county}做成了省内的样板县。公司把${WORLD.city}市区连同两个县一起交给你，团队编制扩到 10 人。市中心医院是三甲，门槛高、盘子大，也是所有竞品的必争之地。`;
  ACTS[1].quote = '“进了三甲，才有资格谈品牌。”——' + WORLD.city + '中心医院 药剂科主任';
  ACTS[2].region = WORLD.province;
  ACTS[2].org = co + ' · ' + WORLD.province + '省区';
  ACTS[2].brief = '八个地市，编制 15 人。省级平台的打法和县域完全不同——拼的是准入节奏、医保身份和学术话语权。';
  ACTS[2].quote = '“省级市场不是加法，是乘法。做对一个地市，其他七个会自己找上门。”';
  ACTS[3].org = co + ' · 营销中心';
  ACTS[3].brief = '六大区、二十八个省区、一千两百人的销售体系，编制 22 人。你签的每一份文件都会变成一线的动作。合规、增长、利润，三件事同时压在你桌上。';
  ACTS[3].quote = '“到这个位置，你要管的不是销量，是别人敢不敢按你说的做。”';
}

const COMPANIES = ['江右药业', '润泽医药', '南岭制药', '恒岳医药'];

function generateWorld() {
  WORLD._used = {};
  WORLD.company = pickOne(COMPANIES);
  WORLD.province = genPlace('省');
  WORLD.city = genPlace('市');
  WORLD.county = genPlace('县');
  WORLD.county2 = genPlace('县');
  WORLD.town1 = genPlace('镇');
  WORLD.town2 = genPlace('镇');
  WORLD.cities = [];
  for (let i = 0; i < 6; i++) WORLD.cities.push(genPlace('市'));
  buildProducts();
  buildTerminals();
  buildActs();
}

/* =========================================================
   代表标签
   ========================================================= */
/* eff 键位：cap 当量上限 / cov 覆盖 / aw 认知 / rel 客情 / ct 合规倾向
   growth 成长 / salary 薪资 / exposure 风险积累 / fail 失败率
   ally 医共体协同 / loyalty0 初始忠诚 / loyalty 每月忠诚漂移 / rebate 带金收益 */
const VISIBLE_TAGS = [
  { id: 'grinder', name: '拼命三郎', weight: 16, ability: [48, 64], loyalty: [55, 75], ct: [55, 72],
    eff: { cap: 0.7, growth: 0.4, rel: -0.1 }, desc: '当量上限 +0.7，成长快；跑得广但关系做不细' },
  { id: 'scholar', name: '学术派', weight: 16, ability: [52, 70], loyalty: [65, 85], ct: [82, 95],
    eff: { ct: 14, aw: 0.45, rel: -0.15, exposure: -0.3 }, desc: '合规 +14，认知推进 +45%，风险积累 -30%；不擅应酬' },
  { id: 'rookie', name: '应届生', weight: 14, ability: [28, 42], loyalty: [70, 90], ct: [72, 92],
    eff: { cap: -0.5, salary: -0.25, growth: 1.1, aw: -0.1 }, desc: '薪资 -25%，学得快；当量上限 -0.5' },
  { id: 'oldfox', name: '老江湖', weight: 15, ability: [68, 86], loyalty: [45, 65], ct: [28, 50],
    eff: { rel: 0.5, ct: -12, exposure: 0.25, aw: -0.15 }, desc: '客情 +50%，但合规 -12，风险积累 +25%' },
  { id: 'connector', name: '关系户', weight: 13, ability: [38, 55], loyalty: [60, 82], ct: [50, 70],
    eff: { rel: 0.75, ally: 0.02, cov: -0.05, aw: -0.2 }, desc: '客情 +75%，医共体协同更强；专业底子薄' },
  { id: 'analyst', name: '数据控', weight: 12, ability: [50, 68], loyalty: [58, 78], ct: [70, 88],
    eff: { cov: 0.08, aw: 0.2, rel: -0.2 }, desc: '覆盖 +8%，认知 +20%；不爱应酬' },
  { id: 'ironman', name: '铁人', weight: 12, ability: [45, 62], loyalty: [65, 85], ct: [60, 78],
    eff: { cap: 0.4, loyalty0: 8 }, desc: '当量上限 +0.4，出勤稳定，忠诚高' },
  { id: 'parachute', name: '空降兵', weight: 10, ability: [58, 76], loyalty: [40, 58], ct: [55, 72],
    eff: { cov: 0.1, salary: 0.15, loyalty0: -10 }, desc: '覆盖 +10%，但薪资 +15%、忠诚偏低' },
  { id: 'local', name: '本地人', weight: 13, ability: [42, 60], loyalty: [62, 84], ct: [55, 75],
    eff: { ally: 0.03, rel: 0.2 }, desc: '医共体协同 +0.03，客情推进 +20%；入职时就能确认' },
];

const HIDDEN_TAGS = [
  { id: 'fragile', name: '玻璃心', weight: 10, eff: { loyalty: -0.6 }, desc: '忠诚持续下滑' },
  { id: 'slippery', name: '老油条', weight: 10, eff: { cov: 0.06, exposure: 0.2 }, desc: '效率略高，但风险积累更快' },
  { id: 'purist', name: '学术洁癖', weight: 8, eff: { rebate: -0.4, exposure: -0.4 }, desc: '拒绝带金，风险低' },
  { id: 'jobhunt', name: '骑驴找马', weight: 7, eff: { jobhunt: 1 }, desc: '在岗满 10 个月后忠诚快速下滑' },
  { id: 'charmer', name: '会来事', weight: 10, eff: { rel: 0.35, ct: -6 }, desc: '客情推进快，合规感弱' },
  { id: 'introvert', name: '闷葫芦', weight: 10, eff: { aw: 0.3, rel: -0.3 }, desc: '讲得清产品，处不好关系' },
  { id: 'perfect', name: '强迫症', weight: 9, eff: { fail: -0.06, cov: -0.04 }, desc: '执行细致，动作偏慢' },
  { id: 'nightowl', name: '夜猫子', weight: 9, eff: { cap: 0.3, loyalty: -0.2 }, desc: '能熬夜，稳定性差' },
  { id: 'family', name: '家有老小', weight: 9, eff: { loyalty: 0.4, cap: -0.2 }, desc: '稳定但不愿出差' },
  { id: 'drinker', name: '酒量好', weight: 9, eff: { rel: 0.3, ct: -4 }, desc: '酒桌上谈事，客情快，边界松' },
  { id: 'exrival', name: '前竞品', weight: 8, eff: { aw: 0.18, cov: 0.04 }, desc: '从对手过来，懂打法、上手快' },
  { id: 'badnav', name: '路痴', weight: 8, eff: { cap: -0.25 }, desc: '跑不远，半径小' },
  { id: 'procrast', name: '拖延症', weight: 8, eff: { fail: 0.05 }, desc: '交办的事经常拖到最后一刻' },
  { id: 'book', name: '客户资源', weight: 7, eff: { cov: 0.1, loyalty: -0.3 }, desc: '手里有客户，但随时能带走' },
  { id: 'niceguy', name: '老好人', weight: 9, eff: { rel: 0.2, cov: -0.04, ct: 4 }, desc: '谁都不得罪，也压不动量' },
  { id: 'paperwork', name: '报表控', weight: 8, eff: { fail: -0.04, aw: 0.08 }, desc: '材料做得漂亮，执行少出错' },
  { id: 'moody', name: '情绪化', weight: 8, eff: { cov: 0.05, loyalty: -0.25 }, desc: '状态好时很猛，状态差时掉链子' },
  { id: 'sidegig', name: '兼职', weight: 6, eff: { cov: -0.08, loyalty: -0.45 }, desc: '心思不在本职上' },
  { id: 'chronic', name: '慢性病', weight: 6, eff: { cap: -0.3, loyalty: 0.25 }, desc: '跑不动，但求稳' },
];

/* =========================================================
   玩家：成长路线 + 个人标签
   ========================================================= */
const PATHS = [
  { id: 'sales', name: '营销线', en: 'SALES', desc: '带团队、抢份额、拼准入。从县域一路做到全国营销总监。', ready: true },
  { id: 'academic', name: '学术线', en: 'MEDICAL', desc: '从医学事务做起，用证据和共识影响处方。', ready: false },
  { id: 'market', name: '市场线', en: 'MARKETING', desc: '产品策略、市场准入、品牌建设。', ready: false },
];

const PLAYER_TAGS = [
  { id: 'iron', name: '铁腕', desc: '全员覆盖 +5%，团队忠诚每月 -0.15', eff: { cov: 0.05, loyalty: -0.15 } },
  { id: 'mentor', name: '师长', desc: '代表能力成长 +45%', eff: { growth: 0.45 } },
  { id: 'data', name: '数据狂', desc: '所有项目失败率 -5pt', eff: { fail: -0.05 } },
  { id: 'network', name: '关系通', desc: '准入开发效果 +12%', eff: { dev: 0.12 } },
  { id: 'clean', name: '合规派', desc: '合规评分每月 +0.5，风险积累 -10%', eff: { compliance: 0.5, exposure: -0.1 } },
  { id: 'frugal', name: '成本控', desc: '所有项目成本 -10%', eff: { cost: -0.1 } },
  { id: 'workaholic', name: '工作狂', desc: '每周精力 +1', eff: { ap: 1 } },
  { id: 'charisma', name: '人格魅力', desc: '上级评价获取 +30%', eff: { eval: 0.3 } },
  { id: 'parachute', name: '空降兵', desc: '自带外部关系（客户 +15、商业 +10），但内部关系 -10', eff: { relExt: 12, relInt: -10 } },
];

/* =========================================================
   角色 / 打法 / 项目
   ========================================================= */
const NAMES_SURNAME = '王李张刘陈杨黄赵周吴徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾萧田董袁潘蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦方白邹孟熊秦邱江尹薛段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤'.split('');
const NAMES_GIVEN = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '霞', '平', '刚', '建国', '志强', '晓东', '海燕', '雪梅', '立新', '文博', '雨欣', '浩然', '子涵', '佳怡', '振宇', '思远', '雅雯', '鹏飞', '慧敏', '国栋', '玉兰', '长春', '建平', '小军', '亚楠', '婷婷', '鑫', '楠', '琳', '晨', '阳', '悦', '斌', '翔', '秋萍', '红梅', '俊杰', '建军', '卫东'];

const ROLES = {
  '代表': { salary: 1.2, cov: 1.55, label: '医药代表', en: 'Sales Rep' },
  '高级代表': { salary: 1.7, cov: 1.75, label: '高级代表', en: 'Senior Rep' },
  '学术专员': { salary: 1.5, cov: 0.85, label: '学术专员', en: 'MSL' },
  '渠道经理': { salary: 1.6, cov: 1.00, label: '渠道经理', en: 'Channel Manager' },
};

const TACTICS = [
  { id: 'standard', name: '规范拜访', en: 'Standard Visit', cov: 1.00, mul: 1.00, exposure: 0, loyalty: 0.5, aw: 1.0, rel: 1.0, desc: '按合规手册拜访，节奏稳，天花板低。' },
  { id: 'push', name: '冲刺压货', en: 'Push Volume', cov: 1.22, mul: 1.06, exposure: 4, loyalty: -1.6, aw: 0.9, rel: 0.8, desc: '加大拜访频次与进货压力，短期上量，代表会累。' },
  { id: 'data', name: '统方渗透', en: 'Rx Data', cov: 1.06, mul: 1.16, exposure: 9, loyalty: -0.5, aw: 2.6, rel: 1.2, desc: '拿处方数据精准打击。数据来源本身不合规。' },
  { id: 'rebate', name: '带金销售', en: 'Rebate', cov: 1.55, mul: 1.32, exposure: 15, loyalty: -0.8, aw: 1.2, rel: 1.9, desc: '短期最猛，风险敞口最大的玩法。一旦被查，全线崩。' },
];

/* 项目：effect 为“基准效果”，实际按终端类型与终端画像缩放（见 engine.effOf） */
const PROJECTS = [
  { id: 'dept', name: '科室会', en: 'Dept. Meeting', cost: 1.2, ap: 1, multi: 3, fail: 0.16, delay: 0,
    base: { aw: 12, rel: 4 }, desc: '在选定终端各开一场科室会：认知、客情按终端类型浮动。',
    help: '性价比最高的学术动作。同一终端连续开会，边际效应递减。' },
  { id: 'case', name: '病例征集', en: 'Case Collection', cost: 4.5, ap: 1, multi: 2, fail: 0.22, delay: 2,
    base: { aw: 14, rel: 8 }, desc: '真实世界病例收集，2 个月后结算；在医院效果远好于零售。',
    help: '合规且能沉淀证据，是进院和医保谈判的硬材料。周期长，别指望当月见效。' },
  { id: 'dev', name: '医院开发', en: 'Access Development', cost: 3.5, ap: 1, multi: 2, fail: 0.28, delay: 1,
    base: { access: 20 }, desc: '提交药事会申请，1 个月后出结果；难度与医院等级挂钩。',
    help: '准入低于 25 的终端几乎不出量，开发是唯一的破局动作。' },
  { id: 'channel', name: '渠道建设', en: 'Channel Build', cost: 3.0, ap: 1, multi: 2, fail: 0.15, delay: 1,
    base: { access: 8, rel: 5 }, desc: '谈配送、铺货、店员培训，1 个月后生效；只对基层与零售有效。',
    help: '基层和零售靠覆盖吃饭，渠道不通，学术再强也没用。' },
  { id: 'relation', name: '客情维护', en: 'Key Account Care', cost: 2.0, ap: 1, multi: 3, fail: 0.10, delay: 0,
    base: { rel: 13 }, desc: '客情 +13 起，关系型终端更高；风险敞口 +2。',
    help: '客情是准入和处方的润滑剂，但边界要自己把握。' },
  { id: 'city', name: '区域学术会', en: 'Regional Symposium', cost: 9.0, ap: 1, multi: 0, fail: 0.20, delay: 0,
    base: { aw: 6 }, desc: '全区域认知度 +6，上级评价 +2。',
    help: '一次覆盖所有终端，终端越多越划算。' },
  { id: 'hire', name: '招聘', en: 'Recruit', cost: 0.8, ap: 1, multi: -1, fail: 0, delay: 0,
    desc: '获取 2 名候选人，可择优录用。', help: '人是唯一能复制的能力。' },
  { id: 'train', name: '团队培训', en: 'Team Training', cost: 2.6, ap: 1, multi: -1, fail: 0, delay: 0,
    desc: '全员能力 +4，忠诚 +3，合规倾向 +2。', help: '长期收益最高，短期看不见数字。' },
  { id: 'compliance', name: '合规培训', en: 'Compliance Training', cost: 1.8, ap: 1, multi: -1, fail: 0, delay: 0,
    desc: '合规分 +6，全员风险敞口 -14。', help: '风险堆高之后的唯一解药。' },
];

/* 周会要求 */
const WEEKLY_ORDERS = [
  { id: 'push', name: '冲量', desc: '本周全员加拜访密度：覆盖 +12%，风险 +2', tone: 'risk' },
  { id: 'academic', name: '抓学术', desc: '本周主抓科室会与病例：认知 +3', tone: '' },
  { id: 'relation', name: '做客情', desc: '本周重点维护关键客户：客情 +3', tone: '' },
  { id: 'compliance', name: '抓合规', desc: '本周只做规范动作：风险 -10，覆盖 -5%', tone: 'safe' },
];

const PUNISH = [
  { min: 0, text: '约谈提醒', cash: 0, comp: -3, rep: -2 },
  { min: 30, text: '通报批评', cash: 8, comp: -10, rep: -6 },
  { min: 55, text: '品种停采', cash: 18, comp: -16, rep: -12 },
  { min: 75, text: '移交司法', cash: 40, comp: -26, rep: -22 },
];

/* =========================================================
   市场事件
   ========================================================= */
const EVENTS = [
  {
    id: 'pht', title: '药事会窗口', en: 'P&T Committee Window', weight: 12,
    cond: s => s.terminals.some(t => t.access < 70),
    text: '一家重点终端下月召开药事会，本轮议题包含目录调整。药剂科暗示"材料要齐、要经得起问"。',
    options: [
      { label: '全力备料，提交完整循证材料', cost: 3, ap: 0,
        run: s => { const t = pick(s.terminals.filter(x => x.access < 70)); if (!t) return { text: '窗口已过。', tone: 'flat' };
          t.access = Math.min(100, t.access + 18); t.awareness = Math.min(100, t.awareness + 6); t.idle = 0;
          return { text: `${t.name} 准入 +18，进入目录。`, tone: 'good' }; } },
      { label: '先走关系，材料后补', cost: 1.5, ap: 0,
        run: s => { const t = pick(s.terminals.filter(x => x.access < 70)); if (!t) return { text: '无人可走。', tone: 'flat' };
          t.access = Math.min(100, t.access + 10); s.riskMod = Math.min(60, s.riskMod + 8);
          return { text: `${t.name} 准入 +10，风险 +8。`, tone: 'bad' }; } },
      { label: '放弃本轮', cost: 0, run: () => ({ text: '按兵不动。竞品抢走了两个议题名额。', tone: 'flat' }) },
    ],
  },
  {
    id: 'med-ins', title: '医保总额控费', en: 'Global Budget Cap', weight: 13,
    cond: s => s.terminals.some(t => t.type === 'hospital'),
    text: '医保局对辖区医院下达总额控费指标：药占比超标的医院要被扣减次月额度。你的一家重点医院正在名单上。',
    options: [
      { label: '配合控费，主动压量', cost: 0,
        run: s => { const t = pick(s.terminals.filter(x => x.type === 'hospital')); if (!t) return { text: '无医院。', tone: 'flat' };
          t.potential = +(t.potential * 0.9).toFixed(1); s.compliance = Math.min(100, s.compliance + 3);
          return { text: `${t.name} 品类容量 -10%（${t.potential.toFixed(1)} 万/月），合规 +3。`, tone: 'flat' }; } },
      { label: '提交临床必需性论证，争取豁免', cost: 4, ap: 1,
        run: s => { const t = pick(s.terminals.filter(x => x.type === 'hospital')); if (!t) return { text: '无医院。', tone: 'flat' };
          t.potential = +(t.potential * 1.05).toFixed(1); t.awareness = Math.min(100, t.awareness + 12);
          return { text: `${t.name} 论证通过，容量 +5% 且认知 +12，花了 4 万。`, tone: 'good' }; } },
      { label: '转到院外渠道消化', cost: 2,
        run: s => { const t = s.terminals.find(x => x.type === 'retail'); if (!t) return { text: '无零售终端。', tone: 'flat' };
          t.potential = +(t.potential * 1.12).toFixed(1); s.riskMod = Math.min(60, s.riskMod + 8);
          return { text: `${t.name} 容量 +12%，但处方外流被记了一笔。风险 +8。`, tone: 'bad' }; } },
    ],
  },
  {
    id: 'new-wing', title: '新院区开诊', en: 'New Campus', weight: 9,
    cond: s => s.terminals.some(t => t.type === 'hospital'),
    text: '一家医院的新院区下月开诊，编制床位翻倍。药剂科重新梳理供应商，老关系不一定带得过去。',
    options: [
      { label: '抢在开诊前重新做准入', cost: 6, ap: 1,
        run: s => { const t = pick(s.terminals.filter(x => x.type === 'hospital')); if (!t) return { text: '无医院。', tone: 'flat' };
          t.potential = +(t.potential * 1.28).toFixed(1); t.access = Math.max(45, t.access * 0.85); t.idle = 0;
          return { text: `${t.name} 容量 +28%（${t.potential.toFixed(1)} 万/月），准入重谈到 ${t.access.toFixed(0)}。`, tone: 'good' }; } },
      { label: '沿用老关系，先不动', cost: 0,
        run: s => { const t = pick(s.terminals.filter(x => x.type === 'hospital')); if (!t) return { text: '无医院。', tone: 'flat' };
          t.potential = +(t.potential * 1.2).toFixed(1); t.access = Math.max(0, t.access * 0.6);
          return { text: `${t.name} 容量 +20%，但准入被重置到 ${t.access.toFixed(0)}，得重新做工作。`, tone: 'flat' }; } },
    ],
  },
  {
    id: 'expert', title: '学科带头人引进', en: 'Key Opinion Leader', weight: 10,
    cond: s => s.terminals.some(t => t.type === 'hospital'),
    text: '一家医院从外省引进了一位学科带头人，据说门诊量很大，对用药方案有很强的话语权。',
    options: [
      { label: '第一时间做学术拜访', cost: 2, ap: 1,
        run: s => { const t = pick(s.terminals.filter(x => x.type === 'hospital')); if (!t) return { text: '无医院。', tone: 'flat' };
          t.awareness = Math.min(100, t.awareness + 16); t.relation = Math.min(100, t.relation + 10);
          return { text: `${t.name} 认知 +16，客情 +10。`, tone: 'good' }; } },
      { label: '等代表日常跟进', cost: 0,
        run: s => { const t = pick(s.terminals.filter(x => x.type === 'hospital')); if (!t) return { text: '无医院。', tone: 'flat' };
          t.awareness = Math.min(100, t.awareness + 4);
          return { text: `${t.name} 认知 +4。慢了一步，竞品已经先到了。`, tone: 'flat' }; } },
    ],
  },
  {
    id: 'pht-delay', title: '药事会延期', en: 'P&T Postponed', weight: 8,
    cond: s => s.pending.length > 0,
    text: '医院通知：本轮药事会因故延期，已受理的材料顺延到下一次会议。',
    options: [
      { label: '接受延期', cost: 0,
        run: s => { s.pending.forEach(p => { p.at += 1; });
          return { text: '在途项目全部顺延 1 个月。', tone: 'bad' }; } },
      { label: '找关系争取提前上会', cost: 3, ap: 1,
        run: s => { s.riskMod = Math.min(60, s.riskMod + 6);
          return { text: '材料被插进了临时议题。风险 +6。', tone: 'flat' }; } },
    ],
  },
  {
    id: 'pharm-crack', title: '院边药店整顿', en: 'Pharmacy Cleanup', weight: 8,
    cond: s => s.terminals.some(t => t.pharm > 0),
    text: '卫健委整顿院边药店：不得直接承接院内处方，不得悬挂医院标识。你承接的几家院边店被点名。',
    options: [
      { label: '撤出院边店，交回连锁', cost: 0,
        run: s => { let n = 0;
          s.team.forEach(r => { Object.keys(r.assign).forEach(tid => {
            if (r.assign[tid].pharm) { r.assign[tid].pharm = false; n++; }
          }); });
          return { text: `${n} 个院边药店承接关系被解除，连锁代表维护压力回升。`, tone: 'bad' }; } },
      { label: '改成"健康咨询点"继续做', cost: 2,
        run: s => { s.riskMod = Math.min(60, s.riskMod + 10); s.compliance = Math.max(0, s.compliance - 5);
          return { text: '换了个招牌继续。风险 +10，合规 -5。', tone: 'bad' }; } },
    ],
  },
  {
    id: 'ally-lead', title: '医共体牵头遴选', en: 'Alliance Leadership', weight: 7,
    cond: s => (ALLIANCES[s.level] || []).length > 0,
    text: '县域医共体重新遴选牵头单位。牵头医院可以统一目录，成员单位的用药结构会跟着变。',
    options: [
      { label: '全力支持现有牵头医院', cost: 3, ap: 1,
        run: s => { const al = pick(ALLIANCES[s.level]); if (!al) return { text: '无医共体。', tone: 'flat' };
          al.members.forEach(mid => { const t = termById(mid); if (t) { t.access = Math.min(100, t.access + 5); } });
          s.reputation = Math.min(100, s.reputation + 2);
          return { text: `${al.name} 成员准入各 +5，上级评价 +2。`, tone: 'good' }; } },
      { label: '押注另一家医院', cost: 3, ap: 1,
        run: s => { const al = pick(ALLIANCES[s.level]); if (!al) return { text: '无医共体。', tone: 'flat' };
          const t = pick(s.terminals.filter(x => x.type === 'hospital' && !al.members.includes(x.id)));
          if (t) { t.access = Math.min(100, t.access + 20); t.potential = +(t.potential * 1.1).toFixed(1); }
          s.riskMod = Math.min(60, s.riskMod + 6);
          return { text: t ? `${t.name} 准入 +20，容量 +10%。赌对了就是翻盘。` : '没人可押。', tone: 'flat' }; } },
    ],
  },
  {
    id: 'letter', title: '匿名举报信', en: 'Anonymous Letter', weight: 10,
    cond: s => teamRisk() > 35,
    text: '公司纪检邮箱收到一封匿名信，指向你辖区"存在不当利益输送"。信里点了两个终端名字，没点名到人。',
    options: [
      { label: '主动自查，移送线索', cost: 0, ap: 1,
        run: s => { s.riskMod = Math.max(-20, s.riskMod - 25); s.compliance = Math.min(100, s.compliance + 4); s.reputation = Math.max(0, s.reputation - 3);
          return { text: '自查报告上交，风险 -25，合规 +4，上级评价 -3。', tone: 'flat' }; } },
      { label: '压下去，内部消化', cost: 1.5,
        run: s => { s.riskMod = Math.min(60, s.riskMod + 10); s.compliance = Math.max(0, s.compliance - 8);
          return { text: '信被"处理"掉了。合规 -8，风险 +10。', tone: 'bad' }; } },
    ],
  },
  {
    id: 'inspect', title: '医保飞检', en: 'NHSA Inspection', weight: 9,
    cond: s => s.totalMonth > 3,
    text: '省医保局飞行检查组进驻，重点查"不合理用药"和"处方外流"。抽到你辖区两家终端。',
    options: [
      { label: '配合检查，全员合规口径', cost: 0.5, ap: 1,
        run: s => { if (teamRisk() < 45) { s.reputation = Math.min(100, s.reputation + 4); s.compliance = Math.min(100, s.compliance + 3); s.riskMod = Math.max(-20, s.riskMod - 10);
            return { text: '检查通过，无违规记录。上级评价 +4。', tone: 'good' }; }
          s.compliance = Math.max(0, s.compliance - 12); s.cash -= 12;
          return { text: '查出两笔无适应症处方，罚款 12 万，合规 -12。', tone: 'bad' }; } },
      { label: '临时清账，统一口径', cost: 2,
        run: s => { s.riskMod = Math.max(-20, s.riskMod - 12); s.compliance = Math.max(0, s.compliance - 5);
          return { text: '账平了，但检查组记下了"配合度异常"。合规 -5。', tone: 'bad' }; } },
    ],
  },
  {
    id: 'compmeet', title: '竞品开城市会', en: 'Rival Symposium', weight: 12,
    cond: () => true,
    text: () => `${pickOne(RIVALS)}办了一场 300 人的学术会，主推同类品种，请了两位省级主委站台。你的客户被请去了一半。`,
    options: [
      { label: '跟进办一场，规格不低于对手', cost: 8, ap: 1,
        run: s => { s.terminals.forEach(t => t.awareness = Math.min(100, t.awareness + 4));
          s.terminals.forEach(t => t.comp = Math.min(0.85, t.comp + 0.02));
          return { text: '全区域认知 +4，竞品压力 +0.02。', tone: 'flat' }; } },
      { label: '不打对台，做小范围深度沟通', cost: 2, ap: 1,
        run: s => { s.terminals.forEach(t => t.relation = Math.min(100, t.relation + 4));
          return { text: '全区域客情 +4。', tone: 'good' }; } },
      { label: '不管，按原节奏走', cost: 0,
        run: s => { s.terminals.forEach(t => t.awareness = Math.max(0, t.awareness - 5));
          return { text: '全区域认知 -5。客户在会上被对手洗了一遍。', tone: 'bad' }; } },
    ],
  },
  {
    id: 'director', title: '院长换届', en: 'Leadership Change', weight: 8,
    cond: s => s.totalMonth > 3,
    text: '一家重点终端的院长调任，新院长是从外院空降的，据说对供应商"零基础、重新筛"。',
    options: [
      { label: '第一时间登门汇报', cost: 1, ap: 1,
        run: s => { const t = pick(s.terminals); if (!t) return { text: '无终端。', tone: 'flat' };
          t.relation = Math.max(10, Math.round(t.relation * 0.6) + 15);
          return { text: `${t.name} 客情重置为 ${t.relation.toFixed(1)}。`, tone: 'flat' }; } },
      { label: '先观察，让代表跟进', cost: 0,
        run: s => { const t = pick(s.terminals); if (!t) return { text: '无终端。', tone: 'flat' };
          t.relation = Math.round(t.relation * 0.35); t.access = Math.max(0, t.access - 8);
          return { text: `${t.name} 客情跌至 ${t.relation.toFixed(1)}，准入 -8。`, tone: 'bad' }; } },
    ],
  },
  {
    id: 'poach', title: '对手挖人', en: 'Talent Poaching', weight: 10,
    cond: s => s.team.length >= 2,
    text: '竞品的 HR 在你辖区活动，开出了 30% 的涨幅。你最好的代表昨天接到了一通电话。',
    options: [
      { label: '加薪挽留（月薪 +25%）', cost: 0,
        run: s => { const r = s.team.slice().sort((a, b) => b.ability - a.ability)[0];
          if (!r) return { text: '无人在岗。', tone: 'flat' };
          r.salary = +(r.salary * 1.25).toFixed(2); r.loyalty = Math.min(100, r.loyalty + 18);
          return { text: `${r.name} 留任，月薪上调至 ${r.salary.toFixed(1)} 万。`, tone: 'good' }; } },
      { label: '放走，招新人重练', cost: 0,
        run: s => { const r = s.team.slice().sort((a, b) => b.ability - a.ability)[0];
          if (!r) return { text: '无人在岗。', tone: 'flat' };
          s.team = s.team.filter(x => x.id !== r.id);
          return { text: `${r.name} 离职，带队经验流失。`, tone: 'bad' }; } },
    ],
  },
  {
    id: 'payment', title: '账期拉长', en: 'Payment Terms', weight: 9,
    cond: s => s.totalMonth > 3,
    text: '商业公司通知：受医院回款影响，本月起账期由 60 天延至 90 天。你的费用池要垫一层。',
    options: [
      { label: '接受，压缩本季活动', cost: 6, run: () => ({ text: '垫付 6 万，本季度学术活动预算被挤占。', tone: 'bad' }) },
      { label: '换一家商业公司谈', cost: 2, ap: 1,
        run: s => { s.reputation = Math.min(100, s.reputation + 2); return { text: '花 2 万切换配送商，账期维持 60 天。上级评价 +2。', tone: 'good' }; } },
    ],
  },
  {
    id: 'media', title: '媒体暗访', en: 'Undercover Reporter', weight: 7,
    cond: s => s.totalMonth > 4,
    text: '有记者以"患者家属"身份在门诊区待了三天，打听代表和医生的往来。',
    options: [
      { label: '全员暂停线下拜访一周', cost: 3,
        run: s => { s.riskMod = Math.max(-20, s.riskMod - 18); s.terminals.forEach(t => t.awareness = Math.max(0, t.awareness - 3));
          return { text: '风险 -18，全区域认知 -3。躲过一劫。', tone: 'good' }; } },
      { label: '照常跑，身正不怕影子斜', cost: 0,
        run: s => { if (teamRisk() < 40) { s.reputation = Math.min(100, s.reputation + 3); return { text: '记者跟了三天没抓到东西。上级评价 +3。', tone: 'good' }; }
          s.compliance = Math.max(0, s.compliance - 10); s.cash -= 8;
          return { text: '报道发出，公关费用 8 万，合规 -10。', tone: 'bad' }; } },
    ],
  },
  {
    id: 'tender', title: '集采续标', en: 'VBP Renewal', weight: 8,
    cond: s => s.totalMonth > 5,
    text: '价格敏感型品种进入续标。规则是"最低价中标"，报价空间被压到极限。',
    options: [
      { label: '跟价中标，保份额弃利润', cost: 0,
        run: s => { s.terminals.forEach(t => t.comp = Math.min(0.85, t.comp + 0.04));
          return { text: '中标。份额守住，但竞品压力 +0.04。', tone: 'flat' }; } },
      { label: '不跟，放弃院内市场', cost: 0,
        run: s => { s.terminals.forEach(t => t.awareness = Math.max(0, t.awareness - 6));
          return { text: '弃标。认知 -6。', tone: 'bad' }; } },
    ],
  },
  {
    id: 'annual', title: '全国年会名额', en: 'National Congress', weight: 8,
    cond: s => s.reputation > 55,
    text: '总部给了省区两个全国学术年会名额，可以带客户去，也可以派自己的人去。',
    options: [
      { label: '带 4 位核心专家去', cost: 4, ap: 1,
        run: s => { const t = pick(s.terminals); if (t) { t.relation = Math.min(100, t.relation + 12); t.awareness = Math.min(100, t.awareness + 8); }
          s.reputation = Math.min(100, s.reputation + 3);
          return { text: '客情 +12、认知 +8，上级评价 +3。', tone: 'good' }; } },
      { label: '派学术专员去学习', cost: 2,
        run: s => { const r = s.team.find(x => x.role === '学术专员') || s.team[0];
          if (r) { r.ability = Math.min(100, r.ability + 6); r.loyalty = Math.min(100, r.loyalty + 8); }
          return { text: '学术能力 +6，忠诚 +8。', tone: 'good' }; } },
    ],
  },
  {
    id: 'kickback', title: '代表的"私活"', en: 'Side Deal', weight: 8,
    cond: s => teamRisk() > 30 && s.team.length > 2,
    text: '你发现一名代表在私下代理竞品的品种，用你的客户资源走货。被问到时他说"大家都这么干"。',
    options: [
      { label: '立即停职，走公司流程', cost: 0, ap: 1,
        run: s => { const r = pick(s.team.filter(x => x.exposure > 20)) || pick(s.team);
          if (r) s.team = s.team.filter(x => x.id !== r.id);
          s.riskMod = Math.max(-20, s.riskMod - 12); s.compliance = Math.min(100, s.compliance + 3); s.reputation = Math.min(100, s.reputation + 3);
          return { text: '人员清退，风险 -12，风气立住了。', tone: 'good' }; } },
      { label: '私下警告，保留人力', cost: 0,
        run: s => { s.riskMod = Math.min(60, s.riskMod + 12); s.compliance = Math.max(0, s.compliance - 6);
          return { text: '人留下了，风险 +12，合规 -6。', tone: 'bad' }; } },
    ],
  },
  {
    id: 'candidate', title: '主动投简历', en: 'Inbound Resume', weight: 9,
    cond: s => s.team.length < CFG.teamCap[s.level],
    text: '一位在三甲做了五年、手里有客户资源的代表主动投了简历，期望薪资高于编制标准。',
    options: [
      { label: '破格录用', cost: 2,
        run: s => { if (s.team.length >= CFG.teamCap[s.level]) return { text: '编制已满。', tone: 'flat' };
          const r = makeRep(s, { abilityBoost: 12, salaryBoost: 1.3, traitId: 'oldfox' });
          s.team.push(r); return { text: `${r.name} 入职（能力 ${r.ability.toFixed(1)}）。`, tone: 'good' }; } },
      { label: '按标准薪资谈', cost: 0,
        run: s => { if (Math.random() < 0.45 && s.team.length < CFG.teamCap[s.level]) {
            const r = makeRep(s); s.team.push(r); return { text: `${r.name} 接受标准 offer。`, tone: 'good' }; }
          return { text: '对方拒了，去了竞品。', tone: 'flat' }; } },
    ],
  },
  {
    id: 'rectify', title: '卫健委整顿', en: 'Health Commission', weight: 7,
    cond: s => s.totalMonth > 3,
    text: '卫健委下发通知，要求所有代表备案、不得在门诊区活动。',
    options: [
      { label: '全员备案，转学术路径', cost: 1.5, ap: 1,
        run: s => { s.compliance = Math.min(100, s.compliance + 6); s.riskMod = Math.max(-20, s.riskMod - 10);
          s.terminals.forEach(t => t.awareness = Math.max(0, t.awareness - 2));
          return { text: '合规 +6，认知 -2（拜访受限）。', tone: 'good' }; } },
      { label: '换个名目继续跑', cost: 0,
        run: s => { s.riskMod = Math.min(60, s.riskMod + 14); s.compliance = Math.max(0, s.compliance - 8);
          return { text: '换汤不换药。风险 +14，合规 -8。', tone: 'bad' }; } },
    ],
  },
  {
    id: 'pricecut', title: '竞品降价', en: 'Price War', weight: 10,
    cond: () => true,
    text: () => `${pickOne(RIVALS)}把同类品种的院内价下调 18%，同时给商业公司加了 5 个点的返利。`,
    options: [
      { label: '申请专项政策跟价', cost: 3, ap: 1,
        run: s => { s.terminals.forEach(t => t.comp = Math.min(0.85, t.comp + 0.03));
          s.reputation = Math.min(100, s.reputation + 2);
          return { text: '拿到专项折扣。竞品压力 +0.03，上级评价 +2。', tone: 'flat' }; } },
      { label: '不跟价，打差异化', cost: 0,
        run: s => { s.terminals.forEach(t => t.comp = Math.min(0.9, t.comp + 0.06));
          return { text: '竞品压力 +0.06。', tone: 'bad' }; } },
    ],
  },
  {
    id: 'star', title: '冒尖的新人', en: 'Rising Star', weight: 9,
    cond: s => s.team.length >= 3,
    text: '一个入职不到一年的代表，把一家原本放弃的终端做进了前三。',
    options: [
      { label: '提拔为组长，让他带人', cost: 1, ap: 1,
        run: s => { const r = s.team.slice().sort((a, b) => (b.ability + b.loyalty) - (a.ability + a.loyalty))[0];
          if (!r) return { text: '无人可提。', tone: 'flat' };
          r.role = '高级代表'; r.ability = Math.min(100, r.ability + 8); r.loyalty = Math.min(100, r.loyalty + 12); r.salary = +(r.salary * 1.2).toFixed(2);
          s.team.forEach(x => x.loyalty = Math.min(100, x.loyalty + 2));
          return { text: `${r.name} 升任高级代表，全员忠诚 +2。`, tone: 'good' }; } },
      { label: '先给奖金，稳住再说', cost: 2,
        run: s => { const r = s.team.slice().sort((a, b) => (b.ability + b.loyalty) - (a.ability + a.loyalty))[0];
          if (r) r.loyalty = Math.min(100, r.loyalty + 6);
          return { text: '发了 2 万奖金，忠诚 +6。', tone: 'flat' }; } },
    ],
  },
  {
    id: 'audit', title: '集团合规审计', en: 'Corporate Audit', weight: 8,
    cond: s => s.totalMonth > 4,
    text: '集团法务与合规部年度审计，抽到你辖区。要求提供近 12 个月的学术活动台账、讲者协议和费用凭证。',
    options: [
      { label: '开诚布公，补齐台账', cost: 2, ap: 1,
        run: s => { if (s.compliance > 70) { s.reputation = Math.min(100, s.reputation + 5); s.compliance = Math.min(100, s.compliance + 4);
            return { text: '审计无重大发现，合规 +4，上级评价 +5。', tone: 'good' }; }
          s.compliance = Math.max(0, s.compliance - 15); s.cash -= 10;
          return { text: '查出 3 场活动无签到表，罚款 10 万，合规 -15。', tone: 'bad' }; } },
      { label: '让代表自己想办法补', cost: 0,
        run: s => { s.riskMod = Math.min(60, s.riskMod + 15); s.compliance = Math.max(0, s.compliance - 10);
          return { text: '台账补上了，但笔迹太像。风险 +15，合规 -10。', tone: 'bad' }; } },
    ],
  },
];

/* =========================================================
   管理事件（来自公司 / 上级）
   ========================================================= */
const MGMT_EVENTS = [
  {
    id: 'm-grid', title: '网格化管理', en: 'Territory Grid', weight: 14, mgmt: true,
    text: '总部下发《代表网格化管理细则》：每名代表负责的医院不超过 2 家，超出部分必须重新划分。省区要求本月内落地。',
    options: [
      { label: '严格执行', desc: '按细则重划：每人最多 2 家，超出部分转给他人或空缺',
        run: s => { const cut = trimAssignments(2);
          s.reputation = Math.min(100, s.reputation + 6); s.compliance = Math.min(100, s.compliance + 2);
          if (!cut) return { text: '核查后所有代表都在 2 家以内，无需调整。上级评价 +6，合规 +2。', tone: 'good' };
          return { text: `重划完成，${cut} 个终端转为无人负责，短期销量会掉。上级评价 +6，合规 +2。`, tone: 'flat' }; } },
      { label: '选择执行', desc: '只处理超过 3 家的代表，其余不动',
        run: s => { const cut = trimAssignments(3);
          s.reputation = Math.min(100, s.reputation + 1); s.riskMod = Math.min(60, s.riskMod + 4);
          return { text: cut ? `部分调整，${cut} 个终端被释放。上级评价 +1，风险 +4。` : '本来就都没超 3 家，等于没动。上级评价 +1，风险 +4。', tone: 'flat' }; } },
      { label: '不执行', desc: '维持现状，报一份"已按要求调整"的说明',
        run: s => { s.reputation = Math.max(0, s.reputation - 6); s.riskMod = Math.min(60, s.riskMod + 8);
          s.flags.auditAt = s.totalMonth + 3; s.flags.auditWhy = '网格化管理落实';
          return { text: '说明交上去了。上级评价 -6，风险 +8。三个月内会有一次专项核查。', tone: 'bad' }; } },
    ],
  },
  {
    id: 'm-cost', title: '费用压缩', en: 'Budget Cut', weight: 13, mgmt: true,
    text: 'CFO 在经营分析会上点名：辖区销售费用率高出大盘 4 个点。要求本月起压缩 15%，且不得影响学术活动场次。',
    options: [
      { label: '严格执行', desc: '按 15% 扣减，学术场次不动，砍客情与差旅',
        run: s => { const c = totalSales() * CFG.grossRate * 0.15;
          s.cash -= c; s.compliance = Math.min(100, s.compliance + 3); s.reputation = Math.min(100, s.reputation + 5);
          s.flags.lean = 8;
          return { text: `预算扣减 ${c.toFixed(1)} 万。上级评价 +5，未来 2 个月客情类项目成本 -20%。`, tone: 'good' }; } },
      { label: '选择执行', desc: '扣 8%，剩余从下季度额度里腾',
        run: s => { const c = totalSales() * CFG.grossRate * 0.08;
          s.cash -= c; s.reputation = Math.min(100, s.reputation + 1);
          return { text: `预算扣减 ${c.toFixed(1)} 万。上级评价 +1。`, tone: 'flat' }; } },
      { label: '不执行', desc: '把费用挪到"市场调研"科目，账面上看不出来',
        run: s => { s.reputation = Math.max(0, s.reputation - 7); s.riskMod = Math.min(60, s.riskMod + 10); s.compliance = Math.max(0, s.compliance - 4);
          return { text: '费用保住了。上级评价 -7，合规 -4，风险 +10。财务迟早会对上账。', tone: 'bad' }; } },
    ],
  },
  {
    id: 'm-filing', title: '学术活动备案', en: 'Activity Filing', weight: 12, mgmt: true,
    text: '合规部要求：所有科室会、病例会必须提前 5 个工作日在系统备案，附会议议程与讲者资质。未备案的费用不予报销。',
    options: [
      { label: '严格执行', desc: '全部备案，科室会成本 +20%',
        run: s => { s.flags.filing = 16; s.compliance = Math.min(100, s.compliance + 5); s.reputation = Math.min(100, s.reputation + 3);
          return { text: '全员培训备案流程。合规 +5，上级评价 +3。未来 4 个月科室会成本 +20%。', tone: 'good' }; } },
      { label: '选择执行', desc: '大场次备案，小科室会口头报备',
        run: s => { s.flags.filing = 8; s.compliance = Math.min(100, s.compliance + 1); s.riskMod = Math.min(60, s.riskMod + 4);
          return { text: '部分备案。合规 +1，风险 +4。', tone: 'flat' }; } },
      { label: '不执行', desc: '照常办，反正以前也没人查',
        run: s => { s.reputation = Math.max(0, s.reputation - 4); s.riskMod = Math.min(60, s.riskMod + 9);
          s.flags.auditAt = s.totalMonth + 2; s.flags.auditWhy = '学术活动备案';
          return { text: '活动照办。上级评价 -4，风险 +9。两个月内会被抽一次活动台账。', tone: 'bad' }; } },
    ],
  },
  {
    id: 'm-pledge', title: '合规承诺书', en: 'Compliance Pledge', weight: 11, mgmt: true,
    text: '集团要求全员签署《医药代表合规承诺书》，并现场考试。省区把签署率纳入本月考核。',
    options: [
      { label: '严格执行', desc: '全员签署 + 考试，占用 1 点精力',
        run: s => { s.compliance = Math.min(100, s.compliance + 7); s.team.forEach(r => { r.exposure = Math.max(0, r.exposure - 10); r.ct = Math.min(100, r.ct + 3); });
          s.reputation = Math.min(100, s.reputation + 4); s.ap = Math.max(0, s.ap - 1);
          return { text: '签署率 100%，考试全员通过。合规 +7，全员风险 -10，上级评价 +4。', tone: 'good' }; } },
      { label: '选择执行', desc: '只让核心代表签，其余代签',
        run: s => { s.compliance = Math.min(100, s.compliance + 2); s.riskMod = Math.min(60, s.riskMod + 3);
          return { text: '报的 100%。合规 +2，风险 +3。', tone: 'flat' }; } },
      { label: '不执行', desc: '拖着，等省区催',
        run: s => { s.reputation = Math.max(0, s.reputation - 5); s.compliance = Math.max(0, s.compliance - 5);
          return { text: '拖过了这个月。上级评价 -5，合规 -5。', tone: 'bad' }; } },
    ],
  },
  {
    id: 'm-report', title: '周报真实性抽查', en: 'Report Audit', weight: 10, mgmt: true,
    text: '省区抽查近三个月周报，要求提供拜访记录与客户签字。你的代表交上来的记录里，有几家医院的拜访时间对不上。',
    options: [
      { label: '严格执行', desc: '主动说明问题，重做记录并自罚',
        run: s => { s.reputation = Math.max(0, s.reputation - 3); s.compliance = Math.min(100, s.compliance + 6);
          s.team.forEach(r => r.ct = Math.min(100, r.ct + 2));
          return { text: '问题主动上报，重做记录。上级评价 -3，合规 +6。', tone: 'flat' }; } },
      { label: '选择执行', desc: '改掉最明显的几处，其余照旧',
        run: s => { s.riskMod = Math.min(60, s.riskMod + 6); s.compliance = Math.max(0, s.compliance - 3);
          return { text: '改了几处对不上的。风险 +6，合规 -3。', tone: 'bad' }; } },
      { label: '不执行', desc: '统一口径，让他们把签字补上',
        run: s => { s.riskMod = Math.min(60, s.riskMod + 12); s.compliance = Math.max(0, s.compliance - 7);
          s.flags.auditAt = s.totalMonth + 2; s.flags.auditWhy = '周报真实性';
          return { text: '签字补上了。风险 +12，合规 -7。两个月内会有一次飞行核查。', tone: 'bad' }; } },
    ],
  },
  {
    id: 'm-rotate', title: '代表轮岗', en: 'Rotation Order', weight: 9, mgmt: true,
    text: '公司要求核心终端代表两年必须轮岗，防止"客户变私产"。你手上最好的几个代表，都在轮岗名单里。',
    options: [
      { label: '严格执行', desc: '能力最强的两人轮岗，客情短期归零',
        run: s => { const tops = s.team.slice().sort((a, b) => b.ability - a.ability).slice(0, 2);
          tops.forEach(r => { Object.keys(r.assign).forEach(tid => {
            const t = termById(tid); if (t) t.relation = Math.max(0, t.relation - 22); }); });
          s.reputation = Math.min(100, s.reputation + 7); s.compliance = Math.min(100, s.compliance + 3);
          return { text: `${tops.map(r => r.name).join('、')} 完成轮岗。客情大幅回落，上级评价 +7。`, tone: 'flat' }; } },
      { label: '选择执行', desc: '只轮岗一人，其余报"客户结构特殊"',
        run: s => { const top = s.team.slice().sort((a, b) => b.ability - a.ability)[0];
          if (top) Object.keys(top.assign).forEach(tid => { const t = termById(tid); if (t) t.relation = Math.max(0, t.relation - 12); });
          s.reputation = Math.min(100, s.reputation + 2); s.riskMod = Math.min(60, s.riskMod + 4);
          return { text: '轮岗一人，其余打了报告。上级评价 +2，风险 +4。', tone: 'flat' }; } },
      { label: '不执行', desc: '一个都不动，理由写"在谈大项目"',
        run: s => { s.reputation = Math.max(0, s.reputation - 8); s.riskMod = Math.min(60, s.riskMod + 6);
          return { text: '一个没动。上级评价 -8，风险 +6。这几个人从此只有你能管。', tone: 'bad' }; } },
    ],
  },
];

const AUDIT_EVENT = {
  id: 'm-audit', title: '专项核查', en: 'Targeted Audit', weight: 100, mgmt: true,
  text: '总部专项核查组进驻，调取近半年的费用凭证、活动台账与拜访记录。',
  options: [
    { label: '全面配合', desc: '材料照实提供', cost: 2, ap: 1,
      run: s => { if (s.compliance >= 72) { s.compliance = Math.min(100, s.compliance + 3); s.reputation = Math.min(100, s.reputation + 3);
          return { text: '核查未发现重大问题。合规 +3，上级评价 +3。', tone: 'good' }; }
        s.compliance = Math.max(0, s.compliance - 14); s.cash -= 14; s.reputation = Math.max(0, s.reputation - 5);
        return { text: '查出费用与台账不符，罚款 14 万。合规 -14，上级评价 -5。', tone: 'bad' }; } },
    { label: '紧急补材料', desc: '通宵补台账', cost: 4, ap: 1,
      run: s => { s.riskMod = Math.min(60, s.riskMod + 8); s.cash -= 4;
        return { text: '材料补上了，但核查组记下了时间线异常。风险 +8，花费 4 万。', tone: 'bad' }; } },
  ],
};

/* =========================================================
   难度：药事会制度不同（参考现实：有的医院一年只开一两次）
   ========================================================= */
const DIFFICULTY = {
  easy: {
    id: 'easy', name: '简单', en: 'EASY',
    desc: '药事会季度例会，周期固定可预期；窗口期内开发成功率和收益都更高。',
    cycle: 12, jitter: 0, window: 3, inBonus: 0.18, outPenalty: -0.10, noPht: false,
  },
  normal: {
    id: 'normal', name: '中等', en: 'NORMAL',
    desc: '药事会不定期召开，只能从"窗口临近"的迹象判断；错过要等下轮。',
    cycle: 0, jitter: 0, window: 3, inBonus: 0.08, outPenalty: -0.06, noPht: false,
  },
  hard: {
    id: 'hard', name: '困难', en: 'HARD',
    desc: '这家医院常年不开药事会，正式开发走不通。只能靠客情、病例、渠道一点点磨进院。',
    cycle: 0, jitter: 0, window: 0, inBonus: 0, outPenalty: 0, noPht: true,
  },
};

/* =========================================================
   关系：公司内部部门 + 外部资源
   ========================================================= */
const REL_DEFS = {
  internal: [
    { id: 'compliance', name: '合规部', desc: '好感高 → 被抽查概率下降、合规培训效果更好' },
    { id: 'finance', name: '财务部', desc: '好感高 → 费用上限上浮、报销更顺' },
    { id: 'marketing', name: '市场部', desc: '好感高 → 区域学术会成本下降' },
    { id: 'medical', name: '医学部', desc: '好感高 → 学术活动认知增益更高' },
    { id: 'commercial', name: '商务部', desc: '好感高 → 渠道建设效果更好' },
    { id: 'hr', name: '人力部', desc: '好感高 → 候选人质量更好、新人上手更快' },
  ],
  external: [
    { id: 'hospital', name: '医院客户', desc: '好感高 → 客情与进院更快' },
    { id: 'distributor', name: '商业公司', desc: '好感高 → 回款更顺、配送覆盖更广' },
    { id: 'kol', name: '专家网络', desc: '好感高 → 病例与区域会效果更好' },
    { id: 'association', name: '行业协会', desc: '好感高 → 合规事件的冲击更小' },
  ],
};



/* =========================================================
   政策身份事件（医保 / 集采 / 基药）与支付改革
   ========================================================= */
EVENTS.push(
  {
    id: 'nrdl', title: '医保目录谈判', en: 'NRDL Negotiation', weight: 13,
    cond: s => PRODUCTS.some(p => !p.pol.includes('nrdl')),
    text: () => {
      const p = pickOne(PRODUCTS.filter(x => !x.pol.includes('nrdl')));
      return `${p.name}（${TA_NAME[p.ta]}）进入今年国家医保目录谈判名单。以价换量，降价幅度决定了能不能进。`;
    },
    options: [
      { label: '大幅降价，确保进目录', cost: 3, ap: 1,
        run: s => { const p = pick(PRODUCTS.filter(x => !x.pol.includes('nrdl'))); if (!p) return { text: '本轮没有可谈品种。', tone: 'flat' };
          p.pol.push('nrdl'); p.priceEdge -= 0.02; s.reputation = Math.min(100, s.reputation + 4);
          return { text: `${p.name} 进入医保目录，份额上限抬升，单价小幅下调。上级评价 +4。`, tone: 'good' }; } },
      { label: '守住价格，接受谈判失败', cost: 0,
        run: s => { const p = pick(PRODUCTS.filter(x => !x.pol.includes('nrdl')));
          if (p) p.priceEdge += 0.01;
          return { text: p ? `${p.name} 谈判未成，继续自费。价格守住了，但院内推广更难。` : '无品种可谈。', tone: 'flat' }; } },
    ],
  },
  {
    id: 'vbp', title: '集采投标', en: 'Volume-Based Procurement', weight: 12,
    cond: s => PRODUCTS.some(p => !p.pol.includes('vbp') && (p.id === 'gen' || p.id === 'base')),
    text: () => {
      const p = PRODUCTS.find(x => !x.pol.includes('vbp') && (x.id === 'gen' || x.id === 'base')) || PRODUCTS[0];
      return `${p.name} 所在品种组进入国家集采。规则是最低价中标，中标量价齐升，落标基本退出院内市场。`;
    },
    options: [
      { label: '压到底价，抢中标', cost: 2, ap: 1,
        run: s => { const p = PRODUCTS.find(x => !x.pol.includes('vbp') && (x.id === 'gen' || x.id === 'base'));
          if (!p) return { text: '没有可投标品种。', tone: 'flat' };
          if (Math.random() < 0.62) { p.pol.push('vbp'); p.priceEdge -= 0.04;
            return { text: `${p.name} 中标。份额上限提高，但单价被压。`, tone: 'good' }; }
          p.pol = p.pol.filter(x => x !== 'nrdl');
          return { text: `${p.name} 落标，院内市场基本失守。`, tone: 'bad' }; } },
      { label: '不投，保住价格体系', cost: 0,
        run: s => { const p = PRODUCTS.find(x => !x.pol.includes('vbp') && (x.id === 'gen' || x.id === 'base'));
          if (p) { p.priceEdge += 0.01; }
          s.reputation = Math.max(0, s.reputation - 2);
          return { text: '弃标。价格保住了，但上级对"放弃存量"有意见。评价 -2。', tone: 'flat' }; } },
    ],
  },
  {
    id: 'edl', title: '基药目录遴选', en: 'Essential Drug List', weight: 10,
    cond: s => PRODUCTS.some(p => !p.pol.includes('edl') && (p.id === 'base' || p.id === 'herb')),
    text: '新版基本药物目录开始遴选。进入目录意味着基层必须配备，但价格和利润空间都会被压。',
    options: [
      { label: '全力申报', cost: 2, ap: 1,
        run: s => { const p = PRODUCTS.find(x => !x.pol.includes('edl') && (x.id === 'base' || x.id === 'herb'));
          if (!p) return { text: '没有可申报品种。', tone: 'flat' };
          if (Math.random() < 0.55) { p.pol.push('edl');
            return { text: `${p.name} 进入基药目录，基层和连锁终端的配备率会明显提升。`, tone: 'good' }; }
          return { text: `${p.name} 未入选，本轮申报白做。`, tone: 'flat' }; } },
      { label: '不申报，保住院内外价差', cost: 0,
        run: s => { s.reputation = Math.min(100, s.reputation + 1);
          return { text: '放弃基药身份，保住价格体系。上级评价 +1（利润优先）。', tone: 'flat' }; } },
    ],
  },
  {
    id: 'drg', title: 'DRG 付费改革', en: 'DRG Payment Reform', weight: 12,
    cond: s => PRODUCTS.some(p => p.id === 'bio' || p.price >= 200),
    text: '医保局在辖区推行 DRG 按病种付费。高值品种一旦超出病组支付标准，医院要自己承担，科室开始压处方。',
    options: [
      { label: '申报特例单议，逐例争取', cost: 5, ap: 1,
        run: s => {
          const hi = PRODUCTS.filter(p => p.id === 'bio' || p.price >= 200);
          hi.forEach(p => { p.priceEdge += 0.0; });
          s.rel.external.association = Math.min(100, s.rel.external.association + 3);
          return { text: '特例单议通道打通，高值品种没有被一刀切压掉。花费 5 万，行业协会好感 +3。', tone: 'good' }; } },
      { label: '接受现实，转向门诊和院外', cost: 0,
        run: s => { s.terminals.forEach(t => { if (t.type === 'hospital') t.potential = +(t.potential * 0.94).toFixed(1); });
          const rt = s.terminals.find(t => t.type === 'retail');
          if (rt) rt.potential = +(rt.potential * 1.1).toFixed(1);
          return { text: '院内高值品类容量 -6%，连锁终端容量 +10%。处方在往院外走。', tone: 'flat' }; } },
    ],
  },
  {
    id: 'one-two', title: '一品两规', en: 'One Drug, Two Strengths', weight: 9,
    cond: s => s.terminals.some(t => t.type === 'hospital'),
    text: '一家医院严格执行"一品两规"：同一化学成分只保留两个品规。你的一个品种被列入清退名单。',
    options: [
      { label: '争取保留，做临床必需性论证', cost: 3, ap: 1,
        run: s => { const t = pick(s.terminals.filter(x => x.type === 'hospital'));
          if (!t) return { text: '无医院。', tone: 'flat' };
          t.access = Math.min(100, t.access + 4); t.awareness = Math.min(100, t.awareness + 8);
          return { text: `${t.name} 保留在目录内，认知 +8。`, tone: 'good' }; } },
      { label: '放弃该院，把资源挪走', cost: 0,
        run: s => { const t = pick(s.terminals.filter(x => x.type === 'hospital'));
          if (t) t.access = Math.max(0, t.access - 18);
          return { text: t ? `${t.name} 被清退，准入 -18。` : '无医院。', tone: 'bad' }; } },
    ],
  },
);
