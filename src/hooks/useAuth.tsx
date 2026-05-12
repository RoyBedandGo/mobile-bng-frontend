import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api"; // 🚨 1. IMPORT YOUR API INSTANCE

// 1. Define what our User object looks like
type User = {
  name: string;
  email?: string;
  position?: string;
  department?: string;
  // add any other fields your Express server sends back
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  signIn: (token: string, userData: User) => Promise<void>;
  signOut: () => Promise<void>;
};

// 2. Create the Context
const AuthContext = createContext<AuthContextType | null>(null);

// 3. Create the Provider Wrapper
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // When the app first opens, check if they are already logged in
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync("bedandgo_token");
        const storedUser = await SecureStore.getItemAsync("bedandgo_user");

        if (storedToken && storedUser) {
          // 🚨 2. APP RESTART FIX: Instantly attach token to Axios on boot
          api.defaults.headers.common["Authorization"] =
            `Bearer ${storedToken}`;
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error("Failed to load user data", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  // Function to call when they successfully log in
  const signIn = async (token: string, userData: User) => {
    await SecureStore.setItemAsync("bedandgo_token", token);
    await SecureStore.setItemAsync("bedandgo_user", JSON.stringify(userData));

    // 🚨 3. THE CRITICAL LOGIN FIX: Instantly inject token into Axios
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    setUser(userData);
  };

  // Function to call when they log out
  const signOut = async () => {
    await SecureStore.deleteItemAsync("bedandgo_token");
    await SecureStore.deleteItemAsync("bedandgo_user");

    // 🚨 4. SECURITY FIX: Wipe the token from Axios memory on logout
    delete api.defaults.headers.common["Authorization"];

    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// 4. Create a simple hook so we don't have to import useContext everywhere
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
