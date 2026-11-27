import React, { useState } from 'react';
import { Download, Package, X, Image as ImageIcon } from 'lucide-react';
import { MC_VERSION_PRESETS, McVersionPreset } from '../lib/mcVersions';
import { fileToRawImage, rawImageToPngBlob, resizeNearestBuffer } from '../lib/canvasEngine';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  modifiedPaths: string[];
  extraFilePaths: string[];
  hasSkyJsonConfigs: boolean;
  onExport: (opts: {
    packName: string;
    description: string;
    versionPreset: McVersionPreset;
    packIconBlob: Blob | null;
    fixSkyBlendReplace: boolean;
    skipUnchangedVanilla: boolean;
  }) => Promise<void>;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  onClose,
  modifiedPaths,
  extraFilePaths,
  hasSkyJsonConfigs,
  onExport,
}) => {
  const [packName, setPackName] = useState('Teru_Custom_Pack');
  const [description, setDescription] = useState('§dCustom Resource Pack §7- Created with MC Pack Studio');
  const [versionId, setVersionId] = useState('26.3');
  const [packIconBlob, setPackIconBlob] = useState<Blob | null>(null);
  const [packIconPreview, setPackIconPreview] = useState<string | null>(null);
  const [fixSkyBlendReplace, setFixSkyBlendReplace] = useState<boolean>(true);
  const [skipUnchangedVanilla, setSkipUnchangedVanilla] = useState<boolean>(true);
  const [exporting, setExporting] = useState(false);

  if (!open) return null;

  const selectedPreset =
    MC_VERSION_PRESETS.find((p) => p.id === versionId) || MC_VERSION_PRESETS[0];

  const handleIconFile = async (file: File) => {
    const raw = await fileToRawImage(file);
    // Resize cleanly to 128x128 for pack.png
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const tmp = document.createElement('canvas');
    tmp.width = raw.width;
    tmp.height = raw.height;
    tmp.getContext('2d')!.putImageData(
      new ImageData(new Uint8ClampedArray(raw.data), raw.width, raw.height),
      0,
      0
    );
    ctx.imageSmoothingEnabled = raw.width > 64;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tmp, 0, 0, 128, 128);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (blob) {
      setPackIconBlob(blob);
      if (packIconPreview) URL.revokeObjectURL(packIconPreview);
      setPackIconPreview(URL.createObjectURL(blob));
    } else {
      const fallback = await rawImageToPngBlob(resizeNearestBuffer(raw, 128, 128));
      setPackIconBlob(fallback);
    }
  };

  const handleConfirm = async () => {
    setExporting(true);
    try {
      await onExport({
        packName: packName.trim() || 'Custom_Resource_Pack',
        description,
        versionPreset: selectedPreset,
        packIconBlob,
        fixSkyBlendReplace,
        skipUnchangedVanilla,
      });
      onClose();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-zinc-100">
            <Package className="w-5 h-5 text-pink-400" />
            <span>Xuất Resource Pack (.zip)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-[96px_1fr] gap-4 items-center">
            <label className="w-24 h-24 rounded-lg border border-dashed border-zinc-700 hover:border-pink-500 checkerboard flex flex-col items-center justify-center gap-1 cursor-pointer overflow-hidden relative">
              {packIconPreview ? (
                <img src={packIconPreview} alt="pack.png" className="w-full h-full object-cover" />
              ) : (
                <>
                  <ImageIcon className="w-6 h-6 text-zinc-500" />
                  <span className="text-[10px] text-zinc-400 text-center px-1">Chọn pack.png</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleIconFile(f);
                }}
              />
            </label>

            <div className="space-y-3">
              <div>
                <label className="block text-zinc-400 mb-1">Tên file Resource Pack</label>
                <input
                  type="text"
                  value={packName}
                  onChange={(e) => setPackName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Phiên bản Minecraft</label>
                <select
                  value={versionId}
                  onChange={(e) => setVersionId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-pink-500"
                >
                  {MC_VERSION_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} (pack_format {p.packFormat})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 mb-1">Mô tả (hỗ trợ mã màu §a, §d, §l...)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-pink-500"
            />
          </div>

          <label className="flex items-start gap-2 bg-zinc-950 border border-zinc-800 rounded-md p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={skipUnchangedVanilla}
              onChange={(e) => setSkipUnchangedVanilla(e.target.checked)}
              className="mt-0.5 accent-pink-500"
            />
            <span className="text-zinc-300 leading-snug">
              <strong>Bỏ qua texture Minecraft mặc định chưa sửa:</strong> Tự động so sánh với ảnh gốc Vanilla 26.3 và không đóng gói các file chưa thay đổi để pack nhẹ và sạch.
            </span>
          </label>

          {hasSkyJsonConfigs && (
            <label className="flex items-start gap-2 bg-sky-950/40 border border-sky-500/40 rounded-md p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={fixSkyBlendReplace}
                onChange={(e) => setFixSkyBlendReplace(e.target.checked)}
                className="mt-0.5 accent-sky-500"
              />
              <span className="text-sky-200 leading-snug">
                <strong>Tự động chống mờ bầu trời (blend → replace):</strong> Tự sửa file JSON/Properties của Skybox (như Dramatic Skys) để ảnh nhân vật ban ngày đậm màu, không bị nhạt/phủ sương.
              </span>
            </label>
          )}

          <div className="bg-zinc-950 border border-zinc-800 rounded-md p-3">
            <div className="text-zinc-300 font-medium mb-1.5">
              File trong Pack ({modifiedPaths.length} texture • {extraFilePaths.length} JSON/Âm thanh/Config):
            </div>
            {modifiedPaths.length === 0 && extraFilePaths.length === 0 ? (
              <p className="text-amber-400">
                Bạn chưa chỉnh sửa texture, JSON hoặc âm thanh nào. Pack xuất ra sẽ chỉ có pack.mcmeta và pack.png.
              </p>
            ) : (
              <ul className="max-h-32 overflow-y-auto space-y-1 text-[11px] font-mono text-zinc-400">
                {modifiedPaths.map((p) => (
                  <li key={p} className="truncate">
                    • {p.replace('assets/minecraft/textures/', '')}
                  </li>
                ))}
                {extraFilePaths.map((p) => (
                  <li key={p} className="truncate text-emerald-400/90">
                    • {p.replace(/^assets\//, '')}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="px-5 py-3.5 bg-zinc-950/60 border-t border-zinc-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 cursor-pointer"
          >
            Đóng
          </button>
          <button
            onClick={handleConfirm}
            disabled={exporting}
            className="px-4 py-2 rounded-md bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{exporting ? 'Đang đóng gói...' : 'Tải file .zip về máy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
