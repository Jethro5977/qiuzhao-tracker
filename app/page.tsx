'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  FileSpreadsheet,
  LayoutGrid,
  ListFilter,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useTracker } from '@/hooks/use-tracker';
import { CatalogLookup } from '@/components/catalog-lookup';
import { ScreenshotImport } from '@/components/screenshot-import';
import { DRAFT_KEY, parseDraft } from '@/lib/draft';
import type { Draft } from '@/lib/draft';
import {
  agenda,
  blankJob,
  CHANNELS,
  CLOSED,
  completeNext,
  dayDistance,
  duplicates,
  encodeBackup,
  FAMILIES,
  JOB_SOURCES,
  mergeJobs,
  parseJob,
  safeUrl,
  saveRecord,
  STATUSES,
  STORAGE_KEY,
  today,
} from '@/lib/tracker';
import type { Job, Status } from '@/lib/tracker';
import {
  csvTemplate,
  download,
  exportCalendar,
  exportCsv,
  parseImport,
} from '@/lib/transfer';
import type { ImportResult } from '@/lib/transfer';

type View = 'table' | 'kanban' | 'agenda';
const STYLE: Record<Status, string> = {
  待投递: 'status-slate',
  已投递: 'status-blue',
  笔试: 'status-amber',
  一面: 'status-pink',
  二面: 'status-violet',
  终面: 'status-indigo',
  HR面: 'status-cyan',
  已OC: 'status-green',
  Offer: 'status-green',
  感谢信: 'status-red',
  已放弃: 'status-zinc',
};
type ModelTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
declare global {
  interface Document {
    modelContext?: {
      registerTool: (
        tool: ModelTool,
        options?: { signal?: AbortSignal },
      ) => void | Promise<void>;
    };
  }
}

function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge className={'status-pill ' + STYLE[status]} variant="secondary">
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </Badge>
  );
}
function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? 'md:col-span-2' : ''}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <NativeSelect
      aria-label={label}
      className="w-full"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {(options.includes(value) ? options : [value, ...options]).map((v) => (
        <NativeSelectOption key={v} value={v}>
          {v}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
function When({
  date,
  time,
  base,
}: {
  date: string;
  time?: string;
  base: string;
}) {
  const distance = dayDistance(date, base);
  return (
    <span
      className={
        distance < 0
          ? 'text-rose-700'
          : distance <= 2
            ? 'text-amber-800'
            : 'text-slate-600'
      }
    >
      {date.slice(5)}
      {time ? ' ' + time : ''} ·{' '}
      {distance < 0
        ? '逾期 ' + Math.abs(distance) + ' 天'
        : distance === 0
          ? '今天'
          : distance === 1
            ? '明天'
            : distance + ' 天后'}
    </span>
  );
}

export default function Home() {
  const store = useTracker();
  const [view, setView] = useState<View>('table');
  const [scope, setScope] = useState('全部');
  const [filter, setFilter] = useState('全部状态');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('下一日程优先');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<Job | null>(null);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const draftRaw = useRef<string | null>(null);
  const draftReady = useRef(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
  const [lastDeleted, setLastDeleted] = useState<Job | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [pending, setPending] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState('');
  const [now, setNow] = useState(() => new Date());
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const base = today(now);
  useEffect(() => {
    try {
      draftRaw.current = localStorage.getItem(DRAFT_KEY);
      if (draftRaw.current) setDraft(parseDraft(draftRaw.current));
      draftReady.current = true;
    } catch {
      setDraftMessage('草稿无法读取，已保留原始副本。请导出或检查浏览器存储。');
    }
  }, []);

  function persistDraft(job: Job, original: string | null) {
    try {
      if (!draftReady.current) throw new Error('草稿存储尚未就绪');
      if (localStorage.getItem(DRAFT_KEY) !== draftRaw.current)
        throw new Error('另一窗口已更新草稿，请刷新后继续');
      const next = {
        job,
        baseline: original,
        savedAt: new Date().toISOString(),
      };
      const raw = JSON.stringify(next);
      localStorage.setItem(DRAFT_KEY, raw);
      draftRaw.current = raw;
      setDraft(next);
      setDraftMessage('草稿已自动保存到本机');
    } catch (e) {
      setDraftMessage(
        `草稿未保存：${e instanceof Error ? e.message : '存储空间不足'}`,
      );
    }
  }
  function clearDraft() {
    try {
      if (localStorage.getItem(DRAFT_KEY) !== draftRaw.current) return;
      localStorage.removeItem(DRAFT_KEY);
      draftRaw.current = null;
      setDraft(null);
      setDraftMessage('');
    } catch {
      setDraftMessage('记录已保存，但旧草稿未能清除');
    }
  }

  const notify = useCallback((message: string) => {
    setNotice(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(''), 5000);
  }, []);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = setInterval(tick, 60000);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', tick);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const addFromTool = useCallback(
    (input: unknown) => {
      if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new Error('请输入岗位对象');
      const raw = input as Record<string, unknown>;
      const allowed = [
        'company',
        'position',
        'roleFamily',
        'location',
        'batch',
        'applyUrl',
        'jobCode',
      ];
      if (Object.keys(raw).some((key) => !allowed.includes(key)))
        throw new Error('包含不支持的字段');
      const candidate = parseJob({ ...blankJob(), ...raw });
      const match = duplicates(candidate, store.current.current)[0];
      if (match)
        throw new Error(
          '疑似重复：' + match.job.company + ' · ' + match.job.position,
        );
      const job = saveRecord(candidate);
      store.commit([...store.current.current, job]);
      notify('已新增 ' + job.company);
      return {
        id: job.id,
        status: job.status,
        company: job.company,
        position: job.position,
      };
    },
    [store, notify],
  );
  useEffect(() => {
    if (!store.ready || !document.modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const registry = document.modelContext;
    const register = (tool: ModelTool) => {
      try {
        Promise.resolve(
          registry.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => undefined);
      } catch {
        /* Unsupported browser implementations do not block the tracker. */
      }
    };
    register({
      name: 'add_job_application',
      title: '新增秋招投递记录',
      description:
        '在本机台账新增待投递岗位；检测重复，成功持久保存后返回。仅支持列出的字段。',
      inputSchema: {
        type: 'object',
        properties: Object.fromEntries(
          [
            'company',
            'position',
            'roleFamily',
            'location',
            'batch',
            'applyUrl',
            'jobCode',
          ].map((key) => [key, { type: 'string' }]),
        ),
        required: ['company', 'position'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: addFromTool,
    });
    register({
      name: 'list_job_applications',
      title: '查看投递进度',
      description:
        '读取本机台账的公司、岗位、状态和日程，可按公司或岗位关键词过滤。',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input))
          throw new Error('请输入查询对象');
        const raw = input as Record<string, unknown>;
        if (
          Object.keys(raw).some((k) => k !== 'query') ||
          (raw.query !== undefined && typeof raw.query !== 'string')
        )
          throw new Error('查询字段无效');
        const q = String(raw.query || '').toLowerCase();
        return store.current.current
          .filter((j) =>
            (j.company + ' ' + j.position).toLowerCase().includes(q),
          )
          .map(({ id, company, position, status, nextDate, nextTime }) => ({
            id,
            company,
            position,
            status,
            nextDate,
            nextTime,
          }));
      },
    });
    return () => lifecycle.abort();
  }, [store.ready, store, addFromTool]);

  const items = useMemo(
    () =>
      store.jobs
        .filter((j) => {
          const inScope =
            scope === '全部' ||
            (scope === '待投递'
              ? j.status === '待投递'
              : scope === '进行中'
                ? !CLOSED.includes(j.status) && j.status !== '待投递'
                : CLOSED.includes(j.status));
          return (
            inScope &&
            (filter === '全部状态' || j.status === filter) &&
            [
              j.company,
              j.position,
              j.department,
              j.location,
              j.notes,
              j.batch,
              j.jobCode,
            ]
              .join(' ')
              .toLowerCase()
              .includes(query.trim().toLowerCase())
          );
        })
        .sort((a, b) => {
          if (sort === '最近投递')
            return b.applyDate.localeCompare(a.applyDate);
          if (sort === '投递截止优先')
            return (a.deadline || '9999').localeCompare(b.deadline || '9999');
          if (sort === '公司名称')
            return a.company.localeCompare(b.company, 'zh-CN');
          if (sort === '重点岗位优先')
            return (
              Number(b.priority === '重点') - Number(a.priority === '重点')
            );
          return ((a.nextDate || '9999') + a.nextTime).localeCompare(
            (b.nextDate || '9999') + b.nextTime,
          );
        }),
    [store.jobs, scope, filter, query, sort],
  );
  const allAgenda = useMemo(() => agenda(store.jobs, now), [store.jobs, now]);
  const visibleAgenda = useMemo(() => agenda(items, now), [items, now]);
  const urgent = allAgenda.filter(
    (a) => a.overdue || dayDistance(a.date, base) <= 7,
  );
  const totalPages = Math.max(1, Math.ceil(items.length / 20));
  const activePage = Math.min(page, totalPages);
  const pageItems = items.slice((activePage - 1) * 20, activePage * 20);
  const matches =
    editor && editor.company && editor.position
      ? duplicates(editor, store.jobs)
      : [];
  const merge = pending ? mergeJobs(store.jobs, pending.jobs) : null;

  function openEditor(job?: Job) {
    if (job && draft && job.id !== draft.job.id) {
      notify('请先保存或丢弃现有草稿，再编辑其他岗位。');
      return;
    }
    if (job && draft?.job.id === job.id) {
      setEditor(structuredClone(draft.job));
      setBaseline(draft.baseline);
      setAcknowledged(false);
      setFormError('');
      return;
    }
    if (draft && !job) {
      setEditor(structuredClone(draft.job));
      setBaseline(draft.baseline);
      setAcknowledged(false);
      setFormError('');
      return;
    }
    setEditor(job ? structuredClone(job) : blankJob());
    setBaseline(job?.updatedAt || null);
    setAcknowledged(false);
    setFormError('');
  }
  function change(key: keyof Job, value: string) {
    if (!editor) return;
    setEditor({ ...editor, [key]: value });
    persistDraft({ ...editor, [key]: value }, baseline);
    setAcknowledged(false);
    setFormError('');
  }
  function save() {
    if (!editor) return;
    try {
      const previous = store.current.current.find((j) => j.id === editor.id);
      if (baseline && previous?.updatedAt !== baseline)
        throw new Error('此记录已在另一窗口更新或删除，请取消后重新打开。');
      if (matches.length && !acknowledged)
        throw new Error('请先核对重复岗位并勾选确认。');
      const job = saveRecord(editor, previous);
      store.commit(
        previous
          ? store.current.current.map((j) => (j.id === job.id ? job : j))
          : [...store.current.current, job],
      );
      setEditor(null);
      clearDraft();
      notify('记录已保存');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '保存失败');
    }
  }
  function finish(job: Job) {
    try {
      store.commit(
        store.current.current.map((j) =>
          j.id === job.id ? completeNext(j) : j,
        ),
      );
      notify('日程已完成，已加入流程历史');
    } catch (e) {
      notify(e instanceof Error ? e.message : '保存失败');
    }
  }
  function preview(text: string) {
    try {
      setPending(parseImport(text));
      setImportError('');
    } catch (e) {
      setPending(null);
      setImportError(e instanceof Error ? e.message : '读取失败');
    }
  }
  async function readFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error('文件不能超过 10 MB');
      preview(await file.text());
    } catch (e) {
      setImportError(e instanceof Error ? e.message : '无法读取文件');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }
  function confirmImport() {
    if (!pending) return;
    try {
      const latest = mergeJobs(store.current.current, pending.jobs);
      store.commit(latest.jobs);
      setPending(null);
      setPasted('');
      setImportOpen(false);
      notify(
        '新增 ' +
          latest.added.length +
          ' 条，跳过 ' +
          latest.skipped.length +
          ' 条疑似重复记录',
      );
    } catch (e) {
      setImportError(e instanceof Error ? e.message : '导入失败');
    }
  }
  function exportFile(kind: 'json' | 'csv' | 'ics' | 'raw') {
    try {
      if (kind === 'raw')
        download(
          '秋招原始数据.txt',
          localStorage.getItem(STORAGE_KEY) || '',
          'text/plain',
        );
      else if (kind === 'json')
        download('秋招完整备份-' + base + '.json', encodeBackup(store.jobs));
      else if (kind === 'csv')
        download(
          '秋招汇总表-' + base + '.csv',
          exportCsv(store.jobs),
          'text/csv;charset=utf-8',
        );
      else
        download(
          '秋招日程-' + base + '.ics',
          exportCalendar(store.jobs),
          'text/calendar;charset=utf-8',
        );
      notify('已导出文件');
    } catch {
      notify('导出失败，请检查浏览器权限');
    }
  }

  if (!store.ready)
    return (
      <main className="grid min-h-screen place-items-center">
        <p aria-live="polite">正在读取本机台账…</p>
      </main>
    );
  return (
    <main className="min-h-screen pb-16">
      <div className="top-accent" />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-blue-600 text-white">
              <BriefcaseBusiness />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                秋招投递台账
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                2027 届 · 岗位、笔试与面试进度
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <ArrowUpFromLine />
              批量导入
            </Button>
            <Button variant="outline" onClick={() => setExportOpen(true)}>
              <ArrowDownToLine />
              导出与备份
            </Button>
            <Button disabled={store.blocked} onClick={() => openEditor()}>
              <Plus />
              新增岗位
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-8">
        <output className="mb-3 block text-sm text-slate-600">
          {store.error
            ? '保存异常，请查看下方提示'
            : `自动保存已开启 · 本机存储${store.savedAt ? ' · 最近保存 ' + store.savedAt : ''}`}{' '}
          · 编辑内容实时保存为草稿，点击保存记录后加入台账。
        </output>
        {draft && !editor && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <span>
              有未提交草稿：{draft.job.company || '未填写公司'} ·{' '}
              {draft.job.position || '未填写岗位'}
            </span>
            <Button variant="outline" onClick={() => openEditor()}>
              继续编辑
            </Button>
            <Button variant="ghost" onClick={clearDraft}>
              丢弃草稿
            </Button>
          </div>
        )}
        <CatalogLookup
          onSelect={(job) => {
            if (draft) {
              notify('请先保存或丢弃现有草稿，再按序号录入。');
              return;
            }
            setEditor(job);
            setBaseline(null);
            setAcknowledged(false);
            setFormError('');
            persistDraft(job, null);
          }}
        />
        <ScreenshotImport
          disabled={store.blocked}
          onSelect={(job) => {
            if (draft) {
              notify('请先保存或丢弃现有草稿，再从截图录入。');
              return;
            }
            setEditor(job);
            setBaseline(null);
            setAcknowledged(false);
            setFormError('');
            persistDraft(job, null);
          }}
        />
        {store.error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900"
          >
            <p>{store.error}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => exportFile('raw')}>
                导出原始数据
              </Button>
              <Button variant="outline" onClick={store.reload}>
                重新读取
              </Button>
              {store.hasRecovery && (
                <Button variant="outline" onClick={() => setRestoreOpen(true)}>
                  恢复上次备份
                </Button>
              )}
            </div>
          </div>
        )}
        <section
          aria-label="投递统计"
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          {[
            {
              label: '已投递岗位',
              n: store.jobs.filter((j) => j.applyDate || j.status !== '待投递')
                .length,
              note: '累计投递记录',
              color: 'bg-blue-500',
            },
            {
              label: '流程进行中',
              n: store.jobs.filter(
                (j) => !CLOSED.includes(j.status) && j.status !== '待投递',
              ).length,
              note: '笔试 · 面试 · 等待反馈',
              color: 'bg-violet-500',
            },
            {
              label: '需要关注',
              n: urgent.length,
              note: '逾期或未来 7 天日程',
              color: 'bg-amber-500',
            },
            {
              label: '已获 Offer',
              n: store.jobs.filter((j) => j.status === 'Offer').length,
              note: '正式录用通知',
              color: 'bg-emerald-500',
            },
          ].map((m) => (
            <div className="metric-card" key={m.label}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-600">{m.label}</span>
                <span className={'size-2 rounded-full ' + m.color} />
              </div>
              <strong className="mt-3 block text-3xl font-semibold tracking-tight">
                {m.n}
              </strong>
              <span className="mt-2 block text-xs text-slate-500">
                {m.note}
              </span>
            </div>
          ))}
        </section>
        <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="surface min-w-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
              <div>
                <h2 className="font-semibold">
                  我的岗位{' '}
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    {store.jobs.length} 条
                  </span>
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  投递前先搜索公司或岗位编号
                </p>
              </div>
              <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                {(
                  [
                    { v: 'table', label: '汇总表', Icon: ListFilter },
                    { v: 'kanban', label: '进度看板', Icon: LayoutGrid },
                    { v: 'agenda', label: '日程', Icon: CalendarClock },
                  ] as const
                ).map(({ v, label, Icon }) => (
                  <Button
                    key={v}
                    variant={view === v ? 'outline' : 'ghost'}
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                  >
                    <Icon />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-[minmax(180px,1fr)_150px_160px]">
              <div className="relative">
                <Search
                  aria-hidden
                  className="absolute left-3 top-3 size-4 text-slate-400"
                />
                <Input
                  aria-label="搜索岗位"
                  className="pl-9"
                  placeholder="公司 / 岗位 / 编号 / 地点"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <Select
                label="状态筛选"
                value={filter}
                options={['全部状态', ...STATUSES]}
                onChange={(v) => {
                  setFilter(v);
                  setPage(1);
                }}
              />
              <Select
                label="排序方式"
                value={sort}
                options={[
                  '下一日程优先',
                  '最近投递',
                  '投递截止优先',
                  '公司名称',
                  '重点岗位优先',
                ]}
                onChange={(v) => {
                  setSort(v);
                  setPage(1);
                }}
              />
            </div>
            <Tabs
              value={scope}
              onValueChange={(v) => {
                setScope(String(v));
                setPage(1);
              }}
            >
              <TabsList className="mx-4 mb-3" aria-label="岗位范围">
                {['全部', '待投递', '进行中', '已结束'].map((v) => (
                  <TabsTrigger key={v} value={v} className="px-3">
                    {v}
                  </TabsTrigger>
                ))}
              </TabsList>
              {['全部', '待投递', '进行中', '已结束'].map((v) => (
                <TabsContent key={v} value={v}>
                  {items.length === 0 ? (
                    <div className="px-6 py-16 text-center">
                      <BriefcaseBusiness className="mx-auto mb-4 size-9 text-blue-400" />
                      <h3 className="text-lg font-semibold">
                        {store.jobs.length
                          ? '没有匹配的岗位'
                          : '从第一条投递开始'}
                      </h3>
                      <p className="mx-auto mt-2 max-w-sm text-base leading-7 text-slate-500">
                        {store.jobs.length
                          ? '试试其他关键词或筛选条件。'
                          : '添加正在申请的岗位，记录下一场笔试或面试。也可以从已有表格批量导入。'}
                      </p>
                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        {store.jobs.length ? (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setScope('全部');
                              setFilter('全部状态');
                              setQuery('');
                            }}
                          >
                            清除筛选
                          </Button>
                        ) : (
                          <>
                            <Button
                              disabled={store.blocked}
                              onClick={() => openEditor()}
                            >
                              <Plus />
                              添加第一条岗位
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setImportOpen(true)}
                            >
                              导入已有记录
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : view === 'table' ? (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="pl-4">公司 / 岗位</TableHead>
                            <TableHead>进度</TableHead>
                            <TableHead>下一步 / 截止</TableHead>
                            <TableHead>投递信息</TableHead>
                            <TableHead className="pr-4 text-right">
                              操作
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pageItems.map((job) => (
                            <TableRow key={job.id}>
                              <TableCell className="min-w-[220px] pl-4">
                                <button
                                  className="record-title"
                                  onClick={() => openEditor(job)}
                                >
                                  {job.company}
                                  {job.priority === '重点' && (
                                    <span className="ml-2 text-xs text-amber-700">
                                      重点
                                    </span>
                                  )}
                                </button>
                                <p className="max-w-[280px] whitespace-normal text-sm text-slate-700">
                                  {job.position}
                                </p>
                                <p className="mt-1 max-w-[280px] whitespace-normal text-xs text-slate-500">
                                  {[job.location, job.department, job.jobCode]
                                    .filter(Boolean)
                                    .join(' · ') || '地点未填写'}
                                </p>
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={job.status} />
                              </TableCell>
                              <TableCell className="min-w-[210px]">
                                <p className="max-w-[260px] whitespace-normal text-sm">
                                  {job.nextStep ||
                                    (job.nextDate ? job.status : '暂无待办')}
                                </p>
                                {job.nextDate && (
                                  <div className="mt-1 text-sm">
                                    <When
                                      date={job.nextDate}
                                      time={job.nextTime}
                                      base={base}
                                    />
                                  </div>
                                )}
                                {job.deadline && job.status === '待投递' && (
                                  <div className="mt-1 text-sm">
                                    <span className="mr-1">截止</span>
                                    <When date={job.deadline} base={base} />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <p className="text-sm">
                                  {job.applyDate || '尚未投递'}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {job.batch} · {job.channel}
                                </p>
                              </TableCell>
                              <TableCell className="pr-4">
                                <div className="flex justify-end gap-1">
                                  {safeUrl(job.applyUrl) && (
                                    <a
                                      className="icon-link"
                                      aria-label={
                                        '打开 ' + job.company + ' 岗位链接'
                                      }
                                      href={safeUrl(job.applyUrl)}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <ExternalLink className="size-4" />
                                    </a>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={
                                      '编辑 ' + job.company + ' ' + job.position
                                    }
                                    onClick={() => openEditor(job)}
                                  >
                                    <Pencil />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-slate-500">
                        <span>筛选后 {items.length} 条</span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={activePage === 1}
                            aria-label="上一页"
                            onClick={() => setPage(activePage - 1)}
                          >
                            <ChevronLeft />
                          </Button>
                          <span>
                            {activePage} / {totalPages}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={activePage === totalPages}
                            aria-label="下一页"
                            onClick={() => setPage(activePage + 1)}
                          >
                            <ChevronRight />
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : view === 'kanban' ? (
                    <div className="flex gap-4 overflow-x-auto p-4">
                      {STATUSES.map((status) => (
                        <section
                          className="w-[245px] shrink-0 rounded-xl bg-slate-50 p-3"
                          key={status}
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <StatusBadge status={status} />
                            <span className="text-sm text-slate-500">
                              {items.filter((j) => j.status === status).length}
                            </span>
                          </div>
                          <div className="space-y-3">
                            {items
                              .filter((j) => j.status === status)
                              .map((job) => (
                                <button
                                  className="kanban-card"
                                  key={job.id}
                                  onClick={() => openEditor(job)}
                                >
                                  <span className="block font-semibold">
                                    {job.company}
                                  </span>
                                  <span className="mt-1 block text-sm">
                                    {job.position}
                                  </span>
                                  <span className="mt-2 block text-xs text-slate-500">
                                    {job.location || '地点未填写'} · {job.batch}
                                  </span>
                                  {job.nextDate && (
                                    <span className="mt-3 block text-sm">
                                      <When
                                        date={job.nextDate}
                                        time={job.nextTime}
                                        base={base}
                                      />
                                    </span>
                                  )}
                                </button>
                              ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4">
                      <p className="mb-3 text-sm text-slate-500">
                        全部未完成日程与待投递截止时间。时间按当前设备时区显示。
                      </p>
                      {visibleAgenda.length === 0 && (
                        <p className="py-12 text-center text-slate-500">
                          尚未安排日程，可在岗位详情中添加。
                        </p>
                      )}
                      {visibleAgenda.map((item) => (
                        <div
                          className={
                            'agenda-row ' +
                            (item.overdue
                              ? 'border-l-rose-400'
                              : 'border-l-blue-400')
                          }
                          key={item.id}
                        >
                          <div className="flex-1">
                            <span className="text-sm">
                              <When
                                date={item.date}
                                time={item.time}
                                base={base}
                              />
                              {item.overdue && (
                                <span className="ml-2 text-rose-700">
                                  待跟进
                                </span>
                              )}
                            </span>
                            <button
                              className="record-title mt-1 block"
                              onClick={() => openEditor(item.job)}
                            >
                              {item.job.company} · {item.title}
                            </button>
                            <p className="text-sm text-slate-500">
                              {item.job.position}
                            </p>
                          </div>
                          {item.kind === '日程' ? (
                            <Button
                              variant="outline"
                              disabled={store.blocked}
                              onClick={() => finish(item.job)}
                            >
                              <Check />
                              完成
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              onClick={() => openEditor(item.job)}
                            >
                              更新投递
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </section>
          <aside className="space-y-4">
            <section className="surface p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold">
                  <CalendarClock className="size-5 text-blue-600" />
                  近期要做
                </h2>
                <span className="text-sm text-slate-500">
                  {urgent.length} 项
                </span>
              </div>
              {urgent.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  aria-label={'打开 ' + item.job.company + ' 的待办'}
                  className="schedule-row text-left"
                  onClick={() => openEditor(item.job)}
                >
                  <span
                    className={
                      'date-block ' + (item.overdue ? 'date-block-urgent' : '')
                    }
                  >
                    <strong>{item.date.slice(8)}</strong>
                    <small>{item.date.slice(5, 7)}月</small>
                  </span>
                  <span className="min-w-0">
                    <strong className="block text-sm">
                      {item.job.company} · {item.title}
                    </strong>
                    <span
                      className={
                        'mt-1 block text-sm ' +
                        (item.overdue ? 'text-rose-700' : 'text-slate-500')
                      }
                    >
                      {item.overdue
                        ? '已逾期，请跟进'
                        : item.time ||
                          (item.kind === '截止' ? '当日截止' : '时间待定')}
                    </span>
                  </span>
                </button>
              ))}
              {urgent.length === 0 && (
                <p className="py-6 text-center text-sm leading-6 text-slate-500">
                  未来 7 天暂无日程。
                  <br />
                  安排笔面试后会显示在这里。
                </p>
              )}
              <Button
                className="mt-3 w-full"
                variant="outline"
                onClick={() => {
                  setView('agenda');
                  setScope('全部');
                  setFilter('全部状态');
                  setQuery('');
                }}
              >
                查看全部日程
              </Button>
            </section>
            <section className="source-card">
              <FileSpreadsheet className="mb-3 size-6" />
              <h2 className="font-semibold">27 届实时岗位来源</h2>
              <p className="mt-2 text-sm leading-6 text-blue-100">
                查看腾讯原表，使用有权限获取的源表建立序号索引。开放状态请以招聘官网为准。
              </p>
              <div className="mt-4 space-y-2">
                {JOB_SOURCES.map((source, index) => (
                  <a
                    className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                    href={source.url}
                    key={source.id}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-normal text-blue-500">
                        来源 {index + 1}
                      </span>
                      <span className="block truncate">{source.name}</span>
                    </span>
                    <ExternalLink className="size-4 shrink-0" />
                  </a>
                ))}
              </div>
              <p className="mt-3 text-xs text-blue-100">
                当前采用手动导入，未接入自动同步。
              </p>
            </section>
            <section className="rounded-xl border border-slate-200 p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4 text-blue-600" />
                本机保存，定期备份
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                记录只保存在当前浏览器。换设备或清理浏览器前，请导出完整 JSON
                备份；CSV 用于表格查看。
              </p>
              {store.hasRecovery && (
                <Button
                  variant="link"
                  className="mt-1 px-0"
                  onClick={() => setRestoreOpen(true)}
                >
                  恢复上次写入前的数据
                </Button>
              )}
            </section>
          </aside>
        </div>
      </div>

      <Dialog
        open={Boolean(editor)}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {baseline ? '岗位详情与进度' : '新增岗位'}
            </DialogTitle>
            <DialogDescription>
              必填公司与岗位。更新状态会保留流程历史；时间使用当前设备时区。
              输入内容会自动保存为草稿，刷新后可继续编辑。
            </DialogDescription>
          </DialogHeader>
          {editor && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
              className="space-y-5"
            >
              <output className="block text-sm text-slate-600">
                {draftMessage || '开始输入后自动保存草稿'}
              </output>
              {formError && (
                <p
                  role="alert"
                  className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800"
                >
                  {formError}
                </p>
              )}
              {matches.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <p className="flex items-center gap-2 font-semibold">
                    <CircleAlert className="size-4" />
                    发现 {matches.length} 条疑似重复
                  </p>
                  {matches.slice(0, 3).map((m) => (
                    <p key={m.job.id} className="mt-2">
                      {m.job.company} · {m.job.position}（{m.job.status}）<br />
                      <span className="text-amber-800">{m.reason}</span>
                    </p>
                  ))}
                  <div className="mt-3 flex items-center gap-2">
                    <Checkbox
                      aria-label="确认这是不同岗位"
                      checked={acknowledged}
                      onCheckedChange={(checked) =>
                        setAcknowledged(Boolean(checked))
                      }
                    />
                    <span>已核对，确为不同岗位，仍需保存</span>
                  </div>
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="公司 *">
                  <Input
                    required
                    maxLength={200}
                    value={editor.company}
                    onChange={(e) => change('company', e.target.value)}
                    placeholder="公司名称"
                  />
                </Field>
                <Field label="岗位 *">
                  <Input
                    required
                    maxLength={300}
                    value={editor.position}
                    onChange={(e) => change('position', e.target.value)}
                    placeholder="岗位完整名称"
                  />
                </Field>
                <Field label="岗位编号">
                  <Input
                    value={editor.jobCode}
                    onChange={(e) => change('jobCode', e.target.value)}
                    placeholder="官网岗位 ID，可用于精确去重"
                  />
                </Field>
                <Field label="岗位方向">
                  <Select
                    label="岗位方向"
                    value={editor.roleFamily}
                    options={FAMILIES}
                    onChange={(v) => change('roleFamily', v)}
                  />
                </Field>
                <Field label="部门 / 事业群">
                  <Input
                    value={editor.department}
                    onChange={(e) => change('department', e.target.value)}
                  />
                </Field>
                <Field label="工作地点">
                  <Input
                    value={editor.location}
                    onChange={(e) => change('location', e.target.value)}
                    placeholder="北京、深圳"
                  />
                </Field>
                <Field label="招聘批次">
                  <Input
                    value={editor.batch}
                    onChange={(e) => change('batch', e.target.value)}
                  />
                </Field>
                <Field label="优先级">
                  <Select
                    label="优先级"
                    value={editor.priority}
                    options={['普通', '重点', '低优先级']}
                    onChange={(v) => change('priority', v)}
                  />
                </Field>
                <Field label="当前进度">
                  <Select
                    label="当前进度"
                    value={editor.status}
                    options={STATUSES}
                    onChange={(v) => change('status', v)}
                  />
                </Field>
                <Field label="投递渠道">
                  <Select
                    label="投递渠道"
                    value={editor.channel}
                    options={CHANNELS}
                    onChange={(v) => change('channel', v)}
                  />
                </Field>
                <Field label="投递日期">
                  <Input
                    type="date"
                    value={editor.applyDate}
                    onChange={(e) => change('applyDate', e.target.value)}
                  />
                </Field>
                <Field label="投递截止日期">
                  <Input
                    type="date"
                    value={editor.deadline}
                    onChange={(e) => change('deadline', e.target.value)}
                  />
                </Field>
                <Field label="下一步事项" wide>
                  <Input
                    value={editor.nextStep}
                    onChange={(e) => change('nextStep', e.target.value)}
                    placeholder="例如：在线笔试、二面、联系 HR 确认进度"
                  />
                </Field>
                <Field label="日程日期">
                  <Input
                    type="date"
                    value={editor.nextDate}
                    onChange={(e) => change('nextDate', e.target.value)}
                  />
                </Field>
                <Field label="日程时间">
                  <Input
                    type="time"
                    value={editor.nextTime}
                    onChange={(e) => change('nextTime', e.target.value)}
                  />
                </Field>
                <Field label="岗位 / 投递链接" wide>
                  <Input
                    type="url"
                    value={editor.applyUrl}
                    onChange={(e) => change('applyUrl', e.target.value)}
                    placeholder="https://…"
                  />
                </Field>
                <Field label="信息来源">
                  <Input
                    value={editor.source}
                    onChange={(e) => change('source', e.target.value)}
                  />
                </Field>
                <Field label="内推人 / 内推码">
                  <Input
                    value={editor.referral}
                    onChange={(e) => change('referral', e.target.value)}
                  />
                </Field>
                <Field label="备注 / 笔面试反馈" wide>
                  <Textarea
                    className="min-h-24"
                    value={editor.notes}
                    onChange={(e) => change('notes', e.target.value)}
                    placeholder="记录面试问题、反馈、后续准备重点"
                  />
                </Field>
              </div>
              {editor.history.length > 0 && (
                <details className="rounded-xl border p-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    流程历史 · {editor.history.length} 条
                  </summary>
                  <ol className="mt-3 space-y-3 border-l-2 border-blue-200 pl-4">
                    {[...editor.history].reverse().map((h, i) => (
                      <li key={h.at + i}>
                        <p className="text-sm">{h.note}</p>
                        <time className="text-xs text-slate-500">
                          {new Date(h.at).toLocaleString('zh-CN')}
                        </time>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-white py-3">
                {baseline && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setDeleteTarget(editor)}
                  >
                    <Trash2 />
                    删除
                  </Button>
                )}
                <div className="flex-1" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditor(null)}
                >
                  关闭并保留草稿
                </Button>
                <Button
                  type="submit"
                  disabled={
                    store.blocked || (!!matches.length && !acknowledged)
                  }
                >
                  保存记录
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>批量导入岗位</DialogTitle>
            <DialogDescription>
              支持 JSON 备份、UTF-8
              CSV，或复制表格的带表头内容。先预览再合并，已有投递进度会保留。
            </DialogDescription>
          </DialogHeader>
          <input
            aria-label="选择导入文件"
            ref={fileRef}
            type="file"
            accept=".json,.csv,.tsv,.txt"
            className="hidden"
            onChange={(e) => void readFile(e.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <ArrowUpFromLine />
              选择文件
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                download(
                  '岗位导入模板.csv',
                  csvTemplate(),
                  'text/csv;charset=utf-8',
                )
              }
            >
              下载表头模板
            </Button>
          </div>
          <Field label="粘贴表格内容">
            <Textarea
              className="min-h-28"
              value={pasted}
              onChange={(e) => {
                setPasted(e.target.value);
                setPending(null);
              }}
              placeholder="公司名称&#9;招聘岗位&#9;工作地点&#9;投递链接"
            />
          </Field>
          <Button
            variant="outline"
            disabled={!pasted.trim()}
            onClick={() => preview(pasted)}
          >
            预览粘贴内容
          </Button>
          {importError && (
            <p role="alert" className="text-sm text-rose-700">
              {importError}
            </p>
          )}
          {pending && merge && (
            <div className="space-y-3 rounded-xl border bg-slate-50 p-4">
              <p className="font-semibold">
                新增 {merge.added.length} 条 · 疑似重复 {merge.skipped.length}{' '}
                条 · 无效 {pending.errors.length} 条
              </p>
              <div className="max-h-60 space-y-2 overflow-y-auto text-sm">
                {merge.added.slice(0, 20).map((job) => (
                  <p key={job.id}>
                    <span className="mr-2 text-emerald-700">新增</span>
                    {job.company} · {job.position} · {job.status}
                  </p>
                ))}
                {merge.skipped.slice(0, 20).map(({ job, reason }) => (
                  <p key={job.id}>
                    <span className="mr-2 text-amber-800">跳过</span>
                    {job.company} · {job.position}：{reason}
                  </p>
                ))}
                {pending.errors.slice(0, 20).map((e) => (
                  <p key={e} className="text-rose-700">
                    {e}
                  </p>
                ))}
              </div>
              <p className="text-xs text-slate-600">
                各类最多预览 20
                条。疑似重复项不覆盖现有记录，需更新时请编辑原岗位。
              </p>
              <Button
                disabled={!merge.added.length || store.blocked}
                onClick={confirmImport}
              >
                确认合并 {merge.added.length} 条
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>导出与备份</DialogTitle>
            <DialogDescription>
              导出全部 {store.jobs.length}{' '}
              条岗位。备份文件可能包含你的笔面试记录，请妥善保存。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button className="w-full" onClick={() => exportFile('json')}>
              完整 JSON 备份（含流程历史）
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => exportFile('csv')}
            >
              CSV 汇总表（Excel 可打开）
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => exportFile('ics')}
            >
              导出笔面试日历（ICS）
            </Button>
          </div>
          <p className="text-sm leading-6 text-slate-500">
            日历是导出时的快照，不会自动同步；按接收日历的本地时区解释时间，未指定时间的事项为全天事件。CSV
            不包含流程历史。
          </p>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条岗位记录？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.company} · {deleteTarget?.position}
              。可在删除后撤销，或恢复上次写入前的数据。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                try {
                  if (!deleteTarget) return;
                  const latest = store.current.current.find(
                    (j) => j.id === deleteTarget.id,
                  );
                  store.commit(
                    store.current.current.filter(
                      (j) => j.id !== deleteTarget.id,
                    ),
                  );
                  setLastDeleted(latest || null);
                  setDeleteTarget(null);
                  setEditor(null);
                  notify('已删除，可撤销');
                } catch (e) {
                  notify(e instanceof Error ? e.message : '删除失败');
                }
              }}
            >
              确认删除
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>恢复上次写入前的数据？</AlertDialogTitle>
            <AlertDialogDescription>
              当前台账将替换为自动备份。系统会另外保留恢复前的原始副本，建议先导出完整备份。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setRestoreOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                try {
                  store.restore();
                  setRestoreOpen(false);
                  notify('已恢复上次备份');
                } catch (e) {
                  notify(e instanceof Error ? e.message : '恢复失败');
                }
              }}
            >
              确认恢复
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {lastDeleted && (
        <div className="mx-auto mt-4 flex max-w-lg items-center justify-between rounded-xl border bg-white p-3 text-sm">
          <span>已删除 {lastDeleted.company}</span>
          <Button
            variant="outline"
            onClick={() => {
              try {
                if (store.current.current.some((j) => j.id === lastDeleted.id))
                  throw new Error('该记录已存在');
                store.commit([...store.current.current, lastDeleted]);
                setLastDeleted(null);
                notify('已撤销删除');
              } catch (e) {
                notify(e instanceof Error ? e.message : '撤销失败');
              }
            }}
          >
            撤销删除
          </Button>
        </div>
      )}
      {notice && (
        <output
          aria-live="polite"
          className="fixed bottom-5 left-1/2 z-[100] flex w-max max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-xl bg-slate-950 px-4 py-3 text-sm text-white shadow-xl"
        >
          <span>{notice}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="关闭提示"
            onClick={() => setNotice('')}
          >
            <X />
          </Button>
        </output>
      )}
    </main>
  );
}
