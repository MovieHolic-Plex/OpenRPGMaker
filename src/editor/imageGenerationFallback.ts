// 그림 생성이 막혔을 때 조수가 턴을 멈추지 않게 하는 안내 — 가장 가까운 라이브러리 그림(그림 설명으로 찾은 것)과 «계속 짓기».
//
// 왜(2026-10-25 조수 단독 게임 심사, salad-omo-1 「그림 생성이 Google 로그인 요구」 7건): 그림 연결(Google Antigravity 로그인)이 없는
// 실행에서 generate_opening_image·generate_title_art 가 실패했고, 실패 안내가 «번들 스틸로 대체하지 말고 제작을 멈추라»고 시켜
// 조수가 오프닝·타이틀을 글자만으로 두거나 빌드를 멈췄다. 로그인은 이번 실행 안에서 생기지 않으므로 같은 생성을 되풀이해도 소용없다 —
// 설명이 맞는 라이브러리 그림을 두고 나머지를 계속 짓게 하고, 보고에 «새 그림 없음 — 가장 가까운 그림 사용»을 적게 한다.
import { ImageGenerationError } from "@/ai/imageGenerationClient";
import { searchResources } from "@/assets/resourceSearch";

export type ImageFallbackKind = "opening" | "title" | "backdrop" | "picture" | "logo" | "gameOver";

/** 이번 실행 안에서 풀리지 않는 실패(로그인·연결 없음). 일시 오류(시간 초과·5xx)는 아니다. */
export function isImageCredentialFailure(error: unknown): boolean {
  const status = error instanceof ImageGenerationError ? error.status : undefined;
  if (status === 401 || status === 403) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /로그인|연결해 주세요|not (?:logged|signed) in|credential|api key|unauthori[sz]ed/iu.test(message);
}

/** 현대가 아닌 장면을 말하는 설명이면 도시 빌딩 그림을 고르지 않는다(J38 과 같은 이유). */
const PREMODERN = /동화|공방|마법|왕국|기사|성채|중세|판타지|숲|마을|조선|사극|무협|fairy|fantasy|kingdom|castle|medieval|village|forest|wizard/iu;
const CITY = /city|skyline|도시|빌딩|modern/iu;

/** 그림 설명으로 찾은 가장 가까운 라이브러리 그림 몇 장(id·이름). 못 찾으면 빈 목록. */
export function closestLibraryPictures(brief: string, limit = 3): { id: string; name: string }[] {
  const text = brief.replace(/\s+/gu, " ").trim();
  if (!text) return [];
  const premodern = PREMODERN.test(text);
  const words = [text, ...text.split(/[\s,.·「」()]+/u).filter((word) => word.length >= 2)];
  const seen = new Map<string, { id: string; name: string; score: number }>();
  for (const word of words.slice(0, 12)) {
    for (const hit of searchResources("backdrop", word)) {
      const id = hit.resourceId ?? hit.id.replace(/^backdrop:/u, "");
      if (premodern && CITY.test(`${id} ${hit.label} ${hit.description ?? ""}`)) continue;
      const prior = seen.get(id);
      seen.set(id, { id, name: hit.label, score: (prior?.score ?? 0) + hit.score });
    }
  }
  return [...seen.values()].sort((a, b) => b.score - a.score).slice(0, limit).map(({ id, name }) => ({ id, name }));
}

/**
 * 실패 요약 뒤에 붙이는 «다음에 할 일». 로그인·연결이 없으면 다시 부르지 말고 가장 가까운 그림을 두고 계속 짓는다.
 * 일시 오류면 한 번 더 시도해도 되고, 그래도 안 되면 같은 대체로 간다. 어느 쪽이든 턴을 멈추지 않는다.
 */
export function imageFailureNextStep(kind: ImageFallbackKind, brief: string, error: unknown, ownUnused: readonly string[] = []): string {
  const credential = isImageCredentialFailure(error);
  const head = credential
    ? "이번 실행에는 그림 생성 연결(로그인)이 없어 새 그림을 만들 수 없다 — 같은 생성 도구를 다시 부르지 마라."
    : "일시 오류일 수 있으니 한 번만 다시 시도하고, 또 실패하면 아래 대체로 간다.";
  if (kind === "logo") {
    return `${head} 로고 그림 없이 set_title_screen 의 글자 제목(title·logoStyle)으로 두고 나머지 작업을 계속한다. 보고에 «로고 그림 생성 불가 — 글자 제목 사용»을 적는다. 턴을 멈추지 않는다.`;
  }
  const own = ownUnused.length ? `먼저 이 프로젝트에서 아직 안 쓴 전용 그림: ${ownUnused.join(", ")}. ` : "";
  const closest = closestLibraryPictures(brief);
  const library = closest.length
    ? `그림 설명이 가장 가까운 라이브러리 그림: ${closest.map((pick) => `${pick.id}(${pick.name})`).join(", ")} — 쓰기 전에 list_resources{kind:'backdrop', query:'${closest[0]!.id}'} 의 description(그림: …)이 이 장면과 맞는지 읽어라.`
    : "list_resources{kind:'backdrop', query:<장소·분위기 낱말 하나>} 의 description(그림: …)을 읽고 이 장면과 가장 가까운 그림을 고른다.";
  const use = kind === "title" ? "set_title_screen{backgroundResourceId}" : kind === "opening" ? "그 장면·샷의 배경(resourceId)" : kind === "backdrop" ? "맵 배경(set_map_background)" : kind === "gameOver" ? "게임오버 화면 배경" : "그 자리";
  return `${head} ${own}${library} 고른 그림을 ${use}에 두고 나머지 작업을 계속한다. 맞는 그림이 없으면 그림 없이(단색·글자) 두고 계속한다. 보고에 «새 그림 생성 불가 — 가장 가까운 그림 <id> 사용»을 적는다. 이름만 있는 resourceId 를 만들지 않는다. 턴을 멈추지 않는다.`;
}
