import { unzipSync, strFromU8 } from 'fflate';

export async function readDocx(file: File): Promise<string> {
  try {
    const filename = 'word/document.xml';
    const maxXml = 5 * 1024 * 1024;
    const zip = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: (entry) => entry.name === filename && entry.originalSize <= maxXml,
    });
    const xml = zip[filename];
    if (!xml || xml.length > maxXml) throw new Error();
    const doc = new DOMParser().parseFromString(strFromU8(xml), 'application/xml');
    const ns = doc.documentElement.namespaceURI;
    if (doc.documentElement.localName !== 'document' || !ns || doc.querySelector('parsererror')) throw new Error();
    const body = doc.getElementsByTagNameNS(ns, 'body')[0];
    if (!body) throw new Error();
    const output: string[] = [];
    const children = (node: Element) => {
      const all = Array.from(node.children);
      if (node.namespaceURI !== 'http://schemas.openxmlformats.org/markup-compatibility/2006' || node.localName !== 'AlternateContent') return all;
      const choice = all.find((child) => child.localName === 'Choice') ?? all.find((child) => child.localName === 'Fallback');
      return choice ? [choice] : [];
    };
    const paragraph = (node: Element): string =>
      children(node).map((child) => {
        if (['p', 'del', 'moveFrom', 'txbxContent'].includes(child.localName)) return '';
        if (child.localName === 't') return child.textContent ?? '';
        if (child.localName === 'tab') return '\t';
        if (['br', 'cr'].includes(child.localName)) return '\n';
        return paragraph(child);
      }).join('');
    // Use one representation when Word includes alternate fallback markup.
    const walk = (node: Element) => {
      if (node.namespaceURI === ns && ['del', 'moveFrom'].includes(node.localName)) return;
      if (node.namespaceURI === ns && node.localName === 'p') output.push(paragraph(node));
      for (const child of children(node)) walk(child);
    };
    walk(body);
    return output.join('\n');
  } catch { throw new Error('无法读取 DOCX 正文。文件可能损坏、加密或过大，请改用粘贴。'); }
}
