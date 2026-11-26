import type { Profile } from '../types';
import { ProfileEditor } from './ProfileEditor';
import { IconArrowLeft, IconCheck, IconLock } from './Icons';

interface ProfileViewProps {
  profile: Profile;
  backLabel: string;
  onChange: (profile: Profile) => void;
  onBack: () => void;
}

export function ProfileView({ profile, backLabel, onChange, onBack }: ProfileViewProps) {
  return (
    <main className="page profile-page">
      <div className="page-head">
        <button className="text-btn" onClick={onBack}>
          <IconArrowLeft /> {backLabel}
        </button>
        <div className="page-head-copy">
          <p className="eyebrow">我的资料</p>
          <h1>把能确定的条件写下来。</h1>
          <p className="page-sub">
            这些资料只保存在当前浏览器。修改后，当前岗位会按新资料重新判断；后续分析其他岗位也会继续使用。
          </p>
        </div>
      </div>

      <ProfileEditor profile={profile} onChange={onChange} />

      <div className="profile-savebar">
        <span>
          <IconLock size={13} /> 修改即自动保存
        </span>
        <button className="btn btn-primary" onClick={onBack}>
          <IconCheck size={15} /> {backLabel}
        </button>
      </div>
    </main>
  );
}
