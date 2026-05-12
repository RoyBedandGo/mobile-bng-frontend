import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo"; // <-- NEW
import * as ImageManipulator from "expo-image-manipulator"; // <-- NEW
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../lib/api";
import { SyncManager } from "../../../lib/SyncManager"; // <-- NEW

export default function RecoveryReportScreen() {
  const {
    item_id,
    report_id,
    property_id,
    area_name,
    report_type,
    requires_contract,
    report_item_id,
  } = useLocalSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track if a recovery report already exists
  const [existingRecoveryId, setExistingRecoveryId] = useState<string | null>(
    null,
  );

  // --- BEFORE STATE (Fetched from DB) ---
  const [itemName, setItemName] = useState("");
  const [area, setArea] = useState("");
  const [condition, setCondition] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>([]);
  const [beforeImages, setBeforeImages] = useState<string[]>([]);

  // --- AFTER STATE (User Input) ---
  const [recoveryTitle, setRecoveryTitle] = useState("");
  const [afterImages, setAfterImages] = useState<string[]>([]);

  // Media Viewer State
  const [selectedMedia, setSelectedMedia] = useState<{
    url: string;
    type: "image" | "video";
  } | null>(null);

  const isVideo = (url: string | null) =>
    !!url?.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/);

  const fullScreenPlayer = useVideoPlayer(
    selectedMedia?.type === "video" ? selectedMedia.url : "",
    (player) => {
      player.loop = true;
      player.play();
    },
  );

  useEffect(() => {
    if (!selectedMedia) fullScreenPlayer?.pause();
  }, [selectedMedia]);

  // --- 1. FETCH 'BEFORE' & 'AFTER' DETAILS ---
  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        const cleanItemId = String(item_id).trim();
        try {
          setIsLoading(true);

          // A. Fetch "Before" Details
          const detailsResponse = await api.get(
            `/pm/items/details/${report_id}/${cleanItemId}`,
          );
          const data = detailsResponse.data;

          const safeParse = (val: any) => {
            if (!val) return [];
            if (typeof val === "string") {
              try {
                return JSON.parse(val);
              } catch {
                return [];
              }
            }
            return Array.isArray(val) ? val : [];
          };

          setItemName(data.item_name || "");
          setArea(data.area || "");
          setCondition(safeParse(data.condition));
          setStatus(safeParse(data.status));
          setBeforeImages(safeParse(data.images));

          // B. Fetch "After" (Recovery) Details
          const recoveryResponse = await api.get(
            `/pm/reports/recovery/details/${report_item_id}`,
          );
          const fetchedReports = recoveryResponse.data.reports || [];

          if (fetchedReports.length > 0) {
            // Populate the form with the existing recovery report data
            const latestRecovery = fetchedReports[0];
            setExistingRecoveryId(latestRecovery.id);
            setRecoveryTitle(latestRecovery.recovery_title);
            setAfterImages(safeParse(latestRecovery.images));
          } else {
            // Reset in case they navigate back and forth
            setExistingRecoveryId(null);
            setRecoveryTitle("");
            setAfterImages([]);
          }
        } catch (error: any) {
          Alert.alert("Error", "Could not load report details.");
          router.back();
        } finally {
          setIsLoading(false);
        }
      };

      if (item_id && item_id !== "undefined") fetchData();
    }, [item_id, report_id]),
  );

  // ---> NEW: IMAGE MANIPULATOR HELPER <---
  const processMediaAsset = async (uri: string) => {
    if (isVideo(uri)) return uri; // Don't compress videos
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      return manipResult.uri;
    } catch (error) {
      console.error("Failed to compress image:", error);
      return uri; // Fallback to original
    }
  };

  // --- 2. HANDLE 'AFTER' MEDIA ---
  const handlePickMedia = () => {
    Alert.alert("Add Media", "Choose an option", [
      {
        text: "Take Photo/Video",
        onPress: async () => {
          const permissionResult =
            await ImagePicker.requestCameraPermissionsAsync();
          if (permissionResult.granted === false) {
            Alert.alert(
              "Permission Required",
              "You need to grant camera permissions.",
            );
            return;
          }

          let result = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images", "videos"],
            allowsEditing: false,
            quality: 1, // Keep 1 so manipulator handles compression
          });

          if (!result.canceled) {
            const processedUri = await processMediaAsset(result.assets[0].uri);
            setAfterImages((prev) => [...prev, processedUri]);
          }
        },
      },
      {
        text: "Choose from Gallery",
        onPress: async () => {
          let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images", "videos"],
            allowsEditing: false,
            quality: 1, // Keep 1 so manipulator handles compression
          });

          if (!result.canceled) {
            const processedUri = await processMediaAsset(result.assets[0].uri);
            setAfterImages((prev) => [...prev, processedUri]);
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleRemoveMedia = (indexToRemove: number) => {
    setAfterImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // --- 3. SUBMIT RECOVERY REPORT (CREATE) ---
  const handleCreateRecovery = async () => {
    if (!recoveryTitle.trim()) {
      Alert.alert("Required", "Please enter a Recovery Title.");
      return;
    }

    let rawPayload: any;

    try {
      setIsSubmitting(true);

      // 1. Build Raw Payload for Queue
      rawPayload = {
        report_item_id: String(report_item_id),
        recovery_title: recoveryTitle,
        images: afterImages.map((uri, index) => {
          const isVid = isVideo(uri);
          const ext = uri.split(".").pop() || (isVid ? "mp4" : "jpg");
          return {
            uri: uri,
            name: `recovery_${index}.${ext}`,
            type: isVid ? `video/${ext}` : `image/${ext}`,
          };
        }),
      };

      // 2. Check Network
      const networkState = await NetInfo.fetch();

      if (!networkState.isConnected) {
        await SyncManager.addToQueue(
          `/pm/reports/recovery/add`,
          "POST",
          rawPayload,
          true,
        );
        Alert.alert(
          "Offline",
          "Recovery report saved offline and will sync automatically.",
        );
        // router.back();
        return;
      }

      // 3. Online Upload
      const formData = new FormData();
      formData.append("report_item_id", String(report_item_id));
      formData.append("recovery_title", recoveryTitle);

      afterImages.forEach((uri, index) => {
        const isVid = isVideo(uri);
        const ext = uri.split(".").pop() || (isVid ? "mp4" : "jpg");

        formData.append("images", {
          uri: uri,
          name: `recovery_${index}.${ext}`,
          type: isVid ? `video/${ext}` : `image/${ext}`,
        } as any);
      });

      await api.post(`/pm/reports/recovery/add`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Alert.alert("Success", "Recovery Report Created!");
      // router.back();
    } catch (error: any) {
      if (error.message === "Network Error" || error.response === undefined) {
        await SyncManager.addToQueue(
          `/pm/reports/recovery/add`,
          "POST",
          rawPayload,
          true,
        );
        Alert.alert(
          "Weak Signal",
          "Saved offline. Will sync when connection improves.",
        );
        // router.back();
      } else {
        console.error(error);
        Alert.alert("Error", "Failed to create recovery report.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 4. UPDATE RECOVERY REPORT (EDIT) ---
  const handleUpdateRecovery = async () => {
    if (!recoveryTitle.trim()) {
      Alert.alert("Required", "Please enter a Recovery Title.");
      return;
    }

    let rawPayload: any;

    try {
      setIsSubmitting(true);

      const existingImages = afterImages.filter((img) =>
        img.startsWith("http"),
      );
      const newLocalImages = afterImages.filter((img) =>
        img.startsWith("file://"),
      );

      // 1. Build Raw Payload for Queue
      rawPayload = {
        recovery_title: recoveryTitle,
        existing_images: existingImages,
        new_images: newLocalImages.map((uri, index) => {
          const isVid = isVideo(uri);
          const ext = uri.split(".").pop() || (isVid ? "mp4" : "jpg");
          return {
            uri: uri,
            name: `media_${index}.${ext}`,
            type: isVid ? `video/${ext}` : `image/${ext}`,
          };
        }),
      };

      // 2. Check Network
      const networkState = await NetInfo.fetch();

      if (!networkState.isConnected) {
        await SyncManager.addToQueue(
          `/pm/reports/recovery/update/${existingRecoveryId}`,
          "PUT",
          rawPayload,
          true,
        );
        Alert.alert(
          "Offline",
          "Update saved offline and will sync automatically.",
        );
        // router.back();
        return;
      }

      // 3. Online Upload
      const formData = new FormData();
      formData.append("recovery_title", recoveryTitle);
      formData.append("existing_images", JSON.stringify(existingImages));

      newLocalImages.forEach((uri, index) => {
        const isVid = isVideo(uri);
        const ext = uri.split(".").pop() || (isVid ? "mp4" : "jpg");

        formData.append("new_images", {
          uri: uri,
          name: `media_${index}.${ext}`,
          type: isVid ? `video/${ext}` : `image/${ext}`,
        } as any);
      });

      await api.put(
        `/pm/reports/recovery/update/${existingRecoveryId}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );

      Alert.alert("Success", "Recovery Report Updated!");
      router.back();
    } catch (error: any) {
      if (error.message === "Network Error" || error.response === undefined) {
        await SyncManager.addToQueue(
          `/pm/reports/recovery/update/${existingRecoveryId}`,
          "PUT",
          rawPayload,
          true,
        );
        Alert.alert(
          "Weak Signal",
          "Update saved offline. Will sync when connection improves.",
        );
        router.back();
      } else {
        console.error(error);
        Alert.alert("Error", "Failed to update recovery report.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#42A5F5" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: "/property/item-details",
              params: {
                item_id,
                report_id,
                property_id,
                area_name,
                report_type,
                requires_contract,
                report_item_id,
              },
            })
          }
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.mainTitle}>Recovery Report</Text>

        {/* Item Info Row */}
        <View style={styles.itemInfoRow}>
          <Text style={styles.itemInfoText}>{itemName}</Text>
          <Text style={styles.itemInfoText}>{area}</Text>
        </View>

        {/* --- BEFORE SECTION --- */}
        <Text style={styles.sectionHeader}>BEFORE</Text>
        <View style={styles.beforeDetails}>
          <Text style={styles.detailLabel}>
            Condition:{" "}
            <Text style={styles.detailValue}>
              {condition.join(" • ") || "None"}
            </Text>
          </Text>
          <Text style={styles.detailLabel}>
            Status:{" "}
            <Text style={styles.detailValue}>
              {status.join(" • ") || "None"}
            </Text>
          </Text>
        </View>

        <View style={styles.mediaContainer}>
          {beforeImages.map((mediaUrl, index) => {
            const mediaType = isVideo(mediaUrl) ? "video" : "image";
            return (
              <TouchableOpacity
                key={`before-${index}`}
                activeOpacity={0.8}
                onPress={() =>
                  setSelectedMedia({ url: mediaUrl, type: mediaType })
                }
              >
                <View style={styles.videoThumbnailContainer}>
                  <Image
                    source={{ uri: mediaUrl }}
                    style={styles.mediaThumbnail}
                  />
                  {mediaType === "video" && (
                    <View style={styles.playIconOverlay}>
                      <Ionicons
                        name="play-circle"
                        size={40}
                        color="rgba(255,255,255,0.9)"
                      />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          {beforeImages.length === 0 && (
            <Text style={styles.noMediaText}>No previous media</Text>
          )}
        </View>

        <View style={styles.divider} />

        {/* --- AFTER SECTION --- */}
        <Text style={styles.sectionHeader}>AFTER</Text>

        <Text style={styles.inputLabel}>Recovery Title</Text>
        <View style={styles.inputBox}>
          <TextInput
            style={styles.textInput}
            value={recoveryTitle}
            onChangeText={setRecoveryTitle}
            placeholder="e.g. Repair Electric Fan"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.mediaContainer}>
          {afterImages.map((mediaUrl, index) => {
            const mediaType = isVideo(mediaUrl) ? "video" : "image";
            return (
              <View
                key={`after-${index}`}
                style={styles.videoThumbnailContainer}
              >
                {/* Media Click -> Full Screen */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() =>
                    setSelectedMedia({ url: mediaUrl, type: mediaType })
                  }
                >
                  <Image
                    source={{ uri: mediaUrl }}
                    style={styles.mediaThumbnail}
                  />
                  {mediaType === "video" && (
                    <View style={styles.playIconOverlay}>
                      <Ionicons
                        name="play-circle"
                        size={40}
                        color="rgba(255,255,255,0.9)"
                      />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Remove Media Button */}
                <TouchableOpacity
                  style={styles.removeMediaBadge}
                  onPress={() => handleRemoveMedia(index)}
                >
                  <Ionicons name="close" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            );
          })}

          <TouchableOpacity
            style={styles.addMediaBtn}
            onPress={handlePickMedia}
          >
            <Ionicons name="add-circle-outline" size={32} color="#666" />
            <Text style={styles.addMediaText}>Add Media</Text>
          </TouchableOpacity>
        </View>

        {/* --- DYNAMIC ACTION BUTTONS --- */}
        <View style={styles.actionButtonsContainer}>
          {!existingRecoveryId ? (
            <TouchableOpacity
              style={[styles.primaryBtn, isSubmitting && { opacity: 0.7 }]}
              onPress={handleCreateRecovery}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Create</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.secondaryBtn, isSubmitting && { opacity: 0.7 }]}
              onPress={handleUpdateRecovery}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.secondaryBtnText}>Edit</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Full Screen Media Viewer */}
      <Modal visible={!!selectedMedia} transparent={true} animationType="fade">
        <View style={styles.fullScreenOverlay}>
          <TouchableOpacity
            style={styles.closeModalBtn}
            onPress={() => setSelectedMedia(null)}
          >
            <Ionicons name="close" size={36} color="#FFFFFF" />
          </TouchableOpacity>
          {selectedMedia?.type === "video" ? (
            <VideoView
              player={fullScreenPlayer}
              style={styles.fullScreenMedia}
              contentFit="contain"
              nativeControls
            />
          ) : (
            <Image
              source={{ uri: selectedMedia?.url }}
              style={styles.fullScreenMedia}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  backButton: { padding: 5 },
  scrollContent: { paddingHorizontal: 25, paddingBottom: 40 },

  mainTitle: {
    fontSize: 22,
    color: "#666",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 20,
  },

  itemInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  itemInfoText: { fontSize: 12, color: "#333", fontWeight: "500" },

  sectionHeader: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 15,
  },

  beforeDetails: { marginBottom: 15 },
  detailLabel: { fontSize: 12, color: "#666", marginBottom: 5 },
  detailValue: { color: "#999" },

  divider: { height: 1, backgroundColor: "#E0E0E0", marginVertical: 30 },

  inputLabel: { fontSize: 12, color: "#333", marginBottom: 6, marginLeft: 2 },
  inputBox: {
    backgroundColor: "#EEEEEE",
    minHeight: 45,
    paddingHorizontal: 15,
    justifyContent: "center",
    borderRadius: 6,
    marginBottom: 20,
  },
  textInput: { fontSize: 14, color: "#333", padding: 0 },

  mediaContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  mediaThumbnail: {
    height: 100,
    width: 100,
    borderRadius: 8,
    backgroundColor: "#EEE",
  },
  videoThumbnailContainer: { position: "relative", height: 100, width: 100 },
  playIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 8,
  },
  noMediaText: { fontSize: 12, color: "#999", fontStyle: "italic" },

  removeMediaBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#FF5252",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
    zIndex: 2,
  },
  addMediaBtn: {
    height: 100,
    width: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#CCC",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
  },
  addMediaText: {
    fontSize: 10,
    color: "#666",
    marginTop: 4,
    fontWeight: "bold",
  },

  actionButtonsContainer: { marginTop: 20 },
  primaryBtn: {
    backgroundColor: "#777777",
    paddingVertical: 15,
    borderRadius: 4,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "500" },
  secondaryBtn: {
    backgroundColor: "#777777",
    paddingVertical: 15,
    borderRadius: 4,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "500" },

  fullScreenOverlay: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  closeModalBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  fullScreenMedia: { width: "100%", height: "100%" },
});
