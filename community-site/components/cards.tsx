import Link from "next/link";
import { AUDIO_KINDS } from "~/lib/kinds";
import type { AssetRow, GameRow, PostRow } from "~/lib/db";

export function AssetCard({ asset, lang }: { asset: AssetRow; lang: string }) {
  const isAudio = AUDIO_KINDS.has(asset.kind);
  return (
    <Link className="card" href={`/${lang}/assets/${encodeURIComponent(asset.slug)}`}>
      <div className="card-thumb">
        {isAudio ? (
          <span className="glyph" aria-hidden>♪</span>
        ) : (
          <img src={`/api/assets/${encodeURIComponent(asset.slug)}/download?format=raw`} alt="" loading="lazy" />
        )}
      </div>
      <div className="card-title">{asset.name}</div>
      <div className="card-meta">
        <span className={`kind-badge kind-${asset.kind}`}>{asset.kind}</span>
        <span>{asset.author}</span>
        <span>↓ {asset.downloads}</span>
        <span>▲ {asset.likes}</span>
      </div>
    </Link>
  );
}

export function GameCard({ game, lang, mapsLabel }: { game: GameRow; lang: string; mapsLabel: string }) {
  return (
    <Link className="card" href={`/${lang}/games/${encodeURIComponent(game.slug)}`}>
      <div className="card-thumb">
        {game.cover_data_url ? (
          <img src={game.cover_data_url} alt="" loading="lazy" />
        ) : (
          <span className="glyph" aria-hidden>▞▚</span>
        )}
      </div>
      <div className="card-title">{game.title}</div>
      <div className="card-meta">
        <span>{game.map_count} {mapsLabel}</span>
        <span>{game.author}</span>
        <span>↓ {game.downloads}</span>
        <span>▲ {game.likes}</span>
      </div>
    </Link>
  );
}

export function PostRowItem({ post, lang, dict }: { post: PostRow; lang: string; dict: { categories: Record<string, string>; views: string } }) {
  return (
    <Link className="post-row" href={`/${lang}/board/${post.id}`}>
      <span className="post-cat">{dict.categories[post.category] ?? post.category}</span>
      <span className="post-title">{post.title}</span>
      <span className="post-stats">
        <span>{post.author}</span>
        <span>💬 {post.comment_count}</span>
        <span>▲ {post.likes}</span>
        <span>{post.views} {dict.views}</span>
      </span>
    </Link>
  );
}
