import { eventDisplayName } from "@/editor/eventMarkerUx";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { selectEditorMap } from "@/editor/mapSelection";
import { emptyToUndefined, numberField, selectField, textControl } from "@/editor/panels/databaseControls";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { SEASON_OPTIONS } from "@/editor/panels/eventEditor/conditionForm";
import { characterListThumbnail } from "@/editor/panels/characterListThumbnail";
import {
  characterIdExists,
  listCharacterIdIndex,
  type CharacterIdIndexEntry,
  type CharacterIdUsageHost,
} from "@/project/characterIdIndex";
import { SEASONS, type Season } from "@/project/gameTime";
import { store } from "@/project/store";
import type { CharacterProfile, GiftPrefs, GiftResponses, ItemId, Project } from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";

const DELETE_CONFIRM_LABEL = "정말 삭제?";
const DELETE_IDLE_LABEL = "프로필 삭제";
const DELETE_CONFIRM_WINDOW_MS = 3000;

let selectedCharacterId: string | undefined;

export function renderCharactersTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const entries = listCharacterIdIndex(project);
  if (!selectedCharacterId || !entries.some((entry) => entry.characterId === selectedCharacterId)) {
    selectedCharacterId = entries[0]?.characterId;
  }
  const selected = entries.find((entry) => entry.characterId === selectedCharacterId);

  const list = el("div", { class: "db-list", dataset: { testid: "db-characters-list" } });
  for (const entry of entries) {
    const label = entry.profile?.displayName?.trim() || entry.characterId;
    const badges: string[] = [];
    if (entry.isOrphan) badges.push("고아");
    if (entry.isUnusedProfile) badges.push("미사용");
    if (entry.usageCount > 0) badges.push(`이벤트 ${entry.usageCount}`);
    list.append(
      el("button", {
        class: `db-list-row db-list-row-has-thumb${entry.characterId === selectedCharacterId ? " active" : ""}`,
        attrs: {
          type: "button",
          title: `${label} (${entry.characterId})`,
        },
        dataset: {
          testid: `db-character-row-${entry.characterId}`,
          recordId: entry.characterId,
          recordName: label,
        },
        on: {
          click: () => {
            selectedCharacterId = entry.characterId;
            rerender();
          },
        },
        children: [
          characterListThumbnail(project, entry),
          el("span", { class: "db-list-name", text: label }),
          el("small", {
            text: badges.length > 0 ? `${entry.characterId} · ${badges.join(" · ")}` : entry.characterId,
          }),
        ],
      }),
    );
  }

  const listPane = el("div", { class: "db-list-pane oprn-record-list-pane" });
  listPane.append(
    el("h3", { text: "캐릭터" }),
    list,
    el("div", { class: "db-list-footer", text: `${entries.length}개` }),
    toolbar(entries, rerender),
  );

  const detailPane = el("div", { class: "db-detail-pane oprn-record-detail-pane" });
  detailPane.append(
    selected
      ? characterDetail(selected, project, rerender)
      : el("section", {
          class: "db-detail-form",
          dataset: { testid: "db-detail-form" },
          text: "캐릭터 ID가 없습니다. 이벤트에 characterId를 달거나 아래에서 프로필을 추가하세요.",
        }),
  );

  host.append(
    el("p", {
      class: "db-record-intro",
      dataset: { testid: "db-characters-intro" },
      text: "호감·선물 공유 키(characterId) 카탈로그입니다. 프로필만 삭제할 수 있고 이벤트 참조는 남습니다. 이름 변경(rename)은 지원하지 않습니다.",
    }),
    el("div", {
      class: "db-record-workspace oprn-record-workspace oprn-record-characters",
      dataset: { testid: "db-characters-workspace" },
      children: [listPane, detailPane],
    }),
  );
}

function toolbar(entries: readonly CharacterIdIndexEntry[], rerender: () => void): HTMLElement {
  return el("div", {
    class: "db-toolbar",
    children: [addProfileButton(rerender), deleteProfileButton(entries, rerender)],
  });
}

function addProfileButton(rerender: () => void): HTMLElement {
  return el("button", {
    class: "db-toolbar-button",
    text: "+ 프로필 추가",
    attrs: { type: "button" },
    dataset: { testid: "db-character-add" },
    on: {
      click: () => {
        const id = allocateUniqueCharacterId(store.getCurrent());
        recordProjectSnapshot("캐릭터 프로필 추가");
        store.update((project) => {
          const next = { ...(project.characters ?? {}) };
          next[id] = { displayName: "새 캐릭터" };
          project.characters = next;
        }, { scope: "project" });
        selectedCharacterId = id;
        toast("캐릭터 프로필을 추가했습니다.", "ok");
        rerender();
      },
    },
  });
}

function deleteProfileButton(entries: readonly CharacterIdIndexEntry[], rerender: () => void): HTMLElement {
  let armedId: string | null = null;
  let armedUntil = 0;
  let resetTimer: number | null = null;

  const button = el("button", {
    class: "db-toolbar-button danger",
    text: DELETE_IDLE_LABEL,
    attrs: { type: "button" },
    dataset: { testid: "db-character-delete" },
    on: {
      click: () => {
        const id = selectedCharacterId;
        if (!id) return;
        const entry = entries.find((item) => item.characterId === id);
        if (!entry?.hasProfile) {
          toast("삭제할 프로필이 없습니다. (이벤트 참조만 있는 고아 ID)", "error");
          return;
        }

        const now = Date.now();
        const isArmed = armedId === id && now <= armedUntil;
        if (!isArmed) {
          armedId = id;
          armedUntil = now + DELETE_CONFIRM_WINDOW_MS;
          button.textContent = DELETE_CONFIRM_LABEL;
          button.classList.add("confirming");
          if (resetTimer !== null) window.clearTimeout(resetTimer);
          resetTimer = window.setTimeout(() => {
            resetTimer = null;
            if (Date.now() >= armedUntil) {
              armedId = null;
              button.textContent = DELETE_IDLE_LABEL;
              button.classList.remove("confirming");
            }
          }, DELETE_CONFIRM_WINDOW_MS + 100);
          return;
        }

        armedId = null;
        armedUntil = 0;
        button.textContent = DELETE_IDLE_LABEL;
        button.classList.remove("confirming");
        recordProjectSnapshot("캐릭터 프로필 삭제");
        store.update((project) => {
          if (!project.characters?.[id]) return;
          const next = { ...project.characters };
          delete next[id];
          if (Object.keys(next).length === 0) delete project.characters;
          else project.characters = next;
        }, { scope: "project" });
        // Keep selection on the same characterId so orphan usage rows remain visible.
        toast(
          entry.usageCount > 0
            ? "프로필만 삭제했습니다. 이벤트 characterId 참조는 유지됩니다."
            : "프로필을 삭제했습니다 — Ctrl+Z로 되돌릴 수 있습니다.",
          "ok",
        );
        rerender();
      },
    },
  });
  return button;
}

function characterDetail(entry: CharacterIdIndexEntry, project: Project, rerender: () => void): HTMLElement {
  const form = el("section", {
    class: "db-detail-form oprn-detail-form",
    dataset: { testid: "db-detail-form" },
  });

  form.append(
    el("div", {
      class: "db-record-id",
      children: [
        el("span", { text: "캐릭터 ID" }),
        el("code", { text: entry.characterId, dataset: { testid: "db-character-id" } }),
      ],
    }),
    el("div", {
      class: "db-character-status",
      dataset: { testid: "db-character-status" },
      children: [
        el("span", {
          text: entry.hasProfile ? "프로필 있음" : "프로필 없음 (고아 ID)",
        }),
        el("span", {
          text: `이벤트 ${entry.usageCount} · 맵 ${entry.mapCount}`,
        }),
      ],
    }),
  );

  if (!entry.hasProfile) {
    form.append(orphanCreatePanel(entry, rerender));
  } else {
    form.append(profileFields(entry.characterId, entry.profile ?? {}, project, rerender));
  }

  form.append(usagePanel(entry, project));
  return form;
}

function orphanCreatePanel(entry: CharacterIdIndexEntry, rerender: () => void): HTMLElement {
  let displayName = "";
  const nameInput = el("input", {
    attrs: { type: "text", placeholder: "표시 이름 (선택)" },
    dataset: { testid: "db-character-orphan-display-name" },
  }) as HTMLInputElement;
  nameInput.addEventListener("input", () => {
    displayName = nameInput.value;
  });

  const createButton = el("button", {
    class: "btn primary",
    text: "프로필 만들기",
    attrs: { type: "button" },
    dataset: { testid: "db-character-create-profile" },
    on: {
      click: () => {
        const name = displayName.trim();
        if (!name) {
          toast("표시 이름은 필수입니다.", "error");
          return;
        }
        recordProjectSnapshot("캐릭터 프로필 생성");
        store.update((project) => {
          const next = { ...(project.characters ?? {}) };
          next[entry.characterId] = { displayName: name };
          project.characters = next;
        }, { scope: "project" });
        toast("프로필을 만들었습니다.", "ok");
        rerender();
      },
    },
  });

  return el("div", {
    class: "db-character-orphan-create",
    dataset: { testid: "db-character-orphan-create" },
    children: [
      el("p", {
        class: "empty-hint",
        text: "이벤트에서 쓰이는 characterId이지만 프로필이 없습니다. 표시 이름을 넣고 프로필을 만들 수 있습니다.",
      }),
      el("label", {
        class: "db-field",
        children: [el("span", { text: "표시 이름" }), nameInput],
      }),
      createButton,
    ],
  });
}

function profileFields(
  characterId: string,
  profile: CharacterProfile,
  project: Project,
  rerender: () => void,
): HTMLElement {
  const wrap = el("div", {
    class: "db-character-profile-fields",
    dataset: { testid: "db-character-profile-fields" },
  });

  wrap.append(
    textControl(
      "표시 이름",
      profile.displayName ?? "",
      (value) => {
        const next = emptyToUndefined(value);
        patchProfile(characterId, {
          displayName: next,
        }, { clearDisplayName: !next });
      },
      "db-character-display-name",
    ),
    birthdayFields(characterId, profile, rerender),
    giftPrefsFields(characterId, profile.giftPrefs, project, rerender),
    giftResponsesFields(characterId, profile.giftResponses),
  );
  return wrap;
}

function birthdayFields(characterId: string, profile: CharacterProfile, rerender: () => void): HTMLElement {
  const enabled = profile.birthday !== undefined;
  const season = profile.birthday?.season ?? "spring";
  const day = profile.birthday?.day ?? 1;

  const enable = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "db-character-birthday-enabled" },
  }) as HTMLInputElement;
  enable.checked = enabled;
  enable.addEventListener("change", () => {
    if (enable.checked) {
      patchProfile(characterId, { birthday: { season, day } });
    } else {
      patchProfile(characterId, {}, { clearBirthday: true });
    }
    rerender();
  });

  const seasonSelect = selectField(
    "생일 계절",
    "db-character-birthday-season",
    season,
    SEASON_OPTIONS.map((option) => ({ id: option.value, name: option.label })),
    (value) => {
      if (!SEASONS.includes(value as Season)) return;
      patchProfile(characterId, {
        birthday: {
          season: value as Season,
          day: store.getCurrent().characters?.[characterId]?.birthday?.day ?? day,
        },
      });
    },
  );
  const dayField = numberField(
    "생일 일",
    "db-character-birthday-day",
    day,
    (value) => {
      const nextDay = Math.min(99, Math.max(1, Math.trunc(value) || 1));
      patchProfile(characterId, {
        birthday: {
          season: store.getCurrent().characters?.[characterId]?.birthday?.season ?? season,
          day: nextDay,
        },
      });
    },
    { min: 1, max: 99 },
  );

  if (!enabled) {
    seasonSelect.querySelector("select")?.setAttribute("disabled", "true");
    dayField.querySelector("input")?.setAttribute("disabled", "true");
  }

  return el("div", {
    class: "db-character-birthday",
    dataset: { testid: "db-character-birthday" },
    children: [
      el("label", {
        class: "db-checkbox-field",
        children: [enable, el("span", { text: "생일 사용" })],
      }),
      seasonSelect,
      dayField,
    ],
  });
}

function giftPrefsFields(
  characterId: string,
  prefs: GiftPrefs | undefined,
  project: Project,
  rerender: () => void,
): HTMLElement {
  const items = project.database.items.map((item) => ({ id: item.id, name: item.name || item.id }));
  const ranks: readonly { readonly key: keyof GiftPrefs; readonly label: string; readonly testid: string }[] = [
    { key: "loved", label: "좋아하는 선물 (loved)", testid: "db-character-gift-loved" },
    { key: "liked", label: "괜찮은 선물 (liked)", testid: "db-character-gift-liked" },
    { key: "disliked", label: "싫어하는 선물 (disliked)", testid: "db-character-gift-disliked" },
  ];

  const sections = ranks.map((rank) => {
    const selected = [...(prefs?.[rank.key] ?? [])];
    const list = el("div", {
      class: "db-character-gift-list",
      dataset: { testid: `${rank.testid}-list` },
    });
    if (selected.length === 0) {
      list.append(el("div", { class: "empty-hint", text: "(없음)" }));
    } else {
      for (const itemId of selected) {
        const itemName = items.find((item) => item.id === itemId)?.name ?? itemId;
        list.append(
          el("div", {
            class: "db-character-gift-row",
            dataset: { testid: `${rank.testid}-row-${itemId}` },
            children: [
              el("span", { text: itemName }),
              el("button", {
                class: "btn small",
                text: "제거",
                attrs: { type: "button" },
                dataset: { testid: `${rank.testid}-remove-${itemId}` },
                on: {
                  click: () => {
                    patchGiftPrefs(characterId, rank.key, (ids) => ids.filter((id) => id !== itemId));
                    rerender();
                  },
                },
              }),
            ],
          }),
        );
      }
    }

    const available = items.filter((item) => !selected.includes(item.id));
    const picker = el("select", {
      dataset: { testid: `${rank.testid}-picker` },
    }) as HTMLSelectElement;
    picker.append(el("option", { text: "(아이템 추가)", attrs: { value: "" } }));
    for (const item of available) {
      picker.append(el("option", { text: item.name, attrs: { value: item.id } }));
    }
    const addButton = el("button", {
      class: "btn small",
      text: "추가",
      attrs: available.length === 0 ? { type: "button", disabled: "true" } : { type: "button" },
      dataset: { testid: `${rank.testid}-add` },
      on: {
        click: () => {
          const itemId = picker.value as ItemId;
          if (!itemId) return;
          patchGiftPrefs(characterId, rank.key, (ids) => {
            const current = new Set(ids);
            current.add(itemId);
            return [...current];
          });
          rerender();
        },
      },
    });

    return el("div", {
      class: "db-character-gift-rank",
      dataset: { testid: rank.testid },
      children: [
        el("strong", { text: rank.label }),
        list,
        el("div", { class: "db-character-gift-add-row", children: [picker, addButton] }),
      ],
    });
  });

  return el("div", {
    class: "db-character-gift-prefs",
    dataset: { testid: "db-character-gift-prefs" },
    children: [el("h4", { text: "선물 선호 (프로필 기본값)" }), ...sections],
  });
}

function giftResponsesFields(characterId: string, responses: GiftResponses | undefined): HTMLElement {
  const keys: readonly { readonly key: keyof GiftResponses; readonly label: string; readonly testid: string }[] = [
    { key: "loved", label: "loved 반응", testid: "db-character-response-loved" },
    { key: "liked", label: "liked 반응", testid: "db-character-response-liked" },
    { key: "neutral", label: "neutral 반응", testid: "db-character-response-neutral" },
    { key: "disliked", label: "disliked 반응", testid: "db-character-response-disliked" },
    { key: "alreadyGifted", label: "이미 선물함", testid: "db-character-response-already-gifted" },
    { key: "noItems", label: "아이템 없음", testid: "db-character-response-no-items" },
  ];

  return el("div", {
    class: "db-character-gift-responses",
    dataset: { testid: "db-character-gift-responses" },
    children: [
      el("h4", { text: "선물 반응 문구 (프로필 기본값)" }),
      ...keys.map((entry) =>
        textControl(
          entry.label,
          responses?.[entry.key] ?? "",
          (value) => {
            const trimmed = emptyToUndefined(value);
            patchGiftResponse(characterId, entry.key, trimmed);
          },
          entry.testid,
        ),
      ),
    ],
  });
}

function usagePanel(entry: CharacterIdIndexEntry, project: Project): HTMLElement {
  const wrap = el("div", {
    class: "db-character-usage",
    dataset: { testid: "db-character-usage" },
  });
  wrap.append(el("h4", { text: "사용 중인 이벤트" }));

  if (entry.hosts.length === 0) {
    wrap.append(
      el("p", {
        class: "empty-hint",
        text: "이 characterId를 쓰는 맵 이벤트가 없습니다.",
        dataset: { testid: "db-character-usage-empty" },
      }),
    );
    return wrap;
  }

  const list = el("div", { class: "db-character-usage-list" });
  for (const host of entry.hosts) {
    list.append(usageRow(host, project));
  }
  wrap.append(list);
  return wrap;
}

function usageRow(host: CharacterIdUsageHost, project: Project): HTMLElement {
  const mapName = project.maps[host.mapId]?.name || host.mapId;
  const event = project.maps[host.mapId]?.events.find((entry) => entry.id === host.eventId);
  const eventLabel = event ? eventDisplayName(event) : host.eventId;
  return el("div", {
    class: "db-character-usage-row",
    dataset: {
      testid: `db-character-usage-${host.mapId}-${host.eventId}`,
    },
    children: [
      el("span", {
        text: `${mapName} / ${eventLabel} (${host.x},${host.y})`,
      }),
      el("button", {
        class: "btn small",
        text: "이벤트로 이동",
        attrs: { type: "button" },
        dataset: { testid: `db-character-jump-${host.mapId}-${host.eventId}` },
        on: {
          click: () => jumpToHost(host),
        },
      }),
    ],
  });
}

function jumpToHost(host: CharacterIdUsageHost): void {
  const project = store.getCurrent();
  const map = project.maps[host.mapId];
  const event = map?.events.find((entry) => entry.id === host.eventId);
  if (!map || !event) {
    toast("연결된 이벤트를 찾을 수 없습니다.", "error");
    return;
  }
  if (!selectEditorMap(host.mapId, { clearEventSelection: false })) {
    toast("연결된 맵을 찾을 수 없습니다.", "error");
    return;
  }
  openEventEditorModal(host.mapId, host.eventId);
}

function patchProfile(
  characterId: string,
  patch: Partial<CharacterProfile>,
  options: { readonly clearDisplayName?: boolean; readonly clearBirthday?: boolean; readonly clearGiftPrefs?: boolean; readonly clearGiftResponses?: boolean } = {},
): void {
  recordCoalescedSnapshot(`db-character:${characterId}`);
  store.update((project) => {
    const existing = project.characters?.[characterId] ?? {};
    const nextProfile: CharacterProfile = {
      ...existing,
      ...patch,
    };
    // Rebuild without cleared optional keys (readonly fields cannot be deleted in place).
    const rebuilt: {
      displayName?: string;
      birthday?: CharacterProfile["birthday"];
      giftPrefs?: GiftPrefs;
      giftResponses?: GiftResponses;
    } = {};
    const displayName = options.clearDisplayName ? undefined : nextProfile.displayName;
    const birthday = options.clearBirthday ? undefined : nextProfile.birthday;
    const giftPrefs = options.clearGiftPrefs ? undefined : nextProfile.giftPrefs;
    const giftResponses = options.clearGiftResponses ? undefined : nextProfile.giftResponses;
    if (displayName !== undefined) rebuilt.displayName = displayName;
    if (birthday !== undefined) rebuilt.birthday = birthday;
    if (giftPrefs !== undefined) rebuilt.giftPrefs = giftPrefs;
    if (giftResponses !== undefined) rebuilt.giftResponses = giftResponses;
    const next = { ...(project.characters ?? {}) };
    // Empty profile object is still a valid registered profile (orphan → profile).
    next[characterId] = rebuilt;
    project.characters = next;
  }, { scope: "project" });
}

function patchGiftPrefs(
  characterId: string,
  rank: keyof GiftPrefs,
  transform: (ids: readonly ItemId[]) => readonly ItemId[],
): void {
  const existing = store.getCurrent().characters?.[characterId]?.giftPrefs;
  const nextIds = transform(existing?.[rank] ?? []);
  const next: {
    loved?: readonly ItemId[];
    liked?: readonly ItemId[];
    disliked?: readonly ItemId[];
  } = {
    ...(existing?.loved ? { loved: [...existing.loved] } : {}),
    ...(existing?.liked ? { liked: [...existing.liked] } : {}),
    ...(existing?.disliked ? { disliked: [...existing.disliked] } : {}),
  };
  if (nextIds.length === 0) {
    if (rank === "loved") delete next.loved;
    else if (rank === "liked") delete next.liked;
    else delete next.disliked;
  } else if (rank === "loved") next.loved = nextIds;
  else if (rank === "liked") next.liked = nextIds;
  else next.disliked = nextIds;

  if (!next.loved && !next.liked && !next.disliked) {
    patchProfile(characterId, {}, { clearGiftPrefs: true });
  } else {
    patchProfile(characterId, { giftPrefs: next });
  }
}

function patchGiftResponse(
  characterId: string,
  key: keyof GiftResponses,
  value: string | undefined,
): void {
  const existing = store.getCurrent().characters?.[characterId]?.giftResponses ?? {};
  const next: {
    loved?: string;
    liked?: string;
    neutral?: string;
    disliked?: string;
    alreadyGifted?: string;
    noItems?: string;
  } = { ...existing };
  if (value === undefined) {
    if (key === "loved") delete next.loved;
    else if (key === "liked") delete next.liked;
    else if (key === "neutral") delete next.neutral;
    else if (key === "disliked") delete next.disliked;
    else if (key === "alreadyGifted") delete next.alreadyGifted;
    else delete next.noItems;
  } else if (key === "loved") next.loved = value;
  else if (key === "liked") next.liked = value;
  else if (key === "neutral") next.neutral = value;
  else if (key === "disliked") next.disliked = value;
  else if (key === "alreadyGifted") next.alreadyGifted = value;
  else next.noItems = value;

  if (Object.keys(next).length === 0) {
    patchProfile(characterId, {}, { clearGiftResponses: true });
  } else {
    patchProfile(characterId, { giftResponses: next });
  }
}

function allocateUniqueCharacterId(project: Project): string {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const id = genId("char");
    if (!characterIdExists(project, id) && project.characters?.[id] === undefined) return id;
  }
  // Extremely unlikely fallback — still unique enough for editor use.
  return `char_${Date.now().toString(36)}`;
}
