import type { Job } from '../types';
import { createSampleJobs } from '../data/samples';
import { IconArrowRight, IconCheck, IconEdit, IconFlag, IconLock, IconSpark, IconTable } from './Icons';

interface LandingViewProps {
  savedJob: Job | null;
  favoritesCount: number;
  resumeName?: string;
  onPaste: () => void;
  onLoadSample: () => void;
  onContinue: () => void;
  onOpenFavorites: () => void;
  onEditProfile: () => void;
}

export function LandingView({
  savedJob,
  favoritesCount,
  resumeName,
  onPaste,
  onLoadSample,
  onContinue,
  onOpenFavorites,
  onEditProfile,
}: LandingViewProps) {
  const sample = createSampleJobs()[0];

  return (
    <main className="landing">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-line" />
            STUDYHACK · 学习科研
          </p>
          <h1 className="hero-title">下一站</h1>
          <p className="hero-subtitle">
            粘贴一份 JD，看清匹配、差距和下一步练什么。
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-large" onClick={onPaste}>
              粘贴一份岗位描述 <IconArrowRight size={16} />
            </button>
            <button className="btn btn-ghost btn-large" onClick={onLoadSample}>
              载入示例 JD
            </button>
          </div>
          <div className="hero-meta">
            <span>
              <IconLock size={13} /> 本地保存
            </span>
            <span>一次分析一份岗位</span>
            <span>无需登录</span>
            <span>不做网页抓取</span>
          </div>

          {savedJob || favoritesCount > 0 ? (
            <div className="home-resume">
              {savedJob ? (
                <div className="saved-banner">
                  <div>
                    <span className="saved-label">上次分析</span>
                    <strong>{savedJob.name}</strong>
                  </div>
                  <button className="text-btn" onClick={onContinue}>
                    继续看 <IconArrowRight size={14} />
                  </button>
                </div>
              ) : null}
              {favoritesCount > 0 ? (
                <button className="favorites-shortcut" onClick={onOpenFavorites}>
                  <IconFlag size={14} />
                  收藏列表
                  <strong>{favoritesCount}</strong>
                  <IconArrowRight size={13} />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="visual-note">一份 JD → 逐项对照 → 自己决定</div>
          <div className="hero-analysis-card">
            <div className="hero-analysis-head">
              <span className="job-avatar tone-0">A</span>
              <div>
                <h3>{sample.name}</h3>
                <span>内置虚构示例</span>
              </div>
              <span className="mini-tag">示例</span>
            </div>
            <div className="hero-analysis-overview">
              <span>适配总览</span>
              <strong>到岗要求不满足；有 1 项 SQL 能力待补强。</strong>
            </div>
            <div className="hero-fit-row">
              <span className="hero-fit-label">每周到岗</span>
              <span className="hero-fit-value">简历未写到岗时间</span>
              <span className="verdict-pill unmet">无法确认</span>
            </div>
            <div className="hero-fit-row">
              <span className="hero-fit-label">SQL · 分组去重</span>
              <span className="hero-fit-value">简历只提到 SQL</span>
              <span className="verdict-pill unmet">仅提及</span>
            </div>
            <div className="hero-fit-row">
              <span className="hero-fit-label">Python</span>
              <span className="hero-fit-value">岗位：优先</span>
              <span className="verdict-pill bonus">加分项</span>
            </div>
            <div className="hero-analysis-foot">
              <span>
                <IconCheck size={12} /> 原句可回看
              </span>
              <span>不计算无依据的分数</span>
            </div>
          </div>
          <div className="visual-float">
            <IconSpark size={14} />
            收藏后推荐练习 · 回到岗位看进度
          </div>
        </div>
      </section>

      <section className="home-profile-strip">
        <div>
          <span className="home-strip-label">简历</span>
          <strong>{resumeName || '尚未导入简历'}</strong>
          <span className="home-strip-sub">
            支持 TXT、DOCX、PDF，也可粘贴文字
          </span>
        </div>
        <button className="btn btn-ghost btn-small" onClick={onEditProfile}>
          <IconEdit size={14} /> 导入或更换简历
        </button>
      </section>

      <section className="steps">
        <article>
          <span className="step-number">01</span>
          <IconTable size={19} />
          <h2>粘贴单份 JD</h2>
          <p>名称、正文和来源链接都可编辑。来源链接只做记录，不会代替正文，也不会自动抓取。</p>
        </article>
        <article>
          <span className="step-number">02</span>
          <IconSpark size={19} />
          <h2>对照简历</h2>
          <p>逐条展示 JD 原句和简历证据，没有证据时不做结论。</p>
        </article>
        <article>
          <span className="step-number">03</span>
          <IconCheck size={19} />
          <h2>收藏并练短板</h2>
          <p>分析不会自动收藏。收藏后才推荐 SQL 或岗位场景练习，题卡会说明原句、练什么和为什么推荐。</p>
        </article>
      </section>

      <section className="scope-strip">
        <div>
          <span>本轮范围</span>
          <strong>单岗位分析</strong>
        </div>
        <div>
          <span>原创练习</span>
          <strong>SQL 题与岗位场景题</strong>
        </div>
        <div>
          <span>判断依据</span>
          <strong>明确规则 + 原文</strong>
        </div>
        <div>
          <span>数据保存</span>
          <strong>当前浏览器</strong>
        </div>
      </section>
    </main>
  );
}
