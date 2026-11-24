import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, CloudSun, RotateCw, X, Check } from 'lucide-react';
import { RawImage, rawImageToCanvas } from '../lib/canvasEngine';
import { AnimationSettings } from '../lib/animationEngine';
import { projectStampOntoSkybox3D } from '../lib/skyboxProjector';

interface Preview3DModalProps {
  open: boolean;
  onClose: () => void;
  image: RawImage | null;
  baseImage: RawImage | null;
  activeStamp: RawImage | null;
  stampOpacity: number;
  stampFlipX: boolean;
  stampRotation: number;
  onCommitSkybox3DStamp: (result: RawImage) => void;
  category: string;
  textureName: string;
  animSettings: AnimationSettings | null;
}

type PreviewMode = 'skybox' | 'item' | 'block';

export const Preview3DModal: React.FC<Preview3DModalProps> = ({
  open,
  onClose,
  image,
  baseImage,
  activeStamp,
  stampOpacity,
  stampFlipX,
  stampRotation,
  onCommitSkybox3DStamp,
  category,
  textureName,
  animSettings,
}) => {
  const defaultMode: PreviewMode =
    category === 'sky' ? 'skybox' : category === 'block' ? 'block' : 'item';
  const [mode, setMode] = useState<PreviewMode>(defaultMode);
  const [yaw, setYaw] = useState<number>(25);
  const [pitch, setPitch] = useState<number>(category === 'sky' ? 15 : -15);
  const [autoSpin, setAutoSpin] = useState<boolean>(category !== 'sky');
  const [frameIdx, setFrameIdx] = useState<number>(0);
  const [stamp3DSizeDeg, setStamp3DSizeDeg] = useState<number>(50);

  const dragRef = useRef<{ active: boolean; x: number; y: number; yaw: number; pitch: number }>({
    active: false,
    x: 0,
    y: 0,
    yaw: 0,
    pitch: 0,
  });

  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setPitch(defaultMode === 'skybox' ? 15 : -15);
      setAutoSpin(defaultMode !== 'skybox');
    }
  }, [open, defaultMode]);

  // Auto-spin loop
  useEffect(() => {
    if (!open || !autoSpin) return;
    let raf = 0;
    const tick = () => {
      setYaw((y) => (y + 0.6) % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, autoSpin]);

  // Extract frames if vertical animated sprite sheet (height > width and height % width === 0)
  const frameUrls = useMemo(() => {
    if (!open || !image) return [];
    const srcCanvas = rawImageToCanvas(image);
    if (mode !== 'skybox' && image.height > image.width && image.height % image.width === 0) {
      const count = Math.min(60, Math.floor(image.height / image.width));
      const urls: string[] = [];
      const tmp = document.createElement('canvas');
      tmp.width = image.width;
      tmp.height = image.width;
      const ctx = tmp.getContext('2d')!;
      for (let i = 0; i < count; i++) {
        ctx.clearRect(0, 0, tmp.width, tmp.height);
        ctx.drawImage(srcCanvas, 0, i * image.width, image.width, image.width, 0, 0, tmp.width, tmp.height);
        urls.push(tmp.toDataURL('image/png'));
      }
      return urls;
    }
    return [srcCanvas.toDataURL('image/png')];
  }, [open, image, mode]);

  // Animate frames
  useEffect(() => {
    if (!open || frameUrls.length <= 1) return;
    const ms = Math.max(50, (animSettings?.frametime ?? 2) * 50);
    const id = window.setInterval(() => {
      setFrameIdx((i) => (i + 1) % frameUrls.length);
    }, ms);
    return () => window.clearInterval(id);
  }, [open, frameUrls.length, animSettings?.frametime]);

  // Slice 3x2 skybox into 6 individual face data URLs (use baseImage when placing a 3D stamp live)
  const skySourceImage = mode === 'skybox' && activeStamp && baseImage ? baseImage : image;
  const skyFaces = useMemo(() => {
    if (!open || !skySourceImage || mode !== 'skybox') return null;
    const srcCanvas = rawImageToCanvas(skySourceImage);
    const fw = Math.floor(skySourceImage.width / 3);
    const fh = Math.floor(skySourceImage.height / 2);
    if (fw < 2 || fh < 2) return null;

    const slice = (col: number, row: number) => {
      const c = document.createElement('canvas');
      c.width = fw;
      c.height = fh;
      c.getContext('2d')!.drawImage(srcCanvas, col * fw, row * fh, fw, fh, 0, 0, fw, fh);
      return c.toDataURL('image/png');
    };

    return {
      bottom: slice(0, 0),
      top: slice(1, 0),
      south: slice(2, 0),
      west: slice(0, 1),
      north: slice(1, 1),
      east: slice(2, 1),
    };
  }, [open, skySourceImage, mode]);

  const activeStampUrl = useMemo(() => {
    if (!open || !activeStamp) return null;
    return rawImageToCanvas(activeStamp).toDataURL('image/png');
  }, [open, activeStamp]);

  if (!open || !image) return null;

  const activeTexUrl = frameUrls[frameIdx % Math.max(1, frameUrls.length)] || '';
  const skySize = 760;
  const skyHalf = skySize / 2;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    setAutoSpin(false);
    dragRef.current = { active: true, x: e.clientX, y: e.clientY, yaw, pitch };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setYaw(dragRef.current.yaw + dx * 0.45);
    setPitch(Math.max(-85, Math.min(85, dragRef.current.pitch - dy * 0.45)));
  };

  const onPointerUp = () => {
    dragRef.current.active = false;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-4xl h-[82vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Box className="w-4 h-4 text-pink-400" />
            <span>Xem Trước 3D — {textureName}</span>
            {frameUrls.length > 1 && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                Frame {(frameIdx % frameUrls.length) + 1} / {frameUrls.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setMode('skybox')}
              className={`px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer ${
                mode === 'skybox' ? 'bg-sky-600 text-white' : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              <CloudSun className="w-3.5 h-3.5" />
              <span>Bầu trời 360°</span>
            </button>
            <button
              onClick={() => setMode('item')}
              className={`px-2.5 py-1 rounded cursor-pointer ${
                mode === 'item' ? 'bg-pink-600 text-white' : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              Item 3D
            </button>
            <button
              onClick={() => setMode('block')}
              className={`px-2.5 py-1 rounded cursor-pointer ${
                mode === 'block' ? 'bg-pink-600 text-white' : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              Block 3D
            </button>

            <button
              onClick={() => setAutoSpin((s) => !s)}
              className={`ml-2 px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer ${
                autoSpin ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Tự xoay</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3D Viewport */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="flex-1 relative overflow-hidden bg-zinc-950 flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
          style={{ perspective: mode === 'skybox' ? '420px' : '900px' }}
        >
          {mode === 'skybox' && skyFaces && (
            <div
              style={{
                width: skySize,
                height: skySize,
                transformStyle: 'preserve-3d',
                transform: `translateZ(260px) rotateX(${pitch}deg) rotateY(${yaw}deg)`,
              }}
              className="relative"
            >
              {/* Inside-out 6 faces of the Minecraft skybox cube */}
              <SkyFace url={skyFaces.north} size={skySize} transform={`translateZ(-${skyHalf - 1}px)`} />
              <SkyFace url={skyFaces.south} size={skySize} transform={`rotateY(180deg) translateZ(-${skyHalf - 1}px)`} />
              <SkyFace url={skyFaces.east} size={skySize} transform={`rotateY(-90deg) translateZ(-${skyHalf - 1}px)`} />
              <SkyFace url={skyFaces.west} size={skySize} transform={`rotateY(90deg) translateZ(-${skyHalf - 1}px)`} />
              <SkyFace url={skyFaces.top} size={skySize} transform={`rotateX(-90deg) translateZ(-${skyHalf - 1}px)`} />
              <SkyFace url={skyFaces.bottom} size={skySize} transform={`rotateX(90deg) translateZ(-${skyHalf - 1}px)`} />
            </div>
          )}

          {mode === 'item' && (
            <div
              style={{
                width: 240,
                height: 240,
                transformStyle: 'preserve-3d',
                transform: `rotateX(${pitch}deg) rotateY(${yaw}deg)`,
              }}
              className="relative"
            >
              {/* 10 stacked depth layers simulate real Minecraft 3D extruded item thickness */}
              {Array.from({ length: 10 }).map((_, i) => {
                const z = (i - 4.5) * 2.2;
                const isEdge = i > 0 && i < 9;
                return (
                  <img
                    key={i}
                    src={activeTexUrl}
                    alt=""
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    style={{
                      transform: `translateZ(${z}px)`,
                      imageRendering: 'pixelated',
                      filter: isEdge ? 'brightness(0.75)' : 'none',
                    }}
                  />
                );
              })}
            </div>
          )}

          {mode === 'block' && (
            <div
              style={{
                width: 200,
                height: 200,
                transformStyle: 'preserve-3d',
                transform: `rotateX(${pitch}deg) rotateY(${yaw}deg)`,
              }}
              className="relative"
            >
              {[
                'translateZ(100px)',
                'rotateY(180deg) translateZ(100px)',
                'rotateY(90deg) translateZ(100px)',
                'rotateY(-90deg) translateZ(100px)',
                'rotateX(90deg) translateZ(100px)',
                'rotateX(-90deg) translateZ(100px)',
              ].map((t, idx) => (
                <img
                  key={idx}
                  src={activeTexUrl}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-cover border border-white/5 pointer-events-none"
                  style={{ transform: t, imageRendering: 'pixelated' }}
                />
              ))}
            </div>
          )}

          {/* Live 3D Stamp Crosshair Overlay when placing an activeStamp in 360° Skybox */}
          {mode === 'skybox' && activeStampUrl && baseImage && activeStamp && (
            <>
              <img
                src={activeStampUrl}
                alt="3D Stamp Preview"
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 border border-dashed border-pink-400/70"
                style={{
                  height: `${Math.round(stamp3DSizeDeg * 4.5)}px`,
                  transform: `translate(-50%, -50%) rotate(${stampRotation}deg) scaleX(${stampFlipX ? -1 : 1})`,
                  opacity: stampOpacity,
                }}
              />
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute top-3 left-1/2 -translate-x-1/2 bg-zinc-900/95 border border-pink-500/50 px-3.5 py-2 rounded-lg flex items-center gap-3 text-xs shadow-xl"
              >
                <span className="text-zinc-300">Cỡ trên trời:</span>
                <input
                  type="range"
                  min={15}
                  max={110}
                  value={stamp3DSizeDeg}
                  onChange={(e) => setStamp3DSizeDeg(Number(e.target.value))}
                  className="w-28 accent-pink-500"
                />
                <input
                  type="number"
                  min={5}
                  max={150}
                  value={stamp3DSizeDeg}
                  onChange={(e) =>
                    setStamp3DSizeDeg(Math.max(5, Math.min(150, Number(e.target.value) || 50)))
                  }
                  className="w-14 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-center font-mono text-pink-300"
                />
                <span className="text-zinc-400">°</span>
                <button
                  onClick={() => {
                    const projected = projectStampOntoSkybox3D(baseImage, activeStamp, {
                      yawDeg: yaw,
                      pitchDeg: pitch,
                      angularSizeDeg: stamp3DSizeDeg,
                      rotationDeg: stampRotation,
                      opacity: stampOpacity,
                      flipX: stampFlipX,
                    });
                    onCommitSkybox3DStamp(projected);
                  }}
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Đặt nhân vật ngay tại góc nhìn 3D này</span>
                </button>
              </div>
            </>
          )}

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-zinc-900/90 border border-zinc-800 px-3 py-1 rounded-full text-[11px] text-zinc-400 pointer-events-none">
            Kéo chuột để xoay 360° • {mode === 'skybox' ? 'Góc nhìn từ bên trong bầu trời Minecraft' : 'Xem mô hình 3D'}
          </div>
        </div>
      </div>
    </div>
  );
};

const SkyFace: React.FC<{ url: string; size: number; transform: string }> = ({
  url,
  size,
  transform,
}) => (
  <img
    src={url}
    alt=""
    draggable={false}
    style={{
      width: size,
      height: size,
      transform,
      backfaceVisibility: 'visible',
    }}
    className="absolute inset-0 object-cover pointer-events-none"
  />
);
