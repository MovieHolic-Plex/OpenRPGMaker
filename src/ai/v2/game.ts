// 조수 v2 «게임 요소» — 퀘스트·아이템·상점·전투·파티·스위치처럼 맵이 아닌 요청.
//
// 왜(2026-10-23 게임 요소 비교 40): v2 동사(make_place·add_people·add_event·add_scene)는 장소·사람·연출만 다뤄서
// 「심부름 퀘스트」「새 무기를 상점에서」「보스 전투 뒤 감사」를 옮길 길이 없었다. 이 층은 이미 검증된 v1 결정론 도구를
// 그대로 내놓는다(스키마·검증·저장 계약이 v1 과 같다). 요청에 게임 낱말이 있을 때만 싣는다 — 맵 요청의 첫 턴을 무겁게 하지 않는다.
import { createPiToolset, type PiToolShape } from "@/ai/piAgent/toolAdapter";
import { getTool } from "@/editor/tools/toolRegistry";
import type { PiAssistantV2Env } from "./env";

export const GAME_WORDS = /퀘스트|의뢰|심부름|부탁|아이템|회복약|포션|무기|갑옷|방패|장비|장신구|상점|가게|팔게|팔기|열쇠|잠긴|보물|상자|제작|만들어 주는|주인공|이름|직업|레벨|능력치|체력|동료|파티|합류|떠나|스킬|기술|전투|싸우|보스|적\b|몬스터|무리|선택지|호감|기억|스위치|변수|횟수|레버|여관|묵으|저장|회복|치료|신부|골드|돈|엔딩|결말|게임|일지|제한 시간|타이머|낮에|밤에|시간대|아침|저녁|팻말|표지판|우물|동전|암호|비밀번호|통행료|경비|문지기|함정|독|중독|마비|수면|상태 ?이상|날씨|비가|비 ?오|무작위|랜덤|인카운터|조우|마주치|늑대|멧돼지|슬라임|고블린|얻게|얻는|얻을|모으|모았|모아|줍|주워|개수|몇 개|조사하면|조사할|입력|자물쇠|숫자|비밀번호|옮겨|옮기|묘비|회상|따라오|따라와|따라다|도망|사라지|나타나|말 걸|말을 걸|대사|다가가|밟으면|들어가면|문을|잇|이어 줘|이어줘|연결|follow|random|encounter|지진|흔들|번쩍|번개|음악|배경음|bgm|약초|광맥|이동석|눈이|눈 ?내|폭풍|안개|quest|item|shop|weapon|armor|battle|enemy|party|skill|inn|save|gold|ending|poison|weather/iu;

/** v1 도구 중 게임 요소에 쓰는 것(읽기 먼저). 레지스트리에 없는 이름은 빠진다. */
export const V2_GAME_TOOLS: readonly string[] = [
  "get_database_records", "find_events", "get_event", "get_story_state", "find_switch_usage",
  "create_quest",
  "upsert_item", "upsert_equipment", "set_shop_stock", "set_sell_prices", "place_chest", "upsert_craft_recipe",
  "upsert_actor", "upsert_class", "upsert_skill", "set_party", "add_companion",
  "upsert_enemy", "upsert_troop", "upsert_troop_battle_page", "set_encounter_table",
  "find_empty_ground", "place_npc", "upsert_event", "patch_event_page", "run_scene_test", "upsert_common_event", "set_npc_schedule", "configure_time_system", "place_savepoint", "set_start_position",
  // 2026-10-24 새 12 사례 비교: v1 이 쓰고 v2 에 없던 것 — 칩 고르기(없으면 그림 관문이 막는다)·이야기 깃발·엔딩·필드 적·이벤트 옮기기/지우기·문 잇기·날씨.
  "list_npc_graphics", "list_resources", "read_npc_layout", "declare_story_flag", "list_endings", "define_ending", "place_field_enemy",
  "move_event", "remove_event", "create_transfer_pair", "set_scene_mood",
];

export const GAME_CARD = `[게임 요소 — 퀘스트·아이템·상점·전투·파티·스위치] 이 요청에는 v1 게임 도구를 그대로 쓴다(장소·연출은 위 동사).
- 순서: 1) 읽기 — get_database_records(있는 아이템·적·배우), find_events(이 맵의 NPC·이벤트 id) → 2) 데이터 — upsert_item/upsert_equipment/upsert_skill/upsert_enemy/upsert_troop/upsert_actor/upsert_class → 3) 붙이기 — place_npc/upsert_event(페이지·조건·명령), set_shop_stock, place_chest, set_encounter_table, create_quest → 4) get_event 로 다시 읽어 조건·명령이 맞는지 확인.
- 새 NPC 는 add_people 로 자리 낱말을 줘서 세운 뒤, 돌려받은 이벤트 id 에 upsert_event 로 페이지·조건·명령을 단다. 좌표가 꼭 필요하면(상자·레버) find_empty_ground 로 빈 칸을 받아 쓴다 — 지어내지 않는다.
- 이미 있는 NPC(촌장 등)를 고칠 때는 새로 세우지 말고 그 이벤트 id 로 upsert_event 한다. 기존 대사는 요청이 바꾸라 하지 않으면 남긴다.
- 상태가 바뀌는 대화(의뢰→진행→완료, 선택 기억)는 페이지마다 조건(스위치·변수·셀프 스위치)을 다르게 둔다. 보상·아이템 증감·골드·파티 변경은 명령으로 넣는다.
- 요청에 숫자(회복량·공격력·가격)가 있으면 그 값을 그대로 쓴다. 아이템에 효과 기술(skillId)을 따로 이으면 그 기술의 위력도 같은 값·분산 0 으로 맞춘다(어긋나면 실제 회복량이 요청과 달라진다).
- 호감·신뢰·평판처럼 «쌓이는» 값은 변수로 두고 대화·선물마다 증감 명령을 넣고, 바뀌는 대사 페이지는 그 변수 조건(≥ 문턱)으로 고른다 — 대화 횟수 셀프 스위치로 대신하면 호감이 장식이 된다.
- 한 번만 일어나야 하는 것(보상·상자·합류)은 셀프 스위치나 스위치로 다시 안 일어나게 막는다.
- 시간대(낮·밤)에 따라 NPC 자리·대사가 바뀌면 configure_time_system(시간 켜기) → set_npc_schedule(시간표)·페이지 조건을 쓴다(집 안이 없으면 make_place 로 실내를 짓고 문을 잇는다). 할 수 없으면 묻기 전에 가장 가까운 동작 판을 먼저 만들고 보고에 적는다.
- 이름 바꾸기: upsert_actor 에는 id·name 만 보낸다(능력치는 그대로 남는다). 요청이 «대사에서도 부르게» 같으면 find_events 로 그 인물을 부르는 NPC 를 찾아 patch_event_page 로 그 줄만 고친다 — 다른 대사는 남긴다. 지목한 대사에 이름이 아직 없으면 그 인물이 새 이름으로 주인공을 부르게 그 줄에 넣는다(「어서 오게, 아린. …」) — 요청의 뜻은 대사에서 새 이름이 들리는 것이다.
- 시작 장비를 바꾸면 그 장비가 주인공 직업의 장비 허용(class equipmentPermissions)에 들었는지 확인하고 없으면 upsert_class 로 넣는다. 기존보다 약한 장비로 바꾸지 말 것(요청이 없으면).
- 상점은 set_shop_stock 으로 단다(되팔기가 켜진다). upsert_event 로 shop 명령을 직접 쓰면 allowSell:true 를 꼭 넣는다(빠지면 팔기 메뉴가 없다). 되팔기 비율(예: 70%)은 set_sell_prices 가 품목별 표라서, 그 상점 물건만이 아니라 플레이어가 흔히 가진 소모품·장비까지 넓게 채운다.
- 대사는 그 인물의 입말로 쓴다 — 퀘스트 요약문(「~를 찾아 소식을 전해 주자」)을 NPC 대사로 쓰지 않는다. 주인공 독백·내레이션은 말하는 사람 이름 없이.
- 타이머·시간 제한: 페이지 조건 timer 는 {timerId:"timer1"|"timer2", seconds, op?} — op 를 빼면 «남은 시간 ≤ 초»(">" 등도 된다, 다른 timerId 는 안 된다). 시작 = timer set(초)+start(timer1)+시작 스위치, 성공 = 물건·스위치 조건 페이지에서 timer stop, 실패 = 남은 시간 ≤0 페이지(가장 높은 번호).
- 다 만든 뒤 run_scene_test 로 핵심 경로를 한 번 돌려 본다(말 걸기 interact·choose → expect switchOn/inventoryCount/goldDelta 등). 실패하면 patch_event_page 로 고치고 다시. 통과한 것만 「됐다」고 보고한다.
- 사람 그림: 새 NPC·새 페이지·배우 그림은 list_npc_graphics(query:외형)로 후보 그림을 보고 그 selectionId 를 쓴다(칸 번호를 지어내면 그림 관문이 거절한다). 이미 있는 NPC 의 페이지를 더할 때는 그 NPC 의 기존 graphic 을 그대로 복사한다. 늑대·박쥐처럼 짐승·적은 list_npc_graphics 에 없으면 place_field_enemy(필드 적) 또는 그림 없는 밟기 이벤트로 — 같은 검색어로 되풀이하지 않는다.
- 플래그: 새 스위치·변수는 declare_story_flag(이름·뜻)로 먼저 선언하고, 켠 스위치는 반드시 어떤 페이지 조건이나 분기가 읽게 한다(켜기만 하고 안 읽는 깃발 = 「이미 했다」 페이지가 빠졌다는 뜻). 선언만 하고 안 쓰는 깃발은 만들지 않는다.
- 한 번만 통과·한 번만 주는 관문(암호·통행료·보상·열쇠)은 «이미 통과/이미 받음» 페이지를 꼭 둔다: 통과 스위치(또는 셀프 스위치) 조건의 더 높은 번호 페이지에 짧은 대사(「지나가게」)와 통과 동작만.
- 물건 보여 주기·내기(presentItem·아이템 고르기)는 그 물건을 가졌을 때만 뜨게 한다: 그 페이지 조건에 {kind:'item',itemId,present:true}(또는 fork 로 감싸기) — 물건이 없을 때는 평소 대사 페이지가 나와야 한다.
- 상태 이상(독·마비·수면…): 화면 효과·소리만으로 흉내 내지 말고 실제 상태를 건다 — {kind:'m2Command',commandId:'m2-019-change-state',fields:{target:'party'(또는 배우 id),operation:'add',value:'state_poison'}}. 상태 id 는 get_database_records(states)로 확인. 효과음·번쩍임은 그 위에 덧붙인다.
- 날씨(비·눈·폭풍·안개): 실제 날씨 명령 {kind:'setWeather',weather:'rain'|'storm'|'snow'|'fog'|'none',intensity:0~1} 을 쓴다(또는 add_event 의 weather 비트, 맵 전체 기본 날씨는 set_scene_mood). tint(화면 색)는 날씨가 아니다.
- 흔들림·지진은 add_event 의 shake 비트(또는 m2Command m2-048-shake-screen), 번쩍·번개는 flash 비트(m2-047-flash-screen), 음악 바꾸기는 music 비트({do:'music',action:'bgm',query:'festival'} 또는 {kind:'playAudio',resourceId,loop:true}) — 카메라 이동·페이드로 흉내 내지 않는다.
- 플레이어가 «조사하는» 물건(비석·이동석·분수·약초 자리·광맥·표지판·덤불)은 눈에 보여야 한다: list_spatial_designs{kind:'object',query:'비석'|'돌'|'분수'|'나무'|'덤불'} 로 물건 id 를 찾아 stamp_object{mapId,objectId,x,y} 로 그 칸(또는 바로 위 칸)에 찍고, 이벤트는 그 물건 칸 앞에 둔다. 이미 있는 물건 칸을 써도 된다. 투명 이벤트를 맨땅에 두지 않는다(숨기라는 요청만 예외).
- 꼭 맞는 그림이 없는 물건(사과나무·묘비·상자 더미)은 draw_object 카드만 남기고 멈추지 않는다: 가장 비슷한 기존 물건(나무·돌·표지판) 칸 위에 조사 이벤트를 두고 아이템·대사·스위치는 그대로 만든다. 그림이 대체물이면 보고에 적는다.
- 숫자 자물쇠·암호 입력은 {kind:'inputNumber',variableId,digits:4} 로 변수에 받고 fork 조건 {kind:'variable',variableId,op:'==',value:1024} 으로 연다(조건의 kind 는 'variable' — 'var' 는 setVariable 의 피연산자 {kind:'var',id} 에만 쓴다). 자물쇠가 달린 창고·문이 없으면 그 건물·문을 먼저 만든다(add_event·create_transfer_pair).
- 새 맵(실내·필드)을 만들면 반드시 들어가는 길을 단다: 집 문 칸 ↔ 실내 입구는 create_transfer_pair, 마을 가장자리 ↔ 필드도 create_transfer_pair. 무작위로 나오는 적은 set_encounter_table(보이는 적 이벤트가 아니다).
- 한 번만 주는 보상·동료(addFollower)·회상은 셀프 스위치를 켜고 그 조건의 「이미 했다」 페이지를 둔다. 머리 위 「!」 같은 감정은 add_event 의 emote 비트(대사로 쓰지 않는다).
- 난수(확률 70%·무작위 보상) 명령은 엔진에 없다(setVariable 의 value 는 숫자나 {kind:'var',id} 뿐) — 여러 번 시도하지 말고, 순서로 돌아가는 결과(예: 세 번에 한 번 실패)로 대신하고 보고에 «확률 대신 순서»라고 적는다.
- 이미 있는 NPC 는 add_people 로 다시 세우지 않는다(같은 이름이면 함수가 그 NPC 를 그대로 쓴다) — 그 그림·얼굴·자리는 바꾸지 않는다.
- 엔딩·결말: list_endings 로 보고 define_ending(id·name·epilogue)으로 엔딩을 정의한 뒤 선택지 갈래에 {kind:'triggerEnding',endingId} 를 넣는다. 내레이션 + returnToTitle 만으로 엔딩을 흉내 내지 않는다. «마지막에» 묻는 선택이면 그 앞 조건(보스 처치·완료 스위치)을 페이지 조건으로 건다.
- 요청이 가리키는 자리(다리 앞·강가·우물 옆…)가 맵에 없으면 묻지 않는다: 그 물건·지형을 만들어(stamp_object·fill_region 덧그리기, 없으면 가장 그럴듯한 길목) 짓고 보고에 「~가 없어 ~에 만들었다」고 쓴다.
- 도구가 거절하면 이유를 읽고 고쳐 다시 부른다. 같은 거절이 두 번이면 방법을 바꾼다. 할 수 없는 것은 보고에 적는다.`;

export function wantsGameTools(task: string): boolean {
  return GAME_WORDS.test(task);
}

/** 이미 있는 맵에 물길·다리·작은 물건을 덧그리는 요청(맵을 새로 짓지 않는다) — v1 결정론 덧그리기 도구 셋. */
export const TERRAIN_WORDS = /다리\s*(를|가|위|에|앞|옆|건너|밑|아래|목)|돌다리|나무다리|강을|강이|강물|강 상류|강 하류|개울|냇물|시냇|연못을|물길|폭포|레버|팻말|표지판|간판|bridge|lever|signpost/iu;
export const V2_TERRAIN_TOOLS: readonly string[] = ["list_spatial_designs", "stamp_object", "fill_region"];
export const TERRAIN_CARD = `[이미 있는 맵에 덧그리기 — 물길·다리·작은 물건] 맵을 새로 짓지 않고 고칠 때(이미 지은 마을에 강·다리·레버·팻말).
- 물: fill_region{mapId, material, rect:{x,y,w,h}, shape?:'ellipse', referencePurpose} — 버들항 칩셋(beodeul_city)은 material:'버들항 물'(그냥 '물'은 물 준 밭흙이 된다)·referencePurpose:'beodeul-city-water'. 굽은 강은 rect 여러 개. 집·완성 구역은 피하고, 길이 물을 건너는 자리를 남겨 다리를 놓는다.
- 물건: list_spatial_designs{kind:'object', query} 로 id 를 찾아 stamp_object{mapId, objectId:'kit:…', x, y}. 버들항에서 자주 쓰는 것: 다리 'kit:beodeul_city/bd-bridge-arch', 표지판 'kit:beodeul_city/bd-out-signpost',
  바닥에 세우는 레버 'kit:shared_hand_interior_harness/shared_hand-interior:floor lever'(벽 레버 'wall lever'·던전 레버는 벽 앞면에만 걸린다). 찾아도 없을 때만 draw_object. 묻기 전에 먼저 놓아 본다.
- 이벤트(조사·밟기)는 그 물건 칸에 둔다(좌표는 방금 놓은 x,y). 다 놓은 뒤 inspect 로 1배 그림을 본다.`;
export function wantsTerrainTools(task: string): boolean {
  return TERRAIN_WORDS.test(task);
}

/** 게임 도구 묶음 — 실행 기록은 v1 경로와 같은 onCall(env.record)로 남는다. */
export function createGameTools(env: PiAssistantV2Env, task = ""): PiToolShape[] {
  // 게임 요청도 «조사하는 물건»(비석·이동석·분수)을 보이게 찍어야 해서 물건 찾기·찍기를 같이 준다(2026-10-24: 투명 이벤트가 맨땅에 남았다).
  const want = [...(wantsGameTools(task) ? [...V2_GAME_TOOLS, "list_spatial_designs", "stamp_object"] : []), ...(wantsTerrainTools(task) ? V2_TERRAIN_TOOLS : [])];
  const names = [...new Set(want)].filter((name) => getTool(name));
  return createPiToolset(env.ctx, { ...(env.toolsetOptions ?? {}), toolNames: names, onCall: env.record });
}
