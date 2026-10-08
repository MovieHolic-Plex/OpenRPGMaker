import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { withTsModule } from "../ontology-ts-loader.mjs";

const baseUrl = process.env.OPRN_STORE_TEST_URL ?? "http://100.73.251.77:18320";
const cache = await mkdtemp(resolve(tmpdir(), "oprn-assistant-store-"));
const result = await withTsModule(resolve("scripts/qa/assistant-store-install-entry.ts"), "assistant-store-install.mjs", async ({ AssetStoreClient, createBlankProject, STORE_TOOLS, createMemoryRepository, setProjectRepositoryForTest }) => {
  const client = new AssetStoreClient(cache, {
    load: () => null,
    save: () => {},
    persistent: () => false,
  }, baseUrl);
  const installed = () => client.installed();
  globalThis.window = {
    oprn: {
      store: {
        catalog: ({ q = "", kind = "", grade = "", lang = "ko" } = {}) => client.catalog({ q, kind, grade, lang }),
        installed,
        install: ({ slug, version } = {}) => client.install(slug, () => {}, version),
        package: ({ slug } = {}) => client.packageFor(slug),
      },
    },
  };
  setProjectRepositoryForTest(createMemoryRepository({ target: { kind: "local", projectDir: cache, projectId: "assistant-store-install" } }));
  const search = STORE_TOOLS.find((tool) => tool.name === "store_search");
  const install = STORE_TOOLS.find((tool) => tool.name === "store_install");
  if (!search || !install || !search.prepare || !install.prepare) throw new Error("스토어 조수 도구를 찾지 못했습니다.");
  await search.prepare({ query: "버들항", kind: "tileset", aiReadyOnly: true });
  const searchResult = search.run(createBlankProject(), { query: "버들항", kind: "tileset", aiReadyOnly: true });
  const items = searchResult.data?.items ?? [];
  const item = items.find((candidate) => candidate.title.includes("버들항")) ?? items[0];
  if (!item?.slug) throw new Error("스토어 검색에서 버들항 팩을 찾지 못했습니다.");
  await install.prepare({ slug: item.slug }, createBlankProject());
  const draft = createBlankProject();
  const applied = install.run(draft, { slug: item.slug });
  const storeTilesets = Object.values(draft.tilesets).filter((tileset) => tileset.id.startsWith("store_"));
  return {
    baseUrl,
    cache,
    search: { total: searchResult.data?.total ?? 0, items: items.slice(0, 8) },
    installed: installed().map(({ slug, version, title }) => ({ slug, version, title })),
    applied: {
      summary: applied.summary,
      tilesetIds: applied.data?.tilesets?.map(({ id }) => id) ?? [],
      assetCount: applied.data?.assetIds?.length ?? 0,
      referenceDocumentCount: storeTilesets.reduce((sum, tileset) => sum + (tileset.referenceDocuments?.length ?? 0), 0),
      storeOrigins: Object.values(draft.assets.uploaded).filter((asset) => asset.origin?.itemSlug === item.slug).length,
    },
  };
});
await writeFile(resolve("verify-shots/asset-store/assistant-install.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await rm(cache, { recursive: true, force: true });
