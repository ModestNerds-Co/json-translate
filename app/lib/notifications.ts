export interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
}

export interface NotificationResult {
  success: boolean;
  error?: string;
  permission?: NotificationPermission;
}

export class NotificationManager {
  private static instance: NotificationManager;
  private permissionGranted = false;

  private constructor() {
    this.checkPermission();
  }

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  private checkPermission(): void {
    if (!this.isSupported()) {
      return;
    }

    this.permissionGranted = Notification.permission === 'granted';
  }

  private isSupported(): boolean {
    return 'Notification' in window;
  }

  async requestPermission(): Promise<NotificationResult> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: 'Notifications are not supported in this browser',
        permission: 'denied'
      };
    }

    if (Notification.permission === 'granted') {
      this.permissionGranted = true;
      return {
        success: true,
        permission: 'granted'
      };
    }

    if (Notification.permission === 'denied') {
      return {
        success: false,
        error: 'Notifications are blocked. Please enable them in your browser settings.',
        permission: 'denied'
      };
    }

    try {
      const permission = await Notification.requestPermission();
      this.permissionGranted = permission === 'granted';

      if (permission === 'granted') {
        return {
          success: true,
          permission: 'granted'
        };
      } else {
        return {
          success: false,
          error: 'Notification permission was denied',
          permission: permission
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to request notification permission: ${error instanceof Error ? error.message : 'Unknown error'}`,
        permission: 'denied'
      };
    }
  }

  async showNotification(options: NotificationOptions): Promise<NotificationResult> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: 'Notifications are not supported in this browser'
      };
    }

    if (!this.permissionGranted) {
      const permissionResult = await this.requestPermission();
      if (!permissionResult.success) {
        return permissionResult;
      }
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        tag: options.tag || 'json-translator',
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false
      });

      // Auto-close after 5 seconds if not requiring interaction
      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      return {
        success: true,
        permission: 'granted'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to show notification: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  getPermissionStatus(): NotificationPermission {
    if (!this.isSupported()) {
      return 'denied';
    }
    return Notification.permission;
  }

  isPermissionGranted(): boolean {
    return this.permissionGranted;
  }

  // Predefined notification methods for common scenarios
  async showTranslationComplete(
    totalItems: number,
    successCount: number,
    errorCount: number,
    duration: number
  ): Promise<NotificationResult> {
    const hasErrors = errorCount > 0;
    const title = hasErrors
      ? '⚠️ Translation completed with errors'
      : '✅ Translation completed successfully';

    const body = hasErrors
      ? `${successCount}/${totalItems} items translated successfully in ${Math.round(duration)}s. ${errorCount} errors occurred.`
      : `All ${totalItems} items translated successfully in ${Math.round(duration)}s.`;

    return this.showNotification({
      title,
      body,
      tag: 'translation-complete',
      requireInteraction: hasErrors, // Require interaction if there are errors
      icon: hasErrors ? '/error-icon.png' : '/success-icon.png'
    });
  }

  async showTranslationStarted(itemCount: number): Promise<NotificationResult> {
    return this.showNotification({
      title: '🚀 Translation started',
      body: `Processing ${itemCount} items...`,
      tag: 'translation-started',
      silent: true
    });
  }

  async showTranslationError(error: string): Promise<NotificationResult> {
    return this.showNotification({
      title: '❌ Translation failed',
      body: error,
      tag: 'translation-error',
      requireInteraction: true
    });
  }

  async showBatchProgress(currentBatch: number, totalBatches: number, itemsPerSecond: number): Promise<NotificationResult> {
    // Only show progress notifications for long-running tasks
    if (totalBatches < 10) {
      return { success: false, error: 'Batch too small for progress notifications' };
    }

    const percentage = Math.round((currentBatch / totalBatches) * 100);

    return this.showNotification({
      title: `🔄 Translation progress: ${percentage}%`,
      body: `Processing batch ${currentBatch}/${totalBatches} (${itemsPerSecond.toFixed(1)} items/sec)`,
      tag: 'translation-progress',
      silent: true
    });
  }

  // Test notification to verify setup
  async showTestNotification(): Promise<NotificationResult> {
    return this.showNotification({
      title: '🔔 Test Notification',
      body: 'Notifications are working correctly!',
      tag: 'test-notification',
      requireInteraction: false
    });
  }
}

// Export singleton instance
export const notificationManager = NotificationManager.getInstance();

// Helper functions for easy use
export const requestNotificationPermission = () => notificationManager.requestPermission();
export const showNotification = (options: NotificationOptions) => notificationManager.showNotification(options);
export const isNotificationSupported = () => 'Notification' in window;
export const getNotificationPermission = () => notificationManager.getPermissionStatus();

// Translation-specific helpers
export const notifyTranslationComplete = (
  totalItems: number,
  successCount: number,
  errorCount: number,
  duration: number
) => notificationManager.showTranslationComplete(totalItems, successCount, errorCount, duration);

export const notifyTranslationStarted = (itemCount: number) =>
  notificationManager.showTranslationStarted(itemCount);

export const notifyTranslationError = (error: string) =>
  notificationManager.showTranslationError(error);

export const notifyBatchProgress = (currentBatch: number, totalBatches: number, itemsPerSecond: number) =>
  notificationManager.showBatchProgress(currentBatch, totalBatches, itemsPerSecond);

export const showTestNotification = () => notificationManager.showTestNotification();
