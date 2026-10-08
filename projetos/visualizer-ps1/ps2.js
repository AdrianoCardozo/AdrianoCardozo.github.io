// Material "PlayStation 2": iluminação por pixel com várias luzes coloridas,
// texturas filtradas, um brilho especular discreto e névoa colorida. O brilho
// (bloom) das luzes fica no pós-processamento em main.js.
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
};

const vert = /* glsl */ `
  uniform float uFogNear, uFogFar;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying float vFog;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    vec4 mv = viewMatrix * wp;
    vFog = smoothstep(uFogNear, uFogFar, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const frag = /* glsl */ `
  uniform vec3 uLightPos[${MAX_LIGHTS}];
  uniform vec3 uLightCol[${MAX_LIGHTS}];
  uniform float uLightFall[${MAX_LIGHTS}];
  uniform vec3 uAmbient;
  uniform sampler2D map;
  uniform float uHasMap;
  uniform vec3 uColor;
  uniform vec3 uEmissive;
  uniform float uOpacity;
  uniform float uAlphaTest;
  uniform float uUnlit;
  uniform float uSpec;
  uniform vec3 uFogColor;
  uniform float uFogAmt;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying float vFog;
  void main() {
    vec4 tex = uHasMap > 0.5 ? texture2D(map, vUv) : vec4(1.0);
    if (tex.a < uAlphaTest) discard;
    vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 lit = uAmbient;
    vec3 spec = vec3(0.0);
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      vec3 d = uLightPos[i] - vWorld;
      float dist = length(d);
      vec3 l = d / max(dist, 1e-4);
      float att = 1.0 / (1.0 + dist * dist * uLightFall[i]);
      float lambert = max(dot(n, l) * 0.8 + 0.2, 0.0); // meio-lambert
      lit += uLightCol[i] * lambert * att;
      spec += uLightCol[i] * pow(max(dot(n, normalize(l + v)), 0.0), 40.0) * att;
    }
    vec3 base = uColor * tex.rgb;
    vec3 light = mix(lit, vec3(1.0), uUnlit);
    vec3 c = base * light + base * uEmissive + spec * uSpec;
    c = mix(c, uFogColor, vFog * uFogAmt);
    gl_FragColor = vec4(c, tex.a * uOpacity);
  }
`;

export function mat({ color = 0xffffff, map = null, emissive = 0, opacity = 1, unlit = false, fog = 1, spec = 0.08, alphaTest = 0.4, side = THREE.FrontSide } = {}) {
  const c = new THREE.Color(color);
  const e = typeof emissive === 'number' ? new THREE.Vector3(emissive, emissive, emissive) : emissive;
  const transparent = opacity < 1;
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    side,
    transparent,
    depthWrite: !transparent,
    uniforms: {
      ...shared,
      map: { value: map },
      uHasMap: { value: map ? 1 : 0 },
      uColor: { value: new THREE.Vector3(c.r, c.g, c.b) },
      uEmissive: { value: e },
      uOpacity: { value: opacity },
      uAlphaTest: { value: alphaTest },
      uUnlit: { value: unlit ? 1 : 0 },
      uSpec: { value: spec },
      uFogAmt: { value: fog },
    },
  });
}

// Textura desenhada num <canvas> pequeno. As estáticas são ampliadas 8x sem
// suavizar e depois filtradas (bordas firmes, sem serrilhado de pixel); as
// dinâmicas (telas) ficam no tamanho original com filtro linear.
const UP = 8;
export function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  let img = cv;
  if (draw) {
    draw(g, w, h);
    img = document.createElement('canvas');
    img.width = w * UP;
    img.height = h * UP;
    const g2 = img.getContext('2d');
    g2.imageSmoothingEnabled = false;
    g2.drawImage(cv, 0, 0, w * UP, h * UP);
  }
  const t = new THREE.CanvasTexture(img);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = draw ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.generateMipmaps = !!draw;
  t.anisotropy = 4;
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
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d, seg, seg, seg), m);
}

// Cilindro de lados suaves (membros, dreads, cabos).
export function tube(rTop, rBottom, h, m, sides = 10) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, sides), m);
}
