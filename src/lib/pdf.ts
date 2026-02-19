import { PDFDocument } from 'pdf-lib';

export async function generateRequestPdf(editorData: Record<string, string>, filename: string): Promise<void> {
  const bytes = await fetch('/template.pdf').then((r) => r.arrayBuffer());
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  Object.entries(editorData).forEach(([field, value]) => {
    const target = form.getTextField(field);
    target.setText(value ?? '');
  });
  const out = await doc.save();
  const blob = new Blob([out.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
