'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  CATALOG_KEY,
  CATALOGS_KEY,
  lookupSerial,
  parseCatalog,
  readCatalogStore,
} from '@/lib/catalog';
import type { Catalog, CatalogStore } from '@/lib/catalog';
import { JOB_SOURCES } from '@/lib/tracker';
import type { Job, JobSourceId } from '@/lib/tracker';

const emptyStore = (): CatalogStore => ({ version: 2, catalogs: {} });

export function CatalogLookup({ onSelect }: { onSelect: (job: Job) => void }) {
  const [catalogs, setCatalogs] = useState<Record<string, Catalog>>({});
  const [sourceId, setSourceId] = useState<JobSourceId>(JOB_SOURCES[0].id);
  const [serial, setSerial] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [error, setError] = useState('');
  const [manage, setManage] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const selectedSource =
    JOB_SOURCES.find((source) => source.id === sourceId) || JOB_SOURCES[0];
  const catalog = catalogs[sourceId] || null;

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const current = localStorage.getItem(CATALOGS_KEY);
        if (current) {
          setCatalogs(readCatalogStore(JSON.parse(current)).catalogs);
          return;
        }
        const legacy = localStorage.getItem(CATALOG_KEY);
        if (!legacy) return;
        const parsed = JSON.parse(legacy) as Partial<Catalog>;
        if (!Array.isArray(parsed.rows) || typeof parsed.importedAt !== 'string')
          throw new Error();
        const migrated: Catalog = {
          sourceId: JOB_SOURCES[0].id,
          sourceName: JOB_SOURCES[0].name,
          sourceUrl: JOB_SOURCES[0].url,
          importedAt: parsed.importedAt,
          rows: parsed.rows,
        };
        const next: CatalogStore = {
          version: 2,
          catalogs: { [JOB_SOURCES[0].id]: migrated },
        };
        localStorage.setItem(CATALOGS_KEY, JSON.stringify(next));
        setCatalogs(next.catalogs);
      } catch {
        setError('无法读取岗位索引，请重新导入源表。台账记录不受影响。');
      }
    });
  }, []);

  function importSource(text: string) {
    try {
      const imported = parseCatalog(text, selectedSource);
      const next: CatalogStore = {
        ...emptyStore(),
        catalogs: { ...catalogs, [sourceId]: imported },
      };
      localStorage.setItem(CATALOGS_KEY, JSON.stringify(next));
      setCatalogs(next.catalogs);
      setError('');
      setManage(false);
      setSourceText('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '源表保存失败');
    }
  }

  return (
    <section className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">按来源表序号录入</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            两份来源表分别建立索引；查询前先选择序号所在的表，避免同号岗位混淆。
          </p>
        </div>
        <a
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-sm font-medium text-blue-700 hover:bg-blue-100"
          href={selectedSource.url}
          target="_blank"
          rel="noreferrer"
        >
          打开当前来源表
          <ExternalLink className="size-4" />
        </a>
      </div>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            if (!catalog)
              throw new Error(
                `请先导入“${selectedSource.name}”，之后可直接按序号查询。`,
              );
            onSelect(lookupSerial(catalog, serial));
            setError('');
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : '查询失败');
          }
        }}
      >
        <NativeSelect
          aria-label="岗位来源表"
          className="w-full bg-white sm:w-72"
          value={sourceId}
          onChange={(event) => {
            setSourceId(event.target.value as JobSourceId);
            setError('');
          }}
        >
          {JOB_SOURCES.map((source, index) => (
            <NativeSelectOption key={source.id} value={source.id}>
              来源 {index + 1} · {source.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          aria-label="原表序号"
          className="w-48 bg-white"
          inputMode="numeric"
          placeholder="输入序号，如 4150"
          value={serial}
          onChange={(event) => setSerial(event.target.value)}
        />
        <Button type="submit">获取岗位信息</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setManage(!manage)}
        >
          {catalog ? '更新当前来源表' : '导入当前来源表'}
        </Button>
      </form>
      <p className="mt-2 text-sm text-slate-600">
        {catalog
          ? `当前来源已索引 ${catalog.rows.length} 条 · 更新于 ${new Date(catalog.importedAt).toLocaleString('zh-CN')}。`
          : `“${selectedSource.name}”尚未建立本机索引。`}
        {' · '}已导入 {Object.keys(catalogs).length}/{JOB_SOURCES.length} 份来源表。
      </p>
      {manage && (
        <div className="mt-3 space-y-3 rounded-lg border border-blue-200 bg-white p-3">
          <p className="text-sm leading-6 text-slate-600">
            正在导入：<strong>{selectedSource.name}</strong>。请包含“序号、公司名称、招聘岗位”表头；额外字段会保存在备注中。
          </p>
          <Input
            ref={file}
            type="file"
            accept=".csv,.tsv,.txt"
            aria-label={`选择${selectedSource.name}文件`}
            onChange={async (event) => {
              const selected = event.target.files?.[0];
              if (!selected) return;
              try {
                if (selected.size > 10_000_000)
                  throw new Error('源表不能超过 10 MB');
                importSource(await selected.text());
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : '文件读取失败',
                );
              } finally {
                if (file.current) file.current.value = '';
              }
            }}
          />
          <Textarea
            aria-label={`粘贴${selectedSource.name}`}
            placeholder="也可粘贴带表头的表格内容"
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
          />
          <Button
            type="button"
            onClick={() => importSource(sourceText)}
            disabled={!sourceText.trim()}
          >
            保存到当前来源索引
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {error}
        </p>
      )}
    </section>
  );
}
