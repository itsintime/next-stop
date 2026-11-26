import type { Profile, SelfLevel, SqlTask } from '../types';
import { taskLabel } from '../fit';

interface ProfileEditorProps {
  profile: Profile;
  onChange: (profile: Profile) => void;
}

const TASKS: SqlTask[] = ['basic', 'dedupe', 'join'];
const LEVELS: { value: SelfLevel; label: string }[] = [
  { value: '', label: '跳过 / 暂不填写' },
  { value: 'none', label: '没学过' },
  { value: 'aware', label: '了解但不能独立完成' },
  { value: 'independent', label: '能独立完成' },
];

export function ProfileEditor({ profile, onChange }: ProfileEditorProps) {
  const update = (patch: Partial<Profile>) => onChange({ ...profile, ...patch });
  const updateSql = (task: SqlTask, level: SelfLevel) =>
    onChange({ ...profile, sql: { ...profile.sql, [task]: level } });

  return (
    <div className="profile-editor">
      <section className="profile-block">
        <div className="profile-block-head">
          <h2>时间与届别</h2>
          <span>用于和 JD 里的硬条件逐项比较</span>
        </div>
        <div className="profile-grid">
          <label className="field">
            <span>毕业届别</span>
            <input
              className="input"
              value={profile.graduation}
              onChange={(event) => update({ graduation: event.target.value })}
              placeholder="例如：2027"
              inputMode="numeric"
            />
          </label>
          <label className="field">
            <span>每周可到岗天数</span>
            <input
              className="input"
              type="number"
              min={1}
              max={7}
              value={profile.days}
              onChange={(event) => update({ days: event.target.value })}
              placeholder="例如：3"
            />
          </label>
          <label className="field">
            <span>可连续实习时长（月）</span>
            <input
              className="input"
              type="number"
              min={1}
              max={36}
              value={profile.duration}
              onChange={(event) => update({ duration: event.target.value })}
              placeholder="例如：3"
            />
          </label>
        </div>
      </section>

      <section className="profile-block">
        <div className="profile-block-head">
          <h2>SQL 自评</h2>
          <span>按任务填写；跳过不当作不满足</span>
        </div>
        <div className="sql-self-list">
          {TASKS.map((task) => (
            <label className="sql-self-row" key={task}>
              <span className="sql-self-name">{taskLabel(task)}</span>
              <select
                className="input"
                value={profile.sql[task]}
                onChange={(event) => updateSql(task, event.target.value as SelfLevel)}
              >
                {LEVELS.map((level) => (
                  <option key={level.value || 'skip'} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="profile-hint">自评和练习结果只用于推荐下一步练习，不等同于岗位录用判断。</p>
      </section>
    </div>
  );
}
