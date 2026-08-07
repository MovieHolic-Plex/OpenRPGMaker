// aiQueueController — 입력 큐(pendingSends) 분리 (aiChatPanel 분해 2/3)
export interface QueueController {
  readonly pending: string[];
  enqueue(text: string): void;
  drain(next: (text: string) => Promise<void>): void;
  label(): string;
  isEmpty(): boolean;
}

export function createQueueController(onChange: () => void): QueueController {
  const pending: string[] = [];
  return {
    get pending() { return pending; },
    enqueue(text: string) { pending.push(text); onChange(); },
    drain(next) {
      const copy = [...pending];
      pending.length = 0;
      onChange();
      for (const t of copy) void next(t);
    },
    label() {
      return pending.length > 0 ? `대기 ${pending.length}건 · 입력 1건 + 대기열 ${pending.length}건 — Enter 연타는 순서대로 전송됩니다` : "";
    },
    isEmpty() { return pending.length === 0; },
  };
}
