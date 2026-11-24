import React, { useEffect, useRef, useState } from 'react';
import {
  Move,
  Pencil,
  Eraser,
  Pipette,
  Hand,
  ZoomIn,
  ZoomOut,
  Grid,
  Undo2,
  Redo2,
  RotateCcw,
  Maximize2,
} from 'lucide-react';
import { RawImage, StampTransform, hexToRgb } from '../lib/canvasEngine';

export type EditorTool = 'stamp' | 'pencil' | 'eraser' | 'eyedropper' | 'pan';

interface EditorCanvasProps {
  displayImage: RawImage | null;
  activeStamp: RawImage | null;
  stampTransform: StampTransform;
  onUpdateStampTransform: (patch: Partial<StampTransform>) => void;
  tool: EditorTool;
  onSelectTool: (t: EditorTool) => void;
  brushColor: string;
  onPickColor: (hex: string) => void;
  brushSize: number;
  onBrushSizeChange: (s: number) => void;
  onCommitPixelEdit: (next: RawImage) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onResetVanilla: () => void;
  textureName: string;
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  displayImage,
  activeStamp,
  stampTransform,
  onUpdateStampTransform,
  tool,
  onSelectTool,
  brushColor,
  onPickColor,
  brushSize,
  onBrushSizeChange,
  onCommitPixelEdit,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onResetVanilla,
  textureName,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [zoom, setZoom] = useState<number>(2);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState<boolean>(false);

  const dragStateRef = useRef<{
    mode: 'none' | 'pan' | 'stamp' | 'draw';
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
    startStampX: number;
    startStampY: number;
    workingBuffer: RawImage | null;
  }>({
    mode: 'none',
    startClientX: 0,
    startClientY: 0,
    startPanX: 0,
    startPanY: 0,
    startStampX: 0,
    startStampY: 0,
    workingBuffer: null,
  });

  // Fit zoom automatically when image dimensions change drastically
  const fitToViewport = () => {
    if (!displayImage || !viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const pad = 80;
    const availW = Math.max(100, rect.width - pad);
    const availH = Math.max(100, rect.height - pad);
    const ideal = Math.min(availW / displayImage.width, availH / displayImage.height);
    setZoom(Math.max(0.15, Math.min(24, Number(ideal.toFixed(2)))));
    setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    fitToViewport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textureName, displayImage?.width, displayImage?.height]);

  // Render displayImage onto visible canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !displayImage) return;
    canvas.width = displayImage.width;
    canvas.height = displayImage.height;
    const ctx = canvas.getContext('2d')!;
    const imgData = new ImageData(
      new Uint8ClampedArray(displayImage.data),
      displayImage.width,
      displayImage.height
    );
    ctx.putImageData(imgData, 0, 0);
  }, [displayImage]);

  const clientToCanvasCoords = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  const paintAt = (buf: RawImage, cx: number, cy: number, erase: boolean) => {
    const px = Math.floor(cx);
    const py = Math.floor(cy);
    const half = Math.floor(brushSize / 2);
    const [r, g, b] = hexToRgb(brushColor);

    for (let dy = -half; dy < brushSize - half; dy++) {
      for (let dx = -half; dx < brushSize - half; dx++) {
        const tx = px + dx;
        const ty = py + dy;
        if (tx >= 0 && tx < buf.width && ty >= 0 && ty < buf.height) {
          const idx = (ty * buf.width + tx) * 4;
          if (erase) {
            buf.data[idx + 3] = 0;
          } else {
            buf.data[idx] = r;
            buf.data[idx + 1] = g;
            buf.data[idx + 2] = b;
            buf.data[idx + 3] = 255;
          }
        }
      }
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(new ImageData(new Uint8ClampedArray(buf.data), buf.width, buf.height), 0, 0);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!displayImage) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);

    // Middle mouse button or Pan tool -> pan
    if (e.button === 1 || tool === 'pan') {
      dragStateRef.current = {
        ...dragStateRef.current,
        mode: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      };
      return;
    }

    const coords = clientToCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    if (tool === 'stamp' && activeStamp) {
      dragStateRef.current = {
        ...dragStateRef.current,
        mode: 'stamp',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startStampX: stampTransform.x,
        startStampY: stampTransform.y,
      };
      return;
    }

    if (tool === 'eyedropper') {
      const ix = Math.floor(coords.x);
      const iy = Math.floor(coords.y);
      if (ix >= 0 && ix < displayImage.width && iy >= 0 && iy < displayImage.height) {
        const idx = (iy * displayImage.width + ix) * 4;
        if (displayImage.data[idx + 3] > 0) {
          const hex =
            '#' +
            [displayImage.data[idx], displayImage.data[idx + 1], displayImage.data[idx + 2]]
              .map((v) => v.toString(16).padStart(2, '0'))
              .join('');
          onPickColor(hex);
        }
      }
      return;
    }

    if ((tool === 'pencil' || tool === 'eraser') && !activeStamp) {
      const copy: RawImage = {
        width: displayImage.width,
        height: displayImage.height,
        data: new Uint8ClampedArray(displayImage.data),
      };
      dragStateRef.current = {
        ...dragStateRef.current,
        mode: 'draw',
        workingBuffer: copy,
      };
      paintAt(copy, coords.x, coords.y, tool === 'eraser');
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (st.mode === 'none') return;

    if (st.mode === 'pan') {
      setPan({
        x: st.startPanX + (e.clientX - st.startClientX),
        y: st.startPanY + (e.clientY - st.startClientY),
      });
      return;
    }

    if (st.mode === 'stamp') {
      const dx = (e.clientX - st.startClientX) / zoom;
      const dy = (e.clientY - st.startClientY) / zoom;
      onUpdateStampTransform({
        x: Math.round(st.startStampX + dx),
        y: Math.round(st.startStampY + dy),
      });
      return;
    }

    if (st.mode === 'draw' && st.workingBuffer) {
      const coords = clientToCanvasCoords(e.clientX, e.clientY);
      if (coords) {
        paintAt(st.workingBuffer, coords.x, coords.y, tool === 'eraser');
      }
    }
  };

  const handlePointerUp = () => {
    const st = dragStateRef.current;
    if (st.mode === 'draw' && st.workingBuffer) {
      onCommitPixelEdit(st.workingBuffer);
    }
    dragStateRef.current = { ...st, mode: 'none', workingBuffer: null };
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.altKey && activeStamp) {
      const factor = e.deltaY < 0 ? 1.06 : 0.94;
      onUpdateStampTransform({
        scale: Math.max(0.02, Math.min(10, Number((stampTransform.scale * factor).toFixed(3)))),
      });
      return;
    }
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom((z) => Math.max(0.1, Math.min(32, Number((z * factor).toFixed(2)))));
  };

  return (
    <main className="flex-1 flex flex-col bg-zinc-950 h-full min-w-0">
      {/* Top Canvas Toolbar */}
      <div className="h-12 border-b border-zinc-800 bg-zinc-900/90 px-3 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1">
          <ToolBtn
            active={tool === 'stamp'}
            onClick={() => onSelectTool('stamp')}
            title="Di chuyển / Kéo thả ảnh Stamp"
            icon={<Move className="w-4 h-4" />}
            label="Stamp"
          />
          <ToolBtn
            active={tool === 'pencil'}
            onClick={() => onSelectTool('pencil')}
            disabled={!!activeStamp}
            title={activeStamp ? 'Áp dụng hoặc hủy Stamp trước khi vẽ pixel' : 'Bút vẽ Pixel'}
            icon={<Pencil className="w-4 h-4" />}
            label="Vẽ"
          />
          <ToolBtn
            active={tool === 'eraser'}
            onClick={() => onSelectTool('eraser')}
            disabled={!!activeStamp}
            title="Tẩy trong suốt"
            icon={<Eraser className="w-4 h-4" />}
            label="Tẩy"
          />
          <ToolBtn
            active={tool === 'eyedropper'}
            onClick={() => onSelectTool('eyedropper')}
            title="Hút màu"
            icon={<Pipette className="w-4 h-4" />}
          />
          <ToolBtn
            active={tool === 'pan'}
            onClick={() => onSelectTool('pan')}
            title="Kéo khung nhìn (hoặc giữ chuột giữa)"
            icon={<Hand className="w-4 h-4" />}
          />

          <div className="h-5 w-px bg-zinc-800 mx-1.5" />

          {(tool === 'pencil' || tool === 'eraser') && (
            <div className="flex items-center gap-2 text-xs text-zinc-300 mr-2">
              {tool === 'pencil' && (
                <input
                  type="color"
                  value={brushColor}
                  onChange={(e) => onPickColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border border-zinc-700"
                  title="Màu bút vẽ"
                />
              )}
              <span className="text-zinc-400">Cỡ:</span>
              <input
                type="number"
                min={1}
                max={64}
                value={brushSize}
                onChange={(e) =>
                  onBrushSizeChange(Math.max(1, Math.min(64, Number(e.target.value) || 1)))
                }
                className="w-12 bg-zinc-950 border border-zinc-700 rounded px-1 py-0.5 text-center font-mono text-zinc-200"
              />
              <input
                type="range"
                min={1}
                max={32}
                value={Math.min(32, brushSize)}
                onChange={(e) => onBrushSizeChange(Number(e.target.value))}
                className="w-20 accent-pink-500"
              />
            </div>
          )}

          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Hoàn tác (Ctrl+Z)"
            className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Làm lại (Ctrl+Y)"
            className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onResetVanilla}
            title="Khôi phục texture gốc Minecraft 26.3"
            className="px-2 py-1 rounded text-xs hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Gốc</span>
          </button>
        </div>

        {/* Zoom & Grid Controls */}
        <div className="flex items-center gap-1.5 text-xs">
          {displayImage && (
            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
              {displayImage.width} × {displayImage.height}px
            </span>
          )}
          <button
            onClick={() => setShowGrid((g) => !g)}
            title="Bật/tắt lưới pixel (khi zoom lớn)"
            className={`p-1.5 rounded cursor-pointer ${
              showGrid ? 'bg-pink-600 text-white' : 'hover:bg-zinc-800 text-zinc-400'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.1, Number((z / 1.25).toFixed(2))))}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="w-14 text-center font-mono text-zinc-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(32, Number((z * 1.25).toFixed(2))))}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={fitToViewport}
            title="Vừa màn hình"
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Interactive Canvas Viewport */}
      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className={`flex-1 relative overflow-hidden flex items-center justify-center bg-zinc-950 ${
          tool === 'pan'
            ? 'cursor-grab active:cursor-grabbing'
            : activeStamp && tool === 'stamp'
            ? 'cursor-move'
            : 'cursor-crosshair'
        }`}
      >
        {!displayImage ? (
          <div className="text-zinc-500 text-sm">Chọn một texture bên trái để bắt đầu chỉnh sửa</div>
        ) : (
          <div
            style={{
              width: displayImage.width * zoom,
              height: displayImage.height * zoom,
              transform: `translate(${pan.x}px, ${pan.y}px)`,
            }}
            className="relative checkerboard shadow-2xl border border-zinc-700/80 shrink-0"
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full block"
              style={{ imageRendering: 'pixelated' }}
            />

            {/* Optional Pixel Grid when zoomed in */}
            {showGrid && zoom >= 4 && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundSize: `${zoom}px ${zoom}px`,
                  backgroundImage:
                    'linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)',
                }}
              />
            )}

            {/* Stamp Bounding Outline Indicator */}
            {activeStamp && (
              <div
                className="absolute border-2 border-dashed border-pink-400 pointer-events-none shadow-sm"
                style={{
                  width: activeStamp.width * stampTransform.scale * zoom,
                  height: activeStamp.height * stampTransform.scale * zoom,
                  left:
                    (stampTransform.x - (activeStamp.width * stampTransform.scale) / 2) * zoom,
                  top:
                    (stampTransform.y - (activeStamp.height * stampTransform.scale) / 2) * zoom,
                  transform: `rotate(${stampTransform.rotation}deg)`,
                }}
              />
            )}
          </div>
        )}

        {/* Helpful bottom hint bar */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-zinc-900/90 border border-zinc-800 px-3 py-1 rounded-full text-[11px] text-zinc-400 pointer-events-none flex items-center gap-3">
          <span>Lăn chuột: Phóng to/Thu nhỏ</span>
          <span>•</span>
          <span>Chuột giữa: Kéo khung nhìn</span>
          {activeStamp && (
            <>
              <span>•</span>
              <span className="text-pink-400 font-medium">
                Kéo chuột để di chuyển ảnh Stamp | Giữ Alt + Lăn chuột để đổi kích thước Stamp
              </span>
            </>
          )}
        </div>
      </div>
    </main>
  );
};

const ToolBtn: React.FC<{
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  icon: React.ReactNode;
  label?: string;
}> = ({ active, onClick, disabled, title, icon, label }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
      active
        ? 'bg-pink-600 text-white shadow-sm'
        : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
    }`}
  >
    {icon}
    {label && <span>{label}</span>}
  </button>
);
