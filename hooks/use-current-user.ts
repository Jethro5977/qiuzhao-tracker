'use client';
import { useCallback, useEffect, useState } from 'react';
import { createUserRecord } from '@/lib/user';
import type { User } from '@/lib/user';
import { clearUserData, loadCurrentUserId, loadUsers, migrateLegacyData, saveCurrentUserId, saveUsers } from '@/lib/storage';
export function useCurrentUser() {
  const [users, setUsers] = useState<User[]>([]); const [userId, setUserId] = useState(''); const [ready, setReady] = useState(false); const [migrationCount, setMigrationCount] = useState(0);
  useEffect(() => { queueMicrotask(() => { const list = loadUsers(); const saved = loadCurrentUserId(); setUsers(list); setUserId(list.some((u) => u.id === saved) ? saved : list[0]?.id || ''); setReady(true); }); }, []);
  const switchUser = useCallback((id: string) => { saveCurrentUserId(id); setUserId(id); window.dispatchEvent(new CustomEvent('user-switched', { detail: id })); }, []);
  const createUser = useCallback((nickname: string, avatar: string) => { const user = createUserRecord(nickname, avatar); const next = [...loadUsers(), user]; saveUsers(next); saveCurrentUserId(user.id); setMigrationCount(migrateLegacyData(user.id)); setUsers(next); setUserId(user.id); return user; }, []);
  const updateUser = useCallback((next: User) => { const list = loadUsers().map((user) => user.id === next.id ? next : user); saveUsers(list); setUsers(list); }, []);
  const deleteUser = useCallback((id: string) => { clearUserData(id); const next = loadUsers().filter((user) => user.id !== id); saveUsers(next); const nextId = next[0]?.id || ''; saveCurrentUserId(nextId); setUsers(next); setUserId(nextId); }, []);
  return { users, user: users.find((u) => u.id === userId) || null, userId, ready, migrationCount, switchUser, createUser, updateUser, deleteUser };
}
