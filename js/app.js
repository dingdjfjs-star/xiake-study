// ============================================================
// 霞客行 · 主应用（hash 路由 / 学生端五页 / 打卡-答题-图鉴-成就闭环）
// 数据持久化：localStorage（按学生姓名分档案）；无框架无构建
// 页面对应手册学生端：研学首页 / 篇章路线页 / 点位详情页 / 智能答题页 / 图鉴成就页
// ============================================================
(function () {
  'use strict';

  // ---------- 常量与状态 ----------
  var DB_KEY = 'xiake_v1';
  var CHAPTERS = window.XK_CHAPTERS, POINTS = window.XK_POINTS, QUES = window.XK_QUESTIONS, LF = window.XK_LANDFORMS;

  function freshUser() { return { recs: { points: {}, wrongBook: {}, ach: {}, read: {}, asked: {}, about: 0 } }; }
  function loadDB() { try { return JSON.parse(localStorage.getItem(DB_KEY)) || null; } catch (e) { return null; } }
  var DB = loadDB() || { v: 1, current: '', users: {} };
  if (!DB.current) DB.current = '徐小霞';
  function cur() { if (!DB.users[DB.current]) DB.users[DB.current] = freshUser(); return DB.users[DB.current]; }
  function recs() {
    var r = cur().recs;
    if (!r.points) r.points = {};
    if (!r.wrongBook) r.wrongBook = {};
    if (!r.ach) r.ach = {};
    if (!r.read) r.read = {};
    if (!r.asked) r.asked = {};
    if (!('about' in r)) r.about = 0;
    return r;
  }
  function save() { try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch (e) { toast('保存失败：' + e.message); } }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }
  function hash32(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function chOf(id) { return CHAPTERS.filter(function (c) { return c.id === id; })[0]; }
  function pointsOf(chId) {
    return Object.keys(POINTS).map(function (k) { return POINTS[k]; })
      .filter(function (p) { return p.ch === chId; }).sort(function (a, b) { return a.seq - b.seq; });
  }
  function pointById(pid) { return POINTS[pid]; }
  function customs(pid) { var t = window.TDB; return (t && t.customQ && t.customQ[pid]) || []; }
  function questionsOf(pid) { return (QUES[pid] || []).concat(customs(pid)); }

  // ---------- 提示浮层 ----------
  function toast(msg, long) {
    var box = $('#xk-toasts');
    if (!box) { box = document.createElement('div'); box.id = 'xk-toasts'; document.body.appendChild(box); }
    var t = document.createElement('div'); t.className = 'xk-toast'; t.textContent = msg;
    box.appendChild(t);
    setTimeout(function () { t.className += ' out'; }, long ? 5200 : 3200);
    setTimeout(function () { t.remove(); }, long ? 5800 : 3800);
  }

  // ---------- 成就检查 ----------
  function recheckAch() {
    var stats = window.XK_stats(recs(), CHAPTERS);
    var now = window.XK_judge(stats);
    var fresh = now.filter(function (id) { return !recs().ach[id]; });
    fresh.forEach(function (id) { recs().ach[id] = Date.now(); });
    if (fresh.length) save();
    fresh.forEach(function (id) {
      var a = window.XK_ACHIEVEMENTS.filter(function (x) { return x.id === id; })[0];
      if (a) toast('🏆 解锁成就「' + a.name + '」— ' + a.desc, true);
    });
  }

  // ---------- 顶部导航 ----------
  function navHTML(route) {
    function on(r) { return route === r || (r === '' && (route === '' || route === 'home')) ? ' class="on"' : ''; }
    return '<header class="xk-top"><div class="xk-top-in">' +
      '<a class="xk-logo" href="#/"><span class="xk-seal">霞</span>霞客行 <i>《徐霞客游记》研学</i></a>' +
      '<nav>' +
      '<a href="#/"' + on('') + '>研学</a>' +
      '<a href="#/collection"' + on('collection') + '>图鉴</a>' +
      '<a href="#/atlas"' + on('atlas') + '>遐征全图</a>' +
      '<a href="#/about"' + on('about') + '>其人</a>' +
      '<a href="#/teacher/dashboard">教师端</a>' +
      '<a href="#/settings"' + on('settings') + '>设置</a>' +
      '</nav><span class="xk-user" title="切换身份在设置页">👤 ' + esc(DB.current) + '</span>' +
      '</div></header>';
  }

  // ---------- 页面：研学首页 ----------
  var filters = { lf: '', diff: '', kw: '' };
  function pageHome(root, route) {
    var rec = recs(), stats = window.XK_stats(rec, CHAPTERS);
    var tasks = (window.TDB && window.TDB.tasks) || [];
    var M = window.XK_META || { quotes: [] };
    var q = M.quotes.length ? M.quotes[Math.floor(Date.now() / 864e5) % M.quotes.length] : null;
    var html = '<section class="xk-hero">' +
      '<div class="xk-hero-t"><h1>霞客行</h1><p>跟着徐霞客读山河 · 古籍 × 地貌 × 打卡研学</p>' +
      '<div class="xk-hero-stats">' +
      '<span><b>' + stats.checkedCount + '</b>/25 点位</span><span><b>' + stats.chaptersDone.length + '</b>/7 篇章</span><span><b>' + stats.landformsSeen.length + '</b>/7 图鉴</span><span><b>' + (stats.readerGroups || 0) + '</b>/7 原文</span><span><b>' + Object.keys(rec.ach || {}).length + '</b>/' + window.XK_ACHIEVEMENTS.length + ' 成就</span>' +
      '</div></div><span class="xk-bigseal">霞客行</span></section>';
    if (q) html += '<section class="xk-quotecard">「' + esc(q.text) + '」<i>— ' + esc(q.src) + (q.verified ? ' · 已核底本' : '') + '</i> <a href="#/about">更多语录 →</a></section>';
    html += dailyCardHTML();

    if (tasks.length) {
      html += '<section class="xk-tasks"><h3>研学任务</h3>';
      tasks.forEach(function (t) {
        var done = stats.chaptersDone.indexOf(t.ch) >= 0;
        html += '<div class="xk-task' + (done ? ' done' : '') + '"><b>' + esc(t.cls) + '</b> · ' + esc(t.title) +
          ' <a href="#/chapter/' + t.ch + '">去完成 →</a><i>' + (done ? '已完成' : '截止 ' + esc(t.deadline || '不限')) + '</i></div>';
      });
      html += '</section>';
    }

    var visible = CHAPTERS.filter(function (c) {
      if (filters.lf && c.landforms.indexOf(filters.lf) < 0) return false;
      if (filters.diff && String(c.difficulty) !== filters.diff) return false;
      if (filters.kw) {
        var kw = filters.kw.toLowerCase();
        var hay = (c.title + c.region + c.subtitle + c.intro).toLowerCase() +
          pointsOf(c.id).map(function (p) { return p.ancient + p.modern; }).join('').toLowerCase();
        if (hay.indexOf(kw) < 0) return false;
      }
      return true;
    });

    html += '<section class="xk-filters">' +
      '<select id="f-lf"><option value="">全部地貌</option>' + Object.keys(LF).map(function (k) { return '<option' + (filters.lf === k ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select>' +
      '<select id="f-diff"><option value="">全部难度</option>' + [1, 2, 3].map(function (d) { return '<option value="' + d + '"' + (filters.diff === String(d) ? ' selected' : '') + '>' + '★'.repeat(d) + '</option>'; }).join('') + '</select>' +
      '<input id="f-kw" placeholder="搜篇章 / 地名…" value="' + esc(filters.kw) + '">' +
      '</section><section class="xk-chlist">';

    if (!visible.length) html += '<p class="xk-empty">没有符合条件的篇章。</p>';
    visible.forEach(function (c) {
      var pts = pointsOf(c.id), done = pts.filter(function (p) { return rec.points[p] && rec.points[p].checkedAt; }).length;
      var pct = pts.length ? Math.round(done / pts.length * 100) : 0;
      html += '<a class="xk-chcard" href="#/chapter/' + c.id + '">' +
        '<div class="xk-chcard-h"><h3>' + esc(c.title) + '</h3><span class="xk-stars">' + '★'.repeat(c.difficulty) + '</span></div>' +
        '<p class="xk-chmeta">' + esc(c.year) + ' · ' + esc(c.region) + ' · ' + esc(c.age) + '</p>' +
        '<p class="xk-epi">「' + esc((c.epigraph || c.subtitle).slice(0, 24)) + (c.epigraph && c.epigraph.length > 24 ? '…' : '') + '」</p>' +
        '<div class="xk-chlf">' + c.landforms.map(function (l) { return '<span style="--pc:' + (LF[l] || {}).color + '">' + esc(l) + '</span>'; }).join('') + '</div>' +
        '<div class="xk-bar"><i style="width:' + pct + '%"></i></div><span class="xk-bartxt">' + done + '/' + pts.length + ' 点位 · ' + pct + '%</span>' +
        '<span class="xk-readflag">' + (readGroup(c.id) ? '原文已读 ✓' : '含原文全文') + '</span>' +
        '</a>';
    });
    html += '</section>';
    root.innerHTML = html;
    $('#f-lf').onchange = function (e) { filters.lf = e.target.value; pageHome(root, route); };
    $('#f-diff').onchange = function (e) { filters.diff = e.target.value; pageHome(root, route); };
    $('#f-kw').oninput = function (e) { filters.kw = e.target.value.trim(); pageHome(root, route); };
    bindDaily(root);
  }

  function readGroup(chId) {
    var rec = recs(), S = window.XK_SOURCE;
    if (!S) return false;
    return S.pieces.filter(function (p) { return p.parent === chId; }).some(function (p) { return rec.read[p.id]; });
  }
  function srcChars(chId) {
    var S = window.XK_SOURCE;
    if (!S) return '?';
    return S.pieces.filter(function (p) { return p.parent === chId; }).reduce(function (n, p) { return n + p.chars; }, 0);
  }

  // ---------- 页面：原文阅读器 ----------
  var DAY_RE = /^(初[一二三四五六七八九十]+日|[正二三四五六七八九十冬]{1,2}月初[一二三四五六七八九十]+日|[一二三四五六七八九十]{1,3}日)/;
  function pageReader(root, chId, pieceId) {
    var S = window.XK_SOURCE;
    var g = S && S.groups.filter(function (x) { return x.id === chId; })[0];
    if (!g) { root.innerHTML = '<p class="xk-empty">原文分组不存在。<a href="#/">返回</a></p>'; return; }
    var pieces = S.pieces.filter(function (p) { return p.parent === chId; });
    var rec = recs();
    var active = null;
    if (pieceId) active = pieces.filter(function (p) { return p.id === pieceId; })[0];
    if (!active) {
      var unread = pieces.filter(function (p) { return !rec.read[p.id]; });
      active = unread.length ? unread[0] : pieces[0];
    }
    var html = '<section class="xk-rdhead">' +
      '<a class="xk-back" href="#/chapter/' + g.id + '">← ' + esc(g.title) + '</a>' +
      '<h2>游记原文 · ' + esc(g.title) + '</h2>' +
      '<p class="xk-dim">底本：国学梦《徐霞客游记》全文库 · 正文含原站随文夹注（如"越潦积水""即老虎"等小注嵌于原文），研读时注意分辨。</p>' +
      '<div class="xk-rdtabs">' + pieces.map(function (p) {
        return '<a href="javascript:;" data-piece="' + p.id + '" class="' + (p.id === active.id ? 'on' : '') + (rec.read[p.id] ? ' read' : '') + '">' + esc(p.title) + (rec.read[p.id] ? ' ✓' : '') + '</a>';
      }).join('') + '</div></section>' +
      '<section class="xk-reader" id="xk-reader">';
    active.paras.forEach(function (para) {
      var m = para.match(DAY_RE);
      if (m && m[0].length <= 8) html += '<h4 class="xk-day">' + esc(m[0]) + '</h4><p>' + esc(para.slice(m[0].length)) + '</p>';
      else html += '<p>' + esc(para) + '</p>';
    });
    var done = !!rec.read[active.id];
    html += '<p class="xk-rdsrc">来源：<a href="' + esc(active.url) + '" target="_blank" rel="noopener">' + esc(active.url) + '</a>（公有领域古籍）</p></section>' +
      '<section class="xk-ptfoot"><button class="xk-btn primary" id="xk-readdone"' + (done ? ' disabled' : '') + '>' + (done ? '本篇已读完 ✓' : '我读完了这一篇') + '</button>' +
      '<span class="xk-dim">本组 ' + pieces.filter(function (p) { return rec.read[p.id]; }).length + '/' + pieces.length + ' 篇已读 · 读满一组点亮「遍读群记」进度</span></section>';
    root.innerHTML = html;
    [].forEach.call(root.querySelectorAll('#xk-rdtabs a'), function (a) {
      a.onclick = function () { renderReaderInto(root, g.id, a.getAttribute('data-piece')); };
    });
    var btn = root.querySelector('#xk-readdone');
    if (btn) btn.onclick = function () {
      rec.read[active.id] = Date.now(); save(); recheckAch();
      toast('已读完「' + active.title + '」');
      renderReaderInto(root, g.id, active.id);
    };
  }
  function renderReaderInto(root, chId, pieceId) { location.hash = '#/reader/' + chId + (pieceId ? '/' + pieceId : ''); }

  // ---------- 页面：霞客其人 ----------
  function pageAbout(root) {
    var m = window.XK_META || { bio: [], timeline: [], quotes: [] };
    var rec = recs();
    if (!rec.about) { rec.about = Date.now(); save(); recheckAch(); }
    var html = '<section class="xk-hero small"><div class="xk-hero-t"><h1>霞客其人</h1><p>千古奇人 · 千古奇书</p></div><span class="xk-bigseal">霞客</span></section>';
    html += '<section class="xk-card"><h3>小传</h3>' + m.bio.map(function (p, i) {
      if (i === m.bio.length - 1 && p.indexOf('三大历史贡献') === 0) {
        var parts = p.split(/(?=[①②③])/);
        return '<p>' + esc(parts[0]) + '</p><ul class="xk-contri">' + parts.slice(1).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
      }
      return '<p class="xk-bio">' + esc(p) + '</p>';
    }).join('') + '</section>';
    html += '<section class="xk-card"><h3>行迹年表</h3><ol class="xk-timeline">' +
      m.timeline.map(function (t) {
        return '<li><b>' + esc(t.year) + '</b>' + (t.approx ? '<i class="xk-approx">约</i>' : '') + '<span>' + esc(t.event) + '</span></li>';
      }).join('') + '</ol><p class="xk-dim">标「约」者为通行系年，未经底本逐条核证；其余年份可由对应游记底本互证。</p></section>';
    html += '<section class="xk-card"><h3>霞客语录</h3><div class="xk-quotesgrid">' +
      m.quotes.map(function (q) {
        return '<div class="xk-quoteitem' + (q.verified ? ' v' : '') + '">「' + esc(q.text) + '」<i>' + esc(q.src) + (q.verified ? ' · 已核底本' : '') + '</i></div>';
      }).join('') + '</div></section>';
    html += '<section class="xk-ptfoot"><a class="xk-btn primary" href="#/">开始研学 →</a></section>';
    root.innerHTML = html;
  }

  // ---------- 页面：篇章路线页 ----------
  function pageChapter(root, chId) {
    var c = chOf(chId); if (!c) { root.innerHTML = '<p class="xk-empty">篇章不存在。<a href="#/">返回</a></p>'; return; }
    var pts = pointsOf(chId), rec = recs();
    var done = pts.filter(function (p) { return rec.points[p] && rec.points[p].checkedAt; }).length;
    var pct = Math.round(done / pts.length * 100);
    var html = '<section class="xk-chhead">' +
      '<a class="xk-back" href="#/">← 返回研学</a>' +
      '<h2>' + esc(c.title) + '</h2>' +
      '<p class="xk-chmeta">' + esc(c.year) + ' · ' + esc(c.region) + ' · ' + esc(c.age) + ' · ' + '★'.repeat(c.difficulty) + '</p>' +
      (c.epigraph ? '<blockquote class="xk-quote">「' + esc(c.epigraph) + '」<i>— ' + esc(c.epigraphSrc || '') + '</i></blockquote>' : '') +
      '<p class="xk-intro">' + esc(c.intro) + '</p>' +
      '<div class="xk-bar big"><i style="width:' + pct + '%"></i></div><span class="xk-bartxt">' + done + '/' + pts.length + '</span>' +
      '<div class="xk-row"><a class="xk-btn primary" href="#/exam/' + c.id + '">章节综合测验 →</a><a class="xk-btn" href="#/reader/' + c.id + '">读原文全文 →</a><span class="xk-dim">' + (readGroup(c.id) ? '本篇原文你已读过 ✓' : '底本全文约 ' + srcChars(c.id) + ' 字，读完可得成就') + '</span></div>' +
      '</section>' +
      '<section class="xk-chbody"><aside class="xk-ptlist"><ol>' +
      pts.map(function (p) {
        var ok = rec.points[p] && rec.points[p].checkedAt;
        return '<li class="' + (ok ? 'done' : '') + '"><a href="#/point/' + p + '">' +
          '<span class="xk-dot" style="--pc:' + (LF[p.landform] || {}).color + '"></span>' +
          '<b>' + esc(p.ancient) + '</b><i>' + esc(p.modern.split('·').pop().trim()) + '</i>' + (ok ? '<em>✓</em>' : '') + '</a></li>';
      }).join('') +
      '</ol></aside><div class="xk-mapwrap"><div id="xk-map" class="xk-map"></div></div></section>';
    root.innerHTML = html;
    var el = $('#xk-map', root);
    if (el) window.XKMap.create(el, pts, function (p) { location.hash = '#/point/' + p; });
  }

  // ---------- 页面：点位研学详情页 ----------
  function glossify(note) {
    return esc(note).replace(/【([^】]+)】/g, '<b class="xk-gloss">【$1】</b>');
  }
  function pagePoint(root, pid) {
    var p = pointById(pid); if (!p) { root.innerHTML = '<p class="xk-empty">点位不存在。<a href="#/">返回</a></p>'; return; }
    var c = chOf(p.ch), rec = recs(), r = rec.points[pid] || {};
    var ill = window.XK_paint(p.landform, hash32(pid));
    var lfColor = (LF[p.landform] || {}).color;
    var html = '<section class="xk-pthead">' +
      '<a class="xk-back" href="#/chapter/' + c.id + '">← ' + esc(c.title) + '</a>' +
      '<h2><span class="xk-seq">' + p.seq + '</span> ' + esc(p.ancient) + '<i class="xk-modern">今 · ' + esc(p.modern) + '</i></h2>' +
      '<div class="xk-chips">' +
      '<span class="xk-chip" style="--pc:' + lfColor + '">' + esc(p.landform) + '</span>' +
      '<span class="xk-chip dim">考据 ' + (p.verified ? '已核底本' : '待核（见考据说明）') + '</span>' +
      '<span class="xk-chip dim">' + p.lon.toFixed(2) + '°E ' + p.lat.toFixed(2) + '°N</span>' +
      '</div></section>';

    if (ill) html += '<section class="xk-card xk-ill"><h3>地貌示意 · 手绘风</h3>' + ill.svg +
      '<p class="xk-ill-cap">本地生成剖面示意 · 标注：' + ill.labels.map(esc).join(' / ') + '</p></section>';

    html += '<section class="xk-card"><h3>游记原文</h3><blockquote class="xk-quote big">「' + esc(p.seg) + '」</blockquote>' +
      '<p class="xk-src">出处：《徐霞客游记 · ' + esc(p.src) + '》' + (p.segSrc && p.segSrc !== p.src ? '（引文：' + esc(p.segSrc) + '）' : '') + '</p>' +
      '<p class="xk-note">' + glossify(p.note) + '</p></section>';

    html += '<section class="xk-card"><h3>白话译文</h3><p class="xk-baihua">' + esc(p.baihua) + '</p></section>';

    html += '<section class="xk-card"><h3>地理知识点</h3><ol class="xk-kn">' +
      (p.knowledge || []).map(function (k) { return '<li>' + esc(k) + '</li>'; }).join('') + '</ol></section>';

    html += '<section class="xk-card" id="ai-card"><h3>跨学科研学助教</h3>' +
      '<div class="xk-chatlog" id="ai-log"><div class="xk-msg ai">你好，我是本点位助教。可以问我关于「' + esc(p.ancient) + '」的地理成因、原文典故或古今变迁。' + (AI.isApi() ? '' : '（离线模式，接入 API 见设置页）') + '</div></div>' +
      '<div class="xk-chatrow"><input id="ai-q" placeholder="例如：这里的瀑布是怎么形成的？"><button id="ai-ask" class="xk-btn">问</button></div></section>';

    html += '<section class="xk-ptfoot">' + (r.checkedAt
      ? '<a class="xk-btn ghost" href="#/quiz/' + pid + '">已完成打卡 · 查看练习</a>'
      : '<button class="xk-btn primary" id="xk-checkin">打卡 · 学完了，开始答题</button>') +
      ' <a class="xk-btn ghost" href="#/chapter/' + c.id + '">回游线</a></section>';

    root.innerHTML = html;
    var btn = $('#xk-checkin', root);
    if (btn) btn.onclick = function () {
      if (!rec.points[pid]) rec.points[pid] = {};
      rec.points[pid].checkedAt = Date.now();
      save(); recheckAch();
      toast('已打卡「' + p.ancient + '」，进入练习');
      location.hash = '#/quiz/' + pid;
    };
    function ask() {
      var q = $('#ai-q', root).value.trim(); if (!q) return;
      $('#ai-q', root).value = '';
      var log = $('#ai-log', root);
      log.insertAdjacentHTML('beforeend', '<div class="xk-msg me">' + esc(q) + '</div><div class="xk-msg ai" id="ai-pending">思考中…</div>');
      log.scrollTop = log.scrollHeight;
      rec.asked = rec.asked || {}; rec.asked['q' + Date.now()] = 1; save(); recheckAch();
      AI.tutor(p, q).then(function (res) {
        var pend = $('#ai-pending', root); if (pend) pend.remove();
        log.insertAdjacentHTML('beforeend', '<div class="xk-msg ai">' + esc(res.text).replace(/\n/g, '<br>') + '</div>');
        log.scrollTop = log.scrollHeight;
      });
    }
    $('#ai-ask', root).onclick = ask;
    $('#ai-q', root).onkeydown = function (e) { if (e.key === 'Enter') ask(); };
  }

  // ---------- 页面：智能答题页 ----------
  function renderQuestion(item, qi, disabled, given) {
    var h = '<fieldset class="xk-q" data-qi="' + qi + '"><legend>第' + (qi + 1) + '题 · ' + ({ choice: '选择题', blank: '填空题', material: '材料简答' }[item.type] || item.type) + '</legend>';
    h += '<p class="xk-qq">' + esc(item.q) + '</p>';
    if (item.type === 'choice') {
      h += item.options.map(function (o, oi) {
        var sel = given && given.pick === oi;
        return '<label class="xk-opt' + (sel ? ' sel' : '') + '"><input type="radio" name="q' + qi + '" value="' + oi + '"' + (sel ? ' checked' : '') + (disabled ? ' disabled' : '') + '> ' + 'ABCD'[oi] + '. ' + esc(o) + '</label>';
      }).join('');
    } else if (item.type === 'blank') {
      h += '<input class="xk-blank" name="q' + qi + '" value="' + esc(given ? given.text || '' : '') + '"' + (disabled ? ' disabled' : '') + ' placeholder="填空">';
    } else {
      h += '<textarea class="xk-mat" name="q' + qi + '" rows="4"' + (disabled ? ' disabled' : '') + ' placeholder="结合材料与知识点作答…">' + esc(given ? given.text || '' : '') + '</textarea>';
    }
    return h + '</fieldset>';
  }

  function pageQuiz(root, pid) {
    var p = pointById(pid); if (!p) { root.innerHTML = '<p class="xk-empty">点位不存在。</p>'; return; }
    var items = questionsOf(pid);
    if (!items.length) { root.innerHTML = '<p class="xk-empty">本题库未配置题目。</p>'; return; }
    var rec = recs();
    var prev = rec.points[pid] && rec.points[pid].quiz;
    var html = '<section class="xk-qhead"><a class="xk-back" href="#/point/' + pid + '">← ' + esc(p.ancient) + '</a>' +
      '<h2>智能答题</h2><p>' + (AI.isApi() ? 'AI 批改（' + esc(AI.cfg().model || '') + '）' : '本地批改引擎') + ' · 共 ' + items.length + ' 题</p></section>';
    if (prev && prev.done) {
      html += '<section class="xk-review" id="xk-review">' + reviewHTML(items, prev.items) + '</section>' +
        '<section class="xk-ptfoot"><button class="xk-btn ghost" id="xk-redo">再答一次</button>' + nextBtnHTML(pid) + '</section>';
      root.innerHTML = html;
      $('#xk-redo', root).onclick = function () { delete rec.points[pid].quiz; save(); pageQuiz(root, pid); };
      bindNext(root, pid);
      return;
    }
    html += '<section id="xk-quizform">' + items.map(function (it, i) { return renderQuestion(it, i, false); }).join('') +
      '<div class="xk-ptfoot"><button class="xk-btn primary" id="xk-submit">交卷</button>' + nextBtnHTML(pid, true) + '</div></section>' +
      '<section class="xk-review" id="xk-review" hidden></section>';
    root.innerHTML = html;
    $$('#xk-quizform .xk-opt', root).forEach(function (lab) {
      lab.onchange = function () { $$('#xk-quizform .xk-opt', root).forEach(function (l) { l.classList.remove('sel'); }); lab.classList.add('sel'); };
    });
    $('#xk-submit', root).onclick = function () {
      var answers = items.map(function (it, i) {
        if (it.type === 'choice') { var r = $('input[name="q' + i + '"]:checked', root); return { pick: r ? parseInt(r.value, 10) : -1 }; }
        if (it.type === 'blank') { var b = $('input[name="q' + i + '"]', root); return { text: b ? b.value : '' }; }
        var m = $('textarea[name="q' + i + '"]', root); return { text: m ? m.value : '' };
      });
      if (answers.some(function (a, i) { return items[i].type === 'choice' ? a.pick < 0 : !(a.text || '').trim(); })) {
        if (!confirm('还有未作答的题目，确定交卷？未答题按错误计。')) return;
      }
      AI.gradeQuiz(p, items, answers.map(function (a) { return a.pick !== undefined ? a.pick : a.text; })).then(function (gr) {
        var total = 0;
        var itemsRes = gr.results.map(function (res, i) {
          total += res.score;
          return { correct: res.correct, score: res.score, comment: res.comment, given: answers[i] };
        });
        if (!rec.points[pid]) rec.points[pid] = {};
        rec.points[pid].quiz = { done: Date.now(), items: itemsRes, total: total, via: gr.via };
        // 错题入本
        gr.results.forEach(function (res, i) {
          var key = pid + '#' + i;
          if (!res.correct) {
            var wb = rec.wrongBook;
            if (wb[key] && wb[key].cleared) wb[key].cleared = false;
            if (!wb[key]) wb[key] = { pid: pid, qi: i, added: Date.now(), wrongCount: 0 };
            wb[key].wrongCount = (wb[key].wrongCount || 0) + 1;
          }
        });
        save(); recheckAch();
        var form = $('#xk-quizform', root), rev = $('#xk-review', root);
        form.hidden = true;
        rev.hidden = false; rev.innerHTML = reviewHTML(items, itemsRes) + '<p class="xk-total">总分 ' + total + ' / ' + items.length * 10 + '</p>';
        rev.scrollIntoView({ behavior: 'smooth' });
      });
    };
  }
  function nextBtnHTML(pid, hide) {
    var p = pointById(pid), pts = pointsOf(p.ch), next = null;
    for (var i = 0; i < pts.length; i++) if (pts[i] === p && pts[i + 1]) { next = pts[i + 1]; break; }
    if (!next) return ' <a class="xk-btn ghost" href="#/chapter/' + p.ch + '">本篇已尽 · 回游线</a>';
    if (hide) return '';
    return ' <a class="xk-btn primary" href="#/point/' + next + '">下一点位 · ' + esc(next.ancient) + ' →</a>';
  }
  function bindNext(root, pid) { /* 链接式跳转，无需绑定 */ }

  function reviewHTML(items, results) {
    return items.map(function (it, i) {
      var res = results[i] || {};
      var givenText = '';
      if (res.given) givenText = it.type === 'choice' ? (res.given.pick >= 0 ? 'ABCD'[res.given.pick] + '. ' + it.options[res.given.pick] : '未作答') : (res.given.text || '未作答');
      var std = it.type === 'choice' ? 'ABCD'[it.answer] + '. ' + it.options[it.answer] : (it.type === 'blank' ? it.answer : (it.ref || ''));
      return '<div class="xk-rv ' + (res.correct ? 'ok' : 'no') + '"><h4>' + (res.correct ? '✓' : '✗') + ' 第' + (i + 1) + '题 · 得 ' + (res.score || 0) + ' 分</h4>' +
        '<p class="xk-qq">' + esc(it.q) + '</p>' +
        '<p><b>你的答案：</b>' + esc(givenText) + '</p>' +
        '<p><b>' + (it.type === 'material' ? '参考要点' : '标准答案') + '：</b>' + esc(std) + '</p>' +
        '<p class="xk-explain">' + esc(res.comment || it.explain || '') + '</p></div>';
    }).join('');
  }

  // ---------- 错题重做 ----------
  function pageWrong(root, pid, qi) {
    var p = pointById(pid); var items = questionsOf(pid);
    var it = items[qi]; if (!p || !it) { root.innerHTML = '<p class="xk-empty">错题不存在。</p>'; return; }
    var rec = recs(), key = pid + '#' + qi;
    var html = '<section class="xk-qhead"><a class="xk-back" href="#/collection">← 错题本</a><h2>错题重做</h2><p>' + esc(p.ancient) + '</p></section>' +
      '<section id="xk-wrongform">' + renderQuestion(it, qi, false) + '<div class="xk-ptfoot"><button class="xk-btn primary" id="xk-wsub">提交</button></div></section>' +
      '<section id="xk-wrongrev" hidden></section>';
    root.innerHTML = html;
    $('#xk-wsub', root).onclick = function () {
      var ans;
      if (it.type === 'choice') { var r = $('input[name="q' + qi + '"]:checked', root); ans = r ? parseInt(r.value, 10) : -1; }
      else { var b = $('textarea[name="q' + qi + '"],input[name="q' + qi + '"]', root); ans = b ? b.value : ''; }
      AI.gradeQuiz(p, [it], [ans]).then(function (gr) {
        var res = gr.results[0];
        var wb = rec.wrongBook[key];
        if (res.correct && wb) { wb.cleared = true; wb.clearedAt = Date.now(); save(); recheckAch(); }
        var rev = $('#xk-wrongrev', root);
        $('#xk-wrongform', root).hidden = true;
        rev.hidden = false;
        rev.innerHTML = reviewHTML([it], [{ correct: res.correct, score: res.score, comment: res.comment, given: it.type === 'choice' ? { pick: ans } : { text: ans } }]) +
          '<div class="xk-ptfoot"><a class="xk-btn primary" href="#/collection">回错题本</a></div>';
      });
    };
  }

  // ---------- 页面：个人图鉴与成就页 ----------
  function pageCollection(root) {
    var rec = recs(), stats = window.XK_stats(rec, CHAPTERS);
    var acc = stats.answerCount ? Math.round(stats.correctCount / stats.answerCount * 100) : 0;
    var html = '<section class="xk-hero small"><div class="xk-hero-t"><h1>山河图鉴 · ' + esc(DB.current) + '</h1></div><span class="xk-bigseal">图鉴</span></section>';
    html += '<section class="xk-statrow">' +
      '<div class="xk-stat"><b>' + stats.checkedCount + '</b><i>已打卡点位</i></div>' +
      '<div class="xk-stat"><b>' + acc + '%</b><i>答题正确率</i></div>' +
      '<div class="xk-stat"><b>' + Object.keys(rec.ach || {}).length + '</b><i>成就徽章</i></div>' +
      '<div class="xk-stat"><b>' + stats.landformsSeen.length + '/7</b><i>地貌图鉴</i></div>' +
      '<div class="xk-stat"><b>' + (stats.readerGroups || 0) + '/7</b><i>原文通读</i></div></section>';

    var M = window.XK_META || { quotes: [] };
    if (M.quotes.length) {
      var q2 = M.quotes[Math.floor(Date.now() / 864e5) % M.quotes.length];
      html += '<section class="xk-quotecard">「' + esc(q2.text) + '」<i>— ' + esc(q2.src) + (q2.verified ? ' · 已核底本' : '') + '</i></section>';
    }

    html += '<h3 class="xk-sechead">地貌插画图鉴 <i>研学对应点位后点亮</i></h3><section class="xk-illgrid">';
    Object.keys(LF).forEach(function (l) {
      var open = stats.landformsSeen.indexOf(l) >= 0;
      var ill = window.XK_paint(l, hash32('coll-' + l));
      html += '<div class="xk-illcard' + (open ? ' open' : ' locked') + '">' + (ill ? ill.svg : '') +
        (open ? '' : '<div class="xk-lockmask">未点亮<br><i>打卡任一「' + esc(l) + '」点位</i></div>') +
        '<div class="xk-illname" style="--pc:' + LF[l].color + '">' + esc(l) + '</div></div>';
    });
    html += '</section>';

    html += '<h3 class="xk-sechead">成就徽章墙</h3><section class="xk-badgegrid">';
    window.XK_ACHIEVEMENTS.forEach(function (a) {
      var got = rec.ach && rec.ach[a.id];
      html += '<div class="xk-badge' + (got ? ' got' : '') + '" title="' + esc(a.desc) + '"><span class="xk-bicon">' + esc(a.icon) + '</span><b>' + esc(a.name) + '</b><i>' + esc(a.desc) + '</i></div>';
    });
    html += '</section>';

    var wb = Object.keys(rec.wrongBook || {}).map(function (k) { return rec.wrongBook[k]; }).filter(function (w) { return w && !w.cleared; });
    html += '<h3 class="xk-sechead">错题本 <i>答对自动移出 · 累计已清 ' + stats.wrongCleared + ' 题</i></h3><section class="xk-wronglist">';
    if (!wb.length) html += '<p class="xk-empty">错题本是空的，继续保持！</p>';
    wb.forEach(function (w) {
      var p = pointById(w.pid), its = questionsOf(w.pid), it = its[w.qi]; if (!p || !it) return;
      html += '<div class="xk-wrongrow"><div><b>' + esc(p.ancient) + '</b> <span class="xk-wq">' + esc(it.q.slice(0, 32)) + '…</span></div>' +
        '<a class="xk-btn small" href="#/wrong/' + w.pid + '/' + w.qi + '">重做</a></div>';
    });
    html += '</section>';
    root.innerHTML = html;
  }

  // ---------- 页面：设置 ----------
  function pageSettings(root) {
    var c = AI.cfg();
    var users = Object.keys(DB.users);
    var html = '<h2 class="xk-pgtitle">设置</h2>' +
      '<section class="xk-card"><h3>学生身份</h3><p class="xk-dim">同一浏览器多档案；教师端看板按此汇总。</p>' +
      '<div class="xk-row"><input id="s-name" value="' + esc(DB.current) + '"><button class="xk-btn" id="s-save">切换 / 新建</button></div>' +
      '<div class="xk-userlist">' + users.map(function (u) { return '<a href="javascript:;" data-u="' + esc(u) + '" class="xk-chip dim' + (u === DB.current ? ' on' : '') + '">' + esc(u) + '</a>'; }).join('') + '</div></section>' +

      '<section class="xk-card"><h3>AI 助教 / 批改</h3><p class="xk-dim">默认离线引擎（零积分、可测、离线可用）；填入密钥即可切换真实大模型（OpenAI 兼容协议，智谱 GLM 默认）。</p>' +
      '<label class="xk-fld">模式 <select id="s-mode"><option value="offline"' + (c.mode !== 'api' ? ' selected' : '') + '>离线引擎</option><option value="api"' + (c.mode === 'api' ? ' selected' : '') + '>真实 API</option></select></label>' +
      '<label class="xk-fld">接口地址 <input id="s-endpoint" value="' + esc(c.endpoint || 'https://open.bigmodel.cn/api/paas/v4/chat/completions') + '"></label>' +
      '<label class="xk-fld">模型 <input id="s-model" value="' + esc(c.model || 'glm-4-flash') + '"></label>' +
      '<label class="xk-fld">API Key <input id="s-key" type="password" value="' + esc(c.key || '') + '" placeholder="仅保存在本机浏览器"></label>' +
      '<div class="xk-row"><button class="xk-btn" id="s-ai">保存 AI 配置</button><button class="xk-btn ghost" id="s-test">测试连通</button></div></section>' +

      '<section class="xk-card"><h3>手册四组提示词（内置）</h3><p class="xk-dim">对应原手册「核心AI能力提示词」，可直接复制到任意 AI 平台配置。</p>' +
      ['ner', 'draw', 'tutor', 'quiz'].map(function (k) {
        var names = { ner: '① 古籍地理实体识别', draw: '② 手绘风地理插画生成', tutor: '③ 跨学科研学助教', quiz: '④ 自适应出题与批改' };
        return '<details><summary>' + names[k] + '</summary><pre class="xk-prompt">' + esc(AI.PROMPTS[k]) + '</pre><button class="xk-btn small" data-copy="' + k + '">复制</button></details>';
      }).join('') + '</section>' +

      '<section class="xk-card"><h3>数据</h3><div class="xk-row">' +
      '<button class="xk-btn" id="s-export">导出学习档案</button>' +
      '<label class="xk-btn ghost">导入<input id="s-import" type="file" accept=".json" hidden></label>' +
      '<button class="xk-btn ghost" id="s-reset">重置当前学生</button></div>' +
      '<p class="xk-dim">引文考据状态见 <a href="report/考据说明.md" target="_blank">report/考据说明.md</a></p></section>';
    root.innerHTML = html;

    $('#s-save', root).onclick = function () {
      var n = $('#s-name', root).value.trim() || '徐小霞';
      DB.current = n; save(); toast('当前身份：' + n); render();
    };
    $$('.xk-userlist .xk-chip', root).forEach(function (a) {
      a.onclick = function () { DB.current = a.getAttribute('data-u'); save(); toast('当前身份：' + DB.current); render(); };
    });
    $('#s-ai', root).onclick = function () {
      AI.setCfg({
        mode: $('#s-mode', root).value, endpoint: $('#s-endpoint', root).value.trim(),
        model: $('#s-model', root).value.trim(), key: $('#s-key', root).value.trim()
      });
      toast('AI 配置已保存（' + (AI.isApi() ? 'API 模式' : '离线模式') + '）');
    };
    $('#s-test', root).onclick = function () {
      if (!AI.isApi()) return toast('当前为离线模式，无需测试。');
      toast('测试中…');
      AI.tutor(pointById('tt01'), '测试连通').then(function (r) {
        toast(r.via === 'api' ? 'API 连通正常' : 'API 失败，已回退离线（详情见助教回复）', true);
      });
    };
    $$('button[data-copy]', root).forEach(function (b) {
      b.onclick = function () {
        var t = AI.PROMPTS[b.getAttribute('data-copy')];
        if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast('已复制'); }, function () { toast('复制失败，请手动选择'); });
        else toast('浏览器不支持一键复制');
      };
    });
    $('#s-export', root).onclick = function () {
      var blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = '霞客行档案-' + DB.current + '-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
    };
    $('#s-import', root).onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var j = JSON.parse(rd.result);
          if (!j || !j.users) throw new Error('格式不符');
          DB = j; save(); toast('导入成功'); render();
        } catch (err) { toast('导入失败：' + err.message, true); }
      };
      rd.readAsText(f, 'utf-8');
    };
    $('#s-reset', root).onclick = function () {
      if (!confirm('确定清空「' + DB.current + '」的全部学习记录？')) return;
      DB.users[DB.current] = freshUser(); save(); toast('已重置'); render();
    };
  }

  // ---------- 每日一题（夜跑 2026-11-12 新增：按日期轮换，仅选择题池，即答即判） ----------
  function dateKey() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function dailyPool() {
    var pool = [];
    Object.keys(POINTS).forEach(function (pid) {
      (QUES[pid] || []).forEach(function (q, qi) { if (q.type === 'choice') pool.push({ pid: pid, qi: qi, q: q }); });
    });
    return pool;
  }
  function dailyPick(key) { var pool = dailyPool(); return pool[hash32('daily-' + key) % pool.length]; }
  function dailyCardHTML() {
    var rec = recs(), pick = dailyPick(dateKey()), done = !!(rec.daily && rec.daily.date === dateKey());
    var q = pick.q;
    var h = '<section class="xk-card" id="xk-daily"><h3>每日一题 <i class="xk-modern">' + dateKey() + (done ? ' · 已作答' : '') + '</i></h3>' +
      '<p class="xk-qq">' + esc(q.q) + '</p>';
    if (done) {
      h += '<p class="xk-dim">今日已答' + (rec.daily.correct ? '对 ✓' : '错 ✗') + ' —— 正确答案：' + esc(q.options[q.answer]) + '<br>' + esc(q.explain || '') + '</p>';
    } else {
      h += q.options.map(function (o, oi) {
        return '<button class="xk-btn small" data-daily="' + oi + '" style="margin:4px 8px 0 0">' + 'ABCD'[oi] + '. ' + esc(o) + '</button>';
      }).join('');
    }
    h += '<p class="xk-src">出处点位：<a href="#/point/' + pick.pid + '">' + esc(pointById(pick.pid).ancient) + '</a> · 明天换新题</p></section>';
    return h;
  }
  function bindDaily(root) {
    $$('#xk-daily button[data-daily]', root).forEach(function (b) {
      b.onclick = function () {
        var pick = dailyPick(dateKey()), oi = parseInt(b.getAttribute('data-daily'), 10);
        var correct = oi === pick.q.answer;
        var rec = recs();
        rec.daily = { date: dateKey(), pid: pick.pid, qi: pick.qi, pick: oi, correct: correct };
        if (!correct) {
          var key = pick.pid + '#' + pick.qi, wb = rec.wrongBook;
          if (!wb[key]) wb[key] = { pid: pick.pid, qi: pick.qi, added: Date.now(), wrongCount: 0 };
          wb[key].wrongCount = (wb[key].wrongCount || 0) + 1;
        }
        save(); recheckAch();
        toast(correct ? '答对了！' : '不对哦 —— 正确答案：' + 'ABCD'[pick.q.answer] + '. ' + pick.q.options[pick.q.answer], true);
        render();
      };
    });
  }

  // ---------- 页面：章节综合测验（夜跑 2026-11-12 新增：跨点位混合卷，日期种子抽题可复现） ----------
  function examPool(chId) {
    var items = [];
    Object.keys(POINTS).forEach(function (k) {
      var p = POINTS[k];
      if (p.ch !== chId) return;
      (questionsOf(k) || []).forEach(function (q, qi) { items.push({ pid: k, qi: qi, q: q }); });
    });
    // 按点位 seq 排序（与游线一致），同点位内按题序
    items.sort(function (a, b) {
      var pa = POINTS[a.pid], pb = POINTS[b.pid];
      return (pa.seq - pb.seq) || (a.qi - b.qi);
    });
    return items;
  }
  function examSeedPick(chId, n, key) {
    var pool = examPool(chId), k = key || dateKey();
    var t = hash32(chId + '|' + k) >>> 0;
    function rnd() { t += 0x6D2B79F5; var r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }
    var arr = pool.slice();
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp; }
    return arr.slice(0, Math.min(n, arr.length));
  }
  function pageExam(root, chId) {
    var c = chOf(chId); if (!c) { root.innerHTML = '<p class="xk-empty">篇章不存在。<a href="#/">返回</a></p>'; return; }
    var picked = examSeedPick(chId, 10);
    if (!picked.length) { root.innerHTML = '<p class="xk-empty">本篇章暂无题目。<a href="#/chapter/' + chId + '">返回</a></p>'; return; }
    var rec = recs();
    var prev = rec.exams && rec.exams[chId];
    var html = '<section class="xk-qhead"><a class="xk-back" href="#/chapter/' + chId + '">← ' + esc(c.title) + '</a>' +
      '<h2>章节综合测验 · ' + esc(c.title) + '</h2><p>跨点位混合卷 · 按日期种子抽题（同日可复现） · 共 ' + picked.length + ' 题</p></section>';
    if (prev) html += '<section class="xk-quotecard">上次成绩：' + prev.total + ' / ' + prev.max + '（' + new Date(prev.done).toLocaleString() + '）</section>';
    html += '<section id="xk-examform">' + picked.map(function (it, i) { return renderQuestion(it.q, i, false); }).join('') +
      '<div class="xk-ptfoot"><button class="xk-btn primary" id="xk-examsub">交卷</button> <a class="xk-btn ghost" href="#/chapter/' + chId + '">先不考了</a></div></section>' +
      '<section class="xk-review" id="xk-examrev" hidden></section>';
    root.innerHTML = html;
    $$('#xk-examform .xk-opt', root).forEach(function (lab) {
      lab.onchange = function () { $$('#xk-examform .xk-opt', root).forEach(function (l) { l.classList.remove('sel'); }); lab.classList.add('sel'); };
    });
    var ctxPoint = pointById(picked[0].pid);
    $('#xk-examsub', root).onclick = function () {
      var answers = picked.map(function (it, i) {
        if (it.q.type === 'choice') { var r = $('input[name="q' + i + '"]:checked', root); return r ? parseInt(r.value, 10) : -1; }
        var f = $('input[name="q' + i + '"]', root) || $('textarea[name="q' + i + '"]', root);
        return f ? f.value : '';
      });
      if (answers.some(function (a) { return a === -1 || a === ''; })) {
        if (!confirm('还有未作答的题目，确定交卷？未答题按错误计。')) return;
      }
      AI.gradeQuiz(ctxPoint, picked.map(function (it) { return it.q; }), answers).then(function (gr) {
        var total = 0, wrong = 0;
        var results = gr.results.map(function (res, i) {
          total += res.score;
          var it = picked[i];
          if (!res.correct) {
            wrong++;
            var key = it.pid + '#' + it.qi, wb = recs().wrongBook;
            if (wb[key] && wb[key].cleared) wb[key].cleared = false;
            if (!wb[key]) wb[key] = { pid: it.pid, qi: it.qi, added: Date.now(), wrongCount: 0 };
            wb[key].wrongCount = (wb[key].wrongCount || 0) + 1;
          }
          return { correct: res.correct, score: res.score, comment: res.comment, given: it.q.type === 'choice' ? { pick: answers[i] } : { text: answers[i] } };
        });
        recs().exams = recs().exams || {};
        recs().exams[chId] = { done: Date.now(), total: total, max: picked.length * 10, count: picked.length };
        save(); recheckAch();
        var form = $('#xk-examform', root), rev = $('#xk-examrev', root);
        form.hidden = true;
        rev.hidden = false;
        rev.innerHTML = reviewHTML(picked.map(function (it) { return it.q; }), results) +
          '<p class="xk-total">章节卷总分 ' + total + ' / ' + picked.length * 10 + '（错 ' + wrong + ' 题，已入错题本）</p>';
        rev.scrollIntoView({ behavior: 'smooth' });
      });
    };
  }

  // ---------- 页面：万里遐征总路线图（夜跑 2026-11-12 新增：全域游线一张图） ----------
  function atlasPoints() {
    var arr = [];
    CHAPTERS.forEach(function (c) { pointsOf(c.id).forEach(function (p) { arr.push(p); }); });
    return arr;
  }
  function atlasKm(pts) {
    var R = 6371, r = Math.PI / 180, total = 0;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      var dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
      var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      total += 2 * R * Math.asin(Math.sqrt(s));
    }
    return Math.round(total);
  }
  function pageAtlas(root) {
    var rec = recs(), pts = atlasPoints();
    var html = '<section class="xk-chhead">' +
      '<a class="xk-back" href="#/">← 返回研学</a>' +
      '<h2>万里遐征 · 总路线图</h2>' +
      '<p class="xk-chmeta">7 篇章 · ' + pts.length + ' 点位 · 直线全程约 ' + atlasKm(pts).toLocaleString() + ' km</p>' +
      '<p class="xk-intro">按游历顺序连线成"万里遐征"。已打卡的点位在下方清单里点亮，点击地图点位或清单直达研学页；底图瓦片需联网，离线时仍可看路线与清单。</p>' +
      '</section>' +
      '<section class="xk-mapwrap"><div id="xk-atlasmap" class="xk-map"></div></section>' +
      '<section class="xk-card"><h3>游历顺序清单</h3><ol class="xk-kn">' +
      pts.map(function (p) {
        var ok = rec.points[p] && rec.points[p].checkedAt;
        return '<li>' + (ok ? '<b style="color:#3a7d5c">✓</b> ' : '') + '<b>' + esc(p.ancient) + '</b> <i class="xk-modern">· ' + esc(p.modern) + '</i>（' + esc(p.landform) + '） <a class="xk-back" href="#/point/' + p + '">研学 →</a></li>';
      }).join('') + '</ol></section>';
    root.innerHTML = html;
    var el = $('#xk-atlasmap', root);
    if (el) window.XKMap.create(el, pts, function (p) { location.hash = '#/point/' + p; });
  }

  // ---------- 路由 ----------
  function render() {
    var route = location.hash.replace(/^#\//, '');
    var root = $('#app');
    var top = $('#xk-top'); if (!top) { top = document.createElement('div'); top.id = 'xk-top'; document.body.insertBefore(top, root); }
    top.innerHTML = navHTML(route.split('/')[0] === 'teacher' ? 'teacher' : route);
    document.title = '霞客行 · 徐霞客游记研学';
    var seg = route.split('/');
    try {
      if (route === '' || seg[0] === 'home') pageHome(root, route);
      else if (seg[0] === 'chapter') pageChapter(root, seg[1]);
      else if (seg[0] === 'point') pagePoint(root, seg[1]);
      else if (seg[0] === 'quiz') pageQuiz(root, seg[1]);
      else if (seg[0] === 'wrong') pageWrong(root, seg[1], parseInt(seg[2], 10));
      else if (seg[0] === 'collection') pageCollection(root);
      else if (seg[0] === 'exam') pageExam(root, seg[1]);
      else if (seg[0] === 'atlas') pageAtlas(root);
      else if (seg[0] === 'settings') pageSettings(root);
      else if (seg[0] === 'reader') pageReader(root, seg[1], seg[2]);
      else if (seg[0] === 'about') pageAbout(root);
      else if (seg[0] === 'teacher') window.Teacher.render(root, seg[1] || 'dashboard');
      else root.innerHTML = '<p class="xk-empty">页面不存在。<a href="#/">回首页</a></p>';
    } catch (e) {
      root.innerHTML = '<p class="xk-empty">页面渲染出错：' + esc(e.message) + '<br><a href="#/">回首页</a></p>';
      if (window.console) console.error(e);
    }
    window.scrollTo(0, 0);
  }

  // ---------- 对外 API（教师端复用） ----------
  window.AppApi = {
    DB: DB, cur: cur, save: save, recs: recs, toast: toast, recheckAch: recheckAch,
    CHAPTERS: CHAPTERS, POINTS: POINTS, LF: LF,
    chOf: chOf, pointsOf: pointsOf, pointById: pointById, questionsOf: questionsOf,
    esc: esc, $: $, $$: $$, render: render, hash32: hash32,
    examPool: examPool, examSeedPick: examSeedPick, atlasPoints: atlasPoints, atlasKm: atlasKm, dailyPick: dailyPick, dateKey: dateKey
  };

  if (typeof document !== 'undefined') {
    window.addEventListener('hashchange', render);
    document.addEventListener('DOMContentLoaded', render);
    if (document.readyState !== 'loading') render();
  }
})();

// ============================================================
// 夜跑润色层（2026-11-12 值班自动化）· 地貌插画灯箱
// 纯装饰：事件委托 + 克隆节点展示，不改任何既有渲染函数与数据
// ============================================================
(function () {
  'use strict';
  function close() {
    var box = document.getElementById('xk-lightbox');
    if (box) box.classList.remove('on');
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  function ensureBox() {
    var box = document.getElementById('xk-lightbox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'xk-lightbox';
      box.innerHTML = '<div class="xk-lightbox-in"></div><p class="xk-lightbox-tip">点击任意处或按 ESC 关闭</p>';
      box.addEventListener('click', close);
      document.body.appendChild(box);
    }
    return box;
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('#xk-lightbox')) return;
    var card = t.closest('.xk-ill, .xk-illcard.open');
    if (!card) return;
    var svg = card.querySelector('.xk-illust');
    if (!svg) return;
    var box = ensureBox();
    var holder = box.querySelector('.xk-lightbox-in');
    holder.innerHTML = '';
    holder.appendChild(svg.cloneNode(true));
    box.classList.add('on');
    document.addEventListener('keydown', onKey);
  });
})();

// ============================================================
// 夜跑润色层 · 原文阅读器离线语音朗读（Web Speech API，零依赖零联网）
// 哈希变化后向 #xk-reader 注入朗读条；不改既有渲染函数与数据
// ============================================================
(function () {
  'use strict';
  var speaking = -1;
  function paras() {
    var reader = document.getElementById('xk-reader');
    if (!reader) return [];
    return [].slice.call(reader.querySelectorAll('p')).filter(function (p) {
      return p.className.indexOf('xk-rdsrc') < 0 && p.textContent.trim().length > 1;
    });
  }
  function clearHi() {
    [].slice.call(document.querySelectorAll('p.xk-tts-on')).forEach(function (p) {
      p.className = p.className.replace(' xk-tts-on', '');
    });
  }
  function stop() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    clearHi(); speaking = -1;
    var b = document.querySelector('#xk-ttsbar [data-tts="all"]');
    if (b) b.textContent = '朗读全文';
  }
  function speakFrom(list, i) {
    if (i >= list.length) { stop(); return; }
    var u = new window.SpeechSynthesisUtterance(list[i].textContent);
    u.lang = 'zh-CN'; u.rate = 0.95;
    clearHi();
    list[i].className += ' xk-tts-on';
    list[i].scrollIntoView({ block: 'center', behavior: 'smooth' });
    speaking = i;
    u.onend = function () { if (speaking === i) speakFrom(list, i + 1); };
    window.speechSynthesis.speak(u);
  }
  function inject() {
    if (typeof document === 'undefined' || !('speechSynthesis' in window)) return;
    var old = document.getElementById('xk-ttsbar');
    if (old) old.remove();
    window.speechSynthesis.cancel(); clearHi(); speaking = -1;
    var reader = document.getElementById('xk-reader');
    if (!reader) return;
    var list = paras();
    if (!list.length) return;
    var bar = document.createElement('div');
    bar.id = 'xk-ttsbar';
    bar.className = 'xk-ptfoot';
    bar.innerHTML = '<button class="xk-btn small" data-tts="all">朗读全文</button><button class="xk-btn small" data-tts="stop">停止</button><span class="xk-dim">离线朗读 · 用浏览器系统语音，各机器音色不同</span>';
    bar.querySelector('[data-tts="all"]').onclick = function () { stop(); speakFrom(paras(), 0); };
    bar.querySelector('[data-tts="stop"]').onclick = stop;
    reader.insertBefore(bar, reader.firstChild);
  }
  if (typeof document !== 'undefined' && 'speechSynthesis' in window) {
    window.addEventListener('hashchange', function () { setTimeout(inject, 30); });
    document.addEventListener('DOMContentLoaded', function () { setTimeout(inject, 30); });
    if (document.readyState !== 'loading') setTimeout(inject, 30);
  }
})();
