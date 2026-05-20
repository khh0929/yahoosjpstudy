function btnStyle(bg, border) {
  return {
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 14,
    color: 'var(--text)',
    cursor: 'pointer',
    padding: '14px 12px',
    textAlign: 'center',
  };
}

export function HomeScreen({ data, progress, stats, onStart, onReview, onSettings }) {
  const today = new Date().toDateString();
  const studiedToday = progress.lastStudied === today;
  const totalItems = data.curriculum.flatMap((l) => l.items).length;
  const learnedItems = progress.completedLessons.flatMap((idx) => data.curriculum[idx]?.items || []).length;
  const weakCount = Object.values(stats).filter((s) => s.wrong > 0).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 40 }}>
      <div style={{ padding: '28px 20px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>일본어 학습</div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>
            {studiedToday ? '오늘도 수고했어요 👏' : '오늘 학습 시작해요!'}
          </div>
        </div>
        <button onClick={onSettings} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 20, cursor: 'pointer', padding: 4, marginTop: 4 }}>⚙️</button>
      </div>

      <div style={{ margin: '20px 20px 0', padding: '16px', background: 'var(--bg2)', borderRadius: 16, border: '1px solid var(--border)', display: 'flex', gap: 0 }}>
        {[
          { label: '학습 완료', value: learnedItems, unit: '개', color: 'var(--accent)' },
          { label: '연속 학습', value: progress.streak, unit: '일', color: 'var(--yellow)' },
          { label: '취약 항목', value: weakCount, unit: '개', color: 'var(--red)' },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}<span style={{ fontSize: 12, fontWeight: 400 }}>{s.unit}</span></div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {learnedItems > 0 && (
        <div style={{ margin: '16px 20px 0', display: 'flex', gap: 10 }}>
          <button onClick={() => onReview('random')} style={{ flex: 1, ...btnStyle('var(--bg2)', 'var(--border2)') }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>🎲</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>랜덤 복습</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>배운 것 중 15개</div>
          </button>
          <button onClick={() => onReview('weak')} style={{ flex: 1, ...btnStyle('var(--bg2)', 'var(--border2)') }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>🎯</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>취약점 복습</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>틀린 것만 {weakCount}개</div>
          </button>
        </div>
      )}

      <div style={{ margin: '20px 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>전체 진도</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'DM Mono, monospace' }}>{learnedItems}/{totalItems}</div>
      </div>
      <div style={{ margin: '0 20px 20px', height: 4, background: 'var(--bg3)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${(learnedItems / totalItems) * 100}%`, background: 'linear-gradient(90deg,var(--accent3),var(--accent))', borderRadius: 2, transition: 'width 0.5s ease' }} />
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.curriculum.map((lesson, idx) => {
          const isCompleted = progress.completedLessons.includes(idx);
          const isUnlocked = idx <= progress.unlockedLesson;
          const isCurrent = idx === progress.unlockedLesson && !isCompleted;
          const lessonStats = lesson.items.map((item) => stats[item.char] || { correct: 0, wrong: 0 });
          const accuracy = lessonStats.reduce((a, s) => a + s.correct, 0) /
            Math.max(1, lessonStats.reduce((a, s) => a + s.correct + s.wrong, 0));
          const catColors = { katakana: '#c084fc', hiragana: '#60a5fa', vocabulary: '#4ade80', grammar: '#fbbf24' };

          return (
            <div
              key={lesson.id}
              onClick={() => isUnlocked && onStart(idx)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                borderRadius: 14, cursor: isUnlocked ? 'pointer' : 'default',
                background: isCurrent ? 'rgba(192,132,252,0.08)' : 'var(--bg2)',
                border: `1px solid ${isCurrent ? 'rgba(192,132,252,0.3)' : isCompleted ? 'rgba(74,222,128,0.15)' : 'var(--border)'}`,
                opacity: isUnlocked ? 1 : 0.35,
                transition: 'all 0.2s',
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0, color: catColors[lesson.category] || 'var(--text)' }}>
                {isCompleted ? '✓' : isUnlocked ? idx + 1 : '🔒'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{lesson.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{lesson.items.length}개 항목</div>
              </div>
              {isCompleted && (
                <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: accuracy > 0.8 ? 'var(--green)' : 'var(--yellow)' }}>
                  {Math.round(accuracy * 100)}%
                </div>
              )}
              {isCurrent && <div style={{ fontSize: 11, background: 'var(--accent3)', color: '#fff', borderRadius: 8, padding: '2px 8px', fontWeight: 600 }}>학습</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
