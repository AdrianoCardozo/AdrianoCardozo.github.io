// Os dois personagens como bonecos de ação articulados (estilo stop-motion):
// cabeça esculpida pintada à mão, juntas esféricas aparentes, mãos de plástico
// e roupa de tecido.
//  A: pele parda, dreads pretos até o pescoço, óculos escuro, cigarro.
//     Meio deitado no sofá, olhando pra cima, balançando a cabeça e o pé.
//  B: degradê americano baixo, boné pra trás, óculos de grau.
//     Na cadeira do computador, produzindo e balançando a cabeça.
import * as THREE from './three.module.min.js';
import { mat, plastic, fabric, metal, canvasTex, rbox, tube, ball, grain, weave, rand, hash } from './ps2.js';

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

const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (k) => k * k * (3 - 2 * k);
const clamp01 = (k) => Math.max(0, Math.min(1, k));

// Pulso de "balanço de cabeça": desce rápido no tempo e volta devagar.
function nod(phase) {
  const down = Math.min(phase / 0.15, 1);
  const up = Math.max(0, (phase - 0.15) / 0.85);
  return phase < 0.15 ? Math.sin(down * PI * 0.5) : Math.cos(up * PI * 0.5) ** 2;
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  if (k < 0) c.multiplyScalar(1 + k);
  else c.lerp(new THREE.Color(1, 1, 1), k);
  return '#' + c.getHexString();
}

// ---------------- texturas ----------------
// Cabeça: textura envolvendo a esfera (u = volta, frente em x = 32).
function headTex(skin, o) {
  return canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = skin;
    g.fillRect(0, 0, w, h);
    // volume pintado: maçãs do rosto, sombra sob o queixo e na nuca
    const blush = g.createRadialGradient(32, 34, 2, 32, 34, 22);
    blush.addColorStop(0, shade(skin, 0.08));
    blush.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = blush;
    g.fillRect(0, 0, w, h);
    const low = g.createLinearGradient(0, 44, 0, 64);
    low.addColorStop(0, 'rgba(0,0,0,0)');
    low.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = low;
    g.fillRect(0, 0, w, h);

    if (o.hair === 'fade') {
      // degradê americano baixo: cabelo curto em cima, laterais esfumadas
      const hair = '#0d0907';
      for (let x = 0; x < w; x += 0.5) {
        const dx = Math.min(Math.abs(x - 32), w - Math.abs(x - 32)); // distância da frente
        const line = dx < 14 ? 15 + (dx / 14) * 3 : 18 + Math.min(1, (dx - 14) / 10) * 9; // contorno
        g.fillStyle = hair;
        g.fillRect(x, 0, 0.6, line);
        const fade = g.createLinearGradient(0, line, 0, line + 9);
        fade.addColorStop(0, 'rgba(13,9,7,0.75)');
        fade.addColorStop(1, 'rgba(13,9,7,0)');
        g.fillStyle = fade;
        g.fillRect(x, line, 0.6, 9);
      }
    } else {
      // couro cabeludo escuro (dreads saem daqui)
      g.fillStyle = '#100c0a';
      g.fillRect(0, 0, w, 15);
      for (let x = 0; x < w; x += 0.5) {
        const dx = Math.min(Math.abs(x - 32), w - Math.abs(x - 32));
        g.fillRect(x, 0, 0.6, dx < 13 ? 16 : 26);
      }
    }
    // sobrancelhas grossas
    g.fillStyle = '#120c09';
    g.beginPath();
    g.ellipse(25, 25.3, 5, 1.1, 0.12, 0, PI * 2);
    g.ellipse(39, 25.3, 5, 1.1, -0.12, 0, PI * 2);
    g.fill();
    if (o.eyes) {
      for (const ex of [25, 39]) {
        g.fillStyle = '#efe6d8';
        g.beginPath();
        g.ellipse(ex, 29, 3.2, 1.6, 0, 0, PI * 2);
        g.fill();
        g.fillStyle = '#2a170c';
        g.beginPath();
        g.arc(ex + (ex < 32 ? 0.6 : -0.6), 29, 1.4, 0, PI * 2);
        g.fill();
        g.fillStyle = '#000';
        g.beginPath();
        g.arc(ex + (ex < 32 ? 0.6 : -0.6), 29, 0.6, 0, PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.fillRect(ex + 0.2, 28.2, 0.5, 0.5);
        g.strokeStyle = shade(skin, -0.5);
        g.lineWidth = 0.5;
        g.beginPath();
        g.ellipse(ex, 29, 3.3, 1.7, 0, PI * 1.05, PI * 1.95);
        g.stroke();
      }
    }
    // sombra do nariz (o nariz em si é geometria)
    g.fillStyle = shade(skin, -0.25);
    g.beginPath();
    g.ellipse(32, 37.5, 3.6, 1.5, 0, 0, PI * 2);
    g.fill();
    // boca
    g.fillStyle = o.lips;
    g.beginPath();
    g.ellipse(32, 42.3, 4.6, 1.5, 0, 0, PI * 2);
    g.fill();
    g.strokeStyle = shade(o.lips, -0.5);
    g.lineWidth = 0.45;
    g.beginPath();
    g.moveTo(27.6, 42.2);
    g.quadraticCurveTo(32, 43, 36.4, 42.2);
    g.stroke();
    // barba
    if (o.beard) {
      g.fillStyle = 'rgba(14,9,7,0.92)';
      g.beginPath();
      g.ellipse(32, 40.2, 5.2, 0.9, 0, 0, PI * 2); // bigode
      g.fill();
      g.beginPath();
      if (o.beard === 'full') {
        g.moveTo(18, 30);
        g.quadraticCurveTo(19, 52, 32, 54);
        g.quadraticCurveTo(45, 52, 46, 30);
        g.lineTo(44, 31);
        g.quadraticCurveTo(43, 46, 36, 45.5);
        g.lineTo(28, 45.5);
        g.quadraticCurveTo(21, 46, 20, 31);
      } else {
        g.ellipse(32, 48, 4, 4, 0, 0, PI * 2); // cavanhaque
      }
      g.fill();
    }
    grain(g, w, h, 10, o.seed || 3);
  });
}

// Tronco: textura em volta do cilindro, frente no centro do canvas (offset 0.5).
function wrapTex(w, h, draw) {
  const t = canvasTex(w, h, draw);
  t.offset.x = 0.5;
  return t;
}

function hoodieTex() {
  return wrapTex(96, 48, (g, w, h) => {
    g.fillStyle = '#1d1c21';
    g.fillRect(0, 0, w, h);
    weave(g, w, h, 0.09, 11);
    // lavado/desbotado irregular
    const r = rand(12);
    for (let i = 0; i < 30; i++) {
      g.fillStyle = `rgba(90,88,100,${0.04 + r() * 0.06})`;
      g.beginPath();
      g.ellipse(r() * w, r() * h, 2 + r() * 6, 1 + r() * 4, r() * PI, 0, PI * 2);
      g.fill();
    }
    // costuras laterais
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(23.8, 0, 0.4, h);
    g.fillRect(71.8, 0, 0.4, h);
    // coração de espinhos pingando (serigrafia rachada)
    const cx = 48;
    const cy = 17;
    g.fillStyle = '#b8141c';
    g.beginPath();
    g.moveTo(cx, cy + 9);
    g.bezierCurveTo(cx - 13, cy + 1, cx - 8, cy - 9, cx, cy - 3);
    g.bezierCurveTo(cx + 8, cy - 9, cx + 13, cy + 1, cx, cy + 9);
    g.fill();
    [[-5, 4], [-1.5, 7], [3, 3], [6, 5]].forEach(([x, l]) => {
      g.fillRect(cx + x, cy + 4, 1, l + 3);
      g.beginPath();
      g.arc(cx + x + 0.5, cy + 7 + l, 0.8, 0, PI * 2);
      g.fill();
    });
    g.strokeStyle = '#e8e1d4';
    g.lineWidth = 0.7;
    g.beginPath();
    g.ellipse(cx, cy + 1, 11, 8, 0.15, 0, PI * 2);
    g.stroke();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * PI * 2;
      const x = cx + Math.cos(a) * 11;
      const y = cy + 1 + Math.sin(a) * 8;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a + 0.6) * 2, y + Math.sin(a + 0.6) * 2);
      g.stroke();
    }
    g.fillStyle = '#e8e1d4';
    g.font = 'bold 4.2px Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText('SEM SINAL', cx, 33);
    // rachaduras da estampa
    g.strokeStyle = 'rgba(29,28,33,0.8)';
    g.lineWidth = 0.15;
    for (let i = 0; i < 25; i++) {
      const x = cx - 12 + r() * 24;
      const y = cy - 8 + r() * 26;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 3, y + (r() - 0.5) * 3);
      g.stroke();
    }
    // bolso canguru e cordões
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 0.4;
    g.strokeRect(36, 37, 24, 14);
    g.fillStyle = '#cfc8bb';
    g.fillRect(45, 0, 0.9, 11);
    g.fillRect(50.2, 0, 0.9, 12);
  });
}

function jacketTex() {
  return wrapTex(96, 48, (g, w, h) => {
    g.fillStyle = '#7c522c';
    g.fillRect(0, 0, w, h);
    weave(g, w, h, 0.12, 5);
    const r = rand(6);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(50,28,12,${0.05 + r() * 0.08})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 3, 0.3 + r());
    }
    // camiseta branca aparecendo na frente aberta
    g.fillStyle = '#e8e3d8';
    g.fillRect(42, 0, 12, h);
    weave(g, 12, h, 0.05, 7);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(42, 0, 1.2, h);
    g.fillRect(52.8, 0, 1.2, h);
    // zíper e costuras duplas em amarelo
    g.fillStyle = '#3a2412';
    g.fillRect(41, 0, 1, h);
    g.fillRect(54, 0, 1, h);
    g.strokeStyle = 'rgba(214,170,90,0.8)';
    g.lineWidth = 0.25;
    g.setLineDash([0.6, 0.4]);
    for (const x of [39.8, 56.2]) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    // bolsos no peito
    for (const x of [30, 58]) {
      g.strokeRect(x, 14, 8, 9);
      g.beginPath();
      g.moveTo(x, 16);
      g.lineTo(x + 8, 16);
      g.stroke();
    }
    g.setLineDash([]);
    // estrela de 4 pontas na camiseta
    g.fillStyle = '#111';
    g.beginPath();
    g.moveTo(48, 12);
    g.lineTo(49, 16);
    g.lineTo(53, 17);
    g.lineTo(49, 18);
    g.lineTo(48, 22);
    g.lineTo(47, 18);
    g.lineTo(43, 17);
    g.lineTo(47, 16);
    g.fill();
  });
}

function clothTex(base, seed, extra) {
  return canvasTex(32, 32, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    weave(g, w, h, 0.1, seed);
    // dobras do tecido: vincos escuros com borda clara
    const r = rand(seed + 50);
    for (let i = 0; i < 9; i++) {
      const y = r() * h;
      const x0 = r() * w;
      const len = 6 + r() * 12;
      const tilt = (r() - 0.5) * 6;
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(0,0,0,0.28)';
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(x0, y);
      g.quadraticCurveTo(x0 + len / 2, y + tilt * 0.5 + 1, x0 + len, y + tilt);
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.07)';
      g.lineWidth = 0.5;
      g.beginPath();
      g.moveTo(x0, y - 0.7);
      g.quadraticCurveTo(x0 + len / 2, y + tilt * 0.5 + 0.3, x0 + len, y + tilt - 0.7);
      g.stroke();
    }
    if (extra) extra(g, w, h);
    grain(g, w, h, 8, seed + 1);
  });
}

const denim = (base, seed) =>
  clothTex(base, seed, (g, w, h) => {
    // desgaste claro e calça "empilhada" embaixo
    const r = rand(seed + 9);
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `rgba(200,210,230,${r() * 0.07})`;
      g.fillRect(r() * w, r() * h, 0.3, 1 + r() * 2);
    }
    for (let y = 20; y < h; y += 2.5) {
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(0, y, w, 0.6);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(0, y + 0.6, w, 0.5);
    }
  });

function dreadTex() {
  return canvasTex(8, 32, (g, w, h) => {
    g.fillStyle = '#15100d';
    g.fillRect(0, 0, w, h);
    const r = rand(41);
    for (let y = 0; y < h; y += 1.2 + r() * 0.8) {
      g.fillStyle = `rgba(80,62,50,${0.25 + r() * 0.3})`;
      g.fillRect(0, y, w, 0.5);
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(0, y + 0.6, w, 0.3);
    }
    grain(g, w, h, 18, 42);
  });
}

function shadesTex() {
  return canvasTex(16, 8, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#120518');
    grd.addColorStop(0.55, '#5a0f3a');
    grd.addColorStop(1, '#c2301e');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,235,255,0.55)';
    g.beginPath();
    g.ellipse(4, 2.2, 2.2, 0.6, -0.3, 0, PI * 2);
    g.fill();
  });
}

// ---------------- esqueleto ----------------
function hand(parent, skinM, side) {
  // palma + dedos dobrados + polegar, com o pino do pulso aparente
  add(parent, tube(0.022, 0.022, 0.03, skinM, 10), 0, 0.0, 0);
  add(parent, rbox(0.035, 0.085, 0.075, skinM, 0.014), 0, -0.05, 0);
  const f = add(parent, rbox(0.03, 0.06, 0.07, skinM, 0.012), side * -0.008, -0.1, 0.004);
  f.rotation.z = side * -0.45;
  const th = add(parent, rbox(0.022, 0.05, 0.022, skinM, 0.009), side * -0.012, -0.05, 0.042);
  th.rotation.x = 0.5;
}

function shoe(parent, upperM, soleM, accentM) {
  const g = pivot(parent, 0, -0.015, 0.045);
  add(g, rbox(0.13, 0.095, 0.27, upperM, 0.04), 0, 0.01, 0);
  add(g, rbox(0.15, 0.045, 0.31, soleM, 0.02), 0, -0.05, 0.005);
  add(g, rbox(0.135, 0.02, 0.1, accentM, 0.008), 0, 0.055, 0.04); // língua/cadarço
  return g;
}

function skeleton({ skin, torsoMat, sleeveMat, pantsMat, shoeMats, torsoR = 0.26 }) {
  const root = new THREE.Group();
  const skinM = plastic({ color: skin });
  const hips = pivot(root, 0, 0.95, 0);
  add(hips, rbox(0.4, 0.17, 0.27, pantsMat, 0.06), 0, -0.02, 0); // pelve
  const torso = pivot(hips, 0, 0, 0);
  const chest = add(torso, new THREE.Mesh(new THREE.CylinderGeometry(torsoR, torsoR * 0.86, 0.62, 24, 4), torsoMat), 0, 0.31, 0);
  chest.scale.z = 0.6;
  // ombros arredondados do moletom/jaqueta
  add(torso, ball(torsoR * 0.98, 0.07, torsoR * 0.6, torsoMat), 0, 0.6, 0);
  const neck = pivot(torso, 0, 0.62, 0);
  add(neck, tube(0.048, 0.054, 0.12, skinM), 0, 0.03, 0);
  const head = pivot(neck, 0, 0.07, 0.005);

  const arm = (side) => {
    const sh = pivot(torso, side * (torsoR + 0.04), 0.54, 0);
    add(sh, ball(0.082, 0.082, 0.082, sleeveMat), 0, 0, 0);
    add(sh, tube(0.077, 0.07, 0.3, sleeveMat), 0, -0.15, 0);
    const el = pivot(sh, 0, -0.3, 0);
    add(el, ball(0.07, 0.07, 0.07, sleeveMat), 0, 0, 0);
    add(el, tube(0.068, 0.06, 0.27, sleeveMat), 0, -0.13, 0);
    add(el, tube(0.063, 0.063, 0.03, sleeveMat), 0, -0.265, 0); // punho
    const hd = pivot(el, 0, -0.29, 0);
    hand(hd, skinM, side);
    return { sh, el, hand: hd };
  };
  const leg = (side) => {
    const th = pivot(hips, side * 0.11, -0.03, 0);
    add(th, ball(0.1, 0.1, 0.1, pantsMat), 0, 0, 0);
    add(th, tube(0.1, 0.092, 0.45, pantsMat), 0, -0.22, 0);
    const kn = pivot(th, 0, -0.45, 0);
    add(kn, ball(0.093, 0.093, 0.093, pantsMat), 0, 0, 0);
    add(kn, tube(0.092, 0.108, 0.42, pantsMat), 0, -0.2, 0);
    const ft = pivot(kn, 0, -0.43, 0);
    shoe(ft, ...shoeMats);
    return { th, kn, ft };
  };
  return { root, hips, torso, neck, head, skinM, armL: arm(1), armR: arm(-1), legL: leg(1), legR: leg(-1) };
}

// cabeça esculpida: esfera pintada + nariz, orelhas e queixo em volume
function sculptHead(s, skin, tex) {
  const sk = s.skinM;
  const headM = plastic({ map: tex });
  const h = add(s.head, ball(0.108, 0.135, 0.12, headM, 28), 0, 0.135, 0);
  add(s.head, ball(0.075, 0.05, 0.07, headM, 16), 0, 0.045, 0.035); // mandíbula
  const nose = add(s.head, rbox(0.032, 0.05, 0.03, sk, 0.012), 0, 0.118, 0.113);
  nose.rotation.x = -0.2;
  add(s.head, ball(0.024, 0.014, 0.016, sk), 0, 0.097, 0.118); // ponta do nariz
  for (const sx of [1, -1]) {
    add(s.head, ball(0.016, 0.034, 0.024, sk), sx * 0.106, 0.13, -0.005);
  }
  return h;
}

function chain(parent, color, y, w, z = 0.16) {
  const m = metal({ color });
  const r = rand(4);
  for (let i = 0; i < 13; i++) {
    const a = (i / 12) * PI;
    const l = add(parent, rbox(0.024, 0.016, 0.014, m, 0.006), Math.cos(a) * w, y - Math.sin(a) * 0.13 + (r() - 0.5) * 0.004, z);
    l.rotation.z = a - PI / 2 + (i % 2) * 0.5;
  }
  add(parent, rbox(0.045, 0.055, 0.016, m, 0.01), 0, y - 0.155, z + 0.005); // pingente
}

function jitter(a, k, amt = 0.012) {
  // "respiração" do stop-motion: cada pose é ajustada à mão, nunca idêntica
  return (hash(a.pose * 7.31 + k * 1.93) - 0.5) * 2 * amt;
}

// ---------------- personagem A ----------------
export function buildA() {
  const skin = '#9b6644'; // pardo
  const sleeve = fabric({ map: clothTex('#1d1c21', 13) });
  const s = skeleton({
    skin,
    torsoMat: fabric({ map: hoodieTex() }),
    sleeveMat: sleeve,
    pantsMat: fabric({ map: denim('#5e5843', 21) }), // cargo cáqui escuro
    shoeMats: [plastic({ color: 0x8c806c, spec: 0.15 }), plastic({ color: 0xd9d2c3, spec: 0.1 }), fabric({ color: 0x5d544a })],
    torsoR: 0.27,
  });
  // capuz caído nas costas
  add(s.torso, ball(0.19, 0.085, 0.09, sleeve), 0, 0.6, -0.15);
  // bolsos laterais da cargo
  const pocket = fabric({ map: denim('#4c4736', 22) });
  add(s.legL.th, rbox(0.035, 0.14, 0.13, pocket, 0.01), 0.1, -0.27, 0);
  add(s.legR.th, rbox(0.035, 0.14, 0.13, pocket, 0.01), -0.1, -0.27, 0);
  chain(s.torso, 0xd8dde6, 0.62, 0.11);

  const headMesh = sculptHead(s, skin, headTex(skin, { eyes: false, beard: 'goatee', lips: '#6e3d2d', seed: 5 }));
  // couro cabeludo
  const hairM = fabric({ color: 0x100c0a });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, PI * 2, 0, PI / 2), hairM);
  cap.scale.set(0.114, 0.11, 0.126);
  add(s.head, cap, 0, 0.165, -0.004);

  // dreads: presos ao topo da cabeça, caindo até o pescoço
  const dreadM = fabric({ map: dreadTex() });
  const bead = metal({ color: 0xd8dde6 });
  const dreads = [];
  const r = rand(77);
  const N = 30;
  for (let i = 0; i < N; i++) {
    const row = i % 2;
    const a = -PI * 0.8 + (i / (N - 1)) * PI * 1.6; // 0 = nuca, deixa a testa livre
    const len = 0.26 + r() * 0.09 - row * 0.04;
    const rad = 0.098 - row * 0.03;
    const p = pivot(s.head, Math.sin(a) * rad, 0.235 + row * 0.03, -Math.cos(a) * rad * 1.1);
    const d = add(p, tube(0.021, 0.018, len, dreadM, 8), 0, -len / 2, 0);
    d.rotation.y = r() * PI;
    add(p, ball(0.019, 0.016, 0.019, dreadM, 8), 0, -len, 0); // ponta arredondada
    if (i % 5 === 2) add(p, tube(0.025, 0.025, 0.025, bead, 12), 0, -len + 0.05, 0);
    const out = 0.12 + r() * 0.1 + row * 0.12;
    p.userData = { a, out, ph: r() * PI * 2 };
    dreads.push(p);
  }

  // óculos escuro estiloso (lente envolvente espelhada)
  const lens = mat({ map: shadesTex(), emissive: 0.35, spec: 2.2, shine: 90 });
  const frameM = metal({ color: 0xc9ccd2 });
  const shades = pivot(s.head, 0, 0.158, 0.118);
  for (const sx of [1, -1]) {
    const l = add(shades, rbox(0.092, 0.046, 0.01, lens, 0.012), sx * 0.05, 0, 0);
    l.rotation.y = sx * 0.22;
    add(shades, rbox(0.006, 0.008, 0.17, frameM, 0.002), sx * 0.104, 0.016, -0.085);
  }
  add(shades, rbox(0.2, 0.007, 0.012, frameM, 0.003), 0, 0.026, 0.004);

  // cigarro entre os dedos da mão direita
  const cig = pivot(s.armR.hand, 0.0, -0.105, 0.03);
  cig.rotation.set(PI / 2 - 0.3, 0, 0);
  add(cig, tube(0.0055, 0.0055, 0.075, mat({ color: 0xf0ece2, spec: 0.05 }), 8), 0, 0.03, 0);
  add(cig, tube(0.006, 0.006, 0.02, mat({ color: 0xc58a3c }), 8), 0, -0.012, 0);
  const emberM = mat({ color: 0xff5a14, emissive: 1.6, unlit: true });
  const ember = add(cig, tube(0.0058, 0.0058, 0.008, emberM, 8), 0, 0.071, 0);
  add(cig, tube(0.0058, 0.0058, 0.006, mat({ color: 0x77736c }), 8), 0, 0.064, 0); // cinza

  // anéis
  const ring = metal({ color: 0xd8dde6 });
  add(s.armR.hand, tube(0.026, 0.026, 0.012, ring, 12), 0, -0.1, 0);
  add(s.armL.hand, tube(0.026, 0.026, 0.012, ring, 12), 0, -0.1, 0);

  const mouth = pivot(s.head, 0, 0.07, 0.115);
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  function update(a) {
    const bp = a.beatPhase;
    const j = (k, amt) => jitter(a, k, amt);
    const n = nod(bp);
    // tragada a cada 2 compassos: leva o cigarro à boca, segura, solta a fumaça
    const c = a.beatF % 8;
    const up = smooth(clamp01((c - 4) / 0.6)) * (1 - smooth(clamp01((c - 5.6) / 0.6)));
    const exhale = c > 5.7 && c < 7.8 ? Math.sin(((c - 5.7) / 2.1) * PI) : 0;

    // meio deitado: quadril na beira do assento, costas no encosto
    s.hips.position.set(0, 0.5, 0.06);
    s.hips.rotation.x = -0.12;
    s.torso.rotation.set(-0.42 + 0.03 * n + j(1), j(2), j(3));
    // cabeça pra trás, olhando pro teto, balançando no tempo
    s.neck.rotation.set(-0.38 + 0.2 * n + j(4, 0.02), 0.08 + j(5), 0.05 * Math.sin((a.beatF / 2) * PI));
    s.head.rotation.set(-0.22 + 0.06 * n - 0.1 * exhale, -0.05 + j(6), j(7));
    // pernas esticadas; o pé direito batendo no tempo
    const tap = Math.sin(PI * bp) ** 2;
    s.legL.th.rotation.set(-1.22 + j(8), 0.1, 0.16);
    s.legL.kn.rotation.x = 0.42;
    s.legL.ft.rotation.set(0.72, 0, -0.08);
    s.legR.th.rotation.set(-1.12 + 0.04 * tap + j(9), -0.08, -0.06);
    s.legR.kn.rotation.x = 0.62 - 0.06 * tap;
    s.legR.ft.rotation.set(0.62 - 0.55 * tap, 0, 0.05);
    // braço esquerdo largado no encosto
    s.armL.sh.rotation.set(0.35 + j(10), 0.2, 1.15);
    s.armL.el.rotation.set(-0.35, 0, -0.85);
    s.armL.hand.rotation.set(0, 0, -0.3);
    // braço direito: apoiado / levando o cigarro à boca
    s.armR.sh.rotation.set(lerp(-0.25, -1.05, up) + j(11), lerp(0.15, 0.5, up), lerp(-0.42, -0.2, up));
    s.armR.el.rotation.set(lerp(-1.25, -2.25, up) + 0.08 * n * (1 - up), lerp(0, 0.2, up), 0);
    s.armR.hand.rotation.set(lerp(0.2, 0.5, up), lerp(0.5, 0.9, up), 0);
    // dreads com inércia: caem pra trás porque a cabeça está inclinada
    const lag = nod((bp + 0.88) % 1);
    dreads.forEach((p, i) => {
      const { a: ang, out, ph } = p.userData;
      const sway = 0.05 * Math.sin(a.beatF * PI + ph) + j(20 + i, 0.02);
      p.rotation.x = Math.cos(ang) * (out + 0.18 * lag) + 0.35 + sway;
      p.rotation.z = Math.sin(ang) * out * 1.2;
    });
    // brasa: acende forte na tragada
    const glow = 0.55 + 0.25 * Math.sin(a.beatF * PI * 3) + 0.4 * a.high + 1.6 * (c > 4.5 && c < 5.6 ? 1 : 0);
    emberM.uniforms.uColor.value.set(1, 0.28 + 0.12 * Math.min(glow, 1.5), 0.05);
    emberM.uniforms.uEmissive.value.setScalar(1 + glow);
    ember.getWorldPosition(tmp);
    mouth.getWorldPosition(tmp2);
    return { ember: tmp.clone(), glow, mouth: tmp2.clone(), exhale, puffing: up };
  }

  return { group: s.root, update, head: s.head, headMesh, foot: s.legR.ft };
}

// ---------------- personagem B ----------------
export function buildB() {
  const skin = '#6b4329';
  const jacketM = fabric({ map: jacketTex() });
  const sleeve = fabric({ map: clothTex('#6a4524', 31) });
  const s = skeleton({
    skin,
    torsoMat: jacketM,
    sleeveMat: sleeve,
    pantsMat: fabric({ map: denim('#34425e', 33) }), // jeans largo
    shoeMats: [plastic({ color: 0x161616, spec: 0.25 }), plastic({ color: 0x3a1410, spec: 0.1 }), fabric({ color: 0x222222 })],
    torsoR: 0.265,
  });
  chain(s.torso, 0xe0b54a, 0.62, 0.1);
  // capuz cinza do moletom por baixo da jaqueta
  const hoodM = fabric({ map: clothTex('#5f5d5a', 35) });
  add(s.torso, ball(0.15, 0.08, 0.08, hoodM), 0, 0.6, -0.16);
  add(s.armL.el, tube(0.064, 0.064, 0.04, hoodM), 0, -0.28, 0);
  add(s.armR.el, tube(0.064, 0.064, 0.04, hoodM), 0, -0.28, 0);
  // gola de veludo
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 18, PI * 1.4), fabric({ color: 0x3d2614 }));
  collar.rotation.set(PI / 2, 0, PI * 0.8);
  add(s.torso, collar, 0, 0.62, -0.01);

  sculptHead(s, skin, headTex(skin, { eyes: true, beard: 'full', lips: '#4a281c', hair: 'fade', seed: 8 }));
  // boné de beisebol virado pra trás
  const capM = fabric({ map: clothTex('#121212', 51), spec: 0.04 });
  const capRed = plastic({ color: 0x9e1620, spec: 0.12 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, PI * 2, 0, PI / 2), capM);
  dome.scale.set(0.121, 0.1, 0.133);
  add(s.head, dome, 0, 0.19, -0.004);
  add(s.head, ball(0.012, 0.007, 0.012, capM), 0, 0.29, -0.004); // botão
  const bill = add(s.head, rbox(0.17, 0.012, 0.12, capRed, 0.005), 0, 0.2, -0.17);
  bill.rotation.x = -0.12;
  // abertura do snapback na testa
  add(s.head, rbox(0.06, 0.012, 0.008, plastic({ color: 0xbdbdbd }), 0.003), 0, 0.212, 0.128);

  // óculos de grau: armação grossa de acetato preto com detalhe dourado
  const fr = plastic({ color: 0x0b0b0b, spec: 0.9, shine: 80 });
  const gold = metal({ color: 0xe0b54a });
  const lensM = mat({ color: 0xcfeaff, emissive: 0.15, opacity: 0.22, spec: 2.5, shine: 120 });
  const gl = pivot(s.head, 0, 0.155, 0.122);
  for (const sx of [1, -1]) {
    add(gl, rbox(0.088, 0.012, 0.012, fr, 0.005), sx * 0.052, 0.024, 0);
    add(gl, rbox(0.088, 0.009, 0.012, fr, 0.004), sx * 0.052, -0.022, 0);
    add(gl, rbox(0.011, 0.054, 0.012, fr, 0.004), sx * 0.096, 0.001, 0);
    add(gl, rbox(0.009, 0.046, 0.012, fr, 0.004), sx * 0.009, 0.001, 0);
    add(gl, rbox(0.08, 0.042, 0.003, lensM, 0.001), sx * 0.052, 0.001, 0.001);
    add(gl, rbox(0.006, 0.01, 0.17, gold, 0.002), sx * 0.104, 0.02, -0.085);
  }
  add(gl, rbox(0.02, 0.007, 0.012, gold, 0.003), 0, 0.018, 0.002);

  // relógio
  add(s.armL.el, tube(0.068, 0.068, 0.035, gold, 16), 0, -0.24, 0);

  function update(a) {
    const bp = a.beatPhase;
    const j = (k, amt) => jitter(a, k, amt);
    const n = nod(bp);
    // no último compasso de cada frase vira pro amigo, ainda balançando
    const barPos = (a.beatF % 16) / 4;
    const look = smooth(clamp01((barPos - 3.0) / 0.35)) * (1 - smooth(clamp01((barPos - 3.75) / 0.25)));
    // sentado, inclinado pra tela
    s.hips.position.set(0, 0.53, 0);
    s.legL.th.rotation.set(-PI / 2 + 0.08, 0, 0.16);
    s.legR.th.rotation.set(-PI / 2 + 0.06, 0, -0.12);
    s.legL.kn.rotation.x = PI / 2 - 0.25;
    s.legR.kn.rotation.x = PI / 2 + 0.1 - 0.08 * Math.sin(PI * ((bp + 0.5) % 1)) ** 2;
    s.legL.ft.rotation.x = 0.1;
    s.legR.ft.rotation.x = -0.05;
    s.torso.rotation.set(0.14 + 0.05 * n + j(1), 0.05 * look + j(2), j(3));
    s.neck.rotation.set(-0.16 + 0.3 * n + j(4, 0.02), -0.25 * look, 0);
    s.head.rotation.set(-0.1 + 0.06 * n, -0.75 * look + 0.08 * Math.sin((a.beatF / 8) * PI * 2) + j(5), -0.05 * Math.sin((a.beatF / 2) * PI));
    // mão direita no mouse: pequenos deslocamentos e cliques
    const mx = Math.sin(a.beatF * PI * 0.375) * 0.05 + Math.sin(a.beatF * PI / 16) * 0.04; // períodos que fecham no loop
    s.armR.sh.rotation.set(-1.02 + j(6), mx, 0.12);
    s.armR.el.rotation.set(-0.28 + 0.03 * Math.sin(a.beatF * PI / 4), 0, 0);
    s.armR.hand.rotation.set(0.35 + (a.beat % 2 === 1 && bp < 0.2 ? 0.12 : 0), 0, 0.15);
    // mão esquerda no teclado, digitando/marcando notas
    const type = hash(Math.floor(a.beatF * 4) * 3.7) > 0.5 ? 1 : 0;
    s.armL.sh.rotation.set(-1.0 + j(7), -0.05, -0.16);
    s.armL.el.rotation.set(-0.32 + 0.07 * type, 0, 0);
    s.armL.hand.rotation.set(0.4 + 0.15 * type, 0, -0.1);
  }

  return { group: s.root, update, head: s.head };
}
