import { useState } from 'react';
import type { ExtractedItem, FitResult, Job, Scenario } from '../types';
import { formatSupplement } from '../../mode/resume-supplement';
import { IconAlert, IconArrowLeft, IconCheck, IconQuote, IconSpark } from './Icons';

interface ScenarioViewProps {
  job: Job;
  item: ExtractedItem;
  scenario: Scenario;
  result: FitResult | null;
  onBack: () => void;
}

export function ScenarioView({ job, item, scenario, result, onBack }: ScenarioViewProps) {
  const [answer, setAnswer] = useState('');
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const hasResumeEvidence = Boolean(result && result.profileValue !== '暂无简历证据');

  return (
    <main className="page scenario-page">
      <div className="practice-head">
        <button className="text-btn" onClick={onBack}>
          <IconArrowLeft /> 返回岗位
        </button>
        <div className="practice-title-row">
          <div>
            <div className="practice-badges">
              <span className="tag tag-required">开放场景题</span>
              <span className="tag tag-preferred">不自动打分</span>
              <span className="tag">{scenario.discipline}</span>
              <span className="tag">难度：{scenario.difficulty}</span>
            </div>
            <h1>{scenario.title}</h1>
            <p className="page-sub">先把思路写下来，再对照参考框架和评价要点自查；这里不评判对错。</p>
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

      <div className="scenario-layout">
        <div className="scenario-main">
          <section className="panel scenario-question">
            <div className="panel-head">
              <h2>
                <IconSpark size={17} /> 场景问题
              </h2>
              <span className="panel-note">开放题 · 无自动评分</span>
            </div>
            <p>{scenario.prompt}</p>
            <label className="field">
              <span>你的思路（可选）</span>
              <textarea
                className="input textarea"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                rows={7}
                placeholder="可以从目标、判断依据、验证方法三个方向展开。"
              />
            </label>
            <div className="scenario-actions">
              <button className="btn btn-primary" onClick={() => setShowEvaluation(true)}>
                {showEvaluation ? '重新查看评价要点' : '提交并查看评价要点'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowReference(true)}>
                {showReference ? '重新查看参考思路' : '查看参考思路'}
              </button>
              <span>提交只用于自查，不自动打分。</span>
            </div>
          </section>

          <section className="link-card">
            <div className="link-card-head">
              <IconQuote size={15} />
              <span>对应 JD 原句</span>
            </div>
            {result ? (
              <>
                <blockquote>{result.quote || result.requirement}</blockquote>
                <dl className="practice-basis">
                  <div>
                    <dt>对应能力</dt>
                    <dd>{result.label}</dd>
                  </div>
                  <div>
                    <dt>简历证据</dt>
                    <dd>
                      {hasResumeEvidence ? (
                        <span className="scenario-evidence-line">
                          <span className="tag tag-resume">简历原文</span>
                          <span>{result.profileValue}</span>
                        </span>
                      ) : (
                        <span>暂无简历证据</span>
                      )}
                      {result.supplement ? (
                        <span className="scenario-evidence-line">
                          <span className="tag tag-user">用户补充</span>
                          <span>{formatSupplement(result.supplement)}</span>
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt>为什么推荐</dt>
                    <dd>{result.reason}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <div className="scenario-missing" role="status">
                无法确认这条要求对应的匹配行，请返回岗位页重新选择练习。
              </div>
            )}
          </section>

          {showEvaluation ? (
            <section className="panel scenario-evaluation">
              <div className="panel-head">
                <h2>
                  <IconCheck size={17} /> 评价要点
                </h2>
                <span className="panel-note">分点自查 · 不是唯一答案</span>
              </div>
              <ol className="scenario-reference">
                {scenario.evaluationPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ol>
              {scenario.followUps.length > 0 ? (
                <div className="scenario-followups">
                  <h3>可以继续追问自己</h3>
                  <ul>
                    {scenario.followUps.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="scenario-source">来源：{scenario.sourceNote}</p>
            </section>
          ) : null}

          {showReference ? (
            <>
              <section className="panel">
                <div className="panel-head">
                  <h2>
                    <IconCheck size={17} /> 参考思路
                  </h2>
                  <span className="panel-note">不是唯一答案</span>
                </div>
                <ol className="scenario-reference">
                  {scenario.referencePoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ol>
              </section>
              <section className="panel scenario-selfcheck">
                <div className="panel-head">
                  <h2>
                    <IconAlert size={17} /> 自查要点
                  </h2>
                </div>
                <ul>
                  {scenario.selfCheck.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </section>
              <p className="scenario-source">来源：{scenario.sourceNote}</p>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}