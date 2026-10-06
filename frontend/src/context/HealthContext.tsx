import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  RhythmType,
  MonitoringMode,
  PersonaMode,
  DeviceStatus,
  UserHealthProfile,
  WorkoutSession,
  RhythmEvent,
  AppNotification,
  WorkoutType,
  ConnectionMode,
  HeartRateZone
} from '../types';
import { deviceService } from '../services/deviceService';
import { storageService } from '../services/storageService';

interface ActiveWorkoutState {
  type: WorkoutType;
  title: string;
  startTime: number;
  seconds: number;
  samples: number[];
  detectedEvents: number;
}

interface HealthContextValue {
  currentBpm: number;
  currentRhythm: RhythmType;
  deviceStatus: DeviceStatus;
  monitoringMode: MonitoringMode;
  personaMode: PersonaMode;
  isDarkMode: boolean;
  userProfile: UserHealthProfile;
  workouts: WorkoutSession[];
  events: RhythmEvent[];
  notifications: AppNotification[];
  activeWorkout: ActiveWorkoutState | null;
  unreadNotificationsCount: number;

  toggleDarkMode: () => void;
  setPersonaMode: (mode: PersonaMode) => void;
  setMonitoringMode: (mode: MonitoringMode) => void;
  startWorkout: (type: WorkoutType) => void;
  finishWorkout: () => WorkoutSession | null;
  cancelWorkout: () => void;
  acknowledgeEvent: (eventId: string, notes?: string) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  saveUserProfile: (profile: UserHealthProfile) => void;
  simulateRhythm: (rhythm: RhythmType, customBpm?: number) => void;
  toggleMonitoring: () => void;
  reconnectDevice: () => void;
  disconnectDevice: () => void;
  setConnectionMode: (mode: ConnectionMode, config?: any) => void;
  addNotification: (title: string, message: string, severity?: 'normal' | 'attention' | 'critical', category?: any) => void;
}

const HealthContext = createContext<HealthContextValue | undefined>(undefined);

export const HealthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentBpm, setCurrentBpm] = useState<number>(deviceService.getCurrentBpm());
  const [currentRhythm, setCurrentRhythm] = useState<RhythmType>(deviceService.getCurrentRhythm());
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>(deviceService.getStatus());
  const [monitoringMode, setMonitoringModeState] = useState<MonitoringMode>('normal');
  const [personaMode, setPersonaModeState] = useState<PersonaMode>(storageService.getPersonaMode());
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [userProfile, setUserProfile] = useState<UserHealthProfile>(storageService.getProfile());
  const [workouts, setWorkouts] = useState<WorkoutSession[]>(storageService.getWorkouts());
  const [events, setEvents] = useState<RhythmEvent[]>(storageService.getEvents());
  const [notifications, setNotifications] = useState<AppNotification[]>(storageService.getNotifications());
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkoutState | null>(null);

  // Sync theme with HTML document class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Subscribe to device stream
  useEffect(() => {
    const unsubHr = deviceService.subscribeHeartRate((reading) => {
      setCurrentBpm(reading.bpm);
      setCurrentRhythm(reading.rhythm);

      // If workout is active, record sample
      setActiveWorkout((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          samples: [...prev.samples, reading.bpm]
        };
      });
    });

    const unsubStatus = deviceService.subscribeStatus((status) => {
      setDeviceStatus(status);
    });

    const unsubEvents = deviceService.subscribeEvents((newEvent) => {
      setEvents((prev) => {
        const updated = [newEvent, ...prev];
        storageService.saveEvents(updated);
        return updated;
      });

      // Also trigger a notification
      addNotification(
        'Arrhythmia Pattern Detected',
        `${newEvent.label} at ${new Date(newEvent.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${newEvent.heartRate} BPM).`,
        newEvent.severity,
        'rhythm'
      );

      // Increment active workout event count if exercising
      setActiveWorkout((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          detectedEvents: prev.detectedEvents + 1
        };
      });
    });

    return () => {
      unsubHr();
      unsubStatus();
      unsubEvents();
    };
  }, []);

  // Workout active timer tick
  useEffect(() => {
    if (!activeWorkout) return;

    const timer = setInterval(() => {
      setActiveWorkout((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          seconds: prev.seconds + 1
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeWorkout !== null]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const setPersonaMode = (mode: PersonaMode) => {
    setPersonaModeState(mode);
    storageService.savePersonaMode(mode);
  };

  const setMonitoringMode = (mode: MonitoringMode) => {
    setMonitoringModeState(mode);
  };

  const addNotification = (
    title: string,
    message: string,
    severity: 'normal' | 'attention' | 'critical' = 'normal',
    category: any = 'system'
  ) => {
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title,
      message,
      timestamp: Date.now(),
      severity,
      read: false,
      category
    };

    setNotifications((prev) => {
      const updated = [newNotif, ...prev];
      storageService.saveNotifications(updated);
      return updated;
    });
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      storageService.saveNotifications(updated);
      return updated;
    });
  };

  const clearNotifications = () => {
    setNotifications([]);
    storageService.saveNotifications([]);
  };

  const saveUserProfile = (profile: UserHealthProfile) => {
    setUserProfile(profile);
    storageService.saveProfile(profile);
    addNotification('Profile Updated', 'Health parameters and alert thresholds were updated.', 'normal', 'system');
  };

  const acknowledgeEvent = (eventId: string, notes?: string) => {
    setEvents((prev) => {
      const updated = prev.map((evt) =>
        evt.id === eventId
          ? { ...evt, acknowledged: true, clinicalNotes: notes ?? evt.clinicalNotes }
          : evt
      );
      storageService.saveEvents(updated);
      return updated;
    });
    addNotification('Event Reviewed', 'Arrhythmia event status updated to Acknowledged.', 'normal', 'rhythm');
  };

  const startWorkout = (type: WorkoutType) => {
    const titles: Record<WorkoutType, string> = {
      running: 'Cardio Run Session',
      walking: 'Brisk Walk',
      cycling: 'Cycling Training',
      gym: 'Strength & Conditioning',
      other: 'Cardio Fitness Session'
    };

    setActiveWorkout({
      type,
      title: titles[type] || 'Workout Session',
      startTime: Date.now(),
      seconds: 0,
      samples: [currentBpm],
      detectedEvents: 0
    });

    setMonitoringModeState('sports');
    // Elevated HR during exercise simulation
    deviceService.setSimulatedBpm(135);
    addNotification('Sports Mode Started', `Started ${titles[type]}. Real-time HR zone tracking active.`, 'normal', 'workout');
  };

  const finishWorkout = (): WorkoutSession | null => {
    if (!activeWorkout) return null;

    const samples = activeWorkout.samples.length > 0 ? activeWorkout.samples : [currentBpm];
    const avgBpm = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
    const minBpm = Math.min(...samples);
    const maxBpm = Math.max(...samples);

    // Compute zone breakdown
    const totalSecs = Math.max(1, activeWorkout.seconds);
    const zoneCounts: Record<HeartRateZone, number> = {
      rest: 0,
      light: 0,
      moderate: 0,
      cardio: 0,
      peak: 0
    };

    samples.forEach((bpm) => {
      const zone = deviceService.calculateZone(bpm);
      zoneCounts[zone]++;
    });

    const zoneDistribution = [
      {
        zone: 'rest' as HeartRateZone,
        label: 'Rest / Recovery',
        minBpm: 0,
        maxBpm: 109,
        seconds: Math.round((zoneCounts.rest / samples.length) * totalSecs),
        percentage: Math.round((zoneCounts.rest / samples.length) * 100),
        color: '#38bdf8'
      },
      {
        zone: 'light' as HeartRateZone,
        label: 'Light / Fat Burn',
        minBpm: 110,
        maxBpm: 135,
        seconds: Math.round((zoneCounts.light / samples.length) * totalSecs),
        percentage: Math.round((zoneCounts.light / samples.length) * 100),
        color: '#34d399'
      },
      {
        zone: 'moderate' as HeartRateZone,
        label: 'Moderate / Aerobic',
        minBpm: 136,
        maxBpm: 155,
        seconds: Math.round((zoneCounts.moderate / samples.length) * totalSecs),
        percentage: Math.round((zoneCounts.moderate / samples.length) * 100),
        color: '#fbbf24'
      },
      {
        zone: 'cardio' as HeartRateZone,
        label: 'Cardio / Anaerobic',
        minBpm: 156,
        maxBpm: 175,
        seconds: Math.round((zoneCounts.cardio / samples.length) * totalSecs),
        percentage: Math.round((zoneCounts.cardio / samples.length) * 100),
        color: '#f97316'
      },
      {
        zone: 'peak' as HeartRateZone,
        label: 'Peak Effort',
        minBpm: 176,
        maxBpm: 220,
        seconds: Math.round((zoneCounts.peak / samples.length) * totalSecs),
        percentage: Math.round((zoneCounts.peak / samples.length) * 100),
        color: '#ef4444'
      }
    ];

    // Estimated calories: approx 9-11 kcal per min for moderate exercise
    const calories = Math.round((totalSecs / 60) * ((avgBpm / 140) * 10));

    // Construct trend points (5 to 10 points)
    const hrTrend: { time: number; bpm: number }[] = [];
    const step = Math.max(1, Math.floor(samples.length / 8));
    for (let i = 0; i < samples.length; i += step) {
      hrTrend.push({
        time: Math.round((i / samples.length) * (totalSecs / 60)),
        bpm: samples[i]
      });
    }

    const session: WorkoutSession = {
      id: `wo-${Date.now()}`,
      type: activeWorkout.type,
      title: activeWorkout.title,
      startTime: activeWorkout.startTime,
      endTime: Date.now(),
      durationSeconds: totalSecs,
      avgBpm,
      minBpm,
      maxBpm,
      estimatedCalories: Math.max(15, calories),
      zoneDistribution,
      eventsDetected: activeWorkout.detectedEvents,
      hrTrend
    };

    setWorkouts((prev) => {
      const updated = [session, ...prev];
      storageService.saveWorkout(session);
      return updated;
    });

    setActiveWorkout(null);
    setMonitoringModeState('normal');
    // Return heart rate back towards normal
    deviceService.setSimulatedBpm(74);

    addNotification(
      'Workout Saved',
      `Completed ${session.title}: ${Math.floor(session.durationSeconds / 60)}m ${session.durationSeconds % 60}s | Avg ${session.avgBpm} BPM`,
      'normal',
      'workout'
    );

    return session;
  };

  const cancelWorkout = () => {
    setActiveWorkout(null);
    setMonitoringModeState('normal');
    deviceService.setSimulatedBpm(72);
  };

  const simulateRhythm = (rhythm: RhythmType, customBpm?: number) => {
    deviceService.simulateRhythm(rhythm, customBpm);
  };

  const toggleMonitoring = () => {
    deviceService.toggleMonitoring();
  };

  const reconnectDevice = () => {
    deviceService.reconnect();
  };

  const disconnectDevice = () => {
    deviceService.disconnect();
  };

  const setConnectionMode = (mode: ConnectionMode, config?: any) => {
    deviceService.setConnectionMode(mode, config);
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  return (
    <HealthContext.Provider
      value={{
        currentBpm,
        currentRhythm,
        deviceStatus,
        monitoringMode,
        personaMode,
        isDarkMode,
        userProfile,
        workouts,
        events,
        notifications,
        activeWorkout,
        unreadNotificationsCount,

        toggleDarkMode,
        setPersonaMode,
        setMonitoringMode,
        startWorkout,
        finishWorkout,
        cancelWorkout,
        acknowledgeEvent,
        markNotificationRead,
        clearNotifications,
        saveUserProfile,
        simulateRhythm,
        toggleMonitoring,
        reconnectDevice,
        disconnectDevice,
        setConnectionMode,
        addNotification
      }}
    >
      {children}
    </HealthContext.Provider>
  );
};

export const useHealth = () => {
  const context = useContext(HealthContext);
  if (!context) {
    throw new Error('useHealth must be used within a HealthProvider');
  }
  return context;
};
