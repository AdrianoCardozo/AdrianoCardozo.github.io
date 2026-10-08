// Os dois personagens, montados com caixas low-poly + texturas minúsculas.
//  A: pele parda, dreads pretos até o pescoço, óculos escuro, cigarro.
//  B: degradê americano baixo, boné de beisebol pra trás, óculos de grau.
import * as THREE from './three.module.min.js';
import { mat, canvasTex, box, tube, grain, rand } from './ps2.js';

const PI = Math.PI;

function pivot(parent, x = 0, y = 0, z = 0) {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  parent.add(p);
  return p;
}

function add(parent, mesh, x = 0, y = 0, z = 0) {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// Pulso de "balanço de cabeça": desce rápido no tempo e volta devagar.
function nod(phase) {
  const down = Math.min(phase / 0.12, 1);
  const up = Math.max(0, (phase - 0.12) / 0.88);
  return phase < 0.12 ? Math.sin(down * PI * 0.5) : Math.cos(up * PI * 0.5) ** 2;
}

// ---------------- texturas ----------------
function faceTex(skin, { eyes, beard, lips }) {
  return canvasTex(32, 36, (g, w, h) => {
    g.fillStyle = skin;
    g.fillRect(0, 0, w, h);
    const dark = shade(skin, -0.28);
    const darker = shade(skin, -0.5);
    // sombra das bochechas
    g.fillStyle = shade(skin, -0.12);
    g.fillRect(0, 0, 3, h);
    g.fillRect(w - 3, 0, 3, h);
    // sobrancelhas
    g.fillStyle = '#120c0a';
    g.fillRect(6, 11, 8, 2);
    g.fillRect(18, 11, 8, 2);
    if (eyes) {
      g.fillStyle = '#e8ddd0';
      g.fillRect(7, 15, 6, 3);
      g.fillRect(19, 15, 6, 3);
      g.fillStyle = '#1a0e08';
      g.fillRect(9, 15, 3, 3);
      g.fillRect(20, 15, 3, 3);
      g.fillStyle = darker;
      g.fillRect(7, 14, 6, 1);
      g.fillRect(19, 14, 6, 1);
    }
    // nariz
    g.fillStyle = dark;
    g.fillRect(14, 16, 4, 7);
    g.fillStyle = darker;
    g.fillRect(13, 22, 2, 2);
    g.fillRect(17, 22, 2, 2);
    // barba
    if (beard) {
      g.fillStyle = 'rgba(15,8,6,0.85)';
      g.fillRect(10, 25, 12, 2); // bigode
      g.fillRect(4, 26, 3, 10);
      g.fillRect(w - 7, 26, 3, 10);
      g.fillRect(5, 32, 22, 4);
      g.fillRect(12, 29, 8, 4);
    }
    // boca
    g.fillStyle = lips;
    g.fillRect(11, 27, 10, 3);
    g.fillStyle = darker;
    g.fillRect(11, 28, 10, 1);
    grain(g, w, h, 18, 3);
  });
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  if (k < 0) c.multiplyScalar(1 + k);
  else c.lerp(new THREE.Color(1, 1, 1), k);
  return '#' + c.getHexString();
}

function fadeTex(skin, hair, topHair) {
  // laterais do degradê: cabelo em cima, pele embaixo (american low fade)
  return canvasTex(16, 32, (g, w, h) => {
    for (let y = 0; y < h; y++) {
      const k = y / h;
      g.fillStyle = k < 0.45 ? hair : k < 0.7 ? shade(skin, -0.55 + (k - 0.45) * 1.6) : skin;
      g.fillRect(0, y, w, 1);
    }
    if (topHair) {
      g.fillStyle = hair;
      g.fillRect(0, 0, w, 6);
    }
    grain(g, w, h, 30, 9);
  });
}

function hoodieTex() {
  // moletom preto lavado, gráfico vermelho "coração de espinhos pingando"
  return canvasTex(48, 48, (g, w, h) => {
    g.fillStyle = '#1b1a1d';
    g.fillRect(0, 0, w, h);
    const r = rand(11);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(80,78,90,${0.15 + r() * 0.2})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 3, 1);
    }
    g.fillStyle = '#c4121b';
    const cx = 24;
    const cy = 16;
    // coração em pixels
    const heart = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
    heart.forEach((row, y) => [...row].forEach((ch, x) => ch === 'X' && g.fillRect(cx - 10 + x * 3, cy - 6 + y * 3, 3, 3)));
    // pingos
    [[16, 4], [21, 7], [27, 3], [31, 5]].forEach(([x, l]) => g.fillRect(x, 28, 2, l));
    // espinhos
    g.fillStyle = '#e6e0d6';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PI * 2;
      g.fillRect(cx - 1 + Math.cos(a) * 13, cy + Math.sin(a) * 11, 2, 2);
    }
    // texto em fonte miúda
    g.fillStyle = '#e6e0d6';
    g.fillRect(12, 38, 24, 1);
    g.font = '6px monospace';
    g.fillText('SEM SINAL', 9, 45);
    // bolso canguru
    g.fillStyle = '#121114';
    g.fillRect(10, 36, 28, 1);
  });
}

function jacketTex() {
  // jaqueta de trabalho marrom aberta, camiseta branca no meio, gola de veludo
  return canvasTex(48, 48, (g, w, h) => {
    g.fillStyle = '#7a4f2a';
    g.fillRect(0, 0, w, h);
    const r = rand(5);
    for (let i = 0; i < 140; i++) {
      g.fillStyle = `rgba(40,22,10,${0.15 + r() * 0.25})`;
      g.fillRect(r() * w, r() * h, 1, 1 + r() * 2);
    }
    g.fillStyle = '#e9e4da';
    g.fillRect(17, 0, 14, h);
    g.fillStyle = '#c9c2b5';
    g.fillRect(17, 0, 2, h);
    // gola
    g.fillStyle = '#3d2614';
    g.fillRect(10, 0, 9, 6);
    g.fillRect(29, 0, 9, 6);
    // bolsos e costuras
    g.fillStyle = '#5c3a1c';
    g.fillRect(4, 26, 10, 8);
    g.fillRect(34, 26, 10, 8);
    g.fillStyle = '#b07c3c';
    g.fillRect(4, 26, 10, 1);
    g.fillRect(34, 26, 10, 1);
    // estampa na camiseta: estrela de 4 pontas
    g.fillStyle = '#111';
    g.fillRect(23, 14, 2, 8);
    g.fillRect(20, 17, 8, 2);
  });
}

function denimTex(base) {
  return canvasTex(16, 32, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const r = rand(21);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(255,255,255,${r() * 0.12})`;
      g.fillRect(r() * w, r() * h, 1, 1);
    }
    // pregas (calça empilhada embaixo)
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let y = 20; y < h; y += 4) g.fillRect(0, y, w, 1);
  });
}

function shadesTex() {
  // lente espelhada iridescente: preto -> roxo -> vermelho
  return canvasTex(16, 8, (g, w, h) => {
    for (let y = 0; y < h; y++) {
      const k = y / h;
      g.fillStyle = `rgb(${Math.round(20 + 140 * k)},${Math.round(5 + 10 * k)},${Math.round(60 - 30 * k)})`;
      g.fillRect(0, y, w, 1);
    }
    g.fillStyle = 'rgba(255,220,255,0.7)';
    g.fillRect(2, 1, 3, 1);
    g.fillRect(3, 2, 1, 1);
  });
}

// ---------------- esqueleto ----------------
function skeleton({ skin, torsoMat, sleeveMat, pantsMat, shoeMat, soleMat, torsoW = 0.5 }) {
  const root = new THREE.Group();
  const skinM = mat({ color: skin });
  const hips = pivot(root, 0, 0.95, 0);
  const torso = pivot(hips, 0, 0, 0);
  add(torso, box(torsoW, 0.62, 0.3, torsoMat), 0, 0.31, 0);
  const neck = pivot(torso, 0, 0.62, 0);
  add(neck, tube(0.05, 0.056, 0.12, skinM), 0, 0.03, 0);
  const head = pivot(neck, 0, 0.07, 0.01);

  const arm = (side) => {
    const sh = pivot(torso, side * (torsoW / 2 + 0.04), 0.56, 0);
    add(sh, tube(0.088, 0.078, 0.34, sleeveMat), 0, -0.13, 0);
    add(sh, new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), sleeveMat), 0, 0.0, 0);
    const el = pivot(sh, 0, -0.3, 0);
    add(el, tube(0.078, 0.07, 0.3, sleeveMat), 0, -0.12, 0);
    const hand = pivot(el, 0, -0.29, 0);
    add(hand, box(0.075, 0.1, 0.085, skinM), 0, -0.04, 0);
    add(hand, tube(0.045, 0.045, 0.02, skinM, 8), 0, 0.0, 0);
    return { sh, el, hand };
  };
  const leg = (side) => {
    const th = pivot(hips, side * 0.12, 0, 0);
    add(th, tube(0.115, 0.105, 0.48, pantsMat), 0, -0.22, 0);
    const kn = pivot(th, 0, -0.45, 0);
    add(kn, tube(0.105, 0.12, 0.44, pantsMat), 0, -0.2, 0);
    const ft = pivot(kn, 0, -0.43, 0);
    add(ft, box(0.15, 0.09, 0.3, shoeMat), 0, -0.02, 0.05);
    add(ft, box(0.16, 0.04, 0.32, soleMat), 0, -0.07, 0.05);
    return { th, kn, ft };
  };
  return { root, hips, torso, neck, head, skinM, armL: arm(1), armR: arm(-1), legL: leg(1), legR: leg(-1) };
}

function chain(parent, color, y, w) {
  const m = mat({ color, emissive: 0.15, spec: 1.4 });
  const r = rand(4);
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * PI;
    const l = box(0.03, 0.02, 0.02, m);
    l.position.set(Math.cos(a) * w, y - Math.sin(a) * 0.12 + (r() - 0.5) * 0.005, 0.155);
    parent.add(l);
  }
  add(parent, box(0.05, 0.06, 0.02, m), 0, y - 0.15, 0.16); // pingente
}

// ---------------- personagem A ----------------
export function buildA() {
  const skin = '#9b6644'; // pardo
  const hood = hoodieTex();
  const black = mat({ color: 0x1c1b1f });
  const torsoMat = [black, black, black, black, mat({ map: hood }), black];
  const s = skeleton({
    skin,
    torsoMat,
    sleeveMat: black,
    pantsMat: mat({ map: denimTex('#5d5844') }), // cargo cáqui escuro
    shoeMat: mat({ color: 0x8a7d6a }),
    soleMat: mat({ color: 0xd8d2c4 }),
    torsoW: 0.54,
  });
  // capuz caído nas costas
  add(s.torso, box(0.36, 0.16, 0.12, black), 0, 0.58, -0.17);
  // bolsos laterais da cargo
  const pocket = mat({ color: 0x4a4636 });
  add(s.legL.th, box(0.04, 0.14, 0.14, pocket), 0.11, -0.28, 0);
  add(s.legR.th, box(0.04, 0.14, 0.14, pocket), -0.11, -0.28, 0);
  chain(s.torso, 0xd8dde6, 0.6, 0.11);

  const face = faceTex(skin, { eyes: false, beard: true, lips: '#6b3a2c' });
  const sk = s.skinM;
  const headMesh = add(s.head, box(0.23, 0.27, 0.25, [sk, sk, sk, sk, mat({ map: face }), sk]), 0, 0.135, 0);
  // orelhas
  add(s.head, box(0.03, 0.06, 0.05, sk), 0.125, 0.13, 0);
  add(s.head, box(0.03, 0.06, 0.05, sk), -0.125, 0.13, 0);
  // couro cabeludo
  const hairM = mat({ color: 0x0d0b0b });
  add(s.head, box(0.25, 0.07, 0.27, hairM), 0, 0.27, -0.005);

  // dreads: presos ao topo da cabeça, caindo até o pescoço
  const dreadM = mat({ emissive: 0.12, map: canvasTex(4, 16, (g) => {
    for (let y = 0; y < 16; y++) {
      g.fillStyle = y % 3 === 0 ? '#4a3a32' : y % 3 === 1 ? '#2a221e' : '#16110f';
      g.fillRect(0, y, 4, 1);
    }
  }) });
  const bead = mat({ color: 0xd8dde6, emissive: 0.35, spec: 1.4 });
  const dreads = [];
  const r = rand(77);
  const N = 22;
  for (let i = 0; i < N; i++) {
    // ângulo ao redor da cabeça, deixando a testa livre
    const a = -PI * 0.78 + (i / (N - 1)) * PI * 1.56; // 0 = nuca
    const len = 0.27 + r() * 0.08;
    const p = pivot(s.head, Math.sin(a) * 0.125, 0.27, -Math.cos(a) * 0.13);
    const d = add(p, tube(0.024, 0.02, len, dreadM, 6), 0, -len / 2, 0);
    d.rotation.y = r();
    if (i % 4 === 1) add(p, tube(0.029, 0.029, 0.03, bead, 8), 0, -len + 0.06, 0); // anel de prata no dread
    const out = 0.1 + r() * 0.08;
    p.userData = { a, out, ph: r() * PI * 2 };
    dreads.push(p);
  }

  // óculos escuro estiloso (lente envolvente espelhada)
  const lens = mat({ map: shadesTex(), emissive: 0.5, spec: 2 });
  const frameM = mat({ color: 0xc9ccd2, emissive: 0.2, spec: 1.4 });
  const shades = pivot(s.head, 0, 0.155, 0.13);
  const l1 = add(shades, box(0.11, 0.05, 0.012, lens), 0.055, 0, 0);
  l1.rotation.y = 0.18;
  const l2 = add(shades, box(0.11, 0.05, 0.012, lens), -0.055, 0, 0);
  l2.rotation.y = -0.18;
  add(shades, box(0.24, 0.008, 0.015, frameM), 0, 0.028, -0.005);
  add(shades, box(0.01, 0.01, 0.2, frameM), 0.12, 0.02, -0.1);
  add(shades, box(0.01, 0.01, 0.2, frameM), -0.12, 0.02, -0.1);

  // cigarro no canto da boca
  const cig = pivot(s.head, -0.03, 0.055, 0.125);
  cig.rotation.set(0.35, -0.35, 0);
  add(cig, box(0.012, 0.012, 0.075, mat({ color: 0xeeeae0 })), 0, 0, 0.0375);
  add(cig, box(0.013, 0.013, 0.02, mat({ color: 0xc58a3c })), 0, 0, 0.005);
  const emberM = mat({ color: 0xff5a14, emissive: 1.5, unlit: true });
  const ember = add(cig, box(0.014, 0.014, 0.012, emberM), 0, 0, 0.08);

  // anéis
  const ring = mat({ color: 0xd8dde6, emissive: 0.2, spec: 1.4 });
  add(s.armR.hand, box(0.085, 0.02, 0.095, ring), 0, -0.06, 0);

  const g = s.root;
  const tmp = new THREE.Vector3();

  function update(a) {
    const bp = a.beatPhase;
    const half = ((a.beat % 2) + bp) / 2; // meio-tempo
    const n = nod(bp) * (0.7 + 0.5 * a.kick);
    const n2 = nod(half);
    const heavy = a.section === 2 ? 1.35 : 1;
    // corpo quica junto
    s.hips.position.y = 0.95 - 0.035 * n * heavy;
    s.torso.rotation.x = 0.06 + 0.07 * n2 * heavy;
    s.torso.rotation.y = 0.12 * Math.sin((a.beatF / 4) * PI * 2 * 0.5);
    s.neck.rotation.x = 0.1 + 0.32 * n * heavy;
    s.head.rotation.z = 0.06 * Math.sin((a.beatF / 2) * PI);
    s.head.rotation.y = -0.15 + 0.1 * Math.sin((a.beatF / 8) * PI * 2);
    // pernas: joelhos dobram no tempo
    const k = 0.12 * n * heavy;
    s.legL.th.rotation.x = -k - 0.04;
    s.legL.kn.rotation.x = k * 2;
    s.legL.ft.rotation.x = -k;
    s.legR.th.rotation.x = -k + 0.1;
    s.legR.kn.rotation.x = k * 2;
    s.legR.ft.rotation.x = -k - 0.1;
    s.legL.th.rotation.z = 0.08;
    s.legR.th.rotation.z = -0.08;
    // mão esquerda no bolso do moletom
    s.armL.sh.rotation.set(-0.25, 0, 0.12);
    s.armL.el.rotation.set(-1.1, 0, -0.25);
    // mão direita "regendo" o beat (gesto de trap)
    s.armR.sh.rotation.set(-0.55 - 0.15 * n2, 0.2, -0.35);
    s.armR.el.rotation.set(-1.35 + 0.55 * n, 0, 0.1);
    s.armR.hand.rotation.set(0.6 * n - 0.3, 0, 0);
    // dreads com atraso (inércia)
    const lag = nod((bp + 0.9) % 1) * heavy;
    dreads.forEach((p) => {
      const { a: ang, out, ph } = p.userData;
      const sway = 0.06 * Math.sin(a.beatF * PI + ph);
      p.rotation.x = Math.cos(ang) * (out + 0.3 * lag) + sway;
      p.rotation.z = Math.sin(ang) * out + 0.05 * lag * Math.sin(ang);
    });
    // brasa pulsando
    const glow = 0.6 + 0.4 * Math.sin(a.beatF * PI * 3) * Math.sin(a.beatF * PI * 0.75) + 0.6 * a.high;
    emberM.uniforms.uColor.value.set(1, 0.3 + 0.15 * glow, 0.05);
    ember.scale.setScalar(0.8 + 0.4 * glow);
    ember.getWorldPosition(tmp);
    return { ember: tmp.clone(), glow };
  }

  return { group: g, update, head: s.head, headMesh };
}

// ---------------- personagem B ----------------
export function buildB() {
  const skin = '#6b4329';
  const jack = jacketTex();
  const brown = mat({ color: 0x7a4f2a });
  const s = skeleton({
    skin,
    torsoMat: [brown, brown, brown, brown, mat({ map: jack }), brown],
    sleeveMat: brown,
    pantsMat: mat({ map: denimTex('#262b38') }), // jeans escuro largo
    shoeMat: mat({ color: 0x1a1a1a }),
    soleMat: mat({ color: 0x3a1410 }),
    torsoW: 0.52,
  });
  chain(s.torso, 0xe0b54a, 0.6, 0.1);
  add(s.torso, box(0.3, 0.07, 0.1, mat({ color: 0x3d2614 })), 0, 0.6, -0.12); // gola

  const face = faceTex(skin, { eyes: true, beard: true, lips: '#4a281c' });
  const sk = s.skinM;
  const side = mat({ map: fadeTex(skin, '#0e0a08') });
  const back = mat({ map: fadeTex(skin, '#0e0a08') });
  const top = mat({ color: 0x0e0a08 });
  add(s.head, box(0.23, 0.27, 0.25, [side, side, top, sk, mat({ map: face }), back]), 0, 0.135, 0);
  add(s.head, box(0.03, 0.06, 0.05, sk), 0.125, 0.13, 0);
  add(s.head, box(0.03, 0.06, 0.05, sk), -0.125, 0.13, 0);
  // boné de beisebol virado pra trás
  const capM = mat({ color: 0x111111 });
  const capRed = mat({ color: 0x9e1620 });
  add(s.head, box(0.245, 0.085, 0.265, capM), 0, 0.29, -0.005);
  add(s.head, box(0.2, 0.05, 0.2, capM), 0, 0.33, -0.01);
  const bill = add(s.head, box(0.19, 0.016, 0.13, capRed), 0, 0.255, -0.18);
  bill.rotation.x = -0.12;
  // fecho do snapback na testa (abertura)
  add(s.head, box(0.07, 0.03, 0.01, sk), 0, 0.265, 0.127);
  add(s.head, box(0.07, 0.008, 0.012, mat({ color: 0xcfcfcf })), 0, 0.282, 0.128);

  // óculos de grau: armação grossa de acetato preto com detalhe dourado
  const fr = mat({ color: 0x0c0c0c, emissive: 0.05 });
  const gold = mat({ color: 0xe0b54a, emissive: 0.25, spec: 1.4 });
  const lensM = mat({ color: 0xbfe6ff, emissive: 0.6, opacity: 0.32 });
  const gl = pivot(s.head, 0, 0.152, 0.13);
  for (const sx of [1, -1]) {
    add(gl, box(0.088, 0.014, 0.012, fr), sx * 0.055, 0.03, 0);
    add(gl, box(0.088, 0.01, 0.012, fr), sx * 0.055, -0.026, 0);
    add(gl, box(0.012, 0.06, 0.012, fr), sx * 0.104, 0.002, 0);
    add(gl, box(0.01, 0.05, 0.012, fr), sx * 0.007, 0.004, 0);
    add(gl, box(0.08, 0.044, 0.004, lensM), sx * 0.055, 0.002, 0.002);
    add(gl, box(0.008, 0.012, 0.2, gold), sx * 0.118, 0.025, -0.1);
  }
  add(gl, box(0.02, 0.008, 0.014, gold), 0, 0.022, 0.002);

  // relógio
  add(s.armL.el, box(0.155, 0.04, 0.16, gold), 0, -0.25, 0);

  function update(a) {
    const bp = a.beatPhase;
    const n = nod(bp) * (0.75 + 0.4 * a.kick);
    const heavy = a.section === 2 ? 1.3 : 1;
    // sentado na cadeira
    s.hips.position.y = 0.52;
    s.legL.th.rotation.set(-PI / 2 + 0.05, 0, 0.18);
    s.legR.th.rotation.set(-PI / 2 + 0.05, 0, -0.14);
    s.legL.kn.rotation.x = PI / 2 - 0.15 + 0.08 * nod((bp + 0.5) % 1);
    s.legR.kn.rotation.x = PI / 2 + 0.05;
    s.legL.ft.rotation.x = -0.1;
    s.torso.rotation.x = 0.12 + 0.06 * n * heavy;
    s.neck.rotation.x = 0.05 + 0.3 * n * heavy;
    s.head.rotation.y = 0.35 * Math.sin((a.beatF / 16) * PI * 2) + 0.1;
    s.head.rotation.z = -0.05 * Math.sin((a.beatF / 2) * PI);
    // mãos: uma no teclado/mouse tamborilando, outra solta no ritmo
    s.armR.sh.rotation.set(-0.95, 0, 0.1);
    s.armR.el.rotation.set(-0.7 + 0.12 * n, 0, 0);
    s.armR.hand.rotation.x = 0.25 * n;
    if (a.section === 2) {
      // na parte mais pesada levanta a mão esquerda
      s.armL.sh.rotation.set(-1.6 - 0.25 * n, 0, 0.35);
      s.armL.el.rotation.set(-0.9 + 0.6 * n, 0, 0);
    } else {
      s.armL.sh.rotation.set(-0.95, 0, -0.1);
      s.armL.el.rotation.set(-0.7 + 0.3 * nod((bp * 2) % 1), 0, 0);
    }
  }

  return { group: s.root, update, head: s.head };
}
