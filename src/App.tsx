import { useEffect, useMemo, useState } from 'react';
import type {
  CapabilityAnswer,
  ExtractedItem,
  FavoriteEntry,
  GradeReport,
  Job,
  PersistedState,
  Phase,
  PracticeRecord,
  Profile,
  Question,
  QuestionId,
  SelfLevel,
} from './types';
import { createSampleJobs } from './data/samples';
import { QUESTIONS } from './data/questions';
import { extractItems } from './extract/extract';
import { recommendForJob } from './recommend';
import { scenarioForCapability } from '../mode/practice-bank';
import { practiceKey, uid } from './utils';
import { LandingView } from './components/LandingView';
import { InputView } from './components/InputView';
import { JobView } from './components/JobView';
import { FavoritesView } from './components/FavoritesView';
import { ResumeDialog } from './components/ResumeDialog';
import { readSavedResume, saveResume, type ConfirmedResume } from '../mode/resume-import';
import { evaluateMatchSession, findMatchResultForItem, matchInputKey, saveSessionSupplement } from '../mode/match-session';
import type { SupplementKind } from '../mode/resume-supplement';
import { Inspector } from './components/Inspector';
import { PracticeView } from './components/PracticeView';
import { ScenarioView } from './components/ScenarioView';
import { AdminWorkbench } from './components/AdminWorkbench';
import { BrandMark, IconFlag, IconLock } from './components/Icons';

const STORAGE_KEY = 'jd-sql-assistant:state:v2';
const IS_DEV = import.meta.env.DEV;

const DEFAULT_PROFILE: Profile = {
  graduation: '',
  days: '',
  duration: '',
  sql: { basic: '', dedupe: '', join: '' },
};

function defaultState(): PersistedState {
  return {
    version: 3,
    jobs: [],
    currentJobId: null,
    favorites: {},
    practice: {},
    profile: { ...DEFAULT_PROFILE, sql: { ...DEFAULT_PROFILE.sql } },
    capabilityAnswers: {},
  };
}

function isSelfLevel(value: unknown): value is SelfLevel {
  return value === '' || value === 'none' || value === 'aware' || value === 'independent';
}

function normalizeProfile(value: unknown): Profile {
  const input = value && typeof value === 'object' ? (value as Partial<Profile>) : {};
  const sql =
    input.sql && typeof input.sql === 'object'
      ? (input.sql as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  return {
    graduation: typeof input.graduation === 'string' ? input.graduation : '',
    days: typeof input.days === 'string' ? input.days : '',
    duration: typeof input.duration === 'string' ? input.duration : '',
    sql: {
      basic: isSelfLevel(sql.basic) ? sql.basic : '',
      dedupe: isSelfLevel(sql.dedupe) ? sql.dedupe : '',
      join: isSelfLevel(sql.join) ? sql.join : '',
    },
  };
}

function loadPersisted(): PersistedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const version = (parsed as { version?: number }).version;
    if ((version !== 2 && version !== 3) || !Array.isArray(parsed.jobs)) {
      return defaultState();
    }
    const jobs: Job[] = parsed.jobs
      .filter((job): job is Job => Boolean(job && typeof job.id === 'string' && typeof job.rawText === 'string'))
      .map((job) => ({
        ...job,
        name: job.name || '未命名岗位',
        link: typeof job.link === 'string' ? job.link : undefined,
        items: Array.isArray(job.items) ? job.items : [],
        extraction: job.extraction === 'failed' ? 'failed' : job.extraction === 'ok' ? 'ok' : 'pending',
        needsReverify: false,
      }));
    const jobIds = new Set(jobs.map((job) => job.id));
    const favorites: Record<string, FavoriteEntry> = {};
    if (parsed.favorites && typeof parsed.favorites === 'object') {
      for (const [jobId, value] of Object.entries(parsed.favorites)) {
        if (!jobIds.has(jobId) || !value || typeof value !== 'object') continue;
        favorites[jobId] = {
          note: typeof value.note === 'string' ? value.note : '',
          savedAt: typeof value.savedAt === 'string' ? value.savedAt : new Date().toISOString(),
        };
      }
    }
    const practice: Record<string, PracticeRecord> = {};
    if (parsed.practice && typeof parsed.practice === 'object') {
      for (const [key, value] of Object.entries(parsed.practice)) {
        if (value && typeof value === 'object' && jobIds.has(value.jobId)) {
          practice[key] = value;
        }
      }
    }
    const capabilityAnswers: Record<string, CapabilityAnswer> = {};
    if (parsed.capabilityAnswers && typeof parsed.capabilityAnswers === 'object') {
      for (const [key, value] of Object.entries(parsed.capabilityAnswers)) {
        if (!value || typeof value !== 'object' || !isSelfLevel(value.level)) continue;
        capabilityAnswers[key] = {
          level: value.level,
          updatedAt:
            typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
        };
      }
    }
    return {
      version: 3,
      jobs,
      currentJobId:
        typeof parsed.currentJobId === 'string' && jobIds.has(parsed.currentJobId)
          ? parsed.currentJobId
          : null,
      favorites,
      practice,
      profile: normalizeProfile(parsed.profile),
      capabilityAnswers,
    };
  } catch {
    return defaultState();
  }
}

function extractSafely(rawText: string): { items: ExtractedItem[]; error?: string } {
  try {
    return { items: extractItems(rawText) };
  } catch (error) {
    return {
      items: [],
      error: `提取失败：${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

interface ToastState {
  id: number;
  message: string;
}

interface InputSeed {
  key: string;
  job: Job | null;
  editing: boolean;
}

interface InspectorState {
  jobId: string;
  itemId: string | null;
  mode: 'view' | 'edit';
  add?: boolean;
}

interface PracticeContext {
  jobId: string;
  questionId: QuestionId;
  itemId: string;
}

interface ScenarioContext {
  jobId: string;
  itemId: string;
}

export default function App() {
  const [state, setState] = useState<PersistedState>(loadPersisted);
  const [view, setView] = useState<Phase>('landing');
  const [resume, setResume] = useState<ConfirmedResume | null>(readSavedResume);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [, setSupplementRevision] = useState(0);
  const evaluateResume = (job: Job) => evaluateMatchSession(job, resume?.text ?? '');
  const openResume = () => setResumeOpen(true);
  const [inputSeed, setInputSeed] = useState<InputSeed | null>(null);
  const [inspector, setInspector] = useState<InspectorState | null>(null);
  const [practiceContext, setPracticeContext] = useState<PracticeContext | null>(null);
  const [scenarioContext, setScenarioContext] = useState<ScenarioContext | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Local storage may be unavailable in private browsing; the app still works in memory.
    }
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string) => setToast({ id: Date.now(), message });

  const currentJob = useMemo(
    () => state.jobs.find((job) => job.id === state.currentJobId) ?? null,
    [state.currentJobId, state.jobs],
  );
  const favoritesCount = useMemo(
    () =>
      Object.keys(state.favorites).filter((jobId) => state.jobs.some((job) => job.id === jobId)).length,
    [state.favorites, state.jobs],
  );

  const goHome = () => {
    setView('landing');
    setInspector(null);
    setPracticeContext(null);
    setScenarioContext(null);
    setInputSeed(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openNewInput = () => {
    setInputSeed({ key: `new-${Date.now()}`, job: null, editing: false });
    setView('input');
    setInspector(null);
    setPracticeContext(null);
    setScenarioContext(null);
    window.scrollTo({ top: 0 });
  };

  const openSample = () => {
    const sample = createSampleJobs()[0];
    setInputSeed({
      key: `sample-${Date.now()}`,
      job: sample ? { ...sample, id: uid('job'), items: sample.items.map((item) => ({ ...item })) } : null,
      editing: false,
    });
    setView('input');
    setInspector(null);
    setPracticeContext(null);
    setScenarioContext(null);
    window.scrollTo({ top: 0 });
  };

  const openEditCurrent = () => {
    if (!currentJob) return;
    setInputSeed({
      key: `edit-${currentJob.id}-${Date.now()}`,
      job: currentJob,
      editing: true,
    });
    setView('input');
    setInspector(null);
    setPracticeContext(null);
    setScenarioContext(null);
    window.scrollTo({ top: 0 });
  };

  const backFromInput = () => {
    setInputSeed(null);
    if (currentJob) {
      setView('analysis');
    } else {
      setView('landing');
    }
    window.scrollTo({ top: 0 });
  };

  const openFavorites = () => {
    setView('favorites');
    setInspector(null);
    setPracticeContext(null);
    setScenarioContext(null);
    window.scrollTo({ top: 0 });
  };

  const openJob = (jobId: string) => {
    setState((prev) => ({ ...prev, currentJobId: jobId }));
    setView('analysis');
    setInspector(null);
    setPracticeContext(null);
    setScenarioContext(null);
    window.scrollTo({ top: 0 });
  };

  const openCurrent = () => {
    if (!currentJob) return;
    setView('analysis');
    setInspector(null);
    setPracticeContext(null);
    setScenarioContext(null);
    window.scrollTo({ top: 0 });
  };

  const handleAnalyze = (draft: Job) => {
    const existing = state.jobs.find((job) => job.id === draft.id);
    const rawChanged = existing ? existing.rawText !== draft.rawText : true;
    const extraction = !existing || rawChanged ? extractSafely(draft.rawText) : null;
    const items = extraction ? extraction.items : existing?.items ?? [];
    const nextJob: Job = {
      ...draft,
      items,
      extraction: extraction
        ? extraction.error
          ? 'failed'
          : 'ok'
        : existing?.extraction ?? 'pending',
      extractionError: extraction ? extraction.error : existing?.extractionError,
      needsReverify: false,
      isSample: Boolean(draft.isSample),
    };
    const evaluation = evaluateResume(nextJob);
    const lostManual =
      existing && rawChanged ? existing.items.filter((item) => item.manual).length : 0;

    setState((prev) => {
      const exists = prev.jobs.some((job) => job.id === nextJob.id);
      return {
        ...prev,
        jobs: exists
          ? prev.jobs.map((job) => (job.id === nextJob.id ? nextJob : job))
          : [nextJob, ...prev.jobs],
        currentJobId: nextJob.id,
      };
    });
    setInputSeed(null);
    setView('analysis');
    setInspector(null);
    setPracticeContext(null);
    setScenarioContext(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (nextJob.extraction === 'failed') {
      showToast('岗位已保存，但提取失败；可在分析页重试或手动补充。');
    } else if (lostManual > 0) {
      showToast(`JD 原文已更新并重新提取；${lostManual} 项旧的手动更正未保留。`);
    } else {
      showToast(`分析完成：${evaluation.headline}`);
    }
  };

  const handleUpdateItem = (jobId: string, itemId: string, patch: Partial<ExtractedItem>) => {
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              items: job.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
            }
          : job,
      ),
    }));
  };

  const handleAddItem = (jobId: string, item: ExtractedItem) => {
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((job) =>
        job.id === jobId ? { ...job, items: [...job.items, item] } : job,
      ),
    }));
  };

  const handleDeleteItem = (jobId: string, itemId: string) => {
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((job) =>
        job.id === jobId ? { ...job, items: job.items.filter((item) => item.id !== itemId) } : job,
      ),
    }));
    showToast('已删除该项。');
  };

  const handleReextract = (jobId: string, mode: 'keep' | 'overwrite') => {
    const job = state.jobs.find((entry) => entry.id === jobId);
    if (!job) return;
    const result = extractSafely(job.rawText);
    if (result.error) {
      setState((prev) => ({
        ...prev,
        jobs: prev.jobs.map((entry) =>
          entry.id === jobId
            ? { ...entry, extraction: 'failed', extractionError: result.error, needsReverify: false }
            : entry,
        ),
      }));
      showToast('重新提取失败，原文和已有字段已保留。');
      return;
    }
    const manualItems = job.items.filter((item) => item.manual);
    const items = mode === 'keep' ? [...manualItems, ...result.items] : result.items;
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((entry) =>
        entry.id === jobId
          ? { ...entry, items, extraction: 'ok', extractionError: undefined, needsReverify: false }
          : entry,
      ),
    }));
    showToast(
      mode === 'keep' && manualItems.length > 0
        ? `已重新提取，保留 ${manualItems.length} 项手动修改。`
        : '已重新提取全部字段。',
    );
  };

  const handleFavorite = (jobId: string) => {
    setState((prev) => {
      if (prev.favorites[jobId]) return prev;
      return {
        ...prev,
        favorites: {
          ...prev.favorites,
          [jobId]: { note: '', savedAt: new Date().toISOString() },
        },
      };
    });
    showToast('已收藏岗位；现在可以查看练习推荐。');
  };

  const handleUnfavorite = (jobId: string) => {
    setState((prev) => {
      const next = { ...prev.favorites };
      delete next[jobId];
      return { ...prev, favorites: next };
    });
    showToast('已取消收藏，岗位已从收藏列表移除。');
  };

  const handleFavoriteNote = (jobId: string, note: string) => {
    setState((prev) => {
      const favorite = prev.favorites[jobId];
      if (!favorite) return prev;
      return {
        ...prev,
        favorites: { ...prev.favorites, [jobId]: { ...favorite, note } },
      };
    });
  };

  const handleSupplementSave = (resultId: string, kind: SupplementKind, value: string) => {
    if (!currentJob) return;
    const ok = saveSessionSupplement(currentJob, resume?.text ?? '', resultId, {
      kind,
      value: value.trim(),
      updatedAt: new Date().toISOString(),
    });
    if (ok) {
      setSupplementRevision((version) => version + 1);
      showToast('已保存补充信息，当前行和统计已重新计算。');
    } else {
      showToast('浏览器未能保存补充信息，请稍后再试。');
    }
  };

  const handleSupplementDelete = (resultId: string) => {
    if (!currentJob) return;
    const ok = saveSessionSupplement(currentJob, resume?.text ?? '', resultId, null);
    if (ok) {
      setSupplementRevision((version) => version + 1);
      showToast('已删除补充信息，判断已恢复为简历证据。');
    } else {
      showToast('浏览器未能删除补充信息，请稍后再试。');
    }
  };

  const handleStartPractice = (questionId: QuestionId, itemId: string) => {
    if (!currentJob) return;
    const recommendation = recommendForJob(
      currentJob,
      state.profile,
      evaluateResume(currentJob),
    );
    const item = currentJob.items.find((entry) => entry.id === itemId) ?? recommendation.sqlItem;
    if (!item) {
      showToast('这个岗位暂无对应练习。');
      return;
    }
    setPracticeContext({ jobId: currentJob.id, questionId, itemId: item.id });
    setScenarioContext(null);
    setInspector(null);
    window.scrollTo({ top: 0 });
  };

  const handleStartScenario = (itemId: string) => {
    if (!currentJob) return;
    const item = currentJob.items.find((entry) => entry.id === itemId);
    if (!item) {
      showToast('找不到这项任务的原文依据。');
      return;
    }
    const key = item.taskKey ? `task:${item.taskKey}` : '';
    if (!scenarioForCapability(key, item.value)) {
      showToast('这项任务暂无对应场景题。');
      return;
    }
    setScenarioContext({ jobId: currentJob.id, itemId: item.id });
    setPracticeContext(null);
    setInspector(null);
    window.scrollTo({ top: 0 });
  };

  const handleGrade = (
    jobId: string,
    questionId: QuestionId,
    outcome: GradeReport['outcome'],
    sql: string,
  ) => {
    setState((prev) => {
      const key = practiceKey(jobId, questionId);
      const previous = prev.practice[key];
      const status: PracticeRecord['status'] =
        outcome === 'passed' ? 'passed' : previous?.status === 'passed' ? 'passed' : 'attempted';
      const record: PracticeRecord = {
        jobId,
        questionId,
        status,
        attempts: (previous?.attempts ?? 0) + 1,
        lastSql: sql,
        lastOutcome:
          outcome === 'passed'
            ? 'passed'
            : outcome === 'mismatch'
              ? 'mismatch'
              : outcome === 'timeout'
                ? 'timeout'
                : 'error',
        updatedAt: new Date().toISOString(),
      };
      return { ...prev, practice: { ...prev.practice, [key]: record } };
    });
  };

  const inspectJob = inspector ? state.jobs.find((job) => job.id === inspector.jobId) ?? null : null;
  const practiceJob = practiceContext
    ? state.jobs.find((job) => job.id === practiceContext.jobId) ?? null
    : null;
  const practiceQuestion: Question | null = practiceContext ? QUESTIONS[practiceContext.questionId] : null;
  const practiceItem =
    practiceJob && practiceContext
      ? practiceJob.items.find((item) => item.id === practiceContext.itemId) ??
        recommendForJob(
          practiceJob,
          state.profile,
          evaluateResume(practiceJob),
        ).sqlItem
      : undefined;
  const practiceRecord =
    practiceContext && practiceQuestion
      ? state.practice[practiceKey(practiceContext.jobId, practiceQuestion.id)]
      : undefined;
  const practiceRecommendation =
    practiceJob
      ? recommendForJob(
          practiceJob,
          state.profile,
          evaluateResume(practiceJob),
        )
      : null;
  const scenarioJob = scenarioContext
    ? state.jobs.find((job) => job.id === scenarioContext.jobId) ?? null
    : null;
  const scenarioItem = scenarioJob && scenarioContext
    ? scenarioJob.items.find((item) => item.id === scenarioContext.itemId) ?? null
    : null;
  const scenarioDefinition = scenarioItem
    ? scenarioForCapability(
        scenarioItem.taskKey ? `task:${scenarioItem.taskKey}` : '',
        scenarioItem.value,
      )
    : null;
  const scenarioEvaluation = scenarioJob ? evaluateResume(scenarioJob) : null;
  const scenarioResult =
    scenarioEvaluation && scenarioContext
      ? findMatchResultForItem(scenarioEvaluation, scenarioContext.itemId)
      : null;

  if (IS_DEV && adminOpen) {
    return <AdminWorkbench onBack={() => setAdminOpen(false)} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <button className="brand brand-button" onClick={goHome} aria-label="回到首页">
          <BrandMark />
          <span className="brand-title">JD 匹配与 SQL 自测</span>
        </button>
        <nav className="header-nav" aria-label="主导航">
          {currentJob ? (
            <button className="header-nav-btn" onClick={openCurrent} aria-current={view === 'analysis' ? 'page' : undefined}>
              当前岗位
            </button>
          ) : null}
          <button
            className="header-nav-btn"
            onClick={openFavorites}
            aria-current={view === 'favorites' ? 'page' : undefined}
          >
            <IconFlag size={14} /> 收藏
            <span className="nav-count">{favoritesCount}</span>
          </button>
        </nav>
        <div className="header-right">
          <span className="header-chip">
            <IconLock size={12} /> 本地保存
          </span>
          <span className="header-chip subtle">StudyHack</span>
        </div>
      </header>

      {view === 'landing' ? (
        <LandingView
          savedJob={currentJob}
          favoritesCount={favoritesCount}
          onPaste={openNewInput}
          onLoadSample={openSample}
          onContinue={openCurrent}
          onOpenFavorites={openFavorites}
          onEditProfile={openResume}
          resumeName={resume?.name}
        />
      ) : null}

      {view === 'input' && inputSeed ? (
        <InputView
          key={inputSeed.key}
          initialJob={inputSeed.job}
          editing={inputSeed.editing}
          onBack={backFromInput}
          onAnalyze={handleAnalyze}
          onEditResume={openResume}
          resumeName={resume?.name}
          showToast={showToast}
        />
      ) : null}

      {view === 'analysis' && currentJob && !practiceContext && !scenarioContext ? (
        <JobView
          key={matchInputKey(currentJob, resume?.text ?? '')}
          job={currentJob}
          jobs={state.jobs}
          profile={state.profile}
          favorite={state.favorites[currentJob.id]}
          practice={state.practice}
          onBack={goHome}
          onSwitchJob={openJob}
          onNewJob={openNewInput}
          onEditJob={openEditCurrent}
          onEditProfile={openResume}
          resumeName={resume?.name}
          evaluation={evaluateResume(currentJob)}
          onOpenInspector={(itemId, mode) =>
            setInspector({ jobId: currentJob.id, itemId, mode })
          }
          onAddItem={() => setInspector({ jobId: currentJob.id, itemId: null, mode: 'edit', add: true })}
          onFavorite={() => handleFavorite(currentJob.id)}
          onUnfavorite={() => handleUnfavorite(currentJob.id)}
          onFavoriteNote={(note) => handleFavoriteNote(currentJob.id, note)}
          onStartPractice={handleStartPractice}
          onStartScenario={handleStartScenario}
          onSupplementSave={handleSupplementSave}
          onSupplementDelete={handleSupplementDelete}
        />
      ) : null}

      {view === 'analysis' &&
      practiceContext &&
      practiceJob &&
      practiceQuestion &&
      practiceItem ? (
        <PracticeView
          key={`${practiceJob.id}:${practiceQuestion.id}`}
          job={practiceJob}
          question={practiceQuestion}
          item={practiceItem}
          recommendation={
            practiceRecommendation ??
            recommendForJob(
              practiceJob,
              state.profile,
              evaluateResume(practiceJob),
            )
          }
          lastRecord={practiceRecord}
          onBack={() => {
            setPracticeContext(null);
            setScenarioContext(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onGrade={(questionId, outcome, sql) => handleGrade(practiceJob.id, questionId, outcome, sql)}
          showToast={showToast}
        />
      ) : null}

      {view === 'analysis' &&
      scenarioContext &&
      scenarioJob &&
      scenarioItem &&
      scenarioDefinition ? (
        <ScenarioView
          key={`${scenarioJob.id}:${scenarioDefinition.id}:${scenarioContext.itemId}`}
          job={scenarioJob}
          item={scenarioItem}
          scenario={scenarioDefinition}
          result={scenarioResult}
          onBack={() => {
            setScenarioContext(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      ) : null}

      {view === 'favorites' ? (
        <FavoritesView
          jobs={state.jobs}
          favorites={state.favorites}
          profile={state.profile}
          practice={state.practice}
          onBack={goHome}
          onOpenJob={openJob}
          onRemoveFavorite={handleUnfavorite}
          onNote={handleFavoriteNote}
          onPaste={openNewInput}
          onEditProfile={openResume}
          evaluateResume={evaluateResume}
        />
      ) : null}

      {resumeOpen ? (
        <ResumeDialog current={resume} onClose={() => setResumeOpen(false)} onSave={(next) => {
          const saved = saveResume(next);
          setResume(next);
          setResumeOpen(false);
          showToast(!saved ? '浏览器未能保存简历文字，刷新后请重新确认。' : next ? '已确认简历，岗位证据已更新。' : '已清除简历。');
        }} />
      ) : null}

      {inspector && inspectJob && view === 'analysis' && !practiceContext && !scenarioContext ? (
        <Inspector
          key={`${inspectJob.id}:${inspector.itemId ?? 'raw'}:${inspector.mode}:${inspector.add ? 'add' : 'view'}`}
          job={inspectJob}
          itemId={inspector.itemId}
          initialMode={inspector.mode}
          startAdding={inspector.add}
          onClose={() => setInspector(null)}
          onUpdateItem={handleUpdateItem}
          onAddItem={handleAddItem}
          onDeleteItem={handleDeleteItem}
          onReextract={handleReextract}
          onEditRaw={() => {
            setInspector(null);
            openEditCurrent();
          }}
          showToast={showToast}
        />
      ) : null}

      {IS_DEV ? (
        <button className="dev-admin-fab" onClick={() => setAdminOpen(true)} type="button">
          题库工作台
        </button>
      ) : null}

      {toast ? (
        <div className="toast" role="status" key={toast.id}>
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
