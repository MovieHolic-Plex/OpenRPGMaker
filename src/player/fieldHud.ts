import type { Project } from "@/project/types";
import type { PlaySession } from "@/project/session";
import { effectiveFieldHud, fieldHudWidgets, normalizeFieldHud, recommendedHudFont, type HudWidget } from "@/project/fieldHud";
import { isActionCombatMap } from "@/project/actionCombat";
import { resolvePlayResolution } from "@/project/playResolution";
import { readHudWidget, type HudEntry, type HudReading, type HudRuntimeContext } from "./fieldHudData";
import { drawHudWidget, hudNode } from "./fieldHudRender";
export type { HudRuntimeContext } from "./fieldHudData";
interface WidgetLayout { x: number; y: number; width: number; height: number; autoMap: boolean; mapRight: number; avoiding: boolean }
interface WidgetMount {
  node: HTMLElement;
  drawnWidget?: HudWidget;
  seenReading?: HudReading;
  drawnReading?: HudReading;
  layout?: WidgetLayout;
  changedAt: number;
  changedPending?: boolean;
  /** 줄 목록 위젯(동료·상태)의 내용 높이 — 저작 높이는 상한이고, 판은 지금 보이는 줄 수만큼만 차지한다. 아직 못 쟀으면 undefined. */
  fitHeight?: number;
  fitPending?: boolean;
}
/** 줄 수가 플레이 중에 달라지는 위젯 — 판 높이를 내용에 맞춘다(한 명뿐인 파티에 네 명 높이의 판이 화면 왼쪽을 덮었다, 2026-11-12 증기의 심장). */
const LIST_KINDS: readonly HudWidget["kind"][] = ["party", "timers"];
/** Same renderer for authoring preview and shipped player; input belongs to the editor only. */
export class FieldHud {
  readonly root = hudNode("field-hud");
  private readonly mounts = new Map<string, WidgetMount>();
  private configSource: unknown;
  private projectSource: unknown;
  private initialized = false;
  private widgets: HudWidget[] = [];
  private config = normalizeFieldHud(undefined);
  constructor(private readonly host: HTMLElement) {
    this.root.dataset.testid = "field-hud"; host.append(this.root);
  }
  update(project: Project, session: PlaySession, context: HudRuntimeContext = {}): void {
    const hudSource = effectiveFieldHud(project);
    if (this.configSource !== hudSource || this.projectSource !== project || !this.initialized) {
      this.initialized = true;
      this.configSource = hudSource;
      this.projectSource = project;
      this.config = normalizeFieldHud(hudSource);
      // 프리셋 구성에서는 이 게임의 필드에서 바뀔 수 없는 칸(턴제 게임의 체력·마력 막대, 동료 체력 판)을 올리지 않는다 — fieldHudWidgets.
      this.widgets = fieldHudWidgets(project, this.config);
      const wanted = new Set(this.widgets.map(w => w.id));
      for (const [id, mount] of this.mounts) if (!wanted.has(id)) { mount.node.remove(); this.mounts.delete(id); }
      for (const widget of this.widgets) {
        if (!this.mounts.has(widget.id)) {
          const node = hudNode("hud-widget"); node.dataset.widgetId = widget.id; node.dataset.testid = `hud-widget-${widget.id}`;
          if (widget.autoAvoid) node.dataset.autoAvoid = "true";
          this.mounts.set(widget.id, { node, changedAt: -Infinity });
        }
        this.root.append(this.mounts.get(widget.id)!.node);
      }
    }
    const config = this.config, modern = config.theme !== "legacy";
    writeDataset(this.host, "fieldHud", config.theme);
    writeDataset(this.host, "hudObjective", String(!modern || config.objective));
    const uiScale = String(Math.max(1, Math.round((resolvePlayResolution(project.system).height / 240) * 100) / 100));
    if (this.host.style.getPropertyValue("--play-ui-scale") !== uiScale) this.host.style.setProperty("--play-ui-scale", uiScale);
    writeDataset(this.root, "theme", config.theme);
    const font = config.font && config.font !== "auto" ? config.font : recommendedHudFont(config.theme);
    writeDataset(this.host, "hudFont", font);
    writeDataset(this.root, "font", font);
    // 「현재 목표」 줄은 HUD 판 밖(zone-feedback)에 있다. 저자가 글꼴을 직접 고른 때만 따라가게 해 기존 게임 모양은 그대로 둔다.
    if (config.font && config.font !== "auto") writeDataset(this.host, "hudObjectiveFont", config.font);
    else if (this.host.dataset.hudObjectiveFont !== undefined) delete this.host.dataset.hudObjectiveFont;
    // HUD 껍질의 판(project/uiLook.ts) — 목표 줄·알림 띠·조작 안내가 프리셋 칸과 같은 판(종이)으로 선다. 생략 = 어두운 판(지금까지).
    if (config.panel) writeDataset(this.host, "hudPanel", config.panel);
    else if (this.host.dataset.hudPanel !== undefined) delete this.host.dataset.hudPanel;
    if (this.root.hidden !== !modern) this.root.hidden = !modern;
    if (!modern) {
      if (this.host.dataset.hudStamina !== undefined) delete this.host.dataset.hudStamina;
      if (this.host.dataset.hudHp !== undefined) delete this.host.dataset.hudHp;
      return;
    }
    const size = resolvePlayResolution(project.system);
    const action = isActionCombatMap(project, project.maps[session.currentMapId]);
    const now = performance.now();
    let staminaOwned = false, hpOwned = false;
    for (const widget of this.widgets) {
      const mount = this.mounts.get(widget.id)!;
      const reading = readHudWidget(widget, project, session, context);
      if (mount.seenReading && !sameReading(mount.seenReading, reading)) { mount.changedAt = now; mount.changedPending = widget.condition === "changed"; }
      // 대화·메뉴가 HUD 를 가리는 동안 바뀐 값은 다시 보일 때부터 3초를 센다(말 걸기 직후의 호감 변화를 놓치지 않게).
      if (mount.changedPending && this.root.offsetParent !== null) { mount.changedAt = now; mount.changedPending = false; }
      mount.seenReading = reading;
      const condition = widget.condition === "always" ||
        (widget.condition === "damaged" && reading.value < reading.max) ||
        (widget.condition === "low" && reading.value / reading.max <= .25) ||
        (widget.condition === "nonzero" && reading.value > 0) ||
        (widget.condition === "action" && action) ||
        (widget.condition === "switch" && !!widget.switchId && session.switches[widget.switchId] === true) ||
        (widget.condition === "changed" && now - mount.changedAt < 3000);
      const hidden = !widget.enabled || !reading.available || !condition ||
        (widget.hideEmpty && ["slots", "timers", "party"].includes(widget.kind) && reading.value === 0);
      if (mount.node.hidden !== hidden) mount.node.hidden = hidden;
      if (widget.enabled && reading.available && widget.kind === "party" && widget.source !== "friendship") hpOwned = true;
      if (widget.enabled && reading.available && widget.kind === "gauge") {
        if (widget.source === "stamina") staminaOwned = true;
        if (widget.source === "hp") hpOwned = true;
      }
      // 위젯 설정은 설정 객체가 바뀔 때만 새로 정규화되므로(위 configSource) 정체성으로 비교한다.
      // 읽기 값은 필드만 대조한다 — 매 프레임 JSON.stringify 하면 위젯마다 문자열이 생긴다.
      if (widget !== mount.drawnWidget || !sameReading(mount.drawnReading, reading)) {
        drawHudWidget(mount.node, widget, reading);
        mount.drawnReading = reading;
        mount.drawnWidget = widget;
        mount.fitPending = LIST_KINDS.includes(widget.kind);
        if (!mount.fitPending) mount.fitHeight = undefined;
      }
      // 보이는 동안에만 잴 수 있다(대사·메뉴가 HUD 를 가리면 0) — 못 쟀으면 다음 프레임에 다시 잰다. 그동안은 저작 높이다.
      if (mount.fitPending && !hidden && mount.node.offsetParent != null) {
        mount.node.style.height = "auto";
        const natural = mount.node.offsetHeight;
        mount.layout = undefined;
        if (natural > 0) { mount.fitHeight = natural; mount.fitPending = false; }
      }
      let width = Math.min(size.width - 8, widget.width);
      const height = Math.min(size.height - 8, widget.height, mount.fitHeight ?? widget.height);
      let anchor = widget.anchor;
      const bottom = anchor.startsWith("bottom");
      // Keep controls clear of the avatar; switching is based on the authored anchor, never on the moved position.
      if (widget.autoAvoid && context.playerY !== undefined && (bottom ? context.playerY > size.height - height - widget.y - 20 : anchor.startsWith("top") && context.playerY < height + widget.y + 20)) anchor = anchor.replace(bottom ? "bottom" : "top", bottom ? "top" : "bottom") as HudWidget["anchor"];
      let { x, y } = hudAnchorPoint(widget, anchor, size, width, height);
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
        // 목표 창처럼 HUD 판 밖에 고정된 창도 같은 띠에서는 비킨다(가운데보다 오른쪽에 있으면 오른쪽 끝, 아니면 왼쪽 끝).
        for (const fixed of context.fixed ?? []) {
          if (y >= fixed.y + fixed.height + 3 || y + height + 3 <= fixed.y) continue;
          if (fixed.x + fixed.width / 2 >= size.width / 2) right = Math.min(right, fixed.x - 4);
          else left = Math.max(left, fixed.x + fixed.width + 4);
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
      const autoMap = config.theme === "collector" && widget.source === "map";
      const mapRight = autoMap ? size.width - x - 8 : 0;
      const avoiding = anchor !== widget.anchor;
      const layout = mount.layout;
      // Standing still used to assign left/top/width/height every frame (5 strings × each widget).
      if (!layout || layout.x !== x || layout.y !== y || layout.width !== width || layout.height !== height
        || layout.autoMap !== autoMap || layout.mapRight !== mapRight || layout.avoiding !== avoiding) {
        mount.layout = { x, y, width, height, autoMap, mapRight, avoiding };
        Object.assign(mount.node.style, {
          left: `${x}px`, top: `${y}px`,
          width: autoMap ? "auto" : `${width}px`,
          maxWidth: autoMap ? `${mapRight}px` : "",
          height: `${height}px`,
        });
        writeDataset(mount.node, "avoiding", avoiding ? "true" : "false");
      }
    }
    writeDataset(this.host, "hudStamina", String(staminaOwned));
    writeDataset(this.host, "hudHp", String(hpOwned));
  }
  destroy(): void {
    this.root.remove(); this.mounts.clear();
    for (const key of ["fieldHud", "hudFont", "hudObjectiveFont", "hudPanel", "hudObjective", "hudStamina", "hudHp"]) delete this.host.dataset[key];
  }
}

/** 앵커와 저작 좌표에서 칸의 왼쪽 위 — 화면 논리 px, 가장자리 4px 안쪽. 예산 검사(test/fieldHudBudget.test.ts)가 같은 셈으로 프리셋의 자리를 잰다. */
export function hudAnchorPoint(widget: Pick<HudWidget, "x" | "y">, anchor: string, size: { width: number; height: number }, width: number, height: number): { x: number; y: number } {
  const x = anchor.endsWith("right") ? size.width - width - widget.x : anchor.endsWith("center") ? (size.width - width) / 2 + widget.x - 10 : widget.x;
  const y = anchor.startsWith("bottom") ? size.height - height - widget.y : anchor.startsWith("middle") ? (size.height - height) / 2 + widget.y - 10 : widget.y;
  return { x: Math.max(4, Math.min(size.width - width - 4, x)), y: Math.max(4, Math.min(size.height - height - 4, y)) };
}

function writeDataset(node: HTMLElement, key: string, value: string): void {
  if (node.dataset[key] !== value) node.dataset[key] = value;
}

function sameReading(cached: HudReading | undefined, reading: HudReading): boolean {
  if (!cached || cached.available !== reading.available || cached.value !== reading.value || cached.max !== reading.max
    || cached.text !== reading.text || cached.detail !== reading.detail) return false;
  const left = cached.entries;
  const right = reading.entries;
  if (left === right) return true;
  if (!left || !right || left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (!sameEntry(left[index]!, right[index]!)) return false;
  }
  return true;
}

function sameEntry(left: HudEntry, right: HudEntry): boolean {
  return left.name === right.name && left.value === right.value && left.max === right.max
    && left.icon === right.icon && left.key === right.key && left.selected === right.selected;
}
