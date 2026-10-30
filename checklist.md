# FlightTool 체크리스트

## Phase 1 — 공항 허브 (습관 훅)

- [x] 프로젝트 스캐폴드 (CLAUDE.md·체크리스트·컨텍스트 노트·git)
- [x] 기상 중계 Worker (`proxy/worker.js`) 작성
- [x] Worker 배포 (skyworker-wx)
- [x] PWA 뼈대: index.html + manifest + service worker (오프라인 셸 캐시)
- [x] i18n 구조 (ko 기본 + en 뼈대)
- [x] 공항 카드: METAR 한국어 풀이 + 비행 카테고리 색 표시
- [x] 공항 카드: TAF 구간별 한국어 풀이 (KST 시각)
- [x] 활주로별 정풍/측풍 계산 (자편차 반영, 참고용 고지)
- [x] 일출·일몰 (UTC+KST)
- [x] 공항 추가/삭제 (아무 ICAO나, localStorage)
- [x] 다크(기본)/라이트 테마 토글
- [x] 마지막 조회 데이터 오프라인 표시 (localStorage 스냅샷)
- [x] node 로직 테스트 (tests/run.js)
- [ ] 앱 아이콘 (PNG 192/512 — 손그림 무드, 이름 확정 후)
- [x] 이름 확정(SkyWorker) → 폴더·Worker 개명
- [x] GitHub 저장소 생성 + Pages 배포 (daudetwoong.github.io/skyworker) + CORS 확인
- [ ] 형님 실기기(아이패드/폰) 테스트

## Phase 2 — 비행 도구 (다음)

- [ ] OFP 붙여넣기 입구 + 회사별 파서 플러그인 구조 (KE/OZ 우선, 범용 확장 설계)
- [ ] FL 트레이드: OFP 바람 매트릭스 → 고도별 ETA 비교
- [ ] 활주로·접근 브리핑 (TAF → 예상 활주로)
- [ ] TOD/강하 계산기
- [ ] 홀딩 연료 시계

## Phase 3 — 개인화

- [ ] 카드 켜고끄기/순서 (localStorage)
- [ ] 공항별 메모
- [ ] 영어 번역 완성 (en 사전 채우기)
