import type { HudWidget } from "@/project/fieldHud";
import type { HudReading } from "./fieldHudData";
export function hudNode(className: string, text?: string): HTMLDivElement {
  const node = document.createElement("div"); node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function picture(url: string | undefined, name: string): HTMLElement {
  const box = hudNode("hud-art", name.slice(0, 1));
  if (url) {
    const img = document.createElement("img"); img.alt = "";
    img.addEventListener("load", () => { if (box.firstChild?.nodeType === Node.TEXT_NODE) box.firstChild.remove(); }, { once: true });
    img.addEventListener("error", () => img.remove(), { once: true });
    img.src = url; box.append(img);
  }
  return box;
}
export function drawHudWidget(node: HTMLElement, widget: HudWidget, reading: HudReading): void {
  node.replaceChildren();
  node.dataset.kind = widget.kind; node.dataset.shape = widget.shape; node.dataset.panel = widget.panel;
  node.style.setProperty("--hud-accent", widget.color);
  const value = Math.round(reading.value), max = Math.round(reading.max);
  const ratio = Math.max(0, Math.min(1, reading.value / reading.max));
  node.style.setProperty("--hud-ratio", String(ratio));
  node.dataset.low = String(ratio <= .25);
  node.dataset.empty = String(ratio === 0);
  node.dataset.showValue = String(widget.showValue);
  node.setAttribute("aria-label", `${widget.label || widget.kind} ${reading.text ?? `${value} / ${max}`}`);
  for (const attr of ["role", "aria-valuemin", "aria-valuemax", "aria-valuenow"]) node.removeAttribute(attr);
  if (widget.kind === "gauge") {
    node.setAttribute("role", "meter"); node.setAttribute("aria-valuemin", "0");
    node.setAttribute("aria-valuemax", String(max)); node.setAttribute("aria-valuenow", String(Math.max(0, Math.min(max, value))));
  }
  if (widget.label && widget.kind !== "image") node.append(hudNode("hud-label", widget.label));
  if (widget.kind === "gauge") {
    if (widget.shape === "petals") {
      const flower = hudNode("hud-flower");
      flower.append(hudNode("hud-flower-stem"), hudNode("hud-flower-leaf"));
      for (let i = 0; i < 5; i++) {
        const petal = hudNode("hud-petal");
        petal.style.setProperty("--petal-angle", `${i * 72}deg`);
        petal.dataset.alive = String(i < Math.ceil(ratio * 5));
        flower.append(petal);
      }
      flower.append(hudNode("hud-flower-center"));
      node.append(flower);
    } else if (widget.shape === "hearts") {
      const hearts = hudNode("hud-hearts");
      for (let i = 0; i < 5; i++) {
        const heart = hudNode("hud-heart"), fill = hudNode("hud-heart-fill");
        fill.style.width = `${Math.max(0, Math.min(1, ratio * 5 - i)) * 100}%`; heart.append(fill); hearts.append(heart);
      }
      node.append(hearts);
    } else if (widget.shape !== "number") {
      const track = hudNode(`hud-meter hud-meter-${widget.shape}`), fill = hudNode("hud-meter-fill");
      track.append(fill); node.append(track);
    }
    node.append(hudNode("hud-value", `${value} / ${max}`));
  } else if (widget.kind === "clock") {
    node.append(hudNode("hud-date", reading.detail), hudNode("hud-time", reading.text));
  } else if (widget.kind === "slots") {
    const slots = hudNode("hud-slots");
    const entries = reading.entries ?? [];
    for (let i = 0; i < widget.slots; i++) {
      const entry = entries[i], slot = hudNode("hud-slot");
      slot.dataset.selected = String(entry?.selected === true);
      if (entry) {
        slot.setAttribute("aria-label", `${entry.name} ${entry.value ?? 0}개`);
        slot.append(picture(entry.icon, entry.name));
        if (entry.key) slot.append(hudNode("hud-slot-key", entry.key));
        if ((entry.value ?? 0) > 1 || widget.source !== "tools") slot.append(hudNode("hud-slot-count", String(entry.value ?? 0)));
      } else slot.append(hudNode("hud-slot-empty", "·"));
      slots.append(slot);
    }
    node.append(slots);
  } else if (widget.kind === "party") {
    for (const entry of reading.entries ?? []) {
      const row = hudNode("hud-party-row"), body = hudNode("hud-party-body");
      const meter = hudNode("hud-party-meter"), fill = hudNode("hud-party-fill");
      fill.style.width = `${Math.max(0, Math.min(100, (entry.value ?? 0) / (entry.max || 1) * 100))}%`;
      meter.append(fill); body.append(hudNode("hud-party-name", entry.name), meter, hudNode("hud-party-value", `${entry.value} / ${entry.max}`));
      row.append(picture(entry.icon, entry.name), body); node.append(row);
    }
  } else if (widget.kind === "timers") {
    for (const entry of reading.entries ?? []) node.append(hudNode("hud-effect", `${entry.name}${entry.value !== undefined ? ` ${entry.value}s` : ""}`));
  } else if (widget.kind === "image") {
    if (reading.text) node.append(picture(reading.text, widget.label));
  } else node.append(hudNode("hud-text", reading.text ?? value.toLocaleString()));
}
