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
- [x] 앱 아이콘 (PNG 512/192/180 생성·연결)
- [x] 이름 확정(SkyWorker) → 폴더·Worker 개명
- [x] GitHub 저장소 생성 + Pages 배포 (daudetwoong.github.io/skyworker) + CORS 확인
- [ ] 형님 실기기(아이패드/폰) 테스트

## Phase 2 — 비행 도구

- [x] OFP 붙여넣기 + OZ(APMS) 파서 + ICAO FPL 범용 폴백 (실OFP 검증 ±1분)
- [x] **OFP PDF 업로드** (드래그&드롭, pdf.js 내장, 기기 안 처리) — 실 브리핑 PDF 54쪽 E2E 통과
- [x] CFP 포맷 파서 (실물 PDF 양식: 3줄 항법로그·FL행 매트릭스) + CFP FL트레이드 (±1분 검증)
- [x] FL 트레이드: 바람 매트릭스 → 고도별 Δ시간·예상 ETA (계획행 하이라이트)
- [x] 타임라인: ETD/TOC/FIR(EET)/TOD/ETA + 도착 주·야 판정
- [x] 연료 카드(TRIP~RAMP+중량+DISP REMARK) · 교체공항 요약
- [x] 시간 Z/L 전역 토글 (OFP 로컬 오프셋 활용)
- [ ] 활주로·접근 브리핑 (TAF → 예상 활주로) — 다음
- [ ] TOD/강하 계산기 · 홀딩 연료 시계 — 다음
- [ ] KE 전용 파서 (KE OFP 샘플 입수 후)

## Phase 2.5 — 친절모드 기능 흡수 (v0.4)

- [x] 오프라인 SVG 경로 지도 (해안선 내장·웨이포인트·TOC/TOD·FIR·SR·NOTAM·공항)
- [x] NOTAM 브리핑 (PDF 패키지 파싱·유효 판정·한국어 해설·경로 관련도)
- [x] SR 4 이상 구간 카드 + 타임라인 연동
- [x] 실시간 GPS 위치 (지도 표시·남은 거리·실시간 ETA·다음 SR)
- [x] FPL 풀이 (Item 7~19)
- [x] 연료: 실제 RAMP 입력 → TOW/LDW/FOD·여유 재계산
- [x] 요약 복사·인쇄
- [ ] 흔들림(난기류) 보고 텍스트 → 지도 (친절모드 기능, 후순위)
- [ ] 가까운 공항 목록 (GPS 기준 ERA 거리)
- [ ] MEL 바로 보기 — R2(회사 자료) 때문에 공개판 제외, 개인 로컬 모드 검토

## Phase 3 — 개인화

- [x] 카드 켜고끄기 + 접기 상태 기억 (localStorage)
- [ ] 공항별 메모
- [ ] 영어 번역 완성 (en 사전 채우기)

## 리뷰 이력

- [x] 2026-10-31 code-reviewer 1차: HIGH 3(FPL 중첩괄호·마하레벨·i18n '분')+MEDIUM 4+LOW 5 → 전부 수정, 회귀테스트 7개 추가
- [x] 2026-10-31 헤드리스 E2E: 붙여넣기→브리핑 7카드·Z/L토글·공항탭, 콘솔에러 0
