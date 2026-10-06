import {
  WorkoutSession,
  UserHealthProfile,
  RhythmEvent,
  AppNotification,
  PersonaMode
} from '../types';
import { INITIAL_MOCK_EVENTS } from './mockDataService';

const STORAGE_KEYS = {
  PROFILE: 'pulseguard_user_profile',
  WORKOUTS: 'pulseguard_workouts',
  EVENTS: 'pulseguard_rhythm_events',
  NOTIFICATIONS: 'pulseguard_notifications',
  PERSONA_MODE: 'pulseguard_persona_mode',
  THEME_MODE: 'pulseguard_theme_mode',
};

const DEFAULT_PROFILE: UserHealthProfile = {
  name: 'Alex Morgan',
  age: 32,
  biologicalSex: 'male',
  heightCm: 178,
  weightKg: 73,
  emergencyContact: {
    name: 'Dr. Sarah Lin (Cardiologist)',
    relationship: 'Primary Physician',
    phone: '+1 (555) 234-8970'
  },
  restingHrTarget: 60,
  maxHrAlertThreshold: 170,
  bradycardiaThreshold: 50,
  soundAlertsEnabled: false,
  preferredView: 'fitness'
};

const INITIAL_WORKOUTS: WorkoutSession[] = [
  {
    id: 'wo-101',
    type: 'running',
    title: 'Morning Cardio Run',
    startTime: Date.now() - 1000 * 60 * 60 * 24, // yesterday
    endTime: Date.now() - 1000 * 60 * 60 * 23.5,
    durationSeconds: 1800, // 30 mins
    avgBpm: 146,
    minBpm: 92,
    maxBpm: 168,
    estimatedCalories: 340,
    zoneDistribution: [
      { zone: 'rest', label: 'Rest / Recovery', minBpm: 0, maxBpm: 109, seconds: 180, percentage: 10, color: '#38bdf8' },
      { zone: 'light', label: 'Light / Fat Burn', minBpm: 110, maxBpm: 135, seconds: 360, percentage: 20, color: '#34d399' },
      { zone: 'moderate', label: 'Moderate / Aerobic', minBpm: 136, maxBpm: 155, seconds: 900, percentage: 50, color: '#fbbf24' },
      { zone: 'cardio', label: 'Cardio / Anaerobic', minBpm: 156, maxBpm: 175, seconds: 360, percentage: 20, color: '#f97316' },
      { zone: 'peak', label: 'Peak Effort', minBpm: 176, maxBpm: 220, seconds: 0, percentage: 0, color: '#ef4444' }
    ],
    eventsDetected: 1,
    hrTrend: [
      { time: 0, bpm: 92 },
      { time: 5, bpm: 120 },
      { time: 10, bpm: 142 },
      { time: 15, bpm: 154 },
      { time: 20, bpm: 162 },
      { time: 25, bpm: 158 },
      { time: 30, bpm: 130 }
    ],
    notes: 'Paced steady 5km run. Felt comfortable in aerobic zone.'
  },
  {
    id: 'wo-102',
    type: 'cycling',
    title: 'Indoor Tempo Ride',
    startTime: Date.now() - 1000 * 60 * 60 * 48, // 2 days ago
    endTime: Date.now() - 1000 * 60 * 60 * 47.25,
    durationSeconds: 2700, // 45 mins
    avgBpm: 138,
    minBpm: 88,
    maxBpm: 159,
    estimatedCalories: 480,
    zoneDistribution: [
      { zone: 'rest', label: 'Rest / Recovery', minBpm: 0, maxBpm: 109, seconds: 270, percentage: 10, color: '#38bdf8' },
      { zone: 'light', label: 'Light / Fat Burn', minBpm: 110, maxBpm: 135, seconds: 810, percentage: 30, color: '#34d399' },
      { zone: 'moderate', label: 'Moderate / Aerobic', minBpm: 136, maxBpm: 155, seconds: 1350, percentage: 50, color: '#fbbf24' },
      { zone: 'cardio', label: 'Cardio / Anaerobic', minBpm: 156, maxBpm: 175, seconds: 270, percentage: 10, color: '#f97316' },
      { zone: 'peak', label: 'Peak Effort', minBpm: 176, maxBpm: 220, seconds: 0, percentage: 0, color: '#ef4444' }
    ],
    eventsDetected: 0,
    hrTrend: [
      { time: 0, bpm: 88 },
      { time: 10, bpm: 125 },
      { time: 20, bpm: 141 },
      { time: 30, bpm: 148 },
      { time: 40, bpm: 135 },
      { time: 45, bpm: 110 }
    ]
  }
];

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    title: 'ECG Telemetry Initialized',
    message: 'Continuous monitoring running smoothly with 98% signal quality index.',
    timestamp: Date.now() - 1000 * 60 * 5,
    severity: 'normal',
    read: false,
    category: 'system'
  },
  {
    id: 'notif-2',
    title: 'Rhythm Check Logged',
    message: 'Premature Ventricular Contraction detected at 10:42 AM. Signal automatically tagged for clinical review.',
    timestamp: Date.now() - 1000 * 60 * 18,
    severity: 'attention',
    read: false,
    category: 'rhythm',
    actionUrl: '/events'
  },
  {
    id: 'notif-3',
    title: 'Workout Target Achieved',
    message: 'You completed 30 minutes of aerobic cardio training yesterday.',
    timestamp: Date.now() - 1000 * 60 * 60 * 24,
    severity: 'normal',
    read: true,
    category: 'workout'
  }
];

export const storageService = {
  getProfile(): UserHealthProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
      return data ? JSON.parse(data) : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  },

  saveProfile(profile: UserHealthProfile): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.error(e);
    }
  },

  getWorkouts(): WorkoutSession[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
      return data ? JSON.parse(data) : INITIAL_WORKOUTS;
    } catch {
      return INITIAL_WORKOUTS;
    }
  },

  saveWorkout(workout: WorkoutSession): void {
    try {
      const workouts = this.getWorkouts();
      workouts.unshift(workout);
      localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(workouts));
    } catch (e) {
      console.error(e);
    }
  },

  getEvents(): RhythmEvent[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EVENTS);
      return data ? JSON.parse(data) : INITIAL_MOCK_EVENTS;
    } catch {
      return INITIAL_MOCK_EVENTS;
    }
  },

  saveEvents(events: RhythmEvent[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    } catch (e) {
      console.error(e);
    }
  },

  getNotifications(): AppNotification[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      return data ? JSON.parse(data) : INITIAL_NOTIFICATIONS;
    } catch {
      return INITIAL_NOTIFICATIONS;
    }
  },

  saveNotifications(notifs: AppNotification[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));
    } catch (e) {
      console.error(e);
    }
  },

  getPersonaMode(): PersonaMode {
    try {
      const mode = localStorage.getItem(STORAGE_KEYS.PERSONA_MODE);
      return (mode as PersonaMode) || 'fitness';
    } catch {
      return 'fitness';
    }
  },

  savePersonaMode(mode: PersonaMode): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PERSONA_MODE, mode);
    } catch (e) {
      console.error(e);
    }
  }
};
