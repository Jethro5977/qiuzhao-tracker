import { parseJob } from './tracker.ts';
import type { Job } from './tracker.ts';
export const DRAFT_KEY = 'qiuzhao-editor-draft-v1';
export type Draft = { job: Job; baseline: string | null; savedAt: string };
export function parseDraft(raw: string): Draft {
  const data = JSON.parse(raw) as Draft;
  if (
    !data.job ||
    typeof data.job.company !== 'string' ||
    typeof data.job.position !== 'string' ||
    (data.baseline !== null && typeof data.baseline !== 'string')
  )
    throw new Error('草稿格式错误');
  // A draft may contain unfinished dates, URLs, or required fields. Validate
  // the shape without interpreting unfinished fields as a valid job.
  const template = parseJob({ company: '草稿', position: '草稿' });
  for (const key of Object.keys(template) as (keyof Job)[]) {
    if (key !== 'history' && typeof data.job[key] !== 'string')
      throw new Error('草稿字段错误');
  }
  if (!Array.isArray(data.job.history)) throw new Error('草稿历史错误');
  return data;
}
