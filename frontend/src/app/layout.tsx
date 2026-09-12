import './globals.css';
import React from 'react';
import { AuthProvider } from '../context/AuthContext';

export const metadata = {
  title: 'Rosco — Rotating Savings Circle (Nimiq Pay Mini App)',
  description: 'Non-custodial digital ROSCA for Nimiq Pay. Group savings made seamless.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <div className="app-container">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
