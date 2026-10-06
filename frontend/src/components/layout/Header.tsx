import React from 'react';
import { useHealth } from '../../context/HealthContext';
import { Bell, Moon, Sun, Activity, Stethoscope, Dumbbell, Wifi, Cpu } from 'lucide-react';
import { PersonaMode } from '../../types';

interface Props {
  activeTab: string;
  onOpenNotifications: () => void;
  onNavigate: (tab: string) => void;
}

export const Header: React.FC<Props> = ({ activeTab, onOpenNotifications, onNavigate }) => {
  const {
    personaMode,
    setPersonaMode,
    isDarkMode,
    toggleDarkMode,
    deviceStatus,
    unreadNotificationsCount,
    currentBpm
  } = useHealth();

  const isConnected = deviceStatus.connectionState === 'connected' && currentBpm > 0;

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between transition-colors">
      {/* Left: Mobile Title or Quick Status */}
      <div className="flex items-center gap-3">
        <div className="md:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black">
            <Activity className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
            PulseGuard
          </span>
        </div>

        {/* Live Status Chip for quick awareness */}
        <div
          onClick={() => onNavigate('device')}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition"
        >
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {deviceStatus.deviceName.split(' ')[0]}
          </span>
          <span className="text-slate-400 font-mono">•</span>
          <span className="text-slate-500 dark:text-slate-400 font-mono">
            {isConnected ? `${currentBpm} BPM` : '-'}
          </span>
        </div>
      </div>

      {/* Center/Right: Dual-Mode Toggle + Action Icons */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Dual-Mode Master Switch: Fitness vs Clinical View (Requirement 🎛️) */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setPersonaMode('fitness')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              personaMode === 'fitness'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline">Fitness Mode</span>
            <span className="sm:hidden">Fitness</span>
          </button>

          <button
            onClick={() => setPersonaMode('clinical')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              personaMode === 'clinical'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5 text-cyan-500" />
            <span className="hidden sm:inline">Clinical Ward</span>
            <span className="sm:hidden">Clinical</span>
          </button>
        </div>

        {/* Theme Toggle (Dark / Light) */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notification Bell */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Open Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-950 animate-pulse" />
          )}
        </button>
      </div>
    </header>
  );
};
