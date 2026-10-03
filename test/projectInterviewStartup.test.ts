import { beforeEach, expect, it, vi } from 'vitest';
import { prepareProjectInterviewStartup } from '@/editor/projectInterviewStartup';
import { store } from '@/project/store';
import { setPendingAiBootIntent } from '@/editor/aiBootIntent';
import { isAssistantEndpointReady } from '@/ai/assistantEndpoint';
import { interviewBrief } from './helpers/gameDesignBrief';
import { configureProjectInterviewBootPreparation } from '@/editor/projectInterviewBootPreparation';
import type { Project } from '@/project/types';
vi.mock('@/project/store', () => ({store:{getCurrent:vi.fn(),getProjectIdentity:vi.fn(),update:vi.fn(),replace:vi.fn(),flush:vi.fn()}}));
vi.mock('@/editor/aiBootIntent', () => ({setPendingAiBootIntent:vi.fn()}));
vi.mock('@/ai/assistantEndpoint', () => ({resolveSurfaceAiConfig:vi.fn(()=>({})),isAssistantEndpointReady:vi.fn(()=>true)}));
vi.mock('@/editor/panels/aiConnectionStatus', () => ({getAiConnectionStatus:vi.fn(()=>({}))}));
vi.mock('@/project/playableSegment', () => ({withVerifiedPlayableSegment:vi.fn(()=>null)}));
vi.mock('@/util/toast', () => ({toast:vi.fn()}));
let project: Project;
beforeEach(()=>{
 vi.clearAllMocks();
 configureProjectInterviewBootPreparation(async()=>{});
 project={system:{},gameDesignBrief:{...interviewBrief('story-cutscene'),generationPending:true}} as Project;
 vi.mocked(store.getCurrent).mockImplementation(()=>project);
 vi.mocked(store.getProjectIdentity).mockReturnValue({kind:'remote',id:'qa-new-folder'});
 vi.mocked(store.update).mockImplementation(fn=>{fn(project);});
 vi.mocked(store.flush).mockResolvedValue({kind:'saved'} as Awaited<ReturnType<typeof store.flush>>);
 vi.mocked(isAssistantEndpointReady).mockReturnValue(true);
});
it('publishes model-only tasks after canonical save, with a short display and a one-turn team option',async()=>{
 vi.mocked(store.flush).mockImplementation(async()=>{
  expect(setPendingAiBootIntent).not.toHaveBeenCalled();
  expect(project.gameDesignBrief?.generationPending).toBeUndefined();
  return {kind:'saved'} as Awaited<ReturnType<typeof store.flush>>;
 });
 await prepareProjectInterviewStartup();
 expect(setPendingAiBootIntent).toHaveBeenCalledOnce();
 const [prompt,opts]=vi.mocked(setPendingAiBootIntent).mock.calls[0]!;
 expect(prompt).toContain('"id":"P03"');
 expect(opts).toMatchObject({autoSend:true,team:true});
 expect(opts?.displayText).not.toContain('"id":"P03"');
 await prepareProjectInterviewStartup();
 expect(setPendingAiBootIntent).toHaveBeenCalledOnce();
});
it('waits for late boot references before claiming, saving or publishing the brief',async()=>{
 let ready!: () => void;
 configureProjectInterviewBootPreparation(()=>new Promise(resolve=>{ready=resolve;}));
 const startup=prepareProjectInterviewStartup();await Promise.resolve();
 expect(store.flush).not.toHaveBeenCalled();expect(setPendingAiBootIntent).not.toHaveBeenCalled();
 expect(project.gameDesignBrief?.generationPending).toBe(true);
 ready();await startup;
 expect(store.flush).toHaveBeenCalledOnce();expect(setPendingAiBootIntent).toHaveBeenCalledOnce();
});
it('does not claim or save the old brief when projects switch during boot preparation', async () => {
 let ready!: () => void;
 configureProjectInterviewBootPreparation(() => new Promise(resolve => { ready = resolve; }));
 const startup = prepareProjectInterviewStartup();
 await Promise.resolve();
 vi.mocked(store.getProjectIdentity).mockReturnValue({ kind: 'remote', id: 'other-folder' });
 ready();
 await startup;
 expect(store.update).not.toHaveBeenCalled();
 expect(store.flush).not.toHaveBeenCalled();
 expect(setPendingAiBootIntent).not.toHaveBeenCalled();
});
it('keeps the retry marker and never launches the assistant when saving fails',async()=>{
 vi.mocked(store.flush).mockRejectedValue(new Error('disk full'));
 await prepareProjectInterviewStartup();
 expect(project.gameDesignBrief?.generationPending).toBe(true);
 expect(setPendingAiBootIntent).not.toHaveBeenCalled();
});
it('does not launch a saved old brief into a different project opened during the save',async()=>{
 vi.mocked(store.flush).mockImplementation(async()=>{
  vi.mocked(store.getProjectIdentity).mockReturnValue({kind:'remote',id:'other-folder'});
  return {kind:'saved'} as Awaited<ReturnType<typeof store.flush>>;
 });
 await prepareProjectInterviewStartup();
 expect(setPendingAiBootIntent).not.toHaveBeenCalled();
});
it('prefills instead of auto-sending when disconnected, retaining internal tasks for the later send',async()=>{
 vi.mocked(isAssistantEndpointReady).mockReturnValue(false);
 await prepareProjectInterviewStartup();
 expect(setPendingAiBootIntent).toHaveBeenCalledWith(expect.stringContaining('"id":"P03"'),expect.objectContaining({autoSend:false,team:true}));
});
it('cannot publish two requests when startup is entered again while its save is pending',async()=>{
 let saved!: (value: Awaited<ReturnType<typeof store.flush>>) => void;
 vi.mocked(store.flush).mockReturnValue(new Promise(resolve=>{saved=resolve;}));
 const first=prepareProjectInterviewStartup();
 await prepareProjectInterviewStartup();
 saved({kind:'saved'} as Awaited<ReturnType<typeof store.flush>>);await first;
 expect(store.flush).toHaveBeenCalledOnce();expect(setPendingAiBootIntent).toHaveBeenCalledOnce();
});
