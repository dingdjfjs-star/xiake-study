// ============================================================
// 霞客行 · 手绘风地貌插画引擎（离线 SVG，手册"AI插画"的本地实现）
// 每类地貌一张剖面示意图：墨线勾勒 + 宣纸底 + 朱砂标注，
// 标注即教学要点（关键地理要素名称）。纯函数、确定性、无 DOM 依赖。
// 用法：XK_paint(landform, seed) -> {svg, labels:[标注文字]}
// ============================================================
window.XK_paint = (function () {
  var INK = '#2b2620', PAPER = '#f4ecd9', CINNABAR = '#a63a2e', FAINT = '#8a7f6a';
  var SEED_COLORS = { '花岗岩峰林': '#c8a06a', '喀斯特岩溶': '#9db4bb', '丹霞地貌': '#d99a86', '火山地貌': '#b8a898', '流水地貌': '#9ec3d8', '湖泊湿地': '#a8cbbf', '山地峡谷': '#b3a4c4' };

  function rng(seed) { // mulberry32
    var t = seed >>> 0;
    return function () { t += 0x6D2B79F5; var r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // —— 基础元件（手绘感：轻微抖动的折线代替直线） ——
  function jag(r, x1, y1, x2, y2, seg, amp) {
    var d = 'M' + x1.toFixed(1) + ',' + y1.toFixed(1);
    for (var i = 1; i <= seg; i++) {
      var t = i / seg, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t + (i < seg ? (r() - 0.5) * amp : 0);
      d += ' L' + x.toFixed(1) + ',' + y.toFixed(1);
    }
    return d;
  }
  function label(r, x, y, text, anchor, color) {
    var lx = x + (anchor === 'end' ? -8 : 8), ly = y - 6;
    return '<text x="' + x + '" y="' + y + '" font-size="9.5" fill="' + (color || CINNABAR) + '" text-anchor="' + (anchor || 'start') + '" font-family="Kaiti,STKaiti,serif">' + text + '</text>' +
      '<line x1="' + x + '" y1="' + (y - 3) + '" x2="' + lx + '" y2="' + ly + '" stroke="' + (color || CINNABAR) + '" stroke-width="0.7"/>';
  }
  function wrap(r, inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220" class="xk-illust">' +
      '<rect width="320" height="220" fill="' + PAPER + '"/>' + inner +
      '<rect x="6" y="6" width="308" height="208" fill="none" stroke="' + INK + '" stroke-width="1" opacity="0.55"/>' +
      '<rect x="9" y="9" width="302" height="202" fill="none" stroke="' + INK + '" stroke-width="0.4" opacity="0.35"/></svg>';
  }
  function hatches(r, x1, y1, x2, y2, gap) { // 岩体晕线
    var s = '';
    for (var x = x1; x < x2; x += gap) s += '<line x1="' + x + '" y1="' + y1 + '" x2="' + (x - 8) + '" y2="' + y2 + '" stroke="' + INK + '" stroke-width="0.5" opacity="0.4"/>';
    return s;
  }

  var SCENES = {
    // 花岗岩峰林：三组节理切割岩体 → 峰柱，峰顶孤松
    '花岗岩峰林': function (r) {
      var s = '';
      s += '<path d="' + jag(r, 20, 195, 70, 60, 6, 4) + ' L70,195 Z" fill="' + SEED_COLORS['花岗岩峰林'] + '" opacity="0.5"/>';
      s += '<path d="' + jag(r, 20, 195, 70, 60, 6, 4) + '" fill="none" stroke="' + INK + '" stroke-width="1.4"/>';
      s += '<path d="' + jag(r, 120, 195, 140, 25, 7, 4) + ' L160,30 L172,195 Z" fill="' + SEED_COLORS['花岗岩峰林'] + '" opacity="0.5"/>';
      s += '<path d="' + jag(r, 120, 195, 140, 25, 7, 4) + '" fill="none" stroke="' + INK + '" stroke-width="1.4"/>';
      s += '<path d="' + jag(r, 250, 195, 262, 55, 6, 4) + ' L295,195 Z" fill="' + SEED_COLORS['花岗岩峰林'] + '" opacity="0.5"/>';
      s += '<path d="' + jag(r, 250, 195, 262, 55, 6, 4) + '" fill="none" stroke="' + INK + '" stroke-width="1.4"/>';
      s += hatches(r, 26, 100, 68, 195, 9);
      s += hatches(r, 126, 60, 168, 195, 9);
      s += '<path d="' + jag(r, 20, 195, 300, 195, 10, 3) + '" fill="none" stroke="' + INK + '" stroke-width="1.6"/>';
      s += '<line x1="150" y1="60" x2="158" y2="120" stroke="' + INK + '" stroke-width="0.8" stroke-dasharray="3 2"/>';
      s += '<line x1="140" y1="80" x2="168" y2="150" stroke="' + INK + '" stroke-width="0.8" stroke-dasharray="3 2"/>';
      s += '<path d="M152,52 q3,-9 8,-2 q7,-8 9,1 q8,-2 3,6 l-2,3 -9,-2 -8,1 z" fill="#4f6b4a"/>';
      s += '<line x1="152" y1="58" x2="148" y2="66" stroke="#4f6b4a" stroke-width="1.2"/>';
      s += label(r, 165, 45, '孤峰（节理切割残留）', 'start');
      s += label(r, 148, 128, '垂直节理', 'start');
      s += label(r, 70, 90, '球状风化', 'start');
      s += label(r, 250, 70, '崩塌块石', 'start');
      return { svg: wrap(r, s), labels: ['垂直节理', '球状风化', '孤峰', '崩塌块石'] };
    },
    // 喀斯特：地上峰丛 + 地下溶洞（钟乳/石笋/地下河）
    '喀斯特岩溶': function (r) {
      var s = '';
      s += '<path d="' + jag(r, 30, 120, 80, 60, 5, 4) + ' L120,120 Z" fill="' + SEED_COLORS['喀斯特岩溶'] + '" opacity="0.45"/>';
      s += '<path d="' + jag(r, 30, 120, 80, 60, 5, 4) + '" fill="none" stroke="' + INK + '" stroke-width="1.3"/>';
      s += '<path d="' + jag(r, 200, 120, 250, 50, 5, 4) + ' L300,120 Z" fill="' + SEED_COLORS['喀斯特岩溶'] + '" opacity="0.45"/>';
      s += '<path d="' + jag(r, 200, 120, 250, 50, 5, 4) + '" fill="none" stroke="' + INK + '" stroke-width="1.3"/>';
      s += '<path d="' + jag(r, 20, 120, 300, 120, 12, 2) + '" fill="none" stroke="' + INK + '" stroke-width="1.5"/>';
      s += '<path d="M110,120 L110,168 Q160,196 214,168 L214,120" fill="none" stroke="' + INK + '" stroke-width="1.2"/>';
      s += '<path d="' + jag(r, 110, 168, 214, 168, 8, 3) + '" fill="none" stroke="' + INK + '" stroke-width="0.8"/>';
      s += '<path d="M126,126 q3,12 0,20 q6,8 4,-6 q3,10 6,14 q4,-8 2,-14" fill="none" stroke="' + INK + '" stroke-width="1"/>';
      s += '<path d="M176,166 q4,-14 -2,-22 q8,2 6,10 q6,-8 8,4 l-2,8 z" fill="' + INK + '" opacity="0.75"/>';
      s += '<path d="M120,196 q20,6 46,4 q30,-2 44,-6" fill="none" stroke="#2e6e8e" stroke-width="2" stroke-dasharray="6 3"/>';
      s += label(r, 132, 148, '石钟乳', 'start');
      s += label(r, 192, 152, '石笋', 'start');
      s += label(r, 168, 196, '地下河', 'start');
      s += label(r, 80, 66, '峰丛（地上）', 'start');
      s += label(r, 262, 56, '孤峰', 'start');
      s += label(r, 112, 112, '落水洞', 'start');
      return { svg: wrap(r, s), labels: ['石钟乳', '石笋', '地下河', '峰丛', '落水洞'] };
    },
    // 丹霞：水平红层 + 垂直节理 + 方山/石柱 + 溪流
    '丹霞地貌': function (r) {
      var s = '';
      for (var i = 0; i < 5; i++) {
        var y = 150 - i * 22;
        s += '<path d="' + jag(r, 40, y, 240, y, 9, 2) + '" fill="none" stroke="' + INK + '" stroke-width="0.7" opacity="0.75"/>';
        s += '<rect x="40" y="' + y + '" width="200" height="22" fill="' + SEED_COLORS['丹霞地貌'] + '" opacity="' + (0.12 + i * 0.07) + '"/>';
      }
      s += '<path d="' + jag(r, 40, 150, 40, 62, 5, 2) + '" fill="none" stroke="' + INK + '" stroke-width="1.5"/>';
      s += '<path d="' + jag(r, 130, 150, 130, 62, 5, 2) + '" fill="none" stroke="' + INK + '" stroke-width="1.1" stroke-dasharray="4 3"/>';
      s += '<path d="' + jag(r, 185, 150, 185, 62, 5, 2) + '" fill="none" stroke="' + INK + '" stroke-width="1.1" stroke-dasharray="4 3"/>';
      s += '<path d="' + jag(r, 240, 150, 240, 62, 5, 2) + '" fill="none" stroke="' + INK + '" stroke-width="1.5"/>';
      s += '<path d="' + jag(r, 40, 62, 240, 62, 10, 2) + '" fill="none" stroke="' + INK + '" stroke-width="1.6"/>';
      s += '<path d="' + jag(r, 262, 150, 268, 96, 4, 3) + ' L288,150 Z" fill="' + SEED_COLORS['丹霞地貌'] + '" opacity="0.4"/>';
      s += '<path d="' + jag(r, 262, 150, 268, 96, 4, 3) + '" fill="none" stroke="' + INK + '" stroke-width="1.3"/>';
      s += '<path d="' + jag(r, 20, 168, 300, 168, 12, 2) + '" fill="none" stroke="#2e6e8e" stroke-width="2"/>';
      s += '<path d="' + jag(r, 20, 174, 300, 174, 12, 2) + '" fill="none" stroke="#2e6e8e" stroke-width="0.8" opacity="0.6"/>';
      s += '<circle cx="286" cy="86" r="3" fill="' + INK + '"/><circle cx="292" cy="80" r="2" fill="' + INK + '"/>';
      s += label(r, 240, 56, '近水平砂砾岩层', 'start');
      s += label(r, 130, 76, '垂直节理', 'start');
      s += label(r, 274, 100, '石柱', 'start');
      s += label(r, 226, 168, '九曲溪流下切', 'start');
      s += label(r, 44, 110, '崖壁（崩塌后退）', 'start');
      return { svg: wrap(r, s), labels: ['砂砾岩层', '垂直节理', '石柱', '崖壁后退', '溪流下切'] };
    },
    // 火山：破火山口剖面 + 流纹岩弧形层 + 火山通道 + 岩浆房
    '火山地貌': function (r) {
      var s = '';
      // 山体剖面（顶部破火山口缺口）
      s += '<path d="M36,178 Q84,74 136,62 L150,88 L172,88 L188,62 Q240,76 286,178 Z" fill="' + SEED_COLORS['火山地貌'] + '" opacity="0.5"/>';
      s += '<path d="M36,178 Q84,74 136,62 L150,88 L172,88 L188,62 Q240,76 286,178" fill="none" stroke="' + INK + '" stroke-width="1.6"/>';
      // 流纹岩弧形层理
      for (var i = 0; i < 3; i++) {
        var q = 26 + i * 18;
        s += '<path d="M' + (58 + i * 4) + ',' + (166 - q * 0.72) + ' Q118,' + (78 - q * 0.9) + ' 160,' + (96 - q * 0.55) + ' Q208,' + (82 - q * 0.85) + ' ' + (268 - i * 4) + ',' + (166 - q * 0.72) + '" fill="none" stroke="' + INK + '" stroke-width="0.7" opacity="0.6"/>';
      }
      // 火山通道与岩浆房
      s += '<path d="M150,88 L146,158 M172,88 L178,158" fill="none" stroke="' + INK + '" stroke-width="1.1" stroke-dasharray="4 3"/>';
      s += '<ellipse cx="162" cy="164" rx="44" ry="12" fill="none" stroke="' + INK + '" stroke-width="1.2"/>';
      s += '<ellipse cx="162" cy="164" rx="44" ry="12" fill="#c98a5a" opacity="0.35"/>';
      // 地面与柱状节理
      s += '<path d="' + jag(r, 20, 178, 300, 178, 12, 2) + '" fill="none" stroke="' + INK + '" stroke-width="1.5"/>';
      s += '<g opacity="0.8">' + ['96,150', '108,158', '120,164', '210,162', '224,154'].map(function (p) {
        var a = p.split(',');
        return '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + a[0] + '" y2="' + (Number(a[1]) + 13) + '" stroke="' + INK + '" stroke-width="0.8"/>';
      }).join('') + '</g>';
      s += label(r, 160, 46, '破火山口（复活隆起）', 'start');
      s += label(r, 226, 106, '流纹岩弧形层理', 'start');
      s += label(r, 96, 158, '柱状节理', 'start');
      s += label(r, 214, 168, '岩浆房', 'start');
      s += label(r, 34, 118, '火山岩台地', 'start');
      return { svg: wrap(r, s), labels: ['破火山口', '流纹岩层理', '火山通道', '岩浆房', '柱状节理'] };
    },
    // 流水：峡谷两壁 + 三级台阶瀑布 + 跌水潭 + 溯源侵蚀
    '流水地貌': function (r) {
      var s = '';
      // 两侧岩体（峡谷谷壁，晕线示岩体）
      s += '<path d="' + jag(r, 20, 30, 96, 186, 8, 3) + ' L20,186 Z" fill="' + SEED_COLORS['流水地貌'] + '" opacity="0.28"/>';
      s += '<path d="' + jag(r, 20, 30, 96, 186, 8, 3) + '" fill="none" stroke="' + INK + '" stroke-width="1.5"/>';
      s += '<path d="' + jag(r, 296, 30, 226, 186, 8, 3) + ' L296,186 Z" fill="' + SEED_COLORS['流水地貌'] + '" opacity="0.28"/>';
      s += '<path d="' + jag(r, 296, 30, 226, 186, 8, 3) + '" fill="none" stroke="' + INK + '" stroke-width="1.5"/>';
      s += hatches(r, 26, 60, 92, 186, 10);
      s += hatches(r, 232, 60, 292, 186, 10);
      // 三级台阶河床（软硬岩相间）与三级跌水
      var steps = [[96, 70, 118, 70], [118, 70, 118, 104], [118, 104, 152, 104], [152, 104, 152, 138], [152, 138, 196, 138]];
      var fall = [[110, 72, 110, 102], [144, 106, 144, 136]];
      steps.forEach(function (a) { s += '<path d="' + jag(r, a[0], a[1], a[2], a[3], 4, 1.5) + '" fill="none" stroke="' + INK + '" stroke-width="1.6"/>'; });
      fall.forEach(function (a) {
        s += '<rect x="' + (a[0] - 4) + '" y="' + a[1] + '" width="8" height="' + (a[3] - a[1]) + '" fill="#7db3cc" opacity="0.9"/>';
        s += '<line x1="' + (a[0] - 1.2) + '" y1="' + a[1] + '" x2="' + (a[0] - 1.2) + '" y2="' + a[3] + '" stroke="#eaf4f8" stroke-width="1.6"/>';
      });
      // 顶部来水与下游水面
      s += '<path d="' + jag(r, 96, 56, 226, 56, 6, 2) + '" fill="none" stroke="#2e6e8e" stroke-width="2"/>';
      s += '<path d="' + jag(r, 226, 56, 226, 70, 2, 1) + '" fill="none" stroke="#2e6e8e" stroke-width="2"/>';
      s += '<ellipse cx="176" cy="148" rx="30" ry="8" fill="#9ec3d8" opacity="0.5"/>';
      s += '<ellipse cx="176" cy="148" rx="30" ry="8" fill="none" stroke="#2e6e8e" stroke-width="1.8"/>';
      s += '<path d="' + jag(r, 196, 148, 226, 152, 4, 1) + '" fill="none" stroke="#2e6e8e" stroke-width="1.6"/>';
      // 溯源侵蚀箭头（指向河源）
      s += '<path d="M236,96 l-26,10 m0,0 l7,-1 m-7,1 l2,-7" stroke="' + CINNABAR + '" stroke-width="1.5" fill="none"/>';
      s += label(r, 238, 44, '峡谷谷壁（岩体）', 'start');
      s += label(r, 130, 62, '硬岩坎成台阶', 'start');
      s += label(r, 148, 96, '跌水', 'start');
      s += label(r, 204, 146, '跌水潭', 'start');
      s += label(r, 236, 92, '溯源侵蚀', 'start');
      s += label(r, 30, 46, '软岩凹坑', 'start');
      return { svg: wrap(r, s), labels: ['峡谷谷壁', '硬岩坎', '跌水', '跌水潭', '溯源侵蚀'] };
    },
    // 湖泊湿地：断陷湖盆 + 断层崖 + 沼泽化草海
    '湖泊湿地': function (r) {
      var s = '';
      s += '<path d="' + jag(r, 60, 30, 130, 190, 8, 3) + '" fill="none" stroke="' + CINNABAR + '" stroke-width="1.6" stroke-dasharray="7 4"/>';
      s += '<path d="M60,30 L40,30 L40,196 L130,196 L130,190" fill="' + SEED_COLORS['湖泊湿地'] + '" opacity="0.25"/>';
      s += '<path d="' + jag(r, 40, 30, 60, 30, 4, 1) + '" fill="none" stroke="' + INK + '" stroke-width="1.4"/>';
      s += '<path d="' + jag(r, 40, 30, 40, 196, 10, 2) + '" fill="none" stroke="' + INK + '" stroke-width="1.3"/>';
      s += '<path d="' + jag(r, 130, 190, 300, 130, 10, 3) + '" fill="none" stroke="' + INK + '" stroke-width="1.4"/>';
      s += '<path d="' + jag(r, 130, 196, 300, 196, 12, 2) + '" fill="none" stroke="' + INK + '" stroke-width="1.4"/>';
      s += '<path d="' + jag(r, 300, 130, 300, 196, 5, 2) + '" fill="none" stroke="' + INK + '" stroke-width="1.4"/>';
      s += '<path d="M130,190 Q200,168 300,150 L300,196 L130,196 Z" fill="' + SEED_COLORS['湖泊湿地'] + '" opacity="0.4"/>';
      s += '<path d="' + jag(r, 214, 174, 262, 168, 8, 2) + '" fill="none" stroke="#3a7d6c" stroke-width="1.2" stroke-dasharray="4 3"/>';
      s += ['196,176', '206,170', '222,166', '238,164'].map(function (p) { var a = p.split(','); return '<path d="M' + a[0] + ',' + a[1] + ' q2,-8 4,0 m-4,0 q4,-6 6,0" fill="none" stroke="#3a7d6c" stroke-width="0.9"/>'; }).join('');
      s += label(r, 118, 40, '断层线', 'start', CINNABAR);
      s += label(r, 46, 116, '抬升盘（断块山）', 'start');
      s += label(r, 206, 140, '断陷湖盆', 'start');
      s += label(r, 232, 196, '沼泽化浅滩', 'start');
      s += label(r, 262, 128, '湖面', 'start');
      return { svg: wrap(r, s), labels: ['断层线', '断块山', '断陷湖盆', '沼泽化'] };
    },
    // 山地峡谷：主谷 V 形 + 支谷悬谷 + 断块山体
    '山地峡谷': function (r) {
      var s = '';
      s += '<path d="' + jag(r, 30, 40, 130, 186, 9, 3) + '" fill="none" stroke="' + INK + '" stroke-width="1.6"/>';
      s += '<path d="' + jag(r, 290, 40, 190, 186, 9, 3) + '" fill="none" stroke="' + INK + '" stroke-width="1.6"/>';
      s += hatches(r, 36, 80, 126, 182, 10);
      s += hatches(r, 196, 80, 286, 182, 10);
      s += '<path d="M160,96 l-6,88 m6,-88 l6,88" fill="none" stroke="#2e6e8e" stroke-width="2.4"/>';
      s += '<path d="' + jag(r, 60, 96, 152, 112, 6, 3) + '" fill="none" stroke="' + INK + '" stroke-width="1"/>';
      s += '<path d="M150,112 L152,150" stroke="#2e6e8e" stroke-width="2" fill="none"/>';
      s += label(r, 160, 44, '断块山（整体抬升）', 'start');
      s += label(r, 84, 108, '支谷', 'start');
      s += label(r, 168, 132, '主谷（下切更快）', 'start');
      s += label(r, 158, 110, '悬谷口', 'start', CINNABAR);
      s += label(r, 60, 60, 'V 形谷', 'start');
      return { svg: wrap(r, s), labels: ['V形谷', '断块山', '悬谷', '主谷下切'] };
    }
  };

  return function (landform, seed) {
    var f = SCENES[landform];
    if (!f) return null;
    var r = rng(hash(landform) ^ (seed >>> 0 || 1));
    var out = f(r);
    out.landform = landform;
    return out;
  };
})();
