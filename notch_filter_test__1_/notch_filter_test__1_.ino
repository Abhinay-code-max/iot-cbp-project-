/*
  50Hz Notch Filter Test — AD8232 + ESP32
  ------------------------------------------
  Plots RAW and FILTERED signal side by side in Serial Plotter
  so you can see the notch filter removing mains hum in real time.

  Sampling rate: 250 Hz (must match NOTCH_FS below)
  Notch frequency: 50 Hz (change to 60.0 if you're in a 60Hz-mains country)
*/

#define ECG_PIN   34
#define LO_PLUS   32
#define LO_MINUS  33

// ---------------- Notch filter (biquad IIR) design ----------------
const float NOTCH_FS = 250.0;   // sampling rate, must match delay() in loop
const float NOTCH_FREQ = 50.0;  // frequency to remove (Hz)
const float NOTCH_Q = 5.0;      // quality factor - higher = narrower notch

float b0, b1, b2, a1, a2; // filter coefficients

// filter state (previous 2 inputs/outputs)
float fx1 = 0, fx2 = 0, fy1 = 0, fy2 = 0;

void designNotch() {
  float w0 = 2.0 * PI * NOTCH_FREQ / NOTCH_FS;
  float alpha = sin(w0) / (2.0 * NOTCH_Q);
  float cosw0 = cos(w0);

  float a0 = 1 + alpha;
  b0 = 1 / a0;
  b1 = (-2 * cosw0) / a0;
  b2 = 1 / a0;
  a1 = (-2 * cosw0) / a0;
  a2 = (1 - alpha) / a0;
}

float applyNotch(float x0) {
  float y0 = b0 * x0 + b1 * fx1 + b2 * fx2 - a1 * fy1 - a2 * fy2;
  // shift history
  fx2 = fx1; fx1 = x0;
  fy2 = fy1; fy1 = y0;
  return y0;
}

void setup() {
  Serial.begin(115200);
  pinMode(LO_PLUS, INPUT);
  pinMode(LO_MINUS, INPUT);
  designNotch();

  // Serial Plotter legend (first line becomes labels)
  Serial.println("raw,filtered");
}

void loop() {
  if (digitalRead(LO_PLUS) == 1 || digitalRead(LO_MINUS) == 1) {
    Serial.println("0,0");
  } else {
    int raw = analogRead(ECG_PIN);
    float filtered = applyNotch((float)raw);

    Serial.print(raw);
    Serial.print(",");
    Serial.println(filtered);
  }
  delay(4); // 250 samples/sec - keep consistent with NOTCH_FS
}
