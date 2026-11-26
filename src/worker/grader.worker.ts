/// <reference lib="webworker" />
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { gradeDataset, validateSql, type WorkerRequest, type WorkerResponse } from '../grading/grade';

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { sql, datasets } = event.data;
  const rejection = validateSql(sql);
  if (rejection) {
    self.postMessage({ type: 'rejected', message: rejection });
    return;
  }
  try {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    const results = datasets.map((payload) => gradeDataset(SQL, payload, sql));
    const response: WorkerResponse = { type: 'result', results };
    self.postMessage(response);
  } catch (error) {
    self.postMessage({
      type: 'fatal',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
