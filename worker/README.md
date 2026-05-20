# yahoosjpstudy Worker

Cloudflare Worker — 두 가지 역할:

1. **`POST /`** — 앱의 🚀 배포 버튼이 호출하는 legacy GitHub 프록시
2. **`POST /mcp`** — Claude Custom Connector가 호출하는 MCP 서버 (안드로이드 Claude 앱에서 직접 `update_data_json` 도구 호출)

## 한 번만 설정

```bash
cd worker
npm install
npx wrangler login

# 시크릿 등록 (3개)
npx wrangler secret put GITHUB_TOKEN        # repo 권한이 있는 GitHub PAT
npx wrangler secret put GITHUB_REPO         # khh0929/yahoosjpstudy
npx wrangler secret put MCP_SHARED_SECRET   # 아무 긴 랜덤 문자열

# 배포
npm run deploy
```

배포 후 URL은 `https://wispy-voice-ac17.<account>.workers.dev` 형태.

## Claude.ai에 Connector 등록

1. claude.ai → Settings → Connectors → Add custom connector
2. URL: `https://wispy-voice-ac17.<account>.workers.dev/mcp`
3. Auth: `Bearer <MCP_SHARED_SECRET>`
4. 등록 후 안드로이드 Claude 앱에서 같은 계정으로 로그인하면 자동 동기화

## 사용

> "오늘 히라가나 ま행 추가해서 배포해줘"

Claude가 `update_data_json` 툴을 호출 → GitHub push → Vercel 자동 빌드 → 1-2분 후 앱에 반영.
