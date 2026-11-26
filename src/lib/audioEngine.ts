import { createOggEncoder } from 'wasm-media-encoders';

export interface SoundPreset {
  label: string;
  group: string;
  /** Archive path inside resource pack */
  path: string;
  /** Optional Minecraft sound event ID for sounds.json */
  eventId: string;
  /** Recommended mono for 3D positional audio */
  recommendMono: boolean;
}

export const VANILLA_SOUND_PRESETS: SoundPreset[] = [
  // UI
  {
    label: 'Click nút UI (Button Click)',
    group: 'Giao diện (UI)',
    path: 'assets/minecraft/sounds/random/click.ogg',
    eventId: 'ui.button.click',
    recommendMono: true,
  },
  {
    label: 'Thông báo thành tựu (Toast Challenge)',
    group: 'Giao diện (UI)',
    path: 'assets/minecraft/sounds/ui/toast/challenge_complete.ogg',
    eventId: 'ui.toast.challenge_complete',
    recommendMono: false,
  },
  // Combat & Action
  {
    label: 'Đánh trúng / Sát thương (Hit 1)',
    group: 'Chiến đấu',
    path: 'assets/minecraft/sounds/damage/hit1.ogg',
    eventId: 'entity.player.hurt',
    recommendMono: true,
  },
  {
    label: 'Đòn chí mạng (Crit)',
    group: 'Chiến đấu',
    path: 'assets/minecraft/sounds/entity/player/attack/crit1.ogg',
    eventId: 'entity.player.attack.crit',
    recommendMono: true,
  },
  {
    label: 'Chém mạnh (Strong Attack)',
    group: 'Chiến đấu',
    path: 'assets/minecraft/sounds/entity/player/attack/strong1.ogg',
    eventId: 'entity.player.attack.strong',
    recommendMono: true,
  },
  {
    label: 'Mũi tên trúng đích (Bow Hit)',
    group: 'Chiến đấu',
    path: 'assets/minecraft/sounds/random/successful_hit.ogg',
    eventId: 'entity.arrow.hit_player',
    recommendMono: true,
  },
  {
    label: 'Bắn cung (Bow Shoot)',
    group: 'Chiến đấu',
    path: 'assets/minecraft/sounds/random/bow.ogg',
    eventId: 'entity.arrow.shoot',
    recommendMono: true,
  },
  {
    label: 'Kích hoạt Totem (Totem of Undying)',
    group: 'Chiến đấu',
    path: 'assets/minecraft/sounds/item/totem/use_totem.ogg',
    eventId: 'item.totem.use',
    recommendMono: false,
  },
  // Gameplay & Items
  {
    label: 'Nhặt kinh nghiệm (XP Orb)',
    group: 'Gameplay',
    path: 'assets/minecraft/sounds/random/orb.ogg',
    eventId: 'entity.experience_orb.pickup',
    recommendMono: true,
  },
  {
    label: 'Lên cấp (Level Up)',
    group: 'Gameplay',
    path: 'assets/minecraft/sounds/random/levelup.ogg',
    eventId: 'entity.player.levelup',
    recommendMono: false,
  },
  {
    label: 'Ăn thức ăn (Eat 1)',
    group: 'Gameplay',
    path: 'assets/minecraft/sounds/random/eat1.ogg',
    eventId: 'entity.generic.eat',
    recommendMono: true,
  },
  {
    label: 'Uống thuốc (Drink)',
    group: 'Gameplay',
    path: 'assets/minecraft/sounds/random/drink.ogg',
    eventId: 'entity.generic.drink',
    recommendMono: true,
  },
  {
    label: 'Mở rương (Chest Open)',
    group: 'Gameplay',
    path: 'assets/minecraft/sounds/random/chestopen.ogg',
    eventId: 'block.chest.open',
    recommendMono: true,
  },
  {
    label: 'Đóng rương (Chest Close)',
    group: 'Gameplay',
    path: 'assets/minecraft/sounds/random/chestclosed.ogg',
    eventId: 'block.chest.close',
    recommendMono: true,
  },
  {
    label: 'Nổ TNT / Creeper (Explode 1)',
    group: 'Gameplay',
    path: 'assets/minecraft/sounds/random/explode1.ogg',
    eventId: 'entity.generic.explode',
    recommendMono: true,
  },
  // Music & Discs
  {
    label: 'Nhạc nền Menu chính (Menu 1)',
    group: 'Nhạc & Đĩa nhạc',
    path: 'assets/minecraft/sounds/music/menu/menu1.ogg',
    eventId: 'music.menu',
    recommendMono: false,
  },
  {
    label: 'Đĩa nhạc Cat (records/cat)',
    group: 'Nhạc & Đĩa nhạc',
    path: 'assets/minecraft/sounds/records/cat.ogg',
    eventId: 'music_disc.cat',
    recommendMono: false,
  },
  {
    label: 'Đĩa nhạc Pigstep (records/pigstep)',
    group: 'Nhạc & Đĩa nhạc',
    path: 'assets/minecraft/sounds/records/pigstep.ogg',
    eventId: 'music_disc.pigstep',
    recommendMono: false,
  },
  {
    label: 'Âm thanh tùy chỉnh (custom/my_sound)',
    group: 'Tùy chỉnh',
    path: 'assets/minecraft/sounds/custom/my_sound.ogg',
    eventId: 'custom.my_sound',
    recommendMono: true,
  },
];

export interface AudioEditOptions {
  trimStart: number; // seconds
  trimEnd: number; // seconds
  gain: number; // multiplier, e.g. 1.0 = 100%, 1.5 = 150%
  playbackRate: number; // 0.5 - 2.0
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  mono: boolean;
  normalize: boolean;
  vbrQuality: number; // Ogg Vorbis quality (-1 to 10, default 4)
}

export function isOggBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x4f && // 'O'
    bytes[1] === 0x67 && // 'g'
    bytes[2] === 0x67 && // 'g'
    bytes[3] === 0x53 // 'S'
  );
}

export function isAudioFilePath(path: string): boolean {
  return /\.(ogg|wav|mp3|m4a|webm|flac)$/i.test(path);
}

export function isTextEditablePath(path: string): boolean {
  return /\.(json|mcmeta|properties|txt|fsh|vsh|glsl|lang|cfg|yml|yaml)$/i.test(path);
}

export function normalizeSoundArchivePath(rawPath: string): string {
  let clean = rawPath.trim().replace(/^\/+/, '').replace(/\\/g, '/');
  if (!clean) clean = 'assets/minecraft/sounds/custom/sound.ogg';
  if (!clean.startsWith('assets/')) {
    clean = clean.startsWith('sounds/')
      ? `assets/minecraft/${clean}`
      : `assets/minecraft/sounds/${clean}`;
  }
  if (!clean.toLowerCase().endsWith('.ogg')) {
    clean = clean.replace(/\.[^/.]+$/, '') + '.ogg';
  }
  // Minecraft resource paths must be lowercase [a-z0-9/._-]
  return clean.toLowerCase().replace(/[^a-z0-9/._-]/g, '_');
}

export function archivePathToSoundResource(archivePath: string): string {
  const norm = archivePath.replace(/^\/+/, '').replace(/\\/g, '/');
  const match = norm.match(/^assets\/([^/]+)\/sounds\/(.+)\.ogg$/i);
  if (!match) {
    return norm.replace(/^assets\/minecraft\/sounds\//i, '').replace(/\.ogg$/i, '');
  }
  const [, namespace, rel] = match;
  return namespace === 'minecraft' ? rel : `${namespace}:${rel}`;
}

/**
 * Decodes raw audio bytes (OGG, MP3, WAV, M4A, WebM...) into a Web Audio API AudioBuffer.
 */
export async function decodeAudioBytes(bytes: Uint8Array): Promise<AudioBuffer> {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    return await ctx.decodeAudioData(copy);
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * Applies trim, playbackRate (pitch/speed), mono mixdown, normalize, gain, and fade in/out
 * to an AudioBuffer using OfflineAudioContext.
 */
export async function processAudioBuffer(
  source: AudioBuffer,
  opts: AudioEditOptions
): Promise<AudioBuffer> {
  const start = Math.max(0, Math.min(opts.trimStart, source.duration));
  const end = Math.max(start + 0.02, Math.min(opts.trimEnd, source.duration));
  const clipDuration = Math.max(0.02, end - start);
  const rate = Math.max(0.25, Math.min(4, opts.playbackRate || 1));
  const outDuration = Math.max(0.02, clipDuration / rate);
  const outChannels = opts.mono ? 1 : Math.min(2, source.numberOfChannels);
  const sampleRate = source.sampleRate || 44100;
  const frameCount = Math.max(1, Math.ceil(outDuration * sampleRate));

  const offline = new OfflineAudioContext(outChannels, frameCount, sampleRate);
  const bufSource = offline.createBufferSource();
  bufSource.buffer = source;
  bufSource.playbackRate.value = rate;
  bufSource.connect(offline.destination);
  bufSource.start(0, start, clipDuration);

  const rendered = await offline.startRendering();

  // Apply normalize + gain + fade in/out directly on PCM samples
  let peak = 0;
  if (opts.normalize) {
    for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
      const data = rendered.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i]);
        if (abs > peak) peak = abs;
      }
    }
  }
  const normFactor = opts.normalize && peak > 1e-5 ? 0.96 / peak : 1;
  const totalGain = normFactor * Math.max(0, opts.gain);
  const fadeInSamples = Math.min(rendered.length, Math.round(Math.max(0, opts.fadeIn) * sampleRate));
  const fadeOutSamples = Math.min(rendered.length, Math.round(Math.max(0, opts.fadeOut) * sampleRate));

  for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
    const data = rendered.getChannelData(ch);
    const len = data.length;
    for (let i = 0; i < len; i++) {
      let env = 1;
      if (fadeInSamples > 0 && i < fadeInSamples) {
        env *= i / fadeInSamples;
      }
      if (fadeOutSamples > 0 && i >= len - fadeOutSamples) {
        env *= (len - 1 - i) / fadeOutSamples;
      }
      const v = data[i] * totalGain * env;
      data[i] = v > 1 ? 1 : v < -1 ? -1 : v;
    }
  }

  return rendered;
}

/**
 * Encodes Float32 PCM channel arrays into standard Ogg Vorbis (.ogg) bytes
 * compatible with Minecraft Java Edition (OpenAL / stb_vorbis).
 */
export async function encodePcmToOggVorbis(
  channels: Float32Array[],
  sampleRate: number,
  vbrQuality = 4
): Promise<Uint8Array> {
  const numChannels = channels.length === 1 ? 1 : 2;
  const encoder = await createOggEncoder();
  encoder.configure({
    channels: numChannels,
    sampleRate,
    vbrQuality: Math.max(-1, Math.min(10, vbrQuality)),
  });

  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  const pushChunk = (data: Uint8Array) => {
    if (data.length === 0) return;
    const copy = new Uint8Array(data.length);
    copy.set(data);
    chunks.push(copy);
    totalLength += copy.length;
  };

  const totalSamples = channels[0].length;
  const blockSize = 4096;

  for (let offset = 0; offset < totalSamples; offset += blockSize) {
    const end = Math.min(totalSamples, offset + blockSize);
    const slice: Float32Array[] =
      numChannels === 1
        ? [channels[0].subarray(offset, end)]
        : [channels[0].subarray(offset, end), channels[1].subarray(offset, end)];
    pushChunk(encoder.encode(slice));
  }

  pushChunk(encoder.finalize());

  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const c of chunks) {
    result.set(c, pos);
    pos += c.length;
  }
  return result;
}

export async function encodeAudioBufferToOgg(
  buffer: AudioBuffer,
  vbrQuality = 4
): Promise<Uint8Array> {
  const numChannels = buffer.numberOfChannels === 1 ? 1 : 2;
  const channels: Float32Array[] =
    numChannels === 1
      ? [buffer.getChannelData(0)]
      : [buffer.getChannelData(0), buffer.getChannelData(1)];
  return encodePcmToOggVorbis(channels, buffer.sampleRate, vbrQuality);
}

/**
 * Fast PCM -> WAV Blob conversion for instant in-browser preview before OGG encoding.
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([ab], { type: 'audio/wav' });
}

/**
 * Updates or creates an entry in assets/minecraft/sounds.json cleanly.
 */
export function upsertSoundsJson(
  existingJsonText: string | null,
  eventId: string,
  soundResource: string,
  opts: { replace?: boolean; stream?: boolean; volume?: number; pitch?: number } = {}
): string {
  let root: Record<string, unknown> = {};
  if (existingJsonText && existingJsonText.trim()) {
    try {
      const parsed = JSON.parse(existingJsonText);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        root = parsed as Record<string, unknown>;
      }
    } catch {
      root = {};
    }
  }

  const useObjectEntry =
    opts.stream ||
    (opts.volume !== undefined && opts.volume !== 1) ||
    (opts.pitch !== undefined && opts.pitch !== 1);

  const soundEntry = useObjectEntry
    ? {
        name: soundResource,
        ...(opts.volume !== undefined && opts.volume !== 1 ? { volume: Number(opts.volume.toFixed(2)) } : {}),
        ...(opts.pitch !== undefined && opts.pitch !== 1 ? { pitch: Number(opts.pitch.toFixed(2)) } : {}),
        ...(opts.stream ? { stream: true } : {}),
      }
    : soundResource;

  root[eventId.trim()] = {
    replace: opts.replace ?? true,
    sounds: [soundEntry],
  };

  return JSON.stringify(root, null, 2);
}
