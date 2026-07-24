import Link from "next/link";
import { AssetCard, GameCard, PostRowItem } from "~/components/cards";
import { communityStats, listAssets, listGames, listPosts } from "~/lib/db";
import { getDict, toLang } from "~/lib/i18n";

export const dynamic = "force-dynamic";

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang = toLang(raw);
  const dict = getDict(lang);
  const [assets, games, posts, stats] = await Promise.all([
    listAssets({ limit: 6 }),
    listGames({ limit: 6 }),
    listPosts(undefined, 5),
    communityStats(),
  ]);
  return (
    <>
      <section className="hero panel-frame">
        <div className="hero-eyebrow">{dict.hero.eyebrow}</div>
        <h1>
          {dict.hero.titleA}
          <br />
          {dict.hero.titleB}
        </h1>
        <p>{dict.hero.body}</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href={`/${lang}/assets`}>{dict.hero.browseAssets}</Link>
          <Link className="btn" href={`/${lang}/games`}>{dict.hero.browseGames}</Link>
          <Link className="btn" href={`/${lang}/upload`}>{dict.hero.share}</Link>
        </div>
        <dl className="stats-row">
          <div><dt>{stats.assets}</dt><dd>{dict.stats.assets}</dd></div>
          <div><dt>{stats.games}</dt><dd>{dict.stats.games}</dd></div>
          <div><dt>{stats.posts}</dt><dd>{dict.stats.posts}</dd></div>
          <div><dt>{stats.downloads}</dt><dd>{dict.stats.downloads}</dd></div>
        </dl>
      </section>

      <section className="quest-strip" aria-label={dict.quest.title}>
        <h2 className="sr-only">{dict.quest.title}</h2>
        {[
          { n: "1", t: dict.quest.step1t, b: dict.quest.step1b },
          { n: "2", t: dict.quest.step2t, b: dict.quest.step2b },
          { n: "3", t: dict.quest.step3t, b: dict.quest.step3b },
        ].map((s) => (
          <div className="quest-step" key={s.n}>
            <span className="quest-num">{s.n}</span>
            <div>
              <strong>{s.t}</strong>
              <p>{s.b}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="section-head">
        <h2>{dict.sections.recentAssets}</h2>
        <Link href={`/${lang}/assets`}>{dict.sections.viewAll}</Link>
      </div>
      <div className="card-grid">
        {assets.map((a) => <AssetCard key={a.slug} asset={a} lang={lang} />)}
      </div>
      {assets.length === 0 && (
        <div className="empty-state">
          <p>{dict.empty.assets}</p>
          <Link className="btn" href={`/${lang}/upload`}>{dict.hero.share}</Link>
        </div>
      )}

      <div className="section-head">
        <h2>{dict.sections.recentGames}</h2>
        <Link href={`/${lang}/games`}>{dict.sections.viewAll}</Link>
      </div>
      <div className="card-grid">
        {games.map((g) => <GameCard key={g.slug} game={g} lang={lang} mapsLabel={dict.game.maps} />)}
      </div>
      {games.length === 0 && <div className="empty-state"><p>{dict.empty.games}</p></div>}

      <div className="section-head">
        <h2>{dict.sections.recentPosts}</h2>
        <Link href={`/${lang}/board`}>{dict.sections.viewAll}</Link>
      </div>
      <div className="post-list">
        {posts.map((p) => <PostRowItem key={p.id} post={p} lang={lang} dict={dict.board} />)}
        {posts.length === 0 && <div className="empty-state"><p>{dict.empty.posts}</p></div>}
      </div>
    </>
  );
}
