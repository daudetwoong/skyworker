# SkyWorker 인계 문서 (2026-10-31)

이 문서는 SkyWorker 개발을 다른 세션(Claude 앱·폰 등)에서 그대로 이어받기 위한 것이다. **먼저 이 문서를 끝까지 읽고, 그다음 CLAUDE.md → checklist.md → context-notes.md 순서로 읽은 뒤 작업을 시작한다.**

- 라이브: https://daudetwoong.github.io/skyworker/ (GitHub Pages, 저장소 push = 즉시 배포)
- 저장소: https://github.com/daudetwoong/skyworker (공개)
- 기상 중계 Worker: https://skyworker-wx.daudet0127.workers.dev (Cloudflare, 계정 daudet0127@gmail.com, 코드 proxy/worker.js)
- 전신: NOTAM 친절모드 https://daudetwoong.github.io/notam/ (저장소 daudetwoong/notam) — **그대로 유지, 건드리지 않는다**

---

## 1. 형님(권구웅, 아시아나 A321 부기장)이 직접 정한 의도 — 원문 보존

이 프로젝트의 방향은 전부 아래 말에서 나왔다. 해석하지 말고 그대로 따른다.

### 1-1. 시작 의도 (2026-10-30)

> 친절모드 있는 거 있잖아. 웹페이지로 인터넷 없어도 사용 가능하게. 수익화? 항공사들이 쓰고 싶어하게 만들어 볼까 고민되거든.
> 실제 운항 중에 기계획된 바람에 따라 시간이 얼마나 걸릴지 — 그래서 항로에서 내가 고도를 280 300 320 340 이런 식으로 어떤 고도를 선택하냐에 따라서 ETA가 얼마나 나올지 확인해 볼 수 있는 방식이라든가,
> 비행계획을 넣었을 때 런웨이랑 비행 관련 정보가 조금 더 정확하고 꼭 필요한 정보들을 넣어 준다든지,
> 만약에 필요하면 사람들이 자기에 맞게 구성해서 바꿔서 쓸 수 있다든지.
> 내가 말한 것들이 꼭 구현된다기보다는 예를 든 거니까, 추가적으로 운항에 도움이 될 만한 거 있으면 넣어서.
> 웹페이지로 가는 게 좋을지 앱(아이패드 전용)으로 만드는 게 좋을지 — 앱은 회사에서 못 깔게 해놔서 제한이 되는 부분도 꽤 있을 거야.
> aticview(ATISVIEW) 같은 홈페이지처럼 뭔가 필요한 게 있어서 사람들이 자주 들어오게 하는 방법.

→ 결정: **웹/PWA**(회사 기기 MDM이 앱 설치를 막음). 오프라인 동작 필수(기내).

### 1-2. 사업·개발 전략 (2026-10-30, 10-31 두 번 강조 — "아까 내가 이렇게 말한 것도 기억해라")

> 당장은 수익화는 하지 말고, ForeFlight가 어떻게 수익을 내고 있는지 먼저 알아봐.
> 처음에는 무료로 다 풀어서 사람들이 매일 사용하게 만들고 나중에 유료 전환 검토하는 게 더 좋을 것 같고, 사업자는 아내 이름으로 해도 되니까 문제가 없을 것 같아, 그때 가서.
> fly-smart-team이랑 같이 할 생각은 없고, 거기 있는 내용들 우리가 따와서 우리 스타일로 새로 만들 거야. ForeFlight 거에서 따와도 되고.
> 꼭 조종사들한테 필요한 뭔가를 만들어서 항공사나 젭슨 같은 회사들이 사고 싶게 만드는 게 최종 목표가 되면 좋겠지만, 지금은 그 생각보단 기능과 자주 사용할 수 있게 하는 게 중요할 것 같아.
> 지금은 대한항공·아시아나 비행계획을 기반으로 만들고 있긴 한데 꼭 두 회사 말고 다른 회사 어떤 플랜이 와도 필요한 정보를 줄 수 있으면 더 좋을 것 같고, 더 나아가면 외국어 버전으로 만들어서 다른 나라에서도 소문나게 하는 게 좋은 방향인 것 같아.
> flightool 같은 어떤 특정 이름으로 만들어 보는 게 좋을 것 같아.

→ 이름은 **SkyWorker**로 확정(하늘에서 일하는 사람=조종사, 하늘 일을 돕는 일꾼=앱). 도메인(skyworker.app/.kr 미등록 확인)은 구매 보류, 무료 Pages 주소 사용.
→ ForeFlight 리서치 결과: 개인 구독($130/$260/$390·년)으로 표준이 된 뒤 B2B(Dispatch)·군·하드웨어(Sentry)·Jeppesen 차트로 확장, 2019 보잉 인수. 교훈 = 지금은 "압도적 사용성"으로 매일 쓰게 만드는 구간.

### 1-3. 품질 기준 (2026-10-31 두 차례 질책 — 반드시 기억)

> 노탐 친절모드보다는 적어도 나아야 하지 않아? 기본적으로 친절모드에 있는 기능들은 다 들어가거나 향상된 뭔가가 보여야 하지 않겠어? 지금 만든 게 무슨 쓸모니? 누가 이걸 보고 매번 사용하고 싶을 거 같아? 조종사한테 뭐가 필요한지 체크한 거 맞아?
> 비행계획은 친절모드처럼 파일을 내가 주면 작동하는 방식이지, 글자 붙여넣기로는 비행계획을 이해할 수 없지 않아?
> 이게 최선이야? 이럴 거면 친절모드에서 기능 향상으로 내가 방향을 잡는 게 더 낫겠다고 생각이 들 정도인데?

→ 친절모드와 정직 비교 후 두 길 제시: **A안 = 친절모드 100% 패리티 + 우위까지 완성(라이선스 깨끗한 기반)** / B안 = 친절모드에 역이식(상업화 포기). **형님이 A안 선택, "완성본까지 만들어".** 기능을 뺀 채 "완성"이라 하지 않는다. 입력은 **PDF 파일 드롭**이 1차다.

---

## 2. 현재 상태 — v0.11 (2026-11-01)

**v0.11 추가**: 양식 범용화 — 전용 파서가 없는 항공사 OFP도 FPL 경로+본문 좌표로 추정 경로(지도·SIGMET 동작), 범용 연료표·단위(kg/lb), FPL DOF+EOBT 시각, 요약 카드 '양식 인식 결과'와 내용 없는 '진단 정보 복사'(src/generic.js). **타사 실물 샘플 없음 — 받으면 진단 복사본부터 받아 지원 추가.**

### v0.10 (경로 SIGMET)

**v0.10 추가**: 경로 SIGMET 지도 — 국제 SIGMET·PIREP을 Worker(/wx/isigmet, /wx/pirep)로 10° 격자 칸으로 받아(장거리·날짜변경선 OK) 경로 교차·통과 시각·고도로 🔴/🟠/🟡 분류, 새 카드·지도 점선 구역·타임라인, 기내용 스냅샷(SIGMET·PIREP 따로, 실패는 '못 받음')(src/sigmet.js). 지도 최대 확대 버그도 수정. Worker(skyworker-wx v0.3)와 사이트 모두 라이브. **Worker 배포(`cd proxy && npx wrangler deploy`)는 운영 배포라 형님 승인 후에만**, 순서는 Worker 먼저 → 사이트 push.

**v0.9 추가**: 저장 소실 방어 — 영구 저장 요청, 홈 화면 설치 안내, 하단 '기기 저장 상태' 패널(오프라인 실행 준비 포함), 저장 막힌 환경에서도 세션 동안 동작(src/storage.js, app.js store). **비행 전날 이 패널이 ✓인지 확인하라고 안내**.

**v0.8 추가**: OFP 자체 검산(src/verify.js) — OFP 안에 두 번 나오는 값(연료 합·중량·EET·항법로그 끝·노탐 개수 등 11종)을 대조해 카드마다 ✓/⚠ 표시. 이 검산으로 APMS 항법로그 TOD 끊김·`CONT/공항` 미인식을 찾아 고침. **새 양식/새 PDF를 받으면 먼저 검산 ⚠부터 볼 것.**

**v0.7 추가**: 공항 기상 카드를 공항당 3~4줄 요약+접힌 '자세히'로(높이 약 1/5), FPL 풀이를 원문 주석 방식으로(코드 누르면 바로 아래 풀이). 형님 피드백 반영.

**v0.6 추가**: 국내선 `DOM FLT PLAN` PDF 지원(시각 L→UTC, 지도·SR·FL트레이드는 자료가 없어 숨김) · APMS 브리핑의 `LIDO-NOTAM-BULLETIN` 노탐 파싱(v0.5까지는 국제선 APMS PDF의 NOTAM 카드가 비어 있었음). 실PDF 10개(국제선 8·국내선 2) 헤드리스 E2E 콘솔 에러 0, 테스트 122개.

### v0.5 (A안 패리티)

브리핑 PDF(54쪽, 회사 CFP 양식) 하나를 끌어다 놓으면 아래 13개 카드가 자동 구성된다. 전부 기기 안에서 처리(서버 전송 없음).

| 카드 | 내용 |
|---|---|
| 비행 요약 | 편명·구간 히어로·ETD/ETA(Z/L 토글)·계획 FL·거리·평균 바람·플랜 유효시한·디스패처·유사 콜사인 경고 |
| 🗺️ 경로 지도 | Leaflet 줌/팬, 오프라인 기본(내장 해안선 Natural Earth 110m)+온라인 OSM 타일 토글, 웨이포인트 팝업(FL·T+·SR·바람), TOC/TOD, FIR 진입점(주황), SR≥4 구간(보라 굵은 선), 유효·경로관련 NOTAM 구역(원/다각형/점), 흔들림 마커, 공항, 📍 GPS 내 위치(따라가기)·궤적, ✈️ 내 비행기 어디(ADS-B adsb.lol), 🌀 흔들림 보고 텍스트→지도 |
| ✅ 비행 중 할 일 | OFP 공지·노탐 코멘트에서 보고/요청/교신 문장 자동 추출→지점 매핑, FIR 진입·SR·TOC/TOD·🔴 경로 교차 유효 노탐, 직접 메모, GPS 50NM 전 배너+알림음, 지남 흐리게/다음 강조, 수동 "지난 지점" 선택 |
| 📋 NOTAM 브리핑 | PDF 안 패키지 파싱(출발/도착/교체/ERA/FIR, 164건급), 운항시간 유효 배지(출발=ETD, 도착·교체=ETA), 지연 +15/+30/+60/직접, 퀵턴 복편 시각, ★ 중요(기억), 한줄 요약·한국어 직역·약어 풀이, FMS 좌표(MCDU 형식) 복사, FIR 🔴교차+통과시각 유효/🟠교차/🟡근접/좌표없음, 회사 코멘트 |
| 공항 기상 | 출발·도착·교체 METAR 한국어 풀이+비행 카테고리 배지, 활주로별 정풍/측풍(자편차), TAF 구간 풀이 + ETD/ETA ±1h 하이라이트(TEMPO/BECMG 주황), 일출·일몰 |
| 🛬 가까운 공항 | GPS/수동 지점 기준 목적지·교체·ERA 거리·방위·예상시간 |
| 🌪️ SR 4 이상 구간 | 이륙 후 몇 분부터 몇 분간·최대 SR·고도·예상 시각 |
| 고도 선택(FL 트레이드) | OFP 바람 매트릭스로 고도별 Δ시간·예상 ETA·평균 성분·온도 (실OFP 대조 ±1분, ForeFlight Altitude Advisor 대응) |
| 타임라인 | ETD→TOC→FIR(EET)→SR→TOD→ETA, 도착 시 주/야 |
| 연료 | TRIP~RAMP·FOD·중량, 실제 RAMP 입력→TOW/LDW/FOD·여유, 홀딩 가능 분(F-RSV 유량 역산), 현재 FOB→잔여 trip 연료로 예상 FOD |
| 📖 FPL 풀이 | RVSM/PBN/CPDLC/ADS 능력 요약 + Item 7~19 한국어 |
| 교체공항 · OFP 원문 | ALTN 요약표 · 원문 전체 |
| 공통 | 📋 요약 복사·🖨️ 인쇄, 카드 켜고끄기·접기 기억, 다크/라이트, 한/영 토글(영어는 뼈대), 새 버전 안내 띠, 카드별 "이 칸은 뭐예요?", 오프라인 스냅샷, 보조 탭 "공항"(임의 ICAO 조회) |

**검증 상태(v0.5 시점)**: 로직 테스트 106개(`node tests/run.js`), 코드 리뷰어 2차까지 반영, 실PDF 헤드리스 E2E(콘솔 에러 0), 프로덕션 동일 확인.

**제외(사유 명시)**: MEL 바로 보기 — 회사 MEL 자료 재배포라 공개판 금지(R2) / FIR 경계 폴리곤 — 쓸 수 있는 공개 라이선스 데이터 없음(진입점 마커로 대체) / ETP — 해당 기종 비행에 없음 / 주기장·인천 운항이력 — data.go.kr 키(ICN_KEY)를 skyworker-wx Worker 비밀값으로 다시 넣어야 함(키는 형님만 가짐).

---

## 3. 코드 구조 (빌드 없음, 순수 정적 ES 모듈)

```
index.html            셸(헤더 Z/L·새로고침·테마·언어, 탭 내비행/공항)
sw.js                 서비스워커 — CACHE_VERSION 'skyworker-v0.11.0' (화면 바뀌면 반드시 bump)
manifest.webmanifest  PWA
src/app.js            메인(카드 렌더·상태·GPS·할 일·연료·지도 호출) — 가장 큼
src/ofp.js            OFP 파서: 국내선 DOM → CFP(FLIGHT RELEASE) → APMS(OFP 4:…) → ICAO FPL 폴백. 항법로그(좌표·SR·FIR·누적연료)·바람 매트릭스·연료·시각(로컬 오프셋)
src/fltrade.js        FL 트레이드(APMS: 마하 역산+성분 계산 / CFP: 매트릭스의 성분 직접 합산)
src/generic.js        범용 OFP 해석(좌표 표기 5종·FPL 경로 지점·연료 라벨·단위·진단 줄 모양)
src/sigmet.js         경로 SIGMET·PIREP 분류(경로 샘플·다각형 판정·진입 이분법) + Worker 호출
src/storage.js        기기 저장 지키기(영구 저장 요청·설치 여부·오프라인 캐시 점검) — 핵심 파일 목록(CRITICAL)은 sw.js SHELL과 맞출 것
src/verify.js         OFP 자체 검산(카드별 ✓/⚠) — 새 파서 만들면 여기 검산도 추가
src/notam.js          NOTAM 파서(CFP NOTAM PACKAGE + APMS LIDO-NOTAM-BULLETIN)·유효 판정·한국어 해설·좌표/구역·경로 관련도·유사 콜사인·FMS 좌표
src/fpl.js            ICAO FPL 풀이
src/map.js            Leaflet 지도(해안선 vendor/coastline.json, OSM 토글, 레이어, destroyMap/resetMapView)
src/pdfread.js        pdf.js로 PDF→텍스트 (글자 좌표로 고정폭 줄 재구성 — 매트릭스 이름줄의 선행공백이 이것에 의존)
src/wx.js             METAR/TAF 한국어 풀이, fetchWx(타임아웃)
src/wind.js sun.js time.js airports.js i18n.js
vendor/               pdf.js 4.10.38, leaflet 1.9.4, coastline.json (전부 오프라인 캐시)
proxy/worker.js       기상 중계(aviationweather.gov는 CORS 없음 → 필수) — /wx/metar·taf·isigmet?cells=·pirep?cells=, wrangler.toml
tests/run.js          순수 로직 테스트, tests/fixtures/ 가공 OFP(APMS·CFP+NOTAM)
CLAUDE.md             운영 규칙 R1~R7 + 상위호환 원칙 (반드시 읽기)
checklist.md          패리티 체크리스트(완료/남은 것)
context-notes.md      결정·함정 기록(시간순)
```

데이터 흐름: 파일 드롭 → `pdfread.extractPdfText` → `parseOFP` → `buildModel`(FL트레이드·주요 레그·SR 구간·NOTAM 파싱+관련도·FPL) → 카드 렌더. OFP 텍스트는 localStorage `sw_ofp_text`에만 저장.

---

## 4. 불변 규칙 (CLAUDE.md 요약 — 위반 금지)

- R1 fly-smart-team/notammap **코드 복사 금지**(라이선스 없음). 아이디어·기능 따오기는 OK. daudetwoong/notam의 `src/` 자작 레이어(kind/fpl/addon/pro/turb)는 우리 코드라 이식 가능.
- R2 **회사 내부 자료 금지** — FOM/FCOM 수치·MEL·제한치 하드코딩 금지, **실제 OFP/브리핑 PDF와 그 추출 텍스트를 저장소에 커밋 금지**(테스트는 가공 픽스처만).
- R3 모든 운항 수치에 참고용 고지. R4 데이터는 기기 안(localStorage)만, 외부 전송 금지(기상 중계엔 ICAO 코드만, ADS-B엔 기번만).
- R5 UI 문자열은 `src/i18n.js` 사전으로만(하드코딩 금지). R6 유료 API 금지. R7 활주로 방위·자편차 추측 금지(모르면 사용자 입력).
- **상위호환 원칙**: 친절모드 기능은 전부 있어야 하고 그 위에 더한다. 기능을 뺀 채 "완성"이라 말하지 않는다.
- **E2E는 실제 브리핑 PDF 업로드로**: pypdf 텍스트로 통과해도 pdf.js 추출본(공백 폭·`NOTAM    PACKAGE`식 띄어쓰기)에서 깨질 수 있다. 정규식은 `\s+`로.
- 작업 방식(형님 지시): 각 단계 **구현 → 별도 검토(비판) → 수정 → 다음**. 완료 선언 전 테스트 실행, SW 버전 bump, checklist/context-notes 갱신, 의미 단위 커밋.

---

## 5. 꼭 알아야 할 함정 (이미 겪은 것)

- 같은 아시아나라도 OFP 양식이 3종(국내선 `DOM FLT PLAN & RLS SHEET` 추가 — 1장·1줄 항법로그·좌표 없음·시각 L표기). 노탐도 2종: CFP=`NOTAM PACKAGE`, APMS=`LIDO-NOTAM-BULLETIN`. 국제선 기존 2종: APMS(`OFP 4:0026Z`, 2줄 항법로그, 매트릭스 ddsssMtt) / **CFP(`FLIGHT RELEASE`, 3줄 항법로그, FL행 매트릭스에 성분·온도 미리 계산)**. 실물 브리핑 PDF는 CFP. 둘 다 지원 유지.
- FL 트레이드는 "바람·온도만 반영한 시간 비교". 연료는 수치 금지(추세만). 실OFP 대조: APMS 53/52분, CFP 141/140분.
- Leaflet: 레이어 추가 전 `setView` 필수, 지도는 DOM에 붙은 뒤 초기화, `render()`마다 `destroyMap`으로 리스너 해제, 타일 토글 시 attribution 컨트롤 제거.
- AWC(aviationweather.gov)는 ID 많으면 TAF 504 → METAR(≤20)/TAF(≤8) 분리 + 요청별 12초 타임아웃 + `Promise.allSettled`. Worker도 9초 상류 타임아웃.
- 할 일 문장 추출은 ERA 공항 제외 + 전화/메일/CONTACT POINT 노이즈 필터, **문장 단위**로.
- 홀딩 가능 분은 F-RSV(최종예비 30분 연료)로 유량 역산 — 회사 성능표 없이 OFP 수치만.
- NOTAM 유효 판정: 출발=ETD, 도착·교체=ETA, FIR/ERA=비행창, FIR 통과시각=지연 반영 ETD+경로점 누적시간 ±30분.
- 유사 콜사인은 회사 공지 블록(`[ SIMILAR CALL SIGNS]`)에서 내 편명과 1자리 차이·자리바꿈만 경고.
- **실PDF는 ~/Downloads/flight-briefing-pdfs/ 10개 전부로 E2E 할 것**(v0.5는 1개로만 해서 APMS 노탐·국내선 전체가 안 되는 걸 놓쳤다). 국내선 PDF는 글자 단위 텍스트라 pdfread의 붙이기 규칙에 의존.
- 과거 실패: v0.2는 친절모드 기능 없이 FL트레이드만 만들어 "쓸모없다" 판정 — 원인은 기존 기능 목록을 체크리스트로 안 박고 시작한 것.

---

## 6. 남은 백로그 (우선순위 순)

1. **실비행 피드백 반영** — 형님이 다음 비행 OFP로 써보고 어긋나는 것(파싱 누락·시각·FL 수치·노탐 분류)부터 수정. 가장 중요. (v0.6에서 보관 PDF 10개는 자체 점검 완료)
2. ForeFlight 비교에서 나온 개선 제안: ~~파싱 신뢰도 표시~~(v0.8 완료) · ~~저장 소실 방어~~(v0.9 완료) · ~~경로 SIGMET/PIREP 지도~~(v0.10 완료) · ~~양식 범용화~~(v0.11, 실물 검증 대기) · 영어. 근거는 SecondBrain `03 위키/decisions/SkyWorker vs ForeFlight 포지셔닝 2026-10.md`.
3. 디자인 다듬기 — 친절모드 대비 "구리다"는 느낌을 없애기(형님 취향: 손그림·따뜻한 무드 아이콘, 콕핏용 야간 기본은 유지).
3. 주기장·인천 운항이력(ICN_KEY를 Worker 비밀값으로 받으면 proxy에 data.go.kr 경로 추가 — 코드는 우리 것으로 새로 작성).
4. KE(대한항공)·LCC 전용 파서 — 샘플 PDF 필요. v0.11 범용 해석으로 FPL 경로·좌표·연료표는 읽힘(가공 샘플로만 검증). 실물을 받으면 앱의 '진단 정보 복사'부터.
5. 영어 사전 완성(i18n en) → 글로벌 소문 전략의 전제.
6. 흔들림 보고 파서 고도화(PIREP 형식), 가까운 공항에 활주로 길이·운영시간.
7. FIR 폴리곤(공개 라이선스 데이터 찾으면), ETP(장거리 기종 쓰는 사용자 생기면), MEL은 개인 로컬 모드로만.
8. 도메인(skyworker.app·.kr) — 소문 나기 시작하면 구매. 수익화·계정·결제는 **지시 전까지 금지**.

---

## 7. 작업 환경 메모

- 맥 세션: `~/skyworker/`, 로컬 서버 `python3 -m http.server 8787`, 테스트 `node tests/run.js`, 배포 = `git push`(Pages 자동, 반영 1~2분, sw.js 버전으로 확인). Worker 배포 `cd proxy && npx wrangler deploy`(wrangler login 필요, OAuth 만료 잦음).
- Claude 앱/폰 세션: GitHub 저장소를 직접 수정하는 방식(notam 프로젝트와 동일). node·브라우저 테스트를 못 돌리면 **형님이 실PDF를 올려 확인**하는 것으로 대체하고, 그 사실을 커밋 메시지에 적는다.
- 실OFP 샘플은 맥 로컬에만(세컨드브레인/다운로드). 폰 세션은 형님이 PDF를 직접 올려준다. 어디에도 커밋하지 않는다.

## 8. 새 세션 시작 프롬프트 (복사용)

> daudetwoong/skyworker 저장소의 HANDOFF.md를 끝까지 읽고, CLAUDE.md·checklist.md·context-notes.md를 읽은 뒤 작업을 시작해. 형님 의도(HANDOFF 1절)와 규칙(4절)은 그대로 지키고, 친절모드 기능은 하나도 빼지 않는다. 작업은 단계마다 구현→검토→수정으로 진행하고, 끝나면 checklist/context-notes 갱신 후 커밋해.
