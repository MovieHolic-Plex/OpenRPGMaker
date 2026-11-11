// 정착지 목적표 — 장소를 깔기 전에 «이 장소가 무엇을 위해 있는가»를 구성기에 건네는 계약.
// 왜(오너 2026-11-11 «초록 네모가 전부 문이 맞기는 한데 ..», 「맵은 목적으로 깐다 — 공간이 남으면 너무 큰 것」): 구성기는 장소 종류마다
// 고정 크기 맵에 집 줄을 끝까지 채웠고(사막 다섯 장에 건물 53채), 들어갈 수 있는 건물은 모델이 방을 장소로 적었을 때뿐이었다(53채 가운데 3채).
// 이제 게임이 그 장소에서 쓰는 역할(가게·여관·누구의 집…)을 먼저 정해 건네면, 구성기는 역할 건물을 큰길에 먼저 놓고 채움 집 몇 채만 더하며
// 맵 크기도 그 수에서 정한다. 어느 키트가 어느 역할의 건물인지는 번들(구성기)이 선언한다 — 읽는 쪽이 키트 이름에서 짐작하지 않는다.
// 목적표 없이 부르면 구성기는 예전 그대로 짠다.

/** 역할 하나 — 건물 한 채가 맡는다. id 는 목적표 안에서 유일하고, 구성기가 놓은 건물(결과 buildings[].need)과 맵 로케이션 꼬리표로 돌아온다. */
export interface RoleNeed {
  readonly id: string;
  /** 번들이 선언한 역할 이름(shop·inn·home …). */
  readonly role: string;
  /** 건물 이름(«나지라의 집»). 없으면 역할의 기본 이름. */
  readonly label?: string;
}

export interface SettlementProgram {
  readonly roles: readonly RoleNeed[];
  /** 역할 없는 채움 집 수. 없으면 그 장소 종류가 선언한 값. */
  readonly filler?: number;
}

/** 번들이 선언하는 역할 하나: 그 역할을 맡을 수 있는 건물 키트와, 안으로 들어가면 나오는 방 종류(구성기의 방 kind 값 — 없으면 들어갈 수 없는 역할). */
export interface SettlementRoleDecl {
  readonly ko: string;
  /** 이 역할의 건물 키트 — 선언 차례의 첫 번째가 그 역할의 얼굴이고 뒤는 자리가 좁을 때의 대안이다. */
  readonly kits: readonly string[];
  /** 키트가 모두 같은 급이다(살림집) — 차례 없이 고른다. */
  readonly anyKit?: true;
  readonly room?: string;
}

/**
 * 번들이 선언하는 장소 종류 하나: 여기 놓일 수 있는 역할(차례 = 이 종류에 어울리는 순서 — 첫 역할이 이 종류의 본업이다: 바자르는 가게, 대상 숙소는 여관)과
 * 채움 집 수(큰 도시는 더 많이 선언할 수 있다). landmark = 이 종류가 언제나 세우는 건물의 역할(궁전·피라미드 입구) — 목적표에 늘 들어간다.
 */
export interface SettlementKindDecl {
  readonly roles: readonly string[];
  readonly filler?: number;
  readonly landmark?: string;
}

export interface SettlementDecl {
  readonly roles: Readonly<Record<string, SettlementRoleDecl>>;
  readonly kinds: Readonly<Record<string, SettlementKindDecl>>;
}

/**
 * 번들 공통 역할 이름 — 이 이름으로 선언한 번들만 그 건물을 받는다. home = 누구의 집(그 장소에 단계가 있는 사람), inn = 쉴 곳(전원 회복), shop = 가게(회복약).
 * 그 밖의 역할 이름(찻집·목욕탕·궁전…)은 번들이 제 방 종류에 맞춰 짓는다.
 */
export const HOME_ROLE = "home";
export const REST_ROLE = "inn";
export const SUPPLY_ROLE = "shop";

/** 장소 종류가 따로 선언하지 않았을 때의 채움 집 수. */
export const DEFAULT_FILLER = 2;

/** 맵 로케이션 꼬리표 — 역할 건물(`program-role` + `role:<역할>` + `need:<id>`)과 목적표가 지은 방(`program-room`). */
export const PROGRAM_ROLE_TAG = "program-role";
export const PROGRAM_ROOM_TAG = "program-room";
export const roleTag = (role: string): string => `role:${role}`;
export const needTag = (id: string): string => `need:${id}`;

export const fillerOf = (decl: SettlementDecl, kind: string, program: SettlementProgram): number =>
  Math.max(0, program.filler ?? decl.kinds[kind]?.filler ?? DEFAULT_FILLER);

/** 이 장소 종류에 놓일 수 있는 역할만 남긴 목적표의 역할(차례 그대로). */
export const placeableRoles = (decl: SettlementDecl, kind: string, program: SettlementProgram): RoleNeed[] =>
  program.roles.filter((need) => (decl.kinds[kind]?.roles ?? []).includes(need.role) && (decl.roles[need.role]?.kits.length ?? 0) > 0);

/**
 * 구성기가 건물을 놓을 때마다 묻는 예산. 남은 역할이 있으면 그 역할의 키트를, 다 놓았으면 채움 집을 준다. 둘 다 없으면 undefined — 그 줄은 거기서 끝난다.
 * 역할은 목적표의 차례대로 놓인다(구성기는 큰길 안쪽에서 먼저 묻는다 — 그래서 역할 건물이 큰길에 선다).
 */
export class BuildingBudget {
  private readonly waiting: RoleNeed[];
  private fillerLeft: number;
  /** 처음에 놓기로 한 건물 수(역할 + 채움) — 구성기가 줄 수·맵 배치를 정할 때 본다. */
  readonly total: number;
  constructor(private readonly decl: SettlementDecl, kind: string, program: SettlementProgram) {
    this.waiting = placeableRoles(decl, kind, program);
    this.fillerLeft = fillerOf(decl, kind, program);
    this.total = this.waiting.length + this.fillerLeft;
  }
  /** 더 놓을 건물이 있나(역할이든 채움이든). */
  get open(): boolean { return this.waiting.length > 0 || this.fillerLeft > 0; }
  /** 그 역할이 아직 남았나. */
  wants(role: string): boolean { return this.waiting.some((need) => need.role === role); }
  /**
   * 다음 건물. fits(키트) = 그 자리에 들어가는가. plain = 채움 집으로 쓸 키트들(고르기는 choose).
   * 남은 역할 가운데 그 자리에 맞는 키트가 있는 첫 역할(키트는 선언 차례의 첫 번째 — 역할마다 생김새가 정해진다. 집처럼 키트가 여럿 같은 급이면 choose) → 없으면 채움 집.
   * only 를 주면 그 역할만 본다(회당 자리에는 찻집만).
   */
  next(fits: (kit: string) => boolean, plain: readonly string[], choose: (kits: readonly string[]) => string, only?: readonly string[]): { kit: string; need?: RoleNeed } | undefined {
    for (let i = 0; i < this.waiting.length; i++) {
      const need = this.waiting[i]!;
      if (only && !only.includes(need.role)) continue;
      const role = this.decl.roles[need.role]!;
      const kits = role.kits.filter(fits);
      if (!kits.length) continue;
      this.waiting.splice(i, 1);
      return { kit: role.anyKit ? choose(kits) : kits[0]!, need };
    }
    if (only) return undefined;
    const kits = plain.filter(fits);
    if (this.fillerLeft <= 0 || !kits.length) return undefined;
    this.fillerLeft -= 1;
    return { kit: choose(kits) };
  }
  /** 구성기가 건물을 스스로 정한 자리(궁전·피라미드 입구·숙소 방 줄)에 놓을 역할 — roles 를 주면 그 역할 가운데서. */
  claim(roles?: readonly string[]): RoleNeed | undefined {
    const i = this.waiting.findIndex((need) => !roles || roles.includes(need.role));
    return i < 0 ? undefined : this.waiting.splice(i, 1)[0];
  }
  /** 구성기가 정한 자리에 채움 집 하나를 쓴다. 남은 것이 없으면 false. */
  fill(): boolean {
    if (this.fillerLeft <= 0) return false;
    this.fillerLeft -= 1;
    return true;
  }
  /** 놓지 못한 역할(자리가 모자랐다). */
  unplaced(): readonly RoleNeed[] { return this.waiting; }
}

/** 구성 도구의 `program` 인자 스키마 — 역할 이름은 그 번들의 선언에서 온다. */
export const programSchema = (decl: SettlementDecl) => ({
  type: "object",
  description: "Build by purpose (optional): only these role buildings plus a few filler houses are placed, and the map must be the size the tool reports for this program. Without it the place is composed at its full size.",
  properties: {
    roles: {
      type: "array", maxItems: 24,
      items: {
        type: "object",
        properties: { id: { type: "string" }, role: { type: "string", enum: Object.keys(decl.roles) }, label: { type: "string" } },
        required: ["id", "role"], additionalProperties: false,
      },
    },
    filler: { type: "integer", minimum: 0, maximum: 8 },
  },
  required: ["roles"], additionalProperties: false,
}) as const;

/** 도구 인자 → 목적표. 인자가 없으면 undefined, 모양이 틀리면 던진다(메시지는 도구가 감싼다). */
export function programArg(raw: unknown, decl: SettlementDecl): SettlementProgram | undefined {
  if (raw === undefined || raw === null) return undefined;
  const o = raw as { roles?: unknown; filler?: unknown };
  if (typeof o !== "object" || !Array.isArray(o.roles)) throw new Error("program.roles must be an array of {id, role, label?}");
  const seen = new Set<string>();
  const roles = o.roles.map((r): RoleNeed => {
    const need = r as { id?: unknown; role?: unknown; label?: unknown };
    if (typeof need?.id !== "string" || !need.id || typeof need.role !== "string" || !decl.roles[need.role]) throw new Error(`program.roles[].role must be one of ${Object.keys(decl.roles).join(", ")} with a non-empty id`);
    if (seen.has(need.id)) throw new Error(`program.roles[].id «${need.id}» is repeated`);
    seen.add(need.id);
    return { id: need.id, role: need.role, ...(typeof need.label === "string" && need.label.trim() ? { label: need.label.trim() } : {}) };
  });
  const filler = typeof o.filler === "number" && Number.isInteger(o.filler) && o.filler >= 0 ? { filler: o.filler } : {};
  return { roles, ...filler };
}
