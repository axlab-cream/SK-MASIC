# SK MASIC — 카카오톡 배너 자동생성기

> LLM 진입점. **이 파일을 먼저 읽고, 아래 순서대로 문서를 읽은 뒤 작업을 시작한다.**
> 프로젝트 루트 (현재 작업본): `C:\Users\carro\Downloads\SK-MASIC`
> 이전 경로: `C:\Users\user\Desktop\SK  MASIC\SK-MASIC` — 다른 Windows 계정이다.
> 두 곳이 다르면 **작업 전에 사용자에게 어느 쪽이 기준인지 확인한다.** (AIOS 규약)
> 공백 2개가 들어간 경로를 쓸 때는 반드시 따옴표로 감싼다.

## 이 프로젝트가 무엇인가

SK매직 상품을 판매하는 **오프라인 MC**가, 디자인 지식 없이 고객에게 보낼
카카오톡 배너 이미지를 골라서 다운로드하고 바로 발송할 수 있게 하는 도구.

MC가 하는 일은 네 단계뿐이다.

```
1 상품 선택 → 2 문구 선택 → 3 배너 스타일 선택 → 4 배너 다운로드
                                                    └→ 보관함(별도 공간)에 자동 저장
```

## 화면 띄우기 (MC 가 실제로 쓰는 그 화면)

```bash
npm start            # → http://localhost:5173
```

Playwright Chromium 다운로드가 사내망에서 막히면 (`cdn.playwright.dev` 403),
설치된 Chrome 을 렌더 엔진으로 쓴다.

```powershell
$env:PLAYWRIGHT_CHROMIUM_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
npm start
```

모바일 크기로 보려면:

```
99_scratch/open-mobile.cmd     # chrome --app 430x932
```

## 0단계 — 이 PC 에서 처음 열었다면

```bash
node 03_engine/verify.mjs
```

무엇이 되고 무엇이 막혔는지 한 화면에 나온다. 그 다음 `HANDOFF.md` 를 읽는다.
이 프로젝트는 다른 환경에서 만들어져 ZIP 으로 전달되었고, **크롤러 실행과 실제 제품 사진 적용이 남아 있다.**

## 읽는 순서 (필수)

| 순서 | 파일 | 왜 읽나 |
|---|---|---|
| 0 | `HANDOFF.md` | **이어받는 작업 목록.** 무엇이 검증됐고 무엇이 남았는가 |
| 1 | `00_projectops/GOAL.md` | 무엇을 만들고 무엇을 만들지 않는가 |
| 2 | `00_projectops/DECISIONS.md` | 이미 결정된 것 — 다시 제안하지 말 것 |
| 3 | `00_projectops/WORKFLOW.md` | 10단계 파이프라인과 데이터 흐름 |
| 4 | `00_projectops/TASKS.md` | 지금 할 일. 작업 후 상태를 갱신한다 |
| 5 | `00_projectops/ROADMAP.md` | P0~P5 단계와 완료 기준 |
| 6 | `01_spec/*` | 구현 직전에 해당 스펙만 읽는다 |
| 7 | `AGENTS.md` | 역할 분담이 필요할 때 |

## 절대 규칙 (위반 시 작업 중단)

1. **제품 사진을 생성·합성하지 않는다.** 공식 CDN 원본만 사용한다.
   배경·장식 이미지 생성만 허용한다. (표시광고법 리스크)
2. **가격·고지문을 LLM이 쓰지 않는다.** 카탈로그 값을 코드로 주입한다.
   LLM 응답에 가격 필드가 있으면 응답 전체를 폐기한다.
3. **겹침 판정은 실측값으로 한다.** 픽셀 추정 금지.
   Playwright `getBoundingClientRect()` 결과로만 IoU를 계산한다.
4. **QA 게이트를 통과하지 못한 배너는 MC에게 노출하지 않는다.**
   숨기고 재시도하되, 실패 사실을 화면에 띄우지 않는다.
5. **슬롯·IoU·대비비·패턴코드 같은 내부 용어를 UI에 노출하지 않는다.**
   MC는 비전문가다. `01_spec/content-copy-rules.md`의 문장 규칙을 따른다.
6. **SK magic UI Guide는 비공식 역설계 자료다.** 툴 화면에는 적용하되,
   고객에게 발송되는 배너는 공식 CI·BI 확인이 선행되어야 한다. (`DECISIONS.md` D-09)

## 기술 스택 (확정)

- 렌더: **HTML 템플릿 + Playwright** 헤드리스 PNG 캡처 (고정 뷰포트)
- LLM: **OpenAI API** — 4개 역할 (`01_spec/prompt-contract.md`)
- 수집: 공식몰 크롤링 (Playwright) + 엑셀/CSV 오버라이드
- 데이터: JSON 카탈로그 (`01_spec/product.schema.json`으로 검증)

## 작업 후 반드시 할 것

- `00_projectops/TASKS.md` 의 해당 항목 상태 갱신
- 새로 결정한 것이 있으면 `00_projectops/DECISIONS.md` 에 추가
- 오류/수정/성공 사례를 `05_kms/` 하위에 기록 (AIOS KMS 규약)
