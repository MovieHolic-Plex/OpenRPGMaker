# 툴 카탈로그 (자동 생성)

> 이 문서는 `src/editor/tools/` 레지스트리에서 자동 파생됩니다. 직접 편집하지 마세요.
> 총 100개 툴 — 쓰기 69, 읽기 31.

생성: `generateToolCatalogMarkdown()` (editor/tools/toolCatalog.ts). OpenAI function calling 스키마는 `toOpenAiTools()`로 파생됩니다.

## 쓰기 툴 (dry-run + 커밋 게이트)

| 이름 | 파라미터 | 설명 |
| --- | --- | --- |
| `propose_tile_vocabulary` | `tilesetId?: string`, `items: array` | 미승인 타일/그룹을 승인 어휘로 편입하자고 사용자에게 제안한다(v3). items마다 kind=group(9분할 벽·기둥·오토타일 등 패턴 단위, groupId=기존 그룹 또는 tileIds=신규)/kind=tile(낱개 소품, tileIds). name/role/patternKind/layerHome은 너의 추정이며 카드에서 사용자가 교정 후 수락한다. **중요: 이 툴만 부르고 멈추지 마라 — 제안 직후 같은 턴에 build_wall 등 시공 프리미티브를 그 그룹 id로 호출하면, 미승인 실패가 승인 카드에 보류 시공으로 묶여 사용자 수락 한 번으로 시공까지 끝난다.** 배치 프리미티브는 승인 어휘만 소비한다. |
| `build_wall` | `mapId: string`, `rect: object`, `wallVocabId: string` | 승인된 벽 어휘로 벽을 시공한다(v3 공정 1단계). rect 영역에 9분할(nine_slice)/기둥(vertical) 패턴을 전개하며 레이어는 어휘의 layerHome이 결정한다(layer 인자 없음). 미승인 어휘여도 그냥 호출하라 — propose_tile_vocabulary로 어휘를 제안한 직후 같은 턴에 이 툴을 호출하면, 미승인 실패가 승인 카드에 '보류 시공'으로 묶여 사용자가 한 번 수락하면 시공까지 완료된다(승인을 기다리며 멈추지 마라). 시공 후 place_door/place_window → build_roof 순서로 진행하라. |
| `build_roof` | `mapId: string`, `roofVocabId: string`, `wallRect?: object` | 승인된 지붕 어휘로 벽 위에 지붕을 얹는다(v3 공정 3단계). wallRect 생략 시 맵의 벽 어휘 셀을 스캔해 자동 감지한다. 벽이 없으면 거부 — 먼저 build_wall로 벽을 지으라. 처마/사선 오버레이 레이어는 어휘 layerHome(perCell) 규약으로 자동 판정된다. |
| `place_door` | `mapId: string`, `at: object`, `doorVocabId: string` | 승인된 문 어휘를 벽 셀에 설치한다(v3 공정 2단계). 대상 셀이 벽(승인된 벽 어휘 타일)이 아니면 거부. 문 어휘가 세로 1×2 패턴이면 위 칸까지 자동 전개. layer 인자 없음 — 어휘 layerHome이 결정. |
| `place_window` | `mapId: string`, `at: object`, `windowVocabId: string` | 승인된 창문 어휘를 벽 셀에 설치한다(v3 공정 2단계). 대상 셀이 벽(승인된 벽 어휘 타일)이 아니면 거부. layer 인자 없음 — 창문 같은 투명 소품은 어휘 layerHome(upper/perCell)이 벽을 보존하며 겹친다. |
| `lay_path` | `mapId: string`, `points: array`, `pathVocabId: string`, `naturalness?: number`, `seed?: integer` | 승인된 길 어휘로 경유점(2개 이상)을 잇는 길을 깐다(v3 공정 4단계). 어휘에 8-이웃 variantMap 오토타일 정의가 필수 — 없으면 거부(승인 시 오토타일 정의 필요). 외곽+inner corner 변형을 자동 재계산한다. naturalness 0~1(기본 0.5), seed로 결정론 재현. |
| `place_props` | `mapId: string`, `area: object`, `propVocabId: string`, `count: integer`, `minGap?: integer`, `naturalness?: number`, `seed?: integer` | 승인된 소품 어휘를 area 안에 자연 산포한다(v3 공정 5단계). propVocabId가 그룹이면 기존 산포 엔진(풋프린트 원자 배치·클러스터 hard 규칙·보호셀 회피)을 그대로 쓰고, 승인된 낱개 타일 id(숫자)면 포아송 산포로 배치한다. layer 인자 없음 — 어휘 layerHome이 결정. |
| `tile_erase` | `mapId: string`, `rect: object`, `layer?: both\|lower\|upper` | 지정 사각형의 타일을 비운다(v3). layer: both(기본, 상·하위 모두)/lower/upper. 승인 어휘가 필요 없는 유일한 배치 툴 — 실수 정리·재시공 전 청소에 쓴다. |
| `build_house_kit` | `mapId: string`, `kitId: blue-stone\|bright-plaster`, `wings: array`, `door?: boolean` | 하네싱 집 키트로 집을 짓는다(권장 정공법). 건물 = 날개 사각형(wings)들의 합집합 — 직사각·ㄱ/ㄴ/ㄷ/ㅁ/O자 등 임의 평면 가능. 벽 3행(상·중·하 나인슬라이스)과 지붕 3단, 상위 레이어 마감(대각/용마루/트림)은 스크립트가 자동으로 정확히 깐다 — 타일 ID를 직접 고르지 말 것. 키트: blue-stone(파랑 지붕+석벽) \| bright-plaster(밝은 오렌지 지붕+흰 회벽). 이 두 키트에 없는 재질(통나무·초가 등)을 요청받으면 지어내지 말고 '아직 학습되지 않은 재질'이라고 답할 것. 제약: 날개 폭 ≥3, 각 열 구간 높이 ≥5(벽3+지붕2). 문은 남쪽 외벽 중앙에 자동 배치된다. |
| `tile_paint` | `mapId: string`, `action?: paint\|erase`, `layer?: lower\|upper`, `mode: rect\|line\|fill\|cells`, `tile?: integer`, `from?: object`, `to?: object`, `cells?: array` | 타일을 칠하거나 지운다(v2). action=paint(기본)는 tile 필수, action=erase는 tile 불필요. mode: rect(from/to)/line(from/to)/fill(from, lower 전용)/cells(cells 배열). 클러스터 hard 규칙 동반 배치와 통행성 경고는 자동. |
| `tile_road` | `mapId: string`, `points: array`, `style?: dirt\|sand`, `presetId?: string`, `paletteRole?: ground\|path\|wall\|water\|decor\|boundary\|roof\|furniture`, `naturalness?: number`, `seed?: integer` | 길을 깐다(v2). points 폴리라인(2개 이상)을 잇고 오토타일 셰이핑까지 자동. naturalness 0~1(기본 0.5): 0=반듯한 직선, 0.8+=야생 구불길. 프리셋이 있으면 presetId+paletteRole(path)로 타일을 고른다. |
| `tile_scatter` | `mapId: string`, `area: object`, `count: integer`, `groupId?: string`, `presetId?: string`, `paletteRole?: ground\|path\|wall\|water\|decor\|boundary\|roof\|furniture`, `minGap?: integer`, `naturalness?: number`, `seed?: integer` | 타일 그룹/프리셋 오브젝트를 area 안에 자연 산포한다(v2). groupId 또는 presetId+paletteRole 중 하나 필수. 풋프린트 원자 배치·보호셀 회피·클러스터 hard 규칙 자동. naturalness: <0.3 균일, 0.3~0.7 포아송, >0.7 군락. |
| `tile_structure` | `mapId: string`, `kind: house\|template_house\|structure\|terrain_template`, `origin: object`, `width?: integer`, `height?: integer`, `material?: plaster\|wood\|stone`, `variant?: string`, `template?: string`, `templateId?: string`, `includeFence?: boolean`, `naturalness?: number`, `seed?: integer`, `presetId?: string`, `paletteRole?: ground\|path\|wall\|water\|decor\|boundary\|roof\|furniture` | 구조물을 짓는다(v2). kind=house(맞춤 집: width/height/material), template_house(기성 집: variant/material), structure(내장 구조물: template 이름), terrain_template(지형 템플릿: templateId). 벽 타일을 직접 칠하지 말고 항상 이 툴을 쓰라. |
| `tile_metadata` | `tilesetId?: string`, `confirmedByUser?: boolean`, `entries: array` | 타일의 의미(label/description/role/tags)와 규칙(layer/passable/terrainTag)을 한 번에 설정한다(v2). entries 항목마다 필요한 필드만 넣으면 의미/규칙이 자동 분배된다. 사용자가 확정한 값이면 confirmedByUser=true(잠금·재감사 보호). 잠긴 타일은 confirmedByUser=true로만 수정 가능. |
| `tile_group` | `tilesetId?: string`, `action: upsert\|delete\|set_junction\|set_overlay`, `group?: object`, `groupId?: string`, `junction?: object`, `overlay?: object` | 타일 그룹을 관리한다(v2). action=upsert(group 필요: 신규는 id 생략), delete(groupId), set_junction(groupId+junction), set_overlay(groupId+overlay). 그룹은 산포/클러스터 규칙의 단위다. |
| `tile_cluster_rule` | `tilesetId?: string`, `groupId: string`, `rule: object` | 타일 그룹의 클러스터 규칙을 설정한다(v2). kind: adjacency(동반/인접 배치), spacing(간격), count(개수 한도). strength: hard(배치 강제)/medium(경고)/soft(정보). params는 kind별 파라미터 객체. |
| `tile_palette_preset` | `tilesetId?: string`, `preset: object` | 타일셋 팔레트 프리셋을 추가/수정한다. 프리셋이 있으면 개별 타일 id 대신 presetId+paletteRole을 우선 사용하라. 잠긴 프리셋은 AI가 수정할 수 없다. |
| `create_map` | `name: string`, `width: integer`, `height: integer`, `id?: string` | 새 맵을 생성한다(잔디 바닥 + 테두리 벽, 최대 256×256). 시작 맵이 없으면 이 맵을 시작 맵으로 채택한다. |
| `paint_tiles` | `mapId: string`, `layer: lower\|upper`, `mode: rect\|line\|fill\|cells`, `tile: integer`, `from?: object`, `to?: object`, `cells?: array` | 타일을 칠한다. mode: rect(사각형)/line(선)/fill(채우기)/cells(개별 셀). 통행성이 바뀌면 경고를 반환한다. 투명 배경 칩(벤치·나무·사선 지붕 등)은 상위 레이어 전용이라 자동 라우팅된다. |
| `paint_road` | `mapId: string`, `points: array`, `style?: dirt\|sand`, `presetId?: string`, `paletteRole?: string`, `naturalness?: number`, `seed?: integer` | 폴리라인을 따라 도로를 깐다. style: dirt(흙길)/sand(모래). 프리셋이 있으면 개별 타일 id/style보다 presetId+paletteRole을 우선 사용하라. 오토타일로 가장자리를 자동 성형한다. naturalness(자연도) 기본 0.5. 사용자가 '정갈/반듯'을 원하면 0~0.2, '야생/자연/구불구불'을 원하면 0.8 이상을 쓰세요. |
| `stamp_structure` | `mapId: string`, `template: l\|courtyard\|multi\|road\|plaster\|stone`, `origin: object`, `presetId?: string`, `paletteRole?: string`, `naturalness?: number`, `seed?: integer` | 집/구조물 템플릿을 찍는다. template: l(ㄴ자 집)/courtyard(안뜰 딸린 집)/multi(연립 주택)/road(길)/plaster(회벽 소형 집)/stone(석조 소형 집). 프리셋이 있으면 개별 타일 id 대신 presetId+paletteRole을 우선 사용하라. 반환 diff에 문 좌표를 포함한다. naturalness(자연도) 기본 0.5. 사용자가 '정갈/반듯'을 원하면 0~0.2, '야생/자연/구불구불'을 원하면 0.8 이상을 쓰세요. |
| `stamp_template_house` | `mapId: string`, `origin: object`, `variant: template\|wide\|compact\|l`, `material: plaster\|wood\|stone`, `includeFence?: boolean`, `approachHeight?: integer` | 지형 템플릿 기반 집을 찍는다. variant: template(small_house_01 표)/wide(넓은)/compact(작은)/l(ㄴ자 집), material: plaster(회벽)/wood(목재)/stone(석재). approachHeight로 문 앞 진입로를 깐다. 발자국 약 18×16 — 여유 있는 origin을 잡아라. 임의 크기 직사각형 집은 build_house를 써라. 반환 data에 문 좌표 포함. |
| `build_house` | `mapId: string`, `origin: object`, `width: integer`, `height: integer`, `material: plaster\|wood\|stone`, `presetId?: string`, `paletteRole?: string`, `naturalness?: number`, `seed?: integer` | 요청한 크기의 직사각형 집을 짓는다(지붕 4행 + 벽 + 문 + 창문 자동 구성). width 5~30, height 6~24, material: plaster(회벽)/wood(목재)/stone(석재). 프리셋이 있으면 개별 타일 id 대신 presetId+paletteRole을 우선 사용하라. '10x10 집'처럼 크기가 지정된 집은 벽 타일을 직접 칠하지 말고 이 툴을 써라. 반환 data에 문 좌표 포함. naturalness(자연도) 기본 0.5. 사용자가 '정갈/반듯'을 원하면 0~0.2, '야생/자연/구불구불'을 원하면 0.8 이상을 쓰세요. |
| `clear_region` | `mapId: string`, `x: integer`, `y: integer`, `w: integer`, `h: integer`, `layer?: lower\|upper\|both`, `fill?: grass\|empty` | 맵의 사각 영역을 정리한다: 상위 레이어는 비우고, 하위 레이어는 잔디(fill=grass, 기본) 또는 빈 칸(fill=empty)으로 되돌린다. 잘못 배치한 구조물을 지울 때 사용. 이벤트는 지우지 않고 경고로 알린다. |
| `set_start_position` | `mapId: string`, `x: integer`, `y: integer` | 게임 시작 맵/좌표를 지정한다. 통행 불가 타일이면 실패한다. |
| `set_tile_passability` | `tilesetId?: string`, `tile: integer`, `passable: boolean` | 타일셋의 특정 타일 통행 가능 여부를 설정한다(4방향 일괄). 겉보기와 실제 통행성이 다른 타일을 고칠 때 사용. |
| `set_map_properties` | `mapId: string`, `name?: string`, `encounterRate?: integer`, `troopIds?: array` | 맵 속성을 설정한다: name(이름), encounterRate(랜덤 인카운트율, 0=없음), troopIds(인카운트 적 그룹 — 실제 트룹 id여야 함). |
| `resize_map` | `mapId: string`, `width: integer`, `height: integer` | 맵 크기를 바꾼다(좌상단 기준, 확장부는 잔디, 최대 256×256). 축소로 이벤트가 범위 밖에 나가면 거부 — 먼저 move_event/remove_event로 정리하라. |
| `remove_map` | `mapId: string` | 맵을 삭제한다(파괴적 — 꼭 필요할 때만, 이유를 먼저 설명). 시작 맵은 삭제 불가. 맵 트리/연결/이동(transfer) 참조는 함께 정리되며, 무결성 검증에 실패하면 거부된다. |
| `generate_map` | `theme: village\|forest\|cave`, `name?: string`, `width: integer`, `height: integer`, `entrance?: object`, `pois?: array`, `chokepoints?: integer`, `seed?: integer`, `id?: string` | 테마(village/forest/cave) 맵을 생성한다(최대 256×256). 입구→모든 POI 도달성을 생성기가 보장(생성→검사→통로 수리 루프). |
| `upsert_event` | `mapId: string`, `event: object` | 저수준 만능 이벤트 툴. 기존 GameEvent 구조 그대로 받아 shape 검증 후 맵에 upsert한다. |
| `place_npc` | `mapId: string`, `x: integer`, `y: integer`, `name: string`, `graphic?: object`, `movement?: fixed\|random`, `pages: array`, `id?: string` | NPC 이벤트를 배치한다. graphic은 {query} 또는 {textureKey,characterIndex}. query는 반드시 유효 별칭만: villager\|people\|npc\|human\|사람\|주민\|actor\|hero\|animal\|monster (자유 문구 예: 'old woman'은 실패한다). pages는 SimplePage로 EventPage로 컴파일된다. page.conditions 단수 객체/null, page.commands 단수 객체, command→kind alias는 warning과 함께 정규화한다. 통행 불가 칸이면 실패. |
| `create_transfer_pair` | `a: object`, `b: object`, `fade?: black\|white\|none` | 두 맵 사이 양방향 출입구를 원자적으로 생성한다. 착지점은 상대 출입구에 인접한 통행 가능 칸으로 자동 선정(즉시 재전이 방지). |
| `place_battle_blocker` | `mapId: string`, `x: integer`, `y: integer`, `troopId: string`, `clearSwitchId?: string`, `intro?: array`, `victory?: array`, `victoryItems?: array`, `graphic?: object`, `id?: string` | 전투 블로커를 배치한다(전투 페이지 + 승리 후 투명 페이지). clearSwitchId로 재전투를 막는다. |
| `duplicate_event` | `fromMapId: string`, `eventId: string`, `toMapId: string`, `x: integer`, `y: integer`, `newId?: string` | 이벤트를 다른 맵/좌표로 복제한다. |
| `remove_event` | `mapId: string`, `eventId: string` | 맵에서 이벤트를 제거한다(파괴적). |
| `move_event` | `mapId: string`, `eventId: string`, `x: integer`, `y: integer` | 이벤트를 같은 맵 내 다른 좌표로 옮긴다. |
| `upsert_item` | `item: object` | 아이템 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다. |
| `upsert_enemy` | `enemy: object` | 적 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다. |
| `upsert_troop` | `troop: object` | 적 그룹(트룹) 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다. |
| `upsert_actor` | `actor: object` | 아군 액터 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다. |
| `upsert_skill` | `skill: object` | 스킬 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다. |
| `upsert_equipment` | `equipment: object` | 장비(무기/방어구) 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다. |
| `upsert_class` | `class: object` | 직업(클래스) 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다. |
| `upsert_state` | `state: object` | 상태이상(State) 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 임의 필드는 거부한다. |
| `upsert_common_event` | `id: string`, `name: string`, `trigger?: none\|auto\|parallel`, `conditionSwitchId?: string`, `commands: array` | 커먼 이벤트를 등록/수정한다. trigger: none(호출 전용)/auto/parallel, 조건 스위치 지정 가능. |
| `set_session_start` | `gold?: integer`, `inventory?: object`, `partyActorIds?: array` | 게임 시작 상태(골드/인벤토리/파티)를 설정한다. |
| `set_title_screen` | `title: string`, `menuLabels?: object` | 타이틀 화면 제목/메뉴 라벨을 설정한다. |
| `upsert_world_entities` | `entities: array` | 세계관 개체를 배치 추가/수정한다. 새 NPC/맵/명명 아이템을 만들 때 같은 제안에 반드시 세계관 갱신을 동봉하라. 잠긴 세계관 개체는 AI가 수정할 수 없다. |
| `link_world_ref` | `entityId: string`, `kind: map\|event\|item\|skill\|actor`, `id: string`, `action: link\|unlink` | 기존 세계관 개체에 게임 개체 ref(kind+id)를 연결하거나 해제한다. 새 NPC/맵/명명 아이템 생성 시 upsert_world_entities와 함께 실제 게임 id를 연결하라. |
| `upsert_palette_preset` | `tilesetId?: string`, `preset: object` | 타일셋 팔레트 프리셋을 추가/수정한다. 프리셋이 있으면 개별 타일 id 대신 presetId+paletteRole을 우선 사용하라. 잠긴 프리셋은 AI가 수정할 수 없다. |
| `create_quest_flags` | `questKey: string`, `steps: integer` | 퀘스트용 스위치(sw_<key>_started/_done)와 진행 변수(var_<key>_progress)를 자동 등록한다. |
| `create_quest` | `def: object` | 선언적 QuestDef를 컴파일한다 — 스위치/변수 + 기버 다중 페이지 + 수집물/블로커/게이트 이벤트 생성 + project.quests 메타 보존. |
| `tune_enemy` | `enemyId: string`, `targetHitsToKill: integer`, `targetDamageToHeroPerHit: integer`, `heroLevel?: integer` | 데미지 공식을 역산해 적의 maxHp/attack을 목표(처치 타수/영웅 피해량)에 맞춘다. 반환 data에 산출 근거 포함. |
| `rename_switch` | `fromId?: string`, `fromName?: string`, `to: string` | 스위치 id를 전 맵/커먼이벤트/트룹/적 행동에서 일괄 치환한다(정의·세션·참조 모두). fromId 또는 fromName으로 대상 지정. |
| `rename_variable` | `fromId?: string`, `fromName?: string`, `to: string` | 변수 id를 전 맵/커먼이벤트/트룹에서 일괄 치환한다(정의·세션·setVariable·조건·숫자입력 참조 포함). fromId 또는 fromName으로 대상 지정. |
| `prune_unused` | `apply?: boolean` | 미참조 스위치/변수(명명된 것)와 아이템/트룹을 보고한다. apply=true면 제거까지 수행. |
| `revert_last_edit` | `steps?: integer` | 최근 편집 히스토리의 이전 상태로 되돌린다. 사용자가 '되돌려/취소/이전으로/undo'라고 하면 이 툴을 호출하라. 절대 clear_region 등으로 직접 지우지 말 것. |
| `set_tile_metadata` | `tilesetId?: string`, `entries: array`, `confirmedByUser?: boolean` | 타일의 라벨/설명/태그/역할을 기록한다. 사용자가 답으로 확정한 내용이면 confirmedByUser=true(잠금·최우선). 잠긴 타일은 confirmedByUser=true로만 수정 가능. |
| `set_tile_rules` | `tilesetId?: string`, `entries: array`, `confirmedByUser?: boolean` | 타일의 규칙을 설정한다: layer(auto/lower/upper — 홈 레이어 확정), passable(통행 가능 여부), terrainTag(지형 태그). 레이어 변경은 사용자가 요청/확인한 경우에만 confirmedByUser=true로 호출하라. 여러 타일은 entries로 한 번에. |
| `upsert_tile_group` | `tilesetId?: string`, `id?: string`, `name: string`, `role: building\|castle\|fence\|roof\|terrain\|water\|wall\|prop`, `tileIds: array`, `defaultLayer?: lower\|upper\|event\|mixed`, `description?: string`, `placementRules?: string`, `junctions?: array`, `overlays?: array`, `rules?: array` | 여러 타일이 하나의 구조(지붕/울타리/길 등)를 이룰 때 시맨틱 그룹과 배치 규칙(placementRules)을 기록한다. id가 기존 그룹이면 갱신. |
| `set_group_junction` | `tilesetId: string`, `groupId: string`, `junction: object` | 타일 그룹에 경계 규칙을 추가하거나 갱신한다. 예: 지붕 아래 벽이 맞닿으면 하단 처마 역할 타일을 생략/대체. |
| `set_group_overlay` | `tilesetId: string`, `groupId: string`, `overlay: object` | 타일 그룹에 조건부 오버레이 규칙을 추가하거나 갱신한다. 예: 사선 모서리나 처마 끝 조건에서 상위 레이어 타일을 더한다. |
| `delete_tile_group` | `tilesetId: string`, `groupId: string` | 타일셋의 시맨틱 타일 그룹을 삭제한다. 클러스터 해체처럼 사용자가 명시적으로 확인한 경우에만 호출. |
| `set_cluster_rule` | `tilesetId: string`, `groupId: string`, `rule: object` | 타일 그룹의 클러스터 규칙을 추가하거나 갱신한다. hard는 projectLint error로 커밋 게이트에서 차단되고, medium/soft는 warning/info로 보고된다. |
| `set_group_layout` | `tilesetId?: string`, `groupId: string`, `axis: vertical\|horizontal`, `top?: array`, `bottom?: array`, `left?: array`, `right?: array` | 타일 그룹의 실제 구성 문법(patternGrammar)을 저장한다. 세로는 위/아래, 가로는 좌/우 캡을 기록해 render_group_sample과 배치 툴이 같은 덩어리로 해석하게 한다. |
| `scatter_object` | `mapId: string`, `groupId?: string`, `presetId?: string`, `paletteRole?: string`, `area: object`, `count: integer`, `minGap?: integer`, `maxGap?: integer`, `naturalness?: number`, `mode?: uniform\|poisson\|cluster`, `seed?: integer`, `avoidProtected?: boolean`, `preferSoftRules?: boolean`, `applyStructure?: boolean` | 타일 그룹 오브젝트를 영역 안에 여러 개 흩뿌려 배치한다. 프리셋이 있으면 groupId 대신 presetId+paletteRole을 우선 사용하라. 풋프린트 단위로 원자 배치하며 시작칸/이벤트/transfer/상위 타일 보호셀을 피한다. naturalness(자연도) 기본 0.5. 사용자가 '정갈/반듯'을 원하면 0~0.2, '야생/자연/구불구불'을 원하면 0.8 이상을 쓰세요. |
| `stamp_terrain_template` | `mapId: string`, `templateId: string`, `origin: object`, `material?: plaster\|wood\|stone`, `includeFence?: boolean`, `paintRoads?: boolean` | buildPlan이 있는 지형 템플릿을 맵에 결정적으로 찍는다(울타리+집+창문+문, paintRoads=true면 진입로까지). buildPlan이 없는 템플릿은 get_terrain_template의 grammar대로 paint_tiles로 조립하라. |
| `upsert_terrain_template` | `tilesetId?: string`, `id?: string`, `name: string`, `sourceMapName?: string`, `rows?: array`, `grammar?: array`, `rules?: array`, `tags?: array`, `sourceRegion?: object`, `confirmedByUser?: boolean` | 지형 템플릿(구조물 지식)을 저장한다. 사용자가 인터뷰로 확정한 내용이면 confirmedByUser=true. 기존 템플릿 갱신은 confirmedByUser=true일 때만 허용된다. |

## 읽기 툴

| 이름 | 파라미터 | 설명 |
| --- | --- | --- |
| `tile_query` | `ask: tile_info\|unclassified\|palette\|usage\|similar\|terrain_templates\|terrain_template\|unapproved`, `tilesetId?: string`, `tileIds?: array`, `tileId?: integer`, `mapId?: string`, `role?: string`, `category?: string`, `presetId?: string`, `templateId?: string`, `limit?: integer` | 타일 지식 통합 조회(v2). ask: tile_info(tileIds 상세), unclassified(미분류 목록), palette(role/category/프리셋 필터로 타일 찾기 — 칠할 타일을 모를 때 여기부터), usage(맵 사용 현황: mapId), similar(비슷한 타일: tileId), terrain_templates(템플릿 목록), terrain_template(템플릿 상세: templateId), unapproved(미승인 어휘 요약 — 배치 전 propose_tile_vocabulary 대상 확인). |
| `preview_house` | `mapId: string`, `origin: object`, `width: integer`, `height: integer`, `material: plaster\|wood\|stone` | 요청한 크기의 집을 실제 맵에 짓지 않고 미리보기한다. build_house와 같은 스탬프 로직으로 throwaway 복제 맵에 찍은 뒤, 이미지 렌더링용 lower/upper 타일 그리드를 반환한다. |
| `query_world` | `type?: character\|place\|faction\|event\|item\|concept\|guideline`, `tags?: array`, `text?: string`, `limit?: integer` | 세계관 개체와 관계를 조회한다. type/tags/text로 필터링해 상세(body/refs/relations)를 읽고, 세계관을 수정하기 전 현재 내용을 확인하라. |
| `simulate_battle` | `troopId: string`, `heroLevel: integer`, `inventory?: object`, `potionItemId?: string`, `n?: integer`, `seed?: integer` | 전투를 헤드리스로 N회 시뮬레이션해 승률/평균 타수/포션 사용/잔여 HP를 반환한다(seed로 재현 가능). |
| `list_edit_history` | `mapId?: string`, `limit?: integer` | 편집 히스토리의 라벨, 맵, 순서를 조회한다. 되돌릴 수 있는 작업을 사용자에게 설명하거나 되돌릴 지점을 확인할 때 사용한다. |
| `play_walkthrough` | `scenario: array`, `seed?: integer` | 시나리오 스텝을 브라우저 없이 실행해 완주 가능성/막힘 지점을 검증한다. 스텝: {do:'interact',eventId} / {do:'choose',index} / {do:'moveTo',mapId,x,y} / {do:'battle',expect:'victory'\|'defeat'} / {expect:'switch'\|'item'\|'variable'\|'mapId'\|'gold'\|'ended', ...}. 도달 스텝/실패 지점/최종 상태를 반환한다. |
| `get_project_summary` | (없음) | 제목/맵 목록(크기·이벤트 수)/DB 카운트/스위치·변수/시작점 요약을 반환한다. |
| `get_map_region` | `mapId: string`, `x: integer`, `y: integer`, `w: integer`, `h: integer` | 맵 영역을 시맨틱 문자 그리드(#=벽/통행불가, .=통행가능, ~=물, T=나무, E=이벤트)로 반환한다. |
| `find_events` | `mapId?: string`, `nameContains?: string`, `commandKind?: string`, `referencesSwitch?: string` | 이벤트를 이름/커맨드 종류/스위치 참조로 검색한다. |
| `get_event` | `mapId: string`, `eventId: string` | 이벤트의 전체 정의(위치/그래픽/페이지/커맨드)를 반환한다. upsert_event로 수정하기 전에 반드시 현재 내용을 이걸로 읽어라. |
| `find_switch_usage` | `switchId: string` | 스위치의 전 맵 이벤트/커먼이벤트/트룹 전투이벤트 역참조를 찾는다. |
| `list_resources` | `kind: tile\|charset\|backdrop\|bgm\|se`, `query: string` | 리소스를 시맨틱 검색한다(resourceSearch 위임). kind: tile/charset/backdrop/bgm/se. |
| `query_tiles` | `tilesetId?: string`, `role?: string`, `category?: string`, `presetId?: string`, `limit?: integer` | 타일셋의 타일 상세를 role/category/presetId로 조회한다. 프리셋이 있으면 배치 전에 개별 tile id 대신 presetId+paletteRole 후보를 확인하라. |
| `get_database_records` | `collection: actors\|classes\|skills\|items\|equipment\|enemies\|troops\|states\|battleAnimations\|switches\|variables\|commonEvents\|quests\|maps` | 컬렉션의 {id, name} 목록을 반환한다. 레코드를 참조/수정하기 전에 실제 id를 확인하는 용도. collection: actors/classes/skills/items/equipment/enemies/troops/states/battleAnimations/switches/variables/commonEvents/quests/maps. |
| `run_lint` | `reachability?: array` | projectLint, 세계관 lint, 타일셋 팔레트 lint를 실행해 무결성 issue 목록(error/warning/info)을 반환한다. |
| `check_reachability` | `mapId: string`, `from: object`, `targets: array` | 지정 맵에서 from 지점으로부터 targets 각각에 인접 도달 가능한지 검사한다. |
| `list_project_commits` | `limit?: integer` | Supabase project_commits의 최근 변경 이력을 반환한다. 브라우저 PostgREST 연결에서만 지원된다. |
| `get_tile_info` | `tileIds: array`, `tilesetId?: string` | 타일들의 의미(라벨/설명/태그)·시맨틱 그룹·배치 규칙(placementRules)·통행성·레이어를 조회한다. 타일을 깔기 전에 확인하는 용도. |
| `list_unclassified_tiles` | `tilesetId: string`, `limit?: integer`, `offset?: integer` | 타일셋에서 라벨이 없고 어떤 타일 그룹에도 속하지 않은 미분류 타일 인덱스를 페이지로 조회한다. 미분류 분석을 다음 배치로 이어갈 때 사용. |
| `analyze_map_tile_usage` | `mapId: string`, `includeDescribed?: boolean` | 사람이 깐 맵에서 사용된 타일 종류·사용량·설명 유무·대표 영역(sampleRegion)·인접 통계(mostCommonBelow/Above)를 추출한다. 맵 인터뷰의 시작점 — 설명 없는(described=false) 타일부터 질문하라. |
| `highlight_map_region` | `mapId: string`, `x: integer`, `y: integer`, `w: integer`, `h: integer` | 에디터 화면에서 맵 영역을 강조 표시한다. 사용자에게 타일 질문을 하기 직전에 호출해 어느 부분을 묻는지 보여줘라. |
| `show_tiles` | `tileIds: array`, `tilesetId?: string` | 타일 이미지를 채팅에 표시해 사용자가 눈으로 확인하게 한다. 타일에 대해 질문하거나 설명할 때 반드시 먼저 호출하라(번호만으로는 사용자가 어떤 타일인지 알 수 없다). |
| `show_tile_grid` | `mapId: string`, `x: integer`, `y: integer`, `w: integer`, `h: integer` | 맵 영역(최대 20×20)을 타일 그리드 이미지로 채팅에 표시한다. 구조물에 대해 질문/설명하기 전에 호출해 사용자가 영역 전체를 그림으로 보게 하라. |
| `render_group_sample` | `tilesetId: string`, `groupId?: string`, `role?: building\|castle\|fence\|roof\|terrain\|water\|wall\|prop`, `tileIds?: array`, `patternGrammar?: object`, `proposed?: object` | 타일 그룹/후보를 실제 배치 샘플 이미지로 렌더하기 위한 데이터를 만든다. 클러스터 수정 전에는 현재 샘플을, 수정 제안 전에는 전/후 샘플을 먼저 보여줘라. |
| `show_map_region` | `mapId: string`, `x: integer`, `y: integer`, `w: integer`, `h: integer` | 맵 영역을 하위/상위 타일 2D 배열로 반환하고 실제 타일 이미지로 보여준다. 맵에 뭔가 깐 뒤 말로 단정하지 말고 이 툴로 결과를 눈으로 확인하라. |
| `find_similar_tiles` | `tilesetId: string`, `tileId: integer`, `limit?: integer` | 기준 타일과 같이 쓰기 좋은 비슷한 타일 인덱스를 추천한다. 이미지 픽셀을 읽을 수 없는 환경에서는 시트 근접도, role/label, terrainTag, 그룹 정보를 결정적으로 점수화한다. |
| `suggest_group_from_range` | `tilesetId: string`, `rect?: object`, `tileIds?: array` | 시트 좌표 rect 또는 tileIds 범위를 읽어 새 타일 그룹의 kind/role/name/parts 초안을 휴리스틱으로 제안한다. 확정 전 render_group_sample로 미리보기를 보여줘라. |
| `list_terrain_templates` | `tilesetId?: string` | 타일셋의 지형 템플릿(구조물 지식뱅크) 목록을 반환한다. hasBuildPlan=true면 stamp_terrain_template로 바로 찍을 수 있고, 아니면 get_terrain_template의 grammar대로 조립한다. |
| `get_terrain_template` | `templateId: string`, `tilesetId?: string` | 지형 템플릿의 전체 지식(rows 사례/grammar 문법/rules 금기/buildPlan)을 타일 라벨 사전과 함께 반환한다. 구조물을 짓기 전에 반드시 읽어라. |
| `validate_structure` | `mapId: string`, `templateId: string`, `x: integer`, `y: integer`, `w: integer`, `h: integer` | 맵 영역의 구조물이 지형 템플릿 grammar를 지키는지 기계 검증한다(mustTouch 인접 제약·overlay 레이어·지붕 아래 벽). 조립으로 구조물을 지은 뒤 반드시 호출해 위반을 고쳐라. |
| `extract_terrain_template` | `mapId: string`, `x: integer`, `y: integer`, `w: integer`, `h: integer`, `name?: string` | 사람이 깐 맵 영역에서 지형 템플릿 초안(rows/grammar/mustTouch 추측 + guessSummary)을 추출한다. guessSummary를 사용자에게 먼저 보여주고 확인받은 뒤 upsert_terrain_template로 저장하라. |

