import type { Project } from "@/project/types";
import type { PlaySession } from "@/project/session";
import type { ShopGoods } from "@/player/playSceneShopGoods";
import { previewShopEquipment, type ShopEquipmentPreview } from "@/player/shopEquipmentPreview";

/**
 * 파티원 한 명에게 이 물건이 어떤지 — 목록 행의 ▲▼ 표시와 파티 카드 한 줄의 원천.
 * 수치는 전부 previewShopEquipment(실제 장비 교체 규칙) 에서 온다. 여기서 새로 계산하지 않는다.
 */
export type ShopFitMark = "up" | "down" | "even" | "equipped" | "blocked";
export interface ShopActorFit {
  readonly actorId: string;
  readonly name: string;
  readonly mark: ShopFitMark;
  /** 카드에 쓰는 한 줄. 예: "공격 +6", "장착 중", "장비 불가". */
  readonly label: string;
  /** 카드 두 줄 — 크기 순으로 바뀌는 능력치 최대 두 개. 변화가 없거나 장착 불가면 label 한 줄. */
  readonly lines: readonly { readonly text: string; readonly tone: "up" | "down" | "muted" | "equipped" }[];
  /** 네 능력치 증감의 합. 장착 불가·같은 장비는 0. 어느 동료에게 가장 이득인지 고를 때만 쓴다. */
  readonly score: number;
}

const STAT_NAMES = { attack: "공격", defense: "방어", mind: "정신", agility: "민첩" } as const;
const BLOCKED_LABELS: Readonly<Record<string, string>> = {
  notEquippable: "장비 불가", invalidSlot: "장비 불가", fixedEquipment: "장비 고정",
  cursedEquipment: "저주 장비", insufficientInventory: "교체 불가", missingActor: "장비 불가",
  missingEquipment: "장비 불가",
};

const signed = (value: number) => (value > 0 ? "+" + value : value < 0 ? "−" + -value : "±0");

/** 미리보기 하나를 표시 한 칸으로. 장비가 아니면 null. */
export function fitFromPreview(actorId: string, preview: ShopEquipmentPreview): ShopActorFit | null {
  if (preview.kind === "unavailable") return null;
  const name = preview.targets.find(target => target.actorId === actorId)?.name ?? actorId;
  if (preview.kind === "blocked") {
    const label = BLOCKED_LABELS[preview.reason] ?? "교체 불가";
    return { actorId, name, mark: "blocked", label, score: 0, lines: [{ text: label, tone: "muted" }] };
  }
  if (preview.sameEquipment) return { actorId, name, mark: "equipped", label: "장착 중", score: 0, lines: [{ text: "장착 중", tone: "equipped" }] };
  const deltas = preview.stats.filter(stat => stat.delta !== 0);
  if (deltas.length === 0) return { actorId, name, mark: "even", label: "변화 없음", score: 0, lines: [{ text: "변화 없음", tone: "muted" }] };
  const score = deltas.reduce((sum, stat) => sum + stat.delta, 0);
  // 총합이 이득이면 가장 크게 오르는 값을, 손해면 가장 크게 떨어지는 값을 대표로 보인다.
  // (방어 −10 인데 민첩 +3 을 앞세우면 카드가 거짓말을 한다.) 합이 0 인 맞교환은 둘 다 보인다.
  const gain = [...deltas].sort((a, b) => b.delta - a.delta)[0];
  const loss = [...deltas].sort((a, b) => a.delta - b.delta)[0];
  const mark: ShopFitMark = score > 0 ? "up" : score < 0 ? "down" : "even";
  const text = (stat: typeof gain) => stat ? STAT_NAMES[stat.key] + " " + signed(stat.delta) : "";
  const label = score > 0 ? text(gain) : score < 0 ? text(loss)
    : gain && loss && gain.delta > 0 && loss.delta < 0 ? `${text(gain)} · ${text(loss)}` : "변화 없음";
  // 두 줄은 절댓값이 큰 순서. 오르는 것과 내리는 것이 섞이면 둘 다 보인다(방어 +7 / 민첩 −2).
  const lines = [...deltas].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 2)
    .map(stat => ({ text: text(stat), tone: stat.delta > 0 ? "up" as const : "down" as const }));
  return { actorId, name, mark, label, score, lines };
}

type FitSession = Parameters<typeof previewShopEquipment>[0]["session"];

/** 파티 전원에 대한 표시. 장비가 아니면 null — 행에 빈 칸을 그리지 않는다. */
export function partyFit(project: Project, session: FitSession, goods: ShopGoods): readonly ShopActorFit[] | null {
  if (goods.source !== "equipment") return null;
  // 최소 세션(단위 테스트·빈 새 게임)은 actorEquipment 가 없을 수 있다 — 미리보기는 그 키를 직접 읽는다.
  const view: FitSession = session.actorEquipment ? session : { ...session, actorEquipment: {} };
  const fits: ShopActorFit[] = [];
  for (const actorId of partyActorIdsIn(project, view)) {
    const fit = fitFromPreview(actorId, previewShopEquipment({ project, session: view, goods, actorId }));
    if (fit) fits.push(fit);
  }
  return fits;
}

export function partyActorIdsIn(project: Project, session: Pick<PlaySession, "partyActorIds">): readonly string[] {
  return session.partyActorIds.filter(id => project.database.actors.some(actor => actor.id === id));
}

/**
 * 비교 상세를 누구 기준으로 보여 줄지. 저자가 상세 창에서 동료를 직접 고르기 전에는
 * 가장 크게 이득 보는 동료 → 이미 차고 있는 동료 → 장착 가능한 첫 동료 순이다.
 * 예전에는 첫 물건에서 정한 동료가 끝까지 고정돼, 검사 기준으로 지팡이를 보면 늘 「장비 불가」였다.
 */
export function bestFitActorId(fits: readonly ShopActorFit[] | null): string | undefined {
  if (!fits?.length) return undefined;
  const gains = fits.filter(fit => fit.mark === "up").sort((a, b) => b.score - a.score);
  return gains[0]?.actorId
    ?? fits.find(fit => fit.mark === "equipped")?.actorId
    ?? fits.find(fit => fit.mark !== "blocked")?.actorId;
}

export interface ShopRecoveryRow {
  readonly actorId: string;
  readonly kind: "hp" | "mp";
  readonly current: number;
  readonly max: number;
  readonly next: number;
}

/**
 * 회복 아이템이면 파티원별 현재/회복 후 수치. 회복량 산식은 playerItemUse 와 같다
 * (max × percent / 100 내림 + flat). 회복 효과가 없는 물건은 null.
 */
export function recoveryPreview(
  project: Project,
  session: Pick<PlaySession, "partyActorIds" | "actorVitals">,
  goods: ShopGoods,
): readonly ShopRecoveryRow[] | null {
  if (goods.source !== "item") return null;
  const item = project.database.items.find(record => record.id === goods.id);
  if (!item) return null;
  const kind = recoveryKind(item.hpRecovery) ? "hp" : recoveryKind(item.mpRecovery) ? "mp" : undefined;
  if (!kind) return null;
  const recovery = kind === "hp" ? item.hpRecovery : item.mpRecovery;
  const rows: ShopRecoveryRow[] = [];
  for (const actorId of partyActorIdsIn(project, session)) {
    const vitals = session.actorVitals?.[actorId];
    if (!vitals) continue;
    const max = kind === "hp" ? vitals.maxHp : vitals.maxMp;
    const current = Math.min(max, kind === "hp" ? vitals.hp : vitals.mp);
    const amount = Math.max(0, Math.floor((max * recovery.percentMax) / 100) + recovery.flat);
    rows.push({ actorId, kind, current, max, next: Math.min(max, current + amount) });
  }
  return rows;
}

function recoveryKind(recovery: { readonly flat: number; readonly percentMax: number } | undefined): boolean {
  return Boolean(recovery && (recovery.flat > 0 || recovery.percentMax > 0));
}

