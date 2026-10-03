// Adversarial trajectory review, independent of runtime damage and FX presence checks.
// Runs only this pure evaluator; no test runner or shared worker pool.
import { build } from "esbuild";
import { isDeepStrictEqual } from "node:util";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const temporary = await mkdtemp(join(tmpdir(), "battle-motion-review-"));
try {
  const modulePath = join(temporary, "motion.mjs");
  await build({
    entryPoints: ["src/battle/battleMotionProgram.ts"],
    outfile: modulePath,
    bundle: true,
    platform: "node",
    format: "esm",
    alias: { "@": resolve("src") },
    logLevel: "error",
  });
  const {
    buildBattleMotionTracks: buildTracks,
    motionPositionAt: sample,
    normalizeBattleMotionProgram: normalize,
    BATTLE_MOTION_PATTERNS: patterns,
  } = await import(pathToFileURL(modulePath));
  const anchors = {
    home: { x: 460, y: 240 },
    front: { x: 240, y: 220 },
    target: { x: 200, y: 220 },
    ally: { x: 490, y: 280 },
    left: { x: -96, y: 240 },
    right: { x: 736, y: 240 },
    top: { x: 200, y: -160 },
    target2: { x: 130, y: 190 },
    target3: { x: 110, y: 260 },
  };
  const mirrored = Object.fromEntries(
    Object.entries(anchors).map(([k, p]) => [k, { x: 640 - p.x, y: p.y }]),
  );
  [mirrored.left, mirrored.right] = [mirrored.right, mirrored.left];
  const checks = [];
  const check = (ok, name, details) =>
    checks.push({ name, ok: !!ok, ...(ok ? {} : { details }) });
  const near = (a, b) => Math.abs(a - b) < 0.001;
  for (const pattern of patterns)
    for (const hit of [true, false])
      for (const count of [1, 3, 16]) {
        const beats = Array.from({ length: count }, (_, i) => 800 + i * 260);
        const program = {
          pattern,
          travelMs: 420,
          recoveryMs: 320,
          jumpHeight: 100,
          apexMs: 0,
        };
        const tracks = buildTracks(program, beats, { hit });
        for (const track of tracks) {
          const end = track.points.at(-1).at;
          check(
            !track.points.some((p) => p.pose === "front"),
            `${pattern}/${hit}/${count}/${track.role}: no camera-facing travel pose`,
          );
          for (let t = 0; t <= end; t += 25) {
            const p = sample(track, t, anchors),
              m = sample(track, t, mirrored);
            check(
              Number.isFinite(p.x) && Number.isFinite(p.y),
              `${pattern}/${hit}/${count}/${track.role}@${t}: finite`,
            );
            check(
              near(p.x + m.x, 640) && near(p.y, m.y),
              `${pattern}/${hit}/${count}/${track.role}@${t}: mirrored geometry`,
              { p, m },
            );
          }
          if (track.role === "user") {
            const endPoint = sample(track, end, anchors);
            check(
              near(endPoint.x, anchors.home.x) &&
                near(endPoint.y, anchors.home.y),
              `${pattern}/${hit}/${count}: user finishes at home`,
            );
          }
          if (track.role === "target" && pattern !== "pull") {
            const before = sample(track, beats[0] - 1, anchors);
            check(
              near(before.x, anchors.target.x) &&
                near(before.y, anchors.target.y),
              `${pattern}/${count}: victim stays still until first contact`,
              before,
            );
          }
        }
        check(
          hit || !tracks.some((t) => t.role === "target"),
          `${pattern}/${count}: a miss cannot move the victim`,
        );
        const saved = normalize({
          ...program,
          tracks: tracks.map((t) => ({ ...t, points: [...t.points] })),
        });
        check(
          saved?.tracks?.every((t, i) =>
            isDeepStrictEqual(t.points, tracks[i].points),
          ),
          `${pattern}/${hit}/${count}: unfolded paths survive normalization`,
        );
        if (hit && count > 1 && ["air-chase", "sky-crush"].includes(pattern)) {
          const user = tracks.find((t) => t.role === "user"),
            target = tracks.find((t) => t.role === "target");
          for (const at of beats) {
            const u = sample(user, at, anchors),
              v = sample(target, at, anchors);
            check(
              near(u.y, v.y),
              `${pattern}/${count}@${at}: attacker and victim meet at contact height`,
              { u, v },
            );
          }
        }
      }
  const jump = buildTracks({ pattern: "jump", travelMs: 400, apexMs: 0 }, [
    800,
  ])[0];
  const before = sample(jump, 599, anchors),
    apex = sample(jump, 600, anchors),
    after = sample(jump, 601, anchors);
  check(
    before.x > apex.x && apex.x > after.x,
    "jump: horizontal travel continues across apex",
  );
  check(
    before.y > apex.y && after.y > apex.y,
    "jump: vertical velocity reverses at apex",
  );
  const collateral = buildTracks(
    { pattern: "sky-crush" },
    [800, 1060, 1320, 1580],
    { primaryContacts: 3 },
  );
  check(
    sample(
      collateral.find((t) => t.role === "user"),
      1320,
      anchors,
    ).y === anchors.front.y,
    "collateral damage does not delay primary slam",
  );
  const failures = checks.filter((c) => !c.ok),
    out = "verify-shots/battle-motion/adversarial";
  await mkdir(out, { recursive: true });
  await writeFile(
    join(out, "trajectory-review.json"),
    JSON.stringify({ checks: checks.length, failures }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ checks: checks.length, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
