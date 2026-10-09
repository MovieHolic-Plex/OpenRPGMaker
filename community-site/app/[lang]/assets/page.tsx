import Link from "next/link";
import { AssetCard } from "~/components/cards";
import { listAssets, type Sort } from "~/lib/db";
import { getDict, toLang } from "~/lib/i18n";
import { GALLERY_KIND_FILTERS } from "~/lib/kinds";

export const dynamic = "force-dynamic";

export default async function AssetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ kind?: string; q?: string; sort?: string }>;
}) {
  const { lang: raw } = await params;
  const lang = toLang(raw);
  const dict = getDict(lang);
  const { kind, q, sort: rawSort } = await searchParams;
  const sort: Sort = rawSort === "popular" ? "popular" : "new";
  const assets = await listAssets({ kind, q, sort });
  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (kind) p.set("kind", kind);
    if (q) p.set("q", q);
    if (sort === "popular") p.set("sort", "popular");
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    return `/${lang}/assets${s ? `?${s}` : ""}`;
  };
  return (
    <>
      <div className="section-head">
        <h1>{dict.asset.library}</h1>
        <Link href={`/${lang}/upload`}>{dict.asset.upload}</Link>
      </div>
      <form className="search-row" method="get" action={`/${lang}/assets`}>
        {kind && <input type="hidden" name="kind" value={kind} />}
        <input type="search" name="q" defaultValue={q ?? ""} placeholder={dict.asset.search} aria-label={dict.asset.search} />
        <div className="sort-toggle" role="group" aria-label="sort">
          <Link className={sort === "new" ? "active" : ""} href={qs({ sort: undefined })}>{dict.asset.sortNew}</Link>
          <Link className={sort === "popular" ? "active" : ""} href={qs({ sort: "popular" })}>{dict.asset.sortPopular}</Link>
        </div>
      </form>
      <div className="filter-row">
        <Link className={`filter-chip${!kind ? " active" : ""}`} href={qs({ kind: undefined })}>{dict.asset.all}</Link>
        {GALLERY_KIND_FILTERS.map((k) => (
          <Link key={k} className={`filter-chip${kind === k ? " active" : ""}`} href={qs({ kind: k })}>{k}</Link>
        ))}
      </div>
      <div className="card-grid">
        {assets.map((a) => <AssetCard key={a.slug} asset={a} lang={lang} />)}
      </div>
      {assets.length === 0 && (
        <div className="empty-state">
          <p>{dict.empty.assets}</p>
          <Link className="btn" href={`/${lang}/upload`}>{dict.asset.upload}</Link>
        </div>
      )}
    </>
  );
}
