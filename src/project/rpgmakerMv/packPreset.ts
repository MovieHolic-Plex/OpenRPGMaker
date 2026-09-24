// 재배포 금지 서드파티 RPG Maker MV/MZ 팩을 **사용자가 올린 원본으로** OPRN 타일셋으로 만드는 프리셋 형식.
//
// 저장소에는 그림이 없다. 여기 있는 것은 시트 이름·해시·칸 좌표와 사람 말 이름뿐이다.
// 사용자가 원본 PNG 를 올리면 해시로 판본을 확인하고(layout.ts 가 칸 번호를 정하므로 판본이 다르면
// 번호가 어긋난다) bake.ts 로 아틀라스를 굽고 tilesetPreset.ts 가 조수가 읽을 지식을 붙인다.
// 배경: openwiki/teaching-assistant-tilesets.md 「재배포 금지 서드파티 팩」.

export interface MvPackSheet {
  /** 팩 안 파일 이름. 아틀라스 패널 순서 = 이 배열 순서. */
  readonly file: string;
  /** 팩 안에서 찾을 위치(안내용). */
  readonly folder: string;
  readonly sha256: string;
}

/**
 * 오토타일 한 종류의 쓰임새.
 * - ground: 걷는 바닥(보도·잔디·광장) · road: 차도 · water: 물(막힘)
 * - roof: 옥상·지붕 윗면(막힘) · wall: 건물 외벽(막힘)
 * - mark: 바닥 위에 겹치는 표시(주차선·균열·얼룩, 통행) · fence: 겹치는 울타리·난간(막힘)
 * - plant: 겹치는 풀·덤불(통행) · trim: 벽 위에 겹치는 창틀(벽 통행을 그대로 따른다)
 */
export type MvAutotileRole = "ground" | "road" | "water" | "roof" | "wall" | "mark" | "fence" | "plant" | "trim";

export interface MvPackAutotile {
  readonly sheet: string;
  readonly kind: number;
  readonly name: string;
  readonly role: MvAutotileRole;
  readonly description?: string;
}

/** A5 처럼 오토타일이 아닌 바닥 칸 하나. */
export interface MvPackFlat {
  readonly sheet: string;
  readonly cell: number;
  readonly name: string;
  readonly role: "ground" | "road" | "wall" | "roof";
  readonly description?: string;
}

/**
 * 물체 시트(B~E) 위 여러 칸짜리 물체 하나.
 * - decal: 바닥에 그려진 표시(화살표·횡단보도·맨홀). 통행, 캐릭터 아래.
 * - prop: 전부 막힌 물체(쓰레기통·벤치·분수). 캐릭터와 앞뒤 정렬.
 * - tall: 맨 아래 줄만 막히고 위는 캐릭터 위에 그려지는 키 큰 물체(가로등·나무·자판기).
 * - wallmount: 벽·옥상에 붙이는 것(창문·간판·실외기). 통행은 밑의 벽을 따른다.
 * - door: 벽에 붙이는 문. 그 칸을 걸을 수 있게 만든다(이동 이벤트 자리).
 * - overhead: 전부 캐릭터 위(차양·불빛).
 */
export type MvObjectKind = "decal" | "prop" | "tall" | "wallmount" | "door" | "overhead";

export interface MvPackObject {
  readonly id: string;
  readonly sheet: string;
  /** 시트 안 48px 칸 좌표·크기. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly kind: MvObjectKind;
  readonly name: string;
  readonly description?: string;
  /** 이어 찍어도 되는 축(차선·울타리·벤치). */
  readonly growth?: "horizontal" | "vertical" | "both";
  /** 차도 위에 세워도 되는 막힌 물체(교통 콘). 나머지는 차도 위에 찍으면 도구가 거부한다. */
  readonly onRoad?: boolean;
  /** tall 에서 막히는 칸(물체 원점 기준). 생략 = 맨 아래 줄 전부. */
  readonly solid?: readonly (readonly [number, number])[];
}

export interface MvPackPreset {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly pack: string;
  readonly author: string;
  readonly url: string;
  readonly credit: string;
  readonly license: string;
  readonly sheets: readonly MvPackSheet[];
  readonly autotiles: readonly MvPackAutotile[];
  readonly flats: readonly MvPackFlat[];
  readonly objects: readonly MvPackObject[];
  /** 참고문서 첫 쪽에 들어갈 조립 지침(MD). 칸 번호는 굽는 시점에 채운다 — `{{object:id}}`, `{{auto:name}}`. */
  readonly guide: string;
}
