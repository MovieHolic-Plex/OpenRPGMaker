// Browser evidence for animation/cue synchronization across repeated hitstops.
import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.route("**/__clock-review", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<div id="actor"></div><div id="victim"></div>',
    }),
  );
  await page.goto(server.url + "/__clock-review");
  const result = await page.evaluate(async () => {
    const { BattlePlaybackClock } = await import(
      "/src/player/battlePlaybackClock.ts"
    );
    const clock = new BattlePlaybackClock(),
      checks = [];
    const check = (ok, name, detail) => {
      checks.push({ ok: !!ok, name, detail });
      if (!ok) throw new Error(name + ": " + JSON.stringify(detail));
    };
    const {retroMonsterCellForPose}=await import("/src/battle/retroSkillTimeline.ts");
    check(retroMonsterCellForPose("hit")==="hit","monster victim uses the hit cell");
    check(retroMonsterCellForPose("attack_follow")==="recover","monster follow-through uses recovery cell");
    check(retroMonsterCellForPose("dead")==="dead","monster defeat uses the dead cell");
    const actor = document
      .querySelector("#actor")
      .animate(
        [
          { translate: "0px 0px" },
          { translate: "-200px -100px" },
          { translate: "-400px 0px" },
        ],
        { duration: 900, fill: "forwards" },
      );
    const victim = document
      .querySelector("#victim")
      .animate(
        [
          { translate: "0px 0px" },
          { translate: "0px -100px" },
          { translate: "0px 0px" },
        ],
        { duration: 900, fill: "forwards" },
      );
    clock.trackAnimation(actor, 0);
    clock.trackAnimation(victim, 0);
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    for (let i = 0; i < 4; i++) {
      await wait(85);
      // Main-thread contention must not introduce permanent drift between timers and WAAPI.
      const until = performance.now() + 25;
      while (performance.now() < until) {}
      clock.pause(16);
      const held = clock.elapsedMs,
        time = Number(actor.currentTime);
      check(
        Math.abs(time - held) < 1,
        "contact position uses presentation time " + i,
        { held, time },
      );
      check(
        Math.abs(Number(victim.currentTime) - time) < 1,
        "attacker and victim share time " + i,
      );
      await wait(90);
      check(
        clock.elapsedMs === held && Number(actor.currentTime) === time,
        "hold freezes position and clock " + i,
      );
      clock.resume();
      await new Promise((resolve) =>
        clock.schedule(() => {
          check(
            Math.abs(Number(actor.currentTime) - clock.elapsedMs) < 2,
            "pose callback sees synchronized position " + i,
          );
          resolve();
        }, 35),
      );
    }
    clock.dispose();
    check(
      actor.playState === "idle" && victim.playState === "idle",
      "teardown cancels owned motion",
    );
    await wait(80);
    check(
      document.getAnimations().length === 0,
      "no animation survives disposal",
    );
    return { checks };
  });
  await mkdir("verify-shots/battle-motion/adversarial", { recursive: true });
  await writeFile(
    "verify-shots/battle-motion/adversarial/clock-review.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  await server.close();
}
