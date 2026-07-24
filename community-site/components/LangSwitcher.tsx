"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function LangSwitcher({ current, label }: { current: string; label: string }) {
  const pathname = usePathname() ?? `/${current}`;
  const other = current === "en" ? "ko" : "en";
  const href = pathname.replace(/^\/(en|ko)(\/|$)/, `/${other}$2`);
  return (
    <Link href={href} className="lang-switch" lang={other}>
      {label}
    </Link>
  );
}
