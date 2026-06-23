import React, { useEffect, useState, useRef } from 'react';
import { api, getTierColor } from '../services/api';
import { formatNumber, formatScore } from '../utils/formatters';
import KPICard from '../components/KPICard';
import ClusterDrawer from '../components/ClusterDrawer';

export default function HotspotMap({ filters }) {
  const [summary, setSummary] = useState(null);
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJunction, setSelectedJunction] = useState(null);
  const [showMetro, setShowMetro] = useState(true);
  const [showCorridors, setShowCorridors] = useState(true);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    const params = { limit: 20 };
    if (filters.zone && filters.zone !== 'all') params.zone = filters.zone;
    if (filters.shift && filters.shift !== 'all') params.time_range = filters.shift;
    if (filters.vehicleType && filters.vehicleType !== 'all') params.vehicle_type = filters.vehicleType;
    if (filters.violationType && filters.violationType !== 'all') params.violation_type = filters.violationType;

    setLoading(true);
    Promise.all([
      api.getSummary(),
      api.getHotspots(params)
    ])
      .then(([summaryData, hotspotsData]) => {
        setSummary(summaryData);
        setHotspots(Array.isArray(hotspotsData) ? hotspotsData : hotspotsData.hotspots || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);


  useEffect(() => {
    if (!window.mappls || mapInstanceRef.current) return;

    try {

      mapInstanceRef.current = new window.mappls.Map('mappls-map', {
        center: { lat: 12.9716, lng: 77.5946 },
        zoom: 12,
        zoomControl: true,
        search: false,
      });


      mapInstanceRef.current.addListener('load', () => {
        mapInstanceRef.current.setCenter({ lat: 12.9716, lng: 77.5946 });
        mapInstanceRef.current.setZoom(12);
        console.log('Mappls map centered on Bengaluru');
      });

      console.log('Mappls map initialized');
    } catch (err) {
      console.error('Failed to initialize Mappls map:', err);
    }
  }, []);


  useEffect(() => {
    if (!mapInstanceRef.current || hotspots.length === 0) return;


    markersRef.current.forEach(marker => {
      if (marker.remove) marker.remove();
    });
    markersRef.current = [];


    if (hotspots[0]?.lat && hotspots[0]?.lon) {
      try {
        mapInstanceRef.current.setCenter({ lat: hotspots[0].lat, lng: hotspots[0].lon });
        mapInstanceRef.current.setZoom(12);
      } catch (e) {
        console.log('Could not center map:', e);
      }
    }


    hotspots.forEach((h, idx) => {
      if (!h.lat || !h.lon) return;

      const color = getTierColor(h.congestion_influence_score);
      const size = Math.min(56, Math.max(40, Math.sqrt(h.total_violations / 15)));
      const isTop5 = idx < 5;
      const zIndex = 100 - idx;

      try {

        const markerHtml = `
          <div class="cluster-marker ${isTop5 ? 'pulse' : ''}" style="
            position: relative;
            width: ${size}px;
            height: ${size}px;
            z-index: ${zIndex};
          ">
            ${isTop5 ? `
            <div class="ripple-ring" style="
              position: absolute;
              inset: -6px;
              border: 3px solid ${color};
              border-radius: 50%;
              pointer-events: none;
            "></div>
            <div class="ripple-ring-delayed" style="
              position: absolute;
              inset: -6px;
              border: 2px solid ${color};
              border-radius: 50%;
              pointer-events: none;
            "></div>
            ` : ''}
            <div style="
              position: absolute;
              inset: 0;
              background: linear-gradient(135deg, ${color}, ${color}dd);
              border: 3px solid white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: JetBrains Mono, monospace;
              font-size: ${size > 48 ? 16 : 14}px;
              font-weight: 800;
              color: white;
              cursor: pointer;
              box-shadow: 0 4px 16px ${color}80, 0 2px 4px rgba(0,0,0,0.3);
              text-shadow: 0 1px 2px rgba(0,0,0,0.3);
            ">${idx + 1}</div>
          </div>
        `;

        const marker = new window.mappls.Marker({
          map: mapInstanceRef.current,
          position: [h.lat, h.lon],
          html: markerHtml,
        });


        if (marker.setPosition) {
          marker.setPosition({ lat: h.lat, lng: h.lon });
        }


        marker.addListener('click', () => {
          setSelectedJunction(h.junction_name);
        });

        markersRef.current.push(marker);
      } catch (err) {
        console.error('Failed to add marker:', err);
      }
    });

  }, [hotspots]);

  const topJunction = hotspots[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13, height: '100%' }}>
      
      <div className="kpi-grid">
        
        <KPICard
          label="TOTAL VIOLATIONS"
          value={loading ? '—' : formatNumber(summary?.total_records)}
          sub={
            <span style={{ color: '#1aa260', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
              ▲ 12.4% vs Mar
            </span>
          }
        >
          <svg width="82" height="34" style={{ position: 'absolute', right: 12, top: 12 }}>
            <polyline
              points="0,30 15,25 30,28 45,18 60,20 75,10 82,12"
              fill="none"
              stroke="#2874f0"
              strokeWidth="1.8"
            />
          </svg>
        </KPICard>

        
        <KPICard
          label="APPROVED CHALLANS"
          value={
            <span>
              {loading ? '—' : formatNumber(summary?.approved)}
              <span style={{ fontSize: 13, color: '#6b7585', marginLeft: 8 }}>
                {loading ? '' : `${summary?.approved_pct || 38.7}%`}
              </span>
            </span>
          }
        >
          <div className="progress-bar" style={{ marginTop: 8 }}>
            <div className="fill" style={{
              width: summary ? `${summary.approved_pct || 38.7}%` : '0%'
            }} />
          </div>
          <div style={{
            fontSize: 10,
            color: '#8a94a2',
            fontFamily: 'JetBrains Mono, monospace',
            marginTop: 6,
          }}>
            {loading ? '—' : `${formatNumber(summary?.total_records - summary?.approved)} pending / rejected`}
          </div>
        </KPICard>

        
        <KPICard
          label="TOP JUNCTION"
          isAlert={true}
          labelDot={true}
        >
          {loading || !topJunction ? (
            <div style={{ color: '#b07567' }}>Loading...</div>
          ) : (
            <>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 14,
                fontWeight: 700,
                color: '#e0392b',
              }}>
                {topJunction.junction_name?.split(' - ')[0] || 'BTP051'}
              </div>
              <div style={{
                fontSize: 15,
                fontWeight: 600,
                color: '#5a2018',
                marginTop: 2,
              }}>
                {topJunction.short_name || topJunction.junction_name?.replace(/^BTP\d+\s*-?\s*/, '')}
              </div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 25,
                fontWeight: 700,
                color: '#3a1410',
                marginTop: 4,
              }}>
                {formatNumber(topJunction.total_violations)}
              </div>
              <div style={{ fontSize: 10, color: '#b07567', marginTop: 4 }}>
                violations · impact {formatScore(topJunction.congestion_influence_score)}
              </div>
            </>
          )}
        </KPICard>

        
        <KPICard label="TOP VIOLATION TYPE">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#16203a' }}>
              Wrong Parking
            </span>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 23,
              fontWeight: 700,
              color: '#ef7d1e',
            }}>
              55%
            </span>
          </div>
          <div style={{ display: 'flex', gap: 2, marginTop: 8, height: 9 }}>
            <div style={{ flex: 55, background: '#e0392b', borderRadius: 2 }} />
            <div style={{ flex: 22, background: '#ef7d1e', borderRadius: 2 }} />
            <div style={{ flex: 14, background: '#f2a01a', borderRadius: 2 }} />
            <div style={{ flex: 9, background: '#2874f0', borderRadius: 2 }} />
          </div>
          <div style={{ fontSize: 10, color: '#8a94a2', marginTop: 6 }}>
            Top vehicle · Scooter 32%
          </div>
        </KPICard>
      </div>

      
      <div className="hero-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="number">{summary?.lorenz_top16_junctions || 16}</span>
            <span className="title">junctions account for</span>
            <span className="number">{summary?.lorenz_top16_pct || 60.7}%</span>
            <span className="title">of all junction violations</span>
          </div>
          <span className="sub" style={{ marginLeft: 12 }}>— Pareto concentration confirmed</span>

          <div className="hero-chart" style={{ marginLeft: 'auto' }}>
            <svg viewBox="0 0 148 90" style={{ width: '100%', height: '100%' }}>
              <line x1="20" y1="70" x2="140" y2="70" stroke="#ffffff" strokeWidth="1" opacity="0.3" />
              <line x1="20" y1="70" x2="20" y2="10" stroke="#ffffff" strokeWidth="1" opacity="0.3" />
              <line x1="20" y1="70" x2="140" y2="10" stroke="#ffffff" strokeWidth="1" strokeDasharray="4 2" opacity="0.4" />
              <polyline
                points="20,70 40,68 60,64 80,55 100,40 120,22 140,10"
                fill="none"
                stroke="#ffe11b"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
      </div>

      
      <div style={{ display: 'flex', gap: 13, flex: 1, minHeight: 0 }}>
        
        <div style={{
          flex: 6,
          background: '#e4e9f0',
          border: '1px solid #e2e7ee',
          borderRadius: 8,
          position: 'relative',
          overflow: 'hidden',
        }}>
          
          <div
            id="mappls-map"
            ref={mapContainerRef}
            style={{
              width: '100%',
              height: '100%',
              minHeight: 400,
            }}
          />

          
          <div style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            {[
              { label: 'Metro', value: showMetro, setValue: setShowMetro },
              { label: 'Corridors', value: showCorridors, setValue: setShowCorridors },
            ].map(({ label, value, setValue }) => (
              <div key={label} style={{
                padding: '6px 10px',
                background: 'rgba(255,255,255,.95)',
                border: '1px solid #dbe1e9',
                borderRadius: 5,
                boxShadow: '0 1px 3px rgba(20,40,80,.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
              }} onClick={() => setValue(!value)}>
                <span style={{ fontSize: 11, color: '#5b6573' }}>{label}</span>
                <div style={{
                  width: 26,
                  height: 14,
                  borderRadius: 8,
                  background: value ? '#2874f0' : '#dbe1e9',
                  position: 'relative',
                  transition: 'background 0.2s',
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 2,
                    left: value ? 14 : 2,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#ffffff',
                    boxShadow: '0 1px 2px rgba(0,0,0,.25)',
                    transition: 'left 0.2s',
                  }} />
                </div>
              </div>
            ))}
          </div>

          
          <div style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            padding: '7px 11px',
            background: 'rgba(255,255,255,.95)',
            border: '1px solid #dbe1e9',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            zIndex: 1000,
          }}>
            <span style={{ fontSize: 9, color: '#8a94a2', fontWeight: 600 }}>IMPACT</span>
            {[
              { color: '#e0392b', label: '>80' },
              { color: '#ef7d1e', label: '>60' },
              { color: '#f2a01a', label: '>42' },
              { color: '#2874f0', label: '<42' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 9, color: '#8a94a2' }}>{label}</span>
              </div>
            ))}
          </div>

          
          <div style={{
            position: 'absolute',
            bottom: 8,
            right: 12,
            fontSize: 9,
            color: '#9aa4b2',
            fontFamily: 'JetBrains Mono, monospace',
            zIndex: 1000,
            background: 'rgba(255,255,255,0.8)',
            padding: '2px 6px',
            borderRadius: 3,
          }}>
            Mappls · DBSCAN ε=180m
          </div>

          
          <ClusterDrawer
            junctionName={selectedJunction}
            onClose={() => setSelectedJunction(null)}
          />
        </div>

        
        <div style={{
          flex: 4,
          background: '#ffffff',
          border: '1px solid #e2e7ee',
          borderRadius: 8,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid #eef1f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#16203a' }}>
              Ranked hotspots
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#8a94a2' }}>Top 20 · impact score</span>
              <span style={{
                padding: '2px 6px',
                background: '#f5f7fa',
                borderRadius: 4,
                fontSize: 10,
                color: '#8a94a2',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {formatNumber(summary?.total_records)} rec
              </span>
            </div>
          </div>

          <div className="pq-scrl" style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#8a94a2' }}>
                Loading hotspots...
              </div>
            ) : (
              hotspots.map((h, idx) => {
                const color = getTierColor(h.congestion_influence_score);
                const impactPct = Math.min(100, h.congestion_influence_score);

                return (
                  <div
                    key={h.junction_name}
                    onClick={() => setSelectedJunction(h.junction_name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '9px 12px',
                      borderBottom: '1px solid #f0f3f7',
                      cursor: 'pointer',
                      background: selectedJunction === h.junction_name ? '#f5f7fa' : 'transparent',
                    }}
                  >
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#8a94a2',
                      width: 20,
                    }}>
                      #{idx + 1}
                    </span>

                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#6b7585',
                      width: 55,
                    }}>
                      {h.junction_name?.split(' - ')[0] || `BTP${String(idx + 1).padStart(3, '0')}`}
                    </span>

                    <span style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#16203a',
                      flex: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {h.short_name || h.junction_name?.replace(/^BTP\d+\s*-?\s*/, '')}
                    </span>

                    <div style={{
                      flex: 1,
                      height: 4,
                      background: '#eaeef3',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${impactPct}%`,
                        background: color,
                        borderRadius: 2,
                      }} />
                    </div>

                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 15,
                      fontWeight: 700,
                      color: color,
                      width: 42,
                      textAlign: 'right',
                    }}>
                      {formatScore(h.congestion_influence_score)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
