// 이벤트 명령 폼의 필드 어휘 (단일 진실 소스).
//
// 배경: Command 유니온은 75종이지만, 실제로 쓰이는 "필드 모양"은 12종뿐이다.
// (레코드 참조 30곳 / 스위치·변수 참조 / 연산자 열거형 5회 중복 선언 / VariableOperand 6곳 /
//  Command[] 분기 슬롯 14곳 / 좌표 / 불리언 / 열거형 / 자유 텍스트 …)
// 지금까지는 이 12종을 commandBody*.ts 15개 파일이 각자 손으로 그렸고, 그래서
// 같은 "연산자 + 금액" 조합이 커맨드마다 다른 마크업·다른 간격으로 나왔다.
//
// 이 파일은 DOM 을 만들지 않는다 — 순수 데이터 서술이다.
// 실제 렌더는 panels/eventEditor/schemaCommandBody.ts 가 기존 프리미티브
// (segmentedSelect / numberInput / switchPicker / itemPicker …)에 위임한다.
// 따라서 스키마 도입은 시각·testid 계약을 바꾸지 않는다.

/** 필드 노출 조건. cmd 는 현재 편집 중인 명령(부분 적용 상태)이다. */
export type FieldWhen = (cmd: Record<string, unknown>) => boolean;

export type EnumChoice = {
  readonly value: string;
  readonly label: string;
  /** 세그먼트 버튼 testid 접미사. 생략 시 value 를 슬러그화. */
  readonly key?: string;
};

/** 레코드 참조가 가리키는 데이터베이스 목록. */
export type RecordSource =
  | "actor"
  | "item"
  | "map"
  | "event"
  | "troop"
  | "skill"
  | "equipment"
  | "commonEvent"
  | "monsterSpecies"
  | "animation"
  | "image"
  | "audio"
  | "movie";

type FieldBase = {
  readonly label: string;
  /** 이 필드를 언제 보일지. 생략 시 항상 노출. */
  readonly when?: FieldWhen;
  /** 비어 있어도 검증을 통과시킬지. */
  readonly optional?: boolean;
  /** testid 접미사 override. 생략 시 필드 키를 케밥케이스로. */
  readonly testId?: string;
};

export type FieldSpec =
  /** 한 줄 자유 텍스트. */
  | (FieldBase & { readonly type: "text"; readonly placeholder?: string })
  /** 여러 줄 본문. preview 를 주면 해당 미리보기 위젯이 따라붙는다. */
  | (FieldBase & { readonly type: "multiline"; readonly preview?: "messageWindow" })
  /** 정수 또는 소수 입력 + 스테퍼. */
  | (FieldBase & {
      readonly type: "number";
      readonly min?: number | ((command: Record<string, unknown>) => number);
      readonly max?: number | ((command: Record<string, unknown>) => number);
      readonly step?: number;
      readonly unit?: string;
    })
  /** 0–N 범위 슬라이더. */
  | (FieldBase & {
      readonly type: "range";
      readonly min: number;
      readonly max: number;
      readonly unit?: string;
    })
  /** 켬/끔 토글. */
  | (FieldBase & { readonly type: "bool" })
  /** 고정 선택지. 3개 이하면 세그먼트, 그 이상이면 select 로 렌더된다. */
  | (FieldBase & { readonly type: "enum"; readonly choices: readonly EnumChoice[] })
  /** 산술 연산자. enum 의 특수형 — 5곳에 중복 선언돼 있던 것을 하나로. */
  | (FieldBase & { readonly type: "op"; readonly ops: readonly string[] })
  /**
   * 고정값 ↔ 변수 참조 전환을 내장한 피연산자 (VariableOperand).
   * 지금은 이 전환이 커맨드마다 따로 구현돼 있거나(commandBodyVariable) 아예 빠져 있다
   * (changeGold 는 parseInt 로 변수 참조를 소실시킨다).
   */
  | (FieldBase & { readonly type: "operand"; readonly min?: number })
  /** 스위치 참조. 목록 피커·인라인 검색이 자동으로 붙는다. */
  | (FieldBase & { readonly type: "switch" })
  /** 변수 참조. */
  | (FieldBase & { readonly type: "variable" })
  /** 데이터베이스 레코드 참조. */
  | (FieldBase & {
      readonly type: "record";
      readonly source: RecordSource;
      readonly allowEmpty?: boolean;
    })
  /**
   * 맵 좌표 한 덩어리. RM2003 은 mapId·x·y 를 별개 필드로 둘 수밖에 없었지만,
   * 좌표를 하나의 필드 타입으로 선언하면 미니맵 위젯을 붙일 수 있다.
   */
  | (FieldBase & { readonly type: "mapPoint"; readonly mapField: string })
  /**
   * 스키마로 표현되지 않는 케이스의 탈출구.
   * 전용 위젯이 인스펙터 "안"에 들어간다 — 모달을 새로 열지 않는다.
   */
  | (FieldBase & { readonly type: "custom"; readonly widget: CustomWidgetId });

/** f.custom() 이 가리킬 수 있는 전용 위젯. 늘어나면 여기에 추가한다. */
export type CustomWidgetId =
  | "moveRoute"
  | "choiceOptions"
  | "condition"
  | "shopStock"
  | "faceGraphic"
  | "screenPoint";

export type FieldMap = Readonly<Record<string, FieldSpec>>;

// ── 빌더 ──────────────────────────────────────────────────────────
// 스키마 선언부의 가독성을 위한 얇은 래퍼. 런타임 동작은 없다.

type Opt<T> = Omit<T, "type" | "label"> & { readonly label?: string };

function build<T extends FieldSpec>(spec: T): T {
  return Object.freeze(spec);
}

export const f = {
  text: (label: string, opts: Opt<Extract<FieldSpec, { type: "text" }>> = {}) =>
    build({ ...opts, type: "text", label } as Extract<FieldSpec, { type: "text" }>),

  multiline: (label: string, opts: Opt<Extract<FieldSpec, { type: "multiline" }>> = {}) =>
    build({ ...opts, type: "multiline", label } as Extract<FieldSpec, { type: "multiline" }>),

  number: (label: string, opts: Opt<Extract<FieldSpec, { type: "number" }>> = {}) =>
    build({ ...opts, type: "number", label } as Extract<FieldSpec, { type: "number" }>),

  range: (label: string, min: number, max: number, opts: Partial<Opt<Extract<FieldSpec, { type: "range" }>>> = {}) =>
    build({ ...opts, type: "range", label, min, max } as Extract<FieldSpec, { type: "range" }>),

  bool: (label: string, opts: Opt<Extract<FieldSpec, { type: "bool" }>> = {}) =>
    build({ ...opts, type: "bool", label } as Extract<FieldSpec, { type: "bool" }>),

  enum: (
    label: string,
    choices: readonly EnumChoice[],
    opts: Partial<Opt<Extract<FieldSpec, { type: "enum" }>>> = {}
  ) => build({ ...opts, type: "enum", label, choices } as Extract<FieldSpec, { type: "enum" }>),

  op: (label: string, ops: readonly string[], opts: Partial<Opt<Extract<FieldSpec, { type: "op" }>>> = {}) =>
    build({ ...opts, type: "op", label, ops } as Extract<FieldSpec, { type: "op" }>),

  operand: (label: string, opts: Opt<Extract<FieldSpec, { type: "operand" }>> = {}) =>
    build({ ...opts, type: "operand", label } as Extract<FieldSpec, { type: "operand" }>),

  switch: (label: string, opts: Opt<Extract<FieldSpec, { type: "switch" }>> = {}) =>
    build({ ...opts, type: "switch", label } as Extract<FieldSpec, { type: "switch" }>),

  variable: (label: string, opts: Opt<Extract<FieldSpec, { type: "variable" }>> = {}) =>
    build({ ...opts, type: "variable", label } as Extract<FieldSpec, { type: "variable" }>),

  record: (
    label: string,
    source: RecordSource,
    opts: Partial<Opt<Extract<FieldSpec, { type: "record" }>>> = {}
  ) => build({ ...opts, type: "record", label, source } as Extract<FieldSpec, { type: "record" }>),

  mapPoint: (label: string, mapField: string, opts: Partial<Opt<Extract<FieldSpec, { type: "mapPoint" }>>> = {}) =>
    build({ ...opts, type: "mapPoint", label, mapField } as Extract<FieldSpec, { type: "mapPoint" }>),

  custom: (
    label: string,
    widget: CustomWidgetId,
    opts: Partial<Opt<Extract<FieldSpec, { type: "custom" }>>> = {}
  ) => build({ ...opts, type: "custom", label, widget } as Extract<FieldSpec, { type: "custom" }>),
} as const;

/** 현재 명령 값에서 실제로 노출될 필드만 추린다. */
export function visibleFields(fields: FieldMap, cmd: Record<string, unknown>): readonly (readonly [string, FieldSpec])[] {
  return Object.entries(fields).filter(([, spec]) => (spec.when ? spec.when(cmd) : true));
}

/** 필드 키 → testid 접미사. */
export function fieldTestId(key: string, spec: FieldSpec): string {
  return spec.testId ?? key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}
