// src/editor/walkChipGeneration.ts
/**
 * 조수 도구 generate_walk_chip 의 편집기 쪽 — 외형 연결(쓰기 도구)이 끝난 뒤 공방 작업 줄에 char-gen 「글로」 작업을 세운다.
 * 작업 줄이 호스트 상태를 읽고, 다 그리면 묶음을 넣고(afterPackInstalled) 그 외형의 걷기 칩을 새 칩으로 바꾼다.
 * 조수는 기다리지 않는다 — 생성은 수 분 걸리고, 그동안 외형에는 임시 칩이 서 있다.
 */
import type { ToolResult } from "@/editor/tools/types";
import { store } from "@/project/store";

export async function startWalkChipFromAssistant(linked: ToolResult): Promise<ToolResult> {
  const data = linked.data as { appearanceId?: string; description?: string } | undefined;
  const appearanceId = data?.appearanceId;
  const description = data?.description;
  if (!linked.ok || !appearanceId || !description) return linked;
  const name = store.getCurrent().database.characterAppearances?.find((record) => record.id === appearanceId)?.name ?? description.slice(0, 24);
  const { workshopQueue } = await import("@/editor/workshop/queue/workshopQueue");
  const job = await workshopQueue().enqueueRemote({ kind: "char-gen", mode: "text", text: description, appearanceId, title: name, source: "assistant" });
  if (job.error) {
    return {
      ...linked,
      summary: `${linked.summary} 걷기 칩 생성은 시작하지 못했습니다(${job.error}). 외형에는 지금 칩이 그대로 있다 — 사용자에게 알리고 다음 작업을 계속한다.`,
      warnings: [...(linked.warnings ?? []), `walk-chip-not-started: ${job.error}`],
      data: { ...data, status: "failed", error: job.error },
    };
  }
  return {
    ...linked,
    summary: `${linked.summary} 공방 작업 줄에서 「${name}」 걷기 칩을 만드는 중이다(보통 5~12분). 다 되면 외형의 칩이 저절로 바뀌고 이은 배우·이벤트도 함께 바뀐다 — 기다리지 말고 다음 작업을 계속한다.`,
    data: { ...data, status: "generating", jobId: job.id },
  };
}
