import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user } = useAuth();

  useEffect(() => {
    if (user) {
      router.replace("/(tabs)/properties");
    }
  }, [user]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(
        "Missing Fields",
        "Please enter both your email and password.",
      );
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post("/users/login", {
        email: email,
        password: password,
      });

      if (response.data.Status === "Success!") {
        const { access, user } = response.data;
        await signIn(access, user);
        Alert.alert("Success", `Welcome to the BedandGo App, ${user.name}!`);
        router.replace("/(tabs)/properties");
      } else {
        // Fallback just in case the server sends a 200 OK but the status isn't "Success!"
        Alert.alert(
          "Login Failed",
          response.data.Error || "User doesn't exist or wrong credentials.",
        );
      }
    } catch (error: any) {
      console.error("Login Error:", error);

      // Check if the error comes from the server (e.g., 401 Unauthorized or 404 Not Found)
      if (error.response) {
        const serverMessage = error.response.data?.Error;
        Alert.alert(
          "Login Failed",
          serverMessage || "User doesn't exist or wrong credentials.",
        );
      } else {
        // This triggers if the server is completely down or the phone has no internet
        Alert.alert(
          "Connection Error",
          "Could not reach the server. Make sure you are on the company Wi-Fi.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Login",
          headerStyle: { backgroundColor: "#66BAFF" },
          headerTintColor: "#fff",
        }}
      />
      <Text style={styles.title}>BedandGo</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>email:</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isLoading}
        />
        <Text style={styles.label}>password:</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!isLoading}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>LOGIN</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 40,
    color: "#333",
  },
  inputContainer: {
    width: "100%",
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: "#555",
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: "#fff",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#007BFF",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#A0C4FF",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
