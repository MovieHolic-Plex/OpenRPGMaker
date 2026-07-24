import UploadForm from "~/components/UploadForm";
import { getDict, toLang } from "~/lib/i18n";

export const dynamic = "force-dynamic";

export default async function UploadPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang = toLang(raw);
  const dict = getDict(lang);
  return (
    <>
      <div className="section-head">
        <h1>{dict.upload.title}</h1>
      </div>
      <UploadForm lang={lang} dict={{ ...dict.upload, license: dict.common.license, chooseLicense: dict.common.chooseLicense, coverLabel: dict.common.coverLabel }} />
    </>
  );
}
