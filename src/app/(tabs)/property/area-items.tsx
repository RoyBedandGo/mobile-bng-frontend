import { Ionicons } from "@expo/vector-icons";
// ---> 1. ADD useFocusEffect HERE <---
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
// ---> 2. ADD useCallback HERE <---
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../lib/api";

export default function AreaItemsScreen() {
  const { property_id, report_id, area_name, report_type, requires_contract } =
    useLocalSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const title = area_name ? String(area_name).toUpperCase() : "AREA ITEMS";
  console.log("AreaItemsScreen params:", {
    property_id,
    report_id,
    area_name,
    report_type,
    requires_contract,
  });

  // ---> 3. REPLACE useEffect WITH useFocusEffect & useCallback <---
  useFocusEffect(
    useCallback(() => {
      const fetchAreaItems = async () => {
        try {
          setIsLoading(true);
          const url = `/pm/items/report/${report_id}?area=${encodeURIComponent(
            String(area_name),
          )}`;
          const response = await api.get(url);
          setItems(response.data);
        } catch (error) {
          console.error("Failed to fetch area items:", error);
          Alert.alert("Error", "Could not load items for this area.");
        } finally {
          setIsLoading(false);
        }
      };

      if (report_id && area_name) {
        fetchAreaItems();
      }
    }, [report_id, area_name]),
  );

  const handleDelete = (itemId: string) => {
    Alert.alert(
      "Delete Item",
      "Are you sure you want to remove this item from the report?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // 1. Call the backend to set is_delete = 1 in the database
              await api.delete(`/pm/items/delete/${itemId}`);

              // 2. Remove the item from the local state so it instantly disappears from the screen
              setItems((prevItems) =>
                prevItems.filter((item) => item.report_item_id !== itemId),
              );

              console.log("Successfully deleted item:", itemId);
            } catch (error) {
              console.error("Failed to delete item:", error);
              Alert.alert(
                "Error",
                "Could not delete the item. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    // --- 1. SAFELY PARSE JSON STRINGS TO ARRAYS ---
    const safeParse = (data: any) => {
      if (typeof data === "string") {
        try {
          return JSON.parse(data);
        } catch (e) {
          return [];
        }
      }
      return Array.isArray(data) ? data : [];
    };

    const parsedImages = safeParse(item.images);
    const parsedCondition = safeParse(item.condition);
    const parsedStatus = safeParse(item.status);

    // --- 2. HANDLE ONLY IMAGES ---
    const validImageExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".webp",
    ];
    const filteredImages = parsedImages.filter((mediaUrl: string) => {
      const lowerUrl = mediaUrl.toLowerCase();
      return validImageExtensions.some((ext) => lowerUrl.endsWith(ext));
    });

    let displayImageUrl = null;
    let hasValidImage = false;

    if (filteredImages.length > 0) {
      displayImageUrl = filteredImages[0];
      hasValidImage = true;
    }

    // --- 3. FORMAT TEXT ---
    const conditionText =
      parsedCondition.length > 0 ? parsedCondition.join(", ") : "Unknown";
    const statusText =
      parsedStatus.length > 0 ? parsedStatus.join(", ") : "Unknown";

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => {
          router.push({
            pathname: "/property/item-details",
            params: {
              item_id: item.item_id, // Pass the ID of the item clicked
              report_id: report_id,
              property_id: property_id,
              area_name: area_name,
              report_type: report_type,
              requires_contract: requires_contract,
              report_item_id: item.report_item_id,
            },
          });
        }}
      >
        {/* Left Side: Name and Image */}
        <View style={styles.cardLeft}>
          <Text style={styles.itemName}>{item.item_name}</Text>

          {/* Render image if available, otherwise render a box with "No image" text */}
          {hasValidImage ? (
            <Image source={{ uri: displayImageUrl }} style={styles.itemImage} />
          ) : (
            <View style={[styles.itemImage, styles.placeholderBox]}>
              <Text style={styles.noImageText}>No image</Text>
            </View>
          )}
        </View>

        {/* Right Side: Details and Delete Button */}
        <View style={styles.cardRight}>
          {/* Condition and Status now in the right corner */}
          <View style={styles.detailsContainer}>
            <Text style={styles.itemDetailText}>{conditionText}</Text>
            <Text style={styles.itemDetailText}>{statusText}</Text>
          </View>

          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(item.report_item_id)}
            >
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.topNav}>
          <TouchableOpacity
            onPress={() => {
              // ---> EXPLICIT ROUTE BACK TO VIEW-REPORT <---
              router.push({
                pathname: "/property/view-report",
                params: {
                  property_id: property_id,
                  report_type: report_type,
                  requires_contract: requires_contract,
                },
              });
            }}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={28} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={styles.titleWrapper}>
          <Text style={styles.titleText}>{title}</Text>
        </View>
      </View>

      <View style={styles.listContainer}>
        {isLoading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#42A5F5" />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.centerContent}>
            <Text style={{ color: "#999" }}>
              No items recorded in this area yet.
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.report_item_id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  headerContainer: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 3,
    borderBottomColor: "#42A5F5",
    paddingBottom: 15,
  },
  topNav: { paddingHorizontal: 15, paddingTop: 10, alignItems: "flex-start" },
  backButton: { padding: 5 },
  titleWrapper: { alignItems: "center", marginTop: 5 },
  titleText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333333",
    letterSpacing: 0.5,
  },

  listContainer: { flex: 1, backgroundColor: "#EEEEEE" },
  listContent: { paddingHorizontal: 15, paddingTop: 20, paddingBottom: 50 },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    flexDirection: "row",
    padding: 15,
    marginBottom: 15,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: { elevation: 2 },
    }),
  },
  cardLeft: { flex: 1 },
  itemName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 10,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 6,
    backgroundColor: "#F5F5F5",
  },
  placeholderBox: {
    justifyContent: "center",
    alignItems: "center",
  },
  noImageText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#999",
    textAlign: "center",
  },

  cardRight: {
    flex: 1.5,
    flexDirection: "column",
    justifyContent: "space-between",
  },
  detailsContainer: {
    alignItems: "flex-end", // Align text to the right corner of its container
    width: "100%",
    paddingRight: 10, // Add padding on the right side
  },
  itemDetailText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 6,
    textAlign: "right",
  },

  actionContainer: {
    alignItems: "flex-end",
    justifyContent: "flex-end",
    width: "100%",
  },
  deleteBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FFCDD2",
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderRadius: 4,
    marginTop: 10,
  },
  deleteBtnText: { color: "#FF8A80", fontSize: 12, fontWeight: "500" },
});
