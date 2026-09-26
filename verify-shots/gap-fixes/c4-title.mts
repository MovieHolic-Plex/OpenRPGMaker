import { createBlankProject } from "../../src/project/defaults";
import { runTool } from "../../src/editor/tools/toolRunner";
import { applyGenrePreset } from "../../src/project/genrePresets";
const p = createBlankProject(); const ctx = { project: p };
const authorEffects = [{ kind: "glow", source: [0.5, 0.5] }];
const s = runTool(ctx, "set_title_screen", { title: "저자 타이틀", musicResourceId: "cc0-bgm-rtp-uix-001", effects: authorEffects, logoStyle: "gold" });
const r = runTool(ctx, "improve_title_screen", { stage: 3 });
const t = ctx.project.system.titleScreen!;
const bad = runTool(ctx, "improve_title_screen", { stage: 4 });
const q = createBlankProject(); q.system.battleUiStyle = "dragonquest"; q.system.menuUiStyle = "retro-2000"; applyGenrePreset(q, "adventure-jrpg");
console.log(JSON.stringify({ setOk: s.ok, setSummary: s.summary, improve: r.summary, music: t.musicResourceId, effects: t.effects, logoStyle: t.logoStyle, filled: { intro: t.intro, particles: t.particles, menuStyle: t.menuStyle },
  stage4: { ok: bad.ok, code: bad.issues?.[0]?.code }, jrpgKeepsAuthor: { battleUiStyle: q.system.battleUiStyle, menuUiStyle: q.system.menuUiStyle, battleParty: q.system.battleParty } }, null, 1));