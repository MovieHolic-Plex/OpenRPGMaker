import { registerModal, unregisterModal } from "../ui/modalStack";
import { el } from "../../util/dom";
import { forkPublication, parsePublication, preparePublication, upgradePublication, type Publication } from "../../project/publication";
import { installedRuntimeTarget, RUNTIME_ARCHIVE_BASE } from "../../project/publicationExport";
import { parseRuntimeManifest } from "../../project/gameRelease";
import { defaultFetchBytes } from "../../project/webExportZip";
import type { FetchBytes } from "../../project/playerDeploymentTypes";
import type { Project } from "../../project/types";

export async function openPublishingDialog(options: {
  readonly project: Project;
  readonly opener?: HTMLElement | null;
  readonly apply: (publication: Publication) => void;
  readonly exportZip: () => Promise<void>;
  readonly exportHtml: () => Promise<void>;
  readonly fetchBytes?: FetchBytes;
}): Promise<void> {
  const opener = options.opener ?? document.activeElement;
  const overlay = el("div", { class: "app-modal-overlay", dataset: { testid: "publication-dialog" } });
  const card = el("section", { class: "app-modal-card", attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "publication-title" } });
  let draft = options.project.meta.publication;
  let installed: string | undefined;
  let upgradePredecessor: string | undefined;
  let closed = false;
  const close = () => {
    closed = true; unregisterModal(overlay); overlay.remove();
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  };
  const status = el("p", { class: "app-modal-message", attrs: { role: "status" }, text: "설치된 엔진 확인 중..." });
  const fields = el("div", { class: "app-modal-choices" });
  const input = (label: string, id: string, readonly = false) => {
    const control = document.createElement("input");
    control.className = "app-modal-input"; control.id = `publication-${id}`; control.dataset.testid = control.id;
    control.readOnly = readonly;
    fields.append(el("label", { class: "app-modal-message", attrs: { for: control.id }, text: label }), control);
    return control;
  };
  const gameId = input("게임 ID", "game-id", true);
  const version = input("게임 버전", "version"); version.maxLength = 80;
  const target = input("선택된 엔진 (고정)", "runtime", true);
  const lineage = input("저장 호환 ID", "lineage", true);
  const predecessors = input("허용할 이전 저장 호환 ID (쉼표로 구분, 명시적 복사만 허용)", "predecessors");
  const acceptPredecessor = document.createElement("input");
  acceptPredecessor.type = "checkbox"; acceptPredecessor.dataset.testid = "publication-accept-predecessor";
  acceptPredecessor.disabled = true;
  fields.append(el("label", { class: "app-modal-choice", children: [acceptPredecessor,
    el("span", { text: "이번 업그레이드의 이전 저장을 호환 대상으로 허용" })] }));
  acceptPredecessor.addEventListener("change", () => {
    if (!upgradePredecessor) return;
    const values = predecessors.value.split(",").map(value => value.trim()).filter(value => value && value !== upgradePredecessor);
    if (acceptPredecessor.checked) values.push(upgradePredecessor);
    predecessors.value = values.join(", ");
  });
  const refresh = () => {
    gameId.value = draft?.gameId ?? "아직 준비하지 않음";
    version.value = draft?.versionLabel ?? "1.0"; target.value = draft?.runtimeTarget ?? "";
    lineage.value = draft?.saveCompatibilityId ?? "";
    predecessors.value = draft?.acceptedSaveCompatibilityIds.join(", ") ?? "";
    version.disabled = !draft; predecessors.disabled = !draft;
    prepare.disabled = !installed || !!draft;
    upgrade.disabled = !installed || !draft || draft.runtimeTarget === installed;
    fork.disabled = !draft;
    acceptPredecessor.disabled = !upgradePredecessor;
  };
  const sync = () => {
    if (!draft) throw new Error("먼저 배포를 준비해 주세요.");
    return parsePublication({ ...draft, versionLabel: version.value,
      acceptedSaveCompatibilityIds: predecessors.value.split(",").map(value => value.trim()).filter(Boolean) });
  };
  const action = (id: string, label: string, run: () => void) => {
    const button = el("button", { class: "app-modal-button", text: label, attrs: { type: "button" }, dataset: { testid: `publication-${id}` } });
    button.addEventListener("click", () => { try { run(); } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); } });
    return button;
  };
  const prepare = action("prepare", "배포 준비", () => {
    if (!installed || draft) return;
    draft = preparePublication(installed); refresh(); version.focus();
  });
  const upgrade = action("upgrade", "설치된 엔진으로 업그레이드", () => {
    if (!installed || !draft) return;
    upgradePredecessor = draft.saveCompatibilityId; acceptPredecessor.checked = false;
    draft = upgradePublication(sync(), installed); refresh(); version.focus();
    status.textContent = "엔진을 바꾸고 새 저장 호환 ID를 준비했습니다. 적용 전까지 원본은 바뀌지 않습니다.";
  });
  const fork = action("fork", "새 게임으로 분기", () => {
    if (!draft) return;
    upgradePredecessor = undefined; acceptPredecessor.checked = false;
    draft = forkPublication(sync()); refresh(); version.focus();
  });
  const apply = () => { options.apply(sync()); close(); };
  const exportAction = (kind: "zip" | "html") => {
    apply();
    void (kind === "zip" ? options.exportZip() : options.exportHtml()).catch(error => {
      console.error("[publication export]", error);
    });
  };
  prepare.disabled = true; upgrade.disabled = true;
  card.append(el("h2", { class: "app-modal-title", text: "게임 및 배포", attrs: { id: "publication-title" } }),
    status, fields,
    el("p", { class: "app-modal-message", text: "프로젝트 4 / 저장 4·5·6 / 자산 수집 계약 1\n테스트 플레이는 현재 편집기 엔진 미리보기입니다. 선택된 엔진의 실행은 내보낸 ZIP 또는 HTML에서 확인하세요.\n업그레이드는 초안만 바꾸며 기존 배포와 저장 파일은 바뀌지 않습니다." }),
    el("div", { class: "app-modal-choices", children: [prepare, upgrade, fork,
      action("zip", "적용 후 ZIP 내보내기", () => exportAction("zip")), action("html", "적용 후 HTML 내보내기", () => exportAction("html"))] }),
    el("div", { class: "app-modal-actions", children: [action("cancel", "취소", close), action("apply", "적용", apply)] }));
  card.addEventListener("click", event => event.stopPropagation());
  card.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const controls = [...card.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)")];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  overlay.addEventListener("click", close); overlay.append(card); document.body.append(overlay);
  registerModal(overlay, close); refresh(); (draft ? version : gameId).focus();
  const fetchBytes = options.fetchBytes ?? defaultFetchBytes;
  try {
    const current = await installedRuntimeTarget(fetchBytes);
    await parseRuntimeManifest(JSON.parse(new TextDecoder().decode(await fetchBytes(`${RUNTIME_ARCHIVE_BASE}${current}/runtime.json`))));
    if (closed) return;
    installed = current; prepare.disabled = !!draft; upgrade.disabled = !draft || draft.runtimeTarget === installed;
    status.textContent = `설치된 엔진: ${current.slice(0, 16)} · 프로젝트 4 / 저장 4·5·6 / 수집 1`;
    if (draft && draft.runtimeTarget !== current) {
      await parseRuntimeManifest(JSON.parse(new TextDecoder().decode(await fetchBytes(`${RUNTIME_ARCHIVE_BASE}${draft.runtimeTarget}/runtime.json`))));
    }
  } catch (error) {
    if (!closed) status.textContent = `엔진을 사용할 수 없습니다. 자동 대체하지 않습니다. (${error instanceof Error ? error.message : String(error)})`;
  }
}
