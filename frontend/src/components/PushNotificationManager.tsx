'use client';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export default function PushNotificationManager() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    const subscribeToPush = async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        
        const registration = await navigator.serviceWorker.register('/sw.js');
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
          // Ask for permission if not already granted
          if (Notification.permission !== 'granted') {
             const permission = await Notification.requestPermission();
             if (permission !== 'granted') return;
          }
          
          const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!vapidKey) return;
          
          const convertedVapidKey = urlBase64ToUint8Array(vapidKey);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey,
          });
        }
        
        await apiFetch('/notifications/subscribe', {
          method: 'POST',
          body: JSON.stringify({ subscription }),
        });
      } catch (err) {
        console.error('Failed to subscribe to push notifications', err);
      }
    };
    
    subscribeToPush();
  }, [user]);

  return null;
}
