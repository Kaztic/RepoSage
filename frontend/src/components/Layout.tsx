import Head from 'next/head';
import { ReactNode, useEffect } from 'react';

type LayoutProps = {
  children: ReactNode;
  title?: string;
}

export default function Layout({ children, title = 'RepoSage' }: LayoutProps) {
  // Fix height issues on mobile devices
  useEffect(() => {
    // Function to update the viewport height
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    // Set the initial viewport height
    setVH();

    // Update the height on resize and orientation change
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);

    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);

  return (
    <div className="flex h-screen min-h-screen bg-gray-900 overflow-hidden" 
         style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Your GitHub repository assistant" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="flex-1 flex flex-col relative overflow-hidden max-h-full">
        {children}
      </main>
    </div>
  );
} 