import { blankJob, parseJob } from './tracker.ts';
import type { Job, Status } from './tracker.ts';

export type ScreenshotCandidate = {
  job: Job;
  observedAt: string;
  notice: string;
  raw: string;
};

const statusMap: [RegExp, Status][] = [
  [/已投递|已网申/, '已投递'],
  [/笔试|测评/, '笔试'],
  [/一面|初面/, '一面'],
  [/二面/, '二面'],
  [/终面|三面/, '终面'],
  [/hr\s*面/i, 'HR面'],
  [/offer/, 'Offer'],
  [/感谢信|未通过|不合适/, '感谢信'],
];

function clean(value: string) {
  return value
    .normalize('NFKC')
    .replace(/(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '')
    .replace(/(?<=\d)\s+(?=[\u3400-\u9fff])/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[|丨]/g, '')
    .trim();
}

function findStatus(value: string) {
  return statusMap.find(([pattern]) => pattern.test(value))?.[1] || '已投递';
}

function findCompany(lines: string[]) {
  for (const line of lines) {
    const match = line.match(
      /([\u3400-\u9fffA-Za-z0-9（）()·&.-]{2,80}?(?:股份有限公司|有限责任公司|有限公司|集团公司|研究院|银行|事务所|集团(?!股份)))/,
    );
    if (match)
      return match[1]
        .replace(/^[^\u3400-\u9fffA-Za-z]+/, '')
        .replace(/^(?:号|有最)/, '');
  }
  return '';
}

function findPosition(lines: string[], company: string) {
  return (
    lines.find(
      (line) =>
        line !== company &&
        !/(已投递|已网申|笔试|面试|更新|投递反馈|竞争力分析|修改志愿|暂停展示|邮件通知)/.test(
          line,
        ) &&
        !/^\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(line) &&
        line.length >= 2 &&
        line.length <= 80,
    ) || ''
  );
}

function findNotice(lines: string[]) {
  const line = lines.find((value) =>
    /暂停展示|邮件通知|以.*为准|投递进度/.test(value),
  );
  if (!line) return '';
  return (
    line.match(/(?:该企业|企业).{0,100}?(?:邮件通知为准|以.*?为准)/)?.[0] ||
    line
  );
}

export function parseScreenshotText(text: string): ScreenshotCandidate[] {
  const lines = text
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map(clean)
    .filter(Boolean);
  const statusIndices = lines
    .map((line, index) =>
      statusMap.some(([pattern]) => pattern.test(line)) ? index : -1,
    )
    .filter((index) => index >= 0);
  const candidates: ScreenshotCandidate[] = [];
  for (const [order, statusIndex] of statusIndices.entries()) {
    const previousIndex = statusIndices[order - 1] ?? -1;
    const nextIndex = statusIndices[order + 1] ?? lines.length;
    const statusLine = lines[statusIndex];
    const marker = statusMap.find(([pattern]) => pattern.test(statusLine))?.[0];
    const markerMatch = marker ? statusLine.match(marker) : null;
    const markerIndex = markerMatch?.index ?? -1;
    const inlinePosition = clean(statusLine.slice(0, markerIndex));
    const before = lines.slice(
      Math.max(previousIndex + 1, statusIndex - 8),
      statusIndex,
    );
    const after = lines.slice(
      statusIndex + 1,
      Math.min(nextIndex, statusIndex + 7),
    );
    const noticeContext = lines.slice(statusIndex + 1, statusIndex + 7);
    const context = [
      clean(statusLine.slice(markerIndex + (markerMatch?.[0].length || 0))),
      ...after,
    ];
    const company = inlinePosition ? findCompany(context) : findCompany(before);
    const position = inlinePosition || findPosition(before, company);
    if (!company || !position) continue;
    const observedAt =
      context
        .join(' ')
        .match(/\d{4}[-./]\d{1,2}[-./]\d{1,2}\s+\d{1,2}:\d{2}/)?.[0] || '';
    const notice = findNotice(noticeContext);
    const status = findStatus(statusLine);
    const job = parseJob({
      ...blankJob(),
      company,
      position,
      status,
      channel: '其他',
      source: '截图识别 · 请以招聘平台与邮件通知为准',
      notes: [
        `截图识别：${status}`,
        observedAt ? `页面更新时间：${observedAt}` : '',
        notice ? `平台提示：${notice}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    });
    candidates.push({
      job,
      observedAt,
      notice,
      raw: [...before, statusLine, ...after].join('\n'),
    });
  }
  const seen = new Set<string>();
  return candidates.filter((item) => {
    const key = `${item.job.company}\u0000${item.job.position}\u0000${item.job.status}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
