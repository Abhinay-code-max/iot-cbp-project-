import React, { useState } from 'react';
import { useHealth } from '../../context/HealthContext';
import {
  LayoutDashboard,
  Activity,
  Flame,
  AlertCircle,
  Menu,
  TrendingUp,
  HeartPulse,
  History,
  Cpu,
  User,
  X
} from 'lucide-react';

interface Props {
  activeTab: string;
  onNavigate: (tab: string) => void;
}

export const MobileNav: React.FC<Props> = ({ activeTab, onNavigate }) => {
  const { events, activeWorkout } = useHealth();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const unacknowledgedEvents = events.filter((e) => !e.acknowledged).length;

  const primaryItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'live-ecg', label: 'ECG', icon: Activity },
    { id: 'sports', label: 'Sports', icon: Flame, isHighlight: !!activeWorkout },
    { id: 'events', label: 'Events', icon: AlertCircle, badgeCount: unacknowledgedEvents },
  ];

  const secondaryItems = [
    { id: 'analytics', label: 'Heart Rate Analytics', icon: TrendingUp },
    { id: 'vitals', label: 'Vitals & Sensors', icon: HeartPulse },
    { id: 'history', label: 'Health History', icon: History },
    { id: 'device', label: 'IoT Device Manager', icon: Cpu },
    { id: 'profile', label: 'Profile & Settings', icon: User },
  ];

  return (
    <>
      {/* Fixed Bottom Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-around">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                setIsMoreOpen(false);
              }}
              className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all relative ${
                isActive
                  ? 'text-emerald-500 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${item.isHighlight ? 'animate-pulse text-amber-500' : ''}`} />
                {item.badgeCount ? (
                  <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center font-bold">
                    {item.badgeCount}
                  </span>
                ) : null}
              </div>
              <span className="text-[10px]">{item.label}</span>
            </button>
          );
        })}

        {/* More Button */}
        <button
          onClick={() => setIsMoreOpen(!isMoreOpen)}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all ${
            isMoreOpen || ['analytics', 'vitals', 'history', 'device', 'profile'].includes(activeTab)
              ? 'text-emerald-500 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px]">More</span>
        </button>
      </div>

      {/* Slide-up sheet for 'More' items */}
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-2">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="font-bold text-sm text-slate-900 dark:text-white">Additional Modules</span>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-2 space-y-1">
              {secondaryItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setIsMoreOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-semibold transition ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-slate-400" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
