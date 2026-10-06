import { RhythmType, ECGReading, RhythmEvent } from '../types';

/**
 * Realistic ECG Waveform Generator
 * Models realistic P-Q-R-S-T complexes using Gaussian/harmonic packets
 * with baseline wander, muscle tremor noise, and physiological arrhythmia patterns.
 */
export class MockECGGenerator {
  private sampleRate = 250; // 250 samples per second
  private phase = 0; // 0 to 1 across cardiac cycle
  private currentBpm = 72;
  private currentRhythm: RhythmType = 'normal';
  private baselineWanderPhase = 0;
  private noiseAmplitude = 0.02; // mV
  private sqi = 98; // %
  private isConnected = true;

  // Arrhythmia timing modifiers
  private irregularJitter = 0;
  private pvcCountdown = 4; // periodic PVC event for simulation

  public setBpm(bpm: number) {
    this.currentBpm = Math.max(35, Math.min(220, bpm));
  }

  public getBpm(): number {
    return this.currentBpm;
  }

  public setRhythm(rhythm: RhythmType) {
    this.currentRhythm = rhythm;
    if (rhythm === 'bradycardia') {
      this.currentBpm = 48;
    } else if (rhythm === 'tachycardia') {
      this.currentBpm = 142;
    } else if (rhythm === 'normal') {
      this.currentBpm = 72;
    } else if (rhythm === 'irregular') {
      this.currentBpm = 86;
    } else if (rhythm === 'possible_arrhythmia') {
      this.currentBpm = 108;
    }
  }

  public getRhythm(): RhythmType {
    return this.currentRhythm;
  }

  public setConnected(connected: boolean) {
    this.isConnected = connected;
    this.sqi = connected ? 98 : 0;
  }

  public getSqi(): number {
    if (!this.isConnected) return 0;
    // Add micro jitter
    return Math.min(100, Math.max(85, this.sqi + (Math.random() * 2 - 1)));
  }

  /**
   * Generates next ECG sample in millivolts
   */
  public getNextSample(): ECGReading {
    const timestamp = Date.now();

    if (!this.isConnected || this.currentRhythm === 'signal_unavailable') {
      // Disconnected / flatline with gentle ambient baseline noise
      const deadVoltage = (Math.random() - 0.5) * 0.03;
      return { timestamp, voltage: deadVoltage, lead: 'Lead II' };
    }

    // Advance cardiac phase
    const cycleDurationSeconds = 60 / this.currentBpm;
    let phaseStep = (1 / this.sampleRate) / cycleDurationSeconds;

    // In irregular rhythm, add random cycle variability (RR variability)
    if (this.currentRhythm === 'irregular') {
      this.irregularJitter = (Math.sin(this.phase * Math.PI * 2) * 0.2 + (Math.random() - 0.5) * 0.15);
      phaseStep *= (1 + this.irregularJitter);
    }

    this.phase += phaseStep;
    if (this.phase >= 1) {
      this.phase -= 1;
      this.pvcCountdown--;
    }

    // Baseline respiratory wander (0.2 Hz)
    this.baselineWanderPhase += (2 * Math.PI * 0.2) / this.sampleRate;
    const baselineWander = Math.sin(this.baselineWanderPhase) * 0.05;

    // High frequency sensor noise
    const noise = (Math.random() - 0.5) * this.noiseAmplitude;

    // Calculate P-Q-R-S-T voltage
    let cardiacVoltage = 0;
    const p = this.phase;

    const isPVC = this.currentRhythm === 'possible_arrhythmia' && this.pvcCountdown <= 0;
    if (isPVC && this.phase > 0.95) {
      this.pvcCountdown = Math.floor(Math.random() * 4) + 3; // reset next PVC in 3-6 beats
    }

    if (isPVC) {
      // Premature Ventricular Contraction: bizarre wide QRS, no P wave, inverted T wave
      if (p >= 0.2 && p < 0.6) {
        // Broad inverted spike followed by high peak
        const qrsPhase = (p - 0.2) / 0.4;
        cardiacVoltage = -0.5 * Math.sin(qrsPhase * Math.PI * 2) + Math.exp(-Math.pow((qrsPhase - 0.5) / 0.15, 2)) * 1.6;
      } else if (p >= 0.6 && p < 0.9) {
        // Deep inverted T-wave
        const tPhase = (p - 0.6) / 0.3;
        cardiacVoltage = -0.35 * Math.sin(tPhase * Math.PI);
      }
    } else {
      // Normal / Tachy / Brady Sinus Pattern

      // P wave (Atrial Depolarization) - occurs around phase 0.12 to 0.22
      // Absent or fibrillatory in irregular / AFib
      if (this.currentRhythm === 'irregular') {
        // Micro fibrillatory waves (f-waves)
        cardiacVoltage += Math.sin(p * 28 * Math.PI) * 0.04;
      } else if (p >= 0.12 && p <= 0.22) {
        const pPhase = (p - 0.17) / 0.05;
        cardiacVoltage += 0.15 * Math.exp(-Math.pow(pPhase * 2.5, 2));
      }

      // Q wave (Septal depolarization) - sharp dip at 0.32
      if (p >= 0.30 && p < 0.34) {
        const qPhase = (p - 0.32) / 0.02;
        cardiacVoltage -= 0.12 * Math.exp(-Math.pow(qPhase * 3, 2));
      }

      // R wave (Ventricular depolarization) - massive sharp peak at 0.37
      if (p >= 0.33 && p <= 0.41) {
        const rPhase = (p - 0.37) / 0.025;
        cardiacVoltage += 1.25 * Math.exp(-Math.pow(rPhase * 2.8, 2));
      }

      // S wave (Ventricular depolarization finish) - sharp negative dip at 0.43
      if (p >= 0.40 && p <= 0.46) {
        const sPhase = (p - 0.43) / 0.02;
        cardiacVoltage -= 0.28 * Math.exp(-Math.pow(sPhase * 3, 2));
      }

      // T wave (Ventricular repolarization) - smooth dome around 0.60 to 0.78
      if (p >= 0.58 && p <= 0.78) {
        const tPhase = (p - 0.68) / 0.09;
        cardiacVoltage += 0.26 * Math.exp(-Math.pow(tPhase * 2.2, 2));
      }
    }

    const totalVoltage = cardiacVoltage + baselineWander + noise;

    return {
      timestamp,
      voltage: Number(totalVoltage.toFixed(3)),
      lead: 'Lead II'
    };
  }

  /**
   * Generates a batch snapshot of ECG waveform (e.g. for event previews or mini sparklines)
   */
  public generateSnapshot(samplesCount: number = 200, rhythm: RhythmType = 'normal'): number[] {
    const backupRhythm = this.currentRhythm;
    const backupPhase = this.phase;
    this.currentRhythm = rhythm;
    this.phase = 0;

    const data: number[] = [];
    for (let i = 0; i < samplesCount; i++) {
      const sample = this.getNextSample();
      data.push(sample.voltage);
    }

    this.currentRhythm = backupRhythm;
    this.phase = backupPhase;
    return data;
  }
}

/**
 * Pre-seeded realistic arrhythmia events for clinical inspection
 */
export const INITIAL_MOCK_EVENTS: RhythmEvent[] = [
  {
    id: 'evt-001',
    timestamp: Date.now() - 1000 * 60 * 18, // 18 mins ago
    heartRate: 114,
    rhythmClassification: 'possible_arrhythmia',
    label: 'Unusual heart rhythm detected',
    severity: 'attention',
    durationSeconds: 4.2,
    monitoringMode: 'normal',
    sqi: 96,
    confidenceScore: 92,
    clinicalNotes: 'Isolated Premature Ventricular Contraction (PVC) with compensatory pause noted. Baseline sinus restored spontaneously.',
    acknowledged: false,
    waveformSnapshot: new MockECGGenerator().generateSnapshot(150, 'possible_arrhythmia')
  },
  {
    id: 'evt-002',
    timestamp: Date.now() - 1000 * 60 * 62, // 1 hr ago
    heartRate: 148,
    rhythmClassification: 'tachycardia',
    label: 'Elevated heart rate during mild exertion',
    severity: 'attention',
    durationSeconds: 38.0,
    monitoringMode: 'sports',
    sqi: 94,
    confidenceScore: 97,
    clinicalNotes: 'Sinus tachycardia corresponding to aerobic running interval. Rhythm remained regular.',
    acknowledged: true,
    waveformSnapshot: new MockECGGenerator().generateSnapshot(150, 'tachycardia')
  },
  {
    id: 'evt-003',
    timestamp: Date.now() - 1000 * 60 * 190, // 3 hrs ago
    heartRate: 49,
    rhythmClassification: 'bradycardia',
    label: 'Low resting heart rate detected',
    severity: 'normal',
    durationSeconds: 120.0,
    monitoringMode: 'normal',
    sqi: 99,
    confidenceScore: 95,
    clinicalNotes: 'Nocturnal/resting sinus bradycardia. Regular P-QRS-T morphology preserved.',
    acknowledged: true,
    waveformSnapshot: new MockECGGenerator().generateSnapshot(150, 'bradycardia')
  },
  {
    id: 'evt-004',
    timestamp: Date.now() - 1000 * 60 * 420, // 7 hrs ago
    heartRate: 98,
    rhythmClassification: 'irregular',
    label: 'Irregular R-R interval pattern detected',
    severity: 'attention',
    durationSeconds: 14.5,
    monitoringMode: 'normal',
    sqi: 91,
    confidenceScore: 89,
    clinicalNotes: 'Mild sinus arrhythmia with irregular R-R intervals. Spontaneously resolved.',
    acknowledged: false,
    waveformSnapshot: new MockECGGenerator().generateSnapshot(150, 'irregular')
  }
];
