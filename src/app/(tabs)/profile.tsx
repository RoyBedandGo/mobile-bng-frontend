import { router } from "expo-router";
import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../hooks/useAuth";

// Don't forget to import Ionicons at the very top if you use the icon in the button!
import { Ionicons } from "@expo/vector-icons"; // Import your custom auth hook

export default function ProfileScreen() {
  const { user, signOut } = useAuth(); // Pull the user data and the logout function

  const handleLogout = async () => {
    // Optional: Ask for confirmation before logging out
    Alert.alert("Logout", "Are you sure you want to log out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Yes, Log Out",
        style: "destructive", // Makes the button text red on iOS
        onPress: async () => {
          await signOut(); // Clears SecureStore memory
          router.replace("/login"); // Sends them back to the login screen
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Display the logged-in user's info */}
      <View style={styles.userInfoCard}>
        <Text style={styles.label}>Logged in as:</Text>
        <Text style={styles.userName}>{user?.name || "Administrator"}</Text>
        <Text style={styles.userEmail}>
          {user?.email || "No email provided"}
        </Text>
      </View>

      {/* The Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} />
        <Text style={styles.logoutText}>LOGOUT</Text>
      </TouchableOpacity>
    </View>
  );
}

// Don't forget to import Ionicons at the very top if you use the icon in the button!
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#FAFAFA",
    justifyContent: "space-between", // Pushes the user info to the top, and button to the bottom
  },
  userInfoCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EAEAEA",
    alignItems: "center",
    marginTop: 20,
  },
  label: {
    fontSize: 14,
    color: "#888",
    marginBottom: 8,
  },
  userName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: "#555",
  },
  logoutButton: {
    backgroundColor: "#FF3B30", // Standard iOS warning/destructive red
    flexDirection: "row",
    paddingVertical: 15,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  logoutText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
