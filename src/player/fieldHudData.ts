import type { Project } from "@/project/types";
import type { PlaySession } from "@/project/session";
import type { HudWidget } from "@/project/fieldHud";
import { formatGameClock } from "@/project/gameTime";
import { handSlotCurrent, handSlotEntries, handSlotIndex } from "./handSlot";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { resolveActorFaceResourceId, resolveActorName } from "@/project/sessionActorCommands";
import { defaultActorFaceResourceId } from "@/project/actorModel";
export interface HudRuntimeContext { stamina?: number; staminaMax?: number; playerX?: number; playerY?: number }
export interface HudEntry { name: string; value?: number; max?: number; icon?: string; key?: string; selected?: boolean }
export interface HudReading { available: boolean; value: number; max: number; text?: string; detail?: string; entries?: HudEntry[] }
const WEATHER: Record<string, string> = { none: "맑음", rain: "비", storm: "폭풍", snow: "눈", fog: "안개" };
export function readHudWidget(widget: HudWidget, project: Project, session: PlaySession, context: HudRuntimeContext): HudReading {
  const actorId = widget.actorId || session.partyActorIds[0] || "";
  const vitals = session.actorVitals[actorId];
  const read = (value: number | undefined, max = widget.max): HudReading => ({ available: value !== undefined && Number.isFinite(value), value: value ?? 0, max: Math.max(1, max) });
  const icon = (id?: string) => resolveAssetResourceUrl(id, { project }) ?? undefined;
  if (widget.kind === "clock") {
    const time = session.gameTime;
    return { ...read(time?.hour), text: time ? formatGameClock(time) : "", detail: time ? `${{spring:"봄", summer:"여름", fall:"가을", winter:"겨울"}[time.season]} ${time.day}일${session.dailyWeather ? ` · ${WEATHER[session.dailyWeather.kind] ?? ""}` : ""}` : "" };
  }
  if (widget.kind === "image") return { ...read(widget.resourceId ? 1 : undefined), text: icon(widget.resourceId) };
  if (widget.kind === "party") return { ...read(session.partyActorIds.length), entries: session.partyActorIds.slice(0, widget.slots).flatMap(id => {
    const actor = project.database.actors.find(a => a.id === id), hp = session.actorVitals[id];
    return actor && hp ? [{ name: resolveActorName(session, actor), value: hp.hp, max: hp.maxHp, icon: icon(resolveActorFaceResourceId(session, actor, project) ?? defaultActorFaceResourceId(actor)) }] : [];
  }) };
  if (widget.kind === "timers") {
    const entries: HudEntry[] = (session.actorStateIds?.[actorId] ?? []).flatMap(id => {
      const state = project.database.states.find(s => s.id === id);
      return state ? [{ name: state.name }] : [];
    });
    if (widget.timerId && session.timers[widget.timerId] > 0) entries.push({ name: widget.label || widget.timerId, value: Math.ceil(session.timers[widget.timerId]) });
    return { ...read(entries.length), entries };
  }
  if (widget.kind === "slots") {
    const index = handSlotIndex(project, session);
    if (widget.source === "tools") {
      const all = handSlotEntries(project, session);
      const current = handSlotCurrent(project, session);
      const start = widget.slots === 1 ? Math.max(0, index - 1) : Math.max(0, Math.min(index - widget.slots, all.length - widget.slots));
      const chosen = widget.slots === 1 ? current ? [current] : [] : all.slice(start, start + widget.slots);
      return { ...read(chosen.length), entries: chosen.map((entry, i) => {
        const slot = start + i + 1;
        return { name: entry.name, value: entry.count, icon: icon(project.database.items.find(item => item.id === entry.itemId)?.iconResourceId), key: slot <= 9 ? String(slot) : "[ ]", selected: slot === index };
      }) };
    }
    const items = widget.itemIds.length ? widget.itemIds.flatMap(id => project.database.items.find(i => i.id === id) ?? []) : project.database.items.filter(item => item.consumable && (session.inventory[item.id] ?? 0) > 0);
    return { ...read(items.reduce((sum, item) => sum + (session.inventory[item.id] ?? 0), 0)), entries: items.slice(0, widget.slots).map(item => ({ name: item.name, value: session.inventory[item.id] ?? 0, icon: icon(item.iconResourceId) })) };
  }
  switch (widget.source) {
    case "hp": return read(vitals?.hp, vitals?.maxHp);
    case "mp": return read(vitals?.mp, vitals?.maxMp);
    case "energy": return read(session.energy, project.system.energy?.max);
    case "stamina": return read(context.stamina, context.staminaMax);
    case "gold": return read(session.gold);
    case "variable": return read(widget.variableId && project.variables.some(v => v.id === widget.variableId) ? session.variables[widget.variableId] ?? 0 : undefined, widget.maxVariableId ? session.variables[widget.maxVariableId] ?? widget.max : widget.max);
    case "timer": return read(widget.timerId ? session.timers[widget.timerId] : undefined);
    case "inventory": return read(widget.itemIds.length ? widget.itemIds.reduce((sum, id) => sum + (session.inventory[id] ?? 0), 0) : undefined);
    case "weather": return { ...read(session.dailyWeather ? 1 : undefined), text: session.dailyWeather ? WEATHER[session.dailyWeather.kind] : undefined };
    case "map": return { ...read(1), text: project.maps[session.currentMapId]?.name ?? "" };
    default: return read(undefined);
  }
}
