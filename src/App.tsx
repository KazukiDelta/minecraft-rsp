import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Download, Layers, GitMerge, Database, Trash2, Box } from 'lucide-react';
import {
  TextureEntry,
  classifyTexturePath,
  createCustomSkyboxTemplate,
  loadBuiltinManifest,
  parseResourcePackFile,
} from './lib/packLoader';
import {
  RawImage,
  StampTransform,
  applyPanelTintBuffer,
  cleanItemAlphaCutout,
  cloneRawImage,
  compositeStampOnBedTop,
  compositeStampOnRaw,
  compositeStampOnTwoBedFiles,
  fileToRawImage,
  getOpaqueBounds,
  loadUrlToRawImage,
  rawImageToPngBlob,
  removeBackgroundFloodFillBuffer,
  resizeNearestBuffer,
  upscaleNearestBuffer,
} from './lib/canvasEngine';
import {
  cacheClearAll,
  cacheDeleteExtraFile,
  cacheDeleteTexture,
  cacheLoadAllExtraFiles,
  cacheLoadAllTextures,
  cacheSaveExtraFile,
  cacheSaveTexture,
} from './lib/cacheStore';
import { buildResourcePackZip, triggerBlobDownload } from './lib/packExporter';
import { McVersionPreset } from './lib/mcVersions';
import {
  AnimationSettings,
  buildAnimaticaGuiAnimation,
  buildAnimationMcmetaJson,
  extractFramesFromMediaFile,
  parseAnimationMcmetaBytes,
} from './lib/animationEngine';
import { compositeStampOnSkybox3x2 } from './lib/skyboxProjector';
import { AssetSidebar, WorkspaceMode } from './components/AssetSidebar';
import { EditorCanvas, EditorTool } from './components/EditorCanvas';
import { InspectorPanel } from './components/InspectorPanel';
import { ExportModal } from './components/ExportModal';
import { MergePackModal } from './components/MergePackModal';
import { Preview3DModal } from './components/Preview3DModal';
import { JsonEditorView } from './components/JsonEditorView';
import { SoundStudioView } from './components/SoundStudioView';
import { isAudioFilePath, isTextEditablePath } from './lib/audioEngine';

interface TextureHistory {
  past: RawImage[];
  present: RawImage;
  future: RawImage[];
}

export const App: React.FC = () => {
  const [entries, setEntries] = useState<TextureEntry[]>([]);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TextureEntry | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('texture');
  const [selectedExtraPath, setSelectedExtraPath] = useState<string | null>(null);

  // Per-texture edit history stored by archive path
  const [histories, setHistories] = useState<Map<string, TextureHistory>>(new Map());
  const [modifiedPaths, setModifiedPaths] = useState<Set<string>>(new Set());
  const [extraFiles, setExtraFiles] = useState<Map<string, Uint8Array>>(new Map());
  const [cacheStatus, setCacheStatus] = useState<string>('Sẵn sàng');

  // Editor tool state
  const [tool, setTool] = useState<EditorTool>('stamp');
  const [brushColor, setBrushColor] = useState<string>('#ff8fab');
  const [brushSize, setBrushSize] = useState<number>(2);

  // Active Stamp state (before committing to texture)
  const [rawStampSource, setRawStampSource] = useState<RawImage | null>(null);
  const [rawStampFrames, setRawStampFrames] = useState<RawImage[]>([]);
  const [stampDurationTicks, setStampDurationTicks] = useState<number>(2);
  const [removeBgEnabled, setRemoveBgEnabled] = useState<boolean>(false);
  const [removeBgMode, setRemoveBgMode] = useState<'corner' | 'white'>('corner');
  const [removeBgTolerance, setRemoveBgTolerance] = useState<number>(24);
  const [stampTransform, setStampTransform] = useState<StampTransform>({
    x: 88,
    y: 83,
    scale: 1,
    rotation: 0,
    opacity: 0.85,
    flipX: false,
    maskToBaseAlpha: true,
    protectGuiSlots: true,
  });

  const [exportOpen, setExportOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [preview3DOpen, setPreview3DOpen] = useState(false);

  // Load built-in 26.3 manifest AND restore auto-saved IndexedDB cache on startup
  useEffect(() => {
    let active = true;
    (async () => {
      const [manifest, cachedTextures, cachedExtra] = await Promise.all([
        loadBuiltinManifest(),
        cacheLoadAllTextures().catch(() => new Map<string, Blob>()),
        cacheLoadAllExtraFiles().catch(() => new Map<string, Uint8Array>()),
      ]);
      if (!active) return;

      const entryMap = new Map<string, TextureEntry>();
      for (const e of manifest.entries) {
        entryMap.set(e.path, e);
      }

      const restoredHistories = new Map<string, TextureHistory>();
      const restoredModified = new Set<string>();

      for (const [path, blob] of cachedTextures.entries()) {
        try {
          const raw = await fileToRawImage(blob);
          const url = URL.createObjectURL(blob);
          restoredHistories.set(path, { past: [], present: raw, future: [] });
          restoredModified.add(path);

          const existing = entryMap.get(path);
          if (existing) {
            entryMap.set(path, { ...existing, url });
          } else {
            const { relPath, category, name } = classifyTexturePath(path);
            entryMap.set(path, { path, relPath, name, category, url });
          }
        } catch {
          // Ignore corrupted cache entry
        }
      }

      const finalEntries = Array.from(entryMap.values()).sort((a, b) =>
        a.relPath.localeCompare(b.relPath)
      );
      setEntries(finalEntries);
      setHistories(restoredHistories);
      setModifiedPaths(restoredModified);
      setExtraFiles(cachedExtra);
      if (restoredModified.size > 0) {
        setCacheStatus(`Đã khôi phục ${restoredModified.size} file từ cache`);
      }

      const firstToOpen =
        (restoredModified.size > 0
          ? finalEntries.find((e) => restoredModified.has(e.path))
          : null) ||
        finalEntries.find((e) => e.relPath === 'gui/container/inventory.png') ||
        finalEntries[0];

      if (firstToOpen) {
        setSelectedEntry(firstToOpen);
        if (!restoredHistories.has(firstToOpen.path)) {
          const loaded = await loadUrlToRawImage(firstToOpen.url);
          if (active) {
            setHistories((prev) => {
              const next = new Map(prev);
              next.set(firstToOpen.path, { past: [], present: loaded, future: [] });
              return next;
            });
          }
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const persistTextureToCache = useCallback(async (path: string, img: RawImage) => {
    try {
      const blob = await rawImageToPngBlob(img);
      await cacheSaveTexture(path, blob);
      const thumbUrl = URL.createObjectURL(blob);
      setEntries((prev) => prev.map((e) => (e.path === path ? { ...e, url: thumbUrl } : e)));
      setCacheStatus('Đã tự động lưu cache');
    } catch {
      // Ignore IndexedDB quota/privacy errors
    }
  }, []);

  const handleSelectEntry = async (entry: TextureEntry) => {
    setWorkspaceMode('texture');
    setSelectedEntry(entry);
    setRawStampSource(null);
    if (!histories.has(entry.path)) {
      const loaded = await loadUrlToRawImage(entry.url);
      setHistories((prev) => {
        const next = new Map(prev);
        next.set(entry.path, { past: [], present: loaded, future: [] });
        return next;
      });
    }
  };

  const handleSelectExtraFile = (path: string, mode: 'json' | 'audio') => {
    setWorkspaceMode(mode);
    setSelectedExtraPath(path);
  };

  const handleSwitchWorkspaceMode = (mode: WorkspaceMode) => {
    setWorkspaceMode(mode);
    if (mode === 'json') {
      if (!selectedExtraPath || !isTextEditablePath(selectedExtraPath) || !extraFiles.has(selectedExtraPath)) {
        const firstJson = Array.from(extraFiles.keys()).filter(isTextEditablePath).sort()[0] || null;
        setSelectedExtraPath(firstJson);
      }
    } else if (mode === 'audio') {
      if (!selectedExtraPath || !isAudioFilePath(selectedExtraPath) || !extraFiles.has(selectedExtraPath)) {
        const firstAudio = Array.from(extraFiles.keys()).filter(isAudioFilePath).sort()[0] || null;
        setSelectedExtraPath(firstAudio);
      }
    }
  };

  const handleSaveJsonFile = async (path: string, content: string) => {
    const cleanPath = path.replace(/^\/+/, '').replace(/\\/g, '/');
    const bytes = new TextEncoder().encode(content);
    setExtraFiles((prev) => {
      const next = new Map(prev);
      next.set(cleanPath, bytes);
      return next;
    });
    await cacheSaveExtraFile(cleanPath, bytes);
    setSelectedExtraPath(cleanPath);
    setWorkspaceMode('json');
    setCacheStatus(`Đã lưu ${cleanPath.split('/').pop()}`);
  };

  const handleDeleteExtraFile = async (path: string) => {
    await cacheDeleteExtraFile(path);
    setExtraFiles((prev) => {
      const next = new Map(prev);
      next.delete(path);
      return next;
    });
    if (selectedExtraPath === path) {
      setSelectedExtraPath(null);
    }
    setCacheStatus(`Đã xóa ${path.split('/').pop()}`);
  };

  const handleSaveSoundFile = async (opts: {
    archivePath: string;
    oggBytes: Uint8Array;
    updatedSoundsJson?: string;
    oldPathToDelete?: string;
  }) => {
    const nextExtra = new Map(extraFiles);
    if (opts.oldPathToDelete && opts.oldPathToDelete !== opts.archivePath) {
      nextExtra.delete(opts.oldPathToDelete);
      await cacheDeleteExtraFile(opts.oldPathToDelete);
    }
    nextExtra.set(opts.archivePath, opts.oggBytes);
    await cacheSaveExtraFile(opts.archivePath, opts.oggBytes);

    if (opts.updatedSoundsJson) {
      const soundsPath = 'assets/minecraft/sounds.json';
      const soundsBytes = new TextEncoder().encode(opts.updatedSoundsJson);
      nextExtra.set(soundsPath, soundsBytes);
      await cacheSaveExtraFile(soundsPath, soundsBytes);
    }

    setExtraFiles(nextExtra);
    setSelectedExtraPath(opts.archivePath);
    setWorkspaceMode('audio');
    setCacheStatus(`Đã lưu âm thanh ${opts.archivePath.split('/').pop()}`);
  };

  const currentHistory = selectedEntry ? histories.get(selectedEntry.path) || null : null;
  const baseImage = currentHistory?.present || null;

  const opaqueBounds = useMemo(
    () => (baseImage ? getOpaqueBounds(baseImage) : null),
    [baseImage]
  );

  const deferredStampTransform = useDeferredValue(stampTransform);
  const deferredRemoveBgTolerance = useDeferredValue(removeBgTolerance);

  const processedStamp = useMemo(() => {
    if (!rawStampSource) return null;
    if (!removeBgEnabled) return rawStampSource;
    return removeBackgroundFloodFillBuffer(rawStampSource, deferredRemoveBgTolerance, removeBgMode);
  }, [rawStampSource, removeBgEnabled, deferredRemoveBgTolerance, removeBgMode]);

  const bedPairMatch = selectedEntry?.relPath.match(/^block\/([a-z_]+)_bed_(head|foot)_up\.png$/);
  const isBedTexture = Boolean(selectedEntry?.relPath.includes('entity/bed/') || bedPairMatch);

  const displayImage = useMemo(() => {
    if (!baseImage) return null;
    if (!processedStamp) return baseImage;
    if (deferredStampTransform.bedTopSplit && selectedEntry?.relPath.includes('entity/bed/')) {
      return compositeStampOnBedTop(baseImage, processedStamp, deferredStampTransform);
    }
    if (deferredStampTransform.bedTopSplit && bedPairMatch) {
      const activeIsHead = bedPairMatch[2] === 'head';
      const { head, foot } = compositeStampOnTwoBedFiles(
        baseImage,
        baseImage,
        processedStamp,
        deferredStampTransform,
        activeIsHead
      );
      return activeIsHead ? head : foot;
    }
    if (deferredStampTransform.skyboxWarp && selectedEntry?.category === 'sky') {
      return compositeStampOnSkybox3x2(baseImage, processedStamp, deferredStampTransform, true);
    }
    return compositeStampOnRaw(baseImage, processedStamp, deferredStampTransform);
  }, [baseImage, processedStamp, deferredStampTransform, selectedEntry?.category, selectedEntry?.relPath, bedPairMatch]);

  const pushEdit = useCallback(
    (nextImg: RawImage) => {
      if (!selectedEntry) return;
      const path = selectedEntry.path;
      setHistories((prev) => {
        const cur = prev.get(path);
        if (!cur) return prev;
        const next = new Map(prev);
        next.set(path, {
          past: [...cur.past.slice(-19), cur.present],
          present: nextImg,
          future: [],
        });
        return next;
      });
      setModifiedPaths((prev) => new Set(prev).add(path));
      void persistTextureToCache(path, nextImg);
    },
    [selectedEntry, persistTextureToCache]
  );

  const handleUndo = useCallback(() => {
    if (!selectedEntry) return;
    const path = selectedEntry.path;
    setHistories((prev) => {
      const cur = prev.get(path);
      if (!cur || cur.past.length === 0) return prev;
      const previous = cur.past[cur.past.length - 1];
      const next = new Map(prev);
      next.set(path, {
        past: cur.past.slice(0, -1),
        present: previous,
        future: [cur.present, ...cur.future],
      });
      void persistTextureToCache(path, previous);
      return next;
    });
  }, [selectedEntry, persistTextureToCache]);

  const handleRedo = useCallback(() => {
    if (!selectedEntry) return;
    const path = selectedEntry.path;
    setHistories((prev) => {
      const cur = prev.get(path);
      if (!cur || cur.future.length === 0) return prev;
      const [upcoming, ...rest] = cur.future;
      const next = new Map(prev);
      next.set(path, {
        past: [...cur.past, cur.present],
        present: upcoming,
        future: rest,
      });
      void persistTextureToCache(path, upcoming);
      return next;
    });
  }, [selectedEntry, persistTextureToCache]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (workspaceMode !== 'texture') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, workspaceMode]);

  const handleResetVanilla = async () => {
    if (!selectedEntry) return;
    setRawStampSource(null);
    const vanillaUrl = `/templates/${selectedEntry.path}`;
    try {
      const fresh = await loadUrlToRawImage(vanillaUrl);
      setHistories((prev) => {
        const next = new Map(prev);
        next.set(selectedEntry.path, { past: [], present: cloneRawImage(fresh), future: [] });
        return next;
      });
      setEntries((prev) =>
        prev.map((e) => (e.path === selectedEntry.path ? { ...e, url: vanillaUrl } : e))
      );
      setModifiedPaths((prev) => {
        const next = new Set(prev);
        next.delete(selectedEntry.path);
        return next;
      });
      await cacheDeleteTexture(selectedEntry.path);
      setCacheStatus('Đã khôi phục bản gốc');
    } catch {
      // Custom file not in vanilla templates
    }
  };

  const handleDeleteModified = async (entry: TextureEntry) => {
    const vanillaUrl = `/templates/${entry.path}`;
    await cacheDeleteTexture(entry.path);
    setModifiedPaths((prev) => {
      const next = new Set(prev);
      next.delete(entry.path);
      return next;
    });

    try {
      const fresh = await loadUrlToRawImage(vanillaUrl);
      // Vanilla texture: restore original thumbnail & canvas
      setEntries((prev) =>
        prev.map((e) => (e.path === entry.path ? { ...e, url: vanillaUrl } : e))
      );
      setHistories((prev) => {
        const next = new Map(prev);
        next.set(entry.path, { past: [], present: cloneRawImage(fresh), future: [] });
        return next;
      });
      setCacheStatus(`Đã xóa chỉnh sửa của ${entry.name}`);
    } catch {
      // Custom/imported-only texture: remove from list completely
      setEntries((prev) => prev.filter((e) => e.path !== entry.path));
      setHistories((prev) => {
        const next = new Map(prev);
        next.delete(entry.path);
        return next;
      });
      if (selectedEntry?.path === entry.path) {
        setSelectedEntry(null);
        setRawStampSource(null);
        setRawStampFrames([]);
      }
      setCacheStatus(`Đã gỡ ${entry.name} khỏi dự án`);
    }
  };

  const handleClearCache = async () => {
    await cacheClearAll();
    window.location.reload();
  };

  const applyImportedEntries = async (payload: {
    entries: TextureEntry[];
    textureBlobs: Map<string, Blob>;
    extraFiles: Map<string, Uint8Array>;
  }) => {
    const newHistories = new Map(histories);
    const newModified = new Set(modifiedPaths);
    const newExtra = new Map(extraFiles);
    const entryMap = new Map(entries.map((e) => [e.path, e]));

    for (const entry of payload.entries) {
      const blob = payload.textureBlobs.get(entry.path);
      if (!blob) continue;
      const raw = await fileToRawImage(blob);
      newHistories.set(entry.path, { past: [], present: raw, future: [] });
      newModified.add(entry.path);
      entryMap.set(entry.path, entry);
      await cacheSaveTexture(entry.path, blob);
    }

    for (const [k, v] of payload.extraFiles.entries()) {
      newExtra.set(k, v);
      await cacheSaveExtraFile(k, v);
    }

    const sorted = Array.from(entryMap.values()).sort((a, b) => a.relPath.localeCompare(b.relPath));
    setEntries(sorted);
    setHistories(newHistories);
    setModifiedPaths(newModified);
    setExtraFiles(newExtra);
    setCacheStatus(`Đã nhập & lưu cache ${payload.entries.length} texture`);

    if (payload.entries[0]) {
      setSelectedEntry(payload.entries[0]);
      setRawStampSource(null);
    }
  };

  const handleImportTemplatePack = async (file: File) => {
    setLoadingArchive(true);
    try {
      const parsed = await parseResourcePackFile(file);
      if (parsed.entries.length > 0) {
        await applyImportedEntries({
          entries: parsed.entries,
          textureBlobs: parsed.textureBlobs,
          extraFiles: parsed.extraFiles,
        });
      }
    } finally {
      setLoadingArchive(false);
    }
  };

  const handleCreateSkybox = async () => {
    const sky = await createCustomSkyboxTemplate();
    const blobs = new Map<string, Blob>([[sky.entry.path, sky.blob]]);
    const extra = new Map<string, Uint8Array>([[sky.propertiesPath, sky.propertiesBytes]]);
    await applyImportedEntries({
      entries: [sky.entry],
      textureBlobs: blobs,
      extraFiles: extra,
    });
  };

  const handleUpscaleFactor = (factor: number) => {
    if (!baseImage) return;
    const next = upscaleNearestBuffer(baseImage, factor);
    pushEdit(next);
    if (rawStampSource) {
      setStampTransform((st) => ({
        ...st,
        x: st.x * factor,
        y: st.y * factor,
        scale: st.scale * factor,
      }));
    }
  };

  const handleResizeExact = (w: number, h: number) => {
    if (!baseImage) return;
    const scaleX = w / baseImage.width;
    const scaleY = h / baseImage.height;
    pushEdit(resizeNearestBuffer(baseImage, w, h));
    if (rawStampSource) {
      setStampTransform((st) => ({
        ...st,
        x: st.x * scaleX,
        y: st.y * scaleY,
        scale: st.scale * Math.min(scaleX, scaleY),
      }));
    }
  };

  const handleUploadStampFile = async (file: File) => {
    if (!baseImage) return;
    const frames = await extractFramesFromMediaFile(file, 24, 10);
    const img = frames[0];
    if (!img) return;
    setRawStampFrames(frames);
    setRawStampSource(img);
    setTool('stamp');

    const bounds = opaqueBounds || { x: 0, y: 0, width: baseImage.width, height: baseImage.height };
    const isGui = selectedEntry?.category === 'gui';
    const isSky = selectedEntry?.category === 'sky';
    const isBed = Boolean(selectedEntry?.relPath.includes('entity/bed/'));

    if (bedPairMatch) {
      const w = baseImage.width;
      const h = baseImage.height;
      const activeIsHead = bedPairMatch[2] === 'head';
      // Fit stamp across the full 1x2 bed (W x 2H) and center vertically across both files
      const bedScale = Math.min(w / img.width, (h * 2) / img.height);
      setStampTransform({
        x: Math.round(w / 2),
        y: activeIsHead ? h : 0,
        scale: Number(bedScale.toFixed(3)),
        rotation: 0,
        opacity: 1.0,
        flipX: false,
        maskToBaseAlpha: false,
        protectGuiSlots: false,
        skyboxWarp: false,
        bedTopSplit: true,
      });
      return;
    }

    if (isBed) {
      const scaleU = baseImage.width / 64;
      const scaleV = baseImage.height / 64;
      const bedW = 16 * scaleU;
      const bedH = 32 * scaleV;
      const bedScale = Math.min(bedW / img.width, bedH / img.height);
      setStampTransform({
        x: Math.round(6 * scaleU + bedW / 2),
        y: Math.round(6 * scaleV + bedH / 2),
        scale: Number(bedScale.toFixed(3)),
        rotation: 0,
        opacity: 1.0,
        flipX: false,
        maskToBaseAlpha: false,
        protectGuiSlots: false,
        skyboxWarp: false,
        bedTopSplit: true,
      });
      return;
    }

    const fitScale = isGui || isSky
      ? Math.min(bounds.width / img.width, bounds.height / img.height) * 0.85
      : Math.max(bounds.width / img.width, bounds.height / img.height);

    setStampTransform({
      x: Math.round(bounds.x + bounds.width / 2),
      y: Math.round(bounds.y + bounds.height / 2),
      scale: Number(fitScale.toFixed(3)),
      rotation: 0,
      opacity: isGui ? 0.45 : 1.0,
      flipX: false,
      maskToBaseAlpha: isGui,
      protectGuiSlots: isGui,
      skyboxWarp: isSky && Math.abs(baseImage.width / baseImage.height - 1.5) < 0.15,
    });
  };

  const handleFitStampToPanel = (cover: boolean) => {
    if (!baseImage || !rawStampSource) return;
    const bounds = opaqueBounds || { x: 0, y: 0, width: baseImage.width, height: baseImage.height };
    const scale = cover
      ? Math.max(bounds.width / rawStampSource.width, bounds.height / rawStampSource.height)
      : Math.min(bounds.width / rawStampSource.width, bounds.height / rawStampSource.height);
    setStampTransform((st) => ({
      ...st,
      x: Math.round(bounds.x + bounds.width / 2),
      y: Math.round(bounds.y + bounds.height / 2),
      scale: Number(scale.toFixed(3)),
    }));
  };

  const handleCenterStamp = () => {
    if (!baseImage) return;
    const bounds = opaqueBounds || { x: 0, y: 0, width: baseImage.width, height: baseImage.height };
    setStampTransform((st) => ({
      ...st,
      x: Math.round(bounds.x + bounds.width / 2),
      y: Math.round(bounds.y + bounds.height / 2),
    }));
  };

  const handleApplyStamp = async () => {
    if (!baseImage || !processedStamp || !selectedEntry) return;

    // Animated Stamp -> generate Animatica optifine/anim/*.png + *.properties!
    if (rawStampFrames.length > 1) {
      setCacheStatus('Đang xuất các frame Animatica...');
      const anim = await buildAnimaticaGuiAnimation({
        baseImage,
        stampFrames: rawStampFrames,
        transform: stampTransform,
        targetArchivePath: selectedEntry.path,
        durationTicks: stampDurationTicks,
        removeBg: {
          enabled: removeBgEnabled,
          tolerance: removeBgTolerance,
          mode: removeBgMode,
        },
      });
      pushEdit(anim.firstFrameComposite);
      setExtraFiles((prev) => {
        const next = new Map(prev);
        next.set(anim.animPngPath, anim.animPngBytes);
        next.set(anim.propsPath, anim.propsBytes);
        return next;
      });
      await Promise.all([
        cacheSaveExtraFile(anim.animPngPath, anim.animPngBytes),
        cacheSaveExtraFile(anim.propsPath, anim.propsBytes),
      ]);
      setCacheStatus(`Đã tạo Animatica (${rawStampFrames.length} frame)`);
      setRawStampSource(null);
      setRawStampFrames([]);
      return;
    }

    // Minecraft 26.3 2-file bed top (*_bed_head_up.png + *_bed_foot_up.png) -> save BOTH halves!
    if (stampTransform.bedTopSplit && bedPairMatch) {
      const color = bedPairMatch[1];
      const activeIsHead = bedPairMatch[2] === 'head';
      const headPath = `assets/minecraft/textures/block/${color}_bed_head_up.png`;
      const footPath = `assets/minecraft/textures/block/${color}_bed_foot_up.png`;
      const siblingPath = activeIsHead ? footPath : headPath;

      let siblingImg = histories.get(siblingPath)?.present;
      if (!siblingImg) {
        const siblingEntry = entries.find((e) => e.path === siblingPath);
        siblingImg = siblingEntry ? await loadUrlToRawImage(siblingEntry.url) : baseImage;
      }

      const headBase = activeIsHead ? baseImage : siblingImg;
      const footBase = activeIsHead ? siblingImg : baseImage;
      const { head, foot } = compositeStampOnTwoBedFiles(
        headBase,
        footBase,
        processedStamp,
        stampTransform,
        activeIsHead
      );

      setHistories((prev) => {
        const next = new Map(prev);
        const hCur = prev.get(headPath);
        const fCur = prev.get(footPath);
        next.set(headPath, {
          past: hCur ? [...hCur.past.slice(-19), hCur.present] : [headBase],
          present: head,
          future: [],
        });
        next.set(footPath, {
          past: fCur ? [...fCur.past.slice(-19), fCur.present] : [footBase],
          present: foot,
          future: [],
        });
        return next;
      });
      setModifiedPaths((prev) => {
        const next = new Set(prev);
        next.add(headPath);
        next.add(footPath);
        return next;
      });
      await Promise.all([
        persistTextureToCache(headPath, head),
        persistTextureToCache(footPath, foot),
      ]);
      setCacheStatus(`Đã ghép liền 2 file giường (${color}_bed_head_up & foot_up)`);
      setRawStampSource(null);
      setRawStampFrames([]);
      return;
    }

    // Static Stamp -> render full native resolution on commit
    const finalImg =
      stampTransform.bedTopSplit && isBedTexture
        ? compositeStampOnBedTop(baseImage, processedStamp, stampTransform)
        : stampTransform.skyboxWarp && selectedEntry.category === 'sky'
        ? compositeStampOnSkybox3x2(baseImage, processedStamp, stampTransform, false)
        : compositeStampOnRaw(baseImage, processedStamp, stampTransform);
    pushEdit(finalImg);
    setRawStampSource(null);
    setRawStampFrames([]);
  };

  const existingAnimSettings = useMemo(() => {
    if (!selectedEntry) return null;
    return parseAnimationMcmetaBytes(extraFiles.get(`${selectedEntry.path}.mcmeta`));
  }, [selectedEntry, extraFiles]);

  const handleApplyAnimation = async (
    spriteSheet: RawImage | null,
    settings: AnimationSettings
  ) => {
    if (!selectedEntry) return;
    if (spriteSheet) {
      pushEdit(spriteSheet);
    }
    const mcmetaPath = `${selectedEntry.path}.mcmeta`;
    const bytes = new TextEncoder().encode(buildAnimationMcmetaJson(settings));
    setExtraFiles((prev) => {
      const next = new Map(prev);
      next.set(mcmetaPath, bytes);
      return next;
    });
    await cacheSaveExtraFile(mcmetaPath, bytes);
    setCacheStatus(`Đã lưu ${selectedEntry.name}.mcmeta`);
  };

  const hasSkyJsonConfigs = useMemo(() => {
    for (const k of extraFiles.keys()) {
      if (k.includes('fabricskyboxes/sky/') || k.includes('optifine/sky/') || k.includes('celestial/sky/')) {
        return true;
      }
    }
    return false;
  }, [extraFiles]);

  const handleExportZip = async (opts: {
    packName: string;
    description: string;
    versionPreset: McVersionPreset;
    packIconBlob: Blob | null;
    fixSkyBlendReplace: boolean;
  }) => {
    const map = new Map<string, Blob>();
    for (const path of modifiedPaths) {
      const hist = histories.get(path);
      if (hist) {
        const blob = await rawImageToPngBlob(hist.present);
        map.set(path, blob);
      }
    }

    const finalExtra = new Map<string, Uint8Array>(extraFiles);
    if (opts.fixSkyBlendReplace) {
      const dec = new TextDecoder();
      const enc = new TextEncoder();
      for (const [k, bytes] of finalExtra.entries()) {
        if (k.includes('fabricskyboxes/sky/') && k.endsWith('.json')) {
          const text = dec.decode(bytes);
          const patched = text
            .replace(/"type"\s*:\s*"(add|screen)"/gi, '"type": "replace"')
            .replace(/"blend"\s*:\s*"(add|screen)"/gi, '"blend": "replace"');
          finalExtra.set(k, enc.encode(patched));
        } else if (k.includes('optifine/sky/') && k.endsWith('.properties')) {
          const text = dec.decode(bytes);
          const patched = text.replace(/^blend\s*=\s*(add|screen)/gim, 'blend=replace');
          finalExtra.set(k, enc.encode(patched));
        }
      }
    }

    const bytes = await buildResourcePackZip({
      packName: opts.packName,
      description: opts.description,
      versionPreset: opts.versionPreset,
      modifiedTextures: map,
      extraFiles: finalExtra,
      packIcon: opts.packIconBlob,
    });
    triggerBlobDownload(bytes, opts.packName);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* App Header */}
      <header className="h-13 bg-zinc-900 border-b border-zinc-800 px-4 flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-zinc-100">
              MC Resource Pack Studio
            </h1>
            <p className="text-[11px] text-zinc-400">
              Upscale 4096px • Stamp & Skybox • JSON Editor • Sound Studio (.ogg)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-save Cache Status */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-zinc-400 bg-zinc-950 border border-zinc-800 px-2.5 py-1 rounded-md">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>{cacheStatus}</span>
            {(modifiedPaths.size > 0 || extraFiles.size > 0) && (
              <button
                onClick={handleClearCache}
                title="Xóa toàn bộ cache đã lưu và làm mới từ đầu"
                className="ml-1 text-zinc-500 hover:text-rose-400 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => setPreview3DOpen(true)}
            disabled={workspaceMode !== 'texture' || !displayImage}
            className="px-3 py-2 rounded-lg bg-sky-600/20 hover:bg-sky-600/35 border border-sky-500/40 text-sky-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
          >
            <Box className="w-4 h-4 text-sky-400" />
            <span>Xem 3D</span>
          </button>

          <button
            onClick={() => setMergeOpen(true)}
            className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <GitMerge className="w-4 h-4 text-pink-400" />
            <span>Gộp Pack</span>
          </button>

          <button
            onClick={() => setExportOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-pink-600/20 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Xuất Pack .zip ({modifiedPaths.size + extraFiles.size})</span>
          </button>
        </div>
      </header>

      {/* 3-Pane Studio Workspace */}
      <div className="flex-1 flex min-h-0">
        <AssetSidebar
          entries={entries}
          extraFiles={extraFiles}
          workspaceMode={workspaceMode}
          selectedPath={selectedEntry?.path || null}
          selectedExtraPath={selectedExtraPath}
          modifiedPaths={modifiedPaths}
          onSelectTexture={handleSelectEntry}
          onSelectExtraFile={handleSelectExtraFile}
          onSwitchWorkspaceMode={handleSwitchWorkspaceMode}
          onDeleteModified={handleDeleteModified}
          onDeleteExtraFile={(p) => void handleDeleteExtraFile(p)}
          onImportTemplatePack={handleImportTemplatePack}
          onCreateSkybox={handleCreateSkybox}
          loadingArchive={loadingArchive}
        />

        {workspaceMode === 'json' ? (
          <JsonEditorView
            selectedPath={selectedExtraPath}
            fileBytes={selectedExtraPath ? extraFiles.get(selectedExtraPath) || null : null}
            onSaveFile={handleSaveJsonFile}
            onDeleteFile={handleDeleteExtraFile}
            onCreateOrUploadFile={handleSaveJsonFile}
          />
        ) : workspaceMode === 'audio' ? (
          <SoundStudioView
            selectedPath={selectedExtraPath}
            fileBytes={selectedExtraPath ? extraFiles.get(selectedExtraPath) || null : null}
            soundsJsonBytes={extraFiles.get('assets/minecraft/sounds.json') || null}
            onSaveSound={handleSaveSoundFile}
            onDeleteFile={handleDeleteExtraFile}
          />
        ) : (
          <>
            <EditorCanvas
              displayImage={displayImage}
              activeStamp={processedStamp}
              stampTransform={stampTransform}
              onUpdateStampTransform={(patch) =>
                setStampTransform((prev) => ({ ...prev, ...patch }))
              }
              tool={tool}
              onSelectTool={setTool}
              brushColor={brushColor}
              onPickColor={setBrushColor}
              brushSize={brushSize}
              onBrushSizeChange={setBrushSize}
              onCommitPixelEdit={pushEdit}
              canUndo={!!currentHistory && currentHistory.past.length > 0}
              canRedo={!!currentHistory && currentHistory.future.length > 0}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onResetVanilla={handleResetVanilla}
              textureName={selectedEntry?.path || ''}
            />

            <InspectorPanel
              baseImage={baseImage}
              opaqueBounds={opaqueBounds}
              onUpscaleFactor={handleUpscaleFactor}
              onResizeExact={handleResizeExact}
              onCleanItemEdges={() => {
                if (baseImage) pushEdit(cleanItemAlphaCutout(baseImage, 128));
              }}
              onApplyTint={(hex, strength) => {
                if (baseImage) pushEdit(applyPanelTintBuffer(baseImage, hex, strength));
              }}
              hasStamp={!!rawStampSource}
              stampFrameCount={rawStampFrames.length}
              stampDurationTicks={stampDurationTicks}
              onChangeStampDurationTicks={setStampDurationTicks}
              onUploadStampFile={handleUploadStampFile}
              removeBgEnabled={removeBgEnabled}
              onToggleRemoveBg={setRemoveBgEnabled}
              removeBgMode={removeBgMode}
              onChangeRemoveBgMode={setRemoveBgMode}
              removeBgTolerance={removeBgTolerance}
              onChangeRemoveBgTolerance={setRemoveBgTolerance}
              stampTransform={stampTransform}
              onUpdateStampTransform={(patch) =>
                setStampTransform((prev) => ({ ...prev, ...patch }))
              }
              onFitStampToPanel={handleFitStampToPanel}
              onCenterStamp={handleCenterStamp}
              onApplyStamp={handleApplyStamp}
              onCancelStamp={() => setRawStampSource(null)}
              existingAnimSettings={existingAnimSettings}
              onApplyAnimation={handleApplyAnimation}
              isSkyTexture={selectedEntry?.category === 'sky'}
              isBedTexture={isBedTexture}
              onApplyProjectedSkybox={pushEdit}
            />
          </>
        )}
      </div>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        modifiedPaths={Array.from(modifiedPaths)}
        extraFilePaths={Array.from(extraFiles.keys()).sort()}
        hasSkyJsonConfigs={hasSkyJsonConfigs}
        onExport={handleExportZip}
      />

      <MergePackModal
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        onConfirmMerge={applyImportedEntries}
      />

      <Preview3DModal
        open={preview3DOpen}
        onClose={() => setPreview3DOpen(false)}
        image={displayImage}
        baseImage={baseImage}
        activeStamp={processedStamp}
        stampOpacity={stampTransform.opacity}
        stampFlipX={stampTransform.flipX}
        stampRotation={stampTransform.rotation}
        onCommitSkybox3DStamp={(projected) => {
          pushEdit(projected);
          setRawStampSource(null);
        }}
        category={selectedEntry?.category || 'item'}
        textureName={selectedEntry?.name || ''}
        animSettings={existingAnimSettings}
      />
    </div>
  );
};

export default App;
