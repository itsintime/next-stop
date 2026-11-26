import type { ExtractedItem, Field, Job, Requirement } from './types';
import { locateQuote } from './utils';

export type ItemCategory =
  | 'graduation'
  | 'education'
  | 'enrollment'
  | 'major'
  | 'days'
  | 'duration'
  | 'skill'
  | 'task'
  | 'duty';
export type ItemStatusTone = 'ok' | 'warn' | 'manual';

export function itemCategory(item: ExtractedItem): ItemCategory {
  if (item.field === 'skill') return 'skill';
  return item.field;
}

export function itemCategoryLabel(item: ExtractedItem): string {
  if (item.field === 'skill') return item.requirement === 'preferred' ? '加分项' : '必需技能';
  if (item.field === 'graduation') return '毕业届别';
  if (item.field === 'education') return '学历要求';
  if (item.field === 'enrollment') return '在校状态';
  if (item.field === 'major') return '相关专业';
  if (item.field === 'days') return '每周到岗';
  if (item.field === 'duration') return '连续实习';
  if (item.field === 'task') return '岗位任务';
  return '实习职责';
}

export function itemStatus(job: Job, item: ExtractedItem): { tone: ItemStatusTone; label: string; title: string } {
  const found = locateQuote(job.rawText, item.quote) !== null;
  if (item.uncertain) {
    return { tone: 'warn', label: '待确认', title: item.detail ?? '原文有描述，但无法确定具体值' };
  }
  if (!found) {
    return { tone: 'warn', label: '待确认', title: '原文引用匹配失败，请核对或修改' };
  }
  if (item.manual) {
    return { tone: 'manual', label: '手动修改', title: '已保留原 JD 和手动修改标记' };
  }
  return { tone: 'ok', label: '已核实', title: '引用已定位到原文' };
}

export function categoryToFields(category: ItemCategory, requirement: Requirement): { field: Field; requirement: Requirement } {
  if (category === 'skill') {
    return { field: 'skill', requirement: requirement === 'preferred' ? 'preferred' : 'required' };
  }
  if (category === 'graduation') {
    return { field: 'graduation', requirement: requirement === 'preferred' ? 'preferred' : 'info' };
  }
  if (category === 'task') {
    return { field: 'task', requirement: 'duty' };
  }
  if (category === 'education' || category === 'enrollment' || category === 'major') {
    return { field: category, requirement: 'info' };
  }
  if (category === 'days' || category === 'duration') {
    return { field: category, requirement: 'info' };
  }
  return { field: 'duty', requirement: 'duty' };
}

export function requirementOptions(category: ItemCategory): { value: Requirement; label: string }[] {
  if (category === 'skill') {
    return [
      { value: 'required', label: '必需技能' },
      { value: 'preferred', label: '加分项' },
    ];
  }
  if (category === 'graduation') {
    return [
      { value: 'info', label: '届别信息' },
      { value: 'preferred', label: '优先考虑' },
    ];
  }
  if (category === 'task') return [{ value: 'duty', label: '岗位任务' }];
  if (category === 'duty') return [{ value: 'duty', label: '实习职责' }];
  if (category === 'education') return [{ value: 'info', label: '学历要求' }];
  if (category === 'enrollment') return [{ value: 'info', label: '在校状态' }];
  if (category === 'major') return [{ value: 'info', label: '专业要求' }];
  return [{ value: 'info', label: '时限信息' }];
}
