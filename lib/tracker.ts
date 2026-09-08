export const STORAGE_KEY = 'qiuzhao-tracker-v3';
export const RECOVERY_KEY = 'qiuzhao-tracker-recovery';
export const QQ_SHEET_URL =
  'https://docs.qq.com/sheet/DQUNxdHRXcndkeHFK?tab=986nx3';
export const STATUSES = [
  '待投递',
  '已投递',
  '笔试',
  '一面',
  '二面',
  '终面',
  'HR面',
  '已OC',
  'Offer',
  '感谢信',
  '已放弃',
] as const;
export type Status = (typeof STATUSES)[number];
export const CLOSED: readonly Status[] = ['Offer', '感谢信', '已放弃'];
export const FAMILIES = [
  '其他',
  '前端',
  '后端',
  '客户端',
  '全栈',
  'AI 应用',
  '算法',
  '数据',
  '测试开发',
  'SRE/运维',
  '安全',
  '产品',
  '嵌入式',
  '硬件',
  '金融',
  '运营',
];
export const CHANNELS = [
  '官网',
  '内推',
  '牛客',
  'Boss直聘',
  '公众号',
  '线下宣讲',
  '其他',
];
export type History = { at: string; status: Status; note: string };
export type Job = {
  id: string;
  company: string;
  position: string;
  roleFamily: string;
  department: string;
  location: string;
  batch: string;
  status: Status;
  applyDate: string;
  deadline: string;
  nextStep: string;
  nextDate: string;
  nextTime: string;
  channel: string;
  applyUrl: string;
  source: string;
  referral: string;
  notes: string;
  jobCode: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  history: History[];
};
export type Backup = { schemaVersion: 4; exportedAt: string; jobs: Job[] };

export function today(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function blankJob(): Job {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    company: '',
    position: '',
    roleFamily: '其他',
    department: '',
    location: '',
    batch: '2027届秋招',
    status: '待投递',
    applyDate: '',
    deadline: '',
    nextStep: '',
    nextDate: '',
    nextTime: '',
    channel: '官网',
    applyUrl: '',
    source: '',
    referral: '',
    notes: '',
    jobCode: '',
    priority: '普通',
    createdAt: now,
    updatedAt: now,
    history: [],
  };
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('记录必须是对象');
  return value as Record<string, unknown>;
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
const legacy: Record<string, Status> = {
  已网申: '已投递',
  '三面/终面': '终面',
  已拒: '感谢信',
};
export function parseJob(value: unknown): Job {
  const raw = record(value);
  const job = blankJob();
  for (const key of Object.keys(job) as (keyof Job)[]) {
    if (key === 'history' || raw[key] === undefined || raw[key] === null)
      continue;
    if (key === 'id' && typeof raw[key] === 'number') {
      job.id = String(raw[key]);
      continue;
    }
    if (typeof raw[key] !== 'string') throw new Error(`${key} 必须是文本`);
    (job as unknown as Record<string, unknown>)[key] = raw[key].trim();
  }
  if (!job.id) job.id = crypto.randomUUID();
  if (!job.company || !job.position) throw new Error('公司和岗位不能为空');
  if (
    job.company.length > 200 ||
    job.position.length > 300 ||
    job.notes.length > 30000
  )
    throw new Error('记录内容过长');
  job.status = legacy[job.status] || job.status;
  if (!STATUSES.includes(job.status))
    throw new Error(`无法识别状态：${job.status}`);
  for (const key of ['applyDate', 'deadline', 'nextDate'] as const)
    if (job[key] && !validDate(job[key]))
      throw new Error(`${key} 日期无效，请使用 YYYY-MM-DD`);
  if (job.nextTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(job.nextTime))
    throw new Error('时间无效');
  if (job.nextTime && !job.nextDate)
    throw new Error('填写日程时间时也需要选择日期');
  if (job.applyUrl && !safeUrl(job.applyUrl))
    throw new Error('岗位链接必须是完整的 http 或 https 地址');
  for (const key of ['createdAt', 'updatedAt'] as const)
    if (!Number.isFinite(Date.parse(job[key])))
      throw new Error('记录更新时间无效');
  if (raw.history !== undefined) {
    if (!Array.isArray(raw.history)) throw new Error('流程历史格式无效');
    job.history = raw.history.map((h: unknown) => {
      const entry = record(h);
      if (
        typeof entry.at !== 'string' ||
        !Number.isFinite(Date.parse(entry.at)) ||
        !STATUSES.includes(entry.status as Status) ||
        typeof entry.note !== 'string'
      )
        throw new Error('流程历史内容无效');
      return { at: entry.at, status: entry.status as Status, note: entry.note };
    });
  }
  return job;
}
export function parseBackup(text: string): Job[] {
  const raw: unknown = JSON.parse(text);
  let rows: unknown = raw;
  if (!Array.isArray(raw)) {
    const envelope = record(raw);
    if (envelope.schemaVersion !== 4) throw new Error('不支持此备份版本');
    rows = envelope.jobs;
  }
  if (!Array.isArray(rows) || rows.length > 10000)
    throw new Error('备份应包含不超过 10000 条记录');
  const seen = new Set<string>();
  return rows.map((row, i) => {
    try {
      const job = parseJob(row);
      if (seen.has(job.id)) throw new Error('记录 ID 重复');
      seen.add(job.id);
      return job;
    } catch (error) {
      throw new Error(
        `第 ${i + 1} 条：${error instanceof Error ? error.message : '格式错误'}`,
      );
    }
  });
}
export function encodeBackup(jobs: Job[]) {
  return JSON.stringify(
    {
      schemaVersion: 4,
      exportedAt: new Date().toISOString(),
      jobs,
    } satisfies Backup,
    null,
    2,
  );
}
export function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : '';
  } catch {
    return '';
  }
}
export function normalize(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s·•()（）]/g, '');
}
export function companyKey(value: string) {
  const key = normalize(value).replace(
    /(股份有限公司|有限责任公司|有限公司|集团公司|集团)$/g,
    '',
  );
  const aliases: Record<string, string> = {
    tencent: '腾讯',
    bytedance: '字节跳动',
    字节: '字节跳动',
    alibaba: '阿里巴巴',
  };
  return aliases[key] || key;
}
export function canonicalUrl(value: string) {
  if (!safeUrl(value)) return '';
  const url = new URL(value);
  for (const key of url.searchParams.keys())
    if (/^(utm_.+|spm|from|source|ref|referrer)$/i.test(key))
      url.searchParams.delete(key);
  url.searchParams.sort();
  // Preserve all identity-bearing query parameters and hash routes.
  return `${url.origin}${url.pathname.replace(/\/$/, '')}${url.search}${url.hash}`;
}
function overlapping(a: string, b: string) {
  if (!a || !b || /全国|不限/.test(a + b)) return true;
  const split = (s: string) =>
    normalize(s)
      .split(/[、,，/;；|]+/)
      .map((p) => p.replace(/市$/, ''));
  return split(a).some((p) => split(b).includes(p));
}
export type Duplicate = { job: Job; reason: string };
export function duplicates(candidate: Job, jobs: Job[]): Duplicate[] {
  return jobs.flatMap((job) => {
    if (
      job.id === candidate.id ||
      normalize(job.batch) !== normalize(candidate.batch)
    )
      return [];
    if (companyKey(job.company) !== companyKey(candidate.company)) return [];
    if (
      job.jobCode &&
      candidate.jobCode &&
      normalize(job.jobCode) !== normalize(candidate.jobCode)
    )
      return [];
    let reason = '';
    if (
      candidate.jobCode &&
      normalize(candidate.jobCode) === normalize(job.jobCode)
    )
      reason = '同公司、批次和岗位编号';
    else if (
      normalize(job.position) === normalize(candidate.position) &&
      overlapping(job.location, candidate.location)
    )
      reason = '岗位名称相同且工作地点重叠';
    else if (
      candidate.applyUrl &&
      canonicalUrl(candidate.applyUrl) === canonicalUrl(job.applyUrl) &&
      overlapping(job.location, candidate.location)
    )
      reason = '投递链接相同，请确认是否为通用入口';
    else if (
      candidate.roleFamily !== '其他' &&
      candidate.roleFamily === job.roleFamily &&
      overlapping(job.location, candidate.location)
    )
      reason = '同岗位方向、批次且地点重叠，请核对部门';
    return reason ? [{ job, reason }] : [];
  });
}
export function mergeJobs(existing: Job[], incoming: Job[]) {
  const added: Job[] = [],
    skipped: { job: Job; reason: string }[] = [];
  for (const job of incoming) {
    const sameId = existing.find((j) => j.id === job.id);
    const dup = duplicates(job, [...existing, ...added])[0];
    if (sameId || dup)
      skipped.push({
        job,
        reason: sameId ? 'ID 已存在，保留现有进度' : dup.reason,
      });
    else added.push(job);
  }
  return { jobs: [...existing, ...added], added, skipped };
}
export function saveRecord(candidate: Job, previous?: Job): Job {
  const job = parseJob(candidate),
    at = new Date().toISOString();
  job.createdAt = previous?.createdAt || at;
  job.updatedAt = at;
  job.history = previous?.history || [];
  if (!previous || job.status !== previous.status)
    job.history = [
      ...job.history,
      {
        at,
        status: job.status,
        note: previous
          ? `状态更新：${previous.status} → ${job.status}`
          : '建立投递记录',
      },
    ];
  if (
    job.status !== '待投递' &&
    !job.applyDate &&
    (!previous || previous.status === '待投递')
  )
    job.applyDate = today();
  return job;
}
export function completeNext(job: Job): Job {
  const at = new Date().toISOString();
  return {
    ...job,
    nextStep: '',
    nextDate: '',
    nextTime: '',
    updatedAt: at,
    history: [
      ...job.history,
      {
        at,
        status: job.status,
        note: `完成日程：${job.nextStep || job.status}（${job.nextDate} ${job.nextTime}）`,
      },
    ],
  };
}
export function dayDistance(date: string, base = today()) {
  return Math.round(
    (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${base}T12:00:00Z`)) /
      86400000,
  );
}
export type AgendaItem = {
  id: string;
  job: Job;
  kind: '日程' | '截止';
  date: string;
  time: string;
  title: string;
  overdue: boolean;
};
export function agenda(jobs: Job[], now = new Date()): AgendaItem[] {
  const result: AgendaItem[] = [];
  for (const job of jobs) {
    if (CLOSED.includes(job.status)) continue;
    if (job.nextDate)
      result.push({
        id: `${job.id}-next`,
        job,
        kind: '日程',
        date: job.nextDate,
        time: job.nextTime,
        title: job.nextStep || job.status,
        overdue: job.nextTime
          ? new Date(`${job.nextDate}T${job.nextTime}`).getTime() <
            now.getTime()
          : job.nextDate < today(now),
      });
    if (job.status === '待投递' && job.deadline)
      result.push({
        id: `${job.id}-deadline`,
        job,
        kind: '截止',
        date: job.deadline,
        time: '',
        title: '投递截止',
        overdue: job.deadline < today(now),
      });
  }
  return result.sort((a, b) =>
    `${a.date} ${a.time || '23:59'}`.localeCompare(
      `${b.date} ${b.time || '23:59'}`,
    ),
  );
}
