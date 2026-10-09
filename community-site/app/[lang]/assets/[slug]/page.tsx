import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CommentSection from "~/components/CommentSection";
import LikeButton from "~/components/LikeButton";
import ReportButton from "~/components/ReportButton";
import { getAsset, listComments } from "~/lib/db";
import { getDict, toLang } from "~/lib/i18n";
import { AUDIO_KINDS } from "~/lib/kinds";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const asset = await getAsset(decodeURIComponent(slug));
  if (!asset) return {};
  return { title: `${asset.name} — OpenRPGMaker Community`, description: asset.description.slice(0, 160) };
}

export default async function AssetDetailPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang: raw, slug: rawSlug } = await params;
  const lang = toLang(raw);
  const dict = getDict(lang);
  const slug = decodeURIComponent(rawSlug);
  const asset = await getAsset(slug);
  if (!asset) notFound();
  const comments = await listComments("asset", slug);
  const meta = asset.meta as Record<string, unknown>;
  const isAudio = AUDIO_KINDS.has(asset.kind);
  const isImage = asset.data_url.startsWith("data:image/");
  const metaLabels = dict.metaLabels;
  const knownMeta = Object.entries(meta).filter(([k]) => metaLabels[k]);
  const otherMeta = Object.entries(meta).filter(([k]) => !metaLabels[k]);
  return (
    <>
      <p><Link href={`/${lang}/assets`} className="back-link">{dict.asset.back}</Link></p>
      <div className="detail-head">
        <div className="detail-preview panel-frame">
          {isAudio ? (
            <div className="audio-preview">
              <span className="glyph" aria-hidden>♪</span>
              <audio controls src={`/api/assets/${encodeURIComponent(slug)}/download?format=raw`} />
            </div>
          ) : isImage ? (
            <img src={`/api/assets/${encodeURIComponent(slug)}/download?format=raw`} alt={asset.name} />
          ) : (
            <div className="card-thumb"><span className="glyph">▦</span></div>
          )}
        </div>
        <div className="detail-body">
          <h1>{asset.name}</h1>
          <div className="card-meta">
            <span className={`kind-badge kind-${asset.kind}`}>{asset.kind}</span>
            <span>{dict.asset.by} {asset.author}</span>
            <span className="license-badge">{asset.license}</span>
            <span>{asset.downloads} {dict.asset.downloads}</span>
            <span>{new Date(asset.created_at).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US")}</span>
          </div>
          {asset.tags.length > 0 && (
            <div className="card-meta" style={{ marginTop: 8 }}>
              {asset.tags.map((t) => <span key={t} className="kind-badge">#{t}</span>)}
            </div>
          )}
          <p className="detail-desc">{asset.description}</p>
          {(knownMeta.length > 0 || otherMeta.length > 0) && (
            <table className="meta-table">
              <tbody>
                {[...knownMeta, ...otherMeta].map(([k, v]) => (
                  <tr key={k}><th scope="row">{metaLabels[k] ?? k}</th><td>{String(v)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="hero-actions">
            <a className="btn btn-primary" href={`/api/assets/${encodeURIComponent(slug)}/download`}>{dict.asset.dlJson}</a>
            <a className="btn" href={`/api/assets/${encodeURIComponent(slug)}/download?format=raw`}>{dict.asset.dlImage}</a>
            <LikeButton type="asset" id={slug} initialLikes={asset.likes} label={dict.common.like} />
            <ReportButton type="asset" id={slug} label={dict.common.report} doneLabel={dict.common.reported} />
          </div>
          <div className="howto">
            <strong>{dict.asset.howtoTitle}</strong> — {dict.asset.howtoBody} <code>{asset.kind}</code>{dict.asset.howtoTail}
          </div>
        </div>
      </div>
      <CommentSection parentType="asset" parentId={slug} initialComments={comments} dict={dict.board} />
    </>
  );
}
