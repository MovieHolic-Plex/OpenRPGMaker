import Link from "next/link";
import { notFound } from "next/navigation";
import LangSwitcher from "~/components/LangSwitcher";
import SetHtmlLang from "~/components/SetHtmlLang";
import { getDict, LANGS, toLang, type Lang } from "~/lib/i18n";

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  if (!LANGS.includes(raw as Lang)) notFound();
  const lang = toLang(raw);
  const dict = getDict(lang);
  return (
    <>
      <SetHtmlLang lang={lang} />
      <header className="site-header">
        <div className="wrap header-inner">
          <Link href={`/${lang}`} className="brand">
            <span className="brand-mark" aria-hidden>▚▞</span>
            <span className="brand-name">{dict.nav.brand}</span>
            <span className="brand-sub">{dict.nav.brandSub}</span>
          </Link>
          <nav className="site-nav" aria-label="Main">
            <Link href={`/${lang}/assets`}>{dict.nav.assets}</Link>
            <Link href={`/${lang}/games`}>{dict.nav.games}</Link>
            <Link href={`/${lang}/board`}>{dict.nav.board}</Link>
            <Link href={`/${lang}/upload`} className="nav-cta">{dict.nav.share}</Link>
            <LangSwitcher current={lang} label={dict.a11y.langSwitchTo} />
          </nav>
        </div>
      </header>
      <main className="wrap">{children}</main>
      <footer className="site-footer">
        <div className="wrap">
          <p>{dict.footer}</p>
        </div>
      </footer>
    </>
  );
}
