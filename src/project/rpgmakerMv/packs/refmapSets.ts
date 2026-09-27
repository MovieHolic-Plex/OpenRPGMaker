// REFMAP MV/MZ 세트 프리셋(설원·실내·던전·남쪽 섬·크레용·화산·사진·MZ 지면). 그림은 없다 — 시트 이름·해시·칸 좌표·이름뿐.
// 데이터는 scripts/content/refmap/gen-presets.mts 가 로컬 세트 폴더의 preset.json 에서 만든다. 손으로 고치지 말고 다시 생성한다.
// 약관: 게임 제작 무료, 가공 그림 배포 가능, 무가공 재배포·가공품 판매 금지 — 원본은 저장소·번들에 넣지 않는다.
import type { MvPackPreset } from "../packPreset";
import data from "./refmapSets.json";

export const REFMAP_SET_PRESETS: readonly MvPackPreset[] = data as unknown as MvPackPreset[];
