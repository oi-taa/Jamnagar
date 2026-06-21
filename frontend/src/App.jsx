import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import HotspotMap from './pages/HotspotMap';
import Forecast from './pages/Forecast';
import Deploy from './pages/Deploy';
import Intel from './pages/Intel';

export default function App() {
  const [activePage, setActivePage] = useState('map');
  const [filters, setFilters] = useState({
    zone: 'all',
    shift: 'all',
    vehicleType: 'all',
    violationType: 'all',
  });

  const renderPage = () => {
    switch (activePage) {
      case 'map':
        return <HotspotMap filters={filters} />;
      case 'forecast':
        return <Forecast filters={filters} />;
      case 'deploy':
        return <Deploy filters={filters} />;
      case 'intel':
        return <Intel />;
      default:
        return <HotspotMap filters={filters} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        filters={filters}
        setFilters={setFilters}
      />
      <main className="main-content pq-scrl" style={{
        overflowY: activePage !== 'map' ? 'auto' : 'hidden'
      }}>
        {renderPage()}
      </main>
    </div>
  );
}
