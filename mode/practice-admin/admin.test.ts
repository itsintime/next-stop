import assert from 'node:assert/strict';
import {
  DEMO_CSV,
  TEMPLATE_CSV,
  buildExport,
  commitImport,
  installSampleTasks,
  loadAdminState,
  previewImport,
  runTrial,
  SAMPLE_TASKS,
  saveAdminState,
  setAdminQuestionStatus,
  type AdminQuestion,
  type ExportBaseline,
} from './index';
import { APPROVED_SCENARIOS } from '../practice-bank';

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
  },
});

let state = loadAdminState();
assert.deepEqual(state, { version: 1, tasks: [], questions: [] });
state = installSampleTasks(state).state;
assert.ok(state.tasks.some((task) => task.id === 'task:firmware-offline'));
assert.equal(saveAdminState(state), true);
assert.equal(loadAdminState().tasks.length, 1, '任务草稿刷新后应保留');

const template = previewImport(state, TEMPLATE_CSV);
assert.equal(template.validCount, 2);

const preview = previewImport(state, DEMO_CSV);
assert.equal(preview.validCount, 2, '只有两条有效题可导入');
assert.deepEqual(
  preview.rows.map((row) => row.status),
  ['new', 'new', 'duplicate', 'fix'],
  '重复题和缺评价要点题不能静默进入草稿',
);
assert.match(preview.rows[2].reason, /ID 已存在|重复/);
assert.match(preview.rows[3].reason, /评价要点/);

const imported = commitImport(state, preview);
assert.equal(imported.imported, 2);
state = imported.state;
assert.equal(state.questions.length, 2);
assert.ok(state.questions.every((question) => question.status === 'draft'));
assert.equal(saveAdminState(state), true);
assert.equal(loadAdminState().questions.length, 2, '题目草稿刷新后应保留');

const draftTrial = runTrial(state, {
  jd: '负责传感器联调，并排查固件升级后设备间歇性掉线。',
  resume: '',
  scope: 'draft',
});
assert.deepEqual(
  draftTrial.recognized.map((task) => task.label).sort(),
  ['传感器联调', '固件升级后掉线排查'].sort(),
);
assert.equal(draftTrial.none, false);
assert.ok(draftTrial.recommendationTitle);
assert.ok(draftTrial.requirement.includes('传感器联调') || draftTrial.requirement.includes('固件升级'));

const toolOnly = runTrial(state, { jd: '熟悉 C 语言。', resume: '', scope: 'draft' });
assert.equal(toolOnly.recognized.length, 0);
assert.equal(toolOnly.none, true);

const firmware = state.questions.find((question) => question.id === 'firmware-offline-sample');
assert.ok(firmware);
state = setAdminQuestionStatus(state, firmware.id, 'approved');
saveAdminState(state);
const exported = buildExport(state);
assert.equal(exported.error, undefined);
assert.equal(exported.preservedCount, 1, '已发布的传感器题应保留');
assert.equal(exported.addedCount, 1, '只新增本次审核通过的固件题');
assert.equal(exported.totalCount, 2);
assert.equal(exported.taskCount, 2);

interface ExportedBank extends ExportBaseline {
  version: number;
  exportedAt: string;
}
const exportedBank = JSON.parse(exported.json) as ExportedBank;
assert.deepEqual(
  exportedBank.scenarios.map((scenario) => scenario.id),
  ['sensor-debug-sample', 'firmware-offline-sample'],
  '导出应同时包含已发布题和本次新增题',
);
assert.deepEqual(
  exportedBank.tasks.map((task) => task.id),
  ['task:sensor-debug', 'task:firmware-offline'],
);
assert.ok(
  exportedBank.tasks
    .find((task) => task.id === 'task:firmware-offline')
    ?.patterns.some((pattern) => new RegExp(pattern, 'i').test('负责排查固件升级后设备间歇性掉线')),
  '新增任务的 JD 识别写法应进入导出',
);
assert.equal(exported.json.includes('sensor-debug-demo'), false, '未审核草稿不能导出');
assert.equal(exported.json.includes('"status"'), false);

const rerun = buildExport(state, exportedBank);
assert.equal(rerun.error, undefined);
assert.equal(rerun.preservedCount, 2);
assert.equal(rerun.addedCount, 0, '替换文件后再次导出不应生成重复题');
assert.equal(rerun.totalCount, 2);
assert.deepEqual(
  (JSON.parse(rerun.json) as ExportedBank).scenarios.map((scenario) => scenario.id),
  ['sensor-debug-sample', 'firmware-offline-sample'],
);

const now = new Date().toISOString();
const officialSensor = APPROVED_SCENARIOS.find((scenario) => scenario.id === 'sensor-debug-sample');
assert.ok(officialSensor);

const duplicateQuestion: AdminQuestion = {
  ...officialSensor,
  status: 'approved',
  createdAt: now,
  updatedAt: now,
};
const duplicateOnly = buildExport({ version: 1, tasks: [], questions: [duplicateQuestion] });
assert.equal(duplicateOnly.error, undefined);
assert.equal(duplicateOnly.addedCount, 0, '同 ID 同内容只保留一份');
assert.equal(duplicateOnly.totalCount, 1);

const conflictQuestion: AdminQuestion = {
  ...duplicateQuestion,
  prompt: `${officialSensor.prompt}（工作台改写版）`,
};
const conflict = buildExport({ version: 1, tasks: [], questions: [conflictQuestion] });
assert.ok(conflict.error);
assert.match(conflict.error ?? '', /内容不同/);
assert.match(conflict.error ?? '', /sensor-debug-sample/);
assert.equal(conflict.json, '', '冲突时不应生成可下载内容');

const unknownQuestion: AdminQuestion = {
  ...firmware,
  id: 'missing-task-sample',
  taskTags: ['task:missing-task'],
  status: 'approved',
};
const unknown = buildExport({ version: 1, tasks: [], questions: [unknownQuestion] });
assert.match(unknown.error ?? '', /未知任务：task:missing-task/);
assert.equal(unknown.json, '');

const reusePublishedTask: AdminQuestion = {
  ...firmware,
  id: 'sensor-extra-sample',
  title: '传感器联调补充',
  taskTags: ['task:sensor-debug'],
  status: 'approved',
  prompt: '传感器联调时如何确认采集配置和供电？',
};
const reuse = buildExport({ version: 1, tasks: [], questions: [reusePublishedTask] });
assert.equal(reuse.error, undefined);
assert.equal(reuse.addedCount, 1);
assert.equal(reuse.taskCount, 1, '复用已发布任务配置，不重复导出');
assert.deepEqual(
  (JSON.parse(reuse.json) as ExportedBank).tasks.map((task) => task.id),
  ['task:sensor-debug'],
);

const linkedSensorQuestion: AdminQuestion = {
  ...firmware,
  id: 'sensor-linked-sample',
  title: '传感器联调新题',
  taskTags: ['task:sensor-debug'],
  status: 'approved',
  prompt: '传感器联调时如何检查供电、采样配置并复现问题？',
};
const divergentSensorTask = {
  ...SAMPLE_TASKS[0],
  patterns: [...SAMPLE_TASKS[0].patterns, '传感器校准'],
};
const taskConflict = buildExport({
  version: 1,
  tasks: [divergentSensorTask],
  questions: [linkedSensorQuestion],
});
assert.ok(taskConflict.error, '本地同 ID 任务配置不同时应阻止导出');
assert.match(taskConflict.error ?? '', /任务「传感器联调」/);
assert.match(taskConflict.error ?? '', /task:sensor-debug/);
assert.match(taskConflict.error ?? '', /JD 识别写法/);
assert.equal(taskConflict.json, '', '任务冲突时不生成可下载内容');

const alignedTask = buildExport({
  version: 1,
  tasks: [{ ...SAMPLE_TASKS[0] }],
  questions: [linkedSensorQuestion],
});
assert.equal(alignedTask.error, undefined, '本地配置与正式一致时允许导出');
assert.equal(alignedTask.taskCount, 1, '同 ID 同内容只保留正式任务一份');
assert.deepEqual(
  (JSON.parse(alignedTask.json) as ExportedBank).scenarios.map((scenario) => scenario.id),
  ['sensor-debug-sample', 'sensor-linked-sample'],
  '已发布旧题和本次新题都应保留',
);

const removedLocalTask = buildExport({
  version: 1,
  tasks: [],
  questions: [linkedSensorQuestion],
});
assert.equal(removedLocalTask.error, undefined, '移除冲突本地配置后可正常导出');
assert.equal(removedLocalTask.taskCount, 1);
assert.equal(removedLocalTask.totalCount, 2);

const unreferencedDivergentTask = buildExport({
  version: 1,
  tasks: [
    { ...SAMPLE_TASKS[0], patterns: ['完全不同的识别写法'] },
    SAMPLE_TASKS[1],
  ],
  questions: [{ ...firmware, status: 'approved' }],
});
assert.equal(unreferencedDivergentTask.error, undefined, '未被审核题引用的草稿任务不影响导出');
assert.deepEqual(
  (JSON.parse(unreferencedDivergentTask.json) as ExportedBank).tasks.map((task) => task.id),
  ['task:sensor-debug', 'task:firmware-offline'],
);

const draftOnly = buildExport({
  version: 1,
  tasks: [],
  questions: [{ ...firmware, status: 'draft' }],
});
assert.equal(draftOnly.error, undefined);
assert.equal(draftOnly.addedCount, 0, '草稿不能导出');
assert.equal(draftOnly.totalCount, 1);

const withdrawnOnly = buildExport({
  version: 1,
  tasks: [],
  questions: [{ ...firmware, status: 'withdrawn' }],
});
assert.equal(withdrawnOnly.error, undefined);
assert.equal(withdrawnOnly.addedCount, 0, '撤回项不能导出');

const withdrawnPublished = buildExport({
  version: 1,
  tasks: [],
  questions: [{ ...duplicateQuestion, status: 'withdrawn' }],
});
assert.equal(withdrawnPublished.error, undefined);
assert.equal(withdrawnPublished.totalCount, 1, '撤回本地副本不等于下架已发布题目');
assert.deepEqual(
  (JSON.parse(withdrawnPublished.json) as ExportedBank).scenarios.map((scenario) => scenario.id),
  ['sensor-debug-sample'],
);

console.log('PASS: 工作台任务、导入预览、草稿持久化、试跑与审核导出');
console.log('PASS: 导出以正式题库为基线、按 ID 合并、冲突拦截与任务依赖复用');
console.log('PASS: 同 ID 本地任务与正式配置冲突拦截、正常复用与未引用草稿隔离');