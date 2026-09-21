import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatCompletion, type AiConfig } from '@/ai/llmClient';
import { runPiAgentViaCompanion } from '@/ai/piAgent/client';
import { createBlankProject } from '@/project/defaults';
import { clearPromptInspection, inspectPromptPayload, latestPromptInspection } from '@/ai/authoring/promptInspection';
import type { PiAgentEvent } from '@/ai/piAgent/protocol';
const config: AiConfig = { authMode: 'apiKey', baseUrl: 'https://example.invalid/v1', model: 'minimax/minimax-m3', liteModel: 'minimax/minimax-m3', apiKey: 'private-test-value', maxToolCalls: 8, maxTokens: 1024 };
afterEach(() => { clearPromptInspection(); vi.unstubAllGlobals(); });
describe('feature16 transport boundary integration', () => {
  it('observes the actual outgoing common-client body even on provider rejection', async () => {
    let sent: Record<string, unknown> | undefined;
    vi.stubGlobal('fetch', vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return new Response('{"error":{"message":"unauthorized"}}', { status: 401 });
    }));
    await expect(chatCompletion(config, { messages: [{ role: 'user', content: 'actual request private-test-value' }], stream: false, disableTransientRetry: true })).rejects.toThrow();
    expect(sent?.messages).toEqual([{ role: 'user', content: 'actual request private-test-value' }]);
    const snapshot = latestPromptInspection();
    expect(snapshot?.sections.map(section => section.name)).toEqual(Object.keys(sent!));
    expect(JSON.stringify(snapshot)).toContain('actual request [REDACTED]');
    expect(JSON.stringify(snapshot)).not.toContain('private-test-value');
  });
  it('does not resurrect an in-flight worker snapshot after lifecycle clear', async () => {
    const project = createBlankProject();
    const snapshot = inspectPromptPayload({ messages: 'retired request' }, 'Pi', 'model');
    let resolveResponse!: (response: Response) => void;
    const response = new Promise<Response>(resolve => { resolveResponse = resolve; });
    const pending = runPiAgentViaCompanion({ provider: 'openai-codex', task: 'inspect', mapIds: [], project }, { fetchImpl: async () => response });
    clearPromptInspection();
    resolveResponse(new Response(JSON.stringify({ type: 'prompt_inspection', snapshot }) + '\n' + JSON.stringify({ type: 'done', project, changedKeys: [], stats: { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 } }) + '\n'));
    await pending;
    expect(latestPromptInspection()).toBeNull();
  });
  it('accepts actual worker snapshots through nested team events but excludes them from audit callbacks', async () => {
    const project = createBlankProject();
    const snapshot = inspectPromptPayload({ system: 'assembled worker system', tools: [{ name: 'find_events' }], messages: [{ role: 'user', content: 'inspect' }] }, 'Pi provider payload', 'model');
    const event: PiAgentEvent = { type: 'agent_event', agentId: 'writer', event: { type: 'prompt_inspection', snapshot } };
    const done = { type: 'done', project, ok: true, summary: 'done', changedKeys: [], calls: [], stats: { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 } };
    const onEvent = vi.fn();
    const fetchImpl = vi.fn(async () => new Response([JSON.stringify(event), JSON.stringify(done)].join('\n') + '\n'));
    await runPiAgentViaCompanion({ provider: 'openai-codex', task: 'inspect', mapIds: [], project }, { fetchImpl, onEvent });
    expect(latestPromptInspection()).toEqual(snapshot);
    expect(onEvent.mock.calls.map(([event]) => event.type)).toEqual(['done']);
  });
});
