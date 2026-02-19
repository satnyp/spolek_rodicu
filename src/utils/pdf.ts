import { PDFDocument } from 'pdf-lib';

export async function generatePdf(editorData: Record<string, string>, vs: string) {
  const templateBytes = await fetch('/template.pdf').then((r) => r.arrayBuffer());
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const fields = new Set(form.getFields().map((f) => f.getName()));
  for (const [fieldName, value] of Object.entries(editorData)) {
    if (!fields.has(fieldName)) continue;
    form.getTextField(fieldName).setText(value);
  }
  form.flatten();
  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SR_${vs}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
