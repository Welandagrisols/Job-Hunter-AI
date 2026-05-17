// Background email monitoring requires a native build (not Expo Go)
// This service provides a graceful stub for the web/Expo Go environment

export const backgroundService = {
  async register(): Promise<boolean> {
    // Background fetch requires expo-background-fetch + native build
    console.log("[Background] Background monitoring requires a native build");
    return false;
  },

  async unregister(): Promise<void> {
    // no-op in web/Expo Go
  },

  async isRegistered(): Promise<boolean> {
    return false;
  },
};
