// editor/tools/toolAliases.ts
// find_tools 용어 별칭 사전. 순수 데이터 — 사용자·모델이 쓰는 말(한국어·영어·JRPG 용어)을 실제 도구 이름으로 잇는다.
//
// 왜 필요한가(2026-10-15 FF6 감사 #34): 한국어 형태소 분석 없이 설명 문장만 훑는 검색은
// 「마석」「시간문」「필드 적」 같은 말을 맞는 도구에 못 잇는다. 역할극 3판 중 find_tools 가 호출의 37~52% 였다.
// 이 사전은 (1) 질의에 낱말이 들면 해당 도구에 보너스를 주고 (2) 결과 이유에 「별칭 X → 도구」 를 적는다.
//
// 규칙: terms 는 소문자 부분 문자열(공백 포함 가능). 한 항목은 한 의도다. tools 는 가장 먼저 부를 도구부터 적는다.
// 이름이 레지스트리에 없으면 조용히 무시한다(전수 점검: scripts/qa/find-tools-replay.mts 가 없는 이름을 경고한다).

export interface ToolAlias {
  readonly terms: readonly string[];
  readonly tools: readonly string[];
  /** 결과 이유에 쓰는 한 줄. 생략하면 첫 term. */
  readonly label?: string;
}

export const TOOL_ALIASES: readonly ToolAlias[] = [
  // ── 인물·성장·장비 ──
  { terms: ["배우", "캐릭터 만들", "파티원", "동료 만들", "주인공 만들", "actor", "character record", "party member"], tools: ["upsert_actor", "upsert_class", "upsert_character_profile"], label: "배우" },
  { terms: ["직업", "클래스", "class", "job"], tools: ["upsert_class", "define_promotion"], label: "직업" },
  { terms: ["스킬", "기술", "마법", "주문", "필살기", "리미트", "연계기", "skill", "spell", "magic", "limit break", "ability"], tools: ["upsert_skill", "read_retro_skill_guide", "upsert_state"], label: "스킬" },
  { terms: ["장비", "무기", "방어구", "방패", "투구", "유물", "악세사리", "액세서리", "equipment", "weapon", "armor", "accessory", "relic"], tools: ["upsert_equipment", "upsert_item"], label: "장비" },
  { terms: ["마석", "에스퍼", "소환수", "소환", "esper", "summon", "materia", "magicite"], tools: ["upsert_equipment", "upsert_skill"], label: "마석·에스퍼(장비로 스킬 부여)" },
  { terms: ["장비 마법", "장착 마법", "장착하면 배", "착용 시 기술", "grantsskill", "grant skill", "equip learn", "장비 기술 부여", "equipment skill"], tools: ["upsert_equipment", "upsert_skill"], label: "장비가 스킬 부여" },
  { terms: ["상태이상", "버프", "디버프", "독 상태", "중독", "마비", "state", "status effect", "poison", "sleep"], tools: ["upsert_state"], label: "상태이상" },
  { terms: ["아이템", "도구", "소모품", "포션", "item", "potion", "consumable"], tools: ["upsert_item", "set_shop_stock", "set_sell_prices"], label: "아이템" },
  { terms: ["상점", "가게", "판매", "구매", "shop", "store stock", "vendor"], tools: ["set_shop_stock", "set_sell_prices", "configure_shop_presentation"], label: "상점" },
  { terms: ["승급", "전직", "promotion", "class change"], tools: ["define_promotion", "upsert_class"], label: "전직" },
  { terms: ["레벨업", "경험치", "성장", "능력치", "level up", "exp curve", "growth", "parameter"], tools: ["upsert_actor", "upsert_class", "tune_enemy"], label: "성장·능력치" },
  // ── 파티 ──
  { terms: ["파티", "party", "편성", "동료", "합류", "이탈", "companion", "recruit", "join", "changeparty", "recallparty", "storeparty"], tools: ["set_party", "add_companion", "configure_companion_rules"], label: "파티·동료" },
  { terms: ["파티 선택", "멤버 고르", "파티 편성 화면", "formation menu", "party select", "choose members"], tools: ["configure_companion_rules", "set_party", "configure_field_menu"], label: "파티 편성" },
  { terms: ["분할 파티", "파티 분할", "여러 팀", "split party", "multiple teams", "3팀", "세 팀"], tools: ["set_party", "configure_companion_rules", "run_scene_test"], label: "파티 분할" },
  // ── 적·전투 ──
  { terms: ["적군", "적 몬스터", "적 만들", "적 추가", "몬스터 만들", "몬스터 추가", "보스", "enemy", "monster", "boss"], tools: ["upsert_enemy", "upsert_troop", "author_boss_phases"], label: "적" },
  { terms: ["트룹", "적 구성", "전투 구성", "무리", "troop", "encounter group", "battle group"], tools: ["upsert_troop", "upsert_troop_battle_page"], label: "트룹" },
  { terms: ["전투 이벤트", "전투 페이지", "배틀 이벤트", "battle event", "battle page", "대사 전투 중", "페이즈 전환"], tools: ["upsert_troop_battle_page", "author_boss_phases"], label: "전투 이벤트 페이지" },
  { terms: ["보스 페이즈", "다단계 보스", "형태 변화", "boss phase", "phase"], tools: ["author_boss_phases", "upsert_troop_battle_page"], label: "보스 페이즈" },
  { terms: ["필드 적", "보이는 적", "심볼 인카운터", "심볼", "추격 적", "field enemy", "symbol encounter", "visible enemy", "chase"], tools: ["place_field_enemy", "make_chase_scene", "set_factions"], label: "필드 적" },
  { terms: ["랜덤 인카운터", "조우", "인카운터", "encounter", "random battle", "wild"], tools: ["set_encounter_table", "make_hunting_ground", "author_wild_route"], label: "랜덤 조우" },
  { terms: ["밸런스", "난이도", "시뮬레이션", "승률", "simulate", "balance", "difficulty"], tools: ["simulate_battle", "tune_enemy", "evaluate_game_quality"], label: "전투 시뮬" },
  { terms: ["전투 연출", "배틀 애니", "전투 애니메이션", "battle animation", "battle fx", "효과"], tools: ["upsert_battle_animation", "read_directing_guide", "list_fx_sheets"], label: "전투 연출" },
  { terms: ["액션 전투", "action combat", "realtime battle"], tools: ["set_action_combat", "make_action_enemy", "run_action_combat_test"], label: "액션 전투" },
  { terms: ["비전머신", "필드 기술", "필드 스킬", "hidden machine", "field skill", "절단", "괴력", "파도타기", "폭포 오르기", "플래시", "덩굴", "물길 열기", "배지가 있어야", "배지 필요", "비전서 상자"], tools: ["place_field_obstacle", "upsert_skill", "run_scene_test"], label: "필드 기술 장애물(비전머신)" },
  // ── 포켓몬식 몬스터 전투 깊이(2026-10-16 깊이 감사 #3): 검색하면 맞아 보이는 틀린 도구(날씨→일상 날씨 upsert_life_system, 조건부 볼→set_encounter_table)가 먼저 나오던 것을 바로잡는다 ──
  { terms: ["특성", "몬스터 특성", "종 특성", "포켓몬 특성", "species ability", "immunetype", "resisttype", "boostlowhp", "immunestatus", "contactstatus", "statmultiplier"], tools: ["define_monster_species", "define_monster_families"], label: "몬스터 특성(species.ability)" },
  { terms: ["맹독", "혼란", "독 걸", "독 피해", "독 데미지", "독상태", "badly poisoned", "toxic", "confusion", "volatilestatus", "gen1majorstatus", "화상 상태", "마비 상태", "수면 상태"], tools: ["upsert_state", "upsert_skill"], label: "몬스터 상태이상(독·맹독·혼란)" },
  { terms: ["지닌 물건", "지닌 도구", "지니게", "들려 주", "held item", "helditem", "heldeffect", "held effect", "hold item", "열매"], tools: ["upsert_item", "define_monster_species"], label: "지닌 물건(heldEffect)" },
  { terms: ["도감 등록 문장", "도감 등록 메시지", "도감 등록 대사", "새로 잡았을 때 문장", "처음 잡았을 때 문장", "dex register message", "dexregisteredtext"], tools: ["configure_monster_campaign", "read_game_systems"], label: "도감 등록 문장(system.monsterCampaign.dexRegisteredText, {name}=종 이름)" },
  { terms: ["부활약", "부활 아이템", "부활의 깃털", "기력의 조각", "revive", "상처약", "이상한 사탕", "경험 사탕", "레벨 사탕", "사탕", "rare candy", "진화의 돌", "진화석", "불꽃의 돌", "번개의 돌", "물의 돌", "잎의 돌", "달의 돌", "evolution stone", "에테르", "pp 회복", "pp회복", "가방 포켓", "가방", "bag pocket", "careprofile", "pprecovery"], tools: ["upsert_item", "define_monster_species", "set_shop_stock"], label: "몬스터 필드 아이템(부활약·PP 회복·이상한 사탕·진화의 돌·가방 포켓)" },
  { terms: ["벌레퇴치", "벌레 퇴치", "스프레이", "리펠", "repel", "repellent", "야생 안 나오", "조우 막", "조우 회피", "탈출 로프", "탈출 밧줄", "탈출 아이템", "동굴 탈출", "던전 탈출", "escape rope", "dig rope", "도망 뒤", "도망 후 무적", "도망치면 안 만나", "escapegrace", "repelsteps", "escapeto"], tools: ["upsert_item", "configure_monster_system", "read_monster_game"], label: "벌레퇴치·탈출 로프·도망 무적 걸음(upsert_item repelSteps/escapeTo · configure_monster_system escapeGraceSteps)" },
  { terms: ["조건부 볼", "조건부 포획", "그물볼", "그물 볼", "퀵볼", "퀵 볼", "타이머볼", "타이머 볼", "리피트볼", "리피트 볼", "포획볼", "포획 볼", "net ball", "quick ball", "timer ball", "repeat ball", "capture ball", "capture condition", "captureprofile", "ballclass"], tools: ["upsert_item", "run_scene_test"], label: "조건부 포획볼(captureProfile.condition)" },
  { terms: ["전투 날씨", "배틀 날씨", "몬스터 날씨", "포켓몬 날씨", "날씨 기술", "쾌청", "싸라기눈", "모래바람", "weather move", "battle weather", "sandstorm", "sunny day", "rain dance"], tools: ["upsert_skill", "define_monster_species", "simulate_battle"], label: "전투 날씨 기술(skill.weather)" },
  { terms: ["날씨", "weather"], tools: ["upsert_life_system", "upsert_skill"], label: "날씨(일상 날씨 · 몬스터 전투 날씨 기술은 upsert_skill.weather)" },
  { terms: ["낚시", "낚싯", "fishing", "fishing spot", "fishing rod", "낚싯대", "낚시꾼", "물가 조우", "낚시 몬스터", "낚아서 잡"], tools: ["configure_fishing", "upsert_tool_action", "upsert_item", "upsert_fish_species", "place_chest"], label: "낚시(몬스터 어획 speciesId · 낚싯대 upsert_tool_action fish)" },
  { terms: ["배지 문", "배지 게이트", "배지 N개", "배지 개 이상", "배지 필요", "챔피언로드", "문지기", "badge gate", "badge door", "victory road", "badgecount"], tools: ["place_badge_gate", "configure_monster_campaign"], label: "배지 게이트(배지 N개 이상 문지기)" },
  { terms: ["전투 막기", "길막", "장애물", "바위", "나무 베기", "blocker", "obstacle", "boulder", "rock"], tools: ["place_battle_blocker", "place_field_obstacle", "place_trap", "set_tile_passability"], label: "길 막는 장애물" },
  // ── 맵 ──
  { terms: ["새 맵", "맵 만들", "맵 생성", "맵 추가", "map create", "create map", "new map", "add map", "themescene", "테마 맵", "필드 맵", "필드 만들"], tools: ["create_map", "author_wild_route", "duplicate_map", "resize_map"], label: "맵 만들기(themeScene 으로 구성기까지 한 번에)" },
  { terms: ["마을 만들", "마을", "village", "town"], tools: ["author_beodeul_town", "compose_jp_city_street", "compose_snow_north_map"], label: "마을" },
  { terms: ["던전", "동굴", "지하", "미궁", "dungeon", "cave", "labyrinth"], tools: ["author_dungeon", "author_beodeul_dungeon", "configure_roguelike_room"], label: "던전" },
  { terms: ["실내", "방 만들", "집 안", "interior", "indoor", "room"], tools: ["build_hand_interior_room", "stamp_object"], label: "실내" },
  { terms: ["월드맵", "세계 지도", "세계지도", "대륙", "지형", "오버월드", "worldmap", "world map", "overworld", "continent"], tools: ["edit_world_terrain", "author_worldmap_structure", "read_world_terrain", "list_worldmap_themes"], label: "월드맵" },
  { terms: ["파멸 전후", "두 버전 월드", "before after world", "ruin world", "세계 변형", "세계 두 개", "두 세계", "world ruin"], tools: ["edit_world_terrain", "duplicate_map", "author_worldmap_structure"], label: "월드맵 두 버전" },
  { terms: ["이동", "문 연결", "맵 이동", "출입구", "transfer", "door link", "exit", "입구"], tools: ["create_transfer_pair", "link_maps", "upsert_event"], label: "맵 이동" },
  { terms: ["시작 위치", "시작 맵", "start position", "start map", "spawn"], tools: ["set_start_position", "set_session_start"], label: "시작 위치" },
  { terms: ["통행", "지나갈 수", "passability", "walkable", "reachab", "도달"], tools: ["check_reachability", "set_tile_passability"], label: "통행·도달성" },
  { terms: ["비행선", "비공정", "배 타", "배를", "탈것", "초코보", "뗏목", "airship", "vehicle", "ship", "boat", "mount"], tools: ["place_vehicle", "set_street_traffic", "set_map_transit"], label: "탈것" },
  { terms: ["자동차", "승용차", "차 다니", "차가 다니", "차량 흐름", "움직이는 차", "차 깔", "도로에 차", "회전하는 차", "교차로 회전", "경찰차", "택시", "기차", "지하철", "열차", "버스", "교통", "street traffic", "moving cars", "traffic", "train", "subway", "transit"], tools: ["set_street_traffic", "set_map_transit", "inspect_map_transit", "compose_modern_city_street"], label: "거리 주행 차량·교통(직진·교차로 90° 회전·버스·지하철)" },
  { terms: ["빈 맵", "텅 빈", "빈칸", "단색", "단색 잔디", "잔디 평지", "비어 있", "empty map", "blank", "flat grass", "채우기", "꾸미기", "decorate", "fill"], tools: ["check_map_emptiness", "create_map", "find_empty_ground", "furnish_outdoor_area", "place_props"], label: "맵 채우기" },
  { terms: ["눈 마을", "설원", "북방", "눈덮인", "snow village", "snow north", "눈 맵"], tools: ["compose_snow_north_map", "link_snow_north_interior"], label: "설원 테마" },
  { terms: ["사막", "오아시스", "바자르", "피라미드", "desert", "oasis", "bazaar"], tools: ["compose_desert_east_map", "compose_desert_east_room"], label: "사막 테마" },
  { terms: ["증기", "스팀펑크", "기계 도시", "제국 도시", "steampunk", "industrial city"], tools: ["compose_steampunk_city_map", "link_steampunk_interior"], label: "스팀펑크 테마" },
  { terms: ["천공", "하늘섬", "공중", "sky island", "floating island"], tools: ["compose_sky_island_map", "link_sky_island_interior"], label: "천공섬 테마" },
  { terms: ["해적", "섬 맵", "섬 마을", "pirate", "isles", "island"], tools: ["compose_pirate_isles_map"], label: "해적 섬 테마" },
  { terms: ["선사", "원시", "공룡", "prehistoric", "stone age"], tools: ["compose_prehistoric_map", "link_prehistoric_interior"], label: "선사 테마" },
  { terms: ["우주 정거장", "sf", "우주선", "sci-fi", "space station"], tools: ["compose_sf_station_map"], label: "SF 정거장 테마" },
  { terms: ["포스트 아포칼립스", "아포칼립스", "좀비 도시", "황무지", "폐허 마을", "wasteland", "post-apocalyptic"], tools: ["compose_wasteland_map"], label: "폐허·황무지 테마" },
  { terms: ["센고쿠", "에도", "전국시대", "sengoku", "edo", "samurai"], tools: ["compose_sengoku_edo_map", "link_sengoku_edo_interior"], label: "센고쿠 테마" },
  { terms: ["마을 종류", "시대 마을", "사이버펑크 마을", "조선 마을", "장터 마을", "중세 마을", "고대 도시", "미래 도시", "village type", "town type"], tools: ["find_village_type"], label: "마을 종류 표" },
  { terms: ["일본 거리", "상점가", "일본 지역", "온천 마을", "신사", "다랑논", "등산로", "jp city", "japanese street", "jp region"], tools: ["compose_jp_city_street", "compose_jp_region", "list_jp_regions", "build_jp_city_building"], label: "일본 거리·지역 30종" },
  { terms: ["신사 숲", "진수의 숲", "공원 숲", "일본 숲", "jp forest", "shrine forest", "park forest"], tools: ["paint_jp_forest"], label: "일본 숲(나무 composer)" },
  { terms: ["현대 거리", "도시 거리", "modern city", "modern street"], tools: ["compose_modern_city_street", "link_modern_city_interior"], label: "현대 거리" },
  { terms: ["캠퍼스", "학교", "campus", "school"], tools: ["compose_campus_grounds", "link_campus_interior", "build_wizarding_space"], label: "캠퍼스" },
  { terms: ["마법학교", "호그와트", "wizarding", "hogwarts", "magic school"], tools: ["build_wizarding_space", "list_wizarding_spaces"], label: "마법 학교" },
  { terms: ["고딕", "저택", "묘지", "gothic", "manor", "graveyard"], tools: ["build_gothic_place", "list_gothic_places"], label: "고딕" },
  // ── 이벤트·연출·플래그 ──
  { terms: ["없는 기물", "없는 소품", "없는 가구", "기물 그리", "소품 그리", "가구 그리", "새로 그려", "그려 넣", "missing prop", "missing object", "draw a prop", "object-gen", "object gen"], tools: ["generate_missing_object", "list_spatial_designs", "list_hand_interior_parts"], label: "없는 기물 그리기(먼저 찾기)" },
  { terms: ["조수 스킬", "교훈", "장면 다듬기", "장면 검수", "assistant skill", "scene polish", "lesson"], tools: ["read_assistant_skill", "list_assistant_skills"], label: "조수 스킬" },
  { terms: ["컷신", "연출", "장면", "cutscene", "scene"], tools: ["script_cutscene", "script_cutscene_staged", "read_directing_guide", "preview_cutscene"], label: "컷신" },
  { terms: ["오프닝", "타이틀", "opening", "title screen", "intro"], tools: ["set_opening", "plan_opening", "generate_title_art", "set_title_screen"], label: "오프닝·타이틀" },
  { terms: ["엔딩", "결말", "ending", "credits"], tools: ["define_ending", "list_endings", "script_cutscene"], label: "엔딩" },
  { terms: ["이벤트", "event"], tools: ["upsert_event", "patch_event_page", "event_command_assist", "place_npc"], label: "이벤트" },
  { terms: ["npc", "주민", "마을 사람", "villager", "대화"], tools: ["place_npc", "make_villager", "author_npc_cast"], label: "NPC" },
  { terms: ["스위치", "변수", "플래그", "story flag", "flag", "switch", "variable"], tools: ["declare_story_flag", "find_flag_usage", "rename_switch", "rename_variable"], label: "스위치·변수·플래그" },
  { terms: ["퀘스트", "의뢰", "quest"], tools: ["define_quest", "create_quest", "verify_quest"], label: "퀘스트" },
  { terms: ["배지", "뱃지", "휘장", "배지 획득", "배지 연출", "관장 승리", "badge", "badge ceremony", "gym badge"], tools: ["configure_monster_campaign", "read_monster_game"], label: "배지(체육관 승리 연출·아이콘)" },
  { terms: ["시간문", "시간 여행", "과거로", "time gate", "time travel", "time portal"], tools: ["create_time_gate", "create_transfer_pair"], label: "시간문" },
  { terms: ["세이브", "저장 지점", "savepoint", "save point"], tools: ["place_savepoint"], label: "세이브 포인트" },
  { terms: ["센터", "포켓몬 센터", "몬스터 센터", "회복 센터", "간호사", "병원", "pokemon center", "monster center", "nurse", "heal center"], tools: ["place_monster_center", "place_savepoint"], label: "몬스터 센터(회복 연출)" },
  { terms: ["보물상자", "상자", "chest", "treasure"], tools: ["place_chest", "place_storage_chest"], label: "상자" },
  { terms: ["함정", "trap", "spike"], tools: ["place_trap"], label: "함정" },
  { terms: ["공통 이벤트", "common event", "field skill", "필드 스킬", "필드 기술", "field ability"], tools: ["upsert_common_event", "upsert_skill", "upsert_event"], label: "공통 이벤트·필드 스킬" },
  // ── 시스템·검사·기타 ──
  { terms: ["검사", "점검", "린트", "lint", "validate", "check"], tools: ["run_lint", "check_reachability", "evaluate_game_quality", "check_export_readiness"], label: "검사" },
  { terms: ["플레이 테스트", "시험 플레이", "walkthrough", "playtest", "scene test", "장면 시험", "자동 플레이"], tools: ["run_scene_test", "play_walkthrough", "generate_walkthrough"], label: "플레이 시험" },
  { terms: ["bgm", "음악", "브금", "작곡", "music", "soundtrack"], tools: ["generate_original_bgm", "recommend_bgm", "get_soundtrack", "set_game_audio"], label: "음악" },
  { terms: ["효과음", "se", "sound effect", "sfx"], tools: ["generate_original_se", "list_resources"], label: "효과음" },
  { terms: ["세계관", "설정", "world canon", "lore", "worldbuilding"], tools: ["set_world_canon", "upsert_character_profile", "plan_world"], label: "세계관" },
  { terms: ["시작 아이템", "시작 골드", "초기 자금", "starting gold", "starting items"], tools: ["set_session_start"], label: "시작 소지품" },
  { terms: ["이미지 생성", "그림 생성", "일러스트", "generate image", "illustration"], tools: ["generate_image_asset", "generate_cutscene_art"], label: "이미지 생성" },
  { terms: ["파노라마", "맵 배경", "배경 하늘", "창밖", "시차 배경", "panorama", "parallax background", "map background"], tools: ["set_map_properties", "generate_map_background"], label: "맵 배경(파노라마)" },
  { terms: ["보관함", "pc", "컴퓨터", "상자", "box", "storage", "파티 가득", "맡기기", "놓아주기"], tools: ["place_monster_pc", "configure_monster_system", "read_monster_game"], label: "몬스터 보관함(PC)" },
  { terms: ["되돌리", "undo", "revert", "롤백"], tools: ["revert_last_edit", "list_edit_history"], label: "되돌리기" },
  { terms: ["도감", "pokedex", "dex", "몬스터 도감", "생태 설명", "dex note"], tools: ["define_monster_species", "define_monster_families", "read_monster_game"], label: "몬스터 도감" },
  { terms: ["게임 시스템", "메뉴 구성", "game systems", "menu"], tools: ["read_game_systems", "configure_game_systems", "configure_field_menu"], label: "게임 시스템" },
  { terms: ["갤러리", "CG", "엔딩 목록", "엔딩 회상", "엔딩 체크", "세이브 카드", "저장 칸", "저장 썸네일", "gallery", "ending list", "ending checklist", "save slot", "save card"], tools: ["set_vn_extras", "configure_field_menu", "read_game_systems"], label: "미연시 추가 화면(갤러리·엔딩 목록·세이브 카드)" },
  { terms: ["대사창 스킨", "대사창 룩", "대사창 스타일", "대사창을", "창 느낌", "느낌 창", "파스텔", "카드형", "말풍선", "이름표", "텍스트 크게", "글자 크게", "글씨 크게", "글자 크기", "줄 간격", "자간", "대기 표시", "dialogue skin", "dialogue style", "window style", "name plate", "nameplate", "font size", "text size", "pastel", "nvl"], tools: ["set_vn_look", "set_dialogue_system", "read_game_systems"], label: "미연시 대사창 룩(프리셋·이름표·글자 크기)" },
  { terms: ["백로그", "오토", "스킵", "대사 기록", "대사창 숨기", "읽은 글", "미연시", "비주얼노벨", "backlog", "auto mode", "skip mode", "hide window", "text log", "visual novel"], tools: ["set_dialogue_system", "configure_field_menu", "read_game_systems"], label: "대사창 읽기 보조(백로그·오토·스킵)" },
];

/** 질의(소문자)에 별칭 항목의 낱말이 하나라도 부분 문자열로 들어 있는지. 짧은 영어 낱말(2자 이하)은 낱말 경계로만 본다. */
export function aliasTermHit(queryLower: string, term: string): boolean {
  if (term.length <= 2 && /^[a-z0-9]+$/u.test(term)) {
    return new RegExp(`(^|[^a-z0-9])${term}($|[^a-z0-9])`, "u").test(queryLower);
  }
  return queryLower.includes(term);
}
