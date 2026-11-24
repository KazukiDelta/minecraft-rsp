import JSZip from 'jszip';

export interface TextureEntry {
  /** Full archive path, e.g. assets/minecraft/textures/gui/container/inventory.png */
  path: string;
  /** Short path under textures/ or optifine/, e.g. gui/container/inventory.png */
  relPath: string;
  /** Basename, e.g. inventory.png */
  name: string;
  /** Top-level category folder: gui, painting, item, block, environment, sky, etc. */
  category: string;
  /** Public URL (for built-in 26.3 templates) or object URL (for uploaded packs) */
  url: string;
}

export interface TemplateManifest {
  version: string;
  count: number;
  entries: TextureEntry[];
}

export interface ParsedPack {
  packName: string;
  entries: TextureEntry[];
  textureBlobs: Map<string, Blob>;
  /** Non-PNG files (e.g. .mcmeta, .json models, optifine/sky/*.properties) preserved on export */
  extraFiles: Map<string, Uint8Array>;
}

export function classifyTexturePath(fullPath: string): { relPath: string; category: string; name: string } {
  const norm = fullPath.replace(/^\/+/, '').replace(/\\/g, '/');
  const texPrefix = 'assets/minecraft/textures/';
  const name = norm.split('/').pop() || norm;

  if (
    norm.includes('optifine/sky/') ||
    norm.includes('fabricskyboxes/') ||
    norm.includes('/skybox/') ||
    norm.startsWith('assets/skybox/') ||
    norm.includes('celestial/')
  ) {
    const relPath = norm.replace(/^assets\/(minecraft\/)?/, '');
    return { relPath, category: 'sky', name };
  }

  if (norm.startsWith(texPrefix)) {
    const relPath = norm.slice(texPrefix.length);
    const top = relPath.split('/')[0] || 'other';
    // Group vanilla environment (sun, moon, clouds, end_sky) into 'sky' as well
    const category = top === 'environment' ? 'sky' : top;
    return { relPath, category, name };
  }

  const relPath = norm.replace(/^assets\//, '');
  const top = relPath.split('/')[0] || 'other';
  return { relPath, category: top === 'environment' ? 'sky' : top, name };
}

export async function loadBuiltinManifest(): Promise<TemplateManifest> {
  const res = await fetch('/templates/manifest.json');
  if (!res.ok) {
    return { version: '26.3', count: 0, entries: [] };
  }
  const data = (await res.json()) as TemplateManifest;
  // Normalize 'environment' into 'sky' so users find sun, moon, clouds, end_sky under Bầu trời (Sky)
  return {
    ...data,
    entries: data.entries.map((e) => ({
      ...e,
      category: e.category === 'environment' ? 'sky' : e.category,
    })),
  };
}

/**
 * Parses a .zip or .jar resource pack, returning both PNG textures (including optifine/sky)
 * and extra metadata/model/properties files so importing a template pack preserves everything.
 */
export async function parseResourcePackFile(file: File): Promise<ParsedPack> {
  const zip = await JSZip.loadAsync(file);
  const entries: TextureEntry[] = [];
  const textureBlobs = new Map<string, Blob>();
  const extraFiles = new Map<string, Uint8Array>();

  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);

  for (const rawName of names) {
    const norm = rawName.replace(/^\/+/, '').replace(/\\/g, '/');
    if (norm === 'pack.mcmeta' || norm === 'pack.png') continue;

    const isPng = norm.toLowerCase().endsWith('.png');
    const isAssetTexture = isPng && norm.startsWith('assets/');

    if (isAssetTexture) {
      const blob = await zip.files[rawName].async('blob');
      const pngBlob = new Blob([blob], { type: 'image/png' });
      const url = URL.createObjectURL(pngBlob);
      const archivePath = norm.startsWith('assets/') ? norm : `assets/minecraft/textures/${norm}`;
      const { relPath, category, name } = classifyTexturePath(archivePath);

      entries.push({ path: archivePath, relPath, name, category, url });
      textureBlobs.set(archivePath, pngBlob);
    } else if (norm.startsWith('assets/')) {
      const bytes = await zip.files[rawName].async('uint8array');
      extraFiles.set(norm, bytes);
    }
  }

  entries.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return {
    packName: file.name.replace(/\.(zip|jar)$/i, ''),
    entries,
    textureBlobs,
    extraFiles,
  };
}

/**
 * Generates a blank 1536x1024 (3x2 grid) custom Skybox texture (compatible with OptiFine / Skyboxify)
 * plus its matching .properties config file.
 */
export async function createCustomSkyboxTemplate(): Promise<{
  entry: TextureEntry;
  blob: Blob;
  propertiesPath: string;
  propertiesBytes: Uint8Array;
}> {
  const w = 1536;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Soft twilight sky gradient so user immediately sees the 3x2 skybox layout
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#1e1b4b');
  grad.addColorStop(0.5, '#4c1d95');
  grad.addColorStop(1, '#be185d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle 3x2 face guide lines
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  ctx.beginPath();
  ctx.moveTo(w / 3, 0);
  ctx.lineTo(w / 3, h);
  ctx.moveTo((w * 2) / 3, 0);
  ctx.lineTo((w * 2) / 3, h);
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to create skybox'))), 'image/png');
  });

  const path = 'assets/minecraft/optifine/sky/world0/sky_custom.png';
  const url = URL.createObjectURL(blob);
  const propsText = [
    'source=./sky_custom.png',
    'blend=replace',
    'startFadeIn=0:00',
    'endFadeIn=0:01',
    'endFadeOut=23:59',
    'rotate=true',
  ].join('\n');

  return {
    entry: {
      path,
      relPath: 'optifine/sky/world0/sky_custom.png',
      name: 'sky_custom.png',
      category: 'sky',
      url,
    },
    blob,
    propertiesPath: 'assets/minecraft/optifine/sky/world0/sky_custom.properties',
    propertiesBytes: new TextEncoder().encode(propsText),
  };
}
