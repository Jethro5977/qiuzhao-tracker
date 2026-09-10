import assert from 'node:assert/strict';
import test from 'node:test';
import { blankJob } from '../lib/tracker.ts';
import { exportUserData, getStorageKey, importUserData, loadApplications, saveApplications } from '../lib/storage.ts';
import type { StoragePort } from '../lib/storage.ts';
import type { User } from '../lib/user.ts';

function memoryStorage(): StoragePort {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    key: (index) => [...values.keys()][index] ?? null,
  };
}

test('applications are isolated by user namespace', () => {
  const storage = memoryStorage();
  const job = { ...blankJob(), company: '甲公司', position: '前端工程师' };
  saveApplications('user-a', [job], storage);
  assert.equal(loadApplications('user-a', storage).length, 1);
  assert.deepEqual(loadApplications('user-b', storage), []);
  assert.notEqual(getStorageKey('user-a', 'applications'), getStorageKey('user-b', 'applications'));
});

test('complete user backup round-trips without leaking another user data', () => {
  const storage = memoryStorage();
  const user: User = { id: 'user-a', nickname: 'Jethro', avatar: '🚀', createdAt: new Date().toISOString() };
  saveApplications(user.id, [{ ...blankJob(), company: '乙公司', position: '后端工程师' }], storage);
  const backup = exportUserData(user.id, user, storage);
  const result = importUserData('user-b', backup, 'replace', storage);
  assert.equal(result.added, 1);
  assert.equal(loadApplications('user-b', storage)[0].company, '乙公司');
  assert.equal(loadApplications('user-a', storage).length, 1);
});
