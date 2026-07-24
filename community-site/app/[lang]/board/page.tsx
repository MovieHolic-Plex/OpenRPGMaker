import Link from "next/link";
import { PostRowItem } from "~/components/cards";
import { listPosts } from "~/lib/db";
import { getDict, toLang } from "~/lib/i18n";

export const dynamic = "force-dynamic";

const CATEGORIES = ["general", "showcase", "qna", "feedback"] as const;

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { lang: raw } = await params;
  const lang = toLang(raw);
  const dict = getDict(lang);
  const { c } = await searchParams;
  const category = CATEGORIES.includes(c as (typeof CATEGORIES)[number]) ? c : undefined;
  const posts = await listPosts(category, 50, lang);
  return (
    <>
      <div className="section-head">
        <h1>{dict.board.title}</h1>
        <Link href={`/${lang}/board/new`}>+ {dict.board.write}</Link>
      </div>
      <div className="filter-row">
        <Link className={`filter-chip${!category ? " active" : ""}`} href={`/${lang}/board`}>{dict.board.categories.all}</Link>
        {CATEGORIES.map((k) => (
          <Link key={k} className={`filter-chip${category === k ? " active" : ""}`} href={`/${lang}/board?c=${k}`}>
            {dict.board.categories[k]}
          </Link>
        ))}
      </div>
      <div className="post-list">
        {posts.map((p) => <PostRowItem key={p.id} post={p} lang={lang} dict={dict.board} />)}
        {posts.length === 0 && (
          <div className="empty-state">
            <p>{dict.empty.posts}</p>
            <Link className="btn" href={`/${lang}/board/new`}>+ {dict.board.write}</Link>
          </div>
        )}
      </div>
    </>
  );
}
