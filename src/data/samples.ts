import type { ExtractedItem, Job } from '../types';

export const SAMPLE_A_TEXT =
  '面向 2027 届，每周至少到岗 3 天，连续实习至少 3 个月。要求熟悉 SQL，能对活动报名数据去重并做分组统计；有 Python 经验优先。';

export const SAMPLE_B_TEXT =
  '2028 届优先，每周至少到岗 4 天。要求掌握 SQL 多表连接，能分析活动与报名数据。协助维护 Excel 报表。';

const sampleItem = (item: Omit<ExtractedItem, 'manual' | 'source'>): ExtractedItem => ({
  ...item,
  manual: false,
  source: 'sample',
});

const sampleAItems: ExtractedItem[] = [
  sampleItem({
    id: 'sample-a-graduation',
    field: 'graduation',
    value: '2027 届',
    requirement: 'info',
    quote: '面向 2027 届',
    detail: '毕业届别',
  }),
  sampleItem({
    id: 'sample-a-days',
    field: 'days',
    value: '每周至少到岗 3 天',
    requirement: 'info',
    qualifier: '至少',
    quote: '每周至少到岗 3 天',
    detail: '最低到岗要求',
  }),
  sampleItem({
    id: 'sample-a-duration',
    field: 'duration',
    value: '至少 3 个月',
    requirement: 'info',
    qualifier: '至少',
    quote: '连续实习至少 3 个月',
    detail: '连续实习时长',
  }),
  sampleItem({
    id: 'sample-a-sql',
    field: 'skill',
    value: 'SQL',
    detail: '去重与分组统计',
    requirement: 'required',
    quote: '要求熟悉 SQL，能对活动报名数据去重并做分组统计',
    sqlType: 'dedupe',
  }),
  sampleItem({
    id: 'sample-a-python',
    field: 'skill',
    value: 'Python',
    requirement: 'preferred',
    qualifier: '优先',
    quote: '有 Python 经验优先',
    detail: '有经验者优先',
  }),
];

const sampleBItems: ExtractedItem[] = [
  sampleItem({
    id: 'sample-b-graduation',
    field: 'graduation',
    value: '2028 届',
    requirement: 'preferred',
    qualifier: '优先',
    quote: '2028 届优先',
    detail: '优先考虑该届别',
  }),
  sampleItem({
    id: 'sample-b-days',
    field: 'days',
    value: '每周至少到岗 4 天',
    requirement: 'info',
    qualifier: '至少',
    quote: '每周至少到岗 4 天',
    detail: '最低到岗要求',
  }),
  sampleItem({
    id: 'sample-b-sql',
    field: 'skill',
    value: 'SQL',
    detail: '多表连接',
    requirement: 'required',
    quote: '要求掌握 SQL 多表连接，能分析活动与报名数据',
    sqlType: 'join',
  }),
  sampleItem({
    id: 'sample-b-duty',
    field: 'duty',
    value: '协助维护 Excel 报表',
    requirement: 'duty',
    quote: '协助维护 Excel 报表',
  }),
];

export function createSampleJobs(): Job[] {
  return [
    {
      id: 'sample-a',
      name: '校园活动数据分析实习生',
      rawText: SAMPLE_A_TEXT,
      extraction: 'ok',
      items: sampleAItems.map((item) => ({ ...item })),
      isSample: true,
    },
    {
      id: 'sample-b',
      name: '用户运营数据分析实习生',
      rawText: SAMPLE_B_TEXT,
      extraction: 'ok',
      items: sampleBItems.map((item) => ({ ...item })),
      isSample: true,
    },
  ];
}

export function createSampleJob(index: number): Job {
  return createSampleJobs()[index];
}
