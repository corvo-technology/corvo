/**
 * A minimal, valid PDF made on the spot, one text line per page, so tests read a real PDF without
 * a binary file in the repository. A page with an empty string has no text at all, like a scan.
 */
export function makePdf(pages: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const objects: string[] = [];
  const pageIds = pages.map((_, index) => 4 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((text, index) => {
    const pageId = 4 + index * 2;
    const content = text ? `BT /F1 18 Tf 72 720 Td (${text.replace(/[()\\]/g, "\\$&")}) Tj ET` : "";
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
    objects[pageId + 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = encoder.encode(out).length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = encoder.encode(out).length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1)
    out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return encoder.encode(out);
}
