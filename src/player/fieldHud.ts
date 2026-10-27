import type { Project } from "@/project/types";
import type { PlaySession } from "@/project/session";
import { effectiveFieldHud, normalizeFieldHud, resolvedHudWidgets, recommendedHudFont, type HudWidget } from "@/project/fieldHud";
import { isActionCombatMap } from "@/project/actionCombat";
import { resolvePlayResolution } from "@/project/playResolution";
import { readHudWidget, type HudRuntimeContext } from "./fieldHudData";
import { drawHudWidget, hudNode } from "./fieldHudRender";
export type { HudRuntimeContext } from "./fieldHudData";
interface WidgetMount { node: HTMLElement; signature: string; drawnWidget?: HudWidget; readingSignature?: string; changedAt: number; changedPending?: boolean }
/** Same renderer for authoring preview and shipped player; input belongs to the editor only. */
export class FieldHud {
  readonly root = hudNode("field-hud");
  private readonly mounts = new Map<string, WidgetMount>();
  private configSource: unknown;
  private initialized = false;
  private widgets: HudWidget[] = [];
  private config = normalizeFieldHud(undefined);
  constructor(private readonly host: HTMLElement) {
    this.root.dataset.testid = "field-hud"; host.append(this.root);
  }
  update(project: Project, session: PlaySession, context: HudRuntimeContext = {}): void {
    const hudSource = effectiveFieldHud(project);
    if (this.configSource !== hudSource || !this.initialized) {
      this.initialized = true;
      this.configSource = hudSource;
      this.config = normalizeFieldHud(hudSource);
      this.widgets = resolvedHudWidgets(this.config);
      const wanted = new Set(this.widgets.map(w => w.id));
      for (const [id, mount] of this.mounts) if (!wanted.has(id)) { mount.node.remove(); this.mounts.delete(id); }
      for (const widget of this.widgets) {
        if (!this.mounts.has(widget.id)) {
          const node = hudNode("hud-widget"); node.dataset.widgetId = widget.id; node.dataset.testid = `hud-widget-${widget.id}`;
          this.mounts.set(widget.id, { node, signature: "", changedAt: -Infinity });
        }
        this.root.append(this.mounts.get(widget.id)!.node);
      }
    }
    const config = this.config, modern = config.theme !== "legacy";
    this.host.dataset.fieldHud = config.theme;
    this.host.dataset.hudObjective = String(!modern || config.objective);
    // 「현재 목표」 줄 글자는 논리 해상도를 따라 커진다 — 1024×768 무대에서 7px 가 그대로 7px 라 읽을 수 없었다(2026-10-27 romance-j91 J105).
    const uiScale = String(Math.max(1, Math.round((resolvePlayResolution(project.system).height / 240) * 100) / 100));
    if (this.host.style.getPropertyValue("--play-ui-scale") !== uiScale) this.host.style.setProperty("--play-ui-scale", uiScale);
    this.root.dataset.theme = config.theme;
    const font = config.font && config.font !== "auto" ? config.font : recommendedHudFont(config.theme);
    this.host.dataset.hudFont = font;
    this.root.dataset.font = font;
    this.root.hidden = !modern;
    if (!modern) { delete this.host.dataset.hudStamina; delete this.host.dataset.hudHp; return; }
    const size = resolvePlayResolution(project.system);
    const action = isActionCombatMap(project, project.maps[session.currentMapId]);
    const now = performance.now();
    let staminaOwned = false, hpOwned = false;
    for (const widget of this.widgets) {
      const mount = this.mounts.get(widget.id)!;
      const reading = readHudWidget(widget, project, session, context);
      const readingSignature = JSON.stringify(reading);
      if (mount.readingSignature !== undefined && mount.readingSignature !== readingSignature) { mount.changedAt = now; mount.changedPending = widget.condition === "changed"; }
      // 대화·메뉴가 HUD 를 가리는 동안 바뀐 값은 다시 보일 때부터 3초를 센다(말 걸기 직후의 호감 변화를 놓치지 않게).
      if (mount.changedPending && this.root.offsetParent !== null) { mount.changedAt = now; mount.changedPending = false; }
      mount.readingSignature = readingSignature;
      const condition = widget.condition === "always" ||
        (widget.condition === "damaged" && reading.value < reading.max) ||
        (widget.condition === "low" && reading.value / reading.max <= .25) ||
        (widget.condition === "nonzero" && reading.value > 0) ||
        (widget.condition === "action" && action) ||
        (widget.condition === "switch" && !!widget.switchId && session.switches[widget.switchId] === true) ||
        (widget.condition === "changed" && now - mount.changedAt < 3000);
      mount.node.hidden = !widget.enabled || !reading.available || !condition ||
        (widget.hideEmpty && ["slots", "timers", "party"].includes(widget.kind) && reading.value === 0);
      if (widget.enabled && reading.available && widget.kind === "party" && widget.source !== "friendship") hpOwned = true;
      if (widget.enabled && reading.available && widget.kind === "gauge") {
        if (widget.source === "stamina") staminaOwned = true;
        if (widget.source === "hp") hpOwned = true;
      }
      // 위젯 설정은 설정 객체가 바뀔 때만 새로 정규화되므로(위 configSource) 정체성으로 비교한다.
      // 예전에는 매 프레임 위젯마다 [widget, reading] 전체를 JSON.stringify 했다.
      if (widget !== mount.drawnWidget || readingSignature !== mount.signature) {
        drawHudWidget(mount.node, widget, reading);
        mount.signature = readingSignature;
        mount.drawnWidget = widget;
      }
      let width = Math.min(size.width - 8, widget.width);
      const height = Math.min(size.height - 8, widget.height);
      let anchor = widget.anchor;
      const bottom = anchor.startsWith("bottom");
      // Keep controls clear of the avatar; switching is based on the authored anchor, never on the moved position.
      if (widget.autoAvoid && context.playerY !== undefined && (bottom ? context.playerY > size.height - height - widget.y - 20 : anchor.startsWith("top") && context.playerY < height + widget.y + 20)) anchor = anchor.replace(bottom ? "bottom" : "top", bottom ? "top" : "bottom") as HudWidget["anchor"];
      let x = anchor.endsWith("right") ? size.width - width - widget.x : anchor.endsWith("center") ? (size.width - width) / 2 + widget.x - 10 : widget.x;
      let y = anchor.startsWith("bottom") ? size.height - height - widget.y : anchor.startsWith("middle") ? (size.height - height) / 2 + widget.y - 10 : widget.y;
      x = Math.max(4, Math.min(size.width - width - 4, x)); y = Math.max(4, Math.min(size.height - height - 4, y));
      if (anchor !== widget.anchor) {
        // Auto-relocated controls must also clear fixed panels such as the calendar.
        let left = 4, right = size.width - 4;
        for (const other of this.widgets) {
          if (other.id === widget.id || other.autoAvoid) continue;
          const element = this.mounts.get(other.id)?.node;
          if (!element || element.hidden) continue;
          const ox = parseFloat(element.style.left), oy = parseFloat(element.style.top);
          const ow = parseFloat(element.style.width), oh = parseFloat(element.style.height);
          if (y >= oy + oh + 3 || y + height + 3 <= oy) continue;
          if (other.anchor.endsWith("right")) right = Math.min(right, ox - 4);
          else if (other.anchor.endsWith("left")) left = Math.max(left, ox + ow + 4);
        }
        if (right - left >= Math.min(width, Math.max(80, widget.slots * 14))) {
          width = Math.min(width, right - left);
          x = Math.max(left, Math.min(right - width, x));
        }
        for (let pass = 0; pass < this.widgets.length; pass++) {
          let blocked = false;
          for (const other of this.widgets) {
            if (other.id === widget.id || other.autoAvoid) continue;
            const element = this.mounts.get(other.id)?.node;
            if (!element || element.hidden) continue;
            const ox = parseFloat(element.style.left), oy = parseFloat(element.style.top);
            const ow = parseFloat(element.style.width), oh = parseFloat(element.style.height);
            if (x < ox + ow + 3 && x + width + 3 > ox && y < oy + oh + 3 && y + height + 3 > oy) {
              y = bottom ? oy + oh + 4 : oy - height - 4;
              blocked = true;
            }
          }
          y = Math.max(4, Math.min(size.height - height - 4, y));
          if (!blocked) break;
        }
      }
      const autoMapWidth = config.theme === "collector" && widget.source === "map";
      Object.assign(mount.node.style, { left: `${x}px`, top: `${y}px`, width: autoMapWidth ? "auto" : `${width}px`, maxWidth: autoMapWidth ? `${size.width - x - 8}px` : "", height: `${height}px` });
      mount.node.dataset.avoiding = String(anchor !== widget.anchor);
    }
    this.host.dataset.hudStamina = String(staminaOwned);
    this.host.dataset.hudHp = String(hpOwned);
  }
  destroy(): void {
    this.root.remove(); this.mounts.clear();
    for (const key of ["fieldHud", "hudFont", "hudObjective", "hudStamina", "hudHp"]) delete this.host.dataset[key];
  }
}
