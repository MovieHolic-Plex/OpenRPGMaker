// 사람·사건 동사 — add_people · add_event · add_scene · add_boss_encounter · add_ending_scene.
import type { PiToolShape } from "@/ai/piAgent/toolAdapter";
import type { EventSpec, PersonSpec } from "../../types";
import { buildPeople } from "../../people";
import { buildEvent } from "../../events";
import { buildScene, SCENE_SCHEMA, type SceneSpec } from "../../scene";
import { buildBossEncounter, buildEndingScene, type BossEncounterSpec, type EndingSceneSpec } from "../../sceneVerbs";
import { POINT } from "../placeSchema";
import type { VerbContext } from "../context";

/** createV2Tools 에서 뗀 것 — addPeople · addBossEncounter · BEAT_ITEM · addEndingScene · addEvent · sceneHosts · addScene · personItem …. (peopleVerbs) */
export function peopleVerbs(c: VerbContext) {
  const { env, run, specGate, finishContent } = c;
  const addPeople: PiToolShape = {
    name: "add_people", label: "사람 두기", concurrency: "exclusive",
    description: "Place NPCs from a spec (role, spot word, appearance words, lines). The function picks a walkable cell and builds the first-talk / later-talk pages.",
    parameters: { type: "object", properties: {
      mapId: { type: "string" },
      people: { type: "array", items: { type: "object", properties: {
        role: { type: "string" }, name: { type: "string" }, where: { type: "string" }, at: POINT, mapId: { type: "string" }, looks: { type: "string" },
        firstTalk: { type: "array", items: { type: "string" } }, laterTalk: { type: "array", items: { type: "string" } },
        movement: { type: "string", enum: ["still", "wander", "patrol"] },
      }, required: ["role"] } },
    }, required: ["people"] },
    async execute(id, params) {
      const peopleSpecFirst = specGate("add_people", "people");
      if (peopleSpecFirst) return peopleSpecFirst;
      const p = params as { people: PersonSpec[]; mapId?: string };
      const result = buildPeople(run, p.people, p.mapId ?? env.ctx.currentMapId);
      return finishContent(id, "add_people", params, result);
    },
  };
  // 상위 동사 둘(sceneVerbs.ts) — 「말 걸고 → 보스전」·「대사 → 엔딩」을 한 번에. 모델은 누가·무슨 말·어디만 준다.
  const addBossEncounter: PiToolShape = {
    name: "add_boss_encounter", label: "보스 만남", concurrency: "exclusive",
    description: "Build a talking boss and the boss battle in one go — the boss person (if already present only the lines change), lines before the fight, the boss troop (if missing, made with art from the name/appearance words at a strength matched to the starting party), lines after winning, and vanishing after the win (or laterTalk). If the map already has a boss fight (the dungeon builder's boss, within 4 cells of boss.at), that one becomes this boss — renamed, given the lines, keeping its troop unless troopId is given — instead of a second boss. Do not assemble it from lower tools (upsert_enemy, upsert_troop, patch_event_page).",
    parameters: { type: "object", properties: {
      mapId: { type: "string", description: "map id (or map name) where the boss stands" },
      boss: { type: "object", properties: {
        name: { type: "string" }, where: { type: "string", description: "spot word (방 안쪽 back of the room · 제단 앞 in front of the altar…)" }, at: POINT, looks: { type: "string", description: "appearance words (해골 기사 skeleton knight · 검은 갑옷 black armor…)" },
        enemy: { type: "string", description: "enemy art word (해골 skeleton · 늑대 wolf · 용 dragon · 마왕 demon king…) — empty = from the name/appearance" }, troopId: { type: "string", description: "only to use an existing troop" },
      }, required: ["name"] },
      lines: { type: "array", items: { type: "string" }, description: "boss lines before the fight (1–6 lines)" },
      afterWin: { type: "array", items: { type: "string" }, description: "boss lines right after winning (optional)" },
      laterTalk: { type: "array", items: { type: "string" }, description: "when talked to again after the win (optional; empty = the boss vanishes)" },
    }, required: ["boss", "lines"] },
    async execute(id, params) {
      return finishContent(id, "add_boss_encounter", params, buildBossEncounter(run, params as BossEncounterSpec));
    },
  };
  const BEAT_ITEM = { type: "object", properties: {
        do: { type: "string", enum: ["walk", "say", "appear", "face", "wait", "fade", "tint", "weather", "shake", "flash", "music", "emote", "camera", "look", "vanish", "choose"] },
        who: { type: "string" }, to: { type: "string", description: "spot word (or 'x,y')" }, text: { type: "string" },
        where: { type: "string" }, looks: { type: "string" }, toward: { type: "string" }, ms: { type: "number" }, dir: { type: "string", enum: ["in", "out"] },
        tone: { type: "string", enum: ["night", "dusk", "dawn", "sepia", "clear"] }, as: { type: "string", enum: ["shadow", "ghost", "normal"] },
        weather: { type: "string", enum: ["rain", "storm", "snow", "fog", "none"] }, intensity: { type: "number" },
        strength: { type: "string", enum: ["weak", "medium", "strong"] }, axis: { type: "string", enum: ["both", "horizontal", "vertical"] }, color: { type: "string" },
        action: { type: "string", enum: ["bgm", "se", "bgs", "stop", "fade"] },
        options: { type: "array", description: "choose: 2–4 answers the player picks from; each branch says its own reply and can move gold (negative = the player pays; not enough gold → the branch ends with a short refusal) or give an item by DB item name", items: { type: "object", properties: { label: { type: "string" }, lines: { type: "array", items: { type: "string" }, description: "reply lines after this pick — «이름: 대사» or a line by the choose who" }, gold: { type: "number" }, item: { type: "string" }, count: { type: "number" } }, required: ["label"] } }, emote: { type: "string", description: "emote: ! ? ♥ 땀 화 … zzz 반짝 전구 or exclamation·question·heart·sweat·anger·ellipsis·sleep·sparkle·idea·music·smile" }, query: { type: "string", description: "music: word to find the sound (festival·battle·town·sad·boss·door…; horror 비명 scream · 심장 heartbeat · 삐걱 creak · 물방울 drip · 웅웅 hum · 속삭임 whisper · 쾅 bang · 발소리 footsteps)" },
      }, required: ["do"] };
  const addEndingScene: PiToolShape = {
    name: "add_ending_scene", label: "엔딩 장면", concurrency: "exclusive",
    description: "Build an ending scene in one go — the ending definition (epilogue, final title) and an event on that map that calls the ending after its lines. Give the hero at least one line of their own (who:'주인공') — an ending where only others speak leaves the player out of their own payoff. Calling it again with the same title rebuilds that ending (it does not stack). When: automatically on entering the map after afterSwitchId (or the after word — «마왕» means the demon-king-defeated switch) is on; with talkTo, when talking to that person. Do not assemble it from lower tools (define_ending, patch_event_page).",
    parameters: { type: "object", properties: {
      mapId: { type: "string", description: "ending scene map id (or map name)" },
      title: { type: "string", description: "ending name and final screen title" },
      lines: { type: "array", items: { type: "string" }, description: "scene lines — «이름: 대사» (with speaker) or just the line" },
      epilogue: { type: "array", items: { type: "string" }, description: "epilogue lines on the ending screen (3+ lines recommended)" },
      talkTo: { type: "string", description: "ending when talking to this person (optional)" },
      afterSwitchId: { type: "string", description: "only after this switch is on (optional)" },
      after: { type: "string", description: "word for what it follows («마왕», «해골 기사») — finds the defeat switch (optional)" },
      beats: { type: "array", items: BEAT_ITEM, description: "stage the ending like add_event beats — people walk in and gather (appear/walk), react (emote), music swells, the hero answers. Without beats the ending is text boxes over a still screen; an ending is the payoff, so show the changed world and the people the hero saved. lines are appended after the beats (skip lines you already wrote as say beats). Not used with talkTo." },
    }, required: ["title"] },
    async execute(id, params) {
      return finishContent(id, "add_ending_scene", params, buildEndingScene(run, params as EndingSceneSpec));
    },
  };
  const addEvent: PiToolShape = {
    name: "add_event", label: "사건·컷신", concurrency: "exclusive",
    description: "Make a cutscene or dialogue event as a list of beats (walk/say/appear/face/wait/fade/tint/weather/shake/flash/music/emote/camera/look/vanish/choose). choose = the player picks an answer and each branch replies differently (haggling, persuading, confessing) — use it instead of hand-writing choices with patch_event_page. The function decides walkable paths and spots and checks with a preview probe.",
    parameters: { type: "object", properties: { event: { type: "object", properties: {
      kind: { type: "string", enum: ["cutscene", "talk", "trigger"] }, mapId: { type: "string" },
      when: { type: "string", enum: ["game-start", "enter", "touch", "talk"], description: "game-start = once when the game starts (start map) · enter = once when the player enters this map (arrival spot) · touch = when the player steps on the scene cell (where/at) · talk = when talked to" }, where: { type: "string" }, at: POINT,
      after: { type: "string", description: "play right after talking with this NPC name ends (appended to the end of that NPC's talk, once only)" },
      afterTalk: { type: "array", items: { type: "string" }, description: "what that NPC says when talked to again after the after scene (if the situation changed, like night falling or after an incident). Omitted = the original lines" },
      afterPage: { type: "integer", description: "when the after NPC has several talk pages, the page number (from 0) to attach the scene to. If pages split like day/night, the page where the scene happens — if unsure leave it empty and the call returns the page list" },
      redo: { type: "string", description: "id of a scene event already on this map: rewrite that scene in place with these beats (same spot, same trigger) instead of adding another event — use it to fix a scene the checks pointed at" },
      beats: { type: "array", items: BEAT_ITEM },
    }, required: ["kind", "beats"] } }, required: ["event"] },
    async execute(id, params) {
      const event = (params as { event: EventSpec }).event;
      const beats = event.beats.map((b) => {
        const raw = b as unknown as Record<string, unknown>;
        const asPoint = (v: unknown) => typeof v === "string" && /^\s*\d+\s*,\s*\d+\s*$/u.test(v) ? { x: Number(v.split(",")[0]), y: Number(v.split(",")[1]) } : v;
        return { ...raw, ...(raw.to !== undefined ? { to: asPoint(raw.to) } : {}), ...(raw.where !== undefined ? { where: asPoint(raw.where) } : {}) } as unknown as EventSpec["beats"][number];
      });
      const mapId = event.mapId || env.ctx.currentMapId || env.ctx.project.startMapId;
      // 같은 장면을 다시 부르면(고치기) 그 자리 장면을 다시 쓴다 — 밟기·말 걸기 장면은 부를 때마다 새 이벤트가 생겨 같은 대사가 두 번 돌았다
      // (2026-10-31 씬 벤치 terra 회상·마왕 등장: 2칸 옆에 같은 장면 둘). 같은 맵·같은 언제·자리가 3칸 안이면 redo 로 본다.
      let redo = event.redo;
      const when = event.when ?? (event.kind === "talk" ? "talk" : event.kind === "trigger" ? "touch" : "game-start");
      if (!redo && !event.after && (when === "touch" || when === "talk")) {
        const map = env.ctx.project.maps[mapId];
        const prev = [...sceneHosts].reverse().find((h) => h.mapId === mapId && h.when === when && (map?.events ?? []).some((e) => e.id === h.eventId)
          && (event.at ? Math.abs(event.at.x - h.x) + Math.abs(event.at.y - h.y) <= 3 : event.where ? event.where === h.where : true));
        if (prev) redo = prev.eventId;
      }
      const result = buildEvent(run, { ...event, mapId, ...(redo ? { redo } : {}), beats });
      const host = result.ok ? result.eventIds?.[0] : undefined;
      const hostEv = host ? env.ctx.project.maps[host.mapId]?.events?.find((e) => e.id === host.eventId) : undefined;
      if (host && hostEv && !event.after) sceneHosts.push({ mapId: host.mapId, when, eventId: host.eventId, x: hostEv.x, y: hostEv.y, ...(event.where ? { where: event.where } : {}) });
      const out = redo && !event.redo && result.ok ? { ...result, warnings: [...result.warnings, `같은 자리 장면(${redo})을 다시 불러 그 장면을 이 비트로 바꿨다(새 이벤트를 더 만들지 않았다).`] } : result;
      return finishContent(id, "add_event", params, out);
    },
  };
  const sceneHosts: { mapId: string; when: string; eventId: string; x: number; y: number; where?: string }[] = [];
  const addScene: PiToolShape = {
    name: "add_scene", label: "두 선택 대화 장면", concurrency: "exclusive",
    description: "A short dialogue scene with one partner — opening lines, two choices with a reaction per choice, and what they say when talked to again. If a confirmed romance plan exists it follows that contract; the function stands the partner up with matching-face art and checks both choices in the real runtime.",
    parameters: { type: "object", properties: { scene: SCENE_SCHEMA }, required: ["scene"] },
    async execute(id, params) {
      const scene = (params as { scene: SceneSpec }).scene;
      return finishContent(id, "add_scene", params, buildScene(run, { ...scene, ...(scene.mapId || !env.ctx.currentMapId ? {} : { mapId: env.ctx.currentMapId }) }));
    },
  };
  // ───── make_game: 작은 게임 한 판(맵 5~8장·잇기·사람·사건)을 계획 한 번으로 ─────
  const personItem = (addPeople.parameters as { properties: { people: { items: { properties: Record<string, unknown>; required: string[] } } } }).properties.people.items;
  const eventItem = (addEvent.parameters as { properties: { event: { properties: Record<string, unknown>; required: string[] } } }).properties.event;
  return { addPeople, addBossEncounter, addEndingScene, addEvent, addScene, personItem, eventItem };
}
