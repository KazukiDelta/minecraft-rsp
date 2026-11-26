import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import {
  upscaleNearestBuffer,
  removeBackgroundFloodFillBuffer,
  applyPanelTintBuffer,
  getOpaqueBounds,
  RawImage,
} from '../canvasEngine';
import { MC_VERSION_PRESETS } from '../mcVersions';
import { buildResourcePackZip } from '../packExporter';
import {
  archivePathToSoundResource,
  encodePcmToOggVorbis,
  isOggBytes,
  normalizeSoundArchivePath,
  upsertSoundsJson,
} from '../audioEngine';

describe('canvasEngine', () => {
  it('upscales exact nearest-neighbor dimensions up to high pixel counts', () => {
    const src: RawImage = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([
        255, 0, 0, 255,    0, 255, 0, 255,
        0, 0, 255, 255,    255, 255, 255, 0,
      ]),
    };

    const up = upscaleNearestBuffer(src, 8);
    expect(up.width).toBe(16);
    expect(up.height).toBe(16);

    // Top-left quadrant (0,0) should remain pure red
    expect(Array.from(up.data.slice(0, 4))).toEqual([255, 0, 0, 255]);
    // Bottom-right corner (15,15) should remain transparent
    const lastIdx = (15 * 16 + 15) * 4;
    expect(up.data[lastIdx + 3]).toBe(0);
  });

  it('removes outer white background via flood-fill while preserving enclosed interior white', () => {
    // 5x5 image: white outer border (0 and 4), dark outline ring (1..3), and white center (2,2)
    const w = 5;
    const h = 5;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const isRing = x >= 1 && x <= 3 && y >= 1 && y <= 3 && !(x === 2 && y === 2);
        if (isRing) {
          data[idx] = 20;
          data[idx + 1] = 20;
          data[idx + 2] = 20;
          data[idx + 3] = 255;
        } else {
          // Outer border AND center (2,2) are both pure white!
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
          data[idx + 3] = 255;
        }
      }
    }

    const cleaned = removeBackgroundFloodFillBuffer({ width: w, height: h, data }, 15, 'white');
    // Outer (0,0) must be transparent
    expect(cleaned.data[3]).toBe(0);
    // Enclosed interior white pixel at (2,2) must stay 100% opaque white!
    const centerIdx = (2 * w + 2) * 4;
    expect(Array.from(cleaned.data.slice(centerIdx, centerIdx + 4))).toEqual([255, 255, 255, 255]);
  });

  it('tints neutral gray GUI pixels without altering dark borders', () => {
    const src: RawImage = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([
        198, 198, 198, 255, // #C6C6C6 GUI panel
        55, 55, 55, 255,    // #373737 slot shadow
      ]),
    };

    const tinted = applyPanelTintBuffer(src, '#ffb6c1', 0.8);
    expect(tinted.data[0]).toBeGreaterThan(tinted.data[1]); // Pinkish red > green
    // Dark slot shadow untouched
    expect(Array.from(tinted.data.slice(4, 8))).toEqual([55, 55, 55, 255]);
  });

  it('computes opaque bounds accurately for partial-canvas GUIs', () => {
    const w = 10;
    const h = 10;
    const data = new Uint8ClampedArray(w * h * 4);
    // Opaque box from (1,2) to (5,6)
    for (let y = 2; y <= 6; y++) {
      for (let x = 1; x <= 5; x++) {
        data[(y * w + x) * 4 + 3] = 255;
      }
    }
    expect(getOpaqueBounds({ width: w, height: h, data })).toEqual({
      x: 1,
      y: 2,
      width: 5,
      height: 5,
    });
  });
});

describe('packExporter', () => {
  it('generates a valid Minecraft 26.3 resource pack zip with pack_format 97', async () => {
    const preset263 = MC_VERSION_PRESETS.find((p) => p.id === '26.3')!;
    const modified = new Map<string, Uint8Array>();
    modified.set('assets/minecraft/textures/painting/alban.png', new Uint8Array([137, 80, 78, 71]));

    const bytes = await buildResourcePackZip({
      packName: 'My_Custom_Pack',
      description: 'Test Pack',
      versionPreset: preset263,
      modifiedTextures: modified,
    });

    const loaded = await JSZip.loadAsync(bytes);
    expect(loaded.files['pack.mcmeta']).toBeDefined();
    expect(loaded.files['assets/minecraft/textures/painting/alban.png']).toBeDefined();

    const mcmeta = JSON.parse(await loaded.files['pack.mcmeta'].async('string'));
    expect(mcmeta.pack.pack_format).toBe(97);
    expect(mcmeta.pack.min_format).toBe(97);
    expect(mcmeta.pack.max_format).toBe(97);
  });
});

describe('audioEngine', () => {
  it('normalizes sound archive paths to lowercase .ogg under assets/minecraft/sounds', () => {
    expect(normalizeSoundArchivePath('My Custom/Click Sound.mp3')).toBe(
      'assets/minecraft/sounds/my_custom/click_sound.ogg'
    );
    expect(archivePathToSoundResource('assets/minecraft/sounds/random/click.ogg')).toBe(
      'random/click'
    );
  });

  it('upserts entries cleanly in sounds.json', () => {
    const out = upsertSoundsJson(null, 'ui.button.click', 'random/click', { replace: true });
    const parsed = JSON.parse(out);
    expect(parsed['ui.button.click']).toEqual({
      replace: true,
      sounds: ['random/click'],
    });

    const out2 = upsertSoundsJson(out, 'music.menu', 'music/menu/menu1', {
      replace: true,
      stream: true,
    });
    const parsed2 = JSON.parse(out2);
    expect(parsed2['ui.button.click']).toBeDefined();
    expect(parsed2['music.menu'].sounds[0]).toEqual({
      name: 'music/menu/menu1',
      stream: true,
    });
  });

  it('encodes PCM audio into valid Ogg Vorbis bytes with OggS magic header', async () => {
    const sampleRate = 44100;
    const pcm = new Float32Array(sampleRate / 10); // 0.1s sine wave
    for (let i = 0; i < pcm.length; i++) {
      pcm[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
    }
    const ogg = await encodePcmToOggVorbis([pcm], sampleRate, 4);
    expect(ogg.length).toBeGreaterThan(100);
    expect(isOggBytes(ogg)).toBe(true);
  });
});
