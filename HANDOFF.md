# HANDOFF — 새 세션이 이 프로젝트를 이어받는 방법

이 프로젝트는 **클라우드 컨테이너에서 만들어져 ZIP 으로 전달**되었다.
그 세션은 사용자의 PC(`C:\Users\user`)에 연결되지 못했으므로, 아래 작업은 **이 PC 에서 열린 새 세션**이 이어받는다.

## 프로젝트 루트

```
C:\Users\user\Desktop\SK  MASIC\SK-MASIC
```

상위 폴더 `SK  MASIC` 에 **공백이 2개** 있다. 경로는 항상 따옴표로 감싼다.

```powershell
cd "C:\Users\user\Desktop\SK  MASIC\SK-MASIC"
```

## 0단계 — 환경 자체점검 (제일 먼저)

```bash
node 03_engine/verify.mjs
```

이 스크립트가 확인하는 것: Node 버전 · playwright 설치 · Chromium 실행 · 폰트 파일 ·
카탈로그 스키마와 신선도 · **skmagic.com / static.skmagic.com 도달 여부** · OpenAI 키 유무.

앞선 세션에서 **막혔던 두 가지가 이 PC 에서는 풀릴 것**이다.
- `static.skmagic.com` 차단 → 실제 제품 사진을 쓸 수 있다
- `www.skmagic.com` 차단 → 크롤러를 실제로 돌릴 수 있다

## 1단계 — 읽기

`CLAUDE.md` 의 읽는 순서를 따른다. 특히 `00_projectops/DECISIONS.md` 는
**이미 결정된 사항**이므로 다시 제안하지 않는다.

## 2단계 — 이어서 할 일 (우선순위 순)

### A. 자산 반영 (`TASKS.md` A-01 · A-02)
1. 로고 원본을 `01_spec/assets/logo/` 에 넣는다 (기본 + 리버스). SVG 권장
2. `03_engine/render/template.mjs` 의 `.logoslot` / `.plate` 를 실제 `<img>` 로 교체
3. 폰트를 자체 호스팅 파일로 쓸 경우 `03_engine/fonts/` 를 교체하고 `fontCss()` 의 파일명을 맞춘다
   - 지금은 Google Fonts 배포판(Noto Sans KR + Roboto)을 로컬 임베드해 둔 상태다. 그대로 써도 동작한다

### B. 실제 상품DB 수확 (`P0-04` · `P0-05` — 코드는 작성 완료, 미실행)
```bash
npm run crawl
```
- 설정: `03_engine/crawler/patterns.config.json`
- **식기세척기 · 전기레인지 · 건조기의 `dispClsfNo` 가 비어 있다.** 공식몰 GNB 에서 해당 카테고리를 열고
  주소창의 `dispClsfNo` 값을 config 의 `categories` 에 추가한다
- 수확 결과는 `02_data/raw/harvest-{날짜}.json`. **가격은 `priceCandidates` 배열로만 들어온다** —
  추정하지 않는 설계다. 확정은 정규화 단계에서 사람이 확인하거나 엑셀 오버라이드로 덮는다

### C. 정규화 + 이미지 트림 — **구현 완료**
```bash
npm run catalog                                  # 최신 harvest 를 자동으로 찾는다
npm run catalog -- --override 02_data/override.csv
npm run catalog -- --no-images                   # 이미지 없이 정규화만
```
- `raw/harvest-*.json` → 검증 → 오버라이드 → `02_data/catalog/products.json`
- 이미지는 CDN 원본 → `assets/original/` → **bbox 트림** → `assets/trimmed/` → `image` 필드에 경로
- 가격은 추정하지 않는다. 확정되지 않으면 `needsPriceConfirm: true` 로 남고 배너에서 가격이 숨겨진다
- `02_data/override.csv.example` 를 `override.csv` 로 복사해 쓴다 (한글 헤더 지원)

**이 PC 에서 할 일** — `npm run crawl` 후 `npm run catalog` 를 돌려 실제 사진이 들어간 카탈로그를 만든다

### D. 실제 사진으로 재검증
```bash
npm run poc
```
자리표시자가 실제 제품 사진으로 바뀌면 **겹침·대비 판정이 달라질 수 있다.**
사진은 자리표시자보다 시각 무게가 크므로 충돌 해소 횟수가 늘어날 가능성이 높다.
`04_output/*/qa-report.json` 의 `log` 에서 `collide` 건수를 앞선 PoC 와 비교한다
(앞선 결과는 `05_kms/success/2026-09-07-poc-matrix.md`).

### E. OpenAI 경로 전환 (`P3-01`)
`.env` 에 `OPENAI_API_KEY` 를 넣으면 문구 생성이 Structured Outputs 경로로 바뀐다.
콘솔의 `문구원=` 이 `fallback` → `openai` 로 변한다. **서버측 재검사 4개는 그대로 돈다** —
특히 4번(가격 필드 발견 시 응답 전체 폐기)이 작동하는지 의도적 오류로 확인한다.

### F. 미구현 항목 — **구현 완료**
- `P3-04` LAYOUT_ADVISE — `03_engine/llm/layout.mjs`. 후보 2개 이상일 때만 호출, 후보 밖 key 는 규칙 1순위로 폴백
- `P3-07` 자동 재시도 — 문구 문제 → 다음 문구 후보(최대 2회) / 배치 문제 → 다음 패턴(최대 5회)
- `P3-08` 최소 3개 보장 — 규격 격상 루프. `sizeFixable` 이 아닌 제외는 대상에서 뺀다

남은 것은 `P3-05` BG_GEN(배경 이미지 생성)뿐이다.

### G. 참조 아키텍처 분석 (미착수)
```
C:\Users\user\Desktop\CJ-banner-deploy-h1-20260827
```
배너 생성기 아키텍처 · 그라데이션 · 문구 추가 · 이미지 위 텍스트 처리 참고자료.
앞선 세션은 이 폴더에 접근할 수 없었다. 이 PC 의 세션은 읽을 수 있으므로,
분석 후 이 프로젝트에 반영할 것과 버릴 것을 `00_projectops/DECISIONS.md` 에 남긴다.

## 앞선 PoC 가 검증한 것 / 못 한 것

| 항목 | 상태 |
|---|---|
| 4규격 × 6스타일 × 제품수 1~12 렌더 | **검증** — 39장 생성, QA 8항목 전량 통과 |
| 겹침 회피 6개 규칙 | **검증** — 실측 rect 기반, 충돌 해소 로그 확인 |
| QA 게이트 8항목 | **검증** — 실제 결함 5건을 잡아냄 (`05_kms/fixes/`) |
| 문구 생성 · 금지어 치환 · 3속성 순서 | **검증** (규칙 폴백 경로) |
| 실제 제품 사진 | **미검증** — CDN 차단 |
| 크롤러 | **미실행** — 사이트 차단 |
| 정규화 · 트림 · 오버라이드 | **검증** — 합성 이미지와 흉내낸 harvest 로 확인 |
| 재시도 루프 · 격상 · LLM 선택부 | **검증** — 설계 결함 4건을 잡아냄 (TASKS 2차 작업 참조) |
| OpenAI 경로 | **미검증** — 키 없음 |
| 로고 | **미반영** — 파일 없음 |
