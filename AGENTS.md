# AGENTS — 역할 기반 작업 분담

각 에이전트는 **자기 입력과 출력만** 책임진다. 다른 단계의 파일을 직접 고치지 않는다.

## A1 · Catalog Agent
- 입력: 공식몰 페이지, MC 제공 엑셀/CSV
- 출력: `02_data/catalog/products.json` (+ `assets/trimmed/*.png`)
- 스펙: `01_spec/product.schema.json`
- 책임: 스키마 검증, 여백 트림, 가격 신선도(7일) 태깅
- 금지: 가격을 추정하거나 보정하지 않는다. 없으면 `null`

## A2 · Copy Agent
- 입력: 선택 상품 + 타겟/시즌/톤/강조점 + 글자수 상한
- 출력: 문구 후보 3안 (`headline` `subline` `cta` `labels` `badge`)
- 스펙: `01_spec/prompt-contract.md`, `01_spec/content-copy-rules.md`
- 책임: 3속성 순서(관리→기능→색상), 글자수, 금지어
- 금지: 가격·고지문 작성

## A3 · Compliance Agent
- 입력: 문구 후보
- 출력: 통과 / 치환안 / 폐기 판정
- 스펙: `01_spec/content-copy-rules.md` 금지어 매핑
- 책임: 최상급·비교·의료 효능 표현 탐지, 필수 고지 4항목 확인

## A4 · Layout Agent
- 입력: 제품 수 · 규격 · 문구 실측 길이 · 스타일 토큰
- 출력: 패턴 선택 + 슬롯 좌표 + 충돌 해소 로그
- 스펙: `01_spec/layout-rules.md`, `01_spec/banner-spec.json`
- 책임: 규칙 엔진 우선. 후보가 2개 이상일 때만 LLM에 최종 선택 위임
- 금지: 후보가 1개일 때 LLM 호출 (비용·결정성)

## A5 · Render Agent
- 입력: 슬롯 좌표 + 문구 + 스타일 토큰 + 트림 이미지
- 출력: PNG (`04_output/...`) + 요소별 실측 rect
- 스펙: `01_spec/design-tokens.md`, `03_engine/templates/`
- 책임: 고정 뷰포트, 폰트 로딩 완료 후 캡처, 500KB 이하

## A6 · QA Agent
- 입력: 실측 rect + PNG
- 출력: 8항목 판정 + 실패 사유 + 반송 대상 단계
- 스펙: `01_spec/layout-rules.md` QA 게이트
- 책임: 통과분만 노출. 실패는 숨기고 재시도 지시

## A7 · KMS Agent
- 입력: 모든 단계의 성공·실패 로그
- 출력: `05_kms/{errors,fixes,success,snippets}/`
- 책임: 동일 문제 재발 시 과거 해결책을 우선 후보로 제시
