import type { Dataset, GradeOutcome, GradeReport, Question } from '../types';
import type { DatasetRunResult } from './grade';

function eventName(dataset: Dataset, eventId: unknown): string {
  const id = Number(eventId);
  const event = dataset.events.find((row) => row.event_id === id);
  return event ? `${event.event_name}（${id}）` : `活动 ${String(eventId)}`;
}

function eventById(dataset: Dataset, eventId: unknown) {
  const id = Number(eventId);
  return dataset.events.find((row) => row.event_id === id);
}

function expectedFor(question: Question, datasetId: string): unknown[][] {
  return question.expected[datasetId] ?? [];
}

function datasetFor(question: Question, datasetId: string): Dataset | undefined {
  return [question.publicDataset, ...question.gradingDatasets].find((dataset) => dataset.id === datasetId);
}

function actualRowsById(rows: unknown[][], expectedMap: Map<string, unknown[]>): Map<string, unknown[][]> {
  const map = new Map<string, unknown[][]>();
  for (const row of rows) {
    if (row.length === 0) continue;
    const key = String(row[0]);
    if (!map.has(key)) map.set(key, []);
    map.get(key)?.push(row);
  }
  for (const key of expectedMap.keys()) {
    if (!map.has(key)) map.set(key, []);
  }
  return map;
}

function q1Details(question: Question, result: DatasetRunResult, dataset: Dataset): string[] {
  const details: string[] = [];
  const expected = expectedFor(question, result.datasetId);
  const expectedMap = new Map(expected.map((row) => [String(row[0]), row]));
  const actualRows = result.actualRows ?? [];
  const actualMap = actualRowsById(actualRows, expectedMap);
  const duplicated =
    actualRows.length > new Set(actualRows.map((row) => row.join('\u0001'))).size ? '结果里存在重复行。' : '';

  for (const [id, expectedRow] of expectedMap) {
    const rows = actualMap.get(id) ?? [];
    if (rows.length === 0) {
      details.push(`漏掉了上海活动「${String(expectedRow[1])}」（${id}）。`);
    } else if (rows.length > 1) {
      details.push(`活动「${String(expectedRow[1])}」（${id}）被输出了多行。`);
    } else if (String(rows[0][1] ?? '') !== String(expectedRow[1])) {
      details.push(`活动 ${id} 的 event_name 与期望不一致，检查输出列顺序是否为 event_id, event_name。`);
    }
  }
  for (const [id, rows] of actualMap) {
    if (expectedMap.has(id)) continue;
    const event = eventById(dataset, id);
    if (!event) {
      details.push(`输出了不存在的活动 ID ${id}。`);
    } else if (event.city === null) {
      details.push(`城市为空的活动「${event.event_name}」（${id}）被当成上海活动输出了。`);
    } else if (event.city !== '上海') {
      details.push(`非上海活动「${event.event_name}」（${id}，${event.city}）被输出了。`);
    } else {
      details.push(`活动「${event.event_name}」（${id}）不应出现在结果里。`);
    }
    if (rows.length > 1) details.push(`活动 ${id} 在结果里出现了 ${rows.length} 次。`);
  }
  if (duplicated) details.push(duplicated);
  if (details.length === 0) details.push('行内容与期望不一致，请检查筛选条件和输出列。');
  return details;
}

function q2Details(question: Question, result: DatasetRunResult, dataset: Dataset): string[] {
  const details: string[] = [];
  const expected = expectedFor(question, result.datasetId);
  const expectedMap = new Map(expected.map((row) => [String(row[0]), Number(row[1])]));
  const actualRows = result.actualRows ?? [];
  const actualMap = actualRowsById(actualRows, new Map(expected.map((row) => [String(row[0]), row])));

  for (const [id, expectedCount] of expectedMap) {
    const rows = actualMap.get(id) ?? [];
    if (rows.length === 0) {
      details.push(`漏掉了活动「${eventName(dataset, id)}」，它至少有一位有效报名者。`);
      continue;
    }
    if (rows.length > 1) {
      details.push(`活动「${eventName(dataset, id)}」在结果里出现了 ${rows.length} 行，应只保留一行。`);
    }
    const actualCount = Number(rows[0][1]);
    if (!Number.isFinite(actualCount)) {
      details.push(`活动「${eventName(dataset, id)}」的第二列不是可比较的人数。`);
      continue;
    }
    if (actualCount === expectedCount) continue;
    const signups = dataset.signups.filter((row) => row.event_id === Number(id));
    const valid = signups.filter((row) => row.student_id !== null);
    const uniqueStudents = new Set(valid.map((row) => row.student_id));
    const duplicateExtra = valid.length - uniqueStudents.size;
    const nullRows = signups.filter((row) => row.student_id === null).length;
    if (actualCount > expectedCount) {
      const reasons: string[] = [];
      if (duplicateExtra > 0) reasons.push('同一学生重复报名被多计了');
      if (nullRows > 0) reasons.push('空 student_id 的记录被计入了人数');
      const reason = reasons.length > 0 ? `（${reasons.join('；')}）` : '（人数偏高）';
      details.push(`活动「${eventName(dataset, id)}」应为 ${expectedCount} 人，你得到 ${actualCount} 人${reason}。`);
    } else {
      details.push(`活动「${eventName(dataset, id)}」应为 ${expectedCount} 人，你得到 ${actualCount} 人，人数偏少，检查是否漏掉了有效报名。`);
    }
  }

  for (const [id, rows] of actualMap) {
    if (expectedMap.has(id)) continue;
    const signups = dataset.signups.filter((row) => row.event_id === Number(id));
    const nullOnly = signups.length > 0 && signups.every((row) => row.student_id === null);
    const firstCount = rows[0] ? Number(rows[0][1]) : 0;
    if (firstCount === 0) {
      details.push(`活动「${eventName(dataset, id)}」没有有效报名，却以 0 人的形式出现在结果里。`);
    } else if (nullOnly) {
      details.push(`活动「${eventName(dataset, id)}」只有空 student_id 报名，不应计入有效人数。`);
    } else {
      details.push(`活动「${eventName(dataset, id)}」不应出现在结果里，请检查分组或过滤条件。`);
    }
  }

  if (details.length === 0) details.push('人数统计与期望不一致，请检查是否按活动分组、是否跳过空学生 ID、是否重复计数。');
  return details;
}

function q3Details(question: Question, result: DatasetRunResult, dataset: Dataset): string[] {
  const details: string[] = [];
  const expected = expectedFor(question, result.datasetId);
  const expectedMap = new Map(expected.map((row) => [String(row[0]), row]));
  const actualRows = result.actualRows ?? [];
  const actualMap = actualRowsById(actualRows, expectedMap);

  for (const [id, expectedRow] of expectedMap) {
    const rows = actualMap.get(id) ?? [];
    if (rows.length === 0) {
      const signups = dataset.signups.filter((row) => row.event_id === Number(id));
      const reason =
        signups.length === 0
          ? '完全没有报名记录'
          : signups.every((row) => row.student_id === null)
            ? '只有空 student_id 记录'
            : '没有有效报名者';
      details.push(`漏掉了活动「${String(expectedRow[1])}」（${id}，${reason}）。`);
    } else {
      if (rows.length > 1) details.push(`活动「${String(expectedRow[1])}」（${id}）被输出了多行。`);
      if (String(rows[0][1] ?? '') !== String(expectedRow[1])) {
        details.push(`活动 ${id} 的 event_name 与期望不一致，检查输出列顺序。`);
      }
    }
  }

  for (const [id, rows] of actualMap) {
    if (expectedMap.has(id)) continue;
    const event = eventById(dataset, id);
    const hasValid = dataset.signups.some((row) => row.event_id === Number(id) && row.student_id !== null);
    if (hasValid) {
      details.push(`活动「${event?.event_name ?? id}」（${id}）有有效报名，不应被判定为没有有效报名。`);
    } else if (!event) {
      details.push(`输出了不存在的活动 ID ${id}。`);
    } else {
      details.push(`活动「${event.event_name}」（${id}）不应出现在结果里。`);
    }
    if (rows.length > 1) details.push(`活动 ${id} 在结果里出现了 ${rows.length} 次。`);
  }

  if (details.length === 0) details.push('结果与期望不一致，请检查多表连接条件和空学生 ID 的处理。');
  return details;
}

function mismatchDetails(question: Question, result: DatasetRunResult): string[] {
  const dataset = datasetFor(question, result.datasetId);
  if (!dataset) return [result.error ?? '结果与期望不一致。'];
  if (result.error && result.columnCount !== result.expectedColumnCount) {
    return [result.error];
  }
  if (question.id === 1) return q1Details(question, result, dataset);
  if (question.id === 2) return q2Details(question, result, dataset);
  return q3Details(question, result, dataset);
}

function translateSqlError(message: string): { detail: string; hint: string } {
  if (/syntax error/i.test(message)) {
    return {
      detail: `SQL 语法有误：${message}`,
      hint: '检查 SELECT、FROM、WHERE、GROUP BY 的关键字顺序，以及括号和逗号是否成对。',
    };
  }
  if (/no such table/i.test(message)) {
    return {
      detail: `表名不存在：${message}`,
      hint: '本题只有 events 和 signups 两张表。',
    };
  }
  if (/no such column/i.test(message)) {
    return {
      detail: `字段名不存在：${message}`,
      hint: '核对表结构：events(event_id, event_name, city)、signups(signup_id, event_id, student_id)。',
    };
  }
  if (/misuse of aggregate/i.test(message)) {
    return {
      detail: `聚合函数用法有误：${message}`,
      hint: '使用 COUNT 等聚合函数时，非聚合列要放进 GROUP BY。',
    };
  }
  if (/ambiguous column/i.test(message)) {
    return { detail: `字段名有歧义：${message}`, hint: '两表连接时给表起别名，并用别名.字段名指代。' };
  }
  if (/UNIQUE constraint failed|NOT NULL constraint failed/i.test(message)) {
    return { detail: `查询触发了数据约束：${message}`, hint: '本题只允许读取，不需要写入数据。' };
  }
  return { detail: `执行失败：${message}`, hint: '先检查 SQL 是否完整，再逐步缩小查询范围。' };
}

export function buildFeedback(question: Question, results: DatasetRunResult[]): GradeReport {
  const errorResult = results.find((result) => result.state === 'error');
  if (errorResult) {
    const translated = translateSqlError(errorResult.error ?? '未知错误');
    return {
      outcome: 'error' as GradeOutcome,
      results,
      message: 'SQL 执行出错，尚未进入结果比对。修改后可以继续提交。',
      details: [`${errorResult.datasetLabel}：${translated.detail}`],
      hints: [translated.hint, ...question.hints.slice(0, 2)],
    };
  }

  const failing = results.filter((result) => result.state !== 'match');
  if (failing.length === 0) {
    const gradingCount = results.filter((result) => result.kind === 'grading').length;
    return {
      outcome: 'passed',
      results,
      message: '全部通过。',
      details: [
        `公开样例与 ${gradingCount} 组独立判题数据的结果一致。`,
        '行顺序不限，重复行按出现次数比较。',
        '练习结果只说明本题覆盖的能力，是否收藏或投递仍由你决定。',
      ],
      hints: [],
    };
  }

  const publicResult = results.find((result) => result.kind === 'public');
  const onlyHiddenFailed = publicResult?.state === 'match';
  const details: string[] = [];
  if (onlyHiddenFailed) {
    details.push('公开样例通过，但公开样例不能代表全部情况；独立判题数据未通过。');
  }
  for (const result of failing.slice(0, 2)) {
    const lines = mismatchDetails(question, result);
    for (const line of lines.slice(0, 3)) {
      details.push(`${result.datasetLabel}：${line}`);
    }
  }
  if (failing.length > 2) {
    details.push(`另有 ${failing.length - 2} 组数据未通过。`);
  }

  const specificHints = failing.flatMap((result) => {
    if (question.id === 2) {
      const rows = result.actualRows ?? [];
      const expected = expectedFor(question, result.datasetId);
      const expectedIds = new Set(expected.map((row) => String(row[0])));
      const extraZero = rows.some((row) => !expectedIds.has(String(row[0])) && Number(row[1]) === 0);
      const overCount = rows.some((row) => {
        const match = expected.find((item) => String(item[0]) === String(row[0]));
        return match && Number(row[1]) > Number(match[1]);
      });
      const hints: string[] = [];
      if (overCount) hints.push('统计人数时确认同一活动内同一学生只计一次。');
      if (extraZero) hints.push('先过滤掉 student_id 为空的记录，或只保留人数大于 0 的活动。');
      return hints;
    }
    if (question.id === 3) {
      return ['判断的是「有没有有效报名」，而不是「有没有报名记录」。', 'LEFT JOIN 的过滤条件放在 ON 里，或改用 NOT EXISTS。'];
    }
    return ['核对 city 条件，城市为空的活动不属于上海。'];
  });

  const hints = [...new Set([...specificHints, ...question.hints])].slice(0, 4);
  return {
    outcome: 'mismatch',
    results,
    message: onlyHiddenFailed
      ? '公开样例结果一致，但判题数据未通过。'
      : `结果不符：还有 ${failing.length} 组数据未通过。`,
    details,
    hints,
  };
}
