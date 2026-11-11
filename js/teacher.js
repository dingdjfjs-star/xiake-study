// ============================================================
// 霞客行 · 教师端（手册教师四页）
// 任务管理 / 班级学情看板 / 知识点题库管理 / 优秀作业展示
// 数据：TDB（localStorage 'xiake_teacher_v1'，本机共享）；
// 看板 = 真实本机学生档案 + 种子化模拟班级（明确标注"演示数据"）
// ============================================================
window.TDB = (function () {
  var KEY = 'xiake_teacher_v1';
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
  var db = load() || { tasks: [], excellent: {}, customQ: {}, demoSeed: 20260829 };
  function save() { localStorage.setItem(KEY, JSON.stringify(db)); }
  db.save = save;
  return db;
})();

window.Teacher = (function () {
  'use strict';
  var A = function () { return window.AppApi; };

  // ---------- 种子化模拟班级（演示数据） ----------
  function mulberry(seed) { var t = seed >>> 0; return function () { t += 0x6D2B79F5; var r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
  function hash32(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  var DEMO_NAMES = ['唐晓霞', '程观澜', '顾青崖', '林向晚', '沈知行', '苏砚秋', '陆云帆', '孟涵烟', '江采薇', '顾北辰', '叶枕流', '郑秋帆'];

  function demoClass() {
    var api = A(), chapters = api.CHAPTERS, points = api.POINTS, LF = api.LF;
    var r = mulberry((window.TDB.demoSeed || 20260829) >>> 0);
    var students = DEMO_NAMES.map(function (name) { return { name: name, ability: 0.5 + r() * 0.45 }; });
    var rows = [], weak = {}, accAll = { ok: 0, all: 0 };
    students.forEach(function (st) {
      var done = 0, total = 0, ok = 0;
      Object.keys(points).forEach(function (pid) {
        if (r() > 0.32 + st.ability * 0.5) return; // 完成概率
        done++;
        var p = points[pid];
        ['choice', 'blank', 'material'].forEach(function (tp, qi) {
          var passP = tp === 'choice' ? 0.72 : (tp === 'blank' ? 0.66 : 0.52);
          var okq = r() < passP * (0.6 + st.ability * 0.7);
          total++; ok += okq ? 1 : 0; accAll.all++; accAll.ok += okq ? 1 : 0;
          if (!okq) { var k = p.landform; weak[k] = (weak[k] || 0) + 1; }
        });
      });
      rows.push({ name: st.name, done: done, total: Object.keys(points).length, acc: total ? Math.round(ok / total * 100) : 0 });
    });
    rows.sort(function (a, b) { return b.done * 1000 + b.acc - (a.done * 1000 + a.acc); });
    return { rows: rows, weak: weak, accAll: accAll, demo: true };
  }

  function realStudents() {
    var api = A(), db = api.DB, LF = api.LF, points = api.POINTS;
    return Object.keys(db.users).filter(function (u) { return Object.keys(db.users[u].recs.points).length || Object.keys(db.users[u].recs.wrongBook).length; })
      .map(function (u) {
        var recs = db.users[u].recs, done = 0, ok = 0, all = 0, weak = {};
        Object.keys(recs.points).forEach(function (pid) {
          if (recs.points[pid].checkedAt) done++;
          var q = recs.points[pid].quiz;
          if (q && q.done) (q.items || []).forEach(function (it) {
            all++; ok += it.correct ? 1 : 0;
            if (!it.correct && points[pid]) weak[points[pid].landform] = (weak[points[pid].landform] || 0) + 1;
          });
        });
        return { name: u + '（本机）', done: done, total: Object.keys(points).length, acc: all ? Math.round(ok / all * 100) : 0, weak: weak };
      });
  }

  // ---------- 页面：班级学情看板 ----------
  function pageDashboard(root) {
    var demo = demoClass(), real = realStudents();
    var rows = real.concat(demo.rows);
    var doneRate = Math.round(rows.reduce(function (s, r) { return s + r.done; }, 0) / rows.length / (rows[0] ? rows[0].total : 1) * 100);
    var acc = demo.accAll.all ? Math.round(demo.accAll.ok / demo.accAll.all * 100) : 0;
    var weakPairs = Object.keys(demo.weak).map(function (k) { return [k, demo.weak[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    var html = '<h2 class="xk-pgtitle">班级学情看板</h2>' +
      '<p class="xk-dim">含本机真实学生档案与<b>模拟班级（演示数据，种子 ' + (window.TDB.demoSeed || '') + '）</b>；接入真实班级后自动替换。</p>' +
      '<section class="xk-statrow">' +
      '<div class="xk-stat"><b>' + rows.length + '</b><i>学生数</i></div>' +
      '<div class="xk-stat"><b>' + doneRate + '%</b><i>平均完成率</i></div>' +
      '<div class="xk-stat"><b>' + acc + '%</b><i>平均正确率</i></div>' +
      '<div class="xk-stat"><b>' + Object.keys(demo.weak).length + '</b><i>易错地貌类</i></div></section>' +
      '<section class="xk-card"><h3>易错知识点分布（按地貌类）</h3>' +
      (weakPairs.length ? weakPairs.map(function (p) {
        var color = (A().LF[p[0]] || {}).color || '#888';
        return '<div class="xk-weakrow"><span>' + A().esc(p[0]) + '</span><div class="xk-bar"><i style="width:' + Math.round(p[1] / weakPairs[0][1] * 100) + '%;background:' + color + '"></i></div><b>' + p[1] + '</b></div>';
      }).join('') : '<p class="xk-empty">暂无错题数据。</p>') +
      '</section>' +
      '<section class="xk-card"><h3>学生进度排名</h3><table class="xk-table"><tr><th>名次</th><th>学生</th><th>打卡点位</th><th>正确率</th><th>状态</th></tr>' +
      rows.slice(0, 15).map(function (r, i) {
        return '<tr><td>' + (i + 1) + '</td><td>' + A().esc(r.name) + '</td><td>' + r.done + '/' + r.total + '</td><td>' + r.acc + '%</td><td>' + (r.done >= r.total ? '已通关' : (r.done ? '进行中' : '未开始')) + '</td></tr>';
      }).join('') + '</table></section>';
    root.innerHTML = html;
  }

  // ---------- 页面：研学任务管理 ----------
  function pageTasks(root) {
    var tdb = window.TDB;
    var html = '<h2 class="xk-pgtitle">研学任务管理</h2>' +
      '<section class="xk-card"><h3>新建任务</h3>' +
      '<div class="xk-row"><input id="t-cls" placeholder="班级，如：高一（3）班" style="flex:1">' +
      '<select id="t-ch">' + A().CHAPTERS.map(function (c) { return '<option value="' + c.id + '">' + A().esc(c.title) + '</option>'; }).join('') + '</select>' +
      '<input id="t-dl" type="date"></div>' +
      '<div class="xk-row"><button class="xk-btn primary" id="t-add">一键发布</button><span class="xk-dim">发布后学生端首页出现任务卡（同一浏览器）</span></div></section>' +
      '<section class="xk-card"><h3>已发布任务</h3>' +
      (!tdb.tasks.length ? '<p class="xk-empty">还没有任务。上面新建一个试试。</p>' :
        '<table class="xk-table"><tr><th>班级</th><th>篇章</th><th>截止</th><th>操作</th></tr>' +
        tdb.tasks.map(function (t, i) {
          return '<tr><td>' + A().esc(t.cls) + '</td><td>' + A().esc(t.title) + '</td><td>' + A().esc(t.deadline || '不限') + '</td><td><button class="xk-btn small" data-del="' + i + '">撤回</button></td></tr>';
        }).join('') + '</table>') +
      '</section>';
    root.innerHTML = html;
    $('#t-add', root).onclick = function () {
      var cls = $('#t-cls', root).value.trim() || '高一（3）班';
      var ch = $('#t-ch', root).value, c = A().chOf(ch);
      var dl = $('#t-dl', root).value;
      tdb.tasks.push({ id: 'T' + Date.now(), cls: cls, ch: ch, title: c.title, deadline: dl });
      tdb.save(); A().toast('任务已发布：' + cls + ' · ' + c.title);
      pageTasks(root);
    };
    $$('button[data-del]', root).forEach(function (b) {
      b.onclick = function () { tdb.tasks.splice(parseInt(b.getAttribute('data-del'), 10), 1); tdb.save(); pageTasks(root); };
    });
  }

  // ---------- 页面：知识点题库管理 ----------
  function pageBank(root) {
    var tdb = window.TDB, api = A();
    var html = '<h2 class="xk-pgtitle">知识点题库管理</h2>' +
      '<p class="xk-dim">内置题库 ' + Object.keys(api.POINTS).reduce(function (s, pid) { return s + api.questionsOf(pid).length; }, 0) + ' 题；校本补充题存于本机，追加到对应点位之后（答题时生效）。</p>' +
      '<section class="xk-card"><h3>追加校本题</h3>' +
      '<label class="xk-fld">点位 <select id="b-pid">' + Object.keys(api.POINTS).map(function (pid) {
        var p = api.POINTS[pid]; return '<option value="' + pid + '">' + api.esc(p.ancient) + '（' + api.esc(api.chOf(p.ch).title) + '）</option>';
      }).join('') + '</select></label>' +
      '<label class="xk-fld">题型 <select id="b-type"><option value="choice">选择题</option><option value="blank">填空题</option><option value="material">材料简答</option></select></label>' +
      '<label class="xk-fld">题干 <textarea id="b-q" rows="2"></textarea></label>' +
      '<div id="b-extra"></div>' +
      '<button class="xk-btn primary" id="b-add">保存校本题</button></section>' +
      '<section class="xk-card"><h3>校本题清单</h3>';
    var any = false;
    Object.keys(tdb.customQ || {}).forEach(function (pid) {
      (tdb.customQ[pid] || []).forEach(function (q, qi) {
        any = true;
        html += '<div class="xk-wrongrow"><div><b>' + api.esc(api.POINTS[pid].ancient) + '</b> <span class="xk-wq">' + api.esc(q.q.slice(0, 40)) + '…</span></div>' +
          '<button class="xk-btn small" data-rm="' + pid + '|' + qi + '">删除</button></div>';
      });
    });
    if (!any) html += '<p class="xk-empty">暂无校本题。</p>';
    html += '</section>' +
      '<section class="xk-card"><h3>内置题库总览（只读）</h3>' +
      api.CHAPTERS.map(function (c) {
        return '<details><summary>' + api.esc(c.title) + '</summary><table class="xk-table"><tr><th>点位</th><th>题</th><th>考点关键词</th></tr>' +
          api.pointsOf(c.id).map(function (p) {
            return api.questionsOf(p.id).filter(function (q) { return !q.custom; }).map(function (q) {
              return '<tr><td>' + api.esc(p.ancient) + '</td><td>' + api.esc(q.q.slice(0, 26)) + '…</td><td>' + api.esc((q.keywords || []).slice(0, 3).join('、') || (q.type === 'choice' ? 'ABCD' : '概念')) + '</td></tr>';
            }).join('');
          }).join('') + '</table></details>';
      }).join('') + '</section>';
    root.innerHTML = html;

    function extraFields() {
      var t = $('#b-type', root).value, box = $('#b-extra', root);
      if (t === 'choice') box.innerHTML = ['A', 'B', 'C', 'D'].map(function (l) { return '<label class="xk-fld">选项' + l + ' <input id="b-o' + l + '"></label>'; }).join('') + '<label class="xk-fld">正确项 <select id="b-ans"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select></label>';
      else if (t === 'blank') box.innerHTML = '<label class="xk-fld">答案（可用 / 分隔多个可接受答案） <input id="b-ans"></label>';
      else box.innerHTML = '<label class="xk-fld">参考答案要点 <textarea id="b-ref" rows="2"></textarea></label><label class="xk-fld">评分关键词（顿号分隔） <input id="b-kw"></label>';
    }
    $('#b-type', root).onchange = extraFields; extraFields();
    $('#b-add', root).onclick = function () {
      var pid = $('#b-pid', root).value, t = $('#b-type', root).value, q = $('#b-q', root).value.trim();
      if (!q) return api.toast('题干不能为空');
      var item = { type: t, q: q, custom: true, author: '校本' };
      if (t === 'choice') {
        var os = ['A', 'B', 'C', 'D'].map(function (l) { return $('#b-o' + l, root).value.trim(); });
        if (os.some(function (o) { return !o; })) return api.toast('四个选项都要填');
        item.options = os; item.answer = parseInt($('#b-ans', root).value, 10);
      } else if (t === 'blank') {
        var parts = $('#b-ans', root).value.split('/').map(function (s) { return s.trim(); }).filter(Boolean);
        if (!parts.length) return api.toast('填空题需要答案');
        item.answer = parts[0]; item.accepts = parts;
      } else {
        item.ref = $('#b-ref', root).value.trim() || '参考答案见讲评';
        item.keywords = ($('#b-kw', root).value || '').split(/[、,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
      }
      if (!tdb.customQ[pid]) tdb.customQ[pid] = [];
      tdb.customQ[pid].push(item); tdb.save(); api.toast('校本题已保存'); pageBank(root);
    };
    $$('button[data-rm]', root).forEach(function (b) {
      b.onclick = function () {
        var pr = b.getAttribute('data-rm').split('|');
        tdb.customQ[pr[0]].splice(parseInt(pr[1], 10), 1); tdb.save(); pageBank(root);
      };
    });
  }

  // ---------- 页面：优秀作业展示 ----------
  function pageShowcase(root) {
    var tdb = window.TDB, api = A(), db = api.DB;
    var entries = [];
    Object.keys(db.users).forEach(function (u) {
      Object.keys(db.users[u].recs.points).forEach(function (pid) {
        var q = db.users[u].recs.points[pid].quiz;
        if (!q || !q.done) return;
        var items = api.questionsOf(pid);
        (q.items || []).forEach(function (it, i) {
          if (items[i] && items[i].type === 'material' && it.given && (it.given.text || '').trim().length >= 6) {
            var p = api.POINTS[pid];
            entries.push({ key: u + '|' + pid + '|' + i, user: u, pid: pid, text: it.given.text, score: it.score, point: p ? p.ancient : pid, best: !!tdb.excellent[u + '|' + pid + '|' + i] });
          }
        });
      });
    });
    entries.sort(function (a, b) { return (b.best - a.best) || (b.score - a.score); });
    var html = '<h2 class="xk-pgtitle">优秀作业展示</h2>' +
      '<p class="xk-dim">采集本机各学生档案的材料简答题作答；标记「优秀」即上墙展示。' + (entries.length ? '' : '（暂无简答作答记录——先在学生端答几道简答题）') + '</p>' +
      '<section class="xk-showgrid">' + entries.slice(0, 20).map(function (e) {
        return '<div class="xk-showcard' + (e.best ? ' best' : '') + '"><h4>' + api.esc(e.point) + ' · ' + api.esc(e.user) + ' <i>' + e.score + ' 分' + (e.best ? ' · ⭐优秀' : '') + '</i></h4>' +
          '<p>' + api.esc(e.text) + '</p>' +
          '<button class="xk-btn small" data-best="' + api.esc(e.key) + '">' + (e.best ? '取消优秀' : '标记优秀') + '</button></div>';
      }).join('') + '</section>';
    root.innerHTML = html;
    $$('button[data-best]', root).forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-best');
        if (tdb.excellent[k]) delete tdb.excellent[k]; else tdb.excellent[k] = Date.now();
        tdb.save(); pageShowcase(root);
      };
    });
  }

  function render(root, page) {
    try {
      if (page === 'tasks') pageTasks(root);
      else if (page === 'bank') pageBank(root);
      else if (page === 'showcase') pageShowcase(root);
      else pageDashboard(root);
    } catch (e) { root.innerHTML = '<p class="xk-empty">教师端渲染出错：' + apiEsc(e.message) + '</p>'; }
    var tabs = '<nav class="xk-ttabs">' + [['dashboard', '学情看板'], ['tasks', '任务管理'], ['bank', '题库管理'], ['showcase', '优秀作业']].map(function (t) {
      return '<a href="#/teacher/' + t[0] + '"' + (t[0] === page || (!['tasks', 'bank', 'showcase'].some(function (x) { return x === page; }) && t[0] === 'dashboard') ? ' class="on"' : '') + '>' + t[1] + '</a>';
    }).join('') + '</nav>';
    root.insertAdjacentHTML('afterbegin', tabs);
  }
  function apiEsc(s) { try { return window.AppApi.esc(s); } catch (e) { return String(s); } }

  return { render: render, demoClass: demoClass, realStudents: realStudents };
})();
