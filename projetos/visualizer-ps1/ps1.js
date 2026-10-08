// Material "PlayStation 1": iluminação por vértice (Gouraud), vértices tremidos
// (snap em grade de baixa resolução), textura afim (sem correção de perspectiva),
// névoa e transparência por dithering (screen-door), como no hardware original.
import * as THREE from './three.module.min.js';

// Cores em valores de tela direto (sem conversão sRGB/linear).
THREE.ColorManagement.enabled = false;

export const MAX_LIGHTS = 8;

// Uniforms compartilhados por todos os materiais (atualizados uma vez por frame).
export const shared = {
  uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
  uLightCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
  uLightFall: { value: new Array(MAX_LIGHTS).fill(1) },
  uAmbient: { value: new THREE.Vector3(0.05, 0.03, 0.06) },
  uFogColor: { value: new THREE.Vector3(0.02, 0.0, 0.02) },
  uFogNear: { value: 2.5 },
  uFogFar: { value: 7.5 },
  uSnapRes: { value: new THREE.Vector2(160, 90) },
};

const vert = /* glsl */ `
  uniform vec3 uLightPos[${MAX_LIGHTS}];
  uniform vec3 uLightCol[${MAX_LIGHTS}];
  uniform float uLightFall[${MAX_LIGHTS}];
  uniform vec3 uAmbient;
  uniform float uFogNear, uFogFar;
  uniform vec2 uSnapRes;
  uniform float uUnlit;
  varying vec3 vLight;
  varying vec2 vUvA;
  varying float vW;
  varying float vFog;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(mat3(modelMatrix) * normal);
    vec3 lit = uAmbient;
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      vec3 d = uLightPos[i] - wp.xyz;
      float dist = length(d);
      float lambert = dot(n, d / max(dist, 1e-4)) * 0.75 + 0.25; // meio-lambert
      lit += uLightCol[i] * max(lambert, 0.0) / (1.0 + dist * dist * uLightFall[i]);
    }
    vLight = mix(lit, vec3(1.0), uUnlit);
    vec4 mv = viewMatrix * wp;
    vFog = smoothstep(uFogNear, uFogFar, -mv.z);
    vec4 p = projectionMatrix * mv;
    vec2 g = uSnapRes * 0.5;
    p.xy = floor(p.xy / p.w * g + 0.5) / g * p.w;
    gl_Position = p;
    vUvA = uv * p.w;
    vW = p.w;
  }
`;

const frag = /* glsl */ `
  uniform sampler2D map;
  uniform float uHasMap;
  uniform vec3 uColor;
  uniform vec3 uEmissive;
  uniform float uOpacity;
  uniform vec3 uFogColor;
  uniform float uFogAmt;
  varying vec3 vLight;
  varying vec2 vUvA;
  varying float vW;
  varying float vFog;
  float bayer4(vec2 p) {
    ivec2 q = ivec2(mod(p, 4.0));
    int i = q.x + q.y * 4;
    int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
    return (float(m[i]) + 0.5) / 16.0;
  }
  void main() {
    vec2 uv = vUvA / vW; // interpolação afim = textura "dançando" estilo PS1
    vec4 tex = uHasMap > 0.5 ? texture2D(map, uv) : vec4(1.0);
    float a = tex.a * uOpacity;
    if (a < bayer4(gl_FragCoord.xy)) discard;
    vec3 base = uColor * tex.rgb;
    vec3 c = base * vLight + base * uEmissive;
    c = mix(c, uFogColor, vFog * uFogAmt);
    gl_FragColor = vec4(c, 1.0);
  }
`;

export function mat({ color = 0xffffff, map = null, emissive = 0, opacity = 1, unlit = false, fog = 1, side = THREE.FrontSide } = {}) {
  const c = new THREE.Color(color);
  const e = typeof emissive === 'number' ? new THREE.Vector3(emissive, emissive, emissive) : emissive;
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    side,
    uniforms: {
      ...shared,
      map: { value: map },
      uHasMap: { value: map ? 1 : 0 },
      uColor: { value: new THREE.Vector3(c.r, c.g, c.b) },
      uEmissive: { value: e },
      uOpacity: { value: opacity },
      uUnlit: { value: unlit ? 1 : 0 },
      uFogAmt: { value: fog },
    },
  });
}

// Textura desenhada num <canvas> pequeno, sem filtro (pixels duros).
export function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (draw) draw(g, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.userData.ctx = g;
  return t;
}

// Ruído determinístico (mesmo frame => mesma imagem, essencial para o loop).
export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Ruído de grão simples para texturas.
export function grain(g, w, h, amt, seed = 1) {
  const r = rand(seed);
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * amt;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

// Caixa com material por face: [+x, -x, +y, -y, +z(frente), -z].
export function box(w, h, d, m, seg = 1) {
  const geo = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  return new THREE.Mesh(geo, m);
}
