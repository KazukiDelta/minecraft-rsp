import React, { useEffect, useMemo, useState } from 'react';
import {
  FileJson,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Plus,
  Download,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Wand2,
} from 'lucide-react';

interface JsonEditorViewProps {
  selectedPath: string | null;
  fileBytes: Uint8Array | null;
  onSaveFile: (path: string, content: string) => Promise<void>;
  onDeleteFile: (path: string) => Promise<void>;
  onCreateOrUploadFile: (path: string, content: string) => Promise<void>;
}

const JSON_TEMPLATES: { label: string; path: string; content: string }[] = [
  {
    label: 'sounds.json (Âm thanh)',
    path: 'assets/minecraft/sounds.json',
    content: JSON.stringify(
      {
        'ui.button.click': {
          replace: true,
          sounds: ['random/click'],
        },
      },
      null,
      2
    ),
  },
  {
    label: 'FabricSkyboxes Sky (Bầu trời ngày)',
    path: 'assets/fabricskyboxes/sky/custom_day.json',
    content: JSON.stringify(
      {
        schemaVersion: 2,
        type: 'square-textured',
        textures: {
          north: 'fabricskyboxes:sky/day_north.png',
          south: 'fabricskyboxes:sky/day_south.png',
          east: 'fabricskyboxes:sky/day_east.png',
          west: 'fabricskyboxes:sky/day_west.png',
          top: 'fabricskyboxes:sky/day_top.png',
          bottom: 'fabricskyboxes:sky/day_bottom.png',
        },
        blend: { type: 'replace' },
        properties: {
          fade: {
            alwaysOn: false,
            startFadeIn: 23000,
            endFadeIn: 500,
            startFadeOut: 12000,
            endFadeOut: 13500,
          },
          shouldRotate: true,
        },
      },
      null,
      2
    ),
  },
  {
    label: 'Model Item 2D',
    path: 'assets/minecraft/models/item/custom_item.json',
    content: JSON.stringify(
      {
        parent: 'minecraft:item/generated',
        textures: {
          layer0: 'minecraft:item/diamond_sword',
        },
      },
      null,
      2
    ),
  },
];

export const JsonEditorView: React.FC<JsonEditorViewProps> = ({
  selectedPath,
  fileBytes,
  onSaveFile,
  onDeleteFile,
  onCreateOrUploadFile,
}) => {
  const [text, setText] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newPath, setNewPath] = useState('assets/minecraft/sounds.json');

  useEffect(() => {
    if (!selectedPath || !fileBytes) {
      setText('');
      setOriginalText('');
      return;
    }
    const decoded = new TextDecoder().decode(fileBytes);
    setText(decoded);
    setOriginalText(decoded);
    setSavedFeedback(false);
  }, [selectedPath, fileBytes]);

  const isJsonLike = Boolean(selectedPath && /\.(json|mcmeta)$/i.test(selectedPath));
  const isDirty = text !== originalText;

  const jsonValidation = useMemo(() => {
    if (!isJsonLike || !text.trim()) return { valid: true, error: null as string | null };
    try {
      JSON.parse(text);
      return { valid: true, error: null as string | null };
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : 'Cú pháp JSON không hợp lệ',
      };
    }
  }, [isJsonLike, text]);

  const isFabricSkyboxJson = Boolean(
    selectedPath && selectedPath.includes('fabricskyboxes/') && selectedPath.endsWith('.json')
  );

  const handleSave = async () => {
    if (!selectedPath) return;
    await onSaveFile(selectedPath, text);
    setOriginalText(text);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 1800);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        if (selectedPath) {
          e.preventDefault();
          void handleSave();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(text);
      setText(JSON.stringify(parsed, null, 2));
    } catch {
      // Keep invalid text so user can fix error shown in banner
    }
  };

  const handleMinifyJson = () => {
    try {
      const parsed = JSON.parse(text);
      setText(JSON.stringify(parsed));
    } catch {
      // ignore
    }
  };

  const handleQuickPatchSkybox = (mode: 'replaceBlend' | 'removeConditions' | 'alwaysOn') => {
    try {
      const parsed = JSON.parse(text);
      if (mode === 'replaceBlend') {
        if (typeof parsed.blend === 'object' && parsed.blend !== null) {
          parsed.blend.type = 'replace';
        } else {
          parsed.blend = { type: 'replace' };
        }
      } else if (mode === 'removeConditions') {
        delete parsed.conditions;
      } else if (mode === 'alwaysOn') {
        parsed.properties = parsed.properties || {};
        parsed.properties.fade = { ...(parsed.properties.fade || {}), alwaysOn: true };
      }
      setText(JSON.stringify(parsed, null, 2));
    } catch {
      // ignore if JSON currently invalid
    }
  };

  const handleUploadLocalJson = async (file: File) => {
    const content = await file.text();
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const defaultTarget =
      cleanName.toLowerCase() === 'sounds.json'
        ? 'assets/minecraft/sounds.json'
        : cleanName.toLowerCase().endsWith('.json')
        ? `assets/fabricskyboxes/sky/${cleanName}`
        : `assets/minecraft/${cleanName}`;
    await onCreateOrUploadFile(defaultTarget, content);
  };

  const handleDownloadSingle = () => {
    if (!selectedPath) return;
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedPath.split('/').pop() || 'file.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const lineCount = text ? text.split('\n').length : 0;

  return (
    <main className="flex-1 flex flex-col bg-zinc-950 min-w-0 h-full overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-12 bg-zinc-900 border-b border-zinc-800 px-3 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileJson className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-mono text-zinc-200 truncate">
            {selectedPath || 'Chưa chọn file JSON / Config'}
          </span>
          {isDirty && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-medium shrink-0">
              Chưa lưu
            </span>
          )}
          {savedFeedback && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-medium flex items-center gap-1 shrink-0">
              <CheckCircle2 className="w-3 h-3" /> Đã lưu
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <label className="px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs text-zinc-200 flex items-center gap-1.5 cursor-pointer transition">
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span>Mở file JSON/Text</span>
            <input
              type="file"
              accept=".json,.mcmeta,.properties,.txt,.fsh,.vsh,.glsl"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUploadLocalJson(f);
                e.currentTarget.value = '';
              }}
            />
          </label>

          <button
            onClick={() => setCreatingNew((v) => !v)}
            className="px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs text-zinc-200 flex items-center gap-1 cursor-pointer transition"
          >
            <Plus className="w-3.5 h-3.5 text-pink-400" />
            <span>Tạo mới</span>
          </button>

          {selectedPath && (
            <>
              {isJsonLike && (
                <>
                  <button
                    onClick={handleFormatJson}
                    disabled={!jsonValidation.valid}
                    title="Làm đẹp định dạng JSON (2 spaces)"
                    className="px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs text-zinc-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                    <span>Format</span>
                  </button>
                  <button
                    onClick={handleMinifyJson}
                    disabled={!jsonValidation.valid}
                    title="Nén gọn JSON trên 1 dòng"
                    className="px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs text-zinc-300 cursor-pointer"
                  >
                    Minify
                  </button>
                </>
              )}

              <button
                onClick={() => setText(originalText)}
                disabled={!isDirty}
                title="Hoàn tác thay đổi chưa lưu"
                className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleDownloadSingle}
                title="Tải riêng file này về máy"
                className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => void handleSave()}
                disabled={!isDirty}
                className="px-3 py-1.5 rounded bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu (Ctrl+S)</span>
              </button>

              <button
                onClick={() => void onDeleteFile(selectedPath)}
                title="Xóa file này khỏi pack"
                className="p-1.5 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Create New File Bar */}
      {creatingNew && (
        <div className="bg-zinc-900/95 border-b border-zinc-800 p-3 space-y-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-400">Đường dẫn trong pack:</span>
            <input
              type="text"
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder="assets/minecraft/sounds.json"
              className="flex-1 min-w-60 bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1 text-xs font-mono text-zinc-100 focus:outline-none focus:border-pink-500"
            />
            <button
              onClick={async () => {
                const clean = newPath.trim().replace(/^\/+/, '');
                if (!clean) return;
                await onCreateOrUploadFile(clean, '{\n  \n}\n');
                setCreatingNew(false);
              }}
              className="px-3 py-1 rounded bg-pink-600 hover:bg-pink-500 text-white text-xs font-medium cursor-pointer"
            >
              Tạo file trống
            </button>
            <button
              onClick={() => setCreatingNew(false)}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs cursor-pointer"
            >
              Hủy
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-zinc-500">Mẫu tạo nhanh:</span>
            {JSON_TEMPLATES.map((tpl) => (
              <button
                key={tpl.path}
                onClick={async () => {
                  await onCreateOrUploadFile(tpl.path, tpl.content);
                  setCreatingNew(false);
                }}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 cursor-pointer"
              >
                + {tpl.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FabricSkyboxes Quick Patch Bar */}
      {isFabricSkyboxJson && (
        <div className="bg-sky-950/30 border-b border-sky-500/30 px-3 py-2 flex flex-wrap items-center gap-2 text-xs shrink-0">
          <span className="text-sky-300 font-medium flex items-center gap-1">
            <Wand2 className="w-3.5 h-3.5" /> Sửa nhanh Skybox JSON:
          </span>
          <button
            onClick={() => handleQuickPatchSkybox('replaceBlend')}
            className="px-2 py-1 rounded bg-sky-600/25 hover:bg-sky-600/40 border border-sky-500/40 text-sky-200 cursor-pointer"
          >
            blend → replace (chống mờ)
          </button>
          <button
            onClick={() => handleQuickPatchSkybox('removeConditions')}
            className="px-2 py-1 rounded bg-sky-600/25 hover:bg-sky-600/40 border border-sky-500/40 text-sky-200 cursor-pointer"
          >
            Xóa conditions (không mất sky khi xuống nước/mưa)
          </button>
          <button
            onClick={() => handleQuickPatchSkybox('alwaysOn')}
            className="px-2 py-1 rounded bg-sky-600/25 hover:bg-sky-600/40 border border-sky-500/40 text-sky-200 cursor-pointer"
          >
            alwaysOn: true (hiện cả ngày lẫn đêm)
          </button>
        </div>
      )}

      {/* JSON Syntax Status Banner */}
      {selectedPath && isJsonLike && !jsonValidation.valid && (
        <div className="bg-rose-950/60 border-b border-rose-500/50 px-3 py-2 text-xs text-rose-200 flex items-center gap-2 shrink-0">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="font-mono truncate">Lỗi cú pháp JSON: {jsonValidation.error}</span>
        </div>
      )}

      {/* Editor Area */}
      {selectedPath ? (
        <div className="flex-1 flex flex-col min-h-0 relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full bg-zinc-950 text-zinc-100 font-mono text-xs leading-relaxed p-4 resize-none focus:outline-none selection:bg-pink-500/30"
            placeholder="Nhập nội dung JSON / Config..."
          />
          <div className="h-7 bg-zinc-900 border-t border-zinc-800 px-3 flex items-center justify-between text-[11px] text-zinc-400 shrink-0">
            <span>
              {lineCount} dòng • {new TextEncoder().encode(text).length.toLocaleString()} bytes
            </span>
            <span>
              {isJsonLike
                ? jsonValidation.valid
                  ? '✓ JSON hợp lệ'
                  : '✕ JSON đang có lỗi cú pháp'
                : 'File văn bản / cấu hình'}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <FileJson className="w-7 h-7 text-amber-400" />
          </div>
          <div className="space-y-1 max-w-md">
            <h2 className="text-sm font-semibold text-zinc-200">Trình chỉnh sửa JSON & Config trực tiếp</h2>
            <p className="text-xs text-zinc-400">
              Chọn một file JSON ở cột bên trái (như <code className="text-amber-300">fabricskyboxes/sky/*.json</code>,{' '}
              <code className="text-amber-300">sounds.json</code>, <code className="text-amber-300">models/*.json</code>), hoặc mở trực tiếp file JSON từ máy tính để chỉnh và đóng gói vào Resource Pack.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <label className="px-3.5 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition">
              <Upload className="w-4 h-4" />
              <span>Mở file .json từ máy</span>
              <input
                type="file"
                accept=".json,.mcmeta,.properties,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUploadLocalJson(f);
                  e.currentTarget.value = '';
                }}
              />
            </label>
            <button
              onClick={() => setCreatingNew(true)}
              className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition"
            >
              <Plus className="w-4 h-4 text-pink-400" />
              <span>Tạo file JSON mới</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
};
