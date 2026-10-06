import React from 'react';
import { RhythmEvent } from '../../types';
import { HealthStatusBadge } from '../common/HealthStatusBadge';
import { Clock, Heart, Eye, CheckCircle2 } from 'lucide-react';

interface Props {
  event: RhythmEvent;
  onOpenDetails: (event: RhythmEvent) => void;
}

export const EventCard: React.FC<Props> = ({ event, onOpenDetails }) => {
  const d = new Date(event.timestamp);
  const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateFormatted = d.toLocaleDateString([], { month: 'short', day: 'numeric' });

  // Render mini ECG snapshot preview
  const snapshot = event.waveformSnapshot || [];
  const svgWidth = 120;
  const svgHeight = 36;
  const minV = -0.5;
  const maxV = 1.5;
  const points = snapshot.map((v, i) => {
    const x = (i / Math.max(1, snapshot.length - 1)) * svgWidth;
    const y = svgHeight - ((v - minV) / (maxV - minV)) * svgHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div
      onClick={() => onOpenDetails(event)}
      className="group relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <HealthStatusBadge
              rhythm={event.rhythmClassification}
              severity={event.severity}
              size="sm"
            />
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">
              {event.label}
            </h4>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3" />
                {dateFormatted} at {timeFormatted}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono">
                <Heart className="w-3 h-3 text-rose-500" />
                {event.heartRate} BPM
              </span>
              <span>•</span>
              <span className="font-mono">{event.durationSeconds}s duration</span>
            </div>
          </div>
        </div>

        {/* Snapshot Waveform & Status */}
        <div className="flex items-center gap-4 self-end sm:self-auto">
          {snapshot.length > 0 && (
            <div className="hidden md:block bg-slate-950 rounded-lg p-1 border border-slate-800">
              <svg width={svgWidth} height={svgHeight}>
                <polyline
                  fill="none"
                  stroke={event.severity === 'critical' ? '#f43f5e' : '#10b981'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={points}
                />
              </svg>
            </div>
          )}

          <div className="flex items-center gap-2">
            {event.acknowledged ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Reviewed</span>
              </span>
            ) : (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30 font-medium">
                Review Pending
              </span>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails(event);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Inspect ECG Strip"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
