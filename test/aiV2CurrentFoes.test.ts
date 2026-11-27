import { describe, expect, it } from "vitest";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import { CURRENT_MONSTER_ART_IDS, hasCurrentMonsterArt, installCurrentMonsterArt, isCurrentMonsterArt, preloadCurrentMonsterArt } from "@/assets/currentMonsterArt";
import { PIXEL_ENEMY_SHEETS, pixelEnemySheet, setPixelEnemySheetProjectSource } from "@/assets/pixelEnemySheets";
import { currentFoe, hasCurrentArt, leadEnemyId, settleCurrentArtIn } from "@/ai/v2/story/currentFoes";
import { foeSkillNames } from "@/ai/v2/judge/enemyChecks";
import { themeBossTroop, themeFieldTroops } from "@/ai/v2/place/placeTheme";
import { redrawStepFoesIn } from "@/ai/v2/story/stepFoes";
import { resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { parseArtGap } from "@/project/artGap";
import { standInOriginalArt } from "@/project/defaults/currentMonsterStandIns";
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
  // 2026-11-26 번들 승격: 현행 5×4(20칸) 시트 44종(괴물 38 + 폴른 스타 인간형 적 6)이 정식 번들(PIXEL_ENEMY_SHEETS)이다.
  it("id 목록의 그림은 모두 정식 번들 5×4 시트에 있고, 기본 DB 의 적이 쓰는 현행 시트는 모두 목록에 있다", async () => {
    const sheets = new Set(PIXEL_ENEMY_SHEETS.map((art) => art.resourceId));
    const current = new Set(CURRENT_MONSTER_ART_IDS);
    expect(current.size).toBe(CURRENT_MONSTER_ART_IDS.length);
    for (const id of CURRENT_MONSTER_ART_IDS) {
      expect(sheets.has(id), `${id} 의 시트가 정식 번들 표에 없다`).toBe(true);
      expect(pixelEnemySheet(id)?.grid, id).toBe("5x4");
    }
    await preloadCurrentMonsterArt();
    const project = createBlankProject() as Project;
    expect([...installCurrentMonsterArt(project, CURRENT_MONSTER_ART_IDS)].sort()).toEqual([...CURRENT_MONSTER_ART_IDS].sort());
    for (const id of CURRENT_MONSTER_ART_IDS) expect(hasCurrentMonsterArt(project, id), id).toBe(true);
    // 기본 DB 의 적이 쓰는 현행 시트는 모두 목록에 있어야 한다.
    const defaultFoeArt = new Set((createBlankProject() as Project).database.enemies.map((enemy) => enemy.monsterResourceId));
    for (const id of sheets) if (defaultFoeArt.has(id)) expect(current.has(id), `${id} 는 기본 DB 의 적이 쓰는 현행 시트인데 CURRENT_MONSTER_ART_IDS 에 없다`).toBe(true);
    for (const id of ["generated-enemy-wolf-grey", "generated-enemy-hound-hell", "generated-enemy-golem-iron", "generated-enemy-dragon-whelp"]) expect(current.has(id), id).toBe(true);
  });

  it("더 그린 종(battle-gen gif20)도 정식 번들 5×4 시트와 맵 위 그림으로 바로 잡힌다", async () => {
    await preloadCurrentMonsterArt();
    const project = createBlankProject() as Project;
    const ids = [
      "generated-enemy-leafling-01",
      "generated-enemy-triceratops",
      "generated-enemy-dragon-whelp",
      "generated-enemy-centipede-fire",
      "generated-enemy-bear-brown",
    ];
    expect([...installCurrentMonsterArt(project, ids)].sort()).toEqual([...ids].sort());
    setPixelEnemySheetProjectSource(() => project);
    try {
      for (const id of ids) {
        const sheet = pixelEnemySheet(id)!;
        expect(sheet.grid, id).toBe("5x4");
        expect(resolveEventSpriteTexture(project, id, 0)).toMatchObject({ texture: id, monster: true });
      }
    } finally { setPixelEnemySheetProjectSource(undefined); }
    for (const id of ["enemy_bear_brown", "enemy_dragon_whelp", "enemy_centipede_fire"]) expect(currentFoe(project, id)).toEqual({ enemyId: id });
    // 아직 못 그린 종은 그대로 대역 + 그릴 목록.
    expect(currentFoe(project, "enemy_tiger_saber")).toEqual({ enemyId: "enemy_wolf_dire", wanted: "tiger-saber" });
  });

  it("정식 번들 5×4 시트는 프로젝트 업로드에 중복 복사하지 않고도 전투 시트와 맵 위 그림이 둘 다 잡힌다", async () => {
    const project = createBlankProject() as Project;
    const id = "generated-enemy-boar-tusk";
    expect(installCurrentMonsterArt(project, ["generated-enemy-lizardman-spear"]).size).toBe(0);
    await preloadCurrentMonsterArt();
    expect(hasCurrentMonsterArt(project, id)).toBe(true);
    expect([...installCurrentMonsterArt(project, [id, "generated-enemy-lizardman-spear"])]).toEqual([id]);
    expect(project.assets.uploaded[id]).toBeUndefined();
    const sheet = pixelEnemySheet(id)!;
    expect(sheet.grid).toBe("5x4");
    expect(sheet.cell).toBe(96);
    expect(resolveEventSpriteTexture(project, id, 0)).toMatchObject({ texture: id, monster: true });
  });
});

describe("v2 가 세우는 적은 현행 그림이 있는 종", () => {
  it("그림이 현행이면 그 적, 아니면 가장 가까운 현행 종 + 바란 그림 이름", () => {
    const project = createBlankProject() as Project;
    expect(currentFoe(project, "enemy_boar_tusk")).toEqual({ enemyId: "enemy_boar_tusk" });
    expect(currentFoe(project, "enemy_lizardman_spear")).toEqual({ enemyId: "enemy_snake_viper", wanted: "lizardman-spear" });
    expect(currentFoe(project, "enemy_demon_lord")).toEqual({ enemyId: "enemy_wraith_dark", wanted: "demon-lord" });
    expect(currentFoe(project, "enemy_mimic_chest")).toEqual({ enemyId: "enemy_golem_iron", wanted: "mimic-chest" });
    expect(currentFoe(project, "enemy_none")).toBeUndefined();
    // 새 프로젝트는 옛 그림 적의 그림을 대역 그림으로 싣지만(2026-11-24 qa1124), 바란 그림은 여전히 그 적의 원래 그림이다.
    expect(currentFoe(project, "enemy_slime_red")).toEqual({ enemyId: "enemy_slime_green", wanted: "slime-red" });
    // 대역 표의 대역은 모두 현행 그림이다 — 기본 DB 적은 모두 세울 종이 있다.
    const stuck = project.database.enemies.filter((e) => e.monsterResourceId && !currentFoe(project, e.id)).map((e) => e.id);
    expect(stuck).toEqual([]);
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

  it("테마 표에 없는 세계(버들항)의 싸우는 단계 — 낱말이 가리키는 종의 그림이 어느 묶음에든 있으면 그 종, 대역은 쓰인 종을 피해 돌지 않는다", () => {
    const project = createBlankProject() as Project;
    // 새 프로젝트는 옛 묶음 그림을 싣지 않는다(오너 2026-11-24 «최신 몬스터들 반영», 2026-11-16 «에셋을 자유롭게» 를 대신한다):
    // 낱말이 짚은 마왕은 대역 현행 그림으로 서고 마왕 그림은 그릴 목록에 남는다.
    const lord = themeBossTroop(project, project.startMapId, "동굴 속 마왕", true, 0);
    expect(leadArt(project, lord.troopId)).toBe("generated-enemy-wraith-dark");
    expect(lord.gaps.map((line) => parseArtGap(line)?.wanted)).toEqual(["demon-lord"]);
    // r7-harbour R4 · P6: 대역(창백한 유령)이 이미 길 적이어도 «해골 병사» 는 다이어 울프로 돌지 않는다 — 해골 그림은 그릴 목록.
    const soldier = themeBossTroop(project, project.startMapId, "해골 병사", false, 0, new Set(["enemy_ghost_pale"]));
    expect(leadArt(project, soldier.troopId)).toBe("generated-enemy-wraith-dark");
    expect(soldier.gaps.map((line) => parseArtGap(line)?.wanted)).toEqual(["skeleton-bone"]);
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
    // 새 프로젝트는 이 종의 그림을 대역(다이어 울프)으로 싣는다(2026-11-24). 이 시험은 대역 이전에 저장된 옛 판의 사본이므로 원래(옛 3×3) 그림으로 돌려 세운다.
    const oldArt = standInOriginalArt(old)!;
    expect(oldArt).toBe("generated-enemy-tiger-saber");
    (project.database.enemies as unknown[]).push({ ...structuredClone(old), id: "enemy_fit_foe_s1", name: "늪 괴수", monsterResourceId: oldArt });
    (project.database.troops as unknown[]).push({ id: "troop_fit_foe_s1", name: "늪 괴수", enemyIds: ["enemy_fit_foe_s1"], members: [{ enemyId: "enemy_fit_foe_s1", x: 0, y: 0, hidden: false }], autoAlign: true, battleEventPages: [] });
    (map.events as unknown[]).push({ id: "ev_chain_x_1", name: "늪 괴수", x: 2, y: 2, pages: [{ graphic: { sprite: { type: "bundled", id: oldArt }, direction: "down", pattern: 0 }, trigger: { kind: "action" }, commands: [{ kind: "battleProcessing", troopId: "troop_fit_foe_s1", canEscape: false, canLose: false }] }] });
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
