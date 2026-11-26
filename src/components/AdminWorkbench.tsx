import { useState } from 'react';
import type { Scenario } from '../types';
import {
  ADMIN_STORAGE_KEY,
  DEMO_CSV,
  EXPORT_BUILD_COMMAND,
  EXPORT_PATH,
  TEMPLATE_CSV,
  allDirections,
  allTasksWithAdmin,
  buildExport,
  commitImport,
  createTaskDraft,
  installSampleTasks,
  loadAdminState,
  previewImport,
  questionsForTask,
  runTrial,
  saveAdminState,
  setAdminQuestionStatus,
  updateAdminQuestion,
  type AdminQuestion,
  type AdminQuestionStatus,
  type AdminState,
  type ImportPreview,
  type TrialResult,
} from '../../mode/practice-admin';
import { IconAlert, IconArrowLeft, IconCheck, IconEdit, IconPlus, IconSpark } from './Icons';

interface AdminWorkbenchProps {
  onBack: () => void;
}

const STATUS_LABELS: Record<AdminQuestionStatus, string> = {
  draft: '草稿',
  approved: '审核通过',
  withdrawn: '已撤回',
};

function downloadText(filename: string, text: string, type = 'application/json;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function AdminWorkbench({ onBack }: AdminWorkbenchProps) {
  const [state, setState] = useState<AdminState>(loadAdminState);
  const [notice, setNotice] = useState('');
  const [direction, setDirection] = useState('全部方向');
  const [taskError, setTaskError] = useState('');
  const [taskForm, setTaskForm] = useState({
    id: '',
    name: '',
    directions: '',
    patterns: '',
    source: '',
  });
  const [importText, setImportText] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importNotice, setImportNotice] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState({
    title: '',
    difficulty: '中等' as Scenario['difficulty'],
    prompt: '',
    evaluationPoints: '',
    sourceNote: '',
  });
  const [editError, setEditError] = useState('');
  const [trialJd, setTrialJd] = useState('负责传感器联调，并排查固件升级后设备间歇性掉线。');
  const [trialResume, setTrialResume] = useState('');
  const [trialScope, setTrialScope] = useState<'official' | 'draft'>('draft');
  const [trial, setTrial] = useState<TrialResult | null>(null);
  const [exportNotice, setExportNotice] = useState('');

  const commit = (next: AdminState, message: string) => {
    setState(next);
    const saved = saveAdminState(next);
    setNotice(saved ? message : `${message}（浏览器未能写入本地存储）`);
  };

  const tasks = allTasksWithAdmin(state);
  const directions = allDirections(state);
  const filteredTasks = tasks.filter(
    (task) => direction === '全部方向' || task.directions.includes(direction),
  );
  const adminQuestions = state.questions;
  const selected = adminQuestions.find((question) => question.id === editingId) ?? null;

  const createTask = () => {
    const result = createTaskDraft(state, taskForm);
    if (result.error || !result.task) {
      setTaskError(result.error ?? '任务创建失败。');
      return;
    }
    commit(result.state, `已创建任务草稿：${result.task.name}`);
    setTaskError('');
    setTaskForm({ id: '', name: '', directions: '', patterns: '', source: '' });
  };

  const addSampleTasks = () => {
    const result = installSampleTasks(state);
    commit(result.state, result.added > 0 ? `已加入 ${result.added} 个电子信息示例任务。` : '示例任务已存在。');
  };

  const startPreview = () => {
    const result = previewImport(state, importText);
    setPreview(result);
    setImportNotice(result.error ?? '');
  };

  const confirmImport = () => {
    if (!preview) return;
    const result = commitImport(state, preview);
    commit(result.state, `已写入 ${result.imported} 条题目草稿。`);
    setPreview(null);
    setImportText('');
    setImportNotice('');
  };

  const selectQuestion = (question: AdminQuestion) => {
    setEditingId(question.id);
    setEditForm({
      title: question.title,
      difficulty: question.difficulty,
      prompt: question.prompt,
      evaluationPoints: question.evaluationPoints.join('\n'),
      sourceNote: question.sourceNote,
    });
    setEditError('');
  };

  const saveQuestion = () => {
    if (!selected) return;
    const points = editForm.evaluationPoints.split(/\n/).map((point) => point.trim()).filter(Boolean);
    const result = updateAdminQuestion(state, selected.id, {
      title: editForm.title,
      difficulty: editForm.difficulty,
      prompt: editForm.prompt,
      evaluationPoints: points,
      sourceNote: editForm.sourceNote,
    });
    if (result.error) {
      setEditError(result.error);
      return;
    }
    let next = result.state;
    if (selected.status === 'approved') next = setAdminQuestionStatus(next, selected.id, 'draft');
    commit(next, selected.status === 'approved' ? '已保存修改，并转回待审核。' : '题目草稿已保存。');
    setEditError('');
  };

  const changeStatus = (question: AdminQuestion, status: AdminQuestionStatus) => {
    commit(setAdminQuestionStatus(state, question.id, status), `「${question.title}」已标记为${STATUS_LABELS[status]}。`);
  };

  const exportBank = () => {
    const result = buildExport(state);
    if (result.error) {
      setExportNotice(result.error);
      return;
    }
    downloadText('approved-bank.json', result.json);
    setExportNotice(
      `保留 ${result.preservedCount} 道正式题，新增 ${result.addedCount} 道，导出共 ${result.totalCount} 道（含 ${result.taskCount} 个依赖任务）。请替换 ${EXPORT_PATH} 后运行 ${EXPORT_BUILD_COMMAND}。`,
    );
  };

  return (
    <div className="admin-shell">
      <div className="admin-top">
        <button className="text-btn" onClick={onBack}>
          <IconArrowLeft /> 返回应用
        </button>
        <div>
          <p className="eyebrow">本地维护工具</p>
          <h1>题库工作台</h1>
        </div>
        <span className="admin-badge">仅开发模式</span>
      </div>

      <main className="admin-page">
        <div className="admin-intro">
          <strong>导入、审核、试跑、导出都在当前浏览器完成。</strong>
          <span>审核通过只表示可以导出；正式题库需要把导出的 JSON 放入项目并重新构建。</span>
        </div>
        {notice ? <div className="admin-notice" role="status">{notice}</div> : null}

        <section className="panel admin-section">
          <div className="admin-section-head">
            <div>
              <h2>1. 任务库</h2>
              <p>岗位方向只用于筛选；推荐仍由 JD 中识别出的任务决定。</p>
            </div>
            <div className="admin-head-actions">
              <select className="input admin-select" value={direction} onChange={(event) => setDirection(event.target.value)}>
                <option>全部方向</option>
                {directions.map((item) => <option key={item}>{item}</option>)}
              </select>
              <button className="btn btn-ghost btn-small" onClick={addSampleTasks}>
                <IconPlus size={13} /> 电子信息示例任务
              </button>
            </div>
          </div>

          <div className="admin-task-grid">
            {filteredTasks.map((task) => {
              const linked = questionsForTask(state, task.id);
              return (
                <article className="admin-task-card" key={task.id}>
                  <div className="admin-card-title">
                    <strong>{task.name}</strong>
                    <span className={`mini-tag ${task.builtIn ? '' : 'manual'}`}>{task.builtIn ? '内置任务' : '工作台任务'}</span>
                  </div>
                  <code>{task.id}</code>
                  <div className="admin-tag-row">
                    {task.directions.map((item) => <span className="tag" key={item}>{item}</span>)}
                  </div>
                  <p className="admin-small">来源：{task.source}</p>
                  {task.patterns.length > 0 ? (
                    <p className="admin-small">常见写法：{task.patterns.join('；')}</p>
                  ) : (
                    <p className="admin-small">由现有内置识别规则匹配。</p>
                  )}
                  <div className="admin-linked">
                    <span>关联题目</span>
                    {linked.length > 0 ? linked.map((question) => (
                      <span className="admin-linked-item" key={question.id}>{question.title}</span>
                    )) : <span className="admin-muted">暂无</span>}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="admin-create-task">
            <div className="admin-subhead">
              <h3>新建任务草稿</h3>
              <span>任务 ID 稳定后建议不要修改；匹配式可写正则。</span>
            </div>
            <div className="admin-form-grid">
              <label className="field"><span>任务 ID</span><input className="input" value={taskForm.id} onChange={(event) => setTaskForm({ ...taskForm, id: event.target.value })} placeholder="task:sensor-debug" /></label>
              <label className="field"><span>显示名称</span><input className="input" value={taskForm.name} onChange={(event) => setTaskForm({ ...taskForm, name: event.target.value })} placeholder="例如：传感器联调" /></label>
              <label className="field"><span>岗位方向（逗号分隔）</span><input className="input" value={taskForm.directions} onChange={(event) => setTaskForm({ ...taskForm, directions: event.target.value })} placeholder="电子信息，物联网" /></label>
              <label className="field"><span>来源</span><input className="input" value={taskForm.source} onChange={(event) => setTaskForm({ ...taskForm, source: event.target.value })} placeholder="例如：团队整理" /></label>
            </div>
            <label className="field admin-wide-field">
              <span>常见 JD 写法（每行一个，可写正则）</span>
              <textarea className="input textarea" rows={3} value={taskForm.patterns} onChange={(event) => setTaskForm({ ...taskForm, patterns: event.target.value })} placeholder={'传感器联调\n传感器.*调试'} />
            </label>
            {taskError ? <p className="inline-error">{taskError}</p> : null}
            <button className="btn btn-primary btn-small" onClick={createTask}>保存任务草稿</button>
          </div>
        </section>

        <section className="panel admin-section">
          <div className="admin-section-head">
            <div>
              <h2>2. 批量导入题目</h2>
              <p>UTF-8 CSV 或表格粘贴；先预览，确认后才写入草稿。</p>
            </div>
            <div className="admin-head-actions">
              <button className="btn btn-ghost btn-small" onClick={() => downloadText('practice-bank-template.csv', `\uFEFF${TEMPLATE_CSV}`, 'text/csv;charset=utf-8')}>下载导入模板</button>
              <button className="btn btn-ghost btn-small" onClick={() => setImportText(DEMO_CSV)}>填入验收样例</button>
            </div>
          </div>
          <label className="field">
            <span>上传 UTF-8 CSV</span>
            <input
              className="input"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) void file.text().then(setImportText);
              }}
            />
          </label>
          <label className="field">
            <span>或粘贴多行 CSV / TSV</span>
            <textarea className="input textarea admin-import-text" rows={7} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="题目 ID,标题,任务 ID,难度,题干,评价要点,来源说明" />
          </label>
          <div className="admin-actions-row">
            <button className="btn btn-primary btn-small" onClick={startPreview} disabled={!importText.trim()}>预览导入</button>
            {preview ? <button className="text-btn small" onClick={() => { setPreview(null); setImportNotice(''); }}>取消预览</button> : null}
            {importNotice ? <span className="admin-inline-note">{importNotice}</span> : null}
          </div>
          {preview ? (
            <div className="admin-preview">
              <div className="admin-preview-head">
                <strong>预览结果</strong>
                <span>可新增 {preview.validCount} 条；重复和需修正行不会写入。</span>
              </div>
              <div className="admin-preview-list">
                {preview.rows.map((row) => (
                  <div className={`admin-preview-row ${row.status}`} key={`${row.line}-${row.id}`}>
                    <span className="admin-line">第 {row.line} 行</span>
                    <strong>{row.title || row.id || '未命名题目'}</strong>
                    <span className={`admin-status ${row.status}`}>{row.status === 'new' ? '可新增' : row.status === 'duplicate' ? '疑似重复' : '需要修正'}</span>
                    <span className="admin-reason">{row.reason}</span>
                  </div>
                ))}
              </div>
              <div className="admin-actions-row">
                <button className="btn btn-primary btn-small" onClick={confirmImport} disabled={preview.validCount === 0}>确认导入 {preview.validCount} 条可新增</button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="panel admin-section">
          <div className="admin-section-head">
            <div>
              <h2>3. 审核与试跑</h2>
              <p>审核通过后才会进入导出；编辑已通过题会转回待审核。</p>
            </div>
          </div>
          <div className="admin-review-layout">
            <div className="admin-question-list">
              {adminQuestions.length === 0 ? <p className="admin-muted">还没有工作台题目，先导入草稿。</p> : null}
              {adminQuestions.map((question) => (
                <article className={`admin-question-row ${question.status}`} key={question.id}>
                  <button className="admin-question-main" onClick={() => selectQuestion(question)}>
                    <strong>{question.title}</strong>
                    <span>{question.id} · {question.taskTags.join('、')}</span>
                  </button>
                  <span className={`admin-status ${question.status}`}>{STATUS_LABELS[question.status]}</span>
                  <div className="admin-question-actions">
                    <button className="text-btn small" onClick={() => selectQuestion(question)}>
                      <IconEdit size={12} /> 编辑
                    </button>
                    {question.status === 'approved' ? (
                      <button className="text-btn small" onClick={() => changeStatus(question, 'withdrawn')}>撤回</button>
                    ) : (
                      <button className="text-btn small" onClick={() => changeStatus(question, 'approved')}>
                        <IconCheck size={12} /> 审核通过
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {selected ? (
              <div className="admin-edit-card">
                <div className="admin-subhead">
                  <h3>编辑草稿</h3>
                  <span>编辑后需要重新审核。</span>
                </div>
                <label className="field"><span>标题</span><input className="input" value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} /></label>
                <div className="admin-form-grid">
                  <label className="field"><span>难度</span><select className="input" value={editForm.difficulty} onChange={(event) => setEditForm({ ...editForm, difficulty: event.target.value as Scenario['difficulty'] })}><option>入门</option><option>中等</option><option>进阶</option></select></label>
                  <label className="field"><span>任务</span><input className="input" value={selected.taskTags.join('、')} readOnly /></label>
                </div>
                <label className="field"><span>题干</span><textarea className="input textarea" rows={4} value={editForm.prompt} onChange={(event) => setEditForm({ ...editForm, prompt: event.target.value })} /></label>
                <label className="field"><span>评价要点（每行一条）</span><textarea className="input textarea" rows={4} value={editForm.evaluationPoints} onChange={(event) => setEditForm({ ...editForm, evaluationPoints: event.target.value })} /></label>
                <label className="field"><span>来源说明</span><input className="input" value={editForm.sourceNote} onChange={(event) => setEditForm({ ...editForm, sourceNote: event.target.value })} /></label>
                {editError ? <p className="inline-error">{editError}</p> : null}
                <div className="admin-actions-row">
                  <button className="btn btn-primary btn-small" onClick={saveQuestion}>保存草稿</button>
                  <button className="btn btn-ghost btn-small" onClick={() => setEditingId('')}>收起</button>
                </div>
                <div className="admin-question-preview">
                  <span>题面预览</span>
                  <p>{editForm.prompt}</p>
                  <ol>{editForm.evaluationPoints.split(/\n/).filter(Boolean).map((point) => <li key={point}>{point}</li>)}</ol>
                </div>
              </div>
            ) : null}
          </div>

          <div className="admin-trial">
            <div className="admin-subhead">
              <h3>JD 试跑</h3>
              <span>复用前台任务识别和推荐逻辑，不写入题库。</span>
            </div>
            <div className="admin-scope-row">
              <label className="checkbox-line"><input type="radio" checked={trialScope === 'official'} onChange={() => setTrialScope('official')} /> 当前正式题库</label>
              <label className="checkbox-line"><input type="radio" checked={trialScope === 'draft'} onChange={() => setTrialScope('draft')} /> 含工作台草稿</label>
            </div>
            <label className="field"><span>JD 文本</span><textarea className="input textarea" rows={4} value={trialJd} onChange={(event) => setTrialJd(event.target.value)} /></label>
            <label className="field"><span>简历文本（可选，用于证据判断）</span><textarea className="input textarea" rows={3} value={trialResume} onChange={(event) => setTrialResume(event.target.value)} placeholder="可留空；留空时仍会显示任务和题目，但证据为未提供。" /></label>
            <button className="btn btn-primary btn-small" onClick={() => setTrial(runTrial(state, { jd: trialJd, resume: trialResume, scope: trialScope }))}>运行试跑</button>
            {trial ? (
              <div className="admin-trial-result">
                <p className="admin-small">识别到的任务</p>
                {trial.recognized.length > 0 ? trial.recognized.map((task) => (
                  <div className="admin-recognized" key={task.id}>
                    <strong>{task.label}</strong>
                    <span>{task.quote}</span>
                    <em>{task.scenarioTitle ? `对应题目：${task.scenarioTitle}` : '暂无对应题目'}</em>
                  </div>
                )) : <p className="admin-muted">未识别到题库任务。</p>}
                <p className="admin-small">推荐结果</p>
                {trial.none ? (
                  <p className="admin-trial-none">暂无对应练习。{trial.reason}</p>
                ) : (
                  <div className="admin-trial-recommendation">
                    <strong>{trial.recommendationTitle || trial.recommendation.label}</strong>
                    {trial.requirement ? <p><b>对应原句：</b>{trial.requirement}</p> : null}
                    {trial.reason ? <p><b>推荐理由：</b>{trial.reason}</p> : null}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel admin-section">
          <div className="admin-section-head">
            <div>
              <h2>4. 导出</h2>
              <p>以当前正式扩展题库为基线，追加审核通过的场景题和依赖任务；草稿、撤回项和试跑 JD 不会进入文件。</p>
            </div>
            <span className={`admin-status ${adminQuestions.some((question) => question.status === 'approved') ? 'approved' : 'draft'}`}>
              {adminQuestions.filter((question) => question.status === 'approved').length} 道已通过
            </span>
          </div>
          <div className="admin-export">
            <button className="btn btn-primary btn-small" onClick={exportBank}>下载 approved-bank.json</button>
            <p>放置到 <code>{EXPORT_PATH}</code>，然后运行 <code>{EXPORT_BUILD_COMMAND}</code>。构建后用含新任务的 JD 在前台重新分析，确认新题出现在推荐中。</p>
            <p className="admin-muted">导出会保留已发布的扩展题和任务配置；同 ID 内容不同会报冲突并取消导出，不会静默覆盖。</p>
            {exportNotice ? <p className="admin-notice" role="status">{exportNotice}</p> : null}
            <p className="admin-muted">SQL 自动判题不在本工作台导入/导出范围内，仍由现有题库正常运行。</p>
          </div>
        </section>
      </main>
    </div>
  );
}