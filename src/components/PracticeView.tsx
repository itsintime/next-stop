import { useMemo, useState } from 'react';
import type { ExtractedItem, GradeReport, Job, PracticeRecord, Question } from '../types';
import type { Recommendation } from '../recommend';
import { gradeSql } from '../grading/client';
import { formatDate } from '../utils';
import {
  IconAlert,
  IconArrowLeft,
  IconCheck,
  IconDatabase,
  IconLock,
  IconPlay,
  IconQuote,
  IconRefresh,
  IconSpark,
  IconTable,
} from './Icons';

interface PracticeViewProps {
  job: Job;
  question: Question;
  item: ExtractedItem;
  recommendation: Recommendation;
  lastRecord: PracticeRecord | undefined;
  onBack: () => void;
  onGrade: (questionId: Question['id'], outcome: GradeReport['outcome'], sql: string) => void;
  showToast: (message: string) => void;
}

function renderCell(value: unknown) {
  if (value === null || value === undefined) return <span className="null-cell">NULL</span>;
  return String(value);
}

function DataTable({ columns, rows }: { columns: string[]; rows: unknown[][] }) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{renderCell(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function outcomeTone(report: GradeReport): string {
  if (report.outcome === 'passed') return 'passed';
  if (report.outcome === 'mismatch') return 'mismatch';
  return 'error';
}

function outcomeTitle(report: GradeReport): string {
  if (report.outcome === 'passed') return '通过';
  if (report.outcome === 'mismatch') return '结果不符';
  if (report.outcome === 'timeout') return '执行超时';
  if (report.outcome === 'rejected') return '未能执行';
  return '执行错误';
}

export function PracticeView({
  job,
  question,
  item,
  recommendation,
  lastRecord,
  onBack,
  onGrade,
  showToast,
}: PracticeViewProps) {
  const [sql, setSql] = useState(() => lastRecord?.lastSql ?? '');
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<GradeReport | null>(null);
  const [showExpected, setShowExpected] = useState(false);

  const publicEvents = question.publicDataset.events;
  const publicSignups = question.publicDataset.signups;
  const expectedRows = question.expected[question.publicDataset.id] ?? [];
  const isBroad = recommendation.kind === 'broad' || item.sqlType === 'broad';
  const visibleResults = useMemo(() => report?.results ?? [], [report]);

  const submit = async () => {
    if (running) return;
    if (!sql.trim()) {
      showToast('请先输入 SQL 再提交。');
      return;
    }
    setRunning(true);
    setReport(null);
    try {
      const nextReport = await gradeSql(question, sql);
      setReport(nextReport);
      onGrade(question.id, nextReport.outcome, sql);
    } catch (error) {
      const fallback: GradeReport = {
        outcome: 'error',
        results: [],
        message: '判题请求失败。',
        details: [error instanceof Error ? error.message : String(error)],
        hints: ['刷新页面后可以再试一次。'],
      };
      setReport(fallback);
      onGrade(question.id, 'error', sql);
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="page practice-page">
      <div className="practice-head">
        <button className="text-btn" onClick={onBack}>
          <IconArrowLeft /> 返回岗位
        </button>
        <div className="practice-title-row">
          <div>
            <div className="practice-badges">
              <span className="tag tag-required">题 {question.id}</span>
              <span className="tag">{question.typeLabel}</span>
              <span className="tag">难度：{question.difficulty}</span>
              <span className="tag tag-preferred">原创练习题 · 模拟工作场景</span>
            </div>
            <h1>{question.title}</h1>
            <p className="page-sub">难度描述的是这道练习本身，不是岗位门槛；练习结果也不代表岗位录用结论。</p>
          </div>
          <div className="practice-job-chip">
            <span className="job-avatar tone-0">{job.name.slice(0, 1) || '岗'}</span>
            <div>
              <span>来自岗位</span>
              <strong>{job.name}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="practice-layout">
        <div className="practice-main">
          <section className={`link-card ${isBroad ? 'broad' : ''}`}>
            <div className="link-card-head">
              <IconQuote size={15} />
              <span>{isBroad ? '宽泛 SQL 要求 · 基础自测' : '推荐依据'}</span>
            </div>
            <blockquote>{recommendation.basis?.requirement || item.quote || item.value}</blockquote>
            <dl className="practice-basis">
              <div>
                <dt>简历证据</dt>
                <dd>{recommendation.basis?.answer ?? '未填写'}</dd>
              </div>
              <div>
                <dt>练的是什么</dt>
                <dd>{recommendation.basis?.practice ?? `题 ${question.id} · ${question.typeLabel}`}</dd>
              </div>
              <div>
                <dt>为什么推荐</dt>
                <dd>{recommendation.basis?.why ?? item.detail ?? '这道题覆盖岗位中的 SQL 任务。'}</dd>
              </div>
            </dl>
            <p>
              {isBroad
                ? '这条要求只写了熟悉 SQL 一类宽泛描述，JD 未说明具体任务。先做一道基础自测，确认查询和输出是否准确。'
                : `本题覆盖：${question.typeLabel}。练习结果只说明本题覆盖的能力，不代表岗位其他要求。`}
            </p>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>
                <IconTable size={17} /> 题目目标
              </h2>
              <span className="panel-note">输出列：{question.outputColumns.join('、')}</span>
            </div>
            <ul className="goal-list">
              {question.goal.map((goal) => (
                <li key={goal}>
                  <span className="goal-dot" />
                  {goal}
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>
                <IconDatabase size={17} /> 表结构
              </h2>
              <span className="panel-note">SQLite · 只读临时样例库</span>
            </div>
            <div className="schema-grid">
              <div className="schema-card">
                <code>events</code>
                <ul>
                  <li>
                    <b>event_id</b>
                    <span>INTEGER · 主键</span>
                  </li>
                  <li>
                    <b>event_name</b>
                    <span>TEXT</span>
                  </li>
                  <li>
                    <b>city</b>
                    <span>TEXT · 可为空</span>
                  </li>
                </ul>
              </div>
              <div className="schema-card">
                <code>signups</code>
                <ul>
                  <li>
                    <b>signup_id</b>
                    <span>INTEGER · 主键</span>
                  </li>
                  <li>
                    <b>event_id</b>
                    <span>INTEGER</span>
                  </li>
                  <li>
                    <b>student_id</b>
                    <span>INTEGER · 可为空</span>
                  </li>
                </ul>
              </div>
            </div>
            <p className="schema-note">
              活动 ID 和报名记录 ID 各自在本表唯一；同一学生可以重复报名同一活动。
            </p>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>公开样例数据</h2>
              <span className="panel-note">仅用于理解表结构</span>
            </div>
            <h3 className="table-caption">events</h3>
            <DataTable
              columns={['event_id', 'event_name', 'city']}
              rows={publicEvents.map((row) => [row.event_id, row.event_name, row.city])}
            />
            <h3 className="table-caption">signups</h3>
            <DataTable
              columns={['signup_id', 'event_id', 'student_id']}
              rows={publicSignups.map((row) => [row.signup_id, row.event_id, row.student_id])}
            />
            <div className="sample-caveat">
              <IconAlert size={15} />
              <p>公开样例通过不代表全部通过。提交后还会在独立判题数据上执行，覆盖重复报名、空学生 ID 等场景。</p>
            </div>
            <button className="text-btn small" onClick={() => setShowExpected((value) => !value)}>
              {showExpected ? '收起公开样例期望输出' : '查看公开样例期望输出'}
            </button>
            {showExpected ? (
              <div className="expected-block">
                <DataTable columns={question.outputColumns} rows={expectedRows} />
              </div>
            ) : null}
          </section>
        </div>

        <aside className="practice-aside">
          <section className="editor-panel">
            <div className="editor-head">
              <div>
                <h2>写 SQL</h2>
                <p>只允许一条读取查询，执行上限 6 秒。</p>
              </div>
              <span className="readonly-chip">
                <IconLock size={12} /> 只读
              </span>
            </div>
            <textarea
              className="sql-editor"
              value={sql}
              onChange={(event) => setSql(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault();
                  void submit();
                }
              }}
              placeholder="SELECT ...&#10;FROM events"
              spellCheck={false}
              aria-label="SQL 编辑器"
              rows={9}
            />
            <div className="editor-actions">
              <span className="editor-hint">⌘ / Ctrl + Enter 运行</span>
              <button className="btn btn-primary" onClick={() => void submit()} disabled={running}>
                {running ? <span className="spinner" /> : <IconPlay size={15} />}
                {running ? '正在检查…' : '运行并检查'}
              </button>
            </div>
            {lastRecord ? (
              <p className="attempt-line">
                本题已提交 {lastRecord.attempts} 次 · 最近 {formatDate(lastRecord.updatedAt)}
              </p>
            ) : null}
          </section>

          <div aria-live="polite">
            {running ? (
              <section className="feedback-panel running">
                <div className="feedback-head">
                  <span className="spinner" />
                  <h2>正在公开样例与判题数据上执行</h2>
                </div>
                <p>查询会在独立的临时样例库中运行，不会触碰你的岗位记录。</p>
              </section>
            ) : null}

            {directReport(report, visibleResults, onBack)}
          </div>

          <section className="hint-panel">
            <h3>
              <IconSpark size={14} /> 排查看板
            </h3>
            <ul>
              {question.hints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
              <li>提交错误后可以继续修改，不需要重新开始。</li>
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}

function directReport(
  report: GradeReport | null,
  results: GradeReport['results'],
  onBack: () => void,
) {
  if (!report) return null;
  const tone = outcomeTone(report);
  return (
    <section className={`feedback-panel ${tone}`}>
      <div className="feedback-head">
        <span className={`feedback-icon ${tone}`}>
          {report.outcome === 'passed' ? <IconCheck size={18} /> : <IconAlert size={18} />}
        </span>
        <div>
          <h2>{outcomeTitle(report)}</h2>
          <p>{report.message}</p>
        </div>
      </div>

      {results.length > 0 ? (
        <div className="dataset-results">
          {results.map((result) => (
            <span
              key={result.datasetId}
              className={`dataset-chip ${result.state === 'match' ? 'pass' : result.state === 'error' ? 'error' : 'fail'}`}
            >
              {result.kind === 'public' ? '公开样例' : result.datasetLabel}
              {result.state === 'match' ? ' 通过' : result.state === 'error' ? ' 出错' : ' 未通过'}
            </span>
          ))}
        </div>
      ) : null}

      {report.details.length > 0 ? (
        <div className="feedback-block">
          <h3>看到的情况</h3>
          <ul>
            {report.details.map((detail, index) => (
              <li key={`${detail}-${index}`}>{detail}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.hints.length > 0 ? (
        <div className="feedback-block hints">
          <h3>下一步排查</h3>
          <ul>
            {report.hints.map((hint, index) => (
              <li key={`${hint}-${index}`}>{hint}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="feedback-actions">
        {report.outcome === 'passed' ? (
          <button className="btn btn-primary" onClick={onBack}>
            返回岗位页，更新进度
          </button>
        ) : (
          <button
            className="btn btn-ghost"
            onClick={() => {
              const editor = document.querySelector<HTMLTextAreaElement>('.sql-editor');
              editor?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              editor?.focus();
            }}
          >
            <IconRefresh size={14} /> 回到编辑器修改
          </button>
        )}
        <span className="practice-ability-note">练习结果只说明本题覆盖的能力。</span>
      </div>
    </section>
  );
}
