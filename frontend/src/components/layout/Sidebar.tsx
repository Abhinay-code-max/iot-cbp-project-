import React from 'react';
import { useHealth } from '../../context/HealthContext';
import {
  LayoutDashboard,
  Activity,
  TrendingUp,
  HeartPulse,
  Flame,
  AlertCircle,
  History,
  Cpu,
  User,
  Heart,
  ShieldCheck
} from 'lucide-react';

interface Props {
  activeTab: string;
  onNavigate: (tab: string) => void;
}

export const Sidebar: React.FC<Props> = ({ activeTab, onNavigate }) => {
  const { events, activeWorkout } = useHealth();
  const unacknowledgedEvents = events.filter((e) => !e.acknowledged).length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'live-ecg', label: 'Live ECG', icon: Activity, badge: '250Hz' },
    { id: 'analytics', label: 'Heart Rate', icon: TrendingUp },
    { id: 'vitals', label: 'Vitals', icon: HeartPulse },
    {
      id: 'sports',
      label: 'Sports Mode',
      icon: Flame,
      badge: activeWorkout ? 'Active' : undefined,
      badgeColor: 'bg-emerald-500 text-white'
    },
    {
      id: 'events',
      label: 'Events Log',
      icon: AlertCircle,
      badge: unacknowledgedEvents > 0 ? `${unacknowledgedEvents}` : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
    },
    { id: 'history', label: 'Health History', icon: History },
    { id: 'device', label: 'IoT Device', icon: Cpu },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shrink-0 transition-colors">
      {/* Brand Logo */}
      <div className="flex items-center gap-3 px-3 py-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-md">
          <Heart className="w-5 h-5 fill-white" />
        </div>
        <div>
          <h1 className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
            PulseGuard
          </h1>
          <p className="text-[11px] text-slate-400 font-medium">IoT Arrhythmia Telemetry</p>
        </div>
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-500' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                    item.badgeColor || 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Clinical Mini Info */}
      <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-900">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>ESP32 Telemetry Engine</span>
          </div>
          <p className="line-clamp-2">
            AD8232 Analog Front-End with real-time QRS digital filter.
          </p>
        </div>
      </div>
    </aside>
  );
};
