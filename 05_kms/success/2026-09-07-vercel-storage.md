# Vercel 전용 저장소 연결

- 요청: axlab 공용 GitHub 공개 저장소와 Vercel 프로젝트 생성, 새 저장소 연결.
- 저장소: `sk-masic`, `store_m8h6k0ZbJ1WJft6C`, icn1, private. 토큰은 Vercel이 Production/Preview에 자동 연결.
- 배너는 QA 통과 후 고유 경로로 저장하며 기존 이미지를 덮어쓰거나 삭제하지 않는다.
- 보관함은 항목별 JSON으로 저장하여 동시 추가 시 전체 목록 덮어쓰기를 피한다.
- HttpOnly 쿠키로 브라우저별 접근 분리. 계정 로그인/기기 간 동기화는 포함하지 않는다.
- 사전 검증: build 통과, 테스트 3건 통과, 실제 Blob 렌더 PNG 174531 bytes, 동시 추가 2건 보존, 즐겨찾기 재조회, 다른 방문자 PNG 404 및 빈 보관함.
- 기존 로컬 데이터는 업로드·삭제하지 않음.
