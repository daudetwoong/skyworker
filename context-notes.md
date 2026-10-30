# FlightTool 컨텍스트 노트

작업 중 결정과 이유. 위가 최신.

## 2026-10-30 프로젝트 시작

- **왜 새 프로젝트인가**: notam 친절모드는 fly-smart-team/notammap(라이선스 없음) 기반이라 상업화 불가. 형님 결정 — 협업 안 하고 아이디어만 따서 우리 스타일로 처음부터 새로 만든다. ForeFlight 기능 벤치마크도 OK.
- **전략(형님 지시)**: 당장 수익화 금지. 전부 무료로 풀어 매일 쓰는 습관 먼저 → 유료 전환은 나중 검토. 사업자는 아내 명의 가능해서 신원 노출 문제는 해소됨. 최종 꿈은 항공사/Jeppesen이 사고 싶은 물건이지만 지금은 기능+재방문이 전부.
- **범용 OFP**: KE/OZ 기반으로 시작하되 어떤 회사 플랜이 와도 동작하는 파서 플러그인 구조로 설계할 것(Phase 2). i18n도 처음부터(한국어 기본, 영어 뼈대).
- **플랫폼**: 웹/PWA(회사 기기 MDM 때문에 앱 배제 — notam-growth-plan.html 참고). 빌드 스텝 없는 순수 정적 — 폰 클로드 세션이 GitHub에서 직접 수정하는 워크플로를 위해.
- **CORS 실측**: aviationweather.gov API는 Access-Control-Allow-Origin 헤더를 안 준다 → Cloudflare Worker 중계 필수. Worker는 skyworker-wx로 배포(ft-wx-proxy에서 개명, 2026-10-31). 이름 SkyWorker 확정 — skyworker.app·.kr 미등록 확인, 도메인 구매는 보류(무료 Pages 주소 사용).
- **AWC JSON 활용**: raw METAR 정규식 파싱 대신 API의 구조화 JSON(wdir/wspd/clouds/fltCat/fcsts)을 쓴다. 더 견고하고 코드가 짧다. 원문(rawOb/rawTAF)은 항상 같이 표시.
- **활주로 방위**: 공식 AIP 수치를 하드코딩하지 않고(틀릴 위험+유지보수) 활주로 번호×10을 자방위로 쓰고 자편차(var)로 진방위 변환. 참고용 고지 필수. 확신 없는 공항은 활주로 미등록으로 둔다.
- **이름**: 미정. 도메인 확인 결과 flitebrief(.com+.app 둘 다 미등록), skyofp(둘 다), briefwing/wingbrief/routebrief/fltbrief/wingkit/planbrief(.app만 미등록). 형님이 10개 후보에서 고르기로.

## ForeFlight 수익구조 리서치 요약 (2026-10-30)

- 개인 구독 3단계(연 $130/$260/$390)가 기본. 2019년 보잉에 인수됨. 추정 매출 $25M~$50M+.
- B2B: ForeFlight Dispatch(운항관리)·Business/기단 단위 계약, Military Flight Bag(군용).
- 부가: Sentry ADS-B 수신기(하드웨어), Jeppesen 차트 구독 연동(보잉 계열 시너지).
- 교훈: ①개인 구독으로 시작해 압도적 사용성으로 표준이 된 뒤 B2B·군으로 확장 ②하드웨어/차트 등 생태계 부가 수익 ③우리의 현 단계는 "압도적 사용성" 구간 — ForeFlight도 처음엔 기능으로 이겼다.

## 2026-10-31 홈 전환: 공항 허브 → "내 비행" (형님 지시)

- 홈은 공항 리스트가 아니라 **오늘 내 비행**이다. OFP 텍스트를 붙여넣으면 브리핑이 자동 구성된다. 공항 수동 조회는 보조 탭으로 강등.
- 리서치 근거: ForeFlight Altitude Advisor(고도별 시간·연료 재계산)가 유료 핵심 기능, skybook/AvioBook 등 업계 표준이 "비행 단위 브리핑 + 오프라인 우선". 우리 FL 트레이드가 정확히 그 자리.
- **실제 OZ OFP(APMS/Lido)로 포맷 해독 완료**: 헤더(편명/기체/레그/CI), STD·ETD·STA·ETA(+공항별 P0800식 UTC오프셋 — 시간 로컬표시에 그대로 사용), 연료표, DISP REMARK, ALTN SUMMARY, ICAO FPL 블록(EET 포함), 항법로그 2줄 페어(DST·FL·MC/TC·TAS·GS·ZT), **UPPER WIND/TEMP 매트릭스(웨이포인트×FL250~400 6개 레벨, ddsssMtt 형식)**.
- FL 트레이드 계산: 순항 구간(TOC~TOD)별 TC·DIST + 매트릭스 바람/온도 → 계획 FL TAS·온도로 마하 역산 → 각 FL TAS 재계산 → GS 합산 ETA. 연료는 수치 금지, 추세 화살표만(R2·R3).
- 범용 폴백: ICAO ATC FPL 블록 `(FPL-...)`은 전 세계 공통 → 어떤 항공사 OFP든 편명/출도착/교체/순항FL/경로 최소 파싱 보장.
- **회사 OFP 원문은 저장소에 커밋 금지(R2)** — 테스트 픽스처는 같은 구조의 가공 데이터로 작성, 실OFP 검증은 로컬에서만.
- 시간 표시: 전역 Z/L 토글(헤더). L=공항 로컬(비행 공항은 OFP 오프셋, 공항탭은 DB tz, 모르면 기기).
