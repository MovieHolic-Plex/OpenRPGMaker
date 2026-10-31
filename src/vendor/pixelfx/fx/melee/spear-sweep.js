// The crescent, trace and glint recipe is adapted from Sprite Fusion's open-source slash, and the rolling dust and
// grit from his explosion (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, PF, Rng, fit, sparkle, clamp, ease } from "../../core/index.js";
import { swing, onSwing, travel, slash, slashEnd, stone } from "./_lib.js";

export const meta = {
  name: "Spear sweep",
  desc: "A wide low sweep at shin height: a long flat crescent swings from behind the legs round the front, and the wind of it kicks a wake of dust and grit along the floor.",
  tags: ["melee", "sweep", "spear", "polearm", "low", "aoe", "ground", "dust", "combat", "one-shot"],
  size: [216, 84],
  origin: [104, 70],
  duration: 1.5,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#0f2a2a", "#18504a", "#22806e", "#3fb894", "#8fe6c0", "#dcfff0", "#ffffff"],
    sparks: ["#fff3a6", "#ffe26b", "#ff8a2a", "#f2561d"],
    stone: "#4a3f69",
    seed: 10,
  },
};

export function create(o) {
  const C = fit(o.palette, 7), Rg = new Rng(o.seed), st = stone(o.stone), ps = new Particles({ rng: Rg, ground: () => 0, sparks: o.sparks }), lights = new Lights();
  // from behind the left leg, round the front, out to the right; the far part is behind the fighter
  const A = swing({ cx: 2, cy: -12, R: 50, sy: 0.2, k: 0.19, rot: -0.04, a0: Math.PI + 0.55, dir: -1, span: Math.PI + 0.35, W: 19, t0: 0, sweep: 0.13, hold: 0.05, trail: 0.3, ramp: C });
  const end = slashEnd(A);
  let t = 0, lastU = 0, done = false;
  return {
    update(dt) {
      t += dt;
      // the wind under the blade kicks dust up off the floor as it passes, rolling on the way it goes
      const U = A.span * ease.outExpo(clamp(t / A.sweep));
      for (let u = lastU; u < U; u += 0.09) {
        const tr = travel(A, u), near = Math.sin(tr.a) >= 0, fy = near ? -1 : -3, sp = Rg.range(30, 90);
        ps.spawn(P.SMOKE, tr.x, fy - Rg.range(0, 2), tr.dx * sp, -Rg.range(4, 16), Rg.range(0.7, 1.15), st.dust, Rg.range(3, 5.5), Rg.range(0, 0.05));
        if (Rg.chance(0.6)) ps.spawn(P.GRIT, tr.x, fy, tr.dx * Rg.range(40, 120) + Rg.range(-20, 20), -Rg.range(40, 130), Rg.range(0.6, 1.0), Rg.pick([st.light, st.body, st.shade]), Rg.chance(0.3) ? 2 : 1);
        if (Rg.chance(0.35)) ps.spawn(P.MOTE, tr.x, tr.y, tr.dx * Rg.range(40, 100), tr.dy * 40 - Rg.range(5, 20), Rg.range(0.2, 0.4), Rg.chance(0.5) ? C[4] : C[5], 0.6, 0, near ? 0 : PF.BACK);
      }
      lastU = U;
      if (!done && t >= A.sweep) {
        done = true;
        lights.add(end.x, end.y - 4, 50, C[3], 0.5, 0.35);
        for (let i = 0; i < 8; i++) {
          const a = Math.atan2(end.dy, end.dx) + Rg.range(-0.5, 0.3), sp = Rg.range(120, 260);
          ps.spawn(P.SPARK, end.x, end.y, Math.cos(a) * sp, Math.sin(a) * sp - 40, Rg.range(0.12, 0.3));
        }
        // the wake piles up and rolls on past the tip
        for (let i = 0; i < 6; i++) ps.spawn(P.SMOKE, end.x + Rg.range(-6, 4), -Rg.range(1, 4), Rg.range(30, 90), -Rg.range(4, 14), Rg.range(0.9, 1.25), st.dust, Rg.range(4.5, 7), Rg.range(0, 0.08), PF.BIG);
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      slash(p, A, t, -1);
      ps.draw(p, "back");
    },
    draw(p) {
      slash(p, A, t, 1);
      const g = t - A.sweep * 0.6;
      if (g > 0 && g < 0.24) sparkle(p, end.x, end.y, 9 * ease.outBack(Math.min(1, g / 0.05)) * (1 - g / 0.24), C[5], C[3], 0.55);
      // light rides the edge
      if (t < A.sweep + 0.12) {
        const [x, y] = onSwing(A, A.R - 5, A.span * ease.outExpo(clamp(t / A.sweep)));
        p.glow(x, y, 36, C[3], 0.45 * (1 - t / (A.sweep + 0.12)));
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
