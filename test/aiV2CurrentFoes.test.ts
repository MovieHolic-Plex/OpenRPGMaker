import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import { CURRENT_MONSTER_ART_IDS, hasCurrentMonsterArt, installCurrentMonsterArt, isCurrentMonsterArt, preloadCurrentMonsterArt } from "@/assets/currentMonsterArt";
import { CURRENT_MONSTER_SHEETS_20 } from "@/assets/currentMonsterSheets20";
import { FS_MONSTER_SHEETS_16 } from "@/project/flagship/fallen/monsterSheets16";
import { currentFoe, hasCurrentArt, leadEnemyId, settleCurrentArtIn } from "@/ai/v2/story/currentFoes";
import { foeSkillNames } from "@/ai/v2/judge/enemyChecks";
import { themeBossTroop, themeFieldTroops } from "@/ai/v2/place/placeTheme";
import { redrawStepFoesIn } from "@/ai/v2/story/stepFoes";
import { resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { pixelEnemySheet, setPixelEnemySheetProjectSource } from "@/assets/pixelEnemySheets";
import { parseArtGap } from "@/project/artGap";
import { WORLDS } from "@/ai/v2/place/world";
import type { Project } from "@/project/types";

// 2026-11-12 오너(r1w-fun, 선사 시대): «몬스터는 왜 star fallen 이랑 다르게 구형 몬스터를 배치해놨고».
// v2 가 고른 적은 기본 DB 의 번들 3×3 그림(구형)으로 싸우고 맵에는 옛 걷기 칩으로 섰다. 폴른 스타는 같은 리소스 id 에 새 시트(20칸)를 업로드로 얹어 쓴다.
// 이제 v2 는 그 현행 그림이 있는 종에서만 고르고 그 그림을 프로젝트에 넣는다. 문서 openwiki/assistant-v2.md 「적 그림은 현행 세트」.

function world(setting: string, tilesetId: string, kind: string, name: string): { project: Project; mapId: string } {
  const project = createBlankProject() as Project;
  const map = project.maps[project.startMapId]!;
  map.tilesetId = tilesetId;
  map.name = name;
  project.gameBlueprint = normalizeGameBlueprint({ title: "t", genre: "모험", setting, playerGoal: "g", ending: { name: "끝", how: "끝", feeling: "f" },
    places: [{ name, kind }],
    steps: [{ id: "s1", place: name, event: "x", action: "a", gives: "가", feeling: "f" }, { id: "s2", place: name, event: "y", action: "b", needs: "가", gives: "엔딩", feeling: "f" }] });
  return { project, mapId: map.id };
}
const leadArt = (project: Project, troopId: string | undefined): string | undefined => {
  const troop = project.database.troops.find((t) => t.id === troopId);
  return project.database.enemies.find((e) => e.id === (troop?.members?.[0]?.enemyId ?? troop?.enemyIds?.[0]))?.monsterResourceId;
};

describe("현행 몬스터 그림", () => {
  // 손으로 맞추는 개수 대조가 아니라 그림 표(두 시트 파일)와 기본 DB 를 따른다 — 『폴른 스타』가 제 이야기 적(사람 적 시트 등)을 표에 더해도 빨개지지 않고,
  // v2 가 세울 수 있는 적(기본 DB 에 적 기록이 있는 그림)의 시트를 더하고 id 목록을 빠뜨리면 빨개진다(2026-11-13: 사람 적 여섯 장이 표에 들어오며 개수 대조가 깨졌다).
  it("id 목록의 그림은 모두 표에 있어 설치되고, 표의 그림 가운데 기본 DB 의 적이 쓰는 것·더 그린 종은 모두 목록에 있다", async () => {
    const sheets = new Set([...FS_MONSTER_SHEETS_16, ...CURRENT_MONSTER_SHEETS_20].map((art) => art.resourceId));
    const current = new Set(CURRENT_MONSTER_ART_IDS);
    expect(current.size).toBe(CURRENT_MONSTER_ART_IDS.length);
    for (const id of CURRENT_MONSTER_ART_IDS) expect(sheets.has(id), `${id} 의 시트가 표에 없다`).toBe(true);
    // 목록의 id 는 실제로 설치된다(초상 업로드 kind monster).
    await preloadCurrentMonsterArt();
    const project = createBlankProject() as Project;
    expect([...installCurrentMonsterArt(project, CURRENT_MONSTER_ART_IDS)].sort()).toEqual([...CURRENT_MONSTER_ART_IDS].sort());
    for (const id of CURRENT_MONSTER_ART_IDS) expect(hasCurrentMonsterArt(project, id), id).toBe(true);
    // 표의 그림 가운데 v2 가 세울 수 있는 것(기본 DB 의 적이 쓰는 그림)과 v2 용으로 더 그린 종은 목록에 있어야 한다.
    const defaultFoeArt = new Set((createBlankProject() as Project).database.enemies.map((enemy) => enemy.monsterResourceId));
    for (const id of sheets) if (defaultFoeArt.has(id)) expect(current.has(id), `${id} 는 기본 DB 의 적이 쓰는 현행 시트인데 CURRENT_MONSTER_ART_IDS 에 없다`).toBe(true);
    for (const art of CURRENT_MONSTER_SHEETS_20) expect(current.has(art.resourceId), art.resourceId).toBe(true);
    // 몇 개는 이름으로 못 박는다.
    for (const id of ["generated-enemy-wolf-grey", "generated-enemy-hound-hell", "generated-enemy-golem-iron", "generated-enemy-dragon-whelp"]) expect(current.has(id), id).toBe(true);
    // 두 파일에 다 있는 id 는 표시가 있고(설치는 폴른 스타 것), 그 밖의 id 는 한 파일에만 있다.
    const fallen = new Set(FS_MONSTER_SHEETS_16.map((art) => art.resourceId));
    for (const art of CURRENT_MONSTER_SHEETS_20) expect(fallen.has(art.resourceId), art.resourceId).toBe(art.alsoInFlagship === true);
  });

  it("더 그린 종(battle-gen gif20)도 같은 길로 들어간다 — 20칸 시트 · 맵 위 그림 · 대역 없이 그 적", async () => {
    await preloadCurrentMonsterArt();
    const project = createBlankProject() as Project;
    const ids = CURRENT_MONSTER_SHEETS_20.map((art) => art.resourceId);
    expect([...installCurrentMonsterArt(project, ids)].sort()).toEqual([...ids].sort());
    setPixelEnemySheetProjectSource(() => project);
    try {
      for (const art of CURRENT_MONSTER_SHEETS_20) {
        const sheet = pixelEnemySheet(art.resourceId)!;
        expect(sheet.projectAuthored, art.resourceId).toBe(true);
        expect(sheet.grid, art.resourceId).toBe("5x4");
        expect(sheet.cell, art.resourceId).toBe(art.cell);
        // 폴른 스타에도 있는 id(잎새 정령)는 그쪽 시트가 들어간다 — 한 id 에 그림 하나.
        expect(project.assets.uploaded[art.resourceId]?.generatedBy, art.resourceId).toBe(art.alsoInFlagship ? "battle-gen:fallen-star" : "battle-gen:gif20");
        expect(resolveEventSpriteTexture(project, art.resourceId, 0)).toMatchObject({ texture: art.resourceId, monster: true });
      }
    } finally { setPixelEnemySheetProjectSource(undefined); }
    const before = JSON.stringify(project.assets.uploaded);
    installCurrentMonsterArt(project, ids);
    expect(JSON.stringify(project.assets.uploaded)).toBe(before);
    for (const id of ["enemy_bear_brown", "enemy_dragon_whelp", "enemy_centipede_fire"]) expect(currentFoe(project, id)).toEqual({ enemyId: id });
    // 아직 못 그린 종은 그대로 대역 + 그릴 목록.
    expect(currentFoe(project, "enemy_tiger_saber")).toEqual({ enemyId: "enemy_wolf_dire", wanted: "tiger-saber" });
  });

  it("넣으면 전투 시트와 맵 위 그림이 둘 다 그 그림이 된다 — 넣지 않은 프로젝트는 번들 그림 그대로", async () => {
    const project = createBlankProject() as Project;
    const id = "generated-enemy-boar-tusk";
    expect(installCurrentMonsterArt(project, ["generated-enemy-lizardman-spear"]).size).toBe(0);
    await preloadCurrentMonsterArt();
    expect(hasCurrentMonsterArt(project, id)).toBe(false);
    expect([...installCurrentMonsterArt(project, [id, "generated-enemy-lizardman-spear"])]).toEqual([id]);
    expect(hasCurrentMonsterArt(project, id)).toBe(true);
    const art = FS_MONSTER_SHEETS_16.find((a) => a.resourceId === id)!;
    setPixelEnemySheetProjectSource(() => project);
    try {
      const sheet = pixelEnemySheet(id)!;
      expect(sheet.projectAuthored).toBe(true);
      expect(sheet.grid).toBe(art.grid);
      expect(sheet.cell).toBe(art.cell);
    } finally { setPixelEnemySheetProjectSource(undefined); }
    // 맵 위: 업로드 monster 가 번들보다 먼저 잡힌다(런타임이 그 그림에서 걷기 칩을 뽑는다).
    expect(resolveEventSpriteTexture(project, id, 0)).toMatchObject({ texture: id, monster: true });
    // 되풀이 안전.
    const before = JSON.stringify(project.assets.uploaded);
    installCurrentMonsterArt(project, [id]);
    expect(JSON.stringify(project.assets.uploaded)).toBe(before);
  });
});

describe("v2 가 세우는 적은 현행 그림이 있는 종", () => {
  it("그림이 현행이면 그 적, 아니면 가장 가까운 현행 종 + 바란 그림 이름", () => {
    const project = createBlankProject() as Project;
    expect(currentFoe(project, "enemy_boar_tusk")).toEqual({ enemyId: "enemy_boar_tusk" });
    expect(currentFoe(project, "enemy_lizardman_spear")).toEqual({ enemyId: "enemy_snake_viper", wanted: "lizardman-spear" });
    expect(currentFoe(project, "enemy_demon_lord")).toEqual({ enemyId: "enemy_wraith_dark", wanted: "demon-lord" });
    expect(currentFoe(project, "enemy_mimic_chest")).toBeUndefined();
    expect(currentFoe(project, "enemy_none")).toBeUndefined();
    // 대역 표의 대역은 모두 현행 그림이다 — 기본 DB 적은 넷(미믹·허수아비·기본 무리의 …) 말고 모두 세울 종이 있다.
    const stuck = project.database.enemies.filter((e) => e.monsterResourceId && !currentFoe(project, e.id)).map((e) => e.id);
    expect(stuck).toEqual(["enemy_mimic_chest", "enemy_scarecrow_field"]);
    for (const e of project.database.enemies) { const cur = currentFoe(project, e.id); if (cur) expect(hasCurrentArt(project, cur.enemyId)).toBe(true); }
  });

  // 세계마다 한 시험 — 종류마다 시작 파티에 맞춘 사본을 만들어(모의전) 한 시험에 다 넣으면 CI 에서 49초가 걸렸다.
  for (const w of WORLDS.filter((x) => !!x.composer)) {
    it(`구성기 세계 ${w.id}: 어느 종류에서나 길 적·우두머리가 현행 그림으로 선다 — 없는 종은 없는 그림 줄`, () => {
      {
      for (const kind of w.kinds) {
        const { project, mapId } = world(w.id, w.tilesetId, kind.id, `${w.id}-${kind.id}`);
        const field = themeFieldTroops(project, mapId);
        expect(field.troopIds.length, `${w.id}/${kind.id} 길 적`).toBeGreaterThan(0);
        for (const id of field.troopIds) expect(isCurrentMonsterArt(leadArt(project, id)), `${w.id}/${kind.id} ${id}`).toBe(true);
        // 같이 서는 길 적은 종마다 다른 종에 없는 자기 기술이 있다(끝맺음 «적 개성» 검사와 같은 값).
        const skills = field.troopIds.map((id) => foeSkillNames(project, leadEnemyId(project, id)));
        if (skills.length > 1) for (const [i, own] of skills.entries()) expect([...own].some((s) => skills.every((o, j) => j === i || !o.has(s))), `${w.id}/${kind.id} ${field.troopIds[i]} 자기 기술`).toBe(true);
        const boss = themeBossTroop(project, mapId, undefined, true, 3);
        expect(isCurrentMonsterArt(leadArt(project, boss.troopId)), `${w.id}/${kind.id} 우두머리`).toBe(true);
        for (const line of [...field.gaps, ...boss.gaps]) expect(parseArtGap(line), line).toBeDefined();
      }
      }
    }, 60_000);
  }

  // 2026-11-12 까지는 뱀·딱정벌레 둘만 섰다 — 센 기술을 다른 생물의 약한 기술로 바꾸던 맞춤 때문에 멧돼지·사마귀의 사본이 뱀과 같은 기술을 들었다.
  // 지금은 제 기술을 약하게 한 사본을 들어(멧돼지 «돌진», 사마귀 «교차 낫베기») 넷이 다 선다.
  it("선사 시대 늪: 뱀·멧돼지·딱정벌레·사마귀가 제 기술로 서고, 리자드맨·검치호·공룡은 그릴 목록에 남는다", () => {
    const { project, mapId } = world("prehistoric", "prehistoric", "swamp", "늪지");
    const field = themeFieldTroops(project, mapId);
    expect(field.troopIds.map((id) => leadArt(project, id)?.replace("generated-enemy-", ""))).toEqual(["snake-viper", "boar-tusk", "beetle-horn", "mantis-blade"]);
    expect(field.gaps.map((line) => parseArtGap(line)?.wanted)).toEqual(["dinosaurs (raptor, triceratops)", "lizardman-spear", "tiger-saber"]);
    // 이름이 맞는 종이 있으면 그 종(불의 정령), 없으면 돌려 고른다 — 어느 쪽이든 현행 그림.
    const fire = themeBossTroop(project, mapId, "불의 정령", true, 0);
    expect(leadArt(project, fire.troopId)).toBe("generated-enemy-spirit-fire");
    expect(fire.gaps).toEqual([]);
    // 새끼 용이 그려진 뒤(2026-11-12): 우두머리 후보가 새끼 용·다이어 울프·불의 정령 셋이 되고 그릴 목록에서 빠진다.
    const beast = themeBossTroop(project, mapId, "늪 괴수", false, 2);
    expect(leadArt(project, beast.troopId)).toBe("generated-enemy-spirit-fire");
    // 종 이름으로 불리지 않은 우두머리는 제 이름도 그릴 목록에 남는다(2026-11-13 r3b-fun: «그림자 종지기» 가 대역으로 섰는데 그 이름의 줄이 없었다).
    expect(beast.gaps.map((line) => parseArtGap(line)?.wanted)).toEqual(["dinosaurs (raptor, triceratops)", "늪 괴수", "behemoth-horn", "tiger-saber"]);
    const whelp = themeBossTroop(project, mapId, "새끼 용", true, 0);
    expect(leadArt(project, whelp.troopId)).toBe("generated-enemy-dragon-whelp");
    expect(whelp.gaps).toEqual([]);
  });

  it("테마 표에 없는 세계(버들항)의 싸우는 단계도 현행 그림 — 낱말이 가리키는 종에 그림이 없으면 대역 + 그릴 목록", () => {
    const project = createBlankProject() as Project;
    const lord = themeBossTroop(project, project.startMapId, "동굴 속 마왕", true, 0);
    expect(leadArt(project, lord.troopId)).toBe("generated-enemy-wraith-dark");
    expect(lord.gaps.map((line) => parseArtGap(line)?.wanted)).toEqual(["demon-lord"]);
    const wolf = themeBossTroop(project, project.startMapId, "늑대 우두머리", false, 1);
    expect(leadArt(project, wolf.troopId)).toBe("generated-enemy-wolf-grey");
    expect(wolf.gaps).toEqual([]);
  });
});

describe("옛 판 맞추기(끝맺음 step-foes)", () => {
  it("맵에서 싸우는 적에 현행 그림을 넣고 옛 걷기 칩을 전투 그림으로 — 그림이 없는 종은 그릴 목록", async () => {
    await preloadCurrentMonsterArt();
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    const troop = (id: string, enemyId: string) => { (project.database.troops as unknown[]).push({ id, name: id, enemyIds: [enemyId], members: [{ enemyId, x: 0, y: 0, hidden: false }], autoAlign: true, battleEventPages: [] }); return id; };
    const fight = (id: string, troopId: string, graphic: unknown) => ({ id, name: id, x: 1, y: 1, pages: [{ graphic, trigger: { kind: "eventTouch" }, commands: [{ kind: "battleProcessing", troopId, canEscape: true, canLose: false }] }] });
    // 유령: 옛 걷기 칩(monster1 3번 칸)으로 서 있다 · 리자드맨: 현행 그림이 없다.
    (map.events as unknown[]).push(
      fight("ev_ghost", troop("troop_t_ghost", "enemy_ghost_pale"), { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" }, direction: "down", pattern: 34 }),
      fight("ev_lizard", troop("troop_t_lizard", "enemy_lizardman_spear"), { sprite: { type: "bundled", id: "generated-enemy-lizardman-spear" }, direction: "down", pattern: 0 }),
    );
    const done = settleCurrentArtIn(project);
    expect(hasCurrentMonsterArt(project, "generated-enemy-ghost-pale")).toBe(true);
    expect((project.maps[map.id]!.events.find((e) => e.id === "ev_ghost")!.pages![0]!.graphic as { sprite: { id: string } }).sprite.id).toBe("generated-enemy-ghost-pale");
    expect(done.missing).toEqual([{ wanted: "lizardman-spear", where: map.name ?? map.id, name: "리자드맨" }]);
    expect(settleCurrentArtIn(project).notes).toEqual([]);
  });

  it("함수가 고른 단계 상대(맞춤 사본)의 그림이 현행이 아니면 같은 이름으로 다시 고른다", () => {
    const { project, mapId } = world("prehistoric", "prehistoric", "swamp", "늪지");
    const map = project.maps[mapId]!;
    const old = project.database.enemies.find((e) => e.id === "enemy_tiger_saber")!;   // 아직 현행 그림이 없는 종
    (project.database.enemies as unknown[]).push({ ...structuredClone(old), id: "enemy_fit_foe_s1", name: "늪 괴수" });
    (project.database.troops as unknown[]).push({ id: "troop_fit_foe_s1", name: "늪 괴수", enemyIds: ["enemy_fit_foe_s1"], members: [{ enemyId: "enemy_fit_foe_s1", x: 0, y: 0, hidden: false }], autoAlign: true, battleEventPages: [] });
    (map.events as unknown[]).push({ id: "ev_chain_x_1", name: "늪 괴수", x: 2, y: 2, pages: [{ graphic: { sprite: { type: "bundled", id: old.monsterResourceId }, direction: "down", pattern: 0 }, trigger: { kind: "action" }, commands: [{ kind: "battleProcessing", troopId: "troop_fit_foe_s1", canEscape: false, canLose: false }] }] });
    const bp = project.gameBlueprint!;
    project.gameBlueprint = { ...bp, steps: bp.steps.map((s, i) => (i === 0 ? { ...s, kind: "battle" as const, who: "늪 괴수", built: { mapId, eventId: "ev_chain_x_1" } } : s)) };
    const done = redrawStepFoesIn(project);
    expect(done.notes.length).toBe(1);
    const copy = project.database.enemies.find((e) => e.id === "enemy_fit_foe_s1")!;
    expect(copy.name).toBe("늪 괴수");
    expect(isCurrentMonsterArt(copy.monsterResourceId)).toBe(true);
    expect(redrawStepFoesIn(project).notes).toEqual([]);
  });
});
