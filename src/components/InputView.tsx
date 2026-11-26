import { useState } from 'react';
import type { Job } from '../types';
import { createSampleJobs } from '../data/samples';
import { normalizeName, uid } from '../utils';
import { ConfirmDialog } from './Modal';
import { IconArrowLeft, IconArrowRight, IconEdit, IconLink, IconSpark } from './Icons';

interface InputViewProps {
  initialJob: Job | null;
  editing: boolean;
  resumeName?: string;
  onBack: () => void;
  onAnalyze: (job: Job) => void;
  onEditResume: () => void;
  showToast: (message: string) => void;
}

function createEmptyJob(): Job {
  return {
    id: uid('job'),
    name: '',
    link: '',
    rawText: '',
    extraction: 'pending',
    items: [],
  };
}

function cloneJob(job: Job): Job {
  return {
    ...job,
    items: job.items.map((item) => ({ ...item })),
  };
}

export function InputView({
  initialJob,
  editing,
  resumeName,
  onBack,
  onAnalyze,
  onEditResume,
  showToast,
}: InputViewProps) {
  const [job, setJob] = useState<Job>(() => (initialJob ? cloneJob(initialJob) : createEmptyJob()));
  const [inlineError, setInlineError] = useState('');
  const [pendingSample, setPendingSample] = useState<number | null>(null);
  const isEditing = editing;

  const update = (patch: Partial<Job>) => {
    setInlineError('');
    setJob((prev) => ({ ...prev, ...patch }));
  };

  const analyze = () => {
    if (!job.rawText.trim()) {
      const message = job.link?.trim()
        ? '只填写了来源链接。请把岗位描述正文粘贴到编辑框后再分析。'
        : '请粘贴岗位描述正文后再分析。';
      setInlineError(message);
      showToast(message);
      return;
    }
    setInlineError('');
    onAnalyze({
      ...job,
      name: normalizeName(job.name),
      link: job.link?.trim() || undefined,
      rawText: job.rawText.trim(),
    });
  };

  const loadSample = (index: number) => {
    const sample = createSampleJobs()[index];
    if (!sample) return;
    setJob({
      ...cloneJob(sample),
      id: uid('job'),
      isSample: true,
    });
    setInlineError('');
    showToast(`已载入示例岗位「${sample.name}」，可以直接分析。`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const requestSample = (index: number) => {
    if (job.rawText.trim()) {
      setPendingSample(index);
      return;
    }
    loadSample(index);
  };

  return (
    <main className="page input-page">
      <div className="page-head">
        <button className="text-btn" onClick={onBack}>
          <IconArrowLeft /> 回到首页
        </button>
        <div className="page-head-copy">
          <p className="eyebrow">{isEditing ? '修改岗位' : '输入岗位'}</p>
          <h1>{isEditing ? '更新这份 JD，再重新判断。' : '粘贴一份 JD，先看匹配在哪里。'}</h1>
          <p className="page-sub">
            当前版本一次分析一份岗位。保留可编辑的岗位名称、JD 正文和来源链接；提取与判断都在浏览器本地完成。
          </p>
        </div>
        <div className="head-actions">
          <button className="btn btn-ghost" onClick={onEditResume}>
            <IconEdit /> 简历
          </button>
        </div>
      </div>

      <div className="profile-callout">
        <div>
          <strong>简历：{resumeName || "尚未导入"}</strong>
          <span>导入后逐项查看简历证据。</span>
        </div>
        <button className="text-btn" onClick={onEditResume}>
          {resumeName ? '更换简历' : '导入简历'} <IconArrowRight size={13} />
        </button>
      </div>

      <section className="job-editor single-editor">
        <div className="job-editor-head">
          <span className="job-avatar tone-0">JD</span>
          <div className="job-editor-title">
            <label htmlFor="job-name">岗位名称（可编辑）</label>
            <input
              id="job-name"
              className="input input-name"
              value={job.name}
              onChange={(event) => update({ name: event.target.value })}
              placeholder="例如：校园活动数据分析实习生"
            />
          </div>
        </div>

        <div className="field-row">
          <label className="field">
            <span>
              来源链接（可选）
              <em>仅记录，不读取网页正文</em>
            </span>
            <input
              className="input"
              value={job.link ?? ''}
              onChange={(event) => update({ link: event.target.value })}
              placeholder="https://..."
              inputMode="url"
            />
          </label>
        </div>

        <label className="field">
          <span>
            岗位描述原文
            <em className={job.rawText.length > 1600 ? 'char-warn' : ''}>{job.rawText.length} 字</em>
          </span>
          <textarea
            className="input textarea jd-textarea"
            value={job.rawText}
            onChange={(event) => update({ rawText: event.target.value })}
            placeholder="例如：每周至少到岗 4 天，要求能对报名数据做分组去重；有 Python 经验优先。"
            rows={8}
          />
        </label>

        <div className="input-guidance">
          <span>
            <IconLink size={13} /> 来源链接不能代替 JD 正文；只填链接时不会开始分析。
          </span>
          {isEditing ? <span>重新分析会按当前原文更新提取项，手动更正需要重新补充。</span> : null}
        </div>

        {inlineError ? (
          <p className="inline-error" role="alert">
            {inlineError}
          </p>
        ) : null}

        <div className="input-analyze-row">
          <div className="sample-links">
            <span>没有现成 JD？</span>
            <button className="text-btn small" onClick={() => requestSample(0)}>
              <IconSpark size={12} /> 载入示例 A
            </button>
            <button className="text-btn small" onClick={() => requestSample(1)}>
              载入示例 B
            </button>
          </div>
          <button className="btn btn-primary btn-large" onClick={analyze}>
            分析岗位 <IconArrowRight size={16} />
          </button>
        </div>
      </section>

      {pendingSample !== null ? (
        <ConfirmDialog
          title="替换当前输入？"
          body="当前编辑框里的岗位描述会被示例内容替换。"
          confirmLabel="替换并载入"
          danger
          onCancel={() => setPendingSample(null)}
          onConfirm={() => {
            const index = pendingSample;
            setPendingSample(null);
            loadSample(index);
          }}
        />
      ) : null}
    </main>
  );
}
