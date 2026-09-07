# 2026-09-07 · MC 화면 기동 · Windows 경로 결함 5건

> 분류: fixes · 프로젝트: SK MASIC · 환경: Windows 11 + Node 24 / 리눅스 컨테이너 Node 22
> 계기: "실제 화면 열어봐" — 와이어프레임이 아닌 동작하는 MC 화면을 이 PC 에 띄우는 작업

## 무엇을 만들었나

| 파일 | 역할 |
|---|---|
| `03_engine/pipeline.mjs` | 서버·CLI 공용 파이프라인 (`makeCopy` / `renderStyle` / `greeting` / `contrastPairs`) |
| `03_engine/server.mjs` | 의존성 없는 `node:http` 서버. 포트 5173. `/api/meta` `/api/copy` `/api/render` `/api/sizes` `/api/library` |
| `03_engine/ui/index.html` | 4단계 + 보관함 SPA. 3단계에 **엔진이 실제로 렌더한 PNG** 를 띄운다 |

기동: `npm start` → `http://localhost:5173`

## 결함과 수정

### F-01 `new URL(..., import.meta.url).pathname` 은 Windows 에서 깨진다
- **증상**: 화면이 `not found` 만 출력. API 도 카탈로그를 못 읽음
- **원인**: Windows 에서 `.pathname` 은 `/C:/Users/...` 를 준다. 선행 슬래시 때문에 `path.join` 결과가 존재하지 않는 경로가 된다
- **수정**: 전 파일 `fileURLToPath(new URL(...))` 로 교체 — `pipeline` `cli` `render/template` `verify` `catalog/index` `catalog/trim` `catalog/validate` `crawler/pattern` 8곳
- **교훈**: 개발은 리눅스, 운영은 Windows 인 프로젝트에서 `import.meta.url` 은 **반드시** `fileURLToPath` 를 통과시킨다. 리눅스에서는 우연히 동작하므로 테스트로 잡히지 않는다

### F-02 `el()` 헬퍼가 `aria-pressed="true"` 를 빈 문자열로 바꿨다
- **증상**: 선택 상태(제품 체크·스타일 선택·세그먼트 활성)가 화면에 전혀 안 보임
- **원인**: `v === true ? '' : v` — 불리언 HTML 속성 관례를 ARIA 에도 적용해 `aria-pressed=""` 가 됨. CSS 는 `[aria-pressed="true"]` 를 본다
- **수정**: `aria-*` 는 항상 `String(v)` 로 기록 (false 도 남긴다 — 접근성)

### F-03 인라인 스크립트 괄호 1개 누락
- **증상**: `PAGEERROR missing ) after argument list` — 화면 전체가 백지
- **탐지**: HTML 에서 `<script>` 본문만 추출해 `node --check` 로 검사
- **교훈**: 인라인 스크립트는 문법 검사를 우회한다. **추출 후 `node --check`** 를 배포 전 절차로 둔다

### F-04 인사말 문장이 접합부에서 깨졌다
- `...부담 줄이기 묶음 기준 월 62,700원부터고, 설치...` → 조사 오류 + 줄바꿈 없음
- 수정: subline 뒤 단락 분리, `원부터이고,` 로 교정

### F-05 "카톡으로 보내기" 버튼이 PNG 를 새 탭에 열기만 했다
- 라벨과 동작이 불일치. MC 는 저장 후 카톡에서 직접 첨부한다
- 수정: **배너 전부 저장** (규격별 순차 다운로드) + 토스트 안내로 교체

## 환경 제약 (이 PC 에서 확인)

| 항목 | 결과 |
|---|---|
| Playwright Chromium 다운로드 | **차단** — `cdn.playwright.dev` 403 `Connection blocked by network allowlist` (리눅스 VM·Windows 양쪽) |
| 우회 | `PLAYWRIGHT_CHROMIUM_PATH` 에 **설치된 Chrome** 지정 → 렌더 정상. 5/5 통과, 35~65KB |
| Cowork 리눅스 VM | aarch64. Chromium 없음 → 렌더는 Windows Node 로 실행 |
| Chrome 확장(Claude in Chrome) | `localhost:5173` 접근 실패(오류 페이지). PowerShell·일반 Chrome 창은 200 정상 → **확장 샌드박스 제약**으로 판단 |
| 모바일 화면 확인 | `chrome.exe --app=http://localhost:5173/ --window-size=430,932` 를 `.cmd` 로 만들고 `explorer.exe` 로 실행해야 사용자 세션에 창이 뜬다 (PowerShell `Start-Process` 직접 실행은 화면에 안 나타남) |

## 검증

- 리눅스 컨테이너: 4단계 전체 자동 주행(모바일 420px / 태블릿 900px) — 콘솔 오류 0, 스타일 5종 노출, 다운로드 2종, 보관함 저장·별표 정상
- Windows: `/` 200 (32,788B), 단품 렌더 5/5 통과 (S1·S2 자동 전환), 모바일 430×932 창 정상 표시
