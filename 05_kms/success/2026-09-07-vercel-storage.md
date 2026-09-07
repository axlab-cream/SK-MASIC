# Vercel 전용 저장소 연결

- 요청: axlab 공용 GitHub 공개 저장소와 Vercel 프로젝트 생성, 새 저장소 연결.
- 저장소: `sk-masic`, `store_m8h6k0ZbJ1WJft6C`, icn1, private. 토큰은 Vercel이 Production/Preview에 자동 연결.
- 배너는 QA 통과 후 고유 경로로 저장하며 기존 이미지를 덮어쓰거나 삭제하지 않는다.
- 보관함은 항목별 JSON으로 저장하여 동시 추가 시 전체 목록 덮어쓰기를 피한다.
- HttpOnly 쿠키로 브라우저별 접근 분리. 계정 로그인/기기 간 동기화는 포함하지 않는다.
- 사전 검증: build 통과, 테스트 3건 통과, 실제 Blob 렌더 PNG 174531 bytes, 동시 추가 2건 보존, 즐겨찾기 재조회, 다른 방문자 PNG 404 및 빈 보관함.
- 기존 로컬 데이터는 업로드·삭제하지 않음.

## Production 검증

- https://sk-masic.vercel.app — Git 자동 배포 Ready.
- 첫 배포의 빈 public 디렉터리 오류: 기존 UI HTML을 빌드 출력으로 복사하여 해결.
- 연속 스타일 생성 오류: 서버리스 Chromium에서 페이지별 컨텍스트 종료를 피하고 렌더 컨텍스트를 유지하도록 수정.
- 실제 Production API: 카탈로그 92종, 문구 3안, 스타일 5종 QA 통과/1종 정상 제외, 규격 4종 QA 통과.
- PNG 171915 bytes, 동시 보관함 저장 2건 모두 보존, 즐겨찾기 재조회 유지, 다른 방문자 조회 차단.
- 수정 코드 배포 `e2e9d05` 검증 시 오류 로그 0건. 데스크톱·모바일 화면 확인.
- 남은 기존 준비 사항: 공식 로고, OpenAI 키. 현재 규칙 문구로 동작. 별도 TypeScript/Lint 설정은 없으며 build에서 전체 서버·브라우저 JS 구문을 검사한다.

## 변경 파일

- `.gitignore`
- `package.json`, `package-lock.json`
- `vercel.json`, `api/index.mjs`
- `03_engine/build.mjs`, `03_engine/server.mjs`, `03_engine/storage.mjs`, `03_engine/storage.test.mjs`
- `03_engine/render/shoot.mjs`
- `README.md`, `00_projectops/TASKS.md`, `00_projectops/DECISIONS.md`
- `05_kms/success/2026-09-07-vercel-storage.md`
