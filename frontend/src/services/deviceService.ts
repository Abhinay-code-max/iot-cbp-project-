import {
  DeviceStatus,
  ECGReading,
  HeartRateReading,
  RhythmEvent,
  RhythmType,
  ConnectionMode,
  HeartRateZone
} from '../types';
import { MockECGGenerator } from './mockDataService';
import { WebSerialService, SerialTelemetry } from './webSerialService';
import { WebSocketService } from './webSocketService';

type ECGCallback = (sample: ECGReading) => void;
type HeartRateCallback = (reading: HeartRateReading) => void;
type DeviceStatusCallback = (status: DeviceStatus) => void;
type EventCallback = (event: RhythmEvent) => void;

class DeviceService {
  private mockGenerator = new MockECGGenerator();
  private serialService = new WebSerialService();
  private webSocketService = new WebSocketService();

  private ecgSubscribers: Set<ECGCallback> = new Set();
  private hrSubscribers: Set<HeartRateCallback> = new Set();
  private statusSubscribers: Set<DeviceStatusCallback> = new Set();
  private eventSubscribers: Set<EventCallback> = new Set();

  private mockIntervalId: any = null;
  private hrIntervalId: any = null;
  private httpPollIntervalId: any = null;

  // Initial state: strictly disconnected until ESP32 connects!
  private currentStatus: DeviceStatus = {
    deviceName: 'PulseGuard ESP32-WROOM (AD8232 ECG)',
    serialNumber: 'PG-ESP32-84920',
    firmwareVersion: 'v2.4.1-BLE-WS',
    connectionState: 'disconnected',
    connectionMode: 'serial',
    batteryLevel: 0,
    isCharging: false,
    signalQuality: 0,
    lastSyncTime: 0,
    isMonitoring: true,
    sampleRateHz: 250,
    hardwareType: 'ESP32 Dual-Core / AD8232 Analog Front-End',
    ipAddress: '192.168.4.1',
    serialBaudRate: 115200
  };

  private currentBpm = 0;
  private currentRhythm: RhythmType = 'signal_unavailable';
  private leadsOffNow = true;

  constructor() {
    // Starts completely idle and disconnected.
    // The heartbeat function only operates when ESP32 is connected.
    // When nothing is connected, all displays show '-'.
  }

  public getStatus(): DeviceStatus {
    return { ...this.currentStatus };
  }

  public getCurrentBpm(): number {
    // Only return BPM if genuinely connected and leads are in contact
    if (this.currentStatus.connectionState !== 'connected' || this.leadsOffNow) {
      return 0;
    }
    return this.currentBpm;
  }

  public getCurrentRhythm(): RhythmType {
    if (this.currentStatus.connectionState !== 'connected' || this.leadsOffNow) {
      return 'signal_unavailable';
    }
    return this.currentRhythm;
  }

  public isConnected(): boolean {
    return this.currentStatus.connectionState === 'connected' && !this.leadsOffNow;
  }

  public subscribeECG(cb: ECGCallback): () => void {
    this.ecgSubscribers.add(cb);
    return () => this.ecgSubscribers.delete(cb);
  }

  public subscribeHeartRate(cb: HeartRateCallback): () => void {
    this.hrSubscribers.add(cb);
    // Emit immediate current state
    const isConn = this.currentStatus.connectionState === 'connected' && !this.leadsOffNow;
    cb({
      bpm: isConn ? this.currentBpm : 0,
      timestamp: Date.now(),
      rhythm: isConn ? this.currentRhythm : 'signal_unavailable',
      sqi: isConn ? this.currentStatus.signalQuality : 0,
      zone: this.calculateZone(this.currentBpm)
    });
    return () => this.hrSubscribers.delete(cb);
  }

  public subscribeStatus(cb: DeviceStatusCallback): () => void {
    this.statusSubscribers.add(cb);
    cb(this.getStatus());
    return () => this.statusSubscribers.delete(cb);
  }

  public subscribeEvents(cb: EventCallback): () => void {
    this.eventSubscribers.add(cb);
    return () => this.eventSubscribers.delete(cb);
  }

  public calculateZone(bpm: number): HeartRateZone {
    if (bpm <= 0) return 'rest';
    if (bpm < 110) return 'rest';
    if (bpm <= 135) return 'light';
    if (bpm <= 155) return 'moderate';
    if (bpm <= 175) return 'cardio';
    return 'peak';
  }

  // --- Connection Controls ---

  public setConnectionMode(mode: ConnectionMode, config?: { ip?: string; baudRate?: number }) {
    // Teardown any existing active stream/polling
    this.stopAllStreams();

    this.currentStatus.connectionMode = mode;
    this.currentStatus.connectionState = 'connecting';
    this.notifyStatus();

    if (mode === 'mock') {
      this.currentStatus.connectionState = 'connected';
      this.currentStatus.signalQuality = 98;
      this.currentStatus.batteryLevel = 88;
      this.leadsOffNow = false;
      this.currentBpm = 72;
      this.currentRhythm = 'normal';
      this.startMockStream();
      this.startMockHeartRateLoop();
      this.notifyHeartRate();
      this.notifyStatus();
    } else if (mode === 'serial') {
      this.connectSerial(config?.baudRate || 115200);
    } else if (mode === 'websocket') {
      this.connectWiFi(config?.ip || this.currentStatus.ipAddress || '192.168.4.1');
    }
  }

  public async connectSerial(baudRate: number = 115200) {
    try {
      this.stopAllStreams();
      this.currentStatus.connectionMode = 'serial';
      this.currentStatus.connectionState = 'connecting';
      this.notifyStatus();

      await this.serialService.connect(
        baudRate,
        (sample) => {
          this.broadcastSample(sample);
        },
        (telemetry: SerialTelemetry) => {
          this.handleSerialTelemetry(telemetry);
        },
        (err) => {
          console.error('Serial Error:', err);
          this.handleDisconnect();
        },
        () => {
          this.handleDisconnect();
        }
      );

      this.currentStatus.connectionState = 'connected';
      this.currentStatus.signalQuality = 95;
      this.currentStatus.batteryLevel = 100;
      this.leadsOffNow = false;
      this.notifyStatus();
    } catch (err) {
      console.warn('Serial connection failed or cancelled:', err);
      this.handleDisconnect();
    }
  }

  private handleSerialTelemetry(telemetry: SerialTelemetry) {
    if (telemetry.leadsOff) {
      this.leadsOffNow = true;
      this.currentBpm = 0;
      this.currentRhythm = 'signal_unavailable';
      this.currentStatus.signalQuality = 0;
      this.notifyHeartRate();
      this.notifyStatus();
      return;
    }

    this.leadsOffNow = false;
    this.currentStatus.connectionState = 'connected';
    this.currentStatus.lastSyncTime = Date.now();
    this.currentStatus.signalQuality = 96;

    if (telemetry.bpm !== undefined && telemetry.bpm > 0) {
      this.currentBpm = Math.round(telemetry.bpm);
    }
    if (telemetry.rhythm) {
      this.currentRhythm = telemetry.rhythm;
    }

    this.notifyHeartRate();
    this.notifyStatus();
  }

  public connectWiFi(ip: string = '192.168.4.1') {
    this.stopAllStreams();
    this.currentStatus.connectionMode = 'websocket';
    this.currentStatus.ipAddress = ip;
    this.currentStatus.connectionState = 'connecting';
    this.notifyStatus();

    // 1. Start HTTP polling against ESP32 /api/data
    this.startHttpPolling(ip);

    // 2. Also attempt WebSocket if supported
    this.webSocketService.connect(
      ip,
      (sample) => {
        this.broadcastSample(sample);
      },
      (connected) => {
        if (connected) {
          this.currentStatus.connectionState = 'connected';
          this.currentStatus.signalQuality = 95;
          this.notifyStatus();
        }
      },
      (err) => {
        // WebSocket not required if HTTP polling is responding
      }
    );
  }

  private startHttpPolling(ip: string) {
    if (this.httpPollIntervalId) clearInterval(this.httpPollIntervalId);

    const cleanIp = ip.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const url = `http://${cleanIp}/api/data`;

    let consecutiveFailures = 0;

    const poll = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800);

        const response = await fetch(url, {
          cache: 'no-store',
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        consecutiveFailures = 0;

        this.currentStatus.connectionState = 'connected';
        this.currentStatus.lastSyncTime = Date.now();
        this.currentStatus.batteryLevel = 90;

        if (data.leadsOff) {
          this.leadsOffNow = true;
          this.currentBpm = 0;
          this.currentRhythm = 'signal_unavailable';
          this.currentStatus.signalQuality = 0;
        } else {
          this.leadsOffNow = false;
          this.currentStatus.signalQuality = 94;
          this.currentBpm = data.bpm > 0 ? Math.round(data.bpm) : 0;
          this.currentRhythm = this.mapStatusToRhythm(data.status);
        }

        this.notifyHeartRate();
        this.notifyStatus();
      } catch (e) {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          this.handleDisconnect();
        }
      }
    };

    poll();
    this.httpPollIntervalId = setInterval(poll, 400);
  }

  private mapStatusToRhythm(statusText: string): RhythmType {
    if (!statusText) return 'normal';
    const s = statusText.toLowerCase();
    if (s.includes('tachycardia')) return 'tachycardia';
    if (s.includes('bradycardia')) return 'bradycardia';
    if (s.includes('irregular')) return 'irregular';
    if (s.includes('pause') || s.includes('dropped') || s.includes('arrhythmia')) return 'possible_arrhythmia';
    if (s.includes('lead') || s.includes('off')) return 'signal_unavailable';
    return 'normal';
  }

  public toggleMonitoring() {
    this.currentStatus.isMonitoring = !this.currentStatus.isMonitoring;
    if (this.currentStatus.isMonitoring) {
      if (this.currentStatus.connectionMode === 'mock') {
        this.startMockStream();
      }
    } else {
      this.stopStream();
    }
    this.notifyStatus();
  }

  public disconnect() {
    this.stopAllStreams();
    if (this.serialService.isConnected()) {
      this.serialService.disconnect();
    }
    if (this.webSocketService.isConnected()) {
      this.webSocketService.disconnect();
    }
    this.handleDisconnect();
  }

  private handleDisconnect() {
    this.currentStatus.connectionState = 'disconnected';
    this.currentStatus.signalQuality = 0;
    this.currentBpm = 0;
    this.currentRhythm = 'signal_unavailable';
    this.leadsOffNow = true;
    this.notifyHeartRate();
    this.notifyStatus();
  }

  public reconnect() {
    this.currentStatus.connectionState = 'connecting';
    this.notifyStatus();
    setTimeout(() => {
      this.setConnectionMode(this.currentStatus.connectionMode);
    }, 600);
  }

  // Rhythm simulation controls (for mock testing only)
  public simulateRhythm(rhythm: RhythmType, customBpm?: number) {
    if (this.currentStatus.connectionMode !== 'mock') return;
    this.currentRhythm = rhythm;
    this.mockGenerator.setRhythm(rhythm);
    if (customBpm) {
      this.mockGenerator.setBpm(customBpm);
      this.currentBpm = customBpm;
    } else {
      this.currentBpm = this.mockGenerator.getBpm();
    }

    if (rhythm !== 'normal') {
      const event: RhythmEvent = {
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        heartRate: this.currentBpm,
        rhythmClassification: rhythm,
        label: this.getRhythmLabel(rhythm),
        severity: rhythm === 'possible_arrhythmia' ? 'critical' : 'attention',
        durationSeconds: 12.0,
        monitoringMode: 'normal',
        sqi: this.currentStatus.signalQuality,
        confidenceScore: 91 + Math.floor(Math.random() * 8),
        clinicalNotes: `Telemetry pattern flagged as ${this.getRhythmLabel(rhythm)}. Morphological inspection recommended.`,
        acknowledged: false,
        waveformSnapshot: this.mockGenerator.generateSnapshot(160, rhythm)
      };

      this.eventSubscribers.forEach((cb) => cb(event));
    }

    this.notifyHeartRate();
  }

  public setSimulatedBpm(bpm: number) {
    if (this.currentStatus.connectionMode !== 'mock') return;
    this.currentBpm = bpm;
    this.mockGenerator.setBpm(bpm);
    this.notifyHeartRate();
  }

  private getRhythmLabel(rhythm: RhythmType): string {
    switch (rhythm) {
      case 'bradycardia': return 'Low resting heart rate (Bradycardia)';
      case 'tachycardia': return 'Elevated heart rate (Tachycardia)';
      case 'irregular': return 'Irregular R-R intervals (Arrhythmia Pattern)';
      case 'possible_arrhythmia': return 'Unusual rhythm pattern detected (PVC/AFib candidate)';
      case 'signal_unavailable': return 'Signal quality degraded / Leads off';
      default: return 'Normal Sinus Rhythm';
    }
  }

  // --- Internal loops ---

  private startMockStream() {
    this.stopStream();
    if (!this.currentStatus.isMonitoring) return;

    const intervalMs = 16; // 60 FPS
    const samplesPerTick = Math.ceil((this.currentStatus.sampleRateHz * intervalMs) / 1000);

    this.mockIntervalId = setInterval(() => {
      for (let i = 0; i < samplesPerTick; i++) {
        const sample = this.mockGenerator.getNextSample();
        this.broadcastSample(sample);
      }
    }, intervalMs);
  }

  private stopStream() {
    if (this.mockIntervalId) {
      clearInterval(this.mockIntervalId);
      this.mockIntervalId = null;
    }
  }

  private startMockHeartRateLoop() {
    if (this.hrIntervalId) clearInterval(this.hrIntervalId);

    this.hrIntervalId = setInterval(() => {
      if (!this.currentStatus.isMonitoring || this.currentStatus.connectionState !== 'connected') {
        return;
      }

      if (this.currentRhythm === 'normal') {
        const jitter = Math.floor(Math.random() * 3) - 1;
        this.currentBpm = Math.max(55, Math.min(100, this.currentBpm + jitter));
        this.mockGenerator.setBpm(this.currentBpm);
      }

      this.notifyHeartRate();
      this.currentStatus.lastSyncTime = Date.now();
      this.notifyStatus();
    }, 1200);
  }

  private stopAllStreams() {
    this.stopStream();
    if (this.hrIntervalId) {
      clearInterval(this.hrIntervalId);
      this.hrIntervalId = null;
    }
    if (this.httpPollIntervalId) {
      clearInterval(this.httpPollIntervalId);
      this.httpPollIntervalId = null;
    }
  }

  private broadcastSample(sample: ECGReading) {
    this.ecgSubscribers.forEach((cb) => cb(sample));
  }

  private notifyHeartRate() {
    const isConn = this.currentStatus.connectionState === 'connected' && !this.leadsOffNow;
    const reading: HeartRateReading = {
      bpm: isConn ? this.currentBpm : 0,
      timestamp: Date.now(),
      rhythm: isConn ? this.currentRhythm : 'signal_unavailable',
      sqi: isConn ? this.currentStatus.signalQuality : 0,
      zone: this.calculateZone(this.currentBpm)
    };
    this.hrSubscribers.forEach((cb) => cb(reading));
  }

  private notifyStatus() {
    this.statusSubscribers.forEach((cb) => cb(this.getStatus()));
  }
}

export const deviceService = new DeviceService();
