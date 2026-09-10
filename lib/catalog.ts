import { blankJob, JOB_SOURCES, parseJob, safeUrl } from './tracker.ts';
import type { Job, JobSource } from './tracker.ts';
import { parseDelimited } from './transfer.ts';

export const CATALOG_KEY = 'qiuzhao-source-catalog-v1';
export const CATALOGS_KEY = 'qiuzhao-source-catalog-v2';
export type CatalogRow = { serial: string; job: Job };
export type Catalog = {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  importedAt: string;
  rows: CatalogRow[];
};
export type CatalogStore = { version: 2; catalogs: Record<string, Catalog> };
export function normalizeSerial(value: string) {
  const serial = value.normalize('NFKC').trim();
  if (!/^\d{1,10}$/.test(serial))
    throw new Error('请输入原表的数字序号，例如 4150');
  return serial.replace(/^0+(?=\d)/, '');
}
export function parseCatalog(
  text: string,
  source: JobSource = JOB_SOURCES[0],
): Catalog {
  if (text.length > 10_000_000) throw new Error('源表不能超过 10 MB');
  const rows = parseDelimited(text);
  const index = rows.findIndex((row) => row.some((v) => v.trim() === '序号'));
  if (index < 0) throw new Error('源表必须包含「序号」列，请连同表头导入。');
  const headers = rows[index].map((v) => v.trim());
  const col = (...names: string[]) =>
    headers.findIndex((h) => names.includes(h));
  const company = col('公司名称', '公司', '企业名称');
  const position = col('招聘岗位', '招聘职位', '岗位', '职位');
  if (company < 0 || position < 0)
    throw new Error('源表缺少公司名称或招聘岗位列');
  const result: CatalogRow[] = [];
  for (const [offset, row] of rows.slice(index + 1).entries()) {
    if (!row[col('序号')]?.trim()) continue;
    try {
      const serial = normalizeSerial(row[col('序号')]);
      const get = (...names: string[]) => (row[col(...names)] || '').trim();
      const link = get('投递链接', '网申链接', '招聘链接', '链接');
      const deadline = get('截止日期', '截止时间');
      const job = parseJob({
        ...blankJob(),
        company: row[company],
        position: row[position],
        location: get('工作地点', '工作城市', '地点', '城市'),
        department: get('部门'),
        batch: get('批次') || '2027届秋招',
        applyUrl: safeUrl(link),
        deadline: /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : '',
        source: `腾讯岗位源表 · ${source.name} · 序号 ${serial} · ${source.url}`,
        notes: headers
          .map((header, i) =>
            row[i]?.trim()
              ? `${header || `第${i + 1}列`}：${row[i].trim()}`
              : '',
          )
          .filter(Boolean)
          .join('\n'),
      });
      result.push({ serial, job });
    } catch (error) {
      throw new Error(
        `源表第 ${index + offset + 2} 行：${error instanceof Error ? error.message : '格式错误'}`,
      );
    }
  }
  if (!result.length || result.length > 10000)
    throw new Error('请导入 1–10000 条有效岗位');
  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.url,
    importedAt: new Date().toISOString(),
    rows: result,
  };
}

export function readCatalogStore(value: unknown): CatalogStore {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('岗位索引格式无效');
  const raw = value as Partial<CatalogStore>;
  if (raw.version !== 2 || !raw.catalogs || typeof raw.catalogs !== 'object')
    throw new Error('岗位索引版本无效');
  for (const catalog of Object.values(raw.catalogs)) {
    if (
      !catalog ||
      !Array.isArray(catalog.rows) ||
      typeof catalog.sourceId !== 'string' ||
      typeof catalog.importedAt !== 'string'
    )
      throw new Error('岗位索引内容无效');
  }
  return raw as CatalogStore;
}
export function lookupSerial(catalog: Catalog, input: string) {
  const serial = normalizeSerial(input);
  const matches = catalog.rows.filter((row) => row.serial === serial);
  if (!matches.length)
    throw new Error(`源表中没有序号 ${serial}，请更新源表或核对序号。`);
  if (matches.length > 1)
    throw new Error(`序号 ${serial} 对应多条岗位，请在源表中核对后手动录入。`);
  return {
    ...parseJob(matches[0].job),
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
