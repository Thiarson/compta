export const notificationTypes = ['verify-email', 'reset-password'] as const;
export const notificationStatuses = ['pending', 'sent', 'failed'] as const;

export type NotificationType = (typeof notificationTypes)[number];
export type NotificationStatus = (typeof notificationStatuses)[number];
