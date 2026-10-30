// H6 — 모델 호출 전 문맥 정리(할 일 고리 갈고리).
// 왜: terra boss-room r3 는 15분·46호출 동안 앞 도구 결과(던전 재료·이벤트 전문·DB 목록 수만 자)를 매 호출 다시 읽었고,
// 뒤로 갈수록 할 일과 마지막 실패를 놓쳐 같은 이벤트를 다시 읽거나(get_event 없는 id) 다른 항목으로 흘렀다.
//   ① 오래된 도구 결과 줄이기 — 마지막 KEEP 개는 그대로, 그보다 앞은 글을 앞부분만 남기고 그림은 뺀다.
//      줄이는 경계는 STEP 개 단위로만 옮겨 제공자 프롬프트 캐시 접두부가 호출마다 깨지지 않게 한다.
//   ② 상태 카드 — 그 호출의 마지막 메시지 끝에 짧은 카드(할 일 표·지금 할 것·마지막 실패)를 붙인다. 기록에는 남지 않는다.
// 메시지는 바꾸지 않고 사본을 돌려준다(transformContext 는 호출마다 부르고 결과를 저장하지 않는다).

type Part = { type?: string; text?: string; [k: string]: unknown };
type Msg = { role?: string; content?: unknown; [k: string]: unknown };

export const CONTEXT_KEEP_RESULTS = 10;
export const CONTEXT_TRIM_STEP = 8;
export const CONTEXT_TRIM_CHARS = 700;

/** 메시지 목록 사본: 오래된 도구 결과를 줄이고(경계는 STEP 단위), 카드를 마지막 메시지에 붙인다. 줄인 결과 수와 줄인 글자 수를 같이. */
export function trimContext(messages: readonly unknown[], card?: string): { messages: unknown[]; trimmed: number; savedChars: number } {
  const resultIdx = messages.map((m, i) => ((m as Msg)?.role === "toolResult" ? i : -1)).filter((i) => i >= 0);
  const over = resultIdx.length - CONTEXT_KEEP_RESULTS;
  const cutCount = over > 0 ? Math.floor(over / CONTEXT_TRIM_STEP) * CONTEXT_TRIM_STEP : 0;
  const cut = new Set(resultIdx.slice(0, cutCount));
  let saved = 0;
  let trimmed = 0;
  const out = messages.map((m, i) => {
    if (!cut.has(i)) return m;
    const msg = m as Msg;
    if (!Array.isArray(msg.content)) return m;
    let changed = false;
    const parts = (msg.content as Part[]).map((p) => {
      if (p?.type === "image") { changed = true; saved += String((p as { data?: string }).data ?? "").length; return { type: "text", text: "(earlier image — omitted)" }; }
      if (p?.type === "text" && typeof p.text === "string" && p.text.length > CONTEXT_TRIM_CHARS) {
        changed = true; saved += p.text.length - CONTEXT_TRIM_CHARS;
        return { ...p, text: `${p.text.slice(0, CONTEXT_TRIM_CHARS)}…(earlier result — trimmed; read it again if needed)` };
      }
      return p;
    });
    if (!changed) return m;
    trimmed += 1;
    return { ...msg, content: parts };
  });
  if (card && out.length) {
    const last = out[out.length - 1] as Msg;
    if (last && (last.role === "user" || last.role === "toolResult")) {
      const content = typeof last.content === "string" ? [{ type: "text", text: last.content }] : Array.isArray(last.content) ? [...(last.content as Part[])] : [];
      content.push({ type: "text", text: card });
      out[out.length - 1] = { ...last, content };
    }
  }
  return { messages: out, trimmed, savedChars: saved };
}
