// Material dos bonecos e da maquete: iluminação por pixel com várias luzes
// coloridas, brilho de plástico, sombra real da lâmpada do teto (shadow map)
// e névoa colorida. Desfoque de miniatura, grão e cor de filme ficam em main.js.
import * as THREE from './three.module.min.js';

// Cores em valores de tela direto (sem conversão sRGB/linear).
THREE.ColorManagement.enabled = false;

export const MAX_LIGHTS = 8;
export const SHADOW_LIGHT = 7; // índice da luz que projeta sombra (lâmpada)

// Uniforms compartilhados por todos os materiais (atualizados uma vez por frame).
export const shared = {
  uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
  uLightCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
  uLightFall: { value: new Array(MAX_LIGHTS).fill(1) },
  uAmbient: { value: new THREE.Vector3(0.05, 0.03, 0.06) },
  uFogColor: { value: new THREE.Vector3(0.02, 0.0, 0.02) },
  uFogNear: { value: 2.5 },
  uFogFar: { value: 7.5 },
  uShadowMap: { value: null },
  uShadowMatrix: { value: new THREE.Matrix4() },
  uShadowTexel: { value: 1 / 2048 },
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
  uniform sampler2D uShadowMap;
  uniform mat4 uShadowMatrix;
  uniform float uShadowTexel;
  uniform float uHasMap;
  uniform vec3 uColor;
  uniform vec3 uEmissive;
  uniform float uOpacity;
  uniform float uAlphaTest;
  uniform float uUnlit;
  uniform float uSpec;
  uniform float uShine;
  uniform vec3 uFogColor;
  uniform float uFogAmt;
  uniform float uSheen;
  uniform float uWear;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying float vFog;

  // ruído de valor 3D (imperfeições: poeira, digitais, desgaste)
  float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float vnoise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  float shadow(vec3 n, vec3 l) {
    vec4 sc = uShadowMatrix * vec4(vWorld + n * 0.006, 1.0);
    sc.xyz /= sc.w;
    if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
    float bias = 0.0004 + 0.0012 * (1.0 - max(dot(n, l), 0.0));
    float s = 0.0;
    // PCF 5x5: borda de sombra macia, como luz de estúdio difusa
    for (int x = -2; x <= 2; x++)
      for (int y = -2; y <= 2; y++) {
        float d = texture2D(uShadowMap, sc.xy + vec2(x, y) * uShadowTexel * 1.6).r;
        s += sc.z - bias > d ? 0.0 : 1.0;
      }
    return s / 25.0;
  }

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
      if (i == ${SHADOW_LIGHT}) att *= shadow(n, l);
      float lambert = max(dot(n, l) * 0.85 + 0.15, 0.0);
      lit += uLightCol[i] * lambert * att;
      spec += uLightCol[i] * pow(max(dot(n, normalize(l + v)), 0.0), uShine) * att;
    }
    vec3 base = uColor * tex.rgb;
    // imperfeições: manchas de brilho (digitais/poeira) e leve variação de tinta
    float nLow = vnoise(vWorld * 18.0);
    float nHigh = vnoise(vWorld * 140.0);
    float wear = uWear * (nLow * 0.6 + nHigh * 0.4);
    base *= 1.0 + (nLow - 0.5) * 0.07 * uWear;
    float specK = uSpec * (0.65 + 0.7 * nLow) * (1.0 - 0.35 * nHigh * uWear);
    vec3 light = mix(lit, vec3(1.0), uUnlit);
    // reflexo de borda (plástico) e brilho aveludado (tecido)
    float fres = 1.0 - max(dot(n, v), 0.0);
    float rim = pow(fres, 3.0) * uSpec * 0.35;
    vec3 sheen = pow(fres, 2.0) * uSheen * lit * (0.8 + 0.4 * nHigh);
    vec3 c = base * light + base * uEmissive + spec * specK + rim * lit + sheen * base * 2.0;
    c *= 1.0 - 0.06 * wear * (1.0 - uUnlit);
    c = mix(c, uFogColor, vFog * uFogAmt);
    gl_FragColor = vec4(c, tex.a * uOpacity);
  }
`;

export function mat({
  color = 0xffffff,
  map = null,
  emissive = 0,
  opacity = 1,
  unlit = false,
  fog = 1,
  spec = 0.06,
  shine = 24,
  alphaTest = 0.4,
  sheen = 0,
  wear = 1,
  side = THREE.FrontSide,
} = {}) {
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
      uShine: { value: shine },
      uFogAmt: { value: fog },
      uSheen: { value: sheen },
      uWear: { value: unlit ? 0 : wear },
    },
  });
}

// Presets de material: plástico pintado (pele/acessórios do boneco), tecido e metal.
export const plastic = (o) => mat({ spec: 0.45, shine: 50, ...o });
export const fabric = (o) => mat({ spec: 0.02, shine: 8, sheen: 0.22, ...o });
export const metal = (o) => mat({ spec: 1.4, shine: 70, emissive: 0.12, ...o });

// Textura desenhada num <canvas>. O desenho usa coordenadas "lógicas" (w×h) e
// é rasterizado em S× a resolução, com antisserrilhado — fica nítido de perto.
const S = 8;
export function canvasTex(w, h, draw, { scale = S, filter = true } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w * scale;
  cv.height = h * scale;
  const g = cv.getContext('2d');
  g.scale(scale, scale);
  g.imageSmoothingEnabled = true;
  if (draw) draw(g, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = draw && filter ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.generateMipmaps = !!(draw && filter);
  t.anisotropy = 8;
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

// Grão fino na resolução real do canvas (tecido, papel, tinta).
export function grain(g, _w, _h, amt, seed = 1) {
  const W = g.canvas.width;
  const H = g.canvas.height;
  const r = rand(seed);
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * amt;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

// Trama de tecido: fios cruzados + vincos verticais suaves.
export function weave(g, w, h, amt = 0.08, seed = 3) {
  const r = rand(seed);
  g.save();
  for (let y = 0; y < h; y += 0.25) {
    g.fillStyle = `rgba(0,0,0,${amt * (0.4 + r() * 0.6)})`;
    g.fillRect(0, y, w, 0.08);
  }
  for (let x = 0; x < w; x += 0.25) {
    g.fillStyle = `rgba(255,255,255,${amt * 0.35 * r()})`;
    g.fillRect(x, 0, 0.08, h);
  }
  // vincos/dobras
  for (let i = 0; i < 6; i++) {
    const x = r() * w;
    const grd = g.createLinearGradient(x - 2, 0, x + 2, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.5, `rgba(0,0,0,${0.12 + r() * 0.12})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - 2, 0, 4, h);
  }
  g.restore();
}

// Caixa com material por face: [+x, -x, +y, -y, +z(frente), -z].
export function box(w, h, d, m, seg = 1) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d, seg, seg, seg), m);
}

// Caixa com cantos arredondados (nada no mundo real tem aresta perfeita).
export function rbox(w, h, d, m, r = 0.01, seg = 3) {
  const geo = new THREE.BoxGeometry(w, h, d, 6, 6, 6);
  const p = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  const hw = Math.max(w / 2 - r, 0);
  const hh = Math.max(h / 2 - r, 0);
  const hd = Math.max(d / 2 - r, 0);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(Math.max(-hw, Math.min(hw, v.x)), Math.max(-hh, Math.min(hh, v.y)), Math.max(-hd, Math.min(hd, v.z)));
    const off = v.clone().sub(c);
    if (off.lengthSq() > 1e-12) {
      off.normalize();
      nrm.setXYZ(i, off.x, off.y, off.z); // normal exata do canto arredondado
      v.copy(c).addScaledVector(off, r);
      p.setXYZ(i, v.x, v.y, v.z);
    }
  }
  return new THREE.Mesh(geo, m);
}

// Cilindro de lados suaves (membros, dreads, cabos).
export function tube(rTop, rBottom, h, m, sides = 14) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, sides), m);
}

export function ball(rx, ry, rz, m, seg = 18) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)), m);
  s.scale.set(rx, ry, rz);
  return s;
}
