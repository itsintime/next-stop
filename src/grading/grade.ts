import type { Dataset, GradeOutcome, GradeReport, Question } from '../types';
import { buildFeedback } from './feedback';

export const MAX_ROWS = 5000;
export const EXEC_TIMEOUT_MS = 6000;

export interface DatasetPayload {
  dataset: Dataset;
  expected: unknown[][];
  expectedColumnCount: number;
}

export interface DatasetRunResult {
  datasetId: string;
  datasetLabel: string;
  kind: 'public' | 'grading';
  state: 'match' | 'mismatch' | 'error';
  error?: string;
  actualRows?: unknown[][];
  columnCount?: number;
  expectedColumnCount?: number;
  truncated?: boolean;
}

export interface WorkerRequest {
  sql: string;
  datasets: DatasetPayload[];
}

export interface WorkerResponse {
  type: 'result';
  results: DatasetRunResult[];
}

export interface WorkerRejection {
  type: 'rejected';
  message: string;
}

export class QueryLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueryLimitError';
  }
}

export function stripLiteralsAndComments(sql: string): string {
  let output = '';
  let i = 0;
  while (i < sql.length) {
    const char = sql[i];
    if (char === "'" || char === '"' || char === '`') {
      const quote = char;
      output += ' ';
      i += 1;
      while (i < sql.length) {
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) {
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (char === '-' && sql[i + 1] === '-') {
      output += ' ';
      i += 2;
      while (i < sql.length && sql[i] !== '\n') i += 1;
      continue;
    }
    if (char === '/' && sql[i + 1] === '*') {
      output += ' ';
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (char === '[') {
      output += ' ';
      i += 1;
      while (i < sql.length && sql[i] !== ']') i += 1;
      i += 1;
      continue;
    }
    output += char;
    i += 1;
  }
  return output;
}

export function validateSql(sql: string): string | null {
  if (!sql.trim()) return '请输入 SQL 后再提交。';
  if (sql.length > 12000) return 'SQL 过长，请精简后再提交。';
  const stripped = stripLiteralsAndComments(sql);
  const normalized = stripped.trim().replace(/;+\s*$/, '').trim();
  if (!normalized) return '请输入 SQL 后再提交。';
  if (normalized.includes(';')) return '一次只允许提交一条 SELECT 查询，请去掉多余的分号。';
  if (!/^(select|with)\b/i.test(normalized)) return '本题只接受读取查询：请使用 SELECT 或 WITH 开头。';
  if (
    /\b(insert|update|delete|drop|alter|create|replace|attach|detach|pragma|vacuum|reindex|load_extension|readfile|writefile)\b/i.test(
      normalized,
    )
  ) {
    return '只能提交读取查询，不能修改、创建或删除数据。';
  }
  return null;
}

export function canonicalCell(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return `s:${String(value)}`;
    return `n:${Number.isInteger(value) ? value.toString() : String(value)}`;
  }
  if (value instanceof Uint8Array) return `blob:${Array.from(value).join(',')}`;
  const text = String(value).trim();
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return `n:${String(Number(text))}`;
  return `s:${text}`;
}

export function rowSignature(row: unknown[]): string {
  return JSON.stringify(row.map(canonicalCell));
}

export function rowsMatch(actual: unknown[][], expected: unknown[][]): boolean {
  if (actual.length !== expected.length) return false;
  const counts = new Map<string, number>();
  for (const row of expected) {
    const key = rowSignature(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const row of actual) {
    const key = rowSignature(row);
    const count = counts.get(key) ?? 0;
    if (count === 0) return false;
    counts.set(key, count - 1);
  }
  for (const count of counts.values()) {
    if (count !== 0) return false;
  }
  return true;
}

export function createDatabase(SQL: unknown, dataset: Dataset) {
  // sql.js Database is passed in from the worker or tests.
  const Database = SQL as { Database: new () => any };
  const db = new Database.Database();
  db.run(`
    CREATE TABLE events (
      event_id INTEGER PRIMARY KEY,
      event_name TEXT NOT NULL,
      city TEXT
    );
    CREATE TABLE signups (
      signup_id INTEGER PRIMARY KEY,
      event_id INTEGER NOT NULL,
      student_id INTEGER
    );
  `);
  const insertEvent = db.prepare('INSERT INTO events (event_id, event_name, city) VALUES (?, ?, ?)');
  for (const row of dataset.events) insertEvent.run([row.event_id, row.event_name, row.city]);
  insertEvent.free();
  const insertSignup = db.prepare('INSERT INTO signups (signup_id, event_id, student_id) VALUES (?, ?, ?)');
  for (const row of dataset.signups) insertSignup.run([row.signup_id, row.event_id, row.student_id]);
  insertSignup.free();
  return db;
}

export function runReadQuery(db: any, sql: string): { rows: unknown[][]; columns: string[] } {
  const statement = db.prepare(sql.trim().replace(/;\s*$/, ''));
  const columns: string[] = statement.getColumnNames();
  const rows: unknown[][] = [];
  try {
    while (statement.step()) {
      if (rows.length >= MAX_ROWS) {
        throw new QueryLimitError(`返回行数超过 ${MAX_ROWS} 行，请缩小结果集。`);
      }
      rows.push(statement.get());
    }
  } finally {
    statement.free();
  }
  return { rows, columns };
}

export function gradeDataset(SQL: unknown, payload: DatasetPayload, sql: string): DatasetRunResult {
  const { dataset, expected, expectedColumnCount } = payload;
  let db: any = null;
  try {
    db = createDatabase(SQL, dataset);
    const { rows, columns } = runReadQuery(db, sql);
    if (columns.length !== expectedColumnCount) {
      return {
        datasetId: dataset.id,
        datasetLabel: dataset.label,
        kind: dataset.kind,
        state: 'mismatch',
        actualRows: rows.slice(0, 200),
        columnCount: columns.length,
        expectedColumnCount,
        error: `输出列数不符：题目要求 ${expectedColumnCount} 列，你的查询返回 ${columns.length} 列。`,
      };
    }
    const matched = rowsMatch(rows, expected);
    return {
      datasetId: dataset.id,
      datasetLabel: dataset.label,
      kind: dataset.kind,
      state: matched ? 'match' : 'mismatch',
      actualRows: matched ? undefined : rows.slice(0, 200),
      columnCount: columns.length,
      expectedColumnCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      datasetId: dataset.id,
      datasetLabel: dataset.label,
      kind: dataset.kind,
      state: 'error',
      error: message,
    };
  } finally {
    if (db) db.close();
  }
}

export function buildDatasetPayloads(question: Question): DatasetPayload[] {
  const datasets = [question.publicDataset, ...question.gradingDatasets];
  return datasets.map((dataset) => ({
    dataset,
    expected: question.expected[dataset.id] ?? [],
    expectedColumnCount: question.outputColumns.length,
  }));
}

export function reportFromResults(question: Question, results: DatasetRunResult[]): GradeReport {
  return buildFeedback(question, results);
}

export function finalizeReport(question: Question, results: DatasetRunResult[]): GradeReport {
  return buildFeedback(question, results);
}

export function reportOutcome(report: GradeReport): GradeOutcome {
  return report.outcome;
}
