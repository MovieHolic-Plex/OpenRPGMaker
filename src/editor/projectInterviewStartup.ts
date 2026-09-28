import { store } from "@/project/store";
import { briefOpeningMotive, briefOpeningSequence, isUntouchedDefaultOpening } from "@/project/defaults/defaultOpeningSequence";
import { toast } from "@/util/toast";
import { DEFAULT_DIALOGUE_STYLE_ID, recommendedDialogueStyleForPreset } from "@/project/dialogueStyles";
import { welcomeGenrePresetById, buildWelcomeGenrePresetPrompt, welcomeGenrePresetDisplayText } from "./welcomeGenrePresets";
import { setPendingAiBootIntent } from "./aiBootIntent";
import { isAssistantEndpointReady, resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { getAiConnectionStatus } from "./panels/aiConnectionStatus";
import { withVerifiedPlayableSegment } from "@/project/playableSegment";

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
      // 장르에 어울리는 대화창을 코드가 먼저 깐다 — AI 가 기획 톤을 보고 바꿀 수 있지만,
      // 조수가 연결되지 않았거나 잊어도 첫 플레이부터 장르 대화창이 뜬다. 사용자가 이미 고른 값은 그대로 둔다.
      if (project.system.dialogueStyle === undefined) {
        const dialogueStyle = recommendedDialogueStyleForPreset(brief.presetId);
        if (dialogueStyle !== DEFAULT_DIALOGUE_STYLE_ID) project.system.dialogueStyle = dialogueStyle;
      }
    }, { scope: "project", label: "새 프로젝트 기획 전달 준비", origin: "system" });
    if (!stillCurrent() || store.getCurrent().gameDesignBrief?.generationPending) {
      throw new Error("게임 기획 전달 상태를 변경하지 못했습니다.");
    }
    // 끝낼 수 있는 첫 구간 뼈대 — AI 가 오기 전에 코드가 깔고 자동 플레이로 합격을 확인한다(src/project/playableSegment.ts).
    // 판정을 통과한 뼈대만 심는다. 못 깔면 예전처럼 AI 만으로 진행한다(판정 대상도 아니게 된다).
    const skeleton = withVerifiedPlayableSegment(store.getCurrent());
    if (skeleton) store.replace(skeleton, { change: { label: "끝낼 수 있는 첫 구간 뼈대", origin: "system" } });
    const saved = await store.flush();
    if (saved.kind !== "saved") throw new Error("게임 기획 저장을 확인하지 못했습니다.");
    if (!stillCurrent()) return;
    const config = resolveSurfaceAiConfig("chat");
    const autoSend = isAssistantEndpointReady(config, getAiConnectionStatus(config));
    // 프리셋 첫 생성은 팀(팀장·시공·검수)이 맡는다 — 이 한 턴만이다. 사용자 팀 설정은 바꾸지 않는다.
    setPendingAiBootIntent(buildWelcomeGenrePresetPrompt(preset, brief), { autoSend, displayText: welcomeGenrePresetDisplayText(preset, brief), team: true });
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
