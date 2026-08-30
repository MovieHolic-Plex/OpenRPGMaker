import { loadAiConfig } from "@/ai/llmClient";
import { IMAGE_GENERATION_PROVIDER_ID, imageGenerationUsesOtherProvider } from "@/ai/imageGenerationClient";
import { flattenGeneratedArtwork } from "@/editor/aiArtworkCanvas";
import {
  generateDatabaseRecordWithAi,
  type AiDatabaseGenerationOutcome,
  type AiDatabaseKind,
} from "@/editor/aiDatabaseGeneration";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { el } from "@/util/dom";

const KIND_LABEL: Record<AiDatabaseKind, string> = { enemy: "몬스터", item: "아이템" };
const PLACEHOLDER: Record<AiDatabaseKind, string> = {
  enemy: "예: 얼음 동굴에 사는 서슬 늑대. 빠르고 물리 공격 위주, 초중반 난이도.",
  item: "예: 전투 중에도 쓸 수 있는 상급 회복약. HP 를 넉넉히 회복한다.",
};

export interface OpenAiGenerateDialogOptions {
  readonly kind: AiDatabaseKind;
  readonly rerender: () => void;
}

export function openDatabaseAiGenerateDialog(options: OpenAiGenerateDialogOptions): void {
  const { kind, rerender } = options;
  const label = KIND_LABEL[kind];
  const config = loadAiConfig();

  const overlay = el("div", {
    class: "db-enemy-dialog-backdrop",
    dataset: { testid: `db-ai-generate-dialog-${kind}` },
  });
  const brief = el("textarea", {
    attrs: { rows: "4", placeholder: PLACEHOLDER[kind] },
    dataset: { testid: "db-ai-generate-brief" },
  }) as HTMLTextAreaElement;
  const artworkToggle = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "db-ai-generate-artwork" },
  }) as HTMLInputElement;
  artworkToggle.checked = true;

  const status = el("p", { text: "", dataset: { testid: "db-ai-generate-status" } });
  const preview = el("img", { dataset: { testid: "db-ai-generate-preview" } }) as HTMLImageElement;
  preview.hidden = true;
  preview.width = 128;
  preview.alt = `생성된 ${label} 그림 미리보기`;

  const generate = el("button", {
    class: "btn small",
    text: "생성",
    attrs: { type: "button" },
    dataset: { testid: "db-ai-generate-run" },
  }) as HTMLButtonElement;
  const close = el("button", {
    class: "btn small",
    text: "닫기",
    attrs: { type: "button" },
    dataset: { testid: "db-ai-generate-close" },
  }) as HTMLButtonElement;

  const controller = new AbortController();
  const dismiss = (): void => {
    controller.abort();
    unregisterModal(overlay);
    overlay.remove();
  };
  close.addEventListener("click", dismiss);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay && !generate.disabled) dismiss();
  });
  registerModal(overlay, dismiss);

  generate.addEventListener("click", () => {
    if (generate.disabled) return;
    generate.disabled = true;
    close.disabled = true;
    status.textContent = artworkToggle.checked
      ? `${label} 정보와 그림을 만들고 있습니다… (그림은 30초 이상 걸릴 수 있습니다)`
      : `${label} 정보를 만들고 있습니다…`;
    void generateDatabaseRecordWithAi(
      {
        kind,
        brief: brief.value,
        config,
        withArtwork: artworkToggle.checked,
        signal: controller.signal,
      },
      { flattenArtwork: flattenGeneratedArtwork },
    )
      .then((outcome: AiDatabaseGenerationOutcome) => {
        status.textContent = `완료: ${outcome.name} (${outcome.recordId})`;
        if (outcome.artworkDataUrl) {
          preview.src = outcome.artworkDataUrl;
          preview.hidden = false;
        }
        setSelectedRecordId(kind === "item" ? "items" : "enemies", outcome.recordId);
        rerender();
      })
      .catch((error: unknown) => {
        status.textContent = `실패: ${error instanceof Error ? error.message : String(error)}`;
      })
      .finally(() => {
        generate.disabled = false;
        close.disabled = false;
      });
  });

  const notice = imageGenerationUsesOtherProvider(config)
    ? el("p", {
        text: `그림 생성은 ${IMAGE_GENERATION_PROVIDER_ID} 구독 경로로 처리됩니다(현재 대화 제공자: ${config.providerId}).`,
        dataset: { testid: "db-ai-generate-provider-notice" },
      })
    : null;

  overlay.append(
    el("div", {
      class: "db-enemy-dialog",
      children: [
        el("header", { text: `AI로 ${label} 생성` }),
        el("main", {
          children: [
            el("label", { children: [el("span", { text: `만들고 싶은 ${label} 설명` }), brief] }),
            el("label", { class: "actor-check", children: [artworkToggle, el("span", { text: "그림도 함께 생성" })] }),
            ...(notice ? [notice] : []),
            status,
            preview,
          ],
        }),
        el("footer", { children: [generate, close] }),
      ],
    }),
  );
  document.body.append(overlay);
  brief.focus();
}
