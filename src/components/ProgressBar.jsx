export function ProgressBar({ value, color }) {
  return (
    <div style={{ height: 3, background: 'var(--bg3)' }}>
      <div style={{
        height: '100%',
        width: `${value * 100}%`,
        background: color || 'linear-gradient(90deg,var(--accent3),var(--accent))',
        transition: 'width 0.3s ease',
      }} />
    </div>
  );
}
