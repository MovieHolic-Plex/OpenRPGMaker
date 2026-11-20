import { parseWeightedBranchTable } from "@/editor/panels/eventEditor/weightedBranchTable";
import { QTE_KEYS } from "@/player/interpreter/minigameCommands";
import type { M2CommandFields, Project } from "@/project/types";
import { PrimitiveError } from "../../errors";
import type { PrimitiveContext } from "../../types";
import { displayText } from "../../../target";

export interface ModernLogicRow {
  readonly title?: string;
  readonly required?: readonly string[];
  readonly descriptions?: Readonly<Record<string, string>>;
  validate?(ctx: PrimitiveContext, fields: M2CommandFields): void;
  detail(ctx: PrimitiveContext, fields: M2CommandFields): string;
}

const text = (fields: M2CommandFields, key: string) => String(fields[key] ?? "").trim();

function requireText(value: string, label: string): void {
  if (!value) throw new PrimitiveError(`${label} 항목을 입력해 주세요.`);
}

function requireReference(rows: readonly { id: string }[], id: string, label: string): void {
  if (!id || !rows.some(row => row.id === id)) {
    throw new PrimitiveError(`${label} 항목을 프로젝트에서 찾을 수 없습니다.`);
  }
}

function optionalReference(rows: readonly { id: string }[], id: string, label: string): void {
  if (id) requireReference(rows, id, label);
}

function runtimeKey(value: string, label: string): void {
  requireText(value, label);
  if (Object.hasOwn(Object.prototype, value) || value === "prototype") {
    throw new PrimitiveError(`${label} 항목에 다른 이름을 입력해 주세요.`);
  }
}

function quote(value: string): string {
  const text = displayText(value.replace(/\bm2-\d{3}(?:-[a-z\d-]+)?\b|[{}\[\]]/giu, "…"), "");
  if (!text || /^[… ]+$/u.test(text)) return "";
  return `「${text.length > 30 ? text.slice(0, 29) + "…" : text}」 `;
}

function seconds(fields: M2CommandFields, key: string): string {
  return `${Number(fields[key]) / 1000}초`;
}

function validateWait({ project, target }: PrimitiveContext, fields: M2CommandFields): void {
  const reference = text(fields, "target");
  const map = target.kind === "event" ? project.maps[target.mapId] : undefined;
  switch (fields.condition) {
    case "switchOn":
    case "switchOff":
      requireReference(project.switches, reference, "대기 스위치");
      break;
    case "variable":
      requireReference(project.variables, reference, "대기 변수");
      if (!text(fields, "value") || !Number.isFinite(Number(fields.value))) {
        throw new PrimitiveError("기다릴 변수의 값을 숫자로 입력해 주세요.");
      }
      // The interpreter compares the number's string form, so a differently formatted value will never match.
      if (String(Number(fields.value)) !== fields.value) {
        throw new PrimitiveError("기다릴 변수의 값을 공백이나 불필요한 영 없이 입력해 주세요.");
      }
      break;
    case "eventIdle":
      if (reference && reference !== "this-event") requireReference(map?.events ?? [], reference, "대기 이벤트");
      break;
    case "region":
      requireReference(map?.layoutPlan?.regions ?? [], reference, "대기 구역");
      break;
  }
}

const ACTOR_QUERIES = ["actorLevel", "actorHp", "actorMp", "actorMaxHp", "actorHpPercent"];
const EXPRESSION_BUILTINS = new Set([
  "gold", "playerX", "playerY", "leaderLevel", "leaderHp", "leaderMp", "leaderHpPercent",
  "partySize", "playtime", "steps", "clearCount",
]);

function validateExpression(project: Project, expression: string): void {
  let depth = 0;
  let needsValue = true;
  const tokens = expression.match(/\d+(?:\.\d+)?|[a-z_][a-z\d_]*|[^\s]/giu) ?? [];
  for (const token of tokens) {
    if (needsValue && token === "(") {
      depth++;
    } else if (needsValue && /^(?:\d+(?:\.\d+)?|[a-z_][a-z\d_]*)$/iu.test(token)) {
      if (/^[a-z_]/iu.test(token)) {
        if (!EXPRESSION_BUILTINS.has(token)) requireReference(project.variables, token, "계산에 쓰는 변수");
      } else if (!Number.isFinite(Number(token))) {
        throw new PrimitiveError("계산식의 숫자가 너무 큽니다.");
      }
      needsValue = false;
    } else if (!needsValue && token === ")" && depth > 0) {
      depth--;
    } else if (!needsValue && "+-*/".includes(token)) {
      needsValue = true;
    } else {
      throw new PrimitiveError("계산식은 숫자, 변수, 사칙연산과 괄호로 입력해 주세요.");
    }
  }
  if (needsValue || depth !== 0) throw new PrimitiveError("계산식의 값과 괄호를 확인해 주세요.");
}

function validateQuery({ project }: PrimitiveContext, fields: M2CommandFields): void {
  requireReference(project.variables, text(fields, "variableId"), "결과 변수");
  const target = text(fields, "target");
  const query = text(fields, "query");
  if (query === "itemCount") requireReference(project.database.items, target, "조회할 아이템");
  if (query === "switch") requireReference(project.switches, target, "조회할 스위치");
  if (query === "variable") requireReference(project.variables, target, "조회할 변수");
  if (query === "followerPresent") requireText(target, "동행자 이름");
  if (query === "stringLength") requireText(target, "문자열 변수 이름");
  if (ACTOR_QUERIES.includes(query) && target !== "leader") optionalReference(project.database.actors, target, "조회할 배우");
  if (query === "actorHasState") {
    const [actor, state] = target.includes(":") ? target.split(":") : ["anyone", target];
    if (actor && actor !== "anyone" && actor !== "leader") requireReference(project.database.actors, actor, "조회할 배우");
    requireReference(project.database.states, state ?? "", "조회할 상태");
  }
}

export const ROWS: Readonly<Partial<Record<number, ModernLogicRow>>> = {
  206: {
    title: "조건 대기",
    descriptions: {
      target: "조건에서 확인할 스위치, 변수, 구역 또는 이벤트. 현재 이벤트의 이동을 기다리면 생략할 수 있습니다.",
      value: "변수 조건에서 비교할 숫자를 글자로 입력합니다.",
      timeoutMs: "최대 대기 시간(밀리초). 0이면 조건이 맞을 때까지 기다립니다.",
    },
    validate: validateWait,
    detail(_ctx, fields) {
      const condition = ({ switchOn: "스위치 켜짐", switchOff: "스위치 꺼짐", variable: "변수 값 일치", region: "구역 진입", eventIdle: "이동 완료" })[text(fields, "condition")];
      return `${condition ?? "조건 충족"}까지 ${Number(fields.timeoutMs) > 0 ? `최대 ${seconds(fields, "timeoutMs")} ` : ""}기다리는`;
    },
  },
  208: {
    required: ["questId", "objectiveId"],
    descriptions: {
      questId: "이벤트에서 기록할 퀘스트의 이름표입니다. 같은 퀘스트를 갱신할 때 같은 값을 씁니다.",
      objectiveId: "퀘스트 안에서 목표를 구분하는 이름표입니다.",
      text: "목표의 설명 문구입니다.",
    },
    validate(_ctx, fields) {
      runtimeKey(text(fields, "questId"), "퀘스트 이름표");
      runtimeKey(text(fields, "objectiveId"), "목표 이름표");
    },
    detail(_ctx, fields) {
      const action = ({ start: "시작하는", update: "갱신하는", complete: "완료하는", fail: "실패 처리하는" })[text(fields, "state")];
      return `${quote(text(fields, "text"))}퀘스트 목표를 ${action ?? "기록하는"}`;
    },
  },
  211: {
    title: "확률로 결과 뽑기",
    required: ["resultVariableId"],
    descriptions: {
      table: "줄마다 결과 이름과 가중치를 등호로 잇습니다. 양수인 줄만 뽑습니다.",
      resultVariableId: "뽑은 결과 번호를 저장할 기존 변수입니다. 번호는 0부터 시작합니다.",
    },
    validate({ project }, fields) {
      const rows = parseWeightedBranchTable(text(fields, "table"));
      if (rows.length === 0 || !Number.isFinite(rows.reduce((sum, row) => sum + row.weight, 0))) {
        throw new PrimitiveError("뽑을 결과에 유한한 양수 가중치를 하나 이상 입력해 주세요.");
      }
      requireReference(project.variables, text(fields, "resultVariableId"), "결과 변수");
    },
    detail: (_ctx, fields) => `결과 ${parseWeightedBranchTable(text(fields, "table")).length}개 중 확률로 뽑는`,
  },
  214: {
    title: "화면 안내",
    descriptions: {
      surface: "안내를 띄울 위치",
      message: "화면에 보여 줄 문구입니다. 현재 목표는 문구를 비우면 지워집니다.",
      durationMs: "안내가 보일 시간(밀리초)입니다.",
    },
    validate(_ctx, fields) {
      if (fields.surface !== "objectiveChip") requireText(text(fields, "message"), "안내 문구");
    },
    detail(_ctx, fields) {
      if (fields.surface === "objectiveChip" && !text(fields, "message")) return "화면의 현재 목표를 지우는";
      const surface = ({ toast: "짧은 알림", hud: "상태 표시", banner: "배너", menuPrompt: "메뉴 안내", objectiveChip: "현재 목표" })[text(fields, "surface")];
      return `${quote(text(fields, "message"))}문구를 ${surface ?? "화면 안내"}로 보여 주는`;
    },
  },
  215: {
    title: "실행 기록",
    required: ["message"],
    validate(_ctx, fields) { requireText(text(fields, "message"), "기록 문구"); },
    detail(_ctx, fields) {
      const level = ({ info: "정보", warn: "경고", error: "오류" })[text(fields, "level")];
      return `${quote(text(fields, "message"))}문구를 ${level ?? "실행"} 기록에 남기는`;
    },
  },
  216: {
    required: ["expression", "resultVariableId"],
    descriptions: {
      expression: "숫자, 변수, 소지금 등의 기본 값으로 만든 사칙연산 식입니다. 괄호로 순서를 정할 수 있습니다.",
    },
    validate({ project }, fields) {
      validateExpression(project, text(fields, "expression"));
      requireReference(project.variables, text(fields, "resultVariableId"), "결과 변수");
    },
    detail: () => "계산한 값을 변수에 저장하는",
  },
  217: {
    required: ["variableId"],
    descriptions: {
      target: "아이템 수, 스위치 값, 변수 값처럼 대상이 필요한 조회의 대상입니다. 배우와 상태를 함께 지정할 때는 콜론으로 잇습니다.",
      variableId: "조회한 값을 저장할 기존 변수입니다.",
    },
    validate: validateQuery,
    detail(_ctx, fields) {
      const query = ({
        gold: "소지금", itemCount: "아이템 수", followerPresent: "동행 여부", playerX: "주인공 가로 위치",
        playerY: "주인공 세로 위치", switch: "스위치 상태", variable: "변수 값", actorLevel: "배우 레벨",
        actorHp: "배우 체력", actorMp: "배우 마력", actorMaxHp: "배우 최대 체력", actorHpPercent: "배우 체력 비율",
        actorHasState: "배우의 상태 보유 여부", partyLeaderIndex: "선두 배우 번호", partySize: "파티 인원",
        playerFacing: "주인공이 보는 방향", playtimeSeconds: "플레이 시간(초)", steps: "걸음 수",
        clearCount: "클리어 횟수", weekday: "요일", stringLength: "문자열 길이",
      })[text(fields, "query")];
      return `조회한 ${query ?? "값"}을 변수에 담는`;
    },
  },
  219: {
    title: "누른 키 확인",
    validate({ project }, fields) {
      const direction = text(fields, "dirVariableId");
      const switches = ["confirmSwitchId", "cancelSwitchId", "dashSwitchId"].map(key => text(fields, key));
      if (!direction && !switches.some(Boolean)) throw new PrimitiveError("키 상태를 저장할 변수나 스위치를 골라 주세요.");
      optionalReference(project.variables, direction, "방향 변수");
      for (const id of switches) optionalReference(project.switches, id, "키 상태 스위치");
    },
    detail: () => "현재 누른 키의 상태를 기록하는",
  },
  220: {
    descriptions: {
      options: "선택지 문구를 한 줄에 하나씩 최대 여섯 개 입력합니다.",
      timeLimitMs: "고를 시간(밀리초)입니다.",
      resultVariableId: "고른 번호를 저장할 변수입니다. 첫 선택지는 1, 시간 초과는 0입니다.",
    },
    validate({ project }, fields) {
      const count = text(fields, "options").split(/\r?\n/u).filter(line => line.trim()).length;
      if (count < 1 || count > 6) throw new PrimitiveError("선택지를 한 개에서 여섯 개까지 입력해 주세요.");
      optionalReference(project.variables, text(fields, "resultVariableId"), "결과 변수");
    },
    detail: (_ctx, fields) => `${quote(text(fields, "prompt"))}선택지를 ${seconds(fields, "timeLimitMs")} 안에 고르는`,
  },
  221: {
    title: "제한시간 버튼 입력",
    descriptions: {
      keys: "위·아래·왼쪽·오른쪽은 각각 up·down·left·right, 결정과 취소는 z·x입니다. 쉼표로 구분해 최대 열두 개를 입력합니다.",
      windowMs: "키 하나당 제한 시간 또는 연타 시간(밀리초)입니다.",
    },
    validate({ project }, fields) {
      const keys = text(fields, "keys").toLowerCase().split(/[\s,]+/u).filter(Boolean);
      if (!keys.length || keys.length > 12 || keys.some(key => !QTE_KEYS.some(allowed => allowed === key))) {
        throw new PrimitiveError("방향 키와 결정 키, 취소 키 중 하나 이상을 골라 주세요.");
      }
      optionalReference(project.variables, text(fields, "resultVariableId"), "결과 변수");
      optionalReference(project.switches, text(fields, "resultSwitchId"), "성공 스위치");
    },
    detail: (_ctx, fields) => fields.mode === "mash"
      ? `${seconds(fields, "windowMs")} 동안 버튼을 연타하는`
      : `버튼마다 ${seconds(fields, "windowMs")} 안에 순서대로 누르는`,
  },
  222: {
    descriptions: {
      scoreId: "같은 최고 점수표를 읽거나 갱신할 때 쓰는 이름표입니다.",
    },
    validate({ project }, fields) {
      runtimeKey(text(fields, "scoreId"), "점수 이름표");
      if (fields.action === "submit" || fields.action === "submitLow") {
        requireReference(project.variables, text(fields, "valueVariableId"), "점수 변수");
      } else {
        optionalReference(project.variables, text(fields, "valueVariableId"), "점수 변수");
      }
      optionalReference(project.variables, text(fields, "resultVariableId"), "최고 점수 변수");
      optionalReference(project.switches, text(fields, "recordSwitchId"), "새 기록 스위치");
    },
    detail(_ctx, fields) {
      return ({
        submit: "더 높은 점수로 기록을 갱신하는", submitLow: "더 낮은 점수로 기록을 갱신하는",
        read: "최고 점수를 읽는", reset: "최고 점수를 지우는",
      })[text(fields, "action")] ?? "최고 점수를 다루는";
    },
  },
  223: {
    validate({ project }, fields) { optionalReference(project.variables, text(fields, "resultVariableId"), "결과 변수"); },
    detail: (_ctx, fields) => fields.transfer === false || fields.transfer === "false"
      ? "순간이동 메뉴에서 고른 장소를 기록하는"
      : "순간이동 메뉴에서 고른 장소로 이동하는",
  },
  227: {
    title: "일지 한 줄",
    descriptions: {
      lineId: "지우거나 되살릴 줄의 이름표입니다. 새 줄에 이름표를 비우면 자동으로 붙입니다.",
      writer: "필체 목록에서 고른 필체 또는 일지에 표시할 기록자 이름입니다.",
    },
    validate({ project }, fields) {
      if (fields.action === "write") requireText(text(fields, "text"), "일지 문구");
      else requireText(text(fields, "lineId"), "일지 줄 이름표");
      optionalReference(project.database.actors, text(fields, "learnActorId"), "기술을 배울 배우");
      optionalReference(project.database.skills, text(fields, "learnSkillId"), "다시 배울 기술");
      optionalReference(project.switches, text(fields, "resultSwitchId"), "일지 변경 스위치");
    },
    detail(_ctx, fields) {
      if (fields.action === "erase") return "일지 한 줄을 지우는";
      if (fields.action === "reread") return "지운 일지 한 줄을 다시 읽는";
      return `${quote(text(fields, "text"))}문구를 일지에 쓰는`;
    },
  },
};
