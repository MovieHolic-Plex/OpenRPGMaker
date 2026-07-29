import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { deserialize, serialize } from "@/project/io";
import { normalizeAnimalRecord } from "@/project/farmModel";
import { ProjectFormatError } from "@/project/io";
import type { AnimalRecord, Project } from "@/project/types";

function roundTrip(project: Project): Project {
  return deserialize(serialize(project));
}

describe("농장 동물", () => {
  it("animals 레코드가 저장/로드 왕복에서 보존된다", () => {
    const project = createBlankProject();
    project.database.animals = [
      { id: "animal_cow", name: "젖소", animalType: "cow", produceItemId: "item_milk", produceDays: 1, friendshipRequired: 0 },
    ];
    expect(roundTrip(project).database.animals?.[0]).toEqual({
      id: "animal_cow",
      name: "젖소",
      animalType: "cow",
      produceItemId: "item_milk",
      produceDays: 1,
      friendshipRequired: 0,
    });
  });

  // 회귀: animals 만 `database.animals ?? []` 로 정규화를 건너뛰어, 임의 필드와
  // 비정상 수치가 그대로 Supabase 에 영속화됐다.
  it("알 수 없는 필드는 제거되고 수치는 클램프된다", () => {
    const record = normalizeAnimalRecord({
      id: "a1",
      name: "  닭  ",
      animalType: "chicken",
      produceDays: -999,
      friendshipRequired: 1e9,
      injected: "<script>",
    } as unknown as Partial<AnimalRecord> & Pick<AnimalRecord, "id" | "name">);
    expect(record).not.toHaveProperty("injected");
    expect(record.name).toBe("닭");
    expect(record.produceDays).toBe(1);
    expect(record.friendshipRequired).toBe(1000);
  });

  it("누락·비정상 필드는 기본값으로 대체된다", () => {
    const record = normalizeAnimalRecord({ id: "a1", name: "" } as Partial<AnimalRecord> & Pick<AnimalRecord, "id" | "name">);
    expect(record.animalType).toBe("chicken");
    expect(record.produceDays).toBe(1);
    expect(record.friendshipRequired).toBe(0);
    expect(record.produceItemId).toBeUndefined();
  });

  // 회귀: shape 가드가 없어 배열이 아닌 animals/lifeSkills 가 normalize 의 .map 에서
  // TypeError 로 터지며 프로젝트 전체가 열리지 않았다.
  it("배열이 아닌 animals/lifeSkills 는 형식 오류로 거부된다(크래시 아님)", () => {
    const project = createBlankProject();
    const corrupt = (key: "animals" | "lifeSkills"): string => {
      const raw = JSON.parse(serialize(project));
      raw.database[key] = {};
      return JSON.stringify(raw);
    };
    expect(() => deserialize(corrupt("animals"))).toThrow(ProjectFormatError);
    expect(() => deserialize(corrupt("lifeSkills"))).toThrow(ProjectFormatError);
  });
});
