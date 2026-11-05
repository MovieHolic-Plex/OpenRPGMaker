// generate_item_icon 실행 — 도구 호출과 실행 끝 저절로 그리기가 같은 함수를 쓴다(scripts/lib/piAgentRuntime.ts).
// 그림은 편집기의 그림 경로(generateOpeningImage 브로커, data.itemIcon)로 한 장씩 받고, 등록·연결은 보통 쓰기 도구(upsert_resource + upsert_*)로 한다.
// 실패하면 대신 쓴 그림을 그대로 두고 시도 횟수를 올린다 — 그렸다고 보고하지 않는다.
import type { Project } from '../../src/project/types';
import type { CinematicStillResult } from '../../src/editor/openingImageGeneration';
import type { ToolContext, ToolResult } from '../../src/editor/tools/types';
import {
  ITEM_ICON_CONCURRENCY, iconRecordOf, placeholderKey, type IconCollection, type ItemIconTarget,
} from '../../src/editor/tools/itemIconTools';

const UPSERT: Readonly<Record<IconCollection, readonly [string, string]>> = {
  items: ['upsert_item', 'item'], equipment: ['upsert_equipment', 'equipment'], skills: ['upsert_skill', 'skill'], states: ['upsert_state', 'state'],
};

export interface ItemIconOutcome {
  readonly target: ItemIconTarget;
  readonly ok: boolean;
  readonly resourceId?: string;
  readonly reason?: string;
  readonly dataUrl?: string;
}

export interface DrawItemIconsDeps {
  readonly ctx: ToolContext;
  readonly generate: (project: Project, args: Record<string, unknown>, signal?: AbortSignal) => Promise<CinematicStillResult>;
  readonly runTool: (ctx: ToolContext, name: string, args: Record<string, unknown>) => ToolResult;
  readonly progress?: (summary: string) => void;
  readonly signal?: AbortSignal;
  /** 이 시각(ms) 이후에는 새 그림을 시작하지 않는다 — 실행 시한 안에 끝내기 위해. */
  readonly deadline?: number;
}

function bumpAttempt(ctx: ToolContext, target: ItemIconTarget, reason: string): void {
  const marks = ctx.project.meta.oprnPlaceholderIcons;
  const key = placeholderKey(target.collection, target.id);
  if (!marks?.[key]) return;
  ctx.project = { ...ctx.project, meta: { ...ctx.project.meta, oprnPlaceholderIcons: { ...marks, [key]: { ...marks[key]!, attempts: marks[key]!.attempts + 1, reason: reason.slice(0, 240) } } } };
}

/** 대상마다 한 장 그려 등록·연결한다. 결과는 대상 순서 그대로. */
export async function drawItemIcons(targets: readonly ItemIconTarget[], deps: DrawItemIconsDeps): Promise<ItemIconOutcome[]> {
  const { ctx } = deps;
  const outcomes: ItemIconOutcome[] = new Array(targets.length);
  let next = 0, done = 0;
  const worker = async (): Promise<void> => {
    while (next < targets.length) {
      const index = next++;
      const target = targets[index]!;
      if (deps.signal?.aborted || (deps.deadline !== undefined && Date.now() > deps.deadline)) {
        outcomes[index] = { target, ok: false, reason: '시간이 모자라 그리지 못했습니다' };
        continue;
      }
      const before = iconRecordOf(ctx.project, target.collection, target.id)?.iconResourceId;
      let still: CinematicStillResult;
      try {
        still = await deps.generate(ctx.project, { prompt: `${target.name} icon`, name: `${target.name} 아이콘`, itemIcon: target }, deps.signal);
      } catch (error) {
        if (deps.signal?.aborted) throw error;
        still = { ok: false, code: 'image-generation-failed', summary: error instanceof Error ? error.message : String(error) };
      }
      done += 1;
      if (!still.ok) {
        bumpAttempt(ctx, target, still.summary);
        outcomes[index] = { target, ok: false, reason: still.summary };
        deps.progress?.(`아이콘 ${done}/${targets.length} — 「${target.name}」 실패`);
        continue;
      }
      // 그리는 사이에 사용자·조수가 아이콘을 직접 바꿨으면 그 결정을 덮지 않는다.
      const record = iconRecordOf(ctx.project, target.collection, target.id);
      if (!record || (record.iconResourceId ?? '') !== (before ?? '')) {
        outcomes[index] = { target, ok: false, reason: '그리는 동안 레코드의 아이콘이 바뀌어 새 그림을 붙이지 않았습니다' };
        deps.progress?.(`아이콘 ${done}/${targets.length} — 「${target.name}」 건너뜀`);
        continue;
      }
      const registered = deps.runTool(ctx, 'upsert_resource', { resource: { id: still.resourceId, name: still.name, kind: 'picture', dataUrl: still.dataUrl } });
      const [tool, field] = UPSERT[target.collection];
      const linked = registered.ok ? deps.runTool(ctx, tool, { [field]: { id: target.id, iconResourceId: still.resourceId } }) : registered;
      if (!linked.ok) {
        bumpAttempt(ctx, target, linked.summary);
        outcomes[index] = { target, ok: false, reason: linked.summary };
      } else {
        outcomes[index] = { target, ok: true, resourceId: still.resourceId, dataUrl: still.dataUrl };
      }
      deps.progress?.(`아이콘 ${done}/${targets.length} — 「${target.name}」 ${linked.ok ? '그려 붙임' : '연결 실패'}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(ITEM_ICON_CONCURRENCY, targets.length) }, worker));
  return outcomes;
}

export function itemIconSummary(outcomes: readonly ItemIconOutcome[]): string {
  const made = outcomes.filter((o) => o.ok), failed = outcomes.filter((o) => !o.ok);
  return [
    made.length ? `이름에 맞는 아이콘 ${made.length}개를 새로 그려 붙였습니다: ${made.map((o) => `${o.target.name}(${o.resourceId})`).join(', ')}.` : '',
    failed.length ? `${failed.length}개는 그리지 못해 대신 쓴 그림이 그대로입니다(다음에 다시 그립니다): ${failed.map((o) => `${o.target.name} — ${o.reason}`).join(' / ')}.` : '',
  ].filter(Boolean).join(' ');
}
