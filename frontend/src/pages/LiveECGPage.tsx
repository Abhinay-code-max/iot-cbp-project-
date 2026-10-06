import React, { useState, useEffect } from 'react';
import { useHealth } from '../context/HealthContext';
import { ECGChart } from '../components/ecg/ECGChart';
import { HealthStatusBadge } from '../components/common/HealthStatusBadge';
import { MedicalDisclaimer } from '../components/common/MedicalDisclaimer';
import { RhythmType } from '../types';
import {
  Activity,
  Heart,
  Wifi,
  Clock,
  Sparkles,
  Camera,
  Play,
  RotateCcw,
  Sliders,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

export const LiveECGPage: React.FC = () => {
  const {
    currentBpm,
    currentRhythm,
    deviceStatus,
    personaMode,
    simulateRhythm
  } = useHealth();

  const [activeLead, setActiveLead] = useState('Lead II');
  const [sessionSeconds, setSessionSeconds] = useState(3120); // ~52 mins
  const [snapshotSuccess, setSnapshotSuccess] = useState(false);

  // Monitoring timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h > 0 ? `${h}h ` : ''}${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const handleTakeSnapshot = () => {
    setSnapshotSuccess(true);
    setTimeout(() => setSnapshotSuccess(false), 2500);
  };

  const isConnected = deviceStatus.connectionState === 'connected' && currentBpm > 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Quick Telemetry Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-emerald-500" />
            <span>Live ECG Telemetry Monitor</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time multi-lead biomedical signal streaming at 250 samples/second
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleTakeSnapshot}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition shadow-xs"
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span>{snapshotSuccess ? 'Snapshot Captured!' : 'Capture Strip'}</span>
          </button>
        </div>
      </div>

      {/* Live Biometric Strip Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Heart Rate */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Heart className={`w-3.5 h-3.5 ${isConnected ? 'text-rose-500 animate-heartbeat' : 'text-slate-500'}`} />
            Current Heart Rate
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {isConnected ? currentBpm : '-'}
            </span>
            {isConnected && <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">BPM</span>}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {isConnected ? `R-R interval: ${Math.round(60000 / currentBpm)} ms` : 'R-R interval: -'}
          </span>
        </div>

        {/* Rhythm Classification */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Rhythm Status
          </span>
          <div className="mt-2">
            <HealthStatusBadge rhythm={currentRhythm} disconnected={!isConnected} />
          </div>
          <span className="text-[10px] text-slate-400 mt-2 block">
            {isConnected
              ? currentRhythm === 'normal'
                ? 'Sinus P-QRS-T regular'
                : 'Telemetry tag for review'
              : 'Waiting for telemetry...'}
          </span>
        </div>

        {/* Signal Quality Index */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
            Signal Quality (SQI)
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {deviceStatus.connectionState === 'connected' ? `${deviceStatus.signalQuality}%` : '-'}
            </span>
            <span className={`text-xs font-semibold ${deviceStatus.connectionState === 'connected' ? 'text-emerald-500' : 'text-slate-500'}`}>
              {deviceStatus.connectionState === 'connected' ? 'Optimal' : 'Offline'}
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                deviceStatus.signalQuality >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${deviceStatus.signalQuality}%` }}
            />
          </div>
        </div>

        {/* Monitoring Duration */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            Session Duration
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {deviceStatus.connectionState === 'connected' ? formatTimer(sessionSeconds) : '-'}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block font-mono">
            Buffered samples: {deviceStatus.connectionState === 'connected' ? '2,000 pts' : '-'}
          </span>
        </div>
      </div>

      {/* Main High-Performance Canvas ECG Oscilloscope */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">
              {activeLead} Waveform
            </span>
            <span>•</span>
            <span className="font-mono">Standard 25 mm/s Medical Grid</span>
          </div>
          <span className="text-[11px] italic hidden sm:inline">
            Drag to highlight anomaly region
          </span>
        </div>

        <ECGChart
          height={400}
          persona={personaMode}
          lead={activeLead}
          showControls={true}
        />
      </div>

      {/* Interactive Arrhythmia Simulation & Diagnostic Testing Suite */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-500" />
              <span>Cardiac Pattern Simulation Suite</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Simulate various rhythm conditions to evaluate telemetry behavior and automated detection alerts
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">Mock Hardware Engine</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-2">
          <button
            onClick={() => simulateRhythm('normal', 72)}
            className={`p-3 rounded-xl border text-left transition ${
              currentRhythm === 'normal'
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="text-xs font-bold">Normal Sinus</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">72 BPM • Regular</div>
          </button>

          <button
            onClick={() => simulateRhythm('bradycardia', 48)}
            className={`p-3 rounded-xl border text-left transition ${
              currentRhythm === 'bradycardia'
                ? 'border-amber-500/60 bg-amber-500/10 text-amber-500 font-semibold'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="text-xs font-bold">Bradycardia</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">48 BPM • Low Rate</div>
          </button>

          <button
            onClick={() => simulateRhythm('tachycardia', 142)}
            className={`p-3 rounded-xl border text-left transition ${
              currentRhythm === 'tachycardia'
                ? 'border-amber-500/60 bg-amber-500/10 text-amber-500 font-semibold'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="text-xs font-bold">Tachycardia</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">142 BPM • Elevated</div>
          </button>

          <button
            onClick={() => simulateRhythm('irregular', 86)}
            className={`p-3 rounded-xl border text-left transition ${
              currentRhythm === 'irregular'
                ? 'border-amber-500/60 bg-amber-500/10 text-amber-500 font-semibold'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="text-xs font-bold">Irregular Rhythm</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">Variable R-R Jitter</div>
          </button>

          <button
            onClick={() => simulateRhythm('possible_arrhythmia', 108)}
            className={`p-3 rounded-xl border text-left transition ${
              currentRhythm === 'possible_arrhythmia'
                ? 'border-rose-500/60 bg-rose-500/10 text-rose-500 font-semibold'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="text-xs font-bold">Arrhythmia / PVC</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">Premature QRS spike</div>
          </button>
        </div>
      </div>

      <MedicalDisclaimer />
    </div>
  );
};
