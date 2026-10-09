import { CC0_MUSIC_ASSETS, CC0_SOUND_ASSETS } from "@/assets/cc0AudioAssets";
import { EASYRPG_MUSIC_ASSETS, EASYRPG_SOUND_ASSETS } from "@/assets/easyrpgRtp";
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { audioResourceDocument, audioPlayback } from "./audioResourcePresentation";
import { createAudioPreviewPlayer } from "./audioPreviewPlayer";
import { bgmInstallBanner } from "./bgmInstallBanner";
import { renderEditorIcon as editorIcon } from "./eventEditor/editorIcons";
import { uiLabel } from "@/editor/uiCopy";
import { isTopModal, registerModal } from "@/editor/ui/modalStack";
import { store } from "@/project/store";
import { el } from "@/util/dom";

export function openAudioTestDialog(): void {
  document.querySelector<HTMLButtonElement>("[data-testid='audio-test-close']")?.click();
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  let category: "music" | "sound" = "music";
  let selectedId = "";
  const player = createAudioPreviewPlayer("audio-test");
  const closeButton = el("button", {
    class: "audio-test-close", attrs: { type: "button", "aria-label": "닫기" },
    dataset: { testid: "audio-test-window-close" }, children: [editorIcon("close")],
  });
  const tabs = el("div", { class: "audio-test-tabs", attrs: { role: "tablist", "aria-label": "오디오 종류" } });
  const search = el("input", {
    class: "audio-test-filter", attrs: { type: "search", placeholder: "이름·태그·설명 검색", "aria-label": "오디오 목록 좁히기" },
    dataset: { testid: "audio-test-filter" },
  });
  const count = el("span", { class: "audio-test-list-count", attrs: { "aria-live": "polite" }, dataset: { testid: "audio-test-list-count" } });
  const list = el("div", {
    class: "audio-test-list", attrs: { role: "listbox", "aria-label": "오디오 목록" }, dataset: { testid: "audio-test-list" },
  });
  const description = el("div", { dataset: { testid: "audio-test-description" } });
  const notice = el("p", { class: "audio-preview-meta", attrs: { role: "status" } });
  // 미설치 곡이 있으면 음악 탭에 전체 받기 배너를 건다. 효과음은 레포에 다 있다.
  // 설치 완료 콜백은 목록만 다시 읽는다 — 여기서 배너를 재생성하면
  // fetch→onInstalled→재생성→fetch 무한 재귀가 된다(실측: 테스트 워커 사망).
  const bannerHost = el("div", { class: "audio-test-banner-slot", attrs: { hidden: "" } });
  const refreshBanner = (): void => {
    if (!bannerHost.isConnected) return;
    const next = category === "music"
      ? bgmInstallBanner({ kind: "music", onInstalled: () => { renderList(); renderDetail(); } })
      : null;
    bannerHost.replaceChildren(...(next ? [next] : []));
    if (next === null) bannerHost.setAttribute("hidden", "");
    else bannerHost.removeAttribute("hidden");
  };

  const closeAction = el("button", {
    class: "btn", text: "닫기", attrs: { type: "button" }, dataset: { testid: "audio-test-close" },
    on: { click: () => close() },
  });
  const backdrop = el("div", {
    class: "audio-test-backdrop", dataset: { testid: "audio-test-dialog" },
    children: [el("section", {
      class: "audio-test-window", attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "audio-test-title" },
      children: [
        el("header", { class: "audio-test-titlebar", children: [el("h2", { text: uiLabel("audio"), attrs: { id: "audio-test-title" } }), closeButton] }),
        bannerHost,
        el("div", { class: "audio-test-body", children: [
          el("section", { class: "audio-test-left", children: [tabs, el("div", { class: "audio-test-filter-row", children: [search, count] }), list] }),
          el("section", { class: "audio-test-right", attrs: { "aria-label": "선택한 음원" }, children: [description, notice, player.advanced] }),
        ] }),
        player.transport,
        el("footer", { class: "audio-test-footer", children: [closeAction] }),
      ],
    })],
  });
  let unsubscribe: (() => void) | undefined;
  const close = registerModal(backdrop, () => {
    unsubscribe?.();
    player.dispose();
    backdrop.remove();
    if (opener?.isConnected) opener.focus();
  });
  const current = () => listAudioResources(category, store.getCurrent()).find(entry => entry.id === selectedId);
  function renderDetail(): void {
    const resource = current();
    description.replaceChildren(...(resource ? [audioResourceDocument(resource, store.getCurrent())] : []));
    player.select(resource, store.getCurrent());
  }
  function renderList(): void {
    const order = category === "music" ? [...CC0_MUSIC_ASSETS, ...EASYRPG_MUSIC_ASSETS] : [...CC0_SOUND_ASSETS, ...EASYRPG_SOUND_ASSETS];
    const rank = new Map<string, number>(order.map((entry, index) => [entry.id, index]));
    const resources = [...listAudioResources(category, store.getCurrent())]
      .sort((a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length));
    const needle = search.value.trim().toLowerCase();
    const filtered = resources.filter(entry => !needle || [entry.id, entry.name, entry.description, ...entry.tags].some(value => value.toLowerCase().includes(needle)));
    const entries = [{ id: "", name: "(꺼짐)" }, ...filtered];
    list.replaceChildren(...entries.map(entry => {
      const playback = entry.id ? audioPlayback(entry.id, store.getCurrent()) : { playable: true, midi: false };
      return el("button", {
        class: `audio-test-option${entry.id === selectedId ? " selected" : ""}${playback.playable ? "" : " unplayable"}`,
        attrs: { type: "button", role: "option", tabindex: entry.id === selectedId ? "0" : "-1", "aria-selected": String(entry.id === selectedId), title: entry.name,
          ...(playback.playable ? {} : { "aria-disabled": "true" }) },
        dataset: { testid: entry.id ? `audio-test-option-${resources.findIndex(item => item.id === entry.id) + 1}` : "audio-test-option-off", resourceId: entry.id, audioMidi: String(playback.midi) },
        children: [el("span", { class: "audio-test-option-label", text: entry.name }), ...(playback.playable ? [] : [el("span", { class: "audio-test-option-badge", text: "재생 불가" })])],
        on: { click: () => {
          selectedId = entry.id;
          renderList();
          renderDetail();
          list.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
        } },
      });
    }));
    if (!list.querySelector('[tabindex="0"]')) list.querySelector("button")?.setAttribute("tabindex", "0");
    if (filtered.length === 0) list.append(el("p", { class: "audio-preview-meta", text: "일치하는 음원이 없습니다. 검색어를 바꿔 보세요." }));
    count.textContent = needle ? `${filtered.length}/${resources.length}개` : `${resources.length}개`;
    notice.textContent = selectedId && !filtered.some(entry => entry.id === selectedId) ? "선택한 음원은 검색 결과 밖에 있습니다." : selectedId ? "" : "목록에서 음원을 선택한 뒤 재생하세요.";
  }
  function renderTabs(): void {
    tabs.replaceChildren(...(["music", "sound"] as const).map(kind => el("button", {
      class: `audio-test-tab${category === kind ? " active" : ""}`, text: kind === "music" ? "음악" : "효과음",
      attrs: { type: "button", role: "tab", "aria-selected": String(category === kind), tabindex: category === kind ? "0" : "-1" },
      dataset: { testid: `audio-test-tab-${kind}` }, on: { click: () => {
        if (category === kind) return;
        category = kind;
        selectedId = "";
        renderTabs(); renderList(); renderDetail(); refreshBanner();
        tabs.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
      } },
    })));
  }
  list.addEventListener("keydown", event => {
    const rows = [...list.querySelectorAll<HTMLButtonElement>("button")];
    const index = rows.findIndex(row => row === document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : event.key === "ArrowDown" ? Math.min(rows.length - 1, index + 1) : event.key === "ArrowUp" ? Math.max(0, index - 1) : undefined;
    if (next === undefined) return;
    event.preventDefault();
    rows.forEach((row, i) => { row.tabIndex = i === next ? 0 : -1; });
    rows[next]?.focus();
  });
  tabs.addEventListener("keydown", event => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    tabs.querySelector<HTMLButtonElement>('[aria-selected="false"]')?.click();
  });
  search.addEventListener("input", renderList);
  backdrop.addEventListener("keydown", event => {
    if (event.key !== "Tab" || !isTopModal(backdrop)) return;
    // The dialog's first and last controls stay outside every disclosure.
    if (event.shiftKey && document.activeElement === closeButton) { event.preventDefault(); closeAction.focus(); }
    else if (!event.shiftKey && document.activeElement === closeAction) { event.preventDefault(); closeButton.focus(); }
  });
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", event => { if (event.target === backdrop) close(); });
  document.body.append(backdrop);
  renderTabs(); renderList(); renderDetail(); refreshBanner();
  unsubscribe = store.subscribe((_project, change) => {
    if (change.projectSwitch) { close(); return; }
    if (change.scope !== "project" && change.scope !== "assets") return;
    if (selectedId && !current()) selectedId = "";
    renderList(); renderDetail(); refreshBanner();
  });
  search.focus();
}
