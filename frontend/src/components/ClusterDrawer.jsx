import React, { useEffect, useState } from 'react';
import { api, getTierColor } from '../services/api';
import { formatNumber, formatScore } from '../utils/formatters';

export default function ClusterDrawer({ junctionName, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!junctionName) return;
    setLoading(true);
    api.getHotspotDetail(junctionName)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [junctionName]);

  if (!junctionName) return null;

  const tierColor = data ? getTierColor(data.congestion_influence_score) : '#e0392b';


  const maxRecurrence = data?.chronic_patterns?.length > 0
    ? Math.max(...data.chronic_patterns.map(p => p.recurrence_rate || p.recurrence_pct / 100 || 0))
    : 0;

  return (
    <div style={{
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: 338,
      background: 'rgba(255, 255, 255, 0.97)',
      borderLeft: '1px solid #e2e7ee',
      zIndex: 8,
      boxShadow: '-16px 0 44px rgba(20, 40, 80, 0.16)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: '#fff4f1',
        padding: '14px 16px',
        borderBottom: '1px solid #f3d3cb',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}>
          <div>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: '#c0584a',
              marginBottom: 6,
            }}>
              ● CLUSTER · CRITICAL
            </div>
            {loading ? (
              <div style={{ color: '#8a94a2' }}>Loading...</div>
            ) : (
              <>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#e0392b',
                  marginBottom: 4,
                }}>
                  {data?.btp_code || 'BTP---'}
                </div>
                <div style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#3a1410',
                  marginBottom: 4,
                }}>
                  {data?.junction_name || junctionName}
                </div>
                <div style={{
                  fontSize: 10,
                  color: '#b07567',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {data?.lat?.toFixed(4)}, {data?.lon?.toFixed(4)}
                </div>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              fontSize: 14,
              color: '#9aa4b2',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="pq-scrl" style={{
        flex: 1,
        overflowY: 'auto',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#8a94a2', padding: 20 }}>
            Loading cluster data...
          </div>
        ) : data ? (
          <>
            {/* Score tiles */}
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{
                flex: 1,
                background: '#fff4f1',
                borderRadius: 6,
                padding: 12,
              }}>
                <div style={{ fontSize: 10, color: '#b07567', marginBottom: 4 }}>
                  IMPACT SCORE
                </div>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 24,
                  fontWeight: 700,
                  color: tierColor,
                }}>
                  {formatScore(data.congestion_influence_score)}
                </div>
              </div>
              <div style={{
                flex: 1,
                background: '#f0f7ff',
                borderRadius: 6,
                padding: 12,
              }}>
                <div style={{ fontSize: 10, color: '#6b8ab3', marginBottom: 4 }}>
                  MAX RECURRENCE
                </div>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#1b5bd0',
                }}>
                  {formatScore(maxRecurrence * 100)}%
                </div>
              </div>
            </div>

            {/* Violation count */}
            <div style={{
              background: '#f5f7fa',
              borderRadius: 6,
              padding: 12,
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: '#5b6573' }}>Total Violations</span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#16203a',
                }}>
                  {formatNumber(data.total_violations)}
                </span>
              </div>
            </div>

            {/* Chronic patterns */}
            {data.chronic_patterns && data.chronic_patterns.length > 0 && (
              <div>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#5b6573',
                  marginBottom: 8,
                }}>
                  Top Chronic Patterns
                </div>
                {data.chronic_patterns.slice(0, 3).map((pattern, idx) => (
                  <div key={idx} style={{
                    background: pattern.is_structural ? '#fff7ed' : '#f5f7fa',
                    borderRadius: 4,
                    padding: 8,
                    marginBottom: 6,
                    fontSize: 10,
                  }}>
                    <div style={{ color: '#3a4759', marginBottom: 2 }}>
                      {pattern.dow} · {pattern.hour_label}
                    </div>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      color: pattern.is_structural ? '#ef7d1e' : '#6b7585',
                    }}>
                      {pattern.recurrence_pct?.toFixed(0)}% recurrence · {pattern.vehicle_type}
                    </div>
                    {pattern.is_structural && (
                      <div style={{
                        marginTop: 4,
                        padding: '2px 6px',
                        background: '#fdeae6',
                        borderRadius: 3,
                        display: 'inline-block',
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#c0392b',
                      }}>
                        STRUCTURAL
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Top violation info */}
            <div>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#5b6573',
                marginBottom: 8,
              }}>
                Top Violation
              </div>
              {data.top_violation && (
                <div style={{
                  background: '#f5f7fa',
                  borderRadius: 4,
                  padding: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#16203a',
                }}>
                  {data.top_violation}
                </div>
              )}
            </div>

            {/* Top vehicle */}
            <div>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#5b6573',
                marginBottom: 8,
              }}>
                Top Vehicle Type
              </div>
              {data.top_vehicle && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#2874f0',
                  }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#16203a' }}>
                    {data.top_vehicle}
                  </span>
                </div>
              )}
            </div>

            {/* Peak hour */}
            {data.peak_hour_ist !== undefined && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: 11, color: '#5b6573' }}>Peak Hour</span>
                <span style={{
                  padding: '3px 8px',
                  background: '#fbe0d9',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#c0392b',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {data.peak_hour_ist}:00 - {data.peak_hour_ist + 1}:00
                </span>
              </div>
            )}

            {/* Monthly trend */}
            {data.monthly_counts && (
              <div>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#5b6573',
                  marginBottom: 8,
                }}>
                  Monthly Trend
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 4,
                  height: 50,
                }}>
                  {Object.entries(data.monthly_counts).map(([month, count]) => {
                    const maxCount = Math.max(...Object.values(data.monthly_counts));
                    const height = (count / maxCount) * 100;
                    return (
                      <div key={month} style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                      }}>
                        <div style={{
                          width: '100%',
                          height: `${height}%`,
                          minHeight: 4,
                          background: 'linear-gradient(180deg, #2874f0, #1b4fc4)',
                          borderRadius: 2,
                        }} />
                        <span style={{
                          fontSize: 9,
                          color: '#9aa4b2',
                          marginTop: 4,
                        }}>
                          {month.slice(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}


            {/* Recommended action */}
            <div style={{
              background: data.congestion_influence_score >= 80 ? '#fdeae6' : '#e6f7ef',
              border: `1px solid ${data.congestion_influence_score >= 80 ? '#f4cfc6' : '#c3e6d1'}`,
              borderRadius: 6,
              padding: 12,
            }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                color: data.congestion_influence_score >= 80 ? '#c0392b' : '#1aa260',
                marginBottom: 4,
              }}>
                RECOMMENDED ACTION
              </div>
              <div style={{
                fontSize: 12,
                color: data.congestion_influence_score >= 80 ? '#5a2018' : '#155724',
              }}>
                {data.congestion_influence_score >= 80
                  ? 'TOW + CHALLAN · Deploy senior officer'
                  : 'CHALLAN + MOVE VEHICLE'}
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: '#8a94a2', padding: 20 }}>
            No data available
          </div>
        )}
      </div>
    </div>
  );
}
