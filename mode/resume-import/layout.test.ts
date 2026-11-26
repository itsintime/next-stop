import assert from 'node:assert/strict';
import { readLayout, type LayoutText } from './layout';

const at = (text: string, x: number, y: number, width = 110): LayoutText => ({ text, x, y, width, height: 12 });
const single = [
  at('教育经历', 35, 50), at('项目经历', 35, 105), at('做过报表', 35, 128),
  at('教育经历', 35.4, 50, 110.3), at('统计学本科', 35, 72), at('做过报表', 35, 168),
];
assert.equal(readLayout(single.slice().reverse(), 600), '教育经历\n统计学本科\n项目经历\n做过报表\n做过报表');

const twoColumns = [
  at('项目经历', 340, 50), at('教育经历', 30, 50),
  at('统计学本科', 30, 68, 115), at('校招报名分析', 340, 70, 200),
  at('预计2027年毕业', 30, 90), at('用 SQL 去重', 340, 90, 170),
  at('姓名及求职目标', 30, 15, 500),
  at('项目经历', 340.3, 50.2),
];
assert.equal(readLayout(twoColumns, 600), '姓名及求职目标\n教育经历\n统计学本科\n预计2027年毕业\n项目经历\n校招报名分析\n用 SQL 去重');
console.log('PASS: PDF 逆序、同位置重叠、双栏与真实重复文本');
