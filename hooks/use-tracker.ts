'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseBackup, STORAGE_KEY, RECOVERY_KEY } from '@/lib/tracker';
import type { Job } from '@/lib/tracker';
import { readStorage, writeStorage } from '@/lib/storage';

export function useTracker() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);
  const current = useRef<Job[]>([]);
  const raw = useRef<string | null>(null);
  const locked = useRef(false);
  const publish = useCallback((next: Job[]) => {
    current.current = next;
    setJobs(next);
  }, []);
  const reload = useCallback(() => {
    try {
      const loaded = readStorage(localStorage);
      raw.current = loaded.raw;
      publish(loaded.jobs);
      locked.current = false;
      setBlocked(false);
      setError('');
    } catch {
      locked.current = true;
      setBlocked(true);
      setError(
        '无法读取本机记录。原始数据已保留，写入已暂停。可导出原始数据，或恢复上次备份。',
      );
    }
    try {
      setHasRecovery(Boolean(localStorage.getItem(RECOVERY_KEY)));
    } catch {
      /* Storage unavailable. */
    }
    setReady(true);
  }, [publish]);
  useEffect(() => {
    queueMicrotask(reload);
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) reload();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [reload]);
  const commit = useCallback(
    (next: Job[]) => {
      if (locked.current) throw new Error('请先恢复本机数据，当前写入已暂停。');
      try {
        raw.current = writeStorage(localStorage, next, raw.current);
        publish(next);
        setError('');
        setHasRecovery(true);
      } catch (e) {
        const message = e instanceof Error ? e.message : '写入失败';
        setError(`未保存：${message}。可先导出备份，检查浏览器存储空间。`);
        throw new Error(message);
      }
    },
    [publish],
  );
  const restore = useCallback(() => {
    const backup = localStorage.getItem(RECOVERY_KEY);
    if (!backup) throw new Error('没有可恢复的备份');
    const recovered = parseBackup(backup);
    // Retain the current raw copy, even if malformed, before explicit recovery.
    const previous = localStorage.getItem(STORAGE_KEY);
    if (previous)
      localStorage.setItem(`${RECOVERY_KEY}-before-restore`, previous);
    localStorage.setItem(STORAGE_KEY, backup);
    raw.current = backup;
    publish(recovered);
    locked.current = false;
    setBlocked(false);
    setError('');
  }, [publish]);
  return {
    jobs,
    current,
    ready,
    error,
    blocked,
    hasRecovery,
    commit,
    restore,
    reload,
  };
}
