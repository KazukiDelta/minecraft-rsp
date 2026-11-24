import { RawImage, StampTransform, rawImageToCanvas, resizeNearestBuffer } from './canvasEngine';

// Cached spherical-to-equirectangular lookup tables keyed by `${outW}x${outH}x${eqW}x${eqH}`
const skyboxLutCache = new Map<string, Int32Array>();

function getSkyboxLut(outW: number, outH: number, eqW: number, eqH: number): Int32Array {
  const key = `${outW}x${outH}x${eqW}x${eqH}`;
  const cached = skyboxLutCache.get(key);
  if (cached) return cached;

  const lut = new Int32Array(outW * outH);
  const faceW = outW / 3;
  const faceH = outH / 2;
  const invTwoPi = 1 / (2 * Math.PI);
  const invPi = 1 / Math.PI;

  type FaceDef = { col: number; row: number; dir: (a: number, b: number) => [number, number, number] };
  const faces: FaceDef[] = [
    // Exact match with CSS 3D Skybox faces (Y-up: +X East, +Y Top, -Z North, +Z South)
    { col: 0, row: 0, dir: (a, b) => [a, -1, b] },   // Bottom
    { col: 1, row: 0, dir: (a, b) => [a, 1, -b] },   // Top
    { col: 2, row: 0, dir: (a, b) => [-a, -b, 1] },  // South
    { col: 0, row: 1, dir: (a, b) => [-1, -b, -a] }, // West
    { col: 1, row: 1, dir: (a, b) => [a, -b, -1] },  // North
    { col: 2, row: 1, dir: (a, b) => [1, -b, a] },   // East
  ];

  for (const face of faces) {
    const ox = Math.round(face.col * faceW);
    const oy = Math.round(face.row * faceH);
    const fw = Math.round(faceW);
    const fh = Math.round(faceH);

    for (let y = 0; y < fh; y++) {
      const py = oy + y;
      if (py >= outH) continue;
      const b = ((y + 0.5) / fh) * 2 - 1;
      for (let x = 0; x < fw; x++) {
        const px = ox + x;
        if (px >= outW) continue;
        const a = ((x + 0.5) / fw) * 2 - 1;
        const [dx, dy, dz] = face.dir(a, b);
        const len = Math.hypot(dx, dy, dz);
        const nx = dx / len;
        const ny = dy / len;
        const nz = dz / len;

        const lon = Math.atan2(nx, nz);
        const lat = Math.asin(Math.max(-1, Math.min(1, ny)));
        const u = 0.5 + lon * invTwoPi;
        const v = 0.5 - lat * invPi;

        const sx = Math.floor((((u % 1) + 1) % 1) * (eqW - 1));
        const sy = Math.floor(Math.max(0, Math.min(1, v)) * (eqH - 1));
        lut[py * outW + px] = (sy * eqW + sx) * 4;
      }
    }
  }

  if (skyboxLutCache.size > 6) {
    const firstKey = skyboxLutCache.keys().next().value;
    if (firstKey) skyboxLutCache.delete(firstKey);
  }
  skyboxLutCache.set(key, lut);
  return lut;
}

/**
 * Projects an equirectangular (360° / wide panorama) image into a seamless
 * OptiFine / Skyboxify 3x2 Cubemap Skybox texture (width = 3 * faceSize, height = 2 * faceSize).
 */
export function equirectangularToOptifineSkybox(
  src: RawImage,
  faceSize: number = 512
): RawImage {
  const outW = faceSize * 3;
  const outH = faceSize * 2;
  const lut = getSkyboxLut(outW, outH, src.width, src.height);
  const sData = src.data;
  const out = new Uint8ClampedArray(outW * outH * 4);

  for (let p = 0; p < lut.length; p++) {
    const sIdx = lut[p];
    const dIdx = p * 4;
    out[dIdx] = sData[sIdx];
    out[dIdx + 1] = sData[sIdx + 1];
    out[dIdx + 2] = sData[sIdx + 2];
    out[dIdx + 3] = 255;
  }

  return { width: outW, height: outH, data: out };
}

/**
 * Fast, LUT-accelerated 3x2 skybox stamp compositor.
 */
export function compositeStampOnSkybox3x2(
  baseSkybox: RawImage,
  stamp: RawImage,
  transform: StampTransform,
  fastPreview: boolean = false
): RawImage {
  const previewMaxW = 960;
  const targetBase =
    fastPreview && baseSkybox.width > previewMaxW
      ? resizeNearestBuffer(
        baseSkybox,
        previewMaxW,
        Math.max(2, Math.round((baseSkybox.height / baseSkybox.width) * previewMaxW))
      )
      : baseSkybox;

  const outW = targetBase.width;
  const outH = targetBase.height;
  const ratioX = outW / baseSkybox.width;
  const ratioY = outH / baseSkybox.height;

  const eqW = fastPreview
    ? Math.max(512, Math.min(1024, outW))
    : Math.max(512, Math.min(2048, outW));
  const eqH = Math.max(256, Math.round(eqW / 2));

  const eqCanvas = document.createElement('canvas');
  eqCanvas.width = eqW;
  eqCanvas.height = eqH;
  const ectx = eqCanvas.getContext('2d')!;
  ectx.imageSmoothingEnabled = true;
  ectx.imageSmoothingQuality = fastPreview ? 'low' : 'high';

  const stampCanvas = rawImageToCanvas(stamp);
  const scaleX = eqW / outW;
  const scaleY = eqH / outH;

  ectx.save();
  ectx.translate(transform.x * ratioX * scaleX, transform.y * ratioY * scaleY);
  ectx.rotate((transform.rotation * Math.PI) / 180);
  const s = transform.scale * Math.min(ratioX, ratioY) * Math.min(scaleX, scaleY);
  ectx.scale(transform.flipX ? -s : s, s);
  ectx.globalAlpha = Math.max(0, Math.min(1, transform.opacity));
  ectx.drawImage(stampCanvas, -stamp.width / 2, -stamp.height / 2);
  ectx.restore();

  const eqData = ectx.getImageData(0, 0, eqW, eqH).data;
  const lut = getSkyboxLut(outW, outH, eqW, eqH);
  const out = new Uint8ClampedArray(targetBase.data);

  for (let p = 0; p < lut.length; p++) {
    const sIdx = lut[p];
    const sa = eqData[sIdx + 3];
    if (sa === 0) continue;

    const dIdx = p * 4;
    if (sa === 255) {
      out[dIdx] = eqData[sIdx];
      out[dIdx + 1] = eqData[sIdx + 1];
      out[dIdx + 2] = eqData[sIdx + 2];
      out[dIdx + 3] = 255;
    } else {
      const alpha = sa / 255;
      const invAlpha = 1 - alpha;
      out[dIdx] = (eqData[sIdx] * alpha + out[dIdx] * invAlpha) | 0;
      out[dIdx + 1] = (eqData[sIdx + 1] * alpha + out[dIdx + 1] * invAlpha) | 0;
      out[dIdx + 2] = (eqData[sIdx + 2] * alpha + out[dIdx + 2] * invAlpha) | 0;
      out[dIdx + 3] = Math.min(255, (sa + out[dIdx + 3] * invAlpha) | 0);
    }
  }

  return { width: outW, height: outH, data: out };
}

export interface Skybox3DPlacement {
  yawDeg: number;
  pitchDeg: number;
  angularSizeDeg: number;
  rotationDeg: number;
  opacity: number;
  flipX: boolean;
}

/**
 * Projects a 2D character/stamp PNG onto a 3x2 OptiFine/Skyboxify skybox using
 * true 3D tangent-plane (gnomonic) projection at a chosen 3D sky direction (yaw, pitch).
 */
export function projectStampOntoSkybox3D(
  baseSkybox: RawImage,
  stamp: RawImage,
  placement: Skybox3DPlacement
): RawImage {
  const outW = baseSkybox.width;
  const outH = baseSkybox.height;
  const faceW = outW / 3;
  const faceH = outH / 2;

  const yaw = (placement.yawDeg * Math.PI) / 180;
  const pitch = (placement.pitchDeg * Math.PI) / 180;
  const roll = (placement.rotationDeg * Math.PI) / 180;

  const cosP = Math.cos(pitch);
  const fx = Math.sin(yaw) * cosP;
  const fy = Math.sin(pitch);
  const fz = -Math.cos(yaw) * cosP;

  let rx = -fz;
  let ry = 0;
  let rz = fx;
  const rLen = Math.hypot(rx, ry, rz) || 1;
  rx /= rLen;
  rz /= rLen;

  let ux = ry * fz - rz * fy;
  let uy = rz * fx - rx * fz;
  let uz = rx * fy - ry * fx;

  if (roll !== 0) {
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    const nrx = rx * cr + ux * sr;
    const nry = ry * cr + uy * sr;
    const nrz = rz * cr + uz * sr;
    const nux = -rx * sr + ux * cr;
    const nuy = -ry * sr + uy * cr;
    const nuz = -rz * sr + uz * cr;
    rx = nrx;
    ry = nry;
    rz = nrz;
    ux = nux;
    uy = nuy;
    uz = nuz;
  }

  const halfTan = Math.tan(((placement.angularSizeDeg * Math.PI) / 180) / 2);
  const aspect = stamp.width / Math.max(1, stamp.height);
  const halfTanW = aspect >= 1 ? halfTan : halfTan * aspect;
  const halfTanH = aspect >= 1 ? halfTan / aspect : halfTan;

  const sw = stamp.width;
  const sh = stamp.height;
  const sData = stamp.data;
  const out = new Uint8ClampedArray(baseSkybox.data);

  type FaceDef = { col: number; row: number; dir: (a: number, b: number) => [number, number, number] };
  const faces: FaceDef[] = [
    // Exact match with CSS 3D Skybox faces (Y-up: +X East, +Y Top, -Z North, +Z South)
    { col: 0, row: 0, dir: (a, b) => [a, -1, b] },   // Bottom
    { col: 1, row: 0, dir: (a, b) => [a, 1, -b] },   // Top
    { col: 2, row: 0, dir: (a, b) => [-a, -b, 1] },  // South
    { col: 0, row: 1, dir: (a, b) => [-1, -b, -a] }, // West
    { col: 1, row: 1, dir: (a, b) => [a, -b, -1] },  // North
    { col: 2, row: 1, dir: (a, b) => [1, -b, a] },   // East
  ];

  const op = Math.max(0, Math.min(1, placement.opacity));

  for (const face of faces) {
    const ox = Math.round(face.col * faceW);
    const oy = Math.round(face.row * faceH);
    const fw = Math.round(faceW);
    const fh = Math.round(faceH);

    for (let y = 0; y < fh; y++) {
      const py = oy + y;
      if (py >= outH) continue;
      const b = ((y + 0.5) / fh) * 2 - 1;

      for (let x = 0; x < fw; x++) {
        const px = ox + x;
        if (px >= outW) continue;
        const a = ((x + 0.5) / fw) * 2 - 1;

        const [dx, dy, dz] = face.dir(a, b);
        const dotF = dx * fx + dy * fy + dz * fz;
        if (dotF <= 0.05) continue;

        const dotR = dx * rx + dy * ry + dz * rz;
        const dotU = dx * ux + dy * uy + dz * uz;

        const pu = dotR / (dotF * halfTanW);
        const pv = -dotU / (dotF * halfTanH);
        if (pu < -1 || pu > 1 || pv < -1 || pv > 1) continue;

        const uNorm = placement.flipX ? 0.5 - pu * 0.5 : 0.5 + pu * 0.5;
        const vNorm = 0.5 + pv * 0.5;
        const sx = Math.min(sw - 1, Math.max(0, Math.floor(uNorm * sw)));
        const sy = Math.min(sh - 1, Math.max(0, Math.floor(vNorm * sh)));

        const sIdx = (sy * sw + sx) * 4;
        const sa = sData[sIdx + 3];
        if (sa === 0) continue;

        const alpha = (sa / 255) * op;
        const invAlpha = 1 - alpha;
        const dIdx = (py * outW + px) * 4;
        out[dIdx] = (sData[sIdx] * alpha + out[dIdx] * invAlpha) | 0;
        out[dIdx + 1] = (sData[sIdx + 1] * alpha + out[dIdx + 1] * invAlpha) | 0;
        out[dIdx + 2] = (sData[sIdx + 2] * alpha + out[dIdx + 2] * invAlpha) | 0;
        out[dIdx + 3] = Math.min(255, (sa * op + out[dIdx + 3] * invAlpha) | 0);
      }
    }
  }

  return { width: outW, height: outH, data: out };
}
