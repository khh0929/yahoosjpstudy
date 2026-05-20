import { useEffect, useState } from 'react';
import { storageGet, storageSet } from '../lib/storage.js';
import { TopBar } from '../components/TopBar.jsx';

export function SettingsScreen({ onBack }) {
  const [token, setToken] = useState('');
  const [workerUrl, setWorkerUrl] = useState('https://wispy-voice-ac17.khh0929.workers.dev/');
  const [repo, setRepo] = useState('khh0929/yahoosjpstudy');
  const [deployStatus, setDeployStatus] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    (async () => {
      const t = await storageGet('deploy-token');
      const w = await storageGet('deploy-worker');
      const r = await storageGet('deploy-repo');
      if (t) setToken(t);
      if (w) setWorkerUrl(w);
      if (r) setRepo(r);
    })();
  }, []);

  async function save() {
    await storageSet('deploy-token', token);
    await storageSet('deploy-worker', workerUrl);
    await storageSet('deploy-repo', repo);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(null), 2000);
  }

  async function deploy() {
    if (!token || !workerUrl || !repo) {
      setDeployStatus('error:설정을 먼저 저장해주세요');
      return;
    }
    setDeployStatus('deploying');
    try {
      const dataRes = await fetch('/data.json');
      const dataText = await dataRes.text();
      const toBase64 = (str) => btoa(unescape(encodeURIComponent(str)));

      const res = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          repo,
          message: 'deploy: data.json 업데이트 ' + new Date().toLocaleString('ko-KR'),
          files: [{ path: 'public/data.json', content: toBase64(dataText) }],
        }),
      });
      const data = await res.json();
      if (data.success) setDeployStatus('success');
      else setDeployStatus('error:' + JSON.stringify(data));
    } catch (e) {
      setDeployStatus('error:' + e.message);
    }
  }

  const inputSt = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginTop: 6 };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 40 }}>
      <TopBar title="설정 & 배포" onBack={onBack} />

      <div style={{ padding: '20px' }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', letterSpacing: 1, marginBottom: 16, textTransform: 'uppercase' }}>배포 설정</div>

        {[
          { label: 'GitHub 토큰', val: token, set: setToken, type: 'password', placeholder: 'ghp_...' },
          { label: 'Worker URL', val: workerUrl, set: setWorkerUrl, type: 'text', placeholder: 'https://...' },
          { label: 'GitHub 저장소', val: repo, set: setRepo, type: 'text', placeholder: 'username/repo' },
        ].map((f, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{f.label}</div>
            <input value={f.val} onChange={(e) => f.set(e.target.value)} type={f.type} placeholder={f.placeholder} style={inputSt} />
          </div>
        ))}

        <button onClick={save} style={{ width: '100%', padding: '13px', borderRadius: 12, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 14, cursor: 'pointer', marginBottom: 8 }}>
          💾 설정 저장
        </button>
        {saveStatus === 'saved' && <div style={{ color: 'var(--green)', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>✅ 저장됐어요!</div>}

        <div style={{ height: 1, background: 'var(--border)', margin: '20px 0' }} />

        <div style={{ fontSize: 12, color: 'var(--text3)', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>data.json 배포</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>
          현재 data.json을 GitHub에 push하고 Vercel이 자동 빌드해요. (UI 코드는 빌드 산출물이라 별도 배포 필요)
        </div>

        <button
          onClick={deploy}
          disabled={deployStatus === 'deploying'}
          style={{ width: '100%', padding: '16px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px rgba(79,70,229,0.4)', opacity: deployStatus === 'deploying' ? 0.6 : 1 }}
        >
          {deployStatus === 'deploying' ? '⏳ 배포 중...' : '🚀 data.json 배포'}
        </button>

        {deployStatus === 'success' && (
          <div style={{ marginTop: 12, padding: '12px', borderRadius: 10, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: 'var(--green)', fontSize: 13, textAlign: 'center' }}>
            ✅ 배포 완료! 1-2분 후 반영돼요
          </div>
        )}
        {deployStatus?.startsWith('error:') && (
          <div style={{ marginTop: 12, padding: '12px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: 'var(--red)', fontSize: 12 }}>
            ❌ {deployStatus.replace('error:', '')}
          </div>
        )}
      </div>
    </div>
  );
}
