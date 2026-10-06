import React from 'react';
import { useHealth } from '../context/HealthContext';
import { HeartRateTrendChart } from '../components/analytics/HeartRateTrendChart';
import { HeartRateZone } from '../components/analytics/HeartRateZone';
import { MedicalDisclaimer } from '../components/common/MedicalDisclaimer';
import { TrendingUp, Heart, Activity, ShieldCheck, ArrowDownRight, ArrowUpRight } from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const { currentBpm, deviceStatus } = useHealth();
  const isConnected = deviceStatus.connectionState === 'connected' && currentBpm > 0;

  const avgBpm = 74;
  const restingBpm = 61;
  const minBpm = 52;
  const maxBpm = 154;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
          <TrendingUp className="w-6 h-6 text-emerald-500" />
          <span>Heart Rate Analytics & Trends</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Longitudinal analysis of cardiac frequency, resting baselines, and exertion intervals
        </p>
      </div>

      {/* 5 Core Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Current BPM */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <Heart className={`w-3.5 h-3.5 ${isConnected ? 'text-rose-500 animate-heartbeat' : 'text-slate-500'}`} />
            <span>Current</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {isConnected ? currentBpm : '-'}
            </span>
            {isConnected && <span className="text-xs font-semibold text-slate-400">BPM</span>}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{isConnected ? 'Active sensor stream' : 'Sensor not connected (-)'}</p>
        </div>

        {/* Average BPM */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span>Average Today</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {isConnected ? avgBpm : '-'}
            </span>
            {isConnected && <span className="text-xs font-semibold text-slate-400">BPM</span>}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{isConnected ? '24-hour mean frequency' : 'No active session'}</p>
        </div>

        {/* Resting BPM */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>Resting HR</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {isConnected ? restingBpm : '-'}
            </span>
            {isConnected && <span className="text-xs font-semibold text-slate-400">BPM</span>}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{isConnected ? 'Nocturnal baseline' : 'No active session'}</p>
        </div>

        {/* Minimum BPM */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <ArrowDownRight className="w-3.5 h-3.5 text-cyan-500" />
            <span>Minimum Today</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {isConnected ? minBpm : '-'}
            </span>
            {isConnected && <span className="text-xs font-semibold text-slate-400">BPM</span>}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{isConnected ? 'Logged at 04:12 AM' : 'No active session'}</p>
        </div>

        {/* Maximum BPM */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-500" />
            <span>Maximum Today</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {isConnected ? maxBpm : '-'}
            </span>
            {isConnected && <span className="text-xs font-semibold text-slate-400">BPM</span>}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{isConnected ? 'Logged at 05:40 PM' : 'No active session'}</p>
        </div>
      </div>

      {/* Interactive Trend Graph with Filters (Live, 1h, 6h, today, 7d, 30d) */}
      <HeartRateTrendChart currentBpm={currentBpm} />

      {/* Heart Rate Zones Breakdown */}
      <HeartRateZone currentBpm={currentBpm} showDetails={true} />

      <MedicalDisclaimer />
    </div>
  );
};
