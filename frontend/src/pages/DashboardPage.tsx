import React, { useState } from 'react';
import { useHealth } from '../context/HealthContext';
import { HeroTelemetryStrip } from '../components/dashboard/HeroTelemetryStrip';
import { HeartRateCard } from '../components/dashboard/HeartRateCard';
import { ECGChart } from '../components/ecg/ECGChart';
import { HeartRateZone } from '../components/analytics/HeartRateZone';
import { EventCard } from '../components/events/EventCard';
import { EventModal } from '../components/events/EventModal';
import { MedicalDisclaimer } from '../components/common/MedicalDisclaimer';
import { RhythmEvent } from '../types';
import {
  Flame,
  Dumbbell,
  ArrowRight,
  ShieldAlert,
  Activity,
  FileCheck2,
  Stethoscope,
  Sparkles,
  Zap,
  TrendingUp
} from 'lucide-react';

interface Props {
  onNavigate: (tab: string) => void;
}

export const DashboardPage: React.FC<Props> = ({ onNavigate }) => {
  const {
    currentBpm,
    currentRhythm,
    deviceStatus,
    personaMode,
    events,
    acknowledgeEvent,
    startWorkout
  } = useHealth();

  const [selectedEvent, setSelectedEvent] = useState<RhythmEvent | null>(null);

  // Compute summary stats
  const avgBpm = 74;
  const restingBpm = 61;
  const minBpm = 54;
  const maxBpm = 148;
  const monitoringHours = '8h 42m';

  const recentEvents = events.slice(0, 2);

  const isConnected = deviceStatus.connectionState === 'connected' && currentBpm > 0;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Hero Telemetry Strip */}
      <HeroTelemetryStrip onCardClick={(m: string) => {
        if (m === 'heart_rate') onNavigate('analytics');
        else if (m === 'rhythm') onNavigate('live-ecg');
        else if (m === 'device') onNavigate('device');
      }} />

      {/* 2. Dual-Mode Context Banner (Fitness vs Clinical) */}
      {personaMode === 'fitness' ? (
        <div className="rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-sky-500/10 border border-emerald-500/20 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-500 flex-shrink-0">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Fitness Telemetry Mode Active
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Optimized for aerobic pacing, cardio thresholds, and safe workouts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('sports')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Start Activity</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 border border-cyan-500/20 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 flex-shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Hospital Telemetry & Diagnostic Viewport
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Clinical lead calibration active: 25mm/s • 10mm/mV • Continuous heuristic rhythm analysis.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('live-ecg')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-xs transition"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Multi-Lead Scope</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
        <HeartRateCard
          title="Current HR"
          value={isConnected ? currentBpm : '-'}
          unit={isConnected ? "BPM" : undefined}
          subtitle={isConnected ? "Real-time pulse" : "Sensor not connected"}
          icon="heart"
          statusColor="rose"
          onClick={() => onNavigate('analytics')}
        />

        <HeartRateCard
          title="Average HR"
          value={isConnected ? avgBpm : '-'}
          unit={isConnected ? "BPM" : undefined}
          subtitle={isConnected ? "Today's mean" : "No active session"}
          icon="avg"
          statusColor="emerald"
          onClick={() => onNavigate('analytics')}
        />

        <HeartRateCard
          title="Resting HR"
          value={isConnected ? restingBpm : '-'}
          unit={isConnected ? "BPM" : undefined}
          subtitle={isConnected ? "Nocturnal baseline" : "No active session"}
          icon="rest"
          statusColor="cyan"
          onClick={() => onNavigate('analytics')}
        />

        <HeartRateCard
          title="Min HR Today"
          value={isConnected ? minBpm : '-'}
          unit={isConnected ? "BPM" : undefined}
          subtitle={isConnected ? "At 04:12 AM" : "No active session"}
          icon="min"
          statusColor="indigo"
          onClick={() => onNavigate('analytics')}
        />

        <HeartRateCard
          title="Max HR Today"
          value={isConnected ? maxBpm : '-'}
          unit={isConnected ? "BPM" : undefined}
          subtitle={isConnected ? "At 05:40 PM" : "No active session"}
          icon="max"
          statusColor="amber"
          onClick={() => onNavigate('analytics')}
        />

        <HeartRateCard
          title="ECG Status"
          value={isConnected ? (currentRhythm === 'normal' ? 'Normal' : 'Flagged') : '-'}
          subtitle={isConnected ? (currentRhythm === 'normal' ? 'Sinus regular' : 'Inspection') : 'Disconnected'}
          icon="rhythm"
          statusColor={isConnected ? (currentRhythm === 'normal' ? 'emerald' : 'amber') : 'indigo'}
          onClick={() => onNavigate('events')}
        />

        <HeartRateCard
          title="Monitoring"
          value={isConnected ? monitoringHours : '-'}
          subtitle={isConnected ? "Active telemetry" : "Standby"}
          icon="duration"
          statusColor="emerald"
          onClick={() => onNavigate('history')}
        />
      </div>

      {/* 4. Live ECG Waveform Canvas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Real-Time ECG Telemetry</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-mono font-medium">
                Live 250Hz Stream
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Drag across any waveform interval to highlight or inspect cardiac morphology
            </p>
          </div>

          <button
            onClick={() => onNavigate('live-ecg')}
            className="text-xs text-emerald-500 hover:text-emerald-400 font-semibold flex items-center gap-1 transition"
          >
            <span>Full-Screen Scope</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <ECGChart
          height={personaMode === 'clinical' ? 320 : 260}
          persona={personaMode}
          lead="Lead II"
        />
      </div>

      {/* 5. Heart Rate Zones & Recent Arrhythmia Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Heart Rate Zone breakdown */}
        <HeartRateZone currentBpm={currentBpm} />

        {/* Right: Arrhythmia Events Preview */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Recent Arrhythmia & Event Log</span>
                  {events.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-mono">
                      {events.length}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Algorithmic telemetry alerts requiring review
                </p>
              </div>

              <button
                onClick={() => onNavigate('events')}
                className="text-xs text-emerald-500 hover:text-emerald-400 font-semibold flex items-center gap-1 transition"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {recentEvents.map((event: RhythmEvent) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onOpenDetails={(evt: RhythmEvent) => setSelectedEvent(evt)}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Last automated scan: Continuous</span>
            <span className="text-emerald-500 font-medium">98% Lead Signal Quality</span>
          </div>
        </div>
      </div>

      {/* 6. Medical Disclaimer */}
      <MedicalDisclaimer />

      {/* Event Details Modal */}
      <EventModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onAcknowledge={acknowledgeEvent}
      />
    </div>
  );
};
