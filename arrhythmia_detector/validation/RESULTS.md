# Validation against MIT-BIH Arrhythmia Database

`algorithm.py` reimplements `arrhythmia_detector.ino`'s signal-processing
pipeline (HP filter -> LP filter -> derivative -> squaring -> moving-window
integration -> adaptive-threshold peak detection) sample-for-sample in
Python, including its dead-code quirks (e.g. `noiseThreshold` is computed
but never used, matching the firmware). `evaluate.py` runs it against 4
MIT-BIH records (100, 101, 103, 106), resampled 360Hz -> 250Hz via
`scipy.signal.resample_poly`, and scores detected peaks against the
database's annotated beats using the same +/-150ms matching window as the
ground-truth spacebar feature.

## Baseline (.ino exact constants)

| Record | Ref beats | Detected | Matched | FP | FN | Sens% | FP rate% | FN rate% |
|---|---|---|---|---|---|---|---|---|
| 100 | 2273 | 1437 | 204 | 1233 | 2069 | 9.0 | 85.8 | 91.0 |
| 101 | 1865 | 1410 | 684 | 726 | 1181 | 36.7 | 51.5 | 63.3 |
| 103 | 2084 | 1856 | 1756 | 100 | 328 | 84.3 | 5.4 | 15.7 |
| 106 | 2027 | 191 | 175 | 16 | 1852 | 8.6 | 8.4 | 91.4 |
| **OVERALL** | 8249 | 4894 | 2819 | 2075 | 5430 | **34.2** | **42.4** | **65.8** |

FP rate = false positives / total detected. FN rate = missed beats / total reference beats.

## Root causes found

1. **T-wave misdetection (records 100, 101).** For record 100, 74% of all
   "detections" landed 200-400ms after the preceding true R-peak — the
   classic T-wave timing window, not R-peak jitter. The pipeline's passband
   (~0.5-40Hz) doesn't suppress T-wave energy enough relative to QRS energy
   after squaring, and there's no morphology-based T-wave rejection (unlike
   full Pan-Tompkins). Record 103 showed ~0% of this pattern, and matches
   its much better baseline sensitivity (84.3%) — so this isn't inherent to
   the algorithm's structure, it's inherent to how *aggressively* clean the
   input recording is.
2. **Amplitude-ratio rejection too strict (record 106, PVC-heavy).** Only
   191 of 2027 true beats were detected at all — even accounting for
   T-wave confusion, this is far too low. PVCs commonly have much larger
   QRS amplitude than normal beats on this lead, and the `[0.35, 3.0]`
   ratio-to-average-peak window rejects genuine PVC beats as "noise"
   alongside real artifacts.

## Tuning results

**Recommended fix — widen the amplitude-ratio window from `[0.35, 3.0]` to
`[0.2, 5.0]`.** One constant change (well, two: `AMPLITUDE_RATIO_MIN` and
`AMPLITUDE_RATIO_MAX` in the .ino), helps every record, regresses none:

| Record | Sens% (before -> after) | FP rate% (before -> after) |
|---|---|---|
| 100 | 9.0 -> 19.1 |
| 101 | 36.7 -> 55.4 |
| 103 | 84.3 -> 85.8 |
| 106 | 8.6 -> 63.6 |
| **OVERALL** | **34.2 -> 55.1** | **42.4 -> 30.9** |

**Experimental — also retune the bandpass (`HP_ALPHA` 0.995->0.85,
`LP_ALPHA` 0.3->0.6)** to better suppress T-waves via frequency content
(closer to the ~5-15Hz band real Pan-Tompkins implementations target,
vs. the .ino's current ~0.5-40Hz). This pushes overall sensitivity to
**63.8%** and FP rate down to **21.0%** — but **record 103 regresses from
85.8% to 46.4%** sensitivity. The wider passband that rescues 100/101/106
distorts a signal that was already clean under the original filter. This
is a real bias/variance tradeoff, not a strict improvement, and isn't
adopted as the recommendation below — it needs validation against more
records before trusting it generalizes.

## Firmware changes applied

Both changes below are live in `arrhythmia_detector.ino` (compiled clean,
not yet flashed) and mirrored in `algorithm.py`, which now defaults to
matching the current firmware (amplitude ratio 0.2-5.0, T-wave
discrimination on).

1. **Amplitude ratio widened `[0.35, 3.0]` -> `[0.2, 5.0]`.** Confirmed
   improvement, see above.
2. **T-wave discrimination (Pan-Tompkins style).** When a candidate peak
   lands 200-360ms after the last *confirmed* R-peak, its slope (peak
   |derivative| over the same MWI_WINDOW used to compute its energy, so no
   lookahead is needed) must be >= 50% of the last confirmed R-peak's slope
   or it's rejected without resetting the refractory timer.

## Expanded test set (7 records) + T-wave discrimination results

Added records 111 (LBBB), 119 (PVCs + ST changes), 200 (explicitly noted
by PhysioNet as having bursts of high-frequency noise) for more diversity
beyond the original 4.

| Config | Overall Sens% | Overall FP rate% |
|---|---|---|
| Original baseline (amp 0.35-3.0, no T-wave) | 50.6 | 30.4 |
| + amplitude fix only | 65.5 | 24.3 |
| + amplitude fix + T-wave discrimination | 65.3 | 24.3 |

(Overall numbers shifted from the earlier 4-record report because the 3
new records are, on average, easier than 100/106 — this is exactly the
overfitting risk you flagged, now visible.)

**Record 100 specifically (the one with the 74% T-wave-misdetection rate
found earlier):**

| Config | Sens% | Detected | Matched |
|---|---|---|---|
| Amplitude fix only | 19.1 | 1739 | 434 |
| + T-wave discrimination | 18.3 | 1739 | 417 |

**T-wave discrimination did not help — and slightly hurt.** I verified the
logic is actually firing (it swapped out 321 of the 1739 detected
timestamps for 321 different ones — it's not a no-op), but the *fraction*
of detections landing in the T-wave timing zone relative to the true beat
stayed exactly the same (62.5% before and after). Root cause: with the
amplitude fix alone, record 100 already misses **81% of true beats**
before the T-wave check ever runs. The check's timing reference is "since
the algorithm's own *last confirmed* R-peak" — when that last confirmed
peak is itself several true beats back (because they were missed), the
elapsed time to the next candidate rarely lands in the 200-360ms window
relative to a *stale* reference, so the check can't recognize the T-wave
as one. Rejecting one T-wave also just lets a *different* nearby T-wave-ish
feature through instead, via the same state-feedback that governs which
excursion trips the threshold next — hence the identical 62.5%.

Across all 7 records the effect is a wash (65.5% -> 65.3%), with real
per-record swings in both directions: 103 improves (85.8% -> 88.8%), 101
improves slightly (55.4% -> 56.2%), but **106 regresses (63.6% -> 59.9%)**.

**In short: classic Pan-Tompkins T-wave discrimination assumes the
underlying detector is already mostly finding the real beats — it's a
refinement, not a fix for a detector still missing the majority of them.**
It's implemented correctly and does what it says, but on this data it
isn't a net win as currently wired (relative to the algorithm's own last
*confirmed* peak, not the last *candidate*). I left it in the firmware
since it's not clearly harmful either, but flagging honestly: don't count
it as the fix for record 100's problem. It should probably be reworked to
reference the last *candidate* peak (confirmed or not) rather than only
confirmed ones, so it isn't blind exactly when detection is already
struggling — worth revisiting before you consider it settled.

## Hypothesis check: does the widened amplitude ratio corrupt avgPeakAmplitude?

Checked by logging `avg_peak_amplitude`'s trajectory on record 100 against
the true QRS mwi amplitude at annotated beat locations. Finding: **the
hypothesized mechanism wasn't quite what was happening, but the
investigation found something worse.**

`avg_peak_amplitude` was found sitting around 0.00001-0.00007 throughout
the whole 30-minute recording, while true QRS mwi at real R-peaks is
~0.0026-0.0033 - roughly 100-300x larger. But tracing every update event
showed this wasn't gradual "corruption by noisy peaks" (the amplitude
widening hypothesis) - it was a **runaway collapse of the entire
thresholding mechanism**, present identically under both the original
[0.35, 3.0] and widened [0.2, 5.0] amplitude bounds (traced `peak_level`/
`signal_threshold` under both - byte-for-byte identical trajectories for
the first 70+ seconds). The amplitude ratio change is not the cause.

**Root cause:** the code classified a candidate peak at the instant `mwi`
first crossed `signalThreshold` (the rising edge), using that
crossing-instant value to update `peak_level`. Checked directly: the
excursion's true local maximum (found by scanning forward) was 2.5x-6.3x
*larger* than the crossing-instant value, and this ratio grew over time.
Since a smaller `peak_level` lowers `signalThreshold`, the next crossing
happens even earlier in the next QRS's rise, capturing an even smaller
value - an unstable positive-feedback loop. `peak_level` collapsed from
~0.0024 (t=10s, correct QRS scale) to ~0.000008 by t=90s, a ~300x
collapse in under 90 seconds. This is a genuine, pre-existing bug in the
original .ino's core thresholding, unrelated to anything changed in the
last two sessions - it also explains the earlier T-wave-misdetection
finding as a downstream symptom of the same collapse (once thresholds
crater toward the noise floor, T-wave bumps become "the next biggest
thing available" to detect).

## Canonical Pan-Tompkins thresholding + search-back (algorithm.py only)

Implemented as specified: SPKI/NPKI tracked per the paper's update rules,
`THRESHOLD1 = NPKI + 0.25*(SPKI-NPKI)`, `THRESHOLD2 = 0.5*THRESHOLD1`, and
search-back re-examining any gap exceeding `1.66 x average RR` using
THRESHOLD2 to recover a likely missed beat (search-back's SPKI update
uses the paper's faster-adapting 0.25/0.75 weighting; RR-bounds rejection
is bypassed for search-back recoveries since exceeding the normal RR
bounds is the whole reason search-back exists).

Crucially, this rewrite also fixes the collapse bug above: a peak is now
only classified once its excursion above THRESHOLD1 *ends*, using the
excursion's true local maximum - not the crossing-instant value. Verified
this fixes the collapse: SPKI/THRESHOLD1 now stay flat (~0.005 / ~0.0013)
across a full 5-minute trace on record 100, instead of collapsing toward
zero.

| Record | Before (amp fix + T-wave, no search-back) | After (canonical + search-back) |
|---|---|---|
| 100 | 18.3% | **99.8%** |
| 101 | 56.2% | **99.6%** |
| 103 | 88.8% | **99.5%** |
| 106 | 59.9% | **77.5%** |
| 111 | 93.3% | **97.1%** |
| 119 | 62.5% | **99.8%** |
| 200 | 77.5% | **99.4%** |
| **OVERALL** | **65.3%** | **96.3%** |

False-positive rate also collapsed to essentially zero: 4 false positives
across 14,406 total detections (0.03%), down from 24.3%.

**Record 106 remains the outlier** (77.5%, vs. 97-99.8% everywhere else).
Checked why: with the fix in place, zero of its misses are amplitude-ratio
rejections - the missed beats simply never cross THRESHOLD1 or THRESHOLD2
at all, fairly evenly spread across the whole recording (not a localized
lockup). Record 106 is documented by PhysioNet as having frequent,
*multiform* PVCs (varying morphology/amplitude). The likely explanation:
large PVCs dominate SPKI, pushing the adaptive threshold too high to catch
smaller normal beats interspersed between them - a known limitation of
single-threshold amplitude-adaptive detectors on morphologically mixed
rhythms, not a new bug. Worth a future look, but doesn't change the
verdict below.

**This result clearly justifies porting to the firmware** - the Python
numbers went from "not usable" (65.3%, and record 100 alone at 18.3%) to
"comparable to published QRS-detector benchmarks on this database"
(96.3%). Recommend porting once you give the go-ahead, per your
instruction to hold off until the evidence was in.

## Verdict

**The rule-based algorithm's core logic (adaptive threshold + refractory +
amplitude-ratio gating) is sound in outline, but as originally tuned it
does not hold up against real, diverse cardiac data.** The amplitude-ratio
widening is a safe, verified improvement (50.6% -> 65.5% sensitivity
across 7 records) and is now in the firmware. T-wave discrimination, while
correctly implemented, turned out to be a wash on this data because it's
gated on already-successful detection — a genuine, useful negative result,
not a dead end to paper over. Getting materially further will likely need
either a proper bandpass redesign (alpha retuning alone showed real
per-record tradeoffs, see above) or, as planned, an ML-based classifier —
the rule-based approach alone is unlikely to reach clinically-meaningful
accuracy across diverse patients without one.
