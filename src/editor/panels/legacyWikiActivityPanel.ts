import { legacyWikiActivity } from "@/project/world/activity";
import type { ProjectWorld, WorldEntity } from "@/project/world/types";
import { el } from "@/util/dom";

/** A read-only view of old records; never replay them into today's audit log. */
export function renderLegacyWikiActivityPanel(world: ProjectWorld | undefined): HTMLElement {
  const records = legacyWikiActivity(world);
  const root = el("section", { dataset: { testid: "legacy-wiki-activity" }, attrs: { "aria-label": "이전 AI 작업 기록" } });
  if (!records.length) return root;
  let shown = 30;
  const list = el("ol", { class: "edit-activity-list" });
  const more = el("button", { class: "btn small", text: "이전 기록 더 보기", attrs: { type: "button" }, dataset: { testid: "legacy-wiki-activity-more" } });
  const refresh = (): void => {
    list.replaceChildren(...records.slice(0, shown).map(activityRow));
    if (shown >= records.length) more.remove();
  };
  more.addEventListener("click", () => { shown += 30; refresh(); });
  root.append(
    el("h3", { text: `이전 AI 작업 기록 (${records.length})` }),
    el("p", { text: "설정집에 저장되었던 작업 기록입니다. 원래 시각과 내용을 보존하며 읽기만 할 수 있습니다." }),
    list, more,
  );
  refresh();
  return root;
}

function activityRow(entity: WorldEntity): HTMLElement {
  const at = Math.max(0, ...(entity.wiki?.sources.map((source) => source.at) ?? []));
  const date = new Date(at);
  const dateText = Number.isFinite(date.getTime()) ? date.toLocaleString("ko-KR") : "시각 미상";
  const body = el("div", { class: "edit-activity-fields", dataset: { testid: `legacy-wiki-body-${entity.id}` } });
  body.hidden = true;
  const toggle = el("button", { class: "edit-activity-fields-toggle", text: "원문 보기", attrs: { type: "button", "aria-expanded": "false" }, dataset: { testid: `legacy-wiki-toggle-${entity.id}` } });
  toggle.addEventListener("click", () => {
    const open = body.hidden;
    if (open && !body.childNodes.length) {
      const texts = [...new Set([entity.body, ...(entity.wiki?.sources.map((source) => source.text) ?? [])].filter((text): text is string => !!text))];
      body.append(...texts.map((text) => el("p", { class: "edit-activity-field-after", text })));
    }
    body.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "원문 접기" : "원문 보기";
  });
  return el("li", { class: "edit-activity-item", dataset: { testid: `legacy-wiki-row-${entity.id}` }, children: [
    el("div", { class: "edit-activity-head", children: [
      el("span", { class: "edit-activity-time", text: dateText }),
      el("span", { class: "edit-activity-desc", text: entity.summary }),
    ] }),
    toggle, body,
  ] });
}
