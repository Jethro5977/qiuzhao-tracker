import type { Metadata } from 'next';
import { Noto_Sans_SC } from 'next/font/google';
import './globals.css';

const notoSans = Noto_Sans_SC({ variable: '--font-noto-sans-sc', subsets: ['latin'] });

export const metadata: Metadata = {
  title: '秋招投递台账',
  description: '集中管理秋招岗位、笔试面试进度和后续日程，避免重复投递。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body className={`${notoSans.variable} antialiased`}>{children}</body></html>;
}
