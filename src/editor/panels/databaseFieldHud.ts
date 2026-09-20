import type { Project } from "@/project/types";
import { FIELD_HUD_THEMES, HUD_KINDS, HUD_SOURCES, HUD_SHAPES, HUD_ANCHORS, HUD_CONDITIONS, HUD_WIDGET_LIMIT, hudPreset, normalizeFieldHud, normalizeHudWidget, resolvedHudWidgets, type FieldHudConfig, type HudWidget } from "@/project/fieldHud";
import { startSession } from "@/project/session";
import { resolvePlayResolution } from "@/project/playResolution";
import { FieldHud } from "@/player/fieldHud";
import { renderRegionSnapshot } from "@/editor/regionSnapshot";
import { resourcePickerControl } from "./databaseResourcePickerDialog";
import "./databaseFieldHud.css";
const node = (tag: string, className: string, text?: string): HTMLElement => {
  const element = document.createElement(tag); element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
export function fieldHudEditor(project: Project, save: (config: FieldHudConfig) => void): HTMLElement {
  let config = normalizeFieldHud(project.system.fieldHud);
  let widgets = resolvedHudWidgets(config);
  let selected = widgets[0]?.id ?? "";
  let scenario = "normal";
  let previewSession = startSession(project, 1);
  const root = node("section", "hud-studio"); root.dataset.testid = "db-field-hud";
  const presets = node("div", "hud-studio-presets");
  const status = node("p", "hud-studio-status"); status.setAttribute("role", "status");
  const layout = node("div", "hud-studio-layout");
  const left = node("section", "hud-studio-panel"), list = node("div", "hud-studio-list");
  const center = node("section", "hud-studio-preview");
  const inspector = node("section", "hud-studio-panel hud-studio-inspector"); inspector.dataset.testid = "hud-inspector";
  const viewport = node("div", "hud-studio-viewport"), stage = node("div", "hud-studio-stage");
  viewport.append(stage);
  const resolution = resolvePlayResolution(project.system);
  Object.assign(stage.style, { width: `${resolution.width}px`, height: `${resolution.height}px` });
  const map = project.maps[project.startMapId];
  if (map) {
    const columns = Math.min(map.width, Math.ceil(resolution.width / map.tileSize));
    const rows = Math.min(map.height, Math.ceil(resolution.height / map.tileSize));
    void renderRegionSnapshot(project, map, {
      x: Math.max(0, Math.min(map.width - columns, project.startPos.x - Math.floor(columns / 2))),
      y: Math.max(0, Math.min(map.height - rows, project.startPos.y - Math.floor(rows / 2))),
      width: columns, height: rows,
    }, { targetWidth: resolution.width }).then(canvas => {
      stage.style.backgroundImage = `url("${canvas.toDataURL()}")`;
    }).catch(() => { status.textContent = "맵 배경을 불러오지 못했습니다. HUD 편집은 계속할 수 있습니다."; });
  }
  const hud = new FieldHud(stage);
  function button(text: string, action: () => void, testid?: string): HTMLButtonElement {
    const button = document.createElement("button"); button.type = "button"; button.textContent = text;
    if (testid) button.dataset.testid = testid;
    button.addEventListener("click", action); return button;
  }
  function commit(message = "HUD 설정을 변경했습니다.") {
    config = normalizeFieldHud({ ...config, widgets }); widgets = config.widgets!;
    save(config); status.textContent = message; renderList(); paint();
  }
  function paint() {
    const previewProject = {
      ...project,
      ...(scenario === "action" ? { maps: { ...project.maps, [previewSession.currentMapId]: { ...project.maps[previewSession.currentMapId], actionCombat: true } } } : {}),
      system: { ...project.system, ...(scenario === "action" ? { actionCombat: { ...project.system.actionCombat, enabled: true } } : {}), fieldHud: { ...config, widgets } },
    };
    const context = { stamina: scenario === "action" ? 58 : undefined, staminaMax: 100, playerY: scenario === "edge" ? resolution.height - 12 : resolution.height / 2 };
    hud.update(previewProject, previewSession, context);
    hud.root.style.visibility = scenario === "dialogue" ? "hidden" : "";
    for (const element of stage.querySelectorAll<HTMLElement>(".hud-widget")) {
      element.dataset.selected = String(element.dataset.widgetId === selected); element.tabIndex = 0;
      element.setAttribute("aria-label", `${widgets.find(w => w.id === element.dataset.widgetId)?.label || "HUD 요소"} · 방향키로 이동`);
    }
    for (const element of presets.querySelectorAll<HTMLElement>("button")) element.setAttribute("aria-pressed", String(element.dataset.theme === config.theme));
  }
  function choose(id: string) { selected = id; renderList(); renderInspector(); paint(); }
  function patch(patch: Partial<HudWidget>, rebuild = false) {
    widgets = widgets.map(w => w.id === selected ? normalizeHudWidget({ ...w, ...patch }) : w);
    commit(); if (rebuild) renderInspector();
  }
  function renderList() {
    list.replaceChildren();
    for (const widget of widgets) {
      const row = button(widget.label || HUD_KINDS[widget.kind], () => choose(widget.id), `hud-select-${widget.id}`);
      row.setAttribute("aria-pressed", String(widget.id === selected));
      row.append(node("small", "", widget.enabled ? HUD_KINDS[widget.kind] : "숨김")); list.append(row);
    }
  }
  function field(label: string, control: HTMLElement): HTMLElement {
    const wrapper = node("label", "hud-studio-field"); wrapper.append(node("span", "", label), control); return wrapper;
  }
  function select(label: string, value: string, options: Record<string, string>, change: (value: string) => void, testid: string): HTMLElement {
    const control = document.createElement("select"); control.dataset.testid = testid;
    for (const [key, name] of Object.entries(options)) { const option = document.createElement("option"); option.value = key; option.textContent = name; control.append(option); }
    control.value = value; control.addEventListener("change", () => change(control.value)); return field(label, control);
  }
  function input(label: string, key: keyof HudWidget, widget: HudWidget, type = "text"): HTMLElement {
    const control = document.createElement("input"); control.type = type; control.value = String(widget[key] ?? ""); control.dataset.testid = `hud-field-${key}`;
    if (type === "number") { control.min = ["max", "slots"].includes(key) ? "1" : "0"; control.step = "1"; }
    control.addEventListener("change", () => { patch({ [key]: type === "number" ? Number(control.value) : control.value }); control.value = String(widgets.find(w => w.id === selected)?.[key] ?? ""); }); return field(label, control);
  }
  function check(label: string, key: "enabled" | "hideEmpty" | "autoAvoid", widget: HudWidget): HTMLElement {
    const wrapper = node("label", "hud-studio-check"), control = document.createElement("input"); control.type = "checkbox"; control.checked = widget[key]; control.dataset.testid = `hud-field-${key}`;
    control.addEventListener("change", () => patch({ [key]: control.checked })); wrapper.append(control, label); return wrapper;
  }
  function renderInspector() {
    inspector.replaceChildren(node("h3", "hud-studio-heading", "요소 속성"));
    const widget = widgets.find(w => w.id === selected);
    if (!widget) { inspector.append(node("p", "hud-studio-hint", "요소를 추가하거나 선택하세요.")); return; }
    inspector.append(input("이름", "label", widget), select("요소", widget.kind, HUD_KINDS, value => {
      const kind = value as HudWidget["kind"];
      const source = kind === "slots" ? "tools" : kind === "gauge" && ["tools", "weather", "map"].includes(widget.source) ? "hp" : widget.source;
      patch({ kind, source }, true);
    }, "hud-field-kind"));
    if (["gauge", "text", "slots"].includes(widget.kind)) {
      const sources = widget.kind === "slots" ? { tools: HUD_SOURCES.tools, inventory: HUD_SOURCES.inventory } : Object.fromEntries(Object.entries(HUD_SOURCES).filter(([key]) => !(widget.kind === "gauge" ? ["tools", "weather", "map"] : ["tools"]).includes(key)));
      inspector.append(select("연결할 데이터", widget.source, sources, value => patch({ source: value as HudWidget["source"] }, true), "hud-field-source"));
      if (["hp", "mp"].includes(widget.source)) inspector.append(select("배우", widget.actorId ?? "", { "": "선두 배우", ...Object.fromEntries(project.database.actors.map(a => [a.id, a.name])) }, value => patch({ actorId: value }), "hud-field-actorId"));
      if (widget.source === "variable") {
        const variables = Object.fromEntries(project.variables.map(v => [v.id, v.name || v.id]));
        inspector.append(select("변수", widget.variableId ?? "", { "": "선택하세요", ...variables }, value => patch({ variableId: value }), "hud-field-variableId"), select("최댓값 변수", widget.maxVariableId ?? "", { "": "고정 최댓값 사용", ...variables }, value => patch({ maxVariableId: value }), "hud-field-maxVariableId"));
      }
      if (["variable", "timer", "inventory", "gold"].includes(widget.source)) inspector.append(input("최댓값", "max", widget, "number"));
    }
    if (widget.kind === "gauge") inspector.append(select("표현", widget.shape, HUD_SHAPES, value => patch({ shape: value as HudWidget["shape"] }), "hud-field-shape"));
    if (widget.kind === "slots" || widget.kind === "party") inspector.append(input("표시 칸 수", "slots", widget, "number"));
    if (widget.source === "inventory" && ["slots", "gauge", "text"].includes(widget.kind)) {
      const items = node("div", "hud-studio-inventory");
      for (const item of project.database.items) {
        const row = node("label", "hud-studio-check"), control = document.createElement("input"); control.type = "checkbox"; control.checked = widget.itemIds.includes(item.id);
        control.addEventListener("change", () => { const current = widgets.find(w => w.id === selected)!; patch({ itemIds: control.checked ? [...current.itemIds, item.id].slice(0, 10) : current.itemIds.filter(id => id !== item.id) }); });
        row.append(control, item.name); items.append(row);
      }
      inspector.append(field("아이템 · 최대 10개", items), node("p", "hud-studio-hint", "슬롯의 선택이 비어 있으면 보유한 소모품을 표시합니다. 음식 효과·만료 시간은 만들지 않습니다."));
    }
    if (widget.source === "timer" || widget.kind === "timers") inspector.append(select("타이머", widget.timerId ?? "", { "": "연결 안 함", timer1: "타이머 1", timer2: "타이머 2" }, value => patch({ timerId: value }), "hud-field-timerId"));
    if (widget.kind === "image") inspector.append(resourcePickerControl({ label: "이미지", resourceId: widget.resourceId, kind: "picture", testid: "hud-field-resourceId", allowClear: true, onChange: result => patch({ resourceId: result.resourceId }), rerender: renderInspector }));
    inspector.append(select("고정 위치", widget.anchor, HUD_ANCHORS, value => patch({ anchor: value as HudWidget["anchor"] }), "hud-field-anchor"));
    for (const fields of [["x", "y"], ["width", "height"]] as const) {
      const row = node("div", "hud-studio-row"); row.append(...fields.map(key => input(({ x:"가로 여백", y:"세로 여백", width:"너비", height:"높이" })[key], key, widget, "number"))); inspector.append(row);
    }
    inspector.append(input("강조색", "color", widget, "color"), select("패널", widget.panel, { none:"없음", paper:"종이 · 나무", dark:"어두운 유리" }, value => patch({ panel: value as HudWidget["panel"] }), "hud-field-panel"));
    inspector.append(select("표시 조건", widget.condition, HUD_CONDITIONS, value => patch({ condition: value as HudWidget["condition"] }, true), "hud-field-condition"));
    if (widget.condition === "switch") inspector.append(select("스위치", widget.switchId ?? "", { "":"선택하세요", ...Object.fromEntries(project.switches.map(s => [s.id, s.name || s.id])) }, value => patch({ switchId: value }), "hud-field-switchId"));
    inspector.append(check("사용", "enabled", widget), check("비어 있으면 숨김", "hideEmpty", widget), check("플레이어가 다가오면 위·아래 이동", "autoAvoid", widget));
    const unavailable = widget.source === "energy" && !project.system.energy ? "생활 에너지를 사용하려면 시스템의 에너지 기능을 켜세요." : widget.source === "stamina" ? "액션 전투의 스태미나가 활성화된 맵에서 표시됩니다. 전투 예시로 배치를 확인할 수 있습니다." : widget.kind === "clock" && !project.system.timeSystem?.enabled ? "시계를 사용하려면 시스템 → 시간에서 시간 기능을 켜세요." : widget.source === "variable" && !widget.variableId ? "연결할 프로젝트 변수를 선택하세요." : "";
    if (unavailable) inspector.append(node("p", "hud-studio-warning", unavailable));
  }
  for (const [theme, label] of Object.entries(FIELD_HUD_THEMES)) {
    const control = button(label, () => {
      config = { ...config, theme: theme as FieldHudConfig["theme"] }; widgets = hudPreset(config.theme); selected = widgets[0]?.id ?? "";
      commit(`${label} 구성을 불러왔습니다. 이전 구성은 실행 취소로 복원할 수 있습니다.`); renderInspector();
    }, `db-hud-theme-${theme}`); control.dataset.theme = theme; presets.append(control);
  }
  const addType = document.createElement("select"); addType.dataset.testid = "hud-add-kind";
  for (const [key,label] of Object.entries(HUD_KINDS)) { const option = document.createElement("option"); option.value = key; option.textContent = label; addType.append(option); }
  left.append(node("h3", "hud-studio-heading", "구성 요소"), list, field("추가할 요소", addType), button("+ 요소 추가", () => {
    if (widgets.length >= HUD_WIDGET_LIMIT) { status.textContent = "HUD는 최대 24개 요소를 지원합니다."; return; }
    const kind = addType.value as HudWidget["kind"];
    const widget = normalizeHudWidget({ id: `hud-${crypto.randomUUID()}`, kind, label: HUD_KINDS[kind], source: kind === "slots" ? "tools" : "hp", anchor:"middle-center" });
    widgets = [...widgets, widget]; selected = widget.id; if(config.theme === "legacy") config.theme = "minimal"; commit(); renderInspector();
  }, "hud-add"));
  const actions = node("div", "hud-studio-actions");
  actions.append(button("복제", () => { const current = widgets.find(w => w.id === selected); if (!current || widgets.length >= HUD_WIDGET_LIMIT) return; const copy = { ...current, id:`hud-${crypto.randomUUID()}`, label:`${current.label} 복사`, y:current.y+8 }; widgets = [...widgets,copy]; selected=copy.id; commit(); renderInspector(); }, "hud-duplicate"), button("삭제", () => { widgets=widgets.filter(w=>w.id!==selected); selected=widgets[0]?.id ?? ""; commit(); renderInspector(); }, "hud-delete"));
  for (const [label, delta] of [["위로", -1], ["아래로", 1]] as const) actions.append(button(label, () => { const i=widgets.findIndex(w=>w.id===selected), j=i+delta; if(i<0||j<0||j>=widgets.length)return; [widgets[i],widgets[j]]=[widgets[j],widgets[i]]; commit(); }));
  left.append(actions);
  const scenarios = node("div", "hud-studio-scenarios");
  for (const [key,label] of Object.entries({ normal:"시작 상태", low:"저체력 예시", action:"전투 예시", edge:"화면 아래 접근", dialogue:"대화 중" })) scenarios.append(button(label, () => {
    scenario=key; previewSession=startSession(project,1);
    if(key==="low") for(const vitals of Object.values(previewSession.actorVitals)) vitals.hp=Math.round(vitals.maxHp*.2);
    for(const child of scenarios.children) child.setAttribute("aria-pressed",String(child.textContent===label)); paint();
  }, `hud-preview-${key}`));
  center.append(node("h3","hud-studio-heading","배치 미리보기"),viewport,scenarios,node("p","hud-studio-hint","시작 맵 배경 · 시작 파티 데이터. 드래그 또는 방향키로 이동합니다. 흐린 요소는 현재 상태에서 숨겨집니다. 예시 상태는 저장되지 않습니다."));
  const objective = document.createElement("input"); objective.type="checkbox"; objective.checked=config.objective; objective.dataset.testid="hud-objective";
  objective.addEventListener("change",()=>{config.objective=objective.checked;commit();});
  const objectiveLabel=node("label","hud-studio-check"); objectiveLabel.append(objective,"기존 목표 안내도 표시"); center.append(objectiveLabel);
  stage.addEventListener("pointerdown", event => {
    const target=(event.target as HTMLElement).closest<HTMLElement>(".hud-widget"); if(!target || event.button!==0)return;
    event.preventDefault(); choose(target.dataset.widgetId!); target.focus();
    const before=widgets.find(w=>w.id===selected)!; const scale=stage.getBoundingClientRect().width/resolution.width;
    let moved=false;
    const startX=event.clientX, startY=event.clientY, x=parseFloat(target.style.left), y=parseFloat(target.style.top);
    stage.setPointerCapture(event.pointerId);
    const move=(e:PointerEvent)=>{ moved=true; widgets=widgets.map(w=>w.id===selected ? { ...w,anchor:"top-left",x:Math.round(Math.max(4,Math.min(resolution.width-w.width-4,x+(e.clientX-startX)/scale))),y:Math.round(Math.max(4,Math.min(resolution.height-w.height-4,y+(e.clientY-startY)/scale))) }:w);paint(); };
    const finish=(e:PointerEvent)=>{ stage.removeEventListener("pointermove",move);stage.removeEventListener("pointerup",finish);stage.removeEventListener("pointercancel",cancel);if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);if(moved)commit("배치를 변경했습니다.");renderInspector(); };
    const cancel=()=>{stage.removeEventListener("pointermove",move);stage.removeEventListener("pointerup",finish);stage.removeEventListener("pointercancel",cancel);widgets=widgets.map(w=>w.id===before.id?before:w);paint();};
    stage.addEventListener("pointermove",move);stage.addEventListener("pointerup",finish);stage.addEventListener("pointercancel",cancel);
  });
  stage.addEventListener("keydown",event=>{ const delta:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}; const change=delta[event.key]; const target=(event.target as HTMLElement).closest<HTMLElement>(".hud-widget"); if(!change||!target)return;event.preventDefault();selected=target.dataset.widgetId!;const step=event.shiftKey?8:1;patch({anchor:"top-left",x:parseFloat(target.style.left)+change[0]*step,y:parseFloat(target.style.top)+change[1]*step},true);});
  const resize=new ResizeObserver(()=>{if(!root.isConnected){resize.disconnect();hud.destroy();return;}const width=viewport.clientWidth;if(!width)return;const scale=width/resolution.width;stage.style.transform=`scale(${scale})`;viewport.style.aspectRatio=`${resolution.width}/${resolution.height}`;});resize.observe(viewport);
  layout.append(left,center,inspector);root.append(node("p","hud-studio-hint","프리셋으로 시작한 뒤 요소별 데이터·표현·위치·표시 조건을 편집하세요. 프리셋을 다시 누르면 구성이 교체됩니다."),presets,layout,status);
  renderList();renderInspector();paint();return root;
}
