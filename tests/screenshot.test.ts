import assert from 'node:assert/strict';
import test from 'node:test';
import { parseScreenshotText } from '../lib/screenshot.ts';

test('extracts applied jobs and preserves an update notice from a screenshot', () => {
  const candidates = parseScreenshotText(`销服组织管培生
广汽埃安新能源汽车股份有限公司
已投递
2026-09-10 15:27更新
该企业设置了暂停展示投递进度，请以邮件通知为准
运营管理岗
广州汽车集团股份有限公司
已投递
2026-09-10 15:27更新
该企业设置了暂停展示投递进度，请以邮件通知为准
27届软件开发岗
广州汽车集团股份有限公司
已投递
2026-09-10 15:27更新`);
  assert.equal(candidates.length, 3);
  assert.deepEqual(
    candidates.map((candidate) => [
      candidate.job.company,
      candidate.job.position,
      candidate.job.status,
    ]),
    [
      ['广汽埃安新能源汽车股份有限公司', '销服组织管培生', '已投递'],
      ['广州汽车集团股份有限公司', '运营管理岗', '已投递'],
      ['广州汽车集团股份有限公司', '27届软件开发岗', '已投递'],
    ],
  );
  assert.equal(candidates[0].observedAt, '2026-09-10 15:27');
  assert.match(candidates[0].notice, /邮件通知/);
});

test('does not create a record when company or position cannot be recognized', () => {
  assert.deepEqual(parseScreenshotText('已投递\n2026-09-10 15:27 更新'), []);
});

test('handles the spaced Chinese OCR output used by common recruitment pages', () => {
  const candidates = parseScreenshotText(`销 服 组 织 管 培 生 已 投递
广汽 埃 安 新 能 源 汽 车 股份 有 限 公司 2026-09-10 15:27 更 新
@ 该 企业 设置 了 暂停 展示 投递 进度 ， 请 以 邮件 通知 为 准
运营 管理 岗 已 投递
广州 汽车 集团 股份 有 限 公司 2026-09-10 15:27 更 新`);
  assert.deepEqual(
    candidates.map((candidate) => [
      candidate.job.company,
      candidate.job.position,
    ]),
    [
      ['广汽埃安新能源汽车股份有限公司', '销服组织管培生'],
      ['广州汽车集团股份有限公司', '运营管理岗'],
    ],
  );
});
