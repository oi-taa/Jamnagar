import React from 'react';

export default function KPICard({
  label,
  value,
  sub,
  isAlert = false,
  icon = null,
  labelDot = false,
  valueColor = null,
  children
}) {
  return (
    <div style={{
      background: isAlert ? '#fff4f1' : '#ffffff',
      border: `1px solid ${isAlert ? '#f3d3cb' : '#e2e7ee'}`,
      borderRadius: 8,
      padding: '13px 16px',
      boxShadow: '0 1px 2px rgba(20, 40, 80, 0.04)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Alert glow */}
      {isAlert && (
        <div style={{
          position: 'absolute',
          right: -18,
          top: -18,
          width: 70,
          height: 70,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(224, 57, 43, 0.14), transparent 70%)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Label */}
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.08em',
        color: isAlert ? '#c0584a' : '#8a94a2',
        marginBottom: 8,
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        {labelDot && (
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#e0392b',
          }} />
        )}
        {label}
        {icon && <span style={{ marginLeft: 'auto' }}>{icon}</span>}
      </div>

      {/* Value */}
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 27,
        fontWeight: 700,
        color: valueColor || (isAlert ? '#e0392b' : '#16203a'),
        lineHeight: 1,
      }}>
        {value}
      </div>

      {/* Sub text */}
      {sub && (
        <div style={{
          fontSize: 10,
          color: isAlert ? '#b07567' : '#8a94a2',
          marginTop: 6,
        }}>
          {sub}
        </div>
      )}

      {/* Custom content */}
      {children}
    </div>
  );
}
