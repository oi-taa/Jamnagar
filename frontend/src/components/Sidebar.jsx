import React from 'react';

const NAV_ITEMS = [
  { id: 'map', label: 'Hotspot Map', icon: 'diamond' },
  { id: 'forecast', label: 'Forecast', icon: 'triangle' },
  { id: 'deploy', label: 'Deploy', icon: 'square' },
  { id: 'intel', label: 'Enforcement Intel', icon: 'circle' },
];

const FILTER_OPTIONS = {
  zone: ['All Zones', 'Central', 'North', 'South', 'East', 'West'],
  shift: ['All Shifts', 'Morning', 'Afternoon', 'Evening'],
  vehicleType: ['All vehicles', 'SCOOTER', 'CAR', 'PASSENGER AUTO'],
  violationType: ['All types', 'WRONG PARKING', 'NO PARKING'],
};

export default function Sidebar({ activePage, setActivePage, filters, setFilters }) {
  const renderIcon = (type, isActive) => {
    const color = isActive ? '#2874f0' : '#aab3c0';
    switch (type) {
      case 'diamond':
        return <div style={{ width: 13, height: 13, background: color, transform: 'rotate(45deg)' }} />;
      case 'triangle':
        return <div style={{ width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: `12px solid ${color}` }} />;
      case 'square':
        return <div style={{ width: 12, height: 12, background: color }} />;
      case 'circle':
        return <div style={{ width: 13, height: 13, border: `2px solid ${color}`, borderRadius: '50%' }} />;
      default:
        return null;
    }
  };

  const selectStyle = {
    fontSize: 12, fontWeight: 500, color: '#3a4759', border: 'none',
    background: 'transparent', width: '100%', cursor: 'pointer', outline: 'none'
  };

  const filterBoxStyle = {
    padding: '8px 10px', background: '#f5f7fa', border: '1px solid #e2e7ee',
    borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
  };

  const labelStyle = { fontSize: 10, color: '#8a94a2', letterSpacing: '0.02em', display: 'block', marginBottom: 4 };

  return (
    <div style={{ width: 206, background: '#ffffff', borderRight: '1px solid #e2e7ee', display: 'flex', flexDirection: 'column', height: '100vh', flexShrink: 0 }}>
      <div style={{ padding: '17px 18px 15px', borderBottom: '1px solid #eef1f5', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 25, height: 25, borderRadius: 6, background: 'linear-gradient(135deg, #2874f0, #1546a0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, background: '#ffe11b', transform: 'rotate(45deg)' }} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 800 }}>
          <span style={{ color: '#16203a' }}>Jam</span>
          <span style={{ color: '#2874f0' }}>nagar</span>
        </div>
      </div>

      <nav style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button key={item.id} onClick={() => setActivePage(item.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 6, background: isActive ? '#e9f1ff' : 'transparent', border: 'none', cursor: 'pointer', position: 'relative', textAlign: 'left', width: '100%' }}>
              {isActive && <div style={{ position: 'absolute', left: 0, top: 7, bottom: 7, width: 3, borderRadius: 2, background: '#2874f0' }} />}
              {renderIcon(item.icon, isActive)}
              <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? '#1b4fc4' : '#5b6573' }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ margin: '8px 18px', height: 1, background: '#eef1f5' }} />

      <div style={{ padding: '2px 16px 0' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: '#9aa4b2', marginBottom: 11 }}>FILTERS</div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Zone</label>
          <div style={filterBoxStyle}>
            <select value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })} style={selectStyle}>
              {FILTER_OPTIONS.zone.map((opt) => <option key={opt} value={opt === 'All Zones' ? 'all' : opt}>{opt}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Shift</label>
          <div style={filterBoxStyle}>
            <select value={filters.shift} onChange={(e) => setFilters({ ...filters, shift: e.target.value })} style={selectStyle}>
              {FILTER_OPTIONS.shift.map((opt) => <option key={opt} value={opt === 'All Shifts' ? 'all' : opt.toLowerCase()}>{opt}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Vehicle type</label>
          <div style={filterBoxStyle}>
            <select value={filters.vehicleType || 'all'} onChange={(e) => setFilters({ ...filters, vehicleType: e.target.value })} style={selectStyle}>
              {FILTER_OPTIONS.vehicleType.map((opt) => <option key={opt} value={opt === 'All vehicles' ? 'all' : opt}>{opt}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Violation type</label>
          <div style={filterBoxStyle}>
            <select value={filters.violationType || 'all'} onChange={(e) => setFilters({ ...filters, violationType: e.target.value })} style={selectStyle}>
              {FILTER_OPTIONS.violationType.map((opt) => <option key={opt} value={opt === 'All types' ? 'all' : opt}>{opt}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid #eef1f5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#1aa260', boxShadow: '0 0 7px rgba(26, 162, 96, 0.6)' }} />
          <span style={{ fontSize: 10, color: '#5b6573', fontFamily: 'JetBrains Mono, monospace' }}>live · synced 2m ago</span>
        </div>
        <div style={{ fontSize: 10, color: '#9aa4b2', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.5 }}>
          OPR · btp-supervisor-04<br />Prophet v1.1 · April holdout
        </div>
      </div>
    </div>
  );
}
