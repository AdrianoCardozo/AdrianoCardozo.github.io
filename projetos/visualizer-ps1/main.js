// Visualizer estilo PS2 — quarto-estúdio, 4 câmeras nas quinas do teto,
// cortes no ritmo da batida e loop perfeito (o último frame emenda no primeiro).
import * as THREE from './three.module.min.js';
import { shared, mat, canvasTex } from './ps2.js';
import { buildRoom, ROOM } from './cena.js';
import { buildA, buildB } from './personagens.js';

const PI = Math.PI;
const params = new URLSearchParams(location.search);

const cfg = {
  bpm: 116,
  bars: 8, // 8 compassos a 116 BPM = 16,55 s (fecha a frase de 4 compassos)
  fps: 60,
  vertical: params.has('vertical'),
};

// ---------------- render ----------------
// Resolução cheia + MSAA, render em ponto flutuante para o bloom das luzes.
let OUT_W = 1920;
let OUT_H = 1080;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.autoClear = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020002);
const rtOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
const rt = new THREE.WebGLRenderTarget(OUT_W, OUT_H, { ...rtOpts, samples: 4 });
const bloomA = new THREE.WebGLRenderTarget(OUT_W / 4, OUT_H / 4, rtOpts);
const bloomB = new THREE.WebGLRenderTarget(OUT_W / 4, OUT_H / 4, rtOpts);

const fsVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const fsPass = (fragmentShader, uniforms) => {
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: fsVert, fragmentShader, depthTest: false, depthWrite: false });
  const sc = new THREE.Scene();
  sc.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m));
  return { m, sc };
};
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// 1) separa o que brilha  2) desfoca em 1/4 da resolução  3) soma na imagem final
const bright = fsPass(
  `uniform sampler2D t; varying vec2 vUv;
   void main(){ vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b));
     gl_FragColor = vec4(c * smoothstep(0.75, 1.4, l), 1.0); }`,
  { t: { value: rt.texture } }
);
const blur = fsPass(
  `uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
   void main(){ vec3 c = texture2D(t, vUv).rgb * 0.227;
     c += (texture2D(t, vUv + dir * 1.385).rgb + texture2D(t, vUv - dir * 1.385).rgb) * 0.316;
     c += (texture2D(t, vUv + dir * 3.231).rgb + texture2D(t, vUv - dir * 3.231).rgb) * 0.07;
     gl_FragColor = vec4(c, 1.0); }`,
  { t: { value: null }, dir: { value: new THREE.Vector2() } }
);
const post = fsPass(
  /* glsl */ `
    uniform sampler2D tScene, tBloom;
    uniform float uBloom;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom;
      c = c / (1.0 + c * 0.18); // compressão suave dos estouros
      c = pow(c, vec3(0.95));
      gl_FragColor = vec4(c, 1.0);
    }
  `,
  { tScene: { value: rt.texture }, tBloom: { value: bloomA.texture }, uBloom: { value: 0.9 } }
);

function runBloom() {
  renderer.setRenderTarget(bloomA);
  renderer.render(bright.sc, postCam);
  const px = new THREE.Vector2(1 / bloomA.width, 1 / bloomA.height);
  for (let i = 0; i < 3; i++) {
    blur.m.uniforms.t.value = bloomA.texture;
    blur.m.uniforms.dir.value.set(px.x * (i + 1), 0);
    renderer.setRenderTarget(bloomB);
    renderer.render(blur.sc, postCam);
    blur.m.uniforms.t.value = bloomB.texture;
    blur.m.uniforms.dir.value.set(0, px.y * (i + 1));
    renderer.setRenderTarget(bloomA);
    renderer.render(blur.sc, postCam);
  }
}

function setSize(vertical) {
  OUT_W = vertical ? 1080 : 1920;
  OUT_H = vertical ? 1920 : 1080;
  rt.setSize(OUT_W, OUT_H);
  bloomA.setSize(OUT_W / 4, OUT_H / 4);
  bloomB.setSize(OUT_W / 4, OUT_H / 4);
  renderer.setSize(OUT_W, OUT_H, false);
  camera.aspect = OUT_W / OUT_H;
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

// fumaça do cigarro: sprites semitransparentes
const smokeTex = canvasTex(64, 64);
{
  const g = smokeTex.userData.ctx;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,0.8)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.3)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  smokeTex.needsUpdate = true;
}
const SMOKE_N = 26;
const smoke = [];
for (let i = 0; i < SMOKE_N; i++) {
  const m = mat({ map: smokeTex, color: 0xb8b0c0, emissive: 0.2, opacity: 0.5, alphaTest: 0.01, spec: 0 });
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
  { at: 18, cam: 2, tgt: 'B', fov: 34 },
  { at: 20, cam: 0, tgt: 'A', fov: 24 },
  { at: 22, cam: 3, tgt: 'AB', fov: 48 },
  { at: 24, cam: 1, tgt: 'B', fov: 26 },
  { at: 26, cam: 2, tgt: 'room', fov: 70 },
  { at: 28, cam: 0, tgt: 'A', fov: 32 },
  { at: 30, cam: 3, tgt: 'room', fov: 74 },
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

  // personagens
  const { ember, glow } = A.update(a);
  B.update(a);
  room.update(a, pal);
  scene.updateMatrixWorld();

  // câmera do plano atual
  const shot = shotAt(beatF);
  const cp = CAMS[shot.cam];
  camera.position.copy(cp);
  camera.lookAt(target(shot.tgt));
  if (cfg.camOverride) {
    // usado só para inspecionar a cena (ex.: ?render + vis.init({ camOverride }))
    const o = cfg.camOverride;
    camera.position.fromArray(o.pos);
    camera.lookAt(o.tgt ? v3.fromArray(o.tgt) : target(o.who));
  }
  // aproximação lenta e suave dentro de cada plano
  let fov = cfg.camOverride?.fov ?? shot.fov * (1 - 0.08 * shot.prog);
  if (cfg.vertical) fov = Math.min(110, fov * 1.55);
  camera.fov = fov;
  camera.aspect = OUT_W / OUT_H;
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

  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  runBloom();
  renderer.setRenderTarget(null);
  renderer.render(post.sc, postCam);
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
    return { frames: frameCount(), seconds: loopLen(), w: OUT_W, h: OUT_H };
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
