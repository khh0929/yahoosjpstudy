import { useEffect, useState } from 'react';

const DISMISS_KEY = 'pwa-install-dismissed';

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isMobile() {
  return /Mobi|Android/i.test(navigator.userAgent) || isIOS();
}

export function InstallBanner() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [visible, setVisible] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (!isMobile()) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    const ios = isIOS();

    const onPrompt = (e) => {
      e.preventDefault();
      setPromptEvent(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS는 beforeinstallprompt가 안 발생 → 약간 지연 후 직접 표시
    let iosTimer;
    if (ios) {
      iosTimer = setTimeout(() => setVisible(true), 1200);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
    setShowIosGuide(false);
  }

  async function install() {
    if (promptEvent) {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted' || outcome === 'dismissed') {
        setVisible(false);
        if (outcome === 'accepted') localStorage.setItem(DISMISS_KEY, '1');
      }
    } else if (isIOS()) {
      setShowIosGuide(true);
    }
  }

  if (!visible) return null;

  return (
    <>
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1000,
        background: 'linear-gradient(180deg, rgba(18,18,26,0.95), rgba(10,10,15,0.98))',
        borderTop: '1px solid rgba(192,132,252,0.25)',
        backdropFilter: 'blur(10px)',
        padding: '14px 16px calc(14px + env(safe-area-inset-bottom))',
        display: 'flex', alignItems: 'center', gap: 12, maxWidth: 480, margin: '0 auto',
        animation: 'fadeUp 0.3s ease forwards',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'linear-gradient(135deg, #7c3aed, #c084fc)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 800, color: '#fff', flexShrink: 0,
          fontFamily: 'Noto Sans JP, sans-serif',
        }}>日</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>홈 화면에 추가</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>앱처럼 빠르게 실행</div>
        </div>
        <button onClick={install} style={{
          padding: '8px 14px', borderRadius: 10, border: 'none',
          background: 'linear-gradient(135deg, var(--accent3), var(--accent2))',
          color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>설치</button>
        <button onClick={dismiss} style={{
          padding: 6, borderRadius: 8, border: 'none', background: 'transparent',
          color: 'var(--text3)', fontSize: 18, cursor: 'pointer', lineHeight: 1,
        }} aria-label="닫기">×</button>
      </div>

      {showIosGuide && (
        <div onClick={() => setShowIosGuide(false)} style={{
          position: 'fixed', inset: 0, zIndex: 1001,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'var(--bg2)', borderTopLeftRadius: 20, borderTopRightRadius: 20,
            padding: '24px 20px calc(24px + env(safe-area-inset-bottom))',
            maxWidth: 480, width: '100%', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📱 홈 화면에 추가하기</div>
            <ol style={{ paddingLeft: 20, fontSize: 14, lineHeight: 1.8, color: 'var(--text2)' }}>
              <li>하단 <strong style={{ color: 'var(--text)' }}>공유 버튼</strong> <span style={{ display: 'inline-block', padding: '0 6px', background: 'var(--bg3)', borderRadius: 4 }}>⬆️</span> 탭</li>
              <li><strong style={{ color: 'var(--text)' }}>"홈 화면에 추가"</strong> 선택</li>
              <li>우상단 <strong style={{ color: 'var(--text)' }}>"추가"</strong> 탭</li>
            </ol>
            <button onClick={() => setShowIosGuide(false)} style={{
              width: '100%', marginTop: 20, padding: 14, borderRadius: 12, border: 'none',
              background: 'var(--bg3)', color: 'var(--text)', fontSize: 14, cursor: 'pointer',
            }}>확인</button>
          </div>
        </div>
      )}
    </>
  );
}
