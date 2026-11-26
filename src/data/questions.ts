import type { Dataset, Question, QuestionId } from '../types';

const publicDataset: Dataset = {
  id: 'public',
  label: '公开样例',
  kind: 'public',
  events: [
    { event_id: 1, event_name: '迎新晚会', city: '上海' },
    { event_id: 2, event_name: '校园歌手赛', city: '上海' },
    { event_id: 3, event_name: '读书分享会', city: '北京' },
    { event_id: 4, event_name: '春季招聘会', city: null },
    { event_id: 5, event_name: '志愿服务', city: '广州' },
  ],
  signups: [
    { signup_id: 1, event_id: 1, student_id: 101 },
    { signup_id: 2, event_id: 1, student_id: 102 },
    { signup_id: 3, event_id: 2, student_id: 103 },
    { signup_id: 4, event_id: 3, student_id: 104 },
    { signup_id: 5, event_id: 4, student_id: 105 },
  ],
};

const gradingDataset1: Dataset = {
  id: 'grading-1',
  label: '判题数据 1',
  kind: 'grading',
  events: [
    { event_id: 101, event_name: '社团招新', city: '上海' },
    { event_id: 102, event_name: '讲座', city: '上海' },
    { event_id: 103, event_name: '路演', city: '北京' },
    { event_id: 104, event_name: '招聘会', city: null },
    { event_id: 105, event_name: '展览', city: '广州' },
    { event_id: 106, event_name: '比赛', city: '上海' },
    { event_id: 107, event_name: '音乐会', city: '杭州' },
    { event_id: 108, event_name: '座谈会', city: '成都' },
    { event_id: 109, event_name: '市集', city: '上海' },
  ],
  signups: [
    { signup_id: 1, event_id: 101, student_id: 1001 },
    { signup_id: 2, event_id: 101, student_id: 1001 },
    { signup_id: 3, event_id: 101, student_id: 1002 },
    { signup_id: 4, event_id: 102, student_id: 1002 },
    { signup_id: 5, event_id: 103, student_id: null },
    { signup_id: 6, event_id: 103, student_id: 1003 },
    { signup_id: 7, event_id: 104, student_id: null },
    { signup_id: 8, event_id: 105, student_id: null },
    { signup_id: 9, event_id: 106, student_id: 1004 },
    { signup_id: 10, event_id: 106, student_id: 1005 },
    { signup_id: 11, event_id: 106, student_id: null },
    { signup_id: 12, event_id: 107, student_id: 1006 },
    { signup_id: 13, event_id: 107, student_id: 1006 },
    { signup_id: 14, event_id: 109, student_id: 1007 },
    { signup_id: 15, event_id: 109, student_id: null },
  ],
};

const gradingDataset2: Dataset = {
  id: 'grading-2',
  label: '判题数据 2',
  kind: 'grading',
  events: [
    { event_id: 201, event_name: '春季运动会', city: '上海' },
    { event_id: 202, event_name: '摄影展', city: '北京' },
    { event_id: 203, event_name: '招聘宣讲', city: null },
    { event_id: 204, event_name: '公益跑', city: '广州' },
    { event_id: 205, event_name: '音乐节', city: '上海' },
    { event_id: 206, event_name: '工作坊', city: '上海' },
    { event_id: 207, event_name: '路演', city: '成都' },
  ],
  signups: [
    { signup_id: 1, event_id: 201, student_id: 2001 },
    { signup_id: 2, event_id: 201, student_id: 2001 },
    { signup_id: 3, event_id: 201, student_id: 2001 },
    { signup_id: 4, event_id: 202, student_id: null },
    { signup_id: 5, event_id: 203, student_id: 2002 },
    { signup_id: 6, event_id: 203, student_id: null },
    { signup_id: 7, event_id: 204, student_id: null },
    { signup_id: 8, event_id: 205, student_id: 2002 },
    { signup_id: 9, event_id: 205, student_id: 2003 },
    { signup_id: 10, event_id: 206, student_id: null },
  ],
};

const q1: Question = {
  id: 1,
  title: '找出上海活动 · 基础查询',
  shortTitle: '找出上海活动',
  typeLabel: '基础查询',
  difficulty: '入门',
  goal: ['只保留城市为「上海」的活动。', '输出 event_id 和 event_name 两列。', '城市为空或其他城市的活动不要输出。'],
  outputColumns: ['event_id', 'event_name'],
  publicDataset,
  gradingDatasets: [gradingDataset1, gradingDataset2],
  expected: {
    public: [
      [1, '迎新晚会'],
      [2, '校园歌手赛'],
    ],
    'grading-1': [
      [101, '社团招新'],
      [102, '讲座'],
      [106, '比赛'],
      [109, '市集'],
    ],
    'grading-2': [
      [201, '春季运动会'],
      [205, '音乐节'],
      [206, '工作坊'],
    ],
  },
  hints: ['城市为空不等于上海，不要用 IS NULL 或模糊匹配兜底。', '先用 WHERE 过滤 city，再选择需要输出的两列。'],
};

const q2: Question = {
  id: 2,
  title: '统计每场活动的有效报名人数 · 分组去重',
  shortTitle: '统计有效报名人数',
  typeLabel: '分组去重',
  difficulty: '中等',
  goal: [
    '只统计至少有一位有效报名者的活动。',
    'student_id 为空的报名记录要跳过。',
    '同一活动内同一学生只计一次。',
    '输出 event_id 和 student_count 两列。',
  ],
  outputColumns: ['event_id', 'student_count'],
  publicDataset,
  gradingDatasets: [gradingDataset1, gradingDataset2],
  expected: {
    public: [
      [1, 2],
      [2, 1],
      [3, 1],
      [4, 1],
    ],
    'grading-1': [
      [101, 2],
      [102, 1],
      [103, 1],
      [106, 2],
      [107, 1],
      [109, 1],
    ],
    'grading-2': [
      [201, 1],
      [203, 1],
      [205, 2],
    ],
  },
  hints: [
    '先排除 student_id 为空的记录，再按活动分组。',
    '人数统计要确认同一学生重复报名不会重复计数。',
    '只有空学生 ID 的活动不应出现在结果里。',
  ],
};

const q3: Question = {
  id: 3,
  title: '找出没有有效报名的活动 · 多表分析',
  shortTitle: '找出没有有效报名的活动',
  typeLabel: '多表分析',
  difficulty: '进阶',
  goal: [
    '找出没有有效报名者的活动，输出 event_id 和 event_name。',
    '完全没有报名记录的活动也要包含。',
    '只有空 student_id 记录的活动也要包含。',
    '接受语义等价的 LEFT JOIN 和 NOT EXISTS 写法。',
  ],
  outputColumns: ['event_id', 'event_name'],
  publicDataset,
  gradingDatasets: [gradingDataset1, gradingDataset2],
  expected: {
    public: [[5, '志愿服务']],
    'grading-1': [
      [104, '招聘会'],
      [105, '展览'],
      [108, '座谈会'],
    ],
    'grading-2': [
      [202, '摄影展'],
      [204, '公益跑'],
      [206, '工作坊'],
      [207, '路演'],
    ],
  },
  hints: [
    '先判断每场活动是否存在 student_id 非空的报名，而不是报名记录本身是否存在。',
    'LEFT JOIN 时把过滤条件写在 ON 里，避免把外连接退化成内连接。',
    'NOT EXISTS 也可以表达同一语义。',
  ],
};

export const QUESTIONS: Record<QuestionId, Question> = { 1: q1, 2: q2, 3: q3 };
export const QUESTION_LIST = [q1, q2, q3];

export function getQuestion(id: QuestionId): Question {
  return QUESTIONS[id];
}

export function questionBySqlType(sqlType: string | undefined): QuestionId | null {
  if (sqlType === 'dedupe') return 2;
  if (sqlType === 'join') return 3;
  if (sqlType === 'basic' || sqlType === 'broad') return 1;
  return null;
}
