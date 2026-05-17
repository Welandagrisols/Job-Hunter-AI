import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import { gmailService } from "./gmail";

const BACKGROUND_FETCH_TASK = "background-email-check";

// Define the background task
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const isSignedIn = await gmailService.isSignedIn();
    if (!isSignedIn) return BackgroundFetch.BackgroundFetchResult.NoData;

    const newEmails = await gmailService.checkForNewEmails();
    console.log(`[Background] Found ${newEmails} new recruiter emails`);

    return newEmails > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error("[Background] Email check failed:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const backgroundService = {
  // Register background fetch (runs every ~15 minutes minimum on Android)
  async register(): Promise<boolean> {
    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 15 * 60, // 15 minutes (minimum allowed)
        stopOnTerminate: false,   // Continue after app is closed
        startOnBoot: true,        // Start after device restart
      });
      console.log("[Background] Email monitoring registered");
      return true;
    } catch (error) {
      console.error("[Background] Registration failed:", error);
      return false;
    }
  },

  // Unregister
  async unregister(): Promise<void> {
    try {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    } catch (error) {
      console.error("[Background] Unregister failed:", error);
    }
  },

  // Check if registered
  async isRegistered(): Promise<boolean> {
    const status = await BackgroundFetch.getStatusAsync();
    return status === BackgroundFetch.BackgroundFetchStatus.Available;
  },
};
