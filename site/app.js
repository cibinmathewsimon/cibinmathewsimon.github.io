// The maquette: one Three.js scene. Scrolling moves the camera between three districts
// (furniture platform, application portfolio, career tower); each section's scroll
// progress also drives that district's animation.
import * as THREE from 'three';

const root = document.documentElement;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NARROW = () => innerWidth < 900; // the sheet sits below the model instead of beside it
const TALL = () => innerWidth < innerHeight; // portrait screens get their own camera framing
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const v = (x, y, z) => new THREE.Vector3(x, y, z);
document.getElementById('year').textContent = new Date().getFullYear();

/* ---------- theme toggle (works with or without WebGL) ---------- */
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : darkMQ.matches);
const themeBtn = document.getElementById('theme');
const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></svg>';
const themeListeners = [];
function syncTheme() {
  themeBtn.innerHTML = isDark() ? SUN : MOON;
  themeBtn.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
  themeListeners.forEach(f => f());
}
themeBtn.addEventListener('click', () => {
  root.dataset.theme = isDark() ? 'light' : 'dark';
  try { localStorage.setItem('cms-theme', root.dataset.theme); } catch (e) {}
  syncTheme();
});
darkMQ.addEventListener('change', syncTheme);
syncTheme();

/* ---------- phone menu ---------- */
const bar = document.getElementById('bar'), menuBtn = document.getElementById('menu');
function setMenu(open) {
  bar.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', open);
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}
menuBtn.addEventListener('click', () => setMenu(!bar.classList.contains('open')));
document.getElementById('nav').addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

const PAL = {
  light: { bg: 0xE4E6E8, ground: 0xBFC5CC, model: 0xF6F7F8, edge: 0xC3C9D2, accent: 0x14305A, slate: 0x5B6675, oak: 0xB9824A, dup: 0x7C93B8,
    hemi: 2.2, sun: 2.6, labelBg: 'rgba(246,247,248,0.94)', ink: '#14305A', muted: '#5B6675' },
  dark: { bg: 0x0F141B, ground: 0x151B24, model: 0x2B3443, edge: 0x4D5970, accent: 0x9DB8EA, slate: 0x6D7A90, oak: 0xD9A066, dup: 0x7C93B8,
    hemi: 1.0, sun: 1.7, labelBg: 'rgba(24,32,43,0.92)', ink: '#DCE4F2', muted: '#95A1B5' },
};
const pal = () => (isDark() ? PAL.dark : PAL.light);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('scene'), antialias: true });
} catch (e) {
  root.classList.add('no-webgl');
}
if (renderer) start();

async function start() {
  // labels are drawn with Archivo, so wait for it (but never longer than 1.5 s)
  await Promise.race([document.fonts.load('600 64px Archivo'), new Promise(r => setTimeout(r, 1500))]);

  renderer.setPixelRatio(Math.min(devicePixelRatio, NARROW() ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog(0, 120, 320);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xaab2bd, 2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(40, 80, 45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(NARROW() ? 1024 : 2048, NARROW() ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 10, far: 220 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  /* ---------- themed materials and labels ---------- */
  const painted = []; // [material, palette key]
  const paint = (m, key) => { painted.push([m, key]); return m; };
  const edgeMat = paint(new THREE.LineBasicMaterial(), 'edge');
  const accentEdge = paint(new THREE.LineBasicMaterial({ transparent: true }), 'accent');
  const labels = [];

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), paint(new THREE.MeshStandardMaterial({ roughness: 1 }), 'ground'));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  function box(w, h, d, key = 'model', extra) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0); // origin at the base, so scale.y grows upwards
    const m = new THREE.Mesh(g, paint(new THREE.MeshStandardMaterial({ roughness: 0.85, ...extra }), key));
    m.castShadow = m.receiveShadow = true;
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat));
    return m;
  }
  function cylinder(r, h) {
    const g = new THREE.CylinderGeometry(r, r, h, 40);
    g.translate(0, h / 2, 0);
    const m = new THREE.Mesh(g, paint(new THREE.MeshStandardMaterial({ roughness: 0.85 }), 'model'));
    m.castShadow = m.receiveShadow = true;
    return m;
  }
  function drawLabel(l) {
    const p = pal(), x = l.ctx, c = l.canvas, fs = 64;
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = p.labelBg;
    x.beginPath(); x.roundRect ? x.roundRect(0, 0, c.width, c.height, 14) : x.rect(0, 0, c.width, c.height); x.fill();
    x.font = `600 ${fs}px Archivo, sans-serif`;
    x.fillStyle = l.muted ? p.muted : p.ink; x.textBaseline = 'middle';
    x.fillText(l.text, 22, c.height / 2 + 3);
    l.tex.needsUpdate = true;
  }
  function label(text, h = 1, muted = false) {
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    ctx.font = '600 64px Archivo, sans-serif';
    canvas.width = Math.ceil(ctx.measureText(text).width) + 44; canvas.height = 104;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    h *= 1.45; // readable from the overview distance
    s.scale.set(h * canvas.width / canvas.height, h, 1);
    s.renderOrder = 5;
    const l = { text, muted, canvas, ctx, tex, s, base: s.scale.clone() };
    labels.push(l);
    drawLabel(l);
    return s;
  }
  function place(obj, p, x, y, z) { obj.position.set(p.x + x, p.y + y, p.z + z); scene.add(obj); return obj; }
  const inspectables = [];
  function info(obj, title, text) {
    obj.userData.info = [title, text];
    obj.traverse(o => { if (o.isMesh) { o.userData.info = obj.userData.info; inspectables.push(o); } });
    return obj;
  }

  /* ---------- furniture platform ---------- */
  const Q = v(37, 0, 2);
  place(box(38, 0.6, 26), Q, 0, 0, 0);

  const ipad = info(place(box(3.6, 0.3, 2.6, 'accent'), Q, -13.5, 1.6, 9), 'iPad app in the store',
    'An Angular progressive web app. Sales staff configure furniture with the customer through a guided flow or a 2D drag-and-drop builder, then place the order.');
  ipad.rotation.x = -0.45;
  place(label('iPad app'), Q, -13.5, 4, 9);

  // a sofa that keeps reconfiguring itself: a stand-in for the product configurator
  const sofa = new THREE.Group();
  const fabric = new THREE.MeshStandardMaterial({ roughness: 0.9, color: PAL.light.oak });
  const sofaPart = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), fabric);
    m.position.set(x, y, z); m.castShadow = true; sofa.add(m); return m;
  };
  sofaPart(3.4, 0.5, 1.5, 0, 0, 0);
  sofaPart(3.4, 1.1, 0.35, 0, 0.5, -0.58);
  const arms = [sofaPart(0.35, 0.75, 1.5, -1.53, 0.5, 0), sofaPart(0.35, 0.75, 1.5, 1.53, 0.5, 0)];
  const seats = [0, 1, 2].map(i => sofaPart(1, 0.3, 1.1, -1.1 + i * 1.1, 0.5, 0.12));
  info(sofa, 'Product configurator', 'Every option change is checked against the supplier\'s rules, so only valid products can be ordered. This sofa cycles through options the same way.');
  place(sofa, Q, -13.5, 0.6, 4.6);
  const sofaVariants = [[0xB9824A, true, 3], [0x5B6675, false, 3], [0x7C93B8, true, 2], [0xD8CFC4, true, 3]];
  let sofaStep = 0, sofaTimer = 0;
  const fabricTarget = new THREE.Color(PAL.light.oak);

  // the modular monolith as an exploded axonometric: the shell lifts, modules rise into layers
  const shellGeo = new THREE.BoxGeometry(14, 5.6, 9).translate(0, 2.8, 0);
  const shellMat = paint(new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.12, depthWrite: false }), 'accent');
  const shell = place(new THREE.Mesh(shellGeo, shellMat), Q, -1, 0.6, 1);
  shell.add(new THREE.LineSegments(new THREE.EdgesGeometry(shellGeo), accentEdge));
  info(shell, 'Modular monolith', 'Java 21 and Spring Boot on Cloud Run. One deployable with strict module boundaries, so the team reached production in under six months.');
  const shellTag = place(label('Modular monolith (Spring Boot)', 1.05), Q, -1, 7.4, 1);

  function module(name, x, title, text, layers, side) {
    const base = info(place(box(5, 1.6, 5.6), Q, x, 0.6, 1), title, text);
    const tag = place(label(name, 0.95), Q, x, 3, 1);
    const slabs = layers.map(([n, t]) => {
      const s = info(place(box(4.6, 0.45, 5.2), Q, x, 2.2, 1), n, t);
      const l = place(label(n, 0.8, true), Q, x + side * 2.6, 2.4, 1);
      l.center.set(side > 0 ? 0 : 1, 0.5);
      l.material.depthTest = false; // layer names stay readable beside the stacked slabs
      return { s, l };
    });
    return { base, tag, slabs, x };
  }
  const modules = [
    module('PIM', -4.4, 'PIM module', 'Product information management: supplier products, options and the rules that keep every configuration valid.', [
      ['Catalog', 'Supplier products and options, stored as data rather than code.'],
      ['Rule builder', 'Business users define which options combine and which constraints apply, without a release.'],
      ['Configurator', 'Guided flows and a 2D drag-and-drop builder, used on the iPad.'],
      ['Supplier import', 'Ingests each supplier\'s data with its own configurable rules, and is monitored for errors.'],
    ], -1),
    module('Sales', 2.4, 'Sales module', 'Everything after the product is configured.', [
      ['Orders', 'Places and tracks orders from the store.'],
      ['Discounts', 'Store and campaign discounts, applied by rules.'],
      ['Delivery', 'Delivery options and planning.'],
      ['Payments', 'Payments taken in the store.'],
      ['Contracts', 'Sales contracts generated for the customer.'],
    ], 1),
  ];

  // planned microservices, drawn as dashed outlines
  const dashMat = paint(new THREE.LineDashedMaterial({ dashSize: 0.45, gapSize: 0.3, transparent: true }), 'accent');
  const ghosts = [['Warehouse (planned)', -1.5], ['ERP (planned)', 3.5]].map(([n, z]) => {
    const g = new THREE.BoxGeometry(4, 2.8, 3.2).translate(0, 1.4, 0);
    const hit = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(g), dashMat);
    lines.computeLineDistances();
    hit.add(lines);
    info(place(hit, Q, 15.5, 0.6, z), n,
      'The next phase: a full ERP behind the platform, starting with warehouse management, built as microservices beside the monolith.');
    return { l: place(label(n, 0.8, true), Q, 15.5, 4.3, z) };
  });

  const pg = info(place(cylinder(1.4, 2.8), Q, 0, 0.6, 9.5), 'PostgreSQL', 'The system of record for products, configurations and orders.');
  const es = info(place(cylinder(1.4, 2.8), Q, 4.6, 0.6, 9.5), 'Elasticsearch', 'Product search that answers in under 500 ms.');
  info(place(cylinder(1.4, 2.8), Q, 9.2, 0.6, 9.5), 'Redis', 'A cache for frequently read data.');
  place(label('PostgreSQL', 0.85), Q, 0, 4.3, 9.5);
  place(label('Elasticsearch', 0.85), Q, 4.6, 4.3, 11);
  place(label('Redis', 0.85), Q, 9.2, 4.3, 9.5);

  info(place(box(32, 0.4, 0.9, 'slate'), Q, 1, 0.6, -8), 'Google Pub/Sub',
    'Events such as "order placed" or "stock changed". Other parts of the system react to them without slowing down a sale.');
  place(label('Pub/Sub events', 0.9), Q, 11, 2, -9.6);
  const stock = info(place(box(4, 2.4, 3), Q, -3, 0.6, -11.2), 'Stock monitoring', 'Keeps stock up to date across stores by listening to events.');
  place(label('Stock', 0.85), Q, -3, 3.8, -11.2);
  const bq = info(place(cylinder(1.4, 2.8), Q, 6, 0.6, -11.2), 'BigQuery', 'Analytics on sales and configuration data.');
  place(label('BigQuery', 0.85), Q, 6, 4.3, -11.2);
  const ai = info(place(box(3.2, 2.6, 3.2), Q, -14, 0.6, -5.5), 'AI brochure service',
    'A separate service that turns supplier brochures into structured product data through an API.');
  place(label('AI brochure service', 0.85), Q, -14, 3.6, -5.5);
  const suppliers = new THREE.Group();
  for (let i = 0; i < 8; i++) { const t = box(2.6, 0.22, 1.8); t.position.set((i % 2) * 0.3, i * 0.3, -(i % 3) * 0.2); suppliers.add(t); }
  info(suppliers, '50+ suppliers', 'Each supplier has its own data format and rule set, and is onboarded through configuration instead of code.');
  place(suppliers, Q, -14.5, 0.6, -10);
  place(label('50+ suppliers', 0.85), Q, -14, 4.1, -10);

  // particles travelling along polylines (orders, events, supplier data)
  const at = (m, dy = 1.4) => m.getWorldPosition(new THREE.Vector3()).add(v(0, dy, 0));
  const railAt = x => v(Q.x + x, Q.y + 1.3, Q.z - 8);
  const sales = modules[1].base, pim = modules[0].base;
  const FLOWS = [
    { pts: [at(ipad, 0.6), at(sales)], every: 1.6 },
    { pts: [at(sales), at(pg)], every: 1.6, delay: 0.8 },
    { pts: [at(pim), at(es)], every: 2.4 },
    { pts: [at(suppliers.children[7], 0.4), at(ai), at(pim)], every: 2.2 },
    { pts: [at(sales), railAt(2.4), railAt(-3), at(stock)], every: 1.8, delay: 0.5 },
    { pts: [at(sales), railAt(2.4), railAt(6), at(bq)], every: 1.8, delay: 1.1 },
  ].map(f => {
    const segs = f.pts.slice(1).map((p, i) => p.distanceTo(f.pts[i]));
    return { ...f, segs, len: segs.reduce((a, b) => a + b, 0), acc: -(f.delay || 0) };
  });
  const dotGeo = new THREE.SphereGeometry(0.28, 16, 12);
  const dotMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.35 });
  const dots = [];
  function pointOn(f, d) {
    for (let i = 0; i < f.segs.length; i++) {
      if (d <= f.segs[i]) return f.pts[i].clone().lerp(f.pts[i + 1], d / f.segs[i]);
      d -= f.segs[i];
    }
    return f.pts[f.pts.length - 1].clone();
  }

  /* ---------- portfolio and demerger ---------- */
  const P = v(0, 0, -36);
  const plinthA = place(box(14, 0.6, 12), P, 0, 0, 0);
  const plinthB = place(box(14, 0.6, 12), P, 9, 0, 0);
  const tagA = place(label('Original company', 1.1, true), P, -9, 6.5, -5);
  const tagB = place(label('New company', 1.1, true), P, 9, 6.5, -5);
  const splitDir = v(1, 0, 0), posA = v(0, 0, 0), posB = v(0, 0, 0);
  const apps = Array.from({ length: 20 }, (_, i) => {
    const gx = (i % 5 - 2) * 2.5, gz = (Math.floor(i / 5) - 1.5) * 2.5;
    const h = 1.2 + ((i * 37) % 11) / 4.4;
    const type = i % 3; // 0 rebuilt, 1 split, 2 duplicated
    const a = place(box(1.7, h, 1.7), P, gx, 0.6, gz);
    a.material = new THREE.MeshStandardMaterial({ roughness: 0.85 }); // tinted every frame, so not palette-painted
    const twin = type === 0 ? null : place(box(1.7, h, 1.7, type === 1 ? 'oak' : 'dup'), P, 9 + gx, 0.6, gz);
    return { a, twin, gx, gz, type };
  });
  const tmpColor = new THREE.Color();

  /* ---------- career tower ---------- */
  const T = v(-34, 0, 4);
  place(box(16, 0.6, 16), T, 0, 0, 0);
  const ROLES = ['Associate Software Engineer', 'Software Engineer', 'Team Lead', 'Technical Lead', 'Associate Solution Architect I', 'Associate Solution Architect II'];
  const FLOOR_H = 3.2;
  const floors = ROLES.map((role, i) => {
    const w = 9 - i * 0.55, y = 0.6 + i * (FLOOR_H + 0.25);
    const f = place(box(w, FLOOR_H, w, i === ROLES.length - 1 ? 'oak' : 'model'), T, 0, y, 0);
    const tag = place(label(role, 1.05), T, w / 2 + 1.2, y + FLOOR_H / 2, w / 2);
    tag.center.set(0, 0.5);
    return { f, tag, k: 1 };
  });
  const floorItems = [...document.querySelectorAll('#floors li')];

  /* ---------- theme ---------- */
  let dirty = true;
  function applyTheme() {
    const p = pal();
    scene.background.setHex(p.bg); scene.fog.color.setHex(p.bg);
    hemi.intensity = p.hemi; sun.intensity = p.sun;
    painted.forEach(([m, key]) => m.color.setHex(p[key]));
    dotMat.color.setHex(p.oak); dotMat.emissive.setHex(p.oak);
    labels.forEach(drawLabel);
    dirty = true;
  }
  themeListeners.push(applyTheme);
  applyTheme();

  /* ---------- camera waypoints, one per section ---------- */
  const CAMS = {
    hero: () => ({ pos: v(8, 82, 108), target: v(8, 0, -12) }),
    platform: t => ({ pos: v(Q.x - 6 + t * 8, 28, Q.z + (NARROW() ? 54 : 38)), target: v(Q.x, 3, Q.z - 1) }),
    portfolio: t => ({ pos: v(P.x, 28 - t * 4, P.z + (NARROW() ? 46 : 38) - t * 4), target: v(P.x, 1.5, P.z) }),
    career: t => {
      const a = -0.45 + t * 0.9, r = NARROW() ? 50 : 44, cx = T.x + 5; // aim between the tower and its labels
      return { pos: v(cx + Math.sin(a) * r, 12 + t * 14, T.z + Math.cos(a) * r), target: v(cx, 5 + t * 9, T.z) };
    },
    skills: () => ({ pos: v(0, 110, 60), target: v(0, 0, -12) }),
    contact: () => ({ pos: v(-8, 22, 62), target: v(-22, 9, 0) }),
  };
  // portrait phones: closer shots that track along each district instead of one wide overview
  const CAMS_TALL = {
    hero: () => ({ pos: v(8, 54, 96), target: v(-20, 6, -14) }),
    career: t => {
      const a = -0.3 + t * 0.5, r = 66, cx = T.x + 7; // aim between the tower and its labels
      return { pos: v(cx + Math.sin(a) * r, 16 + t * 12, T.z + Math.cos(a) * r), target: v(cx, 8 + t * 5, T.z) };
    },
    // pan from the iPad, over the exploding monolith, to the planned microservices
    platform: t => { const x = Q.x - 11 + smooth(0.05, 0.95, t) * 24; return { pos: v(x, 40, Q.z + 42), target: v(x, 1, Q.z) }; },
    // the two companies stack front to back, so they read top to bottom on a tall screen
    portfolio: t => ({ pos: v(P.x, 44 - t * 4, P.z + 33), target: v(P.x, 0, P.z - 2) }),
    skills: () => ({ pos: v(6, 120, 90), target: v(6, 0, -12) }),
    contact: () => ({ pos: v(-12, 26, 58), target: v(-30, 9, 0) }),
  };
  // sideways and upward shift of the rendered view, so the model sits beside (or above) the text
  const LENS = { hero: [0.14, 0.17], platform: [0.2, 0], portfolio: [-0.2, 0], career: [-0.2, 0], skills: [0, 0], contact: [0.12, 0] };
  const LENS_NARROW = { hero: [0, 0.24], platform: [0, 0.1], portfolio: [0, 0.1], career: [0, 0.1], skills: [0, 0], contact: [0, 0] };

  const sections = [...document.querySelectorAll('[data-cam]')];
  const order = sections.map(s => s.dataset.cam);
  const navLinks = [...document.querySelectorAll('.bar nav a')];
  let active = 'hero', local = 0;
  function readScroll() {
    const line = innerHeight * 0.55;
    let idx = 0;
    sections.forEach((s, i) => { if (s.getBoundingClientRect().top <= line) idx = i; });
    const r = sections[idx].getBoundingClientRect();
    active = order[idx];
    // on phones the animation plays out across the empty stage, finishing as the sheet covers the lower fifth
    const sheet = NARROW() && sections[idx].querySelector('.sheet');
    local = clamp((line - r.top) / Math.max(1, sheet ? sheet.offsetTop - innerHeight * 0.25 : r.height - innerHeight * 0.3), 0, 1);
    navLinks.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + sections[idx].id));
  }
  // progress through a named section: -1 before it, 0..1 inside it, 2 after it
  function stage(name) {
    const i = order.indexOf(name), a = order.indexOf(active);
    return a < i ? -1 : a > i ? 2 : local;
  }

  /* ---------- inspecting the platform ---------- */
  const inspectBox = document.getElementById('inspect');
  const defaultInspect = inspectBox.innerHTML;
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let hovered = null;
  function pick(e) {
    if (active !== 'platform' || e.target.closest('.sheet, .bar, a, button')) return null;
    mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(inspectables, false).find(h => h.object.visible);
    return hit ? hit.object : null;
  }
  function setHover(m) {
    if (m === hovered) return;
    [hovered, m].forEach((o, i) => {
      if (!o || !o.material.emissive) return;
      o.material.emissive.setHex(i ? pal().oak : 0x000000);
      o.material.emissiveIntensity = i ? 0.3 : 0;
    });
    hovered = m;
    document.body.style.cursor = m ? 'pointer' : '';
    inspectBox.innerHTML = tip.innerHTML = m ? `<b>${m.userData.info[0]}</b>${m.userData.info[1]}` : defaultInspect;
    dirty = true;
  }
  const tip = document.getElementById('tip'), platformSheet = document.querySelector('#platform .sheet');
  tip.innerHTML = defaultInspect;
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') setHover(pick(e)); }, { passive: true });
  addEventListener('click', e => { if (!e.target.closest('.sheet, .bar, .tip')) setHover(pick(e)); });

  /* ---------- loop ---------- */
  let last = performance.now(), first = true;
  const camPos = v(0, 0, 0), camTarget = v(0, 0, 0), lens = [0, 0];
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    // widen the lens on portrait screens so the models fit across, and enlarge labels to stay legible
    camera.fov = TALL() ? Math.min(56, 38 + (1 - camera.aspect) * 34) : 38 * clamp(1.75 / camera.aspect, 1, 1.3);
    camera.updateProjectionMatrix();
    labels.forEach(l => l.s.scale.copy(l.base).multiplyScalar(TALL() ? 1.15 : 1));
    if (TALL()) splitDir.set(0, 0, -1); else splitDir.set(1, 0, 0);
    first = true; // jump straight to the new framing
    dirty = true;
  }
  addEventListener('resize', resize);
  addEventListener('scroll', () => { dirty = true; }, { passive: true });
  resize();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    readScroll();

    // camera eases toward the active section's waypoint
    const goal = (TALL() ? CAMS_TALL : CAMS)[active](local);
    tip.hidden = !(NARROW() && active === 'platform' && platformSheet.getBoundingClientRect().top > innerHeight - 30);
    if (hovered && active !== 'platform') setHover(null);
    const k = first || RM ? 1 : 1 - Math.pow(0.02, dt);
    camPos.lerp(goal.pos, k); camTarget.lerp(goal.target, k);
    camera.position.copy(camPos); camera.lookAt(camTarget);
    const want = (NARROW() ? LENS_NARROW : LENS)[active];
    lens[0] += (want[0] - lens[0]) * k; lens[1] += (want[1] - lens[1]) * k;
    camera.setViewOffset(innerWidth, innerHeight, -lens[0] * innerWidth, lens[1] * innerHeight, innerWidth, innerHeight);
    first = false;

    // platform: explode the monolith, then reveal the planned microservices
    const ps = stage('platform');
    const at01 = ps === -1 ? 0 : ps === 2 ? 1 : ps;
    const e = smooth(0.15, 0.6, at01), g = smooth(0.6, 0.85, at01);
    shell.position.y = Q.y + 0.6 + e * 9;
    shellTag.position.y = Q.y + 7.4 + e * 9;
    shellMat.opacity = 0.12 * (1 - e * 0.6);
    accentEdge.opacity = 1 - e * 0.55;
    modules.forEach((m, mi) => {
      const side = mi ? 1 : -1, x = Q.x + m.x + side * e * 1.4;
      m.base.position.x = x; m.tag.position.x = x;
      m.slabs.forEach((sl, j) => {
        const ej = smooth(0.15 + j * 0.05, 0.55 + j * 0.05, at01);
        const y = Q.y + 2.25 + j * 0.5 + ej * (0.6 + j * 0.75);
        sl.s.position.x = x; sl.s.position.y = y;
        sl.s.visible = ej > 0.01;
        sl.l.position.x = x + side * 2.6; sl.l.position.y = y + 0.25;
        sl.l.material.opacity = smooth(0.5, 1, ej);
      });
    });
    dashMat.opacity = g;
    ghosts.forEach(gh => { gh.l.material.opacity = g; });

    // configurator sofa: a new valid option set every few seconds
    if (!RM) {
      sofaTimer += dt;
      if (sofaTimer > 2.6) {
        sofaTimer = 0; sofaStep = (sofaStep + 1) % sofaVariants.length;
        const [col, withArms, n] = sofaVariants[sofaStep];
        fabricTarget.setHex(col);
        arms.forEach(a => { a.visible = withArms; });
        seats.forEach((st, i) => { st.visible = i < n; st.scale.x = n === 2 ? 1.6 : 1; st.position.x = n === 2 ? -0.85 + i * 1.7 : -1.1 + i * 1.1; });
      }
      fabric.color.lerp(fabricTarget, Math.min(1, dt * 4));
    }

    // demerger: the portfolio splits across two plinths
    const p = pal();
    const qs = stage('portfolio');
    const s = qs === -1 ? 0 : qs === 2 ? 1 : smooth(0.2, 0.8, qs);
    // the companies separate along splitDir: sideways on wide screens, front to back on tall ones
    plinthA.position.copy(P).addScaledVector(splitDir, -9 * s);
    plinthB.position.copy(P).addScaledVector(splitDir, 9);
    plinthB.scale.y = Math.max(0.001, smooth(0, 0.35, s));
    plinthB.visible = s > 0.01;
    tagA.position.copy(P).addScaledVector(splitDir, -9).add(v(0, 6.5, -5));
    tagB.position.copy(P).addScaledVector(splitDir, 9).add(v(0, 6.5, -5));
    tagA.material.opacity = tagB.material.opacity = smooth(0.1, 0.4, s);
    const tint = smooth(0, 0.3, s);
    apps.forEach(ap => {
      ap.a.material.color.setHex(p.model).lerp(tmpColor.setHex([p.accent, p.oak, p.dup][ap.type]), tint);
      posA.set(P.x + ap.gx, 0.6, P.z + ap.gz).addScaledVector(splitDir, -9 * s);
      posB.set(P.x + ap.gx, 0.6, P.z + ap.gz).addScaledVector(splitDir, 9);
      if (ap.type === 0) { // rebuilt on the new platform, retired on the old one
        const m = smooth(0.3, 1, s);
        ap.a.position.lerpVectors(posA, posB, m);
        ap.a.position.y += Math.sin(Math.PI * m) * 4;
      } else {
        ap.a.position.copy(posA);
        ap.a.scale.x = ap.type === 1 ? 1 - 0.5 * smooth(0.3, 0.6, s) : 1;
        ap.twin.position.copy(posB);
        ap.twin.scale.set(ap.type === 1 ? 0.5 : 1, Math.max(0.001, smooth(0.45, 0.9, s)), 1);
        ap.twin.visible = ap.twin.scale.y > 0.01;
      }
    });

    // tower: one floor per role, raised by scrolling through the career section
    const cs = stage('career');
    const built = cs === -1 || cs === 2 ? ROLES.length : 1 + Math.floor(smooth(0.05, 0.8, cs) * (ROLES.length - 1) + 0.0001);
    floors.forEach((fl, i) => {
      const want = i < built ? 1 : 0.001;
      fl.k = RM ? want : fl.k + (want - fl.k) * Math.min(1, dt * 7);
      fl.f.scale.y = Math.max(0.001, fl.k);
      fl.tag.material.opacity = clamp(fl.k * 1.4 - 0.4, 0, 1);
    });
    floorItems.forEach((li, i) => li.classList.toggle('lit', i < built));

    // platform particles
    if (!RM) {
      FLOWS.forEach(f => {
        f.acc += dt;
        if (f.acc >= f.every) { f.acc = 0; const m = new THREE.Mesh(dotGeo, dotMat); scene.add(m); dots.push({ f, d: 0, m }); }
      });
      for (let i = dots.length - 1; i >= 0; i--) {
        const d = dots[i];
        d.d += dt * 9;
        if (d.d >= d.f.len) { scene.remove(d.m); dots.splice(i, 1); continue; }
        d.m.position.copy(pointOn(d.f, d.d));
      }
    }

    if (!RM || dirty) renderer.render(scene, camera);
    dirty = false;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
