import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Volume2,
  Upload,
  Save,
  Trash2,
  Download,
  Play,
  Square,
  RotateCcw,
  Music,
  CheckCircle2,
  Loader2,
  Sliders,
} from 'lucide-react';
import {
  AudioEditOptions,
  VANILLA_SOUND_PRESETS,
  archivePathToSoundResource,
  decodeAudioBytes,
  encodeAudioBufferToOgg,
  isOggBytes,
  normalizeSoundArchivePath,
  processAudioBuffer,
  upsertSoundsJson,
} from '../lib/audioEngine';

interface SoundStudioViewProps {
  selectedPath: string | null;
  fileBytes: Uint8Array | null;
  soundsJsonBytes: Uint8Array | null;
  onSaveSound: (opts: {
    archivePath: string;
    oggBytes: Uint8Array;
    updatedSoundsJson?: string;
    oldPathToDelete?: string;
  }) => Promise<void>;
  onDeleteFile: (path: string) => Promise<void>;
}

const DEFAULT_EDIT: AudioEditOptions = {
  trimStart: 0,
  trimEnd: 0,
  gain: 1,
  playbackRate: 1,
  fadeIn: 0,
  fadeOut: 0,
  mono: true,
  normalize: false,
  vbrQuality: 4,
};

export const SoundStudioView: React.FC<SoundStudioViewProps> = ({
  selectedPath,
  fileBytes,
  soundsJsonBytes,
  onSaveSound,
  onDeleteFile,
}) => {
  const [sourceBuffer, setSourceBuffer] = useState<AudioBuffer | null>(null);
  const [rawOriginalBytes, setRawOriginalBytes] = useState<Uint8Array | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [targetPath, setTargetPath] = useState<string>('assets/minecraft/sounds/random/click.ogg');
  const [editOpts, setEditOpts] = useState<AudioEditOptions>(DEFAULT_EDIT);
  const [isDirty, setIsDirty] = useState(false);

  // sounds.json auto-binding
  const [updateSoundsJson, setUpdateSoundsJson] = useState(true);
  const [soundEventId, setSoundEventId] = useState('ui.button.click');
  const [streamFlag, setStreamFlag] = useState(false);

  // Preview & saving states
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0); // seconds
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const playSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Load selected sound from pack extraFiles
  useEffect(() => {
    let active = true;
    if (!selectedPath || !fileBytes) {
      setSourceBuffer(null);
      setRawOriginalBytes(null);
      setDecodeError(null);
      setIsDirty(false);
      return;
    }

    setTargetPath(selectedPath);
    setRawOriginalBytes(fileBytes);
    setDecodeError(null);
    setSavedMsg(null);

    const matchedPreset = VANILLA_SOUND_PRESETS.find((p) => p.path === selectedPath);
    if (matchedPreset) {
      setSoundEventId(matchedPreset.eventId);
    } else {
      const res = archivePathToSoundResource(selectedPath);
      setSoundEventId(res.replace(/\//g, '.'));
    }

    (async () => {
      try {
        const buf = await decodeAudioBytes(fileBytes);
        if (!active) return;
        setSourceBuffer(buf);
        setEditOpts({
          ...DEFAULT_EDIT,
          trimStart: 0,
          trimEnd: buf.duration,
          mono: buf.numberOfChannels === 1,
        });
        setStreamFlag(buf.duration > 10);
        setIsDirty(!isOggBytes(fileBytes));
      } catch (err) {
        if (!active) return;
        setSourceBuffer(null);
        setDecodeError(
          err instanceof Error
            ? `Không thể giải mã âm thanh: ${err.message}`
            : 'Không thể giải mã file âm thanh này.'
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedPath, fileBytes]);

  const stopPlayback = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (playSourceRef.current) {
      try {
        playSourceRef.current.stop();
        playSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      playSourceRef.current = null;
    }
    if (playCtxRef.current) {
      void playCtxRef.current.close().catch(() => {});
      playCtxRef.current = null;
    }
    setIsPlaying(false);
    setPlayProgress(0);
  };

  useEffect(() => {
    return () => stopPlayback();
  }, []);

  const startPlayback = async () => {
    if (!sourceBuffer) return;
    stopPlayback();

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    playCtxRef.current = ctx;

    const start = Math.max(0, Math.min(editOpts.trimStart, sourceBuffer.duration));
    const rawEnd =
      editOpts.trimEnd >= sourceBuffer.duration - 0.015 ? sourceBuffer.duration : editOpts.trimEnd;
    const end = Math.max(start + 0.02, Math.min(rawEnd, sourceBuffer.duration));
    const clipDur = Math.max(0.02, end - start);
    const rate = Math.max(0.25, Math.min(4, editOpts.playbackRate || 1));
    const outDur = clipDur / rate;

    const src = ctx.createBufferSource();
    src.buffer = sourceBuffer;
    src.playbackRate.value = rate;

    const gainNode = ctx.createGain();
    const now = ctx.currentTime;
    const targetGain = Math.max(0, editOpts.gain);

    if (editOpts.fadeIn > 0) {
      const fi = Math.min(editOpts.fadeIn, outDur / 2);
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.linearRampToValueAtTime(targetGain, now + fi);
    } else {
      gainNode.gain.setValueAtTime(targetGain, now);
    }

    if (editOpts.fadeOut > 0) {
      const fo = Math.min(editOpts.fadeOut, outDur / 2);
      gainNode.gain.setValueAtTime(targetGain, now + Math.max(0, outDur - fo));
      gainNode.gain.linearRampToValueAtTime(0.0001, now + outDur);
    }

    src.connect(gainNode);
    gainNode.connect(ctx.destination);

    playSourceRef.current = src;
    setIsPlaying(true);
    setPlayProgress(0);

    const startedAt = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      if (elapsed >= outDur) {
        stopPlayback();
        return;
      }
      setPlayProgress(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    src.onended = () => {
      stopPlayback();
    };
    src.start(0, start, clipDur);
  };

  // Draw waveform with trim region overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceBuffer) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, w, h);

    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const data = sourceBuffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / w));
    const mid = h / 2;

    const startRatio = sourceBuffer.duration > 0 ? editOpts.trimStart / sourceBuffer.duration : 0;
    const endRatio = sourceBuffer.duration > 0 ? editOpts.trimEnd / sourceBuffer.duration : 1;
    const startX = startRatio * w;
    const endX = endRatio * w;

    // Shaded trimmed-out areas
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, startX, h);
    ctx.fillRect(endX, 0, w - endX, h);

    // Waveform bars
    for (let x = 0; x < w; x++) {
      let min = 1;
      let max = -1;
      const base = x * step;
      for (let j = 0; j < step && base + j < data.length; j++) {
        const v = data[base + j];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const inRange = x >= startX && x <= endX;
      ctx.fillStyle = inRange ? '#ec4899' : '#3f3f46';
      const yTop = mid - max * mid * 0.88 * Math.min(1.5, editOpts.gain);
      const yBot = mid - min * mid * 0.88 * Math.min(1.5, editOpts.gain);
      ctx.fillRect(x, Math.max(2, yTop), 1, Math.max(1, Math.min(h - 2, yBot) - Math.max(2, yTop)));
    }

    // Trim markers
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, h);
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, h);
    ctx.stroke();
  }, [sourceBuffer, editOpts]);

  const handleUploadAudioFile = async (file: File, preset?: (typeof VANILLA_SOUND_PRESETS)[number]) => {
    setDecodeError(null);
    setSavedMsg(null);
    const bytes = new Uint8Array(await file.arrayBuffer());
    setRawOriginalBytes(bytes);

    const suggestedPath = preset
      ? preset.path
      : normalizeSoundArchivePath(`assets/minecraft/sounds/custom/${file.name}`);
    setTargetPath(suggestedPath);
    setSoundEventId(preset ? preset.eventId : archivePathToSoundResource(suggestedPath).replace(/\//g, '.'));

    try {
      const buf = await decodeAudioBytes(bytes);
      setSourceBuffer(buf);
      setEditOpts({
        ...DEFAULT_EDIT,
        trimStart: 0,
        trimEnd: buf.duration,
        mono: preset ? preset.recommendMono : buf.numberOfChannels === 1,
      });
      setStreamFlag(buf.duration > 10);
      setIsDirty(true);
    } catch (err) {
      setDecodeError(
        err instanceof Error
          ? `Không đọc được file âm thanh: ${err.message}`
          : 'Định dạng âm thanh không được trình duyệt hỗ trợ.'
      );
    }
  };

  const handleApplyPresetTarget = (presetPath: string) => {
    const preset = VANILLA_SOUND_PRESETS.find((p) => p.path === presetPath);
    if (!preset) return;
    setTargetPath(preset.path);
    setSoundEventId(preset.eventId);
    setEditOpts((prev) => ({ ...prev, mono: preset.recommendMono }));
    setIsDirty(true);
  };

  const updateEdit = (patch: Partial<AudioEditOptions>) => {
    setEditOpts((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
  };

  const handleSaveToPack = async () => {
    if (!sourceBuffer) return;
    setSaving(true);
    setSavedMsg(null);
    try {
      const finalArchivePath = normalizeSoundArchivePath(targetPath);

      // If original is already OGG and user didn't modify audio parameters, we can still re-encode if edited
      const needsEncode =
        !rawOriginalBytes ||
        !isOggBytes(rawOriginalBytes) ||
        editOpts.trimStart > 0 ||
        Math.abs(editOpts.trimEnd - sourceBuffer.duration) > 0.05 ||
        editOpts.gain !== 1 ||
        editOpts.playbackRate !== 1 ||
        editOpts.fadeIn > 0 ||
        editOpts.fadeOut > 0 ||
        editOpts.normalize ||
        (editOpts.mono && sourceBuffer.numberOfChannels > 1);

      let oggBytes: Uint8Array;
      if (needsEncode) {
        const rendered = await processAudioBuffer(sourceBuffer, editOpts);
        oggBytes = await encodeAudioBufferToOgg(rendered, editOpts.vbrQuality);
      } else {
        oggBytes = rawOriginalBytes!;
      }

      let updatedSoundsJson: string | undefined;
      if (updateSoundsJson && soundEventId.trim()) {
        const existingText = soundsJsonBytes ? new TextDecoder().decode(soundsJsonBytes) : null;
        const resourceId = archivePathToSoundResource(finalArchivePath);
        updatedSoundsJson = upsertSoundsJson(existingText, soundEventId.trim(), resourceId, {
          replace: true,
          stream: streamFlag,
        });
      }

      await onSaveSound({
        archivePath: finalArchivePath,
        oggBytes,
        updatedSoundsJson,
        oldPathToDelete:
          selectedPath && selectedPath !== finalArchivePath ? selectedPath : undefined,
      });

      setRawOriginalBytes(oggBytes);
      setIsDirty(false);
      setSavedMsg(`Đã xuất chuẩn Ogg Vorbis (${(oggBytes.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      setDecodeError(
        err instanceof Error ? `Lỗi mã hóa OGG: ${err.message}` : 'Lỗi khi lưu file âm thanh.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadOgg = async () => {
    if (!sourceBuffer) return;
    setSaving(true);
    try {
      const rendered = await processAudioBuffer(sourceBuffer, editOpts);
      const ogg = await encodeAudioBufferToOgg(rendered, editOpts.vbrQuality);
      const copy = new Uint8Array(ogg.byteLength);
      copy.set(ogg);
      const blob = new Blob([copy], { type: 'audio/ogg' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = normalizeSoundArchivePath(targetPath).split('/').pop() || 'sound.ogg';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setSaving(false);
    }
  };

  const effectiveDuration = useMemo(() => {
    if (!sourceBuffer) return 0;
    const clip = Math.max(0.02, editOpts.trimEnd - editOpts.trimStart);
    return clip / (editOpts.playbackRate || 1);
  }, [sourceBuffer, editOpts.trimStart, editOpts.trimEnd, editOpts.playbackRate]);

  return (
    <main className="flex-1 flex flex-col bg-zinc-950 min-w-0 h-full overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-12 bg-zinc-900 border-b border-zinc-800 px-3 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-mono text-zinc-200 truncate">
            {sourceBuffer ? targetPath : 'Sound Studio (Ogg Vorbis cho Minecraft)'}
          </span>
          {savedMsg && (
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-medium flex items-center gap-1 shrink-0">
              <CheckCircle2 className="w-3 h-3" /> {savedMsg}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <label className="px-2.5 py-1.5 rounded bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Âm thanh (.ogg/.mp3/.wav)</span>
            <input
              type="file"
              accept=".ogg,.mp3,.wav,.m4a,.webm,.flac,audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUploadAudioFile(f);
                e.currentTarget.value = '';
              }}
            />
          </label>

          {sourceBuffer && (
            <>
              <button
                onClick={() =>
                  updateEdit({
                    ...DEFAULT_EDIT,
                    trimStart: 0,
                    trimEnd: sourceBuffer.duration,
                    mono: sourceBuffer.numberOfChannels === 1,
                  })
                }
                title="Đặt lại thông số chỉnh sửa"
                className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => void handleDownloadOgg()}
                disabled={saving}
                title="Tải file .ogg đã chỉnh về máy"
                className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => void handleSaveToPack()}
                disabled={saving}
                className="px-3 py-1.5 rounded bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{saving ? 'Đang mã hóa .ogg...' : isDirty ? 'Lưu .ogg vào Pack' : 'Lưu lại .ogg'}</span>
              </button>

              {selectedPath && (
                <button
                  onClick={() => void onDeleteFile(selectedPath)}
                  title="Xóa âm thanh này khỏi pack"
                  className="p-1.5 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {decodeError && (
        <div className="bg-rose-950/60 border-b border-rose-500/40 px-4 py-2 text-xs text-rose-200 shrink-0">
          {decodeError}
        </div>
      )}

      {/* Body */}
      {sourceBuffer ? (
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Waveform + Player Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-zinc-200 font-medium">
                <Music className="w-4 h-4 text-pink-400" />
                <span>Dạng sóng & Nghe thử</span>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">
                Gốc: {sourceBuffer.duration.toFixed(2)}s • {sourceBuffer.sampleRate}Hz •{' '}
                {sourceBuffer.numberOfChannels === 1 ? 'Mono' : 'Stereo'} → Xuất:{' '}
                <span className="text-emerald-400">{effectiveDuration.toFixed(2)}s</span> (
                {editOpts.mono ? 'Mono' : 'Stereo'})
              </div>
            </div>

            <canvas
              ref={canvasRef}
              width={900}
              height={120}
              className="w-full h-28 rounded-lg border border-zinc-800"
            />

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (isPlaying) stopPlayback();
                  else void startPlayback();
                }}
                className="px-3.5 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 transition"
              >
                {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Dừng' : 'Phát bản đã chỉnh'}</span>
              </button>
              <div className="flex-1 flex items-center gap-2.5 text-[11px] font-mono text-zinc-400">
                <span className="w-12 text-right text-zinc-200">{playProgress.toFixed(1)}s</span>
                <div className="flex-1 h-2 bg-zinc-950 border border-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pink-500 transition-[width] duration-75"
                    style={{
                      width: `${
                        effectiveDuration > 0
                          ? Math.min(100, (playProgress / effectiveDuration) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="w-12 text-emerald-400">{effectiveDuration.toFixed(1)}s</span>
              </div>
            </div>
          </div>

          {/* 2-Column Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Audio Editing Controls */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3.5 text-xs">
              <div className="flex items-center gap-2 font-semibold text-zinc-100">
                <Sliders className="w-4 h-4 text-sky-400" />
                <span>Chỉnh sửa âm thanh</span>
              </div>

              {/* Trim Start / End */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>Cắt đầu (giây)</span>
                    <input
                      type="number"
                      step={0.05}
                      min={0}
                      max={Math.max(0, editOpts.trimEnd - 0.05)}
                      value={editOpts.trimStart}
                      onChange={(e) =>
                        updateEdit({
                          trimStart: Math.max(
                            0,
                            Math.min(Number(e.target.value) || 0, editOpts.trimEnd - 0.05)
                          ),
                        })
                      }
                      className="w-16 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-right font-mono text-zinc-200"
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={sourceBuffer.duration}
                    step={0.01}
                    value={editOpts.trimStart}
                    onChange={(e) =>
                      updateEdit({
                        trimStart: Math.min(Number(e.target.value), editOpts.trimEnd - 0.05),
                      })
                    }
                    className="w-full accent-sky-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>Cắt cuối (giây)</span>
                    <input
                      type="number"
                      step={0.05}
                      min={editOpts.trimStart + 0.05}
                      max={sourceBuffer.duration}
                      value={Number(editOpts.trimEnd.toFixed(2))}
                      onChange={(e) =>
                        updateEdit({
                          trimEnd: Math.min(
                            sourceBuffer.duration,
                            Math.max(Number(e.target.value) || 0.05, editOpts.trimStart + 0.05)
                          ),
                        })
                      }
                      className="w-16 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-right font-mono text-zinc-200"
                    />
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={sourceBuffer.duration}
                    step={0.01}
                    value={editOpts.trimEnd}
                    onChange={(e) =>
                      updateEdit({
                        trimEnd: Math.max(Number(e.target.value), editOpts.trimStart + 0.05),
                      })
                    }
                    className="w-full accent-sky-500"
                  />
                </div>
              </div>

              {/* Volume */}
              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>Âm lượng (Volume)</span>
                  <span className="font-mono text-zinc-200">{Math.round(editOpts.gain * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={3}
                  step={0.05}
                  value={editOpts.gain}
                  onChange={(e) => updateEdit({ gain: Number(e.target.value) })}
                  className="w-full accent-pink-500"
                />
              </div>

              {/* Playback Rate / Pitch */}
              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>Tốc độ / Cao độ (Pitch)</span>
                  <span className="font-mono text-zinc-200">{editOpts.playbackRate.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={editOpts.playbackRate}
                  onChange={(e) => updateEdit({ playbackRate: Number(e.target.value) })}
                  className="w-full accent-pink-500"
                />
              </div>

              {/* Fade In / Out */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>Fade In (s)</span>
                    <span className="font-mono text-zinc-200">{editOpts.fadeIn.toFixed(2)}s</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.min(5, effectiveDuration / 2)}
                    step={0.05}
                    value={editOpts.fadeIn}
                    onChange={(e) => updateEdit({ fadeIn: Number(e.target.value) })}
                    className="w-full accent-emerald-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>Fade Out (s)</span>
                    <span className="font-mono text-zinc-200">{editOpts.fadeOut.toFixed(2)}s</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.min(5, effectiveDuration / 2)}
                    step={0.05}
                    value={editOpts.fadeOut}
                    onChange={(e) => updateEdit({ fadeOut: Number(e.target.value) })}
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>

              {/* Mono & Normalize */}
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editOpts.mono}
                    onChange={(e) => updateEdit({ mono: e.target.checked })}
                    className="accent-pink-500"
                  />
                  <span>Chuyển sang Mono (khuyên dùng cho hiệu ứng 3D)</span>
                </label>

                <label className="flex items-center gap-2 text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editOpts.normalize}
                    onChange={(e) => updateEdit({ normalize: e.target.checked })}
                    className="accent-pink-500"
                  />
                  <span>Normalize (cân bằng âm lượng to rõ)</span>
                </label>
              </div>
            </div>

            {/* Minecraft Target Mapping */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3.5 text-xs">
              <div className="font-semibold text-zinc-100">Gắn vào Minecraft Resource Pack</div>

              <div>
                <label className="block text-zinc-400 mb-1">
                  Chọn nhanh âm thanh Vanilla muốn thay thế
                </label>
                <select
                  value={
                    VANILLA_SOUND_PRESETS.some((p) => p.path === targetPath) ? targetPath : ''
                  }
                  onChange={(e) => {
                    if (e.target.value) handleApplyPresetTarget(e.target.value);
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-pink-500"
                >
                  <option value="">-- Tự nhập đường dẫn bên dưới --</option>
                  {VANILLA_SOUND_PRESETS.map((p) => (
                    <option key={p.path} value={p.path}>
                      [{p.group}] {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">
                  Đường dẫn lưu trong Pack (tự động xuất chuẩn <code className="text-emerald-400">.ogg</code>)
                </label>
                <input
                  type="text"
                  value={targetPath}
                  onChange={(e) => {
                    setTargetPath(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 font-mono text-zinc-100 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-2.5">
                <label className="flex items-center gap-2 text-zinc-200 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateSoundsJson}
                    onChange={(e) => setUpdateSoundsJson(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  <span>Tự động cập nhật assets/minecraft/sounds.json</span>
                </label>

                {updateSoundsJson && (
                  <div className="space-y-2 pl-5">
                    <div>
                      <label className="block text-zinc-400 text-[11px] mb-1">
                        Sound Event ID (ví dụ: ui.button.click, entity.player.attack.crit)
                      </label>
                      <input
                        type="text"
                        value={soundEventId}
                        onChange={(e) => setSoundEventId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 font-mono text-zinc-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-zinc-300 text-[11px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={streamFlag}
                        onChange={(e) => setStreamFlag(e.target.checked)}
                        className="accent-emerald-500"
                      />
                      <span>Bật stream: true (khuyên bật cho nhạc nền / đĩa nhạc &gt; 10 giây)</span>
                    </label>
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>Chất lượng Ogg Vorbis (VBR)</span>
                  <span className="font-mono text-zinc-200">{editOpts.vbrQuality} / 10</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={editOpts.vbrQuality}
                  onChange={(e) => updateEdit({ vbrQuality: Number(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 p-8 text-center space-y-5 overflow-y-auto">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <Volume2 className="w-7 h-7 text-emerald-400" />
          </div>
          <div className="space-y-1.5 max-w-lg">
            <h2 className="text-sm font-semibold text-zinc-200">
              Sound Studio — Upload & Chỉnh Âm Thanh cho Resource Pack
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Upload trực tiếp file <code className="text-emerald-300">.mp3</code>,{' '}
              <code className="text-emerald-300">.wav</code>,{' '}
              <code className="text-emerald-300">.m4a</code> hoặc{' '}
              <code className="text-emerald-300">.ogg</code>. Studio sẽ tự cắt, chỉnh âm lượng/cao độ, chuyển Mono và mã hóa sang chuẩn{' '}
              <strong className="text-zinc-200">Ogg Vorbis (.ogg)</strong> chạy trực tiếp trong Minecraft 26.3.
            </p>
          </div>

          <label className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition">
            <Upload className="w-4 h-4" />
            <span>Chọn file âm thanh từ máy tính</span>
            <input
              type="file"
              accept=".ogg,.mp3,.wav,.m4a,.webm,.flac,audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUploadAudioFile(f);
                e.currentTarget.value = '';
              }}
            />
          </label>

          <div className="max-w-3xl w-full bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 text-left">
            <div className="text-[11px] font-medium text-zinc-300 mb-2.5">
              Hoặc chọn nhanh âm thanh Vanilla để thay thế ({VANILLA_SOUND_PRESETS.length} mẫu):
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 max-h-60 overflow-y-auto pr-1">
              {VANILLA_SOUND_PRESETS.map((preset) => (
                <label
                  key={preset.path}
                  className="px-2.5 py-1.5 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 cursor-pointer truncate transition"
                  title={`Upload file âm thanh để thay cho ${preset.path}`}
                >
                  + {preset.label.split(' (')[0]}
                  <input
                    type="file"
                    accept=".ogg,.mp3,.wav,.m4a,.webm,.flac,audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUploadAudioFile(f, preset);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
