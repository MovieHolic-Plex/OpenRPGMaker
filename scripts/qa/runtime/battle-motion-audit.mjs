// Focused browser inspection of the shipped modules. No unit suite, gate or canonical project write.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
import { recordingFixture } from "./retro2003-gif-fixture.mjs";
const out = "verify-shots/battle-motion";
await mkdir(out, { recursive: true });
const server = await startPlayerQaServer({ logLevel: "error" }),
  browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/__motion-audit", (r) =>
    r.fulfill({ contentType: "text/html", body: "<html><body></body></html>" }),
  );
  await page.goto(server.url + "/__motion-audit");
  const fixture = await recordingFixture();
  const result = await page.evaluate(async (input) => {
    const [
      { createBattleRuntime },
      defaults,
      { defaultBattleMotionSkills, BUNDLED_BATTLE_MOTIONS },
      motion,
      handles,
      timeline,
      catalog,
      normalizer,
      choreoNormalizer,
      convergence,
    ] = await Promise.all([
      import("/src/battle/runtime.ts"),
      import("/src/project/defaults/defaultDatabaseStarterRecords.ts"),
      import("/src/assets/battleMotionCatalog.ts"),
      import("/src/battle/battleMotionProgram.ts"),
      import("/src/battle/retroChoreographyHandles.ts"),
      import("/src/battle/retroSkillTimeline.ts"),
      import("/src/assets/retroSkillCatalog.ts"),
      import("/src/project/databaseRecordModel.ts"),
      import("/src/project/skillChoreographyRecords.ts"),
      import("/src/project/defaults/defaultDatabase.ts"),
    ]);
    const base = input;
    for (const key of ["skills", "states", "battleAnimations"])
      base.database[key] =
        key === "skills"
          ? defaults.defaultSkillRecords()
          : key === "states"
            ? defaults.defaultStateRecords()
            : defaults.defaultBattleAnimationRecords();
    base.database = normalizer.normalizeDatabaseRecords(base.database);
    const ids = defaultBattleMotionSkills().map((s) => s.id),
      rows = [],
      checks = [];
    const assert = (condition, name) => {
      checks.push({ name, ok: !!condition });
      if (!condition) throw new Error(name);
    };
    const legacy = timeline.retroClassSkillTimeline({
      motion: "dash-strike",
      layers: [],
    });
    assert(
      handles.applyChoreographyHandles(legacy) === legacy,
      "unmodified legacy timeline retained",
    );
    const common = defaultBattleMotionSkills()[2];
    const own = {
      ...BUNDLED_BATTLE_MOTIONS[2],
      id: "chor_authored",
      movement: { pattern: "jump", acceleration: 2 },
    };
    assert(
      catalog.resolveSkillChoreography(
        { ...common, retroChoreographyId: own.id },
        [own],
      ).record === own,
      "common skill honors authored choreography",
    );
    const existing = structuredClone(base);
    convergence.ensureRetroRosterRecords(existing);
    existing.database.skills = existing.database.skills.filter(
      (s) => !s.id.startsWith("skill_motion_"),
    );
    assert(
      convergence.ensureRetroRosterRecords(existing),
      "existing project reports motion insertion",
    );
    assert(
      existing.database.skills.filter((s) => s.id.startsWith("skill_motion_"))
        .length === 32,
      "existing project receives all common skills",
    );
    existing.database.skills.find((s) => s.id === common.id).name = "저작 이름";
    convergence.ensureRetroRosterRecords(existing);
    assert(
      existing.database.skills.find((s) => s.id === common.id).name ===
        "저작 이름",
      "authored common skill preserved",
    );
    const anchors = {
      home: { x: 500, y: 200 },
      front: { x: 190, y: 200 },
      target: { x: 160, y: 200 },
      target2: { x: 90, y: 160 },
      target3: { x: 240, y: 240 },
      ally: { x: 550, y: 230 },
      left: { x: -96, y: 200 },
      right: { x: 736, y: 200 },
      top: { x: 160, y: -160 },
    };
    for (const record of defaultBattleMotionSkills())
      for (const miss of [false, true]) {
        const p = structuredClone(base);
        p.system.startActorIds = ["actor_hero", "actor_guardian", "actor_mage"];
        p.system.battleUiStyle = "retro2003";
        p.system.battleFlow = "strict";
        if (p.session) p.session.partyActorIds = p.system.startActorIds;
        for (const a of p.database.actors) {
          a.initialLevel = 22;
          a.learnedSkills = ids.map((skillId) => ({ level: 1, skillId }));
        }
        for (const c of p.database.classes) {
          c.parameterCurves.maxMp = c.parameterCurves.maxMp.map(() => 999);
          c.parameterCurves.maxHp = c.parameterCurves.maxHp.map(() => 999);
        }
        for (const e of p.database.enemies) {
          e.stats.maxHp = 99999;
          e.stats.attack = 12;
          e.stats.agility = 1;
          e.actions = [
            {
              skillId: "skill_attack",
              priority: 5,
              condition: { kind: "always" },
            },
          ];
        }
        const skill = p.database.skills.find((s) => s.id === record.id);
        skill.hitRate = miss ? 0 : 100;
        skill.successRate = 100;
        const troopId =
          input.database.troops.find((t) => t.members?.length)?.id ??
          input.database.troops[0].id;
        const rt = createBattleRuntime({
          project: p,
          troopId,
          canEscape: true,
          canLose: true,
          battleFlow: "strict",
          activeSlots: 2,
          rng: () => 0.5,
        });
        let commands = 0;
        for (let i = 0; i < 50; i++) {
          const s = rt.snapshot();
          if (s.result) break;
          if (s.phase === "actorCommand") {
            const user = s.actors.find((a) => a.recordId === s.activeActorId);
            if (user?.recordId === "actor_hero" && commands < 2) {
              rt.performActorCommand({
                kind: "skill",
                skillId: record.id,
                targetEnemyId: s.enemies.find((e) => !e.defeated)?.id,
              });
              commands++;
            } else rt.performActorCommand({ kind: "defend" });
          } else rt.tick(1000);
          if (rt.snapshot().turn >= 3) break;
        }
        const s = rt.snapshot(),
          facts = s.timeline.filter((e) => e.skillId === record.id);
        assert(commands > 0, record.id + " command available");
        assert(facts.length > 0, record.id + " actual facts");
        const resolved = catalog.resolveSkillChoreography(record),
          c = resolved.record;
        const normalized = choreoNormalizer.normalizeSkillChoreographyRecord(
          JSON.parse(JSON.stringify(c)),
        );
        assert(
          normalized?.movement?.pattern === record.battleGimmick.pattern,
          record.id + " saved program",
        );
        const migrated = normalizer.normalizeSkillRecord(
          JSON.parse(JSON.stringify(skill)),
        );
        assert(
          migrated.battleGimmick?.pattern === record.battleGimmick.pattern,
          record.id + " saved rules",
        );
        const tl = handles.applyChoreographyHandles(
          timeline.retroClassSkillTimeline(resolved.skill, {
            hits: record.hitSequence?.length,
          }),
          c,
          { hit: !miss },
        );
        for (let t = 0; t <= tl.durationMs; t += 20)
          for (const track of tl.actors ?? []) {
            const pos = motion.motionPositionAt(
              track,
              t,
              anchors,
              c.movement.acceleration,
            );
            assert(
              Number.isFinite(pos.x) && Number.isFinite(pos.y),
              record.id + " finite trajectory",
            );
          }
        rows.push({
          id: record.id,
          miss,
          commands,
          turn: s.turn,
          hits: facts.filter((e) => e.kind === "damage").length,
          misses: facts.filter((e) => e.kind === "miss").length,
          periodic: facts.filter((e) => e.gimmick?.source === "periodic")
            .length,
          gimmicks: [...s.actors, ...s.enemies].flatMap(
            (b) => b.gimmicks ?? [],
          ),
          facts: facts.map((e) => ({
            kind: e.kind,
            amount: e.amount,
            gimmick: e.gimmick,
            aside: e.aside,
          })),
        });
        rt.cancel();
      }
    const runCase = (name, config) => {
      const p = structuredClone(base);
      p.system.startActorIds = ["actor_hero", "actor_guardian", "actor_mage"];
      p.system.battleUiStyle = "retro2003";
      p.system.battleFlow = "strict";
      if (p.session) p.session.partyActorIds = p.system.startActorIds;
      for (const a of p.database.actors) {
        a.initialLevel = 22;
        a.learnedSkills = ids.map((skillId) => ({ level: 1, skillId }));
      }
      for (const c of p.database.classes) {
        c.parameterCurves.maxMp = c.parameterCurves.maxMp.map(() => 999);
        c.parameterCurves.maxHp = c.parameterCurves.maxHp.map(() => 999);
      }
      for (const skill of p.database.skills.filter((s) => ids.includes(s.id))) {
        skill.hitRate = 100;
        skill.successRate = 100;
        skill.criticalRate = 0;
        skill.variance = 0;
      }
      p.database.skills.find(
        (s) => s.id === "skill_motion_mark",
      ).battleGimmick.consumeMarks = config.leaveMarks === true ? false : true;
      if (config.trapChance !== undefined)
        p.database.skills.find(
          (s) => s.id === "skill_motion_trap",
        ).battleGimmick.triggerChance = config.trapChance;
      if (config.element)
        p.database.skills.find(
          (s) => s.id === config.sequence[0],
        ).battleGimmick.elementId = config.element;
      if (config.missId)
        p.database.skills.find((s) => s.id === config.missId).hitRate = 0;
      if (config.persistMarks)
        p.database.skills.find(
          (s) => s.id === "skill_motion_mark",
        ).battleGimmick.durationTurns = 6;
      const incoming = {
        ...p.database.skills.find((s) => s.id === "skill_motion_fire"),
        id: "skill_motion_incoming",
        battleGimmick: undefined,
        retroChoreographyId: undefined,
        power: 80,
        elementId: config.incomingElement,
        effect: {
          kind: "damage",
          statistic: config.magical ? "mind" : "attack",
          affects: "hp",
        },
        hitRate: config.noIncoming ? 0 : 100,
        successRate: 100,
        criticalRate: 0,
        variance: 0,
        mpCost: { flat: 0, percentMax: 0 },
      };
      p.database.skills.push(incoming);
      for (const e of p.database.enemies) {
        e.stats.maxHp = config.kill ? 1 : 99999;
        e.stats.maxMp = 9999;
        e.stats.attack = 15;
        e.stats.mind = 20;
        e.stats.agility = 1;
        e.actions = [
          {
            skillId: incoming.id,
            priority: 5,
            condition: { kind: "always" },
            ...(config.leaveZone ? { moveTo: { x: 1000, y: 1000 } } : {}),
          },
        ];
      }
      const troopId =
        p.database.troops.find((t) => t.members?.length)?.id ??
        p.database.troops[0].id;
      const rt = createBattleRuntime({
        project: p,
        troopId,
        canEscape: true,
        canLose: true,
        battleFlow: "strict",
        activeSlots: config.cover ? 2 : (config.slots ?? 1),
        rng: () => (config.cover ? 0.75 : 0.5),
      });
      let n = 0;
      for (let i = 0; i < 80; i++) {
        const s = rt.snapshot();
        if (s.result) break;
        if (s.phase === "actorCommand") {
          if (s.activeActorId === "actor_hero" && n < config.sequence.length) {
            const id = config.sequence[n++];
            rt.performActorCommand({
              kind: "skill",
              skillId: id,
              targetEnemyId: s.enemies.find((e) => !e.defeated)?.id,
            });
          } else rt.performActorCommand({ kind: "defend" });
        } else rt.tick(1000);
        if (rt.snapshot().turn >= 4) break;
      }
      const s = rt.snapshot();
      rt.cancel();
      return {
        name,
        timeline: s.timeline,
        actors: s.actors,
        enemies: s.enemies,
        commands: n,
      };
    };
    const branches = [];
    const add = (name, config) => {
      const b = runCase(name, config);
      branches.push(b);
      return b;
    };
    const count = (b, id, periodic = false) =>
      b.timeline.filter(
        (e) =>
          e.skillId === id &&
          e.kind === "damage" &&
          (!periodic || e.gimmick?.source === "periodic"),
      ).length;
    let b = add("counter contact", { sequence: ["skill_motion_counter"] });
    assert(
      count(b, "skill_motion_counter") > 0,
      "prepared counter retaliates on physical contact",
    );
    b = add("counter miss", {
      sequence: ["skill_motion_counter"],
      noIncoming: true,
    });
    assert(
      count(b, "skill_motion_counter") === 0,
      "counter does not retaliate on miss",
    );
    b = add("matching absorption", {
      sequence: ["skill_motion_absorb", "skill_motion_absorb"],
      magical: true,
      element: "fire",
      incomingElement: "fire",
    });
    assert(count(b, "skill_motion_absorb") > 0, "stored energy releases");
    assert(
      b.timeline.some(
        (e) => e.skillId === "skill_motion_incoming" && e.amount === 0,
      ),
      "matching magic is absorbed",
    );
    b = add("mismatched absorption", {
      sequence: ["skill_motion_absorb", "skill_motion_absorb"],
      magical: true,
      element: "ice",
      incomingElement: "fire",
    });
    assert(
      count(b, "skill_motion_absorb") === 0,
      "mismatched magic produces no release",
    );
    assert(
      b.timeline.some(
        (e) => e.skillId === "skill_motion_incoming" && e.amount > 0,
      ),
      "mismatched magic damages",
    );
    b = add("mirror three returns", {
      sequence: ["skill_motion_mirror-counter", "skill_motion_mirror-counter"],
      magical: true,
    });
    assert(
      count(b, "skill_motion_mirror-counter") === 3,
      "mirror returns exactly three real hits",
    );
    b = add("orbit requires mark", {
      sequence: ["skill_motion_orbit"],
      noIncoming: true,
    });
    assert(count(b, "skill_motion_orbit") === 0, "orbit without mark cancels");
    b = add("orbit marked", {
      sequence: ["skill_motion_mark", "skill_motion_orbit"],
      leaveMarks: true,
      noIncoming: true,
    });
    assert(count(b, "skill_motion_orbit") > 0, "orbit with mark executes");
    b = add("trap avoidance", {
      sequence: ["skill_motion_trap"],
      trapChance: 0,
      noIncoming: true,
    });
    assert(
      count(b, "skill_motion_trap") === 0,
      "avoided trap never deals damage",
    );
    b = add("trap detonation", {
      sequence: ["skill_motion_trap"],
      trapChance: 100,
      noIncoming: true,
    });
    assert(
      count(b, "skill_motion_trap", true) === 1,
      "trap detonates once on next target turn",
    );
    b = add("summon persists", {
      sequence: ["skill_motion_summon"],
      noIncoming: true,
    });
    assert(
      count(b, "skill_motion_summon", true) === 2,
      "summon supports exactly its authored turns",
    );
    b = add("summon interrupted", { sequence: ["skill_motion_summon"] });
    assert(
      count(b, "skill_motion_summon", true) === 0,
      "owner damage cancels summon support",
    );
    b = add("kill refund", {
      sequence: ["skill_motion_sacrifice"],
      kill: true,
      noIncoming: true,
    });
    assert(
      b.timeline.some(
        (e) => e.skillId === "skill_motion_sacrifice" && e.aside === "hpCost",
      ),
      "HP paid first",
    );
    assert(
      b.timeline.some(
        (e) => e.skillId === "skill_motion_sacrifice" && e.aside === "drain",
      ),
      "actual kill refunds HP",
    );
    b = add("no kill no refund", {
      sequence: ["skill_motion_sacrifice"],
      noIncoming: true,
    });
    assert(
      !b.timeline.some(
        (e) => e.skillId === "skill_motion_sacrifice" && e.aside === "drain",
      ),
      "no kill never refunds HP",
    );
    b = add("cover interception", {
      sequence: ["skill_motion_cover"],
      cover: true,
    });
    assert(
      b.timeline.some(
        (e) => e.kind === "special" && e.message?.includes("엄호!"),
      ),
      "prepared cover intercepts physical attack",
    );
    b = add("zone inside", {
      sequence: ["skill_motion_zone"],
      noIncoming: true,
    });
    assert(
      count(b, "skill_motion_zone", true) === 2,
      "zone damages for authored duration inside radius",
    );
    b = add("zone leave", {
      sequence: ["skill_motion_zone"],
      noIncoming: true,
      leaveZone: true,
    });
    assert(
      count(b, "skill_motion_zone", true) === 0 &&
        b.timeline.some((e) => e.kind === "move"),
      "enemy movement beyond radius prevents zone upkeep damage",
    );
    b = add("relay without ready ally", {
      sequence: ["skill_motion_relay"],
      noIncoming: true,
    });
    assert(
      count(b, "skill_motion_relay") === 1,
      "relay without available ally stops after first hit",
    );
    b = add("transform expires", {
      sequence: ["skill_motion_transform"],
      noIncoming: true,
    });
    assert(
      !b.actors.some(
        (a) =>
          a.transformResourceId ||
          a.gimmicks?.some((s) => s.kind === "transform"),
      ),
      "transformation restores original form on expiry",
    );
    b = add("failed mark consumption", {
      sequence: ["skill_motion_mark", "skill_motion_marked-spear"],
      leaveMarks: true,
      persistMarks: true,
      missId: "skill_motion_marked-spear",
      noIncoming: true,
    });
    assert(
      b.enemies.some((e) =>
        e.gimmicks?.some((s) => s.kind === "mark" && s.stacks > 0),
      ),
      "missed final contact preserves accumulated marks",
    );
    // Real cancellation disposes all clocks/temporary game state; no fabricated damage during visual scrubbing.

    assert(BUNDLED_BATTLE_MOTIONS.length === 32, "32 common programs");
    return {
      rows,
      branches,
      checks: checks.length,
      failures: checks.filter((c) => !c.ok),
    };
  }, fixture.project);
  await writeFile(
    out + "/rules-audit.json",
    JSON.stringify({ ...result, errors }, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        rows: result.rows.length,
        checks: result.checks,
        errors,
        failures: result.failures,
      },
      null,
      2,
    ),
  );
  fixture.cleanup();
} finally {
  await browser.close();
  await server.close();
}
