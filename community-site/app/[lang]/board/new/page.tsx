import Link from "next/link";
import PostForm from "~/components/PostForm";
import { getDict, toLang } from "~/lib/i18n";

export const dynamic = "force-dynamic";

export default async function NewPostPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang = toLang(raw);
  const dict = getDict(lang);
  return (
    <>
      <p><Link href={`/${lang}/board`} className="back-link">{dict.board.back}</Link></p>
      <div className="section-head">
        <h1>{dict.board.write}</h1>
      </div>
      <PostForm lang={lang} dict={{ ...dict.board, categoryLabel: dict.common.category }} />
    </>
  );
}
