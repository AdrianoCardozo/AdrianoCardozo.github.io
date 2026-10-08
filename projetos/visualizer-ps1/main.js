// Visualizer PS1 — quarto-estúdio, 4 câmeras de segurança nas quinas do teto,
// cortes no ritmo da batida e loop perfeito (o último frame emenda no primeiro).
import * as THREE from './three.module.min.js';
import { shared, mat, canvasTex, hash } from './ps1.js';
import { buildRoom, ROOM } from './cena.js';
import { buildA, buildB } from './personagens.js';

const PI = Math.PI;
const params = new URLSearchParams(location.search);

const cfg = {
  bpm: 116,
  bars: 8, // 8 compassos a 116 BPM = 16,55 s (fecha a frase de 4 compassos)
  fps: 30,
  vertical: params.has('vertical'),
  title: '',
};

// ---------------- render ----------------
let LO_W = 320;
let LO_H = 180;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.autoClear = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020002);
const rt = new THREE.WebGLRenderTarget(LO_W, LO_H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });

const hudTex = canvasTex(LO_W, LO_H);
const post = new THREE.ShaderMaterial({
  uniforms: {
    tScene: { value: rt.texture },
    tHud: { value: hudTex },
    uLo: { value: new THREE.Vector2(LO_W, LO_H) },
    uFlash: { value: 0 },
    uFlashCol: { value: new THREE.Vector3(1, 1, 1) },
    uGlitch: { value: 0 },
    uAberr: { value: 0 },
    uInvert: { value: 0 },
    uSeed: { value: 0 },
    uTint: { value: new THREE.Vector3(1, 1, 1) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tScene, tHud;
    uniform vec2 uLo;
    uniform float uFlash, uGlitch, uAberr, uInvert, uSeed;
    uniform vec3 uFlashCol, uTint;
    varying vec2 vUv;
    float h1(float n){ return fract(sin(n * 91.345 + uSeed * 17.13) * 47453.53); }
    float bayer4(vec2 p) {
      ivec2 q = ivec2(mod(p, 4.0));
      int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
      return (float(m[q.x + q.y * 4]) + 0.5) / 16.0 - 0.5;
    }
    void main() {
      vec2 uv = vUv;
      float row = floor(uv.y * uLo.y / 3.0);
      float g = step(1.0 - uGlitch * 0.6, h1(row)) * uGlitch;
      uv.x += (h1(row + 7.0) - 0.5) * 0.25 * g;
      vec2 px = floor(uv * uLo) + 0.5;
      vec2 suv = px / uLo;
      float ab = (uAberr + g * 2.0) / uLo.x;
      vec3 c;
      c.r = texture2D(tScene, suv + vec2(ab, 0.0)).r;
      c.g = texture2D(tScene, suv).g;
      c.b = texture2D(tScene, suv - vec2(ab, 0.0)).b;
      c *= uTint;
      // 15 bits de cor (5 por canal) com dithering ordenado, como no PS1
      c = floor(c * 31.0 + bayer4(px) + 0.5) / 31.0;
      c = mix(c, uFlashCol, uFlash);
      c = mix(c, vec3(1.0) - c, uInvert);
      vec4 hud = texture2D(tHud, vUv);
      c = mix(c, hud.rgb, step(0.45, hud.a));
      // linhas de varredura + vinheta de lente de câmera de segurança
      float sl = mod(gl_FragCoord.y, 2.0) < 1.0 ? 0.78 : 1.0;
      vec2 d = vUv - 0.5;
      c *= sl * (1.0 - dot(d, d) * 0.9);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
  depthTest: false,
  depthWrite: false,
});
const postScene = new THREE.Scene();
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

function setSize(vertical) {
  LO_W = vertical ? 180 : 320;
  LO_H = vertical ? 320 : 180;
  rt.setSize(LO_W, LO_H);
  post.uniforms.uLo.value.set(LO_W, LO_H);
  hudTex.image.width = LO_W;
  hudTex.image.height = LO_H;
  hudTex.dispose();
  shared.uSnapRes.value.set(LO_W / 2, LO_H / 2);
  renderer.setSize(LO_W * 2, LO_H * 2, false);
  camera.aspect = LO_W / LO_H;
}

// ---------------- cena ----------------
const room = buildRoom(scene);
const A = buildA();
const B = buildB();
scene.add(A.group, B.group);
A.group.position.set(0.7, 0, -0.3);
A.group.rotation.y = -0.95;
B.group.position.set(-0.7, 0, -0.85);
B.group.rotation.y = 0.85;
room.chair.position.copy(B.group.position);
room.chair.rotation.y = B.group.rotation.y;
room.mic.position.set(1.35, 0, -1.0);
room.mic.rotation.y = 0.7;

// fumaça do cigarro: sprites com transparência por dithering
const smokeTex = canvasTex(16, 16, (g) => {
  const grd = g.createRadialGradient(8, 8, 1, 8, 8, 8);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 16, 16);
});
const SMOKE_N = 26;
const smoke = [];
for (let i = 0; i < SMOKE_N; i++) {
  const m = mat({ map: smokeTex, color: 0xb8b0c0, emissive: 0.25, opacity: 0.5 });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
  scene.add(s);
  smoke.push(s);
}

// ---------------- câmeras ----------------
const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 20);
const { W, D, H } = ROOM;
const CAMS = [
  new THREE.Vector3(-W / 2 + 0.15, H - 0.12, D / 2 - 0.15), // 1: frente-esquerda
  new THREE.Vector3(W / 2 - 0.15, H - 0.12, D / 2 - 0.15), // 2: frente-direita
  new THREE.Vector3(W / 2 - 0.15, H - 0.12, -D / 2 + 0.15), // 3: fundo-direita
  new THREE.Vector3(-W / 2 + 0.15, H - 0.12, -D / 2 + 0.15), // 4: fundo-esquerda
];
// Roteiro de cortes, em batidas de um loop de 32 (8 compassos); é escalado se
// o número de compassos mudar. Fica mais rápido conforme a música pesa e o
// último corte cai exatamente no início do loop.
const SHOTS_32 = [
  { at: 0, cam: 0, tgt: 'room', fov: 70 },
  { at: 4, cam: 2, tgt: 'AB', fov: 52 },
  { at: 8, cam: 0, tgt: 'A', fov: 28 },
  { at: 12, cam: 3, tgt: 'room', fov: 70 },
  { at: 16, cam: 1, tgt: 'B', fov: 28 },
  { at: 18, cam: 2, tgt: 'spk', fov: 42 },
  { at: 20, cam: 0, tgt: 'A', fov: 24 },
  { at: 22, cam: 3, tgt: 'AB', fov: 48 },
  { at: 24, cam: 1, tgt: 'B', fov: 26 },
  { at: 26, cam: 2, tgt: 'room', fov: 70 },
  { at: 28, cam: 0, tgt: 'A', fov: 32 },
  { at: 30, cam: 3, tgt: 'room', fov: 74, zoom: true },
];
let SHOTS = SHOTS_32;
const scaleShots = () => (SHOTS = SHOTS_32.map((s) => ({ ...s, at: (s.at * cfg.bars * 4) / 32 })));

function shotAt(beatF) {
  let i = SHOTS.length - 1;
  while (i > 0 && SHOTS[i].at > beatF) i--;
  const s = SHOTS[i];
  const end = i + 1 < SHOTS.length ? SHOTS[i + 1].at : cfg.bars * 4;
  return { ...s, idx: i, prog: (beatF - s.at) / (end - s.at) };
}

const v3 = new THREE.Vector3();
const v3b = new THREE.Vector3();
function target(name) {
  if (name === 'A') return A.head.getWorldPosition(v3).add(v3b.set(0, 0.0, 0));
  if (name === 'B') return B.head.getWorldPosition(v3).add(v3b.set(0, 0.0, 0));
  if (name === 'AB') {
    A.head.getWorldPosition(v3);
    B.head.getWorldPosition(v3b);
    return v3.add(v3b).multiplyScalar(0.5).add(v3b.set(0, -0.25, 0));
  }
  if (name === 'spk') return v3.set(-0.6, 1.0, -1.6);
  return v3.set(0.0, 0.85, -0.5);
}

// ---------------- paleta por seção ----------------
const PALS = [
  { c: new THREE.Color(1.0, 0.04, 0.07) }, // vermelho Yeezus
  { c: new THREE.Color(1.0, 0.32, 0.02) }, // âmbar queimado
  { c: new THREE.Color(0.55, 0.1, 1.0) }, // roxo ácido
  { c: new THREE.Color(0.35, 1.0, 0.1) }, // verde tóxico
];
function palette(a) {
  let p;
  if (a.section === 0) p = PALS[0];
  else if (a.section === 1) p = a.bar % 2 ? PALS[1] : PALS[0];
  else p = a.bar === cfg.bars - 1 ? PALS[0] : a.bar % 2 ? PALS[3] : PALS[2];
  p.css = '#' + p.c.getHexString();
  return p;
}

// ---------------- análise de áudio ----------------
// Para cada frame: 8 bandas (log), graves, médios, agudos, bumbo e caixa (onsets).
let feat = null;

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar;
        im[i + k + len / 2] = im[i + k] - ai;
        re[i + k] += ar;
        im[i + k] += ai;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

function analyze(buf, frames, fps) {
  const sr = buf.sampleRate;
  const ch = [...Array(buf.numberOfChannels).keys()].map((c) => buf.getChannelData(c));
  const N = 2048;
  const NB = 8;
  const edges = Array.from({ length: NB + 1 }, (_, i) => 35 * Math.pow(12000 / 35, i / NB));
  const raw = [];
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  for (let f = 0; f < frames; f++) {
    const c = Math.floor((f / fps) * sr);
    for (let i = 0; i < N; i++) {
      // janela circular: o fim do trecho conversa com o começo (loop)
      const idx = (((c + i - N / 2) % buf.length) + buf.length) % buf.length;
      let s = 0;
      for (const d of ch) s += d[idx];
      re[i] = (s / ch.length) * (0.5 - 0.5 * Math.cos((2 * PI * i) / N));
      im[i] = 0;
    }
    fft(re, im);
    const bands = new Array(NB).fill(0);
    for (let k = 1; k < N / 2; k++) {
      const hz = (k * sr) / N;
      const b = edges.findIndex((e, i) => hz >= e && hz < edges[i + 1]);
      if (b >= 0) bands[b] += Math.hypot(re[k], im[k]);
    }
    raw.push(bands.map((v) => Math.log1p(v)));
  }
  const norm = (arr) => {
    const sorted = [...arr].sort((x, y) => x - y);
    const lo = sorted[Math.floor(sorted.length * 0.1)];
    const hi = sorted[Math.floor(sorted.length * 0.97)] || 1;
    return arr.map((v) => Math.min(1, Math.max(0, (v - lo) / (hi - lo || 1))));
  };
  const bandsN = [];
  for (let b = 0; b < NB; b++) {
    const col = norm(raw.map((r) => r[b]));
    col.forEach((v, f) => ((bandsN[f] ||= [])[b] = v));
  }
  const onset = (sel) => {
    const e = raw.map((r) => sel.reduce((s, b) => s + r[b], 0));
    const flux = e.map((v, f) => Math.max(0, v - e[(f - 1 + frames) % frames]));
    // decaimento circular para o pico "escorrer"
    const out = norm(flux);
    const dec = new Array(frames).fill(0);
    for (let pass = 0; pass < 2; pass++)
      for (let f = 0; f < frames; f++) dec[f] = Math.max(out[f], dec[(f - 1 + frames) % frames] * 0.78);
    return dec;
  };
  const kick = onset([0, 1]);
  const snare = onset([4, 5, 6]);
  feat = bandsN.map((b, f) => ({
    bands: b,
    bass: (b[0] + b[1] + b[2]) / 3,
    mid: (b[3] + b[4] + b[5]) / 3,
    high: (b[6] + b[7]) / 2,
    kick: kick[f],
    snare: snare[f],
  }));
}

// ---------------- HUD (câmera de segurança) ----------------
const hud = hudTex.userData.ctx;
function drawHud(a, shot) {
  hud.clearRect(0, 0, LO_W, LO_H);
  hud.font = '8px monospace';
  hud.textBaseline = 'top';
  const txt = (s, x, y, col = '#f2efe6') => {
    hud.fillStyle = '#000';
    hud.fillText(s, x + 1, y + 1);
    hud.fillStyle = col;
    hud.fillText(s, x, y);
  };
  if (a.beatPhase < 0.5) {
    hud.fillStyle = '#ff2020';
    hud.fillRect(6, 7, 5, 5);
  }
  txt('REC', 14, 5);
  const names = ['QUINA NO', 'QUINA NE', 'QUINA SE', 'QUINA SO'];
  txt(`CAM 0${shot.cam + 1}`, 6, 15);
  txt(names[shot.cam], 6, 24, '#a9a49a');
  const r = `AO VIVO`;
  txt(r, LO_W - 6 - r.length * 5, 5);
  txt('∞', LO_W - 14, 15, '#ff2020');
  // mini VU
  for (let i = 0; i < 8; i++) {
    const h = Math.round(a.bands[i] * 14);
    hud.fillStyle = i < 3 ? '#ff2020' : '#f2efe6';
    hud.fillRect(6 + i * 4, LO_H - 7 - h, 3, h + 1);
  }
  if (cfg.title) txt(cfg.title.toUpperCase(), LO_W - 6 - cfg.title.length * 5, LO_H - 14);
  // binariza o alfa (texto em pixel duro)
  const img = hud.getImageData(0, 0, LO_W, LO_H);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 110 ? 255 : 0;
  hud.putImageData(img, 0, 0);
  hudTex.needsUpdate = true;
}

// ---------------- luzes ----------------
function setLight(i, x, y, z, col, k, fall) {
  shared.uLightPos.value[i].set(x, y, z);
  shared.uLightCol.value[i].set(col.r * k, col.g * k, col.b * k);
  shared.uLightFall.value[i] = fall;
}
const COL = {
  screen: new THREE.Color(0.35, 0.55, 1.0),
  neon: new THREE.Color(1.0, 0.1, 0.35),
  moon: new THREE.Color(0.3, 0.35, 0.8),
  ember: new THREE.Color(1.0, 0.4, 0.1),
  white: new THREE.Color(1, 0.95, 0.9),
  tv: new THREE.Color(0.6, 0.7, 1.0),
  key: new THREE.Color(1.0, 0.78, 0.8),
};

// ---------------- frame ----------------
const loopLen = () => (cfg.bars * 4 * 60) / cfg.bpm;
const frameCount = () => Math.round(loopLen() * cfg.fps);

function renderAt(t) {
  const L = loopLen();
  t = ((t % L) + L) % L;
  const nf = frameCount();
  const frame = Math.floor((t / L) * nf + 1e-6) % nf;
  const beatLen = 60 / cfg.bpm;
  const beatF = t / beatLen;
  const beat = Math.floor(beatF + 1e-6);
  const bar = Math.floor(beat / 4);
  const f = feat ? feat[frame] : { bands: new Array(8).fill(0), bass: 0, mid: 0, high: 0, kick: 0, snare: 0 };
  const a = {
    ...f,
    t,
    frame,
    bpm: cfg.bpm,
    beatF,
    beat,
    beatPhase: beatF - beat,
    bar,
    loopPos: t / L,
    section: bar < cfg.bars / 4 ? 0 : bar < cfg.bars / 2 ? 1 : 2,
  };
  const pal = palette(a);

  // personagens (animação "travada" em 15 qps, como nos jogos da época)
  const step = Math.floor(beatF * 4) / 4 + Math.round(((beatF % 0.25) / 0.25) * 2) / 8;
  const aChar = { ...a, beatF: step, beat: Math.floor(step), beatPhase: step - Math.floor(step) };
  const { ember, glow } = A.update(aChar);
  B.update(aChar);
  room.update(a, pal);
  scene.updateMatrixWorld();

  // câmera do plano atual
  const shot = shotAt(beatF);
  const cp = CAMS[shot.cam];
  const shake = a.kick * (a.section === 2 ? 0.035 : 0.018);
  camera.position.set(cp.x + (hash(frame) - 0.5) * shake, cp.y + (hash(frame + 99) - 0.5) * shake, cp.z);
  camera.lookAt(target(shot.tgt));
  if (cfg.camOverride) {
    // usado só para inspecionar a cena (ex.: ?render + vis.init({ camOverride }))
    const o = cfg.camOverride;
    camera.position.fromArray(o.pos);
    camera.lookAt(o.tgt ? v3.fromArray(o.tgt) : target(o.who));
  }
  let fov = cfg.camOverride?.fov ?? shot.fov * (1 - 0.1 * shot.prog);
  if (shot.zoom) fov = shot.fov * (1 - 0.45 * shot.prog ** 2);
  fov *= 1 - 0.05 * a.kick;
  if (cfg.vertical) fov = Math.min(110, fov * 1.55);
  camera.fov = fov;
  camera.aspect = LO_W / LO_H;
  camera.updateProjectionMatrix();

  // luzes
  const strobe = a.section >= 1 && a.snare > 0.55 ? a.snare : 0;
  setLight(0, 0, 2.3, 0, pal.c, 0.6 + 1.6 * a.bass, 0.3);
  setLight(1, -0.6, 1.15, -1.35, COL.screen, 0.55 + 0.2 * a.mid, 1.6);
  setLight(2, 2.2, 2.0, 0.25, COL.neon, 0.9 * (0.8 + 0.6 * a.mid), 1.2);
  setLight(3, -2.2, 1.5, -0.55, COL.moon, 0.45, 0.8);
  setLight(4, ember.x, ember.y, ember.z, COL.ember, 0.06 * glow, 60);
  setLight(5, 0.2, 2.3, 0.6, COL.white, strobe * (a.section === 2 ? 3.2 : 1.8), 0.25);
  setLight(6, 1.6, 0.6, 1.25, COL.tv, 0.35 + 0.4 * a.high, 2.5);
  // luz principal suave vindo da frente, para os personagens lerem bem
  setLight(7, 0.1, 2.1, 1.0, COL.key, 0.75 + 0.35 * a.bass, 0.35);
  shared.uAmbient.value.set(0.11 + 0.1 * pal.c.r * a.bass, 0.08 + 0.07 * pal.c.g * a.bass, 0.12 + 0.1 * pal.c.b * a.bass);
  shared.uFogColor.value.set(pal.c.r * 0.06, pal.c.g * 0.03, pal.c.b * 0.06);

  // fumaça: cada partícula tem vida de 2 compassos, defasada (loop-safe)
  const life = beatLen * 8;
  smoke.forEach((s, i) => {
    const age = (t + (i / SMOKE_N) * life) % life;
    const k = age / life;
    const seed = i * 1.37;
    const born = t - age;
    const drift = Math.sin(born * 2.1 + seed) * 0.15;
    s.position.set(
      ember.x + drift * k + Math.sin(k * 6 + seed) * 0.04 * k,
      ember.y + k * 0.75 + 0.02,
      ember.z + Math.cos(born * 1.7 + seed) * 0.12 * k
    );
    s.quaternion.copy(camera.quaternion);
    s.scale.setScalar(0.04 + k * 0.3);
    s.material.uniforms.uOpacity.value = 0.4 * (1 - k) ** 1.5 * Math.min(1, k * 8);
  });

  // pós-processamento agressivo
  const lastBeats = beatF - (cfg.bars * 4 - 2);
  post.uniforms.uGlitch.value = Math.max(a.section === 2 ? a.kick * 0.5 : 0, lastBeats > 0 ? Math.min(1, lastBeats / 2) * 0.9 : 0);
  post.uniforms.uAberr.value = 0.4 + a.kick * 1.5;
  post.uniforms.uFlash.value = a.section === 2 && a.snare > 0.7 ? 0.35 * a.snare : 0;
  post.uniforms.uFlashCol.value.set(pal.c.r * 0.5 + 0.5, pal.c.g * 0.5 + 0.5, pal.c.b * 0.5 + 0.5);
  // inversão de 1 frame nos cortes da parte pesada
  const cutFrame = Math.abs(beatF - SHOTS[shot.idx].at) < 1.2 / (cfg.fps * beatLen);
  post.uniforms.uInvert.value = a.section === 2 && cutFrame ? 1 : 0;
  post.uniforms.uSeed.value = frame % 997;

  drawHud(a, shot);
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
}

// ---------------- API (export) e prévia ao vivo ----------------
async function loadAudio(url, ctx) {
  const ab = await (await fetch(url)).arrayBuffer();
  return (ctx || new OfflineAudioContext(2, 44100, 44100)).decodeAudioData(ab);
}

window.vis = {
  async init(o = {}) {
    Object.assign(cfg, o);
    setSize(cfg.vertical);
    scaleShots();
    if (o.audioUrl) analyze(await loadAudio(o.audioUrl), frameCount(), cfg.fps);
    return { frames: frameCount(), seconds: loopLen(), w: LO_W * 2, h: LO_H * 2 };
  },
  renderFrame(i) {
    renderAt(i / cfg.fps);
    return canvas.toDataURL('image/png');
  },
};

setSize(cfg.vertical);
renderAt(0);

if (!params.has('render')) {
  const ui = document.getElementById('ui');
  ui.hidden = false;
  const $ = (id) => document.getElementById(id);
  let ctx = null;
  let src = null;
  let t0 = 0;
  let running = false;
  async function start() {
    ctx?.close();
    ctx = new AudioContext();
    cfg.bpm = +$('bpm').value;
    cfg.bars = +$('bars').value;
    cfg.title = $('title').value;
    scaleShots();
    const file = $('file').files[0];
    if (!file) return alert('Escolha o arquivo de áudio (mp3/wav) primeiro.');
    const url = URL.createObjectURL(file);
    $('go').textContent = 'analisando…';
    const full = await loadAudio(url, ctx);
    // recorta o trecho escolhido
    const start = Math.floor(+$('start').value * full.sampleRate);
    const len = Math.floor(loopLen() * full.sampleRate);
    const clip = ctx.createBuffer(full.numberOfChannels, len, full.sampleRate);
    for (let c = 0; c < full.numberOfChannels; c++) clip.copyToChannel(full.getChannelData(c).subarray(start, start + len), c);
    analyze(clip, frameCount(), cfg.fps);
    src = ctx.createBufferSource();
    src.buffer = clip;
    src.loop = true;
    src.connect(ctx.destination);
    t0 = ctx.currentTime + 0.05;
    src.start(t0);
    $('go').textContent = '↻ reiniciar';
    if (!running) {
      running = true;
      const loop = () => {
        renderAt(ctx.currentTime - t0);
        requestAnimationFrame(loop);
      };
      loop();
    }
  }
  $('go').onclick = start;
  $('vert').onchange = (e) => {
    cfg.vertical = e.target.checked;
    setSize(cfg.vertical);
    document.body.classList.toggle('vertical', cfg.vertical);
  };
}
