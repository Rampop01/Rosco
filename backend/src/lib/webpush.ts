import webpush from 'web-push';
import { prisma } from '../index';

webpush.setVapidDetails(
  'mailto:test@test.com',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export async function sendNotificationToUser(userId: string, payload: any) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  const payloadString = JSON.stringify(payload);

  for (const sub of subscriptions) {
    try {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };
      await webpush.sendNotification(pushSubscription, payloadString);
    } catch (error: any) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      } else {
        console.error('Error sending push notification:', error);
      }
    }
  }
}
