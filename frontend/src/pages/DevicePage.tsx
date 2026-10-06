import React, { useState } from 'react';
import { useHealth } from '../context/HealthContext';
import { ConnectionMode } from '../types';
import { MedicalDisclaimer } from '../components/common/MedicalDisclaimer';
import {
  Cpu,
  Wifi,
  Battery,
  Radio,
  Power,
  RefreshCw,
  Usb,
  Sparkles
} from 'lucide-react';

export const DevicePage: React.FC = () => {
  const {
    deviceStatus,
    setConnectionMode,
    toggleMonitoring,
    disconnectDevice,
    reconnectDevice
  } = useHealth();

  const [espIp, setEspIp] = useState(deviceStatus.ipAddress || '192.168.4.1');
  const [baudRate, setBaudRate] = useState<number>(deviceStatus.serialBaudRate || 115200);
  const [connectingAction, setConnectingAction] = useState<string | null>(null);

  const isConnected = deviceStatus.connectionState === 'connected';

  const handleModeChange = async (mode: ConnectionMode) => {
    setConnectingAction(mode);
    try {
      if (mode === 'serial') {
        await setConnectionMode('serial', { baudRate });
      } else if (mode === 'websocket') {
        setConnectionMode('websocket', { ip: espIp });
      } else {
        setConnectionMode('mock');
      }
    } finally {
      setConnectingAction(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
          <Cpu className="w-6 h-6 text-emerald-500" />
          <span>IoT ECG Hardware & Interface Hub</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Manage hardware telemetry ingestion via USB Web Serial, Wi-Fi WebSocket AP, or realistic mock simulation
        </p>
      </div>

      {/* Main Hardware Card */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 border border-slate-700 text-emerald-400 flex items-center justify-center shadow-md shrink-0">
              <Cpu className="w-8 h-8" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {deviceStatus.deviceName}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                  {deviceStatus.firmwareVersion}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                S/N: {deviceStatus.serialNumber} • {deviceStatus.hardwareType}
              </p>
            </div>
          </div>

          {/* Connection State Badge & Primary Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="capitalize">{deviceStatus.connectionState}</span>
            </span>

            {isConnected ? (
              <button
                onClick={disconnectDevice}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/30 transition"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            ) : (
              <button
                onClick={reconnectDevice}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reconnect</span>
              </button>
            )}

            <button
              onClick={toggleMonitoring}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
                deviceStatus.isMonitoring
                  ? 'border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{deviceStatus.isMonitoring ? 'Pause Telemetry' : 'Resume Telemetry'}</span>
            </button>
          </div>
        </div>

        {/* Device Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
          {/* Battery */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
              <Battery className="w-4 h-4 text-emerald-400" />
              Battery Level
            </span>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {isConnected ? `${deviceStatus.batteryLevel}%` : '-'}
            </div>
            <span className="text-[11px] text-slate-400 font-medium mt-0.5 block">
              {isConnected ? 'Nominal (~14h life)' : 'Device disconnected'}
            </span>
          </div>

          {/* Signal Quality */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
              <Wifi className="w-4 h-4 text-cyan-400" />
              Signal Quality
            </span>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {isConnected ? `${deviceStatus.signalQuality}%` : '-'}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              {isConnected ? 'Lead II SQI Optimal' : 'Sensor not connected'}
            </span>
          </div>

          {/* Sample Rate */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-indigo-400" />
              ADC Sample Rate
            </span>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {isConnected ? `${deviceStatus.sampleRateHz} Hz` : '-'}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              {isConnected ? '12-bit ADC quantization' : 'Idle'}
            </span>
          </div>

          {/* Last Sync */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4 text-amber-400" />
              Last Packet Sync
            </span>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {isConnected ? 'Live' : '-'}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              {isConnected ? 'Sub-16ms latency' : 'Standby'}
            </span>
          </div>
        </div>
      </div>

      {/* Interface Connection Mode Selector (Pluggable Ingestion Strategy) */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
        <div className="mb-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-500" />
            <span>Telemetry Transport Pipeline</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Switch effortlessly between mock simulation, direct USB Web Serial, or local Wi-Fi WebSocket streaming
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Mode 1: Simulated Engine */}
          <div
            onClick={() => handleModeChange('mock')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              deviceStatus.connectionMode === 'mock'
                ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                <Sparkles className="w-5 h-5" />
              </div>
              {deviceStatus.connectionMode === 'mock' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                  Active
                </span>
              )}
            </div>

            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Mock Simulation Engine
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Generates mathematically realistic P-QRS-T waveforms, physiological heart rate variations, and test arrhythmia conditions.
            </p>
          </div>

          {/* Mode 2: Wired Web Serial API */}
          <div
            onClick={() => handleModeChange('serial')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              deviceStatus.connectionMode === 'serial'
                ? 'border-cyan-500 ring-2 ring-cyan-500/20 bg-cyan-500/5 dark:bg-cyan-500/10'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-500">
                <Usb className="w-5 h-5" />
              </div>
              {deviceStatus.connectionMode === 'serial' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500 text-white">
                  Active
                </span>
              )}
            </div>

            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Wired USB (Web Serial API)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Connects directly to the ESP32 USB controller port via the browser’s native Serial API at 115,200 baud. Zero server required.
            </p>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Baud: 115200</span>
              <span className="text-cyan-500 font-semibold">Connect USB Port →</span>
            </div>
          </div>

          {/* Mode 3: Wireless WebSockets */}
          <div
            onClick={() => handleModeChange('websocket')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              deviceStatus.connectionMode === 'websocket'
                ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-500/10'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500">
                <Wifi className="w-5 h-5" />
              </div>
              {deviceStatus.connectionMode === 'websocket' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500 text-white">
                  Active
                </span>
              )}
            </div>

            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Wireless Wi-Fi (WebSocket)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Streams packets wirelessly from the ESP32 Access Point (AP) or local LAN via high-speed WebSocket socket interface.
            </p>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-mono">{espIp}</span>
              <span className="text-indigo-500 font-semibold">Connect Socket →</span>
            </div>
          </div>
        </div>
      </div>

      <MedicalDisclaimer />
    </div>
  );
};
