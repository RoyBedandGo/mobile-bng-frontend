import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { api } from "./api";

const QUEUE_KEY = "@offline_sync_queue";

export const SyncManager = {
  // 1. Add an action to the local queue
  addToQueue: async (
    endpoint: string,
    method: "POST" | "PUT",
    payload: any,
    isMultipart: boolean = false, // <-- NEW: Tells the manager to build FormData later
  ) => {
    try {
      const existingQueue = await AsyncStorage.getItem(QUEUE_KEY);
      const queue = existingQueue ? JSON.parse(existingQueue) : [];

      queue.push({
        id: Date.now().toString(),
        endpoint,
        method,
        payload,
        isMultipart,
        timestamp: new Date().toISOString(),
      });

      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      console.log(`Saved task to offline queue! Queue size: ${queue.length}`);
    } catch (error) {
      console.error("Failed to queue item:", error);
    }
  },

  // 2. Process the queue when internet returns
  syncData: async () => {
    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected) return; // Still offline

    try {
      const existingQueue = await AsyncStorage.getItem(QUEUE_KEY);
      if (!existingQueue) return;

      const queue = JSON.parse(existingQueue);
      if (queue.length === 0) return;

      console.log(`📡 Internet found! Syncing ${queue.length} items...`);

      const remainingQueue = [];

      for (const task of queue) {
        try {
          let dataToSend = task.payload;
          let headers = {};

          // --- REBUILD FORMDATA FOR IMAGES ---
          if (task.isMultipart) {
            dataToSend = new FormData();
            headers = { "Content-Type": "multipart/form-data" };

            Object.keys(task.payload).forEach((key) => {
              const value = task.payload[key];

              if (Array.isArray(value) && key === "images") {
                // Handle image arrays
                value.forEach((img) => {
                  dataToSend.append("images", img as any);
                });
              } else if (typeof value === "object" && value !== null) {
                // Stringify JSON arrays (like condition, status, item_type)
                dataToSend.append(key, JSON.stringify(value));
              } else {
                // Standard strings/numbers
                dataToSend.append(key, String(value));
              }
            });
          }

          // --- SEND REQUEST ---
          if (task.method === "POST") {
            await api.post(task.endpoint, dataToSend, { headers });
          } else if (task.method === "PUT") {
            await api.put(task.endpoint, dataToSend, { headers });
          }

          console.log(`✅ Successfully synced task: ${task.endpoint}`);
        } catch (error) {
          console.error(`❌ Failed to sync task: ${task.endpoint}`, error);
          // Keep it in the queue to try again later
          remainingQueue.push(task);
        }
      }

      // Save whatever failed back to storage
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
    } catch (error) {
      console.error("Sync process error:", error);
    }
  },
};
