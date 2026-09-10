'use client';
import { useState } from 'react';
import { ChevronDown, Plus, Settings, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { USER_AVATARS } from '@/lib/user';
import type { User } from '@/lib/user';

type Props = { users: User[]; user: User; onSwitch: (id: string) => void; onCreate: (nickname: string, avatar: string) => void; onUpdate: (user: User) => void; onDelete: (id: string) => void };
export function UserSwitcher({ users, user, onSwitch, onCreate, onUpdate, onDelete }: Props) {
  const [open, setOpen] = useState(false); const [mode, setMode] = useState<'create' | 'edit' | ''>(''); const [nickname, setNickname] = useState(''); const [avatar, setAvatar] = useState<string>(USER_AVATARS[0]);
  function edit() { setNickname(user.nickname); setAvatar(user.avatar); setMode('edit'); setOpen(false); }
  function create() { setNickname(''); setAvatar(USER_AVATARS[0]); setMode('create'); setOpen(false); }
  function submit() { if (mode === 'create') onCreate(nickname, avatar); else onUpdate({ ...user, nickname: nickname.trim(), avatar }); setMode(''); }
  return <div className="relative">
    <Button variant="outline" onClick={() => setOpen(!open)} aria-expanded={open}><span className="text-lg">{user.avatar}</span>{user.nickname}<ChevronDown /></Button>
    {open && <div className="user-menu absolute right-0 z-50 mt-2 w-64 rounded-xl border bg-white p-2 shadow-xl transition-all duration-150">
      <p className="px-2 py-1 text-xs font-medium text-slate-500">切换用户（数据互相隔离）</p>
      {users.map((item) => <button key={item.id} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-100 ${item.id === user.id ? 'bg-blue-50 text-blue-700' : ''}`} onClick={() => { onSwitch(item.id); setOpen(false); }}><span className="text-xl">{item.avatar}</span><span>{item.nickname}</span>{item.id === user.id && <span className="ml-auto text-xs">当前</span>}</button>)}
      <div className="my-2 border-t" />
      <button className="menu-action" onClick={create}><Plus />新建用户</button>
      <button className="menu-action" onClick={edit}><Settings />编辑当前用户</button>
      <button className="menu-action text-rose-700" onClick={() => { if (confirm(`确定删除“${user.nickname}”及其全部本机数据吗？此操作不可撤销。`)) onDelete(user.id); setOpen(false); }}><Trash2 />删除当前用户</button>
    </div>}
    <Dialog open={Boolean(mode)} onOpenChange={(value) => !value && setMode('')}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{mode === 'create' ? '新建用户' : '编辑用户'}</DialogTitle><DialogDescription>每个用户拥有独立的岗位、面试记录、来源索引和设置。</DialogDescription></DialogHeader><Input placeholder="昵称" value={nickname} onChange={(e) => setNickname(e.target.value)} /><div className="grid grid-cols-8 gap-2">{USER_AVATARS.map((item) => <button key={item} className={`rounded-lg border p-2 text-xl ${avatar === item ? 'border-blue-500 bg-blue-50' : ''}`} onClick={() => setAvatar(item)}>{item}</button>)}</div><Button disabled={!nickname.trim()} onClick={submit}>保存</Button></DialogContent></Dialog>
  </div>;
}

export function Welcome({ onCreate }: { onCreate: (nickname: string, avatar: string) => void }) {
  const [nickname, setNickname] = useState(''); const [avatar, setAvatar] = useState<string>(USER_AVATARS[0]);
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-4"><section className="w-full max-w-lg rounded-3xl border bg-white p-8 shadow-xl"><div className="mb-6 grid size-14 place-items-center rounded-2xl bg-blue-600 text-2xl text-white">🎯</div><h1 className="text-2xl font-semibold">欢迎使用秋招投递台账</h1><p className="mt-2 leading-7 text-slate-600">先创建一个本机用户。岗位与面试数据只保存在当前浏览器，并按用户完全隔离。</p><label htmlFor="welcome-nickname" className="mt-6 block text-sm font-medium">你的昵称</label><Input id="welcome-nickname" className="mt-2" placeholder="例如 Jethro" value={nickname} onChange={(e) => setNickname(e.target.value)} /><p className="mt-5 text-sm font-medium">选择头像</p><div className="mt-2 grid grid-cols-8 gap-2">{USER_AVATARS.map((item) => <button key={item} className={`rounded-xl border p-2 text-xl ${avatar === item ? 'border-blue-500 bg-blue-50' : ''}`} onClick={() => setAvatar(item)}>{item}</button>)}</div><Button className="mt-6 w-full" disabled={!nickname.trim()} onClick={() => onCreate(nickname, avatar)}>创建并进入台账</Button></section></main>;
}
