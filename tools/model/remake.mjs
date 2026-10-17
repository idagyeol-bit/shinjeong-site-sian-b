// 로봇 모형 다시 만들기 (시안B 11차 2차 다듬기) — '옮겨 굽기'
//  1) 원본(삼각형 214만 개)을 위치·질감 좌표로 묶고, 질감 좌표 어긋남까지 따지며 줄인다(meshoptimizer)
//  2) 줄인 모형의 질감 칸마다 3D 위치를 구해 원본 표면의 가장 가까운 점을 찾고,
//     그 점의 색·금속거칠기·면 방향(물체 기준 노멀)을 옮겨 굽는다 → 줄인 모형이 원본처럼 보인다(판 울렁임·번짐 없음)
//  3) 질감 빈 칸은 가장 가까운 조각 값으로 끝까지 메운다(축소·밉맵 때 가장자리 번짐 방지)
//  4) 보통 GLB(압축 확장 없음): 점 65,535개 이하 조각으로 나눠 2바이트 번호, 질감 좌표는 2바이트 정규화
// 사용: node remake4.mjs <원본 전해상도 glb> <출력 glb> <목표 삼각형 수> [굽기 해상도=4096] [노멀 출력=2048] [색 출력=2048] [mr 출력=1024] [uv 가중=1]
//   환경변수 NQ·BQ·MQ = JPEG 품질, NSTR = 원본 노멀 맵 섞는 정도(0~1, 기본 0), PREVIEW_DIR = 질감 미리보기 저장 폴더
import { NodeIO, Document } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';

const [, , input, output, targetTriS, bakeS, nOutS, bOutS, mOutS, uvWS] = process.argv;
const targetTri = +targetTriS, BR = +(bakeS || 4096), nOut = +(nOutS || 2048), bOut = +(bOutS || 2048), mOut = +(mOutS || 1024), uvW = +(uvWS || 1);
const NQ = +(process.env.NQ || 92), BQ = +(process.env.BQ || 90), MQ = +(process.env.MQ || 90), NSTR = +(process.env.NSTR || 0), PREV = process.env.PREVIEW_DIR;
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', ...a);

// ---------- 원본 읽기 ----------
const doc = await new NodeIO().read(input);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const P = prim.getAttribute('POSITION').getArray(), N = prim.getAttribute('NORMAL').getArray(), UV = prim.getAttribute('TEXCOORD_0').getArray();
const I = prim.getIndices().getArray();
const mat = prim.getMaterial();
const nv = P.length / 3, nt = I.length / 3;
const raw = async (t) => { const r = await sharp(Buffer.from(t.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: r.data, w: r.info.width, h: r.info.height }; };
const SB = await raw(mat.getBaseColorTexture()), SM = await raw(mat.getMetallicRoughnessTexture()), SN = await raw(mat.getNormalTexture());
log('원본', nt, '삼각형 /', nv, '점 | 색', SB.w, 'mr', SM.w, '노멀', SN.w);

// ---------- 1) 묶고 줄이기 ----------
const key = new Map(), remap = new Uint32Array(nv); const wp = [], wu = [];
const f32 = new Float32Array(5), u32 = new Uint32Array(f32.buffer);
for (let v = 0; v < nv; v++) {
  f32[0] = P[3 * v]; f32[1] = P[3 * v + 1]; f32[2] = P[3 * v + 2]; f32[3] = UV[2 * v]; f32[4] = UV[2 * v + 1];
  const k = u32.join(','); let id = key.get(k);
  if (id === undefined) { id = wp.length / 3; key.set(k, id); wp.push(P[3 * v], P[3 * v + 1], P[3 * v + 2]); wu.push(UV[2 * v], UV[2 * v + 1]); }
  remap[v] = id;
}
const WP = new Float32Array(wp), WU = new Float32Array(wu), WI = new Uint32Array(I.length);
for (let i = 0; i < I.length; i++) WI[i] = remap[I[i]];
await MeshoptSimplifier.ready;
const [SI, err] = MeshoptSimplifier.simplifyWithAttributes(WI, WP, 3, WU, 2, [uvW, uvW], null, targetTri * 3, 0.05, []);
const used = new Int32Array(WP.length / 3).fill(-1); const op = [], ou = []; const OI = new Uint32Array(SI.length);
for (let i = 0; i < SI.length; i++) { const v = SI[i]; if (used[v] < 0) { used[v] = op.length / 3; op.push(WP[3 * v], WP[3 * v + 1], WP[3 * v + 2]); ou.push(WU[2 * v], WU[2 * v + 1]); } OI[i] = used[v]; }
const scale = MeshoptSimplifier.getScale(WP, 3);
log('줄임', OI.length / 3, '삼각형 /', op.length / 3, '점, 오차', err.toFixed(5), '(절대', (err * scale).toExponential(2) + ')');

// ---------- 2) 원본 삼각형 격자(가까운 점 찾기용) ----------
let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
for (let v = 0; v < nv; v++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[3 * v + k]); mx[k] = Math.max(mx[k], P[3 * v + k]); }
let edgeSum = 0; for (let t = 0; t < nt; t += 97) { const a = I[3 * t], b = I[3 * t + 1]; edgeSum += Math.hypot(P[3 * a] - P[3 * b], P[3 * a + 1] - P[3 * b + 1], P[3 * a + 2] - P[3 * b + 2]); }
const avgEdge = edgeSum / Math.ceil(nt / 97);
const CS = Math.max(avgEdge * 2, (Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2])) / 1000);
const GD = [0, 1, 2].map((k) => Math.max(1, Math.ceil((mx[k] - mn[k]) / CS) + 1));
const cellOf = (x, y, z) => (Math.min(GD[0] - 1, Math.max(0, Math.floor((x - mn[0]) / CS))) * GD[1] + Math.min(GD[1] - 1, Math.max(0, Math.floor((y - mn[1]) / CS)))) * GD[2] + Math.min(GD[2] - 1, Math.max(0, Math.floor((z - mn[2]) / CS)));
// 삼각형 → 덮는 칸 목록 (정렬 기반 희소 격자)
const pairsK = [], pairsT = [];
const FN = new Float32Array(nt * 3);
for (let t = 0; t < nt; t++) {
  const a = I[3 * t], b = I[3 * t + 1], c = I[3 * t + 2];
  const ex = P[3 * b] - P[3 * a], ey = P[3 * b + 1] - P[3 * a + 1], ez = P[3 * b + 2] - P[3 * a + 2], fx = P[3 * c] - P[3 * a], fy = P[3 * c + 1] - P[3 * a + 1], fz = P[3 * c + 2] - P[3 * a + 2];
  let nx = ey * fz - ez * fy, ny = ez * fx - ex * fz, nz = ex * fy - ey * fx; const l = Math.hypot(nx, ny, nz) || 1; FN[3 * t] = nx / l; FN[3 * t + 1] = ny / l; FN[3 * t + 2] = nz / l;
  const lo = [0, 1, 2].map((k) => Math.floor((Math.min(P[3 * a + k], P[3 * b + k], P[3 * c + k]) - mn[k]) / CS)), hi = [0, 1, 2].map((k) => Math.floor((Math.max(P[3 * a + k], P[3 * b + k], P[3 * c + k]) - mn[k]) / CS));
  for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { pairsK.push((x * GD[1] + y) * GD[2] + z); pairsT.push(t); }
}
const order = new Uint32Array(pairsK.length); for (let i = 0; i < order.length; i++) order[i] = i;
const PK = new Float64Array(pairsK); order.sort((i, j) => PK[i] - PK[j]);
const cellKeys = [], cellStart = []; const cellTris = new Uint32Array(order.length);
for (let i = 0; i < order.length; i++) { const k = PK[order[i]]; if (!cellKeys.length || cellKeys[cellKeys.length - 1] !== k) { cellKeys.push(k); cellStart.push(i); } cellTris[i] = pairsT[order[i]]; }
cellStart.push(order.length);
const CK = new Float64Array(cellKeys), CSt = new Uint32Array(cellStart);
const findCell = (k) => { let lo = 0, hi = CK.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (CK[m] === k) return m; if (CK[m] < k) lo = m + 1; else hi = m - 1; } return -1; };
log('격자', GD.join('x'), '칸 크기', CS.toExponential(2), '쓰인 칸', CK.length, '짝', order.length);

// 점-삼각형 가장 가까운 점 (Ericson) → 무게 [u,v,w] 와 거리²
const res = new Float64Array(4);
function closest(px, py, pz, t) {
  const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
  const ax = P[a], ay = P[a + 1], az = P[a + 2];
  const abx = P[b] - ax, aby = P[b + 1] - ay, abz = P[b + 2] - az, acx = P[c] - ax, acy = P[c + 1] - ay, acz = P[c + 2] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let u, v, w;
  if (d1 <= 0 && d2 <= 0) { u = 1; v = 0; w = 0; }
  else {
    const bpx = px - P[b], bpy = py - P[b + 1], bpz = pz - P[b + 2];
    const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { u = 0; v = 1; w = 0; }
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { const s = d1 / (d1 - d3); u = 1 - s; v = s; w = 0; }
      else {
        const cpx = px - P[c], cpy = py - P[c + 1], cpz = pz - P[c + 2];
        const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) { u = 0; v = 0; w = 1; }
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { const s = d2 / (d2 - d6); u = 1 - s; v = 0; w = s; }
          else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const s = (d4 - d3) / ((d4 - d3) + (d5 - d6)); u = 0; v = 1 - s; w = s; }
            else { const den = 1 / (va + vb + vc); v = vb * den; w = vc * den; u = 1 - v - w; }
          }
        }
      }
    }
  }
  const qx = ax + abx * v + acx * w, qy = ay + aby * v + acy * w, qz = az + abz * v + acz * w;
  res[0] = u; res[1] = v; res[2] = w; res[3] = (px - qx) ** 2 + (py - qy) ** 2 + (pz - qz) ** 2;
}

// 질감 쌍선형 표본 (u,v 0~1, 가로 반복)
function sample(img, u, v, out, o) {
  const w = img.w, h = img.h, d = img.d, ch = d.length / (w * h);
  const x = u * w - 0.5, y = v * h - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const cx = (q) => Math.min(w - 1, Math.max(0, q)), cy = (q) => Math.min(h - 1, Math.max(0, q));
  const i00 = (cy(y0) * w + cx(x0)) * ch, i10 = (cy(y0) * w + cx(x0 + 1)) * ch, i01 = (cy(y0 + 1) * w + cx(x0)) * ch, i11 = (cy(y0 + 1) * w + cx(x0 + 1)) * ch;
  for (let k = 0; k < 3; k++) out[o + k] = (d[i00 + k] * (1 - fx) + d[i10 + k] * fx) * (1 - fy) + (d[i01 + k] * (1 - fx) + d[i11 + k] * fx) * fy;
}

// ---------- 3) 옮겨 굽기 ----------
const R = BR, RR = R * R;
const outB = new Float32Array(RR * 3), outM = new Float32Array(RR * 3), outN = new Float32Array(RR * 3), cov = new Uint8Array(RR);
const lt = OI.length / 3; let miss = 0, far = 0, done = 0; const tmp = new Float64Array(3);
const maxD2 = (CS * 1.5) ** 2;
for (let t = 0; t < lt; t++) {
  const a = OI[3 * t], b = OI[3 * t + 1], c = OI[3 * t + 2];
  const pa = [op[3 * a], op[3 * a + 1], op[3 * a + 2]], pb = [op[3 * b], op[3 * b + 1], op[3 * b + 2]], pc = [op[3 * c], op[3 * c + 1], op[3 * c + 2]];
  const e1 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], e2 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
  let fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const fl = Math.hypot(fn[0], fn[1], fn[2]) || 1; fn = fn.map((q) => q / fl);
  const x0 = ou[2 * a] * R - 0.5, y0 = ou[2 * a + 1] * R - 0.5, x1 = ou[2 * b] * R - 0.5, y1 = ou[2 * b + 1] * R - 0.5, x2 = ou[2 * c] * R - 0.5, y2 = ou[2 * c + 1] * R - 0.5;
  const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (Math.abs(area) < 1e-12) continue;
  const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(R - 1, Math.ceil(Math.max(x0, x1, x2)));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(R - 1, Math.ceil(Math.max(y0, y1, y2)));
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const w0 = ((x1 - x) * (y2 - y) - (x2 - x) * (y1 - y)) / area, w1 = ((x2 - x) * (y0 - y) - (x0 - x) * (y2 - y)) / area, w2 = 1 - w0 - w1;
    if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
    const px = w0 * pa[0] + w1 * pb[0] + w2 * pc[0], py = w0 * pa[1] + w1 * pb[1] + w2 * pc[1], pz = w0 * pa[2] + w1 * pb[2] + w2 * pc[2];
    // 둘레 3x3x3 칸에서 가장 가까운 원본 삼각형(면 방향이 반대인 것은 뺀다 — 얇은 판의 뒷면을 잡지 않게)
    const gx = Math.floor((px - mn[0]) / CS), gy = Math.floor((py - mn[1]) / CS), gz = Math.floor((pz - mn[2]) / CS);
    let best = -1, bd = Infinity, bu = 0, bv = 0, bw = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const X = gx + dx, Y = gy + dy, Z = gz + dz; if (X < 0 || Y < 0 || Z < 0 || X >= GD[0] || Y >= GD[1] || Z >= GD[2]) continue;
      const ci = findCell((X * GD[1] + Y) * GD[2] + Z); if (ci < 0) continue;
      for (let s = CSt[ci]; s < CSt[ci + 1]; s++) {
        const tt = cellTris[s];
        if (FN[3 * tt] * fn[0] + FN[3 * tt + 1] * fn[1] + FN[3 * tt + 2] * fn[2] < 0.2) continue;
        closest(px, py, pz, tt); if (res[3] < bd) { bd = res[3]; best = tt; bu = res[0]; bv = res[1]; bw = res[2]; }
      }
    }
    const q = y * R + x;
    if (best < 0) { miss++; continue; }
    if (bd > maxD2) far++;
    const A = I[3 * best], B = I[3 * best + 1], C = I[3 * best + 2];
    const su = bu * UV[2 * A] + bv * UV[2 * B] + bw * UV[2 * C], sv = bu * UV[2 * A + 1] + bv * UV[2 * B + 1] + bw * UV[2 * C + 1];
    sample(SB, su, sv, outB, 3 * q); sample(SM, su, sv, outM, 3 * q);
    let nx = bu * N[3 * A] + bv * N[3 * B] + bw * N[3 * C], ny = bu * N[3 * A + 1] + bv * N[3 * B + 1] + bw * N[3 * C + 1], nz = bu * N[3 * A + 2] + bv * N[3 * B + 2] + bw * N[3 * C + 2];
    if (NSTR > 0) {
      // 원본 노멀 맵(접선 기준)을 원본 삼각형의 ∇u·∇v 틀로 섞는다(three.js 미분 접선틀과 같은 뜻, y 뒤집기)
      const ax = P[3 * A], ay = P[3 * A + 1], az = P[3 * A + 2];
      const E1 = [P[3 * B] - ax, P[3 * B + 1] - ay, P[3 * B + 2] - az], E2 = [P[3 * C] - ax, P[3 * C + 1] - ay, P[3 * C + 2] - az];
      const F = [E1[1] * E2[2] - E1[2] * E2[1], E1[2] * E2[0] - E1[0] * E2[2], E1[0] * E2[1] - E1[1] * E2[0]], F2 = F[0] ** 2 + F[1] ** 2 + F[2] ** 2;
      if (F2 > 0) {
        const du1 = UV[2 * B] - UV[2 * A], du2 = UV[2 * C] - UV[2 * A], dv1 = UV[2 * B + 1] - UV[2 * A + 1], dv2 = UV[2 * C + 1] - UV[2 * A + 1];
        const c2 = [F[1] * E2[2] - F[2] * E2[1], F[2] * E2[0] - F[0] * E2[2], F[0] * E2[1] - F[1] * E2[0]], c1 = [E1[1] * F[2] - E1[2] * F[1], E1[2] * F[0] - E1[0] * F[2], E1[0] * F[1] - E1[1] * F[0]];
        const nl = Math.hypot(nx, ny, nz) || 1, n = [nx / nl, ny / nl, nz / nl];
        let T = [0, 1, 2].map((k) => (du1 * c2[k] + du2 * c1[k]) / F2), Bt = [0, 1, 2].map((k) => (dv1 * c2[k] + dv2 * c1[k]) / F2);
        const tn = T[0] * n[0] + T[1] * n[1] + T[2] * n[2], bn = Bt[0] * n[0] + Bt[1] * n[1] + Bt[2] * n[2];
        T = T.map((q2, k) => q2 - n[k] * tn); Bt = Bt.map((q2, k) => q2 - n[k] * bn);
        const det = Math.max(T[0] ** 2 + T[1] ** 2 + T[2] ** 2, Bt[0] ** 2 + Bt[1] ** 2 + Bt[2] ** 2), s = det > 0 ? 1 / Math.sqrt(det) : 0;
        sample(SN, su, sv, tmp, 0);
        const mxn = (tmp[0] / 127.5 - 1) * NSTR, myn = -(tmp[1] / 127.5 - 1) * NSTR, mzn = tmp[2] / 127.5 - 1;
        nx = T[0] * s * mxn + Bt[0] * s * myn + n[0] * mzn; ny = T[1] * s * mxn + Bt[1] * s * myn + n[1] * mzn; nz = T[2] * s * mxn + Bt[2] * s * myn + n[2] * mzn;
      }
    }
    const l = Math.hypot(nx, ny, nz) || 1; outN[3 * q] = nx / l; outN[3 * q + 1] = ny / l; outN[3 * q + 2] = nz / l;
    cov[q] = 1; done++;
  }
  if (t % 30000 === 0 && t) log('굽는 중', t, '/', lt);
}
log('굽기 끝: 칸', done, '(', (done / RR * 100).toFixed(1) + '%) / 못 찾음', miss, '/ 멀리', far);

// ---------- 빈 칸 메우기(너비 우선, 끝까지) ----------
{
  const q = new Int32Array(RR); let h = 0, t = 0;
  for (let i = 0; i < RR; i++) if (cov[i]) q[t++] = i;
  while (h < t) {
    const i = q[h++], x = i % R, y = (i / R) | 0;
    const nb = [x > 0 ? i - 1 : -1, x < R - 1 ? i + 1 : -1, y > 0 ? i - R : -1, y < R - 1 ? i + R : -1];
    for (const j of nb) { if (j < 0 || cov[j]) continue; cov[j] = 1; for (let k = 0; k < 3; k++) { outB[3 * j + k] = outB[3 * i + k]; outM[3 * j + k] = outM[3 * i + k]; outN[3 * j + k] = outN[3 * i + k]; } q[t++] = j; }
  }
}
const CACHE = process.env.CACHE;
const toBuf = (f, enc) => { const b = Buffer.alloc(RR * 3); for (let i = 0; i < RR * 3; i++) b[i] = Math.max(0, Math.min(255, Math.round(enc(f[i])))); return b; };
const bBuf = toBuf(outB, (x) => x), mBuf = toBuf(outM, (x) => x), nBuf = toBuf(outN, (x) => (x * 0.5 + 0.5) * 255);
if (CACHE) { fs.writeFileSync(CACHE + '.b', bBuf); fs.writeFileSync(CACHE + '.m', mBuf); fs.writeFileSync(CACHE + '.n', nBuf); fs.writeFileSync(CACHE + '.geo', JSON.stringify({ R, op, ou, OI: Array.from(OI) })); }
const jpg = (b, res, q) => sharp(b, { raw: { width: R, height: R, channels: 3 } }).resize(res, res, { kernel: 'lanczos3' }).jpeg({ quality: q, chromaSubsampling: '4:4:4' }).toBuffer();
const baseImg = await jpg(bBuf, bOut, BQ), mrImg = await jpg(mBuf, mOut, MQ), nImg = await jpg(nBuf, nOut, NQ);
if (PREV) { for (const [n, b] of [['base', bBuf], ['mr', mBuf], ['normal', nBuf]]) await sharp(b, { raw: { width: R, height: R, channels: 3 } }).resize(1024).png().toFile(`${PREV}/bake_${n}.png`); }

// ---------- 4) 보통 GLB 로 쓰기 ----------
const out = new Document(); const buf = out.createBuffer();
const m = out.createMaterial('robot').setDoubleSided(true).setMetallicFactor(1).setRoughnessFactor(1)
  .setBaseColorTexture(out.createTexture('base').setImage(baseImg).setMimeType('image/jpeg'))
  .setMetallicRoughnessTexture(out.createTexture('mr').setImage(mrImg).setMimeType('image/jpeg'))
  .setNormalTexture(out.createTexture('normal-objectspace').setImage(nImg).setMimeType('image/jpeg'))
  .setExtras({ normalMapSpace: 'object' });
const mesh = out.createMesh('robot');
let start = 0, totalV = 0;
while (start < OI.length) {
  const loc = new Map(), cp = [], cu = [], ci = [];
  let i = start;
  for (; i < OI.length; i += 3) {
    let need = 0; for (let k = 0; k < 3; k++) if (!loc.has(OI[i + k])) need++;
    if (loc.size + need > 65535) break;
    for (let k = 0; k < 3; k++) { const v = OI[i + k]; let l = loc.get(v); if (l === undefined) { l = loc.size; loc.set(v, l); cp.push(op[3 * v], op[3 * v + 1], op[3 * v + 2]); cu.push(Math.round(Math.min(1, Math.max(0, ou[2 * v])) * 65535), Math.round(Math.min(1, Math.max(0, ou[2 * v + 1])) * 65535)); } ci.push(l); }
  }
  start = i; totalV += loc.size;
  const pos = out.createAccessor().setType('VEC3').setArray(new Float32Array(cp)).setBuffer(buf);
  const uv = out.createAccessor().setType('VEC2').setArray(new Uint16Array(cu)).setNormalized(true).setBuffer(buf);
  const idx = out.createAccessor().setType('SCALAR').setArray(new Uint16Array(ci)).setBuffer(buf);
  mesh.addPrimitive(out.createPrimitive().setAttribute('POSITION', pos).setAttribute('TEXCOORD_0', uv).setIndices(idx).setMaterial(m));
}
out.createScene().addChild(out.createNode('robot').setMesh(mesh));
await new NodeIO().write(output, out);
log('저장', output, (fs.statSync(output).size / 1e6).toFixed(3) + 'MB', '| 조각', mesh.listPrimitives().length, '점(겹침 포함)', totalV, '| 색', (baseImg.length / 1024).toFixed(0) + 'KB', 'mr', (mrImg.length / 1024).toFixed(0) + 'KB', '노멀', (nImg.length / 1024).toFixed(0) + 'KB');
