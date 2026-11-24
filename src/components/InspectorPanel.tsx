import React, { useEffect, useState } from 'react';
import {
  Maximize,
  ImagePlus,
  Palette,
  Check,
  X,
  FlipHorizontal,
  Crosshair,
  Scan,
  Wand2,
  Film,
  Globe,
} from 'lucide-react';
import { RawImage, StampTransform, fileToRawImage, rawImageToPngBlob } from '../lib/canvasEngine';
import {
  AnimationSettings,
  buildVerticalSpriteSheet,
  extractFramesFromMediaFile,
} from '../lib/animationEngine';
import { equirectangularToOptifineSkybox } from '../lib/skyboxProjector';

interface InspectorPanelProps {
  baseImage: RawImage | null;
  opaqueBounds: { x: number; y: number; width: number; height: number } | null;
  onUpscaleFactor: (factor: number) => void;
  onResizeExact: (w: number, h: number) => void;
  onCleanItemEdges: () => void;
  onApplyTint: (hex: string, strength: number) => void;
  hasStamp: boolean;
  stampFrameCount: number;
  stampDurationTicks: number;
  onChangeStampDurationTicks: (t: number) => void;
  onUploadStampFile: (file: File) => void;
  removeBgEnabled: boolean;
  onToggleRemoveBg: (v: boolean) => void;
  removeBgMode: 'corner' | 'white';
  onChangeRemoveBgMode: (m: 'corner' | 'white') => void;
  removeBgTolerance: number;
  onChangeRemoveBgTolerance: (t: number) => void;
  stampTransform: StampTransform;
  onUpdateStampTransform: (patch: Partial<StampTransform>) => void;
  onFitStampToPanel: (cover: boolean) => void;
  onCenterStamp: () => void;
  onApplyStamp: () => void;
  onCancelStamp: () => void;
  existingAnimSettings: AnimationSettings | null;
  onApplyAnimation: (spriteSheet: RawImage | null, settings: AnimationSettings) => void;
  isSkyTexture: boolean;
  isBedTexture: boolean;
  onApplyProjectedSkybox: (projected: RawImage) => void;
}

const TINT_PRESETS = [
  { label: 'Sakura', color: '#ffc2d1' },
  { label: 'Coral', color: '#fda4af' },
  { label: 'Sky', color: '#bae6fd' },
  { label: 'Mint', color: '#bbf7d0' },
  { label: 'Lavender', color: '#e9d5ff' },
  { label: 'Dark UI', color: '#52525b' },
];

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  baseImage,
  opaqueBounds,
  onUpscaleFactor,
  onResizeExact,
  onCleanItemEdges,
  onApplyTint,
  hasStamp,
  stampFrameCount,
  stampDurationTicks,
  onChangeStampDurationTicks,
  onUploadStampFile,
  removeBgEnabled,
  onToggleRemoveBg,
  removeBgMode,
  onChangeRemoveBgMode,
  removeBgTolerance,
  onChangeRemoveBgTolerance,
  stampTransform,
  onUpdateStampTransform,
  onFitStampToPanel,
  onCenterStamp,
  onApplyStamp,
  onCancelStamp,
  existingAnimSettings,
  onApplyAnimation,
  isSkyTexture,
  isBedTexture,
  onApplyProjectedSkybox,
}) => {
  const [skyFaceSize, setSkyFaceSize] = useState<number>(512);
  const [customW, setCustomW] = useState<string>('1024');
  const [customH, setCustomH] = useState<string>('1024');
  const [tintHex, setTintHex] = useState<string>('#ffc2d1');
  const [tintStrength, setTintStrength] = useState<number>(0.65);

  // Animation (.png.mcmeta) state
  const [animFrames, setAnimFrames] = useState<RawImage[]>([]);
  const [animPreviews, setAnimPreviews] = useState<string[]>([]);
  const [animPreviewIdx, setAnimPreviewIdx] = useState<number>(0);
  const [animFrameSize, setAnimFrameSize] = useState<number>(128);
  const [animFrametime, setAnimFrametime] = useState<number>(2);
  const [animInterpolate, setAnimInterpolate] = useState<boolean>(false);
  const [animRemoveBg, setAnimRemoveBg] = useState<boolean>(false);

  useEffect(() => {
    if (existingAnimSettings) {
      setAnimFrametime(existingAnimSettings.frametime);
      setAnimInterpolate(existingAnimSettings.interpolate);
    }
  }, [existingAnimSettings]);

  useEffect(() => {
    if (animPreviews.length <= 1) return;
    const ms = Math.max(50, animFrametime * 50);
    const id = window.setInterval(() => {
      setAnimPreviewIdx((i) => (i + 1) % animPreviews.length);
    }, ms);
    return () => window.clearInterval(id);
  }, [animPreviews.length, animFrametime]);

  const [animExtracting, setAnimExtracting] = useState<boolean>(false);

  const handleUploadAnimFrames = async (files: FileList) => {
    setAnimExtracting(true);
    try {
      const sorted = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));
      const loaded: RawImage[] = [];
      for (const f of sorted) {
        const extracted = await extractFramesFromMediaFile(f, 48, 10);
        loaded.push(...extracted);
      }
      const urls: string[] = [];
      for (const frame of loaded) {
        const blob = await rawImageToPngBlob(frame);
        urls.push(URL.createObjectURL(blob));
      }
      animPreviews.forEach((u) => URL.revokeObjectURL(u));
      setAnimFrames(loaded);
      setAnimPreviews(urls);
      setAnimPreviewIdx(0);
    } finally {
      setAnimExtracting(false);
    }
  };

  if (!baseImage) {
    return (
      <aside className="w-84 bg-zinc-900 border-l border-zinc-800 p-4 text-xs text-zinc-500">
        Chưa chọn texture.
      </aside>
    );
  }

  return (
    <aside className="w-84 bg-zinc-900 border-l border-zinc-800 flex flex-col h-full shrink-0 overflow-y-auto divide-y divide-zinc-800">
      {/* 1. Upscale Nearest-Neighbor */}
      <section className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
            <Maximize className="w-3.5 h-3.5 text-pink-400" />
            <span>1. Upscale Độ Phân Giải (Pixel)</span>
          </h3>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-md p-2.5 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-zinc-400">Kích thước hiện tại:</span>
            <span className="font-mono font-semibold text-pink-300">
              {baseImage.width} × {baseImage.height} px
            </span>
          </div>
          {opaqueBounds &&
            (opaqueBounds.width !== baseImage.width ||
              opaqueBounds.height !== baseImage.height) && (
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-500">Vùng khung hiển thị:</span>
                <span className="font-mono text-zinc-300">
                  {opaqueBounds.width} × {opaqueBounds.height} px
                </span>
              </div>
            )}
        </div>

        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Phóng to chuẩn <strong>Nearest-Neighbor</strong> giữ sắc nét viền pixel để ghép ảnh HD không bị vỡ hình:
        </p>

        <div className="grid grid-cols-4 gap-1.5">
          {[2, 4, 8, 16].map((factor) => {
            const nextW = baseImage.width * factor;
            const disabled = nextW > 4096 || baseImage.height * factor > 4096;
            return (
              <button
                key={factor}
                disabled={disabled}
                onClick={() => onUpscaleFactor(factor)}
                title={
                  disabled
                    ? 'Vượt quá 4096px'
                    : `Phóng lên ${baseImage.width * factor}x${baseImage.height * factor}px`
                }
                className="py-1.5 rounded bg-zinc-800 hover:bg-pink-600 hover:text-white disabled:opacity-30 text-xs font-semibold text-zinc-200 transition cursor-pointer disabled:cursor-not-allowed"
              >
                {factor}x
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          <input
            type="number"
            min={1}
            max={4096}
            value={customW}
            onChange={(e) => setCustomW(e.target.value)}
            className="w-20 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-200"
            placeholder="Rộng"
          />
          <span className="text-zinc-500 text-xs">×</span>
          <input
            type="number"
            min={1}
            max={4096}
            value={customH}
            onChange={(e) => setCustomH(e.target.value)}
            className="w-20 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-200"
            placeholder="Cao"
          />
          <button
            onClick={() => {
              const w = Math.min(4096, Math.max(1, Number(customW) || baseImage.width));
              const h = Math.min(4096, Math.max(1, Number(customH) || baseImage.height));
              onResizeExact(w, h);
            }}
            className="flex-1 py-1 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 cursor-pointer"
          >
            Đặt px
          </button>
        </div>

        <button
          onClick={onCleanItemEdges}
          disabled={hasStamp}
          title="Xóa các pixel bán trong suốt ở viền ảnh (Alpha Cutout) để khi cầm Item 3D trong Minecraft không bị lỗi viền mờ/răng cưa"
          className="w-full py-1.5 px-2 rounded bg-zinc-800 hover:bg-emerald-600/30 border border-zinc-700 hover:border-emerald-500/50 disabled:opacity-40 text-[11px] font-medium text-zinc-200 transition cursor-pointer"
        >
          Làm sạch viền Item 3D (chống lỗi viền)
        </button>
      </section>

      {/* 2. Stamp / Composite Character Art */}
      <section className="p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
          <ImagePlus className="w-3.5 h-3.5 text-pink-400" />
          <span>2. Stamp / Ghép Ảnh Nhân Vật</span>
        </h3>

        <label className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border border-dashed border-pink-500/50 bg-pink-500/10 hover:bg-pink-500/20 text-pink-200 text-xs font-medium cursor-pointer transition">
          <ImagePlus className="w-4 h-4" />
          <span>
            {hasStamp
              ? 'Đổi ảnh/video Stamp khác...'
              : 'Chọn ảnh tĩnh hoặc WebP/GIF/WebM động'}
          </span>
          <input
            type="file"
            accept="image/*,video/webm,video/mp4,.webp,.webm,.gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadStampFile(f);
              e.currentTarget.value = '';
            }}
          />
        </label>

        {hasStamp && stampFrameCount > 1 && (
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-md p-2.5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-emerald-300 font-medium">
              <span>Stamp Động: {stampFrameCount} frame</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={stampDurationTicks}
                  onChange={(e) =>
                    onChangeStampDurationTicks(Math.max(1, Math.min(200, Number(e.target.value) || 1)))
                  }
                  className="w-12 bg-zinc-950 border border-emerald-700 rounded px-1 py-0.5 text-right font-mono text-emerald-200"
                />
                <span className="font-mono text-[11px]">
                  tick ({(20 / stampDurationTicks).toFixed(1)} FPS)
                </span>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={Math.min(20, stampDurationTicks)}
              onChange={(e) => onChangeStampDurationTicks(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>
        )}

        {hasStamp && (
          <div className="space-y-3 pt-1">
            {/* Auto Flood-Fill Background Removal */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-md p-2.5 space-y-2">
              <label className="flex items-center justify-between text-xs cursor-pointer">
                <span className="flex items-center gap-1.5 font-medium text-zinc-200">
                  <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tự tách nền đơn sắc (Flood-fill)</span>
                </span>
                <input
                  type="checkbox"
                  checked={removeBgEnabled}
                  onChange={(e) => onToggleRemoveBg(e.target.checked)}
                  className="accent-pink-500"
                />
              </label>

              {removeBgEnabled && (
                <div className="space-y-2 pt-1 border-t border-zinc-800/80">
                  <div className="flex gap-1 text-[11px]">
                    <button
                      onClick={() => onChangeRemoveBgMode('corner')}
                      className={`flex-1 py-1 rounded cursor-pointer ${
                        removeBgMode === 'corner'
                          ? 'bg-pink-600 text-white'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      Theo màu góc ảnh
                    </button>
                    <button
                      onClick={() => onChangeRemoveBgMode('white')}
                      className={`flex-1 py-1 rounded cursor-pointer ${
                        removeBgMode === 'white'
                          ? 'bg-pink-600 text-white'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      Tách nền trắng
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Ngưỡng lọc:</span>
                    <input
                      type="number"
                      min={0}
                      max={150}
                      value={removeBgTolerance}
                      onChange={(e) =>
                        onChangeRemoveBgTolerance(Math.max(0, Math.min(150, Number(e.target.value) || 0)))
                      }
                      className="w-14 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-right font-mono text-zinc-200"
                    />
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={90}
                    value={removeBgTolerance}
                    onChange={(e) => onChangeRemoveBgTolerance(Number(e.target.value))}
                    className="w-full accent-pink-500"
                  />
                </div>
              )}
            </div>

            {/* Quick Align & Fit */}
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <button
                onClick={() => onFitStampToPanel(false)}
                className="py-1.5 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center justify-center gap-1 cursor-pointer"
                title="Thu phóng vừa trọn bên trong khung hiển thị"
              >
                <Scan className="w-3 h-3" />
                <span>Vừa khung</span>
              </button>
              <button
                onClick={() => onFitStampToPanel(true)}
                className="py-1.5 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center justify-center gap-1 cursor-pointer"
                title="Lấp kín toàn bộ khung (phù hợp làm Tranh)"
              >
                <Maximize className="w-3 h-3" />
                <span>Lấp đầy</span>
              </button>
              <button
                onClick={onCenterStamp}
                className="py-1.5 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Crosshair className="w-3 h-3" />
                <span>Căn giữa</span>
              </button>
            </div>

            {/* Sliders + Numeric Inputs: Scale, Opacity, Rotation */}
            <div className="space-y-2 text-xs">
              <div>
                <div className="flex items-center justify-between text-zinc-400 mb-0.5">
                  <span>Tỷ lệ ảnh (Scale %)</span>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={Math.round(stampTransform.scale * 100)}
                    onChange={(e) =>
                      onUpdateStampTransform({
                        scale: Math.max(0.01, Math.min(10, (Number(e.target.value) || 1) / 100)),
                      })
                    }
                    className="w-16 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-right font-mono text-zinc-200"
                  />
                </div>
                <input
                  type="range"
                  min={5}
                  max={400}
                  value={Math.min(400, Math.round(stampTransform.scale * 100))}
                  onChange={(e) =>
                    onUpdateStampTransform({ scale: Number(e.target.value) / 100 })
                  }
                  className="w-full accent-pink-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-zinc-400 mb-0.5">
                  <span>Độ rõ / Độ mờ (Opacity %)</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={Math.round(stampTransform.opacity * 100)}
                    onChange={(e) =>
                      onUpdateStampTransform({
                        opacity: Math.max(0.01, Math.min(1, (Number(e.target.value) || 1) / 100)),
                      })
                    }
                    className="w-16 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-right font-mono text-zinc-200"
                  />
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={Math.round(stampTransform.opacity * 100)}
                  onChange={(e) =>
                    onUpdateStampTransform({ opacity: Number(e.target.value) / 100 })
                  }
                  className="w-full accent-pink-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-zinc-400 mb-0.5">
                    <span>Xoay (°)</span>
                    <input
                      type="number"
                      min={-180}
                      max={180}
                      value={stampTransform.rotation}
                      onChange={(e) =>
                        onUpdateStampTransform({
                          rotation: Math.max(-180, Math.min(180, Number(e.target.value) || 0)),
                        })
                      }
                      className="w-16 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-right font-mono text-zinc-200"
                    />
                  </div>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={stampTransform.rotation}
                    onChange={(e) =>
                      onUpdateStampTransform({ rotation: Number(e.target.value) })
                    }
                    className="w-full accent-pink-500"
                  />
                </div>
                <button
                  onClick={() => onUpdateStampTransform({ flipX: !stampTransform.flipX })}
                  title="Lật ngang ảnh"
                  className={`mt-4 p-2 rounded border cursor-pointer ${
                    stampTransform.flipX
                      ? 'bg-pink-600 border-pink-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                  }`}
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Masking & Slot Protection Checkboxes */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-md p-2.5 space-y-2 text-xs">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stampTransform.maskToBaseAlpha}
                  onChange={(e) =>
                    onUpdateStampTransform({ maskToBaseAlpha: e.target.checked })
                  }
                  className="mt-0.5 accent-pink-500"
                />
                <span className="text-zinc-300 leading-snug">
                  <strong>Cắt theo khung gốc:</strong> Không để ảnh tràn ra vùng trong suốt ngoài bảng GUI
                </span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stampTransform.protectGuiSlots}
                  onChange={(e) =>
                    onUpdateStampTransform({ protectGuiSlots: e.target.checked })
                  }
                  className="mt-0.5 accent-pink-500"
                />
                <span className="text-zinc-300 leading-snug">
                  <strong>Giữ ô đồ GUI sắc nét ở trên:</strong> Bảo vệ viền và lưới ô chứa đồ phía trên ảnh nhân vật
                </span>
              </label>

              {isSkyTexture && (
                <label className="flex items-start gap-2 cursor-pointer pt-1 border-t border-zinc-800/80">
                  <input
                    type="checkbox"
                    checked={Boolean(stampTransform.skyboxWarp)}
                    onChange={(e) =>
                      onUpdateStampTransform({ skyboxWarp: e.target.checked })
                    }
                    className="mt-0.5 accent-sky-500"
                  />
                  <span className="text-sky-200 leading-snug">
                    <strong>Tự uốn cong theo khối Skybox 3×2:</strong> Chiếu ảnh Stamp lên 6 mặt bầu trời để vào game không bị gãy góc
                  </span>
                </label>
              )}

              {isBedTexture && (
                <label className="flex items-start gap-2 cursor-pointer pt-1 border-t border-zinc-800/80">
                  <input
                    type="checkbox"
                    checked={Boolean(stampTransform.bedTopSplit)}
                    onChange={(e) =>
                      onUpdateStampTransform({ bedTopSplit: e.target.checked })
                    }
                    className="mt-0.5 accent-pink-500"
                  />
                  <span className="text-pink-200 leading-snug">
                    <strong>Tự ghép liền 2 phần Giường (Đầu + Chăn):</strong> Tự chia ảnh khớp khít vào 2 vùng UV mặt trên của giường Minecraft không bị hở khe
                  </span>
                </label>
              )}
            </div>

            {/* Commit or Cancel Stamp */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onApplyStamp}
                className="flex-1 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  {stampFrameCount > 1 ? 'Áp dụng Stamp Động (Animatica)' : 'Áp dụng Stamp'}
                </span>
              </button>
              <button
                onClick={onCancelStamp}
                className="py-2 px-3 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs flex items-center gap-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Hủy</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 3. GUI Panel Color Tint */}
      <section className="p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-pink-400" />
          <span>3. Nhuộm Màu Nền GUI (Tint)</span>
        </h3>

        <div className="flex flex-wrap gap-1.5">
          {TINT_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setTintHex(p.color)}
              className={`px-2 py-1 rounded text-[11px] border flex items-center gap-1.5 cursor-pointer ${
                tintHex.toLowerCase() === p.color.toLowerCase()
                  ? 'border-pink-400 bg-zinc-800 text-white'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full border border-white/20"
                style={{ backgroundColor: p.color }}
              />
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <input
            type="color"
            value={tintHex}
            onChange={(e) => setTintHex(e.target.value)}
            className="w-8 h-8 rounded bg-transparent border border-zinc-700 cursor-pointer"
          />
          <div className="flex-1">
            <div className="flex items-center justify-between text-zinc-400 text-[11px] mb-0.5">
              <span>Độ đậm màu (%)</span>
              <input
                type="number"
                min={1}
                max={100}
                value={Math.round(tintStrength * 100)}
                onChange={(e) =>
                  setTintStrength(Math.max(0.01, Math.min(1, (Number(e.target.value) || 1) / 100)))
                }
                className="w-14 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-right font-mono text-zinc-200"
              />
            </div>
            <input
              type="range"
              min={10}
              max={100}
              value={Math.round(tintStrength * 100)}
              onChange={(e) => setTintStrength(Number(e.target.value) / 100)}
              className="w-full accent-pink-500"
            />
          </div>
        </div>

        <button
          onClick={() => onApplyTint(tintHex, tintStrength)}
          disabled={hasStamp}
          title={hasStamp ? 'Hãy áp dụng hoặc hủy Stamp trước' : 'Nhuộm các vùng xám #C6C6C6 của bảng GUI'}
          className="w-full py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs font-medium text-zinc-200 transition cursor-pointer"
        >
          Nhuộm nền GUI
        </button>
      </section>

      {/* 4. Animated Texture (.png.mcmeta) */}
      <section className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-pink-400" />
            <span>4. Ảnh Động (.mcmeta)</span>
          </h3>
          {existingAnimSettings && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
              Đang có .mcmeta
            </span>
          )}
        </div>

        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Hỗ trợ <strong>WebP động, GIF, video WebM/MP4</strong> hoặc chọn nhiều ảnh PNG/JPG — web tự tách frame, ghép dải dọc và tạo <code className="text-pink-300">.png.mcmeta</code>.
        </p>

        <label className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-zinc-700 hover:border-pink-500 bg-zinc-950 text-zinc-300 text-xs font-medium cursor-pointer transition">
          <Film className="w-4 h-4 text-pink-400" />
          <span>
            {animExtracting
              ? 'Đang tách khung hình...'
              : animFrames.length > 0
              ? `Đã nạp ${animFrames.length} khung hình (đổi...)`
              : 'Chọn WebP / WebM / GIF / nhiều ảnh'}
          </span>
          <input
            type="file"
            accept="image/*,video/webm,video/mp4,.webp,.webm,.gif"
            multiple
            className="hidden"
            disabled={animExtracting}
            onChange={(e) => {
              if (e.target.files?.length) handleUploadAnimFrames(e.target.files);
              e.currentTarget.value = '';
            }}
          />
        </label>

        {animPreviews.length > 0 && (
          <div className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-md p-2.5">
            <div className="w-14 h-14 rounded checkerboard border border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={animPreviews[animPreviewIdx % animPreviews.length]}
                alt="Preview"
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div className="text-[11px] text-zinc-400 space-y-1 flex-1">
              <div className="flex items-center justify-between text-zinc-200 font-medium">
                <span>Xem trước</span>
                <span className="font-mono text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded">
                  Frame {(animPreviewIdx % animFrames.length) + 1} / {animFrames.length}
                </span>
              </div>
              <div>
                Tốc độ: <span className="text-pink-300 font-mono">{(20 / animFrametime).toFixed(1)} FPS</span>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer text-zinc-300">
                <input
                  type="checkbox"
                  checked={animRemoveBg}
                  onChange={(e) => setAnimRemoveBg(e.target.checked)}
                  className="accent-pink-500"
                />
                <span>Tự tách nền từng frame</span>
              </label>
            </div>
          </div>
        )}

        <div className="space-y-2 text-xs">
          {animFrames.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Cỡ mỗi frame:</span>
              <select
                value={animFrameSize}
                onChange={(e) => setAnimFrameSize(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200"
              >
                {[32, 64, 128, 160, 256, 512].map((sz) => (
                  <option key={sz} value={sz}>
                    {sz} × {sz} px
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-0.5">
              <span>Thời gian mỗi frame (tick)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={animFrametime}
                  onChange={(e) =>
                    setAnimFrametime(Math.max(1, Math.min(200, Number(e.target.value) || 1)))
                  }
                  className="w-14 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-right font-mono text-zinc-200"
                />
                <span className="font-mono text-[11px] text-pink-300">
                  ({(20 / animFrametime).toFixed(1)} FPS)
                </span>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={Math.min(20, animFrametime)}
              onChange={(e) => setAnimFrametime(Number(e.target.value))}
              className="w-full accent-pink-500"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
            <input
              type="checkbox"
              checked={animInterpolate}
              onChange={(e) => setAnimInterpolate(e.target.checked)}
              className="accent-pink-500"
            />
            <span>Chuyển mượt giữa các frame (interpolate)</span>
          </label>
        </div>

        <button
          onClick={() => {
            const sheet =
              animFrames.length > 0
                ? buildVerticalSpriteSheet(animFrames, animFrameSize, { removeBg: animRemoveBg })
                : null;
            onApplyAnimation(sheet, { frametime: animFrametime, interpolate: animInterpolate });
          }}
          className="w-full py-2 rounded-md bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold transition cursor-pointer"
        >
          {animFrames.length > 0
            ? 'Ghép Ảnh Động & Lưu .mcmeta'
            : 'Lưu cài đặt .mcmeta cho texture này'}
        </button>
      </section>

      {/* 5. 360° Panorama -> 3x2 Cubemap Skybox Projection */}
      {isSkyTexture && (
        <section className="p-4 space-y-3 bg-sky-950/20">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            <span>5. Uốn Ảnh 360° → Skybox 3×2</span>
          </h3>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Tự động chiếu & uốn cong ảnh toàn cảnh (Panorama/360°) sang chuẩn 6 mặt khối lập phương <strong>OptiFine / Skyboxify</strong> để không bị gãy góc khi nhìn lên trời.
          </p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Độ nét mỗi mặt:</span>
            <select
              value={skyFaceSize}
              onChange={(e) => setSkyFaceSize(Number(e.target.value))}
              className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200"
            >
              <option value={256}>256px (768×512)</option>
              <option value={512}>512px (1536×1024 - Chuẩn HD)</option>
              <option value={1024}>1024px (3072×2048 - 4K)</option>
            </select>
          </div>
          <label className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer transition">
            <Globe className="w-4 h-4" />
            <span>Chọn ảnh 360° / Panorama để uốn</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const raw = await fileToRawImage(f);
                  const projected = equirectangularToOptifineSkybox(raw, skyFaceSize);
                  onApplyProjectedSkybox(projected);
                }
                e.currentTarget.value = '';
              }}
            />
          </label>
        </section>
      )}
    </aside>
  );
};
