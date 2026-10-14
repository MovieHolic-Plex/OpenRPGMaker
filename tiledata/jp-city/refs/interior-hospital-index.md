# 일본 도시 — 병원·학교 별관·IT 사옥 실내 장소 3곳 · 학교·사무실·병원 방 구성

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **15940칸**, 16px 칸, 시트 1536×2672px, 한 줄 **96칸** — 번호 n 의 칸은 열 n%96, 행 n÷96(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

**가져오기**: `import_region_reference({id:"<장소 id>"})` → 층이 여럿이면 계단·엘리베이터 이동으로 이미 이어져 있다. **거리 건물 문과 잇기**: `link_jp_city_interior({door:{x,y}, width, place:"<장소 id>"})` 한 번 — 1층에만 잇는다.

**새로 짓기(방 구성)**: `build_hand_interior_room({tileset:"jp_city", layout:{program:"<예제 맵 또는 건물 id>"}})` — 방 사각형은 도구가 짜고, 방마다 같은 종류 예제의 가구 한 벌을 옮겨 심는다.
| 요청 | program | 방 |
|---|---|---|
| 병원 1층(대기실·접수·진찰실·약국) | `hospital-1f` | 외래 대기실 → 진찰실·처치실·약국 |
| 병동(병실·간호사 대기소) | `hospital-2f` | 병동 복도 → 2인 병실·간호사 대기소 |
| 학교 교실 층 | `school-2f` | 교실 둘 + 복도 |
| 학교 1층(신발장 현관·교무실·보건실) | `school-1f` | 昇降口·복도·교무실·보건실·화장실 |
| 특별교실(음악·도서·이과) | `school-3f` | 음악실·도서실·이과실 + 복도 |
| 특별교실동(취주악부실·인쇄실) | `school-annex` | 현관 복도 → 취주악부실·인쇄실·계단 홀 |
| 사무층(자유석·회의실·급탕실·엘리베이터 홀) | `office-floor` | 사무실·회의실·급탕실·엘리베이터 홀 |
| 사무 빌딩 1층(로비·접수) | `office-1f` | 로비·엘리베이터 홀·계단 |
| IT 회사 자유석 층(부스·스탠딩 회의·라운지) | `office-free` | 자유석 사무 공간·회의실·급탕실·엘리베이터 홀 |
| IT 사옥 1층(경비·방문자 접수) | `office-tower-1f` | 사옥 로비 |
방 종류만 골라 짤 때는 `layout:{rooms:[{kind:"hosp-ward"},{kind:"hosp-corridor"}]}`. 이 묶음의 방 종류: `annexcorridor` 현관 복도, `annexstairs` 계단 홀, `bandroom` 취주악부실(부실), `elevatorhall` 엘리베이터 홀, `freeoffice` 자유석 사무 공간, `hosp-corridor` 병동 복도, `hosp-exam` 진찰실, `hosp-lobby` 외래 대기실·종합 접수, `hosp-nurse` 간호사 대기소, `hosp-pharmacy` 원내 약국, `hosp-stairs` 계단·엘리베이터 홀, `hosp-treat` 처치실, `hosp-ward` 병실, `meetingroom` 회의실, `pantry` 급탕실, `printroom` 인쇄실(교원 작업실), `towerlobby` 사옥 1층 로비.

| 장소 id | 이름 | 종류 | 맵(예제 문서) | 짜임 |
|---|---|---|---|---|
| `jp-city-school-annex-26x16` | 일본 학교 특별교실동 실내(취주악부실·인쇄실·현관 복도) | 학교 | `jp-interior-ex-school-annex` | 남쪽 2칸 현관 → 3줄 복도: 북쪽 벽면에 게시판·학급 표찰(문 곁)·소화전함, 북쪽 첫 줄에 트로피 유리장, 남쪽 벽 곁에 긴 의자·분리수거통·소화기·우산꽂이·청소 도구(가운데 2줄은 비워 둔다). |
| `jp-city-office-tower-1f-16x11` | 일본 IT 회사 사옥 실내(1층 로비 + 자유석 층) | 사무실 빌딩 | `jp-interior-ex-office-tower-1f` → `jp-interior-ex-office-free` | 1층 로비: 남쪽 유리 자동문(양옆 우산 비닐 받침) → 서쪽 경비 데스크·방문자 접수 태블릿, 북쪽 벽 계단·엘리베이터 둘·층 안내판, 동쪽 화분 상자·소파. |
| `jp-city-hospital-1f-30x19` | 일본 종합병원 실내(1층 외래 + 2층 병동) | 종합병원 | `jp-interior-ex-hospital-1f` → `jp-interior-ex-hospital-2f` | 1층(외래): 남쪽 유리 자동문(2칸, 우산 비닐 받침·손 소독) → 대기실: 서쪽 종합 접수(카운터 둘 + 안쪽 직원 줄 + 재진 접수기·자동 정산기), 가운데 북향 연결 의자 두 줄(가운데 2칸 통로) — 북쪽 벽 호출 화면·TV 를 본다, 동쪽 키즈 코너·냉온수기·잡지대. |

## 없는 것
의사·간호사·환자 NPC(Actor1 캐릭터를 이벤트로 놓는다), 진료·입원 이벤트, 수술실(폐병원 던전의 수술실은 용도 「현대 던전」). 화면·호출 번호판·안내판에 글자·숫자는 없다(색 덩이·점). 십자 표시도 없다.
