'use client';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Job } from '@/lib/tracker';
import type { InterviewLog } from '@/lib/storage';

const stages = ['待投递', '已投递', '笔试', '面试', 'OC'] as const;
function stageIndex(status: string) { if (status === '待投递') return 0; if (status === '已投递') return 1; if (status === '笔试') return 2; if (['一面', '二面', '终面', 'HR面'].includes(status)) return 3; if (['已OC', 'Offer'].includes(status)) return 4; return -1; }
export function DashboardView({ jobs, logs }: { jobs: Job[]; logs: InterviewLog[] }) {
  const data = useMemo(() => {
    const funnel = stages.map((name, index) => ({ name, count: jobs.filter((job) => stageIndex(job.status) >= index).length }));
    const days = Array.from({ length: 30 }, (_, offset) => { const date = new Date(); date.setDate(date.getDate() - 29 + offset); const key = date.toISOString().slice(0, 10); return { date: key.slice(5), count: jobs.filter((job) => job.applyDate === key || job.createdAt.slice(0, 10) === key).length }; });
    const channels = Object.entries(jobs.reduce<Record<string, number>>((all, job) => ({ ...all, [job.channel || '其他']: (all[job.channel || '其他'] || 0) + 1 }), {})).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    return { funnel, days, channels };
  }, [jobs]);
  const rates = ['笔试', '一面', '二面'].map((round) => { const rows = logs.filter((log) => log.round === round); return { round, total: rows.length, passed: rows.filter((log) => log.result === '通过').length }; });
  const words = logs.flatMap((log) => log.questions.split(/[\s，。；、,;：:\n]+/)).filter((word) => word.length >= 2).reduce<Record<string, number>>((all, word) => ({ ...all, [word]: (all[word] || 0) + 1 }), {});
  const topWords = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return <div className="grid gap-5 lg:grid-cols-2">
    <section className="insight-card lg:col-span-2"><h3>投递漏斗</h3><div className="mt-4 grid gap-3 sm:grid-cols-5">{data.funnel.map((item, index) => <div key={item.name} className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">{item.name}</p><strong className="mt-1 block text-2xl">{item.count}</strong><p className="mt-1 text-xs text-slate-500">{index ? `上级转化 ${data.funnel[index - 1].count ? Math.round(item.count / data.funnel[index - 1].count * 100) : 0}%` : '全部线索'}</p></div>)}</div></section>
    <section className="insight-card"><h3>近 30 天新增投递</h3><div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.days}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" interval={5} /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="count" name="新增" stroke="#2563eb" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div></section>
    <section className="insight-card"><h3>渠道分布</h3><div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.channels} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={72} /><Tooltip /><Bar dataKey="count" name="岗位" fill="#7c3aed" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div></section>
    <section className="insight-card"><h3>各轮通过率</h3><div className="mt-4 space-y-3">{rates.map((row) => <div key={row.round}><div className="flex justify-between text-sm"><span>{row.round}</span><span>{row.total ? Math.round(row.passed / row.total * 100) : 0}% · {row.passed}/{row.total}</span></div><div className="mt-1 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-emerald-500" style={{ width: `${row.total ? row.passed / row.total * 100 : 0}%` }} /></div></div>)}</div></section>
    <section className="insight-card"><h3>高频面试问题</h3><div className="mt-4 flex flex-wrap gap-2">{topWords.length ? topWords.map(([word, count]) => <span key={word} className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">{word} · {count}</span>) : <p className="text-sm text-slate-500">记录面试问题后，这里会自动汇总关键词。</p>}</div></section>
  </div>;
}
