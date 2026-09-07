# WORKFLOW

## MC 화면(4단계) ↔ 엔진 파이프라인(10스텝) 대응

```
 MC 화면                  엔진 스텝
 ─────────────────────────    ────────────────────────────────────────────
                              [1] crawl      공식몰 수집        (배치·야간)
                              [2] normalize  카탈로그 정규화    (배치·야간)
                              [3] assetize   여백 트림·리사이즈 (배치·야간)
 1 상품 선택            ───▶  [4] select     선택 상품 확정
 2 문구 선택            ───▶  [5] copy       문구 3안 생성
                              [6] compliance 금지어·고지 검수
 3 배너 스타일 선택     ───▶  [7] compose    스타일×규격 → 패턴 → 슬롯 → 충돌 해소
                              [8] render     HTML+Playwright → PNG + 실측 rect
                              [9] qa         8항목 게이트 → 통과분만 시안 목록
 4 배너 다운로드        ───▶  [10] deliver   다운로드·전송 + 보관함 저장 + KMS
```

**중요** — 7·8·9는 MC가 3단계에 진입하는 순간 **스타일 6종 × 선택 규격만큼 병렬로 미리 돌린다.**
MC가 보는 시안 목록은 이미 QA를 통과한 결과물이다. 실패한 조합은 목록에 뜨지 않는다.

---

## 스텝별 상세

### [1] crawl — 공식몰 수집
- 실행: 야간 배치 (일 1회) + MC 수동 트리거
- 대상: `/goods/indexGoodsList?dispClsfNo={code}` → `/goods/indexGoodsDetail?goodsId={id}`
- 목록 페이지는 JS 렌더 → Playwright 필요
- 이미지: `https://static.skmagic.com/image/goods/{goodsId}/{goodsId}_{n}.png`
- 출력: `02_data/raw/{yyyymmdd}/{goodsId}.json`, `02_data/assets/original/{goodsId}_{n}.png`
- 실패 처리: 3회 재시도 → 실패분은 이전 스냅샷 유지 + `05_kms/errors/`에 기록

### [2] normalize — 카탈로그 정규화
- 입력: `raw/*.json` + MC 엑셀/CSV 오버라이드
- `01_spec/product.schema.json` 으로 검증. 실패 항목은 **제외**하고 로그
- 가격은 약정별 배열로 저장. 없으면 `null` (추정 금지)
- `syncedAt` 타임스탬프 필수 → 7일 초과 시 배너 생성 차단
- 출력: `02_data/catalog/products.json`

### [3] assetize — 이미지 여백 트림
- alpha 채널 또는 흰 배경 bbox를 계산해 잘라낸다
- **이 단계가 겹침 문제의 절반을 해결한다** — 원본은 여백이 커서 시각 중심이 슬롯과 어긋난다
- 규격별 최대 필요 크기로 리사이즈 (컨테인 피팅 전제)
- 출력: `02_data/assets/trimmed/{goodsId}_{n}.png` + `trim.json`(bbox 메타)

### [4] select — 선택 확정
- 입력: 상품 ID 배열, 단품/종합, HERO 지정(없으면 월 구독료 최고가)
- 검증: 종합은 2~12종. 약정 기간 혼재 여부 판정 → 가격 표기 숨김 플래그

### [5] copy — 문구 3안 생성
- OpenAI Structured Outputs. 계약: `01_spec/prompt-contract.md`
- 입력에 규격별 글자수 상한을 넣는다 (`01_spec/banner-spec.json`)
- 응답 후 **서버에서 다시 검사** — 글자수, 3속성 순서, 금지어
- 초과 시 상한을 낮춰 재요청 (최대 2회)

### [6] compliance — 검수
- 금지어 사전 매칭 → 치환 가능하면 치환, 불가하면 후보 폐기
- 필수 고지 4항목(약정기간·의무사용기간·등록비·중도해지 위약금) 삽입
- MC에게는 "바꿨습니다"로만 안내. 규제 용어를 노출하지 않는다

### [7] compose — 패턴 결정 · 슬롯 산출 · 충돌 해소
- 스타일 토큰 로드 → 허용 패턴 ∩ (제품 수 × 규격) 결정
- 슬롯 좌표는 0~1 정규화 정의를 규격 픽셀로 변환
- 겹침 회피 6개 규칙 순차 적용 (`01_spec/layout-rules.md`)
- 후보가 2개 이상이면 LLM에 최종 선택 위임, 1개면 생략

### [8] render — PNG 생성
- HTML 템플릿(`03_engine/templates/`) + 스타일 토큰 주입
- **폰트 로딩 완료(`document.fonts.ready`) 후 캡처** — 안 하면 폴백 폰트로 찍힌다
- 고정 뷰포트. 기기 화면 크기와 무관하게 동일 결과
- 캡처 직전 모든 요소의 `getBoundingClientRect()` 를 수집해 반환

### [9] qa — 8항목 게이트
| 항목 | 기준 |
|---|---|
| 텍스트 ∩ 제품 IoU | ≤ 0.02 |
| 텍스트 ∩ 텍스트 겹침 | 0 |
| 최소 폰트 | ≥ 짧은 변의 3% (1080 기준 32px) |
| 텍스트 대비비 | ≥ 4.5:1 |
| 세이프존 침범 | 0 |
| 오버플로·절삭 | 0 |
| 파일 용량 | ≤ 500KB |
| 필수 고지문 | 포함 |

- 실패 반송: 문구 문제 → [5] (최대 2회) / 배치 문제 → [7] (최대 5회) / 둘 다 실패 → 규격 격상 후 재시도 → 그래도 실패면 **목록에서 제외**
- 스타일 목록에 최소 3개를 보장하지 못하면 규격을 격상해 재시도

### [10] deliver — 전달 · 보관 · 학습
- 파일명: `04_output/{single|composite}/{yyyymmdd}/{CODE}.png`
  - 단품 `SGL-{모델코드}-{규격}-{스타일}` / 종합 `CMP-{제품수}P-{규격}-{스타일}`
- 보관함 저장: 배너 1건 = 하나의 세트(여러 규격을 묶음). 스타일·제품·문구·고객태그 메타 포함
- 동반 인사말 생성 — 이미지를 못 보는 고객도 문자만으로 판단할 수 있게 핵심 정보 반복
- KMS 적재: 성공 조합 → `success/`, 게이트 실패 원인 → `errors/`+`fixes/`, 채택 문구 → `snippets/`
- 다음 생성 시 KMS 기록을 스타일 목록 정렬 가중치로 사용

---

## 데이터 흐름 한 장

```
공식몰 ─crawl─▶ raw/*.json ─normalize─▶ catalog/products.json
                     │                          │
                original/*.png ─assetize─▶ trimmed/*.png
                                                │
MC 선택 ────────────────────────────────────┤
                                                ▼
                            OpenAI COPY ──▶ copy.json ──▶ COMPLIANCE
                                                              │
                            스타일 토큰 ──▶ compose ──▶ layout.json
                                                              │
                                          HTML 템플릿 + Playwright
                                                              │
                                              PNG + rects ──▶ QA
                                                              │
                                        통과 시안 ──▶ MC 선택 ──▶ 다운로드
                                                              │
                                                     보관함 + KMS
```
