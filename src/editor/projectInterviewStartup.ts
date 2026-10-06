import { store } from "@/project/store";
import { briefOpeningMotive, briefOpeningSequence, isUntouchedDefaultOpening } from "@/project/defaults/defaultOpeningSequence";
import { toast } from "@/util/toast";
import { DEFAULT_DIALOGUE_STYLE_ID, recommendedDialogueStyleForPreset } from "@/project/dialogueStyles";
import { welcomeGenrePresetById, buildWelcomeGenrePresetPrompt, welcomeGenrePresetDisplayText } from "./welcomeGenrePresets";
import { applyPendingAiBootIntent, peekAiAssistantDraft, setPendingAiBootIntent } from "./aiBootIntent";
import { isAssistantEndpointReady, resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { AI_CONNECTION_STATUS_CHANGED_EVENT, getAiConnectionStatus, refreshAiConnectionStatus } from "./panels/aiConnectionStatus";
import { withVerifiedPlayableSegment } from "@/project/playableSegment";
import { prepareProjectInterviewBootAssets } from "./projectInterviewBootPreparation";

let preparing = false;
let queuedKey: string | null = null;
let waitingForConnection = false;
let listening = false;

function watchConnection(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener(AI_CONNECTION_STATUS_CHANGED_EVENT, () => {
    const config = resolveSurfaceAiConfig("chat");
    if (!waitingForConnection || preparing || !isAssistantEndpointReady(config, getAiConnectionStatus(config))) return;
    if (!store.getCurrent().gameDesignBrief?.generationPending
      || JSON.stringify([JSON.stringify(store.getProjectIdentity()), store.getCurrent().gameDesignBrief]) !== queuedKey) {
      waitingForConnection = false;
      return;
    }
    // Rebuild from the current saved brief, never from a project left while connecting.
    queuedKey = null;
    void prepareProjectInterviewStartup().then(() => applyPendingAiBootIntent());
  });
}

/** Resume only from the saved new project, never against the folder being left by menu.ts. */
export async function prepareProjectInterviewStartup(): Promise<void> {
  const brief = store.getCurrent().gameDesignBrief;
  if (preparing || !brief?.generationPending) return;
  const preset = welcomeGenrePresetById(brief.presetId);
  if (!preset) return;
  const scope = JSON.stringify(store.getProjectIdentity());
  const key = JSON.stringify([scope, brief]);
  if (queuedKey === key) return;
  const stillCurrent = (): boolean => JSON.stringify(store.getProjectIdentity()) === scope
    && store.getCurrent().gameDesignBrief?.summary === brief.summary;
  preparing = true;
  watchConnection();
  try {
    // Show the saved request before expensive asset preparation; automatic execution waits
    // for the immutable base and canonical save below. A human draft is never replaced.
    if (peekAiAssistantDraft() === "") {
      setPendingAiBootIntent(buildWelcomeGenrePresetPrompt(preset, brief), {
        autoSend: false, displayText: welcomeGenrePresetDisplayText(preset, brief), team: true,
      });
      applyPendingAiBootIntent();
    }
    await prepareProjectInterviewBootAssets();
    if (!stillCurrent() || !store.getCurrent().gameDesignBrief?.generationPending) return;
    // Keep the durable retry marker until the execution route accepts the request.
    store.update(project => {
      // 씨앗의 기본 오프닝(왕국·호숫가 그림)이 기획과 어긋나지 않게 기획 문장으로 바꿔 둔다.
      const opening = project.system.opening;
      if (opening && isUntouchedDefaultOpening(opening, project.meta.title)) {
        project.system.opening = briefOpeningSequence(opening, briefOpeningMotive(brief), project.meta.title);
      }
      // 장르에 어울리는 대화창을 코드가 먼저 깐다 — AI 가 기획 톤을 보고 바꿀 수 있지만,
      // 조수가 연결되지 않았거나 잊어도 첫 플레이부터 장르 대화창이 뜬다. 사용자가 이미 고른 값은 그대로 둔다.
      if (project.system.dialogueStyle === undefined) {
        const dialogueStyle = brief.interview ? "pixel-cinematic" : recommendedDialogueStyleForPreset(brief.presetId);
        if (dialogueStyle !== DEFAULT_DIALOGUE_STYLE_ID) project.system.dialogueStyle = dialogueStyle;
      }
    }, { scope: "project", label: "새 프로젝트 기획 전달 준비", origin: "system" });
    if (!stillCurrent()) return;
    // 끝낼 수 있는 첫 구간 뼈대 — AI 가 오기 전에 코드가 깔고 자동 플레이로 합격을 확인한다(src/project/playableSegment.ts).
    // 판정을 통과한 뼈대만 심는다. 못 깔면 예전처럼 AI 만으로 진행한다(판정 대상도 아니게 된다).
    const skeleton = withVerifiedPlayableSegment(store.getCurrent());
    if (skeleton) store.replace(skeleton, { change: { label: "끝낼 수 있는 첫 구간 뼈대", origin: "system" } });
    const saved = await store.flush();
    if (saved.kind !== "saved") throw new Error("게임 기획 저장을 확인하지 못했습니다.");
    if (!stillCurrent()) return;
    // A cold boot's synchronous cache is often still `checking`. Join the real auth probe.
    await refreshAiConnectionStatus();
    if (!stillCurrent()) return;
    const config = resolveSurfaceAiConfig("chat");
    const autoSend = isAssistantEndpointReady(config, getAiConnectionStatus(config));
    // 프리셋 첫 생성은 팀(팀장·시공·검수)이 맡는다 — 이 한 턴만이다. 사용자 팀 설정은 바꾸지 않는다.
    const preparedBrief = store.getCurrent().gameDesignBrief ?? brief;
    setPendingAiBootIntent(buildWelcomeGenrePresetPrompt(preset, preparedBrief), { autoSend, displayText: welcomeGenrePresetDisplayText(preset, preparedBrief), team: true });
    queuedKey = JSON.stringify([scope, store.getCurrent().gameDesignBrief]);
    waitingForConnection = !autoSend;
    if (!autoSend) toast("게임 기획을 저장했습니다. AI가 연결되면 조수가 첫 제작을 자동으로 시작합니다.", "info");
  } catch {
    if (stillCurrent()) {
      store.update(project => {
        if (project.gameDesignBrief) project.gameDesignBrief.generationPending = true;
      }, { scope: "project", label: "게임 기획 전달 대기 유지", origin: "system" });
      toast("게임 기획을 전달하지 못했습니다. 저장 연결을 확인한 뒤 프로젝트 메뉴의 ‘게임 기획’을 열어 주세요.", "error");
    }
  } finally { preparing = false; }
}
