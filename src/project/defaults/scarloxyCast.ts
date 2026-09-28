// 몬스터 게임(포켓몬풍 데모) 출연진 배역표.
//
// 배역 → 걷기 그림(차셋 텍스처 키 + 칸 번호) · 대사 얼굴 · 전투 그림.
// 게임 데이터(scarloxyPokemonDemoGame.ts)는 이 표에서 그림을 꺼내 쓴다 — 칸 번호를 맵 코드에 직접 적지 않는다.
//
// - people1/people2 는 Scarloxy MPWSP01 팩 원본(CC-BY 4.0), people3/people4 와 scarloxy-face-* 는
//   Scarloxy 화풍으로 그린 생성 자산이다(scripts/build-scarloxy-cast.py, ATTRIBUTION.md 「Generated monster game cast」).
// - faceId 는 대사창 얼굴 리소스 id 다(48×48 낱장). 팩 인물의 얼굴은 기존 generated-faceset-missing-scarloxy-NN 짝을 쓴다.
// - battlerResourceId 는 비워 둔다: 포켓몬식 전투 화면(battleFieldDom)에 트레이너 그림 자리가 없다.
//   트레이너전 표시는 트룹의 trainerBattle 과 인트로 문구(battleDirectorDom.introDirectorState)뿐이다.

export type ScarloxyCastRole =
  | "player"
  | "professor"
  | "mom"
  | "nurse"
  | "clerk"
  | "rival"
  | "grassLeader"
  | "fireLeader"
  | "waterLeader"
  | "champion"
  | "bugCatcher"
  | "hiker"
  | "swimmer"
  | "camperGirl"
  | "fisherman"
  | "gentleman"
  | "villagerA"
  | "villagerB";

export type ScarloxyCastEntry = {
  /** 배역 이름(대사 화자 기본값). */
  readonly label: string;
  /** 번들 차셋 텍스처 키(이벤트 graphic.sprite.id / 배우 characterResourceId 에 넣는다). */
  readonly charsetTextureKey: ScarloxyCastCharsetKey;
  /** 차셋 안 캐릭터 칸(0~7). */
  readonly index: number;
  /** 대사창 얼굴 리소스 id. 없으면 얼굴 없이 말한다. */
  readonly faceId?: string;
  /** 전투 화면 트레이너 그림. 현재 전투 화면이 그리지 않으므로 전원 비어 있다. */
  readonly battlerResourceId?: string;
};

export type ScarloxyCastCharsetKey =
  | "tex_scarloxy_charset_people1"
  | "tex_scarloxy_charset_people2"
  | "tex_scarloxy_charset_people3"
  | "tex_scarloxy_charset_people4";

const P1 = "tex_scarloxy_charset_people1";
const P2 = "tex_scarloxy_charset_people2";
const P3 = "tex_scarloxy_charset_people3";
const P4 = "tex_scarloxy_charset_people4";
const packFace = (cell: number): string => `generated-faceset-missing-scarloxy-${String(cell).padStart(2, "0")}`;

export const SCARLOXY_CAST: Readonly<Record<ScarloxyCastRole, ScarloxyCastEntry>> = {
  player: { label: "주인공", charsetTextureKey: P1, index: 0, faceId: packFace(0) },
  professor: { label: "박사", charsetTextureKey: P3, index: 0, faceId: "scarloxy-face-professor" },
  mom: { label: "엄마", charsetTextureKey: P3, index: 1, faceId: "scarloxy-face-mom" },
  nurse: { label: "간호사", charsetTextureKey: P3, index: 2, faceId: "scarloxy-face-nurse" },
  clerk: { label: "상점 점원", charsetTextureKey: P3, index: 3, faceId: "scarloxy-face-clerk" },
  // 라이벌 = 팩의 남색 머리 소년(주인공과 또래, 대비되는 색).
  rival: { label: "라이벌", charsetTextureKey: P1, index: 5, faceId: packFace(5) },
  grassLeader: { label: "풀 체육관 관장", charsetTextureKey: P2, index: 1, faceId: packFace(9) },
  fireLeader: { label: "불 체육관 관장", charsetTextureKey: P2, index: 0, faceId: packFace(8) },
  waterLeader: { label: "물 체육관 관장", charsetTextureKey: P1, index: 7, faceId: packFace(7) },
  champion: { label: "챔피언", charsetTextureKey: P3, index: 4, faceId: "scarloxy-face-champion" },
  bugCatcher: { label: "벌레잡이 소년", charsetTextureKey: P3, index: 5 },
  hiker: { label: "등산가", charsetTextureKey: P3, index: 6 },
  swimmer: { label: "수영선수", charsetTextureKey: P3, index: 7 },
  camperGirl: { label: "캠프걸", charsetTextureKey: P4, index: 0 },
  fisherman: { label: "낚시꾼", charsetTextureKey: P4, index: 1 },
  gentleman: { label: "신사", charsetTextureKey: P4, index: 2 },
  villagerA: { label: "금발 소년", charsetTextureKey: P1, index: 1, faceId: packFace(1) },
  villagerB: { label: "밀짚모자 농부", charsetTextureKey: P1, index: 6, faceId: packFace(6) },
};

/** 배우 레코드용 차셋 리소스 id(tex_ 접두어 없는 표기, 예: scarloxy-charset-people3). */
export function scarloxyCastCharsetResourceId(role: ScarloxyCastRole): string {
  return SCARLOXY_CAST[role].charsetTextureKey.replace(/^tex_scarloxy_charset_/u, "scarloxy-charset-");
}
