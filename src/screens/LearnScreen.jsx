import { useEffect, useState } from 'react';
import { speak } from '../lib/tts.js';
import { TopBar } from '../components/TopBar.jsx';
import { ProgressBar } from '../components/ProgressBar.jsx';

export function LearnScreen({ lesson, onComplete, onBack }) {
  const [step, setStep] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const item = lesson.items[step];

  useEffect(() => { setFlipped(false); }, [step]);
  useEffect(() => { speak(item.char); }, [item.char]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <TopBar title={lesson.title} right={`${step + 1}/${lesson.items.length}`} onBack={onBack} />
      <ProgressBar value={(step + 1) / lesson.items.length} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20, letterSpacing: 1 }}>카드를 탭해서 뒤집어요</div>

        <div
          onClick={() => setFlipped((f) => !f)}
          style={{
            width: '100%', maxWidth: 360, minHeight: 240,
            background: flipped ? 'rgba(192,132,252,0.06)' : 'var(--bg2)',
            border: `1px solid ${flipped ? 'rgba(192,132,252,0.25)' : 'var(--border2)'}`,
            borderRadius: 24, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            padding: 32, gap: 12, transition: 'all 0.25s',
          }}
        >
          <div style={{ fontSize: 100, lineHeight: 1, fontFamily: 'Noto Sans JP, sans-serif' }}>{item.char}</div>
          {flipped && (
            <div className="fadeUp" style={{ textAlign: 'center', width: '100%' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>{item.reading}</div>
              <div style={{ fontSize: 14, color: 'var(--text2)', fontFamily: 'DM Mono, monospace', marginBottom: 12 }}>{item.romaji}</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', background: 'var(--bg3)', borderRadius: 10, padding: '8px 14px' }}>💡 {item.hint}</div>
            </div>
          )}
        </div>

        <button onClick={() => speak(item.char)} style={{ marginTop: 20, background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 20, padding: '10px 24px', fontSize: 14, cursor: 'pointer' }}>
          🔊 발음 듣기
        </button>
      </div>

      <div style={{ padding: '0 20px 40px', display: 'flex', gap: 12 }}>
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 15, cursor: 'pointer', opacity: step === 0 ? 0.3 : 1 }}
        >
          ← 이전
        </button>
        <button
          onClick={() => (step + 1 >= lesson.items.length ? onComplete() : setStep((s) => s + 1))}
          style={{ flex: 2, padding: '14px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,var(--accent3),var(--accent2))', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px rgba(124,58,237,0.3)' }}
        >
          {step + 1 >= lesson.items.length ? '퀴즈 시작 →' : '다음 →'}
        </button>
      </div>
    </div>
  );
}
