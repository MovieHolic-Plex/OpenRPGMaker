// editor/panels/aiProviderIcons.ts
// AI 제공자 브랜드 마크 — 인라인 SVG.
//
// deckIcon(stroke·currentColor) 과 다른 계열이다: Google "G" 는 4색 채움, OpenAI 매듭은
// 단색 채움이라 같은 shape 테이블을 공유하지 않는다. 장식용이므로 aria-hidden — 뜻은
// 감싸는 카드의 텍스트가 든다.

import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";

const SVG_NS = "http://www.w3.org/2000/svg";

type FillPath = { readonly d: string; readonly fill?: string };

const GOOGLE_G: readonly FillPath[] = [
  { fill: "#4285F4", d: "M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" },
  { fill: "#34A853", d: "M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.98 11.98 0 0 0 12 24z" },
  { fill: "#FBBC05", d: "M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.98 11.98 0 0 0 0 10.76l3.98-3.09z" },
  { fill: "#EA4335", d: "M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.97 11.97 0 0 0 12 0C7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" },
];

const OPENAI_KNOT: readonly FillPath[] = [
  { d: "M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.894zm16.596 3.855-5.815-3.354 2.02-1.168a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.494 7.457v-5.716a.79.79 0 0 0-.392-.681zM20.545 7.7l-.141-.085-4.789-2.758a.772.772 0 0 0-.78 0L8.99 8.223V5.89a.078.078 0 0 1 .033-.061l4.833-2.79A4.495 4.495 0 0 1 20.539 7.7zM6 11.683 3.98 10.515a.08.08 0 0 1-.038-.057V4.874a4.506 4.506 0 0 1 7.375-3.453l-.142.08L6.398 4.264a.78.78 0 0 0-.398.68zm8.01 2.701-2.03-1.167-2.01 1.167-2.04-1.172V9.88l2.02-1.163 2.03 1.167 2.01-1.167z" },
];

const BRAND_PATHS: Readonly<Record<string, readonly FillPath[]>> = {
  [ANTIGRAVITY_PROVIDER_ID]: GOOGLE_G,
  [CODEX_PROVIDER_ID]: OPENAI_KNOT,
};

/** 제공자 브랜드 마크. 등록되지 않은 제공자는 null — 호출부가 일반 아이콘으로 대체한다. */
export function aiProviderIcon(providerId: string, size = 18): SVGSVGElement | null {
  const paths = BRAND_PATHS[providerId];
  if (!paths) return null;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "ai-provider-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const { d, fill } of paths) {
    const node = document.createElementNS(SVG_NS, "path");
    node.setAttribute("d", d);
    node.setAttribute("fill", fill ?? "currentColor");
    svg.append(node);
  }
  return svg;
}
