import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo"; // <-- NEW
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator"; // <-- NEW
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { api } from "../../../lib/api";
import { SyncManager } from "../../../lib/SyncManager"; // <-- NEW

// --- CONSTANTS ---
const ITEM_TYPES = [
  "Sanitary",
  "Electrical",
  "Appliance",
  "Fixture",
  "Furniture",
  "Area",
];

const AUTO_COMPLETE_SUGGESTIONS = [
  // Appliances
  "Refrigerator",
  "Gas/Electric Stove",
  "Gas Stove",
  "Electric Stove",
  "Oven",
  "Washing Machine",
  "Air Conditioner",
  "Air Conditioner Remote",
  "Microwave",
  "Microwave Oven",
  "Electric Kettle",
  "Television",
  "Television Remote",
  "TV Remote",
  "Range Hood",
  "Range hood",
  "Shower Heater",
  "Water Heater",
  "Induction Cooker",
  "Induction cooker",
  "Rice cooker",
  "Electric Fan",

  // Furniture
  "Sofa",
  "Dining Table",
  "Chair",
  "Chairs",
  "Bed Frame",
  "Beds (including mattress)",
  "Mattress",
  "Wardrobe",
  "Wardrobe/Closet",
  "Cabinet",
  "Built in Cabinet",
  "TV Stand",
  "Coffee Table",
  "Ottoman",
  "Study Desk",
  "Study Table",
  "Side table",
  "Hanging Shelves",

  // Fixtures
  "Curtain",
  "Curtain Rods / Blinds",
  "Ceiling Lights",
  "Light Bulb",
  "Wall Sockets",
  "Light Switch",
  "Light Switches",
  "Outlet",
  "Outlets",
  "Faucet",
  "Faucets",
  "Shower Head",
  "Toilet Bowl",
  "Toilet Cover",
  "Lavatory",
  "Kitchen Sink",
  "Door Lock",
  "Doorbell",
  "Window",
  "Mirror",
  "Bathroom Mirror",
  "Bidet",
  "Intercom",
  "Exhaust Fan",
  "Plants",
];

const getSuggestionMatch = (value: string, suggestions: string[]) => {
  const cleanValue = value.trim().toLowerCase();

  if (cleanValue.length < 2) return "";

  const normalizedValue = cleanValue.replace(/\s+/g, "");

  return (
    suggestions.find((suggestion) => {
      const cleanSuggestion = suggestion.trim().toLowerCase();
      const normalizedSuggestion = cleanSuggestion.replace(/\s+/g, "");

      return (
        cleanSuggestion.startsWith(cleanValue) ||
        normalizedSuggestion.startsWith(normalizedValue) ||
        cleanSuggestion.split(/\s+/).some((word) => word.startsWith(cleanValue))
      );
    }) || ""
  );
};

type SmartTextInputProps = TextInputProps & {
  value: string;
  onChangeText: (text: string) => void;
  suggestions?: string[];
};

const SmartTextInput = ({
  value,
  onChangeText,
  suggestions = AUTO_COMPLETE_SUGGESTIONS,
  style,
  ...props
}: SmartTextInputProps) => {
  const cleanSuggestions = Array.from(
    new Set(
      suggestions
        .filter(Boolean)
        .map((suggestion) => String(suggestion).trim())
        .filter(Boolean),
    ),
  );

  const suggestion = getSuggestionMatch(value, cleanSuggestions);

  return (
    <View style={styles.smartInputWrapper}>
      <TextInput
        {...props}
        value={value}
        onChangeText={onChangeText}
        style={style}
        autoCorrect
        spellCheck
        autoCapitalize={props.autoCapitalize || "sentences"}
      />

      {suggestion && suggestion.toLowerCase() !== value.trim().toLowerCase() ? (
        <TouchableOpacity
          style={styles.suggestionButton}
          activeOpacity={0.85}
          onPress={() => onChangeText(suggestion)}
        >
          <Ionicons name="sparkles-outline" size={14} color="#5B7F1F" />
          <Text style={styles.suggestionText}>Suggestion: {suggestion}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

// --- HELPERS ---
const normalizeText = (text: string) => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(
      (word) =>
        word &&
        ![
          "area",
          "room",
          "space",
          "section",
          "the",
          "a",
          "an",
          "for",
          "to",
          "of",
        ].includes(word),
    )
    .join(" ")
    .trim();
};

const findSimilarOption = (input: string, options: string[]) => {
  const normalizedInput = normalizeText(input);

  if (!normalizedInput) return null;

  return options.find((existing) => {
    const normalizedExisting = normalizeText(existing);

    return (
      normalizedExisting === normalizedInput ||
      normalizedExisting.includes(normalizedInput) ||
      normalizedInput.includes(normalizedExisting)
    );
  });
};

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
  const insets = useSafeAreaInsets();

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

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalKeyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[
                styles.modalContent,
                { paddingBottom: Math.max(insets.bottom, 24) + 16 },
              ]}
              onPress={() => {}}
            >
              {availableOptions.length === 0 ? (
                <Text style={styles.emptyText}>All options selected</Text>
              ) : (
                <FlatList
                  data={availableOptions}
                  keyExtractor={(item) => item}
                  style={styles.optionList}
                  contentContainerStyle={styles.optionListContent}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
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
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const SingleSelectPicker = ({
  value,
  options,
  onSelect,
  placeholder,
  onAddOption,
  title,
}: any) => {
  const insets = useSafeAreaInsets();

  const [modalVisible, setModalVisible] = useState(false);
  const [newOption, setNewOption] = useState("");
  const [warning, setWarning] = useState("");

  const handleAdd = async () => {
    const cleanValue = newOption.trim();

    if (!cleanValue) {
      setWarning("Please enter a value.");
      return;
    }

    const similarOption = findSimilarOption(cleanValue, options);

    if (similarOption) {
      setWarning(`Warning: possible duplicate: "${similarOption}"`);
      return;
    }

    setWarning("");

    await onAddOption(cleanValue);

    setNewOption("");
    setModalVisible(false);
  };

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

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalKeyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[
                styles.dynamicModalContent,
                { paddingBottom: Math.max(insets.bottom, 24) + 16 },
              ]}
              onPress={() => {}}
            >
              <Text style={styles.dynamicModalTitle}>{title}</Text>

              <FlatList
                data={options}
                keyExtractor={(item, index) => `${item}-${index}`}
                style={styles.dynamicOptionList}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
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
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No options yet.</Text>
                }
              />

              <View style={styles.addOptionRow}>
                <SmartTextInput
                  value={newOption}
                  onChangeText={(text) => {
                    setNewOption(text);
                    setWarning("");
                  }}
                  suggestions={options}
                  placeholder="Add new option"
                  placeholderTextColor="#999"
                  style={styles.addOptionInput}
                  returnKeyType="done"
                />

                <TouchableOpacity
                  style={styles.addOptionButton}
                  onPress={handleAdd}
                >
                  <Ionicons name="add" size={28} color="#FFF" />
                </TouchableOpacity>
              </View>

              {warning ? (
                <Text style={styles.warningText}>{warning}</Text>
              ) : null}
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const DynamicMultiSelectPicker = ({
  selectedValues,
  options,
  onAdd,
  onRemove,
  placeholder,
  onAddOption,
  title,
}: any) => {
  const insets = useSafeAreaInsets();

  const [modalVisible, setModalVisible] = useState(false);
  const [newOption, setNewOption] = useState("");
  const [warning, setWarning] = useState("");

  const availableOptions = options.filter(
    (opt: string) => !selectedValues.includes(opt),
  );

  const handleAdd = async () => {
    const cleanValue = newOption.trim();

    if (!cleanValue) {
      setWarning("Please enter a value.");
      return;
    }

    const similarOption = findSimilarOption(cleanValue, options);

    if (similarOption) {
      setWarning(`Warning: possible duplicate: "${similarOption}"`);
      return;
    }

    setWarning("");

    await onAddOption(cleanValue);

    setNewOption("");
    setModalVisible(false);
  };

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

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalKeyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[
                styles.dynamicModalContent,
                { paddingBottom: Math.max(insets.bottom, 24) + 16 },
              ]}
              onPress={() => {}}
            >
              <Text style={styles.dynamicModalTitle}>{title}</Text>

              <FlatList
                data={availableOptions}
                keyExtractor={(item, index) => `${item}-${index}`}
                style={styles.dynamicOptionList}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
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
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No options available.</Text>
                }
              />

              <View style={styles.addOptionRow}>
                <SmartTextInput
                  value={newOption}
                  onChangeText={(text) => {
                    setNewOption(text);
                    setWarning("");
                  }}
                  suggestions={options}
                  placeholder="Add new option"
                  placeholderTextColor="#999"
                  style={styles.addOptionInput}
                  returnKeyType="done"
                />

                <TouchableOpacity
                  style={styles.addOptionButton}
                  onPress={handleAdd}
                >
                  <Ionicons name="add" size={28} color="#FFF" />
                </TouchableOpacity>
              </View>

              {warning ? (
                <Text style={styles.warningText}>{warning}</Text>
              ) : null}
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

// --- MAIN SCREEN ---
export default function ItemDetailsScreen() {
  const handleSetMediaAsFirst = (index: number) => {
    setImages((prevImages) => {
      if (index <= 0 || index >= prevImages.length) return prevImages;

      const updatedImages = [...prevImages];
      const selectedMedia = updatedImages.splice(index, 1)[0];

      return [selectedMedia, ...updatedImages];
    });
  };
  const {
    item_id,
    report_id,
    property_id,
    area_name,
    report_type,
    requires_contract,
    report_item_id,
  } = useLocalSearchParams();

  console.log("Received Params:", {
    item_id,
    report_id,
    property_id,
    area_name,
    report_type,
    requires_contract,
    report_item_id,
  });

  const isUnitReport =
    String(report_type).replace(" Report", "").trim() === "Unit";

  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Dynamic Option States
  const [areaOptions, setAreaOptions] = useState<string[]>([]);
  const [conditionOptions, setConditionOptions] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);

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

  const getMediaExtension = (url: string, mediaType: "image" | "video") => {
    const cleanUrl = url.split("?")[0].split("#")[0];
    const extension = cleanUrl.split(".").pop()?.toLowerCase();

    if (extension && extension.length <= 5) return extension;

    return mediaType === "video" ? "mp4" : "jpg";
  };

  const getDownloadFileName = (mediaType: "image" | "video") => {
    const timestamp = new Date().getTime();
    const extension = selectedMedia
      ? getMediaExtension(selectedMedia.url, mediaType)
      : mediaType === "video"
        ? "mp4"
        : "jpg";

    return `bedandgo_item_${timestamp}.${extension}`;
  };

  const handleDownloadMedia = async (
    mediaUrl: string,
    mediaType: "image" | "video",
  ) => {
    try {
      setIsDownloading(true);

      const permission = await MediaLibrary.requestPermissionsAsync(false, [
        "photo",
        "video",
      ]);
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow photo library access so the file can be saved to your phone.",
        );
        return;
      }

      let localUri = mediaUrl;

      if (mediaUrl.startsWith("http")) {
        const fileName = getDownloadFileName(mediaType);
        const downloadPath = `${FileSystem.cacheDirectory}${fileName}`;

        const downloadedFile = await FileSystem.downloadAsync(
          mediaUrl,
          downloadPath,
        );

        localUri = downloadedFile.uri;
      }

      await MediaLibrary.saveToLibraryAsync(localUri);

      Alert.alert(
        "Download Complete",
        mediaType === "video"
          ? "Video saved to your phone gallery."
          : "Image saved to your phone gallery.",
      );
    } catch (error: any) {
      console.error("Failed to download media:", error);
      Alert.alert(
        "Download Failed",
        "Unable to save this file to your phone. Please try again.",
      );
    } finally {
      setIsDownloading(false);
    }
  };

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

  // --- FETCH DYNAMIC OPTIONS ---
  const fetchAreaLocations = async () => {
    try {
      const response = await api.get("/pm/item-settings/area-location");

      const areas = response.data
        .map((item: any) => item.area_name)
        .filter(Boolean);

      setAreaOptions(areas);
    } catch (error: any) {
      console.error("Failed to fetch area locations:", error);
      Alert.alert("Error", "Failed to load area locations.");
    }
  };

  const fetchItemConditions = async () => {
    try {
      const response = await api.get("/pm/item-settings/item-condition");

      const conditions = response.data
        .map((item: any) => item.condition_name)
        .filter(Boolean);

      setConditionOptions(conditions);
    } catch (error: any) {
      console.error("Failed to fetch item conditions:", error);
      Alert.alert("Error", "Failed to load item conditions.");
    }
  };

  const fetchItemStatus = async () => {
    try {
      const response = await api.get("/pm/item-settings/item-status");

      const statuses = response.data
        .map((item: any) => item.status_name)
        .filter(Boolean);

      setStatusOptions(statuses);
    } catch (error: any) {
      console.error("Failed to fetch item status:", error);
      Alert.alert("Error", "Failed to load item status.");
    }
  };

  const fetchAllDynamicOptions = async () => {
    await Promise.all([
      fetchAreaLocations(),
      fetchItemConditions(),
      fetchItemStatus(),
    ]);
  };

  useEffect(() => {
    fetchAllDynamicOptions();
  }, []);

  // Keep old existing values visible even if they are not yet saved in master tables.
  useEffect(() => {
    if (area) {
      setAreaOptions((prev) => (prev.includes(area) ? prev : [...prev, area]));
    }

    condition.forEach((item) => {
      setConditionOptions((prev) =>
        prev.includes(item) ? prev : [...prev, item],
      );
    });

    status.forEach((item) => {
      setStatusOptions((prev) =>
        prev.includes(item) ? prev : [...prev, item],
      );
    });
  }, [area, condition, status]);

  // --- ADD DYNAMIC OPTIONS ---
  const addAreaLocation = async (areaName: string) => {
    try {
      const similarOption = findSimilarOption(areaName, areaOptions);

      if (similarOption) {
        Alert.alert(
          "Duplicate Warning",
          `This may already exist as "${similarOption}".`,
        );
        return;
      }

      const response = await api.post("/pm/item-settings/area-location/add", {
        area_name: areaName,
      });

      if (response.status === 201) {
        const updatedAreas = [...areaOptions, areaName];

        setAreaOptions(updatedAreas);
        setArea(areaName);

        Alert.alert("Success", "Area location added successfully.");
      }
    } catch (error: any) {
      console.error("Failed to add area location:", error);
      Alert.alert(
        "Error",
        error.response?.data?.Error || "Failed to add area location.",
      );
    }
  };

  const addItemCondition = async (conditionName: string) => {
    try {
      const similarOption = findSimilarOption(conditionName, conditionOptions);

      if (similarOption) {
        Alert.alert(
          "Duplicate Warning",
          `This may already exist as "${similarOption}".`,
        );
        return;
      }

      const response = await api.post("/pm/item-settings/item-condition/add", {
        condition_name: conditionName,
      });

      if (response.status === 201) {
        const updatedConditions = [...conditionOptions, conditionName];

        setConditionOptions(updatedConditions);
        setCondition((prev) =>
          prev.includes(conditionName) ? prev : [...prev, conditionName],
        );

        Alert.alert("Success", "Item condition added successfully.");
      }
    } catch (error: any) {
      console.error("Failed to add item condition:", error);
      Alert.alert(
        "Error",
        error.response?.data?.Error || "Failed to add item condition.",
      );
    }
  };

  const addItemStatus = async (statusName: string) => {
    try {
      const similarOption = findSimilarOption(statusName, statusOptions);

      if (similarOption) {
        Alert.alert(
          "Duplicate Warning",
          `This may already exist as "${similarOption}".`,
        );
        return;
      }

      const response = await api.post("/pm/item-settings/item-status/add", {
        status_name: statusName,
      });

      if (response.status === 201) {
        const updatedStatuses = [...statusOptions, statusName];

        setStatusOptions(updatedStatuses);
        setStatus((prev) =>
          prev.includes(statusName) ? prev : [...prev, statusName],
        );

        Alert.alert("Success", "Item status added successfully.");
      }
    } catch (error: any) {
      console.error("Failed to add item status:", error);
      Alert.alert(
        "Error",
        error.response?.data?.Error || "Failed to add item status.",
      );
    }
  };

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

      const imageOrder = images.map((img) => {
        if (img.startsWith("http")) {
          return {
            type: "existing",
            url: img,
          };
        }

        return {
          type: "new",
          localIndex: newLocalImages.indexOf(img),
        };
      });

      const conditionPayload = Array.isArray(condition) ? condition : [];
      const statusPayload = Array.isArray(status) ? status : [];

      // 1. Build Raw Payload for Offline Queue
      rawPayload = {
        area: area,
        item_name: itemName,
        item_type: itemType,
        condition: conditionPayload,
        status: statusPayload,
        comment: comment,
        existing_images: existingImages,
        image_order: imageOrder,
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
      formData.append("condition", JSON.stringify(conditionPayload));
      formData.append("status", JSON.stringify(statusPayload));
      formData.append("comment", comment);

      if (isUnitReport) {
        formData.append("recommendation", recommendation);
        formData.append("quotation_price", parsedQuotation.toString());
        formData.append("labor_materials", parsedLabor.toString());
      }

      formData.append("existing_images", JSON.stringify(existingImages));
      formData.append("image_order", JSON.stringify(imageOrder));

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
            options={areaOptions}
            onSelect={setArea}
            placeholder="Select Area"
            onAddOption={addAreaLocation}
            title="AREA LOCATION"
          />

          <Text style={styles.inputLabel}>Item Type</Text>
          <View style={styles.itemTypePickerSpacing}>
            <MultiSelectPicker
              selectedValues={itemType}
              options={ITEM_TYPES}
              onAdd={(val: string) => setItemType([...itemType, val])}
              onRemove={(val: string) =>
                setItemType(itemType.filter((t) => t !== val))
              }
              placeholder="Select Item Types"
            />
          </View>

          <Text style={styles.inputLabel}>Item Name</Text>
          <View style={styles.inputBox}>
            <SmartTextInput
              style={styles.textInput}
              value={itemName}
              onChangeText={setItemName}
              suggestions={AUTO_COMPLETE_SUGGESTIONS}
              placeholder="e.g. Electric Fan"
              placeholderTextColor="#999"
              editable={isEditing}
            />
          </View>

          <Text style={styles.inputLabel}>Condition</Text>
          <DynamicMultiSelectPicker
            selectedValues={condition}
            options={conditionOptions}
            onAdd={(val: string) => setCondition([...condition, val])}
            onRemove={(val: string) =>
              setCondition(condition.filter((c) => c !== val))
            }
            placeholder="Select Conditions"
            onAddOption={addItemCondition}
            title="CONDITION"
          />

          <Text style={styles.inputLabel}>Status</Text>
          <DynamicMultiSelectPicker
            selectedValues={status}
            options={statusOptions}
            onAdd={(val: string) => setStatus([...status, val])}
            onRemove={(val: string) =>
              setStatus(status.filter((s) => s !== val))
            }
            placeholder="Select Statuses"
            onAddOption={addItemStatus}
            title="STATUS"
          />

          <Text style={styles.inputLabel}>
            {isUnitReport ? "Comment and Findings" : "Comment"}
          </Text>
          <View style={[styles.inputBox, styles.commentBox]}>
            <SmartTextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
              suggestions={AUTO_COMPLETE_SUGGESTIONS}
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
                <View
                  key={`${mediaUrl}-${index}`}
                  style={styles.videoThumbnailContainer}
                >
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

                  {index === 0 && (
                    <View style={styles.firstMediaBadge}>
                      <Ionicons name="star" size={12} color="#FFF" />
                      <Text style={styles.firstMediaBadgeText}>First</Text>
                    </View>
                  )}

                  {isEditing && index !== 0 && (
                    <TouchableOpacity
                      style={styles.setFirstMediaBtn}
                      onPress={() => handleSetMediaAsFirst(index)}
                    >
                      <Ionicons
                        name="arrow-up-circle-outline"
                        size={14}
                        color="#FFF"
                      />
                      <Text style={styles.setFirstMediaText}>Set First</Text>
                    </TouchableOpacity>
                  )}

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

          <TouchableOpacity
            style={styles.downloadModalBtn}
            disabled={isDownloading}
            onPress={() => {
              if (selectedMedia) {
                handleDownloadMedia(selectedMedia.url, selectedMedia.type);
              }
            }}
          >
            {isDownloading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Ionicons name="download-outline" size={30} color="#FFFFFF" />
            )}
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

  firstMediaBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(91, 127, 31, 0.95)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    zIndex: 3,
  },

  firstMediaBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
  },

  setFirstMediaBtn: {
    position: "absolute",
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    borderRadius: 6,
    paddingVertical: 5,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    zIndex: 3,
  },

  setFirstMediaText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
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

  smartInputWrapper: {
    flex: 1,
  },
  suggestionButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F8E9",
    borderWidth: 1,
    borderColor: "#C5E1A5",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
  },
  suggestionText: {
    color: "#5B7F1F",
    fontSize: 12,
    marginLeft: 4,
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
  itemTypePickerSpacing: {
    marginBottom: 14,
  },

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

  modalKeyboardView: {
    flex: 1,
  },
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
  optionList: {
    maxHeight: 360,
    flexShrink: 1,
  },
  optionListContent: {
    paddingBottom: 8,
  },
  emptyText: {
    textAlign: "center",
    padding: 20,
    color: "#999",
  },
  dynamicModalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "75%",
  },
  dynamicModalTitle: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  dynamicOptionList: {
    maxHeight: 300,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 6,
    marginBottom: 8,
  },
  addOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addOptionInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#999",
    borderRadius: 4,
    height: 42,
    paddingHorizontal: 10,
    fontSize: 14,
    color: "#333",
  },
  addOptionButton: {
    width: 42,
    height: 42,
    borderRadius: 5,
    backgroundColor: "#8BC34A",
    justifyContent: "center",
    alignItems: "center",
  },
  warningText: {
    backgroundColor: "#F5F53D",
    color: "#333",
    fontSize: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 8,
    borderRadius: 3,
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
  downloadModalBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 24,
    left: 20,
    zIndex: 10,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenMedia: { width: "100%", height: "100%" },
});
