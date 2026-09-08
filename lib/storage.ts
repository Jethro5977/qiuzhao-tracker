import {
  STORAGE_KEY,
  RECOVERY_KEY,
  encodeBackup,
  parseBackup,
} from './tracker.ts';
import type { Job } from './tracker.ts';
export type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
export function readStorage(storage: StoragePort) {
  const raw = storage.getItem(STORAGE_KEY);
  return { raw, jobs: raw ? parseBackup(raw) : [] };
}
export function writeStorage(
  storage: StoragePort,
  jobs: Job[],
  expected: string | null,
) {
  if (storage.getItem(STORAGE_KEY) !== expected)
    throw new Error('另一窗口已更新数据，请重新打开记录后再保存。');
  // Never overwrite the active copy if recovery backup cannot be written.
  if (expected) storage.setItem(RECOVERY_KEY, expected);
  const raw = encodeBackup(jobs);
  storage.setItem(STORAGE_KEY, raw);
  return raw;
}
