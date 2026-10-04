import { applyJoseonFolklorePack, createJoseonFolkloreRecords, joseonFolklorePackStatus } from "@/project/contentPacks/joseonFolklore";
import type { ToolDefinition } from "./types";

export const CONTENT_PACK_TOOLS: readonly ToolDefinition[] = [
  {
    name: "list_content_packs", mode: "read", domains: ["database"],
    description: "공용 콘텐츠 팩과 현재 설치 상태를 조회한다. 조선 설화 팩은 직업·기술·아이템·장비·귀신·도깨비를 기존 RM2003 전투 데이터로 제공한다.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    run(project) {
      const records = createJoseonFolkloreRecords();
      return { summary: "조선 설화 콘텐츠 팩", data: [{ id: "joseon-folklore", name: "조선 설화 판타지", ...joseonFolklorePackStatus(project), counts: Object.fromEntries(Object.entries(records).map(([key, value]) => [key, value.length])) }] };
    },
  },
  {
    name: "apply_content_pack", mode: "write", domains: ["database"],
    description: "선택한 공용 콘텐츠 팩의 누락된 데이터와 소재를 현재 프로젝트에 추가한다. 기존 레코드와 맵을 보존한다. 직업 선택·상점·사냥터 이벤트 연결은 별도로 저작한다.",
    parameters: { type: "object", properties: { packId: { type: "string", enum: ["joseon-folklore"] } }, required: ["packId"], additionalProperties: false },
    run(project, args) {
      if (args.packId !== "joseon-folklore") throw new Error("Unknown content pack");
      const result = applyJoseonFolklorePack(project);
      return { summary: `조선 설화 팩 ${result.added}개 추가, 기존 ${result.preserved}개 보존`, data: result };
    },
  },
];
