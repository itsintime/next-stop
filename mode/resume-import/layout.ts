export interface LayoutText {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

type Run = LayoutText & { end: number };
type Row = { y: number; height: number; fragments: Run[] };

function joinRow(fragments: Run[]): string {
  return fragments.map((fragment, i) => {
    const prev = fragments[i - 1];
    if (!prev || /\s$/.test(prev.text) || /^\s/.test(fragment.text)) return fragment.text;
    const gap = fragment.x - prev.end;
    if (gap < Math.max(1, fragment.height * 0.12)) return fragment.text;
    const chinese = /[\p{Script=Han}]/u;
    if (gap < fragment.height * 0.55 && chinese.test(prev.text.slice(-1)) && chinese.test(fragment.text[0])) return fragment.text;
    return ' ' + fragment.text;
  }).join('').trim();
}

export function readLayout(items: LayoutText[], pageWidth: number): string {
  const seen = new Map<string, Run[]>();
  const runs: Run[] = [];
  for (const item of items) {
    if (!item.text.trim()) continue;
    const key = item.text.normalize('NFKC').replace(/\s+/g, ' ').trim();
    const same = seen.get(key) ?? [];
    if (same.some((prev) => Math.abs(prev.x - item.x) <= 1 && Math.abs(prev.y - item.y) <= 1 &&
      Math.abs(prev.width - item.width) <= 2)) continue;
    const run = { ...item, end: item.x + Math.max(item.width, item.height / 2) };
    same.push(run);
    seen.set(key, same);
    runs.push(run);
  }

  const rows: Row[] = [];
  for (const run of runs.sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.at(-1);
    if (row && Math.abs(row.y - run.y) <= Math.max(1.5, Math.min(row.height, run.height) * 0.27)) row.fragments.push(run);
    else rows.push({ y: run.y, height: run.height, fragments: [run] });
  }
  for (const row of rows) row.fragments.sort((a, b) => a.x - b.x);

  // Try habitual interior positions and midpoints of large gaps. Confirm each side has several lines;
  // rows that cross the gutter act as full-width section boundaries.
  const minGap = Math.max(16, pageWidth * 0.035);
  const candidates = new Set<number>();
  const grid = Math.max(4, Math.round(pageWidth / 100));
  for (let x = pageWidth * 0.24; x <= pageWidth * 0.76; x += grid) candidates.add(Math.round(x));
  for (const row of rows) {
    for (let i = 1; i < row.fragments.length; i++) {
      const left = row.fragments[i - 1], right = row.fragments[i];
      if (right.x - left.end >= minGap) candidates.add(Math.round((right.x + left.end) / 2 / grid) * grid);
    }
  }
  const classify = (row: Row, x: number) => {
    const left = row.fragments.filter((f) => f.end <= x - minGap / 2);
    const right = row.fragments.filter((f) => f.x >= x + minGap / 2);
    return { left, right, spans: left.length + right.length !== row.fragments.length };
  };
  let best = { score: 0, x: 0 };
  for (const x of candidates) {
    if (x < pageWidth * 0.18 || x > pageWidth * 0.82) continue;
    let leftRows = 0, rightRows = 0, paired = 0, spans = 0;
    for (const row of rows) {
      const parts = classify(row, x);
      if (parts.spans) { spans++; continue; }
      if (parts.left.length) leftRows++;
      if (parts.right.length) rightRows++;
      if (parts.left.length && parts.right.length) paired++;
    }
    const score = paired * 3 + Math.min(leftRows, rightRows) - spans * 2;
    if (leftRows >= 3 && rightRows >= 3 && paired >= 2 && spans <= rows.length * 0.35 && score > best.score) best = { score, x };
  }
  if (!best.score) return rows.map((row) => joinRow(row.fragments)).join('\n');
  const output: string[] = [];
  let left: string[] = [], right: string[] = [];
  const flush = () => { output.push(...left, ...right); left = []; right = []; };
  for (const row of rows) {
    const parts = classify(row, best.x);
    if (parts.spans) { flush(); output.push(joinRow(row.fragments)); }
    else {
      if (parts.left.length) left.push(joinRow(parts.left));
      if (parts.right.length) right.push(joinRow(parts.right));
    }
  }
  flush();
  return output.join('\n');
}
