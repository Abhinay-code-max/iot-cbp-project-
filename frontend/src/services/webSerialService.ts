import { ECGReading, RhythmType } from '../types';

export interface SerialTelemetry {
  voltage?: number;
  bpm?: number;
  medianBpm?: number;
  rr?: number;
  rhythm?: RhythmType;
  statusText?: string;
  leadsOff?: boolean;
}

/**
 * Service for streaming telemetry from ESP32 over USB via browser Web Serial API.
 * Interoperable with ESP32 arrhythmia_detector sketch outputs:
 * 1. Text mode: "R-peak detected | RR: ... ms | HR: ... bpm", "Median HR: ... | Status: ...", "Leads off!..."
 * 2. Plot mode: CSV numeric lines (ecg,mwi,threshold) or raw ADC integers
 * 3. JSON mode: {"bpm": ..., "status": ..., "leadsOff": ...}
 */
export class WebSerialService {
  private port: any = null;
  private reader: any = null;
  private isReading = false;
  private onDataCallback: ((sample: ECGReading) => void) | null = null;
  private onTelemetryCallback: ((telemetry: SerialTelemetry) => void) | null = null;
  private onErrorCallback: ((err: Error) => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public async connect(
    baudRate: number = 115200,
    onData: (sample: ECGReading) => void,
    onTelemetry?: (telemetry: SerialTelemetry) => void,
    onError?: (err: Error) => void,
    onDisconnect?: () => void
  ): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.');
    }

    try {
      this.onDataCallback = onData;
      this.onTelemetryCallback = onTelemetry || null;
      this.onErrorCallback = onError || null;
      this.onDisconnectCallback = onDisconnect || null;

      // Prompt user to select ESP32 COM port
      // @ts-ignore
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate });

      this.isReading = true;
      this.startReadingLoop();
      return true;
    } catch (err: any) {
      if (this.onErrorCallback) this.onErrorCallback(err);
      throw err;
    }
  }

  private mapStatusStringToRhythm(status: string): RhythmType {
    const s = status.toLowerCase();
    if (s.includes('tachycardia')) return 'tachycardia';
    if (s.includes('bradycardia')) return 'bradycardia';
    if (s.includes('irregular')) return 'irregular';
    if (s.includes('pause') || s.includes('dropped') || s.includes('arrhythmia')) return 'possible_arrhythmia';
    if (s.includes('lead') || s.includes('off') || s.includes('contact')) return 'signal_unavailable';
    return 'normal';
  }

  private async startReadingLoop() {
    if (!this.port || !this.port.readable) return;

    // @ts-ignore
    const textDecoder = new TextDecoderStream();
    this.port.readable.pipeTo(textDecoder.writable).catch(() => {});
    this.reader = textDecoder.readable.getReader();

    let buffer = '';

    try {
      while (this.isReading) {
        const { value, done } = await this.reader.read();
        if (done) break;

        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // 1. Check Leads Off message from ESP32
            if (/leads off/i.test(trimmed)) {
              if (this.onTelemetryCallback) {
                this.onTelemetryCallback({
                  leadsOff: true,
                  bpm: 0,
                  rhythm: 'signal_unavailable',
                  statusText: 'Leads Off'
                });
              }
              continue;
            }

            // 2. Check JSON payload
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
              try {
                const parsed = JSON.parse(trimmed);
                const voltage = parsed.v ?? parsed.voltage ?? parsed.ecg ?? null;
                const bpm = parsed.bpm ?? null;
                const leadsOff = parsed.leadsOff ?? false;
                const statusStr = parsed.status || '';

                if (this.onTelemetryCallback) {
                  this.onTelemetryCallback({
                    voltage: voltage !== null ? Number(voltage) : undefined,
                    bpm: bpm !== null ? Number(bpm) : undefined,
                    leadsOff: Boolean(leadsOff),
                    rhythm: statusStr ? this.mapStatusStringToRhythm(statusStr) : undefined,
                    statusText: statusStr
                  });
                }

                if (voltage !== null && this.onDataCallback) {
                  this.onDataCallback({
                    timestamp: Date.now(),
                    voltage: Number(voltage.toFixed(3)),
                    lead: 'Lead II (ESP32 Serial)'
                  });
                }
                continue;
              } catch {
                // fall through to text parsing
              }
            }

            // 3. Check "R-peak detected | RR: 820 ms | HR: 73.2 bpm"
            const hrMatch = trimmed.match(/HR:\s*([\d.]+)\s*bpm/i);
            const rrMatch = trimmed.match(/RR:\s*(\d+)\s*ms/i);
            if (hrMatch) {
              const bpm = parseFloat(hrMatch[1]);
              const rr = rrMatch ? parseInt(rrMatch[1], 10) : undefined;
              if (this.onTelemetryCallback) {
                this.onTelemetryCallback({
                  bpm,
                  rr,
                  leadsOff: false
                });
              }
            }

            // 4. Check "Median HR: 72.0 bpm | SDNN: ... | Status: Normal"
            const medianMatch = trimmed.match(/Median HR:\s*([\d.]+)\s*bpm/i);
            const statusMatch = trimmed.match(/Status:\s*(.+)$/i);
            if (medianMatch || statusMatch) {
              const medianBpm = medianMatch ? parseFloat(medianMatch[1]) : undefined;
              const statusText = statusMatch ? statusMatch[1].trim() : undefined;
              const rhythm = statusText ? this.mapStatusStringToRhythm(statusText) : undefined;
              if (this.onTelemetryCallback) {
                this.onTelemetryCallback({
                  medianBpm,
                  bpm: medianBpm,
                  rhythm,
                  statusText,
                  leadsOff: false
                });
              }
            }

            // 5. Check CSV waveform data (PLOT_MODE 1: ecg,mwi,threshold) or raw ADC float/int
            let voltage: number | null = null;
            if (trimmed.includes(',')) {
              const parts = trimmed.split(',');
              const firstNum = parseFloat(parts[0]);
              if (!isNaN(firstNum)) {
                voltage = firstNum > 10 ? (firstNum - 2048) / 1000 : firstNum;
              }
            } else if (!hrMatch && !medianMatch && !statusMatch && !trimmed.includes('Calibration') && !trimmed.includes('WiFi') && !trimmed.includes('Dropped')) {
              // Only parse if it's purely a number (optionally with 'ecg:' prefix)
              let clean = trimmed;
              if (clean.toLowerCase().startsWith('ecg:')) {
                clean = clean.substring(4).trim();
              }
              if (/^-?\d+(\.\d+)?$/.test(clean)) {
                const num = parseFloat(clean);
                if (!isNaN(num)) {
                  voltage = Math.abs(num) > 10 ? (num - 2048) / 1000 : num;
                }
              }
            }

            if (voltage !== null && this.onDataCallback) {
              this.onDataCallback({
                timestamp: Date.now(),
                voltage: Number(voltage.toFixed(3)),
                lead: 'Lead II (ESP32 Serial)'
              });
            }
          }
        }
      }
    } catch (err: any) {
      if (this.onErrorCallback) this.onErrorCallback(err);
    } finally {
      this.disconnect();
    }
  }

  public async disconnect(): Promise<void> {
    this.isReading = false;
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch (e) {
      // Ignore cleanup error
    }

    if (this.onDisconnectCallback) {
      this.onDisconnectCallback();
    }
  }

  public isConnected(): boolean {
    return this.isReading && this.port !== null;
  }
}
