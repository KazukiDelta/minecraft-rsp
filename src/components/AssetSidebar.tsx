import React, { useMemo, useState } from 'react';
import {
  Search,
  Upload,
  CheckCircle2,
  FolderOpen,
  Sparkles,
  CloudSun,
  Trash2,
  FileJson,
  Volume2,
} from 'lucide-react';
import { TextureEntry } from '../lib/packLoader';
import { isAudioFilePath, isTextEditablePath } from '../lib/audioEngine';

export type WorkspaceMode = 'texture' | 'json' | 'audio';

interface AssetSidebarProps {
  entries: TextureEntry[];
  extraFiles: Map<string, Uint8Array>;
  workspaceMode: WorkspaceMode;
  selectedPath: string | null;
  selectedExtraPath: string | null;
  modifiedPaths: Set<string>;
  onSelectTexture: (entry: TextureEntry) => void;
  onSelectExtraFile: (path: string, mode: 'json' | 'audio') => void;
  onSwitchWorkspaceMode: (mode: WorkspaceMode) => void;
  onDeleteModified: (entry: TextureEntry) => void;
  onDeleteExtraFile: (path: string) => void;
  onImportTemplatePack: (file: File) => void;
  onCreateSkybox: () => void;
  loadingArchive: boolean;
}

const CATEGORIES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'gui', label: 'GUI' },
  { id: 'sky', label: 'Bầu trời' },
  { id: 'painting', label: 'Tranh' },
  { id: 'item', label: 'Item' },
  { id: 'block', label: 'Block' },
  { id: 'modified', label: 'Đã sửa' },
  { id: 'json', label: 'JSON' },
  { id: 'audio', label: 'Âm thanh' },
];

export const AssetSidebar: React.FC<AssetSidebarProps> = ({
  entries,
  extraFiles,
  workspaceMode,
  selectedPath,
  selectedExtraPath,
  modifiedPaths,
  onSelectTexture,
  onSelectExtraFile,
  onSwitchWorkspaceMode,
  onDeleteModified,
  onDeleteExtraFile,
  onImportTemplatePack,
  onCreateSkybox,
  loadingArchive,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('gui');

  const jsonPaths = useMemo(
    () => Array.from(extraFiles.keys()).filter(isTextEditablePath).sort(),
    [extraFiles]
  );

  const audioPaths = useMemo(
    () => Array.from(extraFiles.keys()).filter(isAudioFilePath).sort(),
    [extraFiles]
  );

  const activeCategory =
    workspaceMode === 'json'
      ? 'json'
      : workspaceMode === 'audio'
      ? 'audio'
      : category === 'json' || category === 'audio'
      ? 'gui'
      : category;

  const filteredTextures = useMemo(() => {
    if (activeCategory === 'json' || activeCategory === 'audio') return [];
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (activeCategory === 'modified' && !modifiedPaths.has(e.path)) return false;
      if (activeCategory !== 'all' && activeCategory !== 'modified' && e.category !== activeCategory)
        return false;
      if (q && !e.relPath.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, activeCategory, query, modifiedPaths]);

  const filteredExtraPaths = useMemo(() => {
    const source = activeCategory === 'json' ? jsonPaths : activeCategory === 'audio' ? audioPaths : [];
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter((p) => p.toLowerCase().includes(q));
  }, [activeCategory, jsonPaths, audioPaths, query]);

  const visibleTextures = filteredTextures.slice(0, 200);
  const isExtraList = activeCategory === 'json' || activeCategory === 'audio';
  const totalCount = isExtraList ? filteredExtraPaths.length : filteredTextures.length;

  const handleCategoryClick = (catId: string) => {
    setCategory(catId);
    if (catId === 'json') {
      onSwitchWorkspaceMode('json');
    } else if (catId === 'audio') {
      onSwitchWorkspaceMode('audio');
    } else {
      onSwitchWorkspaceMode('texture');
    }
  };

  return (
    <aside className="w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full shrink-0">
      <div className="p-3 border-b border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 font-semibold text-sm text-zinc-100">
            <Sparkles className="w-4 h-4 text-pink-400" />
            <span>Kho Tài Nguyên</span>
          </div>
          <label
            title="Nhập một Resource Pack mẫu (.zip) để chỉnh sửa tiếp trên nền 26.3"
            className="cursor-pointer inline-flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1.5 rounded-md border border-zinc-700 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{loadingArchive ? 'Đang nhập...' : 'Import Pack mẫu'}</span>
            <input
              type="file"
              accept=".jar,.zip"
              className="hidden"
              disabled={loadingArchive}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportTemplatePack(f);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              activeCategory === 'json'
                ? 'Tìm: sky, sounds.json, model...'
                : activeCategory === 'audio'
                ? 'Tìm: click, hit, music, ogg...'
                : 'Tìm: inventory, sun, sky, alban, totem...'
            }
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-pink-500"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id;
            const countBadge =
              cat.id === 'modified'
                ? modifiedPaths.size
                : cat.id === 'json'
                ? jsonPaths.length
                : cat.id === 'audio'
                ? audioPaths.length
                : null;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                className={`px-2 py-1 rounded text-xs font-medium transition flex items-center gap-1 cursor-pointer ${
                  active
                    ? cat.id === 'json'
                      ? 'bg-amber-600 text-white'
                      : cat.id === 'audio'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-pink-600 text-white'
                    : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <span>{cat.label}</span>
                {countBadge !== null && countBadge > 0 && (
                  <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
                    {countBadge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeCategory === 'sky' && (
          <button
            onClick={onCreateSkybox}
            className="w-full py-1.5 px-2.5 rounded-md bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-200 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition"
          >
            <CloudSun className="w-4 h-4" />
            <span>+ Tạo Custom Skybox 3×2 (OptiFine/Skyboxify)</span>
          </button>
        )}
      </div>

      <div className="px-3 py-1.5 text-[11px] text-zinc-400 border-b border-zinc-800/60 flex justify-between">
        <span>Tìm thấy {totalCount.toLocaleString()} file</span>
        {!isExtraList && filteredTextures.length > 200 && <span>Hiển thị 200 đầu tiên</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {isExtraList ? (
          filteredExtraPaths.length === 0 ? (
            <div className="text-center py-12 px-4 text-zinc-500 text-xs space-y-2">
              {activeCategory === 'json' ? (
                <FileJson className="w-7 h-7 mx-auto opacity-50 text-amber-400" />
              ) : (
                <Volume2 className="w-7 h-7 mx-auto opacity-50 text-emerald-400" />
              )}
              <p>
                {activeCategory === 'json'
                  ? 'Chưa có file JSON/Config nào trong pack. Import pack mẫu hoặc mở/tạo file ở khung bên phải.'
                  : 'Chưa có file âm thanh nào trong pack. Bấm Upload ở khung bên phải để thêm âm thanh .ogg/.mp3/.wav.'}
              </p>
            </div>
          ) : (
            filteredExtraPaths.map((fullPath) => {
              const isSelected = fullPath === selectedExtraPath;
              const name = fullPath.split('/').pop() || fullPath;
              const shortPath = fullPath.replace(/^assets\//, '');
              const bytes = extraFiles.get(fullPath);
              const sizeKb = bytes ? `${(bytes.length / 1024).toFixed(1)} KB` : '';
              return (
                <div
                  key={fullPath}
                  onClick={() =>
                    onSelectExtraFile(fullPath, activeCategory === 'json' ? 'json' : 'audio')
                  }
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition cursor-pointer group ${
                    isSelected
                      ? activeCategory === 'json'
                        ? 'bg-amber-500/20 border border-amber-500/50 text-zinc-100'
                        : 'bg-emerald-500/20 border border-emerald-500/50 text-zinc-100'
                      : 'hover:bg-zinc-800/70 text-zinc-300 border border-transparent'
                  }`}
                >
                  <div className="w-8 h-8 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0">
                    {activeCategory === 'json' ? (
                      <FileJson className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate flex items-center gap-1.5">
                      <span className="truncate">{name}</span>
                      {sizeKb && (
                        <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                          {sizeKb}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate">{shortPath}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteExtraFile(fullPath);
                    }}
                    title="Xóa file này khỏi pack"
                    className="p-1.5 rounded hover:bg-rose-500/20 text-zinc-500 hover:text-rose-400 transition shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )
        ) : visibleTextures.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-xs space-y-2">
            <FolderOpen className="w-7 h-7 mx-auto opacity-50" />
            <p>Không có texture nào khớp bộ lọc.</p>
          </div>
        ) : (
          visibleTextures.map((entry) => {
            const isSelected = workspaceMode === 'texture' && entry.path === selectedPath;
            const isModified = modifiedPaths.has(entry.path);
            return (
              <div
                key={entry.path}
                onClick={() => onSelectTexture(entry)}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition cursor-pointer group ${
                  isSelected
                    ? 'bg-pink-500/20 border border-pink-500/50 text-zinc-100'
                    : 'hover:bg-zinc-800/70 text-zinc-300 border border-transparent'
                }`}
              >
                <div className="w-8 h-8 rounded checkerboard border border-zinc-700/80 flex items-center justify-center shrink-0 overflow-hidden p-0.5">
                  <img
                    src={entry.url}
                    alt={entry.name}
                    loading="lazy"
                    className="max-w-full max-h-full object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate flex items-center gap-1.5">
                    <span className="truncate">{entry.name}</span>
                    {isModified && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate">{entry.relPath}</div>
                </div>
                {isModified && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteModified(entry);
                    }}
                    title="Xóa bản đã chỉnh sửa (khôi phục gốc hoặc gỡ khỏi pack)"
                    className="p-1.5 rounded hover:bg-rose-500/20 text-zinc-500 hover:text-rose-400 transition shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
