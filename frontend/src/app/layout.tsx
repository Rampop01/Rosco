import './globals.css';
import React from 'react';
import { AuthProvider } from '../context/AuthContext';

export const metadata = {
  title: 'Rosco — Rotating Savings & Personal Target Vault (Nimiq Pay)',
  description: 'Non-custodial decentralized rotating savings and solo target vaults powered by Nimiq.',
  icons: {
    icon: '/rosco_logo.jpg',
    apple: '/rosco_logo.jpg',
  },
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
