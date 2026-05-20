# 일본어 학습 앱 개발 로그

## 프로젝트 개요
- **목표**: Claude.ai에서 학습 내용 업데이트 → 자동 배포 → 안드로이드에서 사용
- **앱 URL**: https://yahoosjpstudy.vercel.app/
- **GitHub**: https://github.com/khh0929/yahoosjpstudy

---

## 인프라 구조

```
[자동 경로] 안드로이드 Claude 앱에서 대화만 하면 끝
Claude.ai (Custom Connector 등록됨)
    ↓ MCP tool call: update_data_json
Cloudflare Worker /mcp endpoint
    ↓ GitHub API (worker secret의 PAT 사용)
GitHub → Vercel 자동 빌드 → 📱 1-2분 후 반영

[수동 경로] 앱에서 직접 누르는 경우
앱 ⚙️ 설정 → 🚀 배포 버튼 → Worker POST / → GitHub → Vercel
```

---

## 파일 구조 (Vite 마이그레이션 후)

```
yahoosjpstudy/
├── index.html              # Vite entry shell
├── package.json            # Vite + React 18
├── vite.config.js
├── vercel.json             # Vercel 빌드 설정
├── src/
│   ├── main.jsx            # ReactDOM root
│   ├── App.jsx             # 라우팅/상태 관리
│   ├── styles.css          # 전역 스타일
│   ├── lib/
│   │   ├── tts.js          # Google Translate TTS + Web Speech fallback
│   │   └── storage.js      # localStorage 래퍼
│   ├── components/         # TopBar, ProgressBar
│   └── screens/            # Home, Learn, Quiz, Result, Settings, Loading
├── public/
│   ├── data.json           # 커리큘럼 (Claude가 업데이트하는 파일)
│   └── manifest.json       # PWA
└── worker/                 # Cloudflare Worker (deploy + MCP)
    ├── src/index.js
    ├── wrangler.toml
    └── README.md
```

---

## 배포 방법

### PC에서 수동 배포 (PowerShell)

```powershell
# 1. 변수 설정
$token = "ghp_..."; $repo = "khh0929/yahoosjpstudy"; $headers = @{"Authorization"="token $token";"User-Agent"="jp-study-app";"Content-Type"="application/json"}

# 2. 함수 정의
function Upload-File($path, $localFile) { $content = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($localFile)); try { $existing = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/contents/$path" -Headers $headers; $sha = $existing.sha } catch { $sha = $null }; $body = @{message="deploy: $path 업데이트";content=$content}; if ($sha) { $body.sha = $sha }; Invoke-RestMethod -Method Put -Uri "https://api.github.com/repos/$repo/contents/$path" -Headers $headers -Body ($body | ConvertTo-Json -Depth 10); Write-Host "$path 업로드 완료! ✅" }

# 3. 업로드 (파일 경로 맞게 수정)
Upload-File "index.html" "D:\gittest\index.html"
Upload-File "data.json" "D:\gittest\data.json"
```

### 앱에서 배포 (안드로이드)
1. 앱 접속 → ⚙️ 설정
2. GitHub 토큰 입력 후 저장
3. 🚀 배포 버튼 클릭

---

## 현재 커리큘럼 (data.json)

| ID | 제목 | 카테고리 |
|---|---|---|
| katakana-1 | 가타가나 ア행 | katakana |
| katakana-2 | 가타가나 カ행 | katakana |
| katakana-3 | 가타가나 サ행 | katakana |
| katakana-4 | 가타가나 タ행 | katakana |
| katakana-5 | 가타가나 ナ행 | katakana |
| katakana-6 | 가타가나 ハ행 | katakana |
| katakana-7 | 가타가나 マ행 | katakana |
| katakana-8 | 가타가나 ヤ/ワ/ン행 | katakana |
| katakana-9 | 가타가나 ラ행 | katakana |
| hiragana-1 | 히라가나 あ행 | hiragana |
| hiragana-2 | 히라가나 か행 | hiragana |
| hiragana-3 | 히라가나 さ행 | hiragana |
| hiragana-4 | 히라가나 た행 | hiragana |
| hiragana-5 | 히라가나 な행 | hiragana |
| basic-words-1 | 기초 단어 - 인사 | vocabulary |
| basic-words-2 | 기초 단어 - 숫자 | vocabulary |

---

## 앱 기능

### 학습 모드
- **오늘의 학습**: 커리큘럼 순서대로 5개씩, 카드 뒤집기 방식
- **랜덤 복습**: 완료한 레슨에서 15개 랜덤 출제
- **취약점 복습**: 틀린 횟수 많은 순서로 출제

### 퀴즈 모드
- **타이핑**: 한글 또는 로마자 직접 입력
- **객관식**: 4지선다 (모바일 친화적)
- 틀린 문제 자동 재출제

### 기록
- 레슨별 정답률 표시
- 연속 학습 스트릭 🔥
- localStorage에 진도 저장 (기기에 영구 저장)

---

## 개선 필요 사항 (TODO)

- [ ] 발음(TTS) 안정적으로 작동하게 개선
- [ ] 가타가나 탁음/반탁음 (ガ행, バ행 등) 추가
- [ ] 히라가나 나머지 행 추가
- [ ] 기초 문법 섹션 추가
- [ ] 오답 노트 화면
- [ ] 학습 통계 상세 화면
- [ ] data.json만 업데이트하는 배포 버튼 분리
- [ ] UX 개선 (불편한 점 수정)

---

## 기술 스택
- **Frontend**: React 18 (CDN) + Babel Standalone (빌드 없음)
- **Storage**: localStorage
- **폰트**: Noto Sans KR, Noto Sans JP, DM Mono
- **TTS**: Google Translate TTS → Web Speech API fallback
- **배포**: Vercel (GitHub 연동 자동 배포)
- **프록시**: Cloudflare Worker (GitHub API 중계)
