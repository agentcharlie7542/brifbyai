import { put, del } from '@vercel/blob';

export interface UploadedPdf {
  url: string;
  pathname: string;
}

export async function uploadPdf(args: {
  brandId: string;
  fileName: string;
  bytes: Buffer;
}): Promise<UploadedPdf> {
  const pathname = `reference-sheets/${args.brandId}/${Date.now()}-${sanitize(args.fileName)}`;
  const blob = await put(pathname, args.bytes, {
    access: 'public',
    contentType: 'application/pdf',
    addRandomSuffix: false,
  });
  return { url: blob.url, pathname: blob.pathname };
}

export async function deletePdf(url: string): Promise<void> {
  await del(url);
}

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_').slice(0, 120);
}
