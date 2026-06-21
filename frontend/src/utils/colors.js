// CIS/Impact score color function - use consistently everywhere
export const getTierColor = (score) => {
  if (score >= 80) return '#e0392b';  // critical
  if (score >= 60) return '#ef7d1e';  // high
  if (score >= 42) return '#f2a01a';  // medium
  return '#2874f0';                    // low
};

export const getTierLabel = (score) => {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 42) return 'MEDIUM';
  return 'LOW';
};

export const getTierBg = (score) => {
  if (score >= 80) return '#fff4f1';
  if (score >= 60) return '#fff8f0';
  if (score >= 42) return '#fffbf0';
  return '#f0f7ff';
};
