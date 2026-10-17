// 저장해 둔 굽기 결과로 GLB 만 다시 쓴다(질감 해상도·품질 시험용). 사용: node encode.mjs <캐시> <출력> <노멀 해상도> <노멀 q> <색 해상도> <색 q> <mr 해상도> <mr q> [노멀 형식 jpg|png]
import { NodeIO, Document } from '@gltf-transform/core'; import sharp from 'sharp'; import fs from 'fs';
const [, , C, output, nO, nQ, bO, bQ, mO, mQ, nFmt] = process.argv;
const g = JSON.parse(fs.readFileSync(C + '.geo', 'utf8')); const R = g.R, op = g.op, ou = g.ou, OI = g.OI;
const enc = (f, res, q, fmt) => { const s = sharp(fs.readFileSync(f), { raw: { width: R, height: R, channels: 3 } }).resize(+res, +res, { kernel: 'lanczos3' }); return fmt === 'png' ? s.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer() : s.jpeg({ quality: +q, chromaSubsampling: '4:4:4', mozjpeg: process.env.MOZ === '1' }).toBuffer(); };
const baseImg = await enc(C + '.b', bO, bQ), mrImg = await enc(C + '.m', mO, mQ), nImg = await enc(C + '.n', nO, nQ, nFmt);
const mime = (f) => f === 'png' ? 'image/png' : 'image/jpeg';
const out = new Document(); const buf = out.createBuffer();
const m = out.createMaterial('robot').setDoubleSided(true).setMetallicFactor(1).setRoughnessFactor(1)
  .setBaseColorTexture(out.createTexture('base').setImage(baseImg).setMimeType('image/jpeg'))
  .setMetallicRoughnessTexture(out.createTexture('mr').setImage(mrImg).setMimeType('image/jpeg'))
  .setNormalTexture(out.createTexture('normal-objectspace').setImage(nImg).setMimeType(mime(nFmt)))
  .setExtras({ normalMapSpace: 'object' });
const mesh = out.createMesh('robot'); let start = 0, totalV = 0;
while (start < OI.length) {
  const loc = new Map(), cp = [], cu = [], ci = []; let i = start;
  for (; i < OI.length; i += 3) {
    let need = 0; for (let k = 0; k < 3; k++) if (!loc.has(OI[i + k])) need++;
    if (loc.size + need > 65535) break;
    for (let k = 0; k < 3; k++) { const v = OI[i + k]; let l = loc.get(v); if (l === undefined) { l = loc.size; loc.set(v, l); cp.push(op[3 * v], op[3 * v + 1], op[3 * v + 2]); cu.push(Math.round(Math.min(1, Math.max(0, ou[2 * v])) * 65535), Math.round(Math.min(1, Math.max(0, ou[2 * v + 1])) * 65535)); } ci.push(l); }
  }
  start = i; totalV += loc.size;
  mesh.addPrimitive(out.createPrimitive()
    .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(new Float32Array(cp)).setBuffer(buf))
    .setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(new Uint16Array(cu)).setNormalized(true).setBuffer(buf))
    .setIndices(out.createAccessor().setType('SCALAR').setArray(new Uint16Array(ci)).setBuffer(buf)).setMaterial(m));
}
out.createScene().addChild(out.createNode('robot').setMesh(mesh));
await new NodeIO().write(output, out);
console.log(output.split(/[\/]/).pop(), (fs.statSync(output).size / 1e6).toFixed(3) + 'MB', '| 색', (baseImg.length / 1024).toFixed(0) + 'KB', 'mr', (mrImg.length / 1024).toFixed(0) + 'KB', '노멀', (nImg.length / 1024).toFixed(0) + 'KB', '| 삼각형', OI.length / 3);
