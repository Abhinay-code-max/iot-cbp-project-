export type RhythmType =
  | 'normal'
  | 'bradycardia'
  | 'tachycardia'
  | 'irregular'
  | 'possible_arrhythmia'
  | 'signal_unavailable';

export type MonitoringMode = 'normal' | 'sports' | 'clinical';

export type PersonaMode = 'fitness' | 'clinical';

export type ConnectionMode = 'mock' | 'serial' | 'websocket';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export type SeverityLevel = 'normal' | 'attention' | 'critical';

export type WorkoutType = 'running' | 'walking' | 'cycling' | 'gym' | 'other';

export type HeartRateZone = 'rest' | 'light' | 'moderate' | 'cardio' | 'peak';

export interface HeartRateReading {
  bpm: number;
  timestamp: number;
  rhythm: RhythmType;
  sqi: number; // Signal Quality Index 0 - 100%
  zone?: HeartRateZone;
}

export interface ECGReading {
  timestamp: number;
  voltage: number; // millivolts, e.g. -0.5 to 1.5 mV
  lead?: string; // e.g. "Lead II"
}

export interface VitalReading {
  id: string;
  name: string;
  shortName: string;
  value: number | string | null;
  unit: string;
  status: 'optimal' | 'attention' | 'warning' | 'not_connected';
  isSupportedByDevice: boolean;
  category: 'cardiovascular' | 'respiratory' | 'biometrics';
  description: string;
  lastUpdated?: string;
}

export interface RhythmEvent {
  id: string;
  timestamp: number;
  heartRate: number;
  rhythmClassification: RhythmType;
  label: string;
  severity: SeverityLevel;
  durationSeconds: number;
  monitoringMode: MonitoringMode;
  sqi: number;
  confidenceScore: number; // 0 - 100%
  clinicalNotes?: string;
  acknowledged: boolean;
  waveformSnapshot: number[]; // mini ECG sample array for waveform visualizer
}

export interface ZoneDistribution {
  zone: HeartRateZone;
  label: string;
  minBpm: number;
  maxBpm: number;
  seconds: number;
  percentage: number;
  color: string;
}

export interface WorkoutSession {
  id: string;
  type: WorkoutType;
  title: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  avgBpm: number;
  minBpm: number;
  maxBpm: number;
  estimatedCalories: number;
  zoneDistribution: ZoneDistribution[];
  eventsDetected: number;
  hrTrend: { time: number; bpm: number }[];
  notes?: string;
}

export interface DeviceStatus {
  deviceName: string;
  serialNumber: string;
  firmwareVersion: string;
  connectionState: ConnectionState;
  connectionMode: ConnectionMode;
  batteryLevel: number; // 0 - 100%
  isCharging: boolean;
  signalQuality: number; // 0 - 100%
  lastSyncTime: number;
  isMonitoring: boolean;
  sampleRateHz: number; // default 250Hz or 500Hz
  hardwareType: string; // e.g. "ESP32-WROOM-32D / AD8232 ECG"
  ipAddress?: string;
  serialBaudRate?: number;
}

export interface UserHealthProfile {
  name: string;
  age: number;
  biologicalSex: 'male' | 'female' | 'other';
  heightCm: number;
  weightKg: number;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  restingHrTarget: number;
  maxHrAlertThreshold: number;
  bradycardiaThreshold: number;
  soundAlertsEnabled: boolean;
  preferredView: PersonaMode;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  severity: SeverityLevel;
  read: boolean;
  category: 'rhythm' | 'workout' | 'device' | 'system';
  actionUrl?: string;
}

export interface HistorySummary {
  period: 'today' | 'week' | 'month';
  avgBpm: number;
  restingBpm: number;
  minBpm: number;
  maxBpm: number;
  totalMonitoringMinutes: number;
  irregularEventsCount: number;
  workoutsCount: number;
  trendData: { label: string; avgBpm: number; minBpm: number; maxBpm: number; events: number }[];
}
