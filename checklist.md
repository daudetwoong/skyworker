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
- [x] 국내선 DOM FLT PLAN & RLS SHEET 파서 (L시각→UTC·1줄 항법로그·좌표/바람 없음 안내) — 실PDF 2개 E2E
- [x] APMS 브리핑의 LIDO-NOTAM-BULLETIN 파서 — 실PDF 8개 전부 NOTAM 카드 채워짐(58~123건)

## Phase 2.6 — 친절모드 100% 패리티 (A안, 2026-10-31 형님 승인)

- [x] 지도: Leaflet 줌/팬 + 오프라인 해안선 기본 + 온라인 상세지도(OSM) 토글 + 노탐 구역(원·다각형) + 클릭 팝업 + 내 위치 따라가기
- [x] 노탐: 지연 ETD 조정(+15/+30/+60/직접) · 퀵턴(복편) · ★중요 표시(기억) · FMS 좌표 변환 · 유사 콜사인 경고 · 경로 3단계(교차/FIR내/무관)+통과시각 유효
- [x] 할 일 타임라인: 보고/요청/교신 문장 자동 추출 + 지점 매핑 + 직접 메모 + GPS 50NM 전 알림(배너·소리) + 지남/다음 강조
- [x] 가까운 공항: GPS(또는 수동 지점) 기준 목적지·교체·ERA 거리·방위·예상시간
- [x] 연료 고도화: holding 가능 분(F-RSV 유량 역산) · 현재 FOB 입력 → 예상 FOD(잔여 trip 연료)
- [x] 흔들림(난기류) 보고 텍스트 → 지도 마커
- [x] TAF ETD/ETA ±1h 하이라이트(TEMPO/BECMG 경고색)
- [x] 기체 위치(ADS-B, 기번) — 출발 전 "내 비행기 어디" (adsb.lol 무료)
- [x] 새 버전 안내 띠 · 카드별 도움말(처음 쓰는 사람용)
- [x] 리뷰 루프(code-reviewer 2차: 높음 2·중간 4·낮음 4 전부 수정) + 실PDF E2E + 배포
- [ ] 제외(사유 명시): MEL(R2 회사자료) · FIR 폴리곤(공개 라이선스 데이터 없음, 진입점 마커로 대체) · ETP(해당 기종 비행에 없음) · 주기장/ICN이력(키 재입력 필요)

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
- [x] 2026-10-31 실PDF 10개 일괄 E2E(v0.6): 국제선 8개 NOTAM 카드가 비어 있던 것·국내선 2개 업로드 무반응 발견 → 수정, code-reviewer 3차(HIGH 1·MEDIUM 2) 반영, 테스트 122개
- [x] 2026-10-31 code-reviewer 2차(v0.5): Leaflet attribution 누적·map.remove 누락(HIGH) + idx -1·문장단위 노이즈·i18n·반경우선·F-RSV 파싱 → 전부 수정, 테스트 106개
