# 조선 설화 장비 — 첫 샘플 8개

GPT 6.1 sol high가 이 폴더의 `draw.py`에서 정수 좌표로 새로 그린 32×32 RGBA 아이콘이다. 기존 게임·번들 그림에 이름만 바꾼 재사용은 없다. 그림 생성 API와 제삼자 사진 픽셀을 사용하지 않았다. 출처와 재현 코드를 이 폴더에 함께 보존한다.

## 현재 범위

| 직업 | 초급 무기 / 가격 | 초급 의복 / 가격 | 무기 능력 | 의복 능력 |
| --- | --- | --- | --- | --- |
| 전사 | 수련 환도 / 80 | 솜누비 철릭 / 70 | 공격 +8 | 방어 +6 |
| 도적 | 호신 단검 / 70 | 먹빛 저고리 / 60 | 공격 +5, 민첩 +3, 치명타 +2%p | 방어 +3, 민첩 +3 |
| 주술사 | 수습 칠성방울 / 90 | 홍색 무복 / 65 | 공격 +2, 정신 +7 | 방어 +2, 정신 +3 |
| 도사 | 백지 접부채 / 75 | 삼베 도포 / 65 | 공격 +2, 정신 +6 | 방어 +3, 정신 +2 |

모두 초급 권장 레벨 1, 일반 공격 명중 보정 100%, 저주·양손·특수 플래그 없음. 정신력 수치만 제공하며 회복량 증가율·기력 절약·귀신 특효·자동 정화 효과를 주장하지 않는다. 방울과 부채도 일반 공격은 예약 물리 속성이다.

계약 ID는 `equip_jf_<warrior|rogue|shaman|taoist>_<weapon|body>_1`이며 의복의 실제 엔진 슬롯은 **armor**다. 후속 `_2/_3/_4` 및 공유 머리·장신구 4개는 이번 샘플에 없고 감독자의 후속 지시를 기다린다. 전체 목표 36개 중 8개다.

## 파일과 인계

- `data.json`: ProjectDatabaseInput의 `equipment` 배열. 실제 정규화 함수로 재로드 확인한 8개 레코드.
- `design.json`: 형태 근거 URL·저작 출처·직업·권장 레벨·초반 상점/지급 제안·후속 범위·엔진 한계.
- `icons/*.png`: **원본 에셋 8개**. 32×32, RGBA, 투명/불투명만 사용하며 반투명·안티앨리어싱 없음.
- `assets.json`: `jf-icon-<slug>` → 로컬 원본과 통합 대상 `assets/joseon-folklore/equipment/<slug>.png` 매핑, PNG SHA-256 및 디코딩한 RGBA SHA-256.
- `review/pilot-contact.png`: 원본의 1배 밝은 배경과 6배 nearest 확대 어두운 배경. 위 줄 무기, 아래 줄 의복; 왼쪽부터 전사·도적·주술사·도사.
- `review/smoke.json`: 실제 normalizer·canEquip·장착 transition 실행, 직업 행렬, 읽기 전용 DB와 엔진 소스 해시.
- `review/visual-review.json`: 작성자가 실제 PNG를 연 기록과 관찰·한계. 사용자 승인 아님.
- `review/reproducibility.json`: 저장 PNG 재생성 후 동일 바이트/픽셀 해시 확인과 원본 이미지 검사.
- `status.json`: 마지막에 쓰는 샘플 인계 상태. `ready`는 파일 인계 준비만 뜻한다.

공용 등록과 실제 게임 통합은 감독자가 담당한다. `assets.json`의 `sourcePath`를 이 폴더 기준으로 읽고, `path` 앞에 `public/`을 붙인 대상에 복사·리소스 등록한다. 현재 해당 public 파일과 리소스 등록은 없다. 복사 시 원본 PNG 바이트·resourceId를 유지한다. 메뉴와 자료집 아이콘이며 Actor1 이동·전투 픽셀을 교체하지 않는다.

`class_jf_*`와 `element_jf_physical`는 고정 ids.json 예약 ID다. 현재 prototype DB에는 아직 이 직업·속성 정의가 없으므로 이 파일만으로 게임에 설치된 것으로 보고하지 않는다. 클래스 담당/스킬 담당 레코드를 감독자가 함께 통합해야 한다.

**직업 제한:** 장비 `equippableActorIds=[]`, `equippableClassIds=[자기 class_jf_*]`다. 엔진 `canEquip`는 장비와 클래스 허용을 OR로 결합한다. 클래스의 `equipmentPermissions.actorIds/classIds`는 `[]`, `equipmentIds`는 자기 직업 장비 ID만 허용해야 한다. smoke는 포괄 허용이 실제로 제한을 무력화함도 확인했다. 초보 직업은 이 8개를 허용하지 않는다.

**경제:** 초기금 80으로 초급 무기와 의복을 함께 살 수 없다. 첫 전직 때 해당 초급 한 벌을 지급하는 방안을 제안했으며 지급 이벤트와 상점은 미구현이다. 권장 레벨은 메타데이터이며 실제 최소 레벨 장착 제한이 아니다. 전투 실전 밸런스는 통합 후 검토해야 한다.

## 형태 근거와 창작 범위

아래는 자료의 형태 설명을 참고한 창작이며, 사진을 다운로드하거나 복제한 아이콘이 아니다. 원문 인용 없이 짧게 요약했고 항목별 적용을 `design.json.sources`에 연결했다.

- 전사: [환도 — 한국학중앙연구원](https://dh.aks.ac.kr/sillokwiki/index.php/환도(環刀))의 외날 검 형태와 [철릭 — 한국민족문화대백과사전](https://encykorea.aks.ac.kr/Article/E0056124)의 교차 깃·허리 이음·주름 치마 구성을 참고.
- 도적: [한국문화사 9권 — 국사편찬위원회](https://contents.history.go.kr/data/pdf/km/km_009.pdf)의 장도 호신·장식 용도 설명을 참고한 단검. 짧은 먹빛 저고리는 조선풍 고름·깃의 창작이며 특정 출토복식 재현은 아님.
- 주술사: [무령 — 공유마당/국립민속박물관](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=200018&wrtSn=11994602)의 자루·테·일곱 방울과 철릭 항목의 붉은 무당복을 참고. 지역별 무복의 완전 재현은 아님.
- 도사: [부채](https://encykorea.aks.ac.kr/Article/E0024573)의 대나무·종이 접선 형태, [도포](https://encykorea.aks.ac.kr/Article/E0015901)의 긴 옷·넓은 소매를 참고. 도사가 부채로 수련한다는 직업 설정은 창작.
- 제의 도구 문맥: [무구](https://encykorea.aks.ac.kr/Article/E0018941). 장비의 영적 전투 효과는 별도로 만들지 않았다.

능력치·가격·전용 직업·장비 이름은 이 팩의 게임 설계다. 그림·코드는 이 작업의 신규 저작이며 제삼자 에셋 라이선스 의존성이 없다. 참고 문헌의 이미지 권리를 팩의 권리로 주장하지 않는다.

## 재생성 / 허용된 개별 smoke

저장소 루트에서 실행한다. Python 3 + Pillow, 저장소 Node 의존성이 필요하다.

```bash
python3 content-packs/joseon-folklore/equipment/author.py
node content-packs/joseon-folklore/equipment/run-smoke.mjs
```

`author.py`는 data/design/상태 초안과 원본 도트/시트를 다시 만들고 `ready=false`로 둔다. 그림만 다시 만들려면 `python3 content-packs/joseon-folklore/equipment/draw.py`를 쓴다. 재생성 후 실제 이미지를 다시 보고 리뷰 기록과 해시를 갱신한 뒤 상태를 마지막에 확정해야 한다. Python/Pillow 버전이 바뀌면 PNG 압축 바이트 해시가 달라질 수 있어 RGBA 픽셀 해시도 기록한다.

`run-smoke.mjs`는 ViteNode로 실제 엔진 모듈을 호출하며 dev 서버를 띄우지 않는다. 캐시는 `/tmp/jf-equipment-pilot-vite-cache`, configFile은 false라 공유 node_modules의 읽기 전용 Vite 임시 설정을 쓰지 않는다. 읽기 DB 경로는 기본으로 제공된 `output/jf-workers/prototype-database.json`, 다른 읽기 전용 사본은 `JF_EQUIPMENT_PROTOTYPE`로 지정한다. 전체 gates/vitest/typecheck는 실행하지 않았다.

## 검토·저장 한계

작성자 이미지 열람과 로컬 데이터 smoke 완료는 사용자의 시각 검토 승인·실제 플레이 검증을 뜻하지 않는다. live SQLite/Supabase, 다른 프로젝트, 런타임/에디터 코어, 공용 등록기와 고정 계약은 변경하지 않았다. 현재 워크트리에 project.sqlite가 없고 브라우저 IndexedDB 세션도 제공되지 않아 과거 AI 기록은 조회할 수 없었다. 이번 사용자 메시지와 계약, 작업 단위마다 읽은 steering을 기준으로 제작했다.
