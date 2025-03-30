import Head from 'next/head';
import { ReactNode } from 'react';

type LayoutProps = {
  children: ReactNode;
  title?: string;
}

export default function Layout({ children, title = 'RepoSage' }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-900">
      <Head>
        <title>{title}</title>
        <meta name="description" content="Your GitHub repository assistant" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {children}
      </main>
    </div>
  );
} 