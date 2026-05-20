import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'brifbyai — 오리엔트시트 자동 생성',
  description:
    '멀티 브랜드 오리엔트시트 자동 생성 + 일본 약기법 검증 플랫폼',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
