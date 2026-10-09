// Read-only host integration: actual catalog HTTP GET -> real tools on in-memory test fixtures.
// No authored project or shared catalog is persisted.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:9842';
const output = 'output/evidence/npc-shared-face-mapping';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.route(`${base}/__face-mapping-probe`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>NPC face mapping integration probe</title>' }));
  await page.goto(`${base}/__face-mapping-probe`);
  const evidence = await page.evaluate(async () => {
    const { refreshSharedCharacterGraphics, acceptSharedCharacterGraphics } = await import('/src/project/sharedCharacterFaceResolver.ts');
    const { createBlankProject } = await import('/src/project/defaults.ts');
    const { runTool } = await import('/src/editor/tools/toolRunner.ts');
    const { resolveAssetResourceUrl } = await import('/src/assets/generatedAssetResourceResolver.ts');
    const { document: catalog, revision } = await (await fetch('/__oprn/shared-character-graphics', { cache: 'no-store' })).json();
    await refreshSharedCharacterGraphics();
    const selected = [catalog.mappings.find(row => row.status === 'mapped'), catalog.mappings.find(row => row.status === 'no-face' && row.textureKey === 'tex_easyrpg_charset_people4')];
    if (selected.some(row => !row)) throw new Error('Catalog needs mapped and no-face rows for this probe');
    const checks = [];
    for (const tool of ['place_npc', 'make_villager']) {
      for (const row of selected) {
        const ctx = { project: createBlankProject() };
        const result = runTool(ctx, tool, {
          mapId: ctx.project.startMapId, name: '얼굴 매핑 계약 확인',
          ...(tool === 'place_npc' ? { x: 3, y: 3 } : { home: { x: 3, y: 3 } }),
          graphic: { textureKey: row.textureKey, characterIndex: row.characterIndex },
          pages: [{ lines: ['공용 자료의 얼굴 매핑 확인'] }],
        });
        if (!result.ok) throw new Error(result.summary);
        const event = ctx.project.maps[ctx.project.startMapId].events.find(event => event.id === result.data.eventId);
        const commands = JSON.parse(JSON.stringify(event)).pages[0].commands;
        const actual = commands.find(command => command.kind === 'changeFace')?.resourceId ?? null;
        let image = null;
        if (actual) {
          const url = resolveAssetResourceUrl(actual, { project: ctx.project });
          const img = new Image(); img.src = url; await img.decode();
          image = { width: img.naturalWidth, height: img.naturalHeight };
        }
        checks.push({ tool, sprite: `${row.textureKey}#${row.characterIndex}`, status: row.status, expected: row.faceResourceId, actual, image, passed: actual === row.faceResourceId });
      }
    }
    // Start with a deliberately empty cache: only sendUserMessage's preflight can restore it.
    acceptSharedCharacterGraphics({ schema: 'oprn-npc-face-mapping', version: 2, mappings: [], faces: [] });
    const { AssistantSession } = await import('/src/ai/assistantSession.ts');
    const project = createBlankProject();
    // Normalize unrelated sparse blank-project tile metadata for this focused session fixture.
    for (const tileset of Object.values(project.tilesets)) {
      for (const group of tileset.tileGroups ?? []) group.placementRules ??= '';
      for (const meta of tileset.tileMeta ?? []) if (meta) { meta.label ??= ''; meta.description ??= ''; }
    }
    const row = selected[0];
    let calls = 0;
    const session = new AssistantSession(project, {
      config: { authMode: 'apiKey', agentMode: 'chat', autoApprove: false, baseUrl: 'unused', apiKey: 'unused', model: 'gpt-5.4', maxToolCalls: 4, maxTokens: 4096 },
      freezeGuard: async () => () => {},
      declareIntent: async () => ({ intent: { mode: 'create', space: 'none', facility: null, targetMapId: null, useSelection: false, clarify: null, clarifyOptions: [], needsPlan: false, resetsContext: false, tools: ['place_npc'], summary: 'NPC 계약 확인', source: 'llm' }, elapsedMs: 0 }),
      chat: async () => ++calls === 1 ? {
        message: { role: 'assistant', content: null, tool_calls: [{ id: 'face-probe', type: 'function', function: { name: 'place_npc', arguments: JSON.stringify({ mapId: project.startMapId, x: 3, y: 3, name: '세션 얼굴 확인', graphic: { textureKey: row.textureKey, characterIndex: row.characterIndex }, pages: [{ lines: ['세션 매핑 확인'] }] }) } }] }, finishReason: 'tool_calls',
      } : { message: { role: 'assistant', content: 'NPC 생성 제안을 준비했습니다.' }, finishReason: 'stop' },
    });
    const turn = await session.sendUserMessage('NPC 한 명을 배치해줘');
    const created = session.getProposedProject().maps[project.startMapId].events.find(event => event.name === '세션 얼굴 확인');
    const actual = created?.pages?.[0]?.commands.find(command => command.kind === 'changeFace')?.resourceId ?? null;
    if (actual !== row.faceResourceId) throw new Error(`Session face mismatch: ${actual}; stop=${turn.stoppedReason}; ${turn.assistantText}`);
    return { revision, mappingCount: catalog.mappings.length, checks, session: { actual, expected: row.faceResourceId, passed: actual === row.faceResourceId, stoppedReason: turn.stoppedReason, model: 'scripted tool call; no live LLM' }, persistence: 'none: in-memory contract fixtures only' };
  });
  assert(evidence.checks.every(check => check.passed));
  assert(evidence.checks.filter(check => check.actual).every(check => check.image.width > 0));
  await writeFile(`${output}/browser.json`, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
} finally { await browser.close(); }
