import "react-native-url-polyfill/auto";
import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { notificationService } from "./src/services/notifications";
import { backgroundService } from "./src/services/background";
import { gmailService } from "./src/services/gmail";
import Navigation from "./src/navigation";

export default function App() {
  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    // Request notification permissions
    await notificationService.requestPermissions();

    // Register notification tap handler
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log("Notification tapped:", data);
      // Navigation can be handled here when user taps notification
    });

    // If Gmail already connected, start monitoring
    const isConnected = await gmailService.isSignedIn();
    if (isConnected) {
      await backgroundService.register();
      // Do an initial check on app open
      gmailService.checkForNewEmails().catch(console.error);
    }

    return () => subscription.remove();
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="transparent" translucent />
      <Navigation />
    </SafeAreaProvider>
  );
}
