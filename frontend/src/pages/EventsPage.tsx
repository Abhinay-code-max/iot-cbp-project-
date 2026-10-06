import React, { useState } from 'react';
import { useHealth } from '../context/HealthContext';
import { RhythmEvent, RhythmType } from '../types';
import { EventCard } from '../components/events/EventCard';
import { EventModal } from '../components/events/EventModal';
import { MedicalDisclaimer } from '../components/common/MedicalDisclaimer';
import {
  AlertCircle,
  Filter,
  CheckCircle2,
  Calendar,
  Search,
  Sparkles,
  ArrowUpDown
} from 'lucide-react';

type FilterCategory = 'all' | 'normal' | 'irregular' | 'high_hr' | 'low_hr' | 'possible_arrhythmia';

export const EventsPage: React.FC = () => {
  const { events, acknowledgeEvent } = useHealth();
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [selectedEvent, setSelectedEvent] = useState<RhythmEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filterOptions: { id: FilterCategory; label: string; count: number }[] = [
    { id: 'all', label: 'All Events', count: events.length },
    {
      id: 'irregular',
      label: 'Irregular Rhythm',
      count: events.filter((e: RhythmEvent) => e.rhythmClassification === 'irregular').length
    },
    {
      id: 'possible_arrhythmia',
      label: 'Possible Arrhythmia',
      count: events.filter((e: RhythmEvent) => e.rhythmClassification === 'possible_arrhythmia').length
    },
    {
      id: 'high_hr',
      label: 'High Heart Rate',
      count: events.filter((e: RhythmEvent) => e.rhythmClassification === 'tachycardia' || e.heartRate > 120).length
    },
    {
      id: 'low_hr',
      label: 'Low Heart Rate',
      count: events.filter((e: RhythmEvent) => e.rhythmClassification === 'bradycardia' || e.heartRate < 55).length
    },
    {
      id: 'normal',
      label: 'Normal Rhythms',
      count: events.filter((e: RhythmEvent) => e.rhythmClassification === 'normal').length
    }
  ];

  const filteredEvents = events.filter((evt: RhythmEvent) => {
    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchLabel = evt.label.toLowerCase().includes(q);
      const matchNotes = (evt.clinicalNotes || '').toLowerCase().includes(q);
      if (!matchLabel && !matchNotes) return false;
    }

    if (activeFilter === 'all') return true;
    if (activeFilter === 'irregular') return evt.rhythmClassification === 'irregular';
    if (activeFilter === 'possible_arrhythmia') return evt.rhythmClassification === 'possible_arrhythmia';
    if (activeFilter === 'high_hr') return evt.rhythmClassification === 'tachycardia' || evt.heartRate > 120;
    if (activeFilter === 'low_hr') return evt.rhythmClassification === 'bradycardia' || evt.heartRate < 55;
    if (activeFilter === 'normal') return evt.rhythmClassification === 'normal';
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
          <AlertCircle className="w-6 h-6 text-amber-500" />
          <span>Arrhythmia & Event Detection Log</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Chronological record of automated rhythm anomalies tagged by edge QRS morphology algorithms
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Horizontal Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl">
          {filterOptions.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeFilter === f.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
              }`}
            >
              <span>{f.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeFilter === f.id ? 'bg-slate-100 dark:bg-slate-700' : 'bg-slate-200 dark:bg-slate-800'
              }`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px] sm:min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events or notes..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {filteredEvents.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-slate-400">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-80" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No matching rhythm events
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              No occurrences detected matching the selected filter criteria.
            </p>
          </div>
        ) : (
          filteredEvents.map((event: RhythmEvent) => (
            <EventCard
              key={event.id}
              event={event}
              onOpenDetails={(evt: RhythmEvent) => setSelectedEvent(evt)}
            />
          ))
        )}
      </div>

      <MedicalDisclaimer />

      {/* Detailed Inspection Modal */}
      <EventModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onAcknowledge={acknowledgeEvent}
      />
    </div>
  );
};
