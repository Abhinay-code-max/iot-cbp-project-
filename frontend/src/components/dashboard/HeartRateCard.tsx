import React from 'react';
import { ArrowUpRight, ArrowDownRight, Activity, Heart, Clock, ShieldCheck, Zap } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: 'heart' | 'avg' | 'rest' | 'min' | 'max' | 'rhythm' | 'duration';
  statusColor?: 'emerald' | 'amber' | 'rose' | 'cyan' | 'indigo';
  onClick?: () => void;
  badgeText?: string;
}

export const HeartRateCard: React.FC<Props> = ({
  title,
  value,
  unit,
  subtitle,
  icon = 'heart',
  statusColor = 'emerald',
  onClick,
  badgeText
}) => {
  const getIcon = () => {
    switch (icon) {
      case 'heart': return <Heart className="w-4 h-4 text-rose-500" />;
      case 'avg': return <Activity className="w-4 h-4 text-emerald-400" />;
      case 'rest': return <ShieldCheck className="w-4 h-4 text-blue-400" />;
      case 'min': return <ArrowDownRight className="w-4 h-4 text-cyan-400" />;
      case 'max': return <ArrowUpRight className="w-4 h-4 text-amber-400" />;
      case 'rhythm': return <Zap className="w-4 h-4 text-purple-400" />;
      case 'duration': return <Clock className="w-4 h-4 text-indigo-400" />;
      default: return <Heart className="w-4 h-4 text-rose-500" />;
    }
  };

  const getBorderColor = () => {
    switch (statusColor) {
      case 'rose': return 'hover:border-rose-500/50';
      case 'amber': return 'hover:border-amber-500/50';
      case 'cyan': return 'hover:border-cyan-500/50';
      case 'indigo': return 'hover:border-indigo-500/50';
      default: return 'hover:border-emerald-500/50';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 sm:p-5 shadow-xs transition-all duration-200 ${getBorderColor()} ${
        onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80">
            {getIcon()}
          </div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide uppercase">
            {title}
          </span>
        </div>
        {badgeText && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {badgeText}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
            {unit}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>{subtitle}</span>
          {onClick && (
            <span className="text-emerald-500 dark:text-emerald-400 opacity-0 group-hover:opacity-100 text-[11px] font-medium transition-opacity">
              View trend →
            </span>
          )}
        </p>
      )}
    </div>
  );
};
