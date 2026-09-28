// 포켓몬풍 완결 게임의 지역 조립점 — 코어(configureScarloxyPokemonDemoProject)가 한 번 부른다.
// 지역 파일은 서로를 모르고 scarloxyPokemonWorld.ts 계약만 본다. 순서: A(이끼 마을·풀 체육관·바위굴) → B(파도 마을 ~ 챔피언의 탑).

import type { Project } from "../types";
import { installPkmnRegionA } from "./scarloxyPokemonRegionA";

export function installScarloxyPokemonRegions(project: Project): void {
  installPkmnRegionA(project);
}
