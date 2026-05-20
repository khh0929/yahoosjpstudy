import { useEffect, useRef, useState } from 'react';
import { speak } from '../lib/tts.js';
import { TopBar } from '../components/TopBar.jsx';
import { ProgressBar } from '../components/ProgressBar.jsx';

export function QuizScreen({ items, allItems, quizMode, onModeChange, onComplete, onBack }) {
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [results, setResults] = useState([]);
  const [wrongItems, setWrongItems] = useState([]);
  const [isReview, setIsReview] = useState(false);
  const [currentItems, setCurrentItems] = useState(() => [...items].sort(() => Math.random() - 0.5));
  const [choices, setChoices] = useState([]);
  const [showHint, setShowHint] = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef(null);

  const item = currentItems[step];

  useEffect(() => { speak(item.char); }, [item.char, step]);

  useEffect(() => {
    if (quizMode === 'choice') {
      const wrong = allItems
        .filter((i) => i.char !== item.char)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((i) => i.reading);
      const all = [...wrong, item.reading].sort(() => Math.random() - 0.5);
      setChoices(all);
    }
  }, [step, quizMode, item, allItems]);

  function checkAnswer(ans) {
    const correct = ans.trim() === item.reading || ans.trim().toLowerCase() === item.romaji?.toLowerCase();
    setResult(correct ? 'correct' : 'wrong');
    const newResults = [...results, { id: item.char, correct }];
    setResults(newResults);
    if (!correct) {
      setWrongItems((w) => (w.find((x) => x.char === item.char) ? w : [...w, item]));
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
    }
  }

  function next() {
    setAnswer('');
    setResult(null);
    setShowHint(false);
    if (step + 1 >= currentItems.length) {
      if (wrongItems.length > 0 && !isReview) {
        setIsReview(true);
        setCurrentItems([...wrongItems].sort(() => Math.random() - 0.5));
        setStep(0);
        setWrongItems([]);
      } else {
        onComplete(results);
      }
    } else {
      setStep((s) => s + 1);
    }
  }

  useEffect(() => {
    if (result === null && quizMode === 'typing' && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [step, result, quizMode]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <TopBar title={isReview ? '🔄 틀린 것 복습' : '퀴즈'} right={`${step + 1}/${currentItems.length}`} onBack={onBack} />
      <ProgressBar value={(step + 1) / currentItems.length} color={isReview ? 'var(--yellow)' : undefined} />

      <div style={{ display: 'flex', margin: '12px 20px', background: 'var(--bg2)', borderRadius: 12, padding: 3, border: '1px solid var(--border)' }}>
        {['typing', 'choice'].map((mode) => (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            style={{ flex: 1, padding: '8px', borderRadius: 9, border: 'none', background: quizMode === mode ? 'var(--bg3)' : 'transparent', color: quizMode === mode ? 'var(--text)' : 'var(--text3)', fontSize: 13, cursor: 'pointer', fontWeight: quizMode === mode ? 600 : 400, transition: 'all 0.15s' }}
          >
            {mode === 'typing' ? '✍️ 타이핑' : '📋 객관식'}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px' }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>이 글자를 읽어보세요</div>

        <div className={shaking ? 'shake' : ''} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ fontSize: 96, lineHeight: 1, fontFamily: 'Noto Sans JP, sans-serif' }}>{item.char}</div>
          <button onClick={() => speak(item.char)} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 12, padding: '10px', fontSize: 20, cursor: 'pointer' }}>🔊</button>
        </div>

        {showHint && (
          <div className="fadeUp" style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, fontSize: 13, color: 'var(--yellow)', width: '100%', textAlign: 'center' }}>
            💡 {item.hint}
          </div>
        )}

        {result === null ? (
          quizMode === 'typing' ? (
            <div style={{ width: '100%' }}>
              <input
                ref={inputRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && answer.trim() && checkAnswer(answer)}
                placeholder="한글 또는 로마자로 입력"
                style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 16, outline: 'none', marginBottom: 12 }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                {!showHint && (
                  <button onClick={() => setShowHint(true)} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.06)', color: 'var(--yellow)', fontSize: 13, cursor: 'pointer' }}>
                    힌트
                  </button>
                )}
                <button
                  onClick={() => checkAnswer(answer)}
                  disabled={!answer.trim()}
                  style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,var(--accent3),var(--accent2))', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: answer.trim() ? 1 : 0.4 }}
                >
                  확인
                </button>
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {choices.map((c, i) => (
                <button
                  key={i}
                  onClick={() => checkAnswer(c)}
                  style={{ padding: '16px', borderRadius: 12, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 16, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                >
                  {c}
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="pop" style={{ width: '100%' }}>
            <div style={{ padding: '20px', borderRadius: 14, background: result === 'correct' ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${result === 'correct' ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`, textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{result === 'correct' ? '🎉' : '😅'}</div>
              <div style={{ fontSize: 15, color: result === 'correct' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                {result === 'correct' ? '정답!' : `정답: ${item.reading} (${item.romaji})`}
              </div>
              {result === 'wrong' && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>💡 {item.hint}</div>}
            </div>
            <button onClick={next} style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,var(--accent3),var(--accent2))', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {step + 1 >= currentItems.length ? (wrongItems.length > 0 && !isReview ? '틀린 것 복습 →' : '결과 보기 →') : '다음 →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
