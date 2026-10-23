/* 初期データ（data/bundle.js の window.SEED）と、利用者の変更（localStorage）を分けて持つ。
   画面には両者を合わせた結果だけを渡す。 */
(function () {
  'use strict';

  var KEY = 'kyoto-wg-notes/v1';
  var COLLECTIONS = ['sources', 'claims', 'cases', 'issues', 'stakeholders', 'matrix',
    'proposals', 'pilots', 'questions', 'unknowns'];

  function emptyLayer() {
    var l = { format: 'kyoto-wg-user-layer', version: 1, overrides: {}, added: {}, deleted: {}, notes: {} };
    COLLECTIONS.forEach(function (c) { l.overrides[c] = {}; l.added[c] = []; l.deleted[c] = []; });
    return l;
  }

  function normalize(layer) {
    var base = emptyLayer();
    if (!layer || typeof layer !== 'object') return base;
    ['overrides', 'added', 'deleted'].forEach(function (k) {
      COLLECTIONS.forEach(function (c) {
        var v = layer[k] && layer[k][c];
        if (k === 'overrides') base[k][c] = (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
        else base[k][c] = Array.isArray(v) ? v : [];
      });
    });
    base.notes = (layer.notes && typeof layer.notes === 'object') ? layer.notes : {};
    base.savedAt = layer.savedAt;
    return base;
  }

  var storageOk = true;
  function readStorage() {
    try { var raw = window.localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { storageOk = false; return null; }
  }

  var layer = normalize(readStorage());
  var cache = null;
  var listeners = [];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function merged() {
    if (cache) return cache;
    var seed = window.SEED || {};
    var out = { meta: seed.meta || {}, dims: seed.dims || [], hypotheses: seed.hypotheses || [], gaps: seed.gaps || [], docs: seed.docs || [], ideas: seed.ideas || { ideas: [] } };
    COLLECTIONS.forEach(function (c) {
      var del = layer.deleted[c];
      var ov = layer.overrides[c];
      var arr = (seed[c] || []).filter(function (x) { return del.indexOf(x.id) < 0; }).map(function (x) {
        var item = clone(x);
        if (ov[x.id]) Object.keys(ov[x.id]).forEach(function (f) { item[f] = ov[x.id][f]; });
        item._edited = !!ov[x.id];
        return item;
      });
      layer.added[c].forEach(function (x) { var i = clone(x); i._added = true; arr.push(i); });
      out[c] = arr;
    });
    out.index = {};
    COLLECTIONS.forEach(function (c) {
      out.index[c] = {};
      out[c].forEach(function (x) { out.index[c][x.id] = x; });
    });
    cache = out;
    return out;
  }

  function persist() {
    layer.savedAt = new Date().toISOString();
    cache = null;
    try { window.localStorage.setItem(KEY, JSON.stringify(layer)); storageOk = true; }
    catch (e) { storageOk = false; }
    listeners.forEach(function (fn) { fn(); });
  }

  function isAdded(c, id) { return layer.added[c].some(function (x) { return x.id === id; }); }

  var Store = {
    COLLECTIONS: COLLECTIONS,
    data: merged,
    storageOk: function () { return storageOk; },
    savedAt: function () { return layer.savedAt; },
    onChange: function (fn) { listeners.push(fn); },
    setField: function (c, id, field, value) {
      if (isAdded(c, id)) {
        layer.added[c].forEach(function (x) { if (x.id === id) x[field] = value; });
      } else {
        layer.overrides[c][id] = layer.overrides[c][id] || {};
        layer.overrides[c][id][field] = value;
      }
      persist();
    },
    resetItem: function (c, id) { delete layer.overrides[c][id]; persist(); },
    add: function (c, item) {
      layer.added[c].push(item);
      persist();
      return item;
    },
    remove: function (c, id) {
      if (isAdded(c, id)) layer.added[c] = layer.added[c].filter(function (x) { return x.id !== id; });
      else if (layer.deleted[c].indexOf(id) < 0) layer.deleted[c].push(id);
      persist();
    },
    nextId: function (c, prefix) {
      var d = merged(), n = 1;
      while (d.index[c][prefix + n]) n++;
      return prefix + n;
    },
    getNote: function (key) { return layer.notes[key] || ''; },
    setNote: function (key, text) { layer.notes[key] = text; persist(); },
    exportLayer: function () {
      return {
        format: 'kyoto-wg-export', version: 1, exportedAt: new Date().toISOString(),
        seedVersion: (window.SEED && window.SEED.meta && window.SEED.meta.version) || null,
        userLayer: clone(layer)
      };
    },
    exportFull: function () {
      var d = merged(), out = { format: 'kyoto-wg-full', exportedAt: new Date().toISOString(), meta: d.meta };
      COLLECTIONS.forEach(function (c) { out[c] = d[c]; });
      return out;
    },
    importLayer: function (obj) {
      if (!obj || typeof obj !== 'object') throw new Error('JSON の形式が違います');
      var l = obj.format === 'kyoto-wg-export' ? obj.userLayer
        : obj.format === 'kyoto-wg-user-layer' ? obj : null;
      if (!l) throw new Error('このアプリで保存した JSON ではありません（format が不明）');
      layer = normalize(l);
      persist();
      return { seedVersion: obj.seedVersion };
    },
    clearAll: function () { layer = emptyLayer(); persist(); },
    stats: function () {
      var n = 0;
      COLLECTIONS.forEach(function (c) { n += Object.keys(layer.overrides[c]).length + layer.added[c].length + layer.deleted[c].length; });
      return { changes: n, notes: Object.keys(layer.notes).filter(function (k) { return layer.notes[k]; }).length };
    }
  };

  window.Store = Store;
})();
