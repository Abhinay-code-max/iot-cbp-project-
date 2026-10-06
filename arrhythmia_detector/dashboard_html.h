#pragma once

const char INDEX_HTML[] PROGMEM = R"HTMLPAGE(
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>ECG Monitor</title>
<style>
  :root {
    --bg: #0f1420;
    --card: #171e2e;
    --card-border: rgba(255,255,255,0.05);
    --text: #eef1f8;
    --text-dim: #7d8aa3;
    --red: #f43f5e;
    --teal: #22d3ee;
    --amber: #f59e0b;
    --green: #22c55e;
    --gray: #6b7280;
    --ecg-line: #2ee6a6;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    padding: 18px;
    padding-bottom: 44px;
    max-width: 520px;
    margin-left: auto;
    margin-right: auto;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
  }
  .header h1 {
    font-size: 16px;
    font-weight: 700;
    margin: 0;
    letter-spacing: 0.5px;
  }
  .conn-indicator { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-dim); }
  .dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--gray);
    box-shadow: none;
    transition: background 0.3s, box-shadow 0.3s;
  }
  .dot.live { background: var(--green); box-shadow: 0 0 6px rgba(34,197,94,0.8); }

  .status-badge-wrap { text-align: center; margin-bottom: 18px; }
  .badge {
    display: inline-block;
    padding: 7px 18px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.3px;
  }
  .badge-green  { background: rgba(34,197,94,0.15);  color: var(--green); border: 1px solid rgba(34,197,94,0.35); }
  .badge-orange { background: rgba(245,158,11,0.15); color: var(--amber); border: 1px solid rgba(245,158,11,0.35); }
  .badge-red    { background: rgba(244,63,94,0.15);  color: var(--red);  border: 1px solid rgba(244,63,94,0.35); }
  .badge-gray   { background: rgba(107,114,128,0.15);color: var(--gray); border: 1px solid rgba(107,114,128,0.35); }

  .vitals-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 18px;
  }
  @media (max-width: 420px) {
    .vitals-grid { grid-template-columns: 1fr; }
  }

  .vital-card {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: 18px;
    padding: 18px 14px;
    text-align: center;
    box-shadow: 0 6px 18px rgba(0,0,0,0.35);
  }
  .vital-icon { margin-bottom: 6px; }
  .vital-icon svg { width: 22px; height: 22px; }
  .vital-title {
    font-size: 11px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }
  .vital-value { font-size: 34px; font-weight: 700; line-height: 1; }
  .vital-unit { font-size: 11px; color: var(--text-dim); margin-top: 4px; letter-spacing: 0.5px; }

  .hr-card .vital-icon   { color: var(--red); transition: color 0.3s, opacity 0.3s; }
  .hr-card .vital-value  { color: var(--red); }
  .hr-card .vital-icon.leads-off { color: var(--gray); opacity: 0.5; }
  .hr-card .vital-icon.pulse { animation: heartbeat-pulse 180ms ease-out; }
  @keyframes heartbeat-pulse {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.15); filter: drop-shadow(0 0 6px rgba(244,63,94,0.85)); }
    100% { transform: scale(1); }
  }
  .avg-card .vital-icon  { color: var(--teal); }
  .avg-card .vital-value { color: var(--teal); }
  .max-card .vital-icon  { color: var(--amber); }
  .max-card .vital-value { color: var(--amber); }

  .chart-card {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: 18px;
    padding: 18px;
    margin-bottom: 18px;
    box-shadow: 0 6px 18px rgba(0,0,0,0.35);
  }
  .chart-card .label {
    font-size: 11px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 10px;
  }
  canvas { width: 100%; height: 150px; display: block; }

  .footer-row { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .reset-btn {
    padding: 8px 18px;
    background: transparent;
    border: 1px solid var(--card-border);
    color: var(--text-dim);
    font-size: 12px;
    font-weight: 600;
    border-radius: 20px;
    cursor: pointer;
  }
  .reset-btn:active { background: var(--card); }
  .conn-status { text-align: center; font-size: 11px; color: var(--text-dim); min-height: 14px; }
</style>
</head>
<body>
  <div class="header">
    <h1>ECG Monitor</h1>
    <div class="conn-indicator">
      <span class="dot" id="connDot"></span>
      <span id="connLabel">Connecting</span>
    </div>
  </div>

  <div class="status-badge-wrap">
    <div class="badge badge-gray" id="statusBadge">Connecting&hellip;</div>
  </div>

  <div class="vitals-grid">
    <div class="vital-card hr-card">
      <div class="vital-icon" id="heartIcon">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-6.7-4.3-9.3-8.2C1 10.1 1.5 6.8 4.1 5.1c2.1-1.4 4.7-.9 6.2.9L12 7.8l1.7-1.8c1.5-1.8 4.1-2.3 6.2-.9 2.6 1.7 3.1 5 1.4 7.7C18.7 16.7 12 21 12 21z"/></svg>
      </div>
      <div class="vital-title">Heart Rate</div>
      <div class="vital-value" id="hrValue">--</div>
      <div class="vital-unit">bpm</div>
    </div>
    <div class="vital-card avg-card">
      <div class="vital-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 12 8 12 10 6 14 18 16 12 22 12"/></svg>
      </div>
      <div class="vital-title">Average HR</div>
      <div class="vital-value" id="avgValue">--</div>
      <div class="vital-unit">bpm</div>
    </div>
    <div class="vital-card max-card">
      <div class="vital-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 5"/><polyline points="14 5 21 5 21 12"/></svg>
      </div>
      <div class="vital-title">Highest HR</div>
      <div class="vital-value" id="maxValue">--</div>
      <div class="vital-unit">bpm</div>
    </div>
  </div>

  <div class="chart-card">
    <div class="label">ECG / Heart Rate Trend</div>
    <canvas id="chart"></canvas>
  </div>

  <div class="footer-row">
    <button class="reset-btn" id="resetBtn">Reset Session</button>
    <div class="conn-status" id="connStatus">&nbsp;</div>
  </div>

<script>
(function () {
  var HISTORY_MS = 60000;
  var history = []; // {t: Date.now() at poll time, bpm: number}

  var hrValueEl = document.getElementById('hrValue');
  var avgValueEl = document.getElementById('avgValue');
  var maxValueEl = document.getElementById('maxValue');
  var statusBadgeEl = document.getElementById('statusBadge');
  var connDotEl = document.getElementById('connDot');
  var connLabelEl = document.getElementById('connLabel');
  var connStatusEl = document.getElementById('connStatus');
  var canvas = document.getElementById('chart');
  var ctx = canvas.getContext('2d');
  var resetBtn = document.getElementById('resetBtn');
  var heartIconEl = document.getElementById('heartIcon');

  var HEART_IDLE_MS = 2000; // settle to idle if no new beat within this long
  var lastBeatCount = null;
  var lastBeatSeenAt = Date.now();

  // Restarting a CSS animation by re-adding the same class is a no-op
  // unless the browser is forced to recompute style in between - reading
  // offsetWidth does that. Without it, beats arriving faster than the
  // ~180ms animation would just keep the first pulse running instead of
  // restarting it, which is what "don't let rapid beats visually stack"
  // requires.
  function triggerHeartPulse() {
    heartIconEl.classList.remove('pulse');
    void heartIconEl.offsetWidth;
    heartIconEl.classList.add('pulse');
  }

  function setHeartLeadsOff(isOff) {
    if (isOff) {
      heartIconEl.classList.remove('pulse');
      heartIconEl.classList.add('leads-off');
    } else {
      heartIconEl.classList.remove('leads-off');
    }
  }

  function resizeCanvas() {
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas);

  function setBadge(text, cls) {
    statusBadgeEl.textContent = text;
    statusBadgeEl.className = 'badge ' + cls;
  }

  function setConnected(isLive) {
    connDotEl.className = 'dot' + (isLive ? ' live' : '');
    connLabelEl.textContent = isLive ? 'Live' : 'No signal';
  }

  // A fetch failure means we know nothing right now - blank every card.
  // leadsOff (fetch succeeded) means only the current HR is meaningless;
  // avgBpm/maxBpm are still-valid session stats, so they stay on screen.
  function showNoData() {
    hrValueEl.textContent = '-';
    avgValueEl.textContent = '-';
    maxValueEl.textContent = '-';
    setBadge('No signal', 'badge-gray');
    setConnected(false);
    setHeartLeadsOff(true);
  }

  function drawChart() {
    var rect = canvas.getBoundingClientRect();
    var w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);
    if (history.length < 2) return;

    var now = Date.now();
    var visible = history.filter(function (p) { return now - p.t <= HISTORY_MS; });
    if (visible.length < 2) return;

    var bpms = visible.map(function (p) { return p.bpm; });
    var minBpm = Math.min.apply(null, bpms);
    var maxBpmV = Math.max.apply(null, bpms);
    if (maxBpmV - minBpm < 10) {
      var mid = (maxBpmV + minBpm) / 2;
      minBpm = mid - 5;
      maxBpmV = mid + 5;
    }
    var pad = (maxBpmV - minBpm) * 0.15;
    minBpm -= pad;
    maxBpmV += pad;

    function x(t) { return w - ((now - t) / HISTORY_MS) * w; }
    function y(bpm) { return h - ((bpm - minBpm) / (maxBpmV - minBpm)) * h; }

    // Faint gridlines only
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (var g = 1; g < 4; g++) {
      var gy = (h / 4) * g;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    ctx.strokeStyle = '#2ee6a6';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(46,230,166,0.5)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    visible.forEach(function (p, i) {
      var px = x(p.t), py = y(p.bpm);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.lineTo(x(visible[visible.length - 1].t), h);
    ctx.lineTo(x(visible[0].t), h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(46,230,166,0.07)';
    ctx.fill();
  }

  function statusToBadge(status) {
    if (!status || status.indexOf('Normal') !== -1) return { text: status || 'Normal', cls: 'badge-green' };
    if (status.indexOf('Tachycardia') !== -1 || status.indexOf('Bradycardia') !== -1) return { text: status, cls: 'badge-orange' };
    if (status.indexOf('Irregular') !== -1 || status.indexOf('pause') !== -1) return { text: status, cls: 'badge-red' };
    return { text: status, cls: 'badge-gray' };
  }

  function poll() {
    fetch('/api/data', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('bad status');
        return res.json();
      })
      .then(function (data) {
        connStatusEl.textContent = ' ';

        avgValueEl.textContent = data.avgBpm > 0 ? Math.round(data.avgBpm) : '-';
        maxValueEl.textContent = data.maxBpm > 0 ? Math.round(data.maxBpm) : '-';

        if (data.leadsOff) {
          hrValueEl.textContent = '-';
          setBadge('Leads off', 'badge-gray');
          setConnected(false);
          setHeartLeadsOff(true);
          lastBeatCount = null;
        } else {
          hrValueEl.textContent = data.bpm > 0 ? Math.round(data.bpm) : '-';
          var b = statusToBadge(data.status);
          setBadge(b.text, b.cls);
          setConnected(true);
          setHeartLeadsOff(false);
          if (data.bpm > 0) history.push({ t: Date.now(), bpm: data.bpm });

          if (typeof data.beatCount === 'number') {
            if (lastBeatCount !== null && data.beatCount > lastBeatCount) {
              triggerHeartPulse();
              lastBeatSeenAt = Date.now();
            }
            lastBeatCount = data.beatCount;
          }
          if (Date.now() - lastBeatSeenAt > HEART_IDLE_MS) {
            heartIconEl.classList.remove('pulse');
          }
        }

        var cutoff = Date.now() - HISTORY_MS;
        history = history.filter(function (p) { return p.t >= cutoff; });
        drawChart();
      })
      .catch(function () {
        showNoData();
        connStatusEl.textContent = 'Connection lost - retrying...';
        drawChart();
      });
  }

  resetBtn.addEventListener('click', function () {
    fetch('/api/reset', { cache: 'no-store' }).catch(function () {});
    history = [];
    avgValueEl.textContent = '-';
    maxValueEl.textContent = '-';
    drawChart();
  });

  resizeCanvas();
  poll();
  setInterval(poll, 250);
})();
</script>
</body>
</html>
)HTMLPAGE";
