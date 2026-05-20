export function LoadingScreen() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '3px solid var(--bg3)', borderTop: '3px solid var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ color: 'var(--text2)', fontSize: 14 }}>로딩 중...</div>
    </div>
  );
}

export function ErrorScreen({ msg }) {
  return <div style={{ padding: 40, color: 'var(--red)', fontSize: 14 }}>{msg}</div>;
}
