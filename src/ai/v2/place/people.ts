// 조수 v2 — 사람(NPC) 빌더.
//
// 모델은 «누가·어디쯤·무슨 말»만 쓴다(PersonSpec). 칸 번호는 이 파일이 정한다:
//  - 자리 낱말(입구·광장·문 앞·…)을 실제로 걸어 닿는 칸으로 옮기고,
//  - 막힌 칸·문(이동) 칸·외길을 막는 칸은 후보에서 뺀 뒤,
//  - 놓은 칸을 막힌 칸으로 두고 길찾기를 다시 돌려 «전에 닿던 칸에 아직 다 닿는지» 확인한다.
// 놓기는 v1 place_npc, 그림은 graphic.query, 대사는 페이지(첫 만남 / 두 번째부터).
import type { Dir, GameEvent, GameMap, Project } from "@/project/types";
import { findNpcGraphicMatches, npcGraphicIntent, npcGraphicIsPlain, npcGraphicLabelNamedBy, npcGraphicNamedBy, npcGraphicPersonQuery, npcGraphicWantedLook, queryNpcGraphics } from "@/assets/charsetQuery";
import { charsetFamilyOf } from "@/project/charsetFamily";
import { artGapLine, parseArtGap } from "@/project/artGap";
import { sharedCharsetRow } from "@/project/sharedCharacterFaceResolver";
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { activeMonsterTurn } from "@/project/genreLockMonsterAssets";
import { monsterAssetCatalogFilters } from "@/project/genreLockMonsterAssetsDiff";
import { genreLockCharsetCatalogFilter } from "@/project/genreLockCharsets";
import type { BuildRun, ContentBuildResult, PersonSpec } from "../shared/types";
import { exitThroats, laneCells, wanderReach } from "./placementRules";
import { Cell, findMap, eventsOf, eventBlockers, walkStart, keepsMapConnected } from "./cells";
import { resolveWhere } from "./where";
import { worldOf } from "./world";
import { bustOfChip, lookOfChip } from "../story/speakerBust";
import { faceLookOf } from "@/assets/faceLooks";

export const PEOPLE_CARD =
  "People spec: {role,name?,where?,at?,looks?,firstTalk?,laterTalk?,movement?,sells?,mapId?}. " +
  "role = a role like 문지기 (gatekeeper) · 촌장 (village chief) · 상인 (merchant) (also used to pick art — villagers never get monster or skeleton art; chips with a matching face come first). looks = appearance words (경비병 guard · 노인 old man · 소녀 girl · old woman). " +
  "where words: 입구·성문 (entrance/gate — roadside where the road leaves the map, facing the road) / 광장·가운데 (square/center) / 문 앞 (in front of the door) / «X 옆·앞·뒤» (beside/in front of/behind X: counter, bar, fireplace, well — found by chipset labels) / " +
  "한쪽·벽 쪽 (one side/by the wall) / 북쪽 벽 (north wall; also 남·동·서) / 구석 (corner) / 창가 (by the window) — add a room word (홀 hall · 부엌 kitchen · 침실 bedroom) to stay inside that room («홀 한쪽», «부엌 화덕 옆») / omit (near the start point). English words (entrance, center, behind the counter) also work. " +
  "at:{x,y} only when really needed — a blocked cell moves to the nearest walkable cell. " +
  "firstTalk = lines the first time you talk (array), laterTalk = lines from the second time on (array; omit to repeat the same lines). " +
  "movement: still (default, stays put) · wander (roams — switched to still near exit throats or roads) · patrol (treated as still). " +
  "The builder picks only spots that do not block paths and checks them with pathfinding after placing. Never stand people in the middle of a road or rail track — sidewalk, inside a shop, bench, behind a counter or by a door. " +
  "sells:[{item:'회복약', price?}] makes the person a shopkeeper in the same call (talk → lines → buy/sell shop); item is an item or equipment name or id. " +
  "Shopkeepers and clerks get where «카운터 뒤» (behind the counter) — they stand on the counter's north (owner) side; in front of the counter is the customer spot.";

// ───────────────────────── 그림 고르기 ─────────────────────────

// v1 charset 검색은 «경비병·문지기·촌장» 같은 역할 낱말을 모른다. 역할·외형 낱말을 아는 질의로 바꾸고, 후보 중에서
// 마을 사람에게 맞지 않는 그림(몬스터·언데드·해골 투구)을 빼고, 검토된 짝 얼굴이 있는 그림을 먼저 고른다
// (2026-10-23 v1/v2 눈가림 비교: v2 문지기가 해골 투구 갑옷(적처럼 읽힘)에 얼굴 없음).
const ROLE_LOOKS: ReadonlyArray<readonly [RegExp, readonly string[], ("male" | "female")?]> = [
  [/경비|문지기|수문장|파수|위병|보초|병사|군인|초병|guard|sentry|gatekeeper|soldier|watchman/i, ["병사", "guard"], "male"],
  [/촌장|이장|장로|원로|마을 ?어른|elder|chief|headman|mayor/i, ["할아버지", "노인", "대머리"], "male"],
  [/우두머리|두목|단장|대장|leader|captain|blacksmith/i, ["아저씨"], "male"],
  // 청사진 단계 이름의 직함(2026-10-28 standin joseon·magic: 포졸·주모·종사관·교수·사서가 전부 「중년 남성 주민」이 됐다).
  [/포졸|포교|나졸|군졸|순라/i, ["병사", "guard"], "male"],
  [/종사관|사또|대감|양반|관원|나리|선비|영주|귀족|(?:^|\s)대신(?:\s|$)|재상|noble|lord|vizier|minister/i, ["귀족", "노학자"], "male"],
  [/주모|여주인|안주인|주인댁/i, ["아줌마", "여관 주인"], "female"],
  [/교장|학장|headmaster|principal/i, ["교수", "노학자"]],
  [/교수|박사|학자|연구원|professor|scholar|researcher/i, ["교수", "노학자", "박사"]],
  [/사서|librarian/i, ["사서", "노학자"]],
  [/선생|교사|스승|teacher|tutor/i, ["선생", "교수"]],
  [/의사|doctor|medic/i, ["박사", "연구원"]],
  [/할머니|노파|old woman|grandma/i, ["할머니", "노인"], "female"],
  [/할아버지|노인|영감|old man|grandpa/i, ["할아버지", "노인", "대머리"], "male"],
  [/여관|찻집 ?주인|주막 ?주인|바텐더|술집 ?주인|주점 ?주인|innkeeper|bartender|barkeep/i, ["여관 주인", "상인"]],
  [/상인|장사|점원|가게|행상|merchant|shopkeeper|vendor|clerk|peddler/i, ["상인", "여관 주인"]],
  [/소녀|여자아이|girl/i, ["소녀", "아이"], "female"],
  [/소년|남자아이|boy/i, ["소년", "아이"], "male"],
  [/청년/u, ["청년"], "male"],
  [/아이|꼬마|어린이|child|kid/i, ["아이"]],
  [/기사|knight|paladin/i, ["기사", "병사"]],
  [/마법사|마녀|wizard|mage|witch/i, ["마법사"]],
  [/신부|사제|수녀|성직자|priest|monk|nun|cleric/i, ["사제", "priest"]],
  [/(?<!여)왕(?![비녀])|술탄|황제|king|sultan|emperor/i, ["king"], "male"],
  [/농부|농사|farmer/i, ["아저씨", "주민"]],
  [/아주머니|아줌마|부인|여성|woman/i, ["아줌마", "여성"], "female"],
  [/아저씨|남성|man\b/i, ["아저씨", "남성"], "male"],
];
const HOSTILE = /몬스터|언데드|해골|스켈레톤|좀비|유령|악마|뱀파이어|오크|고블린|슬라임|마물|monster|undead|skeleton|zombie|ghost|demon|vampire|orc|goblin|slime/i;

const CHILD_LOOK = /아이|어린이|소년|소녀|꼬마|child|kid|boy|girl/iu;
const ODD_LOOK = /이국|터번|닌자|요정|난쟁이|수녀|해적|광대|ninja|fairy|dwarf|nun|pirate|clown/i;

interface PersonGraphic {
  readonly textureKey: string;
  readonly characterIndex: number;
  readonly label: string;
  readonly faceResourceId?: string;
  readonly query: string;
  /** 이 게임의 다른 사람이 이미 그 칩(또는 같은 모습·같은 흉상)으로 서 있다 — 남는 맞는 칩이 없어 나눠 쓰게 된 것. */
  readonly shared?: true;
  /** 글이 가리킨 칩(이름)이 표에는 있는데 이 게임이 쓸 수 없어 성별·나이가 가장 가까운 칩이 대신 섰다 — 그 바란 칩의 이름. 없는 그림 줄로 적는다. */
  readonly wanted?: string;
}

/** 역할·외형 낱말 → v1 이 알아듣는 질의 순서(중복 제거, 마지막은 주민). */
function graphicQueries(looks: string | undefined, role: string | undefined, generic?: { from: number }): string[] {
  const out: string[] = [];
  const add = (q: string | undefined): void => {
    const t = (q ?? "").trim();
    if (t && !out.includes(t)) out.push(t);
  };
  for (const word of [looks, role]) {
    add(word);
    for (const [re, alts] of ROLE_LOOKS) if (word && re.test(word)) for (const a of alts) add(a);
  }
  // 이름이 섞인 글(«오르텐 할멈»)은 통째로는 0건이다 — 그 글에서 성별·나이로 읽힌 낱말만으로 한 번 더 묻는다(칩 검색의 낱말 표).
  // 여기서부터는 그 사람의 일·차림을 말하지 않는 검색어다(성별·나이 낱말뿐, 그리고 «villager») — 고르는 쪽이 역할 검색어의 칩 뒤에 둔다.
  if (generic) generic.from = out.length;
  for (const word of [looks, role]) add(word ? npcGraphicPersonQuery(word) : undefined);
  add("villager");
  return out;
}

function wantedGender(looks: string | undefined, role: string | undefined): "male" | "female" | undefined {
  for (const word of [looks, role]) for (const [re, , g] of ROLE_LOOKS) if (word && g && re.test(word)) return g;
  return undefined;
}

/**
 * 벌점 단(작을수록 먼저). 이름 없는 무리: 어긋난 칩(misfit)은 흉상 유무(250)와 검색어 단 차이를 합친 것보다 크고 이름으로 돌려 고르는 마지막 단(1000)보다 작다,
 * 말하지 않은 차림(unasked: 왕관·메이드복·갑옷·토끼 귀·승복…)은 그 마지막 단보다 크다 — 주민을 한 번 더 쓰는 것이 다른 사람 옷을 입히는 것보다 낫다. 쓴 칩은 조금씩만 밀어 고르게 다시 쓴다.
 * 이름 있는 사람(ownFace)은 단이 서로 섞이지 않는다(아랫단을 다 더해도 윗단보다 작다): 이 게임에 안 선 맞는 칩 → 이미 선 칩(reused) → 다른 화풍(offFamily) →
 * 말하지 않은 차림 → 글이 말한 성별·나이와 어긋난 칩 → 주인공과 같은 모습. 남는 맞는 칩이 있는 한 이름 있는 두 사람이 한 얼굴로 서지 않는다.
 * lean: 역할 표의 기본 성별(장로·문지기 = 남성)과 다른 칩 — 이름 있는 사람은 이름으로 돌려 고르는 마지막 단(1000 + 검색어 단)보다 무겁다(둘째 촌장이 노파로 서지 않고 다른 남자 주민으로), 이미 선 칩보다는 가볍다.
 * ageNear: 글이 말한 나이의 이웃 나이(청년 ↔ 중년) — 이름 있는 사람은 말한 나이의 안 선 칩이 어느 검색어에든 있으면 그 칩이 먼저다(역할 낱말의 «아저씨» 가 «농부 청년» 을 이기지 않게).
 */
const CROWD = { misfit: 600, lean: 25, ageNear: 0, reused: 0, offFamily: 0, unasked: 1100, heroTwin: 5000 } as const;
const NAMED = { misfit: 48000, lean: 1600, ageNear: 1200, reused: 6000, offFamily: 12000, unasked: 24000, heroTwin: 96000 } as const;
const AGES = ["child", "youth", "middle", "elder"] as const;

/**
 * 이름으로 돌려 고를 후보 — 역할을 못 알아들은 이름에는 «그냥 주민» 만 선다. 이 맵 화풍의 칩 가운데 칩 설명에 «주민» 이 붙고 그 사람에게 맞는 것(fit)만
 * 남긴다. 주민 꼬리표가 붙은 칩이 셋이 안 되는 화풍(현대 학생 칩)은 그 화풍의 맞는 사람 칩 전부를 쓴다(plainFamily = false).
 * 왜(2026-11-12 r1s-fun): 사람 칩 60칸 전체를 돌렸더니 «오르텐 할멈» 이 왕, «마을 주민 다래» 가 공주, «선원» 이 갑옷 기사, «나디아» 가 메이드로 섰다 —
 * 왕·공주·메이드·기사·수녀 칩은 그 역할을 말했을 때 검색어 단에서만 나온다. 안 맞는 칩(아이·특이한 차림)을 돌리기 전에 빼야 이름마다 고르게 갈린다
 * (넣고 돌리면 그 자리에 걸린 이름이 모두 다음 칩 하나로 몰린다). 맞는 주민이 둘뿐이면(여자 주민) 그 둘만 돈다 — 모자란다고 여왕·토끼 귀를 끼우지 않는다.
 */
function plainPeople<T extends { readonly entry: { readonly textureKey: string; readonly tags: readonly string[] } }>(map: GameMap, people: readonly T[], fit: (m: T) => boolean, own: (m: T) => boolean): { readonly pool: readonly T[]; readonly plainFamily: boolean } {
  const family = people.filter((m) => familyFits(map, m.entry.textureKey));
  const plainAll = family.filter((m) => m.entry.tags.includes("주민") || own(m));
  if (plainAll.length >= 3) {
    const plain = plainAll.filter(fit);
    // 맞는 그냥 사람이 없으면(현대 칩의 사복은 모두 청년 — 노인을 청했다) 이 화풍의 맞는 칩 전부에서 고른다. 그것도 없을 때만 안 맞는 그냥 사람.
    const fitting = plain.length ? plain : family.filter(fit);
    return { pool: fitting.length ? fitting : plainAll, plainFamily: true };
  }
  const fitting = family.filter(fit);
  // 주민 꼬리표가 없는 화풍(현대 칩)에서는 맞는 칩 가운데 사복 칩이 그냥 사람이다 — 역할을 못 알아들은 사람이 교복·앞치마로 서지 않게(순경 = 여학생).
  const everyday = fitting.filter((m) => m.entry.tags.includes("사복"));
  return { pool: everyday.length ? everyday : fitting.length ? fitting : family.length ? family : people, plainFamily: false };
}

/**
 * 이 맵 화풍의 기본 칩 계열인가 — 판타지(버들항·손 도트 실내) 맵에는 EasyRPG 사람 칩, 현대 맵에는 현대 칩. 벽이 아니라 기본값이다:
 * 글이 이름으로 부른 칩은 다른 계열이어도 선다(pickPersonGraphic 의 named).
 * 현대 맵에서 «판타지 RTP 가 아닌 것은 다 현대» 로 보던 탓에 마법 학교 칩·REFMAP 변형 인물(중세 마을 사람)이 현대 거리의 기본 칩으로 섰다
 * (2026-11-16 확인 빌드 r6b: 편의점 점원 = «마법 상점 직원», 서점 주인 = «노년 지팡이 장인», 하교하는 학생 = «부엉이 우편 담당 학생»).
 * hostile = 적으로 청한 사람(해골 병사) — 판타지 맵에서는 몬스터 칩이 제 계열이다(사람 병사 칩으로 서지 않게).
 */
function familyFits(map: GameMap, textureKey: string, hostile = false): boolean {
  const modern = /jp_|modern|city_modern|campus|school|office/i.test(map.tilesetId);
  const family = charsetFamilyOf(undefined, textureKey);
  const fantasyChip = /^tex_easyrpg_charset_(people|actor)|^tex_(oprn_charset_)?scarloxy_(charset_)?people/i.test(textureKey);
  if (!modern) return fantasyChip || (hostile && (family === "rtp-creature" || family === "oprn-creature"));
  if (family === "wizarding") return /wizard/i.test(map.tilesetId);
  return !fantasyChip && family !== "refmap-doll" && family !== "heroes";
}

/**
 * 역할·외형에 맞는 «우호적인 사람» 칩 하나. 몬스터·언데드는 역할 자체가 그것일 때만, 짝 얼굴 있는 칩 먼저, 맵 화풍 계열 먼저,
 * 같은 맵에 이미 쓴 칩은 뒤로.
 */
export function pickPersonGraphic(project: Project, map: GameMap, role: string | undefined, looks: string | undefined, ownFace = false): PersonGraphic | undefined {
  const asked = `${role ?? ""} ${looks ?? ""}`;
  const hostileOk = HOSTILE.test(asked);
  // 성별: 글에서 읽힌 것(칩 검색과 같은 낱말 표 — «오르텐 할멈» = 여성, «여성 촌장» = 여성)은 꼭 지킨다(어긋나면 MISFIT).
  // 역할 표의 기본(촌장·문지기 = 남성)은 글이 말하지 않았을 때의 가벼운 기울기일 뿐이다 — 표의 낱말은 느슨해서(«왕» 이 «여왕» 에도 걸린다) 꼭 지키면 여왕이 왕으로 선다.
  const overrides = (project as unknown as { charsetLabels?: Parameters<typeof queryNpcGraphics>[2] }).charsetLabels;
  const text = npcGraphicIntent(asked);
  // 글이 성별·나이를 말하지 않았으면 그 낱말이 가리키는 칩이 말한다 — 이 게임이 그 칩을 못 써도(다른 계열·잠금) «어떤 사람인가» 는 칩 표가 안다.
  // 왜(2026-11-16 확인 빌드 r6): «순경»(경찰관 칩은 몬스터 수집 전용)이 이름으로 돌려 고른 «여학생 · 양갈래» 로, «젊은 어부» 가 «젊은 여성» 으로,
  // «중년 여인 상인» 이 남자 «여관 주인» 으로 섰다 — 낱말에 맞는 칩이 표에 있는데 그 모습을 읽지 않고 아무 사람이나 세웠다.
  // 칩을 이름으로 부르는 것은 looks(그림 낱말)다 — role 은 직함이라(«선원» · «사냥꾼») 그 사람의 성별만 읽고 칩을 고르지는 않는다(역할을 못 알아들은 이름은 주민 칩).
  const lookWanted = hostileOk || !looks?.trim() ? undefined : npcGraphicWantedLook(looks, overrides);
  const wantedLook = lookWanted ?? (hostileOk || !role?.trim() ? undefined : npcGraphicWantedLook(role, overrides));
  const leaning = text.gender ? undefined : wantedGender(looks, role);
  const said = text.gender ?? (leaning ? undefined : wantedLook?.gender), saidAge = text.age;
  // 이 맵에서 그 칩을 쓴 사람 수 — 쓴 만큼 뒤로 민다(15씩 네 번까지 = 60, 특이한 차림 80보다 작게). 한 번만 밀면 주민 칩을 다 쓴 뒤의 사람이 모두 첫 칩 하나로 몰린다.
  const used = new Map<string, number>();
  for (const e of eventsOf(map)) {
    const g = e.pages?.[0]?.graphic as { sprite?: { id?: string }; pattern?: number } | undefined;
    if (g?.sprite?.id && typeof g.pattern === "number" && g.pattern >= 3) { const k = `${g.sprite.id}#${decodeCharsetFrameIndex(g.pattern).characterIndex}`; used.set(k, (used.get(k) ?? 0) + 1); }
  }
  // 주인공(시작 파티) 칩은 NPC 에 쓰지 않는다 — 2026-10-29 vm mystery: 용의자 「마부 한스」가 탐정 주인공과 같은 칩으로 서 있었다.
  const resKey = (s: string) => s.replace(/^tex_/u, "").replace(/[_-]/gu, "").toLowerCase();
  const partyChips = (project.system?.startActorIds ?? []).flatMap((id) => {
    const actor = project.database.actors.find((a) => a.id === id) as { characterResourceId?: string; characterIndex?: number } | undefined;
    return actor?.characterResourceId ? [{ id: actor.characterResourceId, index: actor.characterIndex ?? 0 }] : [];
  });
  const heroes = new Set(partyChips.map((chip) => `${resKey(chip.id)}#${chip.index}`));
  // 주인공과 같은 사람으로 읽히는 칩도 쓰지 않는다 — 다른 시트의 같은 인물(같은 흉상, 또는 성별·나이·머리가 모두 같은 칩).
  // 왜(2026-11-13 r3b-fun): 대장장이가 people1 의 «푸른 머리 청년» 으로 섰다 — 주인공(actor4 «파란 머리 청년»)과 시트만 다른 같은 모습이라 둘이 쌍둥이로 보였다.
  const heroLooks = new Set(partyChips.map((chip) => lookOfChip(chip.id, chip.index)).filter((look): look is string => !!look));
  const heroBusts = new Set(partyChips.map((chip) => bustOfChip(chip.id, chip.index)).filter((bust): bust is string => !!bust));
  let best: (PersonGraphic & { score: number; generic: boolean }) | undefined;
  // 장르 잠금(몬스터 수집·현대 연애)이 강제 중이면 허용 칩만 — 막힌 칩을 골라 place_npc 가 거부하던 길을 미리 막는다.
  // 저절로 정해진 사람 칩 계열은 벽이 아니라 기본값이다 — 맵 화풍에 맞는 계열을 아래에서 먼저 고르고, 다른 계열의 꼭 맞는 칩(«어부»)도 본다. 장르 잠금과 사용자가 고른 계열만 거른다.
  const allowed = genreLockCharsetCatalogFilter(project, true);
  // 몬스터 수집 전용 칩(Scarloxy 트레이너·주민)은 몬스터 수집 게임이 아니면 고르지 않는다 — 도구 실행 구간 밖에서 부르면 카탈로그 필터가 없어
  // 그 칩이 뽑혔고, 뒤이은 upsert_event 가 «몬스터 수집 잠금»으로 거절돼 청사진 경로가 통째로 안 지어졌다(2026-11-10 worldProbe «촌장 하르»).
  const monsterOk = monsterAssetCatalogFilters(project, activeMonsterTurn())?.charset;
  const genericTier = { from: Number.POSITIVE_INFINITY };
  const queries = graphicQueries(looks, role, genericTier);
  // 글이 이름으로 부른 칩(«젊은 어부» ↔ «어부 · 파란 줄무늬»)은 이 맵의 기본 계열이 아니어도 그대로 선다 — 계열은 기본값이지 벽이 아니다.
  const namedBy = (e: { readonly label: string }): boolean => !!looks?.trim() && npcGraphicLabelNamedBy(looks, e as never);
  type Entry = ReturnType<typeof queryNpcGraphics>[number]["entry"];
  // 그 사람에게 안 맞는 칩: 글이 말한 성별과 다르다 · 아이가 아닌데 아이 칩.
  // 나이는 두 단 넘게 어긋날 때만(«할배» 에 청년 칩 · «소녀» 에 중년 칩) — 이웃 나이(노인 ↔ 중년)는 맞는 것으로 친다.
  // 칩이 데려오는 흉상의 나이도 같은 자로 잰다 — 칩은 «중년» 인데 그 흉상은 «젊은 여성» 인 칸이 있다(2026-11-15 은행 r2t-fun: «노인» 요른이 그 칩으로 서서 게임 검사가 «나이 든 인물인데 젊은 얼굴» 을 짚었다).
  const far = (age: string | undefined): boolean => !!saidAge && !!age && Math.abs(AGES.indexOf(saidAge) - AGES.indexOf(age as (typeof AGES)[number])) >= 2;
  const misfitFor = (e: Entry): boolean => (!!said && !!e.gender && e.gender !== "none" && e.gender !== said) || ((e.age === "child" || CHILD_LOOK.test(e.label)) && !CHILD_LOOK.test(asked))
    || far(e.age) || far(faceLookOf(bustOfChip(e.textureKey, e.characterIndex) ?? "")?.age);
  // 특이한 차림(이국 터번·닌자·요정·난쟁이·수녀)은 그렇게 말했을 때만 — 마을 촌장이 터번 노인으로 나왔다.
  // 이 세계 사람들의 옷(사막의 터번·전통옷)은 이 게임에서 그냥 주민의 옷이다 — 특이한 차림도 말하지 않은 차림도 아니다.
  const dress = worldOf(project)?.dress;
  const native = (e: Entry): boolean => !!dress && e.tags.includes(dress);
  const plainFor = (e: Entry): boolean => npcGraphicIsPlain(e) || native(e);
  const oddFor = (e: Entry): boolean => !native(e) && ODD_LOOK.test(`${e.label} ${e.tags.join(" ")} ${e.textureKey}`) && !ODD_LOOK.test(asked);
  // 다른 맵에서 이미 쓴 칩(게임 전체) — 같은 맵만큼은 아니어도 뒤로 민다(게임의 사람들이 서로 달라 보이게).
  // heldBusts: 이 게임에 선 사람들의 흉상 — 칩이 달라도 흉상이 같으면 대화창에서 같은 얼굴이다.
  const usedElsewhere = new Set<string>(), heldBusts = new Set<string>();
  for (const other of Object.values(project.maps)) for (const e of eventsOf(other)) {
    const g = e.pages?.[0]?.graphic as { sprite?: { id?: string }; pattern?: number } | undefined;
    if (!g?.sprite?.id || typeof g.pattern !== "number" || g.pattern < 3) continue;
    const index = decodeCharsetFrameIndex(g.pattern).characterIndex, bust = bustOfChip(g.sprite.id, index);
    if (other.id !== map.id) usedElsewhere.add(`${g.sprite.id}#${index}`);
    if (bust) heldBusts.add(bust);
  }
  const T = ownFace ? NAMED : CROWD;
  // 마지막 질의(«villager» — 역할 낱말을 못 알아들었거나 알아들은 칩이 이 맵에 안 맞을 때의 기본)는 이름으로 사람 칩을 돌려 고른다 — 순위 1등 고정이면 «족장 바라»·«무당 누리»·«동굴 지기 아루»가
  // 모두 같은 「중년 남성 주민」으로 섰다(2026-11-10 Terra fun-w2: 사람 다섯이 한 얼굴).
  const nameHash = [...asked.trim()].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
  // 이름으로 돌려 고를 때는 주민 한 줄(«villager» 4명)이 아니라 사람 칩 전체(«마을 사람»)에서 고른다.
  // 돌리기 전에 이 게임이 못 쓰는 칩(장르 잠금·몬스터 수집 전용)도 뺀다 — 넣고 돌리면 그 자리에 걸린 이름이 다음 칩으로 몰린다.
  // hasPlain: 이 화풍에 그냥 주민 칩이 있는가 — 있을 때만 말하지 않은 차림의 칩을 뒤로 민다(현대 칩처럼 주민 꼬리표가 없는 화풍은 순위 그대로).
  // 표 전체에서 고른다(자르지 않는다) — 사람 칩 계열이 검색을 좁히지 않게 된 뒤로는 앞쪽 예순 칸이 다른 화풍(REFMAP 변형 인물 2,567명)으로 찬다.
  const townsfolk = findNpcGraphicMatches("마을 사람", overrides).filter((m) => (!allowed || allowed(m.entry)) && (!monsterOk || monsterOk(m.entry)));
  const fitsPerson = (m: (typeof townsfolk)[number]): boolean => !misfitFor(m.entry) && !oddFor(m.entry);
  const { pool: wide, plainFamily: hasPlain } = plainPeople(map, townsfolk, fitsPerson, (m) => native(m.entry));
  // 이름 있는 사람: 주민 꼬리표 칩 뒤에 꼬리표 없는 그냥 사람 칩(차림 꼬리표가 없는 «노파»)을 잇는다 — 주민 칩이 모두 선 뒤 같은 얼굴 둘이 되기 전에 그 칩이 선다.
  // 왜(2026-11-15 확인 빌드 r5): 역할을 못 알아들은 «회관 서기» 가 주민 넷이 다 선 뒤 «등대지기» 와 같은 콧수염 칩으로 섰다 — 안 선 노파 칩은 후보에도 없었다.
  // 이름으로 부른 다른 화풍의 칩은 이 맵의 기본 계열에 그 역할의 맞는 칩이 없을 때만 선다(«학생» 은 현대 칩에 남학생이 있다 — 중세 인형 학생을 세우지 않는다).
  const usable = (e: Entry): boolean => (!allowed || allowed(e)) && (!monsterOk || monsterOk(e));
  // 이름으로 부른 칩이 있을 때만 잰다(검색 한 번씩이 든다).
  let homeHasRole: boolean | undefined;
  const named = (e: Entry): boolean => namedBy(e) && !(homeHasRole ??= queries.slice(0, genericTier.from).some((q) => queryNpcGraphics(q, 120, overrides).some((m) => familyFits(map, m.entry.textureKey, hostileOk) && usable(m.entry) && !misfitFor(m.entry))));
  // 노인을 말했는데 이 맵의 기본 계열에 노인 칩이 하나도 없으면(현대 칩) 다른 계열의 노인 칩도 제 칩으로 친다 — 계열은 기본값이지 벽이 아니다.
  // 왜(2026-11-16 확인 빌드 r6b): 「산책하는 할머니」 가 중년 «정장 여» 로 섰다(노인 칩은 REFMAP 변형 인물에만 있다).
  let homeHasElder: boolean | undefined;
  const elderAway = (e: Entry): boolean => saidAge === "elder" && e.age === "elder" && usable(e)
    && !(homeHasElder ??= findNpcGraphicMatches("노인", overrides).some((m) => familyFits(map, m.entry.textureKey, hostileOk) && m.entry.age === "elder" && usable(m.entry)));
  const spare = ownFace && hasPlain ? townsfolk.filter((m) => familyFits(map, m.entry.textureKey) && plainFor(m.entry) && fitsPerson(m) && !wide.includes(m)) : [];
  queries.forEach((q, qi) => {
    const spin = qi === queries.length - 1, generic = qi >= genericTier.from;
    // 이름 있는 사람은 이 맵 화풍의 칩을 앞에 세워 서른을 자른다 — 다른 화풍 칩이 많은 낱말(«상인»)에서 이 화풍의 둘째 칩이 잘려 나가면 이름 있는 두 상인이 한 칩으로 선다.
    // 이 맵의 기본 계열 칩을 앞에 세워 서른을 자른다 — 다른 화풍 칩이 많은 낱말(«상인» · «학생»)에서 이 화풍의 칩이 잘려 나가지 않게.
    const found = spin && wide.length >= (hasPlain ? 1 : 3) ? wide : queryNpcGraphics(q, ownFace ? 120 : 30, overrides);
    const mine = (m: (typeof found)[number]): boolean => familyFits(map, m.entry.textureKey, hostileOk) || (!generic && named(m.entry)) || elderAway(m.entry);
    const matches = found === wide || !ownFace ? found : [...found.filter(mine), ...found.filter((m) => !mine(m))].slice(0, 30);
    const rotate = spin && matches.length > 1 ? nameHash % matches.length : 0;
    [...matches, ...(found === wide ? spare : [])].forEach((m, rank0) => {
      const rank = rotate && rank0 < matches.length ? (rank0 - rotate + matches.length) % matches.length : rank0;
      const e = m.entry;
      const text = `${e.label} ${e.tags.join(" ")} ${e.textureKey}`;
      // 「몬스터 수집」 장르 꼬리표가 붙은 사람 칩(Scarloxy 트레이너·주민)은 적이 아니다 — 그 낱말을 빼고 적 낱말을 본다.
      const hostileText = text.replace(/몬스터 ?수집|monster[- ]?collect(ion|ing)?/giu, "");
      if (!hostileOk && (HOSTILE.test(hostileText) || /monster/i.test(e.textureKey))) return;
      if (allowed && !allowed(e)) return;
      if (monsterOk && !monsterOk(e)) return;
      const row = sharedCharsetRow(e.textureKey, e.characterIndex);
      const face = row?.status === "mapped" && row.faceResourceId ? row.faceResourceId : undefined;
      const key = `${e.textureKey}#${e.characterIndex}`;
      // 맵 화풍과 다른 계열은 얼굴 짝(70)보다 무겁게 친다 — 현대 편의점 점장이 얼굴 있는 판타지 RTP 주민 칩으로 뽑혔고, 첫 사람 칩이라 사람 칩 잠금이
      // RTP 로 걸려 뒤이은 행인의 현대 칩 검색(여학생)이 0 개가 됐다(2026-10-31 asst-parity 마왕 편의점 opus 후).
      // 대화창에 그 사람의 흉상이 뜨는 칩이 먼저다(story/speakerBust): 흉상 없는 칩은 검색어 두 단 반(250, 얼굴 낱장만 있으면 150)만큼 밀린다 —
      // 역할 검색어 어디든 흉상 있는 칩이 있으면 그 칩(촌장 = 얼굴 없는 터번 노인 → 흰 수염 노인).
      // 이 맵 화풍의 역할 칩이 하나라도 있으면 이름으로 돌려 고르는 마지막 단·다른 화풍 칩보다 늘 앞이다(1000) — 흉상이 없다고 여관 주인이 아무 주민으로 바뀌지 않는다.
      const fits = familyFits(map, e.textureKey, hostileOk) || (!generic && named(e)) || elderAway(e);
      // 흉상은 «맞는 칩» 안에서만 앞선다: 성별이 어긋나거나 아이가 아닌데 아이 칩이면(misfit) 흉상 유무(250)·검색어 단(100씩)보다 무겁다 —
      // 맞는 칩에 흉상이 없으면 흉상 없는 그 칩이 서고, 대화창에는 이름표만 뜬다(다른 사람 얼굴을 띄우지 않는다).
      const bust = bustOfChip(e.textureKey, e.characterIndex), mine = used.get(key) ?? 0;
      // 이름 있는 사람: 이 게임의 누가 이미 그 칩(또는 같은 흉상)으로 서 있으면 안 선 맞는 칩 뒤로(같은 맵에서 쓴 만큼 더).
      // 이름 없는 무리는 쓴 만큼 조금씩만 밀어 주민 칩을 고르게 다시 쓴다(성별이 다른 칩·다른 검색어 단으로 넘어가지 않는다).
      const held = mine > 0 || usedElsewhere.has(key) || (!!bust && heldBusts.has(bust));
      const reuse = ownFace ? (held ? T.reused + 15 * Math.min(mine, 3) : 0) : mine ? 15 * Math.min(mine, 4) : usedElsewhere.has(key) ? 8 : 0;
      const heroTwin = heroes.has(`${resKey(e.textureKey)}#${e.characterIndex}`) || heroLooks.has(lookOfChip(e.textureKey, e.characterIndex) ?? "") || heroBusts.has(bust ?? "");
      const score = qi * 100 + rank + (bust ? 0 : face ? 150 : 250) + (fits ? 0 : 120 + T.offFamily) + (spin || !fits ? 1000 : 0)
        // 성별·나이를 적지 않은 칩(마법 학교 칩)은 말한 성별·나이에 «맞는 칩» 이 아니다 — 맞는지 모르는 칩이다. 적힌 칩의 이웃 나이·기운 성별과 같은 단으로 뒤에 둔다.
        + (misfitFor(e) ? T.misfit : saidAge && e.age && e.age !== saidAge ? T.ageNear : 0) + (leaning && e.gender && e.gender !== "none" && e.gender !== leaning ? T.lean : 0) + reuse + (heroTwin ? T.heroTwin : 0)
        // 이름 있는 사람에게는 특이한 차림(이 세계의 옷이 아닌 터번·닌자·요정)도 말하지 않은 차림이다 — 이미 선 칩을 다시 쓰는 것보다 뒤.
        + (ownFace ? 0 : oddFor(e) ? 80 : 0) + ((ownFace && oddFor(e)) || (hasPlain && !plainFor(e) && !npcGraphicNamedBy(`${asked} ${q}`, e)) ? T.unasked : 0);
      if (!best || score < best.score) best = { textureKey: e.textureKey, characterIndex: e.characterIndex, label: e.label, query: q, score, generic, ...(face ? { faceResourceId: face } : {}), ...(ownFace && held ? { shared: true as const } : {}) };
    });
  });
  if (!best) return undefined;
  const { score: _score, generic: byLookOnly, ...pick } = best;
  if (!byLookOnly || !lookWanted?.label || lookWanted.label === pick.label) return pick;
  // 글의 낱말을 모두 가진 칩이 표에 있는데 선 것은 성별·나이로만 고른 칩이다. 그 칩을 이 게임이 쓸 수 있으면 화풍이 달라도 그 칩이 선다
  // (오너 2026-11-16 «에셋을 자유롭게» — 계열은 기본값이지 벽이 아니다). 못 쓰는 칩(몬스터 수집 전용 · 장르 잠금)이면 고른 칩을 대역으로 두고 바란 칩의 이름을 남긴다(없는 그림 줄).
  // 다른 화풍의 칩으로 바꾸는 것은 글이 그 칩을 이름으로 불렀고(npcGraphicLabelNamedBy) 이 맵의 기본 계열에 그 역할의 맞는 칩이 없을 때만이다 — 위 named() 와 같은 규칙.
  // 「한 게임 한 화풍」은 구성기가 스스로 고를 때의 기본값이다(2026-11-16 명세 은행: «농부»·«중년 여인 상인» 이 RTP 맵에 인형 화풍 칩으로 섞여 섰다).
  const free = (lookWanted.chips ?? []).filter((e) => usable(e) && !misfitFor(e) && !heroes.has(`${resKey(e.textureKey)}#${e.characterIndex}`)
    && (familyFits(map, e.textureKey, hostileOk) || named(e)));
  const exact = free.find((e) => !used.has(`${e.textureKey}#${e.characterIndex}`) && !usedElsewhere.has(`${e.textureKey}#${e.characterIndex}`)) ?? free[0];
  if (!exact) return { ...pick, wanted: lookWanted.label };
  const row = sharedCharsetRow(exact.textureKey, exact.characterIndex);
  return { textureKey: exact.textureKey, characterIndex: exact.characterIndex, label: exact.label, query: pick.query, ...(row?.status === "mapped" && row.faceResourceId ? { faceResourceId: row.faceResourceId } : {}) };
}

/** 같은 사람인지 견주는 이름 — 끝의 괄호는 그 사람이 선 자리일 뿐이다(«농부 말순 (집)» = «농부 말순»). */
export const personKey = (name: string | undefined): string => (name ?? "").replace(/\s*[(（][^()（）]*[)）]\s*$/u, "").trim().toLowerCase();

/**
 * 이 게임 어디엔가 같은 이름으로 이미 선 사람의 칩 — 한 사람이 장소마다 다른 얼굴이 되지 않게(청사진 단계의 사람은 story/personName 이 같은 일을 한다).
 * 왜(2026-11-15 확인 빌드 r5): 밭의 «농부 말순» 은 중년 여성, 집 안의 «농부 말순 (집)» 은 금발 젊은 여성으로 섰다 — 이름 있는 두 사람이 한 칩을 나눠 쓰지 않게 하는 단이 같은 사람에게도 걸렸다.
 */
function standingChipOf(project: Project, name: string): PersonGraphic | undefined {
  const key = personKey(name);
  if (!key) return undefined;
  for (const map of Object.values(project.maps)) for (const e of eventsOf(map)) {
    if (personKey(e.name) !== key) continue;
    const g = e.pages?.[0]?.graphic as { sprite?: { id?: string }; pattern?: number } | undefined;
    if (!g?.sprite?.id || typeof g.pattern !== "number" || g.pattern < 3 || !/charset/iu.test(g.sprite.id) || /object/iu.test(g.sprite.id)) continue;
    const characterIndex = decodeCharsetFrameIndex(g.pattern).characterIndex, row = sharedCharsetRow(g.sprite.id, characterIndex);
    return { textureKey: g.sprite.id, characterIndex, label: `${(e.name ?? "").trim()} 의 앞선 모습`, query: "", ...(row?.status === "mapped" && row.faceResourceId ? { faceResourceId: row.faceResourceId } : {}) };
  }
  return undefined;
}

/** 놓은 NPC 의 모든 페이지 그림을 그 방향으로 돌려 세운다(문지기는 길 쪽을 본다). */
function faceNpc(run: BuildRun, mapId: string, eventId: string, dir: Dir): void {
  const map = findMap(run.ctx.project, mapId);
  const event = map ? eventsOf(map).find((e) => e.id === eventId) : undefined;
  (event?.pages ?? []).forEach((page, pageIndex) => {
    const g = page.graphic as { sprite?: unknown; pattern?: number; direction?: Dir } | undefined;
    if (!g?.sprite) return;
    const characterIndex = typeof g.pattern === "number" && g.pattern >= 3 ? decodeCharsetFrameIndex(g.pattern).characterIndex : 0;
    run.call("patch_event_page", { mapId, eventId, pageIndex, set: { graphic: { ...g, direction: dir, pattern: charsetFrameIndex({ characterIndex, direction: dir, pattern: 1 }) } } });
  });
}

// ───────────────────────── 사람 놓기 ─────────────────────────

function cleanLines(lines: readonly string[] | undefined): string[] {
  return (lines ?? []).map((s) => String(s).trim()).filter(Boolean);
}

/**
 * place_npc 한 번: 역할·외형에 맞는 우호적 사람 칩(짝 얼굴 우선)을 골라 {textureKey,characterIndex} 로 놓는다 — 대사가 있으면
 * place_npc 가 그 칩의 검토된 짝 얼굴을 대사 앞에 붙인다. 고른 칩으로 실패하면 질의 낱말 → 도구 기본 그림 순서로 물러난다.
 */
export function placeNpcWithGraphic(run: BuildRun, map: GameMap, baseArgs: Record<string, unknown>, role: string | undefined, looks: string | undefined, label: string, warnings: string[], ownFace = false): { result: ReturnType<BuildRun["call"]>; graphic?: PersonGraphic } {
  const graphic = (ownFace ? standingChipOf(run.ctx.project, label) : undefined) ?? pickPersonGraphic(run.ctx.project, map, role, looks, ownFace);
  if (graphic) {
    const result = run.call("place_npc", { ...baseArgs, graphic: { textureKey: graphic.textureKey, characterIndex: graphic.characterIndex } });
    if (result.ok) {
      if (!graphic.faceResourceId) warnings.push(`${label}: 고른 그림 '${graphic.label}' 에 검토된 짝 얼굴이 없어 대화창에 얼굴이 안 나온다.`);
      if (graphic.wanted) warnings.push(artGapLine({ want: "person", wanted: graphic.wanted, where: label, standIn: graphic.label, by: "add_people" }));
      return { result, graphic };
    }
  } else warnings.push(`${label}: 역할·외형(${[role, looks].filter(Boolean).join("·")})에 맞는 사람 그림을 못 찾았다.`);
  let result: ReturnType<BuildRun["call"]> | undefined;
  for (const q of graphicQueries(looks, role)) {
    result = run.call("place_npc", { ...baseArgs, graphic: { query: q } });
    if (result.ok) { warnings.push(`${label}: 그림을 질의 '${q}' 로 놓았다(직접 고르기 실패).`); return { result }; }
  }
  result = run.call("place_npc", baseArgs);
  if (result.ok) warnings.push(`${label}: 그림을 못 골라 도구 기본 그림으로 놓았다.`);
  return { result };
}

/**
 * 사람에게 상점을 단다(sells) — 이름으로 아이템·장비를 찾고, 없는 이름은 값만 있는 잡화로 만든 뒤 set_shop_stock 한 번.
 * 상점 주인 한 명에 호출 4~6번(아이템 조회 → 사람 → 이벤트 조회 → 재고)이 들던 것을 add_people 한 번으로 줄인다.
 */
function openShop(run: BuildRun, mapId: string, eventId: string, sells: PersonSpec["sells"], label: string, warnings: string[]): string {
  const wanted = (sells ?? []).filter((entry) => entry && typeof entry.item === "string" && entry.item.trim());
  if (!wanted.length) return "";
  const stock: { itemId: string; priceOverride?: number }[] = [];
  const made: string[] = [];
  for (const entry of wanted) {
    const key = entry.item.trim().toLowerCase();
    const db = run.ctx.project.database;
    const hit = [...db.items, ...db.equipment].find((record) => record.id.toLowerCase() === key || (record.name ?? "").trim().toLowerCase() === key);
    const price = typeof entry.price === "number" && Number.isFinite(entry.price) && entry.price >= 0 ? Math.trunc(entry.price) : undefined;
    let itemId = hit?.id;
    if (!itemId) {
      const id = `item_shop_${db.items.length + 1}`;
      const created = run.call("upsert_item", { item: { id, name: entry.item.trim(), price: price ?? 50, type: "normalGoods" } });
      if (!created.ok) { warnings.push(`${label}: could not create the item «${entry.item}» to sell — ${String(created.summary).slice(0, 140)}`); continue; }
      itemId = id;
      made.push(entry.item.trim());
    }
    if (!stock.some((s) => s.itemId === itemId)) stock.push({ itemId, ...(price !== undefined ? { priceOverride: price } : {}) });
  }
  if (!stock.length) return "";
  const set = run.call("set_shop_stock", { mapId, eventId, stock });
  if (!set.ok) { warnings.push(`${label}: shop not attached — ${String(set.summary).slice(0, 160)}`); return ""; }
  if (made.length) warnings.push(`${label}: new plain items were created to sell (${made.join(", ")}) — they have a price but no effect; give effects with upsert_item if they should heal or equip.`);
  return ` · shop ${stock.length} items (talk → buy/sell)`;
}

export function buildPeople(run: BuildRun, people: readonly PersonSpec[], mapId?: string): ContentBuildResult {
  const warnings: string[] = [];
  const eventIds: { mapId: string; eventId: string }[] = [];
  const mapIds = new Set<string>();
  const used: Cell[] = [];
  const notes: string[] = [];
  const firstCall = run.calls.length;
  let failed = 0;

  for (const person of people) {
    const targetMapId = person.mapId ?? mapId ?? run.ctx.currentMapId ?? run.ctx.project.startMapId;
    const label = person.name ?? person.role;
    const map = findMap(run.ctx.project, targetMapId);
    if (!map) {
      warnings.push(`${label}: 맵 '${targetMapId}' 이 없다.`);
      failed++;
      continue;
    }
    // 이미 이 맵에 같은 이름의 NPC 가 있으면 새로 세우지 않는다(2026-10-24 스위트: 대장장이 그림이 바뀌고 촌장이 둘이 됐다).
    //   그림·얼굴·자리는 그대로 두고, 대사를 준 경우에만 첫 페이지의 대사를 바꾼다(얼굴 명령은 남김).
    const existing = person.name ? eventsOf(map).find((e) => (e.name ?? "").trim().toLowerCase() === person.name!.trim().toLowerCase()) : undefined;
    if (existing && existing.pages?.length) {
      const lines = [...cleanLines(person.firstTalk), ...cleanLines(person.laterTalk)];
      if (lines.length) {
        const p0 = existing.pages[0]!;
        const keep = (p0.commands ?? []).filter((c) => (c as { kind?: string }).kind !== "text");
        const firstPage = { ...structuredClone(p0), commands: [...structuredClone(keep), ...lines.map((body) => ({ kind: "text", speaker: existing.name, body }))] };
        const up = run.call("upsert_event", { mapId: targetMapId, replacePages: true, event: { id: existing.id, pages: [firstPage, ...existing.pages.slice(1).map((pg) => structuredClone(pg))] } });
        if (!up.ok) warnings.push(`${label}: 기존 NPC 대사 고치기 실패 — ${String(up.summary).slice(0, 160)}`);
      }
      eventIds.push({ mapId: targetMapId, eventId: existing.id });
      mapIds.add(targetMapId);
      const shopNote = openShop(run, targetMapId, existing.id, person.sells, label, warnings);
      notes.push(`${label} — 이미 있는 NPC(${existing.id}) 를 그대로 씀(그림·자리 유지${lines.length ? ", 대사만 바꿈" : ""})${shopNote}`);
      continue;
    }
    // 바깥 맵에서는 같은 부름의 사람끼리 바로 옆에 붙여 세우지 않는다(마을 광장에 둘이 겹쳐 선 줄처럼 보였다) — 실내는 바 앞 손님처럼 붙어도 된다.
    const outdoor = (map as unknown as { climate?: { mode?: string } }).climate?.mode !== "indoor";
    const avoid = outdoor ? used.flatMap((c) => [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => ({ x: c.x + dx, y: c.y + dy })))) : used;
    // at {x:0,y:0} 은 모델이 빈 칸을 채운 자리표시다(2026-10-29 room-vig6 tavern: 셋 다 at (0,0) → 맵 왼쪽 위에서 가장 가까운 칸 (6,4)·(7,4)·(6,5) 에 몰렸다).
    // (0,0) 은 어느 맵에서나 벽·가장자리 칸이라 진짜 자리로 쓰지 않는다 — 자리 낱말(where)로 푼다.
    const at = person.at && !(person.at.x === 0 && person.at.y === 0) ? person.at : undefined;
    const where = resolveWhere(run.ctx.project, map, person.where, { at, avoid, role: `${person.role} ${person.name ?? ""}` });
    if (where.note) warnings.push(`${label}: ${where.note}`);
    const cell = where.cell;

    const first = cleanLines(person.firstTalk);
    const later = cleanLines(person.laterTalk);
    const pages: Record<string, unknown>[] = [];
    if (first.length > 0 && later.length > 0) {
      pages.push({ name: "첫 만남", lines: first, commands: [{ kind: "setSelfSwitch", key: "A", value: true }] });
      pages.push({ name: "다시 말 걸면", lines: later, conditions: [{ kind: "selfSwitch", key: "A", value: true }] });
    } else if (first.length > 0 || later.length > 0) {
      pages.push({ name: "대화", lines: first.length > 0 ? first : later });
    }

    let movement = person.movement === "wander" ? "random" : "fixed";
    if (movement === "random") {
      // 배회가 닿는 칸에 하나뿐인 출구 길목·차도가 있으면 제자리로 — 마을 동쪽 외길 출구에서 농부가 배회해 길을 막았다(2026-10-25 J5).
      const roam = wanderReach(run.ctx.project, map, { id: "__new__", x: cell.x, y: cell.y, pages: [] } as unknown as GameEvent);
      const throats = exitThroats(run.ctx.project, map);
      const lanes = laneCells(run.ctx.project, map);
      const hit = [...roam].find((i) => throats.has(i) || lanes.has(i));
      if (hit !== undefined) {
        movement = "fixed";
        warnings.push(`${label}: 배회하면 ${throats.has(hit) ? "하나뿐인 출구 길목" : "차도·선로"} (${hit % map.width},${Math.floor(hit / map.width)})까지 걸어가 길을 막을 수 있어 제자리(still)로 두었다.`);
      } else warnings.push(`${label}: wander 는 걸어 다니다 길목에 설 수 있어 «길을 막지 않는다» 보장이 약해진다.`);
    }
    if (person.movement === "patrol") warnings.push(`${label}: patrol 은 v1 에 순찰 경로 도구가 없어 제자리(fixed)로 두었다.`);

    const baseArgs: Record<string, unknown> = { mapId: targetMapId, name: label, x: cell.x, y: cell.y, movement };
    if (pages.length > 0) baseArgs.pages = pages;
    const placedNpc = placeNpcWithGraphic(run, map, baseArgs, person.role, person.looks, label, warnings, !!person.name?.trim());
    const result = placedNpc.result;
    if (!result.ok) {
      warnings.push(`${label}: 놓기 실패 — ${String(result.summary).slice(0, 160)}`);
      failed++;
      continue;
    }
    for (const w of result.warnings ?? []) warnings.push(`${label}: ${w}`);
    const data = (result.data ?? {}) as { eventId?: string; x?: number; y?: number; adjusted?: boolean };
    const placed = { x: data.x ?? cell.x, y: data.y ?? cell.y };
    used.push(placed);
    mapIds.add(targetMapId);
    if (data.eventId) eventIds.push({ mapId: targetMapId, eventId: data.eventId });
    if (data.eventId && where.face) faceNpc(run, targetMapId, data.eventId, where.face);
    const shopNote = data.eventId ? openShop(run, targetMapId, data.eventId, person.sells, label, warnings) : "";
    notes.push(`${label} (${placed.x},${placed.y})${where.how ? ` ${where.how}` : ""} · 그림 ${placedNpc.graphic ? `${placedNpc.graphic.label}${placedNpc.graphic.faceResourceId ? "+얼굴" : "(짝 얼굴 없음)"}` : "도구 기본"}${where.face ? ` · ${where.face} 를 봄` : ""}${shopNote}`);

    // 놓은 뒤 확인: 이 NPC 칸을 막고도 전에 닿던 칸에 다 닿는가.
    const after = findMap(run.ctx.project, targetMapId);
    if (after && movement === "fixed") {
      const blockers = eventBlockers(after);
      blockers.delete(placed.y * after.width + placed.x);
      const start = walkStart(run.ctx.project, after);
      if (!keepsMapConnected(run.ctx.project, after, start, placed, blockers)) {
        warnings.push(`${label}: (${placed.x},${placed.y}) 에 놓고 보니 길을 막는다 — 도구가 칸을 옮겼을 수 있다. 자리를 다시 정해야 한다.`);
      }
    }
  }

  const ok = failed === 0 && eventIds.length > 0;
  return {
    ok,
    mapIds: [...mapIds],
    summary: ok
      ? `사람 ${eventIds.length}명 놓음: ${notes.join(" / ")}`
      : `사람 ${people.length}명 중 ${failed}명 실패`,
    warnings: warnings.filter((w) => !parseArtGap(w)),
    missingArt: warnings.filter((w) => !!parseArtGap(w)),
    calls: run.calls.slice(firstCall),
    eventIds,
  };
}
