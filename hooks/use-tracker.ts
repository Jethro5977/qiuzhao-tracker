'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadApplications, saveApplications } from '@/lib/storage';
import type { Job } from '@/lib/tracker';
export function useTracker(userId: string) {
  const [jobs, setJobs] = useState<Job[]>([]); const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [savedAt, setSavedAt] = useState(''); const current = useRef<Job[]>([]);
  const reload = useCallback(() => { try { const next = loadApplications(userId); current.current = next; setJobs(next); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : '无法读取本机记录'); } finally { setReady(true); } }, [userId]);
  useEffect(() => { queueMicrotask(reload); }, [reload]);
  const commit = useCallback((next: Job[]) => { try { saveApplications(userId, next); current.current = next; setJobs(next); setSavedAt(new Date().toLocaleTimeString('zh-CN')); setError(''); } catch (cause) { const message = cause instanceof Error ? cause.message : '保存失败'; setError(message); throw new Error(message); } }, [userId]);
  return { jobs, current, ready, error, blocked: Boolean(error), commit, reload, savedAt };
}
