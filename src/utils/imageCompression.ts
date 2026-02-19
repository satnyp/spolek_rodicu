export interface CompressionResult {
  file: File;
  originalBytes: number;
  compressedBytes: number;
  warning?: string;
}

export async function compressImage(input: File): Promise<CompressionResult> {
  if (!input.type.startsWith('image/')) {
    return { file: input, originalBytes: input.size, compressedBytes: input.size };
  }
  const bitmap = await createImageBitmap(input);
  const width = Math.min(bitmap.width, 2000);
  const scale = width / bitmap.width;
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);

  let quality = 0.9;
  let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  while (blob && blob.size > 250 * 1024 && quality > 0.35) {
    quality -= 0.08;
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  }
  if (!blob) return { file: input, originalBytes: input.size, compressedBytes: input.size };
  let warning: string | undefined;
  if (blob.size > 500 * 1024) {
    warning = 'Nepodařilo se dosáhnout cílové velikosti 250 KB; zachována čitelnost (max 500+ KB).';
  }
  const compressed = new File([blob], input.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
  return { file: compressed, originalBytes: input.size, compressedBytes: compressed.size, warning };
}
