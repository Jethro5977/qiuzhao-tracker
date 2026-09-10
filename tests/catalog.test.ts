import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCatalog, lookupSerial } from '../lib/catalog.ts';
import { parseDraft } from '../lib/draft.ts';
import { blankJob, JOB_SOURCES } from '../lib/tracker.ts';

test('source serial lookup preserves extra fields and normalizes full-width numbers', () => {
  const catalog = parseCatalog(
    '序号\t公司名称\t招聘岗位\t工作地点\t投递链接\t招聘对象\n4150\t测试公司\t前端\t深圳\thttps://example.com/jobs/1\t2027届',
  );
  const job = lookupSerial(catalog, '４１５０');
  assert.equal(job.company, '测试公司');
  assert.equal(job.location, '深圳');
  assert.equal(job.applyUrl, 'https://example.com/jobs/1');
  assert.match(job.notes, /招聘对象：2027届/);
  assert.match(job.source, /2027届校招信息汇总表/);
  assert.notEqual(job.id, lookupSerial(catalog, '4150').id);
  assert.throws(() => lookupSerial(catalog, '4149'), /没有序号/);
  assert.throws(() => lookupSerial(catalog, '4150x'), /数字序号/);
});
test('keeps identical serials isolated between the two source sheets', () => {
  const first = parseCatalog(
    '序号,公司名称,招聘岗位\n1,来源一公司,前端',
    JOB_SOURCES[0],
  );
  const second = parseCatalog(
    '序号,公司名称,招聘岗位\n1,来源二公司,后端',
    JOB_SOURCES[1],
  );
  assert.equal(lookupSerial(first, '1').company, '来源一公司');
  assert.equal(lookupSerial(second, '1').company, '来源二公司');
  assert.match(lookupSerial(second, '1').source, /阿发/);
});
test('ambiguous serials and invalid source rows fail without silent partial import', () => {
  const catalog = parseCatalog('序号,公司名称,招聘岗位\n1,A,前端\n1,B,后端');
  assert.throws(() => lookupSerial(catalog, '1'), /多条/);
  assert.throws(
    () => parseCatalog('序号,公司名称,招聘岗位\n1,A,前端\n2,B,'),
    /第 3 行/,
  );
});
test('unfinished draft survives reload without requiring a valid complete job', () => {
  const job = {
    ...blankJob(),
    company: '输入中',
    applyUrl: 'https:/',
    nextDate: '2026-',
  };
  const restored = parseDraft(
    JSON.stringify({ job, baseline: null, savedAt: new Date().toISOString() }),
  );
  assert.deepEqual(restored.job, job);
  assert.throws(() => parseDraft('{broken'));
});
