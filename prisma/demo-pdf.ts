import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { brand } from "../src/shared/config/brand";
import { formatDate, money } from "../src/shared/lib/time";
import type { Contract, PaymentSchedule } from "../src/generated/prisma/client";

export function tuitionContractDocument(
  contract: Pick<Contract, "number" | "title" | "payer" | "totalKopecks">,
  payments: Pick<PaymentSchedule, "dueAt" | "amountKopecks">[],
) {
  return {
    title: `Договор об образовании с ${brand.name}`,
    lines: [
      `Договор № ${contract.number}`,
      `Университет: ${brand.university} (${brand.name}).`,
      `Плательщик: ${contract.payer}.`,
      `Предмет договора: ${contract.title}.`,
      `Стоимость учебного года: ${money(contract.totalKopecks)}.`,
      "График платежей",
      ...payments.map(({ dueAt, amountKopecks }) => {
        const due = formatDate(dueAt, {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        return `${due} - ${money(amountKopecks)}`;
      }),
      "Демонстрационный договор не создаёт обязательств и не содержит платёжных реквизитов.",
    ],
  };
}

export async function demoPdf(title: string, lines: string[]) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const font = await document.embedFont(
    await readFile("public/fonts/Inter-Regular.ttf"),
    { subset: false },
  );
  const page = document.addPage([595, 842]);
  page.drawText(`${brand.name} / ${brand.university.toUpperCase()}`, {
    x: 48,
    y: 780,
    size: 11,
    font,
    color: rgb(0.28, 0.3, 0.34),
  });
  page.drawRectangle({
    x: 48,
    y: 714,
    width: 499,
    height: 40,
    color: rgb(0.95, 0.96, 0.98),
  });
  page.drawText("Демонстрационный документ", {
    x: 62,
    y: 738,
    size: 12,
    font,
    color: rgb(0.15, 0.25, 0.4),
  });
  page.drawText("Не является официальной справкой", {
    x: 62,
    y: 722,
    size: 10,
    font,
    color: rgb(0.15, 0.25, 0.4),
  });
  let y = 675;
  const drawWrapped = (text: string, size: number) => {
    let line = "";
    for (const word of text.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > 495) {
        page.drawText(line, { x: 48, y, size, font });
        y -= size + 8;
        line = word;
      } else line = next;
    }
    if (line) {
      page.drawText(line, { x: 48, y, size, font });
      y -= size + 12;
    }
  };
  drawWrapped(title, 20);
  y -= 14;
  for (const line of lines) drawWrapped(line, 12);
  page.drawLine({
    start: { x: 48, y: 100 },
    end: { x: 547, y: 100 },
    thickness: 1,
    color: rgb(0.85, 0.86, 0.88),
  });
  page.drawText("Все сведения вымышлены. Печатей и подписей нет.", {
    x: 48,
    y: 80,
    size: 10,
    font,
    color: rgb(0.35, 0.36, 0.4),
  });
  document.setTitle(title);
  document.setAuthor(`${brand.name} — учебный прототип`);
  return Buffer.from(await document.save());
}
