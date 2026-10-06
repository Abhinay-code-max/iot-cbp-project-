import React, { useRef, useEffect, useState, useCallback } from 'react';
import { deviceService } from '../../services/deviceService';
import { Play, Pause, ZoomIn, ZoomOut, Maximize2, Tag, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { PersonaMode, RhythmType } from '../../types';

interface Props {
  height?: number;
  persona?: PersonaMode;
  lead?: string;
  onRegionSelected?: (startSec: number, endSec: number) => void;
  showControls?: boolean;
}

export const ECGChart: React.FC<Props> = ({
  height = 340,
  persona = 'clinical',
  lead = 'Lead II',
  onRegionSelected,
  showControls = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Stream state
  const [isPaused, setIsPaused] = useState(false);
  const [sweepSpeed, setSweepSpeed] = useState<number>(25); // mm/s (12.5, 25, 50)
  const [gain, setGain] = useState<number>(1.0); // 1.0 = standard 10mm/mV
  const [activeLead, setActiveLead] = useState<string>(lead);
  const [selectionRange, setSelectionRange] = useState<{ startX: number; endX: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [annotationPrompt, setAnnotationPrompt] = useState(false);

  // Real-time ring buffer storage for smooth 60fps rendering without React Fiber overhead
  const samplesRef = useRef<number[]>([]);
  const headRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const currentSqi = deviceService.getStatus().signalQuality;
  const isConnected = deviceService.getStatus().connectionState === 'connected';

  // Subscribe to device stream and push incoming voltages into ring buffer
  useEffect(() => {
    const maxCapacity = 2000; // ~8 seconds at 250Hz
    const unsub = deviceService.subscribeECG((sample) => {
      if (isPausedRef.current) return;

      const buf = samplesRef.current;
      buf.push(sample.voltage);
      if (buf.length > maxCapacity) {
        buf.shift();
      }
    });

    return () => unsub();
  }, []);

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.clientWidth;
    let ch = height;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = ch * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const render = () => {
      if (!ctx || !canvas) return;
      const w = canvas.clientWidth;
      const h = height;

      // Handle resize dynamically
      if (canvas.width !== w * window.devicePixelRatio || canvas.height !== h * window.devicePixelRatio) {
        canvas.width = w * window.devicePixelRatio;
        canvas.height = h * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }

      ctx.clearRect(0, 0, w, h);

      // --- 1. Draw Medical Calibration Grid ---
      const isClinicalMode = persona === 'clinical';
      const isDark = document.documentElement.classList.contains('dark');

      if (isClinicalMode) {
        // Standard ECG grid: 1mm minor boxes, 5mm major boxes
        // At 25mm/s: 1mm = 0.04s. 5mm = 0.2s
        const minorStep = 10;
        const majorStep = 50;

        ctx.lineWidth = 0.5;
        ctx.strokeStyle = isDark ? 'rgba(30, 41, 59, 0.65)' : 'rgba(239, 68, 68, 0.12)';

        ctx.beginPath();
        for (let x = 0; x < w; x += minorStep) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
        }
        for (let y = 0; y < h; y += minorStep) {
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
        }
        ctx.stroke();

        ctx.lineWidth = 1;
        ctx.strokeStyle = isDark ? 'rgba(51, 65, 85, 0.85)' : 'rgba(239, 68, 68, 0.3)';
        ctx.beginPath();
        for (let x = 0; x < w; x += majorStep) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
        }
        for (let y = 0; y < h; y += majorStep) {
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
        }
        ctx.stroke();

        // 1 mV Standard Calibration Pulse Box on left edge
        const midY = h / 2;
        const pulseHeight = 40 * gain;
        ctx.strokeStyle = isDark ? '#10B981' : '#dc2626';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(10, midY);
        ctx.lineTo(18, midY);
        ctx.lineTo(18, midY - pulseHeight);
        ctx.lineTo(26, midY - pulseHeight);
        ctx.lineTo(26, midY);
        ctx.lineTo(34, midY);
        ctx.stroke();

        // Calibration text
        ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
        ctx.font = '10px Inter, monospace';
        ctx.fillText('1mV', 16, midY - pulseHeight - 4);
      } else {
        // Sleek Minimal Fitness Grid
        ctx.strokeStyle = isDark ? 'rgba(30, 41, 59, 0.35)' : 'rgba(226, 232, 240, 0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let y = h / 4; y < h; y += h / 4) {
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
        }
        ctx.stroke();
      }

      // --- 2. Render Selection Highlight if user drag-selected ---
      if (selectionRange) {
        const start = Math.min(selectionRange.startX, selectionRange.endX);
        const selWidth = Math.abs(selectionRange.endX - selectionRange.startX);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.fillRect(start, 0, selWidth, h);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(start, 0, selWidth, h);
        ctx.setLineDash([]);
      }

      // --- 3. Draw ECG Waveform ---
      const samples = samplesRef.current;
      if (samples.length > 1) {
        const midY = h / 2;
        const amplitudeFactor = (h * 0.28) * gain;
        const totalVisibleSamples = Math.floor(w / 1.5);
        const startIndex = Math.max(0, samples.length - totalVisibleSamples);
        const visibleSlice = samples.slice(startIndex);

        ctx.beginPath();
        ctx.lineWidth = isClinicalMode ? 1.8 : 2.4;
        ctx.strokeStyle = isClinicalMode
          ? (isDark ? '#10B981' : '#dc2626')
          : '#06b6d4';
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Add soft glow effect in dark mode
        if (isDark) {
          ctx.shadowColor = isClinicalMode ? 'rgba(16, 185, 129, 0.45)' : 'rgba(6, 182, 212, 0.4)';
          ctx.shadowBlur = 4;
        } else {
          ctx.shadowBlur = 0;
        }

        const stepX = w / totalVisibleSamples;
        for (let i = 0; i < visibleSlice.length; i++) {
          const x = i * stepX;
          const y = midY - visibleSlice[i] * amplitudeFactor;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // reset

        // Sweep beam dot at newest position
        if (!isPausedRef.current && visibleSlice.length > 0) {
          const lastX = (visibleSlice.length - 1) * stepX;
          const lastY = midY - visibleSlice[visibleSlice.length - 1] * amplitudeFactor;
          ctx.fillStyle = isClinicalMode ? (isDark ? '#34d399' : '#dc2626') : '#38bdf8';
          ctx.beginPath();
          ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [height, persona, gain, selectionRange]);

  // Handle Drag Selection on Canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    setIsDragging(true);
    setSelectionRange({ startX: x, endX: x });
    setAnnotationPrompt(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    setSelectionRange((prev) => prev ? { ...prev, endX: x } : null);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (selectionRange && Math.abs(selectionRange.endX - selectionRange.startX) > 20) {
      setAnnotationPrompt(true);
      if (onRegionSelected) {
        onRegionSelected(selectionRange.startX, selectionRange.endX);
      }
    } else {
      setSelectionRange(null);
    }
  };

  const clearSelection = () => {
    setSelectionRange(null);
    setAnnotationPrompt(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm transition-all"
    >
      {/* Top Header / Meta Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {isConnected && !isPaused ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-500"></span>
              )}
            </span>
            <span className="font-semibold text-xs tracking-wider uppercase text-slate-700 dark:text-slate-300">
              {activeLead}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            <span>250 Hz</span>
            <span>•</span>
            <span>{sweepSpeed} mm/s</span>
            <span>•</span>
            <span>{gain * 10} mm/mV</span>
          </div>
        </div>

        {/* Lead Selector & Controls */}
        {showControls && (
          <div className="flex items-center gap-1.5">
            {/* Lead toggle */}
            <select
              value={activeLead}
              onChange={(e) => setActiveLead(e.target.value)}
              className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
            >
              <option value="Lead II">Lead II (Bipolar Standard)</option>
              <option value="Lead I">Lead I (Right-Left Arm)</option>
              <option value="Lead III">Lead III (Left Arm-Left Leg)</option>
              <option value="V1 (Precordial)">V1 (Chest Derivation)</option>
            </select>

            {/* Sweep Speed button */}
            <div className="hidden md:flex items-center border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 text-xs bg-slate-100 dark:bg-slate-800">
              {[12.5, 25, 50].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setSweepSpeed(speed)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    sweepSpeed === speed
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                  title={`${speed} mm/s sweep speed`}
                >
                  {speed}
                </button>
              ))}
            </div>

            {/* Gain Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setGain((g) => Math.max(0.5, g - 0.25))}
                className="p-1 rounded-md text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                title="Decrease Gain"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 min-w-[28px] text-center">
                {gain}x
              </span>
              <button
                onClick={() => setGain((g) => Math.min(2.5, g + 0.25))}
                className="p-1 rounded-md text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                title="Increase Gain"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Freeze / Resume */}
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                isPaused
                  ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {isPaused ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3" />}
              <span>{isPaused ? 'Resume' : 'Freeze'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Canvas Area */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          style={{ height: `${height}px`, width: '100%' }}
          className={`cursor-crosshair block ${persona === 'clinical' ? 'ecg-grid-dark' : 'bg-slate-950'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />

        {/* Unambiguous Empty / Disconnected State Overlay (Requirement #⚡) */}
        {!isConnected && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-3 animate-pulse">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-base font-semibold text-slate-100">Telemetry Sensor Disconnected</h4>
            <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
              ECG leads are currently offline or repositioning. Re-attach electrode pads or check USB / Wi-Fi link. No flatline diagnosis is assumed.
            </p>
            <button
              onClick={() => deviceService.reconnect()}
              className="mt-4 flex items-center gap-2 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reconnect Stream</span>
            </button>
          </div>
        )}

        {/* Region Annotation Banner if drag-selected */}
        {annotationPrompt && selectionRange && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-cyan-500/40 shadow-xl rounded-xl px-4 py-2 flex items-center gap-3 backdrop-blur-md z-20 animate-fade-in">
            <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Interval Highlighted</span>
            </div>
            <span className="text-xs text-slate-400 border-l border-slate-700 pl-3">
              Width: {Math.round(Math.abs(selectionRange.endX - selectionRange.startX))} px
            </span>
            <button
              onClick={() => {
                deviceService.simulateRhythm('possible_arrhythmia');
                clearSelection();
              }}
              className="text-xs px-2.5 py-1 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition"
            >
              Tag as Rhythm Anomaly
            </button>
            <button
              onClick={clearSelection}
              className="text-xs text-slate-400 hover:text-white transition"
            >
              Clear
            </button>
          </div>
        )}

        {/* Subtle Canvas Status Indicator watermark */}
        <div className="absolute bottom-2.5 right-3 text-[10px] text-slate-500 font-mono pointer-events-none select-none flex items-center gap-2">
          <span>Lead II AD8232</span>
          <span>•</span>
          <span>SQI {currentSqi}%</span>
        </div>
      </div>
    </div>
  );
};
