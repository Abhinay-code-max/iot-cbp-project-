import { ECGReading } from '../types';

/**
 * Service for streaming telemetry from ESP32 over Wi-Fi via WebSockets
 */
export class WebSocketService {
  private socket: WebSocket | null = null;
  private onDataCallback: ((sample: ECGReading) => void) | null = null;
  private onErrorCallback: ((err: Event) => void) | null = null;
  private onStatusChangeCallback: ((connected: boolean) => void) | null = null;

  public connect(
    ipOrUrl: string = '192.168.4.1',
    onData: (sample: ECGReading) => void,
    onStatusChange?: (connected: boolean) => void,
    onError?: (err: Event) => void
  ): void {
    this.disconnect();

    this.onDataCallback = onData;
    this.onStatusChangeCallback = onStatusChange || null;
    this.onErrorCallback = onError || null;

    let targetUrl = ipOrUrl.trim();
    if (!targetUrl.startsWith('ws://') && !targetUrl.startsWith('wss://')) {
      targetUrl = `ws://${targetUrl}/ws`;
    }

    try {
      this.socket = new WebSocket(targetUrl);

      this.socket.onopen = () => {
        if (this.onStatusChangeCallback) this.onStatusChangeCallback(true);
      };

      this.socket.onmessage = (event) => {
        try {
          const raw = event.data;
          let voltage = 0;
          if (typeof raw === 'string' && raw.startsWith('{')) {
            const data = JSON.parse(raw);
            voltage = data.v ?? data.voltage ?? 0;
          } else {
            voltage = parseFloat(raw);
          }

          if (!isNaN(voltage) && this.onDataCallback) {
            this.onDataCallback({
              timestamp: Date.now(),
              voltage: Number(voltage.toFixed(3)),
              lead: 'Lead II (ESP32 Wi-Fi)'
            });
          }
        } catch (e) {
          // Packet parse ignored
        }
      };

      this.socket.onerror = (err) => {
        if (this.onErrorCallback) this.onErrorCallback(err);
      };

      this.socket.onclose = () => {
        if (this.onStatusChangeCallback) this.onStatusChangeCallback(false);
      };
    } catch (err: any) {
      if (this.onErrorCallback) this.onErrorCallback(err);
    }
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}
