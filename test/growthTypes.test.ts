import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults";
import { normalizeSkillRecord, normalizeClassRecord } from "@/project/databaseRecordModel";
import { classGrowthArt, skillGrowthArt, parameterGrowthArt, treeGrowthArt, nodeGrowthArt } from "@/assets/growthTreeArt";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { GROWTH_PARAMETERS, emptyGrowth, type SkillTreeNode } from "@/project/growth/types";
import runtimeAssetInventory from "@/player/runtimeAssets.json";
import { readStoredZipEntry, writeStoredZip } from "@/project/packageZip";
import { createStandaloneHtmlExport } from "@/project/standaloneExport";
import { STANDALONE_ASSETS_NODE_ID } from "@/project/standaloneHtml";
import type { Project, SkillRecord } from "@/project/types";
import { collectWebExportAssets, prepareWebExport } from "@/project/webExport";
import { requiredRuntimeAssetPaths } from "@/project/webExportRuntimeAssets";
import { exactWebExportEntries } from "@/project/webExportZip";
import { isolateTimers } from "./mergedTeardown";

describe("growthTreeArt", () => {
  isolateTimers();
  describe('growth role art', () => {
    it('distinguishes class roles without borrowing an arbitrary actor face', () => {
      const p = createBlankProject(), base = p.database.classes[0]!;
      const ids = ['전사', '마법사', '성직자', '궁수'].map(name => classGrowthArt(p, { ...base, name }));
      expect(new Set(ids).size).toBe(4);
      for (const id of ids) expect(existsSync(`public${resolveAssetResourceUrl(id)}`)).toBe(true);
    });
    it('uses skill effects, never the whole authored animation sheet', () => {
      const p = createBlankProject();
      const skill = normalizeSkillRecord({ id: 'custom', name: 'Custom', animationId: p.database.battleAnimations[0]?.id });
      skill.effect = { kind: 'healing', statistic: 'mind', affects: 'hp' };
      expect(skillGrowthArt(skill)).toBe('cc0-jetrel-holy-water');
      skill.effect = { kind: 'damage', statistic: 'mind', affects: 'hp' };
      expect(skillGrowthArt(skill)).toBe('cc0-jetrel-book-magic');
      skill.effect = { kind: 'damage', statistic: 'attack', affects: 'hp' };
      expect(skillGrowthArt(skill)).toBe('cc0-jetrel-book-sword');
    });
    it('provides registered, distinct parameter symbols and missing-record fallback', () => {
      const ids = GROWTH_PARAMETERS.map(parameterGrowthArt);
      expect(new Set(ids).size).toBe(6);
      for (const id of [...ids, skillGrowthArt(undefined)]) expect(existsSync(`public${resolveAssetResourceUrl(id)}`)).toBe(true);
      expect(skillGrowthArt(undefined)).toBe('cc0-jetrel-skill-book');
    });
    it('supports custom classes through learned skills and empty trees without mutation', () => {
      const p = createBlankProject(), c = structuredClone(p.database.classes[0]!);
      c.name = '별지기'; c.options.dualWield = false; c.options.mightyGuard = false;
      const heal = normalizeSkillRecord({ id: 'custom-heal', name: '별빛' });
      heal.effect = { kind: 'healing', statistic: 'mind', affects: 'hp' };
      p.database.skills.push(heal); c.learnedSkills = [{ level: 1, skillId: heal.id }]; c.skillIds = [];
      const before = JSON.stringify(p);
      expect(classGrowthArt(p, c)).toBe('cc0-jetrel-holy-water');
      expect(treeGrowthArt(p, { id: 'empty', name: 'Empty', description: '', nodes: [], classIds: [], allowReset: true })).toBe('cc0-jetrel-skill-book');
      expect(JSON.stringify(p)).toBe(before);
    });
  });
});

describe("growthTreeArtExport", () => {
  isolateTimers();
  const encoder = new TextEncoder();
  const ICON_NAMES = [
    'book-magic', 'book-sword', 'bronze-sword', 'ether-blue', 'focus-charm',
    'gear', 'gen-bow-short', 'holy-water', 'mage-staff', 'oak-shield',
    'potion-red', 'scout-dagger', 'skill-book', 'warp-scroll', 'wind-feather',
  ] as const;
  const ICON_PATHS = ICON_NAMES.map(name => `assets/cc0/jetrel/icons/${name}.png`);
  function growthProject(): Project {
    const project = createBlankProject();
    const classes = ['Warrior', 'Mage', 'Cleric', 'Archer', 'Rogue', 'Knight', 'Custom'].map((name, index) =>
      normalizeClassRecord({ id: `export-class-${index}`, name }));
    const [firstClass, nextClass] = classes;
    if (!firstClass || !nextClass) throw new TypeError('Growth export fixture requires a promotion');
    firstClass.promotions = [{ toClassId: nextClass.id, requires: {} }];
    project.database.classes.push(...classes);
    for (const actor of project.database.actors) actor.classId = firstClass.id;

    const variants: readonly Partial<SkillRecord>[] = [
      { effect: { kind: 'healing', statistic: 'mind', affects: 'hp' } },
      { effect: { kind: 'healing', statistic: 'mind', affects: 'mp' } },
      { effect: { kind: 'damage', statistic: 'attack', affects: 'hp' } },
      { effect: { kind: 'damage', statistic: 'mind', affects: 'hp' } },
      { effect: { kind: 'support' } },
      { type: 'switch', effect: { kind: 'switch' } },
      { type: 'teleport' },
      { type: 'escape' },
    ];
    const skills = variants.map((variant, index) => normalizeSkillRecord({
      ...variant, id: `export-skill-${index}`, name: `Custom skill ${index}`,
    }));
    project.database.skills.push(...skills);
    const effects: SkillTreeNode['effect'][] = [
      ...skills.map(skill => ({ kind: 'skill' as const, skillId: skill.id })),
      ...GROWTH_PARAMETERS.map(parameter => ({ kind: 'parameter' as const, parameter, amount: 1 })),
    ];
    project.growth = {
      ...emptyGrowth(),
      skillTrees: [{
        id: 'export-tree', name: 'Custom tree', description: '', classIds: [], allowReset: true,
        nodes: effects.map((effect, index) => ({
          id: `node-${index}`, name: `Node ${index}`, description: '', x: index * 200, y: 0,
          cost: 1, maxRank: 1, level: 1, prerequisites: [], effect,
        })),
      }],
    };

    // No incidental catalog/item reference may rescue code-derived growth art.
    project.resourceProfiles = project.resourceProfiles.filter(row => !row.assetId.startsWith('cc0-jetrel-'));
    for (const record of [...project.database.items, ...project.database.equipment]) {
      if (record.iconResourceId?.startsWith('cc0-jetrel-')) delete record.iconResourceId;
      if (record.imageResourceId?.startsWith('cc0-jetrel-')) delete record.imageResourceId;
    }
    expect(JSON.stringify(project)).not.toContain('cc0-jetrel-');
    return project;
  }
  function emittedGrowthPaths(project: Project): string[] {
    const trees = project.growth?.skillTrees ?? [];
    const ids = new Set([
      ...project.database.classes.map(record => classGrowthArt(project, record)),
      ...trees.flatMap(tree => tree.nodes.map(node => nodeGrowthArt(project, node))),
      ...trees.map(tree => treeGrowthArt(project, tree)),
    ]);
    const paths = [...ids].map(id => {
      const url = resolveAssetResourceUrl(id, { project });
      if (!url?.startsWith('/')) throw new TypeError(`Growth icon has no public path: ${id}`);
      return url.slice(1);
    }).sort();
    expect(paths).toEqual(ICON_PATHS);
    return paths;
  }
  // Only unrelated engine/assets are stand-ins. Growth PNGs come from the shipped
  // files, and neither the deployment nor CSS can add icons missing from the plan.
  async function fetchExportBytes(path: string): Promise<Uint8Array> {
    if (path === '/standalone-player/standalone.js') return encoder.encode('/* fixture player */');
    // The player bundle contract rejects empty stylesheets; keep this fixture valid.
    if (path === '/standalone-player/standalone.css') return encoder.encode('body { margin: 0; }');
    if (path.startsWith('/assets/cc0/jetrel/icons/')) return readFileSync(`public${path}`);
    return encoder.encode(`fixture:${path}`);
  }
  describe('growth art export contract', () => {
    it('collects every emitted icon without authored resource references', () => {
      const project = growthProject();
      const paths = emittedGrowthPaths(project);

      const collected = new Set(collectWebExportAssets(project).map(asset => asset.zipPath));
      const prepared = prepareWebExport(project);
      const planned = new Set(prepared.assets.map(asset => asset.zipPath));

      expect(paths.filter(path => !collected.has(path))).toEqual([]);
      expect(paths.filter(path => !planned.has(path))).toEqual([]);
      expect(prepared.project.growth).toEqual(project.growth);
      expect(JSON.stringify(prepared.project)).not.toContain('cc0-jetrel-');
    });

    it('ships the growth PNG bytes inside the exported ZIP', async () => {
      const project = growthProject();
      const paths = emittedGrowthPaths(project);

      const entries = await exactWebExportEntries(prepareWebExport(project), {
        bundleFiles: [{ sourcePath: 'player.html', zipPath: 'index.html', bytes: encoder.encode('<main></main>') }],
        runtimeAssets: [],
      }, fetchExportBytes);
      const zip = new Uint8Array(await writeStoredZip(entries).arrayBuffer());

      expect(paths.filter(path => readStoredZipEntry(zip, path) === null)).toEqual([]);
      for (const path of paths) {
        expect(readStoredZipEntry(zip, path)).toEqual(new Uint8Array(readFileSync(`public/${path}`)));
      }
    });

    it('embeds every growth PNG in the standalone HTML asset table', async () => {
      const project = growthProject();
      const paths = emittedGrowthPaths(project);

      const result = await createStandaloneHtmlExport(project, { fetchBytes: fetchExportBytes });
      const html = await result.blob.text();
      const json = html.match(new RegExp(`<script type="application/json" id="${STANDALONE_ASSETS_NODE_ID}">([\\s\\S]*?)</script>`))?.[1];
      if (!json) throw new TypeError('Standalone export has no asset table');
      const inlineAssets: Record<string, string> = JSON.parse(json);

      expect(result.summary.missingAssets).toEqual([]);
      expect(paths.filter(path => !(path in inlineAssets))).toEqual([]);
      for (const path of paths) {
        expect(inlineAssets[path]).toBe(`data:image/png;base64,${readFileSync(`public/${path}`).toString('base64')}`);
      }
    });

    it('keeps the required inventory sorted, unique, and backed by real files', () => {
      const paths = runtimeAssetInventory.paths;
      const required = [...requiredRuntimeAssetPaths(growthProject())];

      expect(paths).toEqual([...new Set(paths)].sort());
      expect(required).toEqual([...new Set(required)].sort());
      for (const path of paths) expect(readFileSync(`public/${path}`).byteLength, path).toBeGreaterThan(0);
      expect(ICON_PATHS.filter(path => !required.includes(path))).toEqual([]);
    });
  });
});
