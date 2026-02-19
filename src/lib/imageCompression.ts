export interface CompressionResult {
  file: File;
  originalBytes: number;
  finalBytes: number;
  warning: string | null;
}

export async function compressImage(file: File): Promise<CompressionResult> {
  const bitmap = await createImageBitmap(file);
  const maxWidth = 1800;
  const ratio = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas není dostupný.');
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  let quality = 0.9;
  let blob = await toBlob(canvas, quality);
  const target = 250 * 1024;
  const fallback = 500 * 1024;

  while (blob.size > target && quality > 0.4) {
    quality -= 0.1;
    blob = await toBlob(canvas, quality);
  }
  const warning = blob.size > target && blob.size <= fallback ? 'Soubor je větší než cíl 250 KB, použit fallback do 500 KB.' : null;
  if (blob.size > fallback) {
    throw new Error('Nepodařilo se komprimovat pod 500 KB.');
  }

  return {
    file: new File([blob], file.name.replace(/\.(png|jpg|jpeg)$/i, '.jpg'), { type: 'image/jpeg' }),
    originalBytes: file.size,
    finalBytes: blob.size,
    warning
  };
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Blob conversion failed'));
    }, 'image/jpeg', quality);
  });
}
