import type { CapabilityAnswer, FavoriteEntry, Job, PracticeRecord, Profile } from '../types';
import { recommendForJob } from '../recommend';
import { formatDate, getPractice, practiceLabel } from '../utils';
import { IconArrowLeft, IconArrowRight, IconEdit, IconFlag, IconSpark, IconX } from './Icons';

interface FavoritesViewProps {
  jobs: Job[];
  favorites: Record<string, FavoriteEntry>;
  profile: Profile;
  evaluateResume: (job: Job) => import('../types').FitEvaluation;
  practice: Record<string, PracticeRecord>;
  onBack: () => void;
  onOpenJob: (jobId: string) => void;
  onRemoveFavorite: (jobId: string) => void;
  onNote: (jobId: string, note: string) => void;
  onPaste: () => void;
  onEditProfile: () => void;
}

export function FavoritesView({
  jobs,
  favorites,
  profile,
  evaluateResume,
  practice,
  onBack,
  onOpenJob,
  onRemoveFavorite,
  onNote,
  onPaste,
  onEditProfile,
}: FavoritesViewProps) {
  const entries = Object.entries(favorites)
    .map(([jobId, favorite]) => ({ job: jobs.find((entry) => entry.id === jobId), favorite }))
    .filter((entry): entry is { job: Job; favorite: FavoriteEntry } => Boolean(entry.job))
    .sort((left, right) => right.favorite.savedAt.localeCompare(left.favorite.savedAt));

  return (
    <main className="page favorites-page">
      <div className="page-head">
        <button className="text-btn" onClick={onBack}>
          <IconArrowLeft /> 回到首页
        </button>
        <div className="page-head-copy">
          <p className="eyebrow">收藏岗位</p>
          <h1>把值得继续看的岗位留在这里。</h1>
          <p className="page-sub">
            收藏由你主动决定。列表只保存岗位、备注和练习记录，不会自动投递或上传。
          </p>
        </div>
        <div className="head-actions">
          <button className="btn btn-ghost" onClick={onEditProfile}>
            <IconEdit /> 导入简历
          </button>
          <button className="btn btn-primary" onClick={onPaste}>
            分析新岗位 <IconArrowRight size={15} />
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <section className="empty-favorites">
          <span className="empty-icon">
            <IconFlag size={22} />
          </span>
          <h2>还没有收藏岗位</h2>
          <p>先粘贴一份 JD 并完成分析；只有你主动点「收藏岗位」后，它才会出现在这里。</p>
          <button className="btn btn-primary" onClick={onPaste}>
            去分析一份 JD
          </button>
        </section>
      ) : (
        <>
          <div className="favorites-summary">
            <span>
              已收藏 <strong>{entries.length}</strong> 个岗位
            </span>
            <span>备注自动保存在当前浏览器</span>
          </div>
          <div className="favorites-grid">
            {entries.map(({ job, favorite }) => {
              const evaluation = evaluateResume(job);
              const recommendation = recommendForJob(job, profile, evaluation);
              const record = recommendation.questionId
                ? getPractice(practice, job.id, recommendation.questionId)
                : undefined;
              return (
                <article className="favorite-item" key={job.id}>
                  <div className="favorite-item-head">
                    <div>
                      <span className="favorite-date">收藏于 {formatDate(favorite.savedAt) || '本地'}</span>
                      <h2>{job.name}</h2>
                    </div>
                    <span className="mini-tag passed">
                      <IconFlag size={10} /> 已收藏
                    </span>
                  </div>

                  <p className="favorite-headline">{evaluation.headline}</p>

                  <div className="favorite-meta">
                    <span className="mini-tag">提取 {job.items.length} 项</span>
                    {job.items.some((item) => item.manual) ? <span className="mini-tag manual">有手动修正</span> : null}
                    {recommendation.questionId || recommendation.scenario ? (
                      <span className="mini-tag">
                        <IconSpark size={10} /> {recommendation.label}
                      </span>
                    ) : (
                      <span className="mini-tag">暂无对应练习</span>
                    )}
                    {record ? (
                      <span className={`status-pill ${record.status === 'passed' ? 'passed' : 'attempted'}`}>
                        {practiceLabel(record)}
                      </span>
                    ) : null}
                  </div>

                  <label className="field favorite-note">
                    <span>
                      我的看法（可选）
                      <em>自动保存</em>
                    </span>
                    <textarea
                      className="input textarea"
                      value={favorite.note}
                      onChange={(event) => onNote(job.id, event.target.value)}
                      placeholder="例如：值班时间待确认，SQL 去重要补"
                      rows={2}
                    />
                  </label>

                  <div className="favorite-item-actions">
                    <button className="btn btn-small btn-primary" onClick={() => onOpenJob(job.id)}>
                      重新打开岗位 <IconArrowRight size={13} />
                    </button>
                    <button className="text-btn small danger-text" onClick={() => onRemoveFavorite(job.id)}>
                      <IconX size={12} /> 取消收藏
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
