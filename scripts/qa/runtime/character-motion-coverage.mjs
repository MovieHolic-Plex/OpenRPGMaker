// Exhaustive common actor/profile coverage and source for native player recordings.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const out = "verify-shots/character-motion";
await mkdir(out, { recursive: true });
const server = await startPlayerQaServer({ logLevel: "error" }),
  browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.route("**/__character-motion", (r) =>
    r.fulfill({ contentType: "text/html", body: "<html></html>" }),
  );
  await page.goto(server.url + "/__character-motion");
  const result = await page.evaluate(async () => {
    const [
      { defaultPartyRecords },
      { defaultBattleMotionSkills },
      { resolveCharacterMotion, CHARACTER_CLASS_MOTIONS },
      { normalizeActorRecord },
      { normalizeEquipmentRecord },
      { resolveSkillChoreography },
      { retroClassSkillTimeline },
      { buildBattleMotionPreview },
      { characterMotionProgram, characterMotionTracks, defaultCharacterProgram, characterCasting, characterMotionRecipe },
      { battleContactBounds },
      { registerInlineAssets },
    ] = await Promise.all([
      import("/src/project/defaults/defaultDatabasePartyRecords.ts"),
      import("/src/assets/battleMotionCatalog.ts"),
      import("/src/assets/characterMotionCatalog.ts"),
      import("/src/project/actorModel.ts"),
      import("/src/project/databaseRecordModel.ts"),
      import("/src/assets/retroSkillCatalog.ts"),
      import("/src/battle/retroSkillTimeline.ts"),
      import("/src/battle/battleMotionPreview.ts"),
      import("/src/battle/characterMotion.ts"),
      import("/src/battle/battleContactGeometry.ts"),
      import("/src/assets/inlineAssetStore.ts"),
    ]);
    const party = defaultPartyRecords(),
      skills = defaultBattleMotionSkills(),
      rows = [];
    let checks = 0;
    const check = (pass, label) => {
      checks++;
      if (!pass) throw Error(label);
    };
    check(party.actors.length === 136, "Expected all 136 bundled actors");
    for (const actor of party.actors) {
      check(
        !!CHARACTER_CLASS_MOTIONS[actor.classId],
        actor.id + ": missing explicit binding",
      );
      const profile = resolveCharacterMotion(
        actor,
        party.equipment.find((e) => e.id === actor.initialEquipment.weapon),
      );
      const signatures = [];
      for (const skill of skills) {
        const resolved = resolveSkillChoreography(skill),
          factory = (hits) =>
            retroClassSkillTimeline(resolved.skill, { hits, side: "enemies" });
        const options = {
          character: profile,
          hits: skill.hitSequence?.length ?? 1,
          followOnHit: skill.battleGimmick?.followOnHit,
          preparing: skill.effect.kind === "support",
        };
        const hit = buildBattleMotionPreview(resolved.record, factory, options),
          miss = buildBattleMotionPreview(resolved.record, factory, {
            ...options,
            outcome: "miss",
          }),
          cancel = buildBattleMotionPreview(resolved.record, factory, {
            ...options,
            outcome: "cancel",
          });
        check(
          hit.actors?.every((t) =>
            t.points.every((p) => Number.isFinite(p.at) && p.at >= 0),
          ),
          actor.id + "/" + skill.id + ": finite tracks",
        );
        check(
          cancel.events.length === 0 && cancel.actors.length === 1,
          actor.id + "/" + skill.id + ": blocked",
        );
        check(
          !miss.events.some((e) => e.kind === "hit" && e.landed !== false),
          actor.id + "/" + skill.id + ": miss",
        );
        signatures.push([
          skill.id,
          hit.events.find((e) => e.kind === "hit")?.at,
          hit.durationMs,
        ]);
      }
      const settings = {
        style: "heavy",
        anticipation: 1.7,
        travel: 0.8,
        recovery: 1.3,
        reach: 12,
        jump: 0.6,
        recoil: 0.4,
      };
      const reloaded = normalizeActorRecord(
        JSON.parse(JSON.stringify({ ...actor, battleMotion: settings })),
      );
      check(
        JSON.stringify(reloaded.battleMotion) === JSON.stringify(settings),
        actor.id + ": motion override roundtrip",
      );
      rows.push({
        id: actor.id,
        name: actor.name,
        classId: actor.classId,
        resource: actor.battleCharacterResourceId,
        profile,
        skills: signatures,
      });
    }
    const custom = normalizeActorRecord({
      ...party.actors[0],
      id: "custom_actor",
      classId: "custom_class",
      battleMotion: { travel: 0, reach: Infinity, style: "bogus" },
    });
    check(
      custom.battleMotion.travel === 0.4 &&
        !custom.battleMotion.style &&
        !("reach" in custom.battleMotion),
      "custom malformed settings normalized",
    );
    check(
      resolveCharacterMotion(custom).style === "balanced",
      "custom safe default",
    );
    const weapon = normalizeEquipmentRecord({
      id: "qa_spear",
      name: "QA spear",
      battleMotionStyle: "lancer",
    });
    check(
      resolveCharacterMotion(
        { ...party.actors[0], battleMotion: undefined },
        weapon,
      ).style === "lancer",
      "equipped explicit family",
    );
    const tracks = [
      {
        role: "user",
        points: [
          { at: 0, anchor: "home" },
          { at: 500, anchor: "front" },
        ],
      },
    ];
    check(
      characterMotionProgram({ pattern: "dash", tracks }, rows[0].profile)
        .tracks === tracks,
      "authored tracks preserved",
    );
    check(characterMotionTracks(tracks, rows[0].profile, [500], true) === tracks,
      "authored poses preserved");
    for (const row of rows) {
      const program = defaultCharacterProgram("cast", row.profile.style);
      check(program.pattern === "stationary", row.id + ": spells stay stationary");
      const cast = buildBattleMotionPreview({ movement: program },
        hits => retroClassSkillTimeline(resolveSkillChoreography(skills[0]).skill, { hits, side: "enemies" }),
        { character: row.profile, casting: true, hits: 1 });
      const poses = cast.actors.flatMap(t => t.points.map(p => p.pose));
      check(poses.includes("cast_release") && !poses.some(p => p?.startsWith("attack")),
        row.id + ": casting keeps spell poses");
    }
    const original = "/assets/generated/charset-battlers/hero.png";
    const keys = Object.keys((await import("/src/assets/battleContactBounds.json")).default);
    const source = keys.find(k => k.includes("charset-battlers"));
    const bounds = battleContactBounds(source, "attack");
    check(!!bounds, "bundled contact geometry exists");
    registerInlineAssets({ [source]: "data:image/png;base64,QA", [original]: "blob:qa-unknown" });
    check(JSON.stringify(battleContactBounds('url("data:image/png;base64,QA")', "attack")) === JSON.stringify(bounds),
      "standalone export retains contact geometry");
    registerInlineAssets(null);
    check(battleContactBounds("blob:uploaded") === undefined, "uploaded geometry falls back");
    check(characterCasting("finisher", "caster"), "caster finisher retains spell semantics");
    check(!characterCasting("finisher", "heavy"), "physical finisher retains physical semantics");
    const poses = [[0, "attack_windup"], [.4, "attack_strike"], [.62, "attack_strike"], [.9, "attack"]];
    const recipe = { approachMs: 920, recoverMs: 840, poses, approach: "dash" };
    const scaled = characterMotionRecipe(recipe, rows.find(r => r.id === "actor_guardian").profile);
    check(scaled.poses === poses && scaled.approach === "dash" && scaled.approachMs > recipe.approachMs,
      "legacy recipe retains combo and approach while scaling timing");
    const legacyMiss = buildBattleMotionPreview(undefined,
      hits => retroClassSkillTimeline(resolveSkillChoreography(skills[0]).skill, { hits, side: "enemies" }),
      { outcome: "miss" });
    check(!legacyMiss.events.some(e => (e.kind === "hit" && e.landed !== false) ||
      (e.kind === "fx" && ["target", "allTargets"].includes(e.anchor))),
      "legacy preview miss removes contact feedback without replacing poses");
    const skill = skills.find((s) => s.id === "skill_motion_dash");
    const contract = rows.map((row) => ({
      id: "skill_character_" + row.id,
      actorId: row.id,
      motion: "dash",
      layers: [],
      level: 1,
    }));
    const spec = {
      skills: rows.map((row) => ({
        ...skill,
        id: "skill_character_" + row.id,
        name: row.name + " · 돌진",
        retroChoreographyId: "chor_builtin_dash",
      })),
      actors: [],
      classes: party.classes.map((c) => ({
        ...c,
        learnedSkills: [
          {
            level: 1,
            skillId: "skill_character_" + c.id.replace(/^class_/, "actor_"),
          },
        ],
        skillIds: ["skill_character_" + c.id.replace(/^class_/, "actor_")],
      })),
      states: [],
      equipment: [],
      contract,
    };
    return {
      coverage: { checks, actors: rows.length, motions: skills.length, rows },
      spec,
    };
  });
  await writeFile(
    out + "/coverage.json",
    JSON.stringify(result.coverage, null, 2) + "\n",
  );
  await writeFile(
    out + "/recording-spec.json",
    JSON.stringify(result.spec, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      actors: result.coverage.actors,
      motions: result.coverage.motions,
      checks: result.coverage.checks,
    }),
  );
} finally {
  await browser.close();
  await server.close();
}
