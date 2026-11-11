/**
 * 대표 데모 『강호의 철련』(데모 id iron-lotus) — 제1막.
 *
 * 폴른 스타와 같은 길이다. 이야기 사양(ironLotusStory.ts)을 장 구성기에 넘기고,
 * 전국·에도 손 도트 마을·죽림·사원 위에 상점·여관·세이브·보이는 적·중간 우두머리·결전·엔딩을 얹는다.
 * 무림 칩셋(murim_wuxia)은 사람이 고르기 전이라 굽지 않는다.
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { isPassable } from "@/project/collision";
import { JRPG_CLASSIC_FIELD_HUD } from "@/project/fieldHud";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { serialize } from "@/project/io";
import type { ActorRecord as Actor, Command, GameEvent, GameMap, Project } from "@/project/types";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { buildJrpgChapter } from "@/editor/tools/jrpgChapterTools";
import { pickSpot } from "@/editor/tools/jrpgVolumeTools";
import { placeFallenStarVessel } from "./fallenStarVessel";
import { FLAGSHIP_BEAT_MANIFESTS } from "./beats";
import { buildIronLotusOpening } from "./ironLotusOpening";
import { applyIronLotusLore } from "./ironLotusLore";
import { IL_NAMES, IL_PREFIX, IRON_LOTUS_ACT1 } from "./ironLotusStory";
import type { FlagshipDemoBuildResult } from "./types";

const HERO_ID = DEFAULT_ACTOR_ID;
const BAEK_ID = "actor_il_baek";
const ENDING_ID = "end_il_act1";
const SW_BAEK_JOINED = "sw_il_baek_joined";

const CHIP = {
  hero: ["easyrpg-charset-actor4", 7, "tex_easyrpg_charset_actor4", "charset-battler-actor4-7", "easyrpg-faceset-actor2-15"] as const,
  baek: ["easyrpg-charset-actor3", 1, "tex_easyrpg_charset_actor3", "charset-battler-actor3-1"] as const,
  cheongha: ["tex_easyrpg_charset_people5", 3] as const,
  gomo: ["tex_easyrpg_charset_people5", 6] as const,
  salgu: ["tex_easyrpg_charset_people4", 3] as const,
  dani: ["tex_easyrpg_charset_people4", 1] as const,
  cheol: ["tex_easyrpg_charset_people5", 0] as const,
  elder: ["tex_easyrpg_charset_people5", 7] as const,
  yayul: ["tex_easyrpg_charset_actor3", 2] as const,
};

type CommandList = Command[];

function execTool(project: Project, name: string, args: Record<string, unknown>): unknown {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) throw new Error(`[iron-lotus] ${name} failed: ${res.summary} ${JSON.stringify(res.issues ?? [])}`);
  Object.assign(project, ctx.project);
  return (res as { data?: unknown }).data;
}

function forEachCommandList(commands: CommandList, visit: (list: CommandList) => void): void {
  visit(commands);
  for (const cmd of commands) {
    const rec = cmd as unknown as Record<string, unknown>;
    for (const value of Object.values(rec)) {
      if (Array.isArray(value) && value.length && typeof value[0] === "object" && value[0] && "kind" in (value[0] as object)) {
        forEachCommandList(value as CommandList, visit);
      } else if (Array.isArray(value)) {
        for (const opt of value) {
          if (opt && typeof opt === "object" && Array.isArray((opt as { branch?: unknown }).branch)) {
            forEachCommandList((opt as { branch: CommandList }).branch, visit);
          }
        }
      }
    }
  }
}

function eventCommandLists(event: GameEvent): CommandList[] {
  const out: CommandList[] = [];
  forEachCommandList(event.commands, (list) => out.push(list));
  for (const page of event.pages ?? []) forEachCommandList(page.commands, (list) => out.push(list));
  return out;
}

const SPEAKER_LINE = /^([^\s:：「」『』()…—][^:：「」『』()]{0,12})[:：]\s*(.+)$/su;

function applySpeakerPrefixes(project: Project): void {
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      for (const list of eventCommandLists(event)) {
        for (let i = 0; i < list.length; i += 1) {
          const cmd = list[i] as Command & { kind: string; body?: string; speaker?: string };
          if (cmd.kind !== "text" || typeof cmd.body !== "string" || (cmd.speaker && cmd.speaker !== "의뢰인")) continue;
          const parts = cmd.body.split("\n").map((line) => line.trim()).filter(Boolean);
          const parsed = parts.map((line) => {
            const match = SPEAKER_LINE.exec(line);
            return match ? { speaker: match[1]!.trim(), body: match[2]!.trim() } : { body: line };
          });
          if (!parsed.some((part) => "speaker" in part)) continue;
          const merged: Array<{ speaker?: string; body: string }> = [];
          for (const part of parsed) {
            const last = merged[merged.length - 1];
            const speaker = (part as { speaker?: string }).speaker;
            if (last?.speaker && !speaker && !/^[(（]/u.test(part.body)) last.body += `\n${part.body}`;
            else if (last && last.speaker === speaker) last.body += `\n${part.body}`;
            else merged.push({ ...part });
          }
          const replacement = merged.map((part) => {
            const { speaker: _old, ...rest } = cmd;
            return { ...rest, body: part.body, ...(part.speaker ? { speaker: part.speaker } : {}) } as Command;
          });
          list.splice(i, 1, ...replacement);
          i += replacement.length - 1;
        }
      }
    }
  }
}

function setEventChip(map: GameMap | undefined, eventId: string, texture: string, characterIndex: number): void {
  const event = map?.events.find((entry) => entry.id === eventId);
  if (!event) return;
  for (const page of event.pages ?? []) {
    if (page.graphic?.sprite?.id === undefined && page.graphic?.transparent) continue;
    const direction = page.graphic?.direction ?? "down";
    page.graphic = {
      ...(page.graphic ?? {}),
      sprite: { type: "bundled", id: texture },
      direction,
      pattern: charsetFrameIndex({ characterIndex, direction, pattern: 1 }),
    };
  }
}

function vanishWhen(map: GameMap | undefined, eventId: string, switchId: string): void {
  const event = map?.events.find((entry) => entry.id === eventId);
  if (!event?.pages) return;
  event.pages.push({
    id: `${eventId}_gone`,
    name: "합류",
    conditions: [{ kind: "switch", switchId, value: true }],
    graphic: { transparent: true },
    trigger: { kind: "action" },
    priority: "below",
    overlapForbidden: false,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  } as unknown as GameEvent["pages"] extends (infer P)[] | undefined ? P : never);
}

function setupCast(project: Project): void {
  const actors = project.database.actors;
  const hero = actors.find((actor) => actor.id === HERO_ID) ?? actors[0]!;
  hero.name = IL_NAMES.hero;
  hero.nickname = "중계 기체";
  hero.characterResourceId = CHIP.hero[0];
  hero.characterIndex = CHIP.hero[1];
  hero.battleCharacterResourceId = CHIP.hero[3];
  hero.faceResourceId = CHIP.hero[4];
  hero.initialLevel = 5;

  const template = actors.find((actor) => actor.id === "actor_guardian") ?? hero;
  const baek = { ...JSON.parse(JSON.stringify(template)), id: BAEK_ID } as Actor;
  baek.name = IL_NAMES.disciple;
  baek.nickname = "청죽문 제자";
  baek.characterResourceId = CHIP.baek[0];
  baek.characterIndex = CHIP.baek[1];
  baek.battleCharacterResourceId = CHIP.baek[3];
  baek.initialLevel = 5;
  const at = actors.findIndex((actor) => actor.id === BAEK_ID);
  if (at >= 0) actors[at] = baek; else actors.push(baek);

  const curve = { base: 30, extra: 60, acceleration: 20 };
  for (const actor of actors) {
    if (actor.id !== HERO_ID && actor.id !== BAEK_ID) continue;
    actor.expCurve = { ...curve };
    const klass = project.database.classes.find((entry) => entry.id === actor.classId);
    if (klass && "expCurve" in klass) (klass as { expCurve: typeof curve }).expCurve = { ...curve };
  }
  project.system.startActorIds = [HERO_ID];
  project.session.partyActorIds = [HERO_ID];
  project.session.gold = 220;
  project.session.inventory = { ...project.session.inventory, item_potion: 2 };
  project.system.companions = { ...project.system.companions, fromParty: true, spreadWhenBlocked: true, fanOutInScenes: true } as typeof project.system.companions;
  project.system.fieldHud = JRPG_CLASSIC_FIELD_HUD;
  project.system.battleLook = { ...project.system.battleLook, enemyHp: true, enemyNames: true };
  project.system.battleStaging = { ...project.system.battleStaging, pace: "steady", revealWeakness: "never", effectivenessFeedback: "hide" };
  if (!project.switches.some((entry) => entry.id === SW_BAEK_JOINED)) project.switches.push({ id: SW_BAEK_JOINED, name: "백리호 합류" });

  const rename: Record<string, string> = { item_potion: "청죽 보약", item_ether: "기력 차", item_antidote: "해독 환" };
  for (const item of project.database.items) if (rename[item.id]) item.name = rename[item.id]!;
}

function makeEnemy(
  project: Project,
  id: string,
  name: string,
  graphic: string,
  stats: { maxHp: number; attack: number; defense: number; mind: number; agility: number },
  rewards: { exp: number; gold: number },
  role: "normal" | "boss",
  walkChip?: { characterResourceId: string; characterIndex: number },
): void {
  const template = project.database.enemies.find((enemy) => enemy.id === "enemy_bandit_mask")
    ?? project.database.enemies.find((enemy) => (enemy.actions?.length ?? 0) > 0);
  execTool(project, "upsert_enemy", {
    role,
    enemy: {
      id, name, monsterResourceId: graphic, level: role === "boss" ? 8 : 4,
      stats: { maxMp: 20, ...stats },
      rewards: { exp: rewards.exp, gold: rewards.gold, dropRatePercent: 20 },
      ...(template?.actions ? { actions: JSON.parse(JSON.stringify(template.actions)) } : {}),
      ...(walkChip ? { walkChip } : {}),
    },
  });
}

function setupFoes(project: Project): void {
  makeEnemy(project, "enemy_il_viper", "청죽 살무사", "generated-enemy-snake-viper",
    { maxHp: 90, attack: 42, defense: 16, mind: 18, agility: 30 }, { exp: 16, gold: 10 }, "normal");
  makeEnemy(project, "enemy_il_scout", "흑련사 정찰병", "generated-enemy-bandit-mask",
    { maxHp: 120, attack: 46, defense: 20, mind: 14, agility: 26 }, { exp: 22, gold: 16 }, "normal",
    { characterResourceId: "easyrpg-charset-actor3", characterIndex: 2 });
  makeEnemy(project, "enemy_il_mid", "흑련사 선봉 흑랑", "generated-enemy-wolf-dire",
    { maxHp: 240, attack: 54, defense: 24, mind: 16, agility: 32 }, { exp: 70, gold: 48 }, "boss");
  makeEnemy(project, "enemy_il_puppet", "철 인형", "generated-enemy-slime-metal",
    { maxHp: 180, attack: 48, defense: 36, mind: 8, agility: 14 }, { exp: 40, gold: 20 }, "normal");
  for (const [id, name, enemies] of [
    ["troop_il_viper", "청죽 살무사", ["enemy_il_viper"]],
    ["troop_il_scout", "흑련사 정찰병", ["enemy_il_scout"]],
    ["troop_il_mid", "흑련사 선봉", ["enemy_il_mid"]],
    ["troop_il_puppet", "철 인형", ["enemy_il_puppet"]],
  ] as const) {
    execTool(project, "upsert_troop", { troop: { id, name, enemyIds: [...enemies] } });
  }
}

function patchBoss(project: Project): void {
  makeEnemy(project, "enemy_il_boss", "야율검", "generated-enemy-bandit-mask",
    { maxHp: 420, attack: 62, defense: 28, mind: 36, agility: 34 }, { exp: 140, gold: 90 }, "boss",
    { characterResourceId: "easyrpg-charset-actor3", characterIndex: 2 });
  const troop = project.database.troops.find((entry) => entry.id === `troop_${IL_PREFIX}_boss`);
  if (!troop) throw new Error("[iron-lotus] 결전 트룹이 없다");
  troop.name = "야율검과 철 인형";
  troop.enemyIds = ["enemy_il_boss", "enemy_il_puppet"];
  troop.members = [
    { enemyId: "enemy_il_boss", x: 88, y: 96, hidden: false },
    { enemyId: "enemy_il_puppet", x: 168, y: 120, hidden: false },
  ];
}

function tryTool(project: Project, name: string, args: Record<string, unknown>): boolean {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) return false;
  Object.assign(project, ctx.project);
  return true;
}

function placeFieldEnemies(project: Project, mapId: string, troops: readonly string[]): number {
  const map = () => project.maps[mapId]!;
  let placed = 0;
  const origin = { x: Math.floor(map().width / 2), y: Math.floor(map().height / 2) };
  for (let n = 0; n < troops.length; n += 1) {
    const at = pickSpot(project, map(), origin, new Set(map().events.map((event) => `${event.x},${event.y}`)), 0.35 + n * 0.2, 4);
    if (!at) continue;
    const ok = tryTool(project, "place_field_enemy", {
      mapId, x: at.x, y: at.y, troopId: troops[n], behavior: n === 0 ? "stationary" : "patrol",
      patrol: { length: 3, axis: n % 2 === 0 ? "horizontal" : "vertical" },
      canEscape: true, alert: "exclamation", id: `ev_${mapId}_foe${n + 1}`,
    });
    if (ok) placed += 1;
  }
  return placed;
}

function cellKey(x: number, y: number): string { return `${x},${y}`; }

function reachable(project: Project, map: GameMap, origin: { x: number; y: number }): Set<string> {
  const blocked = new Set<string>();
  for (const event of map.events) {
    for (const page of event.pages ?? []) {
      if (page.overlapForbidden) blocked.add(cellKey(event.x, event.y));
    }
  }
  const seen = new Set<string>();
  const queue = [origin];
  seen.add(cellKey(origin.x, origin.y));
  for (let i = 0; i < queue.length; i += 1) {
    const here = queue[i]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = here.x + dx;
      const y = here.y + dy;
      const key = cellKey(x, y);
      if (seen.has(key) || blocked.has(key) || !isPassable(project, map, x, y)) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return seen;
}

function adjacentReachable(seen: Set<string>, x: number, y: number): boolean {
  if (seen.has(cellKey(x, y))) return true;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(cellKey(x + dx!, y + dy!)));
}

function assertPlayable(project: Project, ids: { hub: string; grove: string; temple: string }): void {
  const start = project.startPos;
  if (!start || !isPassable(project, project.maps[ids.hub]!, start.x, start.y)) {
    throw new Error("[iron-lotus] 시작 칸이 통행 불가");
  }
  for (const id of [ids.hub, ids.grove, ids.temple]) {
    const map = project.maps[id]!;
    const door = map.events.find((event) => JSON.stringify(event.commands).includes("transfer") || (event.pages ?? []).some((page) => JSON.stringify(page.commands).includes("transfer")));
    const origin = door ? { x: door.x, y: door.y } : { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
    const landing = isPassable(project, map, origin.x, origin.y) ? origin : (pickSpot(project, map, origin, new Set(), 0.1, 0) ?? origin);
    const seen = reachable(project, map, landing);
    const missed = map.events.filter((event) => event.pages?.some((page) => page.commands.length > 0) && !adjacentReachable(seen, event.x, event.y));
    if (missed.length) {
      throw new Error(`[iron-lotus] ${map.name} 에서 닿지 않는 이벤트 ${missed.slice(0, 6).map((event) => `${event.id}@${event.x},${event.y}`).join(" ")}`);
    }
  }
}

function findTransfer(map: GameMap, toMapId: string): { x: number; y: number } | undefined {
  for (const event of map.events) {
    const blob = JSON.stringify(event);
    if (blob.includes(`"mapId":"${toMapId}"`) || blob.includes(`"mapId": "${toMapId}"`)) return { x: event.x, y: event.y };
  }
  return undefined;
}

function insertJoin(_project: Project, map: GameMap): void {
  const needle = "미확인 에너지";
  for (const event of map.events) {
    if (event.id !== `ev_${IL_PREFIX}_baek`) continue;
    for (const list of eventCommandLists(event)) {
      const hit = list.findIndex((cmd) => cmd.kind === "text" && String((cmd as { body?: string }).body).includes(needle));
      if (hit < 0) continue;
      list.splice(hit + 1, 0,
        { kind: "text", speaker: IL_NAMES.disciple, body: "…알겠다. 기록 기계라도 같이 걷지.\n뒤는 내가 본다." } as Command,
        { kind: "changeParty", actorId: BAEK_ID, action: "add" } as Command,
        { kind: "setSwitch", switchId: SW_BAEK_JOINED, value: true } as Command,
      );
      vanishWhen(map, event.id, SW_BAEK_JOINED);
      return;
    }
  }
  throw new Error("[iron-lotus] 백리호 합류를 끼울 대사를 찾지 못했다");
}

function armBoss(map: GameMap): void {
  const boss = map.events.find((event) => event.id.includes("kill") && JSON.stringify(event).includes("battleProcessing"));
  if (!boss) throw new Error("[iron-lotus] 결전 이벤트가 없다");
  setEventChip(map, boss.id, CHIP.yayul[0], CHIP.yayul[1]);
  for (const list of eventCommandLists(boss)) {
    for (const cmd of list) {
      const rec = cmd as unknown as Record<string, unknown>;
      if (rec.kind === "battleProcessing") {
        rec.troopId = `troop_${IL_PREFIX}_boss`;
        rec.canLose = true;
        rec.canEscape = false;
      }
      if (rec.kind === "fork" && (rec.condition as { kind?: string } | undefined)?.kind === "battleResult") {
        rec.else = [
          { kind: "recoverAll" },
          { kind: "text", speaker: IL_NAMES.disciple, body: "일단 물러서! 숨 고르고 다시 붙자." },
        ];
      }
    }
  }
}

function polishGenerics(project: Project): void {
  const swaps: Record<string, { speaker?: string; body: string }> = {
    "아직 할 일이 남은 것 같군.": { speaker: "장문 소청하", body: "아직 신호 조각이 죽림에 있다.\n서두르거라." },
    "고맙네.": { speaker: "장문 소청하", body: "잘했다. 북쪽의 빛은 다음 고개의 일이다." },
    "자네 덕분에 살았어. 정말 고맙네.": { speaker: "장문 소청하", body: "잘했다. 북쪽의 빛은 다음 고개의 일이다." },
    "마음이 바뀌면 다시 오게.": { speaker: "장문 소청하", body: "마음이 서면 다시 오너라." },
    "확인을 마쳤다.": { speaker: "설린", body: "기록 완료. 다음 절차를 기다립니다." },
    "청죽림의 고치에서 신호 조각을 꺼내고, 운무산 사원의 천기단으로 집을 부른다.": { speaker: "장문 소청하", body: "고치의 조각을 천기단으로 보내거라.\n동문 밖에 백리호가 있다." },
  };
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      for (const list of eventCommandLists(event)) {
        for (const cmd of list) {
          if (cmd.kind === "choices" && String((cmd as { prompt?: string }).prompt ?? "").includes("수락")) {
            (cmd as { prompt?: string }).prompt = "지금 청죽림으로 갈까?";
            const options = (cmd as { options?: Array<{ text: string }> }).options;
            if (options?.[0]) options[0].text = "가겠습니다";
            if (options?.[1]) options[1].text = "잠시만요";
          }
          if (cmd.kind !== "text") continue;
          const body = (cmd as { body?: string }).body;
          const next = body ? swaps[body] : undefined;
          if (!next) continue;
          (cmd as { body: string; speaker?: string }).body = next.body;
          if (next.speaker) (cmd as { speaker?: string }).speaker = next.speaker;
        }
      }
    }
  }
}

export function createIronLotusFlagshipDemo(): FlagshipDemoBuildResult {
  const project = createBlankProject();
  const blankIds = Object.keys(project.maps);
  project.meta.title = "강호의 철련";
  project.meta.author = "OPRN Flagship Studio";
  project.system.playResolution = { width: 480, height: 270 };
  delete project.system.cameraZoom;
  project.system.dialogueStyle = "pixel-cinematic";
  project.system.battleBgmResourceId = "cc0-bgm-rtp-btl-001";

  setupCast(project);
  setupFoes(project);

  const built = buildJrpgChapter(project, IRON_LOTUS_ACT1, {
    chapterId: "iron_lotus_act1", prefix: IL_PREFIX, seed: 11,
    troops: { field: ["troop_il_viper", "troop_il_scout"], boss: "troop_il_mid" },
  });
  const data = built.data as { hubMapId?: string; maps?: Array<{ key: string; mapId: string }> } | undefined;
  const mapIdOf = (key: string): string => {
    const hit = data?.maps?.find((entry) => entry.key === key);
    if (!hit) throw new Error(`[iron-lotus] 맵 키가 없다: ${key} ${JSON.stringify(built.warnings ?? [])}`);
    return hit.mapId;
  };
  const ids = { hub: data?.hubMapId ?? mapIdOf("hub"), grove: mapIdOf("grove"), temple: mapIdOf("temple") };
  for (const id of Object.values(ids)) if (!project.maps[id]) throw new Error(`[iron-lotus] 맵이 덜 지어졌다: ${id}`);
  if ((built.warnings ?? []).some((warning) => warning.includes("퀘스트"))) {
    throw new Error(`[iron-lotus] 퀘스트가 비었다: ${JSON.stringify(built.warnings)}`);
  }

  const M = (id: string): GameMap => project.maps[id]!;
  M(ids.grove).mapRole = "field";
  M(ids.temple).mapRole = "dungeon";
  M(ids.hub).mapRole = "town";

  applySpeakerPrefixes(project);
  polishGenerics(project);
  patchBoss(project);

  setEventChip(M(ids.hub), `ev_${IL_PREFIX}_cheongha`, CHIP.cheongha[0], CHIP.cheongha[1]);
  setEventChip(M(ids.hub), `ev_${IL_PREFIX}_gomo`, CHIP.gomo[0], CHIP.gomo[1]);
  setEventChip(M(ids.hub), `ev_${IL_PREFIX}_salgu`, CHIP.salgu[0], CHIP.salgu[1]);
  setEventChip(M(ids.hub), `ev_${IL_PREFIX}_dani`, CHIP.dani[0], CHIP.dani[1]);
  setEventChip(M(ids.hub), `ev_${IL_PREFIX}_cheol`, CHIP.cheol[0], CHIP.cheol[1]);
  setEventChip(M(ids.hub), `ev_${IL_PREFIX}_elder`, CHIP.elder[0], CHIP.elder[1]);
  setEventChip(M(ids.grove), `ev_${IL_PREFIX}_baek`, CHIP.baek[2], CHIP.baek[1]);

  insertJoin(project, M(ids.grove));
  armBoss(M(ids.temple));

  const shop = M(ids.hub).events.find((event) => event.id === `ev_${IL_PREFIX}_salgu`);
  if (!shop?.pages?.length) throw new Error("[iron-lotus] 약재상이 없다");
  const shopCommand = {
    kind: "shop",
    title: "살구 약방",
    itemIds: ["item_potion", "item_ether", "item_antidote"],
    stock: [
      { itemId: "item_potion", priceOverride: 40 },
      { itemId: "item_ether", priceOverride: 80 },
      { itemId: "item_antidote", priceOverride: 30 },
    ],
    allowSell: true,
    quantityMode: "select",
    shopType: "normal",
    messageType: "welcome",
    branchOnTransaction: false,
    transactionBranch: [],
    branchOnFailedTransaction: false,
    failedTransactionBranch: [],
  } as Command;
  for (const page of shop.pages) if (!page.commands.some((cmd) => cmd.kind === "shop")) page.commands.push(shopCommand);
  const inn = M(ids.hub).events.find((event) => event.id === `ev_${IL_PREFIX}_gomo`);
  if (!inn) throw new Error("[iron-lotus] 여관 주인이 없다");
  const innCommand = {
    kind: "inn", price: 20,
    note: "고모: 죽림 쇠소리에 잠을 설쳤다네.\n방은 비었으니, 하룻밤에 이십 골드.",
    question: "묵고 가겠나? (20 골드)",
  } as Command;
  for (const page of inn.pages ?? []) {
    if (!page.commands.some((cmd) => cmd.kind === "inn")) page.commands.push(innCommand);
  }

  project.system.saveAccess = "savePoints";
  const saveAt = (mapId: string, name: string, id: string): void => {
    const map = M(mapId);
    const origin = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
    const at = pickSpot(project, map, origin, new Set(map.events.map((event) => `${event.x},${event.y}`)), 0.25, 3);
    if (!at) throw new Error(`[iron-lotus] 세이브 자리가 없다: ${mapId}`);
    execTool(project, "place_savepoint", {
      mapId, x: at.x, y: at.y, id, name, heal: true, mode: "both",
      prompt: "이 자리에 기록을 남길까?", glowColor: "#9ef0c8",
    });
  };
  saveAt(ids.hub, "여관 마루의 등", "ev_il_save_inn");
  saveAt(ids.temple, "사원 향로 앞", "ev_il_save_temple");

  const groveFoes = placeFieldEnemies(project, ids.grove, ["troop_il_viper", "troop_il_scout", "troop_il_viper"]);
  const templeFoes = placeFieldEnemies(project, ids.temple, ["troop_il_scout", "troop_il_viper", "troop_il_scout"]);
  if (groveFoes < 2 || templeFoes < 2) {
    throw new Error(`[iron-lotus] 보이는 적이 부족하다 grove ${groveFoes} temple ${templeFoes}`);
  }
  // 제자리 적은 eventTouch 라 주인공이 밟기 전에는 싸움이 안 열린다. 밟으면 전투가 되게 바꾼다.
  for (const mapId of [ids.grove, ids.temple]) {
    for (const event of M(mapId).events) {
      if (!/_foe\d+$/u.test(event.id)) continue;
      event.trigger = { kind: "playerTouch" };
      for (const page of event.pages ?? []) {
        if (!page.id.endsWith("_fight")) continue;
        page.trigger = { kind: "playerTouch" };
        page.overlapForbidden = false;
      }
    }
  }

  const gate = findTransfer(M(ids.grove), ids.temple);
  if (!gate) throw new Error("[iron-lotus] 죽림에서 사원으로 가는 문이 없다");
  const midAt = pickSpot(project, M(ids.grove), gate, new Set(), 0.15, 2) ?? { x: gate.x, y: Math.min(M(ids.grove).height - 2, gate.y + 2) };
  execTool(project, "place_battle_blocker", {
    mapId: ids.grove, x: midAt.x, y: midAt.y, troopId: "troop_il_mid", id: "ev_il_midboss",
    clearSwitchId: "sw_il_mid_clear",
    intro: [
      "흑련사 선봉이 대숲을 가로막는다.",
      "흑랑: 집사님 명이다. 쇳덩이는 여기서 멈춰라.",
      "설린: 위협 등급, 중간. 교전합니다.",
      "백리호: 말은 나중에! 검부터!",
    ],
    victory: [
      "흑랑이 대나무 사이로 굴러 사라진다.",
      "백리호: 본대는 사원에 있다. 야율검은 이런 졸개로 안 끝나.",
      "설린: 기록. 추적자, 아직 전방.",
    ],
  });

  const clue = M(ids.grove).events.find((event) => event.id.includes("inspect"));
  if (clue) {
    const vx = Math.max(0, clue.x - 1);
    const vy = Math.max(0, clue.y - 2);
    placeFallenStarVessel(project, M(ids.grove), vx, vy);
  }

  for (const [id, bgm] of [[ids.hub, "cc0-bgm-rtp-fld-001"], [ids.grove, "cc0-bgm-rtp-fld-002"], [ids.temple, "cc0-bgm-rtp-dng-001"]] as const) {
    M(id).bgm = { mode: "custom", resourceId: bgm };
  }

  execTool(project, "define_ending", {
    id: ENDING_ID,
    name: "제1막 · 강호의 철련",
    conditions: [],
    epilogue: [{ kind: "say", speaker: "설린", text: "북쪽 응답, 유지 중.\n집은 아직 꺼지지 않았습니다." }],
    presentation: {
      kicker: "제1막 끝",
      credits: [
        "설린 — 중계 기체",
        "백리호 — 청죽문 제자",
        "소청하 — 청죽문 장문",
        "야율검 — 흑련사 집사",
        "",
        "그날 밤 청죽림에 떨어진 것은 별이 아니었다.",
        "설린의 집이 부르는 곳, 북쪽.",
        "",
        "OPRN Studio 공식 데모",
        "맵: 전국·에도 손 도트 (OPRN)",
        "추락 고치: 폴른 스타와 같은 코드 손 도트",
        "Music: OPRN BGM (AI-generated, Google Lyria)",
        "",
        "제2막에서 계속됩니다.",
      ].join("\n"),
      musicResourceId: "cc0-bgm-rtp-flt-023",
    },
  });
  const reported = Object.values(project.maps).flatMap((map) => map.events).flatMap((event) => eventCommandLists(event))
    .flatMap((list) => list.map((cmd, index) => ({ list, index, cmd })))
    .find((hit) => hit.cmd.kind === "text" && String((hit.cmd as { body?: string }).body).includes("다음 고개에서"));
  if (!reported) throw new Error("[iron-lotus] 보고 대사를 찾지 못해 엔딩을 걸지 못했다");
  reported.list.push({ kind: "triggerEnding", endingId: ENDING_ID } as Command);

  const master = M(ids.hub).events.find((event) => event.id === `ev_${IL_PREFIX}_cheongha`);
  const start = master
    ? { x: master.x, y: Math.min(M(ids.hub).height - 2, master.y + 2) }
    : { x: Math.floor(M(ids.hub).width / 2), y: Math.floor(M(ids.hub).height / 2) };
  const landed = isPassable(project, M(ids.hub), start.x, start.y) && !M(ids.hub).events.some((event) => event.x === start.x && event.y === start.y)
    ? start
    : (pickSpot(project, M(ids.hub), start, new Set(), 0.05, 1) ?? start);
  project.startMapId = ids.hub;
  project.startPos = landed;
  // 사원을 이기고 마을로 돌아오면 장문 앞이 아니어도 제1막이 닫힌다. 보고 대사는 장문에게 직접 걸어도 같은 엔딩이다.
  M(ids.hub).events.push({
    id: "ev_il_return",
    name: "귀환",
    x: landed.x,
    y: landed.y,
    trigger: { kind: "auto" },
    commands: [],
    pages: [{
      id: "ev_il_return_play",
      name: "제1막 끝",
      conditions: [
        { kind: "switch", switchId: "sw_il_main_step2", value: true },
        { kind: "switch", switchId: "sw_il_main_done", value: false },
      ],
      trigger: { kind: "auto" },
      graphic: { transparent: true },
      priority: "below",
      overlapForbidden: false,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [
        { kind: "text", speaker: "장문 소청하", body: "북쪽에서 답이 왔구나.\n야율검은 물러났다만, 본산은 남아 있다." } as Command,
        { kind: "text", speaker: "설린", body: "북쪽 응답, 유지 중.\n집은 아직 꺼지지 않았습니다." } as Command,
        { kind: "text", speaker: "백리호", body: "그럼 다음 고개다.\n이번엔 내가 앞장설게." } as Command,
        { kind: "changeGold", op: "+=", amount: 240 } as Command,
        { kind: "setSwitch", switchId: "sw_il_main_done", value: true } as Command,
        { kind: "triggerEnding", endingId: ENDING_ID } as Command,
      ],
    }],
  } as GameEvent);

  for (const blankId of blankIds) if (blankId !== ids.hub) delete project.maps[blankId];
  project.mapTree = {
    mapId: ids.hub,
    children: [{ mapId: ids.grove, children: [{ mapId: ids.temple, children: [] }] }],
  };

  buildIronLotusOpening(project);
  execTool(project, "set_title_screen", {
    title: "강호의 철련",
    logoStyle: "gold",
    menuLabels: { newGame: "새 여정", continueGame: "이어하기", credits: "만든 사람" },
  });
  if (project.system.titleScreen) {
    project.system.titleScreen.logoSubtitle = "제1막 · Iron Lotus of the Jianghu";
    project.system.titleScreen.logoStyle = "gold";
    project.system.titleScreen.menuFontPx = 18;
    project.system.titleScreen.musicResourceId = "cc0-bgm-rtp-flt-016";
  }

  applyIronLotusLore(project);
  assertPlayable(project, ids);
  // 로드가 기본 전투 스킨(retro2003)은 저장하지 않는다. 넣어 두면 재로드와 어긋난다.
  delete project.system.battleUiStyle;

  const manifest = FLAGSHIP_BEAT_MANIFESTS["iron-lotus"];
  return {
    id: "iron-lotus",
    manifest: { ...manifest, mapCount: Object.keys(project.maps).length, endingCount: project.endings?.length ?? 0 },
    project,
    serialized: serialize(project),
  };
}
