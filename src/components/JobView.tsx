import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ExtractedItem,
  FavoriteEntry,
  FitResult,
  Job,
  PracticeRecord,
  Profile,
  QuestionId,
} from '../types';
import {
  formatSupplement,
  supplementKindFor,
  supplementPrompt,
  validateSupplement,
  type SupplementKind,
} from '../../mode/resume-supplement';
import type { EvidenceAdvice } from '../../mode/match-session';
import { recommendForJob } from '../recommend';
import { getPractice, practiceLabel } from '../utils';
import {
  IconAlert,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconEdit,
  IconFlag,
  IconLink,
  IconQuote,
  IconRefresh,
  IconSpark,
} from './Icons';

interface JobViewProps {
  job: Job;
  jobs: Job[];
  profile: Profile;
  evaluation: import('../types').FitEvaluation & { evidenceAdvice?: EvidenceAdvice };
  resumeName?: string;
  favorite?: FavoriteEntry;
  practice: Record<string, PracticeRecord>;
  onBack: () => void;
  onSwitchJob: (jobId: string) => void;
  onNewJob: () => void;
  onEditJob: () => void;
  onEditProfile: () => void;
  onOpenInspector: (itemId: string, mode: 'view' | 'edit') => void;
  onAddItem: () => void;
  onFavorite: () => void;
  onUnfavorite: () => void;
  onFavoriteNote: (note: string) => void;
  onStartPractice: (questionId: QuestionId, itemId: string) => void;
  onStartScenario: (itemId: string) => void;
  onSupplementSave: (resultId: string, kind: SupplementKind, value: string) => void;
  onSupplementDelete: (resultId: string) => void;
}

interface GroupSpec {
  title: string;
  hint: string;
  rows: FitResult[];
}

const QUALIFICATION_LABELS = new Set(['毕业届别', '学历要求', '在校状态', '相关专业']);

function statusTone(status: FitResult['status']): string {
  return status;
}

function verdictMark(result: FitResult) {
  if (result.status === 'meet') return <IconCheck size={12} />;
  if (result.status === 'unmet') return <IconAlert size={12} />;
  if (result.status === 'bonus') return <IconSpark size={12} />;
  return <IconQuote size={12} />;
}

function practiceTone(record: PracticeRecord | undefined): 'not-started' | 'attempted' | 'passed' {
  if (!record) return 'not-started';
  return record.status === 'passed' ? 'passed' : 'attempted';
}

export function JobView({
  job,
  jobs,
  profile,
  evaluation,
  resumeName,
  favorite,
  practice,
  onBack,
  onSwitchJob,
  onNewJob,
  onEditJob,
  onEditProfile,
  onOpenInspector,
  onAddItem,
  onFavorite,
  onUnfavorite,
  onFavoriteNote,
  onStartPractice,
  onStartScenario,
  onSupplementSave,
  onSupplementDelete,
}: JobViewProps) {
  const activeJobRef = useRef<HTMLButtonElement | null>(null);
  const highlightTimer = useRef<number | null>(null);
  const [highlight, setHighlight] = useState<{ ids: string[] } | null>(null);
  const [editing, setEditing] = useState<{
    id: string;
    kind: SupplementKind;
    value: string;
    error: string;
  } | null>(null);
  useEffect(() => {
    activeJobRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [job.id]);
  useEffect(
    () => () => {
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    },
    [],
  );
  const recommendation = useMemo(
    () => recommendForJob(job, profile, evaluation),
    [evaluation, job, profile],
  );
  const record = recommendation.questionId
    ? getPractice(practice, job.id, recommendation.questionId)
    : undefined;
  const manualCount = job.items.filter((item) => item.manual).length;
  const sourceLink = job.link && /^https?:\/\//i.test(job.link) ? job.link : null;
  const qualificationRows = evaluation.results.filter(
    (result) =>
      result.group !== 'bonus' &&
      (result.group === 'hard' || QUALIFICATION_LABELS.has(result.label)),
  );
  const bonusRows = evaluation.results.filter((result) => result.group === 'bonus');
  const skillRows = evaluation.results.filter(
    (result) => !qualificationRows.includes(result) && !bonusRows.includes(result),
  );
  const groups: GroupSpec[] = [
    { title: '到岗与资格条件', hint: '优先核对明确的到岗、学历、届别和专业门槛', rows: qualificationRows },
    { title: '专业技能与经历', hint: '区分简历原文、仅提及与需要补充的经历', rows: skillRows },
    { title: '加分项', hint: '优先或加分不作为硬门槛', rows: bonusRows },
  ];
  const metrics = [
    {
      key: 'skills',
      tone: 'warn',
      label: '技能证据待核对',
      rows: evaluation.weakSkills,
    },
    { key: 'bonus', tone: 'bonus', label: '加分项', rows: evaluation.bonus },
    {
      key: 'unknown',
      tone: 'neutral',
      label: '信息不足 / 未说明',
      rows: evaluation.unknown,
    },
  ];

  const jumpToRows = (rows: FitResult[]) => {
    if (rows.length === 0) return;
    const ids = [...new Set(rows.map((row) => row.id))];
    setHighlight({ ids });
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlight(null), 1800);
    window.requestAnimationFrame(() => {
      const first = [...document.querySelectorAll<HTMLElement>('.fit-row')].find(
        (row) => row.dataset.resultId === ids[0],
      );
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      first?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    });
  };

  const beginSupplement = (result: FitResult, item: ExtractedItem | undefined) => {
    if (!item) return;
    setEditing({
      id: result.id,
      kind: supplementKindFor(result, item),
      value: result.supplement?.value ?? '',
      error: '',
    });
  };

  const canSupplement = (result: FitResult, item: ExtractedItem | undefined) => {
    const capability = result.id.startsWith('cap:');
    return Boolean(
      item &&
        (result.supplement ||
          (result.status === 'unknown' || result.status === 'info') &&
            (item.field !== 'duty' || capability)),
    );
  };

  const saveEditing = () => {
    if (!editing) return;
    const error = validateSupplement(editing.kind, editing.value);
    if (error) {
      setEditing({ ...editing, error });
      return;
    }
    onSupplementSave(editing.id, editing.kind, editing.value.trim());
    setEditing(null);
  };
  const renderRow = (result: FitResult) => {
    const item = result.itemId ? job.items.find((entry) => entry.id === result.itemId) : undefined;
    const isEditing = editing?.id === result.id;
    const hasResumeEvidence = result.profileValue !== '暂无简历证据';
    const supplementAllowed = canSupplement(result, item);
    const supplementLabel =
      item?.field === 'days'
        ? '补充到岗时间'
        : item?.field === 'duration'
          ? '补充实习时长'
          : result.id.startsWith('cap:')
            ? '补充经历'
            : '补充信息';
    return (
      <article
        className={`fit-row tone-${statusTone(result.status)} ${
          highlight?.ids.includes(result.id) ? 'is-highlighted' : ''
        }`}
        key={result.id}
        data-result-id={result.id}
      >
        <div className="fit-cell fit-requirement">
          <span className="fit-mobile-label">岗位要求</span>
          <div className="fit-title-line">
            <strong>{result.label}</strong>
            {item?.manual ? <span className="tag tag-manual">手动修改</span> : null}
          </div>
          <p>{result.requirement}</p>
          {result.quote ? <blockquote className="fit-quote">“{result.quote}”</blockquote> : null}
          <div className="fit-row-actions">
            {item ? (
              <>
                <button className="text-btn small" onClick={() => onOpenInspector(item.id, 'view')}>
                  <IconQuote size={12} /> 查看原句
                </button>
                <button className="text-btn small" onClick={() => onOpenInspector(item.id, 'edit')}>
                  <IconEdit size={12} /> 更正
                </button>
              </>
            ) : (
              <button className="text-btn small" onClick={onAddItem}>
                补充这条要求
              </button>
            )}
          </div>
        </div>
        <div className="fit-cell evidence-cell">
          <span className="fit-mobile-label">简历证据</span>
          {hasResumeEvidence ? (
            <div className="evidence-block resume-evidence">
              <span className="tag tag-resume">简历原文</span>
              <p className="fit-profile-value">{result.profileValue}</p>
            </div>
          ) : (
            <p className="fit-profile-value muted">暂无简历证据</p>
          )}
          {result.supplement ? (
            <div className="evidence-block supplement-evidence">
              <span className="tag tag-user">用户补充</span>
              <p>{formatSupplement(result.supplement)}</p>
            </div>
          ) : null}
        </div>
        <div className="fit-cell fit-verdict-cell">
          <span className="fit-mobile-label">状态与操作</span>
          <div className="verdict-line">
            <span className={`verdict-pill ${statusTone(result.status)}`}>
              {verdictMark(result)}
              {result.verdict}
            </span>
            {result.supplement ? (
              <span className="tag tag-user">用户补充</span>
            ) : hasResumeEvidence ? (
              <span className="tag tag-resume">简历原文</span>
            ) : null}
          </div>
          <p>{result.reason}</p>
          {supplementAllowed ? (
            <div className="supplement-entry">
              <span className="supplement-entry-label">{supplementLabel}</span>
              {result.supplement ? (
                <>
                  <button className="text-btn small" onClick={() => beginSupplement(result, item)}>
                    编辑
                  </button>
                  <button
                    className="text-btn small danger-text"
                    onClick={() => {
                      onSupplementDelete(result.id);
                      if (isEditing) setEditing(null);
                    }}
                  >
                    删除
                  </button>
                </>
              ) : (
                <button className="text-btn small" onClick={() => beginSupplement(result, item)}>
                  填写
                </button>
              )}
            </div>
          ) : null}
          {result.exercise && result.exercise.state !== 'not_applicable' ? (
            <div className={`fit-exercise ${result.exercise.state}`}>
              <span>练习匹配</span>
              <strong>{result.exercise.label}</strong>
              {result.exercise.note ? <em>{result.exercise.note}</em> : null}
              {result.exercise.state === 'linked' && result.itemId ? (
                <button
                  className="btn btn-ghost btn-small fit-exercise-link"
                  onClick={() => {
                    if (result.questionId) onStartPractice(result.questionId, result.itemId as string);
                    else onStartScenario(result.itemId as string);
                  }}
                >
                  去练习 <IconArrowRight size={12} />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {isEditing && editing ? (
          <div className="supplement-form">
            <div className="supplement-form-head">
              <strong>补充信息</strong>
              <span>
                {editing.kind === 'days'
                  ? '到岗时间'
                  : editing.kind === 'duration'
                    ? '实习时长'
                    : '具体经历'}
              </span>
            </div>
            <label className="field">
              <span>
                {editing.kind === 'days'
                  ? '每周可到岗天数'
                  : editing.kind === 'duration'
                    ? '可连续实习时长'
                    : '具体经历'}
                {editing.kind === 'days' ? <em>单位：天 / 周</em> : null}
                {editing.kind === 'duration' ? <em>单位：个月</em> : null}
              </span>
              {editing.kind === 'days' || editing.kind === 'duration' ? (
                <div className="supplement-number">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step={editing.kind === 'days' ? 1 : 1}
                    value={editing.value}
                    onChange={(event) =>
                      setEditing({ ...editing, value: event.target.value, error: '' })
                    }
                    placeholder={editing.kind === 'days' ? '例如：4' : '例如：2'}
                  />
                  <span>{editing.kind === 'days' ? '天 / 周' : '个月'}</span>
                </div>
              ) : (
                <textarea
                  className="input textarea"
                  rows={3}
                  value={editing.value}
                  onChange={(event) =>
                    setEditing({ ...editing, value: event.target.value, error: '' })
                  }
                  placeholder={supplementPrompt(result, item)}
                />
              )}
            </label>
            {editing.kind === 'text' ? (
              <p className="supplement-hint">说明做了什么、用到什么工具、解决了什么问题。</p>
            ) : null}
            {editing.error ? (
              <p className="inline-error" role="alert">
                {editing.error}
              </p>
            ) : null}
            <div className="supplement-form-actions">
              <button className="btn btn-primary btn-small" onClick={saveEditing}>
                保存补充
              </button>
              <button className="btn btn-ghost btn-small" onClick={() => setEditing(null)}>
                取消
              </button>
            </div>
          </div>
        ) : null}
      </article>
    );
  };

  return (
    <main className="page analysis-page">
      <div className="analysis-topline">
        <button className="text-btn" onClick={onBack}>
          <IconArrowLeft /> 回到首页
        </button>
        <span className="analysis-local">
          <IconLockInline /> 匹配只使用当前标签页确认的简历
        </span>
      </div>

      <div className="job-switcher">
        <span className="job-switcher-label">切换岗位</span>
        <div className="job-switcher-list">
          {jobs.map((entry) => (
            <button
              key={entry.id}
              ref={entry.id === job.id ? activeJobRef : undefined}
              className={`job-switcher-btn ${entry.id === job.id ? 'active' : ''}`}
              onClick={() => onSwitchJob(entry.id)}
              aria-current={entry.id === job.id ? 'page' : undefined}
            >
              {entry.name}
            </button>
          ))}
          <button className="job-switcher-btn add" onClick={onNewJob}>
            + 分析新岗位
          </button>
        </div>
      </div>

      <div className="page-head analysis-head">
        <div className="page-head-copy">
          <p className="eyebrow">单岗位分析</p>
          <h1>{job.name}</h1>
          <div className="job-head-meta">
            {job.isSample ? <span className="mini-tag">示例</span> : null}
            <span className="mini-tag">已提取 {job.items.length} 项</span>
            {manualCount > 0 ? <span className="mini-tag manual">手动修正 {manualCount} 项</span> : null}
            {sourceLink ? (
              <a className="job-link" href={sourceLink} target="_blank" rel="noreferrer noopener">
                <IconLink size={12} /> 来源链接
              </a>
            ) : (
              <span className="job-source">未填写来源链接</span>
            )}
          </div>
        </div>
        <div className="head-actions">
          <button className="btn btn-ghost" onClick={onEditJob}>
            <IconEdit /> 编辑 JD
          </button>
          <button className="btn btn-ghost" onClick={onEditProfile}>
            <IconEdit /> 简历
          </button>
        </div>
      </div>

      <section className="overview-card">
        <div className="overview-copy">
          <span className="overview-eyebrow">适配总览</span>
          <h2>{evaluation.headline}</h2>
          <p>逐项核对 JD 原句和简历证据。简历没写不等于不会，也不代表不适合投递。</p>
        </div>
        <div className="overview-metrics">
          {metrics.map((metric) => (
            <button
              key={metric.key}
              type="button"
              className={`overview-metric ${metric.tone} ${
                metric.rows.length > 0 ? 'clickable' : 'zero'
              }`}
              onClick={() => jumpToRows(metric.rows)}
              aria-disabled={metric.rows.length === 0}
              aria-label={
                metric.rows.length > 0
                  ? `查看 ${metric.rows.length} 条${metric.label}明细`
                  : `${metric.label}暂无明细`
              }
              title={
                metric.rows.length > 0
                  ? `定位到 ${metric.rows.length} 条${metric.label}明细`
                  : `${metric.label}暂无明细`
              }
            >
              <span className="metric-number-row">
                <strong>{metric.rows.length}</strong>
                <IconArrowRight className="metric-arrow" size={13} />
              </span>
              <span className="metric-label">{metric.label}</span>
            </button>
          ))}
        </div>
      </section>

      {evaluation.evidenceAdvice ? (
        <div className="advice-banner" role="status">
          <span className="advice-icon">
            <IconAlert size={16} />
          </span>
          <div className="advice-copy">
            <strong>暂不建议优先选择这个岗位</strong>
            <span>
              {`${evaluation.evidenceAdvice.coreCount} 项核心要求中，有 ${evaluation.evidenceAdvice.gaps.length} 项证据不足。如果你有相关经历或能确认到岗条件，补充后可重新判断。`}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-small advice-action"
            onClick={() => jumpToRows(evaluation.evidenceAdvice?.gaps ?? [])}
          >
            查看缺项 <IconArrowRight size={12} />
          </button>
        </div>
      ) : null}

      {!evaluation.profileFilled ? (
        <div className="profile-prompt">
          <div>
            <strong>还没有导入简历</strong>
            <span>导入简历后会按这份岗位要求查找证据，无需填写个人资料。</span>
          </div>
          <button className="btn btn-primary btn-small" onClick={onEditProfile}>
            导入简历
          </button>
        </div>
      ) : null}

      <div className="analysis-layout">
        <div className="analysis-main">
          <section className="panel fit-panel">
          <div className="panel-head">
            <h2>逐项适配结果</h2>
            <span className="panel-note">共 {evaluation.results.length} 项 · 修正后立即重算</span>
          </div>
          <div className="fit-table-head" aria-hidden="true">
            <span>岗位要求</span>
            <span>简历证据</span>
            <span>状态与操作</span>
          </div>
          <div className="fit-list">
            {groups.map((spec) => {
              if (spec.rows.length === 0) return null;
              return (
                <section className="fit-group" key={spec.title}>
                  <div className="fit-group-head">
                    <strong>{spec.title}</strong>
                    <span>{spec.hint}</span>
                  </div>
                  {spec.rows.map(renderRow)}
                </section>
              );
            })}
          </div>
          <div className="fit-foot">
            <span>
              <IconRefresh size={13} /> 手动更正提取项后，本页只采用更正后的值；岗位原文仍可查看。
            </span>
            <button className="text-btn small" onClick={onAddItem}>
              <IconEdit size={12} /> 补充一项要求
            </button>
          </div>
        </section>
        </div>

        <aside className="analysis-aside">
          <section className={`side-card favorite-card ${favorite ? 'saved' : ''}`}>
            <div className="side-card-head">
              <h2>
                <IconFlag size={15} /> {favorite ? '已收藏岗位' : '收藏岗位'}
              </h2>
              {favorite ? <span className="mini-tag passed">已收藏</span> : null}
            </div>
            {favorite ? (
              <>
                <p className="side-note">收藏决定由你做出。可以补一句自己的看法，也可以随时取消。</p>
                <label className="field favorite-note">
                  <span>
                    我的看法（可选）
                    <em>自动保存</em>
                  </span>
                  <textarea
                    className="input textarea"
                    value={favorite.note}
                    onChange={(event) => onFavoriteNote(event.target.value)}
                    placeholder="例如：去重任务和我的短板正好对应，通勤时间待确认"
                    rows={3}
                  />
                </label>
                <button className="text-btn small danger-text" onClick={onUnfavorite}>
                  取消收藏
                </button>
              </>
            ) : (
              <>
                <p className="side-note">分析不会自动收藏。确认值得继续看，再保存到收藏列表。</p>
                <button className="btn btn-primary favorite-btn" onClick={onFavorite}>
                  <IconFlag size={15} /> 收藏岗位
                </button>
              </>
            )}
          </section>

          <section className="side-card">
            <div className="side-card-head">
              <h2>简历</h2>
              <button className="text-btn small" onClick={onEditProfile}>
                编辑
              </button>
            </div>
            <p>{resumeName || "未导入简历"}</p>
            <p className="side-footnote">简历文字仅保存在当前标签页。</p>
          </section>

          <section className={`side-card practice-side ${favorite ? '' : 'locked'}`}>
            <div className="side-card-head">
              <h2>
                <IconSpark size={15} /> 推荐练习
              </h2>
              {record ? (
                <span className={`status-pill ${practiceTone(record)}`}>{practiceLabel(record)}</span>
              ) : null}
            </div>

            {!favorite ? (
              <div className="practice-locked">
                <IconFlag size={15} />
                <p>收藏后这里会集中展示优先推荐；也可以在明细行直接进入练习。</p>
              </div>
            ) : recommendation.scenario || recommendation.questionId ? (
              <div className="recommendation-card">
                <div className="recommendation-top">
                  <strong>{recommendation.label}</strong>
                  <span className="mini-tag">{recommendation.basis?.exerciseType}</span>
                </div>
                {recommendation.note ? <p className="recommendation-warning">{recommendation.note}</p> : null}
                <p className="recommendation-common">与上方适配分析使用同一条要求与原句。</p>
                <dl className="recommendation-basis">
                  <div>
                    <dt>JD 要求原句</dt>
                    <dd>{recommendation.basis?.requirement}</dd>
                  </div>
                  <div>
                    <dt>简历证据</dt>
                    <dd>{recommendation.basis?.answer}</dd>
                  </div>
                  <div>
                    <dt>练的是什么</dt>
                    <dd>{recommendation.basis?.practice}</dd>
                  </div>
                  <div>
                    <dt>为什么推荐</dt>
                    <dd>{recommendation.basis?.why}</dd>
                  </div>
                </dl>
                {recommendation.scenario ? (
                  <button
                    className="btn btn-primary btn-small practice-launch"
                    onClick={() => onStartScenario(recommendation.itemId ?? '')}
                  >
                    打开场景题
                  </button>
                ) : (
                  <button
                    className="btn btn-primary btn-small practice-launch"
                    onClick={() =>
                      onStartPractice(
                        recommendation.questionId as QuestionId,
                        recommendation.sqlItem?.id ?? '',
                      )
                    }
                  >
                    {record?.status === 'passed'
                      ? '再练一次'
                      : record?.status === 'attempted'
                        ? '继续练习'
                        : '练习这个岗位'}
                  </button>
                )}
                <p className="side-footnote">
                  {recommendation.scenario
                    ? '开放场景题不自动打分，参考思路只用于自查。'
                    : '练习结果只说明本题覆盖的能力，不代表岗位录用结论。'}
                </p>
              </div>
            ) : (
              <div className="practice-locked">
                <IconAlert size={15} />
                <div>
                  <strong>暂无对应练习</strong>
                  <p>{recommendation.note ?? '这份 JD 暂无对应练习，仍然可以收藏和回看。'}</p>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

function IconLockInline() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
