import test from 'node:test';
import assert from 'node:assert/strict';
import { agenda, blankJob, canonicalUrl, companyKey, completeNext, duplicates, encodeBackup, mergeJobs, parseBackup, parseJob, saveRecord, today } from '../lib/tracker.ts';
import { exportCalendar, exportCsv, parseImport } from '../lib/transfer.ts';
import { readStorage, writeStorage } from '../lib/storage.ts';
import { STORAGE_KEY, RECOVERY_KEY } from '../lib/tracker.ts';
const job = (patch = {}) => parseJob({ ...blankJob(), company: '腾讯', position: '前端工程师', location: '深圳', ...patch });

test('company normalization removes complete suffixes, never individual Chinese characters', () => {
  assert.equal(companyKey('腾讯科技有限公司'), '腾讯科技');
  assert.notEqual(companyKey('大众'), companyKey('众'));
  assert.equal(companyKey('Tencent'), companyKey('腾讯集团'));
});
test('duplicate links retain job ID and hash route; tracking parameters do not matter', () => {
  assert.notEqual(canonicalUrl('https://jobs.example.com/?jobId=1'), canonicalUrl('https://jobs.example.com/?jobId=2'));
  assert.notEqual(canonicalUrl('https://jobs.example.com/#/job/1'), canonicalUrl('https://jobs.example.com/#/job/2'));
  assert.equal(canonicalUrl('https://jobs.example.com/?jobId=1&utm_source=x'), canonicalUrl('https://jobs.example.com/?jobId=1'));
});
test('different batches and independently identified jobs do not collide', () => {
  const a = job({ jobCode: 'A1' });
  assert.equal(duplicates(job({ batch: '2027届提前批', jobCode: 'A1' }), [a]).length, 0);
  assert.equal(duplicates(job({ jobCode: 'A2' }), [a]).length, 0);
  assert.equal(duplicates(job({ jobCode: 'A1' }), [a]).length, 1);
  assert.equal(duplicates(job({ location: '上海' }), [job()]).length, 0);
});
test('unknown role family does not make unrelated roles duplicates', () => {
  assert.equal(duplicates(job({ position: '财务专员' }), [job({ position: '市场专员' })]).length, 0);
  assert.equal(duplicates(job({ company: ' Tencent ' }), [job()]).length, 1);
});
test('validate imports before use and migrate original Claude field/status conventions', () => {
  assert.equal(parseBackup(JSON.stringify([{ ...job(), id: 42, status: '已网申' }]))[0].status, '已投递');
  assert.equal(parseJob({ ...job(), status: '已OC' }).status, '已OC');
  for (const patch of [{ company: 42 }, { status: 'foobar' }, { nextDate: '2026-02-30' }, { applyUrl: 'javascript:alert(1)' }, { nextTime: '25:00' }]) assert.throws(() => job(patch));
  assert.throws(() => parseBackup('null'));
  const a = job(); assert.throws(() => parseBackup(JSON.stringify([a, a])), /ID/);
});
test('merge skips duplicates without overwriting current stage or discarding unrelated entries', () => {
  const existing = job({ status: '二面' });
  const incoming = [job({ status: '待投递' }), job({ company: '其他企业' })];
  const result = mergeJobs([existing], incoming);
  assert.equal(result.jobs.length, 2); assert.equal(result.jobs[0].status, '二面');
  assert.equal(result.skipped.length, 1);
  assert.equal(mergeJobs([], [job(), job()]).jobs.length, 1);
});
test('CSV supports quoted newlines, Chinese headers, formula escaping and TSV source preamble', () => {
  const a = job({ notes: '=1+1\n包含逗号,与"引号"' });
  const csv = exportCsv([a]);
  assert.ok(csv.includes("'=1+1"));
  assert.equal(parseImport(csv).jobs[0].notes, a.notes);
  const tsv = '2027届秋招岗位汇总\n公司名称\t招聘岗位\t工作地点\t截止时间\n企业甲\t测试开发\t深圳\t2026.9.30';
  assert.equal(parseImport(tsv).jobs[0].deadline, '2026-09-30');
  assert.equal(parseImport('公司,岗位,截止日期\n甲,研发,招满即止').errors.length, 1);
});
test('JSON full backup preserves timeline; unsupported future version rejected', () => {
  const a = saveRecord(job());
  assert.deepEqual(parseBackup(encodeBackup([a]))[0].history, a.history);
  assert.throws(() => parseBackup('{"schemaVersion":99,"jobs":[]}'), /版本/);
});
test('progress changes append history and first application fills local date; completing an event does not change stage', () => {
  const a = saveRecord(job());
  const b = saveRecord({ ...a, status: '笔试', nextDate: '2026-09-12', nextStep: '线上测试' }, a);
  assert.equal(b.applyDate, today()); assert.equal(b.history.length, 2);
  const c = completeNext(b);
  assert.equal(c.status, '笔试'); assert.equal(c.nextDate, ''); assert.equal(c.history.length, 3);
});
test('agenda retains overdue entries and only includes deadlines for unapplied active jobs', () => {
  const now = new Date('2026-09-08T12:00:00');
  const items = agenda([job({ nextDate: '2026-09-01' }), job({ deadline: '2026-09-07' }), job({ status: '感谢信', nextDate: '2026-09-01' }), job({ status: '已投递', deadline: '2026-09-01' })], now);
  assert.equal(items.length, 2); assert.ok(items.every(i => i.overdue));
  assert.equal(agenda([job({ nextDate: '2026-09-08', nextTime: '09:00' })], now)[0].overdue, true);
});
test('calendar exports UTF-8 folded lines, escaped values, all-day and timed events', () => {
  const data = exportCalendar([job({ nextDate: '2026-09-12', nextTime: '14:30', nextStep: '一面,技术', notes: '测'.repeat(60) }), job({ deadline: '2026-09-30' })]);
  assert.ok(data.includes('DTSTART:20260912T143000'));
  assert.ok(data.includes('DTSTART;VALUE=DATE:20260930'));
  assert.ok(data.includes('DTEND;VALUE=DATE:20261001'));
  assert.ok(data.includes('一面\\,技术'));
  assert.ok(data.split('\r\n').every(l => Buffer.byteLength(l) <= 75));
});
class MemoryStorage {
  values = new Map<string, string>(); failKey = '';
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (key === this.failKey) throw new Error('quota exceeded'); this.values.set(key, value); }
}
test('storage failure leaves primary copy unchanged and rejects stale-tab writes', () => {
  const storage = new MemoryStorage(), original = encodeBackup([job()]);
  storage.setItem(STORAGE_KEY, original);
  storage.failKey = RECOVERY_KEY;
  assert.throws(() => writeStorage(storage, [], original), /quota/);
  assert.equal(storage.getItem(STORAGE_KEY), original);
  storage.failKey = ''; assert.throws(() => writeStorage(storage, [], null), /另一窗口/);
  const raw = writeStorage(storage, [], original);
  assert.equal(storage.getItem(RECOVERY_KEY), original);
  assert.deepEqual(readStorage(storage).jobs, []);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});
test('malformed storage never silently becomes demo data', () => {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, '{broken');
  assert.throws(() => readStorage(storage));
  assert.equal(storage.getItem(STORAGE_KEY), '{broken');
});

