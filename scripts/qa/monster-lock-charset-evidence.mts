// 몬스터 수집 장르 잠금 — 캐릭터 칩 잠금 헤드리스 증거(2026-10-16).
// 실행: bun scripts/qa/monster-lock-charset-evidence.mts <출력 JSON> [--no-campaign]
// 하는 일: 「몬스터 수집 게임」 프로젝트를 만든다 → 실제 SQLite 프로젝트 폴더(initLocalProjectStore)에 저장 → 다시 열어(openLocalProjectStore) 읽는다 →
//   재로드본 위에서 조수 경로(assistantRun) 도구를 돌려 기본 그림·거부·사용자 경로·해제·표지(system.genre)·프롬프트를 확인한다.
// 모델을 쓰지 않는다(조수 대용 아님 — 도구 실행기와 프롬프트 조립 함수를 직접 부른다). 결과는 JSON 으로만 쓰고 HTML 은 만들지 않는다.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initLocalProjectStore, openLocalProjectStore } from "../../electron/local-store/store.ts";
import { buildPiAgentSystemPrompt } from "../../src/ai/piAgent/systemPrompt.ts";
import { buildSystemPrompt } from "../../src/ai/contextBuilder.ts";
import { runTool } from "../../src/editor/tools/toolRunner.ts";
import type { ToolContext } from "../../src/editor/tools/types.ts";
import { createProjectStartSeed } from "../../src/editor/projectStartSeed.ts";
import { decodeCharsetFrameIndex } from "../../src/assets/easyrpgRtp.ts";
import { charsetFamilyOf } from "../../src/project/charsetFamily.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import { genreLockPromptNote } from "../../src/project/genreLock.ts";
import type { Project } from "../../src/project/types.ts";

const out = process.argv[2];
if (!out) throw new Error("usage: bun scripts/qa/monster-lock-charset-evidence.mts <out.json> [--no-campaign]");
const skipCampaign = process.argv.includes("--no-campaign");

interface Chip { readonly resourceId: string; readonly characterIndex: number; readonly label: string }
interface Check { readonly name: string; readonly pass: boolean; readonly detail?: unknown }
const checks: Check[] = [];
const check = (name: string, pass: boolean, detail?: unknown) => { checks.push({ name, pass, ...(detail !== undefined ? { detail } : {}) }); };

function lastEventChip(project: Project, mapId: string): Chip | undefined {
  const event = project.maps[mapId]!.events.at(-1);
  const graphic = event?.pages?.[0]?.graphic;
  if (!graphic?.sprite) return undefined;
  return { resourceId: graphic.sprite.id, characterIndex: decodeCharsetFrameIndex(graphic.pattern ?? 0).characterIndex, label: event!.name ?? event!.id };
}

const tmp = mkdtempSync(join(tmpdir(), "oprn-monster-lock-"));
const result: Record<string, unknown> = {};
try {
  // 1. 「몬스터 수집 게임」 프로젝트 생성(새 프로젝트 마법사의 시작 장르와 같은 함수).
  const seed = await createProjectStartSeed("monster-collect", "별빛 몬스터", "ai");
  const heroOf = (project: Project) => project.database.actors.find((actor) => actor.id === "actor_hero")!;
  result.seedHero = { resourceId: heroOf(seed).characterResourceId, characterIndex: heroOf(seed).characterIndex ?? 0, faceResourceId: heroOf(seed).faceResourceId ?? null };
  check("프리셋 직후 주인공 걷기 그림이 몬스터 계열(Scarloxy 트레이너)이다", heroOf(seed).characterResourceId === "scarloxy-charset-people1" && (heroOf(seed).characterIndex ?? 0) === 0, result.seedHero);
  check("프리셋 직후 장르 표지·잠금이 모두 남는다", seed.system.genre === "monster-collect" && seed.system.genreLock?.preset === "monster-collect", { genre: seed.system.genre, genreLock: seed.system.genreLock });
  check("저장본에 허용 캐릭터 칩 계열이 복사된다(정본은 프로젝트)", Array.isArray(seed.system.genreLock?.allowedCharsetFamilies) && seed.system.genreLock!.allowedCharsetFamilies!.includes("scarloxy-people") && !seed.system.genreLock!.allowedCharsetFamilies!.includes("rtp-people"));

  // 2. 실제 SQLite 프로젝트 폴더에 저장하고 다시 읽는다.
  const projectDir = join(tmp, "project");
  const store = await initLocalProjectStore({ projectDir });
  let savedSha = "";
  let projectId = "";
  try {
    projectId = store.projectId;
    const saved = await store.saveProject(seed);
    if (saved.kind !== "saved") throw new Error(`save failed: ${JSON.stringify(saved)}`);
    savedSha = saved.sha256;
  } finally { store.close(); }
  const reopened = await openLocalProjectStore({ projectDir });
  let project: Project;
  try {
    const snapshot = reopened.loadSnapshot();
    if (!snapshot) throw new Error("reload returned nothing");
    check("SQLite 재로드본의 sha256 이 저장 때와 같다", snapshot.sha256 === savedSha, { projectId, projectDir: "(임시 폴더, 종료 후 삭제)", sha256: snapshot.sha256, revision: snapshot.revision });
    project = snapshot.project;
  } finally { reopened.close(); }
  result.persistence = { projectId, sha256: savedSha };
  const reHero = heroOf(project);
  check("재로드 뒤에도 주인공 걷기 그림·장르 표지·잠금(허용 캐릭터 칩 계열 포함)이 그대로다",
    reHero.characterResourceId === "scarloxy-charset-people1" && project.system.genre === "monster-collect"
      && JSON.stringify(project.system.genreLock) === JSON.stringify(seed.system.genreLock),
    { hero: reHero.characterResourceId, genre: project.system.genre, lock: project.system.genreLock });

  // 3. 재로드본 위에서 조수 경로 도구를 돌린다.
  const mapId = project.startMapId;
  const ctx: ToolContext = { project, currentMapId: mapId, assistantRun: true };
  const placed: Chip[] = [];

  const npcDefault = runTool(ctx, "place_npc", { mapId, name: "마을 사람", x: 5, y: 5 }, { dryRun: false });
  const npcChip = npcDefault.ok ? lastEventChip(ctx.project, mapId) : undefined;
  if (npcChip) placed.push(npcChip);
  check("place_npc 에 그림을 안 주면 몬스터 계열(Scarloxy) 칩이 기본으로 골라진다", npcDefault.ok && !!npcChip && charsetFamilyOf(ctx.project, npcChip.resourceId) === "scarloxy-people", { ok: npcDefault.ok, chip: npcChip });

  const npcGeneric = runTool(ctx, "place_npc", { mapId, name: "길손", x: 7, y: 6, graphic: { query: "villager" } }, { dryRun: false });
  const genericChip = npcGeneric.ok ? lastEventChip(ctx.project, mapId) : undefined;
  if (genericChip) placed.push(genericChip);
  check("graphic:{query:\"villager\"} 도 허용 칩만 고른다", npcGeneric.ok && !!genericChip && charsetFamilyOf(ctx.project, genericChip.resourceId) === "scarloxy-people", { chip: genericChip });

  const rtp = runTool(ctx, "place_npc", { mapId, name: "판타지 청년", x: 9, y: 5, graphic: { textureKey: "tex_easyrpg_charset_people1", characterIndex: 2 } }, { dryRun: false });
  const rtpMessage = rtp.issues?.[0]?.message ?? "";
  check("허용 밖(RTP People1)을 지정하면 거부되고 가장 가까운 허용 칩이 안내된다", !rtp.ok && rtp.issues?.[0]?.code === "genre-lock" && rtpMessage.includes("가장 가까운 허용 칩") && rtpMessage.includes("tex_scarloxy_charset_people1"), { message: rtpMessage });
  check("거부된 호출은 맵을 바꾸지 않았다", ctx.project.maps[mapId]!.events.every((event) => event.name !== "판타지 청년"));

  const actorRtp = runTool(ctx, "upsert_actor", { actor: { id: "actor_rival", name: "라이벌", classId: "class_hero", characterResourceId: "easyrpg-charset-actor3", characterIndex: 1 } }, { dryRun: false });
  check("배우의 걷기 그림을 허용 밖(RTP Actor3)으로 바꾸는 것도 거부된다", !actorRtp.ok && actorRtp.issues?.[0]?.code === "genre-lock", { ok: actorRtp.ok, message: actorRtp.issues?.[0]?.message ?? actorRtp.summary });

  const grandma = runTool(ctx, "place_npc", { mapId, name: "할머니", x: 3, y: 7, graphic: { query: "할머니" } }, { dryRun: false });
  check("허용 칩에 없는 외형 검색(「할머니」)은 다른 그림으로 대체하지 않고 잠금 안내와 함께 거부된다", !grandma.ok && (grandma.issues?.[0]?.message ?? "").includes("장르 잠금"), { message: grandma.issues?.[0]?.message });

  const troopId = ctx.project.database.troops[0]?.id;
  const trainer = troopId ? runTool(ctx, "place_trainer", { mapId, x: Math.floor(ctx.project.maps[mapId]!.width / 2) + 4, y: Math.floor(ctx.project.maps[mapId]!.height / 2) + 3, name: "산책하는 소년", troopId }, { dryRun: false }) : undefined;
  const trainerChip = trainer?.ok ? lastEventChip(ctx.project, mapId) : undefined;
  if (trainerChip) placed.push(trainerChip);
  check("place_trainer 기본 그림도 허용 칩(트레이너)이다", !!trainer?.ok && !!trainerChip && charsetFamilyOf(ctx.project, trainerChip.resourceId) === "scarloxy-people", { trainerOk: trainer?.ok, summary: trainer?.summary, troopId, chip: trainerChip });

  // 사용자 손 편집(assistantRun 아님)은 막지 않는다.
  const handCtx: ToolContext = { project: ctx.project, currentMapId: mapId };
  const hand = runTool(handCtx, "place_npc", { mapId, name: "사용자가 놓은 청년", x: 11, y: 11, graphic: { textureKey: "tex_easyrpg_charset_people1", characterIndex: 2 } }, { dryRun: false });
  check("사용자 손 편집 경로(assistantRun 아님)는 허용 밖 그림도 막지 않는다", hand.ok, { summary: hand.summary });

  // 4. 장르 표지·프롬프트.
  const note = genreLockPromptNote(ctx.project) ?? "";
  const piSpatial = buildPiAgentSystemPrompt(ctx.project, [mapId], false, { spatialWork: true }).join("\n");
  const piPlain = buildPiAgentSystemPrompt(ctx.project, [mapId], false, { spatialWork: false }).join("\n");
  const legacy = buildSystemPrompt(ctx.project);
  const line = "캐릭터 그림(플레이어·NPC·트레이너 걷기 그림)도 이 장르 칩만 쓴다";
  check("조수 프롬프트(공간 시공·비공간·기본 컨텍스트) 모두에 「캐릭터 그림도 이 장르 칩만」 줄이 매 턴 실린다", piSpatial.includes(line) && piPlain.includes(line) && legacy.includes(line) && note.includes(line));
  result.promptNote = note;
  result.piPlainLockLine = piPlain.split("\n").find((entry) => entry.includes("[장르 잠금")) ?? null;

  // 5. 해제 경로.
  const release = runTool(ctx, "configure_monster_system", { enabled: false }, { dryRun: false });
  check("configure_monster_system(enabled:false) 가 잠금을 풀고 「장르 잠금 해제됨」을 남긴다", release.ok && ctx.project.system.genreLock === undefined && JSON.stringify(release.diff?.warnings ?? []).includes("장르 잠금 해제됨"));
  check("해제한 뒤에도 장르 표지는 남고 조수 프롬프트에 표지 안내가 실린다(막지는 않는다)", ctx.project.system.genre === "monster-collect" && buildPiAgentSystemPrompt(ctx.project, [mapId], false, { spatialWork: false }).join("\n").includes("[장르 표지"));
  const afterRelease = runTool(ctx, "place_npc", { mapId, name: "해제 뒤 청년", x: 12, y: 4, graphic: { textureKey: "tex_easyrpg_charset_people1", characterIndex: 2 } }, { dryRun: false });
  check("해제하면 허용 밖 그림도 다시 쓸 수 있다", afterRelease.ok, { summary: afterRelease.summary });

  // 6. 잠금이 못 걸리는 프로젝트(몬스터 칩셋이 없는 옛 프로젝트)도 몬스터 전용 도구가 성공하면 표지는 남는다.
  const legacyProject = createBlankProject();
  for (const id of Object.keys(legacyProject.tilesets)) if (id.includes("monster_")) delete legacyProject.tilesets[id];
  const legacyCtx: ToolContext = { project: legacyProject, currentMapId: legacyProject.startMapId, assistantRun: true };
  const configured = runTool(legacyCtx, "configure_monster_system", { enabled: true }, { dryRun: false });
  check("잠금이 못 걸리는 프로젝트: 몬스터 전용 도구 성공 → system.genre 표지만 남고 잠금은 없다", configured.ok && legacyCtx.project.system.genre === "monster-collect" && legacyCtx.project.system.genreLock === undefined, { genre: legacyCtx.project.system.genre, lock: legacyCtx.project.system.genreLock ?? null });
  const markerPrompt = buildPiAgentSystemPrompt(legacyCtx.project, [legacyCtx.project.startMapId], false, { spatialWork: false }).join("\n");
  check("그 프로젝트의 조수 프롬프트에 매 턴 「몬스터 수집 게임」 표지가 실린다", markerPrompt.includes("[장르 표지") && markerPrompt.includes(line));
  const markerRtp = runTool(legacyCtx, "place_npc", { mapId: legacyCtx.project.startMapId, name: "청년", x: 5, y: 5, graphic: { textureKey: "tex_easyrpg_charset_people1", characterIndex: 2 } }, { dryRun: false });
  check("표지만 있는 프로젝트는 안내만 하고 거부하지 않는다(기존 프로젝트를 깨지 않는다)", markerRtp.ok, { summary: markerRtp.summary });
  result.markerPromptLine = markerPrompt.split("\n").find((entry) => entry.includes("[장르 표지")) ?? null;

  // 7. 연애 프리셋은 캐릭터를 잠그지 않는다.
  const romance = createBlankProject();
  const { enableGenreLock } = await import("../../src/project/genreLock.ts");
  enableGenreLock(romance, "romance");
  const romanceCtx: ToolContext = { project: romance, currentMapId: romance.startMapId, assistantRun: true };
  const romanceNpc = runTool(romanceCtx, "place_npc", { mapId: romance.startMapId, name: "청년", x: 5, y: 5, graphic: { textureKey: "tex_easyrpg_charset_people1", characterIndex: 2 } }, { dryRun: false });
  check("연애(romance) 잠금은 캐릭터 칩을 건드리지 않는다", romanceNpc.ok && romance.system.genreLock?.allowedCharsetFamilies === undefined, { summary: romanceNpc.summary });

  // 8. 옛 잠금(캐릭터 계열 필드 없음)도 표를 따르고, 다시 켜면 저장본에 복사된다.
  const old = createBlankProject();
  enableGenreLock(old, "monster-collect");
  const oldLock = { ...old.system.genreLock! };
  delete (oldLock as { allowedCharsetFamilies?: unknown }).allowedCharsetFamilies;
  old.system.genreLock = oldLock;
  const oldCtx: ToolContext = { project: old, currentMapId: old.startMapId, assistantRun: true };
  const oldRtp = runTool(oldCtx, "place_npc", { mapId: old.startMapId, name: "청년", x: 5, y: 5, graphic: { textureKey: "tex_easyrpg_charset_people1", characterIndex: 2 } }, { dryRun: false });
  check("캐릭터 잠금이 생기기 전에 켠 옛 잠금도 표를 따라 허용 밖 그림을 거부한다", !oldRtp.ok && oldRtp.issues?.[0]?.code === "genre-lock");
  enableGenreLock(old, "monster-collect");
  check("같은 잠금을 다시 켜면 허용 캐릭터 칩 계열이 저장본에 복사된다", Array.isArray(old.system.genreLock?.allowedCharsetFamilies));

  // 9. 저작자가 이미 바꾼 주인공은 잠금을 켜도 바뀌지 않는다.
  const authored = createBlankProject();
  const authoredHero = heroOf(authored);
  authoredHero.characterResourceId = "easyrpg-charset-actor3";
  authoredHero.characterIndex = 4;
  enableGenreLock(authored, "monster-collect");
  check("저작자가 바꾼 주인공 그림은 잠금을 켜도 그대로다", heroOf(authored).characterResourceId === "easyrpg-charset-actor3" && heroOf(authored).characterIndex === 4);

  result.placedChips = placed;

  // 10. 캠페인(build_monster_game 의 재료) — 주인공과 NPC 칩.
  if (!skipCampaign) {
    const { createMonsterExpedition } = await import("../../src/project/examples/monsterExpedition/index.ts");
    const built = createMonsterExpedition();
    const campaign = built.project;
    const campaignHero = heroOf(campaign);
    const families = new Map<string, number>();
    const roles: { event: string; map: string; chip: string; label: string }[] = [];
    for (const map of Object.values(campaign.maps)) {
      for (const event of map.events) {
        const graphic = event.pages?.[0]?.graphic;
        if (!graphic?.sprite || graphic.transparent) continue;
        const idx = decodeCharsetFrameIndex(graphic.pattern ?? 0).characterIndex;
        const family = charsetFamilyOf(campaign, graphic.sprite.id);
        families.set(family, (families.get(family) ?? 0) + 1);
        if (/_(professor|rival|mom|shop|leader|boss|researcher|nurse)$/u.test(event.id) && roles.length < 24) roles.push({ event: event.id, map: map.id, chip: `${graphic.sprite.id}#${idx}`, label: event.name ?? "" });
      }
    }
    result.campaign = { hero: { resourceId: campaignHero.characterResourceId, characterIndex: campaignHero.characterIndex ?? 0, faceResourceId: campaignHero.faceResourceId ?? null }, lock: campaign.system.genreLock ?? null, genre: campaign.system.genre ?? null, familyCounts: Object.fromEntries(families), roles, maps: Object.keys(campaign.maps).length };
    check("캠페인 생성본의 주인공도 몬스터 계열(Scarloxy)이고 잠금 직전 기본 Actor1 이 아니다", campaignHero.characterResourceId === "scarloxy-charset-people1", result.campaign);
    check("캠페인 이벤트 걷기 그림에 허용 밖 계열(RTP 사람·마법 학교·공용 공방 사람)이 남지 않는다", !["rtp-people", "wizarding", "shared-actor"].some((family) => (families.get(family) ?? 0) > 0), Object.fromEntries(families));
  }

  result.checks = checks;
  writeFileSync(out, JSON.stringify(result, null, 2));
  const failed = checks.filter((entry) => !entry.pass);
  console.log(`checks: ${checks.length - failed.length}/${checks.length} pass`);
  for (const entry of failed) console.log("FAIL", entry.name, JSON.stringify(entry.detail ?? null).slice(0, 600));
  process.exitCode = failed.length ? 1 : 0;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
