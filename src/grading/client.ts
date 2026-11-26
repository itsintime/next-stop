import type { GradeReport, Question } from '../types';
import {
  buildDatasetPayloads,
  EXEC_TIMEOUT_MS,
  validateSql,
  type DatasetRunResult,
  type WorkerRequest,
} from './grade';
import { buildFeedback } from './feedback';

function emptyReport(outcome: GradeReport['outcome'], message: string, details: string[], hints: string[]): GradeReport {
  return { outcome, message, details, hints, results: [] };
}

export function gradeSql(question: Question, sql: string): Promise<GradeReport> {
  const rejection = validateSql(sql);
  if (rejection) {
    return Promise.resolve(
      emptyReport('rejected', rejection, ['查询尚未执行。'], ['只提交一条 SELECT 查询，修改后可以继续。']),
    );
  }

  return new Promise((resolve) => {
    let settled = false;
    const worker = new Worker(new URL('../worker/grader.worker.ts', import.meta.url), { type: 'module' });
    const finish = (report: GradeReport) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      worker.terminate();
      resolve(report);
    };
    const timeout = window.setTimeout(() => {
      finish(
        emptyReport(
          'timeout',
          `执行超时：超过 ${Math.round(EXEC_TIMEOUT_MS / 1000)} 秒仍未完成。`,
          ['查询已被中止，不会影响其他数据。'],
          [
            '检查是否有缺少连接条件的多表查询（笛卡尔积）。',
            '避免无终止条件的递归查询，并尽量先缩小数据范围。',
            '修改后可以继续提交。',
          ],
        ),
      );
    }, EXEC_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as
        | { type: 'result'; results: DatasetRunResult[] }
        | { type: 'rejected'; message: string }
        | { type: 'fatal'; message: string };
      if (data.type === 'rejected') {
        finish(emptyReport('rejected', data.message, ['查询尚未执行。'], ['修改后可以继续提交。']));
        return;
      }
      if (data.type === 'fatal') {
        finish(
          emptyReport(
            'error',
            '判题环境未能启动。',
            [data.message],
            ['可以重新提交；若持续失败，请刷新页面后再试。'],
          ),
        );
        return;
      }
      finish(buildFeedback(question, data.results));
    };

    worker.onerror = (event) => {
      finish(
        emptyReport(
          'error',
          '判题进程出错。',
          [event.message || 'Worker 执行异常'],
          ['可以重新提交；若持续失败，请刷新页面后再试。'],
        ),
      );
    };

    const request: WorkerRequest = { sql, datasets: buildDatasetPayloads(question) };
    worker.postMessage(request);
  });
}
