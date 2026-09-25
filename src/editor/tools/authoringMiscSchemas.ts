import type { JsonSchema } from "./types";
import { EMOTE_KINDS } from "@/project/emotes";
import {
  DIALOGUE_CONTAINER_IDS,
  DIALOGUE_EMOTION_IDS,
  DIALOGUE_PITCH_LIMITS,
  dialogueContainerGuideLines,
  DIALOGUE_SPEED_LIMITS,
  DIALOGUE_STYLE_IDS,
  DIALOGUE_VOICE_IDS,
  dialogueVoiceGuideLines,
} from "@/project/dialogueStyles";
import { FONT_REGISTRY } from "@/project/fontRegistry";

const DIRECTIONS = ["down", "left", "right", "up"] as const;
const RESOURCE_KINDS = [
  "chipset", "charset", "battle", "battleCharset", "battleWeapon", "backdrop",
  "gameOver", "monster", "faceset", "picture", "movie", "system", "system2", "title", "music", "sound",
] as const;
const SEASONS = ["spring", "summer", "fall", "winter"] as const;

const ENDPOINT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    mapId: { type: "string" },
    x: { type: "integer", minimum: 0 },
    y: { type: "integer", minimum: 0 },
    direction: { type: "string", enum: [...DIRECTIONS] },
  },
  required: ["mapId", "x", "y"],
  additionalProperties: false,
};

const STRING_ARRAY_SCHEMA: JsonSchema = { type: "array", items: { type: "string" } };

export const UPSERT_MAP_CONNECTION_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    connection: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        from: ENDPOINT_SCHEMA,
        to: ENDPOINT_SCHEMA,
        playerEnabled: { type: "boolean" },
        npcEnabled: { type: "boolean" },
      },
      required: ["id", "from", "to", "playerEnabled", "npcEnabled"],
      additionalProperties: false,
    },
  },
  required: ["connection"],
  additionalProperties: false,
};

export const DELETE_MAP_CONNECTION_SCHEMA: JsonSchema = {
  type: "object",
  properties: { connectionId: { type: "string" } },
  required: ["connectionId"],
  additionalProperties: false,
};

export const UPSERT_VILLAGE_DOCUMENT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    document: {
      type: "object",
      properties: {
        id: { type: "string" },
        mapId: { type: "string" },
        title: { type: "string" },
        markdown: { type: "string" },
      },
      required: ["id", "mapId", "title", "markdown"],
      additionalProperties: false,
    },
  },
  required: ["document"],
  additionalProperties: false,
};

export const DELETE_VILLAGE_DOCUMENT_SCHEMA: JsonSchema = {
  type: "object",
  properties: { documentId: { type: "string" } },
  required: ["documentId"],
  additionalProperties: false,
};

export const UPSERT_RESOURCE_PROFILE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    profile: {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...RESOURCE_KINDS] },
        name: { type: "string" },
        assetId: { type: "string" },
        tileWidth: { type: "integer", minimum: 1 },
        tileHeight: { type: "integer", minimum: 1 },
        imageWidth: { type: "integer", minimum: 1 },
        imageHeight: { type: "integer", minimum: 1 },
      },
      required: ["kind", "name", "assetId"],
      additionalProperties: false,
    },
  },
  required: ["profile"],
  additionalProperties: false,
};

export const DELETE_RESOURCE_PROFILE_SCHEMA: JsonSchema = {
  type: "object",
  properties: { assetId: { type: "string" } },
  required: ["assetId"],
  additionalProperties: false,
};

export const UPSERT_CHARACTER_PROFILE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    characterId: { type: "string" },
    profile: {
      type: "object",
      properties: {
        displayName: { type: "string" },
        birthday: {
          type: "object",
          properties: {
            season: { type: "string", enum: [...SEASONS] },
            day: { type: "integer", minimum: 1, maximum: 99 },
          },
          required: ["season", "day"],
          additionalProperties: false,
        },
        giftPrefs: {
          type: "object",
          properties: {
            loved: STRING_ARRAY_SCHEMA,
            liked: STRING_ARRAY_SCHEMA,
            disliked: STRING_ARRAY_SCHEMA,
          },
          additionalProperties: false,
        },
        giftResponses: {
          type: "object",
          properties: {
            loved: { type: "string" },
            liked: { type: "string" },
            neutral: { type: "string" },
            disliked: { type: "string" },
            alreadyGifted: { type: "string" },
            noItems: { type: "string" },
          },
          additionalProperties: false,
        },
        dialogue: {
          type: "object",
          description: "이 인물이 말할 때의 대사창. 비운 칸은 프로젝트 기본(set_project_settings dialogue.style)을 따른다. 생략하면 기존 값을 유지한다.",
          properties: {
            style: { type: "string", enum: [...DIALOGUE_STYLE_IDS], description: "이 인물만 다른 대화창(보통 생략)." },
            nameColor: { type: "string", pattern: "^#[0-9a-fA-F]{6}$", description: "이름표 글자 색 #rrggbb. 주요 인물마다 다르게." },
            voice: { type: "string", enum: [...DIALOGUE_VOICE_IDS], description: `글자마다 나는 목소리:\n${dialogueVoiceGuideLines().join("\n")}` },
            pitch: { type: "integer", minimum: DIALOGUE_PITCH_LIMITS.min, maximum: DIALOGUE_PITCH_LIMITS.max, description: "목소리 높이(반음). 아이·작은 동물 +, 노인·거인 -." },
            speed: { type: "number", minimum: DIALOGUE_SPEED_LIMITS.min, maximum: DIALOGUE_SPEED_LIMITS.max, description: "말 빠르기 배율. 수다쟁이 1.3, 느긋한 인물 0.8." },
            font: { type: "string", enum: FONT_REGISTRY.map((font) => font.id) },
            container: { type: "string", enum: [...DIALOGUE_CONTAINER_IDS], description: `이 인물 대사의 기본 그릇(보통 생략 = box):\n${dialogueContainerGuideLines().join("\n")}` },
            talkFace: { type: "string", description: "입 벌린 얼굴 리소스 id. 넣으면 글자가 흐르는 동안 기본 얼굴과 번갈아 입이 움직인다." },
            expressions: {
              type: "object",
              description: "감정별 표정. 대사 emotion 또는 본문 [표정:기쁨] 태그가 부른다. face=얼굴 리소스 id, pitch=반음 더하기, emote=이름표 옆 이모트.",
              properties: Object.fromEntries(DIALOGUE_EMOTION_IDS.map((id) => [id, {
                type: "object",
                properties: {
                  face: { type: "string" },
                  pitch: { type: "integer", minimum: DIALOGUE_PITCH_LIMITS.min, maximum: DIALOGUE_PITCH_LIMITS.max },
                  emote: { type: "string", enum: [...EMOTE_KINDS] },
                },
                additionalProperties: false,
              }])),
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  },
  required: ["characterId", "profile"],
  additionalProperties: false,
};

export const DELETE_CHARACTER_PROFILE_SCHEMA: JsonSchema = {
  type: "object",
  properties: { characterId: { type: "string" } },
  required: ["characterId"],
  additionalProperties: false,
};

export const UPSERT_TEST_PRESET_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    preset: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        switches: { type: "object", additionalProperties: true },
        variables: { type: "object", additionalProperties: true },
        inventory: { type: "object", additionalProperties: true },
        gold: { type: "integer", minimum: 0 },
        startMapId: { type: "string" },
        startPos: {
          type: "object",
          properties: {
            x: { type: "integer", minimum: 0 },
            y: { type: "integer", minimum: 0 },
          },
          required: ["x", "y"],
          additionalProperties: false,
        },
      },
      required: ["id", "name"],
      additionalProperties: false,
    },
  },
  required: ["preset"],
  additionalProperties: false,
};

export const DELETE_TEST_PRESET_SCHEMA: JsonSchema = {
  type: "object",
  properties: { presetId: { type: "string" } },
  required: ["presetId"],
  additionalProperties: false,
};

export const MANAGE_FLAG_SLOT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["add", "delete"] },
    kind: { type: "string", enum: ["switch", "variable"] },
    id: { type: "string" },
    name: { type: "string", description: "add일 때 필요한 슬롯 이름" },
    switchValue: { type: "boolean", description: "switch 시작값(기본 false)" },
    variableValue: { type: "number", description: "variable 시작값(기본 0)" },
  },
  required: ["action", "kind", "id"],
  additionalProperties: false,
};
