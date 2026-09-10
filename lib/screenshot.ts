import { blankJob, parseJob } from './tracker.ts';
import type { Job, Status } from './tracker.ts';

export type ScreenshotCandidate = {
  job: Job;
  observedAt: string;
  appliedAt: string;
  progressLabel: string;
  notice: string;
  raw: string;
};

type StatusRule = { pattern: RegExp; status: Status };

// More specific progress labels must precede broad labels such as “已投递”.
const statusRules: StatusRule[] = [
  { pattern: /感谢信|未通过|不合适/, status: '感谢信' },
  { pattern: /已放弃|撤回成功/, status: '已放弃' },
  { pattern: /offer/i, status: 'Offer' },
  { pattern: /已\s*OC/i, status: '已OC' },
  { pattern: /hr\s*面/i, status: 'HR面' },
  { pattern: /终面|三面/, status: '终面' },
  { pattern: /二面/, status: '二面' },
  { pattern: /一面|初面/, status: '一面' },
  { pattern: /笔试|测评/, status: '笔试' },
  {
    pattern: /待处理简历|简历筛选中|筛选中|处理中|投递成功|已投递|已网申/,
    status: '已投递',
  },
];

const summaryLine =
  /已投递过的职位数|最近投递(?:进度)?|投递反馈|投递时间|我的投递|全部项目|投递过的职位|职位数/;
const nonPositionLine =
  /所属公司|所属部门|简历名称|投递时间|已投递|已网申|投递成功|待处理简历|简历筛选|笔试|面试|更新|投递反馈|竞争力分析|修改志愿|撤回投递|导出简历|暂停展示|邮件通知|个人中心|个人信息|我的投递|我的收藏|校园招聘|社会招聘|全部项目|最近投递|职位数/;

function clean(value: string) {
  return value
    .normalize('NFKC')
    .replace(/(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '')
    .replace(/(?<=\d)\s+(?=[\u3400-\u9fff])/g, '')
    .replace(/[丨]/g, '|')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanField(value: string) {
  return clean(value)
    .replace(/^[^\u3400-\u9fffA-Za-z0-9]+/, '')
    .replace(/[^\u3400-\u9fffA-Za-z0-9）)&.·-]+$/, '')
    .trim();
}

function statusMatch(value: string) {
  if (summaryLine.test(value)) return null;
  for (const rule of statusRules) {
    const match = value.match(rule.pattern);
    if (match) return { ...rule, match };
  }
  return null;
}

function findCompany(lines: string[]) {
  for (const line of lines) {
    const labelled = line.match(
      /所属公司\s*[:：]?\s*([^|]{2,100}?)(?=\s*(?:\||所属部门|简历名称|$))/,
    );
    if (labelled) return cleanField(labelled[1]);
  }
  for (const line of lines) {
    const match = line.match(
      /([\u3400-\u9fffA-Za-z0-9（）()·&.-]{2,80}?(?:股份有限公司|有限责任公司|有限公司|集团公司|研究院|银行|事务所|集团(?!股份)))/,
    );
    if (match)
      return cleanField(match[1])
        .replace(/^[号有最]+(?=[\u3400-\u9fff])/, '')
        .trim();
  }
  return '';
}

function inlinePosition(line: string, markerIndex: number) {
  let value = cleanField(line.slice(0, markerIndex));
  const badgeIndex = value.search(
    /(?:校园|社会|实习|校.?|祸园)招聘|20\d{2}(?:届)?(?:校园招聘|校招)/,
  );
  if (badgeIndex >= 2) value = value.slice(0, badgeIndex);
  return cleanField(value);
}

function findPosition(lines: string[], company: string) {
  const labelled = lines
    .map((line) => line.match(/(?:岗位|职位)(?:名称)?\s*[:：]\s*(.{2,100})/)?.[1])
    .find(Boolean);
  if (labelled) return cleanField(labelled);

  for (const line of [...lines].reverse()) {
    const value = cleanField(line);
    if (
      value !== company &&
      !nonPositionLine.test(value) &&
      !/^\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(value) &&
      !/^\d+$/.test(value) &&
      value.length >= 2 &&
      value.length <= 80
    )
      return value;
  }
  return '';
}

function findNotice(lines: string[]) {
  const line = lines.find((value) =>
    /暂停展示|邮件通知|以.*为准|投递进度/.test(value),
  );
  if (!line || summaryLine.test(line)) return '';
  return (
    line.match(/(?:该企业|企业).{0,100}?(?:邮件通知为准|以.*?为准)/)?.[0] ||
    line
  );
}

function timestamp(lines: string[], label: '投递时间' | '更新') {
  const joined = lines.join(' ');
  const pattern =
    label === '投递时间'
      ? /投递时间\s*[:：]?\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2}\s+\d{1,2}:\d{2})/
      : /(\d{4}[-./]\d{1,2}[-./]\d{1,2}\s+\d{1,2}:\d{2})\s*更新/;
  return joined.match(pattern)?.[1] || '';
}

function datePart(value: string) {
  return value ? value.slice(0, 10).replace(/[./]/g, '-') : '';
}

export function parseScreenshotText(text: string): ScreenshotCandidate[] {
  const lines = text
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map(clean)
    .filter(Boolean);
  const anchors = lines
    .map((line, index) => ({ index, status: statusMatch(line) }))
    .filter(
      (item): item is {
        index: number;
        status: NonNullable<ReturnType<typeof statusMatch>>;
      } => Boolean(item.status),
    );
  const candidates: ScreenshotCandidate[] = [];

  for (const [order, anchor] of anchors.entries()) {
    const previousIndex = anchors[order - 1]?.index ?? -1;
    const nextIndex = anchors[order + 1]?.index ?? lines.length;
    const statusLine = lines[anchor.index];
    const markerIndex = anchor.status.match.index ?? -1;
    const titleOnStatusLine = inlinePosition(statusLine, markerIndex);
    const before = lines.slice(
      Math.max(previousIndex + 1, anchor.index - 8),
      anchor.index,
    );
    const after = lines.slice(
      anchor.index + 1,
      Math.min(nextIndex, anchor.index + 9),
    );
    const context = [...before, statusLine, ...after];
    // Card layouts normally put company details after an inline title/status,
    // while list layouts put the company before a standalone status.
    const company = titleOnStatusLine
      ? findCompany([...after, ...before])
      : findCompany([...before].reverse());
    const position =
      titleOnStatusLine && !nonPositionLine.test(titleOnStatusLine)
        ? titleOnStatusLine
        : findPosition(before, company);
    if (!company || !position) continue;

    const appliedAt = timestamp(context, '投递时间');
    const observedAt = timestamp(context, '更新');
    const notice = findNotice(context);
    const progressLabel = anchor.status.match[0].replace(/\s+/g, '');
    const notes = [
      `截图识别：${anchor.status.status}`,
      progressLabel !== anchor.status.status ? `页面进度：${progressLabel}` : '',
      appliedAt ? `投递时间：${appliedAt}` : '',
      observedAt ? `页面更新时间：${observedAt}` : '',
      notice ? `平台提示：${notice}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const job = parseJob({
      ...blankJob(),
      company,
      position,
      status: anchor.status.status,
      applyDate: datePart(appliedAt),
      channel: '官网',
      source: '截图识别 · 请以招聘平台与邮件通知为准',
      notes,
    });
    candidates.push({
      job,
      observedAt,
      appliedAt,
      progressLabel,
      notice,
      raw: context.join('\n'),
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
