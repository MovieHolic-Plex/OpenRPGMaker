// 조수 v2 그림 검사 — 고른 그림이 그 인물·장면의 설명과 맞는가(끝맺음 관문이 고칠 거리로 올린다).
//
// 왜(2026-10-25 조수 단독 게임 심사): 조수는 그림을 이름으로 고른다. 중간 수문장이 2배로 키워져 16px 파티 옆에서
// 도트가 뭉툭한 확대 그림이 되었다(J23). 「젊은 제페토」가 흰 수염 노인 얼굴로, 줄에 매달린 인형·태엽 병정이 사람 얼굴로(J35·J30),
// 「하얀 드레스를 입은 여자」가 분홍 드레스 공주 칩으로(J41) 나왔다 — 그림 설명(faceLooks.ts·charsetAppearances.ts)과 이름을 맞댄다.
// 순수 함수(before·after) — 워커·테스트가 같이 부른다.
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { colourGroupOf } from "@/assets/charsetQuery";
import { applyCharsetLabelOverrides, CHARSET_SEMANTICS, type CharsetSemanticEntry } from "@/assets/charsetSemantics";
import { CHARSET_FRAME_WIDTH, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { faceLookOf } from "@/assets/faceLooks";
import { OPRN_PANORAMA_ASSETS } from "@/assets/oprnPanoramas";
import { sharedCharacterSemantics } from "@/project/sharedCharacters";
import { normalizeCharacterScale } from "@/project/footprint";
import type { EventPageGraphic, Project } from "@/project/types";

type Obj = Record<string, unknown>;

/** 큰 몸으로 그려도 되는 이벤트(보스). id 의 _boss 접미사(던전 짓기)나 이름의 보스 낱말. */
const BOSS_NAME = /보스|마왕|최종|대마왕|魔王|boss/iu;

/** 걷기 칩 한 칸의 가로 화소. 번들 칩은 24, 업로드 칩은 meta.frameWidth. 칩이 아닌 그림(전투 그림에서 만든 필드 적)은 undefined. */
function frameWidthOf(project: Project, spriteId: string | undefined): number | undefined {
  if (!spriteId) return undefined;
  const uploaded = project.assets.uploaded?.[spriteId];
  if (uploaded) return uploaded.kind === "charset" ? uploaded.meta?.frameWidth ?? CHARSET_FRAME_WIDTH : undefined;
  return findCharsetAsset(spriteId) ? CHARSET_FRAME_WIDTH : undefined;
}

/**
 * 칩 한 칸이 화면에 그려지는 가로 화소(파티와 같은 맵 기준). 16px 칸에서 24px 칩의 자동 맞춤은 1배라 파티도 1배다 —
 * 자동(auto)이면 scale 은 그 위에 곱하는 몸 배율, 수동이면 절대 배율이라 둘 다 칸 폭 × scale 이다.
 */
function drawnWidth(frameWidth: number, graphic: Pick<EventPageGraphic, "scale"> | undefined): number {
  return frameWidth * normalizeCharacterScale(graphic?.scale);
}

/**
 * 파티보다 훨씬 크게 그려지는 칩(J23). 보스가 아닌 이벤트가 파티 칩의 1.75배 이상이면 짚는다 — 확대한 24px 칩은 도트가 뭉툭해
 * 같은 화면의 파티와 다른 해상도로 보인다. 이번에 새로 만들거나 바꾼 이벤트만 본다.
 */
export function oversizedSprites(before: Project, after: Project): string[] {
  const hero = after.database.actors.find((a) => a.id === (after.system.startActorIds?.[0] ?? "actor_hero")) ?? after.database.actors[0];
  const partyWidth = frameWidthOf(after, hero?.characterResourceId) ?? CHARSET_FRAME_WIDTH;
  const old = new Map<string, string>();
  for (const map of Object.values(before.maps)) for (const ev of map.events ?? []) old.set(`${map.id}/${ev.id}`, JSON.stringify(ev.pages ?? []));
  const out: string[] = [];
  for (const map of Object.values(after.maps)) {
    for (const ev of map.events ?? []) {
      if (old.get(`${map.id}/${ev.id}`) === JSON.stringify(ev.pages ?? [])) continue;
      if (/_boss$/u.test(ev.id) || BOSS_NAME.test(ev.name ?? "")) continue;
      for (const [pageIndex, page] of (ev.pages ?? []).entries()) {
        const graphic = page.graphic;
        const width = frameWidthOf(after, graphic?.sprite?.id);
        if (!graphic || !width) continue;
        const ratio = drawnWidth(width, graphic) / partyWidth;
        if (ratio < 1.75) continue;
        const scaleText = (graphic as Obj).scale !== undefined ? `배율 ${String((graphic as Obj).scale)}` : `칸 ${width}px`;
        out.push(`[게임 검사 크기] 「${ev.name || ev.id}」(${map.name ?? map.id}, ${ev.id}) ${pageIndex + 1}쪽 그림이 파티 칩의 ${ratio.toFixed(1)}배로 그려진다(${scaleText}) — 확대한 칩은 도트가 뭉툭해 16px 파티 옆에서 다른 해상도로 보인다. 보스가 아니면 patch_event_page 로 graphic.scale 을 빼서(또는 1) 파티와 같은 크기로 두고, 큰 몸이 필요하면 큰 그림(3×2 몸)이 있는 보스 그림을 고른다.`);
        break;
      }
    }
  }
  return out;
}

// ───────────────────────── 이름 ↔ 그림 설명 ─────────────────────────

/** 이름·역할에서 읽는 «그림이 맞아야 할 것». 낱말이 없으면 아무것도 바라지 않는다(추정하지 않는다). */
interface Wanted { young?: boolean; old?: boolean; child?: boolean; nonHuman?: "doll" | "machine" | "ghost"; colour?: { word: string; group: readonly string[] } }

const YOUNG = /젊은|어린 시절|어릴 적|소년|소녀|청년|아가씨|꼬마|아이|young|boy|girl/iu;
const OLD = /노인|노파|노장|할아버지|할머니|늙은|노년|백발|노학자|노승|old man|old woman|elder/iu;
const DOLL = /인형|꼭두각시|마리오네트|오르골|marionette|doll|puppet/iu;
const MACHINE = /태엽|자동인형|기계|로봇|병정 인형|장난감 병정|clockwork|automaton|robot/iu;
const GHOST = /유령|귀신|원령|망령|혼령|ghost|phantom|spirit/iu;
const COLOUR_THING = /(흰|하얀|새하얀|검은|까만|빨간|붉은|파란|푸른|노란|분홍|보라|초록)\s*(드레스|원피스|옷|로브|망토|코트|기모노|한복)/u;

function wantedOf(name: string): Wanted {
  const w: Wanted = {};
  // 「노장인」 「늙은」이 «젊은» 보다 먼저 — 한 이름에 둘 다 있으면 바라는 것이 없다.
  const old = OLD.test(name), young = YOUNG.test(name);
  if (old && !young) w.old = true;
  if (young && !old) { w.young = true; if (/어린|소년|소녀|꼬마|아이|boy|girl/iu.test(name)) w.child = true; }
  if (DOLL.test(name)) w.nonHuman = "doll";
  else if (MACHINE.test(name)) w.nonHuman = "machine";
  else if (GHOST.test(name)) w.nonHuman = "ghost";
  const c = COLOUR_THING.exec(name);
  if (c) { const group = colourGroupOf(c[1]!); if (group) w.colour = { word: `${c[1]} ${c[2]}`, group }; }
  return w;
}

/** 얼굴이 이름과 어긋나는 까닭(없으면 undefined). */
function faceMismatch(name: string, faceId: string): string | undefined {
  const look = faceLookOf(faceId);
  if (!look) return undefined;
  const w = wantedOf(name);
  if (w.nonHuman && look.kind === "human") return `${w.nonHuman === "doll" ? "인형" : w.nonHuman === "machine" ? "태엽·기계 장난감" : "유령"}인데 사람 얼굴(${look.look})이다`;
  if (look.kind !== "human") return undefined;
  if (w.young && look.age === "elder") return `젊은 인물인데 노인 얼굴(${look.look})이다`;
  if (w.old && (look.age === "child" || look.age === "youth")) return `나이 든 인물인데 ${look.age === "child" ? "아이" : "젊은"} 얼굴(${look.look})이다`;
  return undefined;
}

/** 걷기 칩이 이름과 어긋나는 까닭(없으면 undefined). */
function spriteMismatch(name: string, entry: CharsetSemanticEntry): string | undefined {
  const w = wantedOf(name);
  const text = `${entry.label} ${entry.tags.join(" ")} ${entry.appearance ?? ""}`;
  const isHuman = entry.gender === "male" || entry.gender === "female";
  if (w.nonHuman === "doll" && isHuman && !DOLL.test(text)) return `인형인데 사람 칩(${entry.label})이다`;
  if (w.nonHuman === "machine" && isHuman && !MACHINE.test(text)) return `태엽·기계 장난감인데 사람 칩(${entry.label})이다`;
  if (w.young && entry.age === "elder") return `젊은 인물인데 노인 칩(${entry.label})이다`;
  if (w.old && (entry.age === "child" || entry.age === "youth")) return `나이 든 인물인데 ${entry.age === "child" ? "아이" : "젊은"} 칩(${entry.label})이다`;
  if (w.colour && entry.appearance) {
    // 옷 낱말 바로 앞의 색만 본다 — 「분홍 드레스에 흰 앞치마」의 앞치마 색이 드레스 색으로 읽히면 안 된다.
    const garment = /(\S+)\s*(드레스|원피스|로브|망토|코트|기모노|한복|치마|옷)/gu;
    const colours = [...entry.appearance.matchAll(garment)].map((m) => colourGroupOf(m[1]!.replace(/(의|빛)$/u, ""))).filter((g): g is readonly string[] => !!g);
    if (colours.length && !colours.includes(w.colour.group)) return `「${w.colour.word}」인데 칩 옷 색이 다르다(${entry.appearance})`;
  }
  return undefined;
}

function spriteEntry(after: Project, graphic: EventPageGraphic | undefined): CharsetSemanticEntry | undefined {
  const id = graphic?.sprite?.id;
  if (!id || graphic?.pattern === undefined) return undefined;
  const textureKey = findCharsetAsset(id)?.textureKey ?? id;
  const { characterIndex } = decodeCharsetFrameIndex(graphic.pattern);
  return applyCharsetLabelOverrides([...CHARSET_SEMANTICS, ...sharedCharacterSemantics()], after.charsetLabels)
    .find((entry) => entry.textureKey === textureKey && entry.characterIndex === characterIndex);
}

function walkFaces(commands: unknown, visit: (speaker: string, faceId: string) => void): void {
  if (!Array.isArray(commands)) return;
  let face: string | undefined;
  const step = (list: unknown): void => {
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      const cmd = raw && typeof raw === "object" ? raw as Obj : undefined;
      if (!cmd) continue;
      if (cmd.kind === "changeFace") face = typeof cmd.resourceId === "string" && cmd.resourceId ? cmd.resourceId : undefined;
      if (cmd.kind === "text" && face && typeof cmd.speaker === "string" && cmd.speaker.trim()) visit(cmd.speaker.trim(), face);
      for (const key of ["then", "else", "branch", "commands", "cancelBranch"]) step(cmd[key]);
      if (Array.isArray(cmd.options)) for (const o of cmd.options as Obj[]) step(o?.branch);
    }
  };
  step(commands);
}

/**
 * 고른 얼굴·걷기 칩이 그 인물의 이름과 어긋난다(J35·J30·J41): 「젊은」 인물에 노인 얼굴, 인형·태엽 병정에 사람 얼굴,
 * 「하얀 드레스」 여자에 분홍 드레스 칩. 이름에 나이·종류·옷 색 낱말이 있을 때만 본다. 이번에 만들거나 바꾼 이벤트만.
 */
export function lookMismatches(before: Project, after: Project): string[] {
  const old = new Map<string, string>();
  for (const map of Object.values(before.maps)) for (const ev of map.events ?? []) old.set(`${map.id}/${ev.id}`, JSON.stringify(ev.pages ?? []));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const map of Object.values(after.maps)) {
    for (const ev of map.events ?? []) {
      if (old.get(`${map.id}/${ev.id}`) === JSON.stringify(ev.pages ?? [])) continue;
      const evName = (ev.name ?? "").trim();
      for (const page of ev.pages ?? []) {
        const entry = evName ? spriteEntry(after, page.graphic) : undefined;
        const why = entry ? spriteMismatch(evName, entry) : undefined;
        if (why && !seen.has(`s:${evName}:${entry!.textureKey}#${entry!.characterIndex}`)) {
          seen.add(`s:${evName}:${entry!.textureKey}#${entry!.characterIndex}`);
          out.push(`[게임 검사 그림] 「${evName}」(${map.name ?? map.id}, ${ev.id}) 의 걷기 그림이 이름과 어긋난다: ${why}. list_npc_graphics{query:<나이·종류·옷 색 낱말 하나>} 로 appearance 가 맞는 칸을 골라 patch_event_page 로 graphic 을 바꾼다. 꼭 맞는 그림이 없으면 가장 가까운 것을 두고 보고에 «맞는 그림 없음»이라고 적는다.`);
        }
        walkFaces(page.commands, (speaker, faceId) => {
          const reason = faceMismatch(speaker, faceId);
          if (!reason || seen.has(`f:${speaker}:${faceId}`)) return;
          seen.add(`f:${speaker}:${faceId}`);
          out.push(`[게임 검사 얼굴] 「${speaker}」의 대사 얼굴(${faceId})이 이름과 어긋난다: ${reason}. list_resources{kind:'faceset', query:<나이·종류 낱말>} 의 description(그림: …)을 보고 맞는 얼굴로 changeFace 를 바꾸고, 맞는 얼굴이 없으면(인형·기계·유령 등) 그 대사 앞의 changeFace 를 resourceId:'' 로 비운다 — 다른 인물의 얼굴을 빌리지 않는다.`);
        });
      }
    }
  }
  return out;
}

// ───────────────────────── 타이틀 그림 ↔ 게임 ─────────────────────────

/** 현대 도시가 보이는 배경 층: 도시 층 그림(id·이름에 skyline·city·도시)과 현대 장면 스틸. */
function modernBackdrop(id: string): boolean {
  const layer = OPRN_PANORAMA_ASSETS.find((asset) => asset.id === id);
  if (layer) return /skyline|city|도시|빌딩/u.test(`${layer.id} ${layer.name}`);
  return /^oprn-pack-still-modern-/u.test(id);
}
/** 현대가 아닌 게임(동화·판타지·사극·중세). 요청·제목·맵 이름에서 읽는다. 현대 낱말이 같이 있으면 판정하지 않는다. */
const PREMODERN = /동화|공방|마법|왕국|기사|성\b|성의|용사|마왕|요정|마녀|중세|판타지|조선|사극|무협|태엽|장난감 가게|오르골|fairy|fantasy|kingdom|medieval|wizard/iu;
const MODERN = /현대|서울|도쿄|지하철|학교|대학|회사|카페|편의점|아파트|스마트폰|휴대폰|도시|modern|city|school|subway/iu;

/**
 * 타이틀 배경이 게임과 다른 시대다(J38): 동화 공방 이야기에 현대 고층 도시 노을. 노을 세트는 하늘·해·구름·«먼 도시 실루엣» 세 겹이라
 * 이름(「노을」)만 보면 현대 도시인 줄 모른다. 판타지·동화·사극 게임에서 도시 실루엣·빌딩 층이 타이틀에 깔렸으면 짚는다.
 */
export function titleBackdropMismatch(project: Project, task: string): string[] {
  const title = (project.system.titleScreen ?? {}) as { backgroundResourceId?: string; backgroundLayers?: { resourceId?: string }[]; title?: string };
  const ids = [title.backgroundResourceId, ...(title.backgroundLayers ?? []).map((layer) => layer.resourceId)].filter((id): id is string => typeof id === "string" && !!id);
  const modern = ids.filter(modernBackdrop);
  if (!modern.length) return [];
  const story = `${task} ${title.title ?? ""} ${project.meta.title ?? ""} ${Object.values(project.maps).map((m) => m.name ?? "").join(" ")}`;
  if (!PREMODERN.test(story) || MODERN.test(story)) return [];
  return [`[게임 검사 타이틀] 타이틀 배경(${[...new Set(modern)].join(", ")})에 현대 도시 실루엣·빌딩이 보이는데 이 게임은 현대가 아니다(${PREMODERN.exec(story)?.[0]}). list_resources{kind:'backdrop', query:<장소·분위기 낱말>} 의 description(그림: …)을 읽고 이 이야기의 장소에 맞는 그림으로 set_title_screen{backgroundResourceId, backgroundLayers:[]} 를 다시 하고, 맞는 그림이 없으면 도시가 안 보이는 하늘·밤하늘(oprn-pano-night 등)만 두고 보고에 적는다.`];
}

// ───────────────────────── 주인공 모습 ↔ 장르 ─────────────────────────

/**
 * 판타지가 아닌 게임(현대 장소·연애·공포·이야기)에 주인공이 공장 기본 판타지 검사(Actor1 0번 — 두건·망토·검·방패)로 남았다(J43).
 * 출하 검사(shipChecks hero-look)는 «게임을 만들어 줘» 요청에만 돈다 — 이 검사는 이미 지은 게임을 고치는 요청에서도, 맵이 현대 칩셋이거나
 * 요청·제목이 현대·이야기 쪽이면 짚는다. 고칠 때 이름표가 아니라 그림 설명(list_npc_graphics 의 appearance)으로 고른다.
 */
export function pristineFantasyHero(project: Project, task: string): string[] {
  const hero = project.database.actors.find((a) => a.id === "actor_hero") ?? project.database.actors[0];
  if (!hero || (hero.characterResourceId !== undefined && hero.characterResourceId !== "easyrpg-charset-actor1") || (hero.characterIndex ?? 0) !== 0) return [];
  const modernMaps = Object.values(project.maps).filter((map) => {
    const family = project.tilesets[map.tilesetId ?? ""]?.family ?? "";
    return /modern|jp|kr-|city/iu.test(family) || /^(jp_city|modern|kr_)/u.test(map.tilesetId ?? "");
  });
  const story = `${task} ${project.meta.title ?? ""} ${(project.system.titleScreen as { title?: string } | undefined)?.title ?? ""}`;
  const nonFantasy = modernMaps.length > 0 || MODERN.test(story) || /연애|공포|호러|회상|추리|일상|장난감|태엽|동화|romance|horror|mystery/iu.test(story);
  if (!nonFantasy || /용사|모험|검사|기사|전사|영웅|퀘스트|마왕|rpg|hero|adventure|quest|knight/iu.test(story)) return [];
  const where = modernMaps.length ? `현대 맵 ${modernMaps.slice(0, 2).map((m) => m.name).join("·")}` : "이 이야기";
  return [`[게임 검사 주인공] 주인공(${hero.name}, ${hero.id})이 편집기 기본 판타지 검사 칩(easyrpg-charset-actor1 0번: 두건·망토, 검·방패 장비)이다 — ${where}에 맞지 않는다. list_npc_graphics{query:<주인공의 나이·성별·차림 낱말>} 의 appearance 를 읽고 맞는 칸으로 upsert_actor{id:'${hero.id}', characterResourceId, characterIndex, faceResourceId(그 칸의 face, 없으면 비움)} 하고, 전투가 없으면 initialEquipment 의 weapon·shield 를 비운다.`];
}
