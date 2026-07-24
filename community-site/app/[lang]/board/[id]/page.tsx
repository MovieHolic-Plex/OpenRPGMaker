import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CommentSection from "~/components/CommentSection";
import LikeButton from "~/components/LikeButton";
import ReportButton from "~/components/ReportButton";
import { bumpViews, getPost, listComments } from "~/lib/db";
import { getDict, toLang } from "~/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return {};
  return { title: `${post.title} — OpenRPGMaker Community`, description: post.body.slice(0, 160) };
}

export default async function PostDetailPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang: raw, id } = await params;
  const lang = toLang(raw);
  const dict = getDict(lang);
  const post = await getPost(id);
  if (!post) notFound();
  await bumpViews(id);
  const comments = await listComments("post", id);
  return (
    <>
      <p><Link href={`/${lang}/board`} className="back-link">{dict.board.back}</Link></p>
      <article className="post-detail panel-frame">
        <div className="card-meta">
          <span className="post-cat">{dict.board.categories[post.category] ?? post.category}</span>
          <span>{dict.asset.by} {post.author}</span>
          <span>{new Date(post.created_at).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US")}</span>
          <span>{post.views} {dict.board.views}</span>
        </div>
        <h1>{post.title}</h1>
        <div className="post-body">{post.body}</div>
        <div className="hero-actions">
          <LikeButton type="post" id={post.id} initialLikes={post.likes} label={dict.common.like} />
          <ReportButton type="post" id={post.id} label={dict.common.report} doneLabel={dict.common.reported} />
        </div>
      </article>
      <CommentSection parentType="post" parentId={id} initialComments={comments} dict={dict.board} />
    </>
  );
}
