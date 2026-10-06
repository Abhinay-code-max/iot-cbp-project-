import React from 'react';
import { useHealth } from '../context/HealthContext';
import { healthDataService } from '../services/healthDataService';
import { VitalCard } from '../components/vitals/VitalCard';
import { MedicalDisclaimer } from '../components/common/MedicalDisclaimer';
import { VitalReading } from '../types';
import { HeartPulse, CheckCircle2, Layers, Info } from 'lucide-react';

export const VitalsPage: React.FC = () => {
  const { currentBpm, deviceStatus } = useHealth();
  const isConnected = deviceStatus.connectionState === 'connected';

  const vitals = healthDataService.getVitalsList(currentBpm, deviceStatus.signalQuality, isConnected);

  const supportedVitals = vitals.filter((v: VitalReading) => v.isSupportedByDevice);
  const futureVitals = vitals.filter((v: VitalReading) => !v.isSupportedByDevice);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
          <HeartPulse className="w-6 h-6 text-emerald-500" />
          <span>Biometrics & Clinical Vitals</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Active telemetry channels streamed from the IoT AD8232 ECG hardware module
        </p>
      </div>

      {/* Hardware Architectural Integrity Notice */}
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-3">
        <Info className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-900 dark:text-white">
            Sensor Transparency Guarantee:
          </span>
          <p className="mt-0.5 leading-relaxed text-slate-500 dark:text-slate-400">
            This system streams authentic electrical cardiac potentials. Extra biometric channels (SpO2, Blood Pressure, Temperature) are explicitly displayed as <span className="font-semibold text-slate-700 dark:text-slate-200">Sensor not connected</span> until their dedicated auxiliary hardware interfaces are plugged into the ESP32.
          </p>
        </div>
      </div>

      {/* Section 1: Active Supported Vitals */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Active ECG Telemetry Channels</span>
          </h3>
          <span className="text-xs font-mono text-emerald-500 font-medium">4 Channels Operational</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {supportedVitals.map((v: VitalReading) => (
            <VitalCard key={v.id} vital={v} />
          ))}
        </div>
      </div>

      {/* Section 2: Future Sensor Modules (Explicitly Disconnected) */}
      <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" />
              <span>Modular Auxiliary Sensors</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Reserved for future peripheral expansion over I2C / UART / SPI
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">Status: Disconnected</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {futureVitals.map((v: VitalReading) => (
            <VitalCard key={v.id} vital={v} />
          ))}
        </div>
      </div>

      <MedicalDisclaimer />
    </div>
  );
};
