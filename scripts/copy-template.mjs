import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const from = resolve('assets/Zadost_fillable_final_toggles_masks.pdf');
const to = resolve('public/template.pdf');
mkdirSync(resolve('public'), { recursive: true });
copyFileSync(from, to);
console.log('Copied PDF template to public/template.pdf');
