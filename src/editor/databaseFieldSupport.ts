export type DatabaseFieldRuntimeSupport = "runtime" | "editorOnly" | "authoringOnly";

export type DatabaseFieldSupportDescriptor = Readonly<{
  field: string;
  owner: "item" | "equipment" | "itemAndEquipment" | "enemy";
  support: DatabaseFieldRuntimeSupport;
  label: string;
  help: string;
}>;

export const DATABASE_FIELD_SUPPORT = Object.freeze([
  {
    field: "imageResourceId",
    owner: "itemAndEquipment",
    support: "runtime",
    label: "이미지",
    help: "데이터베이스·피커·미리보기·요약에 사용합니다. 게임 인벤토리·장비 메뉴·상점은 아이콘을 우선하고 없으면 이미지를 사용합니다. 전투 연출은 별도 애니메이션 설정을 따릅니다.",
  },
  {
    field: "iconResourceId",
    owner: "itemAndEquipment",
    support: "runtime",
    label: "아이콘",
    help: "데이터베이스·피커·미리보기·요약에 사용합니다. 게임 인벤토리·장비 메뉴·상점은 아이콘을 우선하고 없으면 이미지를 사용합니다. 전투 연출은 별도 애니메이션 설정을 따릅니다.",
  },
  {
    field: "consumptionLimit",
    owner: "item",
    support: "runtime",
    label: "카피별 사용 횟수",
    help: "필드·전투·포획의 성공한 사용에 카피별 FIFO 사용 횟수를 적용하고 세이브합니다.",
  },
  {
    field: "usableActorIds",
    owner: "item",
    support: "runtime",
    label: "사용 가능 주인공",
    help: "약·책·씨앗의 메뉴 사용 대상 자격을 제한합니다.",
  },
  {
    field: "usableClassIds",
    owner: "item",
    support: "runtime",
    label: "사용 가능 직업",
    help: "약·책·씨앗의 메뉴 사용 대상 직업을 제한합니다.",
  },
  {
    field: "seedParameterBonuses",
    owner: "item",
    support: "runtime",
    label: "씨앗 능력치 보정",
    help: "공격·방어·정신·민첩 영구 보정을 성공한 메뉴 사용에 적용합니다.",
  },
  {
    field: "stateEffects",
    owner: "item",
    support: "runtime",
    label: "상태 변화",
    help: "전투와 필드 둘 다 적용합니다. 부여는 확률 판정을 거치고(전투는 상태 저항까지 곱함), 해제는 걸린 상태를 지웁니다.",
  },
  {
    field: "animationId",
    owner: "item",
    support: "runtime",
    label: "전투 연출",
    help: "전투에서 아이템을 사용하면 대상 위치에 지정한 전투 애니메이션을 재생합니다. 필드에서는 연출을 재생하지 않습니다.",
  },
  {
    field: "careProfile",
    owner: "item",
    support: "runtime",
    label: "몬스터 돌봄",
    help: "필드 메뉴에서 파티 몬스터에게 사용해 친밀도와 경험치를 더합니다. 돌봄 아이템은 주인공 대상 효과를 갖지 않습니다.",
  },
  {
    field: "usageMessage",
    owner: "item",
    support: "editorOnly",
    label: "사용 메시지 형식",
    help: "저장·내보내기만 지원합니다. 런타임은 현재의 표준 사용 메시지를 표시합니다.",
  },
  {
    field: "equipmentProfile",
    owner: "item",
    support: "editorOnly",
    label: "레거시 장비 안내",
    help: "저장되는 레거시 ItemRecord 저작 정보입니다. 실제 런타임 장비는 장비 데이터베이스에서 저작합니다.",
  },
  {
    field: "twoHanded",
    owner: "equipment",
    support: "runtime",
    label: "양손 장비",
    help: "장비 전환 시 양손 슬롯을 원자적으로 점유하고 인벤토리 카피는 한 번만 계산합니다.",
  },
  {
    field: "accuracy",
    owner: "equipment",
    support: "runtime",
    label: "명중률",
    help: "일반 공격 명중률에 장착 장비의 명중률 보정을 곱해 적용합니다.",
  },
  {
    field: "criticalRate",
    owner: "equipment",
    support: "runtime",
    label: "치명타율",
    help: "일반 공격과 스킬의 치명타율에 장착 장비의 수치를 더해 적용합니다.",
  },
  {
    field: "usableAsItemSkillId",
    owner: "equipment",
    support: "runtime",
    label: "전투 사용 스킬",
    help: "장착 중인 장비를 전투에서 사용하면 지정한 스킬을 실행합니다.",
  },
  {
    field: "stateInflictIds",
    owner: "equipment",
    support: "runtime",
    label: "공격 상태 부여",
    help: "일반 공격이 적중하면 중복 제거한 상태 후보를 판정합니다.",
  },
  {
    field: "stateInflictionChance",
    owner: "equipment",
    support: "runtime",
    label: "상태 부여율",
    help: "일반 공격의 장비 상태 부여 확률에 적용합니다.",
  },
  {
    field: "stateResistanceChance",
    owner: "equipment",
    support: "runtime",
    label: "상태 저항률",
    help: "장비가 제공하는 상태 저항 판정에 적용합니다.",
  },
  {
    field: "transparent",
    owner: "enemy",
    support: "authoringOnly",
    label: "투명",
    help: "데이터베이스 미리보기에서만 반투명하게 보입니다. 전투 렌더링에는 적용되지 않습니다.",
  },
  {
    field: "flying",
    owner: "enemy",
    support: "authoringOnly",
    label: "비행",
    help: "현재 전투·필드 런타임이 읽지 않습니다. 분류용 메모로만 쓰입니다.",
  },
  {
    field: "graphicHue",
    owner: "enemy",
    support: "authoringOnly",
    label: "색조",
    help: "데이터베이스 미리보기 색조입니다. 전투 스프라이트 색조는 지원하지 않습니다.",
  },
] as const satisfies readonly DatabaseFieldSupportDescriptor[]);

export function databaseFieldSupport(field: string): DatabaseFieldSupportDescriptor {
  const descriptor = DATABASE_FIELD_SUPPORT.find((candidate) => candidate.field === field);
  if (!descriptor) throw new Error(`Missing database field support descriptor: ${field}`);
  return descriptor;
}

export function databaseFieldSupportNotice(...fields: readonly string[]): HTMLElement {
  const descriptors = fields.map(databaseFieldSupport);
  // 접힌 <details> — 장문 안내가 폼 한복판을 차지하지 않도록 기본은 요약 한 줄만.
  const host = document.createElement("details");
  host.className = "db-field-support-notice";
  host.dataset.testid = "db-field-support-notice";
  const summary = document.createElement("summary");
  // 요약 줄이 결론을 말해야 한다. "필드 적용 범위 안내 (3개 필드)" 는 접힌 상태에서
  // 아무 정보도 주지 않아, 런타임이 읽지 않는 필드가 평범한 컨트롤로 보였다(2026-09-01 실측).
  //
  // 문구는 행 배지와 같은 어휘("런타임 적용" 여부)로만 말한다. "게임에 아무 영향 없음"
  // 까지 단정하면 과하다. 정확한 사용 범위는 펼친 행이 필드별로 말한다.
  const inert = descriptors.filter((descriptor) => descriptor.support !== "runtime");
  host.dataset.inertFields = String(inert.length);
  summary.textContent = inert.length === 0
    ? `필드 적용 범위 안내 (${descriptors.length}개 필드)`
    : inert.length === descriptors.length
      ? `아래 ${inert.length}개 필드는 런타임 적용 대상이 아닙니다 — 자세히`
      : `${descriptors.length}개 필드 중 ${inert.length}개는 런타임 적용 대상이 아닙니다 — 자세히`;
  host.append(summary);
  for (const descriptor of descriptors) {
    const row = document.createElement("p");
    row.dataset.field = descriptor.field;
    row.dataset.runtimeSupport = descriptor.support;
    const badge = document.createElement("strong");
    badge.textContent = descriptor.support === "runtime" ? "런타임 적용" : descriptor.support === "authoringOnly" ? "저작 화면 전용" : "저장 전용";
    const copy = document.createElement("span");
    copy.textContent = ` · ${descriptor.label}: ${descriptor.help}`;
    row.append(badge, copy);
    host.append(row);
  }
  return host;
}
