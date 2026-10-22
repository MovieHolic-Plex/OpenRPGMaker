// project/genreLock.ts
// 장르 잠금(2026-10-15) — 프로젝트 단위로 「이 게임은 이 장르의 칩셋 계열만 새로 쓴다」를 강제한다.
// 옵트인이다: `system.genreLock` 이 없으면 아무 동작도 바뀌지 않고 저장 바이트도 그대로다.
// 판정 함수는 여기 하나(`genreLockMapViolation` / `genreLockAllowsTileset`)이고, 실행기(toolRunner)·도구 노출·검사 도구·DB 화면이 같은 것을 쓴다.
// 강제 대상은 조수·도구 경로(ToolContext.assistantRun)뿐이다 — 사용자가 편집기에서 손으로 칠하는 것은 막지 않고 경고만 한다.
// 장르별 허용 계열은 아래 표(데이터)에 둔다. monster-collect(2026-10-15)에 이어 romance(2026-10-16, 현대 학교·도시 무대의 연애 게임)가 같은 구조로 켠다.
// 캐릭터 칩 잠금(2026-10-16): 프리셋 표의 `charsets` 가 있으면 같은 잠금이 캐릭터 칩(플레이어·NPC·트레이너·이벤트 그림)도 허용 계열로 묶는다 —
// 맵 칩셋과 같은 구조(허용 목록은 켤 때 표에서 복사, 정본은 프로젝트). `charsets` 가 없는 프리셋(연애)은 캐릭터를 건드리지 않는다.
// 판정 함수는 여기(`genreLockAllowsCharset`), 실행기 거부·대안 안내는 genreLockCharsets.ts 가 맡는다.
// 얼굴·전투 그림 잠금(2026-10-16): 프리셋 표의 `visuals` 가 있으면 같은 잠금이 얼굴·흉상·전신(faceset)과 전투 그림(몬스터 앞·뒷모습·트레이너 전투 그림·전투 배경·전투 화면 스킨)도
// 허용 계열로 묶는다 — 허용 목록은 켤 때 표에서 복사(정본은 프로젝트). 계열 분류는 visualFamily.ts, 판정·거부·대안·생성 대기 안내는 genreLockVisuals.ts 가 맡는다.

import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { CHARSET_FAMILY_LABELS, charsetFamilyOf, type CharsetFamilyId } from "./charsetFamily";
import { battlerSourceChip, collectCharsetUses, type CharsetUse } from "./genreLockCharsetUses";
import { tilesetFamily, tilesetFamilyLabel } from "./tilesetFamily";
import type { BackdropFamilyId, BattlerFamilyId, FaceFamilyId, TrainerArtFamilyId } from "./visualFamily";
import type { GameMap, Project } from "./types";

export type GenreLockPresetId = "monster-collect" | "romance";
export type GenreLockMode = "enforce" | "warn";

/** `system.genreLock` — 저장 형태. */
export interface GenreLock {
  readonly preset: GenreLockPresetId;
  /** enforce = 조수·도구가 허용 밖 칩셋으로 맵을 만들거나 바꾸면 거부. warn = 막지 않고 경고만. */
  readonly mode: GenreLockMode;
  /** 켤 때 표에서 복사한 허용 계열. 이 목록이 정본이다(표가 나중에 바뀌어도 이미 켠 프로젝트는 그대로). */
  readonly allowedFamilies: readonly string[];
  /**
   * 켤 때 표에서 복사한 허용 캐릭터 칩 계열(charsetFamily.ts). 없으면(2026-10-16 이전에 켠 잠금) 프리셋 표의 값을 따른다 —
   * 표에 `charsets` 가 없는 프리셋은 캐릭터를 잠그지 않는다. 이미 그려진 그림은 건드리지 않고 조수가 새로 고르는 그림만 막는다.
   */
  readonly allowedCharsetFamilies?: readonly string[];
  /**
   * 켤 때 표에서 복사한 허용 얼굴·흉상·전신 계열(visualFamily.ts FaceFamilyId). 없으면(2026-10-16 이전에 켠 잠금) 프리셋 표의 값을 따른다 —
   * 표에 `visuals` 가 없는 프리셋은 얼굴을 잠그지 않는다. 이미 그려진 얼굴은 건드리지 않고 조수가 새로 고르는 그림만 막는다.
   */
  readonly allowedFaceFamilies?: readonly string[];
  /**
   * 켤 때 표에서 복사한 허용 전투 그림 계열. 한 목록에 접두사로 갈라 담는다 —
   * `battler:<계열>`(몬스터 전투 그림) · `trainer:<계열>`(트레이너 전투 그림) · `backdrop:<계열>`(전투 배경) · `skin:<id>`(전투 화면 스킨).
   * 없으면 프리셋 표의 값을 따른다(`visuals` 가 없는 프리셋은 전투 그림을 잠그지 않는다).
   */
  readonly allowedBattleFamilies?: readonly string[];
  /** 켤 때 이미 허용 밖 칩셋이던 맵 id — 「잠금 이전부터 있던」 맵으로 따로 보고한다(막지 않는다). */
  readonly grandfatheredMapIds?: readonly string[];
  /**
   * 켤 때 이미 허용 밖 캐릭터 칩을 쓰던 사용처 경로(collectCharsetUses 의 키) — 「잠금 이전부터 있던 칩」으로 따로 보고한다(막지 않는다, 2026-10-16 잠금 누수 감사 #3).
   * 조수 경로에서는 genreLockCharsets.settleCharsetsOnLock 이 손대지 않은 기본 명단 배우를 먼저 허용 칩으로 바꾸고 남은 것만 남긴다.
   */
  readonly grandfatheredCharsetPaths?: readonly string[];
}

interface Alternative {
  /** 시도한 칩셋 id·이름·도구 이름·맵 이름을 이어 붙인 글에 맞춰 본다. */
  readonly pattern: RegExp;
  readonly tilesetId: string;
  readonly use: string;
}

/** 장르가 캐릭터 칩(걷기 그림)도 잠글 때의 표. */
interface GenreLockCharsetDef {
  /** 허용 캐릭터 칩 계열. */
  readonly families: readonly CharsetFamilyId[];
  /** 안내 문장에 쓰는 이름. */
  readonly kitNoun: string;
  /** 손대지 않은 기본 주인공에게 입히는 걷기 그림(켤 때 한 번). 허용 계열 안의 번들 칩이어야 한다. */
  readonly playerDefault: { readonly resourceId: string; readonly characterIndex: number };
  /** 조수 안내 문장(사람·몬스터 칩이 어디 있는지). */
  readonly promptLine: string;
  /** 잠금이 강제 중일 때만 붙는 문장(거부·목록 필터). */
  readonly enforceLine: string;
}

/** 얼굴·전투 그림 잠금 표(2026-10-16). 프리셋 표에 `visuals` 가 없으면 이 장르는 얼굴·전투 그림을 잠그지 않는다. */
export interface GenreLockVisualDef {
  /** 허용 얼굴·흉상·전신 계열. */
  readonly faces: readonly FaceFamilyId[];
  /** 허용 몬스터 전투 그림 계열(적·종의 앞모습·뒷모습). */
  readonly battlers: readonly BattlerFamilyId[];
  /** 허용 트레이너 전투 그림 계열(`TroopRecord.trainerSprite`). */
  readonly trainerArt: readonly TrainerArtFamilyId[];
  /** 허용 전투 배경 계열(적 그룹·지형·맵). */
  readonly backdrops: readonly BackdropFamilyId[];
  /** 허용 전투 화면 스킨 id(`system.battleUiStyle`). 이미 있는 값은 건드리지 않고 허용 밖으로 **바꾸는** 것만 막는다. */
  readonly skins: readonly string[];
  /** 안내 문장에 쓰는 이름. */
  readonly kitNoun: string;
  /** 조수 안내 문장 — 얼굴·흉상이 어디 있는지. */
  readonly faceLine: string;
  /** 조수 안내 문장 — 전투 그림이 어디 있고, 없으면 어떻게 하는지. */
  readonly battleLine: string;
  /** 잠금이 강제 중일 때만 붙는 문장(거부·목록 필터). */
  readonly enforceLine: string;
}

interface GenreLockPresetDef {
  readonly label: string;
  /** 안내 문장에 쓰는 이름(「몬스터 칩셋」). */
  readonly kitNoun: string;
  /** 잠금을 다시 켜는 방법(해제 안내 문장). */
  readonly relockHint: string;
  readonly families: readonly string[];
  /** 캐릭터 칩 잠금(없으면 이 장르는 캐릭터를 잠그지 않는다). */
  readonly charsets?: GenreLockCharsetDef;
  /** 얼굴·전투 그림 잠금(없으면 이 장르는 얼굴·전투 그림을 잠그지 않는다). */
  readonly visuals?: GenreLockVisualDef;
  /** tilesetId 를 생략한 맵 생성 도구에 넣는 기본 칩셋. */
  readonly defaultTilesetId: string;
  /** 허용 밖 칩셋을 시도했을 때 가장 가까운 허용 칩셋(앞에서부터 처음 맞는 것). 마지막은 defaultTilesetId 로 물러난다. */
  readonly alternatives: readonly Alternative[];
  /** 조수에게 숨기는 비허용 계열 전용 파이프라인 도구 이름. */
  readonly hiddenToolPatterns: readonly RegExp[];
  /** 시스템 프롬프트의 잠금 덩어리 끝에 붙는 장르 전용 안내(없으면 생략). 칩셋이 아니라 이 장르의 도구가 어디 있는지 알린다. */
  readonly promptExtra?: string;
}

// 계열 id 는 monsterKit.ts(MONSTER_KIT_FAMILY)·emeraldMonsterKit.ts 와 같아야 한다 — 이 파일은 시트 데이터를 끌어오지 않으려고 문자열로 둔다.
export const GENRE_LOCK_PRESETS: Readonly<Record<GenreLockPresetId, GenreLockPresetDef>> = {
  "monster-collect": {
    label: "포켓몬 라이크(몬스터 수집)",
    kitNoun: "몬스터 칩셋",
    relockHint: "configure_monster_system(enabled:true) 또는 자료집 시스템 탭의 「장르 칩셋 잠금」",
    families: ["oprn-monster", "oprn-monster-emerald"],
    // 캐릭터 칩(2026-10-16): 사람은 몬스터 테이밍 팩(Scarloxy) 트레이너·도장 보스, 생물은 OPRN 몬스터·몬스터 수집 따라다니기 칩이다.
    // RTP Monster1~3·Animal 은 생물이라 허용하지만 RTP Actor·People(판타지 사람)·마법 학교·공용 공방 사람 칩은 막는다.
    // 사람 칩(2026-10-16): Scarloxy 원본 10칸(People1 8 + People2 2) + 그 뼈대에서 변형한 OPRN ScarloxyPeople1~13(90칸: 경찰·연구원·간호사·단원·낚시꾼·캠퍼·등산가·점원·수영 선수·뱃사람·노인·마을 주민·도장 보스 13종·학생·역무원·등대지기·포획 대회 참가자·변형 소년·소녀 22종 …).
    // 닌텐도 원작 판형은 공개 저장소에 둘 수 없다. 변형 칩도 charsetFamily 가 같은 `scarloxy-people` 로 분류하므로 저장된 옛 잠금의 허용 목록을 바꿀 필요가 없다.
    charsets: {
      families: ["scarloxy-people", "oprn-creature", "rtp-creature", "object", "uploaded", "other"],
      kitNoun: "몬스터 수집 캐릭터 칩",
      playerDefault: { resourceId: "scarloxy-charset-people1", characterIndex: 0 },
      promptLine: "캐릭터 그림(플레이어·NPC·트레이너 걷기 그림)도 이 장르 칩만 쓴다 — 사람은 Scarloxy 트레이너 칩(scarloxy-charset-people1 0~7 · people2 0~1: 모자 트레이너·소년·소녀·농부·도장 보스)과 그 변형 직군 칩(oprn-charset-scarloxy-people1~13: 경찰·연구원·간호사·단원·낚시꾼·점원·수영 선수·뱃사람·노인·마을 주민·어린이·점쟁이·불/물/땅/격투/비행/독/벌레/고스트/강철/드래곤 도장 보스·남학생·역무원·등대지기·포획 대회 참가자·사육사, people11~13 은 모자·머리색·후드·조끼 차림의 일반 트레이너/마을 소년·소녀 22종 …; list_npc_graphics 에 '점원'·'뱃사람'·'노인' 같은 직군 말로 찾는다), "
        + "몬스터·동물은 OPRN 몬스터 칩(Monster4~6)·몬스터 수집 따라다니기 칩·RTP 동물이다.",
      enforceLine: "RTP Actor·People·마법 학교·공용 공방 사람 칩은 거부되고, list_npc_graphics 는 허용 칩만 보여 준다.",
    },
    // 얼굴·전투 그림(2026-10-16): 사람 얼굴은 Scarloxy 트레이너 얼굴 10칸·OPRN 몬스터 얼굴뿐이고(RTP 몬스터·동물 얼굴은 허용 걷기 칩의 짝이라 허용), RTP Actor·People 얼굴·공용 표정 세트 흉상·전신(사람)은 막는다.
    // 전투 그림은 Scarloxy 몬스터·하네스 몬스터(앞·뒤)·트레이너 번들(battle-trainers)·에메랄드풍/Scarloxy/겹 배경만 허용하고, 일반 JRPG 적(슬라임·박쥐·골렘 …)·RTP 배경은 막는다.
    // 한계(2026-10-16 실측): 허용 몬스터 그림은 Scarloxy 19종 + 하네스 15종(앞·뒤), 트레이너 번들 앞모습 10역할·뒷모습 2역할이다 — 모자라는 칸은 거부하지 않고 「생성 대기」(그림 없이 저장)로 둔다.
    visuals: {
      faces: ["scarloxy-face", "oprn-creature-face", "fantasy-creature-face", "uploaded", "other"],
      battlers: ["scarloxy-monster", "harness-monster", "uploaded", "other"],
      trainerArt: ["oprn-trainer", "uploaded"],
      backdrops: ["scarloxy-backdrop", "emerald-terrain", "oprn-scenery", "pokemon-backdrop", "uploaded", "other"],
      // 전투 화면 스킨은 지금 둘뿐이다(몬스터 대치 pokemon · 도트 측면 retro2003 — 정면 스킨은 2026-10-02 에 지웠다). 몬스터 수집은 둘 다 쓴다.
      // 새 스킨이 생기면 이 목록에 넣기 전까지 몬스터 프로젝트로는 바뀌지 않는다(허용 밖 스킨으로 「바꾸는」 것만 막는다).
      skins: ["pokemon", "retro2003"],
      kitNoun: "몬스터 수집 얼굴·전투 그림",
      faceLine: "얼굴·흉상·전신 초상도 이 장르 것만 쓴다 — 사람은 Scarloxy 트레이너 얼굴(generated-faceset-missing-scarloxy-00~09: 걷기 칩과 짝으로 자동 붙는다), 몬스터는 OPRN·RTP 몬스터 얼굴이다. "
        + "맞는 얼굴이 없으면 판타지 사람 얼굴로 때우지 말고 얼굴 없이 두거나 캐릭터 외형 DB 에 외형을 만들어 generate_character_appearance 로 사용자가 후보를 받게 한다.",
      battleLine: "전투 그림도 이 장르 것만 쓴다 — 몬스터는 list_resources(kind:monster)의 Scarloxy 몬스터·하네스 몬스터(앞·뒷모습)이고 일반 JRPG 적 그림(slime·bat·golem …)은 거부된다, "
        + "트레이너 전투 그림은 troop.trainerSprite 에 battle-trainers 역할 id(앞모습 boy·girl·fisher·hiker·bug_catcher·gym_rock·gym_water·scientist·punk·elder, 뒷모습 hero_m·hero_f)를, "
        + "전투 배경은 battle-scenery-*·scarloxy-backdrop-*·emerald:<갈래> 를, 전투 화면은 몬스터 대치(pokemon)·도트 측면(retro2003)만 쓴다. "
        + "맞는 몬스터·트레이너 그림이 없으면 지어내거나 일반 적 그림으로 바꾸지 말고 그림 없이 저장한다 — 「생성 대기」로 check_genre_lock 에 남고, 새 그림은 사람이 고르는 하네스(monster-collect-species · battle-trainer-sprites)에서 만든다.",
      enforceLine: "허용 밖 얼굴·몬스터·트레이너·배경 그림은 거부되고(가장 가까운 허용 그림을 알려 준다), list_resources 는 허용 그림만 보여 준다.",
    },
    defaultTilesetId: "monster_overworld",
    alternatives: [
      { pattern: /gym|league|체육관|리그/iu, tilesetId: "monster_gyms", use: "체육관·리그 홀" },
      { pattern: /dungeon|cave|catacomb|temple|labyrinth|sewer|mine|ice|던전|동굴|미궁|지하|감옥|묘지|하수|광산|신전|유적|얼음/iu, tilesetId: "monster_dungeon", use: "던전·동굴·유적·얼음 동굴" },
      { pattern: /interior|room|house|inn|shop|실내|집안|방 |상점|여관|민가|저택|센터/iu, tilesetId: "monster_rooms", use: "실내(집·상점·센터·교실)" },
      { pattern: /coast|harbou?r|port|sea|beach|pirate|isle|항구|해안|바다|섬|해적|포구/iu, tilesetId: "monster_coast", use: "항구·해안 마을" },
      { pattern: /desert|snow|volcan|autumn|climate|oasis|사막|설원|눈|화산|가을|기후|오아시스/iu, tilesetId: "monster_climate", use: "사막·설원·화산·가을 같은 기후 지역" },
      { pattern: /field|forest|grass|wild|route|meadow|들|숲|풀|도로|야생|길/iu, tilesetId: "monster_wild", use: "야생 풀밭·숲·도로" },
    ],
    hiddenToolPatterns: [
      /^(author|dress|harmonize|naturalize|refine|compose)_beodeul_/u,
      /^(compose|link|build|list)_(campus|desert_east|jp_city|modern_city|pirate_isles|prehistoric|sengoku_edo|sf_station|sky_island|snow_north|steampunk|gothic|wizarding|wasteland)/u,
      /^apply_beodeul_/u,
    ],
    // 몬스터 게임 제작 도구는 숨기지 않는다(위 패턴에 안 걸린다). 전투 깊이·필드 기술은 도구 인자 한 곳에서 정해진다 — 상태·이벤트로 흉내 내지 않는다.
    promptExtra: "전투 깊이는 전용 필드로 정한다: 능력 단계 ±6 = upsert_skill statStageEffects · 상태이상(독·맹독·화상·수면·얼음·마비·혼란) = upsert_state gen1MajorStatus/volatileStatus · 날씨 = upsert_skill weather · "
      + "특성 = define_monster_species species.ability · 지닌 물건 = upsert_item heldEffect · 조건부 포획볼 = upsert_item captureProfile.condition. 필드 기술(비전머신 HM)은 place_field_obstacle(바위·덩굴·물길·폭포·어둠). "
      + "인자 모양은 find_tools 로 recipe(monster-battle-depth·monster-status-conditions·monster-weather·monster-abilities·monster-held-items·monster-capture-balls·monster-field-skills)를 찾아 읽는다.",
  },
  romance: {
    label: "현대 연애(학교·도시 무대)",
    kitNoun: "현대 칩셋",
    relockHint: "자료집 시스템 탭의 「장르 칩셋 잠금」",
    families: ["oprn-campus", "oprn-modern", "oprn-jp"],
    // 캐릭터 칩(2026-10-16): 현대 연애 인물 칩 Modern1~3(교복·사복·정장·카페 점원·선생 24종)과 기능 칩·올린 칩·공방 칩만 새 인물에 쓴다.
    // RTP Actor·People(판타지 사람)·CT·FF6풍 영웅·마법 학교·몬스터 칩은 막는다. 얼굴·전투 그림은 잠그지 않는다(연애는 전투 그림이 없고 얼굴은 검토된 짝 표를 따른다).
    charsets: {
      families: ["modern", "object", "uploaded"],
      kitNoun: "현대 연애 인물 칩",
      playerDefault: { resourceId: "oprn-charset-modern2", characterIndex: 2 },
      promptLine: "캐릭터 그림(주인공·공략 인물·학생·점원 걷기 그림)도 이 장르 칩만 쓴다 — 현대 연애 인물 칩 Modern1~3(oprn-charset-modern1~3, 칸 0~7): 남녀 교복(남색·회색 블레이저·세일러복·여름 교복), 캐주얼 사복(후드티·원피스·재킷), 정장, 카페 점원 앞치마, 선생·교수. "
        + "list_npc_graphics 에서 「여학생」「남학생」「카페 점원」「교수」 같은 말로 찾고, 인물마다 서로 다른 칸을 고른다(같은 사람이 다른 맵에 다시 나올 때만 같은 칸). "
        + "대화 초상: 교복·사복·정장·카페 점원·선생 12종(남색 블레이저 남·옆머리 남·남색 블레이저 여·세일러복·양갈래·후드티 남·민트 원피스·네이비 정장 남·남색 정장 여·갈색 앞치마·트위드 교수·버건디 카디건 선생)은 칩과 같은 인물의 흉상·전신이 짝으로 있다 — "
        + "list_npc_graphics 의 face(흉상 base)와 portraitOptions 를 그대로 쓰고 다른 얼굴을 붙이지 않는다(NPC 를 놓으면 짝 흉상이 대사에 자동으로 따라 붙는다). 전신은 changeFace 에 portraitOptions 의 전신 id 를 쓰고, 표정은 id 끝의 -base 를 happy·surprised·sad·embarrassed 로 바꾼다(그 밖의 emotion 은 기본 그림).",
      enforceLine: "RTP Actor·People 판타지 칩·영웅·마법 학교·몬스터 칩은 거부되고, list_npc_graphics 는 허용 칩만 보여 준다.",
    },
    defaultTilesetId: "modern_city",
    alternatives: [
      { pattern: /campus|school|univers|academy|classroom|library|dorm|캠퍼스|학교|대학|교실|도서관|기숙|동아리|강의/iu, tilesetId: "modern_campus", use: "캠퍼스·학교(교정·교실·도서관·기숙사)" },
      { pattern: /japan|jp_|tokyo|일본|도쿄|신사|상점가|역 /iu, tilesetId: "jp_city", use: "일본 상점가·주택가·역" },
      { pattern: /city|street|cafe|shop|office|apartment|station|park|거리|도시|카페|상점|사무실|아파트|역|공원|골목|편의점/iu, tilesetId: "modern_city", use: "현대 도시 거리·카페·사무실·아파트" },
    ],
    hiddenToolPatterns: [
      /^(author|dress|harmonize|naturalize|refine|compose)_beodeul_/u,
      /^apply_beodeul_/u,
      /^(compose|link|build|list)_(desert_east|pirate_isles|prehistoric|sengoku_edo|sf_station|sky_island|snow_north|steampunk|gothic|wizarding|wasteland)/u,
    ],
    // 연애 마무리 4가지(2026-10-16 실제 Argon 첫 측정에서 전부 빠졌다): 제목, 인물마다 다른 칩, 호감으로 갈리는 엔딩, 자리표시 이름.
    promptExtra: "연애 게임 마무리: ① 게임 제목은 기본값(「새 게임」·「새 프로젝트」)으로 두지 말고 set_title_screen {title, logoSubtitle} 로 이 게임의 이름과 부제를 정한다 — 부제도 코드가 깔아 둔 「마음이 닿는 계절」 그대로 두지 말고 이 게임 내용에 맞게 바꾼다. "
      + "② 공략 인물·주요 NPC 는 서로 다른 칩 칸을 고른다 — 같은 맵에 같은 얼굴이 둘 이상이면 어색하다(같은 사람이 다른 맵에 다시 나올 때만 같은 칸). "
      + "③ 엔딩: 뼈대에는 이미 호감으로 갈리는 세 결말(해피 ≥60 · 평범 ≥25 · 혼자)과 14일 기한 판정이 깔려 있다 — 구간 끝 이벤트는 엔딩 id 없이 triggerEnding 해 누적 호감으로 고른다. 이 이름·대사를 이 게임에 맞게 고치고, 공략 인물이 둘 이상이면 인물마다 define_ending(예: 「OO와 함께」)을 만들어 set_deadline_ending 의 tiers 맨 위에 {endingId, friendshipAtLeast, characterId} 로 얹는다(마지막은 혼자·평범 기본 결말). 마지막 선택지가 결말을 정하게 만들지 않는다 — 결말은 누적 호감이 가른다. "
      + "④ 호감은 changeFriendship(npcKey=인물 characterId, delta) 로 올린다 — 「OO 호감도」 변수(setVariable)를 따로 두지 않는다(ESC 관계 화면·호감 HUD·호감 엔딩은 friendship 만 읽는다). 선택지가 호감을 올리면 그 분기에 changeFriendship 을 넣는다. "
      + "⑤ 뼈대가 둔 자리표시 이름(「산책로 끝」「떨어진 수첩」)은 이 게임의 장소·사물 이름으로 바꾼다. ESC 메뉴는 호감도·일정·소지품·저장·설정으로 이미 잠겨 있어 전투 능력치 메뉴를 만들지 않는다.",
  },
};

const KNOWN_PRESETS = Object.keys(GENRE_LOCK_PRESETS) as GenreLockPresetId[];

export function isGenreLockPresetId(value: unknown): value is GenreLockPresetId {
  return typeof value === "string" && (KNOWN_PRESETS as string[]).includes(value);
}

export interface ActiveGenreLock {
  readonly lock: GenreLock;
  readonly def: GenreLockPresetDef;
  readonly allowed: ReadonlySet<string>;
  /** 허용 캐릭터 칩 계열. undefined = 이 잠금은 캐릭터를 잠그지 않는다. */
  readonly allowedCharsets: ReadonlySet<string> | undefined;
  /** 허용 얼굴 계열. undefined = 이 잠금은 얼굴을 잠그지 않는다. */
  readonly allowedFaces: ReadonlySet<string> | undefined;
  /** 허용 전투 그림 계열(접두사 `battler:`·`trainer:`·`backdrop:`·`skin:`). undefined = 이 잠금은 전투 그림을 잠그지 않는다. */
  readonly allowedBattle: ReadonlySet<string> | undefined;
}

/** 표의 얼굴·전투 그림 허용 목록을 저장 형태로 편다. */
export function genreLockVisualFamilyLists(def: GenreLockVisualDef): { readonly faces: readonly string[]; readonly battle: readonly string[] } {
  return {
    faces: [...def.faces],
    battle: [
      ...def.battlers.map((id) => `battler:${id}`),
      ...def.trainerArt.map((id) => `trainer:${id}`),
      ...def.backdrops.map((id) => `backdrop:${id}`),
      ...def.skins.map((id) => `skin:${id}`),
    ],
  };
}

/** 프리셋 표의 허용 캐릭터 칩 계열(저장본이 아니라 표). 캐릭터를 안 잠그는 장르는 undefined. 방금 생성한 프로젝트를 표에 맞출 때 쓴다. */
export function genreLockCharsetFamiliesOfPreset(preset: GenreLockPresetId): readonly CharsetFamilyId[] | undefined {
  return GENRE_LOCK_PRESETS[preset].charsets?.families;
}

/** 이 잠금이 지키는 캐릭터 칩 계열(저장본 우선, 없으면 프리셋 표). 캐릭터를 안 잠그는 장르는 undefined. */
function lockedCharsetFamilies(lock: GenreLock, def: GenreLockPresetDef): readonly string[] | undefined {
  return def.charsets ? (lock.allowedCharsetFamilies ?? def.charsets.families) : undefined;
}

/** 켜져 있는 잠금(모르는 preset 이면 없는 것으로 본다). */
export function activeGenreLock(project: Pick<Project, "system">): ActiveGenreLock | undefined {
  const lock = project.system?.genreLock;
  if (!lock || !isGenreLockPresetId(lock.preset)) return undefined;
  const def = GENRE_LOCK_PRESETS[lock.preset];
  const charsets = lockedCharsetFamilies(lock, def);
  const visuals = def.visuals ? genreLockVisualFamilyLists(def.visuals) : undefined;
  const faces = visuals ? (lock.allowedFaceFamilies ?? visuals.faces) : undefined;
  const battle = visuals ? (lock.allowedBattleFamilies ?? visuals.battle) : undefined;
  return {
    lock, def, allowed: new Set(lock.allowedFamilies), allowedCharsets: charsets ? new Set(charsets) : undefined,
    allowedFaces: faces ? new Set(faces) : undefined, allowedBattle: battle ? new Set(battle) : undefined,
  };
}

/** 조수·도구 경로에서 거부해야 하는 잠금인가. */
export function enforcingGenreLock(project: Pick<Project, "system">): ActiveGenreLock | undefined {
  const active = activeGenreLock(project);
  return active && active.lock.mode === "enforce" ? active : undefined;
}

function isWorldmapKitMap(map: GameMap): boolean {
  return Boolean(map.worldmapSource) && map.tilesetId === `worldmap_${map.id}`;
}

/** 이 칩셋 계열이 잠금 허용인가. approved = 사용자가 카드로 승인한 계열(그 계열 한정 허용). */
export function genreLockAllowsTileset(project: Project, tilesetId: string, approved: readonly string[] = []): boolean {
  const active = activeGenreLock(project);
  if (!active) return true;
  const family = tilesetFamily(project, tilesetId);
  return active.allowed.has(family) || approved.includes(family);
}

/**
 * 이 캐릭터 칩(리소스 id 또는 텍스처 키)이 잠금 허용 계열인가. 잠금이 없거나 이 장르가 캐릭터를 안 잠그면 항상 true.
 * 투명 그림·칩이 아닌 그림은 호출부가 거른다.
 */
export function genreLockAllowsCharset(project: Pick<Project, "system" | "assets">, idOrTextureKey: string): boolean {
  const active = activeGenreLock(project);
  if (!active?.allowedCharsets) return true;
  return active.allowedCharsets.has(charsetFamilyOf(project, idOrTextureKey));
}

/** 캐릭터 칩 계열 이름(안내·거부 메시지용). */
export function genreLockCharsetFamilyLabel(project: Pick<Project, "assets">, idOrTextureKey: string): string {
  return CHARSET_FAMILY_LABELS[charsetFamilyOf(project, idOrTextureKey)];
}

/** 이 사용처가 잠금 허용인가 — 풀 수 없는 참조(없는 외형 id)는 항상 허용 밖이다. 잠금이 없거나 캐릭터를 안 잠그면 true. */
export function genreLockAllowsCharsetUse(project: Pick<Project, "system" | "assets">, use: Pick<CharsetUse, "resourceId" | "unresolved">): boolean {
  if (!activeGenreLock(project)?.allowedCharsets) return true;
  return use.unresolved === undefined && genreLockAllowsCharset(project, use.resourceId);
}

/**
 * 보고에 세는 사용처인가. 새 프로젝트가 장르와 무관하게 싣는 「기본 명단」 배우(100여 명)의 칩은 게임이 쓰지 않으면 세지 않는다 — 풀 전체를 위반으로 보고하면 항상 수십 건이라 쓸모가 없다
 * (얼굴·전투 그림 보고의 genreLockVisualReport 와 같은 규칙). 시작 배우와 동료·파티 명령이 가리키는 배우(viaActor)는 센다.
 */
function reportableCharsetUse(project: Pick<Project, "system">, path: string): boolean {
  const match = /^database\/actors\/([^/]+)\//u.exec(path);
  return !match || (project.system.startActorIds ?? []).includes(match[1]!);
}

export interface GenreLockCharsetOutsider extends CharsetUse {
  readonly path: string;
  /** true = 잠금을 켤 때 이미 허용 밖이던 칩(막지 않는다). false = 잠금 이후에 생긴/바뀐 것(고쳐야 할 대상). */
  readonly preexisting: boolean;
}

/** 지금 허용 밖 캐릭터 칩을 쓰는 사용처 전부(걷기 그림·배우 칩·동료/파티 명령이 가리키는 배우·전투 그림·옛 sprite·종 필드 그림). 캐릭터를 안 잠그는 잠금은 빈 배열. */
export function genreLockCharsetOutsiders(project: Project): GenreLockCharsetOutsider[] {
  const active = activeGenreLock(project);
  if (!active?.allowedCharsets) return [];
  const before = new Set(active.lock.grandfatheredCharsetPaths ?? []);
  const out: GenreLockCharsetOutsider[] = [];
  for (const [path, use] of collectCharsetUses(project)) {
    if (genreLockAllowsCharsetUse(project, use) || !reportableCharsetUse(project, path)) continue;
    out.push({ ...use, path, preexisting: before.has(path) });
  }
  return out;
}

/** 허용 캐릭터 칩 계열 이름들(안내용). 캐릭터를 안 잠그면 빈 배열. */
export function genreLockAllowedCharsetLabels(project: Pick<Project, "system">): string[] {
  const active = activeGenreLock(project);
  return active?.allowedCharsets ? [...active.allowedCharsets].map((id) => CHARSET_FAMILY_LABELS[id as CharsetFamilyId] ?? id) : [];
}

/** 맵 하나가 허용 밖인가. 세계 지도 전용 칩셋·지도 그림 시트는 장르와 무관한 도구라 통과한다. */
export function genreLockMapViolation(project: Project, map: GameMap, approved: readonly string[] = []): boolean {
  if (!activeGenreLock(project)) return false;
  if (isWorldmapKitMap(map) || map.tilesetId === "atlas_cartography") return false;
  return !genreLockAllowsTileset(project, map.tilesetId, approved);
}

/** 프로젝트에 실제로 있는 허용 칩셋(번들 순서). */
export function genreLockAllowedTilesets(project: Project): { id: string; name: string }[] {
  const active = activeGenreLock(project);
  if (!active) return [];
  return Object.values(project.tilesets).filter((tileset) => active.allowed.has(tilesetFamily(project, tileset.id))).map((tileset) => ({ id: tileset.id, name: tileset.name }));
}

/** 시도한 칩셋·도구·맵 이름으로 가장 가까운 허용 칩셋. 프로젝트에 없는 칩셋 id 는 고르지 않는다. */
export function genreLockAlternative(project: Project, hint: string): { tilesetId: string; use: string } | undefined {
  const active = activeGenreLock(project);
  if (!active) return undefined;
  const has = (id: string) => project.tilesets[id] !== undefined && active.allowed.has(tilesetFamily(project, id));
  for (const alt of active.def.alternatives) if (alt.pattern.test(hint) && has(alt.tilesetId)) return { tilesetId: alt.tilesetId, use: alt.use };
  if (has(active.def.defaultTilesetId)) return { tilesetId: active.def.defaultTilesetId, use: "야외 마을·길(기본)" };
  const first = genreLockAllowedTilesets(project)[0];
  return first ? { tilesetId: first.id, use: first.name } : undefined;
}

export function genreLockHidesTool(project: Pick<Project, "system">, toolName: string): boolean {
  const active = enforcingGenreLock(project);
  return !!active && active.def.hiddenToolPatterns.some((pattern) => pattern.test(toolName));
}

export function genreLockHiddenToolMessage(project: Project, toolName: string): string {
  const active = activeGenreLock(project)!;
  const alts = active.def.alternatives.map((alt) => `${alt.use}→${alt.tilesetId}`).join(" · ");
  return `장르 잠금(${active.def.label}): ${toolName} 은 ${allowedLabels(project, active)} 밖 칩셋 계열의 전용 시공 도구라 이 프로젝트에서는 쓰지 않는다. `
    + `create_map(tilesetId=허용 칩셋)으로 빈 맵을 만들어 칠하기 도구로 깔거나, ${active.def.kitNoun} 판(${alts})을 골라라. 사용자가 그 계열을 정말 원할 때만 ask_tileset_change 로 묻고 턴을 끝내라.`;
}

function allowedLabels(project: Project, active: ActiveGenreLock): string {
  return [...active.allowed].map((family) => tilesetFamilyLabel(project, family)).join("·");
}

/** 거부 메시지 — 허용 칩셋 목록, 이름으로 고른 가장 가까운 대안, 승인 경로를 모두 싣는다. 무음 대체는 하지 않는다. */
export function genreLockRejection(project: Project, args: { toolName: string; map: GameMap; hint?: string }): string {
  const active = activeGenreLock(project)!;
  const toTileset = project.tilesets[args.map.tilesetId];
  const toFamily = tilesetFamily(project, args.map.tilesetId);
  const alt = genreLockAlternative(project, `${args.map.tilesetId} ${toTileset?.name ?? ""} ${args.map.name} ${args.toolName} ${args.hint ?? ""}`);
  const allowed = genreLockAllowedTilesets(project).map((t) => t.id).join(", ");
  return `장르 잠금(${active.def.label}): 이 프로젝트는 ${allowedLabels(project, active)} 칩셋 계열만 새 맵·칩셋에 쓴다. `
    + `${args.toolName} 이 맵 ${args.map.id}「${args.map.name}」에 「${toTileset?.name ?? args.map.tilesetId}」(${args.map.tilesetId}, ${tilesetFamilyLabel(project, toFamily)} 계열)을 쓰려 해 거부했다 — 다른 칩셋으로 바꿔 넣지 않았다. `
    + `허용 칩셋: ${allowed || "없음"}. `
    + (alt ? `가장 가까운 대안: ${alt.tilesetId}(${alt.use}) — 그 도구가 tilesetId 를 받으면 그것으로 지정해 다시 부르고, 못 받으면 create_map(tilesetId=${alt.tilesetId}) 로 빈 맵을 만든 뒤 칠하기 도구로 직접 깔아라. ` : "")
    + `사용자가 이 계열을 정말 원한다고 말했을 때만 ask_tileset_change(toTilesetId="${args.map.tilesetId}") 로 견본을 보여 묻고 턴을 끝내라 — 승인은 그 계열 한정 허용이지 잠금 해제가 아니다.`;
}

/**
 * 잠금을 켠다(이미 같은 preset·모드면 아무것도 안 한다). 바뀌었으면 true.
 * 프로젝트에 허용 계열 칩셋이 하나도 없으면 켜지 않는다 — 켜면 조수가 아무 맵도 만들 수 없다(칩셋이 없는 최소 fixture·옛 프로젝트 보호).
 * 켜는 시점에 이미 허용 밖 칩셋이던 맵은 grandfatheredMapIds 로 기록한다(막지 않고 따로 보고).
 */
export function enableGenreLock(project: Project, preset: GenreLockPresetId, mode: GenreLockMode = "enforce"): boolean {
  const def = GENRE_LOCK_PRESETS[preset];
  const existing = project.system.genreLock;
  if (existing && existing.preset === preset && existing.mode === mode) {
    // 캐릭터 칩 잠금이 생기기 전(2026-10-16 이전)에 켠 잠금 — 표의 허용 계열을 저장본에 복사해 정본으로 만든다(맵 잠금은 그대로).
    if (def.charsets && !existing.allowedCharsetFamilies) {
      project.system.genreLock = { ...existing, allowedCharsetFamilies: [...def.charsets.families], ...visualFamiliesOf(def) };
      applyGenreLockCharsetDefaults(project, def);
      grandfatherCharsetOutsiders(project);
      return true;
    }
    // 얼굴·전투 그림 잠금(2026-10-16)이 생기기 전에 켠 잠금 — 표의 허용 계열을 저장본에 복사해 정본으로 만든다(맵·캐릭터 잠금은 그대로).
    if (def.visuals && !existing.allowedFaceFamilies) {
      project.system.genreLock = { ...existing, ...visualFamiliesOf(def) };
      return true;
    }
    return false;
  }
  if (!Object.values(project.tilesets).some((tileset) => def.families.includes(tilesetFamily(project, tileset.id)))) return false;
  const keep = existing && existing.preset === preset ? existing.grandfatheredMapIds : undefined;
  const keepCharsets = existing && existing.preset === preset ? existing.grandfatheredCharsetPaths : undefined;
  project.system.genreLock = { preset, mode, allowedFamilies: [...def.families], ...(def.charsets ? { allowedCharsetFamilies: [...def.charsets.families] } : {}), ...visualFamiliesOf(def) };
  const grandfathered = keep ? [...keep] : Object.values(project.maps).filter((map) => genreLockMapViolation(project, map)).map((map) => map.id);
  if (grandfathered.length) project.system.genreLock = { ...project.system.genreLock, grandfatheredMapIds: grandfathered };
  applyGenreLockCharsetDefaults(project, def);
  // 켜는 순간 이미 허용 밖이던 칩(맵 이벤트·기본 명단 배우·동료/파티 명령·전투 그림)을 「잠금 이전부터 있던 칩」으로 적어 둔다 — 막지 않고 따로 보고한다.
  grandfatherCharsetOutsiders(project, keepCharsets);
  return true;
}

/** 칩 사용처 경로 목록 상한 — 통째로 들인 캠페인이 허용 밖 칩 수천 곳을 가져도 저장 줄이 안 커지게(넘으면 나머지는 「잠금 이후」로 센다). */
const GRANDFATHERED_CHARSET_PATH_LIMIT = 1000;

/** 켜져 있는 잠금에 지금 허용 밖인 칩 사용처를 「잠금 이전부터 있던」 것으로 적는다(keep 이 있으면 그 목록을 그대로 둔다). 캐릭터를 안 잠그는 장르는 아무것도 안 한다. */
function grandfatherCharsetOutsiders(project: Project, keep?: readonly string[]): void {
  const lock = project.system.genreLock;
  const active = activeGenreLock(project);
  if (!lock || !active?.allowedCharsets) return;
  const paths = keep ? [...keep] : [...collectCharsetUses(project)].filter(([path, use]) => !genreLockAllowsCharsetUse(project, use) && reportableCharsetUse(project, path)).map(([path]) => path).slice(0, GRANDFATHERED_CHARSET_PATH_LIMIT);
  if (paths.length) project.system.genreLock = { ...lock, grandfatheredCharsetPaths: paths };
}

/** 「잠금 이전부터 있던 칩」 목록을 지금 허용 밖인 사용처로 다시 쓴다 — 켠 직후 조수 경로가 기본 명단 배우를 허용 칩으로 바꾼 뒤 남은 것만 남기려고 쓴다(genreLockCharsets.settleCharsetsOnLock). */
export function refreshGrandfatheredCharsets(project: Project): void {
  const lock = project.system.genreLock;
  if (!lock) return;
  const { grandfatheredCharsetPaths: _drop, ...rest } = lock;
  project.system.genreLock = rest;
  grandfatherCharsetOutsiders(project);
}

function visualFamiliesOf(def: GenreLockPresetDef): { allowedFaceFamilies?: string[]; allowedBattleFamilies?: string[] } {
  if (!def.visuals) return {};
  const lists = genreLockVisualFamilyLists(def.visuals);
  return { allowedFaceFamilies: [...lists.faces], allowedBattleFamilies: [...lists.battle] };
}

/** 기본 주인공 배우 id(defaults/constants 의 DEFAULT_ACTOR_ID — 그 파일은 무거워 값만 적는다). */
const DEFAULT_HERO_ACTOR_ID = "actor_hero";
const PRISTINE_HERO_CHARSETS: ReadonlySet<string> = new Set(["easyrpg-charset-actor1", "tex_easyrpg_charset_actor1"]);

/**
 * 잠금이 켜질 때 장르 기본 걷기 그림을 입힌다 — **손대지 않은 기본 주인공**(기본 배우 id·기본 Actor1 0번 칸)에게만, 한 번.
 * 저작자가 바꾼 배우·다른 배우·이벤트 그림은 그대로 둔다(새 장르를 켜도 이미 그린 그림은 안 바뀐다).
 * 기본 얼굴은 Actor1 걷기 그림의 짝이라 새 칩과 안 맞으므로 그 기본 짝일 때만 비운다(저작자가 고른 얼굴은 남긴다).
 */
function applyGenreLockCharsetDefaults(project: Project, def: GenreLockPresetDef): boolean {
  const charsets = def.charsets;
  if (!charsets) return false;
  const hero = project.database.actors.find((actor) => actor.id === DEFAULT_HERO_ACTOR_ID);
  if (!hero) return false;
  if (hero.characterResourceId !== undefined && !PRISTINE_HERO_CHARSETS.has(hero.characterResourceId)) return false;
  if ((hero.characterIndex ?? 0) !== 0) return false;
  if (hero.characterResourceId === charsets.playerDefault.resourceId) return false;
  const pairedFace = reviewedFaceIdForCharset(hero.characterResourceId ?? "easyrpg-charset-actor1", 0);
  hero.characterResourceId = charsets.playerDefault.resourceId;
  hero.characterIndex = charsets.playerDefault.characterIndex;
  if (hero.faceResourceId !== undefined && hero.faceResourceId === pairedFace) delete hero.faceResourceId;
  // 전투 그림(battleCharacterResourceId)도 새 걷기 칩 계열을 따른다 — 기본 주인공의 RTP Actor1 전투 시트가 남으면 사람 전투에서 RTP 마법사가 선다(잠금 누수 감사 #6).
  // 허용 계열에는 사람 전투 시트가 없으므로 비워 폴백(도트 측면 기본)에 맡긴다. 저작자가 고른 허용 전투 그림은 남긴다.
  const battlerChip = hero.battleCharacterResourceId !== undefined ? battlerSourceChip(hero.battleCharacterResourceId) : undefined;
  if (battlerChip && !(charsets.families as readonly string[]).includes(charsetFamilyOf(project, battlerChip.resourceId))) delete hero.battleCharacterResourceId;
  // 얼굴 잠금이 있으면 새 걷기 칩의 검토된 짝 얼굴을 입힌다 — 얼굴 없이 두면 대사 초상이 비고, 옛 기본 얼굴은 허용 밖이다. 저작자가 고른 다른 얼굴은 남긴다.
  if (def.visuals && hero.faceResourceId === undefined) {
    const nextFace = reviewedFaceIdForCharset(charsets.playerDefault.resourceId, charsets.playerDefault.characterIndex);
    if (nextFace) hero.faceResourceId = nextFace;
  }
  return true;
}

/**
 * 이미 켜진 잠금에, 지금 허용 밖인 맵을 「잠금 이전부터 있던 맵」으로 적어 둔다(막지 않는다).
 * 잠금을 먼저 켠 뒤 시작 예제처럼 프로젝트 내용을 통째로 갈아 끼운 경우에만 쓴다 — 안 하면 그 예제 맵이 곧바로 「잠금 이후 위반」으로 보고된다.
 */
export function grandfatherGenreLockViolations(project: Project): boolean {
  const lock = project.system.genreLock;
  if (!lock) return false;
  const ids = genreLockViolations(project).map((violation) => violation.mapId).filter((id) => !(lock.grandfatheredMapIds ?? []).includes(id));
  const paths = genreLockCharsetOutsiders(project).filter((outsider) => !outsider.preexisting).map((outsider) => outsider.path);
  if (!ids.length && !paths.length) return false;
  project.system.genreLock = {
    ...lock,
    ...(ids.length ? { grandfatheredMapIds: [...(lock.grandfatheredMapIds ?? []), ...ids] } : {}),
    ...(paths.length ? { grandfatheredCharsetPaths: [...(lock.grandfatheredCharsetPaths ?? []), ...paths].slice(0, GRANDFATHERED_CHARSET_PATH_LIMIT) } : {}),
  };
  return true;
}

/** 잠금을 끈다. 켜져 있었으면 true. */
export function disableGenreLock(project: Project): boolean {
  if (!project.system.genreLock) return false;
  delete project.system.genreLock;
  return true;
}

export interface GenreLockViolation {
  readonly mapId: string;
  readonly mapName: string;
  readonly tilesetId: string;
  readonly family: string;
  /** true = 잠금을 켤 때 이미 허용 밖이던 맵(옮길지는 사용자가 정한다). false = 잠금 이후에 생긴/바뀐 맵. */
  readonly preexisting: boolean;
}

/** 허용 밖 칩셋을 쓰는 맵 전부. */
export function genreLockViolations(project: Project, approved: readonly string[] = []): GenreLockViolation[] {
  const active = activeGenreLock(project);
  if (!active) return [];
  const before = new Set(active.lock.grandfatheredMapIds ?? []);
  return Object.values(project.maps).filter((map) => genreLockMapViolation(project, map, approved)).map((map) => ({
    mapId: map.id, mapName: map.name, tilesetId: map.tilesetId, family: tilesetFamily(project, map.tilesetId), preexisting: before.has(map.id),
  }));
}

/** 허용 밖 캐릭터 칩이 남아 있다는 한 줄(없으면 빈 문자열). 잠금 이전부터 있던 것은 막지 않고 알리기만 한다 — 사용자가 바꾸라고 하면 허용 칩으로 바꾼다. */
function charsetOutsiderNote(project: Project): string {
  const outsiders = genreLockCharsetOutsiders(project);
  if (!outsiders.length) return "";
  const before = outsiders.filter((outsider) => outsider.preexisting).length;
  return `\n[허용 밖 캐릭터 칩 ${outsiders.length}곳 — 잠금 이전부터 있던 것 ${before}곳(막지 않았다) · 잠금 이후 ${outsiders.length - before}곳] check_genre_lock 로 위치를 읽고, 새로 만드는 인물은 허용 칩으로 쓴다. 이미 있던 칩은 사용자가 시킬 때만 바꾼다.`;
}

/** 시스템 프롬프트에 붙이는 한 덩어리. 잠금이 없으면 null. */
export function genreLockPromptNote(project: Project): string | null {
  const active = enforcingGenreLock(project);
  if (!active) return null;
  const allowed = genreLockAllowedTilesets(project).map((t) => t.id).join(", ");
  const alts = active.def.alternatives.map((alt) => `${alt.use}→${alt.tilesetId}`).join(" · ");
  return `[장르 잠금 — ${active.def.label}]
이 프로젝트는 장르 잠금이 켜져 있다. 새 맵·마을·길·던전·실내는 ${allowedLabels(project, active)} 계열 칩셋(${allowed || "프로젝트에 아직 없음"})으로만 만든다. 버들항·숲·사막·jp_city·캠퍼스·조선 등 다른 계열 칩셋과 그 전용 파이프라인(author_beodeul_*, compose_*_map 등)은 보이지 않고 쓰면 거부된다 — 요청이 다른 풍경을 말하면 그 분위기를 ${active.def.kitNoun} 안에서 내거나(${alts}), 정말 필요하면 ask_tileset_change 로 사용자에게 묻는다.`
    + (active.def.charsets ? `\n${active.def.charsets.promptLine} ${active.def.charsets.enforceLine}` : "")
    + (active.def.visuals ? `\n${active.def.visuals.faceLine}\n${active.def.visuals.battleLine} ${active.def.visuals.enforceLine}` : "")
    + (active.def.charsets ? charsetOutsiderNote(project) : "")
    + (active.def.promptExtra ? `\n${active.def.promptExtra}` : "");
}

/**
 * 공간 시공이 아닌 턴(대사·가격·이름 고치기 — 긴 잠금 덩어리를 싣지 않는 실행)에도 매번 싣는 한 줄 표지.
 * 잠금이 강제 중이면 짧은 안내, 잠금 없이 장르 표지만 있으면 표지 안내(genreMarkerNote). 둘 다 아니면 null.
 */
export function genreLockShortNote(project: Project): string | null {
  const active = enforcingGenreLock(project);
  if (!active) return null;
  return `[장르 잠금 — ${active.def.label}] 이 프로젝트는 ${active.def.label} 게임으로 잠겨 있다: 새 맵은 ${allowedLabels(project, active)} 칩셋 계열만`
    + (active.def.charsets ? `. ${active.def.charsets.promptLine} ${active.def.charsets.enforceLine}` : ".")
    + (active.def.visuals ? ` 얼굴·흉상·전투 그림(몬스터·트레이너·전투 배경·전투 화면)도 이 장르 계열만 — ${active.def.visuals.enforceLine}` : "")
    + (active.def.charsets ? charsetOutsiderNote(project) : "");
}

/** 몬스터 전용 도구가 처음 성공하면 남기는 장르 표지 — 잠금(맵 칩셋 거부)을 소급해 걸지 않는 대신 이 표지만 남긴다. */
export const MONSTER_MARKER_GENRE = "monster-collect" as const;

/**
 * 몬스터 전용 도구(configure_monster_system(enabled:true)·build_monster_*·define_monster_*·place_trainer·set_encounter_table …)가 성공했는데
 * 프로젝트에 선언 장르가 없으면 system.genre 만 적어 둔다. 맵·칩셋·그림은 건드리지 않고, 다른 장르가 이미 선언돼 있으면 덮지 않는다.
 * 빈 시작 맵 조건(잠금은 빈 프로젝트에서만 걸린다) 때문에 잠금이 못 걸리는 프로젝트도 「몬스터 수집 게임」이라는 기록은 남는다.
 */
export function markMonsterGenre(project: Project): boolean {
  if (project.system.genre !== undefined) return false;
  project.system.genre = MONSTER_MARKER_GENRE;
  return true;
}

/** 이 도구 호출이 「몬스터 수집 게임이다」라는 표지를 남겨야 하는가(이름과 인자로만 판정 — 읽기 도구·끄기 호출은 아니다). */
export function monsterMarkerTool(toolName: string, args: Readonly<Record<string, unknown>>): boolean {
  if (toolName === "configure_monster_system") return args.enabled !== false;
  return MONSTER_MARKER_TOOLS.has(toolName);
}
/**
 * 위 표지 도구 중 스스로 잠금을 거는 것(configure_monster_system·build_monster_*)을 뺀 나머지 — 「얇은」 몬스터 도구.
 * 이 도구가 **빈 시작 맵뿐인 새 프로젝트**에서 처음 불리면(라우팅이 의도 문장을 놓친 자유 경로, 2026-10-16 잠금 누수 감사 #2) toolRunner 가 도구를 돌리기 전에
 * 몬스터 키트 시작 + 장르 잠금을 건다 — 안 그러면 표지(system.genre)만 붙고 주인공이 RTP Actor1 그대로 남는다. 맵이 있는 기존 프로젝트는 표지만 남긴다(소급 잠금 금지).
 */
export function monsterToolStartsLock(toolName: string): boolean {
  return toolName !== "configure_monster_system" && !toolName.startsWith("build_monster_") && MONSTER_MARKER_TOOLS.has(toolName);
}
const MONSTER_MARKER_TOOLS: ReadonlySet<string> = new Set([
  "build_monster_game", "build_monster_tournament", "build_monster_expedition", "define_monster_species", "define_monster_families", "rename_monster_species",
  "give_starter_monsters", "place_trainer", "place_monster_center", "place_monster_pc", "set_encounter_table", "configure_monster_style",
]);

/**
 * 잠금이 없을 때의 장르 표지 안내. 몬스터 수집 표지(system.genre)가 있는데 잠금이 없으면 — 기존 맵 때문에 못 걸었거나 사용자가 풀었다 —
 * 조수가 매 턴 「이 프로젝트는 몬스터 수집 게임」이라는 걸 알게 한다. 막지는 않는다(안내만).
 */
export function genreMarkerNote(project: Project): string | null {
  if (project.system.genre !== MONSTER_MARKER_GENRE || activeGenreLock(project)) return null;
  const def = GENRE_LOCK_PRESETS["monster-collect"];
  return `[장르 표지 — ${def.label}] 이 프로젝트는 몬스터 수집 게임으로 정해져 있다(system.genre). 칩셋·캐릭터 잠금은 꺼져 있다(기존 맵이 다른 계열이거나 사용자가 풀었다) — 막지는 않지만, `
    + `사용자가 다른 풍경·그림을 시키지 않았다면 새 맵은 monster_* 칩셋 계열로 만든다. ${def.charsets!.promptLine} `
    + `잠금을 다시 켜려면 ${def.relockHint}.`;
}

/** 프로젝트를 통째로 갈아 끼우거나 되돌리는 도구 — 결과가 새 프로젝트/이전 상태라 잠금 판정 대상이 아니다. */
export const GENRE_LOCK_EXEMPT_TOOLS: ReadonlySet<string> = new Set(["reset_project", "revert_last_edit"]);

export class GenreLockError extends Error {
  readonly mapId: string;
  constructor(message: string, mapId: string) {
    super(message);
    this.name = "GenreLockError";
    this.mapId = mapId;
  }
}

/**
 * 도구 실행이 만든 draft 가 잠금을 어기는지 판정하는 유일한 입구(toolRunner 가 부른다).
 * 대상 = 이번에 새로 생긴 맵 + tilesetId 가 바뀐 맵. enforce 면 첫 위반에서 GenreLockError, warn 이면 경고 문장 목록을 돌려준다.
 * 잠금 이전부터 있던 맵을 다른 칩셋으로 옮기지 않는 한 건드리지 않는다. approved = 사용자가 카드로 승인한 계열(그 계열 한정 허용).
 */
export function assertGenreLock(before: Project, draft: Project, args: { toolName: string; approved?: readonly string[] }): string[] {
  const active = activeGenreLock(draft);
  if (!active) return [];
  const warnings: string[] = [];
  for (const [id, next] of Object.entries(draft.maps)) {
    const previous = before.maps[id];
    if (previous && previous.tilesetId === next.tilesetId) continue;
    if (!genreLockMapViolation(draft, next, args.approved ?? [])) continue;
    const message = genreLockRejection(draft, { toolName: args.toolName, map: next });
    if (active.lock.mode === "enforce") throw new GenreLockError(message, id);
    warnings.push(`[경고 모드] ${message}`);
  }
  return warnings;
}

/**
 * tilesetId 를 생략해 도구 기본 칩셋이 들어갈 자리에 잠금 허용 칩셋을 넣는다. 도구 기본값이 이미 허용이면 undefined(그대로 둔다).
 * 조용한 교체가 아니다 — 호출부가 돌려준 note 를 도구 결과 경고로 싣는다.
 */
export function genreLockDefaultTileset(project: Project, defaultTilesetId: string, hint: string): { tilesetId: string; note: string } | undefined {
  const active = enforcingGenreLock(project);
  if (!active || genreLockAllowsTileset(project, defaultTilesetId)) return undefined;
  const alt = genreLockAlternative(project, hint);
  if (!alt) return undefined;
  return {
    tilesetId: alt.tilesetId,
    note: `장르 잠금(${active.def.label}): 기본 칩셋 ${defaultTilesetId} 는 허용 계열이 아니라 ${alt.tilesetId}(${alt.use}) 로 만들었다. 다른 허용 칩셋이 맞으면 tilesetId 를 직접 지정하라.`,
  };
}

/** 잠금을 해제할 때 도구 결과·감사 로그에 싣는 문장. */
export const GENRE_LOCK_RELEASED_MARKER = "장르 잠금 해제됨";

export function genreLockReleasedNotice(project: Project, previous: GenreLock): string {
  const def = GENRE_LOCK_PRESETS[previous.preset];
  const outsiders = Object.values(project.maps).filter((map) => !isWorldmapKitMap(map) && map.tilesetId !== "atlas_cartography" && !previous.allowedFamilies.includes(tilesetFamily(project, map.tilesetId)));
  return `${GENRE_LOCK_RELEASED_MARKER}: ${def.label} 칩셋 잠금(${previous.mode})을 껐다 — 이제 조수가 다른 계열 칩셋으로 맵을 만들 수 있다. 다시 막으려면 ${def.relockHint}을 켠다.`
    + (outsiders.length ? ` (이미 허용 밖 칩셋인 맵 ${outsiders.length}개: ${outsiders.slice(0, 5).map((map) => map.id).join(", ")}${outsiders.length > 5 ? " …" : ""})` : "");
}

export interface GenreLockReport {
  readonly active: boolean;
  readonly preset?: GenreLockPresetId;
  readonly mode?: GenreLockMode;
  readonly allowedFamilies: readonly string[];
  readonly allowedTilesets: readonly { id: string; name: string }[];
  /** 잠금을 켠 뒤에 생긴/바뀐 허용 밖 맵(조수·도구 경로가 못 막은 것 — 고쳐야 할 대상). */
  readonly violations: readonly GenreLockViolation[];
  /** 잠금을 켜기 전부터 있던 허용 밖 맵(막지 않는다 — 옮길지는 사용자가 정한다). */
  readonly preexisting: readonly GenreLockViolation[];
  /** 잠금을 켠 뒤에 생긴/바뀐 허용 밖 캐릭터 칩(맵 이벤트·배우·동료/파티 명령·전투 그림). 캐릭터를 안 잠그는 장르는 빈 배열. */
  readonly charsetViolations: readonly GenreLockCharsetOutsider[];
  /** 잠금을 켜기 전부터 있던 허용 밖 캐릭터 칩(막지 않는다). */
  readonly charsetPreexisting: readonly GenreLockCharsetOutsider[];
}

export function genreLockReport(project: Project, approved: readonly string[] = []): GenreLockReport {
  const active = activeGenreLock(project);
  if (!active) return { active: false, allowedFamilies: [], allowedTilesets: [], violations: [], preexisting: [], charsetViolations: [], charsetPreexisting: [] };
  const all = genreLockViolations(project, approved);
  const chips = genreLockCharsetOutsiders(project);
  return {
    charsetViolations: chips.filter((chip) => !chip.preexisting), charsetPreexisting: chips.filter((chip) => chip.preexisting),
    active: true, preset: active.lock.preset, mode: active.lock.mode, allowedFamilies: [...active.allowed],
    allowedTilesets: genreLockAllowedTilesets(project),
    violations: all.filter((v) => !v.preexisting), preexisting: all.filter((v) => v.preexisting),
  };
}
