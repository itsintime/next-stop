const LIMIT = 15 * 1024 * 1024;
const TEXT_LIMIT = 100_000;
const KEY = 'jd-assistant:confirmed-resume:v1';
export interface ConfirmedResume { text: string; name: string }

export function normalizeResume(text: string): string {
  if (text.includes('\u0000') || text.includes('\ufffd')) throw new Error('文字编码无法识别，请改用 UTF-8 TXT 或粘贴文本。');
  const result = text
    .normalize('NFKC')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
  if (!/[\p{L}\p{N}]/u.test(result)) throw new Error('没有检测到可用文字。扫描件可以改用粘贴文本。');
  if (result.length > TEXT_LIMIT) throw new Error('简历文字过长，请精简到 10 万字以内。');
  return result;
}

export function readSavedResume(): ConfirmedResume | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    return value && typeof value.text === 'string' && typeof value.name === 'string'
      ? { text: normalizeResume(value.text), name: value.name } : null;
  } catch { return null; }
}

export function saveResume(value: ConfirmedResume | null): boolean {
  try {
    if (value) sessionStorage.setItem(KEY, JSON.stringify(value));
    else sessionStorage.removeItem(KEY);
    return true;
  } catch { return false; }
}

export async function importResume(file: File): Promise<string> {
  if (file.size > LIMIT) throw new Error('文件超过 15 MB，请缩小后再试。');
  const extension = file.name.toLowerCase().split('.').pop();
  if (!['txt', 'docx', 'pdf'].includes(extension ?? '')) throw new Error('请选择 TXT、DOCX 或 PDF 文件。');
  if (extension === 'txt') {
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); }
    catch { throw new Error('无法读取 UTF-8 文本，请转换编码或改用粘贴。'); }
    return normalizeResume(text);
  }
  if (extension === 'docx') {
    const { readDocx } = await import('./docx');
    return normalizeResume(await readDocx(file));
  }
  const { readPdf } = await import('./pdf');
  return normalizeResume(await readPdf(file));
}
