import "server-only";
import JSZip from "jszip";
import mammoth from "mammoth";

export type ExtractedSection = { label: string; normalizedTextReference: string; startPage: null; endPage: null };

function plain(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(\d+);/g, (entity, number: string | undefined) =>
    number ? String.fromCodePoint(Number(number)) : ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&nbsp;": " " }[entity] ?? " "))
    .replace(/\s+/g, " ").trim();
}

export async function extractDocx(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const entries = Object.values(zip.files);
  if (!zip.file("[Content_Types].xml") || !zip.file("word/document.xml") || !zip.file("_rels/.rels")) throw new Error("Invalid DOCX package.");
  if (entries.length > 3000 || entries.some((e) => e.name.startsWith("/") || e.name.includes("\\") || e.name.split("/").includes("..") || /vbaProject|\.bin$/i.test(e.name))) throw new Error("Unsafe DOCX package.");
  const relationships = entries.filter((e) => e.name.endsWith(".rels"));
  for (const item of relationships) {
    const xml = await item.async("string");
    if (xml.length > 2_000_000 || /TargetMode\s*=\s*["']External["']/i.test(xml)) throw new Error("External DOCX relationship.");
  }
  const documentXml = await zip.file("word/document.xml")!.async("string");
  if (documentXml.length > 8_000_000) throw new Error("DOCX text is too large.");
  const converted = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) }, {
    convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: "" })),
  });
  const paragraphs: Array<{ text: string; headingLevel: number | null; order: number }> = [];
  const pattern = /<(h[1-6]|p)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  for (const match of converted.value.matchAll(pattern)) {
    const value = plain(match[2] ?? "");
    if (!value) continue;
    paragraphs.push({ text: value, headingLevel: match[1]?.startsWith("h") ? Number(match[1][1]) : null, order: paragraphs.length + 1 });
    if (paragraphs.length > 5000) throw new Error("DOCX has too many paragraphs.");
  }
  if (!paragraphs.length) throw new Error("DOCX contains no processable text.");
  const sections: ExtractedSection[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.headingLevel !== null) sections.push({ label: paragraph.text.slice(0, 160), normalizedTextReference: `Heading ${paragraph.order}, level ${paragraph.headingLevel}: ${paragraph.text.slice(0, 500)}`, startPage: null, endPage: null });
    else if (sections.length) {
      const current = sections[sections.length - 1]!;
      if (current.normalizedTextReference.length < 9000) current.normalizedTextReference += `\nParagraph ${paragraph.order}: ${paragraph.text.slice(0, 800)}`;
    }
  }
  return { paragraphs, sections: sections.slice(0, 100), text: paragraphs.map((p) => `${p.headingLevel ? `Heading ${p.headingLevel}` : "Paragraph"} ${p.order}: ${p.text}`).join("\n").slice(0, 350_000) };
}
