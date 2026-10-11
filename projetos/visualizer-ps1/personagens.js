// Os dois personagens como bonecos de ação articulados (estilo stop-motion):
// cabeça esculpida pintada à mão, juntas esféricas aparentes, mãos de plástico
// e roupa de tecido.
//  A: pele parda, dreads pretos até o pescoço, óculos escuro, cigarro.
//     Meio deitado no sofá, olhando pra cima, balançando a cabeça e o pé.
//  B: degradê americano baixo, boné pra trás, óculos de grau.
//     Na cadeira do computador, produzindo e balançando a cabeça.
import * as THREE from './three.module.min.js';
import { mat, plastic, fabric, metal, canvasTex, rbox, tube, ball, grain, weave, rand, hash } from './ps2.js';
import { curve, nodCurve, nodAccent, solveIK, setWorldQuat, quatFromAxes, periodicSpring, easeInOut } from './rig.js';

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
      g.fillStyle = o.beard === 'full' ? 'rgba(14,9,7,0.92)' : 'rgba(20,12,9,0.5)';
      g.beginPath();
      if (o.beard === 'full') g.ellipse(32, 40.2, 5.2, 0.9, 0, 0, PI * 2); // bigode
      else g.ellipse(32, 40.4, 4.4, 0.45, 0, 0, PI * 2); // bigode ralo
      g.fill();
      g.beginPath();
      if (o.beard === 'full') {
        // barba curta cheia: costeleta larga descendo pela mandíbula até o queixo,
        // borda macia (não um contorno fino, que lia como jugular de capacete)
        g.fill();
        g.beginPath();
        g.moveTo(17.0, 31);
        g.quadraticCurveTo(17.5, 53, 32, 55.5);
        g.quadraticCurveTo(46.5, 53, 47.0, 31);
        g.quadraticCurveTo(43.5, 36, 38.5, 44.6); // linha da bochecha em diagonal até o canto da boca
        g.lineTo(25.5, 44.6);
        g.quadraticCurveTo(20.5, 36, 17.0, 31);
        g.closePath();
        g.fillStyle = 'rgba(16,10,8,0.7)';
        g.fill();
        // borda esfumada à mão: contornos cada vez mais largos e transparentes
        g.lineJoin = 'round';
        for (let k = 1; k <= 7; k++) {
          g.strokeStyle = `rgba(16,10,8,${0.09 - k * 0.011})`;
          g.lineWidth = k * 0.8;
          g.stroke();
        }
        // pelos curtos: pontinhos irregulares dentro da barba
        const rb = rand(77);
        for (let k = 0; k < 260; k++) {
          const ax = 17.5 + rb() * 29;
          const ay = 30 + rb() * 25;
          const inSide = (ax < 22 + (ay - 31) * 0.3 || ax > 42 - (ay - 31) * 0.3) && ay < 50 && ay > 31;
          const inChin = ay > 45.5 && Math.abs(ax - 32) < 14 - (ay - 45.5) * 0.9;
          if (!inSide && !inChin) continue;
          g.fillStyle = `rgba(${rb() < 0.5 ? '6,4,3' : '48,32,24'},${0.35 + rb() * 0.4})`;
          g.fillRect(ax, ay, 0.35, 0.35 + rb() * 0.4);
        }
        g.beginPath();
      } else {
        // cavanhaque: tufo macio no queixo
        g.fill();
        const tuft = g.createRadialGradient(32, 49, 0.3, 32, 49, 4.2);
        tuft.addColorStop(0, 'rgba(14,9,6,0.97)');
        tuft.addColorStop(0.78, 'rgba(14,9,6,0.85)');
        tuft.addColorStop(1, 'rgba(14,9,6,0)');
        g.fillStyle = tuft;
        g.beginPath();
        g.ellipse(32, 49, 3, 4.6, 0, 0, PI * 2);
        g.fill();
        const rt = rand(31);
        for (let k = 0; k < 90; k++) {
          const ax = 29 + rt() * 6;
          const ay = 44.5 + rt() * 9;
          if (((ax - 32) / 3.2) ** 2 + ((ay - 49) / 4.8) ** 2 > 1) continue;
          g.fillStyle = `rgba(${rt() < 0.5 ? '4,3,2' : '46,30,22'},${0.4 + rt() * 0.4})`;
          g.fillRect(ax, ay, 0.3, 0.3);
        }
        g.beginPath();
      }
      g.fill();
    }
    grain(g, w, h, 10, o.seed || 3);
  });
}

// Copa do boné: 6 gomos com costura dupla, ilhoses e sarja (u = volta, v = do topo à borda)
function capTex() {
  return canvasTex(96, 32, (g, w, h) => {
    g.fillStyle = '#131313';
    g.fillRect(0, 0, w, h);
    weave(g, w, h, 0.12, 52);
    for (let k = 0; k < 6; k++) {
      const x = (k / 6) * w;
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(x - 0.35, 0, 0.7, h);
      g.strokeStyle = 'rgba(120,120,120,0.35)';
      g.lineWidth = 0.18;
      g.setLineDash([0.5, 0.35]);
      for (const dx of [-0.9, 0.9]) {
        g.beginPath();
        g.moveTo(x + dx, 1.5);
        g.lineTo(x + dx, h);
        g.stroke();
      }
      g.setLineDash([]);
      g.fillStyle = 'rgba(0,0,0,0.85)';
      g.beginPath();
      g.arc(x + w / 12, h * 0.32, 0.7, 0, PI * 2); // ilhós
      g.fill();
    }
    grain(g, w, h, 10, 53);
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
  // lã de dread: fios torcidos em hélice (diagonal que fecha a volta), sem anéis regulares
  return canvasTex(8, 32, (g, w, h) => {
    g.fillStyle = '#18120f';
    g.fillRect(0, 0, w, h);
    const r = rand(41);
    g.lineCap = 'round';
    for (let k = 0; k < 150; k++) {
      const y = r() * (h + 6) - 3;
      const lift = 2.2 + r() * 1.2;
      const c = r();
      g.strokeStyle = c < 0.5 ? `rgba(92,72,58,${0.12 + r() * 0.22})` : `rgba(0,0,0,${0.15 + r() * 0.25})`;
      g.lineWidth = 0.25 + r() * 0.5;
      for (const dx of [-w, 0]) {
        g.beginPath();
        g.moveTo(dx, y);
        g.lineTo(dx + w, y + lift);
        g.stroke();
      }
    }
    // nós e fiapos irregulares
    for (let k = 0; k < 26; k++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '70,54,44' : '5,3,2'},${0.18 + r() * 0.2})`;
      g.beginPath();
      g.ellipse(r() * w, r() * h, 0.6 + r() * 1.2, 0.4 + r() * 0.7, r() * 3, 0, PI * 2);
      g.fill();
    }
    grain(g, w, h, 22, 42);
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

// ---------------- tecido com dobras de verdade ----------------
// Roupa de boneco 1:6 tem dobras grossas e irregulares; cilindro liso entrega o CG.
// Desloca os vértices ao longo da normal com uma soma de ondas (cristas quase
// horizontais = franzido de manga/calça) e, opcionalmente, empilha anéis numa ponta.
let clothSeed = 1;
function wrinkle(geo, { amp = 0.006, freq = 110, tilt = 0.55, vertical = 0, stack = 0, stackAt = -1, lump = 0.25, seed = clothSeed++ } = {}) {
  const r = rand(seed * 7919 + 13);
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const H = max.y - min.y;
  const waves = [];
  for (let i = 0; i < 7; i++) {
    const vert = i < vertical; // cristas verticais (caimento do moletom)
    const a = (r() - 0.5) * 2 * tilt;
    const az = r() * PI * 2;
    const f = freq * (0.6 + r() * 0.8);
    const dir = vert ? new THREE.Vector3(Math.cos(az), 0, Math.sin(az)) : new THREE.Vector3(Math.sin(a) * Math.cos(az), Math.cos(a), Math.sin(a) * Math.sin(az));
    waves.push({ k: dir.multiplyScalar(f), ph: r() * PI * 2, w: (0.55 + r() * 0.45) / (i < 2 ? 1 : 1.6) });
  }
  const lumps = [0, 1, 2].map(() => ({ k: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(18 + r() * 14), ph: r() * PI * 2 }));
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const side = 1 - Math.abs(n.getY(i)); // tampas não deformam
    if (side < 0.5) continue;
    v.fromBufferAttribute(p, i);
    let d = 0;
    for (const w of waves) {
      const x = Math.sin(v.dot(w.k) + w.ph);
      d += w.w * (x > 0 ? x * x * 0.9 : x * 0.6); // crista mais marcada que o vale
    }
    d *= amp / 2.2;
    for (const l of lumps) d += amp * lump * Math.sin(v.dot(l.k) + l.ph);
    if (stack) {
      // anéis empilhados perto de uma ponta (barra da calça sobre o tênis, punho)
      const e = stackAt < 0 ? (v.y - min.y) / H : (max.y - v.y) / H;
      const fall = Math.max(0, 1 - e / 0.35);
      d += stack * fall * fall * (0.55 + 0.45 * Math.sin(e * 95 + Math.atan2(v.z, v.x) * 2 + seed));
    }
    // ponta presa (costura no ombro/cintura/joelho) quase não deforma
    const ey = (v.y - min.y) / H;
    const pin = Math.min(1, Math.min(ey, 1 - ey) / 0.08 + 0.15);
    d *= side * pin;
    p.setXYZ(i, v.x + n.getX(i) * d, v.y + n.getY(i) * d, v.z + n.getZ(i) * d);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  weldNormals(geo);
  return geo;
}
// Costuras de cilindro/esfera duplicam vértices: média das normais para não marcar uma linha.
function weldNormals(geo) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  const nn = geo.attributes.normal;
  const groups = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(5)},${p.getY(i).toFixed(5)},${p.getZ(i).toFixed(5)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  }
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    v.set(0, 0, 0);
    for (const i of ids) v.x += nn.getX(i), v.y += nn.getY(i), v.z += nn.getZ(i);
    v.normalize();
    for (const i of ids) nn.setXYZ(i, v.x, v.y, v.z);
  }
  nn.needsUpdate = true;
}
function cloth(rTop, rBot, h, m, opts = {}) {
  return new THREE.Mesh(wrinkle(new THREE.CylinderGeometry(rTop, rBot, h, 30, 22, !!opts.open), opts), m);
}

// "Boil" de stop-motion: o animador nunca reposiciona o boneco exatamente igual de uma
// foto pra outra. Microvariação determinística por pose (a mesma pose repete o mesmo erro),
// pequena nas juntas e um pouco maior no cabelo e na corrente.
function boil(obj, pose, id, amp) {
  obj.rotation.x += (hash(pose * 1.31 + id * 7.7) - 0.5) * amp;
  obj.rotation.y += (hash(pose * 2.17 + id * 3.1) - 0.5) * amp;
  obj.rotation.z += (hash(pose * 0.73 + id * 5.9) - 0.5) * amp;
}
function boilFigure(s, pose, base, extra = []) {
  const P = pose || 0;
  [s.torso, s.neck, s.head].forEach((o, i) => boil(o, P, base + i, 0.004));
  extra.forEach(([o, amp], i) => boil(o, P, base + 20 + i, amp));
}

// ---------------- esqueleto ----------------
// Mão de boneco articulada: palma, quatro dedos com duas falanges e polegar.
// Pivô da mão pende em -Y; a palma olha para -x (mão esquerda) / +x (direita).
const HAND_POSES = {
  relax: { curl: [0.55, 0.6, 0.7, 0.8], tip: 0.55, spread: 0.04, thumb: 0.5 },
  keys: { curl: [0.45, 0.4, 0.45, 0.5], tip: 0.55, spread: 0.06, thumb: 0.35 },
  mouse: { curl: [0.3, 0.3, 0.45, 0.55], tip: 0.35, spread: 0.02, thumb: 0.6 },
  cig: { curl: [0.25, 0.25, 1.35, 1.45], tip: [0.25, 0.2, 1.2, 1.2], spread: [0.1, -0.08, 0, 0], thumb: 0.9 },
  open: { curl: [0.05, 0.03, 0.05, 0.08], tip: 0.05, spread: 0.12, thumb: 0.15 },
  drape: { curl: [0.5, 0.55, 0.6, 0.65], tip: 0.45, spread: 0.05, thumb: 0.4 },
  push: { curl: [0.05, 1.3, 1.4, 1.45], tip: [0.1, 1.2, 1.2, 1.2], spread: 0.02, thumb: 1.0 },
};
// Afina uma malha ao longo de y (escala em z de s0 no topo a s1 na base), corrigindo as normais.
function taperZ(mesh, s0, s1) {
  const geo = mesh.geometry;
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const k = (max.y - p.getY(i)) / (max.y - min.y);
    const s = s0 + (s1 - s0) * k;
    p.setZ(i, p.getZ(i) * s);
    const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i) / s;
    const l = Math.hypot(nx, ny, nz) || 1;
    n.setXYZ(i, nx / l, ny / l, nz / l);
  }
  p.needsUpdate = true;
  n.needsUpdate = true;
  return mesh;
}
function hand(parent, skinM, side) {
  add(parent, ball(0.016, 0.024, 0.023, skinM, 14), 0, -0.004, 0); // pulso
  // palma esculpida: afina no pulso, alarga nos nós dos dedos; base do polegar saliente
  add(parent, taperZ(rbox(0.03, 0.076, 0.07, skinM, 0.0145), 0.78, 1.0), 0, -0.047, 0);
  add(parent, ball(0.011, 0.021, 0.013, skinM, 12), -side * 0.007, -0.04, 0.024);
  const fingers = [];
  const zs = [0.026, 0.009, -0.009, -0.025];
  const lens = [0.042, 0.046, 0.043, 0.035];
  zs.forEach((z, i) => {
    const f1 = pivot(parent, 0, -0.084, z);
    add(f1, rbox(0.017, lens[i] * 0.55, 0.0158, skinM, 0.0076), 0, -lens[i] * 0.27, 0);
    const f2 = pivot(f1, 0, -lens[i] * 0.55, 0);
    add(f2, taperZ(rbox(0.015, lens[i] * 0.47, 0.0148, skinM, 0.0072), 1.0, 0.86), 0, -lens[i] * 0.22, 0);
    fingers.push([f1, f2]);
  });
  const th = pivot(parent, side * -0.006, -0.03, 0.036);
  add(th, rbox(0.018, 0.026, 0.018, skinM, 0.0085), 0, -0.011, 0.006);
  const th2 = pivot(th, 0, -0.024, 0.006);
  add(th2, taperZ(rbox(0.016, 0.024, 0.016, skinM, 0.0078), 1.0, 0.85), 0, -0.01, 0);
  const at = (v, i) => (Array.isArray(v) ? v[i] : v);
  const pose = (name, k = 1, from = 'relax') => {
    const A = HAND_POSES[from];
    const B = HAND_POSES[name];
    const mix = (x, y) => x + (y - x) * k;
    fingers.forEach(([f1, f2], i) => {
      // dobra em direção à palma (-x na esquerda, +x na direita)
      f1.rotation.set(0, 0, 0);
      f1.rotation.z = -side * mix(A.curl[i], B.curl[i]);
      f1.rotation.x = mix(at(A.spread, i), at(B.spread, i)) * (1.5 - i);
      f2.rotation.z = -side * mix(at(A.tip, i), at(B.tip, i));
    });
    const tk = mix(A.thumb, B.thumb);
    th.rotation.set(0.45 + 0.4 * tk, 0, -side * 0.5 * tk);
    th2.rotation.z = -side * 0.45 * tk;
  };
  pose('relax', 0);
  return { pose, fingers };
}

const OUTSOLE = plastic({ color: 0x1b1a19, spec: 0.12 });
const LACE = fabric({ color: 0xe6e0d4 });
function shoe(parent, upperM, soleM, accentM) {
  const g = pivot(parent, 0, -0.015, 0.045);
  add(g, rbox(0.15, 0.022, 0.31, OUTSOLE, 0.009), 0, -0.062, 0.005); // sola de borracha
  add(g, rbox(0.148, 0.032, 0.302, soleM, 0.012), 0, -0.036, 0.005); // entressola grossa
  add(g, rbox(0.126, 0.08, 0.24, upperM, 0.034), 0, 0.012, -0.012); // cabedal
  add(g, ball(0.063, 0.04, 0.062, upperM, 16), 0, -0.004, 0.098); // biqueira
  add(g, rbox(0.13, 0.058, 0.07, accentM, 0.02), 0, 0.006, -0.106); // contraforte
  const tongue = add(g, rbox(0.066, 0.03, 0.1, accentM, 0.012), 0, 0.058, 0.03);
  tongue.rotation.x = -0.28;
  for (let i = 0; i < 4; i++) add(g, rbox(0.074, 0.006, 0.009, LACE, 0.003), 0, 0.062 - i * 0.011, 0.0 + i * 0.026); // cadarços
  for (const sx of [1, -1]) add(g, rbox(0.004, 0.022, 0.15, accentM, 0.002), sx * 0.064, 0.0, 0.0); // faixa lateral
  return g;
}

function skeleton({ skin, torsoMat, sleeveMat, pantsMat, shoeMats, torsoR = 0.26 }) {
  const root = new THREE.Group();
  const skinM = plastic({ color: skin });
  const hips = pivot(root, 0, 0.95, 0);
  add(hips, rbox(0.4, 0.17, 0.27, pantsMat, 0.06), 0, -0.02, 0); // pelve
  const torso = pivot(hips, 0, 0, 0);
  const chest = add(torso, cloth(torsoR, torsoR * 0.86, 0.62, torsoMat, { amp: 0.009, freq: 40, vertical: 3, tilt: 0.8, stack: 0.006, stackAt: -1 }), 0, 0.31, 0);
  chest.scale.z = 0.6;
  // coluna: pivô do peito na altura da cintura. Ombros, braços e pescoço seguem o 'chestP';
  // o cilindro do moletom curva junto (bendSpine), sem costura nem junta aparente.
  const chestP = pivot(torso, 0, SPINE.waist, 0);
  const W0 = SPINE.waist;
  // ombros arredondados do moletom/jaqueta
  // (mais largo que o cilindro na altura da borda superior, para a borda não aparecer como um balde)
  // (no tecido liso da manga: a estampa do tronco esticada na esfera viraria um segundo coração)
  add(chestP, ball(torsoR * 1.05, 0.075, torsoR * 0.63, sleeveMat), 0, 0.605 - W0, 0);
  const neck = pivot(chestP, 0, 0.62 - W0, 0);
  add(neck, tube(0.05, 0.058, 0.12, skinM, 28), 0, 0.03, 0);
  const head = pivot(neck, 0, 0.07, 0.005);

  const arm = (side) => {
    const sh = pivot(chestP, side * (torsoR + 0.04), 0.54 - W0, 0);
    add(sh, ball(0.082, 0.082, 0.082, sleeveMat), 0, 0, 0).rotation.z = PI / 2;
    add(sh, cloth(0.077, 0.07, 0.3, sleeveMat, { amp: 0.007, freq: 85 }), 0, -0.15, 0);
    const el = pivot(sh, 0, -0.3, 0);
    add(el, ball(0.07, 0.07, 0.07, sleeveMat), 0, 0, 0).rotation.z = PI / 2;
    add(el, cloth(0.068, 0.046, 0.27, sleeveMat, { amp: 0.007, freq: 95, stack: 0.006, stackAt: -1, open: true }), 0, -0.13, 0);
    const cuffR = add(el, new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.011, 10, 24), sleeveMat), 0, -0.272, 0); // punho canelado (anel, sem tampa)
    cuffR.rotation.x = PI / 2;
    const hd = pivot(el, 0, -0.29, 0);
    const rig = hand(hd, skinM, side);
    return { sh, el, hand: hd, rig };
  };
  const leg = (side) => {
    const th = pivot(hips, side * 0.11, -0.03, 0);
    add(th, ball(0.1, 0.1, 0.1, pantsMat), 0, 0, 0);
    add(th, cloth(0.1, 0.092, 0.45, pantsMat, { amp: 0.007, freq: 58, tilt: 0.95, lump: 0.35 }), 0, -0.22, 0);
    const kn = pivot(th, 0, -0.45, 0);
    add(kn, ball(0.093, 0.093, 0.093, pantsMat), 0, 0, 0);
    add(kn, cloth(0.092, 0.108, 0.42, pantsMat, { amp: 0.007, freq: 62, tilt: 0.9, lump: 0.35, stack: 0.012, stackAt: -1 }), 0, -0.2, 0);
    const ft = pivot(kn, 0, -0.43, 0);
    shoe(ft, ...shoeMats);
    return { th, kn, ft };
  };
  return { root, hips, torso, chest: chestP, bendSpine: spineBender(chest, chestP), neck, head, skinM, armL: arm(1), armR: arm(-1), legL: leg(1), legR: leg(-1) };
}

// Curvatura da coluna: cada anel do cilindro do tronco gira em torno do pivô da cintura
// por uma fração da rotação do peito (0 embaixo → 1 acima da faixa). O topo coincide com
// o 'chestP' (ombros e pescoço presos nele); a barriga dobra suave, como tecido sobre a coluna.
const SPINE = { waist: 0.2, lo: 0.04, hi: 0.4 };
function spineBender(mesh, chestP) {
  const geo = mesh.geometry;
  const P = geo.attributes.position;
  const N = geo.attributes.normal;
  const P0 = P.array.slice();
  const N0 = N.array.slice();
  const oy = mesh.position.y;
  const sz = mesh.scale.z;
  const q = new THREE.Quaternion();
  const I = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const nv = new THREE.Vector3();
  let bent = false;
  return () => {
    const qc = chestP.quaternion;
    if (!bent && Math.abs(qc.w) > 0.999999) return;
    for (let i = 0; i < P.count; i++) {
      // espaço do tronco (o cilindro tem deslocamento em y e escala em z)
      const y = P0[i * 3 + 1] + oy;
      const k = clamp01((y - SPINE.lo) / (SPINE.hi - SPINE.lo));
      const w = k * k * (3 - 2 * k);
      q.copy(I).slerp(qc, w);
      v.set(P0[i * 3], y - SPINE.waist, P0[i * 3 + 2] * sz).applyQuaternion(q);
      P.setXYZ(i, v.x, v.y + SPINE.waist - oy, v.z / sz);
      nv.set(N0[i * 3], N0[i * 3 + 1], N0[i * 3 + 2] / sz).normalize().applyQuaternion(q);
      N.setXYZ(i, nv.x, nv.y, nv.z * sz);
    }
    P.needsUpdate = true;
    N.needsUpdate = true;
    geo.computeBoundingSphere();
    bent = Math.abs(qc.w) <= 0.999999;
  };
}

// cabeça esculpida: esfera pintada + nariz, orelhas e queixo em volume
// Crânio + mandíbula como UMA malha: cada vértice da esfera vai até a união suave
// (smooth max) do elipsoide do crânio com o da mandíbula, ao longo do raio a partir do
// centro da cabeça. Sem costura/degrau no queixo; a textura da cabeça cobre o queixo.
function headGeometry() {
  const geo = new THREE.SphereGeometry(1, 64, 48);
  const P = geo.attributes.position;
  const C = new THREE.Vector3(0, 0.135, 0);
  const HR = new THREE.Vector3(0.108, 0.135, 0.12);
  const JC = new THREE.Vector3(0, 0.05, 0.026);
  const JR = new THREE.Vector3(0.08, 0.05, 0.066);
  const k = 0.016;
  const w = new THREE.Vector3();
  const o = new THREE.Vector3().subVectors(C, JC).divide(JR);
  const wj = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    w.set(P.getX(i), P.getY(i), P.getZ(i)).multiply(HR);
    const rh = w.length();
    w.divideScalar(rh);
    wj.copy(w).divide(JR);
    const a = wj.lengthSq();
    const b = 2 * o.dot(wj);
    const c = o.lengthSq() - 1;
    const disc = b * b - 4 * a * c;
    const rj = disc > 0 ? Math.max(0, (-b + Math.sqrt(disc)) / (2 * a)) : 0;
    const hh = Math.min(1, Math.max(0, 0.5 + (0.5 * (rj - rh)) / k));
    const r = rh + (rj - rh) * hh + k * hh * (1 - hh) * 0.5;
    P.setXYZ(i, C.x + w.x * r, C.y + w.y * r, C.z + w.z * r);
  }
  P.needsUpdate = true;
  geo.computeVertexNormals();
  weldNormals(geo);
  return geo;
}

function sculptHead(s, skin, tex) {
  const sk = s.skinM;
  const headM = plastic({ map: tex });
  const h = add(s.head, new THREE.Mesh(headGeometry(), headM), 0, 0, 0);
  // nariz esculpido: ponte larga que nasce do rosto, ponta arredondada e asas (narinas)
  const bridge = add(s.head, ball(0.0155, 0.031, 0.016, sk, 16), 0, 0.123, 0.108);
  bridge.rotation.x = -0.3;
  add(s.head, ball(0.019, 0.0145, 0.016, sk, 16), 0, 0.1, 0.117); // ponta
  for (const sx of [1, -1]) add(s.head, ball(0.0095, 0.008, 0.0095, sk, 12), sx * 0.0122, 0.098, 0.111); // asas, embutidas na ponta
  const nostril = plastic({ color: 0x2a140c, spec: 0.1 });
  for (const sx of [1, -1]) add(s.head, ball(0.0045, 0.0025, 0.0035, nostril, 8), sx * 0.0085, 0.0905, 0.119);
  // orelhas na altura entre olho e nariz, um pouco pra trás (antes ficavam na linha da mandíbula)
  for (const sx of [1, -1]) {
    add(s.head, ball(0.016, 0.034, 0.024, sk), sx * 0.105, 0.142, -0.016);
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
  const g = pivot(parent, 0, y, z - 0.005);
  const m = metal({ color, spec: 1.1, shine: 90 });
  const r = rand(4);
  const N = 26;
  for (let i = 0; i < N; i++) {
    const a = (i / (N - 1)) * PI;
    const l = add(g, rbox(0.013, 0.009, 0.007, m, 0.003), Math.cos(a) * w, -Math.sin(a) * 0.12 + (r() - 0.5) * 0.002, 0.008);
    l.rotation.z = a - PI / 2 + (i % 2) * 0.6;
  }
  add(g, rbox(0.026, 0.032, 0.008, m, 0.005), 0, -0.14, 0.012); // pingente
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

function faceRig(s, skin, { lids = false, brows = false, browV = 25.2, browThick = 1 } = {}) {
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
      const p = headPoint(ex / 128, browV / 64, 0.004);
      const b = add(s.head, rbox(0.036, 0.0065 * browThick, 0.008 * browThick, bm, 0.003), p.x, p.y, p.z);
      b.rotation.y = (ex < 32 ? -1 : 1) * 0.33;
      b.userData = { base: p.clone(), side: ex < 32 ? -1 : 1 };
      return b;
    });
  }
  // boca: interior escuro que abre (os lábios estão pintados por cima)
  const mp = headPoint(0.25, 42.3 / 64, -0.002);
  rig.mouth = add(s.head, ball(0.026, 0.011, 0.004, mat({ color: 0x1a0806, spec: 0.2 }), 14), mp.x, mp.y, mp.z - 0.002);
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
        b.position.y = b.userData.base.y + 0.006 * browUp * (rig.browTravel || 1) - 0.004 * browIn;
        b.rotation.z = b.userData.side * (0.12 + 0.35 * browIn);
      });
    }
    const w = 1 - 0.4 * round;
    const h = 0.12 + 1.2 * open + 1.25 * round;
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
  // capuz caído nas costas, embolado em volta do pescoço
  add(s.chest, ball(0.19, 0.085, 0.09, sleeve), 0, 0.6 - SPINE.waist, -0.15);
  const hoodRim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 8, 20, PI * 1.25), sleeve);
  hoodRim.rotation.set(PI / 2, 0, PI * 0.875);
  add(s.chest, hoodRim, 0, 0.615 - SPINE.waist, -0.02);
  const pocket = fabric({ map: denim('#4c4736', 22) });
  add(s.legL.th, rbox(0.035, 0.14, 0.13, pocket, 0.01), 0.1, -0.27, 0);
  add(s.legR.th, rbox(0.035, 0.14, 0.13, pocket, 0.01), -0.1, -0.27, 0);
  const chainG = chainRig(s.chest, 0xb9bec7, 0.62 - SPINE.waist, 0.105);

  const headMesh = sculptHead(s, skin, headTex(skin, { eyes: false, beard: 'goatee', lips: '#6e3d2d', seed: 5, browMesh: true }));
  // sobrancelhas aparecem por cima dos óculos — o rosto consegue atuar
  const face = faceRig(s, skin, { brows: true, browV: 20.6, browThick: 1.5 });
  face.browTravel = 2;
  const hairM = fabric({ color: 0x100c0a });
  const scalp = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, PI * 2, 0, PI / 2), hairM);
  scalp.scale.set(0.114, 0.11, 0.126);
  add(s.head, scalp, 0, 0.165, -0.004);

  // dreads: presos ao topo da cabeça, caindo até o pescoço (orientados no
  // mundo com gravidade; ver update)
  const dreadM = fabric({ map: dreadTex() });
  const cuff = metal({ color: 0x55575c, spec: 0.7, shine: 70 });
  const dreads = [];
  const r = rand(77);
  const N = 30;
  for (let i = 0; i < N; i++) {
    const row = i % 2;
    const a = -PI * 0.8 + (i / (N - 1)) * PI * 1.6; // 0 = nuca, deixa a testa livre
    const len = (0.23 + r() * 0.09 - row * 0.04) * (0.82 + r() * 0.36);
    const rad = 0.098 - row * 0.03;
    const p = pivot(s.head, Math.sin(a) * rad, 0.235 + row * 0.03, -Math.cos(a) * rad * 1.1);
    const th = (0.019 + r() * 0.005) * (0.85 + r() * 0.35);
    const d = add(p, tube(th, th * 0.62, len, dreadM, 10), 0, -len / 2, 0);
    d.rotation.y = r() * PI;
    add(p, ball(th * 0.66, th * 0.7, th * 0.66, dreadM, 8), 0, -len, 0);
    // poucos anéis, finos e escuros (os claros liam como etiquetas de papel)
    if (i % 10 === 3) add(p, tube(th * 0.86 + 0.0025, th * 0.86 + 0.0025, 0.012, cuff, 12), 0, -len * 0.62, 0);
    p.userData = { a, out: 0.1 + r() * 0.08 + row * 0.1, ph: r(), w: 0.7 + r() * 0.6, len };
    dreads.push(p);
  }

  // óculos escuros: lente quase preta, reflexo só no ângulo (fresnel), armação grafite
  const lens = mat({ color: 0x07080b, spec: 1.3, shine: 190 });
  const frameM = metal({ color: 0x3b3e44, spec: 1.2 });
  // 1,2 cm mais baixo e 0,4 cm mais pra trás: a ponte apoia no nariz (antes flutuava na testa)
  const shades = pivot(s.head, 0, 0.146, 0.114);
  for (const sx of [1, -1]) {
    const l = add(shades, rbox(0.088, 0.044, 0.01, lens, 0.012), sx * 0.049, 0, 0);
    l.rotation.y = sx * 0.22;
    add(l, rbox(0.092, 0.007, 0.013, frameM, 0.003), 0, 0.022, 0.001); // aro superior junto da lente
    // haste acompanhando a lateral da cabeça até a orelha
    const arm = add(shades, rbox(0.005, 0.007, 0.14, frameM, 0.002), sx * 0.104, 0.014, -0.07);
    arm.rotation.y = -sx * 0.08;
  }
  add(shades, rbox(0.018, 0.006, 0.009, frameM, 0.003), 0, 0.014, 0.006); // ponte

  // cigarro preso entre o indicador e o médio; filtro do lado da palma (+x na mão direita)
  const cig = pivot(s.armR.hand, 0.0, -0.112, 0.0175);
  cig.rotation.set(0, 0, PI / 2);
  add(cig, tube(0.0055, 0.0055, 0.075, mat({ color: 0xf0ece2, spec: 0.05 }), 8), 0, 0.017, 0);
  add(cig, tube(0.006, 0.006, 0.02, mat({ color: 0xc58a3c }), 8), 0, -0.025, 0);
  const emberM = mat({ color: 0xff5a14, emissive: 1.6, unlit: true });
  const ember = add(cig, tube(0.0058, 0.0058, 0.008, emberM, 8), 0, 0.058, 0);
  add(cig, tube(0.0058, 0.0058, 0.006, mat({ color: 0x77736c }), 8), 0, 0.051, 0); // cinza
  const filterLocal = new THREE.Vector3(0.035, -0.112, 0.0175); // ponta do filtro, espaço da mão

  const ring = metal({ color: 0xc9ccd2, spec: 1.3, shine: 90 });
  for (const rg of [s.armR.rig, s.armL.rig]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.0095, 0.0022, 8, 18), ring);
    band.rotation.x = PI / 2;
    add(rg.fingers[2][0], band, 0, -0.011, 0); // anelar
  }

  const mouth = pivot(s.head, 0, 0.07, 0.115);

  // ---------- atuação (em batidas; loop de 32) ----------
  const P = 32;
  // tragadas nas batidas 6 e 21 (segura a fumaça ~0,5 s antes de soltar no close): sobe, puxa, desce; a baforada cai dentro dos closes (b8–12 e b24–26)
  // leva o cigarro à boca em ~0,55 s e devolve em ~0,57 s (antes: 0,4 s com easing dobrado = salto de 30 cm por pose)
  const puff = curve([[0, 0], [5.5, 0], [6.55, 1, 'inOut'], [7.85, 1, 'linear'], [8.95, 0, 'inOut'], [20.5, 0], [21.55, 1, 'inOut'], [22.85, 1, 'linear'], [23.95, 0, 'inOut']], P);
  const drag = curve([[0, 0], [6.6, 0], [6.8, 1, 'out'], [7.8, 1, 'linear'], [7.9, 0, 'in'], [21.6, 0], [21.8, 1, 'out'], [22.8, 1, 'linear'], [22.9, 0, 'in']], P);
  const exhaleC = curve([[0, 0], [8.25, 0], [8.65, 1, 'inOut'], [10.2, 0.4, 'inOut'], [11.1, 0, 'inOut'], [23.75, 0], [24.15, 1, 'inOut'], [25.7, 0.4, 'inOut'], [26.6, 0, 'inOut']], P);
  // respiração acompanha a tragada: puxa na tragada, solta com a fumaça
  const breath = curve([[0, 0.4], [2.5, 0.8], [5, 0.2], [7.85, 1, 'inOut'], [10.6, 0, 'inOut'], [13, 0.7], [15.5, 0.15], [18, 0.6], [20.8, 0.25], [22.85, 1, 'inOut'], [26.1, 0, 'inOut'], [28.2, 0.7], [30.2, 0.15]], P);
  // olhar: no teto; desce para a tragada; volta mais pra cima soltando a fumaça
  const lookUp = curve([[0, 1], [5.6, 1], [6.6, 0.45, 'inOut'], [8.1, 0.55], [8.9, 1.12, 'inOut'], [11, 1], [20.6, 1], [21.6, 0.45, 'inOut'], [23.1, 0.55], [24.4, 1.12, 'inOut'], [26.5, 1]], P);
  const turn = curve([[0, -0.05], [11.6, -0.05], [12.6, 0.2, 'inOut'], [15, 0.14], [16.5, -0.05, 'inOut'], [26, -0.05], [27.5, -0.22, 'inOut'], [30.5, -0.15], [31.8, -0.05, 'inOut']], P);
  // bater a cinza (dois toques do indicador), com o queixo apontando pro B
  const flick = curve([[0, 0], [12.5, 0], [12.58, 1, 'out'], [12.7, 0, 'in'], [12.78, 1, 'out'], [12.92, 0, 'in'], [28.5, 0], [28.58, 1, 'out'], [28.7, 0, 'in'], [28.78, 1, 'out'], [28.92, 0, 'in']], P);
  // sobrancelhas: relaxadas; sobem satisfeitas soltando a fumaça
  const browUp = curve([[0, 0.1], [8.6, 0.1], [9.0, 0.9, 'inOut'], [10.6, 0.2, 'inOut'], [24.1, 0.1], [24.5, 0.9, 'inOut'], [26.1, 0.2, 'inOut']], P);
  // bico no chão na batida, sobe no contratempo (antecipação) e bate de novo no tempo
  const tapCurve = curve([[0, 0], [0.4, 0, 'linear'], [0.72, 1, 'inOut'], [0.86, 0.95, 'inOut'], [0.99, 0, 'in']], 1);
  // A (chapado, largado): balança em meio-tempo, um pouco atrás da batida — o groove do trap.
  // Durante a tragada a cabeça quase para (a mão está presa na boca).
  const accentHalf = (k) => [1, 0.8, 1.12, 0.85][k % 4];
  const nodA = (t) => nodAccent((t - 0.06) / 2, accentHalf) * 1.25 * (1 - 0.85 * puff(t));
  const headPitch = (t) => 0.13 * nodA(t) + 0.06 * nodA(t - 0.07);
  // mola bem amortecida (ζ≈0,65) e pequena: cabelo pesado, não chicote
  const dreadSpring = periodicSpring(headPitch, P, { stiffness: 140, damping: 15 });
  const bodyBob = (t) => 0.02 * nodA(t - 0.03);
  const chainSpring = periodicSpring(bodyBob, P, { stiffness: 110, damping: 13 });

  const W = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const upW = new THREE.Vector3();
  const pole = new THREE.Vector3();
  const qW = new THREE.Quaternion();
  const qH = new THREE.Quaternion();
  const qInv = new THREE.Quaternion();
  const dv = new THREE.Vector3();
  const pw = new THREE.Vector3();
  const hc = new THREE.Vector3();
  const hf = new THREE.Vector3();
  const out = new THREE.Vector3();
  const DOWN_LOCAL = new THREE.Vector3(0, -1, 0);
  const eul = new THREE.Euler();

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

    // rosto: boca em "O" soltando fumaça; sobrancelhas sobem satisfeitas
    face.set({ open: 0.15 * ex, round: ex, browUp: browUp(t) });

    // dreads: direção de repouso (penteado) misturada com a gravidade no
    // mundo, mola pequena e colisão com rosto, ombros e parede
    const lag = THREE.MathUtils.clamp(dreadSpring(t) - headPitch(t), -0.12, 0.12);
    s.head.getWorldQuaternion(qH);
    qInv.copy(qH).invert();
    s.head.localToWorld(hc.set(0, 0.135, 0));
    hf.set(0, 0, 1).applyQuaternion(qH);
    // corpo como cápsula pescoço→quadril (as pontas deitam no ombro/capuz em vez de espetar pro lado)
    const capA = s.neck.getWorldPosition(new THREE.Vector3());
    const capB = s.hips.getWorldPosition(new THREE.Vector3());
    const capR = 0.2;
    const tip = new THREE.Vector3();
    const near = new THREE.Vector3();
    dreads.forEach((p) => {
      const { a: ang, out: o, w, len } = p.userData;
      eul.set(Math.cos(ang) * o + 0.18, 0, Math.sin(ang) * o * 1.15);
      dv.set(0, -1, 0).applyEuler(eul).applyQuaternion(qH); // penteado (no mundo)
      dv.lerp(tmp.set(0, -1, 0), 0.8).normalize(); // gravidade (cabelo pesado cai)
      dv.addScaledVector(hf, -lag * 0.5 * w).normalize(); // inércia do balanço
      p.getWorldPosition(pw);
      // não atravessa a cabeça nem cai na frente do rosto
      out.subVectors(pw, hc).normalize();
      const dOut = dv.dot(out);
      if (dOut < 0.06) dv.addScaledVector(out, 0.06 - dOut).normalize(); // deita rente ao couro cabeludo
      const tipF = pw.clone().addScaledVector(dv, len).sub(hc).dot(hf);
      if (tipF > 0.03) dv.addScaledVector(hf, -(tipF - 0.03) / len).normalize();
      // pontas não entram no corpo: empurra pra fora da cápsula do tronco
      for (let it = 0; it < 2; it++) {
        tip.copy(pw).addScaledVector(dv, len);
        const ab = tmp2.subVectors(capB, capA);
        const k = THREE.MathUtils.clamp(tip.clone().sub(capA).dot(ab) / ab.lengthSq(), 0, 1);
        near.copy(capA).addScaledVector(ab, k);
        const off = tip.clone().sub(near);
        const dist = off.length();
        if (dist >= capR) break;
        tip.copy(near).addScaledVector(off.normalize(), capR);
        dv.subVectors(tip, pw).normalize();
      }
      // nem no topo do encosto do sofá (y 0,92, frente em x 1,9)
      tip.copy(pw).addScaledVector(dv, len);
      if (tip.x > 1.9 && tip.y < 0.93) {
        const need = (0.93 - pw.y) / len;
        if (need > -1) {
          const hz = Math.sqrt(Math.max(0, 1 - need * need));
          const hlen = Math.hypot(dv.x, dv.z) || 1;
          dv.set((dv.x / hlen) * hz, need, (dv.z / hlen) * hz);
        }
      }
      if (pw.x + dv.x * len > 2.03) {
        dv.x = (2.03 - pw.x) / len; // folga do raio do dread até a parede
        dv.normalize();
      }
      dv.applyQuaternion(qInv);
      p.quaternion.setFromUnitVectors(DOWN_LOCAL, dv);
    });
    // corrente: balança só pra fora do peito, pouco
    chainG.rotation.x = Math.min(0, -(chainSpring(t) - bodyBob(t)) * 3);

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
    qW.copy(g.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(tmp2.set(0, 1, 0), 0.25));
    setWorldQuat(s.legL.ft, qW);
    qW.copy(g.quaternion)
      .multiply(new THREE.Quaternion().setFromAxisAngle(tmp2.set(0, 1, 0), -0.15))
      .multiply(new THREE.Quaternion().setFromAxisAngle(tmp2.set(1, 0, 0), -toe));
    setWorldQuat(s.legR.ft, qW);

    // braço esquerdo pousado no topo do encosto, mão caindo por cima da borda
    solveIK(s.armL.sh, s.armL.el, s.armL.hand, L(0.68, 1.0 + 0.006 * br, -0.44), dirW(0.1, 0.3, -1).normalize(), ARM[0], ARM[1], 1);
    setWorldQuat(s.armL.hand, handQuat(dirW(1, -0.15, -0.1), dirW(0.05, -1, -0.1), 1));
    s.armL.hand.rotateZ(-0.22 * nodA(t - 0.12)); // dedos marcando o tempo
    s.armL.rig.pose('drape');

    // braço direito: mão apoiada na coxa com o cigarro em pé / levado à boca
    mouth.getWorldPosition(tmp2);
    const mouthW = tmp2.clone();
    const faceN = new THREE.Vector3(0, 0, 1).applyQuaternion(qH);
    const restWrist = L(-0.17, 0.615 + 0.006 * n, 0.16);
    const restQ = handQuat(dirW(0, -0.25, 1), tmp.set(0, -1, 0), -1).clone();
    // pose da tragada no espaço da cabeça (x = esquerda do A, y = cima, z = frente do rosto)
    const dirH = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(qH).normalize();
    // cigarro inclinado pra longe do rosto (pra baixo/direita/frente), brasa longe das lentes
    const mouthQ = handQuat(dirH(0.85, -0.3, 0.3), dirH(0.4, 0.6, -0.7), -1).clone();
    const k = pf; // a curva já tem easing
    const handQ = restQ.clone().slerp(mouthQ, k);
    const filterW = filterLocal.clone().applyQuaternion(handQ);
    const lipCorner = mouthW.clone().add(dirH(-1, 0, 0).multiplyScalar(0.012)).addScaledVector(faceN, 0.004);
    const mouthWrist = lipCorner.sub(filterW);
    // arco: a mão passa por fora, não atravessa o peito
    const arc = dirW(-1, 0.2, 0.5).multiplyScalar(0.14 * Math.sin(pf * PI));
    const wrist = restWrist.clone().lerp(mouthWrist, k).add(arc);
    // polo do cotovelo: atrás/fora no repouso → à frente/baixo com a mão na boca.
    // (um polo fixo ficava quase oposto à direção ombro→boca e o cotovelo virava de lado numa pose)
    // √k: o polo de 'boca' domina até a mão estar perto da coxa (o cotovelo não passa do ponto e volta)
    const poleR = dirW(-1, -0.7, -0.2).normalize().lerp(dirW(0, -0.6, 1).normalize(), Math.sqrt(k)).normalize();
    solveIK(s.armR.sh, s.armR.el, s.armR.hand, wrist, poleR, ARM[0], ARM[1], 1);
    setWorldQuat(s.armR.hand, handQ);
    s.armR.hand.rotateX(-0.3 * flick(t));
    s.armR.rig.pose('cig');

    boilFigure(s, a.pose, 100, [...dreads.map((d) => [d, 0.03]), [chainG, 0.02]]);

    // brasa: acende forte quando ele puxa
    const glow = 0.55 + 0.2 * Math.sin(t * PI * 3) + 0.3 * a.high + 2.2 * dr;
    emberM.uniforms.uColor.value.set(1, 0.26 + 0.12 * Math.min(glow, 1.5), 0.05);
    emberM.uniforms.uEmissive.value.setScalar(1 + glow);
    ember.getWorldPosition(tmp);
    return { ember: tmp.clone(), glow, mouth: mouthW, faceN, exhale: ex, puffing: pf };
  }

  // janelas (em batidas) em que a boca solta fumaça
  const exhaleWindows = [[8.35, 9.9], [23.85, 25.35]]; // a 2ª baforada cai inteira no close extremo (b24–26)
  return { group: s.root, update, head: s.head, headMesh, foot: s.legR.ft, exhaleC, exhaleWindows, rig: s };
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
  const chainG = chainRig(s.chest, 0xe0b54a, 0.62 - SPINE.waist, 0.1);
  const hoodM = fabric({ map: clothTex('#4b4947', 35) }); // moletom cinza-chumbo (não vira um disco claro nas costas)
  // capuz do moletom por baixo da jaqueta, caído e achatado contra as costas
  const hoodRoll = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.03, 8, 20, PI * 1.2), hoodM);
  hoodRoll.rotation.set(PI / 2 + 0.25, 0, PI * 0.9);
  add(s.chest, hoodRoll, 0, 0.632 - SPINE.waist, -0.03);
  const hood = add(s.chest, ball(0.088, 0.062, 0.024, hoodM), 0, 0.585 - SPINE.waist, -0.168);
  hood.rotation.x = -0.5;
  for (const el of [s.armL.el, s.armR.el]) {
    const c = add(el, new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.011, 10, 24), hoodM), 0, -0.29, 0);
    c.rotation.x = PI / 2;
  }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 18, PI * 1.4), fabric({ color: 0x3d2614 }));
  collar.rotation.set(PI / 2, 0, PI * 0.8);
  add(s.chest, collar, 0, 0.62 - SPINE.waist, -0.01);

  sculptHead(s, skin, headTex(skin, { eyes: true, beard: 'full', lips: '#4a281c', hair: 'fade', seed: 8, browMesh: true }));
  const face = faceRig(s, skin, { lids: true, brows: true });
  // boné de beisebol virado pra trás
  const capM = fabric({ map: capTex(), spec: 0.05 });
  const capRed = plastic({ color: 0x7a1219, spec: 0.05, shine: 12 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, PI * 2, 0, PI / 2), capM);
  dome.scale.set(0.121, 0.1, 0.133);
  add(s.head, dome, 0, 0.19, -0.004);
  add(s.head, ball(0.012, 0.007, 0.012, capM), 0, 0.29, -0.004);
  // aba curva (perfil arredondado, com espessura e curvatura lateral)
  const billShape = new THREE.Shape();
  billShape.moveTo(-0.085, 0);
  billShape.quadraticCurveTo(-0.09, 0.1, 0, 0.115);
  billShape.quadraticCurveTo(0.09, 0.1, 0.085, 0);
  billShape.lineTo(-0.085, 0);
  const billGeo = new THREE.ExtrudeGeometry(billShape, { depth: 0.008, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 12 });
  const bp = billGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) bp.setZ(i, bp.getZ(i) - 0.9 * bp.getX(i) * bp.getX(i)); // curvatura
  billGeo.computeVertexNormals();
  const bill = new THREE.Mesh(billGeo, capRed);
  bill.rotation.set(-PI / 2 - 0.2, 0, 0); // aponta pra trás, só um pouco caída
  bill.scale.setScalar(0.88);
  add(s.head, bill, 0, 0.2, -0.108);
  // ajuste snapback (atrás do boné = na testa): tira preta com botões de pressão, não uma barra clara
  add(s.head, rbox(0.064, 0.011, 0.007, plastic({ color: 0x141414, spec: 0.3 }), 0.003), 0, 0.212, 0.128);
  for (const sx of [-0.012, 0.004, 0.02]) add(s.head, ball(0.0035, 0.0035, 0.002, metal({ color: 0x8a8a8e }), 8), sx, 0.212, 0.1325);

  // óculos de grau: armação grossa de acetato preto com detalhe dourado
  const fr = plastic({ color: 0x0b0b0b, spec: 0.9, shine: 80 });
  const gold = metal({ color: 0xe0b54a });
  const lensM = mat({ color: 0xdff2ff, opacity: 0.12, spec: 2.4, shine: 170 });
  const gl = pivot(s.head, 0, 0.155, 0.122);
  for (const sx of [1, -1]) {
    add(gl, rbox(0.088, 0.012, 0.012, fr, 0.005), sx * 0.052, 0.024, 0);
    add(gl, rbox(0.088, 0.009, 0.012, fr, 0.004), sx * 0.052, -0.022, 0);
    add(gl, rbox(0.011, 0.054, 0.012, fr, 0.004), sx * 0.096, 0.001, 0);
    add(gl, rbox(0.009, 0.046, 0.012, fr, 0.004), sx * 0.009, 0.001, 0);
    add(gl, rbox(0.08, 0.042, 0.003, lensM, 0.001), sx * 0.052, 0.001, 0.001);
    const temple = add(gl, rbox(0.006, 0.009, 0.15, fr, 0.003), sx * 0.104, 0.01, -0.075);
    temple.rotation.x = 0.12; // desce em direção à orelha
    add(gl, rbox(0.008, 0.012, 0.012, gold, 0.003), sx * 0.099, 0.012, -0.004); // dobradiça
  }
  add(gl, rbox(0.02, 0.007, 0.012, gold, 0.003), 0, 0.018, 0.002);
  const glBase = gl.position.clone();
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 8, 22), gold);
  strap.rotation.x = PI / 2;
  add(s.armL.hand, strap, 0, 0.004, 0); // pulseira em volta do pulso
  add(s.armL.hand, rbox(0.008, 0.02, 0.02, gold, 0.004), 0.024, 0.004, 0); // caixa no dorso
  add(s.armL.hand, rbox(0.002, 0.015, 0.015, plastic({ color: 0x0c0c0e, spec: 1.5, shine: 120 }), 0.002), 0.0285, 0.004, 0); // mostrador

  // ---------- atuação (em batidas; loop de 32) ----------
  const P = 32;
  // olha pro amigo no fim de cada frase (batidas 12–16 e 28–32), com a mão no ar
  // cabeça vira primeiro, ombros depois; a mão sobe com antecipação e desce por último
  const look = curve([[0, 0], [11.85, 0], [12.6, 1, 'inOut'], [14.95, 1, 'linear'], [15.7, 0, 'inOut'], [27.85, 0], [28.6, 1, 'inOut'], [30.95, 1, 'linear'], [31.7, 0, 'inOut']], P);
  const lookBody = curve([[0, 0], [12.0, 0], [12.95, 1, 'inOut'], [15.1, 1, 'linear'], [15.95, 0, 'inOut'], [28.0, 0], [28.95, 1, 'inOut'], [31.1, 1, 'linear'], [31.95, 0, 'inOut']], P);
  // sobe em ~0,35 s (senoidal), passa 6% do ponto e assenta — sem estalo de 17 cm por pose
  const handUp = curve([[0, 0], [12.25, 0], [12.45, -0.06, 'inOut'], [13.25, 1.06, 'inOut'], [13.55, 1, 'inOut'], [15.1, 1, 'linear'], [15.95, 0, 'inOut'], [28.25, 0], [28.45, -0.06, 'inOut'], [29.25, 1.06, 'inOut'], [29.55, 1, 'inOut'], [31.1, 1, 'linear'], [31.95, 0, 'inOut']], P);
  // ajeita os óculos dentro do close dele (b7), não no corte pro pé
  const glasses = curve([[0, 0], [6.75, 0], [7.45, 1, 'inOut'], [7.7, 1, 'linear'], [8.4, 0, 'inOut']], P);
  // "cara de grave" no 3 dos compassos pares
  const stank = curve([[0, 0], [5.8, 0], [6.08, 1, 'smooth'], [6.75, 0, 'inOut'], [13.8, 0], [14.08, 1, 'smooth'], [14.75, 0, 'inOut'], [21.8, 0], [22.08, 1, 'smooth'], [22.75, 0, 'inOut'], [29.8, 0], [30.08, 1, 'smooth'], [30.75, 0, 'inOut']], P);
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
  const FINGER_ORDER = [0, 1, 0, 2, 1, 0, 3, 1];
  const keyFinger = (t) => {
    const tt = ((t % P) + P) % P;
    const i = keys.findIndex((c) => tt >= c && tt < c + 0.2);
    return i < 0 ? null : { i: FINGER_ORDER[i % 8], k: Math.sin(((tt - keys[i]) / 0.2) * PI) };
  };
  // boca acompanhando a letra nos compassos 5–6
  const sing = (t) => {
    if (t < 16 || t >= 23.5) return 0;
    const e = Math.floor(t * 2);
    const ph = t * 2 - e;
    return hash(e * 3.17) > 0.35 ? Math.sin(ph * PI) * (0.4 + 0.6 * hash(e * 1.7)) : 0;
  };
  const accent = (beat) => [1, 0.7, 1.2, 0.75][beat % 4];
  const nodB = (t) => nodAccent(t, accent);
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
    // a cadeira gira com ele (antes só o tronco torcia ~100° com a cadeira parada)
    const lb = lookBody(t);
    if (g.userData.baseRy === undefined) g.userData.baseRy = g.rotation.y;
    const swivel = -0.75 * lb;
    g.rotation.y = g.userData.baseRy + swivel;
    if (env.chair) env.chair.rotation.y = g.userData.baseRy + swivel;
    g.updateMatrixWorld(true);
    const L = (x, y, z) => g.localToWorld(W.set(x, y, z)).clone();
    const dirW = (x, y, z) => tmp.set(x, y, z).applyQuaternion(g.quaternion).clone();
    // os pés acompanham só metade do giro (empurram o chão e ficam)
    const qFeet = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), g.userData.baseRy + swivel * 0.3);
    const Lf = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(qFeet).add(g.position);
    const dirF = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(qFeet);
    const lk = look(t);
    const hu = handUp(t);
    const gs = glasses(t);
    const st = stank(t);
    const n = nodB(t);
    const br = breath(t);

    // corpo
    s.hips.position.set(0, 0.642, 0);
    s.hips.rotation.set(0, 0, 0);
    // aceno mais contido; a 'cara de grave' recua o queixo (abre o rosto pra câmera em vez de esconder)
    s.torso.rotation.set(0.16 - 0.08 * lb + 0.035 * n, -0.15 * lb, 0.02 * Math.sin((t / 2) * PI));
    s.torso.scale.set(1 + 0.01 * br, 1 + 0.005 * br, 1 + 0.015 * br);
    s.neck.rotation.set(-0.1 + 0.11 * n - 0.05 * st, -0.33 * lk, 0.03 * st);
    s.head.rotation.set(-0.06 + 0.065 * nodB(t - 0.06) - 0.05 * st, -0.6 * lk + 0.05 * Math.sin((t / 8) * PI * 2), -0.04 * Math.sin((t / 2) * PI) - 0.08 * lk + 0.04 * st);
    face.set({ blink: blinkAt(t), open: Math.max(sing(t), 0.35 * st), browIn: st, browUp: 0.7 * hu });
    gl.position.copy(glBase).add(tmp.set(0, 0.011 * Math.sin(gs * PI), -0.004 * Math.sin(gs * PI))); // o empurrão sobe os óculos de verdade
    chainG.rotation.x = -(chainSpring(t) - bodyBob(t)) * 9;

    // pernas: pés plantados (IK); o direito marca o tempo com o calcanhar
    const heel = 0.025 * nodB(t - 0.02) * (lk > 0.5 ? 1.6 : 1);
    // virado, recolhe os pés pra perto da cadeira (não entram no gabinete da mesa)
    solveIK(s.legL.th, s.legL.kn, s.legL.ft, Lf(0.17, ANKLE_H, 0.5 - 0.1 * lb), dirF(0.3, 0.1, 1).normalize(), LEG[0], LEG[1], -1);
    solveIK(s.legR.th, s.legR.kn, s.legR.ft, Lf(-0.15 + 0.06 * lb, ANKLE_H + heel, 0.47 - 0.2 * lb), dirF(-0.3, 0.1, 1).normalize(), LEG[0], LEG[1], -1);
    const fq = new THREE.Quaternion();
    setWorldQuat(s.legL.ft, fq.copy(qFeet).multiply(new THREE.Quaternion().setFromAxisAngle(tmp.set(0, 1, 0), 0.2)));
    setWorldQuat(
      s.legR.ft,
      fq.copy(qFeet).multiply(new THREE.Quaternion().setFromAxisAngle(tmp.set(0, 1, 0), -0.18)).multiply(new THREE.Quaternion().setFromAxisAngle(tmp.set(1, 0, 0), heel * 6))
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
      const wristR = mw.clone().addScaledVector(dirW(0, 0, 1), -0.085).add(tmp.set(0, 0.09 - 0.004 * clickAt(t), 0));
      // virado pro A, solta o mouse: a mão escorrega pra borda da mesa
      const rel = smooth(clamp01((lookBody(t) - 0.2) / 0.5));
      if (rel > 0) wristR.lerp(mw.clone().addScaledVector(dirW(0, 0, 1), -0.24).add(tmp.set(0, 0.07, 0)), rel);
      solveIK(s.armR.sh, s.armR.el, s.armR.hand, wristR, dirW(-0.6, -1, -0.5).normalize(), ARM[0], ARM[1], 1);
      setWorldQuat(s.armR.hand, handQuat(fwdDown, tmp.set(0, -1, 0), -1));
      s.armR.hand.rotateX(0.12 * clickAt(t));
    }

    // ombro esquerdo sobe junto quando a mão vai pro alto
    if (s.armL.sh.userData.y0 === undefined) s.armL.sh.userData.y0 = s.armL.sh.position.y;
    s.armL.sh.position.y = s.armL.sh.userData.y0 + 0.04 * Math.max(0, Math.min(1, hu));

    // mão esquerda: teclado / óculos / mão no ar
    const kbWrist = (env.keyboard ? env.keyboard.clone() : L(0.1, 0.8, 0.5)).add(dirW(0.08, 0, -0.07)).add(tmp.set(0, 0.075 - 0.008 * keyAt(t), 0));
    const qHB = s.head.getWorldQuaternion(new THREE.Quaternion());
    const dirHB = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(qHB).normalize();
    const glassesW = gl.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.012, -0.122, 0.03).applyQuaternion(qHB)); // dedo na ponte
    // mão no ar acima da cabeça (lê nos planos abertos), no referencial do tronco que gira pro A
    const airW = s.torso.localToWorld(new THREE.Vector3(0.2, 1.0 + 0.04 * n, 0.2));
    let wristL = kbWrist.clone();
    if (gs > 0) wristL.lerp(glassesW, gs);
    if (hu > 0) {
      wristL.lerp(airW, hu); // hu > 1 = passa um pouco do ponto
      wristL.y += 0.14 * Math.sin(Math.min(1, Math.max(0, hu)) * PI); // sobe em arco
    }
    if (hu < 0) wristL.add(tmp.set(0, 0.03 * hu, 0)); // antecipação: afunda antes de subir
    // com a mão no alto o polo "pra baixo" ficaria oposto ao alvo (cotovelo virava): vai pro lado
    const poleL = dirW(0.7, -1, -0.4).normalize().lerp(dirW(1, -0.15, 0.35).normalize(), Math.max(0, Math.min(1, hu))).normalize();
    solveIK(s.armL.sh, s.armL.el, s.armL.hand, wristL, poleL, ARM[0], ARM[1], 1);
    const qKb = handQuat(fwdDown, tmp.set(0, -1, 0), 1).clone();
    const qUp = handQuat(dirW(0, 1, 0.2), dirW(-0.2, 0, 1), 1).clone();
    const qGl = handQuat(dirHB(0.08, 1, -0.12), dirHB(0.15, 0, -1), 1).clone();
    const qL = qKb.clone().slerp(qGl, gs).slerp(qUp, Math.max(0, Math.min(1, hu)));
    setWorldQuat(s.armL.hand, qL);
    // poses dos dedos: teclas / empurrando os óculos / mão aberta no ar
    if (hu > 0.05) s.armL.rig.pose('open', Math.min(1, hu), 'keys');
    else if (gs > 0.05) s.armL.rig.pose('push', gs, 'keys');
    else s.armL.rig.pose('keys');
    s.armR.rig.pose('relax', smooth(clamp01((lookBody(t) - 0.2) / 0.5)), 'mouse');
    if (hu > 0) s.armL.hand.rotateX(-0.35 * nodB(t - 0.1) * hu);
    s.armL.hand.rotateX(0.15 * keyAt(t) * (1 - hu));
    // cada tecla é um dedo que desce (indicador, médio, anelar...), não a mão inteira
    const kp = keyFinger(t);
    if (kp && hu < 0.05 && gs < 0.05) {
      const [f1, f2] = s.armL.rig.fingers[kp.i];
      f1.rotation.z -= 0.42 * kp.k;
      f2.rotation.z -= 0.25 * kp.k;
    }
    boilFigure(s, a.pose, 200, [[chainG, 0.02]]);
  }

  return { group: s.root, update, head: s.head, rig: s };
}
