// The maquette: one Three.js scene. Scrolling moves the camera between three districts
// (career tower, application portfolio, furniture platform); each section's scroll
// progress also drives that district's animation.
import * as THREE from 'three';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NARROW = () => innerWidth < 900;
const COL = { ground: 0xE4E6E8, model: 0xF6F7F8, prussian: 0x14305A, oak: 0xB9824A, slate: 0x5B6675, dup: 0x7C93B8, edge: 0xC3C9D2 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const v = (x, y, z) => new THREE.Vector3(x, y, z);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('scene'), antialias: true });
} catch (e) {
  document.documentElement.classList.add('no-webgl');
}
if (renderer) start();

async function start() {
  // labels are drawn with Archivo, so wait for it (but never longer than 1.5 s)
  await Promise.race([document.fonts.load('600 64px Archivo'), new Promise(r => setTimeout(r, 1500))]);

  renderer.setPixelRatio(Math.min(devicePixelRatio, NARROW() ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.ground);
  scene.fog = new THREE.Fog(COL.ground, 120, 320);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xaab2bd, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.position.set(40, 80, 45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(NARROW() ? 1024 : 2048, NARROW() ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 10, far: 220 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ color: 0xBFC5CC, roughness: 1 }) /* darker than the page so it reads as concrete once lit */);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ---------- helpers ---------- */
  function mat(color, extra) { return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra }); }
  function box(w, h, d, color = COL.model, extra) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0); // origin at the base, so scale.y grows upwards
    const m = new THREE.Mesh(g, mat(color, extra));
    m.castShadow = m.receiveShadow = true;
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: COL.edge })));
    return m;
  }
  function cylinder(r, h, color = COL.model) {
    const g = new THREE.CylinderGeometry(r, r, h, 40);
    g.translate(0, h / 2, 0);
    const m = new THREE.Mesh(g, mat(color));
    m.castShadow = m.receiveShadow = true;
    return m;
  }
  function label(text, h = 1.1, color = '#14305A') {
    const c = document.createElement('canvas'), x = c.getContext('2d'), fs = 64;
    x.font = `600 ${fs}px Archivo, sans-serif`;
    c.width = Math.ceil(x.measureText(text).width) + 44; c.height = fs + 40;
    x.font = `600 ${fs}px Archivo, sans-serif`;
    x.fillStyle = 'rgba(246,247,248,0.94)';
    x.beginPath(); x.roundRect ? x.roundRect(0, 0, c.width, c.height, 14) : x.rect(0, 0, c.width, c.height); x.fill();
    x.fillStyle = color; x.textBaseline = 'middle'; x.fillText(text, 22, c.height / 2 + 3);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    h *= 1.45; // labels must stay readable from the overview distance
    s.scale.set(h * c.width / c.height, h, 1);
    s.renderOrder = 5;
    return s;
  }
  function place(obj, p, x, y, z) { obj.position.set(p.x + x, p.y + y, p.z + z); scene.add(obj); return obj; }

  /* ---------- career tower ---------- */
  const T = v(-34, 0, 4);
  place(box(16, 0.6, 16), T, 0, 0, 0);
  const ROLES = ['Associate Software Engineer', 'Software Engineer', 'Team Lead', 'Technical Lead', 'Associate Solution Architect I', 'Associate Solution Architect II'];
  const FLOOR_H = 3.2;
  const floors = ROLES.map((role, i) => {
    const w = 9 - i * 0.55;
    const f = place(box(w, FLOOR_H, w, i === ROLES.length - 1 ? COL.oak : COL.model), T, 0, 0.6 + i * (FLOOR_H + 0.25), 0);
    const tag = place(label(role, 1.05), T, w / 2 + 1.2, 0.6 + i * (FLOOR_H + 0.25) + FLOOR_H / 2, w / 2);
    tag.center.set(0, 0.5);
    return { f, tag, k: 1 };
  });
  const floorItems = [...document.querySelectorAll('#floors li')];

  /* ---------- portfolio and demerger ---------- */
  const P = v(0, 0, -36);
  const plinthA = place(box(14, 0.6, 12), P, 0, 0, 0);
  const plinthB = place(box(14, 0.6, 12), P, 9, 0, 0);
  plinthB.scale.y = 0.001;
  const tagA = place(label('Original company', 1.1, '#5B6675'), P, -9, 6.5, -5);
  const tagB = place(label('New company', 1.1, '#5B6675'), P, 9, 6.5, -5);
  const TYPE = [COL.prussian, COL.oak, COL.dup]; // rebuilt, split, duplicated
  const white = new THREE.Color(COL.model);
  const apps = Array.from({ length: 20 }, (_, i) => {
    const gx = (i % 5 - 2) * 2.5, gz = (Math.floor(i / 5) - 1.5) * 2.5;
    const h = 1.2 + ((i * 37) % 11) / 4.4;
    const type = i % 3;
    const a = place(box(1.7, h, 1.7), P, gx, 0.6, gz);
    const twin = type === 0 ? null : place(box(1.7, h, 1.7, TYPE[type]), P, 9 + gx, 0.6, gz);
    if (twin) { twin.scale.set(type === 1 ? 0.5 : 1, 0.001, 1); twin.visible = false; }
    return { a, twin, gx, gz, type };
  });

  /* ---------- furniture platform ---------- */
  const Q = v(37, 0, 2);
  const inspectables = [];
  function info(mesh, title, text) { mesh.userData.info = [title, text]; inspectables.push(mesh); return mesh; }
  place(box(36, 0.6, 26), Q, 0, 0, 0);
  const ipad = info(place(box(3.6, 0.3, 2.6, COL.prussian), Q, -13.5, 1.6, 8.5), 'iPad app in the store',
    'An Angular progressive web app. Sales staff configure furniture with the customer through a guided flow or a 2D drag-and-drop builder, then place the order.');
  ipad.rotation.x = -0.45;
  place(label('iPad app', 1), Q, -13.5, 4.2, 8.5);

  const mono = place(new THREE.Mesh(new THREE.BoxGeometry(13, 5.4, 8.5).translate(0, 2.7, 0),
    new THREE.MeshStandardMaterial({ color: COL.prussian, transparent: true, opacity: 0.12, depthWrite: false })), Q, -1, 0.6, 1);
  mono.add(new THREE.LineSegments(new THREE.EdgesGeometry(mono.geometry), new THREE.LineBasicMaterial({ color: COL.prussian })));
  info(mono, 'Modular monolith', 'Java 21 and Spring Boot on Cloud Run. One deployable with strict module boundaries, so the team reached production in under six months and modules can move to microservices later.');
  place(label('Modular monolith', 1.1), Q, -1, 7.2, 1);
  const pim = info(place(box(5, 2.8, 5.5), Q, -4.2, 0.6, 1), 'PIM module',
    'Product information: supplier products, options and the rule builder that keeps every configuration valid. It is all data-driven, so a new range needs no release.');
  place(label('PIM', 0.9), Q, -4.2, 4.3, 1);
  const sales = info(place(box(5, 2.8, 5.5), Q, 2.4, 0.6, 1), 'Sales module', 'Ordering, discounts, delivery, payments and contracts.');
  place(label('Sales', 0.9), Q, 2.4, 4.3, 1);

  const pg = info(place(cylinder(1.4, 2.8), Q, 1, 0.6, 9), 'PostgreSQL', 'The system of record for products, configurations and orders.');
  const es = info(place(cylinder(1.4, 2.8), Q, 5.4, 0.6, 9), 'Elasticsearch', 'Product search that answers in under 500 ms.');
  info(place(cylinder(1.4, 2.8), Q, 9.8, 0.6, 9), 'Redis', 'A cache for frequently read data.');
  place(label('PostgreSQL', 0.85), Q, 1, 4.3, 9);
  place(label('Elasticsearch', 0.85), Q, 5.4, 4.3, 9);
  place(label('Redis', 0.85), Q, 9.8, 4.3, 9);

  const rail = info(place(box(30, 0.4, 0.9, COL.slate), Q, 1, 0.6, -7.5), 'Google Pub/Sub',
    'Events such as "order placed" or "stock changed". Other parts of the system react to them without slowing down a sale.');
  place(label('Pub/Sub events', 0.9), Q, 13, 2, -7.5);
  const stock = info(place(box(4, 2.4, 3), Q, -3, 0.6, -11), 'Stock monitoring', 'Keeps stock up to date across stores by listening to events.');
  place(label('Stock', 0.85), Q, -3, 3.8, -11);
  const bq = info(place(cylinder(1.4, 2.8), Q, 6, 0.6, -11), 'BigQuery', 'Analytics on sales and configuration data.');
  place(label('BigQuery', 0.85), Q, 6, 4.3, -11);
  const ai = info(place(box(3.2, 2.6, 3.2), Q, -13.5, 0.6, -2), 'AI brochure service',
    'A separate service that turns supplier brochures into structured product data through an API.');
  place(label('AI brochure service', 0.85), Q, -13.5, 4.1, -2);
  const suppliers = info(new THREE.Group(), '50+ suppliers', 'Each supplier has its own data format and rule set, and is onboarded through configuration instead of code.');
  for (let i = 0; i < 8; i++) {
    const tile = box(2.6, 0.22, 1.8);
    tile.position.set((i % 2) * 0.3, i * 0.3, -(i % 3) * 0.2);
    tile.userData.info = suppliers.userData.info;
    inspectables.push(tile);
    suppliers.add(tile);
  }
  place(suppliers, Q, -14, 0.6, -10);
  place(label('50+ suppliers', 0.85), Q, -13.5, 4.1, -10);

  // particles travelling along polylines (orders, events, supplier data)
  const at = (m, dy = 1.4) => m.getWorldPosition(new THREE.Vector3()).add(v(0, dy, 0));
  const railAt = x => v(Q.x + x, Q.y + 1.3, Q.z - 7.5);
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
  const dotMat = new THREE.MeshStandardMaterial({ color: COL.oak, emissive: COL.oak, emissiveIntensity: 0.35 });
  const dots = [];
  function pointOn(f, d) {
    for (let i = 0; i < f.segs.length; i++) {
      if (d <= f.segs[i]) return f.pts[i].clone().lerp(f.pts[i + 1], d / f.segs[i]);
      d -= f.segs[i];
    }
    return f.pts[f.pts.length - 1].clone();
  }

  /* ---------- camera waypoints, one per section ---------- */
  // LENS shifts the rendered view sideways (fraction of the width) so the model sits beside the text
  const LENS = [[0.14, 0.17], [0.2, 0], [-0.2, 0], [0.2, 0], [0, 0], [0.12, 0]]; // [sideways, upwards]
  const CAMS = [
    () => ({ pos: v(8, 82, 108), target: v(8, 0, -12) }),
    t => { const a = -0.45 + t * 0.9, r = NARROW() ? 42 : 30; return { pos: v(T.x + Math.sin(a) * r, 12 + t * 14, T.z + Math.cos(a) * r), target: v(T.x, 5 + t * 9, T.z) }; },
    t => ({ pos: v(P.x, 26 - t * 4, P.z + (NARROW() ? 44 : 32) - t * 4), target: v(P.x, 1.5, P.z) }),
    t => ({ pos: v(Q.x - 6 + t * 8, 27, Q.z + (NARROW() ? 50 : 36)), target: v(Q.x, 2, Q.z - 1) }),
    () => ({ pos: v(0, 110, 60), target: v(0, 0, -12) }),
    () => ({ pos: v(-8, 22, 62), target: v(-22, 9, 0) }),
  ];
  const sections = [...document.querySelectorAll('[data-cam]')];
  const navLinks = [...document.querySelectorAll('.bar nav a')];
  let active = 0, local = 0;
  function readScroll() {
    const line = innerHeight * 0.55;
    active = 0;
    sections.forEach((s, i) => { if (s.getBoundingClientRect().top <= line) active = i; });
    const r = sections[active].getBoundingClientRect();
    local = clamp((line - r.top) / Math.max(1, r.height - innerHeight * 0.3), 0, 1);
    const id = sections[active].id;
    navLinks.forEach(a => a.classList.toggle('on', id && a.getAttribute('href') === '#' + id));
  }

  /* ---------- inspecting the platform ---------- */
  const inspectBox = document.getElementById('inspect');
  const defaultInspect = inspectBox.innerHTML;
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let hovered = null;
  function pick(e) {
    if (active !== 3 || e.target.closest('.sheet, .bar, a, button')) return null;
    mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(inspectables, false).find(h => h.object.userData.info);
    return hit ? hit.object : null;
  }
  function setHover(m) {
    if (m === hovered) return;
    [hovered, m].forEach((o, i) => {
      if (!o || !o.material.emissive) return;
      if (!o.userData.baseMat) { o.userData.baseMat = o.material; o.material = o.material.clone(); }
      o.material.emissive.setHex(i ? COL.oak : 0x000000);
      o.material.emissiveIntensity = i ? 0.35 : 0;
    });
    hovered = m;
    document.body.style.cursor = m ? 'pointer' : '';
    inspectBox.innerHTML = m ? `<b>${m.userData.info[0]}</b>${m.userData.info[1]}` : defaultInspect;
    dirty = true;
  }
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') setHover(pick(e)); }, { passive: true });
  addEventListener('click', e => { const m = pick(e); if (m) setHover(m); });

  /* ---------- loop ---------- */
  let dirty = true, last = performance.now(), first = true;
  const lens = [0, 0];
  const camPos = v(0, 0, 0), camTarget = v(0, 0, 0);
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
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
    const goal = CAMS[active](local);
    const k = first || RM ? 1 : 1 - Math.pow(0.02, dt);
    camPos.lerp(goal.pos, k); camTarget.lerp(goal.target, k);
    if (active === 0 && !RM) camPos.x += Math.sin(now / 4000) * 0.02; // slow drift on the overview
    camera.position.copy(camPos); camera.lookAt(camTarget);
    lens.forEach((l, i) => { lens[i] += ((NARROW() ? 0 : LENS[active][i]) - l) * k; });
    camera.setViewOffset(innerWidth, innerHeight, -lens[0] * innerWidth, lens[1] * innerHeight, innerWidth, innerHeight);
    first = false;

    // tower: one floor per role, raised by scrolling through the career section
    const built = active < 1 ? ROLES.length : active === 1 ? 1 + Math.floor(smooth(0.05, 0.8, local) * (ROLES.length - 1) + 0.0001) : ROLES.length;
    floors.forEach((fl, i) => {
      const want = i < built ? 1 : 0.001;
      fl.k = RM ? want : fl.k + (want - fl.k) * Math.min(1, dt * 7);
      fl.f.scale.y = Math.max(0.001, fl.k);
      fl.tag.material.opacity = clamp(fl.k * 1.4 - 0.4, 0, 1);
    });
    floorItems.forEach((li, i) => li.classList.toggle('lit', i < built));

    // demerger: the portfolio splits across two plinths
    const s = active < 2 ? 0 : active === 2 ? smooth(0.2, 0.8, local) : 1;
    plinthA.position.x = P.x - 9 * s;
    plinthB.scale.y = Math.max(0.001, smooth(0, 0.35, s));
    plinthB.visible = s > 0.01;
    tagA.material.opacity = tagB.material.opacity = smooth(0.1, 0.4, s);
    const tint = smooth(0, 0.3, s);
    apps.forEach(ap => {
      ap.a.material.color.copy(white).lerp(new THREE.Color(TYPE[ap.type]), tint);
      const ax = P.x - 9 * s + ap.gx, bx = P.x + 9 + ap.gx;
      if (ap.type === 0) { // rebuilt on the new platform, retired on the old one
        const m = smooth(0.3, 1, s);
        ap.a.position.set(ax + (bx - ax) * m, 0.6 + Math.sin(Math.PI * m) * 4, P.z + ap.gz);
      } else {
        ap.a.position.x = ax;
        ap.a.scale.x = ap.type === 1 ? 1 - 0.5 * smooth(0.3, 0.6, s) : 1;
        ap.twin.position.x = bx;
        ap.twin.scale.y = Math.max(0.001, smooth(0.45, 0.9, s));
        ap.twin.visible = ap.twin.scale.y > 0.01;
      }
    });

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
