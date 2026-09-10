import { blankJob, duplicates, parseJob } from './tracker.ts';
import type { Job } from './tracker.ts';
export type BatchRow = { line: number; job: Job | null; state: 'ready' | 'duplicate' | 'invalid'; message: string };
export function parseBatch(text: string, existing: Job[]): BatchRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const accepted = [...existing];
  return lines.map((line, index) => {
    const delimiter = line.includes('\t') ? '\t' : line.includes('|') ? '|' : ',';
    const cells = line.split(delimiter).map((cell) => cell.trim());
    if (index === 0 && /公司/.test(cells[0] || '') && /岗位|职位/.test(cells[1] || '')) return { line: 1, job: null, state: 'invalid', message: '表头（自动跳过）' };
    if (!cells[0] || !cells[1]) return { line: index + 1, job: null, state: 'invalid', message: '缺少公司或岗位' };
    try {
      const job = parseJob({ ...blankJob(), company: cells[0], position: cells[1], location: cells[2] || '', channel: cells[3] || '官网', source: '批量文本录入' });
      const duplicate = duplicates(job, accepted)[0];
      if (!duplicate) accepted.push(job);
      return { line: index + 1, job, state: duplicate ? 'duplicate' : 'ready', message: duplicate ? `疑似重复：${duplicate.job.company} · ${duplicate.job.position}` : '可录入' };
    } catch (cause) { return { line: index + 1, job: null, state: 'invalid', message: cause instanceof Error ? cause.message : '格式错误' }; }
  });
}
