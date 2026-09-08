'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CATALOG_KEY, lookupSerial, parseCatalog } from '@/lib/catalog';
import type { Catalog } from '@/lib/catalog';
import type { Job } from '@/lib/tracker';

export function CatalogLookup({ onSelect }: { onSelect: (job: Job) => void }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [serial, setSerial] = useState('');
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [manage, setManage] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(CATALOG_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Catalog;
          if (
            !Array.isArray(parsed.rows) ||
            typeof parsed.importedAt !== 'string'
          )
            throw new Error();
          setCatalog(parsed);
        }
      } catch {
        setError('无法读取岗位索引，请重新导入源表。台账记录不受影响。');
      }
    });
  }, []);
  function importSource(text: string) {
    try {
      const next = parseCatalog(text);
      localStorage.setItem(CATALOG_KEY, JSON.stringify(next));
      setCatalog(next);
      setError('');
      setManage(false);
      setSource('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '源表保存失败');
    }
  }
  return (
    <section className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <h2 className="font-semibold">按原表序号录入</h2>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            if (!catalog)
              throw new Error(
                '请先导入包含序号的岗位源表，之后可直接按序号查询。',
              );
            onSelect(lookupSerial(catalog, serial));
            setError('');
          } catch (e) {
            setError(e instanceof Error ? e.message : '查询失败');
          }
        }}
      >
        <Input
          aria-label="原表序号"
          className="w-48 bg-white"
          inputMode="numeric"
          placeholder="输入序号，如 4150"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
        />
        <Button type="submit">获取岗位信息</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setManage(!manage)}
        >
          {catalog ? '更新岗位源表' : '导入岗位源表'}
        </Button>
      </form>
      <p className="mt-2 text-sm text-slate-600">
        {catalog
          ? `已索引 ${catalog.rows.length} 条 · 更新于 ${new Date(catalog.importedAt).toLocaleString('zh-CN')}。查询后填入表单，核对并保存即可录入。`
          : '首次需导入有权获取的 CSV / TSV 源表；保留全部原始字段，不会将整个源表加入投递台账。'}
      </p>
      {manage && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-slate-600">
            请包含「序号、公司名称、招聘岗位」表头。额外字段会完整保留在备注中。当前腾讯原表不允许访客复制或导出，请使用你有权限获取的文件；此索引不实时同步。
          </p>
          <Input
            ref={file}
            type="file"
            accept=".csv,.tsv,.txt"
            aria-label="选择岗位源表"
            onChange={async (e) => {
              const selected = e.target.files?.[0];
              if (!selected) return;
              try {
                if (selected.size > 10_000_000)
                  throw new Error('源表不能超过 10 MB');
                importSource(await selected.text());
              } catch (err) {
                setError(err instanceof Error ? err.message : '文件读取失败');
              } finally {
                if (file.current) file.current.value = '';
              }
            }}
          />
          <Textarea
            aria-label="粘贴岗位源表"
            placeholder="也可粘贴带表头的表格内容"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
          <Button
            onClick={() => importSource(source)}
            disabled={!source.trim()}
          >
            保存源表索引
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
