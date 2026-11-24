export interface RawImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface StampTransform {
  /** Center X in target canvas pixels */
  x: number;
  /** Center Y in target canvas pixels */
  y: number;
  /** Scale multiplier relative to stamp natural size */
  scale: number;
  /** Rotation in degrees */
  rotation: number;
  /** Opacity 0..1 */
  opacity: number;
  flipX: boolean;
  /** Clip stamp alpha to base texture alpha so transparent outside stays transparent */
  maskToBaseAlpha: boolean;
  /** Keep GUI slot borders, dark bevels, and slot grids crisp above the stamped art */
  protectGuiSlots: boolean;
  /** Warp stamp onto 3x2 skybox cubemap faces so it looks undistorted in-game */
  skyboxWarp?: boolean;
  /** Seamlessly split stamp across Minecraft Bed top UV (Head 6,6,16,16 + Foot 6,28,16,16) */
  bedTopSplit?: boolean;
}

export function cloneRawImage(img: RawImage): RawImage {
  return {
    width: img.width,
    height: img.height,
    data: new Uint8ClampedArray(img.data),
  };
}

/**
 * Snaps semi-transparent anti-aliased edges to pure opaque (255) or pure transparent (0).
 * Fixes Minecraft's 3D item extruder glitchy/flickering translucent side edges on HD items.
 */
export function cleanItemAlphaCutout(src: RawImage, threshold: number = 128): RawImage {
  const out = new Uint8ClampedArray(src.data);
  for (let i = 3; i < out.length; i += 4) {
    out[i] = out[i] >= threshold ? 255 : 0;
  }
  return { width: src.width, height: src.height, data: out };
}

/**
 * Pure nearest-neighbor upscaler/resizer supporting high resolutions (e.g. 2048x2048 or 4096x4096).
 */
export function upscaleNearestBuffer(src: RawImage, scale: number): RawImage {
  const targetW = Math.max(1, Math.round(src.width * scale));
  const targetH = Math.max(1, Math.round(src.height * scale));
  return resizeNearestBuffer(src, targetW, targetH);
}

export function resizeNearestBuffer(src: RawImage, targetW: number, targetH: number): RawImage {
  const w = Math.max(1, Math.round(targetW));
  const h = Math.max(1, Math.round(targetH));
  const out = new Uint8ClampedArray(w * h * 4);
  const srcData = src.data;
  const sw = src.width;
  const sh = src.height;

  for (let y = 0; y < h; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / w));
      const sIdx = (sy * sw + sx) * 4;
      const dIdx = (y * w + x) * 4;
      out[dIdx] = srcData[sIdx];
      out[dIdx + 1] = srcData[sIdx + 1];
      out[dIdx + 2] = srcData[sIdx + 2];
      out[dIdx + 3] = srcData[sIdx + 3];
    }
  }

  return { width: w, height: h, data: out };
}

/**
 * Edge-seeded BFS flood-fill background remover.
 * Removes outer connected background pixels without erasing enclosed interior white/similar details.
 */
export function removeBackgroundFloodFillBuffer(
  src: RawImage,
  tolerance: number = 22,
  mode: 'white' | 'corner' = 'corner'
): RawImage {
  const w = src.width;
  const h = src.height;
  const out = new Uint8ClampedArray(src.data);
  const visited = new Uint8Array(w * h);

  // Determine reference background color
  let refR = 255;
  let refG = 255;
  let refB = 255;
  if (mode === 'corner' && w > 0 && h > 0) {
    refR = out[0];
    refG = out[1];
    refB = out[2];
  }

  const matchesBg = (idx4: number): boolean => {
    const a = out[idx4 + 3];
    if (a === 0) return true;
    const r = out[idx4];
    const g = out[idx4 + 1];
    const b = out[idx4 + 2];
    if (mode === 'white') {
      const minVal = 255 - tolerance;
      return r >= minVal && g >= minVal && b >= minVal;
    }
    return (
      Math.abs(r - refR) <= tolerance &&
      Math.abs(g - refG) <= tolerance &&
      Math.abs(b - refB) <= tolerance
    );
  };

  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  const trySeed = (x: number, y: number) => {
    const p = y * w + x;
    if (!visited[p] && matchesBg(p * 4)) {
      visited[p] = 1;
      queue[tail++] = p;
    }
  };

  for (let x = 0; x < w; x++) {
    trySeed(x, 0);
    trySeed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    trySeed(0, y);
    trySeed(w - 1, y);
  }

  while (head < tail) {
    const p = queue[head++];
    out[p * 4 + 3] = 0;
    const x = p % w;
    const y = (p - x) / w;

    if (x + 1 < w) trySeed(x + 1, y);
    if (x - 1 >= 0) trySeed(x - 1, y);
    if (y + 1 < h) trySeed(x, y + 1);
    if (y - 1 >= 0) trySeed(x, y - 1);
  }

  return { width: w, height: h, data: out };
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full || 'ffffff', 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Tints neutral light-gray Minecraft GUI panel surfaces (#C6C6C6 range)
 * while leaving dark borders, shadows, and transparent pixels untouched.
 */
export function applyPanelTintBuffer(
  src: RawImage,
  hexColor: string,
  strength: number
): RawImage {
  const [tr, tg, tb] = hexToRgb(hexColor);
  const s = Math.max(0, Math.min(1, strength));
  const out = new Uint8ClampedArray(src.data);

  for (let i = 0; i < out.length; i += 4) {
    const a = out[i + 3];
    if (a === 0) continue;
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];

    const isNeutralGray = Math.abs(r - g) <= 12 && Math.abs(g - b) <= 12;
    if (isNeutralGray && r >= 160 && r <= 230) {
      // Blend proportionally to brightness relative to #C6C6C6 (198)
      const factor = r / 198;
      const targetR = Math.min(255, tr * factor);
      const targetG = Math.min(255, tg * factor);
      const targetB = Math.min(255, tb * factor);
      out[i] = Math.round(r + (targetR - r) * s);
      out[i + 1] = Math.round(g + (targetG - g) * s);
      out[i + 2] = Math.round(b + (targetB - b) * s);
    }
  }

  return { width: src.width, height: src.height, data: out };
}

/**
 * Applies post-compositing GUI slot & border protection by restoring dark GUI frames,
 * slot shadows (#373737), highlights, and partial slot interiors (#8B8B8B) from the base GUI.
 */
export function restoreGuiSlotsOverlay(composited: RawImage, baseGui: RawImage): RawImage {
  if (composited.width !== baseGui.width || composited.height !== baseGui.height) {
    return composited;
  }
  const out = new Uint8ClampedArray(composited.data);
  const base = baseGui.data;

  for (let i = 0; i < out.length; i += 4) {
    const ba = base[i + 3];
    if (ba === 0) continue;
    const br = base[i];
    const bg = base[i + 1];
    const bb = base[i + 2];

    const maxDiff = Math.max(Math.abs(br - bg), Math.abs(bg - bb), Math.abs(br - bb));
    // Dark window borders, text icons, slot top/left shadow (#373737 = 55), black preview box
    if (br <= 95 && bg <= 95 && bb <= 95) {
      out[i] = br;
      out[i + 1] = bg;
      out[i + 2] = bb;
      out[i + 3] = ba;
    } else if (maxDiff <= 8 && br >= 125 && br <= 152) {
      // Standard Minecraft slot interior (#8B8B8B = 139): keep slot clearly visible (60% slot, 40% art)
      out[i] = Math.round(out[i] * 0.4 + br * 0.6);
      out[i + 1] = Math.round(out[i + 1] * 0.4 + bg * 0.6);
      out[i + 2] = Math.round(out[i + 2] * 0.4 + bb * 0.6);
    } else if (br >= 248 && bg >= 248 && bb >= 248) {
      // Pure white slot bottom/right highlight bevel (#FFFFFF): keep crisp at 75%
      out[i] = Math.round(out[i] * 0.25 + 255 * 0.75);
      out[i + 1] = Math.round(out[i + 1] * 0.25 + 255 * 0.75);
      out[i + 2] = Math.round(out[i + 2] * 0.25 + 255 * 0.75);
    }
  }

  return { width: composited.width, height: composited.height, data: out };
}

// --- Browser Canvas Helpers ---

const rawToCanvasCache = new WeakMap<RawImage, HTMLCanvasElement>();

export function rawImageToCanvas(raw: RawImage): HTMLCanvasElement {
  const cached = rawToCanvasCache.get(raw);
  if (cached && cached.width === raw.width && cached.height === raw.height) {
    return cached;
  }
  const canvas = document.createElement('canvas');
  canvas.width = raw.width;
  canvas.height = raw.height;
  const ctx = canvas.getContext('2d')!;
  const imgData = new ImageData(new Uint8ClampedArray(raw.data), raw.width, raw.height);
  ctx.putImageData(imgData, 0, 0);
  rawToCanvasCache.set(raw, canvas);
  return canvas;
}

export function canvasToRawImage(canvas: HTMLCanvasElement): RawImage {
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    width: canvas.width,
    height: canvas.height,
    data: new Uint8ClampedArray(imgData.data),
  };
}

export async function loadUrlToRawImage(url: string): Promise<RawImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(canvasToRawImage(canvas));
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

export async function fileToRawImage(file: File | Blob): Promise<RawImage> {
  const url = URL.createObjectURL(file);
  try {
    return await loadUrlToRawImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function rawImageToPngBlob(raw: RawImage): Promise<Blob> {
  const canvas = rawImageToCanvas(raw);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode PNG'));
    }, 'image/png');
  });
}

/**
 * Composites an image stamp onto a base RawImage using HTML5 Canvas high-quality interpolation
 * for the stamp while preserving exact pixel masking & optional GUI slot protection.
 */
export function compositeStampOnRaw(
  base: RawImage,
  stamp: RawImage,
  transform: StampTransform
): RawImage {
  const baseCanvas = rawImageToCanvas(base);
  const stampCanvas = rawImageToCanvas(stamp);

  const work = document.createElement('canvas');
  work.width = base.width;
  work.height = base.height;
  const ctx = work.getContext('2d')!;

  ctx.drawImage(baseCanvas, 0, 0);

  // Render stamp on a separate layer first so we can clip to base alpha if requested
  const stampLayer = document.createElement('canvas');
  stampLayer.width = base.width;
  stampLayer.height = base.height;
  const sctx = stampLayer.getContext('2d')!;
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';

  sctx.save();
  sctx.translate(transform.x, transform.y);
  sctx.rotate((transform.rotation * Math.PI) / 180);
  sctx.scale(transform.flipX ? -transform.scale : transform.scale, transform.scale);
  sctx.globalAlpha = Math.max(0, Math.min(1, transform.opacity));
  sctx.drawImage(stampCanvas, -stamp.width / 2, -stamp.height / 2);
  sctx.restore();

  if (transform.maskToBaseAlpha) {
    sctx.globalCompositeOperation = 'destination-in';
    sctx.drawImage(baseCanvas, 0, 0);
    sctx.globalCompositeOperation = 'source-over';
  }

  ctx.drawImage(stampLayer, 0, 0);
  let result = canvasToRawImage(work);

  if (transform.protectGuiSlots) {
    result = restoreGuiSlotsOverlay(result, base);
  }

  return result;
}

/**
 * Seamlessly stamps a character/blanket image across the 2 separate top UV rectangles
 * of a Minecraft Bed texture (64x64 base UV, scaled proportionally for HD upscaled beds):
 * - Head top: (6, 6, 16, 16)
 * - Foot top: (6, 28, 16, 16)
 * Skips the 6px UV gap between y=22..27 so the character spans the full 1x2 bed seamlessly!
 */
export function compositeStampOnBedTop(
  base: RawImage,
  stamp: RawImage,
  transform: StampTransform
): RawImage {
  const scaleU = base.width / 64;
  const scaleV = base.height / 64;

  const bedW = Math.max(1, Math.round(16 * scaleU));
  const halfH = Math.max(1, Math.round(16 * scaleV));
  const fullH = halfH * 2;

  // Render the stamp onto a unified 16x32 (scaled) virtual bed-top canvas
  const virtualBed = document.createElement('canvas');
  virtualBed.width = bedW;
  virtualBed.height = fullH;
  const vctx = virtualBed.getContext('2d')!;
  vctx.imageSmoothingEnabled = true;
  vctx.imageSmoothingQuality = 'high';

  const stampCanvas = rawImageToCanvas(stamp);

  // Map transform offset relative to bed center
  const headX = Math.round(6 * scaleU);
  const headY = Math.round(6 * scaleV);
  const footY = Math.round(28 * scaleV);
  const offsetX = transform.x - (headX + bedW / 2);
  const offsetY = transform.y - (headY + fullH / 2);

  vctx.save();
  vctx.translate(bedW / 2 + offsetX, fullH / 2 + offsetY);
  vctx.rotate((transform.rotation * Math.PI) / 180);
  vctx.scale(transform.flipX ? -transform.scale : transform.scale, transform.scale);
  vctx.globalAlpha = Math.max(0, Math.min(1, transform.opacity));
  vctx.drawImage(stampCanvas, -stamp.width / 2, -stamp.height / 2);
  vctx.restore();

  // Composite top half -> Head UV (6,6,16,16) and bottom half -> Foot UV (6,28,16,16)
  const outCanvas = rawImageToCanvas(base);
  const octx = outCanvas.getContext('2d')!;
  octx.drawImage(virtualBed, 0, 0, bedW, halfH, headX, headY, bedW, halfH);
  octx.drawImage(virtualBed, 0, halfH, bedW, halfH, headX, footY, bedW, halfH);

  return canvasToRawImage(outCanvas);
}

/**
 * For Minecraft 26.3 separate bed-top block textures (`*_bed_head_up.png` & `*_bed_foot_up.png`):
 * Renders the stamp onto a unified 1x2 canvas (W x 2H) and returns both halves composited
 * cleanly onto `headBase` and `footBase` (auto-upscaling the sibling to match resolution).
 */
export function compositeStampOnTwoBedFiles(
  headBase: RawImage,
  footBase: RawImage,
  stamp: RawImage,
  transform: StampTransform,
  activeIsHead: boolean
): { head: RawImage; foot: RawImage } {
  const w = activeIsHead ? headBase.width : footBase.width;
  const h = activeIsHead ? headBase.height : footBase.height;
  const normHead = headBase.width === w && headBase.height === h ? headBase : resizeNearestBuffer(headBase, w, h);
  const normFoot = footBase.width === w && footBase.height === h ? footBase : resizeNearestBuffer(footBase, w, h);

  const virtualBed = document.createElement('canvas');
  virtualBed.width = w;
  virtualBed.height = h * 2;
  const vctx = virtualBed.getContext('2d')!;
  vctx.imageSmoothingEnabled = true;
  vctx.imageSmoothingQuality = 'high';

  // Draw head on top half and foot on bottom half
  vctx.drawImage(rawImageToCanvas(normHead), 0, 0);
  vctx.drawImage(rawImageToCanvas(normFoot), 0, h);

  const stampCanvas = rawImageToCanvas(stamp);
  const yOffset = activeIsHead ? 0 : h;
  vctx.save();
  vctx.translate(transform.x, transform.y + yOffset);
  vctx.rotate((transform.rotation * Math.PI) / 180);
  vctx.scale(transform.flipX ? -transform.scale : transform.scale, transform.scale);
  vctx.globalAlpha = Math.max(0, Math.min(1, transform.opacity));
  vctx.drawImage(stampCanvas, -stamp.width / 2, -stamp.height / 2);
  vctx.restore();

  const headCanvas = document.createElement('canvas');
  headCanvas.width = w;
  headCanvas.height = h;
  headCanvas.getContext('2d')!.drawImage(virtualBed, 0, 0, w, h, 0, 0, w, h);

  const footCanvas = document.createElement('canvas');
  footCanvas.width = w;
  footCanvas.height = h;
  footCanvas.getContext('2d')!.drawImage(virtualBed, 0, h, w, h, 0, 0, w, h);

  return {
    head: canvasToRawImage(headCanvas),
    foot: canvasToRawImage(footCanvas),
  };
}

/**
 * Detects the bounding box of non-transparent pixels in a RawImage (useful for fitting a stamp to a GUI panel,
 * e.g. 176x166 inside a 256x256 GUI texture).
 */
export function getOpaqueBounds(raw: RawImage): { x: number; y: number; width: number; height: number } {
  let minX = raw.width;
  let minY = raw.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < raw.height; y++) {
    for (let x = 0; x < raw.width; x++) {
      if (raw.data[(y * raw.width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width: raw.width, height: raw.height };
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}
