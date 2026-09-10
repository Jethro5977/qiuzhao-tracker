import type { Metadata } from 'next';
import './globals.css';
import { PwaRegister } from '@/components/pwa-register';

export const metadata: Metadata = {
  title: '秋招投递台账',
  description: '集中管理秋招岗位、笔试面试进度和后续日程，避免重复投递。',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}<PwaRegister /></body>
    </html>
  );
}
