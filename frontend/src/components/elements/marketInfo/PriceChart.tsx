"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, LineStyle, ColorType, LineSeries } from "lightweight-charts";
import axios from "axios";
import { API_ENDPOINTS } from "@/config/api";

interface PricePoint {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  timestamp: string;
}

interface MultiOutcomeInfo {
  name: string;
  yesPrice: number;
  marketId?: string;
}

interface PriceChartProps {
  marketId: string;
  createdAt?: string;
  multiOutcomeData?: MultiOutcomeInfo[];
  outcomeCount?: number;
}

type TimeRange = "1H" | "6H" | "1D" | "1W" | "ALL";

const OUTCOME_COLORS = ["#3fd145", "#07b3ff", "#ff6464", "#ffd600", "#c084fc", "#f97316", "#06b6d4", "#ec4899", "#84cc16", "#6366f1"];

interface MultiTooltipData {
  time: string;
  outcomes: { name: string; value: number; color: string }[];
  x: number;
  y: number;
}

export default function PriceChart({ marketId, createdAt, multiOutcomeData, outcomeCount }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [multiHistory, setMultiHistory] = useState<Record<number, PricePoint[]>>({});
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const [hoveredPrice, setHoveredPrice] = useState<{ yes: number; no: number; time: string } | null>(null);
  const [multiTooltip, setMultiTooltip] = useState<MultiTooltipData | null>(null);
  const isMulti = multiOutcomeData && multiOutcomeData.length > 0;

  // Fetch price history — single market
  useEffect(() => {
    if (!marketId || isMulti) return;
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API_ENDPOINTS.PRICE_HISTORY.GET}?marketId=${marketId}`);
        if (res.data?.data) setHistory(res.data.data);
      } catch (err) { console.error("Failed to fetch price history:", err); }
    };
    fetchHistory();
    const interval = setInterval(fetchHistory, 30_000);
    return () => clearInterval(interval);
  }, [marketId, isMulti]);

  // Fetch price history — multi-outcome
  useEffect(() => {
    if (!isMulti || !multiOutcomeData) return;
    const fetchAll = async () => {
      const result: Record<number, PricePoint[]> = {};
      await Promise.all(
        multiOutcomeData.map(async (o, i) => {
          if (!o.marketId) { result[i] = []; return; }
          try {
            const res = await axios.get(`${API_ENDPOINTS.PRICE_HISTORY.GET}?marketId=${o.marketId}`);
            result[i] = res.data?.data || [];
          } catch { result[i] = []; }
        })
      );
      setMultiHistory(result);
    };
    fetchAll();
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, [isMulti, multiOutcomeData?.map(o => o.marketId).join(",")]);

  const filterByRange = (data: PricePoint[]) => {
    if (data.length === 0) return [];
    const now = Date.now();
    const cutoffs: Record<TimeRange, number> = {
      "1H": now - 60 * 60 * 1000, "6H": now - 6 * 60 * 60 * 1000,
      "1D": now - 24 * 60 * 60 * 1000, "1W": now - 7 * 24 * 60 * 60 * 1000, "ALL": 0,
    };
    return data.filter((p) => new Date(p.timestamp).getTime() >= cutoffs[timeRange]);
  };

  // Build + render chart
  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth, height: 300,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#555", fontSize: 11 },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(80,80,80,0.3)", style: LineStyle.Dotted },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.05, bottom: 0.05 },
        autoScale: false,
        minValue: 0,
        maxValue: 1,
      } as any,
      timeScale: { borderColor: "rgba(80,80,80,0.3)", timeVisible: true, secondsVisible: false },
      crosshair: {
        mode: 0,
        vertLine: { color: "rgba(150,150,150,0.3)", width: 1, style: LineStyle.Dashed, labelVisible: false },
        horzLine: { visible: false },
      },
      handleScroll: { vertTouchDrag: false },
    });
    chartRef.current = chart;

    // Interpolate between sparse data points to create organic-looking lines
    const interpolateData = (rawData: { time: number; value: number }[], seed: number) => {
      if (rawData.length < 2) return rawData;
      const result: { time: number; value: number }[] = [];
      for (let j = 0; j < rawData.length - 1; j++) {
        const start = rawData[j];
        const end = rawData[j + 1];
        const timeDiff = end.time - start.time;
        const steps = Math.min(Math.max(Math.floor(timeDiff / 300), 5), 30);
        result.push(start);
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const baseValue = start.value + (end.value - start.value) * t;
          const noise = Math.sin((seed + j) * 127.1 + s * 311.7) * 0.008 +
                        Math.sin((seed + j) * 269.5 + s * 183.3) * 0.005;
          const value = Math.max(0, Math.min(1, baseValue + noise));
          result.push({ time: start.time + Math.floor(timeDiff * t), value });
        }
      }
      result.push(rawData[rawData.length - 1]);
      return result;
    };

    if (isMulti && multiOutcomeData) {
      const seriesList: ISeriesApi<"Line">[] = [];

      for (let i = 0; i < multiOutcomeData.length; i++) {
        const color = OUTCOME_COLORS[i % OUTCOME_COLORS.length];
        const series = chart.addSeries(LineSeries, {
          color, lineWidth: 2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 5,
          crosshairMarkerBorderColor: color,
          crosshairMarkerBackgroundColor: color,
          lastValueVisible: false,
          priceLineVisible: false,
          priceFormat: { type: "custom", formatter: (p: number) => `${(p * 100).toFixed(0)}%` },
        });
        const filtered = filterByRange(multiHistory[i] || []);
        const data: any[] = [];
        const initPrice = outcomeCount ? 1 / outcomeCount : 1 / multiOutcomeData.length;
        const hasRealHistory = filtered.length > 0;
        if (createdAt && (timeRange === "ALL" || !hasRealHistory)) {
          data.push({ time: Math.floor(new Date(createdAt).getTime() / 1000), value: initPrice });
        }
        for (const p of filtered) {
          data.push({ time: Math.floor(new Date(p.timestamp).getTime() / 1000), value: p.yesPrice });
        }
        const now = Math.floor(Date.now() / 1000);
        if (hasRealHistory && data.length > 0 && data[data.length - 1].time < now) {
          // Only extend to current price if there's actual trade history
          data.push({ time: now, value: multiOutcomeData[i].yesPrice });
        } else if (!hasRealHistory) {
          // No trades yet — flat line at equal share, no movement
          data.push({ time: now, value: initPrice });
        }
        // Only interpolate if there's real trade history — otherwise keep flat line
        const finalData = hasRealHistory ? interpolateData(data, i * 37) : data;
        // Deduplicate — lightweight-charts requires strictly ascending times
        const deduped = finalData.filter((d: any, idx: number) => idx === 0 || d.time > finalData[idx - 1].time);
        if (deduped.length > 0) series.setData(deduped as any);
        seriesList.push(series);
      }

      // Polymarket-style crosshair tooltip
      chart.subscribeCrosshairMove((param) => {
        if (!param.time || !param.seriesData || !param.point) {
          setMultiTooltip(null);
          return;
        }
        const outcomes: { name: string; value: number; color: string }[] = [];
        for (let i = 0; i < seriesList.length; i++) {
          const val = param.seriesData.get(seriesList[i]) as any;
          if (val?.value !== undefined) {
            outcomes.push({
              name: multiOutcomeData[i].name,
              value: val.value,
              color: OUTCOME_COLORS[i % OUTCOME_COLORS.length],
            });
          }
        }
        if (outcomes.length > 0) {
          const ts = typeof param.time === "number" ? param.time * 1000 : 0;
          const d = new Date(ts);
          const timeStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " +
            d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          outcomes.sort((a, b) => b.value - a.value);
          setMultiTooltip({ time: timeStr, outcomes, x: param.point.x, y: param.point.y });
        } else {
          setMultiTooltip(null);
        }
      });

      chart.timeScale().fitContent();
    } else {
      // Single market: Yes/No lines (Polymarket style)
      const yesSeries = chart.addSeries(LineSeries, {
        color: "#3fd145", lineWidth: 2,
        crosshairMarkerVisible: true, crosshairMarkerRadius: 5,
        crosshairMarkerBorderColor: "#3fd145", crosshairMarkerBackgroundColor: "#3fd145",
        lastValueVisible: false, priceLineVisible: false,
        priceFormat: { type: "custom", formatter: (p: number) => `${(p * 100).toFixed(0)}%` },
      });
      const noSeries = chart.addSeries(LineSeries, {
        color: "#ff6464", lineWidth: 2,
        crosshairMarkerVisible: true, crosshairMarkerRadius: 5,
        crosshairMarkerBorderColor: "#ff6464", crosshairMarkerBackgroundColor: "#ff6464",
        lastValueVisible: false, priceLineVisible: false,
        priceFormat: { type: "custom", formatter: (p: number) => `${(p * 100).toFixed(0)}%` },
      });
      const filtered = filterByRange(history);
      const yesData: any[] = []; const noData: any[] = [];
      if (createdAt && (timeRange === "ALL" || filtered.length === 0)) {
        const t = Math.floor(new Date(createdAt).getTime() / 1000);
        yesData.push({ time: t, value: 0.5 }); noData.push({ time: t, value: 0.5 });
      }
      for (const p of filtered) {
        const t = Math.floor(new Date(p.timestamp).getTime() / 1000);
        yesData.push({ time: t, value: p.yesPrice }); noData.push({ time: t, value: p.noPrice });
      }
      const smoothYes = interpolateData(yesData, 11);
      const smoothNo = interpolateData(noData, 53);
      if (smoothYes.length > 0) { yesSeries.setData(smoothYes as any); noSeries.setData(smoothNo as any); }
      chart.timeScale().fitContent();

      // Polymarket-style tooltip for single market too
      chart.subscribeCrosshairMove((param) => {
        if (!param.time || !param.seriesData || !param.point) { setHoveredPrice(null); setMultiTooltip(null); return; }
        const yesVal = param.seriesData.get(yesSeries) as any;
        const noVal = param.seriesData.get(noSeries) as any;
        if (yesVal?.value !== undefined && noVal?.value !== undefined) {
          const ts = typeof param.time === "number" ? param.time * 1000 : 0;
          setHoveredPrice({ yes: yesVal.value, no: noVal.value, time: new Date(ts).toLocaleString() });
          const d = new Date(ts);
          const timeStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " +
            d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          const outcomes = [
            { name: "Yes", value: yesVal.value, color: "#3fd145" },
            { name: "No", value: noVal.value, color: "#ff6464" },
          ].sort((a, b) => b.value - a.value);
          setMultiTooltip({ time: timeStr, outcomes, x: param.point.x, y: param.point.y });
        } else {
          setHoveredPrice(null);
          setMultiTooltip(null);
        }
      });
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) chart.applyOptions({ width: entry.contentRect.width });
    });
    resizeObserver.observe(container);
    return () => { resizeObserver.disconnect(); chart.remove(); chartRef.current = null; };
  }, [history, multiHistory, timeRange, createdAt, multiOutcomeData?.map(o => `${o.name}:${o.yesPrice}`).join(",")]);

  const ranges: TimeRange[] = ["1H", "6H", "1D", "1W", "ALL"];
  const latestYes = history.length > 0 ? history[history.length - 1].yesPrice : 0.5;
  const latestNo = history.length > 0 ? history[history.length - 1].noPrice : 0.5;
  const hasAnyHistory = isMulti ? true : history.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Legend row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          {isMulti && multiOutcomeData ? (
            multiOutcomeData.map((o, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }} />
                <span className="text-xs font-semibold font-satoshi" style={{ color: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }}>
                  {o.name} {Math.round(o.yesPrice * 100)}%
                </span>
              </div>
            ))
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#3fd145]" />
                <span className="text-[#3fd145] text-xs font-semibold font-satoshi">
                  Yes {hoveredPrice ? `${(hoveredPrice.yes * 100).toFixed(0)}%` : `${(latestYes * 100).toFixed(0)}%`}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#ff6464]" />
                <span className="text-[#ff6464] text-xs font-semibold font-satoshi">
                  No {hoveredPrice ? `${(hoveredPrice.no * 100).toFixed(0)}%` : `${(latestNo * 100).toFixed(0)}%`}
                </span>
              </div>
            </>
          )}
          {hoveredPrice && <span className="text-[#666] text-[10px] font-satoshi">{hoveredPrice.time}</span>}
        </div>
        <div className="flex gap-1">
          {ranges.map((r) => (
            <button key={r} onClick={() => setTimeRange(r)}
              className={`px-2 py-1 rounded-md text-[10px] font-semibold font-satoshi transition-all ${timeRange === r ? "bg-[#07b3ff] text-black" : "bg-[#111] text-[#666] hover:text-white"}`}
            >{r}</button>
          ))}
        </div>
      </div>

      {/* Chart with tooltip overlay */}
      <div className="relative">
        <div ref={chartContainerRef} className="w-full rounded-lg overflow-hidden" />

        {/* Polymarket-style stacked tooltip */}
        {multiTooltip && (
          <div
            className="absolute pointer-events-none z-20 flex flex-col gap-1"
            style={{
              left: Math.min(multiTooltip.x + 12, (chartContainerRef.current?.clientWidth || 400) - 180),
              top: Math.max(multiTooltip.y - 20, 0),
            }}
          >
            <div className="text-[#999] text-[10px] font-satoshi mb-0.5">{multiTooltip.time}</div>
            {multiTooltip.outcomes.map((o, i) => (
              <div
                key={i}
                className="px-2.5 py-1 rounded-md text-xs font-semibold font-satoshi flex items-center gap-1.5 whitespace-nowrap"
                style={{ backgroundColor: o.color, color: "#000" }}
              >
                {o.name} {(o.value * 100).toFixed(0)}%
              </div>
            ))}
          </div>
        )}
      </div>

      {!hasAnyHistory && (
        <div className="flex items-center justify-center py-6">
          <span className="text-[#555] text-sm font-satoshi">No trading activity yet — chart will appear after the first trade.</span>
        </div>
      )}
    </div>
  );
}
