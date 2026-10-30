/**
 * 「사냥꾼 계약」 — 위쳐식 계약 고리를 작게 줄인 어두운 판타지 RPG 데모(설계 docs/games/hunter/design.md).
 *
 * 이 판본(M0 + 주 계약 A): 오프닝 → 세계 지도(서쪽 변경) → 갈대늪 → 여관 게시판 → 의뢰인 마르타 → 단서(뱃사공 · 장례 마당 시체 ·
 * 끈 자국 · 세나) → 일지에 익사귀 항목 → 불씨 기름 · 밤까지 쉬기 → 밤에만 열리는 늪 깊은 곳 → 익사귀 셋 · 물에 잠긴 어미
 * → 진실 → 선택 셋(삯 · 폭로 · 두 배와 침묵) → 마르타의 마무리 → 제1장 끝.
 * 버들항·회색봉(계약 B·C)은 다음 이정표다 — 세계 지도 아이콘 앞에서 닫힌 이유를 말한다.
 *
 * 흐름은 var_hc_stage(줄기)와 var_hc_a(계약 A)가 쥔다. 플래그 접두는 hc_(설계 부록 A).
 */
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { Project } from "@/project/types";
import { FLAGSHIP_BEAT_MANIFESTS } from "../beats";
import type { FlagshipDemoBuildResult } from "../types";
import { buildContractA, SW, V } from "./contractA";
import { setupHunterDatabase } from "./db";
import { execTool } from "./kit";
import { applyHunterLore } from "./lore";
import { BGM, buildMaps, M } from "./maps";
import { buildChapterEnd, buildOpening, buildWorldStory, defineEndings, setupTitle } from "./story";

const END_CH1 = "end_hc_chapter1";

/** 지역 세 곳을 세계 지도와 잇는다(마을 쪽 착지는 서쪽 입구). */
function linkWorld(project: Project, s: ReturnType<typeof buildMaps>): void {
  execTool(project, "create_transfer_pair", {
    a: { mapId: M.world, x: s.world.swampGate.x, y: s.world.swampGate.y },
    b: { mapId: M.swamp, x: s.swamp.entry.x, y: s.swamp.entry.y },
    fade: "black",
  });
}

export function createHunterContractFlagshipDemo(): FlagshipDemoBuildResult {
  const project = createBlankProject();
  project.meta.title = "사냥꾼 계약";
  project.meta.author = "OPRN Flagship Studio";
  project.system.playResolution = { width: 480, height: 270 };
  delete project.system.cameraZoom;
  project.system.dialogueStyle = "pixel-cinematic";

  setupHunterDatabase(project);
  const stage = buildMaps(project);
  linkWorld(project, stage);
  buildWorldStory(project, stage);
  buildContractA(project, stage);
  defineEndings(project, END_CH1);
  buildChapterEnd(project, stage, END_CH1);

  // 장면 하나에 changeTile 하나(스타일 잠금) — 어미가 쓰러지면 둥지 물가 칸 하나가 마른다.
  {
    const nest = project.maps[M.nest]!;
    const at = { x: stage.nest.boss.x, y: stage.nest.boss.y };
    const idx = at.y * nest.width + at.x;
    const truth = nest.events.find((e) => e.id === "ev_hc_a_truth")!;
    const p = truth.pages!.find((pg) => pg.id === "truth")!;
    p.commands.unshift({ kind: "changeTile", mapId: M.nest, layer: "lower", x: at.x, y: at.y, tile: nest.lowerTiles[idx] ?? 0 } as never);
  }

  // 시간 — 하루가 빨리 흐르지 않게(실제 1초 = 게임 1분). 낮에 시작한다(늪 일은 밤까지 기다리는 것이 고리의 일부).
  execTool(project, "configure_time_system", { enabled: true, minutesPerRealSecond: 1, dayStartHour: 10, dayEndHour: 30 });

  buildOpening(project, stage);
  setupTitle(project);

  execTool(project, "configure_story_journal", { title: "일지", writers: [{ id: "doran", name: "도르반" }], lines: [] });
  execTool(project, "configure_field_menu", { preset: "custom", entries: [
    { command: "items", label: "가방" }, { command: "skills", label: "기술" }, { command: "equipment", label: "장비" }, { command: "status", label: "상태" },
    { command: "journal", label: "일지" }, { command: "backlog", label: "대화 기록" },
    { command: "save", label: "저장" }, { command: "load", label: "불러오기" }, { command: "options", label: "설정" }, { command: "to-title", label: "타이틀로" },
  ] });

  for (const id of Object.values(M)) { const m = project.maps[id]!; if (!m.defaultLighting) m.defaultLighting = { ambient: 0, color: "#000000", sources: [] }; }
  execTool(project, "set_map_properties", { mapId: M.inn, zoom: 2 });

  // 빈 시드 맵은 남기지 않는다(맵 트리 밖 고아).
  for (const id of Object.keys(project.maps)) if (!(Object.values(M) as string[]).includes(id)) delete project.maps[id];
  project.startMapId = M.world;
  project.startPos = { x: stage.world.start.x, y: stage.world.start.y };
  project.mapTree = { mapId: M.world, children: [M.swamp, M.inn, M.nest].map((mapId) => ({ mapId, children: [] })) };

  execTool(project, "set_project_settings", { fieldHud: { objective: true, clock: true, widgets: [] } });
  execTool(project, "set_project_settings", { resources: { defaultBgmResourceId: BGM.world } });

  const ensureVar = (id: string, name: string): void => { if (!project.variables.some((v) => v.id === id)) project.variables.push({ id, name }); };
  const ensureSw = (id: string, name: string): void => { if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name }); };
  for (const [key, id] of Object.entries(V)) ensureVar(id, `사냥꾼 · ${key}`);
  for (const id of new Set([...Object.values(SW), ...(JSON.stringify(project.maps).match(/sw_hc_[a-z0-9_]+/g) ?? [])])) ensureSw(id, id.replace(/^sw_hc_/, "사냥꾼 · "));

  const keepTilesets = new Set(Object.values(project.maps).map((m) => m.tilesetId));
  keepTilesets.add("worldmap_selected");
  for (const id of [...keepTilesets]) for (const graft of project.tilesets[id]?.tileGrafts ?? []) keepTilesets.add(graft.sourceChipset);
  for (const id of Object.keys(project.tilesets)) if (!keepTilesets.has(id)) delete project.tilesets[id];

  applyHunterLore(project, (target, name, args) => execTool(target, name, args));

  const serialized = serialize(project);
  const reloaded = deserialize(serialized);
  return {
    id: "hunter-contract",
    manifest: { ...FLAGSHIP_BEAT_MANIFESTS["hunter-contract"], mapCount: Object.keys(reloaded.maps).length, endingCount: reloaded.endings?.length ?? 0 },
    project: reloaded,
    serialized,
  };
}
