import { PDFDocument, StandardFonts } from 'pdf-lib';

export async function generateRequestPdf(editorData: Record<string, string>, filename: string): Promise<void> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  page.drawText('Spolek rodičů — export', { x: 40, y: 800, size: 16, font });
  let y = 770;
  for (const [field, value] of Object.entries(editorData)) {
    page.drawText(`${field}: ${value ?? ''}`, { x: 40, y, size: 11, font });
    y -= 18;
  }

  const out = await doc.save();
  const blob = new Blob([out as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
