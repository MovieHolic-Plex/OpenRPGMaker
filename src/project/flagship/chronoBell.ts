import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { canMove, isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { deserialize, serialize } from "@/project/io";
import type { Command, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { FLAGSHIP_BEAT_MANIFESTS } from "./beats";
import type { FlagshipDemoBuildResult } from "./types";

function execTool(project: Project, name: string, args: Record<string, unknown>): void {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) {
    throw new Error(`[chrono-bell] ${name} failed: ${res.summary} ${JSON.stringify(res.issues ?? [])}`);
  }
  Object.assign(project, ctx.project);
}

function findAdjacentWalkable(
  project: Project,
  map: GameMap,
  origin: { readonly x: number; readonly y: number },
  avoid: ReadonlySet<string>,
): { readonly x: number; readonly y: number } {
  const dirs = [
    [0, 0],
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
    [1, -1],
    [-1, -1],
    [1, 1],
    [-1, 1],
    [0, -2],
    [2, 0],
  ] as const;
  for (const [dx, dy] of dirs) {
    const x = origin.x + dx;
    const y = origin.y + dy;
    const k = `${x},${y}`;
    if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) continue;
    if (avoid.has(k)) continue;
    if (!isPassable(project, map, x, y)) continue;
    if (map.events.some((e) => e.x === x && e.y === y)) continue;
    return { x, y };
  }
  return { x: origin.x, y: Math.max(1, origin.y - 1) };
}

function buildChronoBellOpening(project: Project): void {
  project.system.opening = { enabled: true, skippable: true, scenes: [] };
  const shots: readonly {
    readonly id: string;
    readonly bg: string;
    readonly actorIndex: number;
    readonly role: "hero" | "mage" | "knight" | "villager";
    readonly caption: string;
    readonly lightKind: "shaft" | "glow";
    readonly lightColor: string;
    readonly regionColors: readonly [string, string, string];
  }[] = [
    {
      id: "cb_shot_1",
      bg: "oprn-still-kingdom-day",
      actorIndex: 0,
      role: "hero",
      caption: "왕력 1000년 벨하임 — 천년의 평화를 알리는 범종이 울려 퍼진다.",
      lightKind: "shaft",
      lightColor: "#ffe9b0",
      regionColors: ["#ffd97d", "#fff3b0", "#ffffff"],
    },
    {
      id: "cb_shot_2",
      bg: "oprn-still-manor-night",
      actorIndex: 1,
      role: "mage",
      caption: "발명가 토우의 텔레포드가 세린의 별빛 펜던트와 공명하던 순간 —",
      lightKind: "glow",
      lightColor: "#7fd4ff",
      regionColors: ["#5cb8ff", "#9be2ff", "#ffffff"],
    },
    {
      id: "cb_shot_3",
      bg: "oprn-still-snow-village",
      actorIndex: 2,
      role: "knight",
      caption: "왕력 600년 중세의 안개 대성당과 북방 설원 광산으로 시대의 문이 열렸다.",
      lightKind: "shaft",
      lightColor: "#b8d8ff",
      regionColors: ["#8ecae6", "#caf0f8", "#ffffff"],
    },
    {
      id: "cb_shot_4",
      bg: "oprn-still-desert-ruin",
      actorIndex: 3,
      role: "villager",
      caption: "왕력 2300년 무너진 아리아 돔 — 잿빛 미래에 남겨진 종말의 기록.",
      lightKind: "glow",
      lightColor: "#ff9e66",
      regionColors: ["#ff7b54", "#ffb26b", "#ffd56b"],
    },
    {
      id: "cb_shot_5",
      bg: "oprn-still-dark-citadel",
      actorIndex: 4,
      role: "knight",
      caption: "잔해의 탑 정상에서 깨어나는 종말의 사도 나크타르와 고대 용 아스칼.",
      lightKind: "shaft",
      lightColor: "#ff5c8a",
      regionColors: ["#d90429", "#ef233c", "#ffb703"],
    },
    {
      id: "cb_shot_6",
      bg: "oprn-still-farm-golden",
      actorIndex: 0,
      role: "hero",
      caption: "일곱 시대의 동료들과 함께, 무너진 별의 운명을 바꿀 여정이 시작된다!",
      lightKind: "glow",
      lightColor: "#ffd166",
      regionColors: ["#ffd166", "#ffe699", "#ffffff"],
    },
  ];

  for (const [idx, s] of shots.entries()) {
    execTool(project, "create_opening_animatic_shot", {
      shotId: s.id,
      durationMs: 4500,
      width: 384,
      height: 216,
      background: s.bg,
      narration: s.caption,
      replace: true,
      clearLayers: true,
    });
    execTool(project, "set_opening_pixel_grid", {
      shotId: s.id,
      width: 384,
      height: 216,
    });
    if (idx === 0) {
      const sc = project.system.opening?.scenes[0];
      if (sc?.kind === "animatic") delete sc.composition.transition;
    }
    execTool(project, "place_opening_background", {
      shotId: s.id,
      layerId: "bg",
      resourceId: s.bg,
    });
    execTool(project, "set_opening_region_loop", {
      shotId: s.id,
      layerId: "bg",
      region: {
        x: 160,
        y: 72,
        width: 40,
        height: 28,
        mode: "palette-cycle",
        colors: [...s.regionColors],
        everyTicks: 6,
        tickMs: 16,
      },
    });
    execTool(project, "place_opening_charset_actor", {
      shotId: s.id,
      layerId: "lead_actor",
      charsetResourceId: "oprn-charset-heroes1",
      characterIndex: s.actorIndex,
      characterRole: s.role,
      direction: "right",
      scale: 1,
      x: 96 + idx * 8,
      y: 132,
      fromX: 88 + idx * 8,
      toX: 184 + idx * 8,
      durationMs: 4200,
      stride: 8,
    });
    execTool(project, "upsert_opening_light_fx", {
      shotId: s.id,
      layerId: "light_fx",
      kind: s.lightKind,
      x: 192,
      y: 88,
      width: s.lightKind === "shaft" ? 72 : 96,
      height: s.lightKind === "shaft" ? 136 : 96,
      rotation: s.lightKind === "shaft" ? 22 : 0,
      color: s.lightColor,
      blend: "lighter",
      ...(s.lightKind === "shaft"
        ? {
            spread: 0.7,
            softness: 0.8,
            dust: { count: 20, seed: idx + 3, speed: 18, size: 1 },
            pulse: { hz: 0.7, amount: 0.25, pattern: "pulse", seed: idx + 1 },
          }
        : { inner: 0.25, pulse: { hz: 0.6, amount: 0.3, pattern: "pulse", seed: idx + 1 } }),
    });
    execTool(project, "animate_opening_camera", {
      shotId: s.id,
      camera: {
        x: 192,
        y: 108,
        zoom: 1.04,
        keys: {
          y: [
            { atMs: 0, value: 112, ease: "ease-out" },
            { atMs: 4500, value: 102, ease: "ease-in-out" },
          ],
          zoom: [
            { atMs: 0, value: 1.02, ease: "linear" },
            { atMs: 4500, value: 1.1, ease: "ease-out" },
          ],
        },
      },
    });
    execTool(project, "set_opening_caption", {
      shotId: s.id,
      layerId: "caption",
      letterbox: 0.15,
      color: "#fff0dc",
      cues: [{ atMs: 250, text: s.caption, typewriterMs: 1100 }],
    });
  }
}

export function createChronoBellFlagshipDemo(): FlagshipDemoBuildResult {
  const project = createBlankProject();
  const initialBlankMapIds = Object.keys(project.maps);

  project.meta.title = "시간의 종소리와 무너진 별";
  project.meta.author = "OPRN Flagship Studio";
  project.system.playResolution = { width: 480, height: 270 };
  project.system.cameraZoom = 2;
  project.system.dialogueStyle = "pixel-cinematic";

  const hero = project.database.actors.find((a) => a.id === DEFAULT_ACTOR_ID) ?? project.database.actors[0];
  if (hero) {
    hero.name = "하람";
    hero.nickname = "시대의 검사";
    hero.initialLevel = 15;
    hero.characterResourceId = "easyrpg-charset-actor1";
    hero.characterIndex = 0;
  }

  execTool(project, "set_title_screen", {
    title: "시간의 종소리와 무너진 별",
    backgroundResourceId: "oprn-still-kingdom-day",
    logoStyle: "gold",
  });

  buildChronoBellOpening(project);

  // Build the 7 canonical JRPG chapters across eras using our real tilesets & chapter tool
  execTool(project, "author_jrpg_chapter", { chapter: "ct_truce_fair", seed: 7 });
  const hubMapId = "ct_truce_fair_hub";
  execTool(project, "author_jrpg_chapter", { chapter: "ct_middle_ages", seed: 7, timeGateFrom: hubMapId });
  execTool(project, "author_jrpg_chapter", { chapter: "ff6_narshe", seed: 7, timeGateFrom: hubMapId });
  execTool(project, "author_jrpg_chapter", { chapter: "ff6_zozo_kefka", seed: 7, timeGateFrom: hubMapId });
  execTool(project, "author_jrpg_chapter", { chapter: "ct_future", seed: 7, timeGateFrom: hubMapId });
  execTool(project, "author_jrpg_chapter", { chapter: "ct_prehistory", seed: 7, timeGateFrom: hubMapId });
  execTool(project, "author_jrpg_chapter", { chapter: "ct_zeal", seed: 7, timeGateFrom: hubMapId });

  // Define the two canonical endings
  execTool(project, "define_ending", {
    id: "end_chrono_bell_true",
    name: "새벽의 종소리와 되살아난 별",
    conditions: [],
    epilogue: [
      { kind: "say", speaker: "세린", text: "천년제 광장의 하늘이 다시 맑아졌어… 무너진 별의 심장이 잠들었어!" },
      { kind: "say", speaker: "토우", text: "시대의 문이 닫히기 전에 모두 무사히 돌아왔네. 하람, 바르도, 로코, 고마워!" },
      { kind: "say", speaker: "개굴경 바르도", text: "성검 에테르리온의 빛은 그대들의 우정과 함께 영원히 남을 것이오." },
    ],
  });
  execTool(project, "define_ending", {
    id: "end_chrono_bell_epoch",
    name: "시대의 문 너머로 이어지는 노래",
    conditions: [],
    epilogue: [
      { kind: "say", speaker: "토우", text: "비공정 알바트로스의 날개 아래로 새로운 시대의 바다가 펼쳐지고 있어!" },
      { kind: "say", speaker: "세린", text: "언젠가 다시 종소리가 울리면, 어느 시대에서든 다시 만나자!" },
    ],
  });

  const hub = project.maps[hubMapId];
  if (!hub) throw new Error("[chrono-bell] Missing ct_truce_fair_hub");

  // Place player in the Millennium Fair Plaza on a passable cell with open neighbors
  const hubSpawn = { x: Math.floor(hub.width / 2), y: Math.floor(hub.height / 2) };
  let startPos = hubSpawn;
  for (let r = 0; r < 16; r++) {
    let found: { x: number; y: number } | undefined;
    for (let dy = -r; dy <= r && !found; dy++) {
      for (let dx = -r; dx <= r && !found; dx++) {
        const cx = hubSpawn.x + dx;
        const cy = hubSpawn.y + dy;
        if (cx < 2 || cy < 2 || cx >= hub.width - 2 || cy >= hub.height - 2) continue;
        if (!isPassable(project, hub, cx, cy)) continue;
        if (hub.events.some((e) => Math.abs(e.x - cx) + Math.abs(e.y - cy) <= 1)) continue;
        if (canMove(project, hub, cx, cy, cx, cy - 1) && canMove(project, hub, cx, cy, cx + 1, cy)) {
          found = { x: cx, y: cy };
        }
      }
    }
    if (found) {
      startPos = found;
      break;
    }
  }
  project.startMapId = hubMapId;
  project.startPos = startPos;

  // Remove untouched initial blank seed map so every map in the project is a real authored flagship map
  for (const blankId of initialBlankMapIds) {
    if (blankId !== hubMapId && project.maps[blankId]) {
      delete project.maps[blankId];
    }
  }
  for (const map of Object.values(project.maps)) {
    for (const ev of map.events) {
      if (ev.trigger.kind === "auto") {
        ev.trigger = { kind: "action" };
      }
      for (const page of ev.pages ?? []) {
        if (page.trigger.kind === "auto") {
          page.trigger = { kind: "action" };
        }
      }
    }
  }
  project.mapTree = {
    mapId: hubMapId,
    children: Object.keys(project.maps)
      .filter((id) => id !== hubMapId)
      .map((mapId) => ({ mapId, children: [] })),
  };

  // Ensure switches for our flagship interactive showcase events
  const ensureSw = (id: string, name: string): void => {
    if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name });
  };
  ensureSw("sw_chrono_bell_rung", "천년제 범종 공명 완료");
  ensureSw("sw_chrono_party_joined", "시대의 동료 합류 완료");
  ensureSw("sw_chrono_sword_restored", "성검 에테르리온 복원");
  ensureSw("sw_chrono_final_won", "나크타르 & 아스칼 격파");

  // Tune boss HP so 9-cell animations and skills play out briskly without tedious sponge turns
  for (const enemy of project.database.enemies) {
    if (enemy.id.includes("boss")) {
      enemy.stats = {
        ...enemy.stats,
        maxHp: 35,
        attack: 6,
        defense: 2,
        mind: 5,
        agility: 5,
      };
    }
  }

  // Boost party actors so Haram, Serin, Tou, Bardo, and Rocco hit hard and reliably win
  for (const actor of project.database.actors) {
    actor.initialLevel = Math.max(actor.initialLevel ?? 1, 15);
  }

  const avoid = new Set<string>([`${startPos.x},${startPos.y}`]);

  // 1) North of spawn: Millennium Bell & Secret Seal (2-step choice puzzle + changeTile + companion joins 세린·토우·바르도·로코 + 용암 부싯돌)
  const bellPos = { x: startPos.x, y: startPos.y - 1 };
  avoid.add(`${bellPos.x},${bellPos.y}`);
  const curTile = hub.lowerTiles[bellPos.y * hub.width + bellPos.x] ?? 0;
  const altFloorTile =
    hub.lowerTiles.find((t, idx) => t >= 0 && t !== curTile && isPassable(project, hub, idx % hub.width, Math.floor(idx / hub.width))) ?? curTile;

  const joinActorIds = ["actor_ct_truce_fair_marle", "actor_ct_truce_fair_lucca", "actor_ct_middle_ages_frog", "actor_ff6_zozo_kefka_sabin"].filter(
    (aid) => project.database.actors.some((a) => a.id === aid),
  );
  const joinCommands: Command[] = joinActorIds.map((actorId) => ({
    kind: "changeParty",
    actorId,
    action: "add",
  }));

  const bellEvent: GameEvent = {
    id: "ev_chrono_bell_seal",
    name: "천년제의 시대의 종 & 봉인 석판",
    x: bellPos.x,
    y: bellPos.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "ev_chrono_bell_seal_p1",
        name: "봉인 전",
        conditions: [],
        graphic: {
          sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" },
          direction: "down",
          pattern: charsetFrameIndex({ characterIndex: 0, direction: "down", pattern: 1 }),
          transparent: false,
        },
        movement: { type: "fixed", speed: 3, frequency: 3 },
        priority: "same",
        overlapForbidden: true,
        trigger: { kind: "action" },
        commands: [
          { kind: "text", speaker: "세린", body: "하람! 이게 천년제 광장의 『시대의 종』과 토우의 텔레포드 공명 석판이야!" },
          { kind: "text", speaker: "토우", body: "범종을 친 뒤 공명 파장을 맞추면 광장 바닥의 비밀 문양이 열리고 시대의 동료들이 모일 거야!" },
          {
            kind: "choices",
            prompt: "1단계 — 천년제의 범종을 어떻게 울릴까?",
            options: [
              {
                text: "온 힘을 다해 범종을 울린다",
                branch: [
                  { kind: "playAudio", resourceId: "easyrpg-sound-bell", loop: false, channel: "se" },
                  { kind: "text", speaker: "토우", body: "데에엥—!! 종소리가 광장 전체에 울려 퍼졌어! 이제 공명 파장을 맞춰 봐!" },
                  {
                    kind: "choices",
                    prompt: "2단계 — 텔레포드 공명 파장을 어느 눈금에 맞출까?",
                    options: [
                      {
                        text: "중간 출력 · 별빛 공명 파장",
                        branch: [
                          { kind: "changeTile", mapId: hubMapId, layer: "lower", x: bellPos.x, y: bellPos.y, tile: altFloorTile },
                          ...joinCommands,
                          { kind: "changeItem", itemId: "item_lava_flint", op: "+=", amount: 1 },
                          { kind: "changeItem", itemId: "item_zozo_clock_key", op: "+=", amount: 1 },
                          { kind: "setSwitch", switchId: "sw_chrono_bell_rung", value: true },
                          { kind: "setSwitch", switchId: "sw_chrono_party_joined", value: true },
                          { kind: "setSwitch", switchId: "sw_chrono_sword_restored", value: true },
                          {
                            kind: "text",
                            speaker: "세린",
                            body: "바닥 석판이 빛나며 비밀 문양이 드러났어! 세린·토우·개굴경 바르도·로코가 파티에 합류하고 『용암 부싯돌』과 『시계탑 열쇠』를 얻었다!",
                          },
                        ],
                      },
                      {
                        text: "과부하 최대 출력",
                        branch: [{ kind: "text", speaker: "토우", body: "파장이 너무 강해! 다시 차분하게 맞춰 보자." }],
                      },
                    ],
                  },
                ],
              },
              {
                text: "살살 건드린다",
                branch: [{ kind: "text", speaker: "세린", body: "종소리가 너무 작아서 공명하지 않아. 힘껏 쳐 보자!" }],
              },
            ],
          },
        ],
      },
      {
        id: "ev_chrono_bell_seal_p2",
        name: "공명 완료",
        conditions: [{ kind: "switch", switchId: "sw_chrono_bell_rung", value: true }],
        graphic: {
          sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" },
          direction: "down",
          pattern: charsetFrameIndex({ characterIndex: 0, direction: "down", pattern: 1 }),
          transparent: false,
        },
        movement: { type: "fixed", speed: 3, frequency: 3 },
        priority: "same",
        overlapForbidden: true,
        trigger: { kind: "action" },
        commands: [
          {
            kind: "text",
            speaker: "세린",
            body: "시대의 동료들이 모두 모였어! 바로 옆 『시대의 문 성소』를 조사하면 각 시대의 핵심 무대와 나크타르 결전으로 바로 이동할 수 있어!",
          },
        ],
      },
    ],
  };
  hub.events.push(bellEvent);

  // 2) East of spawn: Time Gate Nexus & 2-Phase 9-Cell Boss Battle (`demon-lord` 나크타르 → `dragon-red` 아스칼) + Ending
  const nexusPos = findAdjacentWalkable(project, hub, { x: startPos.x + 1, y: startPos.y }, avoid);
  avoid.add(`${nexusPos.x},${nexusPos.y}`);
  const demonLordTroopId =
    project.database.troops.find((t) => t.id === "troop_ff6_zozo_kefka_boss")?.id ??
    project.database.troops.find((t) => t.id === "troop_ct_middle_ages_boss")?.id ??
    project.database.troops[0]!.id;
  const dragonRedTroopId =
    project.database.troops.find((t) => t.id === "troop_ct_prehistory_boss")?.id ??
    demonLordTroopId;

  const chapelMap = project.maps["ct_middle_ages_chapel"];
  const futureMap = project.maps["ct_future_hub"];
  const volcanoMap = project.maps["ct_prehistory_canyon"];

  const nexusPage: EventPage = {
    id: "ev_chrono_era_gate_p1",
    name: "시대의 문 성소",
    conditions: [],
    graphic: {
      sprite: { type: "bundled", id: "tex_easyrpg_charset_actor2" },
      direction: "left",
      pattern: charsetFrameIndex({ characterIndex: 2, direction: "left", pattern: 1 }),
      transparent: false,
    },
    movement: { type: "fixed", speed: 3, frequency: 3 },
    priority: "same",
    overlapForbidden: true,
    trigger: { kind: "action" },
    commands: [
      { kind: "text", speaker: "토우", body: "시대의 문이 공명하고 있어! 어느 시대의 무대나 결전지로 넘어갈까?" },
      {
        kind: "choices",
        prompt: "이동할 시대와 결전을 선택하세요",
        options: [
          {
            text: "종말의 사도 나크타르 & 고대 용 아스칼 결전 (보스전 → 엔딩)",
            branch: [
              { kind: "text", speaker: "종말의 사도 나크타르", body: "크하하! 시대의 종소리를 울려 여기까지 왔느냐! 무너진 별의 심장 아래서 사라져라!" },
              {
                kind: "battleProcessing",
                troopId: demonLordTroopId,
                canEscape: true,
                canLose: true,
                branchOnResult: true,
                victoryBranch: [
                  { kind: "setSwitch", switchId: "sw_chrono_final_won", value: true },
                  {
                    kind: "text",
                    speaker: "세린",
                    body: "해냈어! 종말의 사도 나크타르와 고대 용 아스칼이 물러나고 시대의 하늘이 다시 이어졌어!",
                  },
                  {
                    kind: "fork",
                    condition: { kind: "switch", switchId: "sw_chrono_sword_restored", value: true },
                    then: [{ kind: "triggerEnding", endingId: "end_chrono_bell_true" }],
                    else: [{ kind: "triggerEnding", endingId: "end_chrono_bell_epoch" }],
                  },
                ],
                defeatBranch: [
                  { kind: "recoverAll" },
                  { kind: "text", speaker: "세린", body: "시대의 종소리가 우리를 다시 일으켜 세웠어! 무너진 별이 잠들었다!" },
                  { kind: "triggerEnding", endingId: "end_chrono_bell_epoch" },
                ],
                escapeBranch: [
                  { kind: "text", speaker: "토우", body: "태세를 정비하고 다시 도전하자!" },
                ],
              },
            ],
          },
          ...(chapelMap
            ? [
                {
                  text: "왕력 600년 · 대성당 예배당 (파이프 오르간 퍼즐)",
                  branch: [{ kind: "transfer" as const, mapId: chapelMap.id, x: Math.floor(chapelMap.width / 2), y: Math.floor(chapelMap.height / 2) }],
                },
              ]
            : []),
          ...(futureMap
            ? [
                {
                  text: "왕력 2300년 · 아리아 돔 크레이터 (에너트론 캡슐)",
                  branch: [{ kind: "transfer" as const, mapId: futureMap.id, x: Math.floor(futureMap.width / 2), y: Math.floor(futureMap.height / 2) }],
                },
              ]
            : []),
          ...(volcanoMap
            ? [
                {
                  text: "태고의 시대 · 화산 협곡 용암 폭포 (부싯돌 봉인 동굴 & 아스칼)",
                  branch: [
                    { kind: "text" as const, speaker: "고대 용 아스칼", body: "크르르릉!! 태고의 용암 폭포를 넘는 자들이여, 불꽃의 시험을 받아라!" },
                    {
                      kind: "battleProcessing" as const,
                      troopId: dragonRedTroopId,
                      canEscape: true,
                      canLose: true,
                      branchOnResult: true,
                      victoryBranch: [
                        { kind: "text" as const, speaker: "타라", body: "아스칼이 너희의 힘을 인정했다! 용암 동굴의 길이 열렸어!" },
                        { kind: "transfer" as const, mapId: volcanoMap.id, x: Math.floor(volcanoMap.width / 2), y: Math.floor(volcanoMap.height / 2) },
                      ],
                      defeatBranch: [{ kind: "recoverAll" as const }],
                      escapeBranch: [],
                    },
                  ] satisfies Command[],
                },
              ]
            : []),
          {
            text: "새벽의 종소리와 되살아난 별 (진 엔딩 에필로그)",
            branch: [{ kind: "triggerEnding", endingId: "end_chrono_bell_true" }],
          },
        ],
      },
    ],
  };

  hub.events.push({
    id: "ev_chrono_era_gate",
    name: "시대의 문 성소 · 나크타르 결전",
    x: nexusPos.x,
    y: nexusPos.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [nexusPage],
  });

  const serialized = serialize(project);
  const reloaded = deserialize(serialized);
  const manifest = {
    ...FLAGSHIP_BEAT_MANIFESTS["chrono-bell"],
    mapCount: Object.keys(reloaded.maps).length,
    endingCount: reloaded.endings?.length ?? 0,
  };
  return {
    id: "chrono-bell",
    manifest,
    project: reloaded,
    serialized,
  };
}
