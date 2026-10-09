/**
 * 첫 진열 팩: 저장소에 있는 직접 만든 번들 타일셋(버들항·조선·실내 v5·일본 도시·마법 학교)을 스토어 팩으로 바꿔 올린다.
 * (Rasak·REFMAP·MV 팩 계열·PAW 는 제외 — 2026-10-06 사용자 결정. 여기 목록에 넣지 않는다.)
 * 번들 그림(`/assets/...`)과 참고문서 그림을 blob 으로 바꿔, 다른 판의 편집기에서도 팩 하나로 닫히게 한다.
 * 스테이징·e2e 가 같이 쓴다. 운영자(관리자) 세션으로 올리므로 바로 공개된다.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { STORE_LIMITS, STORE_PACK_SCHEMA, blobPlaceholder, mapStrings, type StoreAssetKind, type StoreBlobMime, type StoreLocalizedTexts, type StorePackCharacter, type StorePackManifest } from "../../src/assetStore/format";
import { pngSize, sniffMime } from "../../src/assetStore/sniff";
import { createAtlasBiomeInteriorTileset } from "../../src/project/defaults/atlasBiomeInterior";
import { createBeodeulCityTileset } from "../../src/project/defaults/beodeulCity";
import { createJoseonBaramTileset } from "../../src/project/defaults/joseonBaram";
import { createJpCityTileset } from "../../src/project/defaults/jpCity";
import { createWizardingWorldTileset } from "../../src/project/defaults/wizardingWorld";
import { WIZARDING_CHARSET_SEMANTICS } from "../../src/assets/wizardingCharsets";
import type { TilesetDef } from "../../src/project/types";

export interface BundleSeed {
  create: () => TilesetDef;
  sheet: string;
  title: string;
  summary: string;
  description: string;
  tags: string[];
  /** 표지·미리보기로 쓸 완성 예시 그림(편집기 public/ 기준). 없으면 시트 그림. */
  previews: string[];
  /** 타일셋과 같이 넣을 그림(캐릭터 시트 등). id 는 그대로 프로젝트 에셋 id 가 된다(스토어가 store_ 접두를 붙인다). */
  extraAssets?: { id: string; name: string; kind: StoreAssetKind; path: string }[];
  /** 팩 안 타일셋·시트 그림 이름(없으면 번들 이름). 번들 이름에 원작 이름이 든 경우 바꾼다. */
  displayName?: string;
  /** 캐릭터 시트 칸 설명(조수가 외형으로 고른다). asset 은 extraAssets 의 id. */
  characters?: () => StorePackCharacter[];
  /**
   * 공개 팩에서 바꿔 쓸 낱말 [원래, 바꿀 말] — 원작 고유명(상표)을 일반 낱말로. 타일셋 글(이름·설명·참고문서)·캐릭터 설명에 적용한다.
   * id(영문)는 건드리지 않으므로 한글 낱말만 넣는다. 긴 말을 먼저 적는다.
   */
  scrub?: readonly (readonly [string, string])[];
  /** 다른 언어 상품 글(ko 는 title·summary·description). library_locales.py 의 같은 제목 항목과 맞춘다. */
  locales?: StoreLocalizedTexts;
}

/** 공개 팩용 일반 낱말(원작 고유명 → 일반 말). 에디터 번들 안의 글은 그대로 둔다. */
const WIZARDING_SCRUB: readonly (readonly [string, string])[] = [
  ["해리포터풍", "마법 학교풍"], ["해리포터", "마법 학교"], ["호그와트풍", "마법 학교풍"], ["호그와트", "마법 학교"],
  ["그리핀도르", "붉은 사자 기숙사"], ["슬리데린", "초록 뱀 기숙사"], ["래번클로", "푸른 독수리 기숙사"], ["후플푸프", "노란 오소리 기숙사"],
  ["퀴디치", "빗자루 공놀이"], ["허니듀크", "마법 과자점"], ["호그스미드", "마법 마을"], ["다이애건 앨리", "마법 상점가"], ["다이애건", "마법 상점가"],
  ["올리밴더", "지팡이 장인"], ["HP 테마", "마법 학교 테마"], ["세스트랄", "해골 날개말"], ["스니치", "금빛 날개공"], ["블러저", "쇠공"], ["쿼플", "붉은 공"],
];
const scrubText = (text: string, pairs: readonly (readonly [string, string])[] | undefined): string =>
  (pairs ?? []).reduce((out, [from, to]) => out.split(from).join(to), text);

const GENERIC_TAGS = new Set(["마법 학교", "해리포터풍", "호그와트", "마법사", "마녀", "wizard", "witch"]);

/** 마법 학교 인물 35명 → 스토어 캐릭터 설명(시트 n 칸 i = 팩 에셋 wizarding<n>_charset). */
function wizardingCharacters(): StorePackCharacter[] {
  return WIZARDING_CHARSET_SEMANTICS.map((entry) => {
    const sheet = Number(/wizarding(\d+)$/.exec(entry.textureKey)?.[1]);
    // 옛 native 9명의 설명은 「… — 데모에서 승인된 native 걷기 시트.」 뿐이라 외형이 아니다 — 빼고 이름·태그로 찾게 한다.
    const appearance = entry.appearance && !entry.appearance.includes("native 걷기 시트") ? entry.appearance : undefined;
    return {
      asset: `wizarding${sheet}_charset`, characterIndex: entry.characterIndex, label: entry.label,
      // 이름·역할 낱말을 앞에, 세계관 공통 낱말을 뒤에 — 태그 12개 상한에서 역할 동의어가 잘리지 않게.
      tags: [...entry.tags.filter((tag) => !GENERIC_TAGS.has(tag)), ...entry.tags.filter((tag) => GENERIC_TAGS.has(tag))]
        .filter((tag) => !/^wz-/.test(tag) && tag !== "앨리"),
      ...(appearance ? { appearance } : {}),
    };
  });
}

/** 캐릭터 설명을 스토어 규격에 맞춘다(낱말 바꾸기 → 태그 중복·길이·개수, 외형 길이). */
function fitCharacter(c: StorePackCharacter, pairs: BundleSeed["scrub"]): StorePackCharacter {
  const label = scrubText(c.label, pairs).slice(0, STORE_LIMITS.characterLabel);
  const tags = [...new Set((c.tags ?? []).map((tag) => scrubText(tag, pairs).trim()).filter((tag) => tag && tag !== label && tag.length <= STORE_LIMITS.tagLength))]
    .slice(0, STORE_LIMITS.tags);
  const appearance = c.appearance ? scrubText(c.appearance, pairs).slice(0, STORE_LIMITS.characterAppearance) : undefined;
  return {
    asset: c.asset, characterIndex: c.characterIndex, label,
    ...(tags.length ? { tags } : {}), ...(c.gender ? { gender: c.gender } : {}), ...(c.age ? { age: c.age } : {}), ...(appearance ? { appearance } : {}),
  };
}

export const SEED_BUNDLES: readonly BundleSeed[] = [
  {
    create: createBeodeulCityTileset, sheet: "assets/beodeul-city/beodeul-city-chipset.png",
    title: "버들항 — 로마풍 항구 도시", summary: "손 도트 16px 항구 도시. 구역·건물·소품 키트 120종과 조립 참고문서가 들어 있습니다.",
    description: "광장·시장·항구·성벽·주택가를 칸 단위로 조립하는 16px 손 도트 타일셋입니다.\n참고문서(용도별 MD + 정상/오류 그림)가 들어 있어 에디터 조수가 바로 이 타일로 도시를 깝니다.",
    tags: ["도시", "항구", "16px", "판타지"],
    previews: ["assets/beodeul-city/references/city-overview.png", "assets/beodeul-city/references/kit-castle.png", "assets/beodeul-city/references/kit-forum.png", "assets/beodeul-city/references/manor-kits.png"],
  },
  {
    create: createJoseonBaramTileset, sheet: "assets/joseon-baram/joseon-baram-chipset.png",
    title: "조선 — 바람의나라풍 마을", summary: "기와집·초가·성문·사냥터·동굴까지 조선풍 손 도트 칩셋.",
    description: "코드로 찍은 조선풍 16px 조각을 한 장으로 구운 칩셋입니다. 칸마다 통행·층이 구워져 있고, 마을·국내성·실내 조립 참고문서가 함께 들어 있습니다.",
    tags: ["조선", "한국", "마을", "16px"],
    previews: ["assets/joseon-baram/references/village-overview.png", "assets/joseon-baram/references/ex-manor.png", "assets/joseon-baram/references/ex-row.png", "assets/joseon-baram/references/ex-bridge.png"],
  },
  {
    create: createAtlasBiomeInteriorTileset, sheet: "assets/atlas-interior/interior-chipset.png",
    title: "손 도트 실내 v5", summary: "빵집·여관·민가·상점 실내를 꾸미는 3/4 시점 가구 칩셋.",
    description: "윗면과 앞면이 같이 보이는 3/4 시점 손 도트 실내 가구입니다. 방 종류별 배치 참고문서가 들어 있습니다.",
    tags: ["실내", "가구", "16px"],
    previews: ["assets/hand-interior-references/hand-interior-bakery.png", "assets/hand-interior-references/hand-interior-tavern.png", "assets/hand-interior-references/hand-interior-smithy.png", "assets/hand-interior-references/hand-interior-chapel.png"],
  },
  {
    create: createJpCityTileset, sheet: "assets/jp-city/jp-city-chipset.png",
    title: "일본 도시 — 상가·주택·역·신사", summary: "현대 일본 거리의 주택가·역·공원·신사를 그리는 도트 칩셋.",
    description: "3/4 시점 현대 일본 도시 타일셋입니다. 건물 외형·소품·바닥 타일과 조립 참고문서, 집·가게·공공 실내(편의점·라멘·이자카야·센토·파출소 등 21곳), 학교(교실·교무실·음악실·옥상)·체육관·유치원·지상역(개찰·승강장·전철 차내)·사무 빌딩·우체국·맨션 공용부 7곳, 현대 던전 8곳(지하철 보선 터널·하수도·폐병원·폐교·공사 중 빌딩·지하 주차장·밤의 지하상가·항만 창고 — 잠긴 문·보물 자리)과 거리 문을 실내로 잇는 예제가 들어 있습니다.",
    tags: ["현대", "일본", "도시"],
    previews: ["assets/store-covers/jp-city-street.png", "assets/region-references/jp-city-konbini.png", "assets/region-references/jp-city-school-1f.png", "assets/region-references/jp-city-abandoned-hospital-1f.png", "assets/region-references/jp-city-tramstreet.png"],
  },
  {
    // 원작 이름(해리포터·호그와트·퀴디치 등)은 상품 글에 쓰지 않는다 — 공개 장터라 상표 신고 대상이 된다. 사람 칩도 원작 인물이 아닌 역할(교수·학생·관리인)이다.
    create: createWizardingWorldTileset, sheet: "assets/wizarding-world/wizarding-world-chipset.png",
    title: "마법 학교 — 고딕 성채·교실·숲·호수", summary: "성채 복도·연회장·교실 12곳과 숲·호수·마을을 깔 수 있는 손 도트 칩셋 + 학생·교수·생물 걷기 칩 35명.",
    description: "고딕 성채 벽·바닥·문과 연회장·마법약 교실·도서관·온실·부엉이 탑·병동·시계탑·지팡이 가게·과자점 지하·눈 마을 우체국·숲 마차 승차장·호수 보트 창고·빗자루 경기장 가구를 16px 손 도트로 그렸습니다.\n"
      + "참고문서(공간별 배치 순서·정상/오류 그림)가 들어 있어 에디터 조수가 이 칩셋으로 방을 바로 짓습니다. 학생·교수·관리인·부엉이 등 걷기 칩 35명(시트 5장)이 함께 들어 있습니다.",
    tags: ["마법", "학교", "성", "16px", "판타지"],
    displayName: "마법 학교 성채",
    scrub: WIZARDING_SCRUB,
    characters: wizardingCharacters,
    previews: ["assets/store-covers/wizarding-hall.png", "assets/store-covers/wizarding-cast.png", "assets/store-covers/wizarding-library.png", "assets/store-covers/wizarding-potions.png"],
    extraAssets: [1, 2, 3, 4, 5].map((n) => ({ id: `wizarding${n}_charset`, name: `마법 학교 인물 ${n}`, kind: "charset" as const, path: `assets/generated/charsets/Wizarding${n}.png` })),
    locales: {
      en: {
        title: "Magic School — Gothic Castle, Classrooms, Forest & Lake",
        summary: "Hand-pixeled chipset for castle halls, classrooms, forest, lake and village, plus 35 walking sprites of students, teachers and creatures.",
        description: "Gothic castle walls, floors and doors, with furniture for a great hall, potions classroom, library, greenhouse, owl tower, infirmary, clock tower, wand shop, sweet-shop cellar, snowy village post office, forest carriage stop, lake boathouse and broom-sport stadium — all 16px hand pixel art.\n"
          + "Reference docs (per-space build order with correct and incorrect examples) are included, so the editor assistant can build rooms with this chipset right away. 35 walking sprites (5 sheets) of students, teachers, caretakers and owls are included.",
      },
      ja: {
        title: "魔法学校 — ゴシック城・教室・森・湖",
        summary: "城の廊下・大広間・教室など12の空間と森・湖・村を描けるドットチップセット + 生徒・教師・生き物の歩行キャラ35体。",
        description: "ゴシック城の壁・床・扉と、大広間・魔法薬教室・図書館・温室・ふくろう塔・医務室・時計塔・杖の店・菓子店の地下・雪の村の郵便局・森の馬車乗り場・湖のボート小屋・箒競技場の家具を16pxの手打ちドットで描きました。\n"
          + "空間ごとの配置手順(正しい例・誤った例の図)の参考文書が入っているので、エディターのアシスタントがこのチップセットですぐに部屋を作れます。生徒・教師・管理人・ふくろうなどの歩行キャラ35体(シート5枚)も入っています。",
      },
      zh: {
        title: "魔法学校 — 哥特城堡·教室·森林·湖泊",
        summary: "可铺设城堡走廊、大礼堂、12 个教室与房间以及森林、湖泊、村庄的手绘像素图块集,另附学生、教师、生物行走角色 35 个。",
        description: "以 16px 手绘像素绘制哥特城堡的墙壁、地板、门,以及大礼堂、魔药教室、图书馆、温室、猫头鹰塔、医务室、钟楼、魔杖店、糖果店地窖、雪村邮局、森林马车站、湖边船屋、扫帚竞技场的家具。\n"
          + "附有按空间划分的布置顺序参考文档(含正确与错误示例图),编辑器助手可直接用此图块集搭建房间。另含学生、教师、管理员、猫头鹰等行走角色 35 个(5 张图)。",
      },
    },
  },
];

const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** 번들 타일셋 → 스토어 팩(매니페스트 + blob). publicDir 은 편집기 public/ 폴더. */
export function bundlePack(seed: BundleSeed, publicDir: string): { manifest: StorePackManifest; blobs: Map<string, Uint8Array> } {
  const blobs = new Map<string, { bytes: Uint8Array; mime: StoreBlobMime }>();
  const add = (bytes: Uint8Array): string => {
    const mime = sniffMime(bytes);
    if (!mime) throw new Error("알 수 없는 형식");
    const key = sha(bytes);
    blobs.set(key, { bytes, mime });
    return key;
  };
  const sheetBytes = new Uint8Array(readFileSync(join(publicDir, seed.sheet)));
  const size = pngSize(sheetBytes);
  if (!size) throw new Error(`${seed.sheet}: PNG 가 아닙니다`);
  const sheetSha = add(sheetBytes);
  const source = seed.create();
  const assetId = `${source.id}_sheet`;
  // 참고문서 그림의 `/assets/...` 경로를 blob 으로 바꾼다.
  const tileset = mapStrings(source, (text) => {
    if (!/^\/assets\/.+\.(png|jpe?g|webp)$/i.test(text)) return text;
    const file = join(publicDir, text.slice(1));
    if (!existsSync(file)) return text;
    return blobPlaceholder(add(new Uint8Array(readFileSync(file))));
  }) as TilesetDef;
  const previews = seed.previews.filter((path) => existsSync(join(publicDir, path))).map((path) => add(new Uint8Array(readFileSync(join(publicDir, path)))));
  tileset.image = { type: "uploaded", id: assetId };
  if (seed.displayName) tileset.name = seed.displayName;
  const published = (seed.scrub ? mapStrings(tileset, (text) => scrubText(text, seed.scrub)) : tileset) as TilesetDef;
  const extra: StorePackManifest["content"]["assets"] = {};
  for (const item of seed.extraAssets ?? []) {
    const bytes = new Uint8Array(readFileSync(join(publicDir, item.path)));
    const dim = pngSize(bytes);
    if (!dim) throw new Error(`${item.path}: PNG 가 아닙니다`);
    extra[item.id] = { id: item.id, name: item.name, kind: item.kind, blob: add(bytes), mime: "image/png", meta: { width: dim.width, height: dim.height } };
  }
  const characters = (seed.characters?.() ?? []).filter((c) => extra[c.asset]?.kind === "charset").map((c) => fitCharacter(c, seed.scrub));
  const manifest: StorePackManifest = {
    schema: STORE_PACK_SCHEMA,
    title: seed.title,
    summary: seed.summary,
    description: seed.description,
    // refresh_library.py 는 ko 까지 든 locales 와 비교하므로 ko 도 같이 넣는다(빠지면 다음 갱신 때 새 판본이 생긴다).
    ...(seed.locales ? { locales: { ko: { title: seed.title, summary: seed.summary, description: seed.description }, ...seed.locales } } : {}),
    tags: seed.tags,
    kind: "tileset",
    license: "OPRN-GAME",
    aiGenerated: true,
    credits: `${seed.title} — OPRN 공식 팩 (openrpgmaker.com)`,
    content: {
      assets: { [assetId]: { id: assetId, name: published.name, kind: "chipset", blob: sheetSha, mime: "image/png", meta: { width: size.width, height: size.height, tileSize: source.tileSize } }, ...extra },
      tilesets: { [published.id]: published },
      ...(characters.length ? { characters } : {}),
    },
    previews: [...previews, sheetSha].slice(0, 6),
    blobs: [...blobs].map(([key, blob]) => ({ sha256: key, mime: blob.mime, bytes: blob.bytes.byteLength })),
  };
  return { manifest, blobs: new Map([...blobs].map(([key, blob]) => [key, blob.bytes])) };
}

interface Session { base: string; headers: Record<string, string> }

/** 개발 로그인(스테이징 전용)으로 운영자 세션을 만든다. */
export async function adminSession(base: string, email: string): Promise<Session> {
  const login = await fetch(`${base}/auth/dev`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ email, name: "OPRN 운영", next: "/" }) });
  const cookie = login.headers.getSetCookie().map((line) => line.split(";")[0]).join("; ");
  if (login.status !== 303 || !cookie) throw new Error(`개발 로그인 실패 (${login.status}). STORE_DEV_LOGIN=1 인지 확인하세요.`);
  const page = await (await fetch(`${base}/`, { headers: { cookie } })).text();
  const csrf = /<meta name="csrf" content="([^"]+)"/.exec(page)?.[1] ?? "";
  return { base, headers: { cookie, "x-csrf-token": csrf } };
}

export async function publishPack(session: Session, pack: { manifest: StorePackManifest; blobs: Map<string, Uint8Array> }): Promise<{ slug: string; status: string }> {
  const check = await fetch(`${session.base}/api/v1/blobs/check`, { method: "POST", headers: { ...session.headers, "content-type": "application/json" }, body: JSON.stringify({ sha256s: [...pack.blobs.keys()] }) });
  const { missing } = await check.json() as { missing: string[] };
  for (const key of missing) {
    const response = await fetch(`${session.base}/api/v1/blobs`, { method: "POST", headers: { ...session.headers, "x-sha256": key, "content-type": "application/octet-stream" }, body: Buffer.from(pack.blobs.get(key)!) });
    if (!response.ok) throw new Error(`blob 올리기 실패 ${response.status}: ${await response.text()}`);
  }
  const created = await fetch(`${session.base}/api/v1/items`, { method: "POST", headers: { ...session.headers, "content-type": "application/json" }, body: JSON.stringify({ manifest: pack.manifest }) });
  const body = await created.json() as { slug: string; status: string; message?: string; details?: string[] };
  if (created.status !== 201) throw new Error(`상품 만들기 실패 ${created.status}: ${body.message} ${(body.details ?? []).join(" / ")}`);
  return body;
}

/** 카탈로그에 같은 제목이 없을 때만 올린다(다시 돌려도 중복이 생기지 않는다). */
export async function seedBundles(base: string, adminEmail: string, publicDir: string, log: (line: string) => void = () => {}): Promise<string[]> {
  const session = await adminSession(base, adminEmail);
  const existing = await (await fetch(`${base}/api/v1/items?page=1`)).json() as { items: { title: string; slug: string }[] };
  const slugs: string[] = [];
  for (const seed of SEED_BUNDLES) {
    const found = existing.items.find((item) => item.title === seed.title);
    if (found) { slugs.push(found.slug); continue; }
    const pack = bundlePack(seed, publicDir);
    const created = await publishPack(session, pack);
    log(`[seed] ${seed.title} → ${created.slug} (${created.status}, blob ${pack.blobs.size})`);
    slugs.push(created.slug);
  }
  return slugs;
}

/** admin-link 일회용 토큰(15분·한 번)으로 운영 세션을 만든다. 토큰은 저장하지 않는다. */
export async function linkSession(base: string, token: string): Promise<Session> {
  const login = await fetch(`${base}/auth/link`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) });
  const cookie = login.headers.getSetCookie().map((line) => line.split(";")[0]).join("; ");
  if (!cookie) throw new Error(`링크 로그인 실패 (${login.status}). 토큰은 15분·한 번만 쓸 수 있다.`);
  const page = await (await fetch(`${base}/`, { headers: { cookie } })).text();
  const csrf = /<meta name="csrf" content="([^"]+)"/.exec(page)?.[1];
  if (!csrf) throw new Error("로그인하지 못했습니다(csrf 없음).");
  return { base, headers: { cookie, "x-csrf-token": csrf } };
}

/** 쓰고 난 운영자 세션을 남기지 않는다. */
export async function closeSession(session: Session): Promise<void> {
  await fetch(`${session.base}/logout`, { method: "POST", redirect: "manual", headers: { cookie: session.headers.cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrf: session.headers["x-csrf-token"] }) });
}

/** 이미 있는 상품에 판본을 더한다(blob 은 없는 것만 올린다). 프로젝트에 넣은 id 는 그대로 이어진다. */
export async function addVersion(session: Session, slug: string, pack: { manifest: StorePackManifest; blobs: Map<string, Uint8Array> }): Promise<{ status: number; body: string }> {
  const check = await fetch(`${session.base}/api/v1/blobs/check`, { method: "POST", headers: { ...session.headers, "content-type": "application/json" }, body: JSON.stringify({ sha256s: [...pack.blobs.keys()] }) });
  for (const key of (await check.json() as { missing: string[] }).missing) {
    const sent = await fetch(`${session.base}/api/v1/blobs`, { method: "POST", headers: { ...session.headers, "x-sha256": key, "content-type": "application/octet-stream" }, body: Buffer.from(pack.blobs.get(key)!) });
    if (!sent.ok) throw new Error(`blob 올리기 실패 ${sent.status}`);
  }
  const added = await fetch(`${session.base}/api/v1/items/${slug}/versions`, { method: "POST", headers: { ...session.headers, "content-type": "application/json" }, body: JSON.stringify({ manifest: pack.manifest }) });
  return { status: added.status, body: (await added.text()).slice(0, 300) };
}
