// Ferramentas de animação: curvas de quadros-chave com easing, IK de dois ossos
// (braços/pernas que encostam de verdade no alvo) e molas para movimento
// secundário (dreads, corrente) pré-simuladas em regime periódico — o loop fecha.
import * as THREE from './three.module.min.js';

export const clamp01 = (k) => Math.max(0, Math.min(1, k));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (k) => k * k * (3 - 2 * k);
export const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
export const easeOut = (k) => 1 - (1 - k) ** 3;
export const easeIn = (k) => k * k * k;
// sai devagar, chega rápido e passa um pouco do ponto antes de assentar
export const backOut = (k, s = 1.4) => 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2;

const EASE = { linear: (k) => k, smooth, inOut: easeInOut, out: easeOut, in: easeIn, back: backOut };

// Curva periódica de quadros-chave: keys = [[tempo, valor, easing?], ...] em
// batidas; o último segmento volta ao primeiro valor (período `period`).
export function curve(keys, period) {
  const ks = keys.slice().sort((a, b) => a[0] - b[0]);
  return (t) => {
    const x = ((t % period) + period) % period;
    let i = ks.length - 1;
    for (let j = 0; j < ks.length; j++) if (ks[j][0] <= x) i = j;
    const a = ks[i];
    const b = ks[(i + 1) % ks.length];
    const t0 = a[0];
    let t1 = b[0];
    let xx = x;
    if (t1 <= t0) {
      t1 += period;
      if (xx < t0) xx += period;
    }
    const k = (xx - t0) / (t1 - t0 || 1);
    const e = EASE[b[2] || 'inOut'];
    return lerp(a[1], b[1], e(clamp01(k)));
  };
}

// Pulso de balanço de cabeça com antecipação (sobe um pouco antes), batida
// rápida pra baixo, leve rebote e assentamento. phase em [0,1).
const NOD = curve(
  [
    [0.0, 0.0, 'inOut'],
    [0.09, 1.0, 'out'],
    [0.22, 0.72, 'inOut'],
    [0.36, 0.82, 'inOut'],
    [0.62, 0.22, 'inOut'],
    [0.86, -0.12, 'inOut'],
  ],
  1
);
export const nodCurve = (phase) => NOD(phase);

// ---------- IK de dois ossos ----------
const _S = new THREE.Vector3();
const _T = new THREE.Vector3();
const _d = new THREE.Vector3();
const _u = new THREE.Vector3();
const _p = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qp = new THREE.Quaternion();

// Posiciona a cadeia ombro→cotovelo→punho para o punho chegar em `targetW`
// (mundo). Convenção do esqueleto: o osso pende em -Y local e dobra o
// antebraço/canela girando em X do pivô do meio. `poleW` = direção (mundo)
// para onde o cotovelo/joelho deve apontar. bendSign=+1 dobra pra frente (+Z
// local, braço), -1 dobra pra trás (joelho).
export function solveIK(rootPivot, midPivot, endPivot, targetW, poleW, l1, l2, bendSign = 1) {
  const parent = rootPivot.parent;
  parent.updateWorldMatrix(true, false);
  rootPivot.getWorldPosition(_S);
  _T.copy(targetW);
  _d.subVectors(_T, _S);
  let d = _d.length();
  const maxD = (l1 + l2) * 0.9995;
  const minD = Math.abs(l1 - l2) * 1.001 + 1e-4;
  d = Math.max(minD, Math.min(maxD, d));
  _d.normalize();
  // ângulo entre o osso 1 e a linha ombro→alvo
  const a1 = Math.acos(THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  // ângulo interno do cotovelo
  const ae = Math.acos(THREE.MathUtils.clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
  // perpendicular no plano do polo
  _p.copy(poleW).addScaledVector(_d, -poleW.dot(_d));
  if (_p.lengthSq() < 1e-8) _p.set(0, -1, 0).addScaledVector(_d, -_d.y);
  _p.normalize();
  // direção do osso 1 (mundo)
  _u.copy(_d).multiplyScalar(Math.cos(a1)).addScaledVector(_p, Math.sin(a1));
  // base do pivô raiz: -Y = osso; +Z = lado para onde o meio dobra
  _y.copy(_u).negate();
  // o antebraço dobra em direção ao alvo, saindo do plano do polo
  _z.copy(_d).addScaledVector(_u, -_d.dot(_u)).normalize().multiplyScalar(bendSign);
  _x.crossVectors(_y, _z).normalize();
  _z.crossVectors(_x, _y).normalize();
  _m.makeBasis(_x, _y, _z);
  _q.setFromRotationMatrix(_m);
  parent.getWorldQuaternion(_qp).invert();
  rootPivot.quaternion.copy(_qp.multiply(_q));
  // dobra do meio
  midPivot.rotation.set(-bendSign * (Math.PI - ae), 0, 0);
  midPivot.updateMatrixWorld(true);
  return d;
}

// Orienta um pivô para ter a orientação `qWorld` no mundo.
export function setWorldQuat(obj, qWorld) {
  obj.parent.updateWorldMatrix(true, false);
  obj.parent.getWorldQuaternion(_qp).invert();
  obj.quaternion.copy(_qp.multiply(qWorld));
}

// Quaternion de mundo a partir de eixos desejados (x, y, z ortonormais).
export function quatFromAxes(x, y, z, out = new THREE.Quaternion()) {
  _m.makeBasis(x, y, z);
  return out.setFromRotationMatrix(_m);
}

// ---------- mola periódica ----------
// Simula um oscilador amortecido guiado por `drive(t)` (em unidades de
// batida) com passo fixo, por 3 voltas, e devolve a última volta tabelada —
// assim o estado no fim do loop é igual ao do começo.
export function periodicSpring(drive, period, { stiffness = 120, damping = 9, samples = 768 } = {}) {
  const dt = period / samples;
  let x = drive(0);
  let v = 0;
  const out = new Float32Array(samples);
  for (let lap = 0; lap < 3; lap++) {
    for (let i = 0; i < samples; i++) {
      const t = i * dt;
      const target = drive(t);
      // integração semi-implícita, 4 subpassos
      for (let s = 0; s < 4; s++) {
        const a = stiffness * (target - x) - damping * v;
        v += a * (dt / 4);
        x += v * (dt / 4);
      }
      if (lap === 2) out[i] = x;
    }
  }
  return (t) => {
    const f = ((((t % period) + period) % period) / period) * samples;
    const i = Math.floor(f);
    const k = f - i;
    return lerp(out[i % samples], out[(i + 1) % samples], k);
  };
}
