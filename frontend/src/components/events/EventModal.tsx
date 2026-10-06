import React, { useState } from 'react';
import { RhythmEvent } from '../../types';
import { HealthStatusBadge } from '../common/HealthStatusBadge';
import { X, CheckCircle, Download, PhoneCall, Sparkles, Clock, Heart, Shield, FileText } from 'lucide-react';

interface Props {
  event: RhythmEvent | null;
  onClose: () => void;
  onAcknowledge: (eventId: string, notes?: string) => void;
}

export const EventModal: React.FC<Props> = ({ event, onClose, onAcknowledge }) => {
  if (!event) return null;

  const [notes, setNotes] = useState(event.clinicalNotes || '');
  const [copied, setCopied] = useState(false);

  const d = new Date(event.timestamp);
  const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateFormatted = d.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Render high-res snapshot strip
  const snapshot = event.waveformSnapshot || [];
  const svgWidth = 600;
  const svgHeight = 120;
  const minV = -0.6;
  const maxV = 1.6;
  const points = snapshot.map((v, i) => {
    const x = (i / Math.max(1, snapshot.length - 1)) * svgWidth;
    const y = svgHeight - ((v - minV) / (maxV - minV)) * (svgHeight - 20) - 10;
    return `${x},${y}`;
  }).join(' ');

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(event, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `ecg-event-${event.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative my-8 animate-fade-in">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3 pr-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <HealthStatusBadge rhythm={event.rhythmClassification} severity={event.severity} />
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Event ID: {event.id}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              {event.label}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Detected on {dateFormatted} at {timeFormatted}
            </p>
          </div>
        </div>

        {/* Telemetry Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Heart Rate</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
              {event.heartRate} <span className="text-xs font-normal text-slate-400">BPM</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Duration</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
              {event.durationSeconds}s
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Signal Quality</span>
            <span className="text-xl font-bold text-emerald-500 font-mono">
              {event.sqi}%
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">AI Confidence</span>
            <span className="text-xl font-bold text-indigo-400 font-mono flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              {event.confidenceScore}%
            </span>
          </div>
        </div>

        {/* ECG Strip Canvas / SVG Preview */}
        <div className="my-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5 px-1 font-mono">
            <span>Lead II ECG Strip (25mm/s • 10mm/mV)</span>
            <span>Recorded interval window</span>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 ecg-grid-dark p-2 bg-slate-950">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto">
              {/* Center baseline */}
              <line
                x1="0"
                y1={svgHeight / 2}
                x2={svgWidth}
                y2={svgHeight / 2}
                stroke="rgba(51, 65, 85, 0.4)"
                strokeDasharray="4 4"
              />
              <polyline
                fill="none"
                stroke={event.severity === 'critical' ? '#ef4444' : '#10b981'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
              />
            </svg>
          </div>
        </div>

        {/* Clinical Notes Input */}
        <div className="my-4">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>Clinical Reviewer Notes & Annotations</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none font-sans"
            placeholder="Add clinical observations, physician sign-off, or patient context..."
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Telemetry (DICOM/JSON)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onAcknowledge(event.id, notes);
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Acknowledge & Save Notes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
