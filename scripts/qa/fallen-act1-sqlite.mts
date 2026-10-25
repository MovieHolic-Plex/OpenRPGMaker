// 폴른 스타 구운 프로젝트를 새 SQLite 정본 폴더에 저장하고, 닫았다 다시 열어 1막 새 뼈대가 그대로인지 본다.
//   bun scripts/qa/fallen-act1-sqlite.mts dist/demos/chrono-bell.project.json /tmp/fsact1/sqlite-<stamp>
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { initLocalProjectStore } from "../../electron/local-store/store";
import { loadProjectFile } from "../qa-game/check.mts";

const [file, dirArg] = process.argv.slice(2);
const projectDir = resolve(dirArg ?? `/tmp/fsact1/sqlite-${Date.now()}`, "project");
if (existsSync(resolve(projectDir, "project.sqlite"))) throw new Error(`이미 있다: ${projectDir}`);
const { project } = loadProjectFile(file!);
const first = await initLocalProjectStore({ projectDir });
let projectId = "";
try {
  const saved = await first.saveProject(project);
  projectId = first.projectId;
  console.log(JSON.stringify({ saved: true, projectId, revision: (saved as { revision?: number }).revision ?? null }));
} finally { first.close(); }

const again = await initLocalProjectStore({ projectDir });
try {
  const snap = again.loadSnapshot();
  if (!snap) throw new Error("재로드 실패: 스냅샷이 없다");
  const p = snap.project;
  const db = p.database;
  const checks = {
    projectId: again.projectId,
    sameId: again.projectId === projectId,
    revision: snap.revision,
    sha256: snap.sha256.slice(0, 12),
    maps: Object.keys(p.maps).length,
    b3: !!p.maps.fs_vault_b3 && `${p.maps.fs_vault_b3.width}x${p.maps.fs_vault_b3.height} ev${p.maps.fs_vault_b3.events.length}`,
    b4: !!p.maps.fs_vault_b4 && `${p.maps.fs_vault_b4.width}x${p.maps.fs_vault_b4.height} ev${p.maps.fs_vault_b4.events.length}`,
    crashValen: !!p.maps.fs_forest?.events.some((e) => e.id === "ev_fs_valen_crash"),
    vaultValenGone: !p.maps.fs_vault?.events.some((e) => e.id === "ev_fs_main_kill2"),
    siegeSoldiers: p.maps.fs_hub?.events.filter((e) => e.id.startsWith("ev_fs_siege_soldier_")).length,
    dragon: db.enemies.find((e) => e.id === "enemy_fs_moon_dragon")?.damageTypeRates ?? null,
    pierced: db.states.find((s) => s.id === "state_fs_pierced")?.runtimeEffects?.damageTypeRates ?? null,
    dragonTroopPages: db.troops.find((t) => t.id === "troop_fs_dragon")?.battleEventPages?.length ?? 0,
    pierceSkill: db.skills.find((s) => s.id === "skill_hero_rush_pierce")?.stateEffects?.map((e) => e.stateId) ?? [],
    questSteps: (p.quests?.find((q) => (q as { key?: string }).key === "fs_main") as { steps?: unknown[] } | undefined)?.steps?.length ?? 0,
    valenHideHp: db.enemies.find((e) => e.id === "enemy_fs_valen")?.hideHp ?? null,
    valenTroop: db.troops.find((t) => t.id === "troop_fs_valen_crash")?.members.length ?? 0,
    valenPages: db.troops.find((t) => t.id === "troop_fs_valen_crash")?.battleEventPages?.length ?? 0,
    machine: db.states.find((s) => s.id === "state_fs_valen_machine")?.runtimeEffects?.damageTypeRates ?? null,
    circuit: db.items.some((i) => i.id === "item_fs_circuit"),
    companions: (p.system as { companions?: { display?: string; sceneFormation?: string } }).companions ?? null,
    // 2026-10-25 규칙: 병사 1차 → 발렌 2차, 용 HP 숨김, 승강 장치 드러남, 자동 전투 없음·상태 해제·세이브 포인트 전용, 랜덤 조우 0, 덮치기.
    squadTroop: db.troops.find((t) => t.id === "troop_fs_valen_squad")?.members.map((m) => m.enemyId) ?? [],
    dragonHideHp: db.enemies.find((e) => e.id === "enemy_fs_moon_dragon")?.hideHp ?? null,
    liftEvents: p.maps.fs_vault_b4?.events.filter((e) => e.id.startsWith("ev_fs_b4_lift_")).length ?? 0,
    revealTiles: JSON.stringify(p.maps.fs_vault_b4?.events ?? []).split('"changeTile"').length - 1,
    rules: { allowAutoBattle: p.system.allowAutoBattle ?? null, clearStatesAfterBattle: p.system.clearStatesAfterBattle ?? null, saveAccess: p.system.saveAccess ?? null },
    randomRates: Object.values(p.maps).filter((m) => m.id.startsWith("fs_") && (m.encounterRate ?? 0) > 0).map((m) => m.id),
    lungeFoes: Object.values(p.maps).reduce((n, m) => n + m.events.filter((e) => e.pages?.some((pg) => pg.movement?.chaseLunge)).length, 0),
    hubSavepoint: p.maps.fs_hub?.events.some((e) => e.id === "ev_fs_hub_savepoint") ?? false,
    valenFace: JSON.stringify(p).includes("shared-fs-inquisitor-valen-expressions-bust-base"),
    ending: (p.endings?.find((e) => e.id === "end_fs_act1") as { presentation?: { kicker?: string } } | undefined)?.presentation?.kicker ?? null,
  };
  console.log(JSON.stringify({ reloaded: true, projectDir, ...checks }, null, 1));
} finally { again.close(); }
