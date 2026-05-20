// Cloudflare Worker — yahoosjpstudy deploy + MCP server
// Endpoints:
//   POST /        → Legacy: 앱 내 🚀 배포 버튼 (요청 본문에 token/repo/files)
//   POST /mcp     → MCP JSON-RPC over HTTP (Claude Custom Connector)
//   GET  /health  → 동작 확인

const MCP_PROTOCOL_VERSION = '2024-11-05';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
    if (url.pathname === '/health') return cors(json({ ok: true }));
    if (url.pathname === '/mcp' && request.method === 'POST') return cors(await handleMcp(request, env));
    if (url.pathname === '/' && request.method === 'POST') return cors(await handleLegacyDeploy(request));

    return cors(json({ error: 'not found' }, 404));
  },
};

// ── Legacy deploy (앱의 🚀 버튼이 호출) ─────────────────────────────
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

// ── MCP handler ────────────────────────────────────────────────────
async function handleMcp(request, env) {
  // Bearer 인증 — Connector 등록 시 같은 시크릿을 헤더에 넣어야 함
  const auth = request.headers.get('Authorization') || '';
  const expected = env.MCP_SHARED_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return json({ jsonrpc: '2.0', error: { code: -32001, message: 'unauthorized' }, id: null }, 401);
  }

  let msg;
  try { msg = await request.json(); } catch { return json({ jsonrpc: '2.0', error: { code: -32700, message: 'parse error' }, id: null }, 400); }

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
        JSON.parse(args.content); // validate
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
