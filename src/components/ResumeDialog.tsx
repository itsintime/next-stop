import { useRef, useState } from 'react';
import { importResume, normalizeResume, type ConfirmedResume } from '../../mode/resume-import';
import { Modal } from './Modal';

export function ResumeDialog({ current, onSave, onClose }: {
  current: ConfirmedResume | null;
  onSave: (resume: ConfirmedResume | null) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(current?.text ?? '');
  const [name, setName] = useState(current?.name ?? '粘贴的简历');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const operation = useRef(0);

  const pick = async (file: File) => {
    const id = ++operation.current;
    setBusy(true);
    setError('');
    try {
      const extracted = await importResume(file);
      if (id !== operation.current) return;
      setDraft(extracted);
      setName(file.name);
    } catch (e) {
      if (id === operation.current) setError(e instanceof Error ? e.message : '无法读取文件，请改用粘贴。');
    } finally {
      if (id === operation.current) setBusy(false);
    }
  };

  const confirm = () => {
    try { onSave({ text: normalizeResume(draft), name }); }
    catch (e) { setError(e instanceof Error ? e.message : '请先填写简历文本。'); }
  };

  return <Modal title="导入简历" wide onClose={onClose} footer={<>
    {current && <button className="btn btn-ghost" onClick={() => onSave(null)}>清除已确认的简历</button>}
    <button className="btn btn-ghost" onClick={onClose}>取消</button>
    <button className="btn btn-primary" disabled={busy || !draft.trim()} onClick={confirm}>使用这份简历</button>
  </>}>
    <p className="modal-text">TXT、DOCX 或有文字层的 PDF，最多 15 MB。原文件不保存，确认的文字仅保留在当前标签页，刷新后可继续使用。</p>
    <label className="field">
      <span>选择简历文件</span>
      <input className="input" type="file" accept=".txt,.docx,.pdf" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void pick(file);
      }} />
    </label>
    {busy && <p role="status">正在读取文件…</p>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    <label className="field">
      <span>简历文字预览（也可以直接粘贴）</span>
      <textarea className="input textarea" rows={12} value={draft} placeholder="请核对中文、换行和经历顺序"
        onChange={(event) => { operation.current++; setBusy(false); setError(''); setDraft(event.target.value); }} />
    </label>
    {current && <p className="modal-text">只有点「使用这份简历」才会替换已确认版本。</p>}
  </Modal>;
}
