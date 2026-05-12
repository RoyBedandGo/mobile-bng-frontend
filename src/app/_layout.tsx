import NetInfo from "@react-native-community/netinfo";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { AuthProvider } from "../hooks/useAuth";
import { SyncManager } from "../lib/SyncManager"; // Adjust import path

export default function RootLayout() {
  useEffect(() => {
    // This listens for network changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        // If we get internet back, run the sync automatically!
        SyncManager.syncData();
      }
    });

    // Cleanup the listener when the app closes
    return () => {
      unsubscribe();
    };
  }, []);
  return (
    <AuthProvider>
      <Stack>
        {/* Hides the header for the Login screen */}
        <Stack.Screen name="login" options={{ headerShown: false }} />

        {/* ADD THIS LINE: Hides the root header for the entire tabs folder */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
