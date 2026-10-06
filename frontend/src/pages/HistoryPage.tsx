import React, { useState } from 'react';
import { healthDataService } from '../services/healthDataService';
import { MedicalDisclaimer } from '../components/common/MedicalDisclaimer';
import {
  History,
  Activity,
  Heart,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Flame,
  BarChart3
} from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');

  const summary = healthDataService.getHistorySummary(period);

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Period Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <History className="w-6 h-6 text-emerald-500" />
            <span>Cardiovascular Health History</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Aggregated trends, monitoring duration, and telemetry incident history
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          {(['today', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                period === p
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Average HR */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span>Avg HR</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {summary.avgBpm} <span className="text-xs font-normal text-slate-400">BPM</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Period average</span>
        </div>

        {/* Resting HR */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>Resting HR</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {summary.restingBpm} <span className="text-xs font-normal text-slate-400">BPM</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Baseline resting</span>
        </div>

        {/* Min / Max Range */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <Heart className="w-3.5 h-3.5 text-rose-500" />
            <span>Min / Max</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-mono">
            {summary.minBpm} - {summary.maxBpm}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">BPM range</span>
        </div>

        {/* Total Monitoring Time */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Telemetry Time</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-mono">
            {Math.round(summary.totalMonitoringMinutes / 60)}h {summary.totalMonitoringMinutes % 60}m
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Continuous sampling</span>
        </div>

        {/* Unusual Events */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Rhythm Flags</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-500 tabular-nums">
            {summary.irregularEventsCount}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Tagged anomalies</span>
        </div>

        {/* Sports Sessions */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            <span>Workouts</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {summary.workoutsCount}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Sessions completed</span>
        </div>
      </div>

      {/* Longitudinal Breakdown Bar Chart */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-500" />
              <span>Comparative Heart Rate Breakdown</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Average, Minimum, and Maximum BPM distribution across {period}
            </p>
          </div>
          <span className="text-xs text-slate-400 capitalize font-mono">
            {period} overview
          </span>
        </div>

        {/* Comparative Bars */}
        <div className="space-y-4">
          {summary.trendData.map((item: any, idx: number) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {item.label}
                </span>
                <span className="font-mono text-slate-500 dark:text-slate-400">
                  Avg: {item.avgBpm} BPM (Range: {item.minBpm} - {item.maxBpm})
                </span>
              </div>

              {/* Progress track */}
              <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-emerald-500/80 rounded-full transition-all"
                  style={{ width: `${(item.avgBpm / 180) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <MedicalDisclaimer />
    </div>
  );
};
