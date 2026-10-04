// Verify visible outcomes, not just successful rendering of controls.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const server = await startPlayerQaServer({ logLevel: "error" }),
  browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.route("**/__outcomes", (r) =>
    r.fulfill({ contentType: "text/html", body: "<html></html>" }),
  );
  await page.goto(server.url + "/__outcomes");
  const result = await page.evaluate(async () => {
    const [
      { defaultBattleMotionSkills },
      { resolveSkillChoreography },
      { buildBattleMotionPreview },
      {
        retroClassSkillTimeline,
        retroMonsterSkillTimeline,
        retroTimelineStateAt,
      },
      { applyChoreographyHandles },
      { motionPositionAt },
    ] = await Promise.all([
      import("/src/assets/battleMotionCatalog.ts"),
      import("/src/assets/retroSkillCatalog.ts"),
      import("/src/battle/battleMotionPreview.ts"),
      import("/src/battle/retroSkillTimeline.ts"),
      import("/src/battle/retroChoreographyHandles.ts"),
      import("/src/battle/battleMotionProgram.ts"),
    ]);
    const checks = [],
      rows = [];
    const check = (ok, name) => {
      checks.push({ ok: !!ok, name });
      if (!ok) throw Error(name);
    };
    const anchors = {
      home: { x: 500, y: 240 },
      front: { x: 240, y: 240 },
      target: { x: 200, y: 240 },
      ally: { x: 520, y: 270 },
      left: { x: -96, y: 240 },
      right: { x: 736, y: 240 },
      top: { x: 200, y: -160 },
      target2: { x: 120, y: 220 },
      target3: { x: 100, y: 260 },
    };
    for (const skill of defaultBattleMotionSkills())
      for (const side of ["class", "monster"]) {
        const resolved = resolveSkillChoreography(skill, undefined, side),
          record = resolved.record;
        const factory = (count) =>
          (side === "class"
            ? retroClassSkillTimeline
            : retroMonsterSkillTimeline)(resolved.skill, {
            hits: count,
            side: "enemies",
          });
        const pattern = record.movement.pattern,
          hits =
            pattern === "bounce"
              ? 3
              : pattern === "throw"
                ? 2
                : (skill.hitSequence?.length ?? 1);
        const opts = {
          hits,
          preparing: skill.effect.kind === "support",
          followOnHit: skill.battleGimmick?.followOnHit,
        };
        const previews = Object.fromEntries(
          ["hit", "miss", "cancel"].map((outcome) => [
            outcome,
            buildBattleMotionPreview(record, factory, { ...opts, outcome }),
          ]),
        );
        const cancelled = previews.cancel;
        check(
          cancelled.events.length === 0,
          `${side}/${pattern}: blocked action emits no attack, FX or sound`,
        );
        check(
          cancelled.actors.length === 1,
          `${side}/${pattern}: blocked action has no victim, clone, ally or summon`,
        );
        for (let t = 0; t <= cancelled.durationMs; t += 50) {
          const p = motionPositionAt(cancelled.actors[0], t, anchors);
          check(
            p.x === anchors.home.x &&
              p.y === anchors.home.y &&
              p.pose === "idle",
            `${side}/${pattern}: blocked caster remains at home @${t}`,
          );
        }
        if (!opts.preparing) {
          const miss = previews.miss,
            contacts = miss.events.filter((e) => e.kind === "hit");
          check(
            contacts.length > 0,
            `${side}/${pattern}: miss retains attempted contact timing`,
          );
          check(
            contacts.every((e) => e.landed === false),
            `${side}/${pattern}: miss has no landed contacts`,
          );
          check(
            !miss.events.some(
              (e) =>
                e.kind === "fx" && ["target", "allTargets"].includes(e.anchor),
            ),
            `${side}/${pattern}: miss has no target impact sheets`,
          );
          check(
            !miss.events.some(
              (e) =>
                e.kind === "screen" && ["shake", "flash"].includes(e.effect),
            ),
            `${side}/${pattern}: miss has no contact shake or flash`,
          );
          check(
            !miss.actors.some((t) => t.role === "target"),
            `${side}/${pattern}: miss does not move the victim`,
          );
          for (const c of contacts) {
            const state = retroTimelineStateAt(miss, c.at + 1);
            check(
              state.hitTarget === 0 && state.hitAll === 0,
              `${side}/${pattern}: missed contact cannot flash victim`,
            );
          }
          if (opts.followOnHit)
            check(
              contacts.length === 1,
              `${side}/${pattern}: miss cancels follow-up contacts`,
            );
          const hit = previews.hit,
            contact = hit.events.find((e) => e.kind === "hit");
          check(
            contact && retroTimelineStateAt(hit, contact.at + 1).hitTarget > 0,
            `${side}/${pattern}: hit actually flashes target`,
          );
        }
        rows.push({
          pattern,
          side,
          contacts: Object.fromEntries(
            Object.entries(previews).map(([k, v]) => [
              k,
              v.events.filter((e) => e.kind === "hit").length,
            ]),
          ),
          duration: Object.fromEntries(
            Object.entries(previews).map(([k, v]) => [k, v.durationMs]),
          ),
        });
      }
    const skill = defaultBattleMotionSkills().find(
        (s) => s.id === "skill_motion_freeze",
      ),
      resolved = resolveSkillChoreography(skill);
    const mixed = applyChoreographyHandles(
      retroClassSkillTimeline(resolved.skill, { hits: 3 }),
      resolved.record,
      { hit: true, contactHits: [true, false, true] },
    );
    check(
      JSON.stringify(
        mixed.events.filter((e) => e.kind === "hit").map((e) => e.landed),
      ) === "[true,false,true]",
      "mixed hit/miss/hit facts remain distinct: " +
        JSON.stringify(mixed.events.filter((e) => e.kind === "hit")),
    );
    check(
      mixed.events.filter((e) => e.kind === "fx" && e.anchor === "target")
        .length === 2,
      "mixed action has exactly two impact sheets",
    );
    return {
      checks: checks.length,
      rows,
      failures: checks.filter((c) => !c.ok),
    };
  });
  await mkdir("verify-shots/battle-motion/outcomes", { recursive: true });
  await writeFile(
    "verify-shots/battle-motion/outcomes/contract-review.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      checks: result.checks,
      scenarios: result.rows.length,
      failures: result.failures,
    }),
  );
} finally {
  await browser.close();
  await server.close();
}
