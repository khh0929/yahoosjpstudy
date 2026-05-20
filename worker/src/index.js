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
const SERVER_INSTRUCTIONS = `이 서버는 일본어 학습 앱(yahoosjpstudy)의 커리큘럼(public/data.json)을 관리합니다.

⚡ 토큰 효율을 위해 다음 규칙을 지키세요:
1. 작업 시작 전 항상 \`get_lesson_index\`로 현재 구조를 먼저 확인하세요 (전체 파일을 읽지 마세요).
2. 변경할 때는 가능한 세분화된 도구를 사용하세요:
   - 레슨 추가 → \`add_lesson\`
   - 레슨 수정 → \`update_lesson\`
   - 레슨 삭제 → \`delete_lesson\`
   - 순서 변경 → \`reorder_lessons\`
   - 특정 레슨 내용 확인 → \`get_lesson\`
3. \`get_data_json\` / \`update_data_json\`은 대대적 구조 변경이 필요한 특수 상황에만 사용하세요 (전체 파일을 입출력에 싣게 되어 토큰 낭비).

레슨 스키마:
{ id: string(unique), title: string, category: "katakana"|"hiragana"|"vocabulary"|"grammar"|...,
  items: [{ char: string, reading: string, romaji?: string, hint?: string }] }

변경은 즉시 GitHub에 push되어 Vercel이 자동 빌드합니다.`;

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
        serverInfo: { name: 'yahoosjpstudy-deploy', version: '2.0.0' },
        instructions: SERVER_INSTRUCTIONS,
      },
    });
  }

  if (method === 'notifications/initialized') return new Response(null, { status: 204 });

  if (method === 'tools/list') return json({ jsonrpc: '2.0', id, result: { tools: TOOL_DEFINITIONS } });

  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};
    try {
      const text = await callTool(name, args || {}, env);
      return json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } });
    } catch (e) {
      return json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `❌ ${String(e.message || e)}` }], isError: true } });
    }
  }

  return json({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
}

// ── Tool definitions ───────────────────────────────────────────────
const TOOL_DEFINITIONS = [
  {
    name: 'get_lesson_index',
    description: '커리큘럼의 메타 정보만 가져옵니다. 각 레슨의 id, title, category, item 개수만 반환하여 토큰을 절약합니다. 작업 시작 전 항상 먼저 호출하세요.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_lesson',
    description: '특정 레슨 하나의 전체 내용(items 포함)을 가져옵니다.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: '레슨 ID (예: hiragana-1)' } },
      required: ['id'],
    },
  },
  {
    name: 'add_lesson',
    description: '새 레슨을 추가합니다. position을 지정하지 않으면 맨 끝에 추가됩니다. id가 이미 존재하면 실패합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        lesson: {
          type: 'object',
          description: '추가할 레슨 객체. { id, title, category, items: [{ char, reading, romaji?, hint? }] }',
        },
        position: { type: 'number', description: '삽입 위치 (0-based). 생략 시 맨 끝.' },
        message: { type: 'string', description: 'GitHub 커밋 메시지 (생략 시 자동 생성)' },
      },
      required: ['lesson'],
    },
  },
  {
    name: 'update_lesson',
    description: '기존 레슨을 통째로 교체합니다. id로 찾아서 매칭되는 레슨을 새 객체로 대체합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '교체 대상 레슨 ID' },
        lesson: { type: 'object', description: '새 레슨 객체 (id 포함, 변경 가능)' },
        message: { type: 'string' },
      },
      required: ['id', 'lesson'],
    },
  },
  {
    name: 'delete_lesson',
    description: '특정 레슨을 제거합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '제거할 레슨 ID' },
        message: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'reorder_lessons',
    description: '레슨 순서를 재배치합니다. ids 배열의 순서대로 정렬되며, 누락된 레슨은 끝에 원래 순서대로 남습니다.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: '원하는 순서의 레슨 ID 배열 (전부 나열하지 않아도 됨)' },
        message: { type: 'string' },
      },
      required: ['ids'],
    },
  },
  {
    name: 'get_data_json',
    description: '⚠️ 토큰 비쌈. 전체 data.json을 반환합니다. 구조 전체를 검토해야 하는 특수 상황에만 사용하세요. 일반적으로는 get_lesson_index + get_lesson 조합이 더 효율적입니다.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'update_data_json',
    description: '⚠️ 토큰 비쌈 + 위험. data.json을 통째로 교체합니다. 대대적인 구조 변경이 필요한 특수 상황에만 사용하세요. 일반적인 레슨 추가/수정/삭제는 add_lesson 등 세분화 도구를 쓰세요.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'data.json 전체 내용 (JSON 문자열)' },
        message: { type: 'string' },
      },
      required: ['content'],
    },
  },
];

// ── Tool dispatch ──────────────────────────────────────────────────
async function callTool(name, args, env) {
  switch (name) {
    case 'get_lesson_index': {
      const data = await loadData(env);
      const index = (data.curriculum || []).map((l, i) => ({
        position: i,
        id: l.id,
        title: l.title,
        category: l.category,
        itemCount: Array.isArray(l.items) ? l.items.length : 0,
      }));
      return JSON.stringify({ version: data.version, totalLessons: index.length, lessons: index }, null, 2);
    }

    case 'get_lesson': {
      requireString(args.id, 'id');
      const data = await loadData(env);
      const lesson = (data.curriculum || []).find((l) => l.id === args.id);
      if (!lesson) throw new Error(`lesson not found: ${args.id}`);
      return JSON.stringify(lesson, null, 2);
    }

    case 'add_lesson': {
      const lesson = args.lesson;
      validateLesson(lesson);
      const data = await loadData(env);
      data.curriculum ??= [];
      if (data.curriculum.find((l) => l.id === lesson.id)) {
        throw new Error(`lesson id already exists: ${lesson.id}. Use update_lesson instead.`);
      }
      const pos = Number.isInteger(args.position) ? Math.max(0, Math.min(args.position, data.curriculum.length)) : data.curriculum.length;
      data.curriculum.splice(pos, 0, lesson);
      const r = await saveData(env, data, args.message || `add lesson: ${lesson.title} (${lesson.id})`);
      return `✅ 레슨 추가됨: ${lesson.id} @${pos}. commit ${r.sha?.slice(0, 7)}`;
    }

    case 'update_lesson': {
      requireString(args.id, 'id');
      validateLesson(args.lesson);
      const data = await loadData(env);
      const idx = (data.curriculum || []).findIndex((l) => l.id === args.id);
      if (idx < 0) throw new Error(`lesson not found: ${args.id}`);
      if (args.lesson.id !== args.id && data.curriculum.find((l, i) => i !== idx && l.id === args.lesson.id)) {
        throw new Error(`new id collides with existing lesson: ${args.lesson.id}`);
      }
      data.curriculum[idx] = args.lesson;
      const r = await saveData(env, data, args.message || `update lesson: ${args.lesson.title} (${args.id})`);
      return `✅ 레슨 수정됨: ${args.id}. commit ${r.sha?.slice(0, 7)}`;
    }

    case 'delete_lesson': {
      requireString(args.id, 'id');
      const data = await loadData(env);
      const idx = (data.curriculum || []).findIndex((l) => l.id === args.id);
      if (idx < 0) throw new Error(`lesson not found: ${args.id}`);
      const [removed] = data.curriculum.splice(idx, 1);
      const r = await saveData(env, data, args.message || `delete lesson: ${removed.title} (${args.id})`);
      return `✅ 레슨 삭제됨: ${args.id}. commit ${r.sha?.slice(0, 7)}`;
    }

    case 'reorder_lessons': {
      if (!Array.isArray(args.ids)) throw new Error('ids must be an array');
      const data = await loadData(env);
      const byId = new Map((data.curriculum || []).map((l) => [l.id, l]));
      const reordered = [];
      for (const id of args.ids) {
        const l = byId.get(id);
        if (!l) throw new Error(`unknown id in ids: ${id}`);
        reordered.push(l);
        byId.delete(id);
      }
      for (const l of byId.values()) reordered.push(l); // 누락분은 원래 순서로 뒤에
      data.curriculum = reordered;
      const r = await saveData(env, data, args.message || `reorder ${args.ids.length} lessons`);
      return `✅ 순서 변경됨 (${data.curriculum.length}개). commit ${r.sha?.slice(0, 7)}`;
    }

    case 'get_data_json': {
      const r = await fetchFile({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, path: 'public/data.json' });
      return r.content;
    }

    case 'update_data_json': {
      requireString(args.content, 'content');
      JSON.parse(args.content); // validate
      const r = await pushFile({
        token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, path: 'public/data.json',
        base64Content: btoa(unescape(encodeURIComponent(args.content))),
        message: args.message || `update data.json via Claude (${new Date().toISOString()})`,
      });
      return `✅ data.json 전체 교체됨. commit ${r.sha?.slice(0, 7)}`;
    }

    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

// ── Data load/save helpers ─────────────────────────────────────────
async function loadData(env) {
  const r = await fetchFile({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, path: 'public/data.json' });
  try { return JSON.parse(r.content); }
  catch (e) { throw new Error(`failed to parse remote data.json: ${e.message}`); }
}

async function saveData(env, data, message) {
  const content = JSON.stringify(data, null, 2);
  return await pushFile({
    token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, path: 'public/data.json',
    base64Content: btoa(unescape(encodeURIComponent(content))),
    message,
  });
}

function validateLesson(lesson) {
  if (!lesson || typeof lesson !== 'object') throw new Error('lesson must be an object');
  requireString(lesson.id, 'lesson.id');
  requireString(lesson.title, 'lesson.title');
  requireString(lesson.category, 'lesson.category');
  if (!Array.isArray(lesson.items) || lesson.items.length === 0) throw new Error('lesson.items must be a non-empty array');
  lesson.items.forEach((it, i) => {
    if (!it || typeof it !== 'object') throw new Error(`items[${i}] must be an object`);
    requireString(it.char, `items[${i}].char`);
    requireString(it.reading, `items[${i}].reading`);
  });
}

function requireString(v, label) {
  if (typeof v !== 'string' || !v.length) throw new Error(`${label} must be a non-empty string`);
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
