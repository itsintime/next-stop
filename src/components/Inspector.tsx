import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExtractedItem, Job, Requirement, SqlType } from '../types';
import { locateQuote, uid } from '../utils';
import {
  categoryToFields,
  itemCategory,
  itemCategoryLabel,
  itemStatus,
  requirementOptions,
  type ItemCategory,
} from '../itemMeta';
import { sqlTypeLabel } from '../recommend';
import { ConfirmDialog } from './Modal';
import {
  IconAlert,
  IconCheck,
  IconEdit,
  IconPlus,
  IconQuote,
  IconRefresh,
  IconX,
} from './Icons';

interface InspectorProps {
  job: Job;
  itemId: string | null;
  initialMode?: 'view' | 'edit';
  startAdding?: boolean;
  onClose: () => void;
  onUpdateItem: (jobId: string, itemId: string, patch: Partial<ExtractedItem>) => void;
  onAddItem: (jobId: string, item: ExtractedItem) => void;
  onDeleteItem: (jobId: string, itemId: string) => void;
  onReextract: (jobId: string, mode: 'keep' | 'overwrite') => void;
  onEditRaw: () => void;
  showToast: (message: string) => void;
}

interface FormState {
  category: ItemCategory;
  requirement: Requirement;
  value: string;
  detail: string;
  qualifier: string;
  quote: string;
  sqlType: SqlType;
}

function formFromItem(item: ExtractedItem | null): FormState {
  if (!item) {
    return {
      category: 'skill',
      requirement: 'required',
      value: '',
      detail: '',
      qualifier: '',
      quote: '',
      sqlType: 'broad',
    };
  }
  return {
    category: itemCategory(item),
    requirement: item.requirement,
    value: item.value,
    detail: item.detail ?? '',
    qualifier: item.qualifier ?? '',
    quote: item.quote,
    sqlType: item.sqlType ?? 'broad',
  };
}

function statusBadgeClass(tone: 'ok' | 'warn' | 'manual'): string {
  return tone === 'ok' ? 'ok' : tone === 'warn' ? 'warn' : 'manual';
}

export function Inspector({
  job,
  itemId,
  initialMode = 'view',
  startAdding,
  onClose,
  onUpdateItem,
  onAddItem,
  onDeleteItem,
  onReextract,
  onEditRaw,
  showToast,
}: InspectorProps) {
  const item = job.items.find((entry) => entry.id === itemId) ?? null;
  const [mode, setMode] = useState<'view' | 'edit' | 'add'>(() =>
    startAdding ? 'add' : initialMode === 'edit' && item ? 'edit' : 'view',
  );
  const [form, setForm] = useState<FormState>(() => formFromItem(item));
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const activeMarkRef = useRef<HTMLElement | null>(null);
  const manualCount = job.items.filter((entry) => entry.manual).length;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      activeMarkRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [itemId]);

  const ranges = useMemo(() => {
    return job.items
      .map((entry) => {
        const location = locateQuote(job.rawText, entry.quote);
        if (!location) return null;
        return { ...location, itemId: entry.id };
      })
      .filter((entry): entry is { start: number; end: number; itemId: string } => entry !== null)
      .sort((a, b) => a.start - b.start || a.end - b.end);
  }, [job.items, job.rawText]);

  const activeRange = item ? locateQuote(job.rawText, item.quote) : null;

  const highlighted = useMemo(() => {
    if (ranges.length === 0) return [job.rawText];
    const boundaries = new Set<number>([0, job.rawText.length]);
    for (const range of ranges) {
      boundaries.add(range.start);
      boundaries.add(range.end);
    }
    const points = Array.from(boundaries).sort((a, b) => a - b);
    const parts: { text: string; highlighted: boolean; active: boolean; key: string }[] = [];
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      if (start === end) continue;
      const covered = ranges.some((range) => range.start <= start && range.end >= end);
      const active = Boolean(activeRange && activeRange.start <= start && activeRange.end >= end);
      parts.push({
        text: job.rawText.slice(start, end),
        highlighted: covered,
        active,
        key: `${start}-${end}`,
      });
    }
    return parts;
  }, [job.rawText, ranges, activeRange?.start, activeRange?.end]);

  const quoteFound = item ? locateQuote(job.rawText, item.quote) !== null : false;
  const formQuoteFound = form.quote.trim() ? job.rawText.includes(form.quote.trim()) : false;
  const formCategory = form.category;
  const formIsSql = form.category === 'skill' && /sql/i.test(form.value);

  const beginEdit = () => {
    setForm(formFromItem(item));
    setMode('edit');
  };

  const beginAdd = () => {
    setForm(formFromItem(null));
    setMode('add');
  };

  const updateForm = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const changeCategory = (category: ItemCategory) => {
    const options = requirementOptions(category);
    const currentValid = options.some((option) => option.value === form.requirement);
    const requirement = currentValid ? form.requirement : options[0].value;
    const qualifier =
      (category === 'skill' && requirement === 'preferred') || (category === 'graduation' && requirement === 'preferred')
        ? form.qualifier || '优先'
        : form.qualifier;
    setForm((prev) => ({ ...prev, category, requirement, qualifier }));
  };

  const changeRequirement = (requirement: Requirement) => {
    const qualifier =
      (form.category === 'skill' && requirement === 'preferred') ||
      (form.category === 'graduation' && requirement === 'preferred')
        ? form.qualifier || '优先'
        : form.qualifier;
    setForm((prev) => ({ ...prev, requirement, qualifier }));
  };

  const buildPatch = (): Partial<ExtractedItem> => {
    const fields = categoryToFields(form.category, form.requirement);
    const sqlType = formIsSql ? form.sqlType : undefined;
    return {
      ...fields,
      value: form.value.trim(),
      detail: form.detail.trim() || undefined,
      qualifier: form.qualifier.trim() || undefined,
      quote: form.quote.trim(),
      sqlType,
      manual: true,
      source: 'manual',
      uncertain: false,
    };
  };

  const saveForm = () => {
    if (!form.value.trim()) {
      showToast('请先填写要展示的内容。');
      return;
    }
    if (mode === 'add') {
      const newItem: ExtractedItem = {
        id: uid('manual'),
        field: 'skill',
        value: '',
        requirement: 'required',
        quote: '',
        manual: true,
        source: 'manual',
        ...buildPatch(),
      };
      onAddItem(job.id, newItem);
      showToast(formQuoteFound ? '已补充一项，并定位到原文。' : '已补充一项；引用为空或未匹配，会显示「待确认」。');
      onClose();
      return;
    }
    if (item) {
      onUpdateItem(job.id, item.id, buildPatch());
      showToast(formQuoteFound ? '已保存手动修改，引用已在原文中定位。' : '已保存手动修改；引用未匹配，会显示「待确认」。');
      setMode('view');
    }
  };

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label="原文核对">
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="inspector">
        <div className="inspector-head">
          <div>
            <p className="eyebrow">原文核对</p>
            <h2>{job.name || '未命名岗位'}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭原文核对">
            <IconX />
          </button>
        </div>

        <div className="inspector-body">
          {job.extraction === 'failed' ? (
            <div className="inspector-banner danger">
              <IconAlert size={16} />
              <div>
                <strong>提取失败，原文已保留。</strong>
                <p>{job.extractionError ?? '可以重试提取，或手动补充要求。'}</p>
                <div className="banner-actions">
                  <button className="text-btn small" onClick={() => onReextract(job.id, 'keep')}>
                    重试提取
                  </button>
                  <button className="text-btn small" onClick={beginAdd}>
                    手动补充
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {mode === 'view' && item ? (
            <section className="inspect-item-card">
              <div className="inspect-item-top">
                <span className="category-chip">{itemCategoryLabel(item)}</span>
                {(() => {
                  const status = itemStatus(job, item);
                  return (
                    <span className={`verify-badge large tone-${statusBadgeClass(status.tone)}`} title={status.title}>
                      {status.tone === 'ok' ? <IconCheck size={12} /> : <IconAlert size={12} />}
                      {status.label}
                    </span>
                  );
                })()}
              </div>
              <div className="inspect-value">
                {item.value}
                {item.qualifier ? <span className="tag tag-qualifier">{item.qualifier}</span> : null}
                {item.requirement === 'preferred' ? <span className="tag tag-preferred">优先</span> : null}
                {item.requirement === 'required' ? <span className="tag tag-required">必需</span> : null}
              </div>
              {item.detail ? <p className="inspect-detail">{item.detail}</p> : null}
              {item.sqlType ? <p className="inspect-detail">SQL 任务：{sqlTypeLabel(item.sqlType)}</p> : null}
              <div className={`quote-box ${quoteFound ? 'found' : 'missing'}`}>
                <div className="quote-box-label">
                  <IconQuote size={13} />
                  支持结论的原文片段
                </div>
                <blockquote>{item.quote || '（未填写引用）'}</blockquote>
                <p>
                  {quoteFound
                    ? '已在下方原文中高亮定位。'
                    : '引用匹配失败：原文中找不到这段引用，因此显示「待确认」。'}
                </p>
              </div>
              <div className="inspect-actions">
                <button className="btn btn-small btn-primary" onClick={beginEdit}>
                  <IconEdit size={14} /> 修改此项
                </button>
                <button className="btn btn-small btn-ghost" onClick={beginAdd}>
                  <IconPlus size={14} /> 补充一项
                </button>
              </div>
            </section>
          ) : null}

          {mode === 'view' && !item ? (
            <section className="inspect-empty">
              <IconQuote size={18} />
              <p>点击任意提取项可查看它的原文片段。带高亮的部分是当前提取结果引用的原文。</p>
            </section>
          ) : null}

          {mode !== 'view' ? (
            <section className="inspect-form">
              <div className="inspect-form-head">
                <h3>{mode === 'add' ? '补充一项要求' : '修改提取项'}</h3>
                <button className="text-btn small" onClick={() => setMode('view')}>
                  取消
                </button>
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>归类</span>
                  <select
                    className="input"
                    value={formCategory}
                    onChange={(event) => changeCategory(event.target.value as ItemCategory)}
                  >
                    <option value="graduation">毕业届别</option>
                    <option value="education">学历要求</option>
                    <option value="enrollment">在校状态</option>
                    <option value="major">相关专业</option>
                    <option value="days">每周到岗</option>
                    <option value="duration">连续实习</option>
                    <option value="skill">技能</option>
                    <option value="task">岗位任务</option>
                    <option value="duty">实习职责</option>
                  </select>
                </label>
                <label className="field">
                  <span>属性</span>
                  <select
                    className="input"
                    value={form.requirement}
                    onChange={(event) => changeRequirement(event.target.value as Requirement)}
                  >
                    {requirementOptions(formCategory).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field">
                <span>显示内容</span>
                <input
                  className="input"
                  value={form.value}
                  onChange={(event) => updateForm({ value: event.target.value })}
                  placeholder="例如：SQL、Python、每周至少到岗 3 天"
                />
              </label>
              {formCategory === 'days' || formCategory === 'duration' ? (
                <p className="form-judge-note">
                  对照判断会读取这里填写的天数或月数；更正后旧值不再参与比较，原文仍保留在下方。
                </p>
              ) : null}

              <div className="form-grid">
                <label className="field">
                  <span>限定词（可选）</span>
                  <input
                    className="input"
                    value={form.qualifier}
                    onChange={(event) => updateForm({ qualifier: event.target.value })}
                    placeholder="例如：至少、优先"
                  />
                </label>
                <label className="field">
                  <span>补充说明（可选）</span>
                  <input
                    className="input"
                    value={form.detail}
                    onChange={(event) => updateForm({ detail: event.target.value })}
                    placeholder="例如：多表连接"
                  />
                </label>
              </div>

              {formIsSql ? (
                <label className="field">
                  <span>SQL 任务类型（决定推荐哪道题）</span>
                  <select
                    className="input"
                    value={form.sqlType}
                    onChange={(event) => updateForm({ sqlType: event.target.value as SqlType })}
                  >
                    <option value="broad">JD 未说明具体任务（基础自测）</option>
                    <option value="basic">基础查询</option>
                    <option value="dedupe">分组去重</option>
                    <option value="join">多表连接</option>
                    <option value="unsupported">进阶 SQL（暂无对应题目）</option>
                  </select>
                </label>
              ) : null}

              <label className="field">
                <span>原文引用（用于定位核对）</span>
                <textarea
                  className="input textarea"
                  value={form.quote}
                  onChange={(event) => updateForm({ quote: event.target.value })}
                  rows={3}
                  placeholder="从下方原文中复制支持该结论的片段"
                />
              </label>
              <p className={`form-quote-state ${formQuoteFound ? 'ok' : 'warn'}`}>
                {form.quote.trim()
                  ? formQuoteFound
                    ? '已在原文中定位到这段引用。'
                    : '这段引用在原文中找不到，保存后会显示「待确认」。'
                  : '未填写引用；保存后会显示「待确认」，但仍可手动补充。'}
              </p>

              <div className="inspect-actions">
                <button className="btn btn-small btn-primary" onClick={saveForm}>
                  {mode === 'add' ? '添加这一项' : '保存修改'}
                </button>
                {mode === 'edit' && item ? (
                  <button className="text-btn small danger-text" onClick={() => setConfirmDelete(true)}>
                    删除此项
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="raw-section">
            <div className="raw-head">
              <h3>岗位原文</h3>
              <span>{job.rawText.length} 字</span>
            </div>
            <div className="raw-text">
              {typeof highlighted[0] === 'string' ? (
                <p>{job.rawText}</p>
              ) : (
                <p>
                  {highlighted.map((part) =>
                    typeof part === 'string' ? (
                      <span key={part}>{part}</span>
                    ) : (
                      <mark
                        key={part.key}
                        ref={
                          part.active
                            ? (node) => {
                                activeMarkRef.current = node;
                              }
                            : undefined
                        }
                        className={`quote-mark ${part.highlighted ? 'found' : ''} ${part.active ? 'active' : ''}`}
                      >
                        {part.text}
                      </mark>
                    ),
                  )}
                </p>
              )}
            </div>
          </section>

          <div className="inspector-tools">
            <button className="btn btn-small btn-ghost" onClick={onEditRaw}>
              <IconEdit size={14} /> 编辑岗位原文
            </button>
            <button className="btn btn-small btn-ghost" onClick={() => onReextract(job.id, 'keep')}>
              <IconRefresh size={14} /> 重新提取（保留修正）
            </button>
            {manualCount > 0 ? (
              <button className="text-btn small danger-text" onClick={() => setConfirmOverwrite(true)}>
                覆盖全部修正
              </button>
            ) : null}
          </div>

        </div>
      </aside>

      {confirmOverwrite ? (
        <ConfirmDialog
          title="覆盖全部手动修正？"
          body={`这会丢弃 ${manualCount} 项手动修改，并用当前原文重新提取。此操作不可撤销。`}
          confirmLabel="覆盖并重新提取"
          danger
          onCancel={() => setConfirmOverwrite(false)}
          onConfirm={() => {
            setConfirmOverwrite(false);
            onReextract(job.id, 'overwrite');
          }}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="删除这一项？"
          body="删除后可以从原文重新提取，或再次手动补充。"
          confirmLabel="删除"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            if (item) onDeleteItem(job.id, item.id);
            setConfirmDelete(false);
            onClose();
          }}
        />
      ) : null}
    </div>
  );
}
