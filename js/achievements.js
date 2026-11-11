// ============================================================
// 霞客行 · 成就系统（18 枚徽章，纯函数判定，可测试）
// stats 由 app.js 从学习记录推导：
//   { checkedCount, chaptersDone:[chId], landformsSeen:[地貌],
//     perfectQuizzes, correctCount, wrongCleared, answerCount,
//     readerPieces, readerGroups, askedCount, visitedAbout }
// ============================================================
window.XK_ACHIEVEMENTS = [
  { id: 'a01', name: '初出西门', icon: '行', desc: '完成第一次点位打卡',           check: s => s.checkedCount >= 1 },
  { id: 'a02', name: '云散日朗', icon: '晴', desc: '完成一整章研学',               check: s => s.chaptersDone.length >= 1 },
  { id: 'a03', name: '於菟为伴', icon: '虎', desc: '完成《游天台山日记》全章',     check: s => s.chaptersDone.indexOf('tt') >= 0 },
  { id: 'a04', name: '观止',     icon: '峰', desc: '完成《游黄山日记》全章',       check: s => s.chaptersDone.indexOf('hs') >= 0 },
  { id: 'a05', name: '探洞先锋', icon: '洞', desc: '完成桂林七星岩全章',           check: s => s.chaptersDone.indexOf('gx') >= 0 },
  { id: 'a06', name: '碧水丹山', icon: '丹', desc: '完成《游武彝山日记》全章',     check: s => s.chaptersDone.indexOf('wy') >= 0 },
  { id: 'a07', name: '图鉴开卷', icon: '画', desc: '收集第一张地貌插画',           check: s => s.landformsSeen.length >= 1 },
  { id: 'a08', name: '七彩山河', icon: '图', desc: '集齐 7 类地貌插画',            check: s => s.landformsSeen.length >= 7 },
  { id: 'a09', name: '满分卷',   icon: '全', desc: '单点位三题全对',               check: s => s.perfectQuizzes >= 1 },
  { id: 'a10', name: '学而不厌', icon: '勤', desc: '累计答对 30 题',               check: s => s.correctCount >= 30 },
  { id: 'a11', name: '错题克星', icon: '克', desc: '错题重做累计答对 10 题',       check: s => s.wrongCleared >= 10 },
  { id: 'a12', name: '行万里路', icon: '路', desc: '打卡满 25 个点位',             check: s => s.checkedCount >= 25 },
  { id: 'a13', name: '霞客再世', icon: '霞', desc: '完成全部 7 个篇章',            check: s => s.chaptersDone.length >= 7 },
  { id: 'a14', name: '开卷有益', icon: '卷', desc: '读完第一篇游记原文',           check: s => s.readerPieces >= 1 },
  { id: 'a15', name: '遍读群记', icon: '典', desc: '读完全部 7 组游记原文',        check: s => s.readerGroups >= 7 },
  { id: 'a16', name: '慕霞客之风', icon: '慕', desc: '探访「霞客其人」人物志',     check: s => s.visitedAbout >= 1 },
  { id: 'a17', name: '学富五车', icon: '富', desc: '累计作答 50 题',               check: s => s.answerCount >= 50 },
  { id: 'a18', name: '好问则裕', icon: '问', desc: '向研学助教提问 10 次',         check: s => s.askedCount >= 10 }
];

// 判定：返回当前已解锁的成就 id 数组（纯函数）
window.XK_judge = function (stats) {
  return window.XK_ACHIEVEMENTS.filter(a => { try { return !!a.check(stats); } catch (e) { return false; } })
    .map(a => a.id);
};

// 由原始学习记录推导 stats（纯函数，records 为反序列化后的对象）
window.XK_stats = function (recs, chapters) {
  var points = window.XK_POINTS || {};
  var checked = 0, chaptersDone = [], landformsSeen = {}, perfect = 0, correct = 0, wrongCleared = 0, answers = 0;
  var pts = recs && recs.points ? recs.points : {};
  Object.keys(pts).forEach(function (pid) {
    var p = pts[pid]; if (!p) return;
    if (p.checkedAt) { checked++; var pd = points[pid]; if (pd) landformsSeen[pd.landform] = 1; }
    if (p.quiz && p.quiz.done) {
      answers += (p.quiz.items ? p.quiz.items.length : 0);
      correct += (p.quiz.items || []).filter(function (it) { return it.correct; }).length;
      if ((p.quiz.items || []).length === 3 && p.quiz.items.every(function (it) { return it.correct; })) perfect++;
    }
  });
  var wrongBook = (recs && recs.wrongBook) || {};
  Object.keys(wrongBook).forEach(function (k) { if (wrongBook[k] && wrongBook[k].cleared) wrongCleared++; });
  (chapters || window.XK_CHAPTERS || []).forEach(function (c) {
    var cps = Object.keys(points).filter(function (pid) { return points[pid].ch === c.id; });
    if (cps.length && cps.every(function (pid) { return pts[pid] && pts[pid].checkedAt; })) chaptersDone.push(c.id);
  });
  // 原文阅读 / 提问 / 人物志
  var readMap = (recs && recs.read) || {};
  var readerPieces = Object.keys(readMap).length;
  var readerGroups = {};
  if (window.XK_SOURCE && window.XK_SOURCE.pieces) {
    window.XK_SOURCE.pieces.forEach(function (pc) { if (readMap[pc.id]) readerGroups[pc.parent] = 1; });
  }
  return {
    checkedCount: checked,
    chaptersDone: chaptersDone,
    landformsSeen: Object.keys(landformsSeen),
    perfectQuizzes: perfect,
    correctCount: correct,
    wrongCleared: wrongCleared,
    answerCount: answers,
    readerPieces: readerPieces,
    readerGroups: Object.keys(readerGroups).length,
    askedCount: recs && recs.asked ? Object.keys(recs.asked).length : 0,
    visitedAbout: recs && recs.about ? 1 : 0
  };
};
