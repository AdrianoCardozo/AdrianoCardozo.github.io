// Visualizer em stop-motion — quarto-estúdio em miniatura com dois bonecos de
// ação, 4 câmeras nas quinas do teto, cortes no ritmo da batida e loop perfeito.
//
// Linguagem de stop-motion: os bonecos, a fumaça e as luzes mudam 6 vezes por
// batida (~11,6 poses/s), cada pose com um leve desvio "feito à mão"; foco raso
// de maquete, sombra dura da lâmpada, grão e oscilação de exposição de filme.
import * as THREE from './three.module.min.js';
import { shared, mat, canvasTex, hash } from './ps2.js';
import { buildRoom, ROOM } from './cena.js';
import { buildA, buildB } from './personagens.js';

const PI = Math.PI;
const params = new URLSearchParams(location.search);

const cfg = {
  bpm: 116,
  bars: 8, // 8 compassos a 116 BPM = 16,55 s (fecha a frase de 4 compassos)
  fps: 60,
  posesPerBeat: 6, // cadência do stop-motion (6 × 116/60 ≈ 11,6 poses por segundo)
  vertical: params.has('vertical'),
};

// ---------------- render ----------------
let OUT_W = 1920;
let OUT_H = 1080;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.autoClear = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020002);
const rtOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
const rt = new THREE.WebGLRenderTarget(OUT_W, OUT_H, { ...rtOpts, samples: 4, depthTexture: new THREE.DepthTexture(OUT_W, OUT_H) });
const half = new THREE.WebGLRenderTarget(OUT_W / 2, OUT_H / 2, rtOpts);
const halfB = new THREE.WebGLRenderTarget(OUT_W / 2, OUT_H / 2, rtOpts);
const quarter = new THREE.WebGLRenderTarget(OUT_W / 4, OUT_H / 4, rtOpts);
const quarterB = new THREE.WebGLRenderTarget(OUT_W / 4, OUT_H / 4, rtOpts);
const bloomA = new THREE.WebGLRenderTarget(OUT_W / 4, OUT_H / 4, rtOpts);
const bloomB = new THREE.WebGLRenderTarget(OUT_W / 4, OUT_H / 4, rtOpts);

// sombra da lâmpada do teto
const SHADOW_RES = 2048;
const shadowRT = new THREE.WebGLRenderTarget(SHADOW_RES, SHADOW_RES, { depthTexture: new THREE.DepthTexture(SHADOW_RES, SHADOW_RES) });
const shadowCam = new THREE.PerspectiveCamera(130, 1, 0.06, 6);
const shadowMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
shared.uShadowMap.value = shadowRT.depthTexture;
shared.uShadowTexel.value = 1 / SHADOW_RES;
const biasM = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

const fsVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const fsPass = (fragmentShader, uniforms) => {
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: fsVert, fragmentShader, depthTest: false, depthWrite: false });
  const sc = new THREE.Scene();
  sc.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m));
  return { m, sc };
};
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const copy = fsPass(`uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb, 1.0); }`, { t: { value: null } });
const bright = fsPass(
  `uniform sampler2D t; varying vec2 vUv;
   void main(){ vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b));
     gl_FragColor = vec4(c * smoothstep(0.8, 1.6, l), 1.0); }`,
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
// composição final: foco raso de maquete + brilho + cor/grão de filme
const post = fsPass(
  /* glsl */ `
    uniform sampler2D tScene, tDepth, tHalf, tQuarter, tBloom;
    uniform float uNear, uFar, uFocus, uDof, uExposure, uSeed;
    uniform vec2 uRes;
    varying vec2 vUv;
    float linDepth(vec2 uv) {
      float z = texture2D(tDepth, uv).r * 2.0 - 1.0;
      return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
    }
    float h12(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed * 0.731) * 43758.5453); }
    void main() {
      float d = linDepth(vUv);
      float coc = clamp(abs(d - uFocus) / d * uDof, 0.0, 1.0);
      vec3 sharp = texture2D(tScene, vUv).rgb;
      vec3 c = mix(sharp, texture2D(tHalf, vUv).rgb, smoothstep(0.04, 0.4, coc));
      c = mix(c, texture2D(tQuarter, vUv).rgb, smoothstep(0.4, 1.0, coc));
      // halo avermelhado em volta das luzes (halação de película)
      c += texture2D(tBloom, vUv).rgb * vec3(1.0, 0.72, 0.6) * 0.85;
      c *= uExposure;
      c = vec3(1.0) - exp(-c * 1.15);                          // resposta de filme (sem estourar)
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 0.9);                                // um pouco menos saturado
      c *= mix(vec3(0.93, 1.0, 1.07), vec3(1.06, 1.0, 0.9), smoothstep(0.0, 0.6, l)); // sombras frias, luz quente
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);               // curva em S
      c = c * 0.965 + 0.014;                                   // preto de filme (nunca 100%)
      vec2 q = vUv - 0.5;
      c *= 1.0 - dot(q * vec2(1.0, 0.8), q * vec2(1.0, 0.8)) * 0.75; // vinheta da lente
      float g = h12(floor(vUv * uRes / 1.5)) + h12(floor(vUv * uRes / 1.5) + 17.0) - 1.0;
      c += g * 0.04 * (1.0 - l * 0.55);                       // grão de película
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }
  `,
  {
    tScene: { value: rt.texture },
    tDepth: { value: rt.depthTexture },
    tHalf: { value: half.texture },
    tQuarter: { value: quarter.texture },
    tBloom: { value: bloomA.texture },
    uNear: { value: 0.05 },
    uFar: { value: 20 },
    uFocus: { value: 2 },
    uDof: { value: 1.5 },
    uExposure: { value: 1 },
    uSeed: { value: 0 },
    uRes: { value: new THREE.Vector2(OUT_W, OUT_H) },
  }
);

function pass(p, target) {
  renderer.setRenderTarget(target);
  renderer.render(p.sc, postCam);
}

function blurInto(a, b, iters, spread) {
  const px = new THREE.Vector2(1 / a.width, 1 / a.height);
  for (let i = 0; i < iters; i++) {
    blur.m.uniforms.t.value = a.texture;
    blur.m.uniforms.dir.value.set(px.x * (i + 1) * spread, 0);
    pass(blur, b);
    blur.m.uniforms.t.value = b.texture;
    blur.m.uniforms.dir.value.set(0, px.y * (i + 1) * spread);
    pass(blur, a);
  }
}

function runPost() {
  // versões desfocadas da imagem para o foco raso
  copy.m.uniforms.t.value = rt.texture;
  pass(copy, half);
  blurInto(half, halfB, 2, 1);
  copy.m.uniforms.t.value = half.texture;
  pass(copy, quarter);
  blurInto(quarter, quarterB, 3, 1.2);
  // brilho das luzes
  pass(bright, bloomA);
  blurInto(bloomA, bloomB, 3, 1);
  pass(post, null);
}

function setSize(vertical) {
  OUT_W = vertical ? 1080 : 1920;
  OUT_H = vertical ? 1920 : 1080;
  rt.setSize(OUT_W, OUT_H);
  for (const r of [half, halfB]) r.setSize(OUT_W / 2, OUT_H / 2);
  for (const r of [quarter, quarterB, bloomA, bloomB]) r.setSize(OUT_W / 4, OUT_H / 4);
  post.m.uniforms.uRes.value.set(OUT_W, OUT_H);
  renderer.setSize(OUT_W, OUT_H, false);
  camera.aspect = OUT_W / OUT_H;
}

// ---------------- cena ----------------
const room = buildRoom(scene);
const A = buildA();
const B = buildB();
scene.add(A.group, B.group);
// A meio deitado no sofá (parede direita), B na cadeira de frente pro computador
A.group.position.set(1.6, 0, 0.12);
A.group.rotation.y = -PI / 2;
B.group.position.set(-0.6, 0, -0.76);
B.group.rotation.y = PI;
room.chair.position.copy(B.group.position);
room.chair.rotation.y = B.group.rotation.y;
room.mic.position.set(-1.45, 0, -0.62);
room.mic.rotation.y = 2.2;

shadowCam.position.copy(room.BULB);
shadowCam.up.set(0, 0, -1);
shadowCam.lookAt(room.BULB.x, 0, room.BULB.z);
shadowCam.updateMatrixWorld();
shadowCam.updateProjectionMatrix();

// fumaça: a brasa solta um fio contínuo; a tragada sai pela boca, pra cima
const smokeTex = canvasTex(64, 64, null, { scale: 2 });
{
  const g = smokeTex.userData.ctx;
  const r = (k) => hash(k * 3.7);
  for (let i = 0; i < 9; i++) {
    const x = 32 + (r(i) - 0.5) * 22;
    const y = 32 + (r(i + 9) - 0.5) * 22;
    const rad = 10 + r(i + 19) * 14;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(255,255,255,0.32)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  }
  smokeTex.needsUpdate = true;
}
const smokeMat = () => mat({ map: smokeTex, color: 0xb8b6c0, emissive: 0.04, opacity: 0.5, alphaTest: 0.005, spec: 0 });
const STREAM_N = 22;
const EXHALE_N = 26;
const stream = [];
const exhaleP = [];
for (let i = 0; i < STREAM_N + EXHALE_N; i++) {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), smokeMat());
  s.renderOrder = 10;
  scene.add(s);
  (i < STREAM_N ? stream : exhaleP).push(s);
}

// ---------------- câmeras ----------------
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, 20);
const { W, D, H } = ROOM;
const CAMS = [
  new THREE.Vector3(-W / 2 + 0.15, H - 0.12, D / 2 - 0.15), // 1: frente-esquerda
  new THREE.Vector3(W / 2 - 0.15, H - 0.12, D / 2 - 0.15), // 2: frente-direita
  new THREE.Vector3(W / 2 - 0.15, H - 0.12, -D / 2 + 0.15), // 3: fundo-direita
  new THREE.Vector3(-W / 2 + 0.15, H - 0.12, -D / 2 + 0.15), // 4: fundo-esquerda
];
// Roteiro de cortes, em batidas de um loop de 32 (8 compassos); é escalado se
// o número de compassos mudar. O último corte cai exatamente no início do loop.
// As tragadas do A acontecem nas batidas 4–6 de cada 8 (closes 20 e 28 pegam).
const SHOTS_32 = [
  { at: 0, cam: 0, tgt: 'room', fov: 64 },
  { at: 4, cam: 3, tgt: 'B', fov: 28 },
  { at: 8, cam: 1, tgt: 'A', fov: 26 },
  { at: 12, cam: 2, tgt: 'room', fov: 66 },
  { at: 16, cam: 1, tgt: 'pc', fov: 34 },
  { at: 18, cam: 0, tgt: 'foot', fov: 24 },
  { at: 20, cam: 1, tgt: 'A', fov: 22 },
  { at: 22, cam: 2, tgt: 'AB', fov: 50 },
  { at: 24, cam: 3, tgt: 'A', fov: 26 },
  { at: 26, cam: 0, tgt: 'pc', fov: 34 },
  { at: 28, cam: 3, tgt: 'A', fov: 21 },
  { at: 30, cam: 2, tgt: 'room', fov: 68 },
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
  if (name === 'A') return A.head.getWorldPosition(v3).add(v3b.set(0, 0.1, 0));
  if (name === 'B') return B.head.getWorldPosition(v3).add(v3b.set(0, 0.1, 0));
  if (name === 'foot') return A.foot.getWorldPosition(v3).add(v3b.set(0, 0.25, 0));
  if (name === 'pc') return v3.set(-0.55, 1.08, -1.55);
  if (name === 'AB') {
    A.head.getWorldPosition(v3);
    B.head.getWorldPosition(v3b);
    return v3.add(v3b).multiplyScalar(0.5).add(v3b.set(0, -0.2, 0));
  }
  return v3.set(0.1, 0.75, -0.45);
}

// ---------------- paleta por seção ----------------
const PALS = [
  { c: new THREE.Color(1.0, 0.06, 0.08) }, // vermelho
  { c: new THREE.Color(1.0, 0.34, 0.04) }, // âmbar queimado
  { c: new THREE.Color(0.55, 0.12, 1.0) }, // roxo ácido
  { c: new THREE.Color(0.35, 1.0, 0.12) }, // verde tóxico
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
  screen: new THREE.Color(0.45, 0.6, 1.0),
  neon: new THREE.Color(1.0, 0.12, 0.38),
  moon: new THREE.Color(0.3, 0.38, 0.85),
  ember: new THREE.Color(1.0, 0.42, 0.12),
  tv: new THREE.Color(0.6, 0.7, 1.0),
  bulb: new THREE.Color(1.0, 0.76, 0.5),
};

// ---------------- frame ----------------
const loopLen = () => (cfg.bars * 4 * 60) / cfg.bpm;
const frameCount = () => Math.round(loopLen() * cfg.fps);
const hidden = [];

function renderAt(t) {
  const L = loopLen();
  t = ((t % L) + L) % L;
  const nf = frameCount();
  const beatLen = 60 / cfg.bpm;
  // stop-motion: tudo que se move muda só a cada pose
  const pose = Math.floor((t / beatLen) * cfg.posesPerBeat + 1e-6);
  const beatF = pose / cfg.posesPerBeat;
  const tp = beatF * beatLen;
  const frame = Math.floor((tp / L) * nf + 1e-6) % nf;
  const beat = Math.floor(beatF + 1e-6);
  const bar = Math.floor(beat / 4);
  const f = feat ? feat[frame] : { bands: new Array(8).fill(0), bass: 0, mid: 0, high: 0, kick: 0, snare: 0 };
  const a = {
    ...f,
    t: tp,
    frame,
    pose,
    bpm: cfg.bpm,
    beatF,
    beat,
    beatPhase: beatF - beat,
    bar,
    loopPos: tp / L,
    section: bar < cfg.bars / 4 ? 0 : bar < cfg.bars / 2 ? 1 : 2,
  };
  const pal = palette(a);

  const smokeState = A.update(a);
  B.update(a);
  room.update(a, pal);
  scene.updateMatrixWorld();

  // câmera travada no tripé; só uma aproximação lenta, também em poses
  const shot = shotAt(beatF);
  camera.position.copy(CAMS[shot.cam]);
  const tgt = target(shot.tgt).clone();
  camera.lookAt(tgt);
  if (cfg.camOverride) {
    // usado só para inspecionar a cena (ex.: ?render + vis.init({ camOverride }))
    const o = cfg.camOverride;
    camera.position.fromArray(o.pos);
    tgt.copy(o.tgt ? v3.fromArray(o.tgt) : target(o.who));
    camera.lookAt(tgt);
  }
  let fov = cfg.camOverride?.fov ?? shot.fov * (1 - 0.06 * shot.prog);
  if (cfg.vertical) fov = Math.min(110, fov * 1.55);
  camera.fov = fov;
  camera.aspect = OUT_W / OUT_H;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  // luzes (práticas do cenário)
  const { ember, glow, mouth, exhale } = smokeState;
  setLight(0, 0, 2.4, 0, pal.c, 0.35 + 1.2 * a.bass, 0.35);
  setLight(1, -0.55, 1.15, -1.25, COL.screen, 0.7 + 0.15 * a.mid, 1.4);
  setLight(2, 1.95, 2.15, 0.0, COL.neon, 0.9 * (0.8 + 0.5 * a.mid), 1.1);
  setLight(3, -1.9, 1.55, -0.55, COL.moon, 0.4, 0.9);
  setLight(4, ember.x, ember.y, ember.z, COL.ember, 0.025 * (0.5 + glow), 90);
  setLight(5, 0.62, 0.35, -1.45, pal.c, 0.25 + 0.5 * a.bass, 3);
  setLight(6, 1.55, 0.55, 1.15, COL.tv, 0.3 + 0.3 * a.high, 2.5);
  const B0 = room.BULB;
  setLight(7, B0.x, B0.y - 0.05, B0.z, COL.bulb, 1.55, 0.32);
  shared.uAmbient.value.set(0.055 + 0.04 * pal.c.r * a.bass, 0.045 + 0.03 * pal.c.g * a.bass, 0.065 + 0.04 * pal.c.b * a.bass);
  shared.uFogColor.value.set(0.03 + pal.c.r * 0.03, 0.02 + pal.c.g * 0.015, 0.03 + pal.c.b * 0.03);
  shared.uFogNear.value = 1.5;
  shared.uFogFar.value = 9;

  // fumaça (em poses, como algodão animado quadro a quadro)
  const life = beatLen * 4;
  stream.forEach((s, i) => {
    const age = (tp + (i / STREAM_N) * life) % life;
    const k = age / life;
    const seed = i * 1.37;
    s.position.set(
      ember.x + Math.sin(k * 5 + seed) * 0.05 * k,
      ember.y + 0.01 + k * 0.55,
      ember.z + Math.cos(k * 4 + seed * 1.3) * 0.05 * k
    );
    s.quaternion.copy(camera.quaternion);
    s.rotateZ(seed * 2);
    s.scale.setScalar(0.025 + k * 0.16);
    s.material.uniforms.uOpacity.value = 0.32 * (1 - k) ** 1.6 * Math.min(1, k * 10);
  });
  // baforada: sai da boca pra cima (ele está olhando pro teto) e se espalha
  const c8 = beatF % 8;
  exhaleP.forEach((s, i) => {
    const born = 5.7 + (i / EXHALE_N) * 1.6;
    const age = (((c8 - born) % 8) + 8) % 8; // em batidas
    const on = age < 3.4;
    s.visible = on;
    if (!on) return;
    const k = age / 3.4;
    const seed = i * 2.31;
    const dir = v3b.set(-0.35 + Math.sin(seed) * 0.25, 1, Math.cos(seed * 1.7) * 0.25).normalize();
    s.position.copy(mouth).addScaledVector(dir, 0.04 + Math.sqrt(k) * 0.55);
    s.quaternion.copy(camera.quaternion);
    s.rotateZ(seed);
    s.scale.setScalar(0.04 + k * 0.3);
    s.material.uniforms.uOpacity.value = 0.3 * (1 - k) ** 1.5 * Math.min(1, age * 4);
  });
  void exhale;

  // sombra da lâmpada: profundidade vista da lâmpada
  hidden.length = 0;
  scene.traverse((o) => {
    if (o.isMesh && o.visible && (o.material.transparent || o === room.bulb)) {
      hidden.push(o);
      o.visible = false;
    }
  });
  scene.overrideMaterial = shadowMat;
  renderer.setRenderTarget(shadowRT);
  renderer.render(scene, shadowCam);
  scene.overrideMaterial = null;
  hidden.forEach((o) => (o.visible = true));
  shared.uShadowMatrix.value.copy(biasM).multiply(shadowCam.projectionMatrix).multiply(shadowCam.matrixWorldInverse);

  // foco na pessoa/objeto do plano; foco mais raso nos closes (cara de maquete)
  const pu = post.m.uniforms;
  pu.uFocus.value = camera.position.distanceTo(tgt);
  pu.uDof.value = cfg.camOverride ? 1.2 : fov < 40 ? 2.4 : 1.3;
  pu.uNear.value = camera.near;
  pu.uFar.value = camera.far;
  pu.uExposure.value = 1.45 + 0.07 * (hash(pose * 1.7) - 0.5); // oscilação de luz entre poses
  pu.uSeed.value = Math.floor(t * 24) % 997; // grão a 24 qps, como película

  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  runPost();
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
