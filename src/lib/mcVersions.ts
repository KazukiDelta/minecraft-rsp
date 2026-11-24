export interface McVersionPreset {
  id: string;
  label: string;
  packFormat: number;
  minFormat?: number;
  maxFormat?: number;
  supportedFormats?: [number, number];
}

export const MC_VERSION_PRESETS: McVersionPreset[] = [
  {
    id: '26.3',
    label: 'Minecraft 26.3 (Latest)',
    packFormat: 97,
    minFormat: 97,
    maxFormat: 97,
    supportedFormats: [64, 97],
  },
  {
    id: '26.1-26.2',
    label: 'Minecraft 26.1 – 26.2',
    packFormat: 88,
    minFormat: 75,
    maxFormat: 97,
    supportedFormats: [64, 97],
  },
  {
    id: '1.21.4-1.21.11',
    label: 'Minecraft 1.21.4 – 1.21.11',
    packFormat: 46,
    supportedFormats: [34, 64],
  },
  {
    id: '1.21-1.21.3',
    label: 'Minecraft 1.21 – 1.21.3',
    packFormat: 34,
    supportedFormats: [34, 42],
  },
  {
    id: '1.20.5-1.20.6',
    label: 'Minecraft 1.20.5 – 1.20.6',
    packFormat: 32,
  },
  {
    id: '1.20-1.20.4',
    label: 'Minecraft 1.20 – 1.20.4',
    packFormat: 15,
    supportedFormats: [15, 22],
  },
];

export function buildPackMcmeta(preset: McVersionPreset, description: string): string {
  const packObj: Record<string, unknown> = {
    pack_format: preset.packFormat,
    description,
  };
  if (preset.minFormat !== undefined) packObj.min_format = preset.minFormat;
  if (preset.maxFormat !== undefined) packObj.max_format = preset.maxFormat;
  if (preset.supportedFormats !== undefined) packObj.supported_formats = preset.supportedFormats;

  return JSON.stringify({ pack: packObj }, null, 2);
}
