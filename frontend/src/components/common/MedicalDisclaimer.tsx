import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface Props {
  compact?: boolean;
}

export const MedicalDisclaimer: React.FC<Props> = ({ compact = false }) => {
  if (compact) {
    return (
      <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center flex items-center justify-center gap-1.5 py-2">
        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
        <span>For health-monitoring purposes only. Not a certified medical diagnostic device.</span>
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/40 p-3.5 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-3">
      <ShieldAlert className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-medium text-slate-700 dark:text-slate-300">Clinical Telemetry & Safety Notice</p>
        <p className="mt-0.5 leading-relaxed text-slate-500 dark:text-slate-400">
          This system provides continuous physiological and IoT ECG monitoring data. Algorithmic rhythm tags are heuristic markers and do not constitute a definitive medical diagnosis. In case of acute chest discomfort or clinical emergency, consult a qualified physician or contact emergency medical services immediately.
        </p>
      </div>
    </div>
  );
};
