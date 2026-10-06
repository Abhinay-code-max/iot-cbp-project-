import React, { useState } from 'react';
import { useHealth } from '../context/HealthContext';
import { WorkoutType, WorkoutSession } from '../types';
import { ECGChart } from '../components/ecg/ECGChart';
import { HeartRateZone } from '../components/analytics/HeartRateZone';
import { WorkoutSummaryModal } from '../components/sports/WorkoutSummaryModal';
import { MedicalDisclaimer } from '../components/common/MedicalDisclaimer';
import {
  Flame,
  Play,
  Square,
  Clock,
  Heart,
  Activity,
  Dumbbell,
  Footprints,
  Bike,
  Sparkles,
  Award,
  Calendar,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

export const SportsPage: React.FC = () => {
  const {
    currentBpm,
    activeWorkout,
    startWorkout,
    finishWorkout,
    cancelWorkout,
    workouts,
    currentRhythm,
    deviceStatus
  } = useHealth();

  const isConnected = deviceStatus.connectionState === 'connected' && currentBpm > 0;

  const [selectedActivity, setSelectedActivity] = useState<WorkoutType>('running');
  const [completedSummary, setCompletedSummary] = useState<WorkoutSession | null>(null);

  const activities: { type: WorkoutType; label: string; icon: any; color: string }[] = [
    { type: 'running', label: 'Running', icon: Flame, color: 'text-orange-500 bg-orange-500/10' },
    { type: 'walking', label: 'Brisk Walk', icon: Footprints, color: 'text-emerald-500 bg-emerald-500/10' },
    { type: 'cycling', label: 'Cycling', icon: Bike, color: 'text-cyan-500 bg-cyan-500/10' },
    { type: 'gym', label: 'Gym / Strength', icon: Dumbbell, color: 'text-purple-500 bg-purple-500/10' },
    { type: 'other', label: 'Cardio Workout', icon: Activity, color: 'text-amber-500 bg-amber-500/10' }
  ];

  const handleFinish = () => {
    const summary = finishWorkout();
    if (summary) {
      setCompletedSummary(summary);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // If in active workout mode, render active workout cockpit!
  if (activeWorkout) {
    const samples = activeWorkout.samples.length > 0 ? activeWorkout.samples : [currentBpm];
    const avg = Math.round(samples.reduce((a: number, b: number) => a + b, 0) / samples.length);
    const min = Math.min(...samples);
    const max = Math.max(...samples);

    return (
      <div className="space-y-6 pb-12 animate-fade-in">
        {/* Active Workout Cockpit Header */}
        <div className="rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center font-bold text-2xl shadow-inner">
              <Flame className="w-8 h-8 text-amber-300 animate-pulse" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
                Live Workout Session
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {activeWorkout.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={cancelWorkout}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md transition"
            >
              Cancel
            </button>
            <button
              onClick={handleFinish}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-slate-950 hover:bg-slate-100 text-xs font-bold transition shadow-md"
            >
              <Square className="w-4 h-4 fill-current text-rose-600" />
              <span>Finish Workout</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* Duration Timer */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              Workout Timer
            </span>
            <div className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
              {formatSeconds(activeWorkout.seconds)}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Active tracking</span>
          </div>

          {/* Current Heart Rate */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Heart className={`w-3.5 h-3.5 ${isConnected ? 'text-rose-500 animate-heartbeat' : 'text-slate-500'}`} />
              Live Heart Rate
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                {isConnected ? currentBpm : '-'}
              </span>
              {isConnected && <span className="text-xs font-semibold text-slate-400">BPM</span>}
            </div>
            <span className="text-[11px] text-emerald-500 mt-1 block font-medium">
              {isConnected ? 'Cardio Zone Active' : 'Sensor not connected (-)'}
            </span>
          </div>

          {/* Average Heart Rate */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Average HR
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                {isConnected && avg > 0 ? avg : '-'}
              </span>
              {isConnected && avg > 0 && <span className="text-xs font-semibold text-slate-400">BPM</span>}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {isConnected ? 'Session mean' : 'No active data'}
            </span>
          </div>

          {/* Max Exertion BPM */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              Peak HR
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                {isConnected && max > 0 ? max : '-'}
              </span>
              {isConnected && max > 0 && <span className="text-xs font-semibold text-slate-400">BPM</span>}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {isConnected ? `Min: ${min} BPM` : 'No active data'}
            </span>
          </div>
        </div>

        {/* Live Exercise ECG Waveform */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Real-Time Exercise ECG Waveform</span>
              {currentRhythm !== 'normal' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Rhythm Warning
                </span>
              )}
            </h3>
            <span className="text-xs font-mono text-slate-400">Lead II Real-Time Telemetry</span>
          </div>

          <ECGChart height={280} persona="fitness" />
        </div>

        {/* Real-time Heart Rate Zone distribution */}
        <HeartRateZone currentBpm={currentBpm} />

        <MedicalDisclaimer />

        {/* Summary Modal */}
        <WorkoutSummaryModal
          session={completedSummary}
          onClose={() => setCompletedSummary(null)}
        />
      </div>
    );
  }

  // Normal Sports Home View (Start activity or view workout history)
  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
          <Flame className="w-6 h-6 text-emerald-500" />
          <span>Sports Mode & Workout Telemetry</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Track cardiovascular endurance, monitor exertion zones, and safeguard against exercise-induced arrhythmias
        </p>
      </div>

      {/* Activity Launcher Card */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
          Start New Activity
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Select your training type to calibrate zone boundaries and continuous ECG sampling
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {activities.map((act) => {
            const Icon = act.icon;
            const isSelected = selectedActivity === act.type;

            return (
              <div
                key={act.type}
                onClick={() => setSelectedActivity(act.type)}
                className={`p-4 rounded-2xl border text-center cursor-pointer transition-all ${
                  isSelected
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-2.5 ${act.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  {act.label}
                </h4>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => startWorkout(selectedActivity)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Activity Session</span>
          </button>
        </div>
      </div>

      {/* Target Zones Reference */}
      <HeartRateZone currentBpm={currentBpm} />

      {/* Previous Workouts History Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-500" />
              <span>Workout History</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Locally saved telemetry sessions and cardiac metrics
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {workouts.length} Sessions Logged
          </span>
        </div>

        <div className="space-y-3">
          {workouts.map((wo: WorkoutSession) => {
            const d = new Date(wo.startTime);
            const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            const m = Math.floor(wo.durationSeconds / 60);

            return (
              <div
                key={wo.id}
                onClick={() => setCompletedSummary(wo)}
                className="group p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 flex-shrink-0">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">
                      {wo.title}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                      <span>{dateStr}</span>
                      <span>•</span>
                      <span>{m} mins</span>
                      <span>•</span>
                      <span>{wo.estimatedCalories} kcal</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-auto">
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Avg BPM</span>
                    <span className="text-base font-bold text-slate-900 dark:text-white font-mono">
                      {wo.avgBpm}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Peak BPM</span>
                    <span className="text-base font-bold text-amber-500 font-mono">
                      {wo.maxBpm}
                    </span>
                  </div>

                  <button className="p-2 rounded-xl text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <MedicalDisclaimer />

      {/* Summary Modal */}
      <WorkoutSummaryModal
        session={completedSummary}
        onClose={() => setCompletedSummary(null)}
      />
    </div>
  );
};
