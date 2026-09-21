import type { JsonSchema } from "./types";

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
