// ============================================================
// 霞客行 · AI 适配层（手册四组提示词 + 双模式引擎）
//  offline（默认）：离线助教检索 + 确定性批改，零积分零网络
//  api：OpenAI 兼容 /chat/completions（智谱 GLM 等），失败自动回退离线
// 设计对应手册工作流：节点2(解析)→数据已人工考据固化；节点4(插画)→paint.js；
// 节点5(助教)→tutor；节点6(批改)→grade；节点7(归档)→app.js
// ============================================================
window.AI = (function () {

  // —— 手册四组提示词（原文内置，可在设置页查看/复制） ——
  var PROMPTS = {
    ner: '你是精通中国历史地理与古典文献的专家，专门从事明代地理古籍的地名考据与现代匹配。\n请从以下《徐霞客游记》篇章原文中，提取所有地理实体并完成古今匹配，严格输出JSON格式，禁止多余文字。\n\n篇章标题：{{篇章标题}}\n原文内容：{{篇章原文}}\n\n提取与匹配要求：\n1. 提取所有山、水、洞穴、关隘、村镇、地标等地理实体，排除人名、官职、时间\n2. 每个实体包含字段：ancient_name / modern_name / longitude（4位小数）/ latitude（4位小数）/ landform_type（花岗岩峰林、喀斯特岩溶、丹霞地貌、火山地貌、流水地貌、湖泊湿地、山地峡谷之一）/ text_segment（50字以内）\n3. 按游历先后顺序排列，确保坐标准确，地貌分类符合地理科学定义\n4. 输出格式：纯JSON数组，无任何前缀后缀、解释说明',
    draw: '请生成一张中国风复古手绘地理示意图，浅色宣纸质感，墨线勾勒，淡彩晕染，风格类似明代地理志插图。\n画面主题：{{点位现代地名}}的{{地貌类型}}地貌剖面示意图\n核心要求：\n1. 准确体现该地貌的典型地质结构特征，标注关键地理要素名称\n2. 视角为侧视剖面+局部俯视结合，清晰展示地貌成因\n3. 画面简洁干净，无多余人物、建筑，突出自然地理特征\n4. 尺寸：1024×768，横向构图，适合网页展示\n5. 绝对禁止出现文字错误、地理结构错误',
    tutor: '你是「霞客行」跨学科研学助教，精通中国古典文学、明代历史、自然地理学。\n请基于以下背景知识回答学生问题，语言通俗生动，适合中学生理解，跨学科串联知识点。\n\n当前点位背景：\n- 古地名：{{古地名}}\n- 今地名：{{今地名}}\n- 地貌类型：{{地貌类型}}\n- 原文片段：{{原文片段}}\n- 核心知识点：{{地理知识点}}\n\n回答规则：\n1. 先回应问题本身，再关联徐霞客原文与历史背景，最后补充地理科学原理\n2. 每次回答控制在200字以内，分点清晰，避免长篇大论\n3. 遇到超出范围的问题，礼貌说明并引导关注当前点位的地理与文史知识\n4. 可以适当补充趣味冷知识，但必须有科学依据',
    quiz: '你是中学地理资深命题教师，请根据以下点位学习内容，生成{{难度等级}}难度的配套习题，并给出标准答案与评分标准。\n\n点位内容：\n- 地貌类型：{{地貌类型}}\n- 核心知识点：{{地理知识点}}\n- 原文背景：{{原文片段}}\n\n题目要求：\n1. 共3道题，分别为：1道选择题、1道填空题、1道材料简答题\n2. 选择题4个选项，突出易混易错点\n3. 填空题考察核心地理概念\n4. 简答题考察成因分析，结合材料作答\n5. 所有题目贴合中学生地理课标，不超纲\n\n【批改模式指令】当传入学生答案时，请对照参考答案逐题批改，给出得分、错误原因与详细讲解，最后给出总评与知识点掌握建议。'
  };

  // —— 配置（localStorage） ——
  var CFG_KEY = 'xiake_ai_v1';
  function cfg() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (e) { return {}; }
  }
  function setCfg(c) { localStorage.setItem(CFG_KEY, JSON.stringify(c || {})); }
  function isApi() { var c = cfg(); return c.mode === 'api' && !!c.key; }

  function fill(tpl, map) {
    return tpl.replace(/\{\{([^}]+)\}\}/g, function (_, k) {
      return map[k] !== undefined && map[k] !== null ? String(map[k]) : '';
    });
  }

  // —— 文本归一化（去空白/全半角/下标数字） ——
  function norm(t) {
    return String(t || '').toLowerCase()
      .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 8272); })
      .replace(/[\s，。、；：？！"'"'（）()·\-—－_]/g, '');
  }

  // —— 中文 2-gram 提取 ——
  function grams(t) {
    t = norm(t);
    var out = [];
    for (var i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
    if (t.length === 1) out.push(t);
    return out;
  }

  // —— 离线批改（确定性） ——
  function gradeOne(item, user) {
    var res = { correct: false, score: 0, comment: '' };
    if (item.type === 'choice') {
      var pick = parseInt(user, 10);
      res.correct = pick === item.answer;
      res.score = res.correct ? 10 : 0;
      res.comment = res.correct ? '答对了。' + (item.explain || '') : '再想想：正确答案是 ' + 'ABCD'[item.answer] + '。' + (item.explain || '');
    } else if (item.type === 'blank') {
      var u = norm(user), ok = u && (u === norm(item.answer) || (item.accepts || []).some(function (a) { return u === norm(a); }));
      res.correct = !!ok;
      res.score = ok ? 10 : 0;
      res.comment = ok ? '答对了。' + (item.explain || '') : '参考答案：「' + item.answer + '」。' + (item.explain || '');
    } else { // material
      var hits = (item.keywords || []).filter(function (k) { return norm(user).indexOf(norm(k)) >= 0; });
      var need = Math.max(2, Math.ceil(item.keywords.length * 0.6));
      var sc = Math.min(10, Math.round(hits.length / need * 10));
      res.correct = sc >= 8; res.score = sc;
      res.comment = '命中要点 ' + hits.length + '/' + item.keywords.length + '（满分线：' + need + ' 个）。' + (item.explain || '');
    }
    return res;
  }

  // —— 离线助教：点位知识单元检索，miss 时回落到全局知识库（XK_META.glossary） ——
  function scoreUnits(units, question) {
    var qs = grams(question);
    units.forEach(function (u) {
      var us = grams(u.t), set = {}; us.forEach(function (g) { set[g] = 1; });
      u.score = qs.reduce(function (n, g) { return n + (set[g] ? 1 : 0); }, 0);
    });
    units.sort(function (a, b) { return b.score - a.score; });
    return units;
  }
  function tutorOffline(point, question, _seed) {
    var units = [];
    (point.knowledge || []).forEach(function (k, i) { units.push({ t: k, tag: '知识' + (i + 1) }); });
    if (point.baihua) units.push({ t: '白话释义：' + point.baihua, tag: '原文' });
    if (point.note) units.push({ t: '注释：' + point.note, tag: '注释' });
    scoreUnits(units, question);
    var top = units.slice(0, 2).filter(function (u) { return u.score > 0; });
    var head = '关于「' + point.ancient + '」（' + point.landform + '）：';
    var body, matched = top.length > 0;
    if (top.length) {
      body = top.map(function (u) { return '· ' + u.t; }).join('\n');
    } else if (typeof window !== 'undefined' && window.XK_META && window.XK_META.glossary) {
      var g = scoreUnits(window.XK_META.glossary.map(function (e) { return { t: e.title + '：' + e.text, keys: e.keys.join(' ') }; }), question);
      var gtop = g.slice(0, 2).filter(function (u) { return u.score > 0; });
      if (gtop.length) {
        matched = true;
        head = '这属于「霞客行」通识：';
        body = gtop.map(function (u) { return '· ' + u.t; }).join('\n');
      }
    }
    if (!body) {
      body = '这个问题我手头没有直接掌握的知识。当前点位的核心是' + (point.knowledge || [''])[0] + '\n你可以换个角度问：成因？古今对照？旅行故事？';
    }
    var tail = '（离线助教 · 数据来自本点位考据卡' + (matched && !top.length ? '与全局知识库' : '') + '）';
    return { text: head + '\n' + body + '\n' + tail, matched: matched };
  }

  // —— API 调用（OpenAI 兼容格式） ——
  function apiChat(messages) {
    var c = cfg();
    var url = c.endpoint || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.key },
      body: JSON.stringify({ model: c.model || 'glm-4-flash', messages: messages, temperature: 0.6 })
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      var t = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!t) throw new Error('空响应');
      return String(t).trim();
    });
  }

  function tutor(point, question) {
    if (isApi()) {
      var bg = {
        '古地名': point.ancient, '今地名': point.modern, '地貌类型': point.landform,
        '原文片段': point.seg, '地理知识点': (point.knowledge || []).join('；')
      };
      return apiChat([{ role: 'user', content: fill(PROMPTS.tutor, bg) + '\n\n学生提问：' + question }])
        .then(function (t) { return { text: t, matched: true, via: 'api' }; })
        .catch(function (e) {
          var off = tutorOffline(point, question);
          off.text = '（API 调用失败已回退离线：' + e.message + '）\n' + off.text;
          return off;
        });
    }
    return Promise.resolve(tutorOffline(point, question));
  }

  function gradeQuiz(point, items, userAnswers) {
    var results = items.map(function (item, i) {
      var res = gradeOne(item, userAnswers[i]);
      res.qid = item.qid || ('q' + i);
      return res;
    });
    return Promise.resolve({ results: results, via: 'offline' });
  }

  return {
    PROMPTS: PROMPTS,
    cfg: cfg, setCfg: setCfg, isApi: isApi,
    norm: norm, grams: grams,
    gradeOne: gradeOne, gradeQuiz: gradeQuiz, tutor: tutor, tutorOffline: tutorOffline
  };
})();
