// ============================================================
// 霞客行 · 自动化质检  node test\test.js
// 数据完整性 / 引文与出处 / 题库结构与泄露扫描 / 成就可达性 /
// 离线AI引擎与确定性 / 插画引擎 / 工程文件完整性 / JSON 往返
// ============================================================
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var PASS = 0, FAIL = 0, FAILS = [];
function ok(cond, msg) {
  if (cond) { PASS++; }
  else { FAIL++; FAILS.push(msg); console.log('  ✗ ' + msg); }
}
function section(name) { console.log('\n== ' + name + ' =='); }

// ---------- 加载纯逻辑 JS（window 命名空间） ----------
global.window = {};
var ROOT = path.join(__dirname, '..');
['js/data-chapters.js', 'js/data-points.js', 'js/data-questions.js', 'js/data-source.js', 'js/achievements.js', 'js/paint.js', 'js/ai.js'].forEach(function (f) {
  var code = fs.readFileSync(path.join(ROOT, f), 'utf8');
  vm.runInThisContext(code, { filename: f });
});
var CHAPTERS = window.XK_CHAPTERS, POINTS = window.XK_POINTS, QUES = window.XK_QUESTIONS,
  LF = window.XK_LANDFORMS, ACH = window.XK_ACHIEVEMENTS, AI = window.AI, SOURCE = window.XK_SOURCE, META = window.XK_META;

// ---------- 工具 ----------
function norm(t) { return AI.norm(t); }
function dist(a, b) { // haversine km
  var R = 6371, r = Math.PI / 180;
  var dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(s));
}

// ============================================================
section('1. 篇章数据完整性');
ok(CHAPTERS.length === 7, '篇章数应为 7，实际 ' + CHAPTERS.length);
var chIds = CHAPTERS.map(function (c) { return c.id; });
ok(new Set(chIds).size === 7, '篇章 id 应唯一');
CHAPTERS.forEach(function (c) {
  ok(c.id && c.title && c.region && c.year && c.intro && c.intro.length >= 20, '篇章 ' + c.id + ' 基础字段完整');
  ok(c.difficulty >= 1 && c.difficulty <= 3, c.id + ' 难度应在 1-3');
  ok(c.landforms.length >= 1 && c.landforms.every(function (l) { return LF[l]; }), c.id + ' 地貌类型全部合法');
  ok(c.era && c.age, c.id + ' 时代/年龄标注存在');
});
ok(chIds.indexOf('yn') >= 0 && CHAPTERS[6].id === 'yn', '篇章按游年排序（滇池在末）');

section('2. 点位数据完整性');
var pids = Object.keys(POINTS);
ok(pids.length >= 20, '点位数 ≥20，实际 ' + pids.length);
pids.forEach(function (pid) {
  var p = POINTS[pid];
  ok(!!chOf(p.ch), pid + ' 所属篇章存在');
  ok(p.ancient && p.modern && p.modern.length >= 4, pid + ' 古今地名齐全');
  ok(p.lon > 73 && p.lon < 136 && p.lat > 17 && p.lat < 54, pid + ' 坐标在中国范围内 (' + p.lon + ',' + p.lat + ')');
  ok(!!LF[p.landform], pid + ' 地貌类型合法：' + p.landform);
  ok(typeof p.seg === 'string' && p.seg.length >= 4 && p.seg.length <= 80, pid + ' 引文长度 4-80（现 ' + (p.seg || '').length + '）');
  ok(typeof p.src === 'string' && p.src.length >= 3, pid + ' 出处篇名存在');
  ok(!p.segSrc || typeof p.segSrc === 'string', pid + ' segSrc 类型正确');
  ok(typeof p.note === 'string' && p.note.length >= 10, pid + ' 注释非空');
  ok(typeof p.baihua === 'string' && p.baihua.length >= 8, pid + ' 白话非空');
  ok(Array.isArray(p.knowledge) && p.knowledge.length >= 2 && p.knowledge.every(function (k) { return k.length >= 10; }), pid + ' 知识点 ≥2 条且各 ≥10 字');
  ok(typeof p.verified === 'boolean', pid + ' verified 标记为布尔');
});
function chOf(id) { return CHAPTERS.filter(function (c) { return c.id === id; })[0]; }

section('3. 游线连续性与地貌覆盖');
CHAPTERS.forEach(function (c) {
  var pts = Object.keys(POINTS).map(function (k) { return POINTS[k]; })
    .filter(function (p) { return p.ch === c.id; }).sort(function (a, b) { return a.seq - b.seq; });
  ok(pts.length >= 2, c.id + ' 至少 2 个点位');
  ok(pts.every(function (p, i) { return p.seq === i + 1; }), c.id + ' seq 从 1 连续');
  for (var i = 1; i < pts.length; i++) {
    var d = dist(pts[i - 1], pts[i]);
    ok(d <= 130, c.id + ' 相邻点位 ' + pts[i - 1].ancient + '→' + pts[i].ancient + ' 距离 ' + d.toFixed(1) + 'km ≤130');
  }
  var union = {}; pts.forEach(function (p) { union[p.landform] = 1; });
  c.landforms.forEach(function (l) { ok(union[l], c.id + ' 声明地貌「' + l + '」确有点位承担'); });
});
var allLf = {}; pids.forEach(function (pid) { allLf[POINTS[pid].landform] = 1; });
ok(Object.keys(LF).every(function (l) { return allLf[l]; }), '7 类地貌全部有点位覆盖（缺：' + Object.keys(LF).filter(function (l) { return !allLf[l]; }).join(',') + '）');

section('4. 题库结构');
pids.forEach(function (pid) {
  var qs = QUES[pid];
  ok(Array.isArray(qs) && qs.length === 3, pid + ' 恰好 3 题');
  if (!qs) return;
  ok(qs[0].type === 'choice' && qs[1].type === 'blank' && qs[2].type === 'material', pid + ' 题型为 选择/填空/材料 顺序');
  qs.forEach(function (q, i) {
    ok(q.q && q.q.length >= 6, pid + '#' + i + ' 题干非空');
    ok(typeof q.explain === 'string' && q.explain.length >= 6, pid + '#' + i + ' 解析非空');
    if (q.type === 'choice') {
      ok(q.options.length === 4 && new Set(q.options).size === 4, pid + '#' + i + ' 四选项且互异');
      ok(q.answer >= 0 && q.answer <= 3, pid + '#' + i + ' 答案下标合法');
    }
    if (q.type === 'blank') {
      ok(/[＿_]{2,}/.test(q.q), pid + '#' + i + ' 填空题干含空位');
      ok(q.answer && q.answer.length <= 14, pid + '#' + i + ' 填空答案长度合理');
      ok(Array.isArray(q.accepts) && q.accepts.length >= 1, pid + '#' + i + ' accepts 数组存在');
    }
    if (q.type === 'material') {
      ok(q.ref && q.ref.length >= 15, pid + '#' + i + ' 简答参考要点 ≥15 字');
      ok(Array.isArray(q.keywords) && q.keywords.length >= 4, pid + '#' + i + ' 评分关键词 ≥4 个');
    }
  });
});
ok(pids.every(function (pid) { return QUES[pid]; }), '每点位均有题');

section('5. 泄露扫描（题干不得含答案）');
pids.forEach(function (pid) {
  (QUES[pid] || []).forEach(function (q, i) {
    var nq = norm(q.q);
    if (q.type === 'choice') {
      var corr = norm(q.options[q.answer]);
      ok(nq.indexOf(corr) < 0, pid + '#' + i + ' 选择题题干未泄露正确项');
    }
    if (q.type === 'blank') {
      var bad = [q.answer].concat(q.accepts || []).some(function (a) { return a && nq.indexOf(norm(a)) >= 0; });
      ok(!bad, pid + '#' + i + ' 填空题题干未泄露答案（' + q.answer + '）');
    }
  });
});

section('6. 成就体系');
ok(ACH.length === 18, '成就 18 枚，实际 ' + ACH.length);
ok(new Set(ACH.map(function (a) { return a.id; })).size === 18, '成就 id 唯一');
var zero = window.XK_judge({ checkedCount: 0, chaptersDone: [], landformsSeen: [], perfectQuizzes: 0, correctCount: 0, wrongCleared: 0, answerCount: 0, readerPieces: 0, readerGroups: 0, askedCount: 0, visitedAbout: 0 });
ok(zero.length === 0, '零状态不应解锁任何成就');
var full = { checkedCount: 25, chaptersDone: chIds, landformsSeen: Object.keys(LF), perfectQuizzes: 1, correctCount: 30, wrongCleared: 10, answerCount: 50, readerPieces: 12, readerGroups: 7, askedCount: 10, visitedAbout: 1 };
ok(window.XK_judge(full).length === 18, '满状态解锁全部 18 枚');
ACH.forEach(function (a) {
  // 逐枚构造可达状态
  var s = { checkedCount: 0, chaptersDone: [], landformsSeen: [], perfectQuizzes: 0, correctCount: 0, wrongCleared: 0, answerCount: 0, readerPieces: 0, readerGroups: 0, askedCount: 0, visitedAbout: 0 };
  if (a.id === 'a01') s.checkedCount = 1;
  if (a.id === 'a02') s.chaptersDone = ['tt'];
  if (a.id === 'a03') s.chaptersDone = ['tt'];
  if (a.id === 'a04') s.chaptersDone = ['hs'];
  if (a.id === 'a05') s.chaptersDone = ['gx'];
  if (a.id === 'a06') s.chaptersDone = ['wy'];
  if (a.id === 'a07') s.landformsSeen = ['流水地貌'];
  if (a.id === 'a08') s.landformsSeen = Object.keys(LF);
  if (a.id === 'a09') s.perfectQuizzes = 1;
  if (a.id === 'a10') s.correctCount = 30;
  if (a.id === 'a11') s.wrongCleared = 10;
  if (a.id === 'a12') s.checkedCount = 25;
  if (a.id === 'a13') s.chaptersDone = chIds;
  if (a.id === 'a14') s.readerPieces = 1;
  if (a.id === 'a15') s.readerGroups = 7;
  if (a.id === 'a16') s.visitedAbout = 1;
  if (a.id === 'a17') s.answerCount = 50;
  if (a.id === 'a18') s.askedCount = 10;
  ok(window.XK_judge(s).indexOf(a.id) >= 0, '成就 ' + a.id + ' 可达');
});
// XK_stats 推导
(function () {
  var now = Date.now();
  var recs = { points: { tt01: { checkedAt: now, quiz: { done: now, items: [{ correct: true }, { correct: true }, { correct: true }] } }, tt02: { checkedAt: now } }, wrongBook: { 'tt02#0': { cleared: true } } };
  var s = window.XK_stats(recs, CHAPTERS);
  ok(s.checkedCount === 2, 'stats 打卡数推导');
  ok(s.perfectQuizzes === 1, 'stats 满分卷推导');
  ok(s.correctCount === 3, 'stats 答对数推导');
  ok(s.landformsSeen.indexOf('流水地貌') >= 0, 'stats 图鉴推导');
  ok(s.wrongCleared === 1, 'stats 错题清除推导');
  ok(s.chaptersDone.length === 0, 'stats 章节未满不计数');
  var recs2 = JSON.parse(JSON.stringify(recs));
  Object.keys(POINTS).filter(function (p) { return POINTS[p].ch === 'tt'; }).forEach(function (p) { if (!recs2.points[p]) recs2.points[p] = { checkedAt: now }; });
  ok(window.XK_stats(recs2, CHAPTERS).chaptersDone.indexOf('tt') >= 0, 'stats 全章打卡计入章节');
})();

section('7. 离线 AI 引擎');
ok(norm('Ca(HCO₃)₂') === 'cahco32', 'norm 下标数字归一（括号亦去除）');
ok(norm('千 － 里 之 行，始于足下！') === '千里之行始于足下', 'norm 去空白与标点（含全角连字符）');
// 选择
ok(AI.gradeOne(QUES.tt01[0], 1).correct === true, '选择判对');
ok(AI.gradeOne(QUES.tt01[0], 0).correct === false, '选择判错');
// 填空（含 accepts 与归一化）
ok(AI.gradeOne(QUES.tt01[1], '41').correct === true, '填空 accepts 命中（41）');
ok(AI.gradeOne(QUES.gx01[1], 'Ca(HCO₃)₂').correct === true, '填空化学式归一命中');
ok(AI.gradeOne(QUES.tt01[1], '四十二').correct === false, '填空判错');
// 材料
var mat = QUES.gx01[2];
ok(AI.gradeOne(mat, mat.keywords.join('、')).score === 10, '材料全要点满分');
ok(AI.gradeOne(mat, '不知道').score === 0, '材料空答零分');
var partial = AI.gradeOne(mat, mat.keywords.slice(0, Math.max(2, Math.ceil(mat.keywords.length * 0.6))).join(''));
ok(partial.score >= 8 && partial.correct, '材料达线及格（' + partial.score + '）');
// 助教
var tt04 = POINTS.tt04;
var t1 = AI.tutorOffline(tt04, '石梁是怎么形成的？');
ok(t1.matched === true && t1.text.indexOf('石梁') >= 0, '助教命中相关知识');
var t2 = AI.tutorOffline(tt04, '石梁是怎么形成的呢');
var t3 = AI.tutorOffline(tt04, '石梁是怎么形成的呢');
ok(t2.text === t3.text, '助教同输入输出逐位一致（确定性）');
var t4 = AI.tutorOffline(tt04, '今晚吃什么');
ok(t4.matched === false && t4.text.length > 10, '助教无匹配时礼貌兜底');
ok(AI.grams('徐霞客').length === 2, 'grams 二元分词');
ok(AI.PROMPTS.ner.indexOf('ancient_name') >= 0 && AI.PROMPTS.ner.indexOf('{{篇章标题}}') >= 0, 'NER 提示词内置完整');
ok(AI.PROMPTS.tutor.indexOf('霞客行') >= 0 && AI.PROMPTS.tutor.indexOf('{{古地名}}') >= 0, '助教提示词内置完整');
ok(AI.PROMPTS.quiz.indexOf('批改模式指令') >= 0, '批改提示词内置');
ok(AI.PROMPTS.draw.indexOf('手绘地理示意图') >= 0, '插画提示词内置');

section('8. 插画引擎');
Object.keys(LF).forEach(function (l) {
  var a = window.XK_paint(l, 123);
  ok(a && a.svg.indexOf('<svg') === 0 && a.svg.indexOf('viewBox') > 0, l + ' 插画 SVG 生成');
  ok(Array.isArray(a.labels) && a.labels.length >= 3, l + ' 插画标注 ≥3');
  var b = window.XK_paint(l, 123);
  ok(a.svg === b.svg, l + ' 同种子逐位一致');
});
ok(window.XK_paint('不存在地貌', 1) === null, '未知地貌返回 null');
var c1 = window.XK_paint('丹霞地貌', 1).svg, c2 = window.XK_paint('丹霞地貌', 2).svg;
ok(c1 !== c2, '不同种子画面有差异');

section('9. 工程文件完整性');
var idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
var srcs = [];
idx.replace(/src="([^"]+)"/g, function (_, s) { srcs.push(s); });
srcs.forEach(function (s) { ok(fs.existsSync(path.join(ROOT, s)), '引用存在: ' + s); });
['vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'css/app.css', 'server.js', '启动.bat', 'README.md', 'report/考据说明.md'].forEach(function (f) {
  ok(fs.existsSync(path.join(ROOT, f)), '工程文件存在: ' + f);
});
ok(/8946/.test(fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8')), 'server.js 端口 8946');
// 全部 js 可编译（语法关）
var jsDir = path.join(ROOT, 'js');
fs.readdirSync(jsDir).filter(function (f) { return f.endsWith('.js'); }).forEach(function (f) {
  var code = fs.readFileSync(path.join(jsDir, f), 'utf8');
  var okk = true;
  try { new Function(code); } catch (e) { okk = false; }
  ok(okk, 'js/' + f + ' 语法可编译');
});
// index.html 引用了全部 js
var listed = srcs.filter(function (s) { return s.indexOf('js/') === 0; }).map(function (s) { return s.replace('js/', ''); });
fs.readdirSync(jsDir).forEach(function (f) {
  ok(listed.indexOf(f) >= 0, 'index.html 已挂载 js/' + f);
});
ok(idx.indexOf('vendor/leaflet/leaflet.js') >= 0 && idx.indexOf('css/app.css') >= 0, 'index.html 挂载 Leaflet 与样式');

section('10. 学习档案 JSON 往返');
(function () {
  var recs = { points: { tt01: { checkedAt: 1, quiz: { done: 2, items: [{ correct: true, score: 10, comment: 'a', given: { pick: 1 } }] } } }, wrongBook: { 'tt01#0': { pid: 'tt01', qi: 0, cleared: false } }, ach: { a01: 3 } };
  var back = JSON.parse(JSON.stringify(recs));
  ok(JSON.stringify(back) === JSON.stringify(recs), '档案序列化往返一致');
  ok(window.XK_stats(back, CHAPTERS).checkedCount === 1, '反序列化后 stats 可算');
})();

section('11. 考据状态留痕');
var verified = pids.filter(function (pid) { return POINTS[pid].verified; });
var segOverride = pids.filter(function (pid) { return POINTS[pid].segSrc; });
console.log('  · 引文已核底本（verified=true）：' + verified.length + ' 条');
console.log('  · 引文出处非徐记原文（segSrc 注明，verified=false）：' + segOverride.length + ' 条（' + segOverride.map(function (p) { return POINTS[p].ancient; }).join('、') + '）');
ok(pids.every(function (pid) { return typeof POINTS[pid].verified === 'boolean'; }), '全部点位带考据状态字段');
ok(verified.length >= 20, '已核底本引文 ≥20 条，实际 ' + verified.length);

section('12. 原文语料库（data-source.js）');
ok(SOURCE && SOURCE.pieces && SOURCE.pieces.length >= 12, '语料分篇 ≥12，实际 ' + (SOURCE.pieces ? SOURCE.pieces.length : 0));
ok(SOURCE.groups && SOURCE.groups.length === 7, '阅读分组 = 7 组');
SOURCE.pieces.forEach(function (p) {
  ok(p.paras && p.paras.length >= 5 && p.chars >= 500, '语料「' + p.title + '」≥500 字且分好段（' + p.chars + ' 字）');
  ok(p.url && p.url.indexOf('guoxuemeng') >= 0, '语料「' + p.title + '」带来源 URL');
  ok(!!chOf(p.parent), '语料「' + p.title + '」挂靠篇章存在：' + p.parent);
});
SOURCE.groups.forEach(function (g) {
  ok(SOURCE.pieces.some(function (p) { return p.parent === g.id; }), '分组「' + g.title + '」有语料');
});
ok(META && META.bio && META.bio.length >= 4, '人物志小传 ≥4 段');
ok(META.timeline && META.timeline.length >= 10, '年表 ≥10 条');
ok(META.quotes && META.quotes.length >= 6 && META.quotes.every(function (q) { return q.src; }), '语录 ≥6 条且全部标注出处');
ok(META.quotes.filter(function (q) { return q.verified; }).length >= 5, '已核底本语录 ≥5 条');
ok(META.glossary && META.glossary.length >= 10, '助教全局知识 ≥10 条');

section('13. 引文对照底本回归（verified 逐条可回查）');
// 夹注酌删片段白名单：这些 seg 与原站正文差异仅为"随文夹注删除"，以片段组核对
var GLOSS_FRAGS = {
  tt01: [['癸丑', '之三月晦', '自宁海出西门。云散日朗，人意山光，俱有喜态。']],
  tt02: [['三十里，至梁隍山。闻此於菟', '夹道，月伤数十人，遂止宿。']],
  tt03: [['雨始止。', '遂越潦', '攀岭，溪石渐幽，二十里，暮抵天封寺。']],
  tt05: [['至赤城麓，仰视丹霞层亘', '标其巅，兀立于重岚攒翠间。']],
  yd04: [['洼中积水成芜', '青青弥望', '所称雁湖也。'], ['皆与大龙湫风马牛无及云。']],
  gx01: [['中多列笋悬柱', '此上洞也，是为七星岩。从其右历级下，又入下洞，是为栖霞洞。其洞宏朗雄拓，门亦西北向。']],
  gx03: [['则龙头山铮铮露骨', '县之四围，攒作碧莲玉笋世界矣。']]
};
var union = norm(SOURCE.pieces.map(function (p) { return p.paras.join(''); }).join(''));
verified.forEach(function (pid) {
  var seg = POINTS[pid].seg;
  var parts = seg.split('……');
  var frags = GLOSS_FRAGS[pid] || null;
  var passAll;
  if (frags) {
    passAll = frags.some(function (alt) { return alt.every(function (f) { return union.indexOf(norm(f)) >= 0; }); });
    ok(passAll, pid + ' 引文（夹注酌删版）可回查底本');
  } else {
    passAll = parts.every(function (part) { return norm(part) && union.indexOf(norm(part)) >= 0; });
    ok(passAll, pid + ' 引文逐字回查底本：' + seg.slice(0, 14) + '…');
  }
});
// 两处考据发现须常驻知识库（防回退）
ok(norm(POINTS.ls02.knowledge.join('')).indexOf('张冠李戴') >= 0 || POINTS.ls02.knowledge.some(function (k) { return k.indexOf('拖练') >= 0 && k.indexOf('并无此文') >= 0; }), 'ls02 保留"拖练误传"考据警示');
ok(POINTS.yn02.knowledge.some(function (k) { return k.indexOf('游太华山日记') >= 0 && k.indexOf('华山') >= 0; }), 'yn02 保留"太华山日记=华山"辨名提示');
ok(POINTS.yn03.knowledge.some(function (k) { return k.indexOf('草海') >= 0 && k.indexOf('不复知为滇池巨流') >= 0; }), 'yn03 引底本草海原文');

section('14. 助教全局知识回落');
(function () {
  var bare = { ancient: '测试点', landform: '流水地貌', knowledge: [], baihua: '', note: '' };
  var r1 = AI.tutorOffline(bare, '万里遐征是怎么回事？');
  ok(r1.matched === true && r1.text.indexOf('1636') >= 0, '无点位知识时回落全局知识库（万里遐征）');
  var r2 = AI.tutorOffline(bare, '什么是丹霞地貌');
  ok(r2.matched === true && r2.text.indexOf('砂砾岩') >= 0, '全局知识命中（丹霞地貌）');
  var r3 = AI.tutorOffline(bare, 'xyzzz 完全无关的问题');
  ok(r3.matched === false, '全局也未命中则如实告知');
  // 引用一致性：语录 verified 与底层事实
  ok(META.quotes.every(function (q) { return q.text.length >= 4; }), '语录文本非空');
})();

section('15. stats 新字段推导');
(function () {
  var now = Date.now();
  var recs = { points: {}, wrongBook: {}, read: { tt: now, tt2: now + 1 }, asked: { a: 1, b: 2, c: 3 }, about: now };
  var s = window.XK_stats(recs, CHAPTERS);
  ok(s.readerPieces === 2, 'readerPieces 推导');
  ok(s.readerGroups === 1, 'readerGroups 推导（同组两篇记一组）');
  ok(s.askedCount === 3, 'askedCount 推导');
  ok(s.visitedAbout === 1, 'visitedAbout 推导');
  var recs0 = { points: {}, wrongBook: {} };
  var s0 = window.XK_stats(recs0, CHAPTERS);
  ok(s0.readerGroups === 0 && s0.askedCount === 0 && s0.visitedAbout === 0, '空档案新字段安全');
})();

section('16. 前端新页面接线');
var appCode = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
ok(appCode.indexOf("'reader'") >= 0 && appCode.indexOf('pageReader') >= 0, '阅读器路由已接线');
ok(appCode.indexOf("'about'") >= 0 && appCode.indexOf('pageAbout') >= 0, '人物志路由已接线');
ok(appCode.indexOf('xk-quotecard') >= 0, '首页/图鉴语录卡已接线');
ok(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').indexOf('js/data-source.js') >= 0, 'index.html 挂载语料库');

// ---------- 汇总 ----------
section('17. 夜跑新增（2026-11-12）：章节综合测验 / 每日一题 / 遐征全图 / 离线朗读');
ok(appCode.indexOf('pageExam') >= 0 && appCode.indexOf("seg[0] === 'exam'") >= 0, '章节综合测验路由已接线');
ok(appCode.indexOf('pageAtlas') >= 0 && appCode.indexOf("seg[0] === 'atlas'") >= 0, '遐征全图路由已接线');
ok(appCode.indexOf('遐征全图') >= 0, '导航含遐征全图入口');
ok(appCode.indexOf('每日一题') >= 0, '首页含每日一题卡');
ok(appCode.indexOf('speechSynthesis') >= 0 && appCode.indexOf('xk-ttsbar') >= 0, '阅读器离线朗读模块已装');
ok(appCode.indexOf('xk-lightbox') >= 0, '地貌插画灯箱已装');
var cssAppCode = fs.readFileSync(path.join(ROOT, 'css', 'app.css'), 'utf8');
ok(cssAppCode.indexOf('#xk-lightbox') >= 0 && cssAppCode.indexOf('xk-tts-on') >= 0, '润色层样式齐备（灯箱+朗读高亮）');
ok(cssAppCode.indexOf('夜跑润色层') >= 0, '润色层带留痕注释');
// 行为断言：以 DOM/localStorage 桩在 vm 中加载 app.js
global.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
global.document = { readyState: 'loading', addEventListener: function () {}, removeEventListener: function () {}, getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return { style: {}, classList: { add: function () {}, remove: function () {} }, addEventListener: function () {}, appendChild: function () {}, setAttribute: function () {}, remove: function () {} }; }, body: { appendChild: function () {} } };
window.addEventListener = function () {};
vm.runInThisContext(appCode, { filename: 'js/app.js' });
var API = window.AppApi;
ok(!!API && typeof API.examPool === 'function', 'app.js 可在 vm 中加载并暴露 AppApi');
if (API) {
  var pool0 = API.examPool(chIds[0]);
  ok(pool0.length >= 3, '首章测验池 ≥3 题（实际 ' + pool0.length + '）');
  var d1 = API.examSeedPick(chIds[0], 5, '2026-11-12');
  var d2 = API.examSeedPick(chIds[0], 5, '2026-11-12');
  ok(d1.length === Math.min(5, pool0.length), '抽卷数量正确（' + d1.length + '）');
  ok(JSON.stringify(d1) === JSON.stringify(d2), '同种子抽卷逐位一致（可复现）');
  var seenQ = {}, dupQ = false;
  d1.forEach(function (it) { var k = it.pid + '#' + it.qi; if (seenQ[k]) dupQ = true; seenQ[k] = 1; });
  ok(!dupQ, '抽卷无重复题');
  var aps = API.atlasPoints();
  ok(aps.length === pids.length, '遐征全图聚合全部点位（' + aps.length + '/' + pids.length + '）');
  var orderOk = aps.every(function (p, i) { return i === 0 || chIds.indexOf(p.ch) >= chIds.indexOf(aps[i - 1].ch); });
  ok(orderOk, '游线按篇章游年顺序排列');
  var kmTotal = API.atlasKm(aps);
  ok(typeof kmTotal === 'number' && kmTotal > 1000, '万里遐征直线总距 ' + kmTotal + ' km');
  var dp1 = API.dailyPick('2026-11-12'), dp2 = API.dailyPick('2026-11-12');
  ok(!!dp1 && !!dp2 && dp1.pid === dp2.pid && dp1.qi === dp2.qi, '每日一题当日确定性');
  ok(dp1.q.type === 'choice' && Array.isArray(dp1.q.options), '每日一题池仅选择题');
  ok(!!API.dailyPick('2026-11-13'), '跨日轮换可取');
}

console.log('\n========================================');
console.log('通过 ' + PASS + ' 项 / 失败 ' + FAIL + ' 项');
if (FAIL) { console.log('失败清单：'); FAILS.forEach(function (m) { console.log('  ✗ ' + m); }); process.exit(1); }
else console.log('★ 全绿');
