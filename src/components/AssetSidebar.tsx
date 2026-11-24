import React, { useMemo, useState } from 'react';
import { Search, Upload, CheckCircle2, FolderOpen, Sparkles, CloudSun, Trash2 } from 'lucide-react';
import { TextureEntry } from '../lib/packLoader';

interface AssetSidebarProps {
  entries: TextureEntry[];
  selectedPath: string | null;
  modifiedPaths: Set<string>;
  onSelect: (entry: TextureEntry) => void;
  onDeleteModified: (entry: TextureEntry) => void;
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
];

export const AssetSidebar: React.FC<AssetSidebarProps> = ({
  entries,
  selectedPath,
  modifiedPaths,
  onSelect,
  onDeleteModified,
  onImportTemplatePack,
  onCreateSkybox,
  loadingArchive,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('gui');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (category === 'modified' && !modifiedPaths.has(e.path)) return false;
      if (category !== 'all' && category !== 'modified' && e.category !== category) return false;
      if (q && !e.relPath.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, category, query, modifiedPaths]);

  const visibleSlice = filtered.slice(0, 200);

  return (
    <aside className="w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full shrink-0">
      <div className="p-3 border-b border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 font-semibold text-sm text-zinc-100">
            <Sparkles className="w-4 h-4 text-pink-400" />
            <span>Kho Texture</span>
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
            placeholder="Tìm: inventory, sun, sky, alban, totem..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-pink-500"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((cat) => {
            const active = category === cat.id;
            const countBadge = cat.id === 'modified' ? modifiedPaths.size : null;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-2 py-1 rounded text-xs font-medium transition flex items-center gap-1 cursor-pointer ${
                  active
                    ? 'bg-pink-600 text-white'
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

        {category === 'sky' && (
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
        <span>Tìm thấy {filtered.length.toLocaleString()} file</span>
        {filtered.length > 200 && <span>Hiển thị 200 đầu tiên</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {visibleSlice.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-xs space-y-2">
            <FolderOpen className="w-7 h-7 mx-auto opacity-50" />
            <p>Không có texture nào khớp bộ lọc.</p>
          </div>
        ) : (
          visibleSlice.map((entry) => {
            const isSelected = entry.path === selectedPath;
            const isModified = modifiedPaths.has(entry.path);
            return (
              <div
                key={entry.path}
                onClick={() => onSelect(entry)}
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
