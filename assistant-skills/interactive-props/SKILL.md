---
name: interactive-props
description: Use when placing animated interactive objects (push-in doors, curtains/noren, smashable jars/crates/barrels, opening wardrobes/chests/drawers, flickering horror lights/mirrors/portraits/wheelchairs, vending/arcade machines, campfires/forges/fountains, secret sliding doors) in an OPRN game. 밀고 들어가는 문·커튼·항아리 파괴·옷장/서랍 열기·공포 기믹(거울·초상화·오르간·폐병원)·자판기·모닥불·환경 오브젝트를 맵에 배치하거나 연출할 때.
---

# 상호작용 오브젝트 배치 스킬 (`interactive-props`)

OPRN Studio에는 저장소의 고퀄리티 원본 PNG를 0번 프레임으로 보존한 **5프레임 멀티프레임 상호작용 오브젝트(현재 156종, 5축 분류)**가 내장되어 있다.
단순 대사나 빈 투명 이벤트, 정지 타일로 «열렸다 / 부서졌다 / 깜빡인다»를 흉내 내지 말고 이 카탈로그의 실원본 오브젝트를 직접 배치한다.

- 원본: `assistant-skills/interactive-props/SKILL.md`
- 장르별 추천 ID 치트시트: `read_assistant_skill({ id: "interactive-props", part: "genre-recipes" })`

## 1. 3단계 표준 작업 흐름 (조회 → 배치 → 검증)

1. **5축 조회 (`list_interactive_props`)** — 절대로 ID를 추측하지 말고 먼저 조회한다.
   - `era` / `mapId`: 맵 칩셋 시대 자동 추론 (`fantasy` · `dungeon` · `modern` · `joseon` · `murim` · `scifi` · `steampunk`)
   - `genre`: 게임 장르 (`horror` · `puzzle-escape` · `adventure` · `romance-daily` · `monster-collect` · `life-survival` · `eastern` · `cyber-scifi`)
   - `category`: 기능 (`door-pass` · `container` · `breakable` · `machine` · `light-fire` · `water-env` · `gimmick` · `outdoor-ride`)
   - `zone`: 공간 (`indoor` · `outdoor` · `both`)
   - `role`: 플레이 역할 (`loot` · `passage` · `hide` · `puzzle-clue` · `ambient-light` · `hazard-trap`)
2. **원클릭 배치**
   - 일반 오브젝트·문·공포 기믹·환경 모션·스위치 연동 → **`place_interactive_props`**
   - 전리품 수납 + 집주인 감시(들킴) 패턴 → **`place_search_containers`** 에 `propId` 지정
3. **확인** — `show_map_region` 또는 `get_event`로 위치·겹침·통행(`check_reachability`)을 확인한다.

## 2. 배치 공간(`zone`)과 부착면(`mount`) 엄수 규칙

`list_interactive_props`가 돌려주는 `zone`과 `mount`를 반드시 지킨다:
- **`zone: "indoor"`** (옷장·고해실·세탁기·초상화·전신거울·폐병원 휠체어): 실내 맵에만 둔다. 야외 길·광장에 놓지 않는다.
- **`zone: "outdoor"`** (주차장 차단바·공동묘지 아치·허수아비·풍향계·모닥불·울타리문): 야외 맵에만 둔다. 방 안에 두지 않는다.
- **`mount: "wall"`** (초상화·샹들리에·벽걸이 시계·벽 횃불·해골 감실·납골당 해골 벽): **북쪽 벽면 윗줄**에 밀착해 둔다. 방 한가운데 바닥에 세우지 않는다.
- **`mount: "doorway"`** (밀고 들어가는 문·커튼·노렌·개찰구·대문): 벽 틈·입구·통로 한가운데 두고 앞뒤 1칸은 비워 통행 가능하게 남긴다.
- **중복 타일 금지**: `propId` 이벤트는 0번 프레임 원본 PNG를 런타임에 직접 그린다. **같은 칸에 `stamp_object`로 똑같은 정지 타일을 겹쳐 찍지 않는다**(열렸을 때 뒤에 정지 그림이 비쳐 보임).

## 3. 재생 모드(`playback`)별 연동 패턴

- **`toggle`** (밀기문·커튼·옷장·금고·비밀책장·묘비석판):
  - 다시 닫을 수 있게 하려면 `toggleable: true`.
  - 비밀 통로나 잠금 해제 기믹이면 `switchId: "sw_..."` 를 함께 넘겨 다른 문/이벤트 조건과 연결한다.
- **`break`** (항아리·옹기·술독·나무상자·오크통·수정):
  - `place_interactive_props` / `place_search_containers`가 파괴 후 페이지를 자동으로 `priority: "below", through: true`로 설정해 플레이어가 파편 위를 걸어 지나갈 수 있다.
- **`loopAfterOpen`** (깜빡이는 가로등·작업등·샹들리에·푸른 도깨비불 촛대·오르간·모닥불·분수·화로·원자로):
  - 한 번 작동하면 끝 프레임 구간을 무한 루프 재생하며, 화로·모닥불·제단·램프 계열은 런타임 주변 광원(glow)이 자동 점등된다.
- **`oneshot`** (전신 거울 균열·허수아비 움찔·폐병원 휠체어·자판기·종·북):
  - 1회성 공포 놀람 연출·보상·단서 발견에 쓰고 `message`로 즉각 반응을 준다.

## 4. 장르별 핵심 활용법

- **공포·추격전 (`genre: "horror"`)**:
  - `role: "hide"`(옷장·고해실·사물함·포토부스·천막·철창)를 먼저 찾아 배치하고, `make_chase_scene`의 `hidingSpots` 좌표와 일치시킨다.
  - 깜빡이는 조명(`horror-worklamp-flicker`, `horror-gothic-lamp`, `horror-gothic-chandelier`) + 1회 놀람(`horror-standing-mirror`, `horror-clinic-wheelchair`, `horror-mansion-portrait`) + 비밀 탈출(`horror-tomb-slab` + `switchId`)을 조합한다.
- **밀고 들어가는 출입구 (`category: "door-pass"`)**:
  - 판타지 집(`door-push-house-oak`), 사막(`door-push-desert-arch`), 감옥(`door-push-dungeon-cell`), 선술집(`door-push-izakaya-noren`), 커튼(`door-push-curtain-booth`), 지하철(`door-push-subway-gate`) 등 장소에 맞는 실제 문/커튼을 고른다.
- **탐색·파괴 RPG (`category: "breakable"` / `"container"`)**:
  - 마을·던전·조선·객잔 구석에 항아리/나무상자(`water-jug-smash`, `clay-pots-smash`, `joseon-hangari-smash`, `murim-suldok-smash`)를 `loot`와 함께 배치해 «부수며 탐색하는 손맛»을 만든다.

## 5. 카탈로그에 없는 새 오브젝트 직접 제작 (`author_interactive_prop`)

`list_interactive_props`로 찾아도 요청에 딱 맞는 사물(예: 저주받은 뻐꾸기시계, 마법 수정구, 특수 문·레버 등)이 없으면 **`author_interactive_prop`** 로 AI 조수가 직접 5프레임 가로 PNG 스트립을 만들어 프로젝트(`project.assets.uploaded`)에 등록·배치한다.

- **모드 B (권장 — 0번 원본 격자 + 자동 물리 모션 합성)**:
  - `baseGrid`(아래 실물 크기 규격표 준수) + `palette`(8~14색 색조 음영·어두운 윤곽선) + `motionRecipe` 9종 중 하나(`push-in-door`, `swing-door`, `curtain-part`, `hinge-lid`, `slide-door`, `smash-break`, `horror-flicker`, `glow-activate`, `rattle-scare`)를 넘기면 엔진이 실제 픽셀을 변환해 5프레임 스트립을 자동 합성하고 품질 게이트(크기·불투명·프레임 변화량)를 자동 통과시킨다.
- **모드 A (프레임별 직접 도트)**:
  - `framesGrid`(3~8프레임 격자 배열) + `palette` 로 각 프레임을 정밀하게 직접 찍는다.
- **원스텝 배치**: `place: { mapId, x, y, message?, toggleable?, switchId?, loot? }` 를 함께 넘기면 제작·등록·맵 배치를 한 번에 끝낸다.
- **실물 비례 해상도 규격 (24×32 캐릭터 · 실체 키 24px 기준, 1:1 도트 밀도 엄수)**:
  - **소형 기물 (1×1 타일)**: **`16×16` ~ `24×20`** — 항아리·보물상자·나무통·레버·촛대·탁상 소품. 캐릭터 허리~무릎 높이를 지킨다. (항아리·상자를 32×32로 꽉 채우면 사람보다 커지므로 금지)
  - **세로 가구 · 문 (1×2 타일)**: **`16×32` ~ `24×36`** — 옷장·책장·1칸 문·벽걸이 시계·자판기·횃불 기둥.
  - **대형 기물 · 랜드마크 (2×2 타일)**: **`32×32` ~ `48×48`** — 제단·석상·수정구 받침대·파이프오르간·2칸 대문 등 원래 사람 키 이상인 사물에만 사용한다.
- **HD-2D 품질 원칙 (필수)**:
  - **저채도 유화 팔레트**: 원색(형광·장난감 색)을 피하고 채도를 25~35% 눌러 차분한 중세/필름 톤을 쓴다(어둠은 차가운 남색·자주, 하이라이트는 따뜻한 상아·호박색으로 색조 이동).
  - **Sel-out 윤곽선**: 사물 둘레 전체를 똑같은 어두운 1px 선으로 두르지 말고, 빛 받는 윗면·좌상단 윤곽선은 밝은 중간톤으로 녹이고 순수 `#000000`은 쓰지 않는다.


