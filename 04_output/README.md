# 04_output

`npm run poc` 실행 결과. 실제 엔진이 출력한 PNG 다.

```
single/{yyyymmdd}/     단품 — SGL-{모델코드}-{규격}-{스타일}.png
composite/{yyyymmdd}/  종합 — CMP-{제품수}P-{규격}-{스타일}.png
_samples/              위 둘을 한곳에 모은 열람용 복사본
qa-report.json         규격·스타일별 QA 8항목 판정 + 충돌 해소 로그
```

규격 코드: `0800` = 800×600 · `1080` = 1080×1080 · `1350` = 1080×1350 · `1920` = 1080×1920

## 이 PoC 의 한계

- **제품 사진은 자리표시자다.** 생성 환경에서 `static.skmagic.com` 이 차단돼 있다.
  실제 이미지는 `02_data/assets/trimmed/` 에 넣고 카탈로그의 `image` 필드에 경로를 주면 자동으로 들어간다.
- **로고 슬롯이 비어 있다.** 원본 파일 수령 후 교체한다 (TASKS A-01).
- **문구는 규칙 폴백으로 생성했다.** `OPENAI_API_KEY` 를 넣으면 Structured Outputs 경로로 전환된다.
