// 「얼굴 바꾸기」(changeFace) 명령 폼의 시각 계약.
//
// 실측 결함(2026-08-28):
//  (1) 얼굴이 두 장 겹쳐 보였다. `faceImage()` 는 상자에 `--face-url` CSS 배경(로드 실패
//      폴백)을 깔고 그 안에 실제 <img> 를 넣는데, 두 규칙을 담은
//      `07-identifiable-previews.css` 가 어떤 배럴에도 @import 되지 않은 고아 파일이었다.
//      그래서 <img> 가 `position:static` 원본 크기(48×48)로 흘러가고 배경은 상자 전체
//      (96×96)에 contain 으로 깔려, 크기·자리가 다른 얼굴 두 장이 같이 보였다.
//      실측: 얼굴 상자 115개 중 114개가 배경+<img> 이중 페인트.
//  (2) 표시 옵션 줄이 3열을 선언하는데 필드는 2개뿐이어서 오른쪽에 죽은 열이 남았다.
//  (3) 미리보기 대화창이 불투명한 `--bg-surface`(#F7F8F8) 층을 어두운 유리 색 **위에**
//      깔면서 글자는 `--runtime-window-text`(#FFF6E2) 를 써서 대비가 1.0:1 이었다.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { PNG } from "pngjs"; // 선언은 test/pngjs.d.ts 에 좁게 두었다.
import { createBlankProject } from "@/project/defaults";
import { openCommandPicker, openMapEventEditor } from "./eventStoryboardPicker";
import { seedProjectForEditor } from "./projectSeed";

test.describe.configure({ timeout: 180_000 });

test("얼굴 상자의 <img> 가 배경 폴백을 완전히 덮어 얼굴이 한 장만 보인다", async ({ page }) => {
  const form = await openFaceCommandForm(page);

  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".faceset-crop-box")].map((box) => {
      const img = box.querySelector<HTMLImageElement>("img.faceset-crop-sheet");
      const boxStyle = getComputedStyle(box);
      const inner = {
        width: box.clientWidth,
        height: box.clientHeight,
      };
      const imgRect = img?.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      const border = {
        left: Number.parseFloat(boxStyle.borderLeftWidth) || 0,
        top: Number.parseFloat(boxStyle.borderTopWidth) || 0,
      };
      return {
        label: box.closest<HTMLElement>("[data-resource-id]")?.dataset.resourceId ?? box.className,
        hasImage: img !== null,
        backgroundImage: boxStyle.backgroundImage,
        imgPosition: img === null ? null : getComputedStyle(img).position,
        fillWidth: imgRect === undefined ? null : imgRect.width - inner.width,
        fillHeight: imgRect === undefined ? null : imgRect.height - inner.height,
        offsetX: imgRect === undefined ? null : imgRect.x - boxRect.x - border.left,
        offsetY: imgRect === undefined ? null : imgRect.y - boxRect.y - border.top,
      };
    })
  );

  expect(boxes.length, "얼굴 폼에 얼굴 상자가 렌더돼 있어야 한다").toBeGreaterThan(0);
  // <img> 가 전부 404 나면 faceImage 가 자기가 떼므로 아래 루프가 통짜로 건너뛰어
  // 폼이 다 깨진 상태로도 초록이 된다. 하한은 개수가 아니라 **비율**로 둔다 — 고정 개수는
  // 자산이 더 깨져도 통과하고, 카탈로그가 정당하게 줄면 엉뚱하게 실패한다.
  // 실측 114/115 — 나머지 하나는 `hero-03-face.png` 로, 리소스 등록은 있지만 파일이 없어
  // (generatedAssetResourceResolver 의 NOTE) 404 로 떨어진다. 그 상자만 배경 폴백으로 남는 게
  // 정상이며, :has() 가드가 실패한 <img> 를 제대로 놓아준다는 실물 증거다.
  const loaded = boxes.filter((box) => box.hasImage).length;
  expect(loaded / boxes.length, `얼굴 그림 로드 성공률 ${loaded}/${boxes.length}`).toBeGreaterThan(0.95);
  for (const box of boxes) {
    if (!box.hasImage) continue;
    expect(box.backgroundImage, `${box.label} 실제 그림이 있으면 배경 폴백은 꺼진다`).toBe("none");
    expect(box.imgPosition, `${box.label} <img> 는 상자 안에 배치돼야 한다`).toBe("absolute");
    expect(box.fillWidth ?? 999, `${box.label} <img> 폭이 상자 내부를 채운다`).toBeCloseTo(0, 1);
    expect(box.fillHeight ?? 999, `${box.label} <img> 높이가 상자 내부를 채운다`).toBeCloseTo(0, 1);
    expect(box.offsetX ?? 999, `${box.label} <img> 가로 위치`).toBeCloseTo(0, 1);
    expect(box.offsetY ?? 999, `${box.label} <img> 세로 위치`).toBeCloseTo(0, 1);
  }

  // 폴백 계약: <img> 가 떨어지면(로드 실패) 배경 그림이 다시 들어와야 한다.
  const crop = form.getByTestId("event-command-face-crop").first();
  const fallback = await crop.evaluate((node) => {
    const image = node.querySelector("img.faceset-crop-sheet");
    image?.remove();
    const restored = getComputedStyle(node).backgroundImage;
    if (image !== null) node.append(image);
    return restored;
  });
  expect(fallback, "<img> 가 없으면 CSS 배경 폴백이 보인다").toContain("url(");
});

test("표시 옵션 줄은 실제 필드 수만큼만 열을 만든다", async ({ page }) => {
  const form = await openFaceCommandForm(page);
  const row = await form.locator(".event-command-face-options").evaluate((node) => ({
    columns: getComputedStyle(node)
      .gridTemplateColumns.split(/\s+(?![^(]*\))/)
      .filter((part) => part.length > 0).length,
    fields: node.children.length,
  }));
  expect(row.fields, "표시 위치 · 좌우 반전").toBe(2);
  expect(row.columns, "죽은 열이 남지 않는다").toBe(row.fields);
});

test("미리보기 대화창 글자가 창 배경과 실제로 구별된다", async ({ page }) => {
  const form = await openFaceCommandForm(page);
  const dialog = form.page().getByTestId("event-command-edit-dialog");
  const body = dialog.locator(".ecp-face-stage .ecp-message-body").first();
  await expect(body).toBeVisible();

  const captured = PNG.sync.read(await body.screenshot());
  // 전역 최소/최대를 그대로 재면 클립 안의 아무 어두운 요소(테두리·배지)만으로도 통과하므로,
  // 창 배경(= 클립에서 가장 흔한 색)을 기준으로 잡고 거기서 휘도가 가장 멀리 떨어진 픽셀과 대비를 잰다.
  const histogram = new Map<string, number>();
  const pixels: { luminance: number; key: string }[] = [];
  for (let index = 0; index < captured.data.length; index += 4) {
    const red = captured.data[index] ?? 0;
    const green = captured.data[index + 1] ?? 0;
    const blue = captured.data[index + 2] ?? 0;
    const key = `${red},${green},${blue}`;
    histogram.set(key, (histogram.get(key) ?? 0) + 1);
    pixels.push({ luminance: relativeLuminance(red, green, blue), key });
  }
  const [backgroundKey] = [...histogram.entries()].sort((left, right) => right[1] - left[1])[0] ?? ["0,0,0"];
  const [bgRed, bgGreen, bgBlue] = backgroundKey.split(",").map(Number);
  const backgroundLuminance = relativeLuminance(bgRed ?? 0, bgGreen ?? 0, bgBlue ?? 0);
  const farthest = pixels.reduce(
    (best, pixel) =>
      Math.abs(pixel.luminance - backgroundLuminance) > Math.abs(best.luminance - backgroundLuminance) ? pixel : best,
    pixels[0] ?? { luminance: backgroundLuminance, key: backgroundKey }
  );
  const lighter = Math.max(backgroundLuminance, farthest.luminance);
  const darker = Math.min(backgroundLuminance, farthest.luminance);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  expect(
    ratio,
    `창 배경(${backgroundKey}) 대 본문(${farthest.key}) 대비 ${ratio.toFixed(2)}:1 — 글자가 창 배경에 묻혔다`
  ).toBeGreaterThan(10);
});

function relativeLuminance(red: number, green: number, blue: number): number {
  const channel = (value: number): number => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

async function openFaceCommandForm(page: Page): Promise<Locator> {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await seedProjectForEditor(page, createBlankProject());
  const skip = page.getByTestId("coach-mark-skip");
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await openMapEventEditor(page);
  const picker = await openCommandPicker(page);
  await picker.getByRole("button", { name: "얼굴 바꾸기...", exact: true }).first().click();
  const form = page.getByTestId("event-command-edit-dialog").getByTestId("event-command-face-editor");
  await expect(form).toBeVisible();
  return form;
}
