import axios from "axios";
import * as SecureStore from "expo-secure-store"; // <-- Changed to SecureStore!

const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// --- UPDATED: Global Request Interceptor ---
api.interceptors.request.use(
  async (config) => {
    try {
      // Step 1: Look in the SecureStore vault using your exact key!
      const token = await SecureStore.getItemAsync("bedandgo_token");

      // Step 2: Attach it to the headers
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        console.log("WARNING: bedandgo_token is null in SecureStore!");
      }
    } catch (error) {
      console.error("Error attaching token to request:", error);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);
// ---------------------------------------

// Example function to call your Express backend
export const testConnection = async () => {
  try {
    const response = await api.get("/api/health-check");
    return response.data;
  } catch (error) {
    console.error("API Connection Error:", error);
    throw error;
  }
};
