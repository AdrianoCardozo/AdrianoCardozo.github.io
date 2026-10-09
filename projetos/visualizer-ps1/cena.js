// O quarto/estúdio como uma maquete de stop-motion: paredes pintadas, espuma
// acústica, mesa com o computador (gabinete com fans RGB, monitor, teclado e
// mouse), monitores de áudio que pulsam, sofá de couro, mesinha com cinzeiro,
// cama, janela, letreiro neon, TV de tubo e arara de roupas.
import * as THREE from './three.module.min.js';
import { mat, plastic, fabric, metal, canvasTex, box, rbox, tube, ball, grain, weave, rand, hash } from './ps2.js';

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
    g.fillStyle = '#2c2731';
    g.fillRect(0, 0, w, h);
    // marcas de rolo de tinta e manchas
    const r = rand(8);
    for (let i = 0; i < 160; i++) {
      g.fillStyle = r() > 0.5 ? `rgba(255,240,250,${0.012 + r() * 0.02})` : `rgba(0,0,0,${0.02 + r() * 0.03})`;
      g.beginPath();
      g.ellipse(r() * w, r() * h, 2 + r() * 8, 4 + r() * 14, 0, 0, PI * 2);
      g.fill();
    }
    for (let i = 0; i < 4; i++) {
      const grd = g.createLinearGradient(0, 0, 0, h);
      const x = r() * w;
      grd.addColorStop(0, 'rgba(10,6,10,0)');
      grd.addColorStop(0.6, 'rgba(10,6,10,0.12)');
      grd.addColorStop(1, 'rgba(10,6,10,0)');
      g.fillStyle = grd;
      g.fillRect(x, 0, 2 + r() * 4, h);
    }
    grain(g, w, h, 9, 2);
  });

const floorTex = () =>
  canvasTex(64, 64, (g, w, h) => {
    const r = rand(3);
    for (let y = 0; y < h; y += 8) {
      let x = -r() * 30;
      while (x < w) {
        const len = 22 + r() * 30;
        const base = 52 + r() * 22;
        g.fillStyle = `rgb(${base + 18},${base * 0.62},${base * 0.38})`;
        g.fillRect(x, y, len, 8);
        // veios da madeira
        for (let k = 0; k < 7; k++) {
          g.strokeStyle = `rgba(30,14,6,${0.12 + r() * 0.2})`;
          g.lineWidth = 0.15 + r() * 0.25;
          g.beginPath();
          const yy = y + 0.8 + r() * 6.4;
          g.moveTo(x, yy);
          g.bezierCurveTo(x + len * 0.3, yy + (r() - 0.5) * 2, x + len * 0.6, yy + (r() - 0.5) * 2, x + len, yy + (r() - 0.5));
          g.stroke();
        }
        g.fillStyle = 'rgba(0,0,0,0.65)';
        g.fillRect(x + len - 0.25, y, 0.25, 8);
        x += len;
      }
      g.fillStyle = 'rgba(0,0,0,0.7)';
      g.fillRect(0, y + 7.75, w, 0.25);
      g.fillStyle = 'rgba(255,220,180,0.06)';
      g.fillRect(0, y, w, 0.3);
    }
    grain(g, w, h, 10, 6);
  });

const foamTex = (c1, c2) =>
  canvasTex(16, 16, (g) => {
    // cunhas: cada célula alterna a direção, faces com degradê de luz
    for (let cy = 0; cy < 2; cy++)
      for (let cx = 0; cx < 2; cx++) {
        const x0 = cx * 8;
        const y0 = cy * 8;
        const vertical = (cx + cy) % 2 === 0;
        for (let i = 0; i < 4; i++) {
          const o = i * 2;
          const grd = vertical ? g.createLinearGradient(x0 + o, 0, x0 + o + 2, 0) : g.createLinearGradient(0, y0 + o, 0, y0 + o + 2);
          grd.addColorStop(0, c1);
          grd.addColorStop(0.5, c2);
          grd.addColorStop(1, '#050304');
          g.fillStyle = grd;
          if (vertical) g.fillRect(x0 + o, y0, 2, 8);
          else g.fillRect(x0, y0 + o, 8, 2);
        }
      }
    grain(g, 16, 16, 14, 4);
  });

const rugTex = () =>
  canvasTex(48, 48, (g, w, h) => {
    g.fillStyle = '#100e11';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a1018';
    g.lineWidth = 1.4;
    g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#8a1018';
    g.beginPath();
    g.arc(24, 22, 11, 0, PI * 2);
    g.fill();
    g.strokeStyle = '#100e11';
    g.lineWidth = 1.2;
    for (const ex of [19.5, 28.5]) {
      g.beginPath();
      g.moveTo(ex - 2, 16.5);
      g.lineTo(ex + 2, 20.5);
      g.moveTo(ex + 2, 16.5);
      g.lineTo(ex - 2, 20.5);
      g.stroke();
    }
    g.beginPath();
    g.arc(24, 25, 5, 0.2, PI - 0.2);
    g.stroke();
    g.fillStyle = '#8a1018';
    [[16, 6], [21, 10], [27, 5], [31, 8]].forEach(([x, l]) => {
      g.fillRect(x, 31, 1.6, l);
      g.beginPath();
      g.arc(x + 0.8, 31 + l, 1.1, 0, PI * 2);
      g.fill();
    });
    // pelo do tapete
    const r = rand(9);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.18)';
      g.fillRect(r() * w, r() * h, 0.12, 0.5);
    }
  });

function posterTex(kind) {
  return canvasTex(32, 48, (g, w, h) => {
    const r = rand(kind * 13 + 1);
    if (kind === 0) {
      g.fillStyle = '#0b0b0b';
      g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 0.5) {
        const fh = 10 + Math.abs(Math.sin(x * 0.7) * 10) + r() * 6;
        const grd = g.createLinearGradient(0, h - fh, 0, h);
        grd.addColorStop(0, '#ffd200');
        grd.addColorStop(0.4, '#ff6a00');
        grd.addColorStop(1, '#5a0a00');
        g.fillStyle = grd;
        g.fillRect(x, h - fh, 0.6, fh);
      }
      g.fillStyle = '#f0ece4';
      g.font = 'bold 8px Georgia, serif';
      g.textAlign = 'center';
      g.fillText('FÚRIA', 16, 13);
      g.fillStyle = '#ff2030';
      g.fillRect(4, 16, 24, 0.6);
    } else if (kind === 1) {
      for (let i = 14; i > 0; i--) {
        g.fillStyle = i % 2 ? '#d1561e' : '#3a1a5e';
        g.beginPath();
        g.arc(16, 24, i * 2.2, 0, PI * 2);
        g.fill();
      }
      g.fillStyle = '#2f7d32';
      g.beginPath();
      g.roundRect(14, 11, 5, 27, 2.5);
      g.roundRect(8, 17, 3, 9, 1.5);
      g.roundRect(8, 23, 7, 3, 1.5);
      g.roundRect(22, 14, 3, 9, 1.5);
      g.roundRect(18, 20, 7, 3, 1.5);
      g.fill();
    } else if (kind === 2) {
      g.fillStyle = '#b5121b';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#f2ede4';
      g.beginPath();
      g.moveTo(16, 8);
      g.quadraticCurveTo(10, 22, 12, 34);
      g.lineTo(20, 34);
      g.quadraticCurveTo(22, 22, 16, 8);
      g.fill();
      g.strokeStyle = '#b5121b';
      g.lineWidth = 0.5;
      g.beginPath();
      g.moveTo(16, 10);
      g.lineTo(16, 33);
      g.stroke();
      g.fillStyle = '#0b0b0b';
      g.font = 'bold 5px Arial, sans-serif';
      g.textAlign = 'center';
      g.fillText('PERDÃO', 16, 43);
    } else {
      for (let y = 0; y < h; y += 4)
        for (let x = 0; x < w; x += 4) {
          g.fillStyle = (x + y) % 8 ? '#e8e2d4' : '#141414';
          g.fillRect(x, y, 4, 4);
        }
      g.fillStyle = '#141414';
      g.beginPath();
      g.ellipse(16, 23, 12, 7, 0, 0, PI * 2);
      g.fill();
      g.fillStyle = '#e8e2d4';
      g.beginPath();
      g.ellipse(16, 23, 10, 5, 0, 0, PI * 2);
      g.fill();
      g.fillStyle = '#c4121b';
      g.beginPath();
      g.arc(16, 23, 4, 0, PI * 2);
      g.fill();
      g.fillStyle = '#000';
      g.beginPath();
      g.arc(16, 23, 1.6, 0, PI * 2);
      g.fill();
    }
    // papel: amassado, desbotado e com fita nos cantos
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, 'rgba(255,255,255,0.08)');
    grd.addColorStop(0.5, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = `rgba(0,0,0,${0.08 + r() * 0.08})`;
      g.lineWidth = 0.2;
      g.beginPath();
      g.moveTo(r() * w, 0);
      g.lineTo(r() * w, h);
      g.stroke();
    }
    g.fillStyle = 'rgba(235,225,190,0.55)';
    g.fillRect(-1, 1, 6, 2.5);
    g.fillRect(w - 5, 1, 6, 2.5);
    grain(g, w, h, 14, kind + 40);
  });
}

function neonTex() {
  return canvasTex(96, 24, (g) => {
    g.font = 'bold 12px "Arial Rounded MT Bold", Arial, sans-serif';
    g.textAlign = 'center';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(255,255,255,1)';
    g.lineWidth = 1.2;
    g.strokeText('NÃO PERTURBE', 48, 16.5);
  });
}

function leatherTex() {
  return canvasTex(32, 32, (g, w, h) => {
    g.fillStyle = '#2a1a14';
    g.fillRect(0, 0, w, h);
    const r = rand(61);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(255,220,200,0.035)' : 'rgba(0,0,0,0.1)';
      g.beginPath();
      g.arc(r() * w, r() * h, 0.2 + r() * 0.5, 0, PI * 2);
      g.fill();
    }
    // rachaduras do couro gasto
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(190,160,140,${0.05 + r() * 0.1})`;
      g.lineWidth = 0.1;
      g.beginPath();
      let x = r() * w;
      let y = r() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (r() - 0.5) * 3;
        y += (r() - 0.5) * 3;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    grain(g, w, h, 8, 62);
  });
}

function keysTex() {
  return canvasTex(64, 20, (g, w, h) => {
    g.fillStyle = '#121214';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#26262b';
    for (let row = 0; row < 5; row++)
      for (let k = 0; k < 15; k++) {
        const kw = k === 14 ? 6 : 3.4;
        g.beginPath();
        g.roundRect(1 + k * 4.1 + (row % 2) * 0.8, 1 + row * 3.7, kw, 3.1, 0.5);
        g.fill();
      }
    g.fillRect(14, 19 - 3.2, 28, 2.8);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(0, 0, w, 0.3);
  });
}

function pianoTex() {
  return canvasTex(64, 8, (g) => {
    g.fillStyle = '#ece9e1';
    g.fillRect(0, 0, 64, 8);
    g.fillStyle = '#222';
    for (let x = 0; x < 64; x += 2.9) g.fillRect(x, 0, 0.25, 8);
    for (let x = 0; x < 64; x += 20.3) [1.9, 4.8, 10.6, 13.5, 16.4].forEach((o) => x + o < 64 && g.fillRect(x + o, 0, 1.7, 5));
  });
}

// ---------------- monitores de áudio ----------------
function speaker() {
  const g = new THREE.Group();
  const cab = plastic({ color: 0x151517, spec: 0.3 });
  g.add(rbox(0.22, 0.34, 0.26, cab, 0.015));
  const ring = mat({ color: 0xff1020, emissive: 1, unlit: true });
  const coneM = plastic({ color: 0x2b2b30, spec: 0.2, side: THREE.DoubleSide });
  const capM = metal({ color: 0x8a8a92 });
  const woofer = new THREE.Group();
  woofer.position.set(0, -0.05, 0.131);
  g.add(woofer);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.006, 8, 32), ring);
  woofer.add(rim);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.028, 0.035, 32, 1, true), coneM);
  cone.rotation.x = -PI / 2;
  cone.position.z = -0.012;
  woofer.add(cone);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 8, 0, PI * 2, 0, PI / 2), capM);
  cap.rotation.x = PI / 2;
  woofer.add(cap);
  const tw = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 8, 0, PI * 2, 0, PI / 2), capM);
  tw.rotation.x = PI / 2;
  tw.position.set(0, 0.1, 0.13);
  g.add(tw);
  return { g, woofer, cap, cone, ring, tw };
}

export function buildRoom(scene) {
  const { W, D, H } = ROOM;
  const room = new THREE.Group();
  scene.add(room);

  // paredes / piso / teto
  const wallT = wallTex();
  wallT.repeat.set(3, 2);
  const wallM = mat({ map: wallT, spec: 0.02 });
  const floorT = floorTex();
  floorT.repeat.set(3, 2.5);
  const floor = plane(W, D, mat({ map: floorT, spec: 0.25, shine: 30 }), 8, 6);
  floor.rotation.x = -PI / 2;
  room.add(floor);
  const ceil = plane(W, D, mat({ color: 0x1c191e }), 6, 4);
  ceil.rotation.x = PI / 2;
  ceil.position.y = H;
  room.add(ceil);
  put(room, plane(W, H, wallM, 8, 4), 0, H / 2, -D / 2); // fundo
  put(room, plane(W, H, wallM, 8, 4), 0, H / 2, D / 2, PI); // frente
  put(room, plane(D, H, wallM, 6, 4), -W / 2, H / 2, 0, PI / 2); // esquerda
  put(room, plane(D, H, wallM, 6, 4), W / 2, H / 2, 0, -PI / 2); // direita
  // rodapé
  const skirt = plastic({ color: 0x0d0c0e, spec: 0.15 });
  put(room, rbox(W, 0.08, 0.02, skirt, 0.005), 0, 0.04, -D / 2 + 0.01);
  put(room, rbox(W, 0.08, 0.02, skirt, 0.005), 0, 0.04, D / 2 - 0.01);
  put(room, rbox(0.02, 0.08, D, skirt, 0.005), -W / 2 + 0.01, 0.04, 0);
  put(room, rbox(0.02, 0.08, D, skirt, 0.005), W / 2 - 0.01, 0.04, 0);

  // espuma acústica (preta e vinho)
  const foamT = foamTex('#4a121b', '#1d0a0e');
  foamT.repeat.set(2, 2);
  const foam = fabric({ map: foamT });
  const foamPanel = (x, y, z, ry) => put(room, rbox(0.6, 0.6, 0.05, foam, 0.008), x, y, z, ry);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) foamPanel(-1.95 + i * 0.62, 1.25 + j * 0.62, -D / 2 + 0.03, 0);
  for (let j = 0; j < 2; j++) foamPanel(W / 2 - 0.03, 1.25 + j * 0.62, -1.2, -PI / 2);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) foamPanel(0.2 + i * 0.62, 1.3 + j * 0.62, D / 2 - 0.03, PI);

  // tapete
  const rug = put(room, rbox(1.9, 0.012, 1.5, fabric({ map: rugTex() }), 0.005), 0.1, 0.006, -0.2);

  // ---------- mesa de produção + computador ----------
  const deskT = canvasTex(32, 32, (g, w, h) => {
    g.fillStyle = '#1a171b';
    g.fillRect(0, 0, w, h);
    weave(g, w, h, 0.04, 71);
    grain(g, w, h, 6, 72);
  });
  const deskM = plastic({ map: deskT, spec: 0.3, shine: 40 });
  const desk = new THREE.Group();
  desk.position.set(-0.6, 0, -1.47);
  room.add(desk);
  put(desk, rbox(2.1, 0.05, 0.62, deskM, 0.012), 0, 0.75, 0);
  for (const sx of [-1, 1]) put(desk, rbox(0.05, 0.75, 0.55, deskM, 0.01), sx * 1.0, 0.375, 0);
  put(desk, rbox(2.0, 0.22, 0.02, deskM, 0.005), 0, 0.62, -0.27);
  // prateleira dos monitores
  put(desk, rbox(1.5, 0.035, 0.24, deskM, 0.01), 0, 0.86, -0.18);
  for (const sx of [-1, 1]) put(desk, rbox(0.035, 0.1, 0.24, deskM, 0.008), sx * 0.72, 0.81, -0.18);
  // tapete de mesa (mousepad grande)
  put(desk, rbox(0.95, 0.006, 0.32, fabric({ color: 0x0c0c0e }), 0.004), 0.08, 0.778, 0.13);

  // telas: DAW (principal) e mixer/analisador (secundária)
  const dawT = canvasTex(160, 90, null, { scale: 6 });
  const anaT = canvasTex(120, 80, null, { scale: 6 });
  const bezel = plastic({ color: 0x0b0b0d, spec: 0.5, shine: 60 });
  const mkScreen = (tex, x, y, z, ry, w, h) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    desk.add(g);
    g.add(rbox(w + 0.03, h + 0.03, 0.025, bezel, 0.006));
    const s = plane(w, h, mat({ map: tex, emissive: 1, unlit: true, fog: 0.3 }), 2, 2);
    s.position.z = 0.0135;
    g.add(s);
    put(g, rbox(0.05, y - 0.88, 0.04, bezel, 0.01), 0, -(y - 0.88) / 2 - h / 2 + 0.02, -0.03);
    put(g, rbox(0.2, 0.012, 0.14, bezel, 0.005), 0, -(y - 0.88) - h / 2 + 0.03, -0.01);
    return g;
  };
  mkScreen(dawT, 0.05, 1.15, -0.14, 0, 0.66, 0.37);
  mkScreen(anaT, -0.62, 1.1, -0.08, 0.38, 0.44, 0.29);

  // teclado e mouse do computador
  const kbM = plastic({ color: 0x141416, spec: 0.3 });
  put(desk, rbox(0.44, 0.022, 0.14, [kbM, kbM, plastic({ map: keysTex(), spec: 0.35 }), kbM, kbM, kbM], 0.006), -0.05, 0.792, 0.16);
  const mouse = put(desk, rbox(0.06, 0.03, 0.1, plastic({ color: 0x0f0f11, spec: 0.6, shine: 70 }), 0.025), 0.32, 0.795, 0.17);
  const mouseLed = put(desk, rbox(0.008, 0.004, 0.03, mat({ color: 0xff2040, emissive: 1, unlit: true }), 0.002), 0.32, 0.811, 0.15);
  // teclado MIDI (à esquerda) e controlador de pads (à direita)
  const midi = put(desk, rbox(0.5, 0.045, 0.17, [kbM, kbM, plastic({ map: pianoTex() }), kbM, kbM, kbM], 0.008), -0.66, 0.8, 0.14, 0.18);
  const pads = [];
  put(desk, rbox(0.25, 0.025, 0.14, kbM, 0.008), 0.66, 0.79, 0.12);
  for (let i = 0; i < 8; i++) {
    const pm = mat({ color: 0xff2040, emissive: 0.2, unlit: true });
    pads.push(pm);
    put(desk, rbox(0.045, 0.012, 0.045, pm, 0.005), 0.575 + (i % 4) * 0.057, 0.806, 0.09 + Math.floor(i / 4) * 0.057);
  }
  // interface de áudio com medidor
  const vuT = canvasTex(16, 8, null, { scale: 6 });
  const ifM = metal({ color: 0x9a1418, emissive: 0.05 });
  const iface = put(desk, rbox(0.2, 0.045, 0.13, [ifM, ifM, ifM, ifM, mat({ map: vuT, emissive: 1, unlit: true }), ifM], 0.006), 0.6, 0.9, -0.12, -0.15);
  // fone, latas, cinzeiro, isqueiro
  const can = (c, x, z, lying) => {
    const m = metal({ color: c, emissive: 0.04 });
    const t = put(desk, tube(0.033, 0.033, 0.12, m, 18), x, lying ? 0.808 : 0.835, z);
    if (lying) t.rotation.z = PI / 2;
    return t;
  };
  can(0x1d6b2a, -0.98, 0.16);
  can(0xc8c8c8, -0.86, 0.22, true);
  const phones = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 8, 24, PI), plastic({ color: 0x0d0d0d }));
  phones.rotation.set(-PI / 2 + 0.3, 0, 0.6);
  put(desk, phones, 0.92, 0.79, 0.12);

  // monitores de áudio nas pontas da mesa
  const spkL = speaker();
  const spkR = speaker();
  put(desk, spkL.g, -0.94, 0.95, -0.06, 0.4);
  put(desk, spkR.g, 0.92, 0.95, -0.06, -0.4);
  // subwoofer no chão
  const sub = speaker();
  sub.g.scale.set(1.6, 1.3, 1.4);
  put(desk, sub.g, 0.45, 0.22, 0.0, -0.2);

  // gabinete do PC no chão, lateral de vidro com fans RGB
  const pc = new THREE.Group();
  pc.position.set(0.66, 0, -1.6);
  pc.rotation.y = -0.25;
  room.add(pc);
  const caseM = plastic({ color: 0x0c0c0e, spec: 0.5, shine: 60 });
  // gabinete oco: a lateral +x é o vidro
  put(pc, rbox(0.012, 0.5, 0.46, caseM, 0.004), -0.109, 0.27, 0);
  put(pc, rbox(0.23, 0.012, 0.46, caseM, 0.004), 0, 0.514, 0);
  put(pc, rbox(0.23, 0.012, 0.46, caseM, 0.004), 0, 0.026, 0);
  put(pc, rbox(0.23, 0.5, 0.012, caseM, 0.004), 0, 0.27, 0.224);
  put(pc, rbox(0.23, 0.5, 0.012, caseM, 0.004), 0, 0.27, -0.224);
  put(pc, rbox(0.012, 0.5, 0.02, caseM, 0.004), 0.109, 0.27, 0.22);
  put(pc, rbox(0.012, 0.5, 0.02, caseM, 0.004), 0.109, 0.27, -0.22);
  put(pc, rbox(0.25, 0.02, 0.48, caseM, 0.006), 0, 0.01, 0); // pés
  const glass = mat({ color: 0x223040, emissive: 0.05, opacity: 0.35, spec: 2.4, shine: 140 });
  put(pc, plane(0.44, 0.46, glass, 1, 1), 0.117, 0.27, 0, PI / 2);
  // interior: placa-mãe, placa de vídeo, cooler
  put(pc, box(0.01, 0.4, 0.36, plastic({ color: 0x15171a })), -0.1, 0.28, -0.01);
  const gpu = put(pc, rbox(0.06, 0.06, 0.3, plastic({ color: 0x1d1d22, spec: 0.5 }), 0.008), 0.0, 0.2, 0.01);
  const gpuLed = put(pc, box(0.004, 0.008, 0.26, mat({ color: 0xff2040, emissive: 1, unlit: true })), 0.032, 0.235, 0.01);
  const fanM = mat({ color: 0xff2040, emissive: 1, unlit: true });
  const fans = [];
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.008, 8, 28), fanM);
    f.position.set(0.0, 0.12 + i * 0.13, 0.205);
    pc.add(f);
    fans.push(f);
    const hub = put(pc, tube(0.02, 0.02, 0.01, plastic({ color: 0x111 }), 12), 0, 0.12 + i * 0.13, 0.205);
    hub.rotation.x = PI / 2;
  }
  const cpuFan = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.007, 8, 28), fanM);
  cpuFan.rotation.y = PI / 2;
  cpuFan.position.set(-0.05, 0.38, -0.02);
  pc.add(cpuFan);

  // ---------- cadeira gamer (do B) ----------
  const chair = new THREE.Group();
  const chM = plastic({ map: leatherTex(), spec: 0.25, shine: 30 });
  const chR = plastic({ color: 0x7e0e16, spec: 0.25 });
  put(chair, rbox(0.52, 0.09, 0.5, chM, 0.035), 0, 0.46, 0);
  const back = put(chair, rbox(0.5, 0.75, 0.09, chM, 0.035), 0, 0.86, -0.26);
  back.rotation.x = -0.12;
  for (const sx of [1, -1]) {
    const st = put(chair, rbox(0.07, 0.72, 0.095, chR, 0.02), sx * 0.17, 0.87, -0.26);
    st.rotation.x = -0.12;
    put(chair, rbox(0.06, 0.03, 0.3, chM, 0.012), sx * 0.27, 0.65, -0.02);
    put(chair, tube(0.015, 0.015, 0.17, metal({ color: 0x222 }), 8), sx * 0.27, 0.56, -0.05);
  }
  const chMetal = metal({ color: 0x2a2a2e });
  put(chair, tube(0.03, 0.03, 0.38, chMetal, 12), 0, 0.23, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2;
    const leg = put(chair, rbox(0.32, 0.03, 0.045, plastic({ color: 0x111 }), 0.012), Math.sin(a) * 0.15, 0.045, Math.cos(a) * 0.15);
    leg.rotation.y = a + PI / 2;
    put(chair, ball(0.025, 0.025, 0.025, plastic({ color: 0x111 })), Math.sin(a) * 0.3, 0.025, Math.cos(a) * 0.3);
  }
  room.add(chair);

  // ---------- sofá de couro (parede direita) ----------
  const sofa = new THREE.Group();
  sofa.position.set(1.68, 0, 0.0);
  sofa.rotation.y = -PI / 2;
  room.add(sofa);
  const lt = leatherTex();
  lt.repeat.set(2, 2);
  const leather = plastic({ map: lt, spec: 0.28, shine: 26 });
  put(sofa, rbox(1.75, 0.25, 0.85, leather, 0.05), 0, 0.16, 0); // base
  for (const sx of [-0.42, 0.42]) {
    const cush = put(sofa, rbox(0.83, 0.13, 0.66, leather, 0.06), sx, 0.36, 0.08);
    cush.rotation.z = (hash(sx * 10) - 0.5) * 0.03;
    const bc = put(sofa, rbox(0.83, 0.42, 0.2, leather, 0.08), sx, 0.62, -0.3);
    bc.rotation.x = -0.18;
  }
  put(sofa, rbox(1.75, 0.6, 0.16, leather, 0.05), 0, 0.6, -0.36); // encosto
  for (const sx of [-1, 1]) put(sofa, rbox(0.17, 0.32, 0.85, leather, 0.07), sx * 0.8, 0.45, 0); // braços
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(sofa, tube(0.025, 0.02, 0.05, plastic({ color: 0x0a0a0a }), 10), sx * 0.8, 0.02, sz * 0.36);
  // almofada e manta
  const pillow = put(sofa, rbox(0.32, 0.3, 0.12, fabric({ map: canvasTex(16, 16, (g, w, h) => {
    g.fillStyle = '#c46a1c';
    g.fillRect(0, 0, w, h);
    weave(g, w, h, 0.15, 81);
  }) }), 0.06), 0.66, 0.6, -0.15);
  pillow.rotation.set(-0.3, 0.2, 0.25);
  const blanket = put(sofa, rbox(0.4, 0.04, 0.6, fabric({ map: canvasTex(16, 16, (g, w, h) => {
    g.fillStyle = '#d8d0be';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#141414';
    for (let x = 0; x < w; x += 4) g.fillRect(x, 0, 1.2, h);
    weave(g, w, h, 0.12, 82);
  }) }), 0.02), -0.62, 0.45, 0.1);
  blanket.rotation.z = 0.08;

  // mesinha de centro: cinzeiro, latas, isqueiro, celular
  const table = new THREE.Group();
  table.position.set(0.42, 0, 0.45);
  table.rotation.y = 0.25;
  room.add(table);
  const woodM = plastic({ map: floorTex(), spec: 0.3 });
  put(table, rbox(0.42, 0.04, 0.75, woodM, 0.01), 0, 0.38, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(table, rbox(0.04, 0.36, 0.04, plastic({ color: 0x111 }), 0.01), sx * 0.17, 0.18, sz * 0.32);
  const ashtray = put(table, tube(0.07, 0.06, 0.025, metal({ color: 0x5a5a60 }), 20), 0.02, 0.413, -0.1);
  for (let i = 0; i < 4; i++) {
    const b = put(table, tube(0.006, 0.006, 0.03, mat({ color: i % 2 ? 0xc58a3c : 0xe8e3d8 }), 6), 0.02 + (hash(i) - 0.5) * 0.07, 0.43, -0.1 + (hash(i + 4) - 0.5) * 0.07);
    b.rotation.set(PI / 2, 0, hash(i + 8) * PI);
  }
  const c1 = put(table, tube(0.033, 0.033, 0.12, metal({ color: 0x9e1620 }), 18), -0.08, 0.46, 0.15);
  put(table, rbox(0.075, 0.008, 0.15, plastic({ color: 0x050505, spec: 1.5, shine: 100 }), 0.01), 0.08, 0.404, 0.2).rotation.y = 0.4;
  put(table, rbox(0.022, 0.06, 0.012, plastic({ color: 0xffb400 }), 0.006), 0.1, 0.43, -0.22);

  // ---------- pedestal de microfone ----------
  const micM = metal({ color: 0x1a1a1c });
  const mic = new THREE.Group();
  put(mic, tube(0.013, 0.013, 1.5, micM, 10), 0, 0.75, 0);
  for (let i = 0; i < 3; i++) {
    const l = put(mic, tube(0.01, 0.01, 0.32, micM, 8), Math.sin((i / 3) * PI * 2) * 0.12, 0.06, Math.cos((i / 3) * PI * 2) * 0.12);
    l.rotation.set(Math.cos((i / 3) * PI * 2) * 1.2, 0, -Math.sin((i / 3) * PI * 2) * 1.2);
  }
  const boom = put(mic, tube(0.011, 0.011, 0.6, micM, 8), -0.2, 1.5, 0);
  boom.rotation.z = PI / 2 - 0.25;
  put(mic, rbox(0.065, 0.17, 0.065, metal({ color: 0xb8b8bc }), 0.03), -0.48, 1.52, 0);
  const pop = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.006, 24), mat({ color: 0x050505, opacity: 0.55, side: THREE.DoubleSide }));
  pop.rotation.z = PI / 2;
  pop.position.set(-0.62, 1.52, 0);
  mic.add(pop);
  room.add(mic);

  // ---------- cama / janela (parede esquerda) ----------
  const bed = new THREE.Group();
  bed.position.set(-W / 2 + 0.5, 0, 0.82);
  room.add(bed);
  put(bed, rbox(0.95, 0.3, 1.9, plastic({ color: 0x18151a, spec: 0.1 }), 0.02), 0, 0.15, 0);
  const sheetT = canvasTex(32, 32, (g, w, h) => {
    g.fillStyle = '#2d2935';
    g.fillRect(0, 0, w, h);
    weave(g, w, h, 0.1, 31);
    const r = rand(31);
    for (let i = 0; i < 30; i++) {
      g.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.15})`;
      g.beginPath();
      g.ellipse(r() * w, r() * h, 6 + r() * 10, 0.6 + r(), r() * 0.6, 0, PI * 2);
      g.fill();
    }
  });
  const sheet = put(bed, rbox(0.98, 0.13, 1.5, fabric({ map: sheetT }), 0.05), 0, 0.36, 0.2);
  sheet.rotation.z = 0.03;
  put(bed, rbox(0.6, 0.13, 0.32, fabric({ color: 0xd9d4ca }), 0.06), 0, 0.39, -0.75).rotation.y = 0.15;
  put(bed, rbox(0.35, 0.06, 0.3, fabric({ color: 0xc46a1c }), 0.03), 0.15, 0.45, 0.5).rotation.y = 0.7;

  const winT = canvasTex(32, 32, null, { scale: 6 });
  const winG = new THREE.Group();
  winG.position.set(-W / 2 + 0.02, 1.55, -0.55);
  winG.rotation.y = PI / 2;
  room.add(winG);
  winG.add(rbox(1.1, 0.9, 0.04, plastic({ color: 0x0c0c0e }), 0.01));
  const winS = plane(1.0, 0.8, mat({ map: winT, emissive: 1, unlit: true, fog: 0.2 }), 2, 2);
  winS.position.z = 0.025;
  winG.add(winS);

  // criado-mudo + luminária de lava
  put(room, rbox(0.4, 0.5, 0.4, plastic({ color: 0x1d1a1f, spec: 0.15 }), 0.015), -W / 2 + 0.25, 0.25, -1.2);
  const lavaM = mat({ color: 0xff3a10, emissive: 1.2, unlit: true });
  const lava = put(room, tube(0.035, 0.05, 0.26, lavaM, 18), -W / 2 + 0.25, 0.65, -1.2);
  put(room, tube(0.06, 0.07, 0.08, metal({ color: 0x9a9aa0 }), 18), -W / 2 + 0.25, 0.54, -1.2);
  put(room, tube(0.035, 0.05, 0.04, metal({ color: 0x9a9aa0 }), 18), -W / 2 + 0.25, 0.8, -1.2);

  // ---------- parede direita: neon e pôsteres ----------
  const neonT = neonTex();
  const neonM = mat({ map: neonT, emissive: 1.4, unlit: true, fog: 0, alphaTest: 0.25 });
  const neon = plane(1.15, 0.29, neonM, 2, 1);
  put(room, neon, W / 2 - 0.04, 2.2, 0.0, -PI / 2);

  const posterAt = (k, x, y, z, ry, s = 1) => {
    const p = plane(0.42 * s, 0.63 * s, fabric({ map: posterTex(k) }), 2, 2);
    put(room, p, x, y, z, ry);
    p.rotation.z = (hash(k + x) - 0.5) * 0.08;
  };
  posterAt(0, W / 2 - 0.02, 1.38, 0.62, -PI / 2, 0.85);
  posterAt(3, W / 2 - 0.02, 1.4, -0.55, -PI / 2, 0.8);
  posterAt(2, -1.5, 1.55, D / 2 - 0.02, PI);
  posterAt(3, -W / 2 + 0.02, 1.55, 0.75, PI / 2);
  posterAt(1, 1.55, 1.6, D / 2 - 0.02, PI, 1.0);

  // pilha de caixas de tênis no chão
  const boxColors = [0xd46a1a, 0x111111, 0xd46a1a, 0xe8e2d6, 0x9e1620, 0xd46a1a];
  boxColors.forEach((c, i) => {
    const b = put(room, rbox(0.34, 0.13, 0.22, plastic({ color: c, spec: 0.1 }), 0.006), 0.75 + (hash(i) - 0.5) * 0.05, 0.065 + i * 0.13, D / 2 - 0.2, (hash(i + 5) - 0.5) * 0.3);
    put(b, box(0.345, 0.03, 0.225, plastic({ color: c === 0x111111 ? 0xd46a1a : 0x111111, spec: 0.1 })), 0, 0.05, 0);
  });

  // ---------- TV de tubo no canto ----------
  const tvT = canvasTex(40, 30, null, { scale: 6 });
  const tv = new THREE.Group();
  tv.position.set(W / 2 - 0.5, 0, D / 2 - 0.42);
  tv.rotation.y = -2.5;
  room.add(tv);
  put(tv, rbox(0.6, 0.3, 0.4, plastic({ map: floorTex(), spec: 0.1 }), 0.01), 0, 0.15, 0); // caixote
  put(tv, rbox(0.52, 0.42, 0.45, plastic({ color: 0x1c1c1e, spec: 0.3 }), 0.04), 0, 0.51, -0.02);
  const tvS = plane(0.42, 0.32, mat({ map: tvT, emissive: 1, unlit: true, fog: 0.3 }), 2, 2);
  tvS.position.set(0, 0.52, 0.205);
  tv.add(tvS);
  put(tv, rbox(0.26, 0.05, 0.2, plastic({ color: 0xb9b6b0, spec: 0.2 }), 0.012), 0.05, 0.325, 0.08);

  // ---------- arara com roupas (parede da frente) ----------
  const rack = new THREE.Group();
  rack.position.set(-0.6, 0, D / 2 - 0.35);
  room.add(rack);
  const steel = metal({ color: 0x8a8a90 });
  put(rack, tube(0.012, 0.012, 1.3, steel, 8), 0, 1.6, 0).rotation.z = PI / 2;
  put(rack, tube(0.012, 0.012, 1.6, steel, 8), -0.65, 0.8, 0);
  put(rack, tube(0.012, 0.012, 1.6, steel, 8), 0.65, 0.8, 0);
  const clothes = ['#4a4a2e', '#d8d0be', '#151515', '#c46a1c', '#5b3a25', '#2d2d33', '#8e0f18'];
  clothes.forEach((c, i) => {
    const m = fabric({ map: canvasTex(16, 16, (g, w, h) => {
      g.fillStyle = c;
      g.fillRect(0, 0, w, h);
      weave(g, w, h, 0.14, 90 + i);
    }) });
    const h = put(rack, rbox(0.05 + (i % 2) * 0.03, 0.75 + (i % 3) * 0.1, 0.5, m, 0.02), -0.55 + i * 0.18, 1.2 - (i % 3) * 0.05, 0);
    h.rotation.y = PI / 2 + (hash(i + 3) - 0.5) * 0.3;
  });
  // tênis no chão
  const sneakers = [[0.3, 1.4, 0xe8e2d6], [-1.55, -0.25, 0x111111], [1.0, -0.6, 0x8a7d6a]];
  sneakers.forEach(([x, z, c], i) => {
    put(room, rbox(0.12, 0.09, 0.3, plastic({ color: c, spec: 0.15 }), 0.035), x, 0.045, z, i);
    put(room, rbox(0.12, 0.09, 0.3, plastic({ color: c, spec: 0.15 }), 0.035), x + 0.15, 0.045, z + 0.05, i + 0.3);
  });
  // cabos no chão (do PC e dos monitores)
  const cable = plastic({ color: 0x050505, spec: 0.3 });
  for (let i = 0; i < 4; i++) {
    const cb = put(room, tube(0.007, 0.007, 0.7 + i * 0.15, cable, 6), 0.1 + i * 0.12, 0.007, -1.25, (i - 1.5) * 0.4);
    cb.rotation.x = PI / 2;
  }

  // ---------- fita de LED no teto ----------
  const ledM = mat({ color: 0xff0010, emissive: 1, unlit: true, fog: 0 });
  const inset = 0.06;
  put(room, box(W - 0.1, 0.02, 0.02, ledM), 0, H - inset, -D / 2 + inset);
  put(room, box(W - 0.1, 0.02, 0.02, ledM), 0, H - inset, D / 2 - inset);
  put(room, box(0.02, 0.02, D - 0.1, ledM), -W / 2 + inset, H - inset, 0);
  put(room, box(0.02, 0.02, D - 0.1, ledM), W / 2 - inset, H - inset, 0);
  // lâmpada pendurada: é a luz principal (e a que faz sombra)
  const BULB = new THREE.Vector3(0.3, H - 0.45, 0.1);
  put(room, tube(0.004, 0.004, 0.42, cable, 6), BULB.x, H - 0.21, BULB.z);
  put(room, tube(0.018, 0.018, 0.04, metal({ color: 0x333 }), 12), BULB.x, BULB.y + 0.05, BULB.z);
  const bulbM = mat({ color: 0xffd9a0, emissive: 2.2, unlit: true });
  const bulb = put(room, ball(0.035, 0.045, 0.035, bulbM, 16), BULB.x, BULB.y, BULB.z);

  // ---------- atualização por frame ----------
  const dawC = dawT.userData.ctx;
  const anaC = anaT.userData.ctx;
  const tvC = tvT.userData.ctx;
  const winC = winT.userData.ctx;
  const vuC = vuT.userData.ctx;
  const clipColors = ['#d9534f', '#e0a03a', '#8a5ad9', '#3aa6d9', '#4cc77d', '#d94ca6', '#e0d03a'];
  const trackNames = ['808', 'KICK', 'CLAP', 'HATS', 'MELODIA', 'PAD', 'VOX'];

  function update(a, pal) {
    // DAW: playlist com clipes e cursor de reprodução em loop
    dawC.fillStyle = '#1b1d22';
    dawC.fillRect(0, 0, 160, 90);
    dawC.fillStyle = '#2b2f37';
    dawC.fillRect(0, 0, 160, 8);
    dawC.fillStyle = '#e6e2d6';
    dawC.font = '5px Arial, sans-serif';
    dawC.textAlign = 'left';
    dawC.fillText(`▶ ${Math.round(a.bpm)} BPM   ${String(a.bar + 1).padStart(2, '0')}:${(a.beat % 4) + 1}`, 3, 5.8);
    dawC.fillStyle = pal.css;
    dawC.fillRect(110, 2, 40 * a.bass, 1.6);
    dawC.fillRect(110, 4.4, 40 * a.mid, 1.6);
    for (let tr = 0; tr < 7; tr++) {
      const y = 10 + tr * 11;
      dawC.fillStyle = tr % 2 ? '#22252c' : '#262a32';
      dawC.fillRect(0, y, 160, 11);
      dawC.fillStyle = '#343943';
      dawC.fillRect(0, y, 26, 10.5);
      dawC.fillStyle = '#cfcabe';
      dawC.font = '4px Arial, sans-serif';
      dawC.fillText(trackNames[tr], 2, y + 6.5);
      for (let c = 0; c < 8; c++) {
        if (hash(tr * 9 + c) < 0.22) continue;
        const x0 = 28 + c * 16.5;
        dawC.fillStyle = clipColors[tr];
        dawC.globalAlpha = 0.85;
        dawC.beginPath();
        dawC.roundRect(x0, y + 1, 16, 9, 1);
        dawC.fill();
        dawC.globalAlpha = 1;
        dawC.fillStyle = 'rgba(0,0,0,0.35)';
        for (let k = 0; k < 6; k++) {
          const hh = 1 + hash(tr * 31 + c * 7 + k) * 5;
          dawC.fillRect(x0 + 1.5 + k * 2.4, y + 5.5 - hh / 2, 1.2, hh);
        }
      }
    }
    const ph = 28 + a.loopPos * 132;
    dawC.fillStyle = '#ffffff';
    dawC.fillRect(ph, 8, 0.6, 82);
    dawT.needsUpdate = true;

    // tela 2: mixer com medidores + espectro
    anaC.fillStyle = '#0d0e12';
    anaC.fillRect(0, 0, 120, 80);
    const nb = a.bands.length;
    for (let i = 0; i < nb; i++) {
      const v = a.bands[i];
      const x = 6 + i * 14;
      anaC.fillStyle = '#1d2027';
      anaC.fillRect(x, 6, 10, 46);
      const segs = Math.round(v * 22);
      for (let k = 0; k < segs; k++) {
        anaC.fillStyle = k > 18 ? '#ff3030' : k > 13 ? '#ffb030' : pal.css;
        anaC.fillRect(x + 1, 50 - k * 2, 8, 1.4);
      }
      anaC.fillStyle = '#8a8f99';
      anaC.fillRect(x + 4, 56, 2, 18);
      anaC.fillStyle = '#d8d8d8';
      anaC.fillRect(x + 1.5, 60 + hash(i) * 10, 7, 2.5);
    }
    anaT.needsUpdate = true;

    // medidor da interface
    vuC.fillStyle = '#050505';
    vuC.fillRect(0, 0, 16, 8);
    for (let i = 0; i < 2; i++) {
      const l = Math.round((i ? a.mid : a.bass) * 14);
      for (let x = 0; x < l; x++) {
        vuC.fillStyle = x > 11 ? '#ff2020' : x > 8 ? '#ffc020' : '#30ff40';
        vuC.fillRect(1 + x, 1 + i * 4, 0.8, 2);
      }
    }
    vuT.needsUpdate = true;

    // TV: chuvisco + caveira piscando no tempo
    for (let y = 0; y < 30; y += 1)
      for (let x = 0; x < 40; x += 1) {
        const v = Math.floor(hash(x * 13.1 + y * 71.7 + a.frame * 3.3) * 150 * (0.45 + a.high));
        tvC.fillStyle = `rgb(${v * 0.85 | 0},${v * 0.9 | 0},${v})`;
        tvC.fillRect(x, y, 1, 1);
      }
    if (a.beat % 2 === 0 || a.section === 2) {
      tvC.fillStyle = a.section === 2 ? '#a0ff40' : '#ff2020';
      tvC.beginPath();
      tvC.ellipse(20, 13, 7 + a.kick, 7 + a.kick, 0, 0, PI * 2);
      tvC.fill();
      tvC.fillRect(16, 17, 8, 6);
      tvC.fillStyle = '#000';
      tvC.beginPath();
      tvC.arc(17, 13, 2, 0, PI * 2);
      tvC.arc(23, 13, 2, 0, PI * 2);
      tvC.fill();
      tvC.fillRect(19.4, 16, 1.2, 1.5);
      for (const x of [17, 19.5, 22]) tvC.fillRect(x, 19.5, 0.8, 3);
    }
    tvT.needsUpdate = true;

    // janela: prédios à noite, luz piscando em vermelho
    winC.fillStyle = '#06050d';
    winC.fillRect(0, 0, 32, 32);
    winC.fillStyle = '#3a3a6a';
    winC.beginPath();
    winC.arc(26, 5, 2.2, 0, PI * 2);
    winC.fill();
    for (let b = 0; b < 6; b++) {
      const bh = 10 + hash(b * 3.3) * 14;
      winC.fillStyle = '#0e0d1a';
      winC.fillRect(b * 5.6, 32 - bh, 5, bh);
      for (let wy = 32 - bh + 2; wy < 31; wy += 2.5)
        for (let wx = b * 5.6 + 1; wx < b * 5.6 + 4.5; wx += 1.6) {
          if (hash(wx * 7 + wy) > 0.55) {
            winC.fillStyle = hash(wx + wy * 3) > 0.8 ? '#ffd27a' : '#6a7aff';
            winC.fillRect(wx, wy, 0.8, 0.9);
          }
        }
    }
    if (a.beat % 4 < 2) {
      winC.fillStyle = '#ff2020';
      winC.beginPath();
      winC.arc(8.5, 32 - 10 - hash(9.9) * 14 - 1, 0.6, 0, PI * 2);
      winC.fill();
    }
    winC.fillStyle = 'rgba(0,0,0,0.55)';
    for (let y = 0; y < 32; y += 2.5) winC.fillRect(0, y, 32, 0.9); // persiana
    winT.needsUpdate = true;

    // monitores de áudio pulsando (graves)
    const pump = 1 + a.bass * 0.9 + a.kick * 0.7;
    for (const s of [spkL, spkR, sub]) {
      s.woofer.scale.set(1 + a.kick * 0.08, 1 + a.kick * 0.08, pump);
      s.cap.position.z = 0.004 + 0.02 * (a.bass + a.kick);
      s.ring.uniforms.uColor.value.set(pal.c.r, pal.c.g, pal.c.b);
      s.ring.uniforms.uEmissive.value.setScalar(0.3 + 1.5 * a.bass);
      s.tw.scale.set(1 + a.high * 0.3, 1 + a.high * 0.3, 1);
    }
    // pads acendendo em sequência
    pads.forEach((p, i) => {
      const on = (a.beat * 2 + Math.floor(a.beatPhase * 2)) % 8 === i ? 1 : 0;
      p.uniforms.uColor.value.set(pal.c.r, pal.c.g, pal.c.b);
      p.uniforms.uEmissive.value.setScalar(on * (0.8 + a.kick) + 0.05);
    });
    // RGB do PC e do mouse acompanham a paleta e o grave
    for (const m of [fanM, gpuLed.material, mouseLed.material]) {
      m.uniforms.uColor.value.set(pal.c.r, pal.c.g, pal.c.b);
      m.uniforms.uEmissive.value.setScalar(0.5 + 1.2 * a.bass);
    }
    // LED do teto e neon
    ledM.uniforms.uColor.value.set(pal.c.r, pal.c.g, pal.c.b);
    ledM.uniforms.uEmissive.value.setScalar(0.25 + 1.6 * a.bass);
    const flick = hash(Math.floor(a.beatF * 4) + 0.5) > 0.88 ? 0.3 : 1;
    neonM.uniforms.uColor.value.set(1, 0.12, 0.35).multiplyScalar(flick * (0.8 + 0.6 * a.mid));
    lavaM.uniforms.uEmissive.value.setScalar(0.8 + 0.3 * Math.sin(a.beatF * PI * 0.25));
    return { flick };
  }

  return { group: room, update, chair, mic, sofa, bulb, BULB };
}
