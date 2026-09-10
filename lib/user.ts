export interface User {
  id: string;
  nickname: string;
  avatar: string;
  createdAt: string;
}

export const USER_AVATARS = ['🎯', '🚀', '💻', '🧭', '🌟', '🦊', '🐼', '🐧'] as const;

export function createUserRecord(nickname: string, avatar: string): User {
  const clean = nickname.trim();
  if (!clean) throw new Error('请输入昵称');
  if (clean.length > 24) throw new Error('昵称最多 24 个字符');
  return { id: crypto.randomUUID(), nickname: clean, avatar: avatar || USER_AVATARS[0], createdAt: new Date().toISOString() };
}
