import type { JsonSchema } from "@/editor/tools/types";
import type { M2CommandFieldSpec } from "@/project/eventCommands/m2Catalog";

export const COMMAND_TITLES: Readonly<Record<string, string>> = {
  "030": "화면 전환 예약",
  "044": "화면 숨기기",
  "045": "화면 표시",
  "046": "화면 색조",
  "047": "화면 섬광",
  "048": "화면 흔들기",
  "052": "그림 이동",
  "056": "이벤트 섬광",
  "063": "배경 음악 기억",
  "064": "기억한 배경 음악 재생",
  "201": "카메라 제어",
  "202": "화면 효과",
  "210": "소리 겹치기",
  "224": "입자 효과",
  "225": "캐릭터 모습 효과",
  "226": "승강 발판 이동",
};

const hexPattern = "^#[0-9a-fA-F]{6}$";
const numberText = "^-?[0-9]+(?:\\.[0-9]+)?$";

const fieldDescriptions: Readonly<Record<string, string>> = {
  x: "가로 위치",
  y: "세로 위치",
  durationMs: "효과가 지속되는 시간(밀리초)",
  fadeMs: "소리가 서서히 커지는 시간(밀리초)",
  volume: "음량(백분율)",
  opacity: "불투명도",
  resourceId: "프로젝트나 공용 목록에서 확인한 소리 자료",
  eventId: "특정 이벤트를 고른 경우 이 맵에서 확인한 이벤트 식별자",
  pictureId: "표시 명령에 지정한 그림 칸 이름",
  zoom: "카메라 확대 배율",
  se: "목록에서 확인한 기계음 효과음. 생략하면 기본 기계음을 씁니다.",
};

const numberBounds: Readonly<Record<string, { minimum?: number; maximum?: number }>> = {
  durationMs: { minimum: 0 },
  fadeMs: { minimum: 0 },
  opacity: { minimum: 0, maximum: 255 },
  scale: { minimum: 0 },
  volume: { minimum: 0, maximum: 100 },
};

function catalogFieldSchema(field: M2CommandFieldSpec): JsonSchema {
  const description = fieldDescriptions[field.key] ?? field.label;
  if (field.type === "number") {
    return {
      type: "number", description, ...numberBounds[field.key],
      ...(field.min === undefined ? {} : { minimum: field.min }),
      ...(field.max === undefined ? {} : { maximum: field.max }),
    };
  }
  if (field.type === "boolean") return { type: "boolean", description };
  if (field.options) {
    const options = field.options.map(({ value }) => value);
    return {
      description: `${description}. ${field.options.map(({ label }) => label).join(" / ")}`,
      ...(field.allowHex
        ? { type: "string", oneOf: [{ type: "string", enum: options }, { type: "string", pattern: hexPattern }] }
        : { type: "string", enum: options }),
    };
  }
  return { type: "string", description };
}

export function modelFields(row: string, fields: readonly M2CommandFieldSpec[]): Record<string, JsonSchema> {
  const properties = Object.fromEntries(fields.map(field => [field.key, catalogFieldSchema(field)]));
  switch (row) {
    case "030":
      return { value: { type: "string", minLength: 1, description: "기록할 화면 전환 값" } };
    case "046":
      properties.value = { type: "string", description: "직접 지정할 색. 여섯 자리 색상 코드나 쉼표로 구분한 빨강·초록·파랑 값(0~255)과 선택 불투명도(0~1)" };
      break;
    case "047":
    case "048":
      delete properties.value;
      properties.durationMs = { ...properties.durationMs, minimum: 50, maximum: 5000 };
      break;
    case "052":
      properties.pictureId = { ...properties.pictureId, minLength: 1 };
      properties.x = { ...properties.x, description: "가로 위치. 생략하면 현재 위치를 유지합니다." };
      properties.y = { ...properties.y, description: "세로 위치. 생략하면 현재 위치를 유지합니다." };
      properties.scale = { ...properties.scale, description: "그림 크기(백분율). 생략하면 현재 크기를 유지합니다." };
      properties.opacity = { ...properties.opacity, description: "불투명도(0~255). 생략하면 현재 불투명도를 유지합니다." };
      properties.waitForPicture = { type: "boolean", description: "그림 움직임이 끝날 때까지 기다릴지 여부" };
      break;
    case "056":
      delete properties.value;
      properties.target = { type: "string", minLength: 1, description: "이 맵에서 확인한 섬광 대상 이벤트. 생략하면 현재 이벤트" };
      break;
    case "201":
      properties.x = { ...properties.x, description: "카메라가 비출 맵 칸의 가로 번호(첫 칸은 0)" };
      properties.y = { ...properties.y, description: "카메라가 비출 맵 칸의 세로 번호(첫 칸은 0)" };
      properties.targetEventId = { type: "string", minLength: 1, description: "특정 이벤트를 비출 때 확인한 이벤트 식별자. 이 경우 대상과 좌표는 생략합니다." };
      properties.durationMs = { ...properties.durationMs, maximum: 60_000 };
      properties.wait = { type: "boolean", description: "카메라 이동이 끝날 때까지 기다릴지 여부" };
      break;
    case "202":
      properties.value = { type: "string", description: "효과별 설정값. 섬광·색조는 색, 날씨는 종류와 강도, 검은 띠는 높이(0~25%), 문은 가로·세로 위치와 문 크기" };
      break;
    case "210":
      properties.channel = { ...properties.channel, description: "소리 종류. 배경 음악, 배경 소리, 짧은 음악, 효과음, 환경음" };
      properties.resourceId = { ...properties.resourceId, minLength: 1 };
      break;
    case "225":
      properties.tintHex = { ...properties.tintHex, pattern: `^(?:${hexPattern.slice(1, -1)})?$` };
      properties.angle = { type: "string", pattern: `^(?:${numberText.slice(1, -1)})?$`, description: "기울기 각도(-360~360도)를 글자로 입력합니다. 비워 두면 현재 각도를 유지합니다." };
      properties.opacity = { type: "string", pattern: "^(?:[0-9]{1,3})?$", description: "불투명도(0~100%)를 글자로 입력합니다. 비워 두면 현재 불투명도를 유지합니다." };
      break;
    case "226":
      properties.x = { ...properties.x, type: "integer", minimum: -1, description: "발판 왼쪽 칸. -1은 주인공 위치" };
      properties.y = { ...properties.y, type: "integer", minimum: -1, description: "발판 위쪽 칸. -1은 주인공 위치" };
      for (const key of ["distance", "width", "depth"]) properties[key] = { ...properties[key], type: "integer" };
      break;
  }
  return properties;
}
