import { registerInlineAssets } from "@/assets/inlineAssetStore";
import {
  STANDALONE_ASSETS_NODE_ID as ASSETS_NODE_ID,
  STANDALONE_PROJECT_NODE_ID as PROJECT_NODE_ID,
} from "@/project/standaloneHtml";

/**
 * 단일 HTML 로 내보낸 게임의 내장 페이로드를 읽는다.
 *
 * `file://` 에서는 fetch 가 막히므로(출처 null) project.json 을 네트워크로 가져올 수 없다.
 * 그래서 스탠드얼론 빌드는 프로젝트와 에셋을 HTML 안 `<script type="application/json">` 에
 * 넣어 두고, 부팅 때 DOM 에서 직접 읽는다.
 *
 * 일반 빌드(웹 서버 배포)에는 이 노드가 없으므로 null 이 나오고 기존 경로가 그대로 돈다.
 */
export interface StandalonePayload {
  readonly projectJson: string;
}

export function readStandalonePayload(): StandalonePayload | null {
  const projectNode = document.getElementById(PROJECT_NODE_ID);
  const projectJson = projectNode?.textContent ?? "";
  if (projectJson.trim() === "") return null;

  const assetsJson = document.getElementById(ASSETS_NODE_ID)?.textContent ?? "";
  if (assetsJson.trim() !== "") {
    // 에셋 표가 깨졌다고 게임을 못 열 이유는 없다 — 그림 없이라도 뜨는 편이 진단에 낫다.
    try {
      registerInlineAssets(JSON.parse(assetsJson) as Record<string, string>);
    } catch {
      console.error("내장 에셋 표를 읽지 못했습니다 — 그림이 빠진 채로 실행합니다.");
    }
  }
  return { projectJson };
}
