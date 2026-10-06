import React, { useEffect } from 'react';
import { WorkoutSession } from '../../types';
import confetti from 'canvas-confetti';
import { X, Award, Flame, Heart, Clock, AlertTriangle, ArrowRight, Activity } from 'lucide-react';

interface Props {
  session: WorkoutSession | null;
  onClose: () => void;
}

export const WorkoutSummaryModal: React.FC<Props> = ({ session, onClose }) => {
  useEffect(() => {
    if (session) {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 }
        });
      } catch (e) {
        // Confetti fallback
      }
    }
  }, [session]);

  if (!session) return null;

  const durationMin = Math.floor(session.durationSeconds / 60);
  const durationSec = session.durationSeconds % 60;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl relative my-8 animate-fade-in">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with celebration badge */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Workout Complete
            </span>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              {session.title}
            </h3>
          </div>
        </div>

        {/* Hero stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-medium text-slate-500 uppercase flex items-center gap-1">
              <Clock className="w-3 h-3 text-indigo-400" />
              Duration
            </span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {durationMin}m {durationSec}s
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-medium text-slate-500 uppercase flex items-center gap-1">
              <Activity className="w-3 h-3 text-emerald-400" />
              Avg BPM
            </span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {session.avgBpm}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-medium text-slate-500 uppercase flex items-center gap-1">
              <Heart className="w-3 h-3 text-rose-400" />
              Max BPM
            </span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {session.maxBpm}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-medium text-slate-500 uppercase flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-400" />
              Burned
            </span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {session.estimatedCalories} <span className="text-xs font-normal text-slate-400">kcal</span>
            </div>
          </div>
        </div>

        {/* Time Spent in Heart Rate Zones */}
        <div className="my-5">
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
            Time Spent in Heart-Rate Zones
          </h4>

          {/* Stacked Horizontal Bar */}
          <div className="h-4 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800 mb-3">
            {session.zoneDistribution.map((z) => (
              <div
                key={z.zone}
                style={{ width: `${z.percentage}%`, backgroundColor: z.color }}
                title={`${z.label}: ${z.percentage}%`}
                className="h-full transition-all"
              />
            ))}
          </div>

          <div className="space-y-1.5">
            {session.zoneDistribution.map((z) => (
              <div key={z.zone} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: z.color }} />
                  <span className="font-medium text-slate-700 dark:text-slate-300">{z.label}</span>
                </div>
                <div className="font-mono text-slate-500 dark:text-slate-400">
                  {Math.floor(z.seconds / 60)}m {z.seconds % 60}s ({z.percentage}%)
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Arrhythmia Rhythm Events Flagged during workout */}
        <div className="my-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${session.eventsDetected > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              Cardiac Telemetry Events During Workout:
            </span>
          </div>
          <span className="font-bold text-slate-900 dark:text-white font-mono">
            {session.eventsDetected} Detected
          </span>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
          >
            <span>Save & Return to Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
