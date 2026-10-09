// Os dois personagens como bonecos de ação articulados (estilo stop-motion):
// cabeça esculpida pintada à mão, juntas esféricas aparentes, mãos de plástico
// e roupa de tecido.
//  A: pele parda, dreads pretos até o pescoço, óculos escuro, cigarro.
//     Meio deitado no sofá, olhando pra cima, balançando a cabeça e o pé.
//  B: degradê americano baixo, boné pra trás, óculos de grau.
//     Na cadeira do computador, produzindo e balançando a cabeça.
import * as THREE from './three.module.min.js';
import { mat, plastic, fabric, metal, canvasTex, rbox, tube, ball, grain, weave, rand, hash } from './ps2.js';
import { curve, nodCurve, solveIK, setWorldQuat, quatFromAxes, periodicSpring, easeInOut } from './rig.js';

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
    // sobrancelhas grossas (pintadas; no B viram peças móveis)
    if (!o.browMesh) {
      g.fillStyle = '#120c09';
      g.beginPath();
      g.ellipse(25, 25.3, 5, 1.1, 0.12, 0, PI * 2);
      g.ellipse(39, 25.3, 5, 1.1, -0.12, 0, PI * 2);
      g.fill();
    }
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
    // jaqueta de trabalho verde-oliva lavada (contrasta com a pele)
    g.fillStyle = '#41452f';
    g.fillRect(0, 0, w, h);
    weave(g, w, h, 0.12, 5);
    const r = rand(6);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(20,22,12,${0.06 + r() * 0.1})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 3, 0.3 + r());
    }
    // costas: pala com costura dupla e etiqueta vermelha
    g.strokeStyle = 'rgba(214,190,120,0.55)';
    g.lineWidth = 0.25;
    g.setLineDash([0.6, 0.4]);
    g.beginPath();
    g.moveTo(0, 12);
    g.lineTo(24, 14);
    g.moveTo(72, 14);
    g.lineTo(96, 12);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#9e1620';
    g.fillRect(93.5, 5, 5, 3);
    g.fillRect(-1.5, 5, 3, 3);
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


// Corrente com pivô no pescoço: balança com atraso (mola) quando o tronco quica.
function chainRig(parent, color, y, w, z = 0.16) {
  const g = pivot(parent, 0, y, z - 0.02);
  const m = metal({ color });
  const r = rand(4);
  for (let i = 0; i < 13; i++) {
    const a = (i / 12) * PI;
    const l = add(g, rbox(0.024, 0.016, 0.014, m, 0.006), Math.cos(a) * w, -Math.sin(a) * 0.13 + (r() - 0.5) * 0.004, 0.02);
    l.rotation.z = a - PI / 2 + (i % 2) * 0.5;
  }
  add(g, rbox(0.045, 0.055, 0.016, m, 0.01), 0, -0.155, 0.025); // pingente
  return g;
}

// Rosto animável (substituição de peças, como no stop-motion): pálpebras,
// boca (interior escuro + mandíbula) e sobrancelhas móveis.
// Posições calculadas na esfera da cabeça (raios 0.108/0.135/0.12, centro y=0.135).
function headPoint(u, v, out = 0.0) {
  const phi = u * PI * 2;
  const th = v * PI;
  return new THREE.Vector3(
    -Math.cos(phi) * Math.sin(th) * (0.108 + out),
    0.135 + Math.cos(th) * (0.135 + out),
    Math.sin(phi) * Math.sin(th) * (0.12 + out)
  );
}

function faceRig(s, skin, { lids = false, brows = false } = {}) {
  const rig = {};
  const lidM = plastic({ color: skin, spec: 0.3 });
  if (lids) {
    rig.lids = [25, 39].map((ex) => {
      const p = headPoint(ex / 128, 28.6 / 64, 0.0015);
      const lid = add(s.head, ball(0.0175, 0.012, 0.007, lidM, 14), p.x, p.y, p.z);
      lid.rotation.y = (ex < 32 ? -1 : 1) * 0.33;
      lid.userData.base = p.clone();
      lid.userData.s0 = lid.scale.clone();
      return lid;
    });
  }
  if (brows) {
    const bm = fabric({ color: 0x120c09 });
    rig.brows = [25, 39].map((ex) => {
      const p = headPoint(ex / 128, 25.2 / 64, 0.004);
      const b = add(s.head, rbox(0.034, 0.0065, 0.008, bm, 0.003), p.x, p.y, p.z);
      b.rotation.y = (ex < 32 ? -1 : 1) * 0.33;
      b.userData = { base: p.clone(), side: ex < 32 ? -1 : 1 };
      return b;
    });
  }
  // boca: interior escuro que abre (os lábios estão pintados por cima)
  const mp = headPoint(0.25, 42.3 / 64, -0.002);
  rig.mouth = add(s.head, ball(0.021, 0.009, 0.006, mat({ color: 0x1a0806, spec: 0.2 }), 14), mp.x, mp.y, mp.z);
  rig.mouth.userData.base = mp.clone();
  rig.mouth.userData.s0 = rig.mouth.scale.clone();
  rig.set = ({ blink = 0, open = 0, round = 0, browUp = 0, browIn = 0 } = {}) => {
    if (rig.lids) {
      rig.lids.forEach((l) => {
        // pálpebra superior desce sobre o olho; aberta fica só a linha da pálpebra
        const k = 0.16 + 0.84 * blink;
        const s0 = l.userData.s0;
        l.scale.set(s0.x, s0.y * k, s0.z);
        l.position.y = l.userData.base.y + 0.011 * (1 - k);
      });
    }
    if (rig.brows) {
      rig.brows.forEach((b) => {
        b.position.y = b.userData.base.y + 0.006 * browUp - 0.004 * browIn;
        b.rotation.z = b.userData.side * (0.12 + 0.35 * browIn);
      });
    }
    const w = 1 - 0.45 * round;
    const h = 0.12 + 1.15 * open + 0.6 * round;
    const m0 = rig.mouth.userData.s0;
    rig.mouth.scale.set(m0.x * w, m0.y * Math.min(h, 1.6), m0.z);
    rig.mouth.visible = open + round > 0.04;
    rig.mouth.position.y = rig.mouth.userData.base.y - 0.004 * open;
  };
  rig.set();
  return rig;
}

// Base de orientação "palma pra baixo, dedos pra frente" no espaço do mundo.
const _f = new THREE.Vector3();
const _up = new THREE.Vector3();
const _hx = new THREE.Vector3();
const _hy = new THREE.Vector3();
const _hz = new THREE.Vector3();
const _hq = new THREE.Quaternion();
function handQuat(fingersW, palmNormalW, side) {
  // y do pivô da mão = oposto dos dedos; x = normal da palma (sinal pelo lado)
  _hy.copy(fingersW).normalize().negate();
  _hx.copy(palmNormalW).multiplyScalar(-side); // mão esquerda: palma = -x local
  _hx.addScaledVector(_hy, -_hx.dot(_hy)).normalize();
  _hz.crossVectors(_hx, _hy).normalize();
  return quatFromAxes(_hx, _hy, _hz, _hq);
}

const ARM = [0.3, 0.29];
const LEG = [0.45, 0.43];
const ANKLE_H = 0.0875; // altura do pivô do tornozelo com o pé chapado no chão

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
  add(s.torso, ball(0.19, 0.085, 0.09, sleeve), 0, 0.6, -0.15); // capuz caído nas costas
  const pocket = fabric({ map: denim('#4c4736', 22) });
  add(s.legL.th, rbox(0.035, 0.14, 0.13, pocket, 0.01), 0.1, -0.27, 0);
  add(s.legR.th, rbox(0.035, 0.14, 0.13, pocket, 0.01), -0.1, -0.27, 0);
  const chainG = chainRig(s.torso, 0xd8dde6, 0.62, 0.11);

  const headMesh = sculptHead(s, skin, headTex(skin, { eyes: false, beard: 'goatee', lips: '#6e3d2d', seed: 5 }));
  const face = faceRig(s, skin);
  const hairM = fabric({ color: 0x100c0a });
  const scalp = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, PI * 2, 0, PI / 2), hairM);
  scalp.scale.set(0.114, 0.11, 0.126);
  add(s.head, scalp, 0, 0.165, -0.004);

  // dreads: presos ao topo da cabeça, caindo até o pescoço
  const dreadM = fabric({ map: dreadTex() });
  const bead = metal({ color: 0xd8dde6 });
  const dreads = [];
  const r = rand(77);
  const N = 30;
  for (let i = 0; i < N; i++) {
    const row = i % 2;
    const a = -PI * 0.8 + (i / (N - 1)) * PI * 1.6; // 0 = nuca, deixa a testa livre
    const len = 0.25 + r() * 0.08 - row * 0.04;
    const rad = 0.098 - row * 0.03;
    const p = pivot(s.head, Math.sin(a) * rad, 0.235 + row * 0.03, -Math.cos(a) * rad * 1.1);
    const d = add(p, tube(0.021, 0.018, len, dreadM, 8), 0, -len / 2, 0);
    d.rotation.y = r() * PI;
    add(p, ball(0.019, 0.016, 0.019, dreadM, 8), 0, -len, 0);
    if (i % 5 === 2) add(p, tube(0.025, 0.025, 0.025, bead, 12), 0, -len + 0.05, 0);
    p.userData = { a, out: 0.1 + r() * 0.08 + row * 0.1, ph: r(), w: 0.7 + r() * 0.6 };
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

  // cigarro entre o indicador e o médio da mão direita
  const cig = pivot(s.armR.hand, 0.0, -0.1, 0.03);
  cig.rotation.set(PI / 2 - 0.3, 0, 0);
  add(cig, tube(0.0055, 0.0055, 0.075, mat({ color: 0xf0ece2, spec: 0.05 }), 8), 0, 0.03, 0);
  add(cig, tube(0.006, 0.006, 0.02, mat({ color: 0xc58a3c }), 8), 0, -0.012, 0);
  const emberM = mat({ color: 0xff5a14, emissive: 1.6, unlit: true });
  const ember = add(cig, tube(0.0058, 0.0058, 0.008, emberM, 8), 0, 0.071, 0);
  add(cig, tube(0.0058, 0.0058, 0.006, mat({ color: 0x77736c }), 8), 0, 0.064, 0); // cinza
  const filterLocal = new THREE.Vector3(0, -0.1 - 0.02, 0.03 + 0.005); // ponta do filtro, no espaço da mão (aprox.)

  const ring = metal({ color: 0xd8dde6 });
  add(s.armR.hand, tube(0.026, 0.026, 0.012, ring, 12), 0, -0.1, 0);
  add(s.armL.hand, tube(0.026, 0.026, 0.012, ring, 12), 0, -0.1, 0);

  const mouth = pivot(s.head, 0, 0.07, 0.115);

  // ---------- atuação (em batidas; loop de 32) ----------
  const P = 32;
  // tragadas nas batidas 4 e 20: sobe (0.75), puxa (1.25), desce (0.6), solta fumaça
  const puff = curve([[0, 0], [4, 0], [4.75, 1, 'inOut'], [6.0, 1, 'linear'], [6.6, 0, 'inOut'], [20, 0], [20.75, 1, 'inOut'], [22.0, 1, 'linear'], [22.6, 0, 'inOut']], P);
  const drag = curve([[0, 0], [4.7, 0], [4.9, 1, 'out'], [5.95, 1, 'linear'], [6.05, 0, 'in'], [20.7, 0], [20.9, 1, 'out'], [21.95, 1, 'linear'], [22.05, 0, 'in']], P);
  const exhaleC = curve([[0, 0], [6.4, 0], [6.8, 1, 'out'], [8.4, 0.35, 'inOut'], [9.2, 0, 'inOut'], [22.4, 0], [22.8, 1, 'out'], [24.4, 0.35, 'inOut'], [25.2, 0, 'inOut']], P);
  // respiração acompanha a tragada: puxa na tragada, solta com a fumaça
  const breath = curve([[0, 0.3], [2, 0.7], [4, 0.2], [5.9, 1, 'inOut'], [8.6, 0, 'inOut'], [11, 0.7], [13.5, 0.15], [16, 0.6], [18, 0.2], [21.9, 1, 'inOut'], [24.6, 0, 'inOut'], [27, 0.7], [29.5, 0.15]], P);
  // olhar: no teto; desce um pouco na tragada; vira levemente na batida 26–30
  const lookUp = curve([[0, 1], [3.6, 1], [4.6, 0.45, 'inOut'], [6.1, 0.55], [6.9, 1.12, 'out'], [9, 1], [19.6, 1], [20.6, 0.45, 'inOut'], [22.1, 0.55], [22.9, 1.12, 'out'], [25, 1]], P);
  const turn = curve([[0, -0.05], [10, -0.05], [11.5, 0.18, 'inOut'], [15, 0.12], [16.5, -0.05, 'inOut'], [26, -0.05], [27.5, -0.22, 'inOut'], [30.5, -0.15], [31.8, -0.05, 'inOut']], P);
  // bater cinza do cigarro (dois toques do indicador)
  const flick = curve([[0, 0], [12.5, 0], [12.58, 1, 'out'], [12.7, 0, 'in'], [12.78, 1, 'out'], [12.92, 0, 'in'], [28.5, 0], [28.58, 1, 'out'], [28.7, 0, 'in'], [28.78, 1, 'out'], [28.92, 0, 'in']], P);
  // intensidade do balanço por batida no compasso (o 1 e o 3 pesam mais)
  const accent = (beat) => [1, 0.65, 1.15, 0.7][beat % 4];
  const tapCurve = curve([[0, 0], [0.1, 0, 'linear'], [0.48, 1, 'out'], [0.8, 0.82, 'inOut'], [0.97, 0, 'in']], 1);
  // cabeça: nod com o pescoço e a cabeça um pouco atrasada (sobreposição)
  const nodA = (t) => {
    const b = Math.floor(t);
    return nodCurve(t - b) * accent(((b % 4) + 4) % 4);
  };
  const headPitch = (t) => 0.13 * nodA(t) + 0.06 * nodA(t - 0.07);
  const dreadSpring = periodicSpring(headPitch, P, { stiffness: 140, damping: 7 });
  const bodyBob = (t) => 0.02 * nodA(t - 0.03);
  const chainSpring = periodicSpring(bodyBob, P, { stiffness: 110, damping: 6 });

  const W = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const upW = new THREE.Vector3();
  const pole = new THREE.Vector3();
  const qW = new THREE.Quaternion();

  function update(a) {
    const t = a.beatF;
    const g = s.root;
    g.updateMatrixWorld(true);
    const L = (x, y, z) => g.localToWorld(W.set(x, y, z)).clone();
    const dirW = (x, y, z) => tmp.set(x, y, z).applyQuaternion(g.quaternion).clone();
    const pf = puff(t);
    const dr = drag(t);
    const ex = exhaleC(t);
    const br = breath(t);
    const n = nodA(t);
    const n2 = nodA(t - 0.07);

    // corpo: afundado no sofá, costas no encosto
    s.hips.position.set(0, 0.548 + 0.008 * n, 0.06);
    s.hips.rotation.set(-0.16, 0, 0);
    s.torso.rotation.set(-0.36 - 0.02 * br + 0.035 * n + 0.08 * pf, 0.04 + 0.05 * pf, 0.02);
    s.torso.scale.set(1 + 0.012 * br, 1 + 0.006 * br, 1 + 0.02 * br);
    // pescoço/cabeça olhando pro teto, balançando
    const lu = lookUp(t);
    s.neck.rotation.set(-0.42 * lu + 0.13 * n, 0.06 + 0.5 * turn(t), 0.05 * Math.sin((t / 4) * PI * 2));
    s.head.rotation.set(-0.28 * lu + 0.06 * n2, 0.5 * turn(t), 0.03 * Math.sin((t / 4) * PI * 2 + 0.6));
    s.head.updateMatrixWorld(true);

    // rosto: boca em "O" soltando fumaça, lábios fechados no filtro
    face.set({ open: 0.15 * ex, round: ex });

    // dreads e corrente: mola atrasada em relação à cabeça/tronco
    const lag = dreadSpring(t) - headPitch(t);
    dreads.forEach((p) => {
      const { a: ang, out, w } = p.userData;
      p.rotation.x = Math.cos(ang) * out + 0.18 - lag * 2.2 * w;
      p.rotation.z = Math.sin(ang) * out * 1.15 + Math.sin(ang) * lag * 0.6;
    });
    chainG.rotation.x = -(chainSpring(t) - bodyBob(t)) * 9;

    // pernas: pés plantados no chão (IK); o direito bate o bico no tempo
    fwd.copy(dirW(0, 0, 1));
    upW.set(0, 1, 0);
    const tap = tapCurve(t - Math.floor(t)) * (t % 16 < 15 ? 1 : 0.4);
    const toe = 0.5 * tap;
    const footR = L(-0.15, ANKLE_H + 0.085 * Math.sin(toe), 0.64);
    const footL = L(0.2, ANKLE_H, 0.6);
    pole.copy(fwd).addScaledVector(dirW(1, 0, 0), 0.25).normalize();
    solveIK(s.legL.th, s.legL.kn, s.legL.ft, footL, pole, LEG[0], LEG[1], -1);
    pole.copy(fwd).addScaledVector(dirW(-1, 0, 0), 0.2).normalize();
    solveIK(s.legR.th, s.legR.kn, s.legR.ft, footR, pole, LEG[0], LEG[1], -1);
    // pés: chapados apontando pra frente (um pouco abertos); o direito levanta o bico
    qW.copy(g.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(tmp2.set(0, 1, 0), 0.25));
    setWorldQuat(s.legL.ft, qW);
    qW.copy(g.quaternion)
      .multiply(new THREE.Quaternion().setFromAxisAngle(tmp2.set(0, 1, 0), -0.15))
      .multiply(new THREE.Quaternion().setFromAxisAngle(tmp2.set(1, 0, 0), -toe));
    setWorldQuat(s.legR.ft, qW);

    // braço esquerdo largado sobre o encosto, dedos marcando o tempo
    // (braço quase esticado ao longo do topo do encosto, mão pendendo na ponta)
    solveIK(s.armL.sh, s.armL.el, s.armL.hand, L(0.66, 1.0, -0.47), dirW(0.1, -1, -0.35).normalize(), ARM[0], ARM[1], 1);
    setWorldQuat(s.armL.hand, handQuat(dirW(0.75, -0.65, -0.1), dirW(0, -1, 0.2), 1));
    s.armL.hand.rotateX(0.2 * nodA(t - 0.12));

    // braço direito: cigarro descansando na altura do peito / levado à boca
    mouth.getWorldPosition(tmp2);
    const mouthW = tmp2.clone();
    const faceN = new THREE.Vector3(0, 0, 1).applyQuaternion(s.head.getWorldQuaternion(new THREE.Quaternion()));
    // mão em repouso: cotovelo apoiado no braço do sofá, antebraço levantado
    const restWrist = L(-0.36, 0.86 + 0.012 * n, 0.2);
    const restQ = handQuat(dirW(0.15, 1, 0.35), dirW(1, 0.1, 0.2), -1);
    // na boca: dedos pra cima, cigarro saindo da boca pra fora
    const mouthQ = (() => {
      const fingers = upW.clone().addScaledVector(faceN, -0.35).normalize();
      const palm = faceN.clone().negate().addScaledVector(dirW(1, 0, 0), 0.3).normalize();
      return handQuat(fingers, palm, -1).clone();
    })();
    const handQ = restQ.clone().slerp(mouthQ, easeInOut(pf));
    const filterW = filterLocal.clone().applyQuaternion(handQ);
    const mouthWrist = mouthW.clone().addScaledVector(faceN, 0.012).sub(filterW);
    // arco: a mão passa por fora, não atravessa o peito
    const arc = dirW(-1, 0, 0.6).multiplyScalar(0.12 * Math.sin(pf * PI));
    const wrist = restWrist.clone().lerp(mouthWrist, easeInOut(pf)).add(arc);
    solveIK(s.armR.sh, s.armR.el, s.armR.hand, wrist, dirW(-1, -0.6, -0.3).normalize(), ARM[0], ARM[1], 1);
    setWorldQuat(s.armR.hand, handQ);
    s.armR.hand.rotateX(-0.35 * flick(t));

    // brasa: acende forte quando ele puxa
    const glow = 0.55 + 0.2 * Math.sin(t * PI * 3) + 0.3 * a.high + 2.2 * dr;
    emberM.uniforms.uColor.value.set(1, 0.26 + 0.12 * Math.min(glow, 1.5), 0.05);
    emberM.uniforms.uEmissive.value.setScalar(1 + glow);
    ember.getWorldPosition(tmp);
    return { ember: tmp.clone(), glow, mouth: mouthW, faceN, exhale: ex, puffing: pf };
  }

  return { group: s.root, update, head: s.head, headMesh, foot: s.legR.ft };
}

// ---------------- personagem B ----------------
export function buildB() {
  const skin = '#6b4329';
  const jacketM = fabric({ map: jacketTex() });
  const sleeve = fabric({ map: clothTex('#3d412c', 31) });
  const s = skeleton({
    skin,
    torsoMat: jacketM,
    sleeveMat: sleeve,
    pantsMat: fabric({ map: denim('#34425e', 33) }), // jeans largo
    shoeMats: [plastic({ color: 0x161616, spec: 0.25 }), plastic({ color: 0x3a1410, spec: 0.1 }), fabric({ color: 0x222222 })],
    torsoR: 0.265,
  });
  const chainG = chainRig(s.torso, 0xe0b54a, 0.62, 0.1);
  const hoodM = fabric({ map: clothTex('#5f5d5a', 35) });
  add(s.torso, ball(0.15, 0.08, 0.08, hoodM), 0, 0.6, -0.16);
  add(s.armL.el, tube(0.064, 0.064, 0.04, hoodM), 0, -0.28, 0);
  add(s.armR.el, tube(0.064, 0.064, 0.04, hoodM), 0, -0.28, 0);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 18, PI * 1.4), fabric({ color: 0x3d2614 }));
  collar.rotation.set(PI / 2, 0, PI * 0.8);
  add(s.torso, collar, 0, 0.62, -0.01);

  sculptHead(s, skin, headTex(skin, { eyes: true, beard: 'full', lips: '#4a281c', hair: 'fade', seed: 8, browMesh: true }));
  const face = faceRig(s, skin, { lids: true, brows: true });
  // boné de beisebol virado pra trás
  const capM = fabric({ map: clothTex('#121212', 51), spec: 0.04 });
  const capRed = plastic({ color: 0x9e1620, spec: 0.12 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, PI * 2, 0, PI / 2), capM);
  dome.scale.set(0.121, 0.1, 0.133);
  add(s.head, dome, 0, 0.19, -0.004);
  add(s.head, ball(0.012, 0.007, 0.012, capM), 0, 0.29, -0.004);
  const bill = add(s.head, rbox(0.17, 0.012, 0.12, capRed, 0.005), 0, 0.2, -0.17);
  bill.rotation.x = -0.12;
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
  const glBase = gl.position.clone();
  add(s.armL.el, tube(0.068, 0.068, 0.035, gold, 16), 0, -0.24, 0); // relógio

  // ---------- atuação (em batidas; loop de 32) ----------
  const P = 32;
  // olha pro amigo no fim de cada frase (batidas 12–16 e 28–32), com a mão no ar
  const look = curve([[0, 0], [11.6, 0], [12.3, 1, 'inOut'], [15.2, 1, 'linear'], [15.85, 0, 'inOut'], [27.6, 0], [28.3, 1, 'inOut'], [31.2, 1, 'linear'], [31.85, 0, 'inOut']], P);
  const handUp = curve([[0, 0], [12.4, 0], [12.9, 1, 'back'], [15.0, 1, 'linear'], [15.7, 0, 'inOut'], [28.4, 0], [28.9, 1, 'back'], [31.0, 1, 'linear'], [31.7, 0, 'inOut']], P);
  // ajeita os óculos na batida 18
  const glasses = curve([[0, 0], [17.7, 0], [18.25, 1, 'inOut'], [18.7, 1, 'linear'], [19.3, 0, 'inOut']], P);
  // "cara de grave" no 3 dos compassos pares
  const stank = curve([[0, 0], [5.9, 0], [6.05, 1, 'out'], [6.7, 0, 'inOut'], [13.9, 0], [14.05, 1, 'out'], [14.7, 0, 'inOut'], [21.9, 0], [22.05, 1, 'out'], [22.7, 0, 'inOut'], [29.9, 0], [30.05, 1, 'out'], [30.7, 0, 'inOut']], P);
  // piscadas em tempos irregulares
  const blinks = [2.3, 6.9, 9.6, 14.4, 17.3, 21.8, 25.1, 27.4, 30.6];
  const blinkAt = (t) => {
    let k = 0;
    for (const b of blinks) {
      const d = (t - b) / 0.22;
      if (d > 0 && d < 1) k = Math.max(k, Math.sin(d * PI));
    }
    return k;
  };
  // mouse: trajetória em pequenos movimentos (offsets em metros no tapete)
  const mx = curve([[0, 0], [1.4, 0.012], [2.2, 0.03, 'out'], [3.5, 0.025], [6, -0.01], [7.2, 0.006], [9, 0.055, 'out'], [10.4, 0.058], [11.2, 0.0], [16.5, 0.0], [17.4, -0.02, 'out'], [20.5, -0.02], [21.6, 0.02], [24.8, 0.035, 'out'], [26.2, 0.06, 'inOut'], [27.2, 0.0], [32, 0]], P);
  const mz = curve([[0, 0], [2.2, -0.015, 'out'], [4.5, 0.004], [9, -0.03, 'out'], [10.4, -0.028], [11.2, 0], [17.4, 0.012, 'out'], [21.6, -0.01], [26.2, -0.03, 'inOut'], [27.2, 0]], P);
  const clicks = [1.0, 3.0, 5.0, 7.5, 9.2, 10.4, 17.4, 19.6, 21.6, 24.2, 25.0, 26.2];
  const clickAt = (t) => clicks.reduce((k, c) => Math.max(k, t >= c && t < c + 0.18 ? Math.sin(((t - c) / 0.18) * PI) : 0), 0);
  // teclas: atalhos/notas tocadas pela mão esquerda
  const keys = [0.5, 0.75, 2.5, 4.5, 4.75, 8.5, 8.75, 10.5, 16.5, 16.75, 20.5, 22.5, 24.5, 24.75, 26.5];
  const keyAt = (t) => keys.reduce((k, c) => Math.max(k, t >= c && t < c + 0.2 ? Math.sin(((t - c) / 0.2) * PI) : 0), 0);
  // boca acompanhando a letra nos compassos 5–6
  const sing = (t) => {
    if (t < 16 || t >= 23.5) return 0;
    const e = Math.floor(t * 2);
    const ph = t * 2 - e;
    return hash(e * 3.17) > 0.35 ? Math.sin(ph * PI) * (0.4 + 0.6 * hash(e * 1.7)) : 0;
  };
  const accent = (beat) => [1, 0.7, 1.2, 0.75][beat % 4];
  const nodB = (t) => {
    const b = Math.floor(t);
    return nodCurve(t - b) * accent(((b % 4) + 4) % 4);
  };
  const headPitch = (t) => 0.2 * nodB(t) + 0.08 * nodB(t - 0.06);
  const bodyBob = (t) => 0.02 * nodB(t - 0.03);
  const chainSpring = periodicSpring(bodyBob, P, { stiffness: 110, damping: 6 });
  const breath = curve([[0, 0], [2, 1], [4, 0], [6, 1], [8, 0], [10, 1], [12, 0], [14, 1], [16, 0], [18, 1], [20, 0], [22, 1], [24, 0], [26, 1], [28, 0], [30, 1]], P);

  const W = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let mouse = null;
  let mouseBase = null;

  function update(a, env = {}) {
    const t = a.beatF;
    const g = s.root;
    g.updateMatrixWorld(true);
    const L = (x, y, z) => g.localToWorld(W.set(x, y, z)).clone();
    const dirW = (x, y, z) => tmp.set(x, y, z).applyQuaternion(g.quaternion).clone();
    const lk = look(t);
    const hu = handUp(t);
    const gs = glasses(t);
    const st = stank(t);
    const n = nodB(t);
    const br = breath(t);

    // corpo
    s.hips.position.set(0, 0.635, 0);
    s.hips.rotation.set(0, 0, 0);
    s.torso.rotation.set(0.16 - 0.08 * lk + 0.05 * n + 0.03 * st, -0.22 * lk, 0.02 * Math.sin((t / 2) * PI));
    s.torso.scale.set(1 + 0.01 * br, 1 + 0.005 * br, 1 + 0.015 * br);
    s.neck.rotation.set(-0.1 + 0.2 * n + 0.08 * st, -0.35 * lk, 0);
    s.head.rotation.set(-0.06 + 0.08 * nodB(t - 0.06) + 0.06 * st, -0.75 * lk + 0.05 * Math.sin((t / 8) * PI * 2), -0.04 * Math.sin((t / 2) * PI) - 0.08 * lk);
    face.set({ blink: blinkAt(t), open: Math.max(sing(t), 0.35 * st), browIn: st, browUp: 0.7 * hu });
    gl.position.copy(glBase).add(tmp.set(0, 0.004 * Math.sin(gs * PI), 0));
    chainG.rotation.x = -(chainSpring(t) - bodyBob(t)) * 9;

    // pernas: pés plantados (IK); o direito marca o tempo com o calcanhar
    const heel = 0.025 * nodB(t - 0.02) * (lk > 0.5 ? 1.6 : 1);
    solveIK(s.legL.th, s.legL.kn, s.legL.ft, L(0.17, ANKLE_H, 0.5), dirW(0.3, 0.1, 1).normalize(), LEG[0], LEG[1], -1);
    solveIK(s.legR.th, s.legR.kn, s.legR.ft, L(-0.15, ANKLE_H + heel, 0.47), dirW(-0.3, 0.1, 1).normalize(), LEG[0], LEG[1], -1);
    const fq = new THREE.Quaternion();
    setWorldQuat(s.legL.ft, fq.copy(g.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(tmp.set(0, 1, 0), 0.2)));
    setWorldQuat(
      s.legR.ft,
      fq.copy(g.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(tmp.set(0, 1, 0), -0.18)).multiply(new THREE.Quaternion().setFromAxisAngle(tmp.set(1, 0, 0), heel * 6))
    );

    // mão direita no mouse (o mouse anda junto com a mão)
    if (env.mouse && !mouse) {
      mouse = env.mouse;
      mouseBase = mouse.position.clone();
    }
    const fwdDown = dirW(0, -0.45, 1).normalize();
    if (mouse) {
      const dx = mx(t) * (1 - lk * 0.5);
      const dz = mz(t);
      // offsets no espaço da mesa (x = direita do B vista de frente, z = profundidade)
      mouse.position.set(mouseBase.x + dx, mouseBase.y, mouseBase.z + dz);
      mouse.updateMatrixWorld(true);
      const mw = mouse.getWorldPosition(new THREE.Vector3());
      const wristR = mw.clone().addScaledVector(dirW(0, 0, 1), -0.085).add(tmp.set(0, 0.1 - 0.004 * clickAt(t), 0));
      solveIK(s.armR.sh, s.armR.el, s.armR.hand, wristR, dirW(-0.6, -1, -0.5).normalize(), ARM[0], ARM[1], 1);
      setWorldQuat(s.armR.hand, handQuat(fwdDown, tmp.set(0, -1, 0), -1));
      s.armR.hand.rotateX(0.12 * clickAt(t));
    }

    // mão esquerda: teclado / óculos / mão no ar
    const kbWrist = (env.keyboard ? env.keyboard.clone() : L(0.1, 0.8, 0.5)).add(dirW(0.08, 0, -0.07)).add(tmp.set(0, 0.075 - 0.008 * keyAt(t), 0));
    const glassesW = gl.getWorldPosition(new THREE.Vector3()).add(dirW(0.02, -0.11, 0.06));
    const airW = L(0.3, 1.32 + 0.05 * n, 0.22);
    let wristL = kbWrist.clone();
    if (gs > 0) wristL.lerp(glassesW, easeInOut(gs));
    if (hu > 0) wristL.lerp(airW, Math.min(1, hu));
    solveIK(s.armL.sh, s.armL.el, s.armL.hand, wristL, dirW(0.7, -1, -0.4).normalize(), ARM[0], ARM[1], 1);
    const qKb = handQuat(fwdDown, tmp.set(0, -1, 0), 1).clone();
    const qUp = handQuat(dirW(0, 1, 0.2), dirW(-0.2, 0, 1), 1).clone();
    const qGl = handQuat(dirW(-0.2, 1, -0.2), dirW(0, 0, -1), 1).clone();
    const qL = qKb.clone().slerp(qGl, easeInOut(gs)).slerp(qUp, Math.min(1, hu));
    setWorldQuat(s.armL.hand, qL);
    if (hu > 0) s.armL.hand.rotateX(-0.35 * nodB(t - 0.1) * hu);
    s.armL.hand.rotateX(0.15 * keyAt(t) * (1 - hu));
  }

  return { group: s.root, update, head: s.head };
}
