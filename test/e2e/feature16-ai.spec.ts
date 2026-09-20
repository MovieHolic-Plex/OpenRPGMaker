import { readyEditor } from '../../scripts/qa/feature16-editor-boot.mjs';
import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const output = 'verify-shots/feature16-ai';
async function openTool(page: Page, tool: 'library' | 'dialogue' | 'inspector') {
  const restore = page.getByTestId('ai-collapsed-restore');
  if (await restore.isVisible()) await restore.click();
  await page.getByTestId('ai-command-menu-toggle').click();
  await page.getByTestId(`feature16-open-${tool}-composer`).click();
  await expect(page.getByTestId(`feature16-${tool}`)).toBeVisible();
}

test('feature16: real editor library, dialogue review, source navigation and wire inspector', async ({ page }) => {
  await mkdir(output, { recursive: true });
  // No authored DB traffic. Fixtures live only in the blank-project test session.
  await page.route('**/*', async route => {
    if (/supabase\./u.test(new URL(route.request().url()).hostname) && !['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { await route.abort(); return; }
    await route.continue();
  });
  await page.goto('/?blankProject=1');
  await readyEditor(page);
  await expect(page.getByTestId('edit-canvas')).toBeVisible({ timeout: 60000 });
  await page.evaluate(async () => {
    const { createBlankProject } = await import('/src/project/defaults.ts');
    const { store } = await import('/src/project/store.ts');
    const { loadAiConfig, saveAiConfig } = await import('/src/ai/llmClient.ts');
    saveAiConfig({ ...loadAiConfig(), model: 'gemini-3.7-flash', roleModels: undefined });
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const base = { conditions: [], graphic: {}, trigger: { kind: 'action' as const }, priority: 'same' as const, movement: { type: 'fixed' as const, speed: 3, frequency: 3 } };
    map.events.push({ id: 'feature16-guide', name: '검토 안내인', x: 2, y: 2, trigger: { kind: 'action' }, commands: [], pages: [
      { ...base, id: 'f16-first', name: '첫 인사', commands: [{ kind: 'text', speaker: '안내인', body: '안녕, 여행자.' }, { kind: 'choices', prompt: '어디로 갈까요?', options: [{ text: '광장', branch: [{ kind: 'text', body: ' 광장으로 갑니다. ' }] }] }] },
      { ...structuredClone(base), id: 'f16-second', name: '경비 대사', commands: [{ kind: 'text', speaker: '경비병', body: '멈춰!' }] },
    ] });
    store.replaceProject(project);
  });
  // All feature entry/actions below use visible controls in the booted editor.
  await openTool(page, 'library');
  await page.getByTestId('feature16-template-name').fill('마을 인사');
  await page.getByTestId('feature16-template-tags').fill('마을, 대사');
  await page.getByTestId('feature16-template-body').fill('{{인물}}이 {{장소}}에서 인사한다.');
  await page.getByTestId('feature16-template-save').click();
  await page.getByTestId('feature16-library-search').fill('대사');
  await expect(page.getByTestId('feature16-template-item')).toHaveCount(1);
  await page.getByTestId('feature16-template-item').click();
  await page.getByTestId('feature16-template-name').fill('따뜻한 마을 인사');
  await page.getByTestId('feature16-template-save').click();
  await page.getByTestId('feature16-slot-0').fill('안내인');
  await page.getByTestId('feature16-slot-1').fill('광장');
  await expect(page.getByTestId('feature16-template-preview')).toHaveText('안내인이 광장에서 인사한다.');
  await page.getByTestId('feature16-modal').screenshot({ path: `${output}/01-library.png` });
  await page.getByTestId('feature16-template-apply').click();
  await expect(page.getByTestId('ai-input')).toHaveValue('안내인이 광장에서 인사한다.');
  // Real project serializer/load path, no remote writes; UI must find the persisted template again.
  await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { serialize, deserialize } = await import('/src/project/io.ts');
    store.replaceProject(deserialize(serialize(store.getCurrent())));
  });
  await openTool(page, 'library');
  await expect(page.getByTestId('feature16-template-item')).toContainText('따뜻한 마을 인사');
  await page.getByTestId('feature16-template-item').click();
  await page.getByTestId('feature16-template-delete').click();
  await expect(page.getByTestId('feature16-template-delete')).toHaveText('삭제 확인');
  await page.getByTestId('feature16-template-delete').click();
  await expect(page.getByTestId('feature16-template-item')).toHaveCount(0);
  await page.getByTestId('feature16-tab-dialogue').click();
  await expect(page.getByTestId('feature16-dialogue-count')).toContainText('전체 5개');
  await page.getByTestId('feature16-style-rules').fill('안내인은 존댓말을 사용한다.');
  await page.getByTestId('feature16-style-save').click();
  await page.getByTestId('feature16-review-structure').click();
  await expect(page.getByTestId('feature16-review-findings')).toContainText('앞뒤에 공백');
  await page.getByTestId('feature16-dialogue-speaker').selectOption('안내인');
  let reject = false;
  await page.route('**/chat/completions**', async route => {
    if (reject) { await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":{"message":"provider authentication rejected"}}' }); return; }
    const body = route.request().postDataJSON();
    expect(body.tools).toBeUndefined();
    const user = body.messages.find((message: { role: string }) => message.role === 'user').content;
    const source = JSON.parse(user.split('검토할 원문:\n')[1]);
    expect(source).toHaveLength(1);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: JSON.stringify({ findings: [{ rowId: source[0].id, quote: '안녕', message: '안내인은 존댓말을 사용한다는 규칙과 다릅니다. 안녕하세요로 바꾸세요.' }] }) }, finish_reason: 'stop' }] }) });
  });
  await page.getByTestId('feature16-review-llm').click();
  await expect(page.getByTestId('feature16-review-status')).toContainText('LLM 문체 검토 완료', { timeout: 15000 });
  await expect(page.getByTestId('feature16-review-findings')).toContainText('LLM 문체 지적');
  await page.getByTestId('feature16-modal').screenshot({ path: `${output}/02-dialogue-review.png` });
  reject = true;
  await page.getByTestId('feature16-review-llm').click();
  await expect(page.getByTestId('feature16-review-status')).toContainText('LLM 검토 실패', { timeout: 15000 });
  await page.getByTestId('feature16-tab-inspector').click();
  await expect(page.getByTestId('feature16-inspection-content')).toContainText('Chat completions');
  await page.getByTestId('feature16-inspection-content').getByText(/^messages ·/u).click();
  await expect(page.getByTestId('feature16-inspection-content')).toContainText('안내인은 존댓말');
  await page.getByTestId('feature16-modal').screenshot({ path: `${output}/03-inspector.png` });
  await page.getByTestId('feature16-inspection-clear').click();
  await expect(page.getByTestId('feature16-inspection-content')).toContainText('관측한 요청이 없습니다');
  await page.getByTestId('feature16-tab-dialogue').click();
  await page.getByTestId('feature16-dialogue-speaker').selectOption('경비병');
  await page.getByTestId('feature16-dialogue-source').click();
  await expect(page.getByTestId('event-editor-modal')).toBeVisible();
  await expect.poll(() => page.evaluate(async () => (await import('/src/editor/editorState.ts')).editorState.get().selectedEventPageId)).toBe('f16-second');
  await page.getByTestId('event-editor-modal').screenshot({ path: `${output}/04-source-page.png` });
});
