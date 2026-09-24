// 참고 집 형태(성벽 정주지·왕궁 도시)를 틀 원본으로 내보낸다 — 참고 맵이 바뀌면 다시 돌린다.
import { REFERENCE_HOUSE_FORM_DEFS } from "@/project/defaults/referenceHouseFormCatalog";
import { writeFileSync } from "node:fs";
writeFileSync(process.argv[2], JSON.stringify(REFERENCE_HOUSE_FORM_DEFS, null, 1) + "\n");
