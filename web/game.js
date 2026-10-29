// 《村莊勇者》序章試玩 — VN 引擎（Vanilla，零依賴）
// 節點 schema: {n:'bg'} {n:'n'|'s',w,t,fx} {n:'cap'} {n:'fx',v} {n:'menu',c[{t,fx,go,show_if}]} {n:'jump',to} {n:'cond',check,go,skip}
// 規格依 docs/企劃書 §5 / docs/結局設計.md（七結局路由 + 反挫折配置）
(() => {
'use strict';
const S = window.STORY, L = S.labels, E = S.ENDINGS;
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('vh_' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('vh_' + k, JSON.stringify(v)); } catch {} },
};

const state = {
  label: 'ch1', idx: 0, flags: {}, vars: { intimacy: 0, dream: 0 },
  backlog: [], seen: {}, endings: store.get('endings', {}),
  cfg: Object.assign({ speed: 3, auto: 1200, autoOn: false, skip: true, sound: true }, store.get('cfg', {})),
  started: false, rolling: false,
};

// ---------- derived conditions (結局設計.md §0) ----------
const F = () => state.flags, V = () => state.vars;
const checks = {
  hug: () => !!F().hug,
  warn: () => (V().intimacy < 60 && F().chase === false),
  true_gate: () => F().hug && V().intimacy >= 85 && (F().pet_shima || F().justice) && V().dream >= 3,
  // 結局路由
};
function computeEnding() {
  const f = F(), iv = V().intimacy;
  if (iv < 20 && !f.hug) return 'h1';
  if (f.gevan_wounded && iv < 60 && f.chase === false) return 'be1';
  if (!f.hug && iv < 40) return 'be2';
  if (f.hug && f.indirect_kiss && iv >= 85) return 'good';
  return 'normal';
}

// ---------- sound (synth blips, no assets) ----------
let AC = null;
function beep(kind) {
  if (!state.cfg.sound) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.connect(g); g.connect(AC.destination);
    const P = { click: [220, .04], choice: [440, .08], ending: [110, .5] }[kind] || [330, .05];
    o.frequency.value = P[0]; g.gain.value = .02;
    o.start(); g.gain.exponentialRampToValueAtTime(.0001, AC.currentTime + P[1]);
    o.stop(AC.currentTime + P[1] + .02);
  } catch {}
}

// ---------- backgrounds / sprites (abstract art placeholders) ----------
const BG = {
  forest:'linear-gradient(160deg,#a8c78a 0%,#4c6b3c 55%,#27401f 100%)',
  palace:'linear-gradient(200deg,#1a1a22 0%,#000 60%,#241a33 100%)',
  stonehouse:'linear-gradient(165deg,#cfe3b8 0%,#8aa06f 45%,#5c5148 100%)',
  ride:'linear-gradient(100deg,#7fa3c9 0%,#405a74 60%,#22303e 100%)',
  village_burn:'linear-gradient(150deg,#d9824a 0%,#7a3b2e 45%,#2e1b1b 100%)',
  field:'linear-gradient(170deg,#c9d98a 0%,#6c8a3c 60%,#3c4a22 100%)',
  village_ruin:'linear-gradient(170deg,#9aa0a8 0%,#5c626a 50%,#33363b 100%)',
  night1:'linear-gradient(190deg,#20242e 0%,#101319 60%,#060a12 100%)',
  flashback:'linear-gradient(140deg,#e8d8a8 0%,#a89858 45%,#4a4024 100%)',
  wild:'linear-gradient(175deg,#b8a878 0%,#7a6a40 55%,#3c3620 100%)',
  brubis:'linear-gradient(200deg,#e8c878 0%,#9a7830 40%,#4a3a18 100%)',
  class:'linear-gradient(180deg,#d8cfc0 0%,#a89a84 60%,#6c6050 100%)',
  gym:'linear-gradient(195deg,#3a4458 0%,#1e2430 60%,#0d1018 100%)',
  dorm:'linear-gradient(185deg,#2e3246 0%,#181c2a 70%,#0a0c14 100%)',
  dream_river:'linear-gradient(160deg,#9ac8e8 0%,#5c90c0 50%,#2c4c6c 100%)',
  altar:'linear-gradient(200deg,#c8b8e8 0%,#7a60a8 45%,#302048 100%)',
  gate_rain:'linear-gradient(190deg,#7888a0 0%,#4a5a74 55%,#2a3648 100%)',
  canteen:'linear-gradient(170deg,#e0b888 0%,#a87848 55%,#5c4028 100%)',
  alley:'linear-gradient(195deg,#88788a 0%,#544a5c 55%,#2c2634 100%)',
  village:'linear-gradient(165deg,#d8e8a8 0%,#90a860 50%,#506838 100%)',
  market:'linear-gradient(150deg,#f0c878 0%,#c0903c 50%,#70501c 100%)',
  storm:'linear-gradient(210deg,#2a2a40 0%,#141428 55%,#2c1a44 100%)',
  battle:'linear-gradient(200deg,#3c2a4a 0%,#1c1428 50%,#08060f 100%)',
  abyss:'linear-gradient(185deg,#0e1430 0%,#1a0e3c 45%,#050308 100%)',
};
function setBg(v) {
  const img = $('bg');
  img.style.background = BG[v] || '#111';
  img.style.transition = 'filter .2s';
}
const SP = {};   // name -> element
function spriteFx(spec) {
  if (!spec || !spec.sp) return;
  const parts = spec.sp.split(':');
  const cmd = parts[0];
  if (cmd === 'show') {
    const [, name, pos, expr] = parts;
    if (!SP[name]) {
      const d = document.createElement('div');
      d.className = 'sprite';
      d.innerHTML = '<div class="figure"><i class="hair"></i><i class="face"></i></div><span class="tag"></span>';
      SP[name] = d; $('sprites').appendChild(d);
    }
    const d = SP[name];
    d.classList.add('on');
    d.style.left = pos === 'left' ? '8%' : pos === 'center' ? '50%' : '72%';
    setExpr(d, expr || 'default');
  } else if (cmd === 'hide') {
    const d = SP[parts[1]]; if (d) d.classList.remove('on');
  } else if (cmd === 'move') {
    const d = SP.shiying; if (d) d.style.opacity = .25; setTimeout(() => { if (SP.shiying) { SP.shiying.classList.remove('on'); SP.shiying.style.opacity = 1; } }, 600);
  } else if (cmd === 'expr') {
    if (SP.shiying) setExpr(SP.shiying, parts[1]);
  }
}
function setExpr(d, expr) {
  d.dataset.expr = expr;
  const hues = { default:'#e8ecf8', surprise:'#f8e8f0', cry:'#d8e0f8', blush:'#ffe0e0', smile:'#fff4f8' };
  d.style.setProperty('--hair', hues[expr] || hues.default);
  d.querySelector('.tag').textContent = { default:'無表情', surprise:'訝', cry:'淚', blush:'紅暈', smile:'笑' }[expr] || '';
}
function fxPlay(v) {
  if (v === 'shake') { $('stage').classList.add('shake'); setTimeout(() => $('stage').classList.remove('shake'), 450); }
  if (v === 'flash') { const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
}

// ---------- typewriter ----------
let typing = null;
function typeText(el, txt, cb) {
  clearInterval(typing);
  const perTick = [0, 1, 2, 3, 5, 99][state.cfg.speed] || 2;
  let i = 0; el.textContent = '';
  typing = setInterval(() => {
    i = Math.min(txt.length, i + perTick);
    el.textContent = txt.slice(0, i);
    if (i >= txt.length) { clearInterval(typing); typing = null; cb && cb(); }
  }, 16);
  el._full = txt; el._done = () => { clearInterval(typing); typing = null; el.textContent = txt; };
}

// ---------- core walker ----------
function currentNode() { const lab = L[state.label]; return lab ? lab[state.idx] : null; }
function advance() {
  const node = currentNode();
  if (!node) return;
  const b = $('body');
  if (typing) { b._done(); $('next-mark').style.opacity = 1; return; }   // first press completes line
  state.idx++;
  run();
}
function run() {
  let node = currentNode();
  while (node) {
    if (skipActive() && node.n === 'n') { state.idx++; node = currentNode(); continue; }
    break;
  }
  if (!node) { return; }
  autosave();
  switch (node.n) {
    case 'bg': setBg(node.v); state.idx++; return run();
    case 'fx': fxPlay(node.v); state.idx++; return run();
    case 'cap': return showCaption(node);
    case 'n': return showLine(null, node);
    case 's': return showLine(node.w, node);
    case 'menu': return showMenu(node);
    case 'cond': {
      const ok = checks[node.check] && checks[node.check]();
      state.label = ok ? node.go : node.skip; state.idx = 0; return run();
    }
    case 'jump':
      if (node.to === 'ROUTE') return showEnding(computeEnding());
      if (node.to === 'end_true') return showEnding('truee');
      if (!L[node.to]) { return showEnding(computeEnding()); }
      state.label = node.to; state.idx = 0; return run();
  }
}
function skipActive() {
  if (!state.cfg.skip || typing) return false;
  const node = currentNode();
  return node && node.n === 'n' && state.seen[state.label + ':' + state.idx];
}

function showLine(speaker, node) {
  $('caption').classList.add('hidden');
  $('choices').innerHTML = ''; $('choices').classList.add('hidden');
  $('nameplate').textContent = speaker || '';
  $('nameplate').style.display = speaker ? '' : 'none';
  if (node.fx) spriteFx(node.fx);
  typeText($('body'), node.t, () => {
    state.seen[state.label + ':' + state.idx] = true;
    state.backlog.push({ w: speaker || '', t: node.t });
    if (state.backlog.length > 400) state.backlog.shift();
    $('next-mark').style.opacity = 1;
    if (state.cfg.autoOn) setTimeout(() => { if (state.cfg.autoOn) advance(); }, state.cfg.auto);
  });
  $('next-mark').style.opacity = 0;
  state._needAdvance = true;
}
function showCaption(node) {
  $('caption').classList.remove('hidden');
  typeText($('caption-text'), node.t, () => {
    state.seen[state.label + ':' + state.idx] = true;
    state.backlog.push({ w:'字幕', t: node.t });
  });
  state._advanceCaption = () => { $('caption').classList.add('hidden'); state.idx++; run(); };
}
function showMenu(node) {
  const box = $('choices');
  box.innerHTML = ''; box.classList.remove('hidden');
  const opts = node.c.filter(o => !o.show_if || (checks[o.show_if] && checks[o.show_if]()));
  opts.forEach(o => {
    const b = document.createElement('button');
    b.className = 'choice'; b.textContent = o.t;
    b.onclick = () => {
      beep('choice');
      applyFx(o.fx);
      state.backlog.push({ w:'選択', t: '▸ ' + o.t });
      box.classList.add('hidden');
      state.label = o.go; state.idx = 0; run();
    };
    box.appendChild(b);
  });
  state._needAdvance = false;
}
function applyFx(fx) {
  if (!fx) return;
  if (fx.set) Object.assign(state.flags, fx.set);
  if (fx.add) for (const k in fx.add) state.vars[k] = (state.vars[k] || 0) + fx.add[k];
  if (fx.dream) state.vars.dream = Math.min(3, state.vars.dream + fx.dream);
  if (fx.sp) spriteFx(fx);
  updateAffection();
}
function updateAffection() {
  const a = $('affection'); const iv = state.vars.intimacy;
  const heart = iv >= 85 ? '❤︎' : iv >= 50 ? '♡' : iv >= 20 ? '·' : '—';
  a.textContent = heart + (store.get('debug', false) ? ' ' + iv : '');
  a.className = iv >= 85 ? 'aff-high' : iv >= 50 ? 'aff-mid' : '';
}

// ---------- endings ----------
function showEnding(id) {
  const e = E[id];
  state.endings[id] = (state.endings[id] || 0) + 1;
  store.set('endings', state.endings);
  $('sysmenu').classList.add('hidden');
  $('dialog').classList.add('hidden');
  $('ending-kind').textContent = e.kind;
  $('ending-name').textContent = e.name;
  $('ending-note').innerHTML = e.text + '<br><br><em>' + e.line + '</em>';
  $('ending-screen').classList.remove('hidden');
  beep('ending');
}

// ---------- save / load ----------
function snap() { return { label: state.label, idx: state.idx, flags: state.flags, vars: state.vars, seen: state.seen }; }
function restore(s) { Object.assign(state, s); state.backlog = []; updateAffection(); }
function autosave() { store.set('auto', snap()); }
function saveTo(slot) { store.set('s' + slot, snap()); toast('已存檔 ' + slot); }
function loadFrom(s) { if (!s || !s.label) return false; restore(s); hideOverlays(); startPlay(); run(); return true; }

// ---------- UI wiring ----------
const overlayIds = ['title','caption','sysmenu','backlog','cfg','savegrid','ending-screen'];
function hideOverlays() { overlayIds.forEach(i => { if (i !== 'caption') $(i).classList.add('hidden'); }); }
function toast(msg) {
  const d = document.createElement('div'); d.className = 'toastx'; d.textContent = msg;
  $('stage').appendChild(d); setTimeout(() => d.remove(), 1400);
}
function startPlay() {
  state.started = true;
  $('title').classList.add('hidden');
  $('ending-screen').classList.add('hidden');
  $('dialog').classList.remove('hidden');
}
function clickStage(e) {
  if (e.target.closest('#choices') || e.target.closest('#sysmenu') || e.target.closest('#hud') ||
      e.target.closest('#cfg') || e.target.closest('#savegrid') || e.target.closest('#backlog') ||
      e.target.closest('.overlay')) return;
  if (!state.started) return;
  beep('click');
  if (!$('caption').classList.contains('hidden')) return state._advanceCaption && state._advanceCaption();
  advance();
}
function keyAdvance(e) {
  if (e.key === ' ' || e.key === 'Enter') { if (!$('dialog').classList.contains('hidden')) { e.preventDefault(); clickStage(e); } }
  if (e.key === 'Escape') $('sysmenu').classList.toggle('hidden');
}
function gallery() {
  const grid = $('gallery-grid'); grid.innerHTML = '';
  const order = ['be1','be2','normal','good','truee','h1','h2'];
  order.forEach(id => {
    const d = document.createElement('div');
    const got = state.endings[id];
    d.className = 'gcell' + (got ? ' got' : '');
    d.textContent = got ? E[id].name : '？？？';
    grid.appendChild(d);
  });
  // H2 trigger: 6/6 of main gallery（除 h2 自身）+ pet_shima
  const main6 = ['be1','be2','normal','good','truee','h1'].every(i => state.endings[i]);
  if (main6 && F().pet_shima && !state.endings.h2) {
    store.set('debug', true);
  }
  if (main6 && state.endings.h1 && !state.endings.h2) showEnding('h2');
}

function boot() {
  // build sprites container once
  $('dialog').addEventListener('click', clickStage);
  $('stage').addEventListener('click', clickStage);
  document.addEventListener('keydown', keyAdvance);
  $('btn-start').onclick = () => { beep('click'); state.label='ch1'; state.idx=0; state.flags={}; state.vars={intimacy:0,dream:0}; updateAffection(); startPlay(); run(); };
  $('btn-continue').onclick = () => { beep('click'); const s = store.get('auto', null); if (s && loadFrom(s)) toast('繼續'); else toast('無進度'); };
  $('btn-config').onclick = () => { $('cfg').classList.remove('hidden'); syncCfg(); };
  $('btn-menu').onclick = () => { $('sysmenu').classList.remove('hidden'); gallery(); };
  $('sysmenu').querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
    const a = b.dataset.act;
    $('sysmenu').classList.add('hidden');
    if (a === 'close') return;
    if (a === 'title') return location.reload();
    if (a === 'back') return openBacklog();
    if (a === 'cfg') { $('cfg').classList.remove('hidden'); return syncCfg(); }
    if (a === 'save') return openSave('save');
    if (a === 'load') return openSave('load');
  });
  $('backlog-close').onclick = () => $('backlog').classList.add('hidden');
  $('cfg-close').onclick = () => $('cfg').classList.add('hidden');
  $('cfg-speed').oninput = e => { state.cfg.speed = +e.target.value; store.set('cfg', state.cfg); };
  $('cfg-auto').oninput = e => { state.cfg.auto = [600,900,1200,1800,2600][+e.target.value-1]; store.set('cfg', state.cfg); };
  $('cfg').querySelector('[data-cfg=auto]').onclick = e => { state.cfg.autoOn = !state.cfg.autoOn; e.target.textContent = 'Auto: ' + (state.cfg.autoOn?'開':'關'); store.set('cfg', state.cfg); };
  $('cfg').querySelector('[data-cfg=skip]').onclick = e => { state.cfg.skip = !state.cfg.skip; e.target.textContent = 'Skip: ' + (state.cfg.skip?'只跳已讀':'關'); store.set('cfg', state.cfg); };
  $('cfg').querySelector('[data-cfg=sound]').onclick = e => { state.cfg.sound = !state.cfg.sound; e.target.textContent = '音效: ' + (state.cfg.sound?'開':'關'); store.set('cfg', state.cfg); };
  $('btn-after-end').onclick = () => { hideOverlays(); $('title').classList.remove('hidden'); $('dialog').classList.add('hidden'); state.started = false; };
  // caption click handled by clickStage; init title state
  updateAffection();
  const hasSave = !!store.get('auto', null);
  $('btn-continue').disabled = !hasSave;
}
function openBacklog() {
  const box = $('backlog-list'); box.innerHTML = '';
  state.backlog.slice(-80).forEach(m => {
    const p = document.createElement('p'); p.className = 'bk';
    p.innerHTML = (m.w ? '<b>' + m.w + '</b> ' : '') + m.t;
    box.appendChild(p);
  });
  $('backlog').classList.remove('hidden');
}
function openSave(mode) {
  const box = $('savebox'); box.innerHTML = '<h2>' + (mode === 'save' ? '存檔' : '讀檔') + '</h2>';
  for (let i = 1; i <= 3; i++) {
    const s = store.get('s' + i, null);
    const b = document.createElement('button');
    b.textContent = i + '：' + (s ? L[s.label] ? s.label + ' 第' + (s.idx+1) + '拍' : s.label : '（空）');
    if (mode === 'save') b.onclick = () => { saveTo(i); $('savegrid').classList.add('hidden'); };
    else { b.disabled = !s; b.onclick = () => { if (!loadFrom(s)) toast('無法讀取'); }; }
    box.appendChild(b);
  }
  if (mode === 'load') {
    const s = store.get('auto', null);
    const b = document.createElement('button');
    b.textContent = '自動存檔' + (s ? '：' + s.label : '（空）'); b.disabled = !s;
    b.onclick = () => { if (loadFrom(s)) $('savegrid').classList.add('hidden'); };
    box.appendChild(b);
  }
  const x = document.createElement('button'); x.textContent = '關閉'; x.onclick = () => $('savegrid').classList.add('hidden');
  box.appendChild(x);
  $('savegrid').classList.remove('hidden');
}
function syncCfg() {
  $('cfg-speed').value = state.cfg.speed;
  $('cfg').querySelector('[data-cfg=auto]').textContent = 'Auto: ' + (state.cfg.autoOn?'開':'關');
  $('cfg').querySelector('[data-cfg=skip]').textContent = 'Skip: ' + (state.cfg.skip?'只跳已讀':'關');
  $('cfg').querySelector('[data-cfg=sound]').textContent = '音效: ' + (state.cfg.sound?'開':'關');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
