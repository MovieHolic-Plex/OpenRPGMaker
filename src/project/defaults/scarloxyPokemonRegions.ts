// 포켓몬풍 완결 게임의 지역 조립점 — 코어(configureScarloxyPokemonDemoProject)가 한 번 부른다.
// 지역 파일은 서로를 모르고 scarloxyPokemonWorld.ts 계약만 본다. 순서: A(이끼 마을·풀 체육관·바위굴) → B(파도 마을·물 체육관·3번 도로) → C(잿불 마을·불 체육관·챔피언 로드·챔피언의 탑·엔딩).

import type { Project } from "../types";
import { installPkmnRegionA } from "./scarloxyPokemonRegionA";
import { installPkmnRegionC } from "./scarloxyPokemonRegionC";

export function installScarloxyPokemonRegions(project: Project): void {
  installPkmnRegionA(project);
  installPkmnRegionC(project);
}
