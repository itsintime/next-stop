export const designTools = [
  { value: 'Figma', pattern: /\bfigma\b/i },
  { value: 'Sketch', pattern: /\bsketch\b/i },
  { value: 'Photoshop', pattern: /\bphotoshop\b/i },
];

export function explicitToolChoice(text: string, tools: readonly { value: string; pattern: RegExp }[]): string[] {
  const hits = tools.flatMap(({value, pattern}) => {
    const hit = pattern.exec(text);
    return hit ? [{value, start: hit.index, end: hit.index + hit[0].length}] : [];
  }).sort((a, b) => a.start - b.start);
  if (hits.length < 2 || /或者?同时|而且|并且|同时掌握/.test(text)) return [];
  return hits.slice(1).every((hit, i) => /^\s*(?:或(?:者)?|\bor\b)\s*$/i.test(text.slice(hits[i].end, hit.start)))
    ? hits.map(hit => hit.value)
    : [];
}

// Only well-defined task families are automatically confirmed. The rest stay reviewable.
export function toolTaskFor(text: string): 'prototype' | 'data-processing' | undefined {
  if (/原型/.test(text)) return 'prototype';
  if (/处理.{0,6}数据|数据处理/.test(text)) return 'data-processing';
}

export const toolTaskEvidence = {
  prototype: /(?:制作|设计|完成|绘制|搭建|交付|迭代|制作了).{0,20}原型/,
  'data-processing': /清洗|预处理|(?:处理|连接|关联|汇总|统计|提取|查询|分析|计算).{0,16}(?:数据|记录|订单|转化率|报表|日志)|(?:联表|多表连接|去重)/,
};
