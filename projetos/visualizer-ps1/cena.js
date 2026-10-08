// O quarto/estúdio: paredes, espuma acústica, mesa, monitores de áudio que pulsam,
// telas com DAW e analisador, cama, janela, letreiro neon, TV de tubo, arara de roupas.
import * as THREE from './three.module.min.js';
import { mat, canvasTex, box, grain, rand, hash } from './ps1.js';

export const ROOM = { W: 4.2, D: 3.6, H: 2.6 };
const PI = Math.PI;

function plane(w, h, m, sx = 6, sy = 4) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h, sx, sy), m);
}

function put(parent, mesh, x, y, z, ry = 0) {
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  parent.add(mesh);
  return mesh;
}

// ---------------- texturas ----------------
const wallTex = () =>
  canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#2a2530';
    g.fillRect(0, 0, w, h);
    grain(g, w, h, 22, 2);
    // manchas / infiltração
    const r = rand(8);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `rgba(10,5,12,${0.15 + r() * 0.2})`;
      g.fillRect(r() * w, r() * h, 4 + r() * 10, 6 + r() * 20);
    }
  });

const floorTex = () =>
  canvasTex(64, 64, (g, w, h) => {
    const r = rand(3);
    for (let y = 0; y < h; y += 8) {
      const base = 40 + r() * 18;
      g.fillStyle = `rgb(${base + 14},${base * 0.6},${base * 0.4})`;
      g.fillRect(0, y, w, 8);
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(0, y + 7, w, 1);
      const cut = Math.floor(r() * w);
      g.fillRect(cut, y, 1, 8);
    }
    grain(g, w, h, 20, 6);
  });

const foamTex = (c1, c2) =>
  canvasTex(16, 16, (g) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const cx = x % 8;
        const cy = y % 8;
        const lit = cx < cy === cx + cy < 8; // facetas da pirâmide
        g.fillStyle = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? (lit ? c1 : c2) : lit ? c2 : c1;
        g.fillRect(x, y, 1, 1);
      }
  });

const rugTex = () =>
  canvasTex(48, 48, (g, w, h) => {
    g.fillStyle = '#0f0d10';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8e0f18';
    g.fillStyle = '#8e0f18';
    g.fillRect(2, 2, w - 4, 2);
    g.fillRect(2, h - 4, w - 4, 2);
    g.fillRect(2, 2, 2, h - 4);
    g.fillRect(w - 4, 2, 2, h - 4);
    // smiley de olhos em X derretendo
    g.beginPath();
    g.arc(24, 22, 12, 0, PI * 2);
    g.fill();
    g.fillStyle = '#0f0d10';
    for (const ex of [19, 29]) {
      for (let i = -2; i <= 2; i++) {
        g.fillRect(ex + i, 18 + i, 1, 1);
        g.fillRect(ex + i, 18 - i, 1, 1);
      }
    }
    g.fillRect(18, 27, 12, 2);
    g.fillStyle = '#8e0f18';
    [[16, 6], [21, 10], [27, 4], [31, 8]].forEach(([x, l]) => g.fillRect(x, 32, 2, l));
  });

function posterTex(kind) {
  return canvasTex(32, 48, (g, w, h) => {
    const r = rand(kind * 13 + 1);
    if (kind === 0) {
      // "FÚRIA" com chamas
      g.fillStyle = '#0a0a0a';
      g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x++) {
        const fh = 10 + r() * 16;
        g.fillStyle = '#ff6a00';
        g.fillRect(x, h - fh, 1, fh);
        g.fillStyle = '#ffd200';
        g.fillRect(x, h - fh * 0.5, 1, fh * 0.5);
      }
      g.fillStyle = '#f0ece4';
      g.font = 'bold 9px monospace';
      g.fillText('FÚRIA', 2, 14);
      g.fillStyle = '#ff2030';
      g.fillRect(2, 17, 28, 1);
    } else if (kind === 1) {
      // cacto psicodélico em círculos concêntricos
      for (let i = 12; i > 0; i--) {
        g.fillStyle = i % 2 ? '#d1561e' : '#3a1a5e';
        g.beginPath();
        g.arc(16, 24, i * 2.4, 0, PI * 2);
        g.fill();
      }
      g.fillStyle = '#2f7d32';
      g.fillRect(14, 12, 5, 26);
      g.fillRect(8, 18, 3, 8);
      g.fillRect(8, 24, 6, 3);
      g.fillRect(22, 15, 3, 8);
      g.fillRect(19, 21, 6, 3);
    } else if (kind === 2) {
      // mãos em oração, minimalista vermelho
      g.fillStyle = '#b5121b';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#f2ede4';
      g.fillRect(13, 10, 3, 22);
      g.fillRect(16, 10, 3, 22);
      g.fillRect(11, 26, 10, 10);
      g.fillStyle = '#b5121b';
      g.fillRect(15, 12, 2, 18);
      g.fillStyle = '#0b0b0b';
      g.font = '6px monospace';
      g.fillText('PERDÃO', 5, 44);
    } else {
      // olho que tudo vê em xadrez
      for (let y = 0; y < h; y += 4)
        for (let x = 0; x < w; x += 4) {
          g.fillStyle = (x + y) % 8 ? '#e8e2d4' : '#141414';
          g.fillRect(x, y, 4, 4);
        }
      g.fillStyle = '#141414';
      g.fillRect(4, 16, 24, 14);
      g.fillStyle = '#e8e2d4';
      g.fillRect(6, 19, 20, 8);
      g.fillStyle = '#c4121b';
      g.fillRect(13, 19, 6, 8);
      g.fillStyle = '#000';
      g.fillRect(15, 21, 2, 4);
    }
    grain(g, w, h, 25, kind + 40);
  });
}

function neonTex() {
  return canvasTex(96, 24, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    g.font = 'bold 11px monospace';
    g.fillText('NÃO PERTURBE', 3, 16);
    // binariza
    const img = g.getImageData(0, 0, w, h);
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 90 ? 255 : 0;
    g.putImageData(img, 0, 0);
  });
}

// ---------------- monitores de áudio ----------------
function speaker(m) {
  const g = new THREE.Group();
  const cab = mat({ color: 0x141416 });
  g.add(box(0.22, 0.34, 0.26, cab));
  const ring = mat({ color: 0xff1020, emissive: 1, unlit: true });
  const coneM = mat({ color: 0x2b2b30 });
  const capM = mat({ color: 0x8a8a92, emissive: 0.1 });
  const woofer = new THREE.Group();
  woofer.position.set(0, -0.05, 0.131);
  g.add(woofer);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.01, 10), ring);
  rim.rotation.x = PI / 2;
  woofer.add(rim);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.03, 0.04, 10, 1, true), coneM);
  cone.material.side = THREE.DoubleSide;
  cone.rotation.x = -PI / 2;
  cone.position.z = -0.012;
  woofer.add(cone);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.01, 8), capM);
  cap.rotation.x = PI / 2;
  woofer.add(cap);
  const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 8), capM);
  tw.rotation.x = PI / 2;
  tw.position.set(0, 0.1, 0.132);
  g.add(tw);
  return { g, woofer, cap, cone, ring, tw };
}

// ---------------- telas dinâmicas ----------------
function screen(w, h) {
  const t = canvasTex(w, h);
  return t;
}

export function buildRoom(scene) {
  const { W, D, H } = ROOM;
  const room = new THREE.Group();
  scene.add(room);

  // paredes / piso / teto
  const wallM = mat({ map: wallTex() });
  wallM.uniforms.map.value.repeat.set(3, 2);
  const floorT = floorTex();
  floorT.repeat.set(4, 3);
  const floor = plane(W, D, mat({ map: floorT }), 8, 6);
  floor.rotation.x = -PI / 2;
  room.add(floor);
  const ceil = plane(W, D, mat({ color: 0x1a171c }), 6, 4);
  ceil.rotation.x = PI / 2;
  ceil.position.y = H;
  room.add(ceil);
  put(room, plane(W, H, wallM, 8, 4), 0, H / 2, -D / 2); // fundo
  put(room, plane(W, H, wallM, 8, 4), 0, H / 2, D / 2, PI); // frente
  put(room, plane(D, H, wallM, 6, 4), -W / 2, H / 2, 0, PI / 2); // esquerda
  put(room, plane(D, H, wallM, 6, 4), W / 2, H / 2, 0, -PI / 2); // direita
  // rodapé
  const skirt = mat({ color: 0x0c0b0d });
  put(room, box(W, 0.08, 0.02, skirt), 0, 0.04, -D / 2 + 0.01);
  put(room, box(W, 0.08, 0.02, skirt), 0, 0.04, D / 2 - 0.01);
  put(room, box(0.02, 0.08, D, skirt), -W / 2 + 0.01, 0.04, 0);
  put(room, box(0.02, 0.08, D, skirt), W / 2 - 0.01, 0.04, 0);

  // espuma acústica (preta e vinho)
  const foam = mat({ map: foamTex('#3a0d14', '#14080b') });
  const foamPanel = (x, y, z, ry, w = 0.6, h = 0.6) => {
    const p = put(room, box(w, h, 0.05, foam), x, y, z, ry);
    p.material.uniforms.map.value.repeat.set(w / 0.3, h / 0.3);
    return p;
  };
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) foamPanel(-1.95 + i * 0.62, 1.25 + j * 0.62, -D / 2 + 0.03, 0);
  for (let j = 0; j < 3; j++) foamPanel(W / 2 - 0.03, 0.9 + j * 0.62, -1.2, -PI / 2);
  for (let j = 0; j < 2; j++) foamPanel(W / 2 - 0.03, 1.2 + j * 0.62, -0.58, -PI / 2);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) foamPanel(0.2 + i * 0.62, 1.3 + j * 0.62, D / 2 - 0.03, PI);

  // tapete
  const rug = plane(1.9, 1.5, mat({ map: rugTex() }), 4, 3);
  rug.rotation.x = -PI / 2;
  rug.position.set(0.1, 0.005, -0.2);
  room.add(rug);

  // ---------- mesa de produção ----------
  const deskM = mat({ color: 0x17151a });
  const desk = new THREE.Group();
  desk.position.set(-0.6, 0, -1.68);
  room.add(desk);
  put(desk, box(2.1, 0.05, 0.62, deskM), 0, 0.75, 0);
  for (const sx of [-1, 1]) put(desk, box(0.05, 0.75, 0.55, deskM), sx * 1.0, 0.375, 0);
  put(desk, box(2.0, 0.22, 0.02, deskM), 0, 0.62, -0.28);
  // prateleira/elevação dos monitores
  put(desk, box(1.4, 0.04, 0.25, mat({ color: 0x241f22 })), 0, 0.86, -0.17);
  for (const sx of [-1, 1]) put(desk, box(0.04, 0.1, 0.25, deskM), sx * 0.68, 0.8, -0.17);

  // telas: DAW e analisador
  const dawT = screen(96, 56);
  const anaT = screen(96, 56);
  const bezel = mat({ color: 0x0a0a0c });
  const mkScreen = (tex, x, ry) => {
    const g = new THREE.Group();
    g.position.set(x, 1.1, -0.2);
    g.rotation.y = ry;
    desk.add(g);
    g.add(box(0.62, 0.38, 0.03, bezel));
    const s = plane(0.58, 0.34, mat({ map: tex, emissive: 1, unlit: true, fog: 0.3 }), 2, 2);
    s.position.z = 0.016;
    g.add(s);
    put(g, box(0.05, 0.18, 0.04, bezel), 0, -0.22, -0.03);
    return g;
  };
  mkScreen(dawT, -0.33, 0.12);
  mkScreen(anaT, 0.33, -0.12);

  // teclado MIDI
  const keysT = canvasTex(64, 8, (g) => {
    g.fillStyle = '#e8e6e0';
    g.fillRect(0, 0, 64, 8);
    g.fillStyle = '#111';
    for (let x = 0; x < 64; x += 3) g.fillRect(x, 0, 1, 8);
    for (let x = 0; x < 64; x += 21) [1, 4, 10, 13, 16].forEach((o) => x + o < 64 && g.fillRect(x + o, 0, 2, 5));
  });
  const kb = put(desk, box(0.7, 0.04, 0.2, [deskM, deskM, mat({ map: keysT }), deskM, deskM, deskM]), -0.15, 0.795, 0.12);
  kb.rotation.y = 0;
  // pads com LED
  const pads = [];
  for (let i = 0; i < 8; i++) {
    const pm = mat({ color: 0xff2040, emissive: 0.2, unlit: true });
    pads.push(pm);
    put(desk, box(0.045, 0.012, 0.045, pm), 0.35 + (i % 4) * 0.055, 0.785, 0.06 + Math.floor(i / 4) * 0.055);
  }
  put(desk, box(0.26, 0.02, 0.14, deskM), 0.43, 0.77, 0.09);
  // interface de áudio com medidor
  const vuT = screen(16, 8);
  const iface = put(desk, box(0.22, 0.05, 0.15, [deskM, deskM, deskM, deskM, mat({ map: vuT, emissive: 1, unlit: true }), deskM]), 0.85, 0.8, -0.05);
  iface.rotation.y = -0.2;
  // fone em cima da mesa, lata de energético, cinzeiro
  put(desk, box(0.07, 0.13, 0.07, mat({ color: 0x1d6b2a, emissive: 0.05 })), -0.95, 0.84, 0.15);
  put(desk, box(0.07, 0.13, 0.07, mat({ color: 0xc8c8c8 })), -0.85, 0.84, 0.2).rotation.z = 1.4;
  put(desk, box(0.12, 0.03, 0.12, mat({ color: 0x3a3a40 })), 0.75, 0.79, 0.2);
  put(desk, box(0.18, 0.06, 0.06, mat({ color: 0x0d0d0d })), -0.7, 0.81, 0.18).rotation.y = 0.5;

  // monitores de áudio em suportes nas pontas da mesa
  const spkL = speaker();
  const spkR = speaker();
  put(desk, spkL.g, -0.88, 0.95, -0.05, 0.35);
  put(desk, spkR.g, 0.88, 0.95, -0.05, -0.35);
  // subwoofer no chão
  const sub = speaker();
  sub.g.scale.set(1.6, 1.3, 1.4);
  put(desk, sub.g, 0.55, 0.22, 0.0, -0.2);

  // ---------- cadeira gamer (do B) ----------
  const chair = new THREE.Group();
  const chM = mat({ color: 0x141214 });
  const chR = mat({ color: 0x8e0f18 });
  put(chair, box(0.5, 0.08, 0.5, chM), 0, 0.46, 0);
  put(chair, box(0.5, 0.7, 0.08, chM), 0, 0.85, -0.26).rotation.x = -0.12;
  put(chair, box(0.08, 0.68, 0.085, chR), 0.18, 0.86, -0.26).rotation.x = -0.12;
  put(chair, box(0.08, 0.68, 0.085, chR), -0.18, 0.86, -0.26).rotation.x = -0.12;
  put(chair, box(0.06, 0.4, 0.06, chM), 0, 0.22, 0);
  for (let i = 0; i < 5; i++) {
    const leg = put(chair, box(0.32, 0.03, 0.04, chM), 0, 0.03, 0, (i / 5) * PI * 2);
    leg.position.set(Math.sin((i / 5) * PI * 2) * 0.16, 0.03, Math.cos((i / 5) * PI * 2) * 0.16);
  }
  room.add(chair);

  // ---------- pedestal de microfone ----------
  const micM = mat({ color: 0x1a1a1c });
  const mic = new THREE.Group();
  put(mic, box(0.03, 1.5, 0.03, micM), 0, 0.75, 0);
  put(mic, box(0.4, 0.02, 0.4, micM), 0, 0.01, 0, 0.4);
  const boom = put(mic, box(0.6, 0.025, 0.025, micM), -0.2, 1.5, 0);
  boom.rotation.z = -0.25;
  put(mic, box(0.07, 0.18, 0.07, mat({ color: 0xb8b8bc, emissive: 0.2 })), -0.48, 1.52, 0);
  const pop = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 10), mat({ color: 0x050505, opacity: 0.55, side: THREE.DoubleSide }));
  pop.rotation.z = PI / 2;
  pop.position.set(-0.62, 1.52, 0);
  mic.add(pop);
  room.add(mic);

  // ---------- cama / janela (parede esquerda) ----------
  const bed = new THREE.Group();
  bed.position.set(-W / 2 + 0.5, 0, 0.82);
  room.add(bed);
  put(bed, box(0.95, 0.3, 1.9, mat({ color: 0x18151a })), 0, 0.15, 0);
  const sheetT = canvasTex(32, 32, (g, w, h) => {
    g.fillStyle = '#2b2733';
    g.fillRect(0, 0, w, h);
    const r = rand(31);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.4})`;
      g.fillRect(r() * w, r() * h, 6 + r() * 10, 1 + r() * 2);
    }
  });
  const sheet = put(bed, box(0.98, 0.12, 1.5, mat({ map: sheetT })), 0, 0.36, 0.2);
  sheet.rotation.z = 0.03;
  put(bed, box(0.6, 0.12, 0.3, mat({ color: 0xd9d4ca })), 0, 0.38, -0.75).rotation.y = 0.15;
  // moletom jogado na cama
  put(bed, box(0.35, 0.06, 0.3, mat({ color: 0xc46a1c })), 0.15, 0.44, 0.5).rotation.y = 0.7;

  const winT = canvasTex(32, 32);
  const winG = new THREE.Group();
  winG.position.set(-W / 2 + 0.02, 1.55, -0.55);
  winG.rotation.y = PI / 2;
  room.add(winG);
  winG.add(box(1.1, 0.9, 0.04, mat({ color: 0x0c0c0e })));
  const winS = plane(1.0, 0.8, mat({ map: winT, emissive: 1, unlit: true, fog: 0.2 }), 2, 2);
  winS.position.z = 0.025;
  winG.add(winS);

  // criado-mudo + lâmpada de lava
  put(room, box(0.4, 0.5, 0.4, mat({ color: 0x1d1a1f })), -W / 2 + 0.25, 0.25, -1.2);
  const lavaM = mat({ color: 0xff3a10, emissive: 1.2, unlit: true });
  put(room, box(0.1, 0.28, 0.1, lavaM), -W / 2 + 0.25, 0.64, -1.2);
  put(room, box(0.12, 0.08, 0.12, mat({ color: 0x9a9aa0 })), -W / 2 + 0.25, 0.54, -1.2);

  // ---------- parede direita: neon, pôsteres, prateleira de tênis ----------
  const neonT = neonTex();
  const neonM = mat({ map: neonT, emissive: 1, unlit: true, fog: 0 });
  const neon = plane(1.15, 0.29, neonM, 2, 1);
  put(room, neon, W / 2 - 0.04, 2.25, 0.25, -PI / 2);
  const neonHalo = plane(1.4, 0.5, mat({ color: 0xff2050, emissive: 1, unlit: true, opacity: 0.18, fog: 0 }), 2, 1);
  put(room, neonHalo, W / 2 - 0.035, 2.25, 0.25, -PI / 2);

  const posters = [];
  const posterAt = (k, x, y, z, ry, s = 1) => {
    const p = plane(0.42 * s, 0.63 * s, mat({ map: posterTex(k) }), 2, 2);
    put(room, p, x, y, z, ry);
    p.rotation.z = (hash(k) - 0.5) * 0.08;
    posters.push(p);
  };
  posterAt(0, W / 2 - 0.02, 1.4, 0.9, -PI / 2);
  posterAt(1, W / 2 - 0.02, 1.35, 1.45, -PI / 2, 0.9);
  posterAt(2, -1.5, 1.55, D / 2 - 0.02, PI);
  posterAt(3, -W / 2 + 0.02, 1.55, 0.75, PI / 2);
  posterAt(1, 1.55, 1.6, D / 2 - 0.02, PI, 1.0);

  // pilha de caixas de tênis no chão
  const boxColors = [0xd46a1a, 0x111111, 0xd46a1a, 0xe8e2d6, 0x9e1620, 0xd46a1a];
  boxColors.forEach((c, i) => put(room, box(0.34, 0.13, 0.22, mat({ color: c })), 0.75 + (hash(i) - 0.5) * 0.05, 0.065 + i * 0.13, D / 2 - 0.2, (hash(i + 5) - 0.5) * 0.3));

  // ---------- TV de tubo no canto ----------
  const tvT = canvasTex(40, 30);
  const tv = new THREE.Group();
  tv.position.set(W / 2 - 0.55, 0, D / 2 - 0.5);
  tv.rotation.y = -2.4;
  room.add(tv);
  put(tv, box(0.6, 0.3, 0.4, mat({ color: 0x3a2a1a })), 0, 0.15, 0); // caixote
  put(tv, box(0.52, 0.42, 0.45, mat({ color: 0x1c1c1e })), 0, 0.51, -0.02);
  const tvS = plane(0.42, 0.32, mat({ map: tvT, emissive: 1, unlit: true, fog: 0.3 }), 2, 2);
  tvS.position.set(0, 0.52, 0.21);
  tv.add(tvS);
  // console antigo + controle no chão
  put(tv, box(0.26, 0.05, 0.2, mat({ color: 0xb9b6b0 })), 0.05, 0.325, 0.08);
  put(room, box(0.12, 0.03, 0.06, mat({ color: 0x8a8884 })), 1.2, 0.015, 1.0, 0.6);

  // ---------- arara com roupas (parede da frente) ----------
  const rack = new THREE.Group();
  rack.position.set(-0.6, 0, D / 2 - 0.35);
  room.add(rack);
  const metal = mat({ color: 0x8a8a90, emissive: 0.1 });
  put(rack, box(1.3, 0.025, 0.025, metal), 0, 1.6, 0);
  put(rack, box(0.025, 1.6, 0.025, metal), -0.65, 0.8, 0);
  put(rack, box(0.025, 1.6, 0.025, metal), 0.65, 0.8, 0);
  const clothes = [0x4a4a2e, 0xd8d0be, 0x151515, 0xc46a1c, 0x5b3a25, 0x2d2d33, 0x8e0f18];
  clothes.forEach((c, i) => {
    const h = put(rack, box(0.04 + (i % 2) * 0.03, 0.75 + (i % 3) * 0.1, 0.5, mat({ color: c })), -0.55 + i * 0.18, 1.2 - (i % 3) * 0.05, 0);
    h.rotation.y = PI / 2 + (hash(i + 3) - 0.5) * 0.3;
  });
  // tênis no chão
  const sneakers = [[0.3, 1.4, 0xe8e2d6], [0.55, 1.5, 0xd46a1a], [-1.6, -0.2, 0x111111], [1.6, -1.4, 0x8a7d6a]];
  sneakers.forEach(([x, z, c], i) => {
    put(room, box(0.12, 0.09, 0.3, mat({ color: c })), x, 0.045, z, i);
    put(room, box(0.12, 0.09, 0.3, mat({ color: c })), x + 0.15, 0.045, z + 0.05, i + 0.3);
  });
  // cabos no chão
  const cable = mat({ color: 0x050505 });
  for (let i = 0; i < 5; i++) put(room, box(0.015, 0.01, 0.6 + i * 0.1, cable), -0.2 + i * 0.1, 0.006, -1.0, (i - 2) * 0.4);

  // ---------- fita de LED no teto ----------
  const ledM = mat({ color: 0xff0010, emissive: 1, unlit: true, fog: 0 });
  const inset = 0.06;
  put(room, box(W - 0.1, 0.03, 0.03, ledM), 0, H - inset, -D / 2 + inset);
  put(room, box(W - 0.1, 0.03, 0.03, ledM), 0, H - inset, D / 2 - inset);
  put(room, box(0.03, 0.03, D - 0.1, ledM), -W / 2 + inset, H - inset, 0);
  put(room, box(0.03, 0.03, D - 0.1, ledM), W / 2 - inset, H - inset, 0);
  // lâmpada pendurada (apagada, só silhueta)
  put(room, box(0.01, 0.4, 0.01, cable), 0.3, H - 0.2, 0.3);
  put(room, box(0.06, 0.08, 0.06, mat({ color: 0xffe0b0, emissive: 0.3 })), 0.3, H - 0.43, 0.3);

  // ---------- atualização por frame ----------
  const dawC = dawT.userData.ctx;
  const anaC = anaT.userData.ctx;
  const tvC = tvT.userData.ctx;
  const winC = winT.userData.ctx;
  const vuC = vuT.userData.ctx;
  const clipColors = ['#e03a3a', '#e0a03a', '#7d3ae0', '#3ab0e0', '#3ae07d', '#e03aa8'];

  function update(a, pal) {
    // DAW: trilhas, clipes e cursor de reprodução em loop
    dawC.fillStyle = '#16141c';
    dawC.fillRect(0, 0, 96, 56);
    dawC.fillStyle = '#2a2633';
    dawC.fillRect(0, 0, 96, 6);
    dawC.fillStyle = '#e8e2d4';
    dawC.font = '5px monospace';
    dawC.fillText(`${Math.round(a.bpm)} BPM  ${String(a.bar + 1).padStart(2, '0')}.${(a.beat % 4) + 1}`, 2, 5);
    for (let tr = 0; tr < 7; tr++) {
      dawC.fillStyle = tr % 2 ? '#1c1a24' : '#201d29';
      dawC.fillRect(0, 7 + tr * 7, 96, 7);
      dawC.fillStyle = clipColors[tr % clipColors.length];
      for (let c = 0; c < 6; c++) {
        if (hash(tr * 9 + c) < 0.25) continue;
        const x0 = 12 + c * 14;
        dawC.fillRect(x0, 8 + tr * 7, 13, 5);
      }
      dawC.fillStyle = '#9e9aa8';
      dawC.fillRect(1, 8 + tr * 7, 8, 5);
    }
    const ph = 12 + (a.loopPos * 84) | 0;
    dawC.fillStyle = '#ffffff';
    dawC.fillRect(ph, 6, 1, 50);
    dawT.needsUpdate = true;

    // analisador: barras de espectro + forma de onda
    anaC.fillStyle = '#07060a';
    anaC.fillRect(0, 0, 96, 56);
    const nb = a.bands.length;
    for (let i = 0; i < nb; i++) {
      const v = a.bands[i];
      const bh = Math.round(v * 34);
      for (let y = 0; y < bh; y += 2) {
        const k = y / 34;
        anaC.fillStyle = k > 0.75 ? '#ff2a2a' : k > 0.5 ? '#ffb02a' : pal.css;
        anaC.fillRect(4 + i * 11, 38 - y, 9, 1);
      }
    }
    anaC.fillStyle = pal.css;
    for (let x = 0; x < 96; x++) {
      const y = 47 + Math.sin(x * 0.35 + a.beatF * PI * 2) * 5 * a.bass * Math.sin(x * 0.07 + 1) + (hash(x + a.frame * 0.0) - 0.5) * 4 * a.high;
      anaC.fillRect(x, y | 0, 1, 1);
    }
    anaT.needsUpdate = true;

    // medidor da interface
    vuC.fillStyle = '#050505';
    vuC.fillRect(0, 0, 16, 8);
    for (let i = 0; i < 2; i++) {
      const l = Math.round((i ? a.mid : a.bass) * 14);
      for (let x = 0; x < l; x++) {
        vuC.fillStyle = x > 11 ? '#ff2020' : x > 8 ? '#ffc020' : '#30ff40';
        vuC.fillRect(1 + x, 1 + i * 4, 1, 2);
      }
    }
    vuT.needsUpdate = true;

    // TV: estática + caveira piscando no tempo
    const img = tvC.createImageData(40, 30);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = hash(i * 0.37 + a.frame * 13.1) * 140 * (0.4 + a.high);
      img.data[i] = v * 0.8;
      img.data[i + 1] = v * 0.85;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    tvC.putImageData(img, 0, 0);
    if (a.beat % 2 === 0 || a.section === 2) {
      tvC.fillStyle = a.section === 2 ? '#a0ff40' : '#ff2020';
      const s = 1 + Math.round(a.kick * 1);
      tvC.fillRect(14 - s, 7 - s, 12 + 2 * s, 10 + s);
      tvC.fillRect(16, 17, 8, 5);
      tvC.fillStyle = '#000';
      tvC.fillRect(15, 10, 4, 4);
      tvC.fillRect(21, 10, 4, 4);
      tvC.fillRect(19, 15, 2, 2);
      tvC.fillRect(17, 19, 1, 3);
      tvC.fillRect(20, 19, 1, 3);
      tvC.fillRect(23, 19, 1, 3);
    }
    tvT.needsUpdate = true;

    // janela: prédios à noite, luz piscando em vermelho
    winC.fillStyle = '#05040c';
    winC.fillRect(0, 0, 32, 32);
    winC.fillStyle = '#2a2a5a';
    winC.fillRect(24, 3, 4, 4); // lua
    for (let b = 0; b < 6; b++) {
      const bh = 10 + hash(b * 3.3) * 14;
      winC.fillStyle = '#0d0c18';
      winC.fillRect(b * 6, 32 - bh, 5, bh);
      for (let wy = 32 - bh + 2; wy < 31; wy += 3)
        for (let wx = b * 6 + 1; wx < b * 6 + 5; wx += 2) {
          if (hash(wx * 7 + wy) > 0.55) {
            winC.fillStyle = hash(wx + wy * 3) > 0.8 ? '#ffd27a' : '#6a7aff';
            winC.fillRect(wx, wy, 1, 1);
          }
        }
    }
    if (a.beat % 4 < 2) {
      winC.fillStyle = '#ff2020';
      winC.fillRect(8, 32 - 10 - hash(9.9) * 14 - 1, 1, 1);
    }
    // persiana
    winC.fillStyle = 'rgba(0,0,0,0.55)';
    for (let y = 0; y < 32; y += 3) winC.fillRect(0, y, 32, 1);
    winT.needsUpdate = true;

    // monitores de áudio pulsando (graves)
    const pump = 1 + a.bass * 0.9 + a.kick * 0.7;
    for (const s of [spkL, spkR, sub]) {
      s.woofer.scale.set(1 + a.kick * 0.12, 1 + a.kick * 0.12, pump);
      s.cap.position.z = 0.01 + 0.025 * (a.bass + a.kick);
      s.ring.uniforms.uColor.value.set(pal.c.r, pal.c.g, pal.c.b);
      s.ring.uniforms.uEmissive.value.setScalar(0.3 + 1.5 * a.bass);
      s.tw.scale.set(1 + a.high * 0.4, 1, 1 + a.high * 0.4);
    }
    // pads acendendo em sequência
    pads.forEach((p, i) => {
      const on = (a.beat * 2 + Math.floor(a.beatPhase * 2)) % 8 === i ? 1 : 0;
      p.uniforms.uColor.value.set(pal.c.r, pal.c.g, pal.c.b);
      p.uniforms.uEmissive.value.setScalar(on * (0.8 + a.kick) + 0.05);
    });
    // LED do teto e neon
    ledM.uniforms.uColor.value.set(pal.c.r, pal.c.g, pal.c.b);
    ledM.uniforms.uEmissive.value.setScalar(0.25 + 1.6 * a.bass);
    const flick = hash(Math.floor(a.beatF * 4) + 0.5) > 0.85 ? 0.25 : 1;
    neonM.uniforms.uColor.value.set(1, 0.12, 0.35).multiplyScalar(flick * (0.8 + 0.6 * a.mid));
    neonHalo.material.uniforms.uOpacity.value = 0.12 + 0.2 * a.mid * flick;
    lavaM.uniforms.uEmissive.value.setScalar(0.8 + 0.3 * Math.sin(a.beatF * PI * 0.25));
    return { flick };
  }

  return { group: room, update, chair, mic };
}
