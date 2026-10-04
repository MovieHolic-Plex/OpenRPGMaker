import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ revision: 'one', read: vi.fn(), refs: vi.fn(),
  install: vi.fn(), spatial: vi.fn(), close: vi.fn() }));
vi.mock('node:fs', () => ({ existsSync: () => true }));
vi.mock('node:sqlite', () => ({ DatabaseSync: class {
  prepare() { return { all: () => [{ id: 'library', revision: state.revision }] }; }
  close() { state.close(); }
} }));
vi.mock('../scripts/lib/sharedContentSqlite', () => ({
  sharedContentFile: () => '/catalog.sqlite', readSharedContent: state.read,
}));
vi.mock('../scripts/lib/sharedTileReferencesSqlite', () => ({ readSharedTileReferences: state.refs }));
vi.mock('@/project/sharedContent', () => ({ installSharedContent: state.install }));
vi.mock('@/project/sharedSpatialReferences', () => ({ installSharedSpatialReferences: state.spatial }));

describe('worker catalog preparation', () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks(); state.revision = 'one';
    state.read.mockReturnValue({ revision: 'one', libraries: {} });
    state.refs.mockReturnValue({ spatial: {} });
    state.install.mockResolvedValue(undefined);
  });
  it('team members reuse the installed revision, and a new revision reloads it', async () => {
    const { preparePiWorkerSharedContent: prepare } = await import('../scripts/lib/piWorkerSharedContent');
    await prepare(); await prepare();
    expect(state.read).toHaveBeenCalledTimes(1);
    expect(state.refs).toHaveBeenCalledTimes(1);
    state.revision = 'two'; await prepare();
    expect(state.read).toHaveBeenCalledTimes(2);
    expect(state.install).toHaveBeenCalledTimes(2);
    expect(state.close).toHaveBeenCalledTimes(3);
  });
  it('concurrent team members join one installation', async () => {
    let finish!: () => void;
    state.install.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const { preparePiWorkerSharedContent: prepare } = await import('../scripts/lib/piWorkerSharedContent');
    const first = prepare(), second = prepare();
    expect(state.read).toHaveBeenCalledTimes(1);
    finish(); await Promise.all([first, second]);
    expect(state.install).toHaveBeenCalledTimes(1);
  });
  it('failed installations remain retryable', async () => {
    state.install.mockRejectedValueOnce(new Error('catalog unavailable'));
    const { preparePiWorkerSharedContent: prepare } = await import('../scripts/lib/piWorkerSharedContent');
    await expect(prepare()).rejects.toThrow('catalog unavailable');
    await prepare();
    expect(state.read).toHaveBeenCalledTimes(2);
  });
});
