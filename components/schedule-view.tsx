'use client';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Job } from '@/lib/tracker';

type ScheduleItem = { id: string; date: string; type: '笔试' | '面试' | '截止'; title: string; job: Job };
export function ScheduleView({ jobs, onOpen }: { jobs: Job[]; onOpen: (job: Job) => void }) {
  const [offset, setOffset] = useState(0);
  const days = useMemo(() => { const base = new Date(); const monday = new Date(base); monday.setDate(base.getDate() - ((base.getDay() + 6) % 7) + offset * 7); return Array.from({ length: 7 }, (_, i) => { const day = new Date(monday); day.setDate(monday.getDate() + i); return day; }); }, [offset]);
  const items = useMemo<ScheduleItem[]>(() => jobs.flatMap((job) => { const next: ScheduleItem[] = []; if (job.nextDate) next.push({ id: `${job.id}-next`, date: job.nextDate, type: job.status === '笔试' ? '笔试' : '面试', title: job.nextStep || job.status, job }); if (job.deadline && job.status === '待投递') next.push({ id: `${job.id}-deadline`, date: job.deadline, type: '截止', title: '投递截止', job }); return next; }), [jobs]);
  return <section className="surface overflow-hidden"><div className="flex items-center justify-between border-b p-4"><div><h2 className="font-semibold">本周日程</h2><p className="mt-1 text-sm text-slate-500">点击事项可直接编辑对应岗位</p></div><div className="flex gap-2"><Button size="icon" variant="outline" aria-label="上一周" onClick={() => setOffset(offset - 1)}><ChevronLeft /></Button><Button variant="outline" onClick={() => setOffset(0)}>本周</Button><Button size="icon" variant="outline" aria-label="下一周" onClick={() => setOffset(offset + 1)}><ChevronRight /></Button></div></div><div className="schedule-grid grid min-w-[850px] grid-cols-7">{days.map((day) => { const key = day.toISOString().slice(0, 10); const rows = items.filter((item) => item.date === key); return <div key={key} className="min-h-72 border-r p-3 last:border-0"><p className="text-sm font-medium">{['周日','周一','周二','周三','周四','周五','周六'][day.getDay()]}</p><strong className="text-2xl">{day.getDate()}</strong><div className="mt-3 space-y-2">{rows.map((item) => <button key={item.id} className={`schedule-item schedule-${item.type}`} onClick={() => onOpen(item.job)}><span>{item.type} · {item.title}</span><strong>{item.job.company}</strong><small>{item.job.position}</small></button>)}</div></div>; })}</div></section>;
}
