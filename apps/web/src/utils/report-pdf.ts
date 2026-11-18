import { jsPDF } from "jspdf";
import type { OperationalReport } from "../api/types";
import { reportRows, saveReportBlob } from "./report-export";

// Browser font fallback preserves configurable Unicode labels. Pages are rasterized
// at twice their PDF point dimensions; CSV remains the machine-readable export.
export const buildReportPdf = async (report: OperationalReport): Promise<Blob> => {
  await document.fonts.ready;
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  pdf.setProperties({ title: "Council operational report", subject: `${report.period.from} to ${report.period.to}`, creator: "Smart Urban Council Complaint Management System" });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = width - 2 * margin;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * 2);
  canvas.height = Math.ceil(height * 2);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("PDF rendering is unavailable in this browser.");
  ctx.scale(2, 2);
  let page = 0;
  let y = 0;
  let header: Array<string | number | null> | null = null;
  const font = (bold = false) => { ctx.font = `${bold ? "600" : "400"} 10px "Segoe UI", Arial, sans-serif`; };
  const linesFor = (text: string, maxWidth: number): string[] => {
    const lines: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
      let line = "";
      // Prefer whole words; split oversized words only at grapheme boundaries.
      const words = new Intl.Segmenter(undefined, { granularity: "word" }).segment(paragraph);
      for (const { segment: word } of words) {
        if (line && ctx.measureText(line + word).width > maxWidth) { lines.push(line.trimEnd()); line = ""; }
        if (!line && !word.trim()) continue;
        for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(word)) {
          if (line && ctx.measureText(line + segment).width > maxWidth) { lines.push(line); line = ""; }
          line += segment;
        }
      }
      lines.push(line);
    }
    return lines;
  };
  const finishPage = () => {
    ctx.fillStyle = "#687672";
    ctx.font = '9px "Segoe UI", Arial, sans-serif';
    ctx.fillText("Academic prototype | Operational report", margin, height - 22);
    ctx.textAlign = "right";
    ctx.fillText(`Page ${page}`, width - margin, height - 22);
    ctx.textAlign = "left";
    if (page > 1) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, width, height);
  };
  const newPage = () => {
    page++;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#0b332c";
    ctx.fillRect(0, 0, width, 78);
    ctx.fillStyle = "#ffffff";
    ctx.font = '600 19px "Segoe UI", Arial, sans-serif';
    ctx.fillText("Reports and analytics", margin, 37);
    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${report.period.from} to ${report.period.to} | UTC | ${report.period.bucket}`, margin, 58);
    y = 94;
  };
  const drawRow = (row: Array<string | number | null>, section = false) => {
    const widths = row.length === 4 ? [contentWidth * .4, contentWidth * .2, contentWidth * .2, contentWidth * .2] : [contentWidth * .42, contentWidth * .58];
    font(section);
    const lines = row.map((cell, i) => linesFor(cell === null ? "Not available" : String(cell), (widths[i] ?? contentWidth) - 16));
    const count = Math.max(1, ...lines.map(cell => cell.length));
    let offset = 0;
    while (offset < count) {
      const available = Math.floor((height - 48 - y - 12) / 14);
      if (available < 1 || (offset === 0 && count <= 35 && count > available)) {
        finishPage(); newPage();
        if (header && !section) drawRow(header, true);
      }
      font(section);
      const take = Math.min(count - offset, Math.max(1, Math.floor((height - 48 - y - 12) / 14)));
      const rowHeight = take * 14 + 12;
      ctx.fillStyle = section ? "#dff1ea" : "#f5f7f4";
      ctx.fillRect(margin, y, contentWidth, rowHeight - 1);
      ctx.fillStyle = "#172523";
      let x = margin;
      lines.forEach((cell, column) => {
        cell.slice(offset, offset + take).forEach((line, index) => ctx.fillText(line, x + 8, y + 15 + index * 14));
        x += widths[column] ?? 0;
      });
      y += rowHeight;
      offset += take;
    }
  };
  newPage();
  let nextIsHeader = false;
  // The PDF masthead replaces the CSV's first title row.
  for (const row of reportRows(report).slice(1)) {
    if (!row.length) { y += 12; nextIsHeader = true; continue; }
    if (nextIsHeader) {
      header = row;
      // Keep a section heading with at least one following data row.
      if (y > height - 120) { finishPage(); newPage(); }
    }
    drawRow(row, nextIsHeader);
    nextIsHeader = false;
  }
  finishPage();
  return pdf.output("blob");
};

export const downloadReportPdf = async (report: OperationalReport): Promise<void> => {
  saveReportBlob(report, await buildReportPdf(report), "pdf");
};
