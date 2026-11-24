import JSZip from 'jszip';
import { buildPackMcmeta, McVersionPreset } from './mcVersions';

export interface ExportPackOptions {
  packName: string;
  description: string;
  versionPreset: McVersionPreset;
  /** Map from archive path (e.g. assets/minecraft/textures/...) to PNG Blob or Uint8Array */
  modifiedTextures: Map<string, Blob | Uint8Array>;
  /** Extra non-PNG files (e.g. .mcmeta, optifine/sky/*.properties, models) */
  extraFiles?: Map<string, Uint8Array>;
  packIcon?: Blob | Uint8Array | null;
}

export async function buildResourcePackZip(options: ExportPackOptions): Promise<Uint8Array> {
  const zip = new JSZip();

  const mcmetaContent = buildPackMcmeta(options.versionPreset, options.description);
  zip.file('pack.mcmeta', mcmetaContent);

  if (options.packIcon) {
    zip.file('pack.png', options.packIcon);
  }

  if (options.extraFiles) {
    for (const [extraPath, bytes] of options.extraFiles.entries()) {
      const normalized = extraPath.replace(/^\/+/, '').replace(/\\/g, '/');
      zip.file(normalized, bytes);
    }
  }

  for (const [archivePath, data] of options.modifiedTextures.entries()) {
    const normalized = archivePath.replace(/^\/+/, '').replace(/\\/g, '/');
    zip.file(normalized, data);
  }

  return await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export function triggerBlobDownload(bytes: Uint8Array, filename: string) {
  const safeCopy = new Uint8Array(bytes.byteLength);
  safeCopy.set(bytes);
  const blob = new Blob([safeCopy], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.zip') ? filename : `${filename}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
