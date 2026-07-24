import Link from "next/link";
import { GameCard } from "~/components/cards";
import { listGames, type Sort } from "~/lib/db";
import { getDict, toLang } from "~/lib/i18n";

export const dynamic = "force-dynamic";

export default async function GamesPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { lang: raw } = await params;
  const lang = toLang(raw);
  const dict = getDict(lang);
  const { q, sort: rawSort } = await searchParams;
  const sort: Sort = rawSort === "popular" ? "popular" : "new";
  const games = await listGames({ q, sort });
  const sortHref = (s?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (s) p.set("sort", s);
    const str = p.toString();
    return `/${lang}/games${str ? `?${str}` : ""}`;
  };
  return (
    <>
      <div className="section-head">
        <h1>{dict.game.library}</h1>
        <Link href={`/${lang}/upload`}>{dict.game.upload}</Link>
      </div>
      <form className="search-row" method="get" action={`/${lang}/games`}>
        <input type="search" name="q" defaultValue={q ?? ""} placeholder={dict.game.search} aria-label={dict.game.search} />
        <div className="sort-toggle" role="group" aria-label="sort">
          <Link className={sort === "new" ? "active" : ""} href={sortHref()}>{dict.asset.sortNew}</Link>
          <Link className={sort === "popular" ? "active" : ""} href={sortHref("popular")}>{dict.asset.sortPopular}</Link>
        </div>
      </form>
      <div className="card-grid">
        {games.map((g) => <GameCard key={g.slug} game={g} lang={lang} mapsLabel={dict.game.maps} />)}
      </div>
      {games.length === 0 && (
        <div className="empty-state">
          <p>{dict.empty.games}</p>
          <Link className="btn" href={`/${lang}/upload`}>{dict.game.upload}</Link>
        </div>
      )}
    </>
  );
}
