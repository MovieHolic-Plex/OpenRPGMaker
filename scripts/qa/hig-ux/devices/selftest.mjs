// Selftest lane: proves the framework can both pass and fail. Each device measures the
// primary top-bar controls, resolved by accessible name the same way lane devices do.
// It passes on the editor (baseline or later) at 1440x900 and fails on the
// planted-defect fixture (run.mjs --fixture planted-defects).
const PRIMARY = ['자료집', '소재', '도움말'];

async function tagPrimary({ page, surface, lib, log }) {
  const selectors = [];
  for (const [i, name] of PRIMARY.entries()) {
    selectors.push(await lib.tagTarget(page, lib.tr(surface.lang, name), `primary-${i}`, { lang: surface.lang, log }));
  }
  return selectors;
}

export const surfaces = {
  topbar: { width: 1440, height: 900, lang: 'ko' },
  'topbar-escape': { width: 1440, height: 900, lang: 'ko' },
};

export const devices = [
  {
    id: 'selftest-overlap',
    surface: 'topbar',
    title: 'Primary top-bar controls do not overlap',
    async run(ctx) {
      const m = await ctx.probes.overlapProbe(ctx.page, { selectors: await tagPrimary(ctx) });
      return { pass: m.elements === PRIMARY.length && m.maxOverlapPx2 === 0, measured: m };
    },
  },
  {
    id: 'selftest-tiny-target',
    surface: 'topbar',
    title: 'Primary top-bar controls are at least 24 px on each side',
    async run(ctx) {
      const m = await ctx.probes.targetSizeProbe(ctx.page, { selectors: await tagPrimary(ctx), minPx: 24 });
      return { pass: m.elements === PRIMARY.length && m.belowCount === 0, measured: m };
    },
  },
  {
    id: 'selftest-font-floor',
    surface: 'topbar',
    title: 'Primary top-bar labels are at least 12 px',
    async run(ctx) {
      const m = await ctx.probes.fontFloorProbe(ctx.page, { selectors: await tagPrimary(ctx), floorPx: 12 });
      return { pass: m.texts > 0 && m.belowCount === 0, measured: m };
    },
  },
  {
    id: 'selftest-low-contrast',
    surface: 'topbar',
    title: 'Primary top-bar labels meet WCAG AA contrast',
    async run(ctx) {
      const m = await ctx.probes.contrastProbe(ctx.page, { selectors: await tagPrimary(ctx) });
      return { pass: m.texts > 0 && m.belowCount === 0, measured: m };
    },
  },
  {
    id: 'selftest-document-overflow',
    surface: 'topbar',
    title: 'The document does not scroll horizontally',
    async run(ctx) {
      const m = await ctx.probes.documentOverflowProbe(ctx.page);
      return { pass: m.overflowXPx === 0, measured: m };
    },
  },
  {
    id: 'selftest-focus-ring',
    surface: 'topbar',
    title: 'Keyboard focus on 자료집 draws a visible ring',
    async run(ctx) {
      const [db] = await tagPrimary(ctx);
      const m = await ctx.probes.focusRingProbe(ctx.page, db);
      // A ring is visible when at least half of a 1 px band around the control changes.
      return { pass: m.focused && m.changedPx >= m.perimeterPx / 2, measured: m };
    },
  },
  {
    id: 'selftest-escape-focus',
    surface: 'topbar-escape',
    title: 'Escape closes the 도움말 menu and returns focus to its trigger',
    async run(ctx) {
      const help = await ctx.lib.tagTarget(ctx.page, ctx.lib.tr(ctx.surface.lang, '도움말'), 'escape-trigger', { lang: ctx.surface.lang, log: ctx.log });
      const m = await ctx.probes.escapeRestoreProbe(ctx.page, help);
      const opened = m.layersOpen > m.layersBefore;
      const closed = m.layersAfter === m.layersBefore;
      return { pass: opened && closed && m.focusRestored === 1 && m.focusDistancePx === 0, measured: m };
    },
  },
];
