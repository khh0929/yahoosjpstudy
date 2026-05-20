export function TopBar({ title, right, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 14, cursor: 'pointer', padding: 0 }}>← 뒤로</button>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', fontFamily: 'DM Mono, monospace' }}>{right || ''}</div>
    </div>
  );
}
