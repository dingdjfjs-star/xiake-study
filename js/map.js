// ============================================================
// 霞客行 · 地图模块（Leaflet 本地化，手册节点3"地理空间路线渲染"）
// 三底图：卫星 / 地形 / 墨韵古图（CSS 滤镜做旧）；
// 按游历顺序连线，点位按地貌配色编号，点击回调给 app.js
// ============================================================
window.XKMap = (function () {
  var BASES = {
    sat: { name: '卫星', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Esri', maxZoom: 17 },
    topo: { name: '地形', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attr: 'OpenTopoMap', maxZoom: 16 },
    ink: { name: '墨韵古图', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: 'OSM', maxZoom: 18, className: 'xk-ink-tiles' }
  };
  var tileErrors = 0;

  function create(container, points, onPick) {
    if (typeof L === 'undefined') { container.innerHTML = '<div class="xk-map-miss">地图库未能加载（vendor/leaflet 缺失）</div>'; return null; }
    tileErrors = 0;
    var map = L.map(container, { center: [30.0, 115.0], zoom: 5, zoomControl: true, attributionControl: true });
    var layers = {};
    Object.keys(BASES).forEach(function (k) {
      var b = BASES[k];
      var opt = { maxZoom: b.maxZoom, attribution: b.attr };
      if (b.className) opt.className = b.className;
      layers[k] = L.tileLayer(b.url, opt);
    });
    layers['ink'].addTo(map); // 墨韵古图为默认底图

    var segCtrl = L.control({ position: 'topright' });
    segCtrl.onAdd = function () {
      var div = L.DomUtil.create('div', 'xk-base-switch');
      ['ink', 'topo', 'sat'].forEach(function (k) {
        var a = L.DomUtil.create('a', '', div);
        a.href = 'javascript:;'; a.textContent = BASES[k].name;
        a.onclick = function (e) {
          e.preventDefault();
          Object.keys(layers).forEach(function (kk) { if (kk !== k) map.removeLayer(layers[kk]); });
          layers[k].addTo(map);
          [].forEach.call(div.children, function (c) { c.className = ''; });
          a.className = 'on';
        };
        if (k === 'ink') a.className = 'on';
      });
      return div;
    };
    segCtrl.addTo(map);

    var latlngs = points.map(function (p) { return [p.lat, p.lon]; });
    var line = L.polyline(latlngs, { color: '#a63a2e', weight: 2.5, dashArray: '7 6', opacity: 0.85 }).addTo(map);
    points.forEach(function (p, i) {
      var color = (window.XK_LANDFORMS[p.landform] || {}).color || '#555';
      var html = '<div class="xk-pin" style="--pc:' + color + '"><span>' + p.seq + '</span></div>';
      L.marker([p.lat, p.lon], {
        icon: L.divIcon({ html: html, className: 'xk-pin-wrap', iconSize: [26, 26], iconAnchor: [13, 13] }),
        title: p.ancient
      }).addTo(map).on('click', function () { onPick && onPick(p); });
    });
    if (latlngs.length > 1) map.fitBounds(line.getBounds(), { padding: [36, 36] });
    else map.setView(latlngs[0] || [30, 115], 12);

    map.on('tileerror', function () {
      tileErrors++;
      if (tileErrors === 3) {
        var tip = container.parentNode.querySelector('.xk-map-tip');
        if (!tip && container.parentNode) {
          tip = document.createElement('div');
          tip.className = 'xk-map-tip';
          tip.textContent = '底图瓦片需联网；离线时路线与点位仍可正常浏览。';
          container.parentNode.appendChild(tip);
        }
      }
    });
    return map;
  }
  return { create: create };
})();
