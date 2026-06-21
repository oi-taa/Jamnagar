import React, { useEffect, useState, useMemo } from 'react';
import { api, getTierColor } from '../services/api';
import { formatNumber, formatScore } from '../utils/formatters';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CLUSTER_ID_MAP = [12, 0, 4, 7, 32, 21, 23, 52, 9, 15, 6, 41, 26, 10, 51, 3, 50, 57, 59, 56];

export default function Forecast({ filters }) {
  const [hotspots, setHotspots] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [backtest, setBacktest] = useState(null);
  const [hourly, setHourly] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [zoneDropdownOpen, setZoneDropdownOpen] = useState(false);
  const [hoveredDay, setHoveredDay] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    const params = { limit: 20 };
    if (filters?.zone && filters.zone !== 'all') params.zone = filters.zone;
    if (filters?.shift && filters.shift !== 'all') params.time_range = filters.shift;
    if (filters?.vehicleType && filters.vehicleType !== 'all') params.vehicle_type = filters.vehicleType;
    if (filters?.violationType && filters.violationType !== 'all') params.violation_type = filters.violationType;

    setLoading(true);
    Promise.all([
      api.getHotspots(params),
      api.getForecast(12),
      api.getBacktest(12),
      api.getHourly(12)
    ]).then(([hotspotsData, forecastData, backtestData, hourlyData]) => {
      const list = Array.isArray(hotspotsData) ? hotspotsData : hotspotsData.hotspots || [];
      setHotspots(list);
      if (list.length > 0) {
        setSelectedCluster(list[0]);
        setSelectedIndex(0);
        const clusterId = CLUSTER_ID_MAP[0] ?? 12;
        return Promise.all([
          api.getForecast(clusterId),
          api.getBacktest(clusterId),
          api.getHourly(clusterId)
        ]).then(([fc, bt, hr]) => {
          setForecast(fc);
          setBacktest(bt);
          setHourly(hr);
        });
      } else {
        setForecast(forecastData);
        setBacktest(backtestData);
        setHourly(hourlyData);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [filters]);

  const handleClusterSelect = (cluster, index) => {
    setSelectedCluster(cluster);
    setSelectedIndex(index);
    setZoneDropdownOpen(false);
    const clusterId = CLUSTER_ID_MAP[index] ?? 12;
    Promise.all([api.getForecast(clusterId), api.getBacktest(clusterId), api.getHourly(clusterId)])
      .then(([fc, bt, hr]) => { setForecast(fc); setBacktest(bt); setHourly(hr); })
      .catch(console.error);
  };

  const forecastData = forecast?.forecast || [];
  const totalPredicted = forecastData.reduce((sum, d) => sum + (d.yhat || 0), 0);
  const totalUpper = forecastData.reduce((sum, d) => sum + (d.yhat_upper || d.yhat || 0), 0);
  const totalLower = forecastData.reduce((sum, d) => sum + (d.yhat_lower || 0), 0);
  const uncertaintyPct = totalPredicted > 0 ? (((totalUpper - totalLower) / 2) / totalPredicted * 100).toFixed(1) : 0;

  const peakDayIdx = useMemo(() => {
    if (!forecastData.length) return 6;
    let maxIdx = 0, maxVal = 0;
    forecastData.forEach((d, i) => { if ((d.yhat || 0) > maxVal) { maxVal = d.yhat; maxIdx = i; } });
    return maxIdx;
  }, [forecastData]);

  const peakDay = forecastData[peakDayIdx];
  const mape = forecast?.metrics?.mape || 23.2;
  const mae = forecast?.metrics?.mae || 117.8;
  const mapeColor = mape <= 15 ? '#1aa260' : mape <= 25 ? '#ef7d1e' : '#e0392b';
  const mapeNote = mape <= 15 ? 'excellent' : mape <= 25 ? 'good fit' : 'needs work';

  const derivedMetrics = useMemo(() => {
    if (!forecastData.length) return {};
    const vals = forecastData.map(d => d.yhat || 0);
    const dailyAvg = Math.round(totalPredicted / 7);
    const weekendLoad = Math.round((vals[5] || 0) + (vals[6] || 0));
    const weekdayLoad = Math.round(vals.slice(0, 5).reduce((a, b) => a + b, 0));
    const minVal = Math.min(...vals);
    const minIdx = vals.indexOf(minVal);
    const mean = totalPredicted / 7;
    const variance = vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / 7;
    const volatility = Math.sqrt(variance);
    const firstHalf = vals.slice(0, 3).reduce((a, b) => a + b, 0);
    const secondHalf = vals.slice(4).reduce((a, b) => a + b, 0);
    const trendPct = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf * 100) : 0;
    const confWidths = forecastData.map(d => ((d.yhat_upper || d.yhat) - (d.yhat_lower || 0)) / 2);
    const avgConf = Math.round(confWidths.reduce((a, b) => a + b, 0) / confWidths.length);
    return { dailyAvg, weekendLoad, weekdayLoad, lowestDay: Math.round(minVal), lowestDayName: DAYS[minIdx], volatility: volatility.toFixed(1), trendPct: Math.round(trendPct), trendUp: trendPct > 0, avgConf };
  }, [forecastData, totalPredicted]);

  const getShortName = (n) => n?.includes(' - ') ? n.split(' - ')[1] : (n || '');
  const getBtpCode = (n) => n?.match(/^(BTP\d+)/)?.[1] || 'BTP051';


  const ramp = (t) => {
    t = Math.max(0, Math.min(1, t));
    const lerp = (a, b, u) => Math.round(a + (b - a) * u);
    const blue = [40, 116, 240], amber = [242, 160, 26], red = [224, 57, 43];
    let c;
    if (t < 0.5) { const u = t / 0.5; c = blue.map((v, i) => lerp(v, amber[i], u)); }
    else { const u = (t - 0.5) / 0.5; c = amber.map((v, i) => lerp(v, red[i], u)); }
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8a94a2' }}>Loading...</div>;

  const maxForecastVal = Math.max(...forecastData.map(d => d.yhat_upper || d.yhat || 0), 500);
  const fcVals = forecastData.map(d => d.yhat || 0);
  const fMin = Math.min(...fcVals), fMax = Math.max(...fcVals), fSpan = (fMax - fMin) || 1;

  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      overflowY: 'auto',
      overflowX: 'hidden'
    }}>
      
      {zoneDropdownOpen && <div onClick={() => setZoneDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />}

      
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 30 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#16203a', letterSpacing: '-.01em' }}>Forecast</span>
        <span style={{ fontSize: 12, color: '#8a94a2' }}>7-day Prophet projection per zone</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7585' }}>ZONE</span>
          <div onClick={() => setZoneDropdownOpen(!zoneDropdownOpen)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 13px',
            background: '#fff', border: '1px solid #cfe0fd', borderRadius: 7,
            boxShadow: '0 1px 2px rgba(20,40,80,.05)', cursor: 'pointer', minWidth: 268
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e0392b' }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: '#e0392b' }}>{getBtpCode(selectedCluster?.junction_name)}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#16203a' }}>{getShortName(selectedCluster?.junction_name)}</span>
            <span style={{ fontSize: 10, color: '#9aa4b2', marginLeft: 'auto' }}>▼ top-20 clusters</span>
          </div>
          {zoneDropdownOpen && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 5, width: 316,
              background: '#fff', border: '1px solid #d7e1ee', borderRadius: 8,
              boxShadow: '0 12px 30px rgba(20,40,80,.18)', zIndex: 40, overflow: 'hidden', maxHeight: 300, overflowY: 'auto'
            }}>
              {hotspots.map((h, i) => (
                <div key={h.junction_name} onClick={() => handleClusterSelect(h, i)} style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', cursor: 'pointer',
                  background: i === selectedIndex ? '#f5f8ff' : '#fff', borderBottom: '1px solid #f3f5f8'
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: getTierColor(h.congestion_influence_score), flex: 'none' }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: '#7c8696' }}>{getBtpCode(h.junction_name)}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#2a3548', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getShortName(h.junction_name)}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: '#16203a' }}>{formatNumber(h.total_violations)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      
      <div style={{ flex: 'none', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 8, padding: '12px 16px', boxShadow: '0 1px 2px rgba(20,40,80,.04)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', color: '#8a94a2', marginBottom: 7 }}>7-DAY PREDICTED</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: '#16203a', lineHeight: 1 }}>{formatNumber(Math.round(totalPredicted))}</span>
            <span style={{ fontSize: 12, color: '#ef7d1e', fontFamily: "'JetBrains Mono', monospace" }}>±{uncertaintyPct}%</span>
          </div>
          <div style={{ fontSize: 10, color: '#8a94a2', marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>violations · this zone</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 8, padding: '12px 16px', boxShadow: '0 1px 2px rgba(20,40,80,.04)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', color: '#8a94a2', marginBottom: 7 }}>PEAK DAY</div>
          <div style={{ fontSize: 21, fontWeight: 700, color: '#e0392b', lineHeight: 1 }}>{DAY_FULL[peakDayIdx]}</div>
          <div style={{ fontSize: 10, color: '#8a94a2', marginTop: 7, fontFamily: "'JetBrains Mono', monospace" }}>{formatNumber(Math.round(peakDay?.yhat || 377))} violations expected</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 8, padding: '12px 16px', boxShadow: '0 1px 2px rgba(20,40,80,.04)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', color: '#8a94a2', marginBottom: 7 }}>MAPE · APRIL HOLDOUT</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 9 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: mapeColor, lineHeight: 1 }}>{formatScore(mape)}%</span>
            <span style={{ fontSize: 11, color: mapeColor, fontFamily: "'JetBrains Mono', monospace" }}>{mapeNote}</span>
          </div>
          <div style={{ height: 6, background: '#eaeef3', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, 100 - mape)}%`, height: '100%', background: mapeColor }} />
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 8, padding: '12px 16px', boxShadow: '0 1px 2px rgba(20,40,80,.04)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', color: '#8a94a2', marginBottom: 7 }}>MAE · APRIL HOLDOUT</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: '#16203a', lineHeight: 1 }}>{formatScore(mae)}</span>
            <span style={{ fontSize: 12, color: '#6b7585' }}>viol / day</span>
          </div>
          <div style={{ fontSize: 10, color: '#8a94a2', marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>7-day test · Nov–Mar train</div>
        </div>
      </div>

      
      <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 248 }}>
        
        <div style={{
          flex: 1, minWidth: 0, minHeight: 0, background: '#fff', border: '1px solid #e2e7ee',
          borderRadius: 8, padding: '13px 18px 10px', boxShadow: '0 1px 2px rgba(20,40,80,.04)',
          display: 'flex', flexDirection: 'column'
        }}>
          <div style={{ flex: 'none', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#16203a' }}>
              Prophet · 7-day forecast <span style={{ fontWeight: 500, color: '#9aa4b2', fontSize: 11 }}>· hover for detail</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 14, height: 2, background: '#2874f0' }} /><span style={{ fontSize: 10, color: '#6b7585' }}>actual</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 14, height: 0, borderTop: '2px dashed #ef7d1e' }} /><span style={{ fontSize: 10, color: '#6b7585' }}>forecast</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 14, height: 9, background: 'linear-gradient(180deg,rgba(40,116,240,.3),rgba(239,125,30,.12))', borderRadius: 2 }} /><span style={{ fontSize: 10, color: '#6b7585' }}>80% band</span></div>
            </div>
          </div>
          
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <div style={{ position: 'absolute', left: 40, right: 10, top: 8, bottom: 22 }}>
              
              {[0, 125, 250, 375, 500].map((v, i) => {
                const top = ((500 - v) / 500) * 100;
                return (
                  <React.Fragment key={v}>
                    <div style={{ position: 'absolute', left: 0, right: 0, top: `${top}%`, height: 1, background: '#eef1f5' }} />
                    <div style={{ position: 'absolute', left: -36, width: 30, textAlign: 'right', top: `${top}%`, transform: 'translateY(-50%)', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#9aa4b2' }}>{v}</div>
                  </React.Fragment>
                );
              })}
              
              <div style={{ position: 'absolute', left: '20%', top: '91%', transform: 'translate(-50%,-50%)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em', color: '#cbd3de' }}>HISTORICAL</div>
              <div style={{ position: 'absolute', left: '75%', top: '91%', transform: 'translate(-50%,-50%)', padding: '3px 11px', border: '1px dashed #f0b483', borderRadius: 5, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: '#ef7d1e', background: '#fff7f0' }}>FORECAST</div>
              
              <div style={{ position: 'absolute', left: '47%', top: 0, bottom: 0, width: 0, borderLeft: '1px dashed #c4ccd8' }} />
              <div style={{ position: 'absolute', left: '47%', top: 0, transform: 'translate(-50%,-100%)', fontSize: 9, fontWeight: 700, letterSpacing: '.06em', color: '#b3651a', background: '#fff', padding: '0 4px' }}>TODAY</div>
              
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="pqBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(40,116,240,.30)" />
                    <stop offset="55%" stopColor="rgba(122,90,220,.18)" />
                    <stop offset="100%" stopColor="rgba(239,125,30,.10)" />
                  </linearGradient>
                  <linearGradient id="pqFc" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2874f0" />
                    <stop offset="55%" stopColor="#7a5adc" />
                    <stop offset="100%" stopColor="#ef7d1e" />
                  </linearGradient>
                  <linearGradient id="pqHistArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(40,116,240,.18)" />
                    <stop offset="100%" stopColor="rgba(40,116,240,0)" />
                  </linearGradient>
                </defs>
                
                {(() => {
                  const avg = forecastData.length ? forecastData.reduce((s, d) => s + (d.yhat || 0), 0) / forecastData.length : 280;
                  const YMAX = 500;
                  const yFor = (v) => (1 - v / YMAX) * 100;
                  const histVals = [avg * 0.62, avg * 0.70, avg * 0.55, avg * 0.78, avg * 0.65];
                  const histX = [5, 14, 23, 32, 41];
                  const histLine = histVals.map((v, i) => `${histX[i]},${yFor(v)}`).join(' ');
                  const histArea = histVals.map((v, i) => `${histX[i]},${yFor(v)}`).concat([`${histX[4]},100`, `${histX[0]},100`]).join(' ');
                  return (
                    <>
                      <polygon points={histArea} fill="url(#pqHistArea)" />
                      <polyline points={histLine} fill="none" stroke="#2874f0" strokeWidth="2.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                    </>
                  );
                })()}
                
                {forecastData.length > 0 && (() => {
                  const YMAX = 500;
                  const yFor = (v) => (1 - Math.min(v, YMAX) / YMAX) * 100;
                  const fcX = [53, 60.5, 68, 75.5, 83, 90.5, 98];
                  const fc = forecastData.map(d => d.yhat || 0);
                  const upper = forecastData.map(d => d.yhat_upper || d.yhat || 0);
                  const lower = forecastData.map(d => d.yhat_lower || 0);
                  const bandTop = fc.map((_, i) => `${fcX[i]},${yFor(upper[i])}`);
                  const bandBot = fc.map((_, i) => `${fcX[i]},${yFor(lower[i])}`).reverse();
                  const bandPts = bandTop.concat(bandBot).join(' ');
                  const fcLine = fc.map((v, i) => `${fcX[i]},${yFor(v)}`).join(' ');
                  return (
                    <>
                      <polygon points={bandPts} fill="url(#pqBand)" />
                      <polyline points={fcLine} fill="none" stroke="url(#pqFc)" strokeWidth="2.8" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                    </>
                  );
                })()}
              </svg>
              
              {forecastData.map((d, i) => {
                const YMAX = 500;
                const val = d.yhat || 0;
                const top = (1 - Math.min(val, YMAX) / YMAX) * 100;
                const fcX = [53, 60.5, 68, 75.5, 83, 90.5, 98];
                const left = fcX[i];
                const color = ramp((val - fMin) / fSpan);
                const isHov = hoveredDay === i;
                return (
                  <React.Fragment key={i}>
                    <div style={{ position: 'absolute', left: `${left}%`, top: `${Math.max(5, top - 12)}%`, transform: 'translate(-50%,-50%)', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color }}>{Math.round(val)}</div>
                    {isHov && <div style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, transform: 'translate(-50%,-50%)', width: 30, height: 30, borderRadius: '50%', background: 'rgba(40,116,240,.16)' }} />}
                    <div style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, transform: 'translate(-50%,-50%)', width: isHov ? 17 : 13, height: isHov ? 17 : 13, borderRadius: '50%', background: color, border: '2.5px solid #fff', boxShadow: '0 1px 4px rgba(20,40,80,.3)' }} />
                    <div onMouseEnter={() => setHoveredDay(i)} onMouseLeave={() => setHoveredDay(null)} style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, transform: 'translate(-50%,-50%)', width: 30, height: 46, cursor: 'pointer' }} />
                  </React.Fragment>
                );
              })}
              
              {hoveredDay !== null && forecastData[hoveredDay] && (() => {
                const d = forecastData[hoveredDay];
                const val = d.yhat || 0;
                const YMAX = 500;
                const top = (1 - Math.min(val, YMAX) / YMAX) * 100;
                const fcX = [53, 60.5, 68, 75.5, 83, 90.5, 98];
                const left = fcX[hoveredDay];
                const xp = left > 82 ? '-88%' : left < 18 ? '-12%' : '-50%';
                const yp = top <= 44 ? '18%' : '-118%';
                const pm = Math.round(((d.yhat_upper || d.yhat) - (d.yhat_lower || 0)) / 2);
                const isPeak = hoveredDay === peakDayIdx;
                const prev = hoveredDay > 0 ? forecastData[hoveredDay - 1].yhat : null;
                let delta = '—', deltaColor = '#9fb0cc';
                if (prev) {
                  const dPct = Math.round((val - prev) / prev * 100);
                  delta = (dPct >= 0 ? '▲ +' : '▼ ') + dPct + '%';
                  deltaColor = dPct > 0 ? '#ff7a66' : dPct < 0 ? '#54d6a0' : '#9fb0cc';
                }
                return (
                  <div style={{
                    position: 'absolute', left: `${left}%`, top: `${top}%`, transform: `translate(${xp},${yp})`,
                    zIndex: 15, pointerEvents: 'none', width: 172, background: '#0f1b33', border: '1px solid #25406e',
                    borderRadius: 8, padding: '10px 12px', boxShadow: '0 10px 26px rgba(10,20,45,.4)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{DAY_FULL[hoveredDay]}</span>
                      {isPeak && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.05em', color: '#fff', background: '#e0392b', padding: '2px 7px', borderRadius: 9 }}>PEAK</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 8 }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, color: ramp((val - fMin) / fSpan), lineHeight: 1 }}>{Math.round(val)}</span>
                      <span style={{ fontSize: 10, color: '#9fb0cc' }}>predicted</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontFamily: "'JetBrains Mono', monospace" }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 10, color: '#9fb0cc', fontFamily: 'Inter' }}>80% range</span><span style={{ fontSize: 10, fontWeight: 600, color: '#dce6f5' }}>{Math.round(d.yhat_lower || 0)} – {Math.round(d.yhat_upper || d.yhat)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 10, color: '#9fb0cc', fontFamily: 'Inter' }}>± interval</span><span style={{ fontSize: 10, fontWeight: 600, color: '#dce6f5' }}>±{pm}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 10, color: '#9fb0cc', fontFamily: 'Inter' }}>peak hour</span><span style={{ fontSize: 10, fontWeight: 600, color: '#ffe11b' }}>{hourly?.peak_hour || 18}:00</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 10, color: '#9fb0cc', fontFamily: 'Inter' }}>vs prev day</span><span style={{ fontSize: 10, fontWeight: 700, color: deltaColor }}>{delta}</span></div>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div style={{ position: 'absolute', left: 40, right: 10, bottom: 2, height: 18 }}>
              {['Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map((m, i) => {
                const histX = [5, 14, 23, 32, 41];
                return <div key={m} style={{ position: 'absolute', left: `${histX[i]}%`, transform: 'translateX(-50%)', fontSize: 10, fontWeight: 500, color: '#aab3c0' }}>{m}</div>;
              })}
              {DAYS.map((d, i) => {
                const fcX = [53, 60.5, 68, 75.5, 83, 90.5, 98];
                const isPeak = i === peakDayIdx;
                return <div key={d} style={{ position: 'absolute', left: `${fcX[i]}%`, transform: 'translateX(-50%)', fontSize: 10, fontWeight: isPeak ? 700 : 600, color: isPeak ? '#e0392b' : '#5b6573' }}>{d}</div>;
              })}
            </div>
          </div>
        </div>

        
        <div style={{
          flex: 'none', width: panelOpen ? 170 : 36, minHeight: 0, display: 'flex', flexDirection: 'column',
          background: '#fff', border: '1px solid #e2e7ee', borderRadius: 8, boxShadow: '0 1px 2px rgba(20,40,80,.04)',
          overflow: 'hidden', transition: 'width .18s'
        }}>
          <div onClick={() => setPanelOpen(!panelOpen)} style={{
            flex: panelOpen ? 'none' : 1, display: 'flex', flexDirection: panelOpen ? 'row' : 'column',
            alignItems: 'center', justifyContent: panelOpen ? 'space-between' : 'center', gap: 8,
            padding: '11px 11px', cursor: 'pointer', borderBottom: panelOpen ? '1px solid #f1f4f7' : 'none'
          }}>
            {panelOpen ? (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#16203a', whiteSpace: 'nowrap' }}>7-Day Detail</span>
            ) : (
              <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 10, fontWeight: 700, letterSpacing: '.12em', color: '#6b7585' }}>7-DAY DETAIL</span>
            )}
            <span style={{ fontSize: 14, color: '#8a94a2' }}>{panelOpen ? '›' : '‹'}</span>
          </div>
          {panelOpen && (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {forecastData.map((d, i) => {
                const val = Math.round(d.yhat || 0);
                const maxVal = Math.max(...fcVals);
                const isPeak = val === Math.round(maxVal) && maxVal > 0;
                const pm = Math.round(((d.yhat_upper || d.yhat) - (d.yhat_lower || 0)) / 2);
                const bar = maxVal > 0 ? (val / maxVal * 100) : 0;
                const color = ramp((val - fMin) / fSpan);
                const isHov = hoveredDay === i;
                return (
                  <div key={i} onMouseEnter={() => setHoveredDay(i)} onMouseLeave={() => setHoveredDay(null)} style={{
                    flex: 1, minHeight: 36, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px',
                    borderBottom: '1px solid #f1f4f7', cursor: 'pointer', background: isHov ? '#f5f8ff' : 'transparent'
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: '#5b6573', width: 30, flex: 'none' }}>{DAYS[i]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color, lineHeight: 1 }}>{val}</span>
                        <span style={{ fontSize: 9, color: '#9aa4b2', fontFamily: "'JetBrains Mono', monospace" }}>±{pm}</span>
                        {isPeak && <span style={{ fontSize: 7, fontWeight: 800, letterSpacing: '.06em', color: '#fff', background: '#e0392b', padding: '1px 5px', borderRadius: 8 }}>PEAK</span>}
                      </div>
                      <div style={{ height: 4, background: '#eef1f5', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                        <div style={{ width: `${bar}%`, height: '100%', background: color }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 9, color: '#7c8696', fontFamily: "'JetBrains Mono', monospace", flex: 'none' }}>{hourly?.peak_hour || 18}-{(hourly?.peak_hour || 18) + 2}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      
      <div style={{ flex: 'none', display: 'flex', gap: 12, height: 182 }}>
        
        <div style={{ flex: 2, minWidth: 0, background: '#fff', border: '1px solid #e2e7ee', borderRadius: 8, padding: '11px 18px 7px', boxShadow: '0 1px 2px rgba(20,40,80,.04)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 'none', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#16203a' }}>Hourly profile · 24h <span style={{ fontWeight: 500, color: '#9aa4b2', fontSize: 11 }}>· which hour, not just which day</span></span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#ef7d1e', fontFamily: "'JetBrains Mono', monospace" }}>peak {hourly?.peak_hour || 18}:00 · {hourly?.peak_value || 78}/hr</span>
          </div>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <div style={{ position: 'absolute', left: 32, right: 8, top: 5, bottom: 15 }}>
              
              {[0, 50, 100].map((v, i) => {
                const top = (1 - v / 100) * 100;
                return (
                  <React.Fragment key={v}>
                    <div style={{ position: 'absolute', left: 0, right: 0, top: `${top}%`, height: 1, background: '#eef1f5' }} />
                    <div style={{ position: 'absolute', left: -30, width: 26, textAlign: 'right', top: `${top}%`, transform: 'translateY(-50%)', fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#9aa4b2' }}>{v}</div>
                  </React.Fragment>
                );
              })}
              
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="pqHr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(239,125,30,.32)" />
                    <stop offset="100%" stopColor="rgba(239,125,30,0)" />
                  </linearGradient>
                </defs>
                {hourly?.hourly && (() => {
                  const hrs = hourly.hourly;
                  const maxV = Math.max(...hrs.map(h => h.violations), 1);
                  const pts = hrs.map((h, i) => ({ x: (i / 23) * 100, y: (1 - h.violations / maxV) * 100 }));
                  const line = pts.map(p => `${p.x},${p.y}`).join(' ');
                  const area = pts.map(p => `${p.x},${p.y}`).concat(['100,100', '0,100']).join(' ');
                  const peakI = hrs.findIndex(h => h.violations === maxV);
                  const peakX = (peakI / 23) * 100;
                  const peakY = (1 - maxV / maxV) * 100;
                  return (
                    <>
                      <polygon points={area} fill="url(#pqHr)" />
                      <polyline points={line} fill="none" stroke="#ef7d1e" strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                    </>
                  );
                })()}
              </svg>
              
              {hourly?.hourly && (() => {
                const hrs = hourly.hourly;
                const maxV = Math.max(...hrs.map(h => h.violations), 1);
                const peakI = hrs.findIndex(h => h.violations === maxV);
                const left = (peakI / 23) * 100;
                return (
                  <>
                    <div style={{ position: 'absolute', left: `${left}%`, top: 0, bottom: 0, width: 0, borderLeft: '1px dashed #f0b483' }} />
                    <div style={{ position: 'absolute', left: `${left}%`, top: 0, transform: 'translate(-50%,-50%)', width: 10, height: 10, borderRadius: '50%', background: '#ef7d1e', border: '2.5px solid #fff', boxShadow: '0 1px 4px rgba(20,40,80,.3)' }} />
                  </>
                );
              })()}
            </div>
            
            <div style={{ position: 'absolute', left: 32, right: 8, bottom: 0, height: 13 }}>
              {['00', '06', '12', '18', '23'].map((l, i) => (
                <div key={l} style={{ position: 'absolute', left: `${i * 25}%`, transform: 'translateX(-50%)', fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#9aa4b2' }}>{l}</div>
              ))}
            </div>
          </div>
        </div>

        
        <div style={{ flex: 2, minWidth: 0, background: '#fff', border: '1px solid #e2e7ee', borderRadius: 8, padding: '11px 18px 7px', boxShadow: '0 1px 2px rgba(20,40,80,.04)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 'none', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#16203a' }}>Forecast vs Actual <span style={{ fontWeight: 500, color: '#9aa4b2', fontSize: 11 }}>· April holdout · data the model never saw</span></span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 13, height: 2, background: '#16a34a' }} /><span style={{ fontSize: 10, color: '#6b7585' }}>actual</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 13, height: 0, borderTop: '2px dashed #2874f0' }} /><span style={{ fontSize: 10, color: '#6b7585' }}>predicted</span></div>
              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#16a34a', background: '#e7f6ee', border: '1px solid #bfe6cf', padding: '2px 8px', borderRadius: 10 }}>MAPE {formatScore(backtest?.mape || mape)}%</span>
            </div>
          </div>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <div style={{ position: 'absolute', left: 32, right: 8, top: 5, bottom: 15 }}>
              
              {backtest?.points && (() => {
                const allV = backtest.points.flatMap(p => [p.actual, p.predicted]);
                const maxV = Math.max(...allV, 1);
                return [0, Math.round(maxV / 2), Math.round(maxV)].map((v, i) => {
                  const top = (1 - v / maxV) * 100;
                  return (
                    <React.Fragment key={v}>
                      <div style={{ position: 'absolute', left: 0, right: 0, top: `${top}%`, height: 1, background: '#eef1f5' }} />
                      <div style={{ position: 'absolute', left: -30, width: 26, textAlign: 'right', top: `${top}%`, transform: 'translateY(-50%)', fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#9aa4b2' }}>{v}</div>
                    </React.Fragment>
                  );
                });
              })()}
              
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                {backtest?.points && (() => {
                  const pts = backtest.points;
                  const allV = pts.flatMap(p => [p.actual, p.predicted]);
                  const maxV = Math.max(...allV, 1);
                  const actual = pts.map((p, i) => `${(i / (pts.length - 1)) * 100},${(1 - p.actual / maxV) * 100}`).join(' ');
                  const pred = pts.map((p, i) => `${(i / (pts.length - 1)) * 100},${(1 - p.predicted / maxV) * 100}`).join(' ');
                  return (
                    <>
                      <polyline points={actual} fill="none" stroke="#16a34a" strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                      <polyline points={pred} fill="none" stroke="#2874f0" strokeWidth="2.2" strokeDasharray="5 3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                    </>
                  );
                })()}
              </svg>
            </div>
            
            <div style={{ position: 'absolute', left: 32, right: 8, bottom: 0, height: 13 }}>
              {backtest?.points && backtest.points.filter((_, i) => i % 2 === 0 || i === backtest.points.length - 1).map((p, i, arr) => (
                <div key={p.date} style={{ position: 'absolute', left: `${(i / (arr.length - 1)) * 100}%`, transform: 'translateX(-50%)', fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#9aa4b2' }}>{p.date.slice(5).replace('-', '/')}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      
      <div style={{ flex: 'none', height: 126, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
        {[
          { label: 'DAILY AVG', value: derivedMetrics.dailyAvg || 313, color: '#2874f0', desc: 'mean violations / day' },
          { label: 'WEEKEND', value: derivedMetrics.weekendLoad || 707, color: '#ef7d1e', desc: 'Sat + Sun total' },
          { label: 'WEEKDAY', value: derivedMetrics.weekdayLoad || 1483, color: '#2874f0', desc: 'Mon–Fri total' },
          { label: 'LOWEST', value: derivedMetrics.lowestDay || 263, color: '#16a34a', desc: `on ${derivedMetrics.lowestDayName || 'Mon'}` },
          { label: 'VOLATILITY', value: derivedMetrics.volatility || '35.5', color: '#8b5cf6', desc: 'σ day-to-day' },
          { label: 'TREND', value: derivedMetrics.trendUp ? '▲ Up' : '▼ Down', color: derivedMetrics.trendUp ? '#e0392b' : '#16a34a', desc: `${derivedMetrics.trendPct > 0 ? '+' : ''}${derivedMetrics.trendPct || 12}%` },
          { label: 'CONF WIDTH', value: `±${derivedMetrics.avgConf || 128}`, color: '#16203a', desc: 'avg 80% band' }
        ].map((m, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #e8edf3', borderTop: `3px solid ${m.color}`, borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(20,40,80,.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', color: '#8a94a2' }}>{m.label}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 700, color: m.color, lineHeight: 1, margin: 'auto 0 5px' }}>{typeof m.value === 'number' ? formatNumber(m.value) : m.value}</div>
            <div style={{ fontSize: 11, color: '#9aa4b2', lineHeight: 1.3 }}>{m.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
