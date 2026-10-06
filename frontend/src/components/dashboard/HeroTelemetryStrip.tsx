import React, { useEffect, useState, useRef } from 'react';
import { useHealth } from '../../context/HealthContext';
import { HealthStatusBadge } from '../common/HealthStatusBadge';
import { Heart, Activity, Wifi, Clock, Gauge, Play, Pause } from 'lucide-react';

interface Props {
  onCardClick?: (metric: string) => void;
}

export const HeroTelemetryStrip: React.FC<Props> = ({ onCardClick }) => {
  const { currentBpm, currentRhythm, deviceStatus, monitoringMode, toggleMonitoring } = useHealth();
  const [sparklineData, setSparklineData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);
  const [syncDiffSeconds, setSyncDiffSeconds] = useState(0);

  const isConnected = deviceStatus.connectionState === 'connected' && currentBpm > 0;

  // Maintain 60-second micro-sparkline buffer (only when genuinely connected)
  useEffect(() => {
    if (!isConnected) {
      setSparklineData([0, 0, 0, 0, 0, 0, 0, 0]);
      return;
    }
    setSparklineData((prev) => {
      const next = [...prev, currentBpm];
      if (next.length > 25) next.shift();
      return next;
    });
  }, [currentBpm, isConnected]);

  // Keep last sync time updated
  useEffect(() => {
    if (deviceStatus.connectionState !== 'connected' || deviceStatus.lastSyncTime === 0) {
      setSyncDiffSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      const diff = Math.floor((Date.now() - deviceStatus.lastSyncTime) / 1000);
      setSyncDiffSeconds(Math.max(0, diff));
    }, 1000);
    return () => clearInterval(timer);
  }, [deviceStatus.lastSyncTime, deviceStatus.connectionState]);

  const minVal = Math.min(...sparklineData, 40);
  const maxVal = Math.max(...sparklineData, 120);
  const range = maxVal - minVal || 1;

  // Build SVG sparkline path
  const svgWidth = 140;
  const svgHeight = 36;
  const points = sparklineData.map((val, idx) => {
    const x = (idx / Math.max(1, sparklineData.length - 1)) * svgWidth;
    const y = isConnected
      ? svgHeight - ((val - minVal) / range) * (svgHeight - 8) - 4
      : svgHeight / 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm text-slate-100 transition-all">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 items-center">
        {/* Metric 1: Current Heart Rate */}
        <div
          onClick={() => onCardClick?.('heart_rate')}
          className="col-span-2 sm:col-span-1 lg:col-span-1 cursor-pointer group hover:opacity-90 transition"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
            <Heart className={`w-3.5 h-3.5 ${isConnected ? 'text-rose-500 animate-heartbeat' : 'text-slate-500'}`} />
            <span>Heart Rate</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums text-white">
              {isConnected ? currentBpm : '-'}
            </span>
            {isConnected && <span className="text-sm font-semibold text-slate-400">BPM</span>}
          </div>

          {/* Micro sparkline */}
          <div className="mt-2 flex items-center gap-2">
            <svg width={svgWidth} height={svgHeight} className="overflow-visible">
              <polyline
                fill="none"
                stroke={isConnected ? '#10b981' : '#475569'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
              />
            </svg>
            <span className="text-[10px] text-slate-500 font-mono">
              {isConnected ? '60s' : '-'}
            </span>
          </div>
        </div>

        {/* Metric 2: Rhythm Classification */}
        <div
          onClick={() => onCardClick?.('rhythm')}
          className="cursor-pointer group hover:opacity-90 transition"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Heart Rhythm</span>
          </div>
          <div className="mt-1">
            <HealthStatusBadge rhythm={currentRhythm} disconnected={!isConnected} size="md" />
          </div>
          <p className="text-[11px] text-slate-400 mt-2 line-clamp-1">
            {isConnected
              ? currentRhythm === 'normal'
                ? 'Regular sinus wave • R-R regular'
                : 'Algorithmic telemetry review active'
              : 'Waiting for ESP32 connection...'}
          </p>
        </div>

        {/* Metric 3: Device State */}
        <div
          onClick={() => onCardClick?.('device')}
          className="cursor-pointer group hover:opacity-90 transition"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
            <span>IoT Hardware</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-400 ring-4 ring-emerald-400/20' : 'bg-rose-500'
              }`}
            />
            <span className="text-base font-semibold text-slate-200 capitalize">
              {isConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            {isConnected
              ? deviceStatus.connectionMode === 'serial'
                ? 'USB COM (115.2k)'
                : deviceStatus.connectionMode === 'websocket'
                ? 'Wi-Fi AP (ESP32)'
                : 'Simulated ESP32 Stream'
              : 'Not Connected (-)'}
          </p>
        </div>

        {/* Metric 4: Last Synchronized Time */}
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Telemetry Sync</span>
          </div>
          <div className="text-base font-semibold text-slate-200 tabular-nums">
            {isConnected ? (syncDiffSeconds === 0 ? 'Just now' : `${syncDiffSeconds}s ago`) : '-'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            SQI:{' '}
            <span className={`font-mono font-medium ${isConnected ? 'text-emerald-400' : 'text-slate-500'}`}>
              {isConnected ? `${deviceStatus.signalQuality}%` : '-'}
            </span>
          </p>
        </div>

        {/* Metric 5: Active Monitoring Mode */}
        <div className="col-span-2 sm:col-span-1 lg:col-span-1 border-t sm:border-t-0 sm:border-l border-slate-800 sm:pl-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
            <span>Monitoring Mode</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-base font-semibold text-slate-200 capitalize">
                {isConnected
                  ? monitoringMode === 'sports'
                    ? 'Sports Mode'
                    : monitoringMode === 'clinical'
                    ? 'Clinical Ward'
                    : 'Normal Baseline'
                  : '-'}
              </span>
              <p className="text-[11px] text-slate-400">
                {isConnected ? 'Continuous 250Hz' : 'Standby'}
              </p>
            </div>
            <button
              onClick={toggleMonitoring}
              className={`p-2 rounded-xl transition ${
                deviceStatus.isMonitoring && isConnected
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
              title={deviceStatus.isMonitoring ? 'Pause Monitoring' : 'Start Monitoring'}
            >
              {deviceStatus.isMonitoring && isConnected ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
