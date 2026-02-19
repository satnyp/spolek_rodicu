import { readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';

const templatePath = 'assets/Zadost_fillable_final_toggles_masks.pdf';
const mapPath = 'assets/pdf-map.json';

const data = readFileSync(templatePath);
const doc = await PDFDocument.load(data);
const form = doc.getForm();
const fields = form.getFields().map((field) => ({ name: field.getName(), type: field.constructor.name }));

const payload = {
  source: templatePath,
  generatedAt: new Date().toISOString(),
  mode: fields.length > 0 ? 'acroform' : 'coordinates-fallback',
  fields,
  coordinatesFallback: []
};

writeFileSync(mapPath, JSON.stringify(payload, null, 2));
console.log(`Mapped ${fields.length} fields into ${mapPath}`);
