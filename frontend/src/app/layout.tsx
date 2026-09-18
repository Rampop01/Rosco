import './globals.css';
import React from 'react';
import { AuthProvider } from '../context/AuthContext';
import PushNotificationManager from '../components/PushNotificationManager';

export const metadata = {
  title: 'Rosco — Rotating Savings & Personal Target Vault (Nimiq Pay)',
  description: 'Non-custodial decentralized rotating savings and solo target vaults powered by Nimiq.',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/rosco_logo_icon.jpg' },
      { url: '/favicon.ico' },
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
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
          <PushNotificationManager />
          <div className="app-container">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
