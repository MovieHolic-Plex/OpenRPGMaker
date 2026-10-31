// editor/tools/storeIconTools.ts
// 스토어 아이콘 팩(kind "icon", 32×32 PNG 한 장씩, meta.oprnIcon)으로 아이템·장비·스킬·상태에 아이콘을 붙이는 조수 도구(2026-10-31).
// - assign_store_icons: 아이콘이 없는(또는 overwrite) 레코드마다 이름·종류·속성에 맞는 아이콘을 골라 붙인다. 프로젝트에 이미 넣은 스토어 아이콘을
//   먼저 보고, 스토어(데스크톱 앱·워커 스토어 주소)가 연결돼 있으면 스토어 아이콘 팩까지 보고 고른 아이콘 파일만 받아 넣는다.
// upsert_item·upsert_equipment·upsert_skill·upsert_state 는 아이콘을 안 주면 프로젝트에 있는 스토어 아이콘 중 맞는 것을 스스로 붙인다(dbTools autoStoreIcon).
import { applyPackToProject } from "@/assetStore/pack";
import { storeProjectId, type StoreItemSummary, type StorePackManifest } from "@/assetStore/format";
import { workerStoreAccess, type StoreReadAccess } from "@/assetStore/storeAccess";
import { iconWantRows, planIconAssignments, rankStoreIcons, readStoreIconMeta, STORE_ICON_CONFIDENT_SCORE, type IconAssignment, type IconCandidate } from "@/assetStore/storeIconPick";
import type { PreparedStoreItem } from "@/editor/assetStore/storeApply";
import { addStoreProfiles } from "@/editor/assetStore/storeProfiles";
import { listAllStorePacksOfKind, load, prepareFromWorker, take, UNTRUSTED_NOTE } from "./storeTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type Collection = IconAssignment["collection"];
const COLLECTIONS: readonly Collection[] = ["items", "equipment", "skills", "states"];

/** 스토어 아이콘 하나(팩 안 에셋). id 는 넣은 뒤의 프로젝트 id. */
interface StoreIcon extends IconCandidate { readonly slug: string; readonly assetId: string }

const iconPacks = new Map<string, StoreIcon[]>();

function storeIconsOf(item: Pick<StoreItemSummary, "slug">, manifest: StorePackManifest): StoreIcon[] {
  const out: StoreIcon[] = [];
  for (const asset of Object.values(manifest.content.assets)) {
    if (asset.kind !== "icon") continue;
    const meta = readStoreIconMeta(asset.meta);
    if (meta) out.push({ id: storeProjectId(item.slug, asset.id), slug: item.slug, assetId: asset.id, meta });
  }
  return out;
}

/** 아이콘 팩 목록(전부) → 매니페스트(slug@판본 캐시) → 아이콘. 파일은 받지 않는다. */
export async function loadStoreIcons(access: StoreReadAccess): Promise<StoreIcon[]> {
  const listed = await listAllStorePacksOfKind(access, "icon");
  const out: StoreIcon[] = [];
  for (let at = 0; at < listed.items.length; at += 4) {
    const batch = await Promise.all(listed.items.slice(at, at + 4).map(async (item) => {
      const key = `${access.url}|${item.slug}@${item.latestVersion}`;
      const cached = iconPacks.get(key);
      if (cached) return cached;
      const found = storeIconsOf(item, await access.manifest(item.slug, item.latestVersion));
      iconPacks.set(key, found);
      return found;
    }).map((work) => work.catch(() => [] as StoreIcon[])));
    out.push(...batch.flat());
  }
  return out;
}

const collectionsOf = (value: unknown): Collection[] => (Array.isArray(value) ? COLLECTIONS.filter((c) => value.includes(c)) : []);
const idsOf = (value: unknown): string[] => (Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 120).slice(0, 400) : []);
const assignKey = (args: Record<string, unknown>): string =>
  `icons:${collectionsOf(args.collections).join(",")}:${idsOf(args.ids).join(",")}:${args.overwrite === true ? 1 : 0}`;

const optionsOf = (args: Record<string, unknown>) => ({ collections: collectionsOf(args.collections), overwrite: args.overwrite === true, ids: idsOf(args.ids) });

interface PreparedIcons {
  readonly picks: readonly { readonly collection: Collection; readonly id: string; readonly name: string; readonly iconResourceId: string; readonly score: number; readonly fromStore: boolean }[];
  readonly packs: readonly (PreparedStoreItem & { readonly slug: string })[];
  readonly storeIcons: number;
  readonly storeError?: string;
}

const assignStoreIcons: ToolDefinition = {
  name: "assign_store_icons",
  description: "아이템·장비·스킬·상태에 아이콘(32px 그림)을 한꺼번에 붙인다. 아이콘이 없는 레코드마다 이름·종류(무기·물약·열쇠 …)·속성(불·얼음 …)에 맞는 아이콘을 고른다. "
    + "먼저 프로젝트에 이미 넣은 스토어 아이콘을 보고, 스토어가 연결돼 있으면 스토어 아이콘 팩에서도 골라 그 아이콘 파일만 받아 넣는다. 자신 없는 짝은 붙이지 않고 skipped 로 돌려준다. "
    + "아이템·장비·스킬을 여러 개 만든 뒤 한 번 부르거나, 사용자가 「아이콘 붙여 줘」「아이콘 없는 거 채워 줘」라고 하면 쓴다. 이미 붙은 아이콘은 overwrite:true 일 때만 바꾼다. "
    + "upsert_item 등은 아이콘을 안 주면 프로젝트에 있는 스토어 아이콘을 스스로 붙이므로, 스토어 아이콘을 새로 받아야 할 때 이 도구가 필요하다.",
  mode: "write",
  domains: ["core"],
  parameters: {
    type: "object",
    properties: {
      collections: { type: "array", items: { type: "string", enum: [...COLLECTIONS] }, description: "대상 묶음(items·equipment·skills·states). 비우면 넷 다" },
      ids: { type: "array", items: { type: "string" }, description: "이 레코드 id 만(비우면 대상 묶음 전부)" },
      overwrite: { type: "boolean", description: "true = 이미 아이콘이 있는 레코드도 다시 고른다. 기본 false" },
    },
    required: [],
    additionalProperties: false,
  },
  invalidArgsExample: { collections: ["items", "equipment"] },
  async prepare(args, project) {
    await load(assignKey(args), async (): Promise<PreparedIcons> => {
      if (!project) throw new Error("프로젝트를 읽지 못했습니다.");
      const rows = iconWantRows(project, optionsOf(args));
      const local = planIconAssignments(project, optionsOf(args));
      const localById = new Map(local.assign.map((a) => [`${a.collection}:${a.id}`, a]));
      const access = workerStoreAccess();
      let storeIcons: StoreIcon[] = [];
      let storeError: string | undefined;
      if (access) {
        try { storeIcons = await loadStoreIcons(access); } catch (error) { storeError = error instanceof Error ? error.message : String(error); }
      }
      const picks: PreparedIcons["picks"][number][] = [];
      const wanted = new Map<string, Set<string>>();
      for (const row of rows) {
        const mine = localById.get(`${row.collection}:${row.id}`);
        const [best] = rankStoreIcons(storeIcons, row.want, 1);
        if (best && best.score >= STORE_ICON_CONFIDENT_SCORE && (!mine || best.score > mine.score) && !project.assets.uploaded[best.id]) {
          picks.push({ collection: row.collection, id: row.id, name: row.name, iconResourceId: best.id, score: best.score, fromStore: true });
          wanted.set(best.slug, (wanted.get(best.slug) ?? new Set()).add(best.assetId));
        } else if (mine) picks.push({ ...mine, fromStore: false });
        else if (best && best.score >= STORE_ICON_CONFIDENT_SCORE) picks.push({ collection: row.collection, id: row.id, name: row.name, iconResourceId: best.id, score: best.score, fromStore: false });
      }
      const packs: (PreparedStoreItem & { readonly slug: string })[] = [];
      if (access) for (const [slug, ids] of wanted) packs.push({ ...(await prepareFromWorker(access, slug, [...ids])), slug });
      return { picks, packs, storeIcons: storeIcons.length, ...(storeError ? { storeError } : {}) };
    });
  },
  run(draft, args): ToolExecResult {
    let prepared: PreparedIcons;
    try { prepared = take<PreparedIcons>(assignKey(args)); } catch (error) {
      // 스토어 없이 도는 경로(prepare 가 안 불린 실행기): 프로젝트에 있는 아이콘만으로 붙인다.
      if (!(error instanceof ToolError)) throw error;
      const local = planIconAssignments(draft, optionsOf(args));
      prepared = { picks: local.assign.map((a) => ({ ...a, fromStore: false })), packs: [], storeIcons: 0, storeError: error.message };
    }
    const installed: string[] = [];
    for (const pack of prepared.packs) {
      const result = applyPackToProject(draft, pack.manifest, pack.context);
      addStoreProfiles(draft, result.assetIds);
      installed.push(...result.assetIds);
    }
    const db = draft.database;
    const done: { collection: Collection; id: string; name: string; iconResourceId: string }[] = [];
    for (const pick of prepared.picks) {
      if (!draft.assets.uploaded[pick.iconResourceId]) continue;
      const list = (pick.collection === "items" ? db.items : pick.collection === "equipment" ? db.equipment : pick.collection === "skills" ? db.skills : db.states) as { id: string; iconResourceId?: string }[];
      const record = list.find((entry) => entry.id === pick.id);
      if (!record) continue;
      record.iconResourceId = pick.iconResourceId;
      done.push({ collection: pick.collection, id: pick.id, name: pick.name, iconResourceId: pick.iconResourceId });
    }
    const left = iconWantRows(draft, { ...optionsOf(args), overwrite: false }).map((row) => ({ collection: row.collection, id: row.id, name: row.name }));
    return {
      summary: `아이콘 ${done.length}개를 붙였다(스토어에서 새로 받은 아이콘 ${installed.length}개).`
        + (left.length ? ` 맞는 아이콘이 없어 ${left.length}개는 비워 뒀다 — 그대로 두거나 사용자에게 알린다.` : "")
        + (prepared.storeError ? ` 스토어는 쓰지 못했다(${prepared.storeError.slice(0, 120)}).` : ""),
      data: { assigned: done.slice(0, 120), skipped: left.slice(0, 60), installedIconIds: installed.slice(0, 120), storeIconsSeen: prepared.storeIcons, note: UNTRUSTED_NOTE },
    };
  },
};

export const STORE_ICON_TOOLS: readonly ToolDefinition[] = [assignStoreIcons];
