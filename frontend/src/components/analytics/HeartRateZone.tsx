import React from 'react';
import { HeartRateZone as ZoneType } from '../../types';
import { Zap, Shield, Flame, Activity, AlertTriangle } from 'lucide-react';

interface Props {
  currentBpm: number;
  highlightZone?: ZoneType;
  showDetails?: boolean;
}

interface ZoneMeta {
  zone: ZoneType;
  label: string;
  min: number;
  max: number;
  color: string;
  badgeBg: string;
  description: string;
  icon: React.ReactNode;
}

export const HeartRateZone: React.FC<Props> = ({
  currentBpm,
  highlightZone,
  showDetails = true
}) => {
  const zones: ZoneMeta[] = [
    {
      zone: 'rest',
      label: 'Zone 1: Rest & Recovery',
      min: 40,
      max: 109,
      color: '#38bdf8',
      badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
      description: 'Active recovery, resting baseline, nervous system restoration.',
      icon: <Shield className="w-3.5 h-3.5 text-sky-400" />
    },
    {
      zone: 'light',
      label: 'Zone 2: Light / Fat Burn',
      min: 110,
      max: 135,
      color: '#34d399',
      badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      description: 'Aerobic base building, steady conversational effort, lipid oxidation.',
      icon: <Activity className="w-3.5 h-3.5 text-emerald-400" />
    },
    {
      zone: 'moderate',
      label: 'Zone 3: Moderate / Aerobic',
      min: 136,
      max: 155,
      color: '#fbbf24',
      badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      description: 'Cardiovascular endurance training, rhythmic steady-state running.',
      icon: <Zap className="w-3.5 h-3.5 text-amber-400" />
    },
    {
      zone: 'cardio',
      label: 'Zone 4: Cardio / Anaerobic',
      min: 156,
      max: 175,
      color: '#f97316',
      badgeBg: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
      description: 'Lactate threshold exertion, high intensity intervals.',
      icon: <Flame className="w-3.5 h-3.5 text-orange-400" />
    },
    {
      zone: 'peak',
      label: 'Zone 5: Peak / Max Effort',
      min: 176,
      max: 220,
      color: '#ef4444',
      badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      description: 'Maximum exertion sprints. Monitor closely for telemetry anomalies.',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
    }
  ];

  const determineZone = (bpm: number): ZoneType => {
    if (bpm < 110) return 'rest';
    if (bpm <= 135) return 'light';
    if (bpm <= 155) return 'moderate';
    if (bpm <= 175) return 'cardio';
    return 'peak';
  };

  const isConnected = currentBpm > 0;
  const activeZone = isConnected ? (highlightZone || determineZone(currentBpm)) : null;
  const currentMeta = activeZone ? zones.find((z) => z.zone === activeZone) || zones[0] : null;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Target Heart Rate Zones</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time cardiovascular exertion spectrum
          </p>
        </div>

        {currentMeta ? (
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${currentMeta.badgeBg}`}>
            {currentMeta.icon}
            <span>{currentMeta.label.split(':')[1] || currentMeta.label}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-400">
            <span>-</span>
          </div>
        )}
      </div>

      {/* Progress Bars for 5 zones */}
      <div className="grid grid-cols-5 gap-1.5 h-3.5 my-4 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 p-0.5">
        {zones.map((z) => {
          const isActive = isConnected && z.zone === activeZone;
          return (
            <div
              key={z.zone}
              style={{ backgroundColor: isActive ? z.color : undefined }}
              className={`rounded-full transition-all duration-300 relative ${
                isActive
                  ? 'shadow-xs ring-2 ring-white/50 dark:ring-slate-900'
                  : 'bg-slate-200 dark:bg-slate-700/60 opacity-60 hover:opacity-100'
              }`}
              title={`${z.label} (${z.min}-${z.max} BPM)`}
            />
          );
        })}
      </div>

      {/* Detailed Zone Cards */}
      {showDetails && (
        <div className="space-y-2 mt-4">
          {zones.map((z) => {
            const isActive = z.zone === activeZone;
            return (
              <div
                key={z.zone}
                className={`p-2.5 rounded-xl border transition-all text-xs flex items-center justify-between gap-3 ${
                  isActive
                    ? 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 shadow-xs'
                    : 'border-transparent bg-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: z.color }}
                  />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {z.label}
                    </span>
                    <span className="hidden sm:inline text-slate-500 dark:text-slate-400 text-[11px] ml-2">
                      {z.description}
                    </span>
                  </div>
                </div>

                <div className="text-right font-mono text-[11px] text-slate-600 dark:text-slate-300 flex-shrink-0">
                  {z.min} - {z.max} BPM
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
