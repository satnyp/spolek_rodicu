import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';

async function main() {
  const bytes = readFileSync('assets/Zadost_fillable_final_toggles_masks.pdf');
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();
  const names = form.getFields().map((f) => f.getName());
  console.log(JSON.stringify(names, null, 2));
}

main();
