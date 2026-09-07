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

## 웹 배포

- GitHub: `axlab-cream/SK-MASIC`의 `main` 푸시로 Vercel `ax-lab-cream/sk-masic` 자동 배포.
- 전용 Vercel Blob `sk-masic`: 서울 리전, 비공개. Production/Preview에 저장소 토큰 자동 연결.
- Vercel에서는 서버리스 Chromium으로 생성 후 통과한 PNG만 Blob에 저장한다. 기존 상품 사진은 저장소에 재업로드하지 않는다.
- 보관함과 배너 접근은 HttpOnly 쿠키로 브라우저별 분리된다. 같은 브라우저에서 새로고침 후 유지되며, 쿠키 삭제·다른 기기에서는 공유되지 않는다.
- 로컬 `npm start`는 기존 파일 저장 방식을 유지한다. 기존 로컬 보관함은 자동 업로드하지 않는다.
- `npm run build`: 서버·브라우저 JavaScript 구문 검증. `npm test`: 저장·조회와 요청 검증 회귀 테스트.
- OpenAI 키와 공식 로고는 별도 준비 항목이며 현재 규칙 문구·기존 로고 자리표시자로 동작한다.

## 참고

- 디자인 캔버스(와이어프레임 + 디자인 시스템): claude.ai 아티팩트로 별도 관리
- 브랜드 근거: `SKmagic_product_UI_guide.html` (비공식 역설계 참고자료)
