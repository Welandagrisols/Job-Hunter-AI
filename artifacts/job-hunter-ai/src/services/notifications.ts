import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const CLASSIFICATION_LABELS: Record<string, string> = {
  interview_invite: "🎉 Interview Invite",
  offer: "🏆 Job Offer",
  rejection: "📭 Application Update",
  assessment: "📝 Assessment Received",
  follow_up: "📧 Follow-up Needed",
  other: "📬 Recruiter Email",
};

export const notificationService = {
  async requestPermissions(): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return false;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("recruiter-emails", {
        name: "Recruiter Emails",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#00D4FF",
        sound: "default",
      });

      await Notifications.setNotificationChannelAsync("reminders", {
        name: "Application Reminders",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
      });
    }

    return true;
  },

  async sendEmailAlert(
    from: string,
    subject: string,
    classification: string,
    urgency: "high" | "medium" | "low"
  ): Promise<void> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      const title = CLASSIFICATION_LABELS[classification] || "📬 Recruiter Email";
      const fromName = from.split("<")[0].trim() || from;

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: `From: ${fromName}\n${subject}`,
          sound: "default",
          data: { type: "email_alert", classification },
        },
        trigger: null,
      });
    } catch (err) {
      console.warn("Notification failed:", err);
    }
  },

  async scheduleFollowUpReminder(
    company: string,
    role: string,
    applicationId: string,
    daysAfterApply = 7
  ): Promise<void> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      const triggerDate = new Date();
      triggerDate.setDate(triggerDate.getDate() + daysAfterApply);
      triggerDate.setHours(9, 0, 0, 0);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "⏰ Follow-up Reminder",
          body: `Time to follow up on your ${role} application at ${company}`,
          sound: "default",
          data: { type: "follow_up_reminder", applicationId },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
      });
    } catch (err) {
      console.warn("Schedule reminder failed:", err);
    }
  },

  async scheduleDeadlineReminder(
    company: string,
    role: string,
    deadlineStr: string
  ): Promise<void> {
    try {
      const deadline = new Date(deadlineStr);
      if (isNaN(deadline.getTime())) return;

      const reminderDate = new Date(deadline);
      reminderDate.setDate(reminderDate.getDate() - 3);
      reminderDate.setHours(9, 0, 0, 0);

      if (reminderDate <= new Date()) return;

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "⚠️ Application Deadline in 3 Days",
          body: `${role} at ${company} closes on ${deadline.toLocaleDateString()}`,
          sound: "default",
          data: { type: "deadline_reminder", company, role },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate },
      });
    } catch (err) {
      console.warn("Deadline reminder failed:", err);
    }
  },

  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },
};
