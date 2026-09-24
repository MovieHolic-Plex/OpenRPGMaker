import { store } from "@/project/store";
import { briefOpeningMotive, briefOpeningSequence, isUntouchedDefaultOpening } from "@/project/defaults/defaultOpeningSequence";
import { toast } from "@/util/toast";
import { welcomeGenrePresetById, buildWelcomeGenrePresetPrompt, welcomeGenrePresetDisplayText } from "./welcomeGenrePresets";
import { setPendingAiBootIntent } from "./aiBootIntent";
import { isAssistantEndpointReady, resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { getAiConnectionStatus } from "./panels/aiConnectionStatus";

let preparing = false;

/** Resume only from the saved new project, never against the folder being left by menu.ts. */
export async function prepareProjectInterviewStartup(): Promise<void> {
  const brief = store.getCurrent().gameDesignBrief;
  if (preparing || !brief?.generationPending) return;
  const preset = welcomeGenrePresetById(brief.presetId);
  if (!preset) return;
  const scope = JSON.stringify(store.getProjectIdentity());
  const stillCurrent = (): boolean => JSON.stringify(store.getProjectIdentity()) === scope
    && store.getCurrent().gameDesignBrief?.summary === brief.summary;
  preparing = true;
  try {
    // Save the claim before publishing an intent so a normal refresh cannot launch the same build twice.
    store.update(project => {
      if (project.gameDesignBrief) delete project.gameDesignBrief.generationPending;
      // 씨앗의 기본 오프닝(왕국·호숫가 그림)이 기획과 어긋나지 않게 기획 문장으로 바꿔 둔다.
      const opening = project.system.opening;
      if (opening && isUntouchedDefaultOpening(opening, project.meta.title)) {
        project.system.opening = briefOpeningSequence(opening, briefOpeningMotive(brief), project.meta.title);
      }
    }, { scope: "project", label: "새 프로젝트 기획 전달 준비", origin: "system" });
    if (!stillCurrent() || store.getCurrent().gameDesignBrief?.generationPending) {
      throw new Error("게임 기획 전달 상태를 변경하지 못했습니다.");
    }
    const saved = await store.flush();
    if (saved.kind !== "saved") throw new Error("게임 기획 저장을 확인하지 못했습니다.");
    if (!stillCurrent()) return;
    const config = resolveSurfaceAiConfig("chat");
    const autoSend = isAssistantEndpointReady(config, getAiConnectionStatus(config));
    setPendingAiBootIntent(buildWelcomeGenrePresetPrompt(preset, brief), { autoSend, displayText: welcomeGenrePresetDisplayText(preset, brief) });
    if (!autoSend) toast("게임 기획을 저장하고 조수 입력창에 담았습니다. AI 연결 후 보낼 수 있습니다.", "info");
  } catch {
    if (stillCurrent()) {
      store.update(project => {
        if (project.gameDesignBrief) project.gameDesignBrief.generationPending = true;
      }, { scope: "project", label: "게임 기획 전달 대기 유지", origin: "system" });
      toast("게임 기획을 전달하지 못했습니다. 저장 연결을 확인한 뒤 프로젝트 메뉴의 ‘게임 기획’을 열어 주세요.", "error");
    }
  } finally { preparing = false; }
}
