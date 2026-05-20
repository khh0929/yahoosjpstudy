# yahoosjpstudy Worker

Cloudflare Worker — Claude Custom Connector 호환 MCP 서버 (OAuth 2.1 + PKCE)

## Endpoints

| Route | 용도 |
|---|---|
| `POST /mcp` | MCP JSON-RPC (OAuth 보호) |
| `GET/POST /authorize` | 로그인 화면 |
| `POST /token`, `POST /register`, `/.well-known/...` | OAuth 자동 처리 |
| `POST /` | Legacy: 앱 🚀 배포 버튼 |
| `GET /health` | 헬스체크 |

## 처음 설정 (한 번만)

```powershell
cd D:\gittest\worker

# 1. 의존성
npm install

# 2. Cloudflare 로그인
npx wrangler login

# 3. OAuth 토큰 저장소 KV 만들기
npx wrangler kv namespace create OAUTH_KV
#   → 출력에 id = "xxxxxxxx" 같은 값이 나옴
#   → wrangler.toml의 REPLACE_WITH_KV_ID_AFTER_CREATE 자리에 그 id를 붙여넣기

# 4. 시크릿 3개
npx wrangler secret put GITHUB_TOKEN     # repo 권한 PAT
npx wrangler secret put GITHUB_REPO      # khh0929/yahoosjpstudy
npx wrangler secret put AUTH_PASSWORD    # /authorize에서 입력할 비밀번호 (네가 정함)

# 5. 배포
npm run deploy
```

## 업데이트 (코드 수정 시)

```powershell
cd D:\gittest\worker
npm run deploy
```

## Claude.ai에 Connector 등록

1. claude.ai → Settings → **Connectors** → **Add custom connector**
2. URL: `https://wispy-voice-ac17.<account>.workers.dev/mcp`
3. **고급 설정은 비워둠** — Claude가 자동으로 DCR(Dynamic Client Registration)로 등록
4. 등록 후 "연결" 클릭 → 브라우저에서 로그인 페이지 뜸 → `AUTH_PASSWORD` 입력 → 승인

이후 안드로이드 Claude 앱에서 같은 계정으로 로그인하면 자동 동기화. 대화만으로 `update_data_json` 호출 가능.
