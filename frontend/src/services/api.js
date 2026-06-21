const API_BASE = process.env.REACT_APP_API_URL || '';

export const api = {
  async getSummary() {
    const res = await fetch(`${API_BASE}/api/summary`);
    return res.json();
  },

  async getHotspots(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/api/hotspots?${query}`);
    return res.json();
  },

  async getHotspotDetail(junctionName) {
    const res = await fetch(`${API_BASE}/api/hotspot/${encodeURIComponent(junctionName)}`);
    return res.json();
  },

  async getNetwork() {
    const res = await fetch(`${API_BASE}/api/network`);
    return res.json();
  },

  async getForecast(clusterId) {
    const res = await fetch(`${API_BASE}/api/forecast/${clusterId}`);
    return res.json();
  },

  async getDeploy(officers = 42, shift = 'all', zone = 'all') {
    const res = await fetch(`${API_BASE}/api/deploy?officers=${officers}&shift=${shift}&zone=${zone}`);
    return res.json();
  },

  async getHeatmap() {
    const res = await fetch(`${API_BASE}/api/heatmap`);
    return res.json();
  },

  async getIntel() {
    const res = await fetch(`${API_BASE}/api/intel`);
    return res.json();
  },

  async getBacktest(clusterId = 12) {
    const res = await fetch(`${API_BASE}/api/backtest/${clusterId}`);
    return res.json();
  },

  async getHourly(clusterId = 12) {
    const res = await fetch(`${API_BASE}/api/hourly/${clusterId}`);
    return res.json();
  }
};

// Utility: Format number in Indian locale
export const formatNumber = (num) => {
  if (num === null || num === undefined) return '—';
  return new Intl.NumberFormat('en-IN').format(num);
};

// Utility: Get tier color based on score
export const getTierColor = (score) => {
  if (score >= 80) return '#e0392b';
  if (score >= 60) return '#ef7d1e';
  if (score >= 42) return '#f2a01a';
  return '#2874f0';
};

// Utility: Convert lat/lon to map position %
export const latLonToPercent = (lat, lon) => {
  const LAT_MIN = 12.88, LAT_MAX = 13.08;
  const LON_MIN = 77.48, LON_MAX = 77.72;
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * 100;
  const y = (1 - (lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * 100;
  return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
};
