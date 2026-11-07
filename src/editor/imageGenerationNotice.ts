// editor/imageGenerationNotice.ts
// 「그림 생성이 연결되지 않았다」를 한 코드·한 문장으로 모으는 잎 모듈(DOM 없음).
//
// 왜 필요한가 (2026-11-07 실측): generate_opening_image 의 run() 은 네트워크를 부르지 않고
// 즉시 image-generation-unavailable 로 던졌고, 그 뒤에는 editor/imageGenerationFallback 의
// 「가장 가까운 라이브러리 그림을 두고 계속 짓는다」가 이어져 조수가 **조용히** 번들 그림으로
// 오프닝을 완성했다 — 실제 에이전트 실행에서 사용자는 「이 게임에 생성된 그림이 없다」는 사실을
// 어디에서도 듣지 못했다. 오너 요구(그대로): 「없으면 사용자에게 강하게 알려줘야하고 … 조용한 계속 금지.」
// 그래서 판정·문장·툴 오류가 이 파일 하나에서 나오고, 에디터 표면과 차단 모달이 같은 문장을 쓴다.
import { companionCredentialMissing } from "@/ai/chatgptOAuthClient";
import { loadAiConfig, type AiConfig } from "@/ai/llmClient";
import { DEFAULT_IMAGE_PROVIDER_ID } from "@/ai/imageModelCatalog";
import { resolveImageRoute } from "@/ai/imageRoute";
import type { AiGateNotice } from "@/ai/aiGateNotice";
import { ToolError } from "@/editor/tools/types";

export const IMAGE_GENERATION_UNAVAILABLE_CODE = "image-generation-unavailable";

/** 사용자 화면과 조수 보고가 함께 쓰는 한 문장 — 무엇이 안 되는지 + 한 걸음 해결책. */
export const IMAGE_GENERATION_UNAVAILABLE_NOTICE =
  "그림 생성 계정이 연결되지 않아 오프닝·게임오버·아이콘·맵 배경 그림은 만들어지지 않습니다 — AI 설정 → 「그림·도트 모델」에서 이미지 모델 계정을 연결하세요.";

export function imageGenerationUnavailableInstruction(): string {
  return `${IMAGE_GENERATION_UNAVAILABLE_NOTICE} 보고에 이 사실을 적어라: ${IMAGE_GENERATION_UNAVAILABLE_NOTICE} 생성한 것처럼 보고하거나 이 사실을 빼고 작업을 계속하지 마라.`;
}

export type ImageGenerationAvailability =
  | { readonly available: true; readonly providerId: string }
  | { readonly available: false; readonly providerId: string };

/**
 * 순수 판정 — 이미 있는 판정기만 쓴다(resolveImageRoute + 주입된 자격 조회 결과).
 * 기본 제공자(ChatGPT)에 자격이 없으면 **다른 제공자로 대신하지 않는다** — 오너 규칙(2026-11-07):
 * 「이미지는 chatgpt 로 그려」. Google 로 조용히 갈아타는 것이 바로 그 규칙의 위반이다.
 */
export function imageGenerationAvailability(
  config: AiConfig,
  credentialMissing: (providerId: string) => boolean,
): ImageGenerationAvailability {
  const route = resolveImageRoute("opening-still", config);
  if (route.kind !== "generative") return { available: false, providerId: DEFAULT_IMAGE_PROVIDER_ID };
  const providerId = route.providerId;
  return { available: !credentialMissing(providerId), providerId };
}

/**
 * 실제 자격으로 판정한다. companionCredentialMissing 은 동반 서비스에 닿지 못하면 false(모른다)이므로
 * 조회 실패는 막지 않는다 — 모르는 상태로 사용자를 가두지 않는다(잠금 막과 같은 판단).
 */
export async function probeImageGenerationAvailability(
  config: AiConfig = loadAiConfig(),
): Promise<ImageGenerationAvailability> {
  const route = resolveImageRoute("opening-still", config);
  if (route.kind !== "generative") return { available: false, providerId: DEFAULT_IMAGE_PROVIDER_ID };
  const missing = new Map<string, boolean>();
  const lookup = async (providerId: string): Promise<void> => {
    if (missing.has(providerId)) return;
    missing.set(providerId, await companionCredentialMissing(providerId));
  };
  await lookup(route.providerId);
  return imageGenerationAvailability(config, (providerId) => missing.get(providerId) === true);
}

export function imageGenerationUnavailableError(): ToolError {
  return new ToolError(imageGenerationUnavailableInstruction(), { code: IMAGE_GENERATION_UNAVAILABLE_CODE });
}

/**
 * 「이 실행 경로에는 그림 생성기가 연결돼 있지 않다」 — 도구 이름과 한 걸음 해결책을 함께 돌려준다.
 * read 모드 도구가 `{status:"ui-required"}` 를 **성공**으로 돌려주면 모델은 그림이 생겼다고 읽는다(2026-11-07 실측).
 * 세션은 이 도구들을 run 전에 가로채므로, 여기까지 오는 호출은 생성기가 없는 경로뿐이다.
 */
export function imageGenerationHandoffRefusedError(toolName: string, alternative: string): ToolError {
  return new ToolError(
    `${toolName}: 이 실행 경로에는 그림 생성기가 붙어 있지 않아 아무 그림도 만들어지지 않았습니다(나중에 도착하지도 않습니다). ${alternative} 생성한 것처럼 보고하지 마라.`,
    { code: IMAGE_GENERATION_UNAVAILABLE_CODE },
  );
}

/** aiGateNotice + ui/aiGateModal 로 올릴 내용. 모달 껍데기는 기존 것을 그대로 쓴다. */
export function imageUnavailableGateNotice(): AiGateNotice {
  return {
    kind: "image-unavailable",
    title: "그림 생성이 연결되지 않았습니다",
    headline: "이번 요청에서 새로 만들어진 그림은 없습니다 — 게임에는 생성된 그림이 들어가지 않았습니다.",
    reasons: [IMAGE_GENERATION_UNAVAILABLE_NOTICE],
    nextSteps: ["AI 설정 → 「그림·도트 모델」에서 이미지 모델 계정을 연결한 뒤 같은 요청을 다시 보내세요."],
  };
}

export function isImageGenerationUnavailableCode(code: string | undefined): boolean {
  return code === IMAGE_GENERATION_UNAVAILABLE_CODE;
}
