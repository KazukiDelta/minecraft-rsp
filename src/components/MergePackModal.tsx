import React, { useState } from 'react';
import { GitMerge, Plus, Trash2, X, CheckSquare, Square } from 'lucide-react';
import { ParsedPack, parseResourcePackFile } from '../lib/packLoader';

interface LoadedMergePack {
  id: string;
  pack: ParsedPack;
  selectedPaths: Set<string>;
}

interface MergePackModalProps {
  open: boolean;
  onClose: () => void;
  onConfirmMerge: (payload: {
    entries: ParsedPack['entries'];
    textureBlobs: Map<string, Blob>;
    extraFiles: Map<string, Uint8Array>;
  }) => Promise<void>;
}

export const MergePackModal: React.FC<MergePackModalProps> = ({
  open,
  onClose,
  onConfirmMerge,
}) => {
  const [packs, setPacks] = useState<LoadedMergePack[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);

  if (!open) return null;

  const handleAddFiles = async (files: FileList) => {
    setLoading(true);
    try {
      const added: LoadedMergePack[] = [];
      for (const file of Array.from(files)) {
        const parsed = await parseResourcePackFile(file);
        added.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          pack: parsed,
          selectedPaths: new Set(parsed.entries.map((e) => e.path)),
        });
      }
      setPacks((prev) => [...prev, ...added]);
    } finally {
      setLoading(false);
    }
  };

  const togglePath = (packId: string, path: string) => {
    setPacks((prev) =>
      prev.map((item) => {
        if (item.id !== packId) return item;
        const next = new Set(item.selectedPaths);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return { ...item, selectedPaths: next };
      })
    );
  };

  const selectCategoryForPack = (packId: string, category: string | 'all' | 'none') => {
    setPacks((prev) =>
      prev.map((item) => {
        if (item.id !== packId) return item;
        if (category === 'none') return { ...item, selectedPaths: new Set() };
        if (category === 'all') {
          return { ...item, selectedPaths: new Set(item.pack.entries.map((e) => e.path)) };
        }
        return {
          ...item,
          selectedPaths: new Set(
            item.pack.entries.filter((e) => e.category === category).map((e) => e.path)
          ),
        };
      })
    );
  };

  const removePack = (packId: string) => {
    setPacks((prev) => prev.filter((p) => p.id !== packId));
  };

  const totalSelected = packs.reduce((sum, p) => sum + p.selectedPaths.size, 0);

  const handleMerge = async () => {
    setMerging(true);
    try {
      const mergedEntriesMap = new Map<string, ParsedPack['entries'][number]>();
      const mergedBlobs = new Map<string, Blob>();
      const mergedExtra = new Map<string, Uint8Array>();

      // Later packs override earlier packs if paths collide
      for (const item of packs) {
        if (item.selectedPaths.size === 0) continue;
        for (const entry of item.pack.entries) {
          if (!item.selectedPaths.has(entry.path)) continue;
          mergedEntriesMap.set(entry.path, entry);
          const blob = item.pack.textureBlobs.get(entry.path);
          if (blob) mergedBlobs.set(entry.path, blob);
        }
        // Include extra files (.mcmeta, .properties, models) from packs that have at least 1 selected file
        for (const [k, v] of item.pack.extraFiles.entries()) {
          mergedExtra.set(k, v);
        }
      }

      await onConfirmMerge({
        entries: Array.from(mergedEntriesMap.values()),
        textureBlobs: mergedBlobs,
        extraFiles: mergedExtra,
      });
      setPacks([]);
      onClose();
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-zinc-100">
            <GitMerge className="w-5 h-5 text-pink-400" />
            <span>Gộp Texture Từ Nhiều Pack Khác Nhau</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          <div className="flex items-center justify-between gap-3 bg-zinc-950 border border-zinc-800 rounded-lg p-3">
            <div className="text-zinc-400 leading-relaxed">
              Thêm nhiều file Resource Pack <strong className="text-zinc-200">.zip</strong> (ví dụ: lấy{' '}
              <strong className="text-pink-300">Bầu trời</strong> từ Pack A +{' '}
              <strong className="text-pink-300">Totem</strong> từ Pack B +{' '}
              <strong className="text-pink-300">GUI</strong> từ Pack C) rồi tick chọn từng texture muốn gộp vào dự án hiện tại.
            </div>
            <label className="shrink-0 cursor-pointer px-3 py-2 rounded-md bg-pink-600 hover:bg-pink-500 text-white font-semibold flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span>{loading ? 'Đang đọc...' : 'Thêm Pack .zip'}</span>
              <input
                type="file"
                accept=".zip,.jar"
                multiple
                className="hidden"
                disabled={loading}
                onChange={(e) => {
                  if (e.target.files?.length) handleAddFiles(e.target.files);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>

          {packs.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
              Chưa thêm pack nào. Bấm <strong>Thêm Pack .zip</strong> ở trên để bắt đầu chọn texture cần gộp.
            </div>
          ) : (
            <div className="space-y-3">
              {packs.map((item) => (
                <div
                  key={item.id}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden"
                >
                  <div className="px-3.5 py-2.5 bg-zinc-900/80 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-zinc-200 flex items-center gap-2">
                      <span>{item.pack.packName}</span>
                      <span className="text-[11px] font-normal text-pink-400">
                        ({item.selectedPaths.size}/{item.pack.entries.length} texture đã chọn)
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 text-[11px]">
                      <button
                        onClick={() => selectCategoryForPack(item.id, 'all')}
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
                      >
                        Tất cả
                      </button>
                      <button
                        onClick={() => selectCategoryForPack(item.id, 'sky')}
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sky-300 cursor-pointer"
                      >
                        Chỉ Bầu trời
                      </button>
                      <button
                        onClick={() => selectCategoryForPack(item.id, 'gui')}
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-pink-300 cursor-pointer"
                      >
                        Chỉ GUI
                      </button>
                      <button
                        onClick={() => selectCategoryForPack(item.id, 'item')}
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-300 cursor-pointer"
                      >
                        Chỉ Item
                      </button>
                      <button
                        onClick={() => selectCategoryForPack(item.id, 'none')}
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 cursor-pointer"
                      >
                        Bỏ chọn
                      </button>
                      <button
                        onClick={() => removePack(item.id)}
                        className="p-1 rounded hover:bg-rose-500/20 text-zinc-500 hover:text-rose-400 ml-1 cursor-pointer"
                        title="Xóa pack này khỏi danh sách gộp"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-44 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {item.pack.entries.map((entry) => {
                      const checked = item.selectedPaths.has(entry.path);
                      return (
                        <button
                          key={entry.path}
                          onClick={() => togglePath(item.id, entry.path)}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition cursor-pointer ${
                            checked
                              ? 'bg-pink-500/15 border border-pink-500/40 text-zinc-100'
                              : 'hover:bg-zinc-900 text-zinc-500 border border-transparent'
                          }`}
                        >
                          {checked ? (
                            <CheckSquare className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                          )}
                          <img
                            src={entry.url}
                            alt={entry.name}
                            className="w-6 h-6 rounded checkerboard object-contain shrink-0"
                            style={{ imageRendering: 'pixelated' }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-[11px]">{entry.name}</div>
                            <div className="truncate text-[10px] text-zinc-500">{entry.relPath}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-xs text-zinc-400">
            Tổng cộng sẽ gộp: <strong className="text-pink-300">{totalSelected}</strong> texture vào dự án
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 cursor-pointer"
            >
              Đóng
            </button>
            <button
              onClick={handleMerge}
              disabled={totalSelected === 0 || merging}
              className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <GitMerge className="w-4 h-4" />
              <span>{merging ? 'Đang gộp...' : 'Gộp vào dự án'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
