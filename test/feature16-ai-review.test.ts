import { afterEach, describe, expect, it, vi } from 'vitest';
import { reviewDialogue, REVIEW_CHAR_LIMIT } from '@/ai/authoring/dialogueReview';
import { chatCompletion } from '@/ai/llmClient';
import { isAssistantEndpointReady } from '@/ai/assistantEndpoint';
import type { DialogueRow } from '@/ai/authoring/dialogueInventory';
vi.mock('@/ai/llmClient', () => ({ chatCompletion: vi.fn() }));
vi.mock('@/ai/assistantEndpoint', () => ({ resolveSurfaceAiConfig: vi.fn(() => ({ model: 'configured-model' })), isAssistantEndpointReady: vi.fn(() => true) }));
const rows: DialogueRow[] = [{ id: 'source', mapId: 'map', eventId: 'event', pageId: 'page', path: '1', location: '마을 / 안내인 / 인사', speaker: '안내인', kind: 'text', text: '안녕하세요.' }];
describe('feature16 actual style review orchestration', () => {
  afterEach(() => { vi.clearAllMocks(); vi.mocked(isAssistantEndpointReady).mockReturnValue(true); });
  it('sends authored rules and exact filtered source to the common client without writing tools', async () => {
    vi.mocked(chatCompletion).mockResolvedValue({ message: { role: 'assistant', content: JSON.stringify({ findings: [{ rowId: 'source', quote: '안녕하세요.', message: '인사 규칙과 다릅니다.' }] }) }, finishReason: 'stop' });
    const controller = new AbortController();
    expect((await reviewDialogue(rows, '인사는 안녕하십니까로 쓴다.', controller.signal))[0].source).toBe('llm');
    const request = vi.mocked(chatCompletion).mock.calls[0][1];
    expect(request.signal).toBe(controller.signal); expect(request.tools).toBeUndefined();
    expect(JSON.stringify(request.messages)).toContain('안녕하십니까'); expect(JSON.stringify(request.messages)).toContain('source');
  });
  it('surfaces provider rejection and refuses missing rules, oversize input and truncated output', async () => {
    const signal = new AbortController().signal;
    await expect(reviewDialogue(rows, '', signal)).rejects.toThrow('규칙');
    await expect(reviewDialogue([{ ...rows[0], text: 'x'.repeat(REVIEW_CHAR_LIMIT + 1) }], 'rules', signal)).rejects.toThrow('60,000');
    vi.mocked(isAssistantEndpointReady).mockReturnValue(false);
    await expect(reviewDialogue(rows, 'rules', signal)).rejects.toThrow('연결');
    vi.mocked(isAssistantEndpointReady).mockReturnValue(true);
    vi.mocked(chatCompletion).mockRejectedValue(new Error('provider 401'));
    await expect(reviewDialogue(rows, 'rules', signal)).rejects.toThrow('provider 401');
    vi.mocked(chatCompletion).mockResolvedValue({ message: { role: 'assistant', content: '{}' }, finishReason: 'length' });
    await expect(reviewDialogue(rows, 'rules', signal)).rejects.toThrow('잘렸');
  });
});
