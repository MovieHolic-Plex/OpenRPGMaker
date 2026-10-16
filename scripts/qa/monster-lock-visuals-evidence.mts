// 몬스터 수집 장르 잠금 — 얼굴(faceset)·전투 그림 잠금 헤드리스 증거(2026-10-16).
// 실행: npx vite-node scripts/qa/monster-lock-visuals-evidence.mts <출력 JSON>
// 하는 일: 「몬스터 수집 게임」 프로젝트를 만든다 → 실제 SQLite 프로젝트 폴더(initLocalProjectStore)에 저장 → 다시 열어(openLocalProjectStore) 읽는다 →
//   재로드본 위에서 조수 경로(assistantRun) 도구를 직접 돌려 얼굴·몬스터 전투 그림·트레이너 전투 그림·전투 배경의 허용·거부·생성 대기·해제를 확인한다.
// 모델을 쓰지 않는다(조수 대용 아님 — 도구 실행기와 프롬프트 조립 함수를 직접 부른다). 결과는 JSON 으로만 쓰고 HTML 은 만들지 않는다.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initLocalProjectStore, openLocalProjectStore } from "../../electron/local-store/store.ts";
import { buildPiAgentSystemPrompt } from "../../src/ai/piAgent/systemPrompt.ts";
import { runTool } from "../../src/editor/tools/toolRunner.ts";
import type { ToolContext } from "../../src/editor/tools/types.ts";
import { createProjectStartSeed } from "../../src/editor/projectStartSeed.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import { enableGenreLock } from "../../src/project/genreLock.ts";
import { faceFamilyOf } from "../../src/project/visualFamily.ts";
import type { Project } from "../../src/project/types.ts";

const out = process.argv[2];
if (!out) throw new Error("usage: npx vite-node scripts/qa/monster-lock-visuals-evidence.mts <out.json>");

interface Check { readonly name: string; readonly pass: boolean; readonly detail?: unknown }
const checks: Check[] = [];
const check = (name: string, pass: boolean, detail?: unknown) => { checks.push({ name, pass, ...(detail !== undefined ? { detail } : {}) }); };
const msg = (result: { issues?: readonly { message: string }[]; summary: string }): string => result.issues?.[0]?.message ?? result.summary;
const warnText = (result: { diff?: { warnings?: readonly string[] }; warnings?: readonly string[] }): string => JSON.stringify(result.diff?.warnings ?? (result as { warnings?: unknown }).warnings ?? []);

const tmp = mkdtempSync(join(tmpdir(), "oprn-monster-lock-visuals-"));
const result: Record<string, unknown> = {};
try {
  // 1. 「몬스터 수집 게임」 프로젝트 → 실제 SQLite 저장 → 재로드.
  const seed = await createProjectStartSeed("monster-collect", "별빛 몬스터", "ai");
  const heroOf = (project: Project) => project.database.actors.find((actor) => actor.id === "actor_hero")!;
  check("프리셋 직후 잠금에 허용 얼굴·전투 그림 계열이 저장본으로 복사된다(정본은 프로젝트)",
    Array.isArray(seed.system.genreLock?.allowedFaceFamilies) && seed.system.genreLock!.allowedFaceFamilies!.includes("scarloxy-face") && !seed.system.genreLock!.allowedFaceFamilies!.includes("fantasy-people-face")
      && Array.isArray(seed.system.genreLock?.allowedBattleFamilies) && seed.system.genreLock!.allowedBattleFamilies!.includes("battler:harness-monster") && !seed.system.genreLock!.allowedBattleFamilies!.includes("battler:generic-enemy"),
    { allowedFaceFamilies: seed.system.genreLock?.allowedFaceFamilies, allowedBattleFamilies: seed.system.genreLock?.allowedBattleFamilies });
  check("기본 주인공이 Scarloxy 트레이너 칩과 그 짝 얼굴을 받는다", heroOf(seed).characterResourceId === "scarloxy-charset-people1" && heroOf(seed).faceResourceId === "generated-faceset-missing-scarloxy-00",
    { chip: heroOf(seed).characterResourceId, face: heroOf(seed).faceResourceId ?? null });

  const projectDir = join(tmp, "project");
  const store = await initLocalProjectStore({ projectDir });
  let savedSha = "", projectId = "";
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
    check("SQLite 재로드본의 sha256 이 저장 때와 같다", snapshot.sha256 === savedSha, { projectId, sha256: snapshot.sha256, revision: snapshot.revision });
    project = snapshot.project;
  } finally { reopened.close(); }
  result.persistence = { projectId, sha256: savedSha };
  check("재로드 뒤에도 허용 얼굴·전투 그림 계열·주인공 얼굴이 그대로다",
    JSON.stringify(project.system.genreLock) === JSON.stringify(seed.system.genreLock) && heroOf(project).faceResourceId === "generated-faceset-missing-scarloxy-00",
    { lock: project.system.genreLock });

  const mapId = project.startMapId;
  const ctx: ToolContext = { project, currentMapId: mapId, assistantRun: true };
  const probe = (name: string, args: Record<string, unknown>) => runTool(ctx, name, args, { dryRun: false });
  const eventFaces = (): string[] => {
    const ids: string[] = [];
    const walk = (v: unknown): void => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") { const o = v as Record<string, unknown>; if (o.kind === "changeFace" && typeof o.resourceId === "string") ids.push(o.resourceId); Object.values(o).forEach(walk); } };
    ctx.project.maps[mapId]!.events.forEach(walk);
    return ids;
  };

  // 2. 얼굴 ─────────────────────────────────────────────────────────────────────────────
  const rtpFace = probe("place_npc", { mapId, name: "판타지 청년", x: 5, y: 5, pages: [{ lines: ["안녕"] }], face: { resourceId: "easyrpg-faceset-actor1-02" } });
  result.faceRtpReject = msg(rtpFace);
  const rtpFaceFaces = eventFaces();
  result.faceRtpOnPairedChip = { ok: rtpFace.ok, faces: rtpFaceFaces, warnings: warnText(rtpFace).slice(0, 400) };
  check("걷기 칩과 짝이 있는 NPC 에 허용 밖 얼굴(RTP Actor1)을 주면 기존 짝 교정이 허용 계열 짝 얼굴로 바꾸거나 거부한다(허용 밖 얼굴이 남지 않는다)",
    (rtpFace.ok && rtpFaceFaces.length > 0 && rtpFaceFaces.every((id) => faceFamilyOf(ctx.project, id) !== "fantasy-people-face")) || (!rtpFace.ok && rtpFace.issues?.[0]?.code === "genre-lock"), result.faceRtpOnPairedChip);

  const autoFace = probe("place_npc", { mapId, name: "마을 소년", x: 7, y: 5, pages: [{ lines: ["안녕"] }] });
  const autoFaces = eventFaces();
  result.faceAuto = { ok: autoFace.ok, faces: autoFaces };
  check("얼굴을 안 주면(허용 칩의 짝 얼굴) 허용 계열 얼굴이 자동으로 붙거나 얼굴 없이 간다", autoFace.ok && autoFaces.every((id) => faceFamilyOf(ctx.project, id) !== "fantasy-people-face"), { faces: autoFaces });

  const monsterFace = probe("place_npc", { mapId, name: "슬라임 주민", x: 9, y: 5, pages: [{ lines: ["끈적"] }], face: { resourceId: "easyrpg-faceset-monster-00" } });
  check("몬스터 얼굴(RTP Monster)은 허용된다", monsterFace.ok, { message: msg(monsterFace) });

  const bustFace = probe("place_npc", { mapId, name: "흉상 청년", x: 11, y: 5, pages: [{ lines: ["안녕"] }], face: { resourceId: "shared-people1-boy-expressions-bust-base" } });
  result.facePending = warnText(bustFace);
  check("맞는 허용 그림이 없는 칸(사람 흉상)은 거부 대신 「생성 대기」로 저장되고 경고가 나온다",
    bustFace.ok && warnText(bustFace).includes("생성 대기") && !eventFaces().some((id) => id.includes("-bust")), { ok: bustFace.ok, warnings: warnText(bustFace) });

  const actorRtp = probe("upsert_actor", { actor: { id: "actor_rival", name: "라이벌", classId: "class_hero", faceResourceId: "easyrpg-faceset-actor2-03" } });
  result.faceActorReject = msg(actorRtp);
  check("배우 얼굴을 허용 밖으로 바꾸는 것도 거부된다", !actorRtp.ok && actorRtp.issues?.[0]?.code === "genre-lock", { message: msg(actorRtp) });

  // 3. 몬스터 전투 그림 ─────────────────────────────────────────────────────────────────
  const slimeEnemy = probe("upsert_enemy", { enemy: { id: "enemy_slime_x", name: "초록 슬라임", monsterResourceId: "generated-enemy-slime-01" } });
  result.battlerGeneric = { ok: slimeEnemy.ok, message: msg(slimeEnemy), warnings: warnText(slimeEnemy) };
  const slimeStored = ctx.project.database.enemies.find((enemy) => enemy.id === "enemy_slime_x");
  check("일반 JRPG 적 그림(generated-enemy-*)은 거부되거나(대안 있음) 비워져 「생성 대기」로 저장된다(일반 적 그림이 남지 않는다)",
    (!slimeEnemy.ok && slimeEnemy.issues?.[0]?.code === "genre-lock") || (slimeEnemy.ok && warnText(slimeEnemy).includes("생성 대기") && slimeStored?.monsterResourceId === undefined), result.battlerGeneric);

  const harnessEnemy = probe("upsert_enemy", { enemy: { id: "enemy_sparkit_x", name: "스파킷", monsterResourceId: "harness-monster-sparkit-front" } });
  check("하네스 몬스터 그림(앞모습)은 허용된다", harnessEnemy.ok, { message: msg(harnessEnemy) });

  const byName = probe("upsert_enemy", { enemy: { id: "enemy_leafling_x", name: "풀잎링" } });
  const byNameStored = ctx.project.database.enemies.find((enemy) => enemy.id === "enemy_leafling_x");
  result.battlerByName = { ok: byName.ok, art: byNameStored?.monsterResourceId ?? null, message: msg(byName) };
  check("그림 없이 이름만 주면 허용 계열 그림 안에서만 이름으로 찾고, 못 찾으면 거부하지 않고 비워 둔다", byName.ok && (byNameStored?.monsterResourceId === undefined || /^(harness|scarloxy)-monster-/u.test(byNameStored.monsterResourceId)), result.battlerByName);

  const skeleton = probe("upsert_enemy", { enemy: { id: "enemy_skeleton_x", name: "해골 궁수" } });
  const skeletonStored = ctx.project.database.enemies.find((enemy) => enemy.id === "enemy_skeleton_x");
  result.battlerPending = { ok: skeleton.ok, art: skeletonStored?.monsterResourceId ?? null, warnings: warnText(skeleton) };
  check("번들에 맞는 몬스터 그림이 없는 이름(해골 궁수)은 일반 적 그림으로 때우지 않고 「생성 대기」로 저장된다", skeleton.ok && skeletonStored !== undefined && skeletonStored.monsterResourceId === undefined && warnText(skeleton).includes("생성 대기"), result.battlerPending);

  const species = probe("define_monster_species", { species: { id: "species_ghost_x", name: "유령", baseStats: { maxHp: 20, maxMp: 4, attack: 10, defense: 8, mind: 8, agility: 12 }, captureRate: 0.5, graphic: { monsterResourceId: "generated-enemy-ghost-01" } } });
  result.speciesGeneric = { ok: species.ok, message: msg(species), warnings: warnText(species) };
  check("몬스터 종의 전투 그림을 일반 적 그림으로 지정해도 막힌다(거부 또는 생성 대기)", (!species.ok && species.issues?.[0]?.code === "genre-lock") || (species.ok && warnText(species).includes("생성 대기")), result.speciesGeneric);

  // 4. 트레이너 전투 그림·전투 배경 ───────────────────────────────────────────────────────
  const troopOk = probe("upsert_troop", { troop: { id: "troop_boy_x", name: "산책하는 소년", enemyIds: ["enemy_sparkit_x"], trainerBattle: true, uncapturable: true, trainerSprite: { front: "boy", back: "hero_m" } } });
  check("번들 트레이너 그림(boy/hero_m)은 허용된다", troopOk.ok, { message: msg(troopOk) });
  const troopNinja = probe("upsert_troop", { troop: { id: "troop_ninja_x", name: "닌자", enemyIds: ["enemy_sparkit_x"], trainerBattle: true, uncapturable: true, trainerSprite: { front: "mystery_ninja" } } });
  const ninjaStored = ctx.project.database.troops.find((troop) => troop.id === "troop_ninja_x");
  result.trainerPending = { ok: troopNinja.ok, sprite: ninjaStored?.trainerSprite ?? null, warnings: warnText(troopNinja) };
  check("번들에 없는 트레이너 그림 id 는 지어내지 않고 비워 「생성 대기」로 저장된다", troopNinja.ok && ninjaStored?.trainerSprite === undefined && warnText(troopNinja).includes("생성 대기"), result.trainerPending);

  const troopBare = probe("upsert_troop", { troop: { id: "troop_girl_x", name: "소녀 트레이너", enemyIds: ["enemy_sparkit_x"], trainerBattle: true, uncapturable: true } });
  const bareStored = ctx.project.database.troops.find((troop) => troop.id === "troop_girl_x");
  result.trainerFill = { sprite: bareStored?.trainerSprite ?? null, warnings: warnText(troopBare) };
  check("그림 없이 새로 만든 트레이너 적 그룹은 이름으로 근거가 확실하면 번들 그림이 채워진다", troopBare.ok && bareStored?.trainerSprite?.front === "girl", result.trainerFill);
  const troopUnknown = probe("upsert_troop", { troop: { id: "troop_xx_x", name: "정체불명", enemyIds: ["enemy_sparkit_x"], trainerBattle: true, uncapturable: true } });
  const unknownStored = ctx.project.database.troops.find((troop) => troop.id === "troop_xx_x");
  check("근거가 없으면 채우지 않고 「생성 대기」 안내만 남는다", troopUnknown.ok && unknownStored?.trainerSprite === undefined && warnText(troopUnknown).includes("생성 대기"), { warnings: warnText(troopUnknown) });

  const bgRtp = probe("upsert_troop", { troop: { id: "troop_bg_x", name: "숲 전투", enemyIds: ["enemy_sparkit_x"], previewBackgroundResourceId: "easyrpg-backdrop-forest1" } });
  const bgStored = ctx.project.database.troops.find((troop) => troop.id === "troop_bg_x");
  result.backdropTroopNormalized = bgStored?.previewBackgroundResourceId ?? null;
  check("적 그룹의 RTP 전투 배경은 기존 정규화가 이미 도트 겹 배경으로 바꿔 저장한다(잠금 이전부터 있던 정책 — 허용 계열만 남는다)", bgRtp.ok && bgStored?.previewBackgroundResourceId === "battle-scenery-plains", { stored: bgStored?.previewBackgroundResourceId });
  const terrainRtp = probe("upsert_database_utility", { collection: "terrains", record: { id: "terrain_rtp_x", name: "판타지 지형", damage: 0, encounterRatePercent: 5, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: false }, battleBackgroundResourceId: "easyrpg-backdrop-forest1" } });
  result.backdropReject = msg(terrainRtp);
  check("지형의 RTP 판타지 전투 배경은 거부되고 허용 배경(battle-scenery-*)이 안내된다", !terrainRtp.ok && terrainRtp.issues?.[0]?.code === "genre-lock" && msg(terrainRtp).includes("battle-scenery-"), { message: msg(terrainRtp) });
  const bgScenery = probe("upsert_troop", { troop: { id: "troop_bg_x", name: "숲 전투", enemyIds: ["enemy_sparkit_x"], previewBackgroundResourceId: "battle-scenery-forest" } });
  check("OPRN 도트 겹 배경은 허용된다", bgScenery.ok, { message: msg(bgScenery) });
  const mapBg = probe("set_map_properties", { mapId, battleBackground: "easyrpg-backdrop-forest1" });
  check("맵 전투 배경도 허용 밖이면 거부된다", !mapBg.ok && mapBg.issues?.[0]?.code === "genre-lock", { message: msg(mapBg) });

  // 전투 화면 스킨은 몬스터 대치·도트 측면 둘 다 허용 — 충돌 없음.
  const sideBattle = probe("configure_game_systems", { battleModel: "rm2k3" });
  check("전투 방식을 도트 측면으로 바꾸는 것은 막지 않는다(전투 화면 스킨은 pokemon·retro2003 둘 다 허용)", sideBattle.ok, { message: msg(sideBattle) });
  probe("configure_game_systems", { battleModel: "gen1" });

  // 5. 목록 필터 ─────────────────────────────────────────────────────────────────────────
  const listFaces = (c: ToolContext) => { const r = runTool(c, "list_resources", { kind: "faceset", query: "*", limit: 50 }, { dryRun: false }); return ((r.data as { matches?: { id: string }[] })?.matches ?? []).map((m) => m.id); };
  const assistantFaces = listFaces(ctx);
  const handFaces = listFaces({ project: ctx.project, currentMapId: mapId });
  result.listFaces = { assistant: assistantFaces.length, hand: handFaces.length, assistantFamilies: [...new Set(assistantFaces.map((id) => faceFamilyOf(ctx.project, id)))], handFamilies: [...new Set(handFaces.map((id) => faceFamilyOf(ctx.project, id)))] };
  check("조수 list_resources(faceset)에는 판타지 사람 얼굴이 안 나오고 사용자 경로에는 그대로 나온다",
    !assistantFaces.some((id) => faceFamilyOf(ctx.project, id) === "fantasy-people-face") && handFaces.some((id) => faceFamilyOf(ctx.project, id) === "fantasy-people-face"), result.listFaces);
  const listMonsters = (c: ToolContext) => { const r = runTool(c, "list_resources", { kind: "monster", query: "*", limit: 50 }, { dryRun: false }); return ((r.data as { matches?: { id: string }[]; total?: number })?.matches ?? []).map((m) => m.id); };
  const aMon = listMonsters(ctx);
  check("조수 list_resources(monster)에는 일반 JRPG 적 그림이 안 나온다", aMon.length > 0 && aMon.every((id) => !id.startsWith("generated-enemy-")), { sample: aMon.slice(0, 6) });
  const listBackdrops = (c: ToolContext) => { const r = runTool(c, "list_resources", { kind: "backdrop", query: "*", limit: 50 }, { dryRun: false }); return ((r.data as { matches?: { id: string }[] })?.matches ?? []).map((m) => m.id); };
  check("조수 list_resources(backdrop)에는 RTP 배경이 안 나온다", listBackdrops(ctx).every((id) => !id.startsWith("backdrop:easyrpg-backdrop-")), { count: listBackdrops(ctx).length, handCount: listBackdrops({ project: ctx.project, currentMapId: mapId }).length });

  // 6. 사용자 손 편집은 막지 않는다.
  const handCtx: ToolContext = { project: ctx.project, currentMapId: mapId };
  const hand = runTool(handCtx, "upsert_enemy", { enemy: { id: "enemy_hand_x", name: "손 편집", monsterResourceId: "generated-enemy-slime-01" } }, { dryRun: false });
  check("사용자 손 편집 경로(assistantRun 아님)는 허용 밖 그림도 막지 않는다", hand.ok, { summary: hand.summary });

  // 7. 점검 보고·프롬프트.
  const report = runTool(ctx, "check_genre_lock", {}, { dryRun: false });
  const reportData = report.data as { visuals?: { pending?: { where: string }[]; outsiders?: unknown[] } } | undefined;
  result.checkGenreLock = { summary: report.summary, pending: reportData?.visuals?.pending ?? [], outsiders: reportData?.visuals?.outsiders ?? [] };
  check("check_genre_lock 이 「생성 대기」 칸(그림 없는 적·트레이너)을 보고한다", (reportData?.visuals?.pending ?? []).some((entry) => entry.where.includes("enemy_skeleton_x")) && (reportData?.visuals?.pending ?? []).some((entry) => entry.where.includes("troop_xx_x")), result.checkGenreLock);
  const piSpatial = buildPiAgentSystemPrompt(ctx.project, [mapId], false, { spatialWork: true }).join("\n");
  const piPlain = buildPiAgentSystemPrompt(ctx.project, [mapId], false, { spatialWork: false }).join("\n");
  check("조수 프롬프트(공간 시공·비공간)에 「얼굴·전투 그림도 이 장르 계열만」 줄이 매 턴 실린다", piSpatial.includes("얼굴·흉상·전신 초상도 이 장르 것만 쓴다") && piSpatial.includes("전투 그림도 이 장르 것만 쓴다") && piPlain.includes("얼굴·흉상·전투 그림(몬스터·트레이너·전투 배경·전투 화면)도 이 장르 계열만"), {});
  result.promptLines = {
    spatial: piSpatial.split("\n").filter((line) => line.includes("얼굴·흉상·전신 초상도") || line.includes("전투 그림도 이 장르")),
    plain: piPlain.split("\n").find((line) => line.includes("[장르 잠금")) ?? null,
  };

  // 8. 해제 경로.
  const release = runTool(ctx, "configure_monster_system", { enabled: false }, { dryRun: false });
  check("configure_monster_system(enabled:false) 가 잠금을 풀고 「장르 잠금 해제됨」을 남긴다", release.ok && ctx.project.system.genreLock === undefined && JSON.stringify(release.diff?.warnings ?? []).includes("장르 잠금 해제됨"), { summary: release.summary });
  const afterRelease = probe("upsert_enemy", { enemy: { id: "enemy_after_x", name: "해제 뒤", monsterResourceId: "generated-enemy-slime-01" } });
  check("해제하면 허용 밖 얼굴·전투 그림도 다시 쓸 수 있다", afterRelease.ok, { summary: afterRelease.summary });

  // 9. 연애 프리셋은 얼굴·전투 그림을 잠그지 않는다.
  const romance = createBlankProject();
  enableGenreLock(romance, "romance");
  const romanceCtx: ToolContext = { project: romance, currentMapId: romance.startMapId, assistantRun: true };
  const romanceEnemy = runTool(romanceCtx, "upsert_enemy", { enemy: { id: "enemy_r", name: "슬라임", monsterResourceId: "generated-enemy-slime-01" } }, { dryRun: false });
  check("연애(romance) 잠금은 얼굴·전투 그림을 건드리지 않는다", romanceEnemy.ok && romance.system.genreLock?.allowedFaceFamilies === undefined && romance.system.genreLock?.allowedBattleFamilies === undefined, { summary: romanceEnemy.summary });

  // 10. 얼굴·전투 그림 잠금이 생기기 전에 켠 옛 잠금도 표를 따르고, 다시 켜면 저장본에 복사된다. 잠금 없는 기존 프로젝트는 불변.
  const old = createBlankProject();
  enableGenreLock(old, "monster-collect");
  const oldLock = { ...old.system.genreLock! };
  delete (oldLock as { allowedFaceFamilies?: unknown }).allowedFaceFamilies;
  delete (oldLock as { allowedBattleFamilies?: unknown }).allowedBattleFamilies;
  old.system.genreLock = oldLock;
  const oldCtx: ToolContext = { project: old, currentMapId: old.startMapId, assistantRun: true };
  const oldEnemy = runTool(oldCtx, "upsert_enemy", { enemy: { id: "enemy_old", name: "슬라임", monsterResourceId: "generated-enemy-slime-01" } }, { dryRun: false });
  check("얼굴·전투 그림 잠금이 생기기 전에 켠 옛 잠금도 표를 따라 허용 밖 전투 그림을 막는다", (!oldEnemy.ok && oldEnemy.issues?.[0]?.code === "genre-lock") || (oldEnemy.ok && JSON.stringify(oldEnemy.diff?.warnings ?? []).includes("생성 대기")), { ok: oldEnemy.ok });
  enableGenreLock(old, "monster-collect");
  check("같은 잠금을 다시 켜면 허용 얼굴·전투 그림 계열이 저장본에 복사된다", Array.isArray(old.system.genreLock?.allowedFaceFamilies) && Array.isArray(old.system.genreLock?.allowedBattleFamilies));
  const unlocked = createBlankProject();
  const unlockedCtx: ToolContext = { project: unlocked, currentMapId: unlocked.startMapId, assistantRun: true };
  const unlockedEnemy = runTool(unlockedCtx, "upsert_enemy", { enemy: { id: "enemy_u", name: "슬라임", monsterResourceId: "generated-enemy-slime-01" } }, { dryRun: false });
  check("잠금이 없는 프로젝트는 그림을 막지 않는다(기존 프로젝트 불변)", unlockedEnemy.ok && unlocked.system.genreLock === undefined, { summary: unlockedEnemy.summary });

  result.checks = checks;
  writeFileSync(out, JSON.stringify(result, null, 2));
  const failed = checks.filter((entry) => !entry.pass);
  console.log(`checks: ${checks.length - failed.length}/${checks.length} pass`);
  for (const entry of failed) console.log("FAIL", entry.name, JSON.stringify(entry.detail ?? null).slice(0, 900));
  process.exitCode = failed.length ? 1 : 0;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
