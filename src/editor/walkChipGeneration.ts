// src/editor/walkChipGeneration.ts
/**
 * 조수 도구 generate_walk_chip 의 편집기 쪽 — 외형 연결(쓰기 도구)이 끝난 뒤 공방 작업 줄에 char-gen 「글로」 작업을 세운다.
 * 작업 줄이 호스트 상태를 읽고, 다 그리면 묶음을 넣고(afterPackInstalled) 그 외형의 걷기 칩을 새 칩으로 바꾼다.
 * 조수는 기다리지 않는다 — 생성은 수 분 걸리고, 그동안 외형에는 임시 칩이 서 있다.
 * 두 길: 브라우저 세션(assistantSession 분기 → startWalkChipFromAssistant) · Pi 워커(render_request → startWalkChipJob).
 */
import type { ToolResult } from "@/editor/tools/types";
import { store } from "@/project/store";

/** 작업 줄에 세운다 -> 작업 id. 호스트에 보내지 못하면 그 이유로 던진다. */
export async function startWalkChipJob(input: { readonly appearanceId: string; readonly description: string; readonly name?: string }): Promise<string> {
  const name = input.name || store.getCurrent().database.characterAppearances?.find((record) => record.id === input.appearanceId)?.name || input.description.slice(0, 24);
  const { workshopQueue } = await import("@/editor/workshop/queue/workshopQueue");
  const job = await workshopQueue().enqueueRemote({ kind: "char-gen", mode: "text", text: input.description, appearanceId: input.appearanceId, title: name, source: "assistant" });
  if (job.error) throw new Error(job.error);
  return job.id;
}

export async function startWalkChipFromAssistant(linked: ToolResult): Promise<ToolResult> {
  const data = linked.data as { appearanceId?: string; description?: string } | undefined;
  const appearanceId = data?.appearanceId;
  const description = data?.description;
  if (!linked.ok || !appearanceId || !description) return linked;
  try {
    const jobId = await startWalkChipJob({ appearanceId, description });
    return {
      ...linked,
      summary: `${linked.summary} 공방 작업 줄에서 걷기 칩을 만드는 중이다(보통 5~12분). 다 되면 외형의 칩이 저절로 바뀌고 이은 배우·이벤트도 함께 바뀐다 — 기다리지 말고 다음 작업을 계속한다.`,
      data: { ...data, status: "generating", jobId },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ...linked,
      summary: `${linked.summary} 걷기 칩 생성은 시작하지 못했습니다(${reason}). 외형에는 지금 칩이 그대로 있다 — 사용자에게 알리고 다음 작업을 계속한다.`,
      warnings: [...(linked.warnings ?? []), `walk-chip-not-started: ${reason}`],
      data: { ...data, status: "failed", error: reason },
    };
  }
}
