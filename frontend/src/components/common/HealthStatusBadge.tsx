import React from 'react';
import { RhythmType, SeverityLevel } from '../../types';
import { Activity, AlertTriangle, AlertCircle, CheckCircle2, WifiOff } from 'lucide-react';

interface Props {
  rhythm?: RhythmType;
  severity?: SeverityLevel;
  disconnected?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const HealthStatusBadge: React.FC<Props> = ({
  rhythm = 'normal',
  severity,
  disconnected = false,
  size = 'md',
  showIcon = true
}) => {
  if (disconnected || rhythm === 'signal_unavailable') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-medium rounded-full border border-slate-700 bg-slate-800/80 text-slate-300 ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : size === 'lg' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
      }`}>
        {showIcon && <WifiOff className="w-3.5 h-3.5 text-slate-400" />}
        <span>Sensor Disconnected</span>
      </span>
    );
  }

  // Derive level from rhythm if severity not provided
  const level: SeverityLevel = severity || (
    rhythm === 'possible_arrhythmia' ? 'critical' :
    rhythm === 'irregular' || rhythm === 'tachycardia' || rhythm === 'bradycardia' ? 'attention' :
    'normal'
  );

  const getLabel = () => {
    switch (rhythm) {
      case 'normal': return 'Normal Sinus Rhythm';
      case 'bradycardia': return 'Low Heart Rate (Bradycardia)';
      case 'tachycardia': return 'Elevated Heart Rate';
      case 'irregular': return 'Irregular R-R Rhythm';
      case 'possible_arrhythmia': return 'Unusual Rhythm Detected';
      default: return 'Normal Sinus Rhythm';
    }
  };

  if (level === 'critical') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-medium rounded-full border border-rose-500/40 bg-rose-500/10 text-rose-400 dark:text-rose-300 ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : size === 'lg' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
      }`}>
        {showIcon && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
        <span>{getLabel()}</span>
      </span>
    );
  }

  if (level === 'attention') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-medium rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-500 dark:text-amber-400 ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : size === 'lg' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
      }`}>
        {showIcon && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
        <span>{getLabel()}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ${
      size === 'sm' ? 'px-2 py-0.5 text-xs' : size === 'lg' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
    }`}>
      {showIcon && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
      <span>{getLabel()}</span>
    </span>
  );
};
