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
