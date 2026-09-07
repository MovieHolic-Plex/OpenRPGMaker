import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CommentSection from "~/components/CommentSection";
import LikeButton from "~/components/LikeButton";
import ReportButton from "~/components/ReportButton";
import { getGame, listComments } from "~/lib/db";
import { getDict, toLang } from "~/lib/i18n";
import { releaseDownloadPath, releasePlayPath } from "~/lib/releaseRoutes";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGame(decodeURIComponent(slug));
  if (!game) return {};
  return { title: `${game.title} — OpenRPGMaker Community`, description: game.description.slice(0, 160) };
}

export default async function GameDetailPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang: raw, slug: rawSlug } = await params;
  const lang = toLang(raw);
  const dict = getDict(lang);
  const slug = decodeURIComponent(rawSlug);
  const game = await getGame(slug);
  if (!game) notFound();
  const comments = await listComments("game", slug);
  const sizeKb = Math.round((game.release_bytes ?? ((game.package_base64?.length ?? 0) * 3) / 4) / 1024);
  return (
    <>
      <p><Link href={`/${lang}/games`} className="back-link">{dict.game.back}</Link></p>
      <div className="detail-head">
        {game.cover_data_url && (
          <div className="detail-preview panel-frame">
            <img src={game.cover_data_url} alt={game.title} />
          </div>
        )}
        <div className="detail-body">
          <h1>{game.title}</h1>
          <div className="card-meta">
            <span>{dict.asset.by} {game.author}</span>
            <span className="license-badge">{game.license}</span>
            {game.release_version && <span>{dict.game.release}: {game.release_version}</span>}
            <span>{game.map_count} {dict.game.maps}</span>
            <span>{game.asset_count} {dict.game.assetsInside}</span>
            <span>{game.downloads} {dict.asset.downloads}</span>
            <span>{new Date(game.created_at).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US")}</span>
          </div>
          {game.tags.length > 0 && (
            <div className="card-meta" style={{ marginTop: 8 }}>
              {game.tags.map((t) => <span key={t} className="kind-badge">#{t}</span>)}
            </div>
          )}
          <p className="detail-desc">{game.description}</p>
          <div className="hero-actions">
            <a className="btn btn-primary" href={game.release_id ? `${releasePlayPath(slug, game.release_id)}player.html` : `/play/${encodeURIComponent(slug)}/?lang=${lang}`}>
              ▶ {dict.common.playInBrowser}
            </a>
            <a className="btn" href={game.release_id ? releaseDownloadPath(slug, game.release_id) : `/api/games/${encodeURIComponent(slug)}/download`}>
              {game.release_id ? dict.game.dlRelease : dict.game.dl} ({sizeKb.toLocaleString()} KB)
            </a>
            <LikeButton type="game" id={slug} initialLikes={game.likes} label={dict.common.like} />
            <ReportButton type="game" id={slug} label={dict.common.report} doneLabel={dict.common.reported} />
          </div>
          <div className="howto">
            <strong>{game.release_id ? dict.game.releaseHowtoTitle : dict.game.howtoTitle}</strong> — {game.release_id ? dict.game.releaseHowtoBody : dict.game.howtoBody}
          </div>
        </div>
      </div>
      <CommentSection parentType="game" parentId={slug} initialComments={comments} dict={dict.board} />
    </>
  );
}
