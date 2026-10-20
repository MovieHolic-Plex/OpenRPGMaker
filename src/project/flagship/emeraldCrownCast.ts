// 아스트라 호라이즌 등장인물 배선(2026-10-21 사용자 「chargen 으로 흉상·전신을 찍어라, 지금은 너무 허접하다」).
// - 이름 있는 인물의 대사마다 그 인물의 흉상(표정은 대사 내용으로 고른다)을 띄우고, 다른 화자로 넘어가거나 이벤트가 끝나면 지운다.
// - 전신은 트레이너 소개에서만 보인다(나루·유림·무영 앞모습 battle-trainers/astra_<id>, 주인공 뒷모습 astra_hero). 맵 장면에는 세우지 않는다.
// - 그림(스타터 카드 등)이 떠 있는 동안은 흉상을 내린다.
// 그림: src/assets/astraCast.ts(char-gen 산출물, 감독 선택, 원래 도트 크기).
import { ASTRA_CAST_EXPRESSIONS, astraCastBustId, astraCastCardId, type AstraCastExpression, type AstraCastId } from "@/assets/astraCast";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Command, Project } from "@/project/types";

const SPEAKERS: readonly [RegExp, AstraCastId][] = [
  [/^엄마$/u, "mom"],
  [/^천문박사$/u, "professor"],
  [/(^|· |라이벌 )나루$/u, "naru"],
  [/^센터 직원$/u, "nurse"],
  [/(^|· |관장 )유림$/u, "yurim"],
  [/(^|· )무영$/u, "muyeong"],
];
const castOf = (speaker: string | undefined): AstraCastId | undefined => speaker ? SPEAKERS.find(([re]) => re.test(speaker.trim()))?.[1] : undefined;

/** 대사 내용으로 표정을 고른다. 그 인물에게 없는 표정이면 기본. */
export function astraCastExpression(cid: AstraCastId, body: string): AstraCastExpression {
  const pick = (e: AstraCastExpression): AstraCastExpression => ASTRA_CAST_EXPRESSIONS[cid].includes(e) ? e : "base";
  if (/용서 못|가만두지|방해하지|감히|비켜|화가 나/u.test(body)) return pick("angry");
  if (/뭐\?|뭐라고|어머|설마|헉|깜짝|!\?/u.test(body)) return pick("surprised");
  // 「건강해졌어요」의 「졌」은 슬픔이 아니다 — 낱말 처음의 「졌」만(「으으, 졌다!」).
  if (/(?<![가-힣])졌|아쉽|미안|슬프|흑/u.test(body)) return pick("sad");
  if (/이번엔|이길 거|지지 않|각오|승부|덤벼|보여 줘|보여 줄래|시작하자/u.test(body)) return pick("determined");
  if (/하하|헤헤|좋아|반가|축하|고마|잘했|대단|최고|어서 오세요|기뻐|환영|건강해|기운을 되찾|이겼다|챔피언은 너|멋진/u.test(body)) return pick("happy");
  if (/…|\.\.\./u.test(body)) return pick("serious");
  return "base";
}

const face = (resourceId: string): Command => ({ kind: "changeFace", resourceId, presentation: "bust", position: "left", flipHorizontally: false });
const CLEAR = (): Command => ({ kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false });
const SPOTLIGHT = "astra_cast_spotlight";
/** card-base.png 크기(scripts/content/monsters/bake_astra_cast.py 가 굽는다). */
const CARD_SIZE: Readonly<Record<AstraCastId, readonly [number, number]>> = {
  hero: [83, 188], mom: [82, 187], professor: [85, 186], naru: [86, 186], nurse: [70, 184], yurim: [78, 186], muyeong: [86, 186],
};

/** 명령 목록 하나에 흉상을 끼운다. 안쪽 목록(분기·선택지)도 같은 규칙으로 따로 처리한다. 얼굴을 띄운 채 끝나면 끝에서 지운다. */
type Spotlight = { readonly cid: AstraCastId; readonly list: Command[] };

function castList(list: Command[], spotlight?: Spotlight): void {
  let current: string | null | undefined; // undefined = 모름(목록 처음)
  // 전신: 이 목록이 그 인물과 처음 승부하는 장면(첫 대사가 그 인물 + 같은 목록에 승부)일 때 한 번만 세운다. 첫 대사 묶음이 끝나면(다른 화자·승부) 내린다.
  let lit = spotlight?.list === list ? spotlight.cid : undefined;
  let shown = false;
  let pictures = 0;
  for (let i = 0; i < list.length; i++) {
    const command = list[i]! as Command & Record<string, unknown>;
    const nested: Command[][] = [];
    for (const value of Object.values(command)) {
      if (Array.isArray(value) && value.length && typeof value[0] === "object" && value[0] && "kind" in value[0]) nested.push(value as Command[]);
      else if (Array.isArray(value)) for (const option of value) if (option && typeof option === "object" && Array.isArray((option as { branch?: unknown }).branch)) nested.push((option as { branch: Command[] }).branch);
    }
    for (const inner of nested) castList(inner, spotlight);
    // 안쪽 목록이 얼굴을 바꿨을 수 있다 — 다음 대사는 무조건 다시 맞춘다("?" 는 어떤 값과도 다르다).
    if (nested.some((inner) => inner.some((c) => c.kind === "changeFace"))) current = "?";
    if (command.kind === "battleProcessing") {
      // 전투 화면 위에 흉상·전신이 남지 않게 승부 직전에 내린다.
      if (lit && shown) { list.splice(i, 0, { kind: "erasePicture", pictureId: SPOTLIGHT }); i++; }
      lit = undefined;
      if (current) { list.splice(i, 0, CLEAR()); i++; current = null; }
      continue;
    }
    // 스타터 카드·배지 같은 그림이 떠 있는 동안은 흉상을 내린다(그림과 겹쳤다, 2026-10-21 적대 검수 m3).
    if (command.kind === "showPicture" && (command as { pictureId?: string }).pictureId !== SPOTLIGHT) { pictures++; continue; }
    if (command.kind === "erasePicture" && (command as { pictureId?: string }).pictureId !== SPOTLIGHT) { pictures = Math.max(0, pictures - 1); continue; }
    if (command.kind !== "text") continue;
    // 그림이 떠 있으면 인물 대사라도 흉상을 내린다. 바깥 목록에서 이어진 흉상일 수 있으니(current 모름) 꼭 지운다.
    const hidden = pictures > 0 && castOf(command.speaker) !== undefined;
    const cid = pictures > 0 ? undefined : castOf(command.speaker);
    if (lit && cid === lit) {
      if (i === list.findIndex((c) => c.kind === "text")) {
        // 전신 카드(테두리 창)를 화면 오른쪽, 아래 상자 바로 위에 세운다 — 가운데 맵 인물을 가리지 않게. 카드 크기 = 전신 + 24×20.
        const [w, h] = CARD_SIZE[lit];
        list.splice(i, 0, CLEAR(), { kind: "showPicture", pictureId: SPOTLIGHT, resourceId: astraCastCardId(lit), x: 480 - w - 12, y: 240 - h, scale: 100, opacity: 255, durationMs: 300, waitForPicture: false } as Command);
        current = null; i += 2; shown = true;
      }
      // 전신은 아래 상자 바로 위에 선다(상자 위쪽 끝 ≈ 240px) — 상자가 위로 가면 머리를 덮는다.
      if (shown) { (command as { position?: string }).position = "bottom"; continue; }
    }
    if (lit && shown) { list.splice(i, 0, { kind: "erasePicture", pictureId: SPOTLIGHT }); i++; }
    lit = undefined;
    const want = cid ? astraCastBustId(cid, astraCastExpression(cid, command.body)) : null;
    if (want === current) continue;
    if (want === null && current === undefined && !hidden) { current = null; continue; } // 이 목록에서 띄운 적 없는 일반 대사는 그대로
    list.splice(i, 0, want ? face(want) : CLEAR()); i++; current = want;
  }
  if (lit && shown) list.push({ kind: "erasePicture", pictureId: SPOTLIGHT });
  if (current) list.push(CLEAR());
}

/** 처음 승부를 거는 목록: 첫 대사가 그 인물이고 같은 목록에 승부가 있다. 선택지 안(다시 겨루기)은 건너뛴다. 깊이 우선 첫 번째. */
function firstMeeting(list: Command[], cid: AstraCastId): Command[] | undefined {
  const firstText = list.find((c) => c.kind === "text") as { speaker?: string } | undefined;
  if (castOf(firstText?.speaker) === cid && list.some((c) => c.kind === "battleProcessing")) return list;
  for (const command of list) {
    if (command.kind === "choices") continue;
    for (const value of Object.values(command)) {
      if (Array.isArray(value) && value.length && typeof value[0] === "object" && value[0] && "kind" in value[0]) {
        const found = firstMeeting(value as Command[], cid);
        if (found) return found;
      }
    }
  }
  return undefined;
}

/** 처음 만나는 장면: (맵, 이벤트, 인물) — 그 이벤트 첫 페이지의 첫 대사 묶음에 전신을 세운다. */
// 전신은 트레이너 소개(전투 시작)에서만 보인다 — 맵에 걷기 칩이 서 있는데 전신 카드까지 세우면 한 사람이 두 번 보였다(2026-10-21 적대 검수 r1).
// 장치는 남겨 두지만 지금은 아무 장면도 세우지 않는다.
const SPOTLIGHTS: readonly [string, string, AstraCastId][] = [];

const TRAINER_FRONTS: Readonly<Record<string, string>> = {
  naru: "astra_naru",
  yurim: "astra_yurim",
  muyeong: "astra_muyeong",
};

/** 같은 인물의 걷기 칩: ScarloxyPeople14 칸(0 엄마 · 1 천문박사 · 2 주인공 · 3 센터 직원). 나루·유림·무영은 원래 칩이 흉상과 맞아 그대로 둔다. */
export const ASTRA_CAST_CHIP_SHEET = "oprn-charset-scarloxy-people14";
const ASTRA_CAST_CHIP_TEXTURE = "tex_oprn_charset_scarloxy_people14";
const CHIP_SLOT: readonly [RegExp, number][] = [
  [/^mx_map_home_house_resident$/u, 0],
  [/^mx_map_lab_professor$/u, 1],
  [/_center_nurse(_sprite)?$/u, 3],
];

function dressChips(project: Project): void {
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      const slot = CHIP_SLOT.find(([re]) => re.test(event.id))?.[1];
      if (slot === undefined) continue;
      for (const page of event.pages ?? []) {
        if (!page.graphic?.sprite) continue;
        page.graphic = { ...page.graphic, sprite: { type: "bundled", id: ASTRA_CAST_CHIP_TEXTURE }, pattern: charsetFrameIndex({ characterIndex: slot, direction: page.graphic.direction ?? "down", pattern: 1 }) };
      }
    }
  }
  const hero = project.database.actors[0];
  if (hero) { hero.characterResourceId = ASTRA_CAST_CHIP_SHEET; hero.characterIndex = 2; }
}

export function castTheAstraHorizon(project: Project): void {
  dressChips(project);
  for (const [mapId, map] of Object.entries(project.maps)) {
    for (const event of map.events) {
      const pages = event.pages ?? [];
      if (!JSON.stringify(pages).match(/"speaker":"[^"]*(엄마|천문박사|나루|센터 직원|유림|무영)"/u)) continue;
      const spot = SPOTLIGHTS.find(([m, e]) => m === mapId && e === event.id)?.[2];
      const target = spot ? pages.map((page) => firstMeeting(page.commands as Command[], spot)).find(Boolean) : undefined;
      for (const page of pages) castList(page.commands as Command[], target && spot ? { cid: spot, list: target } : undefined);
    }
  }
  // 트레이너 소개 그림: 그 인물이 거는 승부(무리 이름이 아니라 이벤트 id 로 찾는다).
  const troopFor: Readonly<Record<string, AstraCastId>> = {
    mx_troop_mx_map_lab_rival: "naru",
    mx_troop_mx_map_grove_rival: "naru",
    mx_troop_mx_map_grove_gym_leader: "yurim",
    mx_troop_mx_map_observatory_boss: "muyeong",
    mx_troop_mx_map_league_0_league_challenge: "naru",
  };
  for (const troop of project.database.troops) {
    const cid = troopFor[troop.id];
    if (cid && troop.trainerBattle) troop.trainerSprite = { ...(troop.trainerSprite ?? {}), front: TRAINER_FRONTS[cid]! };
    // 주인공 전투 뒷모습: 옛 그림(머리띠·조끼)은 우리 주인공이 아니었다 — char-gen 으로 그린 별 모자·남색 재킷 뒷모습과 던지기 4칸(public/assets/battle-trainers/astra_hero).
    if (troop.trainerBattle && troop.trainerSprite) troop.trainerSprite = { ...troop.trainerSprite, back: "astra_hero", backThrow: "astra_hero" };
  }
}
