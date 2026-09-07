# OpenAI 요청 계약

구현: `03_engine/llm/copy.mjs`, `03_engine/llm/compliance.mjs`

## 역할 4개

| 역할 | 모델 | 호출 조건 |
|---|---|---|
| COPY_GEN | `OPENAI_MODEL_COPY` | 규격마다 1회 (규격별 글자수 상한이 다르다) |
| LAYOUT_ADVISE | `OPENAI_MODEL_LAYOUT` | **패턴 후보가 2개 이상일 때만**. 1개면 생략 (D-17) |
| BG_GEN | `OPENAI_MODEL_IMAGE` | 배경·장식만. 캐시 키 = 시즌 × 톤 × 규격 |
| COMPLIANCE | `OPENAI_MODEL_COPY` | 금지어 사전으로 1차 처리 후 애매한 건만 |

## COPY_GEN 스키마

```
입력                              출력 (Structured Outputs · strict)
─────────────────────────────     ──────────────────────────────────
products[]                        candidates[3]
  모델코드 · 제품명                 angle: benefit | scene | price
  관리방식 · 기능 · 색상             headline: string
  기준가 · 할인가 · 약정             subline:  string   ← 3속성 순서
target · season · tone            cta:      string
emphasis (MC 자유 입력)            labels[]: string
limits {headline,subline,cta}     badge:    string | null
banned[]                          ── price · notice 필드는 스키마에 없다 ──
```

## 서버측 재검사 — 프롬프트를 신뢰하지 않는다

| # | 검사 | 실패 처리 |
|---|---|---|
| 1 | 글자수 | 상한을 낮춰 재요청 (최대 2회) |
| 2 | 금지어 사전 매칭 | 치환 가능하면 치환, 불가하면 후보 폐기 |
| 3 | subline 의 **3속성 순서** (관리→기능→색상 정규식) | 후보 폐기 |
| 4 | 응답에 `price`/`notice` 필드 또는 금액 문자열 존재 | **응답 전체 폐기** |

4번이 핵심이다. LLM 이 숫자를 쓰는 경로를 스키마 단계에서 없애고,
그래도 새어 나오면 폐기한다. 가격 환각은 고객 발송 광고물에서 사고로 직결된다.

## 오프라인 폴백

`OPENAI_API_KEY` 가 없으면 규칙 기반 폴백(`fallback()`)이 3안을 만든다.
타겟·톤·시즌 사전과 제품 3속성을 조합하며, 글자수·금지어·3속성 순서를 동일하게 지킨다.
**PoC 는 이 경로로 39장을 생성했다** — API 키 없이도 파이프라인 전체가 검증된다.
