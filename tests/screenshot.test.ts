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
  assert.equal(candidates[0].appliedAt, '');
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

test('uses the application card instead of sidebar summaries on a noisy FAW screenshot', () => {
  const candidates = parseScreenshotText(`@ Chrome File Edit View History Bookmarks Profiles Tab Window Help
中国一汽首页社会招聘校园招聘 Q&A 你好,77退出
个人中心我的投递全部校园招聘全部项目
招投标项目经理 。 祸园招聘 ”2027校园招聘 S ” 待处理简历
.~ 所属公司 : 长春一汽国际招标有限公司 | 所属部门 : 长春一汽国际招标有限公司 | 简历名称 : 于兴浩 &
w 急 - _20260910_ 默认模板
4投递时间 : 2026-09-10 18:51
你好从导出简历撤回投递
77
个人信息
我的投递
已投递过的职位数 : 1 0
最近投递 : 招投标项目经理
最近投递进度 : 待处理简历 am
我的收藏`);

  assert.equal(candidates.length, 1);
  assert.deepEqual(
    {
      company: candidates[0].job.company,
      position: candidates[0].job.position,
      status: candidates[0].job.status,
      applyDate: candidates[0].job.applyDate,
      appliedAt: candidates[0].appliedAt,
      progressLabel: candidates[0].progressLabel,
    },
    {
      company: '长春一汽国际招标有限公司',
      position: '招投标项目经理',
      status: '已投递',
      applyDate: '2026-09-10',
      appliedAt: '2026-09-10 18:51',
      progressLabel: '待处理简历',
    },
  );
  assert.doesNotMatch(candidates[0].job.position, /所属公司|简历名称/);
  assert.doesNotMatch(candidates[0].job.notes, /于兴浩/);
});
