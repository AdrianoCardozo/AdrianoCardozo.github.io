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
import { easeInOut } from './rig.js';

const PI = Math.PI;
const params = new URLSearchParams(location.search);

const cfg = {
  bpm: 116,
  bars: 8, // 8 compassos a 116 BPM = 16,55 s (fecha a frase de 4 compassos)
  fps: 60,
  poseRate: 24, // poses por segundo: stop-motion "em uns", como nos longas da Laika
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
// oclusão de ambiente (SSAO): sombra de contato onde as coisas se encostam
const aoRT = new THREE.WebGLRenderTarget(OUT_W / 2, OUT_H / 2, rtOpts);
const aoB = new THREE.WebGLRenderTarget(OUT_W / 2, OUT_H / 2, rtOpts);
const sceneAO = new THREE.WebGLRenderTarget(OUT_W, OUT_H, rtOpts);
const dofRT = new THREE.WebGLRenderTarget(OUT_W / 2, OUT_H / 2, rtOpts);
const DEPTH_GLSL = /* glsl */ `
  uniform sampler2D tDepth;
  uniform mat4 uProj, uInvProj;
  uniform float uNear, uFar;
  vec3 vpos(vec2 uv) {
    float z = texture2D(tDepth, uv).r * 2.0 - 1.0;
    vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, z, 1.0);
    return p.xyz / p.w;
  }
  float linDepth(vec2 uv) {
    float z = texture2D(tDepth, uv).r * 2.0 - 1.0;
    return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
  }
  float h12(vec2 p, float s) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + s * 0.731) * 43758.5453); }
`;
const camU = () => ({
  tDepth: { value: rt.depthTexture },
  uProj: { value: new THREE.Matrix4() },
  uInvProj: { value: new THREE.Matrix4() },
  uNear: { value: 0.05 },
  uFar: { value: 20 },
});
const ao = fsPass(
  /* glsl */ `${DEPTH_GLSL}
    uniform vec2 uRes;
    uniform float uRadius;
    varying vec2 vUv;
    void main() {
      vec3 P = vpos(vUv);
      vec2 px = 1.0 / uRes;
      vec3 N = normalize(cross(vpos(vUv + vec2(px.x, 0.0)) - P, vpos(vUv + vec2(0.0, px.y)) - P));
      if (dot(N, -P) < 0.0) N = -N;
      float a = h12(vUv * uRes, 1.0) * 6.2831;
      vec3 T = normalize(cross(N, abs(N.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
      T = T * cos(a) + cross(N, T) * sin(a);
      vec3 Bt = cross(N, T);
      float occ = 0.0;
      for (int i = 0; i < 16; i++) {
        float t = (float(i) + 0.5) / 16.0;
        float phi = float(i) * 2.39996;
        float rr = sqrt(t);
        vec3 k = vec3(cos(phi) * rr, sin(phi) * rr, sqrt(1.0 - t));
        vec3 S = P + (T * k.x + Bt * k.y + N * k.z) * uRadius * mix(0.12, 1.0, t * t);
        vec4 c = uProj * vec4(S, 1.0);
        vec2 suv = c.xy / c.w * 0.5 + 0.5;
        float sz = vpos(suv).z;
        float range = smoothstep(0.0, 1.0, uRadius / abs(P.z - sz));
        occ += (sz >= S.z + 0.003 ? 1.0 : 0.0) * range;
      }
      gl_FragColor = vec4(vec3(1.0 - occ / 16.0), 1.0);
    }`,
  { ...camU(), uRes: { value: new THREE.Vector2(OUT_W / 2, OUT_H / 2) }, uRadius: { value: 0.14 } }
);
const applyAO = fsPass(
  `uniform sampler2D tScene, tAO; uniform float uAmt; varying vec2 vUv;
   void main(){ vec3 c = texture2D(tScene, vUv).rgb; float a = texture2D(tAO, vUv).r;
     float l = max(c.r, max(c.g, c.b));
     // luzes/telas não recebem oclusão
     float k = mix(1.0, a, uAmt * (1.0 - smoothstep(0.9, 1.6, l)));
     gl_FragColor = vec4(c * k, 1.0); }`,
  { tScene: { value: rt.texture }, tAO: { value: aoRT.texture }, uAmt: { value: 0.85 } }
);
// desfoque de lente com bokeh (discos de luz), juntando amostras em espiral
const bokeh = fsPass(
  /* glsl */ `${DEPTH_GLSL}
    uniform sampler2D tCol;
    uniform vec2 uPx;
    uniform float uFocus, uDof, uMax;
    varying vec2 vUv;
    float coc(float d) { return clamp(abs(d - uFocus) / d * uDof, 0.0, 1.0) * uMax; }
    void main() {
      float dc = linDepth(vUv);
      float cc = coc(dc);
      vec3 acc = texture2D(tCol, vUv).rgb;
      float tot = 1.0;
      float wNear = 0.0;
      float r = 0.6;
      float ang = h12(vUv * 997.0, 3.0) * 6.2831;
      for (int i = 0; i < 110; i++) {
        if (r >= uMax) break;
        vec2 uv = vUv + vec2(cos(ang), sin(ang)) * r * uPx;
        float ds = linDepth(uv);
        float cs = coc(ds);
        if (ds > dc) cs = min(cs, cc * 1.6 + 0.5); // fundo não vaza por cima do que está em foco
        float m = smoothstep(r - 1.2, r + 0.4, cs);
        vec3 col = texture2D(tCol, uv).rgb;
        float lum = dot(col, vec3(0.3, 0.59, 0.11));
        float w = m * (1.0 + 2.0 * max(lum - 0.85, 0.0));
        acc += col * w;
        tot += w;
        if (ds < dc - 0.03) wNear += w; // desfocado da frente cobrindo o que está atrás
        ang += 2.39996323;
        r += 1.3 / r;
      }
      gl_FragColor = vec4(acc / tot, max(cc / uMax, min(1.0, 2.2 * wNear / tot)));
    }`,
  { ...camU(), tCol: { value: sceneAO.texture }, uPx: { value: new THREE.Vector2(2 / OUT_W, 2 / OUT_H) }, uFocus: { value: 2 }, uDof: { value: 1.5 }, uMax: { value: 13 } }
);
// composição final: lente (distorção, aberração, tremor de tripé) + foco + brilho + filme
const post = fsPass(
  /* glsl */ `${DEPTH_GLSL}
    uniform sampler2D tScene, tDof, tBloom;
    uniform float uFocus, uDof, uExposure, uSeed;
    uniform vec2 uRes, uWeave;
    varying vec2 vUv;
    vec2 lens(vec2 uv, float k) {
      vec2 q = uv - 0.5;
      float r2 = dot(q * vec2(1.0, 0.5625), q * vec2(1.0, 0.5625));
      return 0.5 + q * (1.0 + k * r2) * 0.988 + uWeave;
    }
    vec3 at(vec2 uv) {
      float d = linDepth(uv);
      float cocN = clamp(abs(d - uFocus) / d * uDof, 0.0, 1.0);
      vec4 b = texture2D(tDof, uv);
      return mix(texture2D(tScene, uv).rgb, b.rgb, smoothstep(0.06, 0.4, max(cocN, b.a * 0.9)));
    }
    void main() {
      vec2 uvG = lens(vUv, -0.06);
      vec3 c;
      c.r = at(lens(vUv, -0.065)).r;
      c.g = at(uvG).g;
      c.b = at(lens(vUv, -0.055)).b;
      // halo avermelhado em volta das luzes (halação de película)
      c += texture2D(tBloom, uvG).rgb * vec3(1.0, 0.7, 0.55) * 0.7;
      c *= uExposure;
      c = vec3(1.0) - exp(-c * 1.2);                           // resposta de filme
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 0.88);
      c *= mix(vec3(0.92, 1.0, 1.08), vec3(1.07, 1.0, 0.88), smoothstep(0.0, 0.6, l)); // sombras frias, luz quente
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.2);
      c = c * 0.97 + 0.011;                                   // preto de filme
      vec2 q = vUv - 0.5;
      c *= 1.0 - dot(q * vec2(1.0, 0.8), q * vec2(1.0, 0.8)) * 0.45;
      vec2 gp = floor(vUv * uRes);
      float g = (h12(gp, uSeed) + h12(gp + 17.0, uSeed) + h12(gp + 41.0, uSeed) - 1.5) * 0.8;
      c += g * 0.024 * (0.45 + 0.55 * smoothstep(0.02, 0.3, l)) * (1.0 - 0.5 * l); // grão fino, mais nos médios
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }
  `,
  {
    ...camU(),
    tScene: { value: sceneAO.texture },
    tDof: { value: dofRT.texture },
    tBloom: { value: bloomA.texture },
    uFocus: { value: 2 },
    uDof: { value: 1.5 },
    uExposure: { value: 1 },
    uSeed: { value: 0 },
    uRes: { value: new THREE.Vector2(OUT_W, OUT_H) },
    uWeave: { value: new THREE.Vector2() },
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

function runPost(cam, focus, dof, exposure, seed, weave) {
  for (const p of [ao, bokeh, post]) {
    const u = p.m.uniforms;
    u.uProj.value.copy(cam.projectionMatrix);
    u.uInvProj.value.copy(cam.projectionMatrixInverse);
    u.uNear.value = cam.near;
    u.uFar.value = cam.far;
  }
  for (const p of [bokeh, post]) {
    p.m.uniforms.uFocus.value = focus;
    p.m.uniforms.uDof.value = dof;
  }
  post.m.uniforms.uExposure.value = exposure;
  post.m.uniforms.uSeed.value = seed;
  post.m.uniforms.uWeave.value.copy(weave);
  pass(ao, aoRT);
  blurInto(aoRT, aoB, 1, 1);
  pass(applyAO, sceneAO);
  pass(bokeh, dofRT);
  bright.m.uniforms.t.value = sceneAO.texture;
  pass(bright, bloomA);
  blurInto(bloomA, bloomB, 3, 1);
  pass(post, null);
}

function setSize(vertical) {
  OUT_W = vertical ? 1080 : 1920;
  OUT_H = vertical ? 1920 : 1080;
  rt.setSize(OUT_W, OUT_H);
  for (const r of [aoRT, aoB, dofRT]) r.setSize(OUT_W / 2, OUT_H / 2);
  sceneAO.setSize(OUT_W, OUT_H);
  ao.m.uniforms.uRes.value.set(OUT_W / 2, OUT_H / 2);
  bokeh.m.uniforms.uPx.value.set(2 / OUT_W, 2 / OUT_H);
  for (const r of [bloomA, bloomB]) r.setSize(OUT_W / 4, OUT_H / 4);
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
A.group.position.set(1.5, 0, 0.12);
A.group.rotation.y = -PI / 2;
B.group.position.set(-0.6, 0, -0.82);
B.group.rotation.y = PI;
room.chair.position.copy(B.group.position);
room.chair.rotation.y = B.group.rotation.y;
room.mic.position.set(-1.86, 0, -0.42); // perto da janela, fora da linha das câmeras
room.mic.rotation.y = PI + 0.25;

shadowCam.position.copy(room.BULB);
shadowCam.up.set(0, 0, -1);
shadowCam.lookAt(room.BULB.x, 0, room.BULB.z);
shadowCam.updateMatrixWorld();
shadowCam.updateProjectionMatrix();

// fumaça: a brasa solta um fio fino e contínuo; a baforada sai da boca
function smokeTexture(seed, stretch) {
  const t = canvasTex(64, 64, null, { scale: 2 });
  const g = t.userData.ctx;
  const r = (k) => hash(k * 3.7 + seed * 13.1);
  g.clearRect(0, 0, 64, 64);
  for (let i = 0; i < 14; i++) {
    const x = 32 + (r(i) - 0.5) * 22;
    const y = 32 + (r(i + 9) - 0.5) * 34;
    const rad = 6 + r(i + 19) * 11;
    g.save();
    g.translate(x, y);
    g.scale(1, stretch);
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, rad);
    grd.addColorStop(0, `rgba(255,255,255,${0.16 + r(i + 29) * 0.14})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(-rad, -rad, rad * 2, rad * 2);
    g.restore();
  }
  // borda suave em volta (sem quinas de sprite)
  const img = g.getImageData(0, 0, 128, 128);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const dx = (x - 64) / 64;
      const dy = (y - 64) / 64;
      const fall = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
      img.data[(y * 128 + x) * 4 + 3] *= Math.min(1, fall * 1.6);
    }
  g.putImageData(img, 0, 0);
  t.needsUpdate = true;
  return t;
}
const wispTex = [smokeTexture(1, 1.8), smokeTexture(2, 2.2), smokeTexture(3, 1.6)];
const puffTex = [smokeTexture(4, 1.1), smokeTexture(5, 1.25)];
// fumaça clara e um pouco emissiva: lê como fumaça contraluz sobre o fundo escuro
const smokeMat = (map) => mat({ map, color: 0xd6d4dc, emissive: 0.16, opacity: 0.5, alphaTest: 0.003, spec: 0, wear: 0 });
const STREAM_N = 64;
const EXHALE_N = 34; // por janela de baforada
const stream = [];
const exhaleP = [];
for (let i = 0; i < STREAM_N; i++) {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), smokeMat(wispTex[i % 3]));
  s.renderOrder = 10;
  scene.add(s);
  stream.push(s);
}
for (let i = 0; i < EXHALE_N * 2; i++) {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), smokeMat(puffTex[i % 2]));
  s.renderOrder = 11;
  scene.add(s);
  exhaleP.push(s);
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
  // at: batida | cam: quina | arm: braço que tira a câmera da quina (m) | slide: deslize no plano (m)
  // tgt: enquadramento (travado no plano) | focus: onde fica o foco | dof: força do desfoque
  // lift/shift: mira mais alta + deslocamento de lente (tira a distorção dos planos abertos)
  { at: 0, cam: 0, tgt: 'room', fov: 58, dof: 0.55, lift: 0.7, shift: -0.32, slide: [0.18, -0.06, -0.12] },
  // B 3/4 de frente, de cima dos monitores (antes só se via o topo do boné)
  { at: 4, cam: 3, tgt: 'B', fov: 30, arm: [0.85, -1.0, 0.17], slide: [0.04, 0.0, 0.03], dof: 1.2 },
  // baforada vista mais de lado e mais baixo: a fumaça atravessa o quadro
  { at: 8, cam: 1, tgt: 'A', fov: 30, arm: [-0.8, -0.53, -0.85], slide: [0.0, -0.04, -0.04], dof: 1.3 },
  { at: 12, cam: 3, tgt: 'room', focus: 'B', fov: 52, dof: 0.45, lift: 0.6, shift: -0.3, arm: [0.5, -0.2, 0.4], slide: [0.1, -0.04, 0.1] }, // B vira pro A e levanta a mão: foco nele
  { at: 16, cam: 0, tgt: 'pc', aim: [0.15, 0.04, -0.05], fov: 34, arm: [0.65, -0.73, -1.45], slide: [0.05, 0, -0.04], dof: 1.1 }, // por cima do ombro do B, foco na tela
  // tênis em ângulo baixo, foco no bico (o encosto do sofá saiu do quadro)
  { at: 18, cam: 2, tgt: 'foot', aim: [-0.16, -0.12, -0.08], fov: 26, arm: [-0.75, -1.43, 0.6], slide: [-0.03, 0, 0.02], dof: 1.2 },
  // A sobe o cigarro: 3/4 do lado do cigarro
  { at: 20, cam: 2, tgt: 'A', fov: 30, arm: [-0.5, -0.78, 0.6], slide: [0.04, -0.02, 0.03], dof: 1.2 },
  { at: 22, cam: 0, tgt: 'AB', fov: 44, arm: [0.35, -0.2, -0.25], slide: [0.08, -0.03, -0.06], dof: 0.7 },
  // close extremo da baforada, mais perto e mais baixo (lente menos tele)
  { at: 24, cam: 1, tgt: 'A', fov: 24, arm: [-0.9, -1.03, -1.0], slide: [-0.03, -0.02, -0.03], dof: 1.6 },
  // mãos ao longo da mesa, vindo da esquerda do B
  { at: 26, cam: 3, tgt: 'hands', fov: 30, arm: [0.6, -1.4, 0.43], slide: [0.03, 0, 0.02], dof: 1.0 },
  // B olhando pro A com a mão no ar: câmera ~40° fora da linha do olhar (antes ele parecia encarar a lente)
  { at: 28, cam: 2, tgt: 'B', fov: 30, arm: [-1.35, -0.75, 0.05], slide: [-0.05, 0, 0.03], dof: 1.4 },
  { at: 30, cam: 3, tgt: 'room', focus: 'B', fov: 52, dof: 0.45, lift: 0.6, shift: -0.28, arm: [0.55, -0.2, 0.45], slide: [0.12, -0.04, 0.06] },
];
let SHOTS = SHOTS_32;
const scaleShots = () => (SHOTS = SHOTS_32.map((s) => ({ ...s, at: (s.at * cfg.bars * 4) / 32 })));

function shotAt(beatF) {
  let i = SHOTS.length - 1;
  while (i > 0 && SHOTS[i].at > beatF) i--;
  const s = SHOTS[i];
  const end = i + 1 < SHOTS.length ? SHOTS[i + 1].at : cfg.bars * 4;
  return { ...s, idx: i, end, prog: (beatF - s.at) / (end - s.at) };
}

const v3 = new THREE.Vector3();
const v3b = new THREE.Vector3();
const v3c = new THREE.Vector3();
// Alvos de enquadramento/foco. Para não "acenar" junto com a cabeça, os alvos
// dos personagens usam a posição média do plano (tabela pré-calculada).
function target(name, sh) {
  const tr = getTrail();
  if (sh && (name === 'A' || name === 'B' || name === 'foot' || name === 'AB')) {
    const key = name + '@' + sh.at;
    if (!tr.locked[key]) {
      const end = sh.end;
      const acc = new THREE.Vector3();
      let n = 0;
      for (let b = sh.at; b < end; b += 0.25, n++) {
        const p = trailAt(tr, b);
        if (name === 'A') acc.add(p.headA);
        else if (name === 'B') acc.add(p.headB);
        else if (name === 'foot') acc.add(p.foot);
        else acc.add(v3b.copy(p.headA).add(p.headB).multiplyScalar(0.5));
      }
      acc.multiplyScalar(1 / Math.max(1, n));
      if (name === 'A' || name === 'B') acc.y += 0.11;
      if (name === 'foot') acc.add(v3b.set(0.08, 0.1, 0.08));
      if (name === 'AB') acc.y -= 0.2;
      tr.locked[key] = acc;
    }
    return v3.copy(tr.locked[key]);
  }
  if (name === 'A') return A.head.getWorldPosition(v3).add(v3b.set(0, 0.11, 0));
  if (name === 'B') return B.head.getWorldPosition(v3).add(v3b.set(0, 0.11, 0));
  if (name === 'foot') return A.foot.getWorldPosition(v3).add(v3b.set(0.08, 0.1, 0.08));
  if (name === 'pc') return v3.set(-0.55, 1.08, -1.55);
  if (name === 'hands') return v3.copy(room.keyboardW).add(v3b.set(0.17, 0.06, 0.05)); // ponto fixo entre teclado e mouse
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
  { c: new THREE.Color(0.22, 0.42, 1.0) }, // azul elétrico
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
  // versões suavizadas (ataque rápido, soltura lenta) para as luzes do quarto:
  // a sala "respira" com o grave em vez de piscar quadro a quadro
  for (const key of ['bass', 'mid', 'high']) {
    let v = feat[frames - 1][key];
    for (let pass = 0; pass < 2; pass++)
      for (let f = 0; f < frames; f++) {
        const x = feat[f][key];
        v = x > v ? v + (x - v) * 0.35 : v + (x - v) * 0.06;
        if (pass === 1) feat[f][key + 'S'] = v;
      }
  }
}

// ---------------- luzes ----------------
function setLight(i, x, y, z, col, k, fall) {
  shared.uLightPos.value[i].set(x, y, z);
  shared.uLightCol.value[i].set(col.r * k, col.g * k, col.b * k);
  shared.uLightFall.value[i] = fall;
}
const COL = {
  screen: new THREE.Color(0.64, 0.72, 1.0),
  neon: new THREE.Color(1.0, 0.12, 0.38),
  moon: new THREE.Color(0.3, 0.38, 0.85),
  ember: new THREE.Color(1.0, 0.42, 0.12),
  tv: new THREE.Color(0.6, 0.7, 1.0),
  bulb: new THREE.Color(1.0, 0.76, 0.5),
  keyA: new THREE.Color(1.0, 0.8, 0.62),
  keyB: new THREE.Color(1.0, 0.87, 0.74),
};

// ---------------- frame ----------------
const loopLen = () => (cfg.bars * 4 * 60) / cfg.bpm;
const frameCount = () => Math.round(loopLen() * cfg.fps);
const poseOf = (t) => {
  const L = loopLen();
  return Math.floor((((t % L) + L) % L) * cfg.poseRate + 1e-6);
};
const hidden = [];

// Trajetória da brasa e da boca ao longo do loop (para a fumaça ficar no ar
// onde foi solta). Calculada uma vez, rodando a atuação do A em 12 amostras
// por batida.
let trailCache = null;
function getTrail() {
  if (trailCache) return trailCache;
  const P = cfg.bars * 4;
  const N = P * 12;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const beatF = (i / N) * P;
    const a = { beatF, beat: Math.floor(beatF), beatPhase: beatF % 1, high: 0, bass: 0, mid: 0, kick: 0, pose: i };
    const st = A.update(a);
    B.update(a, { mouse: room.mouse, keyboard: room.keyboardW });
    pts.push({
      ember: st.ember.clone(),
      mouth: st.mouth.clone(),
      faceN: st.faceN.clone(),
      headA: A.head.getWorldPosition(new THREE.Vector3()),
      headB: B.head.getWorldPosition(new THREE.Vector3()),
      foot: A.foot.getWorldPosition(new THREE.Vector3()),
    });
  }
  trailCache = { pts, P, N, locked: {} };
  return trailCache;
}
const _tr = { ember: new THREE.Vector3(), mouth: new THREE.Vector3(), faceN: new THREE.Vector3(), headA: new THREE.Vector3(), headB: new THREE.Vector3(), foot: new THREE.Vector3() };
function trailAt(tr, beat) {
  const f = ((((beat % tr.P) + tr.P) % tr.P) / tr.P) * tr.N;
  const i = Math.floor(f);
  const k = f - i;
  const a = tr.pts[i % tr.N];
  const b = tr.pts[(i + 1) % tr.N];
  _tr.ember.lerpVectors(a.ember, b.ember, k);
  _tr.mouth.lerpVectors(a.mouth, b.mouth, k);
  _tr.faceN.lerpVectors(a.faceN, b.faceN, k).normalize();
  _tr.headA.lerpVectors(a.headA, b.headA, k);
  _tr.headB.lerpVectors(a.headB, b.headB, k);
  _tr.foot.lerpVectors(a.foot, b.foot, k);
  return _tr;
}

function renderAt(t) {
  getTrail(); // antes de posar os bonecos (a pré-simulação mexe no A)
  const L = loopLen();
  t = ((t % L) + L) % L;
  const nf = frameCount();
  const beatLen = 60 / cfg.bpm;
  // stop-motion: tudo que se move muda só a cada pose
  const pose = poseOf(t);
  const tp = pose / cfg.poseRate;
  const beatF = tp / beatLen;
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
  // a paleta troca no compasso real (junto com o corte), não na pose
  const realBar = Math.floor(t / beatLen / 4 + 1e-6);
  const pal = palette({ ...a, bar: realBar, section: realBar < cfg.bars / 4 ? 0 : realBar < cfg.bars / 2 ? 1 : 2 });

  const smokeState = A.update(a);
  B.update(a, { mouse: room.mouse, keyboard: room.keyboardW });
  room.update(a, pal);
  scene.updateMatrixWorld();

  // câmera de motion control: parte da quina (com um braço que a afasta da
  // parede), desliza poucos centímetros durante o plano e segue o alvo
  // o corte usa o tempo real (cai exatamente no bumbo); o resto anda em poses
  const shot = shotAt(t / beatLen);
  const k = easeInOut(Math.min(1, Math.max(0, (beatF - shot.at) / (shot.end - shot.at))));
  const arm = shot.arm || [0, 0, 0];
  const slide = shot.slide || [0, 0, 0];
  camera.position.copy(CAMS[shot.cam]).add(v3.set(arm[0] + slide[0] * k, arm[1] + slide[1] * k, arm[2] + slide[2] * k));
  const tgt = target(shot.tgt, shot).clone();
  if (shot.aim) tgt.add(v3.fromArray(shot.aim));
  const focusP = shot.focus ? target(shot.focus, shot).clone() : tgt.clone();
  camera.lookAt(v3.copy(tgt).add(v3b.set(0, shot.lift || 0, 0)));
  if (cfg.camOverride) {
    // usado só para inspecionar a cena (ex.: ?render + vis.init({ camOverride }))
    const o = cfg.camOverride;
    camera.position.fromArray(o.pos);
    tgt.copy(o.tgt ? v3.fromArray(o.tgt) : target(o.who));
    focusP.copy(tgt);
    camera.lookAt(tgt);
  }
  let fov = cfg.camOverride?.fov ?? shot.fov * (1 - (shot.zoom ?? 0.04) * k);
  if (cfg.vertical) fov = Math.min(110, fov * 1.55);
  camera.fov = fov;
  camera.aspect = OUT_W / OUT_H;
  camera.updateProjectionMatrix();
  if (shot.shift && !cfg.camOverride) {
    // deslocamento de lente (como câmera de fole): desce o quadro sem inclinar
    camera.projectionMatrix.elements[9] += shot.shift;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  camera.updateMatrixWorld();

  // luzes (práticas do cenário)
  const { ember, glow } = smokeState;
  const bassS = a.bassS ?? a.bass;
  const midS = a.midS ?? a.mid;
  const highS = a.highS ?? a.high;
  // fita de LED do teto (cor da paleta): banha paredes e teto, não é mais a luz principal dos rostos
  setLight(0, 0, 2.45, 0, pal.c, 0.2 + 0.6 * bassS, 0.5);
  // brilho dos monitores na altura do rosto do B (antes vinha de baixo e azul demais: rosto cinza)
  setLight(1, -0.55, 1.34, -1.3, COL.screen, 1.35 + 0.1 * midS, 1.3);
  setLight(2, 1.95, 2.15, 0.0, COL.neon, 0.9 * (0.8 + 0.4 * midS), 1.1);
  setLight(3, -1.9, 1.55, -0.55, COL.moon, 0.4, 0.9);
  setLight(4, ember.x, ember.y, ember.z, COL.ember, 0.025 * (0.5 + glow), 90);
  setLight(5, 0.62, 0.35, -1.45, pal.c, 0.25 + 0.4 * bassS, 3);
  setLight(6, 1.55, 0.55, 1.15, COL.tv, 0.3 + 0.2 * highS, 2.5);
  const B0 = room.BULB;
  setLight(7, B0.x, B0.y - 0.05, B0.z, COL.bulb, 1.55, 0.32);
  // luzes de rosto motivadas (abajur fora de quadro / rebatedor do monitor), como num set de stop-motion
  setLight(8, 1.2, 1.5, 0.55, COL.keyA, 0.85, 4);
  setLight(9, -0.9, 1.62, -1.32, COL.keyB, 0.8, 4); // frente-esquerda do B, lado da câmera do close
  shared.uAmbient.value.set(0.045 + 0.02 * pal.c.r * bassS, 0.04 + 0.016 * pal.c.g * bassS, 0.055 + 0.02 * pal.c.b * bassS);
  shared.uFogColor.value.set(0.03 + pal.c.r * 0.03, 0.02 + pal.c.g * 0.015, 0.03 + pal.c.b * 0.03);
  shared.uFogNear.value = 1.5;
  shared.uFogFar.value = 9;

  // fumaça: cada partícula nasce onde a brasa (ou a boca) estava no instante
  // em que foi solta e fica no ar — sobe, faz curvas e se desfaz
  const trail = getTrail();
  const camQ = camera.quaternion;
  const orient = (s, vel, spin) => {
    // billboard alinhado à direção do movimento na tela (fumaça "esticada")
    s.quaternion.copy(camQ);
    const vc = vel.clone().applyQuaternion(camQ.clone().invert());
    s.rotateZ(Math.atan2(vc.y, vc.x) - PI / 2 + spin);
  };
  const lifeS = 6; // batidas
  stream.forEach((s, i) => {
    const age = (((beatF + (i / STREAM_N) * lifeS) % lifeS) + lifeS) % lifeS;
    const src = trailAt(trail, beatF - age);
    const k = age / lifeS;
    const sec = age * beatLen;
    const seed = i * 1.37;
    // sobe com empuxo, desacelera, e a corrente de ar do quarto empurra pra -x
    const rise = 0.16 * sec - 0.008 * sec * sec;
    const curl = 0.035 * k * Math.sin(sec * 2.3 + seed) + 0.02 * k * Math.sin(sec * 5.1 + seed * 2);
    s.position.set(src.ember.x - 0.035 * sec * k + curl, src.ember.y + 0.004 + rise, src.ember.z + 0.03 * k * Math.cos(sec * 1.9 + seed * 1.3));
    const vel = v3b.set(-0.035 * k + 0.08 * k * Math.cos(sec * 2.3 + seed), 0.16 - 0.016 * sec, 0);
    orient(s, vel, 0);
    s.scale.set(0.006 + k * 0.07, 0.02 + k * 0.13, 1);
    s.material.uniforms.uOpacity.value = 0.3 * (1 - k) ** 1.8 * Math.min(1, age * 5);
  });
  // baforada: velocidade inicial pra fora da boca que freia (arrasto), depois
  // sobe (empuxo) com turbulência; emissão espalhada por toda a expiração
  const wins = A.exhaleWindows;
  // direção da câmera: a baforada sai atravessando o quadro (nas câmeras de cima o rosto
  // virado pro teto aponta pra lente, e a fumaça voava direto no vidro / no desfoque)
  const camF = v3c.set(0, 0, -1).applyQuaternion(camera.quaternion);
  // ele sopra de lado (pra direita do quadro, sobre o fundo escuro dos dreads): com o rosto
  // virado pro teto, soprar "pra frente" passava por cima do nariz e parecia sair da testa
  const camR = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  exhaleP.forEach((s, idx) => {
    const wi = Math.floor(idx / EXHALE_N);
    const i = idx % EXHALE_N;
    const [w0, w1] = wins[wi];
    const born = w0 + (w1 - w0) * Math.pow((i + 0.5) / EXHALE_N, 1.6); // mais denso no começo
    const age = beatF - born;
    const lifeE = 4.5;
    const on = age >= 0 && age < lifeE;
    s.visible = on;
    if (!on) return;
    const src = trailAt(trail, born);
    const k = age / lifeE;
    const sec = age * beatLen;
    const seed = i * 2.31 + wi * 7.7;
    const strength = 0.55 + 0.45 * (1 - (born - w0) / (w1 - w0)); // primeiras saem mais fortes
    const dir = v3b.copy(src.faceN).addScaledVector(camF, -0.8 * src.faceN.dot(camF)).normalize().multiplyScalar(0.45);
    dir.addScaledVector(camR, 0.8).add(v3.set(Math.sin(seed) * 0.12, 0.12, Math.cos(seed * 1.7) * 0.12)).normalize();
    // nuvem que se forma na frente da boca e cresce (no close o quadro tem ~40 cm: alcance curto)
    const reach = 0.17 * strength * (1 - Math.exp(-sec * 1.5)); // arrasto
    const lift = 0.035 * sec * sec / (0.6 + sec); // empuxo só depois que o sopro perde força
    const curl = 0.04 * k * Math.sin(sec * 2.0 + seed);
    s.position.copy(src.mouth).addScaledVector(src.faceN, 0.01).addScaledVector(dir, reach);
    s.position.y += lift;
    s.position.x += curl;
    s.position.z += 0.04 * k * Math.cos(sec * 1.6 + seed);
    const vel = dir.clone().multiplyScalar(0.17 * strength * 1.5 * Math.exp(-sec * 1.5)).add(v3.set(0, 0.035, 0));
    orient(s, vel, 0.3 * Math.sin(seed));
    const sz = 0.03 + Math.pow(k, 0.6) * 0.22;
    s.scale.set(sz, sz * 1.35, 1);
    const nearCam = THREE.MathUtils.smoothstep(s.position.distanceTo(camera.position), 0.25, 0.55);
    s.material.uniforms.uOpacity.value = 0.52 * (1 - k) ** 1.6 * Math.min(1, age * 14) * nearCam;
  });

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
  // foco no assunto do plano; raso nos closes, quase todo nítido nos abertos
  const focus = camera.position.distanceTo(focusP);
  const dof = cfg.camOverride ? 1.2 : shot.dof ?? (fov < 40 ? 1.6 : 0.6);
  // oscilação de exposição de stop-motion: ±1%, variando devagar entre poses
  const vn = (x) => {
    const i0 = Math.floor(x);
    const f = x - i0;
    const e = f * f * (3 - 2 * f);
    return hash(i0 * 1.7) * (1 - e) + hash((i0 + 1) * 1.7) * e;
  };
  const exposure = 1.55 * (1 + 0.02 * (vn(pose / 5) - 0.5));
  // tremor de tripé: a câmera de stop-motion leva esbarrões mínimos entre poses
  const weave = v3.set((vn(pose / 3 + 11) - 0.5) * 0.0006, (vn(pose / 3 + 37) - 0.5) * 0.0004, 0);
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  runPost(camera, focus, dof, exposure, pose % 997, weave);
}

// ---------------- API (export) e prévia ao vivo ----------------
async function loadAudio(url, ctx) {
  const ab = await (await fetch(url)).arrayBuffer();
  return (ctx || new OfflineAudioContext(2, 44100, 44100)).decodeAudioData(ab);
}

window.vis = {
  async init(o = {}) {
    Object.assign(cfg, o);
    trailCache = null;
    setSize(cfg.vertical);
    scaleShots();
    if (o.audioUrl) analyze(await loadAudio(o.audioUrl), frameCount(), cfg.fps);
    return { frames: frameCount(), seconds: loopLen(), w: OUT_W, h: OUT_H };
  },
  // mesma pose + mesmo plano + mesmo compasso => mesma imagem (o render reaproveita)
  poseKey(i) {
    const L = loopLen();
    const t = (((i / cfg.fps) % L) + L) % L;
    const beatLen = 60 / cfg.bpm;
    return `${poseOf(t)}_${shotAt(t / beatLen).idx}_${Math.floor(t / beatLen / 4 + 1e-6)}`;
  },
  renderFrame(i) {
    renderAt(i / cfg.fps);
    return canvas.toDataURL('image/png');
  },
};

// só para inspeção automática (testes de colisão etc.)
window.__dbg = {
  THREE,
  A,
  B,
  room,
  get exhaleP() { return exhaleP; },
  get camera() { return camera; },
  scene,
  cfg,
  pose(beatF) {
    const a = { beatF, beat: Math.floor(beatF), beatPhase: beatF % 1, high: 0, bass: 0, mid: 0, kick: 0, snare: 0, bands: new Array(8).fill(0), pose: 0, frame: 0, t: 0, bar: Math.floor(beatF / 4), section: 0, loopPos: beatF / (cfg.bars * 4), bpm: cfg.bpm };
    A.update(a);
    B.update(a, { mouse: room.mouse, keyboard: room.keyboardW });
    scene.updateMatrixWorld(true);
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
