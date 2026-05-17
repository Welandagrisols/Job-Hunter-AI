import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Configure how notifications appear
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

const URGENCY_PRIORITIES: Record<string, Notifications.AndroidNotificationPriority> = {
  high: Notifications.AndroidNotificationPriority.MAX,
  medium: Notifications.AndroidNotificationPriority.HIGH,
  low: Notifications.AndroidNotificationPriority.DEFAULT,
};

export const notificationService = {
  // Request permissions
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

  // Send email alert notification
  async sendEmailAlert(
    from: string,
    subject: string,
    classification: string,
    urgency: "high" | "medium" | "low"
  ): Promise<void> {
    const title = CLASSIFICATION_LABELS[classification] || "📬 Recruiter Email";
    const fromName = from.split("<")[0].trim() || from;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: `From: ${fromName}\n${subject}`,
        sound: "default",
        priority: URGENCY_PRIORITIES[urgency],
        data: { type: "email_alert", classification },
        color: classification === "interview_invite" || classification === "offer"
          ? "#00D4FF"
          : "#FF6B6B",
      },
      trigger: null, // Show immediately
    });
  },

  // Remind to follow up on applications
  async scheduleFollowUpReminder(
    company: string,
    role: string,
    applicationId: string,
    daysAfterApply = 7
  ): Promise<void> {
    const triggerDate = new Date();
    triggerDate.setDate(triggerDate.getDate() + daysAfterApply);
    triggerDate.setHours(9, 0, 0, 0); // 9am

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "⏰ Follow-up Reminder",
        body: `Time to follow up on your ${role} application at ${company}`,
        sound: "default",
        data: { type: "follow_up_reminder", applicationId },
      },
      trigger: {
        date: triggerDate,
        channelId: "reminders",
      },
    });
  },

  // Deadline reminder
  async scheduleDeadlineReminder(
    company: string,
    role: string,
    deadline: Date
  ): Promise<void> {
    const reminderDate = new Date(deadline);
    reminderDate.setDate(reminderDate.getDate() - 1); // 1 day before
    reminderDate.setHours(8, 0, 0, 0);

    if (reminderDate > new Date()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "⚠️ Application Deadline Tomorrow",
          body: `${role} at ${company} deadline is tomorrow!`,
          sound: "default",
          data: { type: "deadline_reminder" },
        },
        trigger: {
          date: reminderDate,
          channelId: "reminders",
        },
      });
    }
  },

  // Cancel all scheduled notifications
  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },
};
