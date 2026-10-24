// editor/panels/databaseStoryScriptView.ts
// 자료집 「이야기 › 대사」 탭의 기본 보기 「대본」 — 대사를 맵 순서가 아니라 «이야기 순서» 의 시나리오로 읽고 고친다.
//
//   왼쪽  개요: 막 → 장(장소) → 장면(S1…). 검색. 누르면 그 장면으로 간다.
//   오른쪽 대본: 장면 머리(번호·장소·발동·조건·한 줄 요약) · 화자 칸 + 대사 · [지문] · 선택지/조건 갈래(접기).
//         본줄 장면 뒤에는 그 무렵 들을 수 있는 곁가지(NPC 잡담·조사)가 접혀 붙는다.
//         대사는 눌러서 그 자리에서 고치고(창 맞춤 배지), 조수 제안은 해당 줄 바로 아래에 전·후로 보인다.
//
// 이야기 순서·장면·막은 editor/dialogue/storyScript.ts(조수 도구 get_story_outline·read_story_script 와 같은 모델)가 만든다.

import { store } from "@/project/store";
import { readDialogueDesk, type DialogueProposal } from "@/project/dialogueDesk";
import type { DialogueLine } from "@/editor/dialogue/dialogueIndex";
import { acceptDialogueProposals, rejectDialogueProposals, setSceneSummary } from "@/editor/dialogue/dialogueActions";
import { buildStory, sceneSummary, type ScriptBlock, type ScriptNode, type Story, type StoryChapter, type StoryScene } from "@/editor/dialogue/storyScript";
import { detailHero, detailPane, emptyState, listPane, listRow, listSearch, workspaceShell } from "@/editor/panels/databaseWorkspace";
import { diffNode, fitBadge, inlineLineText, jumpToLine, lineFit, speakerLabel, warmDialogueMeasurer } from "@/editor/panels/dialogueViewShared";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

export type DialogueViewMode = "script" | "list";

interface ScriptState {
  chapterId: string;
  query: string;
  activeSceneId: string;
  openSide: Set<string>;
  editingSummary: string | null;
  /** 다시 그린 뒤 이 장면으로 간다(개요에서 접힌 곁가지를 골랐을 때). */
  jumpTo: string | null;
  /** 대본 창의 스크롤 — 받기·고치기로 다시 그려도 읽던 자리에 남는다. */
  scrollTop: number;
  scrollKey: string;
}

const scriptState: ScriptState = { chapterId: "", query: "", activeSceneId: "", openSide: new Set(), editingSummary: null, jumpTo: null, scrollTop: 0, scrollKey: "" };

const watchedScrollers = new WeakSet<HTMLElement>();

function scrollParent(node: HTMLElement): HTMLElement | null {
  for (let cursor = node.parentElement; cursor; cursor = cursor.parentElement) {
    const style = getComputedStyle(cursor);
    if (/(auto|scroll)/u.test(style.overflowY) && cursor.scrollHeight > cursor.clientHeight) return cursor;
  }
  return null;
}

/** 대본/목록 전환 단추. */
export function dialogueModeToggle(mode: DialogueViewMode, onChange: (mode: DialogueViewMode) => void): HTMLElement {
  const button = (value: DialogueViewMode, label: string, hint: string): HTMLElement => el("button", {
    class: `db-script-mode${mode === value ? " is-active" : ""}`,
    text: label,
    attrs: { type: "button", title: hint, "aria-pressed": mode === value ? "true" : "false" },
    dataset: { testid: `db-dialogue-mode-${value}` },
    on: { click: () => { if (mode !== value) onChange(value); } },
  });
  return el("div", {
    class: "db-script-modes",
    attrs: { role: "group", "aria-label": "대사 보기" },
    children: [
      button("script", "대본", "이야기 순서로 읽는 시나리오"),
      button("list", "목록", "맵·이벤트 순서의 표 — 창 넘침을 한꺼번에 고칠 때"),
    ],
  });
}

function sceneMatches(scene: StoryScene, query: string): boolean {
  if (!query) return true;
  const haystack = `${scene.ref}\n${scene.place}\n${scene.title}\n${scene.speakers.join("\n")}\n${scene.lines.map((line) => line.text).join("\n")}`.toLocaleLowerCase();
  return haystack.includes(query);
}

interface RenderContext {
  readonly project: Project;
  readonly story: Story;
  readonly panelRoot: HTMLElement;
  readonly rerender: () => void;
  readonly proposals: ReadonlyMap<string, DialogueProposal>;
  readonly query: string;
}

function renderProposalInline(context: RenderContext, line: DialogueLine, proposal: DialogueProposal): HTMLElement {
  const stale = line.hash !== proposal.baseHash;
  const { after } = diffNode(proposal.before, proposal.after);
  const accept = (): void => {
    const outcome = acceptDialogueProposals([proposal.id]);
    if (outcome.accepted.length === 0) toast(outcome.failed[0]?.verdict.message ?? "받지 못했습니다.", "error");
    context.rerender();
  };
  const reject = (): void => { rejectDialogueProposals([proposal.id]); context.rerender(); };
  return el("div", {
    class: `db-script-proposal${stale ? " is-stale" : ""}`,
    dataset: { testid: "db-script-proposal", lineId: line.id },
    children: [
      el("span", { class: "db-script-proposal-tag", text: "제안" }),
      el("div", {
        class: "db-script-proposal-text",
        children: [
          after,
          ...(proposal.reason ? [el("p", { class: "db-script-proposal-reason", text: proposal.reason, attrs: { translate: "no" }, dataset: { i18nSkip: "" } })] : []),
          ...(stale ? [el("span", { class: "db-dialogue-stale", text: "원문이 바뀜 — 받을 수 없음" })] : []),
        ],
      }),
      fitBadge(lineFit(context.project, line, proposal.after)),
      el("div", {
        class: "db-script-proposal-actions",
        children: [
          el("button", { class: "db-ws-btn db-ws-btn-ghost", text: "버리기", attrs: { type: "button" }, dataset: { testid: "db-script-reject" }, on: { click: reject } }),
          el("button", { class: "db-ws-btn db-ws-btn-primary", text: "받기", attrs: { type: "button", ...(stale ? { disabled: "true" } : {}) }, dataset: { testid: "db-script-accept" }, on: { click: accept } }),
        ],
      }),
    ],
  });
}

function renderLine(context: RenderContext, line: DialogueLine, role: "line" | "prompt" | "option" = "line"): HTMLElement {
  const fit = lineFit(context.project, line);
  const proposal = context.proposals.get(line.id);
  const narration = !line.speaker && line.kind === "text";
  const who = role === "option" ? "고르기" : role === "prompt" ? (line.speaker || "질문") : narration ? "" : speakerLabel(line);
  const ref = context.story.lineRefs.get(line.id);
  const row = el("div", {
    class: `db-script-line${narration ? " is-narration" : ""}${role !== "line" ? ` is-${role}` : ""}${fit?.overflow ? " is-overflow" : ""}${proposal ? " has-proposal" : ""}`,
    dataset: { testid: "db-script-line", lineId: line.id, ...(ref ? { ref: `${context.story.scenes.get(ref.sceneId)?.ref ?? ""}.${ref.index}` } : {}) },
    children: [
      el("span", { class: "db-script-speaker", text: who, attrs: { translate: "no", title: who }, dataset: { i18nSkip: "" } }),
      inlineLineText(line, context.project, context.rerender, { className: "db-script-text" }),
      fit?.overflow ? fitBadge(fit) : el("span", { class: "db-script-fit-slot" }),
    ],
  });
  if (!proposal) return row;
  return el("div", { class: "db-script-line-wrap", children: [row, renderProposalInline(context, line, proposal)] });
}

function renderBranch(context: RenderContext, block: ScriptBlock, label: string, extra: readonly HTMLElement[] = []): HTMLElement {
  const details = el("details", {
    class: `db-script-branch is-${block.tone}`,
    dataset: { testid: "db-script-branch" },
    children: [
      el("summary", { class: "db-script-branch-label", text: label, attrs: { translate: "no" }, dataset: { i18nSkip: "" } }),
      el("div", { class: "db-script-branch-body", children: [...extra, ...renderNodes(context, block.children)] }),
    ],
  }) as HTMLDetailsElement;
  details.open = true;
  return details;
}

function renderNodes(context: RenderContext, nodes: readonly ScriptNode[]): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const node of nodes) {
    switch (node.k) {
      case "line":
        out.push(renderLine(context, node.line));
        break;
      case "dir":
        out.push(el("div", { class: `db-script-dir${node.tone ? ` is-${node.tone}` : ""}`, text: node.text, attrs: { translate: "no" }, dataset: { i18nSkip: "" } }));
        break;
      case "choice":
        out.push(el("div", {
          class: "db-script-choice",
          dataset: { testid: "db-script-choice" },
          children: [
            el("div", { class: "db-script-choice-label", text: "선택지" }),
            ...(node.prompt ? [renderLine(context, node.prompt, "prompt")] : []),
            ...node.options.map((option, index) => renderBranch(
              context,
              option,
              `${String.fromCharCode(0x2460 + Math.min(index, 19))} ${option.head?.text.replace(/\n/gu, " ") ?? option.label}`,
              option.head ? [renderLine(context, option.head, "option")] : [],
            )),
          ],
        }));
        break;
      case "block":
        out.push(renderBranch(context, node, node.label, node.head ? [renderLine(context, node.head, "option")] : []));
        break;
    }
  }
  return out;
}

function renderSummary(context: RenderContext, scene: StoryScene): HTMLElement {
  const summary = sceneSummary(context.project, scene);
  if (scriptState.editingSummary === scene.id) {
    const input = el("input", {
      class: "db-script-summary-input",
      value: summary.auto ? "" : summary.text,
      attrs: { type: "text", maxlength: "200", placeholder: summary.text, "aria-label": `${scene.ref} 한 줄 요약`, translate: "no" },
      dataset: { testid: "db-script-summary-input", i18nSkip: "" },
    });
    const save = (): void => {
      scriptState.editingSummary = null;
      setSceneSummary(scene.id, input.value);
      context.rerender();
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); save(); }
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); scriptState.editingSummary = null; context.rerender(); }
    });
    queueMicrotask(() => input.focus());
    return el("div", {
      class: "db-script-summary is-editing",
      children: [
        el("span", { class: "db-script-summary-label", text: "요약" }),
        input,
        el("button", { class: "db-ws-btn db-ws-btn-primary", text: "저장", attrs: { type: "button" }, dataset: { testid: "db-script-summary-save" }, on: { click: save } }),
      ],
    });
  }
  return el("div", {
    class: `db-script-summary${summary.auto ? " is-auto" : ""}`,
    children: [
      el("span", { class: "db-script-summary-label", text: summary.auto ? "자동 요약" : "요약" }),
      el("span", { class: "db-script-summary-text", text: summary.text, attrs: { translate: "no" }, dataset: { i18nSkip: "" } }),
      el("button", {
        class: "db-script-link",
        text: summary.auto ? "요약 쓰기" : "고치기",
        attrs: { type: "button", title: "이 장면의 한 줄 요약 — 조수도 이야기 개요에서 이것을 읽습니다" },
        dataset: { testid: "db-script-summary-edit" },
        on: { click: () => { scriptState.editingSummary = scene.id; context.rerender(); } },
      }),
    ],
  });
}

function renderScene(context: RenderContext, scene: StoryScene, compact = false): HTMLElement {
  const twin = scene.sameAs ? context.story.scenes.get(scene.sameAs) : undefined;
  const meta = [scene.trigger, ...(scene.conditions.length ? [`조건: ${scene.conditions.join(", ")}`] : [])].join(" · ");
  const pendingHere = scene.lines.filter((line) => context.proposals.has(line.id)).length;
  const head = el("header", {
    class: "db-script-scene-head",
    children: [
      el("span", { class: `db-script-ref${scene.lane === "side" ? " is-side" : ""}`, text: scene.ref }),
      el("h4", {
        class: "db-script-scene-title",
        children: [
          el("span", { class: "db-script-place", text: scene.place, attrs: { translate: "no" }, dataset: { i18nSkip: "" } }),
          el("span", { class: "db-script-title-sep", text: " — " }),
          el("span", { text: scene.title, attrs: { translate: "no" }, dataset: { i18nSkip: "" } }),
        ],
      }),
      ...(pendingHere ? [el("span", { class: "db-script-pending", text: `제안 ${pendingHere}` })] : []),
      el("button", {
        class: "db-dialogue-jump",
        text: "이벤트 열기",
        attrs: { type: "button", title: "이 장면의 이벤트(또는 전투·공용 이벤트)를 엽니다" },
        dataset: { testid: "db-script-jump" },
        on: { click: () => { const first = scene.lines[0]; if (first) jumpToLine(first, context.panelRoot); } },
      }),
    ],
  });
  const children: HTMLElement[] = [head];
  if (meta) children.push(el("p", { class: "db-script-scene-meta", text: meta, attrs: { translate: "no" }, dataset: { i18nSkip: "" } }));
  if (twin) {
    const details = el("details", {
      class: "db-script-twin",
      children: [
        el("summary", { text: `${twin.ref} 와 대사가 같습니다(같은 이벤트를 여러 칸에 둔 것) — 펼쳐서 따로 고치기` }),
        el("div", { class: "db-script-body", children: renderNodes(context, scene.nodes) }),
      ],
    }) as HTMLDetailsElement;
    details.open = pendingHere > 0;
    children.push(details);
  } else {
    if (!compact) children.push(renderSummary(context, scene));
    children.push(el("div", { class: "db-script-body", children: renderNodes(context, scene.nodes) }));
  }
  return el("article", {
    class: `db-script-scene${scene.lane === "side" ? " is-side" : ""}${scriptState.activeSceneId === scene.id ? " is-active" : ""}`,
    attrs: { id: sceneAnchor(scene) },
    dataset: { testid: "db-script-scene", sceneId: scene.id, ref: scene.ref },
    children,
  });
}

function sceneAnchor(scene: StoryScene): string {
  return `db-script-${scene.ref}`;
}

function renderSideLane(context: RenderContext, key: string, sides: readonly StoryScene[], title: string): HTMLElement {
  const lineCount = sides.reduce((sum, scene) => sum + scene.lines.length, 0);
  const pending = sides.reduce((sum, scene) => sum + scene.lines.filter((line) => context.proposals.has(line.id)).length, 0);
  const body = el("div", { class: "db-script-side-body" });
  const details = el("details", {
    class: "db-script-side",
    dataset: { testid: "db-script-side", anchor: key },
    children: [
      el("summary", {
        class: "db-script-side-label",
        children: [
          el("span", { text: title }),
          el("span", { class: "db-dialogue-muted", text: `${sides.length}장면 · 대사 ${lineCount}줄${pending ? ` · 제안 ${pending}` : ""}` }),
        ],
      }),
      body,
    ],
  }) as HTMLDetailsElement;
  const fill = (): void => { if (body.childElementCount === 0) body.append(...sides.map((scene) => renderScene(context, scene, true))); };
  const open = scriptState.openSide.has(key) || Boolean(context.query) || pending > 0;
  if (open) { fill(); details.open = true; }
  details.addEventListener("toggle", () => {
    if (details.open) { scriptState.openSide.add(key); fill(); } else scriptState.openSide.delete(key);
  });
  return details;
}

function chapterStats(context: RenderContext, chapter: StoryChapter): { lines: number; overflow: number } {
  let lines = 0;
  let overflow = 0;
  for (const id of [...chapter.mainIds, ...chapter.sideIds]) {
    const scene = context.story.scenes.get(id);
    if (!scene) continue;
    for (const line of scene.lines) {
      lines += 1;
      if (lineFit(context.project, line)?.overflow) overflow += 1;
    }
  }
  return { lines, overflow };
}

export function renderStoryScriptView(
  host: HTMLElement,
  panelRoot: HTMLElement,
  rerender: () => void,
  options: { readonly toggle: HTMLElement; readonly stamp: string; readonly isCurrent: () => boolean },
): void {
  const project = store.getCurrent();
  warmDialogueMeasurer(project, rerender, options.isCurrent);
  const story = buildStory(project);
  const desk = readDialogueDesk(project);
  const proposals = new Map(desk.proposals.map((proposal) => [proposal.lineId, proposal]));
  const query = scriptState.query.trim().toLocaleLowerCase();
  const context: RenderContext = { project, story, panelRoot, rerender, proposals, query };

  if (!story.chapters.some((chapter) => chapter.id === scriptState.chapterId)) scriptState.chapterId = story.chapters[0]?.id ?? "";
  const chapter = story.chapters.find((entry) => entry.id === scriptState.chapterId);

  // ── 왼쪽: 개요 ──
  const outlineRows: HTMLElement[] = [];
  const goTo = (scene: StoryScene): void => {
    scriptState.activeSceneId = scene.id;
    const target = host.querySelector<HTMLElement>(`#${CSS.escape(sceneAnchor(scene))}`);
    if (!target) {
      // 곁가지가 접혀 있으면 펼친 뒤 다시 그린다.
      if (scene.lane === "side") scriptState.openSide.add(scene.anchorId ?? "start");
      scriptState.jumpTo = scene.id;
      rerender();
      return;
    }
    host.querySelectorAll(".db-script-scene.is-active, .db-script-outline-row.active").forEach((node) => node.classList.remove("is-active", "active"));
    target.classList.add("is-active");
    host.querySelector(`.db-script-outline-row[data-scene-id="${CSS.escape(scene.id)}"]`)?.classList.add("active");
    target.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  if (chapter) {
    for (const section of chapter.sections) {
      const scenes = section.sceneIds.map((id) => story.scenes.get(id)!).filter((scene) => sceneMatches(scene, query));
      if (scenes.length === 0) continue;
      outlineRows.push(el("div", { class: "db-script-outline-section", text: section.title, attrs: { translate: "no" }, dataset: { i18nSkip: "" } }));
      for (const scene of scenes) {
        const pending = scene.lines.filter((line) => proposals.has(line.id)).length;
        const row = listRow({
          name: `${scene.ref}  ${scene.title}`,
          sub: `${scene.sameAs ? "같은 대사" : `${scene.lines.length}줄`}${pending ? ` · 제안 ${pending}` : ""}`,
          active: scriptState.activeSceneId === scene.id,
          title: sceneSummary(project, scene).text,
          dataset: { sceneId: scene.id, ref: scene.ref },
          testid: "db-script-outline-row",
          onSelect: () => goTo(scene),
        });
        row.classList.add("db-script-outline-row");
        if (scene.sameAs) row.classList.add("is-twin");
        outlineRows.push(row);
      }
    }
    if (query) {
      const sides = chapter.sideIds.map((id) => story.scenes.get(id)!).filter((scene) => sceneMatches(scene, query));
      if (sides.length) {
        outlineRows.push(el("div", { class: "db-script-outline-section", text: "곁가지" }));
        for (const scene of sides.slice(0, 80)) {
          const row = listRow({ name: `${scene.ref}  ${scene.title}`, sub: scene.place, dataset: { sceneId: scene.id, ref: scene.ref }, testid: "db-script-outline-row", onSelect: () => goTo(scene) });
          row.classList.add("db-script-outline-row", "is-side");
          outlineRows.push(row);
        }
      }
    }
  }
  const outline = listPane({
    title: "개요",
    count: chapter ? `${chapter.mainIds.length}장면` : undefined,
    search: listSearch({
      placeholder: "대사·인물·장소 검색",
      value: scriptState.query,
      testid: "db-script-search",
      delayMs: 220,
      onInput: (value) => { scriptState.query = value; rerender(); },
    }),
    rows: outlineRows,
    empty: emptyState({ icon: "…", title: query ? "찾는 장면이 없습니다" : "아직 대사가 없습니다", compact: true }),
    testid: "db-script-outline",
  });

  // ── 오른쪽: 대본 ──
  const body: HTMLElement[] = [options.toggle];
  if (story.chapters.length > 1) {
    body.push(el("div", {
      class: "db-script-chapters",
      attrs: { role: "tablist", "aria-label": "막" },
      children: story.chapters.map((entry) => el("button", {
        class: `db-script-chapter${entry.id === scriptState.chapterId ? " is-active" : ""}`,
        text: entry.title,
        attrs: { type: "button", role: "tab", "aria-selected": entry.id === scriptState.chapterId ? "true" : "false", translate: "no" },
        dataset: { testid: "db-script-chapter", chapterId: entry.id, i18nSkip: "" },
        on: { click: () => { scriptState.chapterId = entry.id; scriptState.activeSceneId = ""; rerender(); } },
      })),
    }));
  }
  if (desk.proposals.length > 0) {
    const fresh = desk.proposals.filter((proposal) => {
      const at = story.lineRefs.get(proposal.lineId);
      const line = at ? story.scenes.get(at.sceneId)?.lines[at.index - 1] : undefined;
      return line?.hash === proposal.baseHash;
    });
    const instructions = [...new Set(desk.proposals.map((proposal) => proposal.instruction).filter((value): value is string => Boolean(value)))];
    body.push(el("section", {
      class: "db-script-proposal-bar",
      dataset: { testid: "db-script-proposal-bar" },
      children: [
        el("div", {
          class: "db-dialogue-proposals-title",
          children: [
            el("strong", { text: `조수 윤문 제안 ${desk.proposals.length}줄` }),
            el("span", { class: "db-dialogue-muted", text: "대본 속 해당 줄 바로 아래에 보입니다. 받기 전에는 게임 대사가 바뀌지 않습니다." }),
            ...instructions.slice(0, 2).map((text) => el("span", { class: "db-dialogue-instruction", text: `요청: ${text}`, attrs: { translate: "no" }, dataset: { i18nSkip: "" } })),
          ],
        }),
        el("div", {
          class: "db-dialogue-proposals-actions",
          children: [
            el("button", {
              class: "db-ws-btn db-ws-btn-ghost",
              text: "첫 제안으로",
              attrs: { type: "button" },
              dataset: { testid: "db-script-first-proposal" },
              on: { click: () => host.querySelector<HTMLElement>(".db-script-proposal")?.scrollIntoView({ block: "center", behavior: "smooth" }) },
            }),
            el("button", {
              class: "db-ws-btn db-ws-btn-ghost",
              text: "모두 버리기",
              attrs: { type: "button" },
              dataset: { testid: "db-script-reject-all" },
              on: { click: () => { const count = rejectDialogueProposals(desk.proposals.map((proposal) => proposal.id)); toast(`윤문 제안 ${count}줄을 버렸습니다.`, "info"); rerender(); } },
            }),
            el("button", {
              class: "db-ws-btn db-ws-btn-primary",
              text: `모두 받기 (${fresh.length})`,
              attrs: { type: "button", ...(fresh.length === 0 ? { disabled: "true" } : {}) },
              dataset: { testid: "db-script-accept-all" },
              on: {
                click: () => {
                  const outcome = acceptDialogueProposals(fresh.map((proposal) => proposal.id));
                  toast(outcome.failed.length
                    ? `${outcome.accepted.length}줄 받음 · ${outcome.failed.length}줄은 원문이 바뀌어 남겨 둠`
                    : `윤문 제안 ${outcome.accepted.length}줄을 받았습니다.`, outcome.failed.length ? "info" : "ok");
                  rerender();
                },
              },
            }),
          ],
        }),
      ],
    }));
  }

  const script = el("div", { class: "db-script-page", dataset: { testid: "db-script-page" } });
  if (chapter) {
    const sidesByAnchor = new Map<string, StoryScene[]>();
    for (const id of chapter.sideIds) {
      const scene = story.scenes.get(id)!;
      if (query && !sceneMatches(scene, query)) continue;
      const key = scene.anchorId ?? "start";
      sidesByAnchor.set(key, [...(sidesByAnchor.get(key) ?? []), scene]);
    }
    script.append(el("h3", { class: "db-script-chapter-title", text: chapter.title, attrs: { translate: "no" }, dataset: { i18nSkip: "" } }));
    const opening = sidesByAnchor.get("start");
    if (opening?.length) script.append(renderSideLane(context, "start", opening, "처음부터 들을 수 있는 곁가지"));
    let shownScenes = 0;
    for (const section of chapter.sections) {
      const scenes = section.sceneIds.map((id) => story.scenes.get(id)!);
      const visible = scenes.filter((scene) => sceneMatches(scene, query) || (sidesByAnchor.get(scene.id)?.length ?? 0) > 0);
      if (visible.length === 0) continue;
      script.append(el("h3", { class: "db-script-section-title", text: section.title, attrs: { translate: "no" }, dataset: { i18nSkip: "" } }));
      for (const scene of visible) {
        if (sceneMatches(scene, query)) { script.append(renderScene(context, scene)); shownScenes += 1; }
        const sides = sidesByAnchor.get(scene.id);
        if (sides?.length) script.append(renderSideLane(context, scene.id, sides, `${scene.ref} 뒤 곁가지`));
      }
    }
    if (query && shownScenes === 0 && !script.querySelector(".db-script-side")) {
      script.append(emptyState({ icon: "…", title: "찾는 대사가 없습니다", body: "검색어를 바꾸거나 지워 보세요.", compact: true, testid: "db-script-empty" }));
    }
  } else {
    script.append(emptyState({ icon: "…", title: "아직 대사가 없습니다", body: "이벤트에 「문장 표시」 명령을 넣으면 이야기 순서대로 여기에 모입니다.", compact: true, testid: "db-script-empty" }));
  }
  body.push(script);

  const stats = chapter ? chapterStats(context, chapter) : { lines: 0, overflow: 0 };
  const detail = detailPane({
    hero: detailHero({
      eyebrow: "이야기 · 대본",
      title: chapter?.title ?? "대본",
      subtitle: chapter
        ? `본줄 ${chapter.mainIds.length}장면 · 곁가지 ${chapter.sideIds.length}장면 · 대사 ${stats.lines}줄${stats.overflow ? ` · 창 넘침 ${stats.overflow}줄` : ""} — 이야기 순서(조건·스위치·자동 시작으로 추정)`
        : "",
      testid: "db-dialogue-hero",
    }),
    body,
    testid: "db-dialogue-detail",
  });
  const shell = workspaceShell({ list: outline, detail, legacyClass: "db-dialogue-workspace db-script-workspace", testid: "db-dialogue-view" });
  shell.dataset.project = options.stamp;
  shell.dataset.mode = "script";
  host.append(shell);
  const scrollKey = `${scriptState.chapterId}|${query}`;
  const jumpTo = scriptState.jumpTo;
  scriptState.jumpTo = null;
  requestAnimationFrame(() => {
    const scroller = scrollParent(script);
    if (!scroller) return;
    const jumpScene = jumpTo ? story.scenes.get(jumpTo) : undefined;
    const target = jumpScene ? host.querySelector<HTMLElement>(`#${CSS.escape(sceneAnchor(jumpScene))}`) : null;
    if (target) target.scrollIntoView({ block: "start" });
    else if (scriptState.scrollKey === scrollKey) scroller.scrollTop = scriptState.scrollTop;
    scriptState.scrollKey = scrollKey;
    if (!watchedScrollers.has(scroller)) {
      watchedScrollers.add(scroller);
      scroller.addEventListener("scroll", () => {
        if (scroller.querySelector("[data-testid='db-script-page']")) scriptState.scrollTop = scroller.scrollTop;
      }, { passive: true });
    }
  });
}
