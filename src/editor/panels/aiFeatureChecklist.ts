// 요청 특징 확인표 — 조수가 짓기 전에 적은 항목(set_feature_checklist)과 실행기의 1배 확인 바퀴별 결과를 패널에 짧게 보인다.
// 워커가 흘리는 execution_status `feature_checklist`(data = FeatureChecklistSnapshot, featureReview.ts)를 받아 같은 상자를 고쳐 쓴다.
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import type { FeatureChecklistSnapshot, FeatureState } from "@/ai/piAgent/featureReview";
import { el } from "@/util/dom";

const MARK: Record<FeatureState, string> = { pending: "□", pass: "✓", fail: "✗", unjudged: "?" };

export interface FeatureChecklistView {
  /** 실행 이벤트를 흘려 넣는다. 확인표 사건이면 상자를 만들거나 고친다. */
  event(event: PiAgentEvent): void;
}

export interface FeatureChecklistViewOptions {
  /** 「다듬기」 단추 — 확인이 끝났는데 안 읽히는 항목이 남았을 때 보인다. 누르면 패널이 다듬기 실행(request.polish)을 보낸다. */
  readonly onPolish?: () => void;
}

export function createFeatureChecklistView(mount: (element: HTMLElement) => void, options: FeatureChecklistViewOptions = {}): FeatureChecklistView {
  let box: HTMLDetailsElement | null = null;
  let progress = "";
  let lastSnapshot: FeatureChecklistSnapshot | null = null;
  const render = (snapshot: FeatureChecklistSnapshot) => {
    if (!snapshot.items.length) return;
    const fresh = !box;
    box ??= el("details", { class: "ai-chat-bubble ai-chat-system ai-feature-checklist", dataset: { testid: "ai-feature-checklist" } }) as HTMLDetailsElement;
    box.open = true;
    const rounds = snapshot.rounds;
    const last = rounds[rounds.length - 1];
    const states = (id: string) => rounds.map((r) => r.verdicts.find((v) => v.id === id)?.state ?? "pending");
    const passed = last ? last.verdicts.filter((v) => v.state === "pass").length : 0;
    const title = last
      ? `요청 특징 확인 — ${last.round}바퀴 ${snapshot.final ? "끝" : "중"} · 읽힘 ${passed}/${snapshot.items.length}`
      : `요청 특징 확인표 · ${snapshot.items.length}항목${snapshot.source === "derived" ? " (요청에서 뽑음)" : ""}`;
    box.dataset.state = !last ? "pending" : last.verdicts.every((v) => v.state === "pass") ? "pass" : snapshot.final ? "fail" : "running";
    const list = el("ul", { class: "ai-feature-checklist-items" });
    for (const item of snapshot.items) {
      const history = states(item.id);
      const now = history[history.length - 1] ?? "pending";
      const verdict = last?.verdicts.find((v) => v.id === item.id);
      const li = el("li", { dataset: { state: now } });
      li.append(
        el("span", { class: "ai-feature-checklist-mark", text: MARK[now] }),
        el("span", { class: "ai-feature-checklist-text", text: item.text }),
        ...(history.length > 1 ? [el("span", { class: "ai-feature-checklist-history", text: history.map((s) => MARK[s]).join("") , attrs: { title: "바퀴별 결과" } })] : []),
      );
      if (verdict && verdict.state !== "pass" && verdict.why) li.append(el("div", { class: "ai-feature-checklist-why", text: verdict.why }));
      list.append(li);
    }
    const unresolved = !!last && snapshot.final === true && last.verdicts.some((v) => v.state !== "pass");
    const polishButton = unresolved && options.onPolish
      ? el("button", { class: "ai-feature-checklist-polish", text: "다듬기 (최대 30분)", dataset: { testid: "ai-feature-polish" },
        attrs: { type: "button", title: "1배 확인·독립 비평→고치기를 더 오래 돌린다. 진행 중 중지 단추로 멈추면 그때까지 고친 것은 남는다." } })
      : null;
    polishButton?.addEventListener("click", () => { polishButton.disabled = true; polishButton.textContent = "다듬기 시작함"; options.onPolish?.(); });
    box.replaceChildren(el("summary", { text: title }), list,
      ...(progress && !snapshot.final ? [el("p", { class: "ai-feature-checklist-progress", text: progress })] : []),
      ...(last ? [el("p", { class: "ai-feature-checklist-note", text: `1배 그림 ${last.imagesSent}장 · 판정자가 받은 그림 ${last.imagesSeen ?? "?"}장 · 조수가 아닌 별도 판정·비평 호출` })] : []),
      ...(polishButton ? [polishButton] : []));
    if (fresh) mount(box);
  };
  return {
    event(raw) {
      let event = raw;
      while (event.type === "agent_event") event = event.event;
      if (event.type !== "execution_status") return;
      if (event.name === "feature_review.repair" || event.name === "feature_review.judging") {
        progress = event.summary;
        if (lastSnapshot) render(lastSnapshot);
        return;
      }
      if (event.name !== "feature_checklist" || !event.data) return;
      lastSnapshot = event.data as FeatureChecklistSnapshot;
      render(lastSnapshot);
    },
  };
}
