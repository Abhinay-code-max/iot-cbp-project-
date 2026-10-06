/*
  ESP32 + AD8232 Rule-Based Arrhythmia Detector
  ------------------------------------------------
  Hardware:
    AD8232 OUTPUT -> ESP32 GPIO34 (ADC1, input-only, safe with WiFi)
    AD8232 LO+    -> ESP32 GPIO32
    AD8232 LO-    -> ESP32 GPIO33
    AD8232 3.3V   -> ESP32 3.3V
    AD8232 GND    -> ESP32 GND

  Pipeline:
    1. Sample ECG at 250 Hz via hardware timer ISR (jitter-free)
    2. Bandpass filter (simple IIR high-pass + low-pass) to remove
       baseline wander and high-frequency noise
    3. Derivative + squaring + moving-window integration (Pan-Tompkins style)
    4. Adaptive threshold R-peak detection
    5. RR interval logging -> heart rate + rhythm classification

  This is a hobby/educational implementation, NOT a medical device.

  ---------------------------------------------------------------
  PLOT_MODE:
    1 = outputs pure numeric CSV (ecg,mwi,threshold) every sample,
        for use with Tools -> Serial Plotter. No text messages,
        since Serial Plotter can't parse them.
        - "ecg" is the filtered signal - this is the line that will
          actually look like a heartbeat (a P-QRS-T-ish shape),
          since it's close to the real waveform.
        - "mwi"/"threshold" are the internal detection signals
          (spiky, not heartbeat-shaped) - useful for tuning, not
          for "seeing your heartbeat".
    0 = outputs full text (R-peak detections, HR, rhythm
        classification) for use with Tools -> Serial Monitor.
        Use this for the actual detection/classification.
  Change the value below, re-upload, and switch the matching
  tool in Arduino IDE. You can't usefully view both at once.
  ---------------------------------------------------------------
*/
#define PLOT_MODE 0

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>

// ---------------- Pin definitions ----------------
#define ECG_PIN     34   // ADC1 channel, input-only
#define LO_PLUS     32
#define LO_MINUS    33
#define ALERT_LED   2    // onboard LED on many ESP32 dev boards

// ---------------- WiFi hotspot + web server ----------------
// Runs alongside the detection pipeline; doesn't touch the filtering/
// detection logic. server.handleClient() is called every loop()
// iteration (see loop() below) - see the note there on concurrency
// with the 250Hz sampling ISR.
const char* AP_SSID = "ECG-Monitor";
const char* AP_PASSWORD = "heartbeat123"; // WPA2 min length is 8 chars

WebServer server(80);

// Live values exposed via /api/data. Updated by classifyRhythm() each
// time it computes a new medianBPM (i.e. roughly once per detected beat,
// once enough RR history has accumulated) and by loop()'s leads-off check -
// both running on Core 1 (the default Arduino loop core). Read/written by
// the web server task below, which runs pinned to Core 0 (see
// serverTask()), so this block is now a genuine cross-core shared-data
// race and must go through dataMux on both sides. currentStatus is a
// fixed char buffer rather than a String specifically so a critical
// section never needs to cover a String reassignment (potential heap
// realloc) - keeping critical sections short is important since they
// disable interrupts on both cores while held.
portMUX_TYPE dataMux = portMUX_INITIALIZER_UNLOCKED;
float lastMedianBpm = 0;
float bpmSum = 0;
unsigned long bpmSampleCount = 0;
float maxBpmSinceReset = 0;
char currentStatus[64] = "Normal";
bool leadsOffNow = false;
// Incremented once per confirmed beat inside registerRPeak() - lets the
// dashboard detect "a new beat happened" between polls (for a per-beat
// pulse animation) without relying on medianBPM, which only updates once
// rrHistoryFilled >= 4 and lags several beats behind the actual R-peaks.
volatile unsigned long beatCount = 0;

void handleApiData() {
  server.client().setNoDelay(true); // see note on handleRoot() below
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");

  // Snapshot everything under the lock, then build the JSON string
  // outside it - String concatenation can heap-allocate, which shouldn't
  // happen while a critical section (interrupts disabled) is held.
  float bpm, avgBpmDenomSum, maxBpm;
  unsigned long sampleCount_;
  unsigned long beatCount_;
  char statusCopy[sizeof(currentStatus)];
  bool leadsOff;
  portENTER_CRITICAL(&dataMux);
  bpm = lastMedianBpm;
  avgBpmDenomSum = bpmSum;
  sampleCount_ = bpmSampleCount;
  maxBpm = maxBpmSinceReset;
  memcpy(statusCopy, currentStatus, sizeof(currentStatus));
  leadsOff = leadsOffNow;
  beatCount_ = beatCount;
  portEXIT_CRITICAL(&dataMux);

  String json = "{";
  json += "\"bpm\":" + String(bpm, 1) + ",";
  json += "\"avgBpm\":" + String(sampleCount_ > 0 ? avgBpmDenomSum / sampleCount_ : 0.0f, 1) + ",";
  json += "\"maxBpm\":" + String(maxBpm, 1) + ",";
  json += "\"status\":\"" + String(statusCopy) + "\",";
  json += "\"leadsOff\":";
  json += leadsOff ? "true" : "false";
  json += ",\"beatCount\":" + String(beatCount_);
  json += "}";
  server.send(200, "application/json", json);
}

void handleApiReset() {
  server.client().setNoDelay(true);
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");
  portENTER_CRITICAL(&dataMux);
  bpmSum = 0;
  bpmSampleCount = 0;
  maxBpmSinceReset = 0;
  portEXIT_CRITICAL(&dataMux);
  server.send(200, "application/json", "{\"status\":\"reset\"}");
}

// Self-contained dashboard: no CDN/external assets (the AP has no
// internet access) - plain HTML/CSS/vanilla JS, chart drawn on canvas.
// Stored in flash (PROGMEM); served via send_P so it's never copied
// into RAM.
#include "dashboard_html.h"

void handleRoot() {
  // Without this, ESP32's WebServer combines with TCP delayed-ACK and
  // Nagle's algorithm to add multi-second stalls per response, even for
  // small pages - a well-known ESP32 WebServer gotcha. Disabling Nagle
  // on the response socket fixes it.
  server.client().setNoDelay(true);
  server.send_P(200, "text/html", INDEX_HTML);
}

// ---------------- Sampling config ----------------
const int SAMPLE_RATE_HZ   = 250;
const int SAMPLE_PERIOD_US = 1000000 / SAMPLE_RATE_HZ;

hw_timer_t *timer = NULL;
portMUX_TYPE timerMux = portMUX_INITIALIZER_UNLOCKED;

volatile bool sampleReady = false;
volatile int  rawSample   = 0;

// ---------------- Filter state ----------------
// Simple high-pass (removes baseline wander, ~0.5Hz cutoff)
float hp_prevInput = 0, hp_prevOutput = 0;
const float HP_ALPHA = 0.995; // closer to 1 = lower cutoff

// Simple low-pass (removes high-freq noise, ~40Hz cutoff)
float lp_prevOutput = 0;
const float LP_ALPHA = 0.3; // closer to 1 = higher cutoff passed

// Derivative
float derivPrev1 = 0, derivPrev2 = 0;

// Moving window integrator
const int MWI_WINDOW = 15; // ~60ms window at 250Hz
float mwiBuffer[MWI_WINDOW] = {0};
int mwiIndex = 0;
float mwiSum = 0;

// Raw (unsquared) derivative over the same window, used for T-wave
// discrimination below - gives a causally-available "how steep was this
// candidate" measure without needing to look ahead of the current sample.
float derivBuffer[MWI_WINDOW] = {0};

// T-wave discrimination (Pan-Tompkins style): a candidate peak landing
// 200-360ms after the last confirmed R-peak could be a T-wave rather than
// a new QRS. Reject it as a T-wave unless its rate of rise is at least
// half the last confirmed R-peak's rate of rise.
const unsigned long TWAVE_ZONE_MIN_MS = 200;
const unsigned long TWAVE_ZONE_MAX_MS = 360;
const float TWAVE_SLOPE_RATIO_MIN = 0.5f;
float lastConfirmedSlope = 0;

// ---------------- Peak detection (canonical Pan-Tompkins) ----------------
// SPKI/NPKI: running signal-peak / noise-peak estimates.
// THRESHOLD1 = NPKI + 0.25*(SPKI-NPKI); THRESHOLD2 (= 0.5*THRESHOLD1) is
// computed inline where used (search-back only).
float signalThreshold = 0; // THRESHOLD1
float SPKI = 0;
float NPKI = 0;
bool  aboveThreshold = false;

// A peak is only classified once its excursion above THRESHOLD1 ends,
// using the excursion's true local maximum - NOT the value at the instant
// of crossing. (Using the crossing-instant value here previously caused
// an unstable feedback loop: a smaller captured value lowers SPKI, which
// lowers THRESHOLD1, which makes the next crossing happen even earlier
// and capture an even smaller value - collapsing the threshold toward
// the noise floor within ~90 seconds. Verified in the Python validation.)
float excursionPeakMwi = 0;
unsigned long excursionPeakTime = 0;
float excursionPeakSlope = 0;

unsigned long lastPeakTime = 0;
unsigned long sampleCount = 0;

// Search-back: if no beat is confirmed within SEARCHBACK_RR_MULTIPLIER x
// the current average RR, re-examine that gap using THRESHOLD2 to recover
// a likely missed beat. Needs a short rolling history of (time, mwi,
// slope) to re-examine - a fixed-size circular buffer works cleanly here
// since sampling is a fixed 250Hz, so HISTORY_CAPACITY samples always
// represents exactly the last HISTORY_CAPACITY/SAMPLE_RATE_HZ seconds.
const float SEARCHBACK_RR_MULTIPLIER = 1.66f;
const int HISTORY_CAPACITY = SAMPLE_RATE_HZ * 4; // 4 sec of history
unsigned long historyTime[HISTORY_CAPACITY];
float historyMwi[HISTORY_CAPACITY];
float historySlope[HISTORY_CAPACITY];
int historyHead = 0;
int historyCount = 0;
bool searchbackAttempted = false;

// Called on leads-off: clears every piece of state that's a function of
// recent SAMPLE VALUES (filter recursion memory, the derivative/MWI
// buffers, the in-progress excursion, and the search-back history ring),
// since those are contaminated by whatever the ADC read while the
// electrodes were open (typically a rail-to-rail floating input, not
// actual NaN/Inf - the filters are bounded-input-bounded-output IIRs
// operating on a 0-4095 ADC range, so they can't literally diverge - but
// left alone this stale/garbage state causes a spurious detection or
// filter-settling transient right after reconnection). Deliberately does
// NOT reset SPKI/NPKI/signalThreshold/avgPeakAmplitude/avgRR - those are
// slow-moving calibration state, not raw-sample state, and stay valid
// across a brief disconnect (this part of the design was already correct;
// see the note this replaces in loop()).
void resetFilterState() {
  hp_prevInput = 0;
  hp_prevOutput = 0;
  lp_prevOutput = 0;
  derivPrev1 = 0;
  derivPrev2 = 0;
  for (int i = 0; i < MWI_WINDOW; i++) {
    mwiBuffer[i] = 0;
    derivBuffer[i] = 0;
  }
  mwiIndex = 0;
  mwiSum = 0;
  aboveThreshold = false;
  excursionPeakMwi = 0;
  excursionPeakTime = 0;
  excursionPeakSlope = 0;
  historyHead = 0;
  historyCount = 0;
  searchbackAttempted = false;
}

// Running average of accepted peak amplitudes, used to reject
// spurious noise spikes that are much smaller/larger than recent
// genuine beats (motion artifact rejection)
float avgPeakAmplitude = 0;
bool  avgPeakInitialized = false;

// Running average RR interval, used to flag (not reject) beats
// whose timing is very inconsistent with the recent rhythm
float avgRR = 0;
bool  avgRRInitialized = false;

// ---------------- RR interval / rhythm ----------------
const int RR_HISTORY_LEN = 8;
unsigned long rrHistory[RR_HISTORY_LEN];
int rrHistoryIndex = 0;
int rrHistoryFilled = 0;

float currentBPM = 0;

// ---------------- Timer ISR ----------------
// Direct dropped-sample counter: incremented whenever the ISR is about to
// overwrite rawSample/sampleReady before loop() has consumed the previous
// one. This is a real measurement, independent of any noise theory - if
// loop() (e.g. inside server.handleClient()) ever runs longer than one
// 4ms sample period, the sample that arrived during that stall is lost
// here rather than queued.
volatile unsigned long droppedSampleCount = 0;

void IRAM_ATTR onTimer() {
  portENTER_CRITICAL_ISR(&timerMux);
  if (sampleReady) {
    droppedSampleCount++;
  }
  rawSample = analogRead(ECG_PIN);
  sampleReady = true;
  portEXIT_CRITICAL_ISR(&timerMux);
}

// Runs pinned to Core 0, separate from loop()'s sample-draining work on
// Core 1, so a slow/stalled HTTP client can no longer delay sample
// consumption (that contention is exactly what droppedSampleCount was
// added to measure). server.handleClient() is already non-blocking when
// idle; the 1-tick delay just yields to the scheduler between polls
// instead of spinning.
void serverTask(void *pvParameters) {
  for (;;) {
    server.handleClient();
    vTaskDelay(1);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LO_PLUS, INPUT);
  pinMode(LO_MINUS, INPUT);
  pinMode(ALERT_LED, OUTPUT);
  analogReadResolution(12); // 0-4095

  // Bring up the WiFi hotspot before starting the sampling timer, so its
  // (comparatively slow, ~100s of ms) bring-up doesn't overlap with the
  // ISR already firing.
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  WiFi.setSleep(false); // WiFi modem sleep is another common source of
                        // multi-hundred-ms latency on ESP32; not needed
                        // here since we're mains/USB powered, not battery.
  IPAddress apIP = WiFi.softAPIP();
#if !PLOT_MODE
  Serial.print("WiFi AP started. SSID: ");
  Serial.print(AP_SSID);
  Serial.print("  IP: ");
  Serial.println(apIP);
#endif

  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/data", HTTP_GET, handleApiData);
  server.on("/api/data", HTTP_OPTIONS, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "*");
    server.send(204);
  });
  server.on("/api/reset", HTTP_GET, handleApiReset);
  server.on("/api/reset", HTTP_OPTIONS, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "*");
    server.send(204);
  });
  server.begin();

  // Pinned to Core 0 - see serverTask()'s comment. Started before the
  // sampling timer for the same reason WiFi.softAP() is brought up
  // first: keep slow one-time bring-up work off the sampling-critical
  // path's start.
  xTaskCreatePinnedToCore(serverTask, "WebServerTask", 8192, NULL, 1, NULL, 0);

  timer = timerBegin(1000000);                // 1MHz tick (1 tick = 1us)
  timerAttachInterrupt(timer, &onTimer);
  timerAlarm(timer, SAMPLE_PERIOD_US, true, 0); // auto-reload, repeat forever

#if !PLOT_MODE
  Serial.println("ESP32 Arrhythmia Detector Starting...");
#endif
  delay(1000);
}

unsigned long lastDropReportMs = 0;
unsigned long lastReportedDropCount = 0;

void loop() {
  // server.handleClient() used to be serviced here every loop() iteration.
  // It now runs in serverTask(), pinned to Core 0 (see setup()), so this
  // loop is free to drain sampleReady at full speed without WiFi/HTTP
  // request handling competing for Core 1 time - see droppedSampleCount's
  // comment for why that contention mattered.

  // Report dropped-sample count once per second. Runs unconditionally
  // (not gated on sampleReady) so it keeps reporting even during a long
  // stall. Gated out of PLOT_MODE so it doesn't corrupt the numeric CSV
  // stream the Serial Plotter expects.
  unsigned long nowMsForDrops = millis();
  if (nowMsForDrops - lastDropReportMs >= 1000) {
    lastDropReportMs = nowMsForDrops;
    unsigned long currentDropCount;
    portENTER_CRITICAL(&timerMux);
    currentDropCount = droppedSampleCount;
    portEXIT_CRITICAL(&timerMux);
    unsigned long delta = currentDropCount - lastReportedDropCount;
    lastReportedDropCount = currentDropCount;
#if !PLOT_MODE
    Serial.print("DroppedSamples: ");
    Serial.println(delta);
#endif
  }

  if (!sampleReady) return;

  int sample;
  portENTER_CRITICAL(&timerMux);
  sample = rawSample;
  sampleReady = false;
  portEXIT_CRITICAL(&timerMux);

  sampleCount++;

  // Leads-off detection
  if (digitalRead(LO_PLUS) == 1 || digitalRead(LO_MINUS) == 1) {
#if !PLOT_MODE
    Serial.println("Leads off! Check electrode contact.");
#endif
    digitalWrite(ALERT_LED, LOW);
    portENTER_CRITICAL(&dataMux);
    leadsOffNow = true;
    portEXIT_CRITICAL(&dataMux);
    // Reset all raw-sample-derived state (filters, MWI, excursion,
    // search-back ring) via resetFilterState() - see its comment.
    // SPKI/NPKI/thresholds/avgPeakAmplitude/avgRR are left alone; that
    // calibration is still valid after a brief disconnect.
    // lastPeakTime=0 is the sketch's existing "no prior beat" sentinel
    // (see registerRPeak()), so the next confirmed peak after
    // reconnection is automatically treated like the very first beat:
    // its timestamp is recorded but no RR is computed against the
    // stale pre-disconnect timestamp.
    resetFilterState();
    lastPeakTime = 0;
    return;
  }
  portENTER_CRITICAL(&dataMux);
  leadsOffNow = false;
  portEXIT_CRITICAL(&dataMux);

  processSample(sample);
}

// ---------------- Signal processing ----------------
void processSample(int raw) {
  float x = (float)raw;

  // 1. High-pass filter (baseline wander removal)
  float hp_out = HP_ALPHA * (hp_prevOutput + x - hp_prevInput);
  hp_prevInput = x;
  hp_prevOutput = hp_out;

  // 2. Low-pass filter (noise smoothing)
  float lp_out = LP_ALPHA * hp_out + (1 - LP_ALPHA) * lp_prevOutput;
  lp_prevOutput = lp_out;

  // 3. Derivative
  float deriv = (lp_out - derivPrev1) / 2.0;
  derivPrev2 = derivPrev1;
  derivPrev1 = lp_out;

  // 4. Squaring
  float squared = deriv * deriv;

  // 5. Moving window integration
  mwiSum -= mwiBuffer[mwiIndex];
  mwiBuffer[mwiIndex] = squared;
  mwiSum += squared;
  derivBuffer[mwiIndex] = deriv;
  mwiIndex = (mwiIndex + 1) % MWI_WINDOW;
  float mwi = mwiSum / MWI_WINDOW;

  // Peak rate-of-rise within the same window that produced this mwi
  // value - the candidate's "slope" for T-wave discrimination.
  float candidateSlope = 0;
  for (int k = 0; k < MWI_WINDOW; k++) {
    float a = fabs(derivBuffer[k]);
    if (a > candidateSlope) candidateSlope = a;
  }

  unsigned long now = millis();

  // Push into the search-back history buffer (fixed 4s ring @ 250Hz).
  historyTime[historyHead] = now;
  historyMwi[historyHead] = mwi;
  historySlope[historyHead] = candidateSlope;
  historyHead = (historyHead + 1) % HISTORY_CAPACITY;
  if (historyCount < HISTORY_CAPACITY) historyCount++;

#if PLOT_MODE
  Serial.print(lp_out, 1);
  Serial.print(",");
  Serial.print(mwi, 1);
  Serial.print(",");
  Serial.println(signalThreshold, 1);
#endif

  detectPeak(mwi, candidateSlope, now);
}

void detectPeak(float mwi, float candidateSlope, unsigned long now) {
  // Initialize thresholds during first couple seconds
  static bool initialized = false;
  static unsigned long initSamples = 0;

  if (!initialized) {
    SPKI = max(SPKI, mwi);
    NPKI = (NPKI * 0.99f) + (mwi * 0.01f);
    initSamples++;
    if (initSamples > SAMPLE_RATE_HZ * 2) { // ~2 sec warmup
      signalThreshold = NPKI + 0.25f * (SPKI - NPKI);
      initialized = true;
#if !PLOT_MODE
      Serial.println("Calibration done. Monitoring started.");
#endif
    }
    return;
  }

  if (mwi > signalThreshold) {
    if (!aboveThreshold) {
      // Rising edge: start tracking this excursion's local maximum.
      aboveThreshold = true;
      excursionPeakMwi = mwi;
      excursionPeakTime = now;
      excursionPeakSlope = candidateSlope;
    } else if (mwi > excursionPeakMwi) {
      excursionPeakMwi = mwi;
      excursionPeakTime = now;
      excursionPeakSlope = candidateSlope;
    }
  } else {
    if (aboveThreshold) {
      // Excursion just ended: classify using its TRUE peak.
      classifyCandidate(excursionPeakMwi, excursionPeakSlope, excursionPeakTime, false);
      aboveThreshold = false;
    }
    NPKI = 0.125f * mwi + 0.875f * NPKI;
  }

  // Adapt THRESHOLD1 continuously
  signalThreshold = NPKI + 0.25f * (SPKI - NPKI);

  // Search-back: gap since the last confirmed beat has exceeded
  // 1.66x the average RR without a new beat - try to recover one.
  if (avgRRInitialized && lastPeakTime != 0 && !searchbackAttempted) {
    unsigned long gap = now - lastPeakTime;
    if ((float)gap > SEARCHBACK_RR_MULTIPLIER * avgRR) {
      doSearchback(now);
      searchbackAttempted = true;
    }
  }
}

void doSearchback(unsigned long now) {
  float threshold2 = 0.5f * signalThreshold;
  bool found = false;
  unsigned long bestTime = 0;
  float bestMwi = 0;
  float bestSlope = 0;

  // Walk backward through the history ring from most recent to oldest,
  // stopping as soon as we reach entries at/before the last confirmed
  // beat (everything older than that isn't part of this gap).
  for (int k = 0; k < historyCount; k++) {
    int idx = (historyHead - 1 - k + HISTORY_CAPACITY * 2) % HISTORY_CAPACITY;
    unsigned long t = historyTime[idx];
    if (t <= lastPeakTime) break;
    float m = historyMwi[idx];
    if (m > threshold2 && (!found || m > bestMwi)) {
      found = true;
      bestMwi = m;
      bestTime = t;
      bestSlope = historySlope[idx];
    }
  }

  if (found) {
    classifyCandidate(bestMwi, bestSlope, bestTime, true);
  }
}

// peakMwi/peakSlope/peakTime: the candidate's true local-maximum mwi,
// its slope at that sample, and when it occurred. viaSearchback: true
// when this candidate came from doSearchback() rather than the normal
// rising/falling-edge excursion path.
void classifyCandidate(float peakMwi, float peakSlope, unsigned long peakTime, bool viaSearchback) {
  // Adaptive refractory period: fixed 300ms floor, but never less
  // than ~40% of the recent average RR - prevents double-counting
  // on people with naturally fast heart rates, while still
  // rejecting fast noise bursts on people with slower rates
  unsigned long refractory = 300;
  if (avgRRInitialized) {
    unsigned long adaptive = (unsigned long)(avgRR * 0.4f);
    if (adaptive > refractory) refractory = adaptive;
  }

  if (lastPeakTime != 0 && (peakTime - lastPeakTime) <= refractory) {
    return;
  }

  // Amplitude quality check: reject peaks wildly different in
  // size from the recent average genuine beat (motion artifact
  // spikes tend to be much taller or much shorter)
  bool amplitudeOk = true;
  if (avgPeakInitialized) {
    float ratio = peakMwi / avgPeakAmplitude;
    if (ratio < 0.2f || ratio > 5.0f) amplitudeOk = false;
  }

  // T-wave discrimination: a candidate landing 200-360ms after the
  // last confirmed R-peak could be a T-wave. Only accept it as a new
  // beat if its slope is at least half the last confirmed R-peak's.
  // Not applied to search-back recoveries - they're far from the last
  // confirmed peak by construction (that's why search-back triggered).
  bool tWaveSuspect = false;
  if (!viaSearchback && lastPeakTime != 0) {
    unsigned long sinceLastPeak = peakTime - lastPeakTime;
    if (sinceLastPeak >= TWAVE_ZONE_MIN_MS && sinceLastPeak <= TWAVE_ZONE_MAX_MS) {
      if (peakSlope < TWAVE_SLOPE_RATIO_MIN * lastConfirmedSlope) {
        tWaveSuspect = true;
      }
    }
  }

  // SPKI update: canonical Pan-Tompkins uses a faster-adapting weight
  // for search-back recoveries (0.25/0.75) vs. normal detections
  // (0.125/0.875).
  if (viaSearchback) {
    SPKI = 0.25f * peakMwi + 0.75f * SPKI;
  } else {
    SPKI = 0.125f * peakMwi + 0.875f * SPKI;
  }

  if (amplitudeOk && !tWaveSuspect) {
    if (!avgPeakInitialized) {
      avgPeakAmplitude = peakMwi;
      avgPeakInitialized = true;
    } else {
      avgPeakAmplitude = 0.2f * peakMwi + 0.8f * avgPeakAmplitude;
    }
    lastConfirmedSlope = peakSlope;
    registerRPeak(peakTime, viaSearchback);
    searchbackAttempted = false;
  }
}

void registerRPeak(unsigned long now, bool viaSearchback) {
  if (lastPeakTime == 0) {
    lastPeakTime = now;
    portENTER_CRITICAL(&dataMux);
    beatCount++;
    portEXIT_CRITICAL(&dataMux);
    return;
  }

  unsigned long rr = now - lastPeakTime;
  lastPeakTime = now;

  // Reject physiologically implausible RR intervals for a resting
  // adult (roughly 40-150 bpm range). Tighter than before to reject
  // more motion-artifact spikes; widen if you expect vigorous exercise.
  // Search-back recoveries bypass this - a gap exceeding the normal RR
  // bounds is exactly why search-back exists.
  if (!viaSearchback && (rr < 400 || rr > 1500)) return;

  // Every rejection check (amplitude/T-wave in classifyCandidate, the
  // refractory period, and the RR-plausibility check just above) has now
  // passed - this is a confirmed beat.
  portENTER_CRITICAL(&dataMux);
  beatCount++;
  portEXIT_CRITICAL(&dataMux);

  if (!avgRRInitialized) {
    avgRR = rr;
    avgRRInitialized = true;
  } else {
    avgRR = 0.25f * rr + 0.75f * avgRR; // smoothed running average
  }

  rrHistory[rrHistoryIndex] = rr;
  rrHistoryIndex = (rrHistoryIndex + 1) % RR_HISTORY_LEN;
  if (rrHistoryFilled < RR_HISTORY_LEN) rrHistoryFilled++;

  currentBPM = 60000.0f / rr;

#if !PLOT_MODE
  Serial.print("R-peak detected | RR: ");
  Serial.print(rr);
  Serial.print(" ms | HR: ");
  Serial.print(currentBPM, 1);
  Serial.println(" bpm");
#endif

  if (rrHistoryFilled >= 4) {
    classifyRhythm();
  }
}

// ---------------- Rhythm classification ----------------
void classifyRhythm() {
  // Sort a copy of RR history to get the median - far less sensitive
  // to one stray noise-driven RR value than the mean is.
  unsigned long sorted[RR_HISTORY_LEN];
  for (int i = 0; i < rrHistoryFilled; i++) sorted[i] = rrHistory[i];
  for (int i = 1; i < rrHistoryFilled; i++) {
    unsigned long key = sorted[i];
    int j = i - 1;
    while (j >= 0 && sorted[j] > key) { sorted[j + 1] = sorted[j]; j--; }
    sorted[j + 1] = key;
  }
  float medianRR = sorted[rrHistoryFilled / 2];

  float sum = 0;
  for (int i = 0; i < rrHistoryFilled; i++) sum += rrHistory[i];
  float meanRR = sum / rrHistoryFilled;

  float sqDiffSum = 0;
  for (int i = 0; i < rrHistoryFilled; i++) {
    float diff = rrHistory[i] - meanRR;
    sqDiffSum += diff * diff;
  }
  float sdnn = sqrt(sqDiffSum / rrHistoryFilled); // RR variability (ms) - kept
                                                   // for the Serial log format
                                                   // (analyze_ab_logs.py parses
                                                   // it); no longer drives the
                                                   // Irregular-rhythm decision
                                                   // below, see MAD.

  // Median absolute deviation (MAD): median(|rr_i - median(rr)|). Used
  // instead of population SDNN to decide "Irregular rhythm" - validated
  // in validation/variability_metric_test.py against real MIT-BIH AFib-
  // labeled data: at this threshold, MAD nearly matches population SDNN's
  // AFib sensitivity (30.9% -> 32.4%) while roughly halving its false-
  // positive rate on real normal-sinus data (16.3% -> 8.8%). SDNN is
  // dominated by a single outlier RR (e.g. one ectopic beat's compensatory
  // pause); MAD only responds strongly when most of the window's values
  // are elevated, matching "sustained irregularity" rather than "one bad
  // beat". Uses its own true-median calculation (average of the two
  // middle sorted values when rrHistoryFilled is even) to exactly match
  // Python's statistics.median() as validated - deliberately not reusing
  // medianRR above, which uses the coarser sorted[filled/2] for
  // medianBPM/pause-detection and is unrelated to this port.
  float trueMedianRR;
  if (rrHistoryFilled % 2 == 0) {
    trueMedianRR = (sorted[rrHistoryFilled / 2 - 1] + sorted[rrHistoryFilled / 2]) / 2.0f;
  } else {
    trueMedianRR = sorted[rrHistoryFilled / 2];
  }
  float deviations[RR_HISTORY_LEN];
  for (int i = 0; i < rrHistoryFilled; i++) {
    deviations[i] = fabs((float)rrHistory[i] - trueMedianRR);
  }
  for (int i = 1; i < rrHistoryFilled; i++) {
    float key = deviations[i];
    int j = i - 1;
    while (j >= 0 && deviations[j] > key) { deviations[j + 1] = deviations[j]; j--; }
    deviations[j + 1] = key;
  }
  float mad;
  if (rrHistoryFilled % 2 == 0) {
    mad = (deviations[rrHistoryFilled / 2 - 1] + deviations[rrHistoryFilled / 2]) / 2.0f;
  } else {
    mad = deviations[rrHistoryFilled / 2];
  }

  float medianBPM = 60000.0f / medianRR;

  bool alert = false;
  String status = "Normal";

  if (medianBPM > 100) {
    status = "Tachycardia (HR > 100 bpm)";
    alert = true;
  } else if (medianBPM < 60) {
    status = "Bradycardia (HR < 60 bpm)";
    alert = true;
  } else if (mad > 90.0f) {
    // Sustained (not single-outlier-driven) RR variability -> irregular
    // rhythm, e.g. possible AFib
    status = "Irregular rhythm (high RR variability, possible AFib)";
    alert = true;
  }

  // Detect a single abnormally long RR interval (possible pause/dropped beat)
  int lastIdx = (rrHistoryIndex - 1 + RR_HISTORY_LEN) % RR_HISTORY_LEN;
  if (rrHistory[lastIdx] > medianRR * 1.6f) {
    status = "Possible pause / dropped beat";
    alert = true;
  }

  // Update values exposed via /api/data. status.c_str() is only read
  // here, before the lock, into a local copy - safe, since status is a
  // local String never touched by the other core.
  char statusCopy[sizeof(currentStatus)];
  strncpy(statusCopy, status.c_str(), sizeof(statusCopy) - 1);
  statusCopy[sizeof(statusCopy) - 1] = '\0';

  portENTER_CRITICAL(&dataMux);
  lastMedianBpm = medianBPM;
  bpmSum += medianBPM;
  bpmSampleCount++;
  if (medianBPM > maxBpmSinceReset) maxBpmSinceReset = medianBPM;
  memcpy(currentStatus, statusCopy, sizeof(currentStatus));
  portEXIT_CRITICAL(&dataMux);

#if !PLOT_MODE
  Serial.print("  -> Median HR: ");
  Serial.print(medianBPM, 1);
  Serial.print(" bpm | SDNN: ");
  Serial.print(sdnn, 1);
  Serial.print(" ms | Status: ");
  Serial.println(status);
#endif

  digitalWrite(ALERT_LED, alert ? HIGH : LOW);
}
