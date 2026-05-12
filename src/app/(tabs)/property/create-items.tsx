import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { useAuth } from "../../../hooks/useAuth";
import { api } from "../../../lib/api";

import NetInfo from "@react-native-community/netinfo";
import { SyncManager } from "../../../lib/SyncManager";

// --- CONSTANTS ---
const AREA_OPTIONS = [
  "Kitchen Area",
  "Living Room",
  "Master Bedroom",
  "Bedroom",
  "Bathroom",
  "Dining Area",
  "Balcony",
];
const ITEM_TYPES = [
  "Sanitary",
  "Electrical",
  "Appliance",
  "Fixture",
  "Furniture",
];
const CONDITIONS = [
  "Busted",
  "Stain",
  "Dirty",
  "Good",
  "Working",
  "Expired",
  "Not Cooling",
  "Broken",
  "Damaged",
];
const STATUSES = [
  "Repair",
  "Replace",
  "Cleaning",
  "Laundry",
  "Shampooing",
  "Working",
];

// --- CUSTOM UI COMPONENTS ---
const Chip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <View style={styles.chip}>
    <Text style={styles.chipText}>{label}</Text>
    <TouchableOpacity onPress={onRemove} style={styles.chipRemove}>
      <Ionicons name="close-circle" size={16} color="#666" />
    </TouchableOpacity>
  </View>
);

const MultiSelectPicker = ({
  selectedValues,
  options,
  onAdd,
  onRemove,
  placeholder,
}: any) => {
  const [modalVisible, setModalVisible] = useState(false);
  const availableOptions = options.filter(
    (opt: string) => !selectedValues.includes(opt),
  );

  return (
    <>
      <TouchableOpacity
        style={styles.inputBox}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        {selectedValues.length > 0 ? (
          <View style={styles.chipContainer}>
            {selectedValues.map((val: string) => (
              <Chip key={val} label={val} onRemove={() => onRemove(val)} />
            ))}
          </View>
        ) : (
          <Text style={styles.placeholderText}>{placeholder}</Text>
        )}
        <Ionicons name="caret-down" size={16} color="#666" />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            {availableOptions.length === 0 ? (
              <Text style={{ textAlign: "center", padding: 20, color: "#999" }}>
                All options selected
              </Text>
            ) : (
              <FlatList
                data={availableOptions}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      onAdd(item);
                      setModalVisible(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const SingleSelectPicker = ({ value, options, onSelect, placeholder }: any) => {
  const [modalVisible, setModalVisible] = useState(false);
  return (
    <>
      <TouchableOpacity
        style={styles.inputBox}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.inputText, !value && styles.placeholderText]}>
          {value || placeholder}
        </Text>
        <Ionicons name="caret-down" size={16} color="#666" />
      </TouchableOpacity>
      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    onSelect(item);
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

// --- MAIN SCREEN ---
export default function CreateItemScreen() {
  const { property_id, report_id } = useLocalSearchParams();

  const { user } = useAuth();

  // --- FORM STATES ---
  const [area, setArea] = useState<string>("Kitchen Area");
  const [itemType, setItemType] = useState<string[]>([]);
  const [itemName, setItemName] = useState<string>("");
  const [condition, setCondition] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>([]);
  const [comment, setComment] = useState<string>("");

  // MEDIA STATES
  const [selectedMedia, setSelectedMedia] = useState<
    ImagePicker.ImagePickerAsset[]
  >([]);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // ---> NEW: MEDIA CONVERSION HELPER <---
  // ---> NEW: MEDIA CONVERSION HELPER <---
  const processMediaAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    // We don't convert videos, skip them
    if (asset.type === "video") return asset;

    try {
      // ---> THE FIX: Add the resize action! <---
      // This shrinks a massive 4000px phone camera photo down to a max width of 800px.
      // The height will scale automatically to maintain the aspect ratio.
      const manipResult = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 800 } }], // 👈 WE ADDED THE RESIZE ACTION HERE
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }, // 👈 Lowered compress to 0.7 for optimal PDF size
      );

      // Create a clean filename ending in .jpg
      const newFileName = asset.fileName
        ? asset.fileName.replace(/\.[^/.]+$/, ".jpg")
        : `image_${Date.now()}.jpg`;

      // Return the updated asset object imitating the original ImagePicker output
      return {
        ...asset,
        uri: manipResult.uri,
        fileName: newFileName,
        mimeType: "image/jpeg",
      };
    } catch (error) {
      console.error("Image conversion failed. Using original asset.", error);
      return asset;
    }
  };

  // --- MEDIA HANDLERS ---
  const pickImage = async () => {
    setMediaModalVisible(false);

    setTimeout(async () => {
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images", "videos"],
          allowsEditing: false,
          quality: 1,
        });

        if (!result.canceled && result.assets) {
          if (selectedMedia.length >= 5) {
            Alert.alert(
              "Limit Reached",
              "You can only upload up to 5 files per item.",
            );
            return;
          }

          const originalMedia = result.assets[0];

          // Convert the image natively on the device
          const processedMedia = await processMediaAsset(originalMedia);

          setSelectedMedia((prev) => [...prev, processedMedia]);
          runAIAnalysis(processedMedia);
        }
      } catch (error: any) {
        console.error("Gallery Error:", error);
      }
    }, 600);
  };

  const takePhoto = async () => {
    setMediaModalVisible(false);

    setTimeout(async () => {
      try {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Denied",
            "Please go to your iPhone Settings and enable Camera access.",
          );
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images", "videos"],
          allowsEditing: false,
          quality: 1,
        });

        if (!result.canceled && result.assets) {
          if (selectedMedia.length >= 5) {
            Alert.alert(
              "Limit Reached",
              "You can only upload up to 5 files per item.",
            );
            return;
          }

          const originalMedia = result.assets[0];

          // Convert the image natively on the device
          const processedMedia = await processMediaAsset(originalMedia);

          setSelectedMedia((prev) => [...prev, processedMedia]);
          runAIAnalysis(processedMedia);
        }
      } catch (error: any) {
        console.error("Camera Error:", error);
      }
    }, 600);
  };

  const removeMedia = (indexToRemove: number) => {
    setSelectedMedia(
      selectedMedia.filter((_, index) => index !== indexToRemove),
    );
  };

  const runAIAnalysis = async (mediaAsset: ImagePicker.ImagePickerAsset) => {
    try {
      setIsAnalyzing(true);

      const formData = new FormData();
      const fileUri =
        Platform.OS === "ios"
          ? mediaAsset.uri.replace("file://", "")
          : mediaAsset.uri;
      const fileType = mediaAsset.type === "video" ? "video/mp4" : "image/jpeg";
      const fileName =
        mediaAsset.fileName ||
        `media_${Date.now()}.${mediaAsset.type === "video" ? "mp4" : "jpg"}`;

      formData.append("media", {
        uri: fileUri,
        name: fileName,
        type: fileType,
      } as any);

      const response = await api.post("/pm/items/analyze-media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      let rawData = response.data;

      if (rawData.ai_skipped) {
        return;
      }

      // --- 1. BULLETPROOF JSON EXTRACTION ---
      let payload = rawData;

      const stringToParse =
        typeof rawData === "string"
          ? rawData
          : rawData.text || rawData.content || rawData.result;

      if (typeof stringToParse === "string") {
        try {
          const jsonStart = stringToParse.indexOf("{");
          const jsonEnd = stringToParse.lastIndexOf("}");

          if (jsonStart === -1 || jsonEnd === -1) {
            throw new Error("No JSON brackets found in the response.");
          }

          const cleanText = stringToParse.substring(jsonStart, jsonEnd + 1);
          payload = JSON.parse(cleanText);
        } catch (e) {
          console.error(
            "🚨 CRITICAL: AI JSON Parse Failed. Raw String:",
            stringToParse,
          );
          Alert.alert(
            "AI Error",
            "The AI returned an invalid format. Please try again or fill manually.",
          );
          return;
        }
      }

      let targetData = payload;
      if (Array.isArray(payload)) {
        targetData = payload[0];
      }

      const aiData: any = {};
      for (const key in targetData) {
        const cleanKey = key.replace(/_/g, "").toLowerCase();
        aiData[cleanKey] = targetData[key];
      }

      const exactMatch = (val: string, options: string[]) =>
        options.find((o) => o.toLowerCase() === val.toLowerCase()) || val;

      const exactMatchArray = (arr: any, options: string[]) => {
        if (!Array.isArray(arr)) return [];
        return arr.map((a) => exactMatch(String(a), options));
      };

      if (aiData.area) setArea(exactMatch(String(aiData.area), AREA_OPTIONS));
      if (aiData.itemname) setItemName(String(aiData.itemname));
      if (aiData.itemtype)
        setItemType(exactMatchArray(aiData.itemtype, ITEM_TYPES));
      if (aiData.condition)
        setCondition(exactMatchArray(aiData.condition, CONDITIONS));
      if (aiData.status) setStatus(exactMatchArray(aiData.status, STATUSES));
      if (aiData.rawtranscript) setComment(String(aiData.rawtranscript));
    } catch (error: any) {
      console.error(
        "AI Analysis Request Failed:",
        error.response?.data || error.message,
      );
      Alert.alert(
        "Network Error",
        "Could not connect to AI service. Please fill out manually.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- SUBMIT LOGIC ---
  const handleSaveItem = async (isDone: boolean) => {
    if (
      !area ||
      itemType.length === 0 ||
      !itemName ||
      condition.length === 0 ||
      status.length === 0
    ) {
      Alert.alert(
        "Validation Error",
        "Please fill out all required item fields.",
      );
      return;
    }

    // Define the raw payload outside the try block so the catch block can use it if the network drops mid-upload
    let rawPayload: any;

    try {
      setIsSubmitting(true);

      // 1. Build the Raw Payload (Standard JS Object for AsyncStorage)
      rawPayload = {
        property_id: String(property_id),
        report_id: String(report_id),
        area: area,
        item_type: itemType,
        item_name: itemName,
        created_by: String(user?.id),
        comment: comment,
        condition: condition,
        status: status,
        images: selectedMedia.map((mediaItem, index) => ({
          uri:
            Platform.OS === "ios"
              ? mediaItem.uri.replace("file://", "")
              : mediaItem.uri,
          name:
            mediaItem.fileName ||
            `media_${Date.now()}_${index}.${mediaItem.type === "video" ? "mp4" : "jpg"}`,
          type: mediaItem.type === "video" ? "video/mp4" : "image/jpeg",
        })),
      };

      // 2. Check Internet Connection
      const networkState = await NetInfo.fetch();

      if (!networkState.isConnected) {
        // --- OFFLINE MODE: Save to Queue and Exit ---
        await SyncManager.addToQueue(
          "/pm/items/add-item",
          "POST",
          rawPayload,
          true,
        );

        Alert.alert(
          "Offline",
          "No internet connection. Item saved offline and will sync automatically when signal returns.",
        );

        if (isDone) {
          router.back();
        } else {
          setItemType([]);
          setItemName("");
          setCondition([]);
          setStatus([]);
          setComment("");
          setSelectedMedia([]);
        }
        return; // Stop execution here since we saved it offline
      }

      // --- ONLINE MODE: Proceed with Standard FormData Upload ---
      const formData = new FormData();

      formData.append("property_id", String(property_id));
      formData.append("report_id", String(report_id));
      formData.append("area", area);
      formData.append("item_type", JSON.stringify(itemType));
      formData.append("item_name", itemName);
      formData.append("created_by", String(user?.id));
      formData.append("comment", comment);

      formData.append("condition", JSON.stringify(condition));
      formData.append("status", JSON.stringify(status));

      selectedMedia.forEach((mediaItem, index) => {
        const fileUri =
          Platform.OS === "ios"
            ? mediaItem.uri.replace("file://", "")
            : mediaItem.uri;
        const fileType =
          mediaItem.type === "video" ? "video/mp4" : "image/jpeg";
        const fileName =
          mediaItem.fileName ||
          `media_${Date.now()}_${index}.${mediaItem.type === "video" ? "mp4" : "jpg"}`;

        formData.append("images", {
          uri: fileUri,
          name: fileName,
          type: fileType,
        } as any);
      });

      const response = await api.post("/pm/items/add-item", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.status === 201) {
        if (isDone) {
          Alert.alert("Success", "Item saved successfully.");
          router.back();
        } else {
          Alert.alert("Success", "Item added! Ready for the next one.");
          setItemType([]);
          setItemName("");
          setCondition([]);
          setStatus([]);
          setComment("");
          setSelectedMedia([]);
        }
      }
    } catch (error: any) {
      // --- FALLBACK: If the phone says it's online but the upload fails (e.g. very weak 3G) ---
      if (error.message === "Network Error" || error.response === undefined) {
        await SyncManager.addToQueue(
          "/pm/items/add-item",
          "POST",
          rawPayload,
          true,
        );

        Alert.alert(
          "Weak Signal",
          "Connection is too weak. Item saved offline and will sync when signal improves.",
        );

        if (isDone) {
          router.back();
        } else {
          setItemType([]);
          setItemName("");
          setCondition([]);
          setStatus([]);
          setComment("");
          setSelectedMedia([]);
        }
      } else {
        // Real API Error (e.g. 400 Bad Request, 500 Server Error)
        console.error("Failed to add item:", error);
        Alert.alert(
          "Error",
          error.response?.data?.Error || "Failed to add item.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons color="#333" name="chevron-back" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CREATE ITEM</Text>

        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => {
            router.push({
              pathname: "/property/view-all-reports",
              params: {
                property_id: property_id,
              },
            });
          }}
        >
          <Text style={styles.doneBtnText}>DONE</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.inputLabel}>Area Location</Text>
        <SingleSelectPicker
          onSelect={setArea}
          options={AREA_OPTIONS}
          placeholder="Select Area"
          value={area}
        />

        <Text style={styles.inputLabel}>Item Type</Text>
        <MultiSelectPicker
          onAdd={(val: string) => setItemType([...itemType, val])}
          options={ITEM_TYPES}
          selectedValues={itemType}
          onRemove={(val: string) =>
            setItemType(itemType.filter((t) => t !== val))
          }
          placeholder="Select Item Types"
        />

        <Text style={styles.inputLabel}>Item Name</Text>
        <View style={styles.inputBox}>
          <TextInput
            onChangeText={setItemName}
            placeholder="e.g. Electric Fan"
            placeholderTextColor="#999"
            style={styles.textInput}
            value={itemName}
          />
        </View>

        <Text style={styles.inputLabel}>Condition</Text>
        <MultiSelectPicker
          onAdd={(val: string) => setCondition([...condition, val])}
          options={CONDITIONS}
          selectedValues={condition}
          onRemove={(val: string) =>
            setCondition(condition.filter((c) => c !== val))
          }
          placeholder="Select Conditions"
        />

        <Text style={styles.inputLabel}>Status</Text>
        <MultiSelectPicker
          onAdd={(val: string) => setStatus([...status, val])}
          options={STATUSES}
          selectedValues={status}
          onRemove={(val: string) => setStatus(status.filter((s) => s !== val))}
          placeholder="Select Statuses"
        />

        <Text style={styles.inputLabel}>Comment</Text>
        <View style={[styles.inputBox, styles.commentBox]}>
          <TextInput
            multiline
            onChangeText={setComment}
            placeholder="Add comments here..."
            placeholderTextColor="#999"
            style={styles.commentInput}
            value={comment}
          />
        </View>

        <View style={styles.mediaContainer}>
          {selectedMedia.map((media, index) => (
            <View key={index} style={styles.mediaThumbnailWrapper}>
              <Image
                source={{ uri: media.uri }}
                style={styles.mediaThumbnail}
              />
              {media.type === "video" && (
                <View style={styles.videoOverlay}>
                  <Ionicons color="#FFF" name="play-circle" size={24} />
                </View>
              )}
              <TouchableOpacity
                onPress={() => removeMedia(index)}
                style={styles.removeMediaBtn}
              >
                <Ionicons color="#FF3B30" name="close-circle" size={24} />
              </TouchableOpacity>
            </View>
          ))}

          {selectedMedia.length < 5 && (
            <TouchableOpacity
              onPress={() => setMediaModalVisible(true)}
              style={styles.imagePlaceholder}
            >
              <Ionicons color="#999" name="camera-outline" size={32} />
              <Text style={{ color: "#999", fontSize: 12, marginTop: 5 }}>
                Add Media
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => handleSaveItem(false)}
          style={styles.addItemBtn}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.addItemBtnText}>ADD ITEM</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={mediaModalVisible}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setMediaModalVisible(false)}
          style={styles.modalOverlay}
        >
          <View style={styles.actionSheet}>
            <TouchableOpacity onPress={pickImage} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Upload Photo / Video</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={takePhoto} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Use Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMediaModalVisible(false)}
              style={[styles.actionButton, styles.cancelButton]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {isAnalyzing && (
        <View style={styles.analyzingOverlay}>
          <ActivityIndicator color="#8BC34A" size="large" />
          <Text style={styles.analyzingText}>
            AI is Analyzing your video...
          </Text>
          <Text style={styles.analyzingSubText}>Auto-filling form data</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  analyzingText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginTop: 15,
  },
  analyzingSubText: {
    fontSize: 14,
    color: "#666",
    marginTop: 5,
  },
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 15,
    marginBottom: 10,
  },
  headerTitle: { fontSize: 18, color: "#666", letterSpacing: 1 },
  backButton: { padding: 5 },
  doneBtn: {
    backgroundColor: "#8BC34A",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  doneBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 14 },
  scrollContent: { paddingHorizontal: 25, paddingBottom: 100 },
  inputLabel: { fontSize: 12, color: "#333", marginBottom: 6, marginLeft: 2 },
  inputBox: {
    backgroundColor: "#F5F5F5",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 45,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 6,
    marginBottom: 20,
  },
  inputText: { color: "#333", fontSize: 14, flex: 1 },
  textInput: { flex: 1, fontSize: 14, color: "#333", padding: 0 },
  placeholderText: { color: "#999", fontSize: 14 },
  chipContainer: { flexDirection: "row", flexWrap: "wrap", flex: 1, gap: 6 },
  chip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 15,
    paddingVertical: 4,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  chipText: { fontSize: 12, color: "#333", marginRight: 5 },
  chipRemove: { marginLeft: 2 },
  commentBox: { alignItems: "flex-end", paddingVertical: 15, minHeight: 100 },
  commentInput: {
    flex: 1,
    alignSelf: "flex-start",
    fontSize: 14,
    color: "#333",
    width: "100%",
    textAlignVertical: "top",
  },

  mediaContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  mediaThumbnailWrapper: { position: "relative" },
  mediaThumbnail: {
    height: 100,
    width: 100,
    borderRadius: 8,
    backgroundColor: "#EEE",
  },
  videoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 8,
  },
  removeMediaBtn: {
    position: "absolute",
    top: -10,
    right: -10,
    backgroundColor: "#FFF",
    borderRadius: 12,
  },
  imagePlaceholder: {
    backgroundColor: "#F5F5F5",
    height: 100,
    width: 100,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDD",
    borderStyle: "dashed",
  },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 25,
    paddingVertical: 20,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },
  addItemBtn: {
    backgroundColor: "#777777",
    paddingVertical: 15,
    borderRadius: 6,
    alignItems: "center",
  },
  addItemBtnText: { color: "#FFFFFF", fontWeight: "bold", letterSpacing: 0.5 },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    maxHeight: "50%",
    paddingVertical: 10,
  },
  modalItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  modalItemText: { fontSize: 16, color: "#333" },

  actionSheet: {
    backgroundColor: "#ECECEC",
    padding: 15,
    paddingBottom: 30,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  actionButton: {
    backgroundColor: "#FFF",
    paddingVertical: 18,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  actionButtonText: { fontSize: 16, color: "#333", fontWeight: "500" },
  cancelButton: { backgroundColor: "#FFF", marginTop: 5 },
  cancelButtonText: { fontSize: 16, color: "#FF3B30", fontWeight: "bold" },
});
