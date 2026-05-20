export function ResultScreen({ result, onHome, onNext }) {
  const pct = Math.round((result.correct / result.total) * 100);
  const emoji = pct === 100 ? '🏆' : pct >= 80 ? '🌟' : pct >= 60 ? '💪' : '📚';
  const msg = pct === 100 ? '완벽해요!' : pct >= 80 ? '잘했어요!' : pct >= 60 ? '조금만 더 연습해요!' : '다시 한번 복습해봐요!';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div className="pop" style={{ textAlign: 'center', width: '100%', maxWidth: 360 }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>{emoji}</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>{msg}</div>

        <div style={{ width: 140, height: 140, borderRadius: '50%', border: '3px solid var(--accent)', background: 'rgba(192,132,252,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 0 40px rgba(192,132,252,0.2)' }}>
          <div style={{ fontSize: 38, fontWeight: 800, color: 'var(--accent)' }}>{pct}%</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>정답률</div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 24, justifyContent: 'center' }}>
          {[
            { label: '정답', val: result.correct, color: 'var(--green)' },
            { label: '오답', val: result.total - result.correct, color: 'var(--red)' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '16px 28px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onHome} style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 14, cursor: 'pointer' }}>🏠 홈</button>
          {onNext && (
            <button onClick={onNext} style={{ flex: 2, padding: '14px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,var(--accent3),var(--accent2))', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              다음 레슨 →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
