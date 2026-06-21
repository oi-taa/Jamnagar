// Format number in Indian locale (2,98,450)
export const formatNumber = (num) => {
  if (num === null || num === undefined) return '—';
  return new Intl.NumberFormat('en-IN').format(num);
};

// Format percentage
export const formatPct = (n, decimals = 1) => {
  if (n === null || n === undefined) return '—';
  return `${Number(n).toFixed(decimals)}%`;
};

// Format score
export const formatScore = (n) => {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(1);
};

// Format time
export const formatTime = (hour) => {
  if (hour === null || hour === undefined) return '—';
  const h = parseInt(hour);
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
};
