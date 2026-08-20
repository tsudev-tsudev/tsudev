import React from 'react';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';

type LayoutProps = {
  children?: React.ReactNode;
  active?: string;
  bare?: boolean;
};

export const Layout = ({ children, active = '/', bare = false }: LayoutProps) => (
  <div className="min-h-screen flex flex-col bg-base text-fg font-sans">
    <SiteHeader active={active} />
    <main
      id="main-content"
      role="main"
      className={bare ? 'flex-1' : 'flex-1 max-w-6xl w-full mx-auto px-4 py-10'}
    >
      {children}
    </main>
    <SiteFooter />
  </div>
);

export default Layout;
