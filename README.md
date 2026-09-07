# SK MASIC

SK매직 상품 카카오톡 배너 자동생성기. 오프라인 MC용.

- LLM으로 작업할 때는 **`CLAUDE.md`부터 읽는다.**
- 사람이 처음 볼 때는 `00_projectops/GOAL.md` → `ROADMAP.md` 순서를 권한다.

## 폴더 구조

```
00_projectops/   GOAL · TASKS · WORKFLOW · ROADMAP · DECISIONS
01_spec/         디자인 토큰 · 배너 스타일 · 레이아웃 규칙 · 카피 규칙 · 스키마 · 프롬프트 계약
02_data/         raw(크롤링 원본) · catalog(정규화) · assets(원본/트림 이미지)
03_engine/       crawler · catalog · llm · layout · render · templates · qa
04_output/       single(단품) · composite(종합) — 날짜별 산출물
05_kms/          errors · fixes · theory · snippets · success (AIOS KMS)
99_scratch/      임시 파일
```

## 시작하기

```bash
cp .env.example .env      # OPENAI_API_KEY 입력
npm install
npx playwright install chromium
npm run crawl             # 02_data/raw 채우기
npm run catalog           # 02_data/catalog/products.json 생성
npm run dev               # MC UI
```

## 참고

- 디자인 캔버스(와이어프레임 + 디자인 시스템): claude.ai 아티팩트로 별도 관리
- 브랜드 근거: `SKmagic_product_UI_guide.html` (비공식 역설계 참고자료)
