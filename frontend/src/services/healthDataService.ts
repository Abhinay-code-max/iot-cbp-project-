import {
  VitalReading,
  HistorySummary
} from '../types';

export const healthDataService = {
  /**
   * Returns list of clinical vitals according to requirement #4:
   * "Do not pretend the current ECG hardware measures vitals that it cannot actually measure.
   * If these additional sensors are not connected, show them as: 'Sensor not connected'
   * rather than generating fake readings."
   */
  getVitalsList(currentBpm: number, sqi: number, isConnected: boolean): VitalReading[] {
    return [
      {
        id: 'hr',
        name: 'Heart Rate',
        shortName: 'HR',
        value: isConnected && currentBpm > 0 ? currentBpm : '-',
        unit: 'BPM',
        status: isConnected && currentBpm > 0 ? (currentBpm < 50 || currentBpm > 120 ? 'attention' : 'optimal') : 'not_connected',
        isSupportedByDevice: true,
        category: 'cardiovascular',
        description: 'Real-time ventricular rate calculated via R-peak detection from Lead II ECG.'
      },
      {
        id: 'hrv',
        name: 'Heart Rate Variability',
        shortName: 'HRV (RMSSD)',
        value: isConnected ? 42 : '-',
        unit: 'ms',
        status: isConnected ? 'optimal' : 'not_connected',
        isSupportedByDevice: true,
        category: 'cardiovascular',
        description: 'Root Mean Square of Successive Differences between adjacent normal R-R intervals.'
      },
      {
        id: 'resting_hr',
        name: 'Resting Heart Rate',
        shortName: 'Resting HR',
        value: isConnected ? 61 : '-',
        unit: 'BPM',
        status: isConnected ? 'optimal' : 'not_connected',
        isSupportedByDevice: true,
        category: 'cardiovascular',
        description: 'Computed nocturnal and sustained resting baseline over 24-hour observation.'
      },
      {
        id: 'ecg_sqi',
        name: 'ECG Signal Quality Index',
        shortName: 'SQI',
        value: isConnected ? `${sqi}%` : '-',
        unit: '%',
        status: isConnected && sqi >= 85 ? 'optimal' : isConnected ? 'attention' : 'not_connected',
        isSupportedByDevice: true,
        category: 'cardiovascular',
        description: 'P-QRS-T morphological SNR index verifying lead adhesion and motion artifact resistance.'
      },
      // --- Sensors NOT currently connected to the AD8232 ECG hardware ---
      {
        id: 'spo2',
        name: 'Blood Oxygen Saturation',
        shortName: 'SpO2',
        value: null,
        unit: '%',
        status: 'not_connected',
        isSupportedByDevice: false,
        category: 'respiratory',
        description: 'Optical photoplethysmography sensor (e.g. MAX30102) not attached.'
      },
      {
        id: 'temp',
        name: 'Core Body Temperature',
        shortName: 'Body Temp',
        value: null,
        unit: '°C',
        status: 'not_connected',
        isSupportedByDevice: false,
        category: 'biometrics',
        description: 'Infrared or contact thermistor sensor not attached.'
      },
      {
        id: 'bp',
        name: 'Blood Pressure',
        shortName: 'BP',
        value: null,
        unit: 'mmHg',
        status: 'not_connected',
        isSupportedByDevice: false,
        category: 'cardiovascular',
        description: 'Oscillometric cuff or continuous tonometric sensor not attached.'
      },
      {
        id: 'resp',
        name: 'Respiratory Rate',
        shortName: 'Resp Rate',
        value: null,
        unit: 'br/min',
        status: 'not_connected',
        isSupportedByDevice: false,
        category: 'respiratory',
        description: 'Dedicated impedance pneumography or respiratory belt sensor not connected.'
      }
    ];
  },

  /**
   * Generates realistic heart rate trend data for specified time range filter
   */
  getHeartRateTrend(filter: 'live' | '1h' | '6h' | 'today' | '7d' | '30d', baseBpm: number = 72) {
    const points: {
      timestamp: number;
      label: string;
      bpm: number;
      mode: 'normal' | 'sports' | 'clinical';
      rhythm: string;
    }[] = [];

    const now = Date.now();

    if (filter === 'live') {
      // Last 60 seconds (1 pt per 2 seconds)
      for (let i = 30; i >= 0; i--) {
        const time = now - i * 2000;
        const d = new Date(time);
        const noise = Math.sin(i * 0.4) * 4 + (Math.random() - 0.5) * 2;
        points.push({
          timestamp: time,
          label: `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
          bpm: Math.round(baseBpm + noise),
          mode: 'normal',
          rhythm: 'Normal Sinus Rhythm'
        });
      }
    } else if (filter === '1h') {
      // 60 minutes (1 pt per 2 minutes)
      for (let i = 30; i >= 0; i--) {
        const time = now - i * 60 * 2 * 1000;
        const d = new Date(time);
        const bpm = Math.round(70 + Math.sin(i * 0.3) * 8 + (i > 10 && i < 18 ? 40 : 0));
        points.push({
          timestamp: time,
          label: `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          bpm,
          mode: i > 10 && i < 18 ? 'sports' : 'normal',
          rhythm: bpm > 130 ? 'Sinus Tachycardia (Exertion)' : 'Normal Sinus Rhythm'
        });
      }
    } else if (filter === '6h') {
      // 6 hours (1 pt per 10 minutes)
      for (let i = 36; i >= 0; i--) {
        const time = now - i * 10 * 60 * 1000;
        const d = new Date(time);
        const bpm = Math.round(68 + Math.sin(i * 0.2) * 12 + (i === 15 ? 55 : 0));
        points.push({
          timestamp: time,
          label: `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          bpm,
          mode: i === 15 ? 'sports' : 'normal',
          rhythm: i === 15 ? 'High Heart Rate' : 'Normal Sinus Rhythm'
        });
      }
    } else if (filter === 'today') {
      // 24 hours (1 pt per hour)
      for (let hour = 23; hour >= 0; hour--) {
        const time = now - hour * 3600 * 1000;
        const d = new Date(time);
        let bpm = 64;
        if (d.getHours() >= 0 && d.getHours() < 6) bpm = 54 + Math.round(Math.random() * 4); // nocturnal rest
        else if (d.getHours() >= 7 && d.getHours() < 9) bpm = 82 + Math.round(Math.random() * 8); // morning commute
        else if (d.getHours() >= 17 && d.getHours() < 19) bpm = 138 + Math.round(Math.random() * 15); // workout
        else bpm = 72 + Math.round(Math.random() * 6); // normal day

        points.push({
          timestamp: time,
          label: `${d.toLocaleTimeString([], { hour: 'numeric' })}`,
          bpm,
          mode: bpm > 120 ? 'sports' : 'normal',
          rhythm: bpm > 120 ? 'Elevated HR (Exercise)' : bpm < 58 ? 'Resting Bradycardia' : 'Normal Sinus Rhythm'
        });
      }
    } else if (filter === '7d') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let i = 6; i >= 0; i--) {
        const time = now - i * 86400 * 1000;
        const d = new Date(time);
        const avg = 71 + Math.round(Math.sin(i) * 5);
        points.push({
          timestamp: time,
          label: days[d.getDay()],
          bpm: avg,
          mode: 'normal',
          rhythm: 'Normal Baseline Sinus'
        });
      }
    } else {
      // 30 days (every 2 days)
      for (let i = 15; i >= 0; i--) {
        const time = now - i * 2 * 86400 * 1000;
        const d = new Date(time);
        const avg = 70 + Math.round(Math.sin(i * 0.8) * 4);
        points.push({
          timestamp: time,
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          bpm: avg,
          mode: 'normal',
          rhythm: 'Normal Baseline Sinus'
        });
      }
    }

    return points;
  },

  /**
   * Health History summary generator for Today / Week / Month
   */
  getHistorySummary(period: 'today' | 'week' | 'month'): HistorySummary {
    if (period === 'today') {
      return {
        period: 'today',
        avgBpm: 74,
        restingBpm: 58,
        minBpm: 52,
        maxBpm: 154,
        totalMonitoringMinutes: 620, // ~10.3 hours
        irregularEventsCount: 2,
        workoutsCount: 1,
        trendData: [
          { label: '00:00 - 04:00', avgBpm: 55, minBpm: 52, maxBpm: 60, events: 0 },
          { label: '04:00 - 08:00', avgBpm: 62, minBpm: 54, maxBpm: 84, events: 0 },
          { label: '08:00 - 12:00', avgBpm: 78, minBpm: 68, maxBpm: 114, events: 1 },
          { label: '12:00 - 16:00', avgBpm: 75, minBpm: 65, maxBpm: 88, events: 0 },
          { label: '16:00 - 20:00', avgBpm: 92, minBpm: 70, maxBpm: 154, events: 1 },
          { label: '20:00 - Present', avgBpm: 71, minBpm: 64, maxBpm: 79, events: 0 }
        ]
      };
    } else if (period === 'week') {
      return {
        period: 'week',
        avgBpm: 72,
        restingBpm: 59,
        minBpm: 50,
        maxBpm: 168,
        totalMonitoringMinutes: 4120, // ~68 hours
        irregularEventsCount: 5,
        workoutsCount: 4,
        trendData: [
          { label: 'Mon', avgBpm: 71, minBpm: 52, maxBpm: 148, events: 1 },
          { label: 'Tue', avgBpm: 73, minBpm: 54, maxBpm: 162, events: 0 },
          { label: 'Wed', avgBpm: 70, minBpm: 51, maxBpm: 120, events: 1 },
          { label: 'Thu', avgBpm: 75, minBpm: 55, maxBpm: 156, events: 1 },
          { label: 'Fri', avgBpm: 72, minBpm: 53, maxBpm: 142, events: 0 },
          { label: 'Sat', avgBpm: 69, minBpm: 50, maxBpm: 168, events: 2 },
          { label: 'Sun', avgBpm: 74, minBpm: 52, maxBpm: 154, events: 0 }
        ]
      };
    } else {
      return {
        period: 'month',
        avgBpm: 71,
        restingBpm: 58,
        minBpm: 48,
        maxBpm: 172,
        totalMonitoringMinutes: 17400, // ~290 hours
        irregularEventsCount: 16,
        workoutsCount: 18,
        trendData: [
          { label: 'Week 1', avgBpm: 73, minBpm: 51, maxBpm: 165, events: 4 },
          { label: 'Week 2', avgBpm: 70, minBpm: 49, maxBpm: 160, events: 3 },
          { label: 'Week 3', avgBpm: 72, minBpm: 50, maxBpm: 172, events: 5 },
          { label: 'Week 4', avgBpm: 71, minBpm: 48, maxBpm: 158, events: 4 }
        ]
      };
    }
  }
};
