import React from 'react';
import { VitalReading } from '../../types';
import { Activity, AlertCircle, CheckCircle, WifiOff, PlusCircle } from 'lucide-react';

interface Props {
  vital: VitalReading;
}

export const VitalCard: React.FC<Props> = ({ vital }) => {
  const isConnected = vital.status !== 'not_connected';

  return (
    <div
      className={`rounded-2xl border p-5 transition-all duration-200 relative overflow-hidden ${
        isConnected
          ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs'
          : 'border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 opacity-75'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            {vital.category}
          </span>
          <h4 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
            {vital.name}
          </h4>
        </div>

        {isConnected ? (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
            vital.status === 'optimal'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
          }`}>
            <CheckCircle className="w-3 h-3" />
            <span>Optimal</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-200/60 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700">
            <WifiOff className="w-3 h-3" />
            <span>Sensor not connected</span>
          </span>
        )}
      </div>

      {/* Main Measurement */}
      <div className="my-4">
        {isConnected && vital.value !== null && vital.value !== '-' ? (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">
              {vital.value}
            </span>
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {vital.unit}
            </span>
          </div>
        ) : (
          <div className="py-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-400 dark:text-slate-600 font-mono">
              -
            </span>
            <p className="text-xs text-amber-600/90 dark:text-amber-400/90 font-medium mt-1">
              Sensor not connected
            </p>
          </div>
        )}
      </div>

      {/* Description / Explanation */}
      <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 text-xs text-slate-500 dark:text-slate-400">
        <p className="line-clamp-2 leading-relaxed">
          {vital.description}
        </p>

        {!vital.isSupportedByDevice && (
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
            <PlusCircle className="w-3 h-3 text-slate-400" />
            <span>Hardware expansion slot available</span>
          </div>
        )}
      </div>
    </div>
  );
};
