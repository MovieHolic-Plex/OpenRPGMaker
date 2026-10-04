# 조선 설화 장비 — 전체 36종

GPT 6.1 sol high가 이 폴더의 `draw.py`에서 정수 좌표로 새로 그린 32×32 RGBA 아이콘이다. 기존 게임·번들 그림에 이름만 바꾼 재사용은 없다. 그림 생성 API와 제삼자 사진 픽셀을 사용하지 않았다. 출처와 재현 코드를 이 폴더에 함께 보존한다.

## 현재 범위

| 직업 | 유지한 초급 무기 / 가격 | 유지한 초급 의복 / 가격 | 무기 능력 | 의복 능력 |
| --- | --- | --- | --- | --- |
| 전사 | 수련 환도 / 80 | 솜누비 철릭 / 70 | 공격 +8 | 방어 +6 |
| 도적 | 호신 단검 / 70 | 먹빛 저고리 / 60 | 공격 +5, 민첩 +3, 치명타 +2%p | 방어 +3, 민첩 +3 |
| 주술사 | 수습 칠성방울 / 90 | 홍색 무복 / 65 | 공격 +2, 정신 +7 | 방어 +2, 정신 +3 |
| 도사 | 백지 접부채 / 75 | 삼베 도포 / 65 | 공격 +2, 정신 +6 | 방어 +3, 정신 +2 |

위 초급 8개는 이전 커밋의 데이터와 원본 PNG 해시를 그대로 유지했다. 전체는 **무기16 + 의복16 + 머리2 + 장신구2 = 36종**, 직업별 전용 무기·의복은 각각 4급이다. 레벨 권장 단계는 **1/5/10/15**, 실제 엔진 슬롯은 무기 `weapon`, 의복 `armor`, 머리 `helmet`, 장신구 `accessory`다.

모든 장비의 일반 공격 명중 보정은 100%, 저주·양손·특수 플래그는 없다. 정신력 수치만 제공하며 회복량 증가율·기력 절약·귀신 특효·자동 정화 효과를 주장하지 않는다. 방울과 부채도 일반 공격은 예약 물리 속성이다. 도적 단검만 치명타 보정 +2/+3/+4/+5%p다.

계약 ID는 `equip_jf_<warrior|rogue|shaman|taoist>_<weapon|body>_<1|2|3|4>`다. 고정 ids.json에 공유 장비의 개별 ID 예약은 없어 `equip_jf_shared_head_1/_2`, `equip_jf_shared_accessory_1/_2`를 사용했다. 공유는 네 정식 직업 모두를 명시적으로 허용하며 초보는 포함하지 않는다. 전체 이름·ID·능력·가격은 [catalog.md](catalog.md), 정확한 클래스 권한 연결은 [class-links.json](class-links.json)을 본다.

| 계열 | 무기 주 능력 1→4급 | 의복 방어 1→4급 | 후속 형태 차이 |
| --- | --- | --- | --- |
| 전사 | 공격 8/14/21/29 | 6/10/15/21 | 외날 환도·은빛 코등이·청옥 자루 / 덧배자·겹여밈·트인 사냥 철릭 |
| 도적 | 공격 5/10/16/23, 민첩 3/4/6/8 | 3/6/10/14, 민첩 3/4/6/8 | 전사보다 짧은 단검 / 짧은 배자옷·먹빛 겹포·청띠 행려포 |
| 주술사 | 정신 7/12/18/25 | 2/5/8/12, 정신 3/5/8/11 | 일곱 방울·연결선·은빛 방울·청옥 자루 / 홍색·오색띠·흰소매·교차 깃 |
| 도사 | 정신 6/11/17/24 | 3/6/10/14, 정신 2/4/6/9 | 펼친 종이 접선·산수/구름/청죽 문양 / 긴 백색 도포·남색 깃·청옥띠 |

공유 장비는 말총 망건(권장1/가격50/방어1·민첩1), 대나무 삿갓(권장10/가격300/방어5·정신1), 매듭 향낭(권장5/가격160/방어1·정신2), 청옥 노리개(권장15/가격620/정신5·민첩2)다. 장비 이름의 옥·향·무복이 자동 회복이나 상태저항 효과를 의미하지 않는다.

## 파일과 인계

- `data.json`: ProjectDatabaseInput의 `equipment` 배열. 실제 정규화 함수로 재로드 확인한 36개 레코드.
- `design.json`: 형태 근거 URL·저작 출처·직업·권장 레벨·초반 상점/지급 제안·후속 범위·엔진 한계.
- `icons/*.png`: **원본 에셋 36개**. 32×32, RGBA, 투명/불투명만 사용하며 반투명·안티앨리어싱 없음.
- `assets.json`: `jf-icon-<slug>` → 로컬 원본과 통합 대상 `assets/joseon-folklore/equipment/<slug>.png` 매핑, PNG SHA-256 및 디코딩한 RGBA SHA-256.
- `review/*-full.png`: 직업별 무기/의복 1→4급과 공유 4종. 원본 1배 밝은 배경 + 5배 nearest 어두운 배경. `full-contact.png`는 36종 전체 시트, `pilot-contact.png`는 유지한 초급 시트다.
- `review/smoke.json`: 실제 normalizer·canEquip·장착 transition 실행, 직업 행렬, 읽기 전용 DB와 엔진 소스 해시.
- `review/visual-review.json`: 작성자가 실제 PNG를 연 기록과 관찰·한계. 사용자 승인 아님.
- `review/reproducibility.json`: 저장 PNG 재생성 후 동일 바이트/픽셀 해시 확인과 원본 이미지 검사.
- `class-links.json`: 감독자가 클래스 담당에게 연결할 정확한 허용 ID 12개/직업. 코드나 클래스 정본을 바꾸는 파일이 아니다.
- `catalog.md`: author.py에서 생성하는 전체 36종 수치 목록.
- `review/pilot-baseline.json`: 이전 초급 8개 레코드·그림 해시를 고정한 비교 근거.
- `HANDOFF.md`: 감독자 통합과 검토의 인계 요약.
- `status.json`: 마지막에 쓰는 `phase=full` 인계 상태. `ready`는 파일 인계 준비만 뜻한다.

공용 등록과 실제 게임 통합은 감독자가 담당한다. `assets.json`의 `sourcePath`를 이 폴더 기준으로 읽고, `path` 앞에 `public/`을 붙인 대상에 복사·리소스 등록한다. 현재 해당 public 파일과 리소스 등록은 없다. 복사 시 원본 PNG 바이트·resourceId를 유지한다. 메뉴와 자료집 아이콘이며 Actor1 이동·전투 픽셀을 교체하지 않는다.

`class_jf_*`와 `element_jf_physical`는 고정 ids.json 예약 ID다. 현재 prototype DB에는 아직 이 직업·속성 정의가 없으므로 이 파일만으로 게임에 설치된 것으로 보고하지 않는다. 클래스 담당/스킬 담당 레코드를 감독자가 함께 통합해야 한다.

**직업 제한:** 전용 장비 `equippableActorIds=[]`, `equippableClassIds=[자기 class_jf_*]`다. 공유 4개에는 네 직업을 명시한다. 엔진 `canEquip`는 장비와 클래스 허용을 OR로 결합한다. 클래스의 `equipmentPermissions.actorIds/classIds`는 `[]`, `equipmentIds`는 자기 직업 8개 + 공유 4개만 허용해야 한다. 정확한 목록은 class-links.json에 있다. smoke는 포괄 허용이 실제로 제한을 무력화함도 확인했다. 초보 직업은 이 36개를 허용하지 않는다.

**경제:** 초급 무기70~90/의복60~70 → 2급 무기180~220/의복160~180 → 3급 무기410~480/의복350~390 → 4급 무기820~940/의복680~740. 초기금 80으로 초급 한 벌을 함께 살 수 없어 첫 전직 때 한 벌 지급을 권장한다. 상점·지급 이벤트 미구현. 급별 주 능력 증분은 +4~8로 설정해 특수효과 없이 점진적으로 성장한다. 신규 적·클래스·기술과의 실전 경제/전투 검토는 통합 후 필요하며 실제 플레이 합격을 주장하지 않는다.

## 형태 근거와 창작 범위

아래는 자료의 형태 설명을 참고한 창작이며, 사진을 다운로드하거나 복제한 아이콘이 아니다. 원문 인용 없이 짧게 요약했고 항목별 적용을 `design.json.sources`에 연결했다.

- 전사: [환도 — 한국학중앙연구원](https://dh.aks.ac.kr/sillokwiki/index.php/환도(環刀))의 외날 검 형태와 [철릭 — 한국민족문화대백과사전](https://encykorea.aks.ac.kr/Article/E0056124)의 교차 깃·허리 이음·주름 치마 구성을 참고.
- 도적: [한국문화사 9권 — 국사편찬위원회](https://contents.history.go.kr/data/pdf/km/km_009.pdf)의 장도 호신·장식 용도 설명을 참고한 단검. 짧은 먹빛 저고리는 조선풍 고름·깃의 창작이며 특정 출토복식 재현은 아님.
- 주술사: [무령 — 공유마당/국립민속박물관](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=200018&wrtSn=11994602)의 자루·테·일곱 방울과 철릭 항목의 붉은 무당복을 참고. 지역별 무복의 완전 재현은 아님.
- 도사: [부채](https://encykorea.aks.ac.kr/Article/E0024573)의 대나무·종이 접선 형태, [도포](https://encykorea.aks.ac.kr/Article/E0015901)의 긴 옷·넓은 소매를 참고. 도사가 부채로 수련한다는 직업 설정은 창작.
- 제의 도구 문맥: [무구](https://encykorea.aks.ac.kr/Article/E0018941). 장비의 영적 전투 효과는 별도로 만들지 않았다.
- 머리: [망건](https://encykorea.aks.ac.kr/Article/E0017844)의 말총 그물눈 머리띠와 [복식](https://encykorea.aks.ac.kr/Article/E0023690)의 삿갓 사용 문맥을 참고.
- 장신구: [장신구](https://encykorea.aks.ac.kr/Article/E0048637)·[노리개](https://encykorea.aks.ac.kr/Article/E0012731)의 향낭·매듭·옥 몸체·술 구성을 참고. 역사적 여성 노리개를 게임에서 성별·직업 공용으로 확장한 설정이다.

능력치·가격·전용 직업·장비 이름은 이 팩의 게임 설계다. 그림·코드는 이 작업의 신규 저작이며 제삼자 에셋 라이선스 의존성이 없다. 참고 문헌의 이미지 권리를 팩의 권리로 주장하지 않는다.

## 재생성 / 허용된 개별 smoke

저장소 루트에서 실행한다. Python 3 + Pillow, 저장소 Node 의존성이 필요하다.

```bash
python3 content-packs/joseon-folklore/equipment/author.py
node content-packs/joseon-folklore/equipment/run-smoke.mjs
python3 content-packs/joseon-folklore/equipment/verify-assets.py
```

`author.py`는 전체36 data/design/class-links/catalog/상태 초안과 원본 도트/시트를 다시 만들고 `ready=false`로 둔다. 그림만 다시 만들려면 `python3 content-packs/joseon-folklore/equipment/draw.py`를 쓴다. 재생성 후 실제 이미지를 다시 보고 리뷰 기록과 해시를 갱신한 뒤 상태를 마지막에 확정해야 한다. Python/Pillow 버전이 바뀌면 PNG 압축 바이트 해시가 달라질 수 있어 RGBA 픽셀 해시도 기록한다. 고정한 pilot-baseline.json과 비교하여 초급 8개가 변하지 않는지도 검사한다.

`run-smoke.mjs`는 ViteNode로 실제 엔진 모듈을 호출하며 dev 서버를 띄우지 않는다. 실제 정규화·직렬화 재로드와 144개 직업/장착 조합, 초보144 거부, class-links 일치를 검사한다. `verify-assets.py`는 PNG36을 디코딩하여 32px·RGBA·투명/불투명·그림 고유성·재생성 바이트 일치·초급8 보존을 검사한다. 캐시는 `/tmp/jf-equipment-pilot-vite-cache`, configFile은 false라 공유 node_modules의 읽기 전용 Vite 임시 설정을 쓰지 않는다. 읽기 DB 경로는 기본으로 제공된 `output/jf-workers/prototype-database.json`, 다른 읽기 전용 사본은 `JF_EQUIPMENT_PROTOTYPE`로 지정한다. 전체 gates/vitest/typecheck는 실행하지 않았다.

## 검토·저장 한계

작성자 이미지 열람과 로컬 데이터 smoke 완료는 사용자의 시각 검토 승인·실제 플레이 검증을 뜻하지 않는다. live SQLite/Supabase, 다른 프로젝트, 런타임/에디터 코어, 공용 등록기와 고정 계약은 변경하지 않았다. 현재 워크트리에 project.sqlite가 없고 브라우저 IndexedDB 세션도 제공되지 않아 과거 AI 기록은 조회할 수 없었다. 이번 사용자 메시지와 계약, 작업 단위마다 읽은 steering을 기준으로 제작했다.
