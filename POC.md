# PoC 실행 가이드

## 준비

```bash
npm install
npx playwright install chromium      # 또는 기존 Chromium 경로를 .env 에 지정
cp .env.example .env
```

`.env` 에서 최소 한 가지만 확인하면 된다.

- `OPENAI_API_KEY` — **없어도 돌아간다.** 없으면 규칙 기반 폴백으로 문구를 만든다.
- `PLAYWRIGHT_CHROMIUM_PATH` — 이미 설치된 Chromium 을 쓰고 싶을 때만 지정한다.

## 실행

```bash
npm run poc          # 3종 종합 · 4규격 × 6스타일
npm run poc:single   # 단품 1종 · 3규격
npm run poc:list     # 6종 · 카드 리스트
```

직접 조합하려면:

```bash
node 03_engine/cli.mjs \
  --products G000069846,G000069931,G000069282 \
  --sizes C1350,W0800 \
  --styles neutral-white,benefit-yellow \
  --target "이사 예정" --tone "혜택 강조" --season "9월 이사철" \
  --consultant "김○○ MC" --phone "010-0000-0000" \
  --html --debug --allow-stale
```

| 옵션 | 설명 |
|---|---|
| `--products` | goodsId 또는 모델코드 (쉼표 구분) |
| `--sizes` | `W0800` `S1080` `C1350` `L1920` |
| `--styles` | `neutral-white` `benefit-yellow` `price-focus` `premium-black` `ice-campaign` `card-list` |
| `--html` | 렌더에 쓴 HTML 을 PNG 옆에 남긴다 (디버깅용) |
| `--debug` | 세이프존을 점선으로 표시 |
| `--allow-stale` | 카탈로그 7일 초과 차단을 우회 (검증 목적 전용) |

## 상품DB 패턴 수확

```bash
npm run crawl        # 03_engine/crawler/patterns.config.json 기준
```

DOM 셀렉터가 아니라 **URL·ID 패턴**으로 수확한다.

```
goodsId    G\d{9}
목록       /goods/indexGoodsList?dispClsfNo={code}[&goodsFilterList={n}]
상세       /goods/indexGoodsDetail?goodsId={goodsId}
이미지     https://static.skmagic.com/image/goods/{goodsId}/{goodsId}_{n}.{png|jpg}
이벤트     /event/indexEventDetail?eventNo={n}
```

목록 페이지를 열어 `G\d{9}` 를 전부 긁어 goodsId 집합을 만들고, 각 상세에서 필드 정규식으로 값을 뽑고,
이미지는 CDN URL 을 조립해 HEAD 로 존재만 확인한다. 마크업이 바뀌어도 패턴이 유지되면 계속 동작한다.

**주의** — 가격은 `priceCandidates` 배열로만 싣는다. 추정·보정하지 않는다.
확정은 정규화 단계에서 사람이 확인하거나 엑셀 오버라이드로 덮는다.

## 결과 확인

```
04_output/_samples/                     생성된 PNG 전부
04_output/{single|composite}/*/qa-report.json   QA 판정 + 충돌 해소 로그
```

QA 8항목 중 하나라도 실패하면 그 시안은 **MC 화면에 노출되지 않는다.**
콘솔에 실패 항목과 반송 대상 단계(`copy` / `compose`)가 출력된다.
