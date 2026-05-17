import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "JobHunter AI",
  slug: "job-hunter-ai",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  splash: {
    backgroundColor: "#0A0F1E",
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#0A0F1E",
    },
    package: "com.wesleykipkemoi.jobhunterai",
    permissions: [
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
      "POST_NOTIFICATIONS",
    ],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#00D4FF",
      },
    ],
  ],
  scheme: "jobhunterai",
  extra: {
    eas: {
      projectId: "YOUR_EAS_PROJECT_ID",
    },
  },
});
