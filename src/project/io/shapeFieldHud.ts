import { FIELD_HUD_THEMES, HUD_KINDS, HUD_SOURCES, HUD_SHAPES, HUD_ANCHORS, HUD_CONDITIONS, HUD_WIDGET_LIMIT } from "../fieldHud";
import { assert, requireRecord, requireArray, requireString, requireNumber, requireBoolean } from "./guards";
export function validateFieldHud(value: unknown): void {
  const hud = requireRecord("system.fieldHud", value);
  if (hud.theme !== undefined) { requireString("system.fieldHud.theme", hud.theme); assert(Object.hasOwn(FIELD_HUD_THEMES, hud.theme as string), "system.fieldHud.theme is not supported"); }
  for (const key of ["vitals", "clock", "tools", "objective", "hideEmpty"]) if (hud[key] !== undefined) requireBoolean(`system.fieldHud.${key}`, hud[key]);
  if (hud.widgets === undefined) return;
  const widgets = requireArray("system.fieldHud.widgets", hud.widgets);
  assert(widgets.length <= HUD_WIDGET_LIMIT, "system.fieldHud.widgets exceeds 24 elements");
  const ids = new Set<string>();
  for (const [i, raw] of widgets.entries()) {
    const path = `system.fieldHud.widgets[${i}]`, widget = requireRecord(path, raw);
    requireString(`${path}.id`, widget.id);
    const id = widget.id as string;
    assert(id.length > 0 && id.length <= 160 && id === id.trim() && !ids.has(id), `${path}.id must be unique and nonempty`); ids.add(id);
    for (const [key, options] of Object.entries({ kind:HUD_KINDS, source:HUD_SOURCES, shape:HUD_SHAPES, anchor:HUD_ANCHORS, condition:HUD_CONDITIONS, panel:{none:1,paper:1,dark:1} })) {
      if (widget[key] !== undefined) { requireString(`${path}.${key}`, widget[key]); assert(Object.hasOwn(options, widget[key] as string), `${path}.${key} is not supported`); }
    }
    for (const [key, min, max] of [["x",0,1920],["y",0,1080],["width",20,640],["height",14,480],["max",1,999999999],["slots",1,10]] as const) {
      if(widget[key]===undefined)continue;
      requireNumber(`${path}.${key}`,widget[key]); const n=widget[key] as number;
      assert(Number.isFinite(n)&&Number.isInteger(n)&&n>=min&&n<=max,`${path}.${key} is outside ${min}..${max}`);
    }
    for(const key of ["enabled","hideEmpty","autoAvoid"])if(widget[key]!==undefined)requireBoolean(`${path}.${key}`,widget[key]);
    for(const key of ["label","actorId","variableId","maxVariableId","switchId","timerId","resourceId"])if(widget[key]!==undefined){requireString(`${path}.${key}`,widget[key]);assert((widget[key] as string).length<=(key==="label"?60:160),`${path}.${key} is too long`);}
    if(widget.color!==undefined){requireString(`${path}.color`,widget.color);assert(/^#[\da-f]{6}$/i.test(widget.color as string),`${path}.color must be a hex color`);}
    if(widget.itemIds!==undefined){const items=requireArray(`${path}.itemIds`,widget.itemIds);assert(items.length<=10,`${path}.itemIds exceeds 10`);for(const id of items){requireString(`${path}.itemIds`,id);assert((id as string).length>0&&(id as string).length<=160,`${path}.itemIds has invalid id`);}}
  }
}
