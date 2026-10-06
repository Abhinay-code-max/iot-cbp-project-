import React, { useState, useMemo } from 'react';
import { healthDataService } from '../../services/healthDataService';
import { Clock, Info, ShieldCheck } from 'lucide-react';

interface Props {
  currentBpm?: number;
}

type FilterType = 'live' | '1h' | '6h' | 'today' | '7d' | '30d';

export const HeartRateTrendChart: React.FC<Props> = ({ currentBpm = 72 }) => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('today');
  const [hoveredPoint, setHoveredPoint] = useState<{
    timestamp: number;
    label: string;
    bpm: number;
    mode: string;
    rhythm: string;
    x: number;
    y: number;
  } | null>(null);

  const trendData = useMemo(() => {
    return healthDataService.getHeartRateTrend(activeFilter, currentBpm);
  }, [activeFilter, currentBpm]);

  // Chart Dimensions
  const height = 260;
  const paddingX = 40;
  const paddingY = 30;

  const minBpm = Math.max(40, Math.min(...trendData.map((d) => d.bpm)) - 10);
  const maxBpm = Math.min(200, Math.max(...trendData.map((d) => d.bpm)) + 15);
  const bpmRange = maxBpm - minBpm || 1;

  // Compute SVG Points
  const chartWidth = 700; // base virtual width
  const pointsWithCoords = useMemo(() => {
    return trendData.map((d, i) => {
      const x = paddingX + (i / Math.max(1, trendData.length - 1)) * (chartWidth - paddingX * 2);
      const y = height - paddingY - ((d.bpm - minBpm) / bpmRange) * (height - paddingY * 2);
      return { ...d, x, y };
    });
  }, [trendData, minBpm, bpmRange]);

  const pathD = useMemo(() => {
    if (pointsWithCoords.length === 0) return '';
    return pointsWithCoords.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      // Smooth cubic bezier curves
      const prev = pointsWithCoords[i - 1];
      const cx1 = prev.x + (pt.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (pt.x - prev.x) / 2;
      const cy2 = pt.y;
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
    }, '');
  }, [pointsWithCoords]);

  // Area under curve
  const areaD = useMemo(() => {
    if (pointsWithCoords.length === 0) return '';
    const firstX = pointsWithCoords[0].x;
    const lastX = pointsWithCoords[pointsWithCoords.length - 1].x;
    const bottomY = height - paddingY;
    return `${pathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [pathD, pointsWithCoords]);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
      {/* Header and Filter Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Heart Rate Activity Trend</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-normal">
              Continuous
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Hover or tap any segment to inspect R-R cardiac rhythm classification
          </p>
        </div>

        {/* Time Filters */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
          {(['live', '1h', '6h', 'today', '7d', '30d'] as FilterType[]).map((filter) => (
            <button
              key={filter}
              onClick={() => {
                setActiveFilter(filter);
                setHoveredPoint(null);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-lg capitalize whitespace-nowrap transition-all ${
                activeFilter === filter
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {filter === 'live' ? 'Live' : filter === '1h' ? '1 Hour' : filter === '6h' ? '6 Hours' : filter === 'today' ? 'Today' : filter === '7d' ? '7 Days' : '30 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Chart Container */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${chartWidth} ${height}`}
          className="w-full h-auto overflow-visible"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id="hrGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Horizontal Reference Grid Lines */}
          {[60, 100, 140].map((gridBpm) => {
            if (gridBpm < minBpm || gridBpm > maxBpm) return null;
            const y = height - paddingY - ((gridBpm - minBpm) / bpmRange) * (height - paddingY * 2);
            return (
              <g key={gridBpm}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  className="text-slate-200 dark:text-slate-800"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 font-mono"
                >
                  {gridBpm}
                </text>
              </g>
            );
          })}

          {/* Area under curve */}
          <path d={areaD} fill="url(#hrGradient)" />

          {/* Smooth line */}
          <path
            d={pathD}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points / Interaction Hotspots */}
          {pointsWithCoords.map((pt, idx) => (
            <g
              key={idx}
              className="cursor-pointer group"
              onMouseEnter={() => setHoveredPoint(pt)}
              onClick={() => setHoveredPoint(pt)}
            >
              {/* Invisible large target for easy mobile tapping */}
              <circle cx={pt.x} cy={pt.y} r="10" fill="transparent" />

              {/* Point circle */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={hoveredPoint?.timestamp === pt.timestamp ? 5.5 : pt.bpm > 130 ? 3.5 : 2}
                fill={pt.bpm > 130 ? '#ef4444' : '#10b981'}
                stroke="#0f172a"
                strokeWidth="1.5"
                className="transition-all duration-150"
              />
            </g>
          ))}

          {/* Vertical inspection cursor crosshair if hovered */}
          {hoveredPoint && (
            <line
              x1={hoveredPoint.x}
              y1={paddingY}
              x2={hoveredPoint.x}
              y2={height - paddingY}
              stroke="#38bdf8"
              strokeDasharray="2 2"
              strokeWidth="1"
            />
          )}
        </svg>

        {/* Hover / Tap Tooltip */}
        {hoveredPoint && (
          <div
            className="absolute pointer-events-none z-20 bg-slate-900/95 border border-slate-700/80 backdrop-blur-md rounded-xl p-3 shadow-xl text-white text-xs transform -translate-x-1/2 -translate-y-full transition-all"
            style={{
              left: `${(hoveredPoint.x / chartWidth) * 100}%`,
              top: `${(hoveredPoint.y / height) * 100 - 4}%`
            }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-1.5 mb-1.5">
              <span className="font-bold text-emerald-400 text-sm tabular-nums">
                {hoveredPoint.bpm} <span className="text-[10px] text-slate-400 font-normal">BPM</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {hoveredPoint.label}
              </span>
            </div>
            <div className="space-y-0.5 text-[11px]">
              <p className="text-slate-300">
                <span className="text-slate-500">Rhythm: </span>
                {hoveredPoint.rhythm}
              </p>
              <p className="text-slate-300 capitalize">
                <span className="text-slate-500">Mode: </span>
                {hoveredPoint.mode} Mode
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Axis Labels */}
      <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-2 px-2">
        <span>{trendData[0]?.label || 'Start'}</span>
        <span className="text-slate-400 dark:text-slate-600">• Time Progression •</span>
        <span>{trendData[trendData.length - 1]?.label || 'Now'}</span>
      </div>
    </div>
  );
};
