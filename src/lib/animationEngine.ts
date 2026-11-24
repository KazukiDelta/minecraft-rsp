import {
  RawImage,
  StampTransform,
  canvasToRawImage,
  compositeStampOnRaw,
  fileToRawImage,
  getOpaqueBounds,
  rawImageToPngBlob,
  removeBackgroundFloodFillBuffer,
} from './canvasEngine';

export interface AnimationSettings {
  /** Ticks per frame (20 ticks = 1 second). Default: 2 (10 FPS) */
  frametime: number;
  /** Smoothly blend between consecutive frames */
  interpolate: boolean;
}

export function buildAnimationMcmetaJson(settings: AnimationSettings): string {
  return JSON.stringify(
    {
      animation: {
        frametime: Math.max(1, Math.round(settings.frametime)),
        interpolate: settings.interpolate,
      },
    },
    null,
    2
  );
}

export function parseAnimationMcmetaBytes(bytes: Uint8Array | undefined): AnimationSettings | null {
  if (!bytes) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as {
      animation?: { frametime?: number; interpolate?: boolean };
    };
    if (!parsed.animation) return null;
    return {
      frametime: Number(parsed.animation.frametime) || 2,
      interpolate: Boolean(parsed.animation.interpolate),
    };
  } catch {
    return null;
  }
}

/**
 * Combines multiple frame RawImages into a Minecraft-standard vertical sprite sheet
 * of size (frameSize x (frameSize * frames.length)).
 */
export function buildVerticalSpriteSheet(
  frames: RawImage[],
  frameSize: number,
  options?: { removeBg?: boolean; tolerance?: number; mode?: 'corner' | 'white' }
): RawImage {
  const count = frames.length;
  const w = Math.max(16, Math.round(frameSize));
  const h = w * count;

  const sheet = document.createElement('canvas');
  sheet.width = w;
  sheet.height = h;
  const ctx = sheet.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  for (let i = 0; i < count; i++) {
    const src = options?.removeBg
      ? removeBackgroundFloodFillBuffer(frames[i], options.tolerance ?? 24, options.mode ?? 'corner')
      : frames[i];

    const tmp = document.createElement('canvas');
    tmp.width = src.width;
    tmp.height = src.height;
    tmp.getContext('2d')!.putImageData(
      new ImageData(new Uint8ClampedArray(src.data), src.width, src.height),
      0,
      0
    );

    // Fit centered inside square frame (w x w) preserving aspect ratio
    const scale = Math.min(w / src.width, w / src.height);
    const dw = src.width * scale;
    const dh = src.height * scale;
    const dx = (w - dw) / 2;
    const dy = i * w + (w - dh) / 2;
    ctx.drawImage(tmp, dx, dy, dw, dh);
  }

  const outData = ctx.getImageData(0, 0, w, h);
  return {
    width: w,
    height: h,
    data: new Uint8ClampedArray(outData.data),
  };
}

/**
 * Extracts frames from animated .webp / .gif (via browser ImageDecoder)
 * or .webm / .mp4 videos (via offscreen <video> seeking), or falls back to a single image.
 */
export async function extractFramesFromMediaFile(
  file: File,
  maxFrames: number = 48,
  sampleFps: number = 10
): Promise<RawImage[]> {
  const lower = file.name.toLowerCase();
  const isVideo = file.type.startsWith('video/') || lower.endsWith('.webm') || lower.endsWith('.mp4');

  if (isVideo) {
    return await extractFramesFromVideo(file, maxFrames, sampleFps);
  }

  const isAnimatedImg =
    lower.endsWith('.webp') ||
    lower.endsWith('.gif') ||
    file.type === 'image/webp' ||
    file.type === 'image/gif';

  if (isAnimatedImg && 'ImageDecoder' in window) {
    try {
      const ImageDecoderCtor = (window as unknown as {
        ImageDecoder: new (init: { data: BufferSource; type: string }) => {
          tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } | null };
          decode: (opts: { frameIndex: number }) => Promise<{ image: VideoFrame }>;
          close: () => void;
        };
      }).ImageDecoder;

      const mime = file.type || (lower.endsWith('.webp') ? 'image/webp' : 'image/gif');
      const decoder = new ImageDecoderCtor({ data: await file.arrayBuffer(), type: mime });
      await decoder.tracks.ready;
      const total = decoder.tracks.selectedTrack?.frameCount ?? 1;

      if (total > 1) {
        const frames: RawImage[] = [];
        const step = Math.max(1, Math.ceil(total / maxFrames));
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        for (let i = 0; i < total && frames.length < maxFrames; i += step) {
          const { image } = await decoder.decode({ frameIndex: i });
          canvas.width = image.displayWidth;
          canvas.height = image.displayHeight;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0);
          frames.push(canvasToRawImage(canvas));
          image.close();
        }
        decoder.close();
        if (frames.length > 0) return frames;
      }
      decoder.close();
    } catch {
      // Fallback to single frame below
    }
  }

  return [await fileToRawImage(file)];
}

async function extractFramesFromVideo(
  file: File,
  maxFrames: number,
  sampleFps: number
): Promise<RawImage[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Không đọc được file video'));
    });

    const duration = Math.max(0.1, video.duration || 1);
    const stepSec = 1 / Math.max(1, sampleFps);
    const totalNeeded = Math.min(maxFrames, Math.max(1, Math.floor(duration / stepSec)));
    const actualStep = duration / totalNeeded;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 256;
    canvas.height = video.videoHeight || 256;
    const ctx = canvas.getContext('2d')!;

    const frames: RawImage[] = [];
    for (let i = 0; i < totalNeeded; i++) {
      const t = Math.min(duration - 0.01, i * actualStep);
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
        video.currentTime = t;
      });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvasToRawImage(canvas));
    }

    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Generates an Animatica / OptiFine Custom Animation pair:
 * - assets/minecraft/optifine/anim/<safeName>_anim.png (vertical strip cropped to opaqueBounds)
 * - assets/minecraft/optifine/anim/<safeName>_anim.properties
 */
export async function buildAnimaticaGuiAnimation(params: {
  baseImage: RawImage;
  stampFrames: RawImage[];
  transform: StampTransform;
  targetArchivePath: string;
  durationTicks: number;
  removeBg?: { enabled: boolean; tolerance: number; mode: 'corner' | 'white' };
}): Promise<{
  firstFrameComposite: RawImage;
  animPngPath: string;
  animPngBytes: Uint8Array;
  propsPath: string;
  propsBytes: Uint8Array;
}> {
  const { baseImage, stampFrames, transform, targetArchivePath, durationTicks, removeBg } = params;
  const bounds = getOpaqueBounds(baseImage);
  const count = stampFrames.length;

  const strip = document.createElement('canvas');
  strip.width = bounds.width;
  strip.height = bounds.height * count;
  const sctx = strip.getContext('2d')!;

  let firstFrameComposite: RawImage = baseImage;

  for (let i = 0; i < count; i++) {
    const frameStamp = removeBg?.enabled
      ? removeBackgroundFloodFillBuffer(stampFrames[i], removeBg.tolerance, removeBg.mode)
      : stampFrames[i];

    const composited = compositeStampOnRaw(baseImage, frameStamp, transform);
    if (i === 0) firstFrameComposite = composited;

    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = composited.width;
    frameCanvas.height = composited.height;
    frameCanvas.getContext('2d')!.putImageData(
      new ImageData(new Uint8ClampedArray(composited.data), composited.width, composited.height),
      0,
      0
    );

    sctx.drawImage(
      frameCanvas,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      0,
      i * bounds.height,
      bounds.width,
      bounds.height
    );
  }

  const stripRaw = canvasToRawImage(strip);
  const stripBlob = await rawImageToPngBlob(stripRaw);
  const animPngBytes = new Uint8Array(await stripBlob.arrayBuffer());

  const safeName = targetArchivePath
    .replace(/^assets\/minecraft\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  const relTarget = targetArchivePath.replace(/^assets\/minecraft\//, '');
  const animPngRel = `optifine/anim/${safeName}_anim.png`;
  const animPngPath = `assets/minecraft/${animPngRel}`;
  const propsPath = `assets/minecraft/optifine/anim/${safeName}_anim.properties`;

  const propsText = [
    `from=${animPngRel}`,
    `to=${relTarget}`,
    `x=${bounds.x}`,
    `y=${bounds.y}`,
    `w=${bounds.width}`,
    `h=${bounds.height}`,
    `duration=${Math.max(1, Math.round(durationTicks))}`,
  ].join('\n');

  return {
    firstFrameComposite,
    animPngPath,
    animPngBytes,
    propsPath,
    propsBytes: new TextEncoder().encode(propsText),
  };
}
