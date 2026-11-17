/* 渲染冒烟测试：用桩对象跑一遍所有视图，抓模板里的 ReferenceError / undefined */
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '..');

const store = {};
function el(id) {
  return {
    id, _html: '',
    set innerHTML(v) { this._html = v; store[id] = v; },
    get innerHTML() { return this._html; },
    appendChild() {}, remove() {}, style: {}, value: '测试',
    addEventListener() {},
  };
}
const ctx = {
  console, Math, Date, JSON, Object, Set, Array, String, Number, Boolean, isNaN, parseInt, parseFloat,
  document: {
    getElementById: id => (store['_' + id] = store['_' + id] || el(id)),
    addEventListener() {},
    createElement: () => el('tmp'),
    querySelector: () => null,
  },
  window: { scrollY: 0, scrollTo() {}, addEventListener() {} },
  location: { search: '' },
  URLSearchParams: class { get() { return null; } },
};
ctx.globalThis = ctx;
vm.createContext(ctx);
['data.js', 'engine.js', 'ui.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(root, 'src/js', f), 'utf8'), ctx, { filename: f }));

function run(code) { return vm.runInContext(code, ctx); }

// 1) 开始页
run('render()');
const startHtml = store.app || '';
console.log('开始页:', startHtml.includes('营销线') && startHtml.includes('敬请期待') ? 'OK' : 'FAIL');

// 2) 开局
run("START={stage:'setup',path:'sales',name:'测试',tags:['data','frugal'],diff:'hard'}; startGame();");
const S = run('S');
console.log('开局:', S && S.team.length === 2 ? 'OK' : 'FAIL', '| 难度', S.diff, '| 预算', S.cash);

// 3) 各视图
['overview', 'terminals', 'team', 'actions', 'relations', 'compliance', 'log'].forEach(tab => {
  try {
    run(`TAB='${tab}'; render();`);
    const html = store.app || '';
    const bad = /undefined|NaN|\[object Object\]/.test(html);
    console.log('视图', tab.padEnd(11), bad ? 'FAIL(含 undefined/NaN)' : 'OK', html.length + ' chars');
    if (bad) {
      const m = html.match(/.{0,60}(undefined|NaN|\[object Object\]).{0,60}/);
      console.log('   →', m && m[0]);
    }
  } catch (e) {
    console.log('视图', tab, 'ERROR', e.message);
  }
});

// 4) 弹窗
try {
  run("setModal(matrixModal); renderModal();");
  console.log('矩阵弹窗:', (store['modal-root'] || '').includes('团队明细配置') ? 'OK' : 'FAIL');
} catch (e) { console.log('矩阵弹窗 ERROR', e.message); }
try {
  run("ACT={pid:'coach',sel:[],repId:S.team[0].id}; setModal(coachModal); renderModal();");
  console.log('协访弹窗:', (store['modal-root'] || '').includes('协访') ? 'OK' : 'FAIL');
} catch (e) { console.log('协访弹窗 ERROR', e.message); }
try {
  run("openGuess(S.team[0].id); renderModal();");
  console.log('猜标签弹窗:', (store['modal-root'] || '').includes('猜标签') ? 'OK' : 'FAIL');
} catch (e) { console.log('猜标签 ERROR', e.message); }

// 5) 推进四周 + 月报 + 事件
try {
  for (let i = 0; i < 4; i++) { run('onEndWeek()'); run("confirmOrder('push')"); }
  console.log('四周结算:', 'OK', '| 月份', run('S.totalMonth'), '| 历史', run('S.history.length'));
  run('showMonthReport({monthReport:S.lastReport, promotion:null})');
  console.log('月报:', (store['modal-root'] || '').includes('经营简报') ? 'OK' : 'FAIL');
} catch (e) { console.log('结算 ERROR', e.message); }
