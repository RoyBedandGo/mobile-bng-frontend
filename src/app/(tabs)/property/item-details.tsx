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
import { api } from "../../../lib/api";
import { SyncManager } from "../../../lib/SyncManager"; // <-- NEW

// --- CONSTANTS ---
const AREA_OPTIONS = [
  "Kitchen Area",
  "Living Room",
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
export default function ItemDetailsScreen() {
  const {
    item_id,
    report_id,
    property_id,
    area_name,
    report_type,
    requires_contract,
    report_item_id,
  } = useLocalSearchParams();

  const isUnitReport =
    String(report_type).replace(" Report", "").trim() === "Unit";

  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States
  const [area, setArea] = useState<string>("");
  const [itemType, setItemType] = useState<string[]>([]);
  const [itemName, setItemName] = useState<string>("");
  const [condition, setCondition] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>([]);
  const [comment, setComment] = useState<string>("");
  const [images, setImages] = useState<string[]>([]);

  // Unit Report Specific States
  const [recommendation, setRecommendation] = useState<string>("");
  const [quotationPrice, setQuotationPrice] = useState<string>("");
  const [laborMaterials, setLaborMaterials] = useState<string>("");

  const parsedQuotation =
    parseFloat(quotationPrice.replace(/[^0-9.]/g, "")) || 0;
  const parsedLabor = parseFloat(laborMaterials.replace(/[^0-9.]/g, "")) || 0;
  const totalQuotation = parsedQuotation + parsedLabor;

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

  // --- 1. FETCH ITEM DETAILS ---
  useFocusEffect(
    useCallback(() => {
      const fetchItem = async () => {
        const cleanItemId = String(item_id).trim();
        try {
          setIsLoading(true);
          const response = await api.get(
            `/pm/items/details/${report_id}/${cleanItemId}`,
          );
          const data = response.data;

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

          setArea(data.area || "");
          setItemName(data.item_name || "");
          setComment(data.comment || "");
          setItemType(safeParse(data.item_type));
          setCondition(safeParse(data.condition));
          setStatus(safeParse(data.status));
          setImages(safeParse(data.images));

          setRecommendation(data.recommendation || "");
          setQuotationPrice(
            data.quotation_price ? String(data.quotation_price) : "",
          );
          setLaborMaterials(
            data.labor_material_cost ? String(data.labor_material_cost) : "",
          );
        } catch (error: any) {
          Alert.alert("Error", "Could not load item details.");
          router.back();
        } finally {
          setIsLoading(false);
        }
      };

      if (item_id && item_id !== "undefined") fetchItem();
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

  // --- 2. HANDLE MEDIA ---
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
              "You need to grant camera permissions to use this feature.",
            );
            return;
          }

          let result = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images", "videos"],
            allowsEditing: false,
            quality: 1, // Keep high so manipulator handles compression
          });

          if (!result.canceled) {
            const processedUri = await processMediaAsset(result.assets[0].uri);
            setImages((prev) => [...prev, processedUri]);
          }
        },
      },
      {
        text: "Choose from Gallery",
        onPress: async () => {
          let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images", "videos"],
            allowsEditing: false,
            quality: 1,
          });

          if (!result.canceled) {
            const processedUri = await processMediaAsset(result.assets[0].uri);
            setImages((prev) => [...prev, processedUri]);
          }
        },
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  const handleRemoveMedia = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // --- 3. HANDLE DELETE ---
  const handleDelete = () => {
    Alert.alert(
      "Delete Item",
      "Are you sure you want to permanently delete this item?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete offline support is optional, but for now we attempt online directly
              await api.delete(`/pm/items/delete/${report_item_id}`);
              Alert.alert("Success", "Item deleted.");
              router.push({
                pathname: "/property/area-items",
                params: {
                  property_id,
                  report_id,
                  area_name,
                  report_type,
                  requires_contract,
                },
              });
            } catch (error) {
              Alert.alert("Error", "Failed to delete item.");
            }
          },
        },
      ],
    );
  };

  // --- 4. HANDLE EDIT / UPDATE ---
  const handleEditToggle = async () => {
    if (!isEditing) {
      setIsEditing(true);
      return;
    }

    let rawPayload: any;

    try {
      setIsSubmitting(true);

      const existingImages = images.filter((img) => img.startsWith("http"));
      const newLocalImages = images.filter((img) => img.startsWith("file://"));

      // 1. Build Raw Payload for Offline Queue
      rawPayload = {
        area: area,
        item_name: itemName,
        item_type: itemType,
        condition: condition,
        status: status,
        comment: comment,
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

      if (isUnitReport) {
        rawPayload.recommendation = recommendation;
        rawPayload.quotation_price = parsedQuotation.toString();
        rawPayload.labor_materials = parsedLabor.toString();
      }

      // 2. Check Network Status
      const networkState = await NetInfo.fetch();

      if (!networkState.isConnected) {
        // --- OFFLINE MODE ---
        await SyncManager.addToQueue(
          `/pm/items/update/${report_item_id}`,
          "PUT",
          rawPayload,
          true,
        );
        Alert.alert(
          "Offline",
          "No internet connection. Update saved offline and will sync automatically.",
        );
        setIsEditing(false);
        return;
      }

      // --- ONLINE MODE ---
      const formData = new FormData();
      formData.append("area", area);
      formData.append("item_name", itemName);
      formData.append("item_type", JSON.stringify(itemType));
      formData.append("condition", JSON.stringify(condition));
      formData.append("status", JSON.stringify(status));
      formData.append("comment", comment);

      if (isUnitReport) {
        formData.append("recommendation", recommendation);
        formData.append("quotation_price", parsedQuotation.toString());
        formData.append("labor_materials", parsedLabor.toString());
      }

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

      await api.put(`/pm/items/update/${report_item_id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Alert.alert("Success", "Item updated successfully!");
      setIsEditing(false);
    } catch (error: any) {
      // --- FALLBACK QUEUE ON WEAK SIGNAL ---
      if (error.message === "Network Error" || error.response === undefined) {
        await SyncManager.addToQueue(
          `/pm/items/update/${report_item_id}`,
          "PUT",
          rawPayload,
          true,
        );
        Alert.alert(
          "Weak Signal",
          "Update saved offline. Will sync when connection improves.",
        );
        setIsEditing(false);
      } else {
        Alert.alert("Error", "Failed to update item.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading)
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#42A5F5" />
      </View>
    );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            router.push({
              pathname: "/property/view-report",
              params: {
                property_id,
                report_id,
                area_name,
                report_type,
                requires_contract,
              },
            });
          }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleContainer}>
          <Text style={styles.mainTitle}>{itemName.toUpperCase()}</Text>
          <View style={styles.topRightActions}>
            {isUnitReport && (
              <TouchableOpacity
                style={styles.recoveryBtn}
                onPress={() => {
                  router.push({
                    pathname: "/property/recovery-report",
                    params: {
                      item_id,
                      report_id,
                      property_id,
                      area_name,
                      report_type,
                      requires_contract,
                      report_item_id,
                    },
                  });
                }}
              >
                <Text style={styles.recoveryBtnText}>Recovery</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.deleteIconBtn}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={20} color="#FF5252" />
            </TouchableOpacity>
          </View>
        </View>

        <View
          pointerEvents={isEditing ? "auto" : "none"}
          style={{ opacity: isEditing ? 1 : 0.8 }}
        >
          <Text style={styles.inputLabel}>Area Location</Text>
          <SingleSelectPicker
            value={area}
            options={AREA_OPTIONS}
            onSelect={setArea}
            placeholder="Select Area"
          />

          <Text style={styles.inputLabel}>Item Type</Text>
          <MultiSelectPicker
            selectedValues={itemType}
            options={ITEM_TYPES}
            onAdd={(val: string) => setItemType([...itemType, val])}
            onRemove={(val: string) =>
              setItemType(itemType.filter((t) => t !== val))
            }
            placeholder="Select Item Types"
          />

          <Text style={styles.inputLabel}>Item Name</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              value={itemName}
              onChangeText={setItemName}
              placeholder="e.g. Electric Fan"
              placeholderTextColor="#999"
              editable={isEditing}
            />
          </View>

          <Text style={styles.inputLabel}>Condition</Text>
          <MultiSelectPicker
            selectedValues={condition}
            options={CONDITIONS}
            onAdd={(val: string) => setCondition([...condition, val])}
            onRemove={(val: string) =>
              setCondition(condition.filter((c) => c !== val))
            }
            placeholder="Select Conditions"
          />

          <Text style={styles.inputLabel}>Status</Text>
          <MultiSelectPicker
            selectedValues={status}
            options={STATUSES}
            onAdd={(val: string) => setStatus([...status, val])}
            onRemove={(val: string) =>
              setStatus(status.filter((s) => s !== val))
            }
            placeholder="Select Statuses"
          />

          <Text style={styles.inputLabel}>
            {isUnitReport ? "Comment and Findings" : "Comment"}
          </Text>
          <View style={[styles.inputBox, styles.commentBox]}>
            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder="No comment added."
              placeholderTextColor="#999"
              multiline
              editable={isEditing}
            />
          </View>

          {isUnitReport && (
            <>
              <Text style={styles.inputLabel}>Recommendation</Text>
              <View style={[styles.inputBox, styles.commentBox]}>
                <TextInput
                  style={styles.commentInput}
                  value={recommendation}
                  onChangeText={setRecommendation}
                  placeholder="No recommendation added."
                  placeholderTextColor="#999"
                  multiline
                  editable={isEditing}
                />
              </View>

              <Text style={styles.inputLabel}>Quotation Cost</Text>
              <View style={styles.quotationWrapper}>
                <View style={styles.quotationRow}>
                  <Text style={styles.quotationText}>Quotation Price: ₱</Text>
                  <TextInput
                    style={styles.quotationInput}
                    value={quotationPrice}
                    onChangeText={setQuotationPrice}
                    keyboardType="numeric"
                    editable={isEditing}
                    placeholder="0"
                  />
                </View>
                <View style={styles.quotationRow}>
                  <Text style={styles.quotationText}>Labor & Materials: ₱</Text>
                  <TextInput
                    style={styles.quotationInput}
                    value={laborMaterials}
                    onChangeText={setLaborMaterials}
                    keyboardType="numeric"
                    editable={isEditing}
                    placeholder="0"
                  />
                </View>
                <View style={styles.quotationRowTotal}>
                  <Text style={styles.quotationTextBold}>
                    Total: ₱{totalQuotation.toLocaleString()}
                  </Text>
                </View>
              </View>
            </>
          )}

          <Text style={styles.inputLabel}>Attached Media</Text>
          <View style={styles.mediaContainer}>
            {images.map((mediaUrl, index) => {
              const mediaType = isVideo(mediaUrl) ? "video" : "image";
              return (
                <View key={index} style={styles.videoThumbnailContainer}>
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

                  {isEditing && (
                    <TouchableOpacity
                      style={styles.removeMediaBadge}
                      onPress={() => handleRemoveMedia(index)}
                    >
                      <Ionicons name="close" size={16} color="#FFF" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {isEditing && (
              <TouchableOpacity
                style={styles.addMediaBtn}
                onPress={handlePickMedia}
              >
                <Ionicons name="add-circle-outline" size={32} color="#666" />
                <Text style={styles.addMediaText}>Add Media</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleEditToggle}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitBtnText}>
              {isEditing ? "UPDATE" : "EDIT"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ---> FULL SCREEN MEDIA MODAL <--- */}
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

// --- STYLES ---
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
  scrollContent: { paddingHorizontal: 25, paddingBottom: 100 },

  titleContainer: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
    minHeight: 40,
  },
  mainTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
    textAlign: "center",
    maxWidth: "60%",
  },
  topRightActions: {
    position: "absolute",
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recoveryBtn: {
    borderWidth: 1.5,
    borderColor: "#4CAF50",
    backgroundColor: "#FFF",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  recoveryBtnText: { color: "#4CAF50", fontSize: 12, fontWeight: "600" },
  deleteIconBtn: {
    borderWidth: 1.5,
    borderColor: "#FFCDD2",
    backgroundColor: "#FFF",
    padding: 6,
    borderRadius: 4,
  },

  inputLabel: { fontSize: 12, color: "#333", marginBottom: 6, marginLeft: 2 },
  inputBox: {
    backgroundColor: "#EEEEEE",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 45,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 6,
    marginBottom: 15,
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

  commentBox: { alignItems: "flex-end", paddingVertical: 15, minHeight: 80 },
  commentInput: {
    flex: 1,
    alignSelf: "flex-start",
    fontSize: 14,
    color: "#333",
    width: "100%",
    textAlignVertical: "top",
  },

  quotationWrapper: {
    backgroundColor: "#EEEEEE",
    borderRadius: 6,
    padding: 10,
    marginBottom: 15,
    gap: 6,
  },
  quotationRow: {
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  quotationRowTotal: {
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 4,
  },
  quotationText: { fontSize: 12, color: "#333" },
  quotationTextBold: { fontSize: 12, fontWeight: "bold", color: "#333" },
  quotationInput: {
    flex: 1,
    fontSize: 12,
    color: "#333",
    padding: 0,
    marginLeft: 2,
  },

  mediaContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
    marginBottom: 20,
  },
  mediaThumbnail: {
    height: 120,
    width: 120,
    borderRadius: 8,
    backgroundColor: "#EEE",
  },
  videoThumbnailContainer: { position: "relative", height: 120, width: 120 },
  playIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 8,
  },

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
    height: 120,
    width: 120,
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
  submitBtn: {
    backgroundColor: "#777777",
    paddingVertical: 15,
    borderRadius: 6,
    alignItems: "center",
  },
  submitBtnText: { color: "#FFFFFF", fontWeight: "bold", letterSpacing: 0.5 },

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
