import React, { useEffect, useState, useCallback } from 'react';
import { api, getTierColor } from '../services/api';
import { formatNumber, formatScore } from '../utils/formatters';
import KPICard from '../components/KPICard';

const SHIFT_COLORS = {
  morning: { bg: '#fdf0d8', text: '#b3651a', bar: '#f2a01a' },
  afternoon: { bg: '#e9f1ff', text: '#1b5bd0', bar: '#2874f0' },
  evening: { bg: '#fbe0d9', text: '#c0392b', bar: '#e0392b' },
  night: { bg: '#fbe0d9', text: '#c0392b', bar: '#e0392b' },
};

const ACTION_STYLES = {
  'TOW+CHALLAN': { bg: '#fdeae6', text: '#c0392b', border: '#f4cfc6' },
  'CHALLAN': { bg: '#eaf2ff', text: '#1b5bd0', border: '#cfe0fd' },
  'REMOVE': { bg: '#fdf3e3', text: '#b3651a', border: '#f0dcb4' },
};

export default function Deploy({ filters }) {
  const [officers, setOfficers] = useState(42);
  const [deployData, setDeployData] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [loading, setLoading] = useState(true);


  const fetchDeploy = useCallback((numOfficers) => {
    api.getDeploy(numOfficers, filters.shift, filters.zone)
      .then(setDeployData)
      .catch(console.error);
  }, [filters.shift, filters.zone]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getDeploy(officers, filters.shift, filters.zone),
      api.getHeatmap()
    ])
      .then(([deploy, heatmap]) => {
        setDeployData(deploy);
        setHeatmapData(heatmap);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters.shift, filters.zone]);


  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDeploy(officers);
    }, 300);
    return () => clearTimeout(timer);
  }, [officers, fetchDeploy]);

  const deployments = deployData?.deployment || [];
  const rawShiftDist = deployData?.shift_distribution || {};
  const shiftDist = {
    morning: {
      officers: rawShiftDist.morning_6_11am || 14,
      pct: ((rawShiftDist.morning_6_11am || 14) / officers) * 100
    },
    afternoon: {
      officers: rawShiftDist.afternoon_12_5pm || 12,
      pct: ((rawShiftDist.afternoon_12_5pm || 12) / officers) * 100
    },
    evening: {
      officers: rawShiftDist.evening_6_11pm || 16,
      pct: ((rawShiftDist.evening_6_11pm || 16) / officers) * 100
    },
  };

  const totalDeployed = Object.values(shiftDist).reduce((sum, s) => sum + s.officers, 0);
  const coverage = deployData?.coverage_pct || 68.4;
  const peakShift = Object.entries(shiftDist).reduce((max, [shift, data]) =>
    data.officers > max.officers ? { shift, ...data } : max
  , { shift: 'evening', officers: 0 });

  const exportCSV = () => {
    const headers = ['Rank', 'Junction', 'CIS', 'Shift', 'Officers', 'Action'];
    const rows = deployments.map((d, i) => [
      i + 1,
      d.junction_name,
      d.congestion_influence_score?.toFixed(1),
      d.shift,
      d.officers,
      d.action
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jamnagar_deployment_${officers}officers.csv`;
    a.click();
  };

  return (
    <div className="pq-scrl" style={{ display: 'flex', flexDirection: 'column', gap: 13, height: '100%', overflow: 'auto', paddingBottom: 14 }}>
      
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: '#16203a', margin: 0 }}>
            Deploy
          </h1>
          <p style={{ fontSize: 12, color: '#8a94a2', margin: '4px 0 0' }}>
            Impact-weighted officer allocation
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          
          <div style={{
            padding: '7px 9px 7px 14px',
            background: '#fff',
            border: '1px solid #cfe0fd',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7585' }}>
              OFFICERS AVAILABLE
            </span>
            <button
              onClick={() => setOfficers(Math.max(1, officers - 1))}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: '#eef3fb',
                border: '1px solid #d3e1fb',
                fontSize: 17,
                fontWeight: 700,
                color: '#2874f0',
                cursor: 'pointer',
              }}
            >
              −
            </button>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 21,
              fontWeight: 700,
              color: '#16203a',
              width: 38,
              textAlign: 'center',
            }}>
              {officers}
            </span>
            <button
              onClick={() => setOfficers(officers + 1)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: '#2874f0',
                border: '1px solid #2160d6',
                fontSize: 17,
                fontWeight: 700,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              +
            </button>
            <input
              type="range"
              min="10"
              max="100"
              value={officers}
              onChange={(e) => setOfficers(parseInt(e.target.value))}
              style={{ width: 100, accentColor: '#2874f0' }}
            />
          </div>

          
          <button
            onClick={exportCSV}
            style={{
              padding: '8px 13px',
              background: '#fff',
              border: '1px solid #e2e7ee',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              color: '#3a4759',
              cursor: 'pointer',
            }}
          >
            ⤓ CSV
          </button>
          <button
            onClick={() => window.print()}
            style={{
              padding: '8px 13px',
              background: '#e0392b',
              border: '1px solid #c5301f',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            ⤓ PDF
          </button>
        </div>
      </div>

      
      <div className="kpi-grid">
        <KPICard
          label="OFFICERS DEPLOYED"
          value={totalDeployed}
          sub={`across ${deployments.length} junctions`}
        />

        <KPICard
          label="PROJECTED COVERAGE"
          value={`${formatScore(coverage)}%`}
        >
          <div className="progress-bar" style={{ marginTop: 8 }}>
            <div className="fill" style={{ width: `${coverage}%` }} />
          </div>
          <div style={{ fontSize: 10, color: '#8a94a2', marginTop: 6 }}>
            of head violations
          </div>
        </KPICard>

        <KPICard
          label="PEAK SHIFT LOAD"
          value={
            <span>
              <span style={{ textTransform: 'capitalize' }}>{peakShift.shift}</span>
              <span style={{
                marginLeft: 8,
                color: '#e0392b',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {peakShift.officers}
              </span>
            </span>
          }
          sub="officers"
        />

        <KPICard
          label="UNCOVERED JUNCTIONS"
          isAlert={true}
          labelDot={true}
          value={deployData?.uncovered_junctions || 3}
          sub="of top 20"
        />
      </div>

      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
        
        <div className="card" style={{ overflow: 'hidden' }}>
          
          <div style={{
            background: '#f5f7fa',
            borderBottom: '1px solid #e8edf3',
            padding: '9px 12px',
            display: 'grid',
            gridTemplateColumns: '30px 1fr 50px 70px 60px 90px',
            gap: 8,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#8a94a2',
            textTransform: 'uppercase',
          }}>
            <span>#</span>
            <span>Junction</span>
            <span>CIS</span>
            <span>Shift</span>
            <span>Off.</span>
            <span>Action</span>
          </div>

          
          <div className="pq-scrl" style={{ maxHeight: 320, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#8a94a2' }}>
                Loading deployments...
              </div>
            ) : (
              deployments.map((d, idx) => {
                const shiftStyle = SHIFT_COLORS[d.shift?.toLowerCase()] || SHIFT_COLORS.morning;
                const actionStyle = ACTION_STYLES[d.action] || ACTION_STYLES.CHALLAN;

                return (
                  <div
                    key={d.junction_name}
                    style={{
                      padding: '9px 12px',
                      borderBottom: '1px solid #f0f3f7',
                      display: 'grid',
                      gridTemplateColumns: '30px 1fr 50px 70px 60px 90px',
                      gap: 8,
                      alignItems: 'center',
                      background: idx === 0 ? '#fff7f5' : 'transparent',
                    }}
                  >
                    <span style={{ fontSize: 10, color: '#9aa4b2' }}>
                      {d.rank || idx + 1}
                    </span>
                    <div>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#6b7585',
                      }}>
                        {d.short_name?.slice(0, 5) || `BTP${String(idx + 1).padStart(3, '0')}`}
                      </span>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#1f2a3d',
                        marginLeft: 6,
                      }}>
                        {d.short_name?.slice(0, 18) || d.junction_name?.replace(/^BTP\d+\s*-?\s*/, '').slice(0, 18)}
                      </span>
                    </div>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 13,
                      fontWeight: 700,
                      color: getTierColor(d.congestion_influence_score),
                    }}>
                      {formatScore(d.congestion_influence_score)}
                    </span>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      background: shiftStyle.bg,
                      color: shiftStyle.text,
                      textTransform: 'capitalize',
                    }}>
                      {d.dominant_shift?.toLowerCase() === 'night' ? 'evening' : (d.dominant_shift?.toLowerCase() || 'morning')}
                    </span>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 13,
                      fontWeight: 700,
                      color: d.officers_assigned > 0 ? '#16203a' : '#c3c9d2',
                    }}>
                      {d.officers_assigned || 0}
                    </span>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      background: actionStyle.bg,
                      color: actionStyle.text,
                      border: `1px solid ${actionStyle.border}`,
                    }}>
                      {d.action}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        
        <div className="card">
          <div style={{ padding: '15px 17px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#16203a', marginBottom: 16 }}>
              Shift distribution
            </div>

            {Object.entries(shiftDist).map(([shift, data]) => {
              const style = SHIFT_COLORS[shift];
              return (
                <div key={shift} style={{ marginBottom: 16 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: style.bar,
                      }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#16203a', textTransform: 'capitalize' }}>
                        {shift}
                      </span>
                      <span style={{
                        fontSize: 11,
                        color: '#8a94a2',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>
                        {shift === 'morning' ? '6-11 AM' : shift === 'afternoon' ? '12-5 PM' : '6-11 PM'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 22,
                        fontWeight: 700,
                        color: '#16203a',
                      }}>
                        {data.officers}
                      </span>
                      <span style={{
                        fontSize: 11,
                        color: '#8a94a2',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>
                        {data.pct?.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div style={{
                    height: 5,
                    background: '#eaeef3',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${data.pct}%`,
                      background: style.bar,
                      borderRadius: 3,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      
      <div className="card">
        <div style={{ padding: '15px 17px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#16203a', marginBottom: 14 }}>
            Violation action guide
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 11,
          }}>
            {[
              { type: 'WRONG PARKING', action: 'CHALLAN', color: '#2874f0' },
              { type: 'NO PARKING', action: 'TOW+CHALLAN', color: '#e0392b' },
              { type: 'DOUBLE PARKING', action: 'TOW+CHALLAN', color: '#e0392b' },
              { type: 'PARKING IN MAIN ROAD', action: 'REMOVE', color: '#ef7d1e' },
            ].map(({ type, action, color }) => (
              <div key={type} style={{
                padding: 12,
                background: '#f5f7fa',
                borderRadius: 6,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1f2a3d', marginBottom: 8 }}>
                  {type}
                </div>
                <div style={{
                  width: 24,
                  height: 3,
                  background: color,
                  borderRadius: 2,
                  marginBottom: 8,
                }} />
                <span style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  background: ACTION_STYLES[action]?.bg,
                  color: ACTION_STYLES[action]?.text,
                  border: `1px solid ${ACTION_STYLES[action]?.border}`,
                }}>
                  {action}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      
      <div className="card">
        <div style={{ padding: '15px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#16203a', marginBottom: 14 }}>
            Junction · peak-hour intensity
          </div>

          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '70px repeat(9, 1fr)',
            gap: 4,
            marginBottom: 8,
          }}>
            <div style={{ fontSize: 10, color: '#8a94a2' }}>Junction</div>
            {['6-8', '8-10', '10-12', '12-14', '14-16', '16-18', '18-20', '20-22', '22-24'].map(h => (
              <div key={h} style={{
                textAlign: 'center',
                fontSize: 10,
                color: '#8a94a2',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {h}
              </div>
            ))}
          </div>

          
          <div>
            {(heatmapData?.junctions || []).map((junctionName, jIdx) => {
              const shortName = heatmapData?.short_names?.[junctionName] || junctionName;
              const hourData = heatmapData?.matrix?.[junctionName] || {};


              const allValues = Object.values(hourData);
              const maxVal = Math.max(...allValues, 1);


              const timeSlots = [
                [6, 7], [8, 9], [10, 11], [12, 13], [14, 15], [16, 17], [18, 19], [20, 21], [22, 23]
              ];

              return (
                <div
                  key={junctionName}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '70px repeat(9, 1fr)',
                    gap: 4,
                    marginBottom: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#6b7585',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {shortName.slice(0, 10)}
                    </span>
                  </div>
                  {timeSlots.map((slot, hIdx) => {

                    const value = (hourData[slot[0]] || 0) + (hourData[slot[1]] || 0);
                    const intensity = value / (maxVal * 2);

                    let bg, textColor;
                    if (intensity >= 0.75) {
                      bg = '#e0392b'; textColor = '#fff';
                    } else if (intensity >= 0.50) {
                      bg = '#f2a01a'; textColor = '#5a3a05';
                    } else if (intensity >= 0.25) {
                      bg = '#9ec3f7'; textColor = '#1b3a6e';
                    } else if (intensity > 0) {
                      bg = '#e8f0fe'; textColor = '#7c8696';
                    } else {
                      bg = '#f4f6f9'; textColor = '#c3c9d2';
                    }

                    return (
                      <div
                        key={hIdx}
                        style={{
                          height: 32,
                          borderRadius: 4,
                          background: bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 600,
                          color: textColor,
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        {value > 0 ? value : ''}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
