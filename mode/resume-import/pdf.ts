import { readLayout, type LayoutText } from './layout';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export async function readPdf(file: File): Promise<string> {
  GlobalWorkerOptions.workerSrc = workerUrl;
  const loading = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const doc = await loading.promise;
    if (doc.numPages > 30) throw new Error('PAGE_LIMIT');
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });
      const fragments: LayoutText[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        fragments.push({ text: item.str, x, y, width: item.width, height: item.height });
      }
      pages.push(readLayout(fragments, viewport.width));
      page.cleanup();
    }
    return pages.join('\n\n');
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException') throw new Error('PDF 已加密，请使用解密后的文件或粘贴文本。');
    if (error instanceof Error && error.message === 'PAGE_LIMIT') throw new Error('PDF 超过 30 页，请只保留简历页。');
    throw new Error('无法读取 PDF，文件可能损坏。你可以改用粘贴文本。');
  } finally { await loading.destroy().catch(() => {}); }
}
