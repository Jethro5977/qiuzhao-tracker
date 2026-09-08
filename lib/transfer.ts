import { agenda, blankJob, parseBackup, parseJob, today } from './tracker.ts';
import type { Job } from './tracker.ts';

const COLUMNS: [string, keyof Job][] = [
  ['公司名称', 'company'],
  ['招聘岗位', 'position'],
  ['岗位族', 'roleFamily'],
  ['部门', 'department'],
  ['工作地点', 'location'],
  ['批次', 'batch'],
  ['状态', 'status'],
  ['投递日期', 'applyDate'],
  ['截止日期', 'deadline'],
  ['下一步', 'nextStep'],
  ['日程日期', 'nextDate'],
  ['日程时间', 'nextTime'],
  ['投递渠道', 'channel'],
  ['投递链接', 'applyUrl'],
  ['信息来源', 'source'],
  ['内推人', 'referral'],
  ['岗位编号', 'jobCode'],
  ['优先级', 'priority'],
  ['备注', 'notes'],
];
const ALIASES: Record<string, keyof Job> = {
  公司: 'company',
  岗位: 'position',
  职位: 'position',
  地点: 'location',
  城市: 'location',
  当前状态: 'status',
  截止时间: 'deadline',
  投递截止时间: 'deadline',
  网申链接: 'applyUrl',
  招聘链接: 'applyUrl',
  链接: 'applyUrl',
  来源: 'source',
  下一步日期: 'nextDate',
  招聘对象: 'batch',
};
function csvCell(value: string) {
  // Prevent spreadsheet programs from interpreting exported user text as a formula.
  const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function exportCsv(jobs: Job[]) {
  return (
    '\uFEFF' +
    [
      COLUMNS.map(([label]) => csvCell(label)).join(','),
      ...jobs.map((job) =>
        COLUMNS.map(([, key]) => csvCell(String(job[key] as string))).join(','),
      ),
    ].join('\r\n')
  );
}
export function csvTemplate() {
  return '\uFEFF' + COLUMNS.map(([label]) => csvCell(label)).join(',') + '\r\n';
}
export function parseDelimited(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '');
  const delimiter = input.includes('\t') ? '\t' : ',';
  const rows: string[][] = [],
    row: string[] = [];
  let cell = '',
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || !cell) quoted = !quoted;
      else cell += c;
    } else if (c === delimiter && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(cell);
      rows.push([...row]);
      row.length = 0;
      cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('引号未闭合，请检查 CSV 文件');
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim()));
}
export type ImportResult = { jobs: Job[]; errors: string[] };
export function parseImport(text: string): ImportResult {
  if (text.length > 10_000_000)
    throw new Error('文件过大，请限制在 10 MB 以内');
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (/^(?:\[|\{)/.test(clean)) return { jobs: parseBackup(clean), errors: [] };
  const rows = parseDelimited(clean);
  const lookup = Object.fromEntries(
    COLUMNS.flatMap(([label, key]) => [
      [label, key],
      [key, key],
    ]),
  ) as Record<string, keyof Job>;
  Object.assign(lookup, ALIASES);
  const headerIndex = rows.findIndex(
    (row) =>
      row.some((v) => lookup[v.trim()] === 'company') &&
      row.some((v) => lookup[v.trim()] === 'position'),
  );
  if (headerIndex < 0)
    throw new Error(
      '未找到公司和岗位列。请包含表头，例如「公司名称、招聘岗位、工作地点」。',
    );
  const keys = rows[headerIndex].map((h) => lookup[h.trim()]);
  if (rows.length > 10003) throw new Error('单次最多导入 10000 条');
  const jobs: Job[] = [],
    errors: string[] = [];
  rows.slice(headerIndex + 1).forEach((row, index) => {
    try {
      const raw: Record<string, unknown> = {
        ...blankJob(),
        source: '表格导入 · 未核验线索',
      };
      keys.forEach((key, i) => {
        if (!key || !row[i]?.trim()) return;
        let value = row[i].trim();
        if (/^'[\s]*[=+@-]/.test(value)) value = value.slice(1);
        if (['applyDate', 'deadline', 'nextDate'].includes(key))
          value = value.replace(
            /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/,
            (_, y, m, d) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`,
          );
        raw[key] = value;
      });
      jobs.push(parseJob(raw));
    } catch (e) {
      errors.push(
        `第 ${headerIndex + index + 2} 行：${e instanceof Error ? e.message : '格式无效'}`,
      );
    }
  });
  return { jobs, errors };
}
function escapeIcs(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/[,;]/g, '\\$&');
}
function foldLine(line: string) {
  const encoder = new TextEncoder();
  let bytes = 0,
    result = '';
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 73) {
      result += '\r\n ';
      bytes = 1;
    }
    result += char;
    bytes += size;
  }
  return result;
}
export function exportCalendar(jobs: Job[]) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Qiuzhao Tracker//CN',
    'CALSCALE:GREGORIAN',
  ];
  for (const item of agenda(jobs)) {
    const date = item.date.replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${item.id}@qiuzhao-tracker`,
      `DTSTAMP:${stamp}`,
    );
    if (item.time) {
      // Floating times use the calendar's local timezone, matching the date/time editor.
      lines.push(
        `DTSTART:${date}T${item.time.replace(':', '')}00`,
        'DURATION:PT1H',
      );
    } else {
      const nextDay = new Date(`${item.date}T12:00:00`);
      nextDay.setDate(nextDay.getDate() + 1);
      lines.push(
        `DTSTART;VALUE=DATE:${date}`,
        `DTEND;VALUE=DATE:${today(nextDay).replace(/-/g, '')}`,
      );
    }
    lines.push(
      `SUMMARY:${escapeIcs(`${item.job.company} · ${item.title}`)}`,
      `DESCRIPTION:${escapeIcs(`${item.job.position}\n${item.job.notes}`)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
export function download(
  name: string,
  content: string,
  type = 'application/json',
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
