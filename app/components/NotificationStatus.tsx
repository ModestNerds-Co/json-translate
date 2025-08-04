import * as React from "react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { cn } from "../lib/utils";

export interface NotificationStatusProps {
  className?: string;
  showPermissionButton?: boolean;
  onPermissionGranted?: () => void;
}

export function NotificationStatus({
  className,
  showPermissionButton = true,
  onPermissionGranted,
}: NotificationStatusProps) {
  const [permission, setPermission] = React.useState<NotificationPermission>("default");
  const [isRequestingPermission, setIsRequestingPermission] = React.useState(false);

  React.useEffect(() => {
    // Check if notifications are supported
    if ("Notification" in window) {
      setPermission(Notification.permission);
    } else {
      setPermission("denied");
    }
  }, []);

  const handleRequestPermission = async () => {
    if (!("Notification" in window)) {
      return;
    }

    setIsRequestingPermission(true);

    try {
      const { notificationManager } = await import("../lib/notifications");
      const result = await notificationManager.requestPermission();

      setPermission(Notification.permission);

      if (result.success && onPermissionGranted) {
        onPermissionGranted();
        // Show test notification
        await notificationManager.showTestNotification();
      }
    } catch (error) {
      console.error("Failed to request notification permission:", error);
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const getStatusInfo = () => {
    switch (permission) {
      case "granted":
        return {
          icon: "🔔",
          text: "Notifications enabled",
          variant: "success" as const,
          description: "You'll be notified when translations complete",
        };
      case "denied":
        return {
          icon: "🔕",
          text: "Notifications blocked",
          variant: "destructive" as const,
          description: "Enable in browser settings to get completion notifications",
        };
      case "default":
        return {
          icon: "❓",
          text: "Notifications not configured",
          variant: "secondary" as const,
          description: "Click to enable completion notifications",
        };
      default:
        return {
          icon: "❓",
          text: "Unknown status",
          variant: "secondary" as const,
          description: "Unable to determine notification status",
        };
    }
  };

  const statusInfo = getStatusInfo();

  if (!("Notification" in window)) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Badge variant="secondary" className="text-xs">
          🚫 Notifications not supported
        </Badge>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge variant={statusInfo.variant} className="text-xs flex items-center gap-1">
        <span>{statusInfo.icon}</span>
        <span>{statusInfo.text}</span>
      </Badge>

      {permission !== "granted" && showPermissionButton && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRequestPermission}
          disabled={isRequestingPermission}
          className="text-xs h-6"
        >
          {isRequestingPermission ? "Requesting..." : "Enable"}
        </Button>
      )}
    </div>
  );
}

export default NotificationStatus;
