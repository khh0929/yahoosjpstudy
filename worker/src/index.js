// Cloudflare Worker — yahoosjpstudy MCP server with OAuth 2.1
//
// Routes:
//   POST /mcp            → MCP JSON-RPC (OAuth-protected, OAuthProvider 자동 검증)
//   GET  /authorize      → 로그인 폼
//   POST /authorize      → 비밀번호 검증 + completeAuthorization
//   POST /token          → OAuthProvider 내부
//   POST /register       → OAuthProvider 내부 (Dynamic Client Registration)
//   GET  /.well-known/oauth-authorization-server → 메타데이터 (자동)
//   POST /               → Legacy 앱 🚀 배포 버튼 (인증 없음, 호환성 유지)
//   GET  /health         → 헬스체크

import { OAuthProvider } from '@cloudflare/workers-oauth-provider';

const MCP_PROTOCOL_VERSION = '2024-11-05';

// ── MCP API handler (OAuth로 보호된 라우트) ─────────────────────────
const apiHandler = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== '/mcp' || request.method !== 'POST') {
      return cors(json({ error: 'not found' }, 404));
    }
    return cors(await handleMcp(request, env));
  },
};

// ── Default handler (인증 페이지 + 공개 라우트) ────────────────────
const defaultHandler = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));

    if (url.pathname === '/health') return cors(json({ ok: true }));

    if (url.pathname === '/' && request.method === 'POST') {
      return cors(await handleLegacyDeploy(request));
    }

    if (url.pathname === '/authorize') {
      if (request.method === 'GET') return await renderLoginGet(request, env);
      if (request.method === 'POST') return await handleLoginPost(request, env);
    }

    return new Response('not found', { status: 404 });
  },
};

export default new OAuthProvider({
  apiRoute: '/mcp',
  apiHandler,
  defaultHandler,
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/token',
  clientRegistrationEndpoint: '/register',
});

// ── OAuth: /authorize GET (로그인 폼) ───────────────────────────────
async function renderLoginGet(request, env) {
  const oauthReqInfo = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  const clientInfo = await env.OAUTH_PROVIDER.lookupClient(oauthReqInfo.clientId);
  const clientName = clientInfo?.clientName || clientInfo?.clientId || 'Unknown client';

  const encoded = btoa(JSON.stringify(oauthReqInfo));

  const html = `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>yahoosjpstudy 인증</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0a0a0f; color: #e8e0f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; padding: 20px; }
  .card { background: #12121a; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 32px; max-width: 360px; width: 100%; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #9490a8; font-size: 13px; margin-bottom: 24px; }
  .client { background: #1a1a26; border-radius: 10px; padding: 12px; margin-bottom: 20px; font-size: 13px; color: #c084fc; }
  input { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: #1a1a26; color: #e8e0f0; font-size: 15px; box-sizing: border-box; outline: none; }
  input:focus { border-color: #c084fc; }
  button { width: 100%; padding: 13px; border-radius: 10px; border: none; background: linear-gradient(135deg, #7c3aed, #a855f7); color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 12px; }
  .err { color: #f87171; font-size: 13px; margin-top: 8px; min-height: 16px; }
</style>
</head><body>
<form class="card" method="POST" action="/authorize">
  <h1>🔐 yahoosjpstudy</h1>
  <div class="sub">다음 앱이 너의 학습 데이터에 접근하려고 해</div>
  <div class="client">${escapeHtml(clientName)}</div>
  <input type="hidden" name="oauthReqInfo" value="${encoded}" />
  <input type="password" name="password" placeholder="비밀번호" autofocus required />
  <button type="submit">승인하기</button>
  <div class="err"></div>
</form>
</body></html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ── OAuth: /authorize POST (비밀번호 검증) ─────────────────────────
async function handleLoginPost(request, env) {
  const formData = await request.formData();
  const password = formData.get('password');
  const encoded = formData.get('oauthReqInfo');

  if (!encoded || !password) return new Response('잘못된 요청', { status: 400 });
  if (!env.AUTH_PASSWORD) return new Response('서버에 AUTH_PASSWORD 시크릿이 설정 안 됨', { status: 500 });
  if (password !== env.AUTH_PASSWORD) {
    return new Response('❌ 비밀번호 틀렸어요. 뒤로 가서 다시 시도.', { status: 401, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  let oauthReqInfo;
  try { oauthReqInfo = JSON.parse(atob(encoded)); }
  catch { return new Response('잘못된 요청', { status: 400 }); }

  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReqInfo,
    userId: 'owner',
    metadata: { label: 'yahoosjpstudy owner' },
    scope: oauthReqInfo.scope,
    props: { userId: 'owner' },
  });

  return Response.redirect(redirectTo, 302);
}

// ── Legacy deploy endpoint (앱 🚀 버튼) ─────────────────────────────
async function handleLegacyDeploy(request) {
  try {
    const { token, repo, message, files } = await request.json();
    if (!token || !repo || !files?.length) return json({ success: false, error: 'token/repo/files required' }, 400);

    const results = [];
    for (const f of files) {
      const r = await pushFile({ token, repo, path: f.path, base64Content: f.content, message: message || `update ${f.path}` });
      results.push({ path: f.path, ...r });
    }
    return json({ success: true, results });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
}

// ── MCP JSON-RPC handler ───────────────────────────────────────────
async function handleMcp(request, env) {
  let msg;
  try { msg = await request.json(); }
  catch { return json({ jsonrpc: '2.0', error: { code: -32700, message: 'parse error' }, id: null }, 400); }

  const { method, params, id } = msg;

  if (method === 'initialize') {
    return json({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'yahoosjpstudy-deploy', version: '1.0.0' },
      },
    });
  }

  if (method === 'notifications/initialized') return new Response(null, { status: 204 });

  if (method === 'tools/list') {
    return json({
      jsonrpc: '2.0', id,
      result: {
        tools: [
          {
            name: 'update_data_json',
            description: '일본어 학습 앱의 data.json을 GitHub에 업데이트하고 Vercel 자동 배포를 트리거합니다. 전체 JSON 문자열을 넘기면 public/data.json을 통째로 교체합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                content: { type: 'string', description: 'data.json 전체 내용 (JSON 문자열)' },
                message: { type: 'string', description: 'GitHub 커밋 메시지' },
              },
              required: ['content'],
            },
          },
          {
            name: 'get_data_json',
            description: '현재 GitHub에 올라간 data.json을 읽어옵니다.',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      },
    });
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};
    try {
      if (name === 'update_data_json') {
        if (!args?.content) throw new Error('content required');
        JSON.parse(args.content);
        const r = await pushFile({
          token: env.GITHUB_TOKEN,
          repo: env.GITHUB_REPO,
          path: 'public/data.json',
          base64Content: btoa(unescape(encodeURIComponent(args.content))),
          message: args.message || `update data.json via Claude (${new Date().toISOString()})`,
        });
        return json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `✅ data.json 업데이트 완료. commit: ${r.sha?.slice(0, 7)}` }] } });
      }

      if (name === 'get_data_json') {
        const r = await fetchFile({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, path: 'public/data.json' });
        return json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: r.content }] } });
      }

      throw new Error(`unknown tool: ${name}`);
    } catch (e) {
      return json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `❌ ${String(e)}` }], isError: true } });
    }
  }

  return json({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
}

// ── GitHub helpers ─────────────────────────────────────────────────
async function pushFile({ token, repo, path, base64Content, message }) {
  const headers = {
    Authorization: `token ${token}`,
    'User-Agent': 'yahoosjpstudy-worker',
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  let sha;
  const existing = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { headers });
  if (existing.ok) sha = (await existing.json()).sha;

  const body = { message, content: base64Content };
  if (sha) body.sha = sha;

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method: 'PUT', headers, body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${data.message || JSON.stringify(data)}`);
  return { ok: true, sha: data.commit?.sha };
}

async function fetchFile({ token, repo, path }) {
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'yahoosjpstudy-worker',
      Accept: 'application/vnd.github.raw',
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return { content: await res.text() };
}

// ── Utils ──────────────────────────────────────────────────────────
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
