import React, { useEffect, useState } from 'react';
import { api, getTierColor } from '../services/api';
import { formatNumber, formatScore } from '../utils/formatters';
import KPICard from '../components/KPICard';

export default function Intel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getIntel()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const rawFunnel = data?.funnel || {};
  const funnel = {
    recorded: rawFunnel.total || 298450,
    sent_to_scita: (rawFunnel.total || 298450) - (rawFunnel.null_unreviewed || 125254),
    approved: rawFunnel.approved || 115400,
    rejected: rawFunnel.rejected || 49754,
    unreviewed: rawFunnel.null_unreviewed || 125254,
  };

  const stations = data?.station_scorecards || [];
  const metrics = data?.model_metrics || {};
  const decayTrends = data?.decay_data || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: '#16203a', margin: 0 }}>
            Enforcement Intel
          </h1>
          <p style={{ fontSize: 12, color: '#8a94a2', margin: '4px 0 0' }}>
            Pipeline quality · station scorecards · model diagnostics
          </p>
        </div>
        <span style={{
          padding: '4px 9px',
          background: '#fff',
          border: '1px solid #e2e7ee',
          borderRadius: 5,
          fontSize: 11,
          color: '#6b7585',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          Jan – Apr 2024 holdout
        </span>
      </div>

      
      <div className="kpi-grid">
        <KPICard
          label="TOTAL RECORDS"
          value={formatNumber(funnel.recorded)}
        />

        <KPICard
          label="APPROVED CHALLANS"
          value={
            <span>
              {formatNumber(funnel.approved)}
              <span style={{ fontSize: 13, color: '#1aa260', marginLeft: 8 }}>
                {((funnel.approved / funnel.recorded) * 100).toFixed(1)}%
              </span>
            </span>
          }
        >
          <div className="progress-bar" style={{ marginTop: 8 }}>
            <div className="fill" style={{
              width: `${(funnel.approved / funnel.recorded) * 100}%`
            }} />
          </div>
        </KPICard>

        <KPICard
          label="MEDIAN APPROVAL RATE"
          value="64.8%"
          sub={
            <span style={{ color: '#ef7d1e' }}>
              1 station flagged
            </span>
          }
        />

        <KPICard
          label="ANOMALY FLAGS"
          isAlert={true}
          labelDot={true}
          value="7"
          sub="junctions + 1 device · Isolation Forest · contamination 0.03"
        />
      </div>

      
      <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 13 }}>
        
        <div className="card">
          <div style={{ padding: '15px 18px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#16203a' }}>
                Enforcement funnel
              </span>
              <span style={{
                fontSize: 11,
                color: '#8a94a2',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {formatNumber(funnel.recorded)} → {formatNumber(funnel.approved)} · 38.7% yield
              </span>
            </div>

            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Recorded', count: funnel.recorded, color: '#1b4fc4', width: 100 },
                { label: 'Sent to SCITA', count: funnel.sent_to_scita, color: '#2160d6', width: 75 },
                { label: 'Under Review', count: funnel.sent_to_scita - funnel.rejected, color: '#2874f0', width: 55 },
                { label: 'Approved', count: funnel.approved, color: '#1aa260', width: 42 },
              ].map((stage, idx) => (
                <div key={stage.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: `${stage.width}%`,
                    height: 32,
                    background: stage.color,
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#fff',
                    }}>
                      {stage.label}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#16203a',
                  }}>
                    {formatNumber(stage.count)}
                  </span>
                  <span style={{
                    padding: '2px 7px',
                    background: '#f5f7fa',
                    border: '1px solid #e2e7ee',
                    borderRadius: 4,
                    fontSize: 11,
                    color: '#3a4759',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {((stage.count / funnel.recorded) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>

            
            <div style={{
              marginTop: 16,
              padding: 12,
              background: '#fff4f1',
              borderRadius: 6,
              border: '1px solid #f3d3cb',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 6,
              }}>
                <span style={{ color: '#e0392b', fontSize: 14 }}>↪</span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#e0392b',
                }}>
                  {formatNumber(funnel.unreviewed)}
                </span>
                <span style={{ fontSize: 12, color: '#5a2018' }}>
                  never reviewed (42%)
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{ color: '#ef7d1e', fontSize: 14 }}>↪</span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#ef7d1e',
                }}>
                  {formatNumber(funnel.rejected)}
                </span>
                <span style={{ fontSize: 12, color: '#5a2018' }}>
                  rejected
                </span>
              </div>
            </div>
          </div>
        </div>

        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          
          <div className="card">
            <div style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#16203a', marginBottom: 12 }}>
                Model diagnostics
              </div>

              {[
                { label: 'XGBoost R²', value: metrics.xgboost_r2 || 0.7985, color: '#1aa260', suffix: ' good' },
                { label: 'Spearman ρ', value: metrics.xgboost_spearman || 0.8843, color: '#2874f0', suffix: ' strong' },
                { label: 'Prophet MAPE', value: `${metrics.prophet_best_cluster_accuracy?.cluster_12?.mape || 23.2}%`, color: '#1aa260', suffix: ' ok' },
              ].map(({ label, value, color, suffix }) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 11, color: '#6b7585' }}>{label}</span>
                    <span>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 12,
                        fontWeight: 700,
                        color: color,
                      }}>
                        {typeof value === 'number' ? value.toFixed(4) : value}
                      </span>
                      <span style={{ fontSize: 10, color: color, marginLeft: 4 }}>
                        {suffix}
                      </span>
                    </span>
                  </div>
                  <div style={{ height: 5, background: '#eaeef3', borderRadius: 3 }}>
                    <div style={{
                      height: '100%',
                      width: `${typeof value === 'number' ? value * 100 : 77}%`,
                      background: color,
                      borderRadius: 3,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          
          <div style={{
            background: '#fff4f1',
            border: '1px solid #f3d3cb',
            borderRadius: 8,
            padding: '14px 16px',
          }}>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#c0392b',
              marginBottom: 10,
            }}>
              ⚠ Device anomaly · FKDEV00021
            </div>

            <div style={{ marginBottom: 8 }}>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 24,
                fontWeight: 700,
                color: '#e0392b',
              }}>
                39.3%
              </span>
              <span style={{ fontSize: 12, color: '#5a2018', marginLeft: 8 }}>
                of Kodigehalli
              </span>
            </div>

            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              color: '#5a2018',
              marginBottom: 10,
            }}>
              50.6% approval rate
            </div>

            <span style={{
              display: 'inline-block',
              padding: '3px 8px',
              background: '#fdeae6',
              color: '#c0392b',
              border: '1px solid #f4cfc6',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              marginBottom: 10,
            }}>
              Isolation Forest flagged
            </span>

            <div style={{ fontSize: 11, color: '#8a94a2', lineHeight: 1.4 }}>
              Recommendation: Audit this device and review all its filed violations
            </div>
          </div>
        </div>
      </div>

      
      <div className="card">
        <div style={{ padding: '15px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#16203a', marginBottom: 14 }}>
            Station quality scorecards
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 11,
          }}>
            {(stations.length ? stations.map(s => ({
              name: s.station,
              code: s.station?.slice(0, 3).toUpperCase(),
              approval: s.approval_rate,
              null_rate: s.null_rate,
              rejection: s.rejection_rate,
              flagged: !!s.flag,
            })) : [
              { name: 'Koramangala', code: 'KRM', approval: 72.4, null_rate: 8.2, rejection: 19.4, flagged: false },
              { name: 'Whitefield', code: 'WFD', approval: 68.1, null_rate: 12.4, rejection: 19.5, flagged: false },
              { name: 'Indiranagar', code: 'IND', approval: 71.8, null_rate: 9.8, rejection: 18.4, flagged: false },
              { name: 'Kodigehalli', code: 'KDG', approval: 50.6, null_rate: 24.8, rejection: 24.6, flagged: true },
              { name: 'Jayanagar', code: 'JYN', approval: 74.2, null_rate: 7.4, rejection: 18.4, flagged: false },
              { name: 'Malleshwaram', code: 'MLW', approval: 69.5, null_rate: 11.2, rejection: 19.3, flagged: false },
            ]).map((station) => (
              <div
                key={station.name}
                style={{
                  background: station.flagged ? '#fff4f1' : '#ffffff',
                  border: `1px solid ${station.flagged ? '#f3d3cb' : '#e8edf3'}`,
                  borderRadius: 7,
                  padding: 12,
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 10,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2a3d' }}>
                      {station.name}
                    </div>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 11,
                      color: '#6b7585',
                    }}>
                      {station.code}
                    </div>
                  </div>
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 9,
                    fontWeight: 700,
                    background: station.flagged ? '#fdeae6' : station.approval >= 70 ? '#e6f7ef' : '#f5f7fa',
                    color: station.flagged ? '#c0392b' : station.approval >= 70 ? '#1aa260' : '#8a94a2',
                  }}>
                    {station.flagged ? 'FLAGGED' : station.approval >= 70 ? 'HEALTHY' : 'OK'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#8a94a2', marginBottom: 2 }}>Approval</div>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 14,
                      fontWeight: 700,
                      color: station.approval >= 65 ? '#1aa260' : '#e0392b',
                    }}>
                      {station.approval.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#8a94a2', marginBottom: 2 }}>Null</div>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 14,
                      fontWeight: 700,
                      color: station.null_rate > 15 ? '#e0392b' : '#ef7d1e',
                    }}>
                      {station.null_rate.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#8a94a2', marginBottom: 2 }}>Reject</div>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#6b7585',
                    }}>
                      {station.rejection.toFixed(1)}%
                    </div>
                  </div>
                </div>

                
                <div style={{
                  height: 4,
                  background: '#eaeef3',
                  borderRadius: 2,
                  marginTop: 8,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${station.null_rate * 3}%`,
                    background: station.null_rate > 15 ? '#e0392b' : '#ef7d1e',
                    borderRadius: 2,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      
      <div className="card">
        <div style={{ padding: '15px 18px' }}>
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#16203a' }}>
              Enforcement decay · 5-month violation trend
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#8a94a2', marginBottom: 14 }}>
            rising = enforcement not deterring · flat = no measurable effect
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 11,
          }}>
            {[
              { name: 'KR Market Junction', code: 'BTP082', delta: '+158%', color: '#e0392b', points: '0,40 40,35 80,30 120,20 160,8 200,4' },
              { name: 'Safina Plaza', code: 'BTP051', delta: 'Stable', color: '#ef7d1e', points: '0,22 40,24 80,22 120,23 160,22 200,22' },
              { name: 'Modi Bridge', code: 'BTP027', delta: '+42%', color: '#e0392b', points: '0,35 40,32 80,28 120,22 160,18 200,14' },
              { name: 'Yeshwanthpur', code: 'BTP045', delta: '-8%', color: '#1aa260', points: '0,18 40,20 80,22 120,24 160,26 200,28' },
            ].map((item) => (
              <div
                key={item.code}
                style={{
                  border: '1px solid #e8edf3',
                  borderRadius: 7,
                  padding: '12px 13px',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 8,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2a3d' }}>
                      {item.name}
                    </div>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 10,
                      color: '#8a94a2',
                    }}>
                      {item.code}
                    </div>
                  </div>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 14,
                    fontWeight: 700,
                    color: item.color,
                  }}>
                    {item.delta}
                  </span>
                </div>

                <svg width="100%" height="44" viewBox="0 0 200 44" preserveAspectRatio="none">
                  <polyline
                    points={item.points}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="2"
                  />
                  <circle
                    cx={item.points.split(' ').pop().split(',')[0]}
                    cy={item.points.split(' ').pop().split(',')[1]}
                    r="4"
                    fill={item.color}
                  />
                </svg>
              </div>
            ))}
          </div>
        </div>
      </div>

      
      <div className="card">
        <div style={{ padding: '15px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#16203a', marginBottom: 14 }}>
            Full model metrics
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e8edf3' }}>
                <th style={{ padding: '8px 0', textAlign: 'left', color: '#8a94a2', fontWeight: 600 }}>Model</th>
                <th style={{ padding: '8px 0', textAlign: 'left', color: '#8a94a2', fontWeight: 600 }}>Metric</th>
                <th style={{ padding: '8px 0', textAlign: 'right', color: '#8a94a2', fontWeight: 600 }}>Value</th>
                <th style={{ padding: '8px 0', textAlign: 'left', color: '#8a94a2', fontWeight: 600, paddingLeft: 16 }}>Interpretation</th>
              </tr>
            </thead>
            <tbody>
              {[
                { model: 'XGBoost', metric: 'R² (test)', value: '0.7985', interp: 'Model explains 80% of chronic recurrence variance' },
                { model: 'XGBoost', metric: 'Spearman ρ', value: '0.8843', interp: 'Rankings agree with ground truth 88.4%' },
                { model: 'XGBoost', metric: 'RMSE', value: '0.0804', interp: 'Average error on 0-1 recurrence scale' },
                { model: 'XGBoost', metric: 'Top feature', value: 'total_violations', interp: 'High-volume junctions have predictable patterns' },
                { model: 'DBSCAN', metric: 'Clusters', value: '156', interp: 'Spatially significant violation clusters' },
                { model: 'DBSCAN', metric: 'Noise', value: '18.1%', interp: 'Isolated violations outside cluster boundaries' },
                { model: 'Prophet', metric: 'Best MAPE', value: '23.2%', interp: 'Best cluster forecast accuracy' },
                { model: 'Isolation Forest', metric: 'FKDEV00021', value: '✓ flagged', interp: 'Known anomaly correctly identified' },
              ].map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f0f3f7' }}>
                  <td style={{ padding: '10px 0', color: '#5b6573' }}>{row.model}</td>
                  <td style={{ padding: '10px 0', color: '#16203a', fontWeight: 500 }}>{row.metric}</td>
                  <td style={{
                    padding: '10px 0',
                    textAlign: 'right',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    color: '#2874f0',
                  }}>
                    {row.value}
                  </td>
                  <td style={{ padding: '10px 0', paddingLeft: 16, color: '#8a94a2', fontSize: 11 }}>
                    {row.interp}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      
      <div className="conclusion-banner">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="title" style={{ marginBottom: 12 }}>
            Current reactive patrol has <span className="highlight">zero measurable impact</span> at top junctions
          </div>
          <ul className="sub" style={{
            margin: 0,
            paddingLeft: 20,
            lineHeight: 1.8,
          }}>
            <li>KR Market violations increased 158% from November to March despite ongoing patrol</li>
            <li>Safina Plaza has been #1 junction for 5 consecutive months — enforcement not reducing violations</li>
            <li>61.3% of recorded violations never become challans — systemic enforcement leakage</li>
            <li>91 patterns recur every single week — structural interventions needed, not just officers</li>
            <li>One device (FKDEV00021) = 39.3% of Kodigehalli violations at 50.6% approval rate</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
