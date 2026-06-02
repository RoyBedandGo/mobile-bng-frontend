import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import { useAuth } from "../../../hooks/useAuth";
import { api } from "../../../lib/api";
import { SyncManager } from "../../../lib/SyncManager";

// --- CONSTANTS ---
const ITEM_TYPES = [
  "Sanitary",
  "Electrical",
  "Appliance",
  "Fixture",
  "Furniture",
  "Area",
];

const MAX_MEDIA_FILES = 3;

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

const exactMatch = (val: string, options: string[]) =>
  options.find((o) => o.toLowerCase() === val.toLowerCase()) || val;

const exactMatchArray = (arr: any, options: string[]) => {
  if (!Array.isArray(arr)) return [];
  return arr.map((a) => exactMatch(String(a), options));
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
export default function CreateItemScreen() {
  const { property_id, report_id } = useLocalSearchParams();
  const { user } = useAuth();

  // --- FORM STATES ---
  const [areaOptions, setAreaOptions] = useState<string[]>([]);
  const [conditionOptions, setConditionOptions] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);

  const [area, setArea] = useState<string>("");
  const [itemType, setItemType] = useState<string[]>([]);
  const [itemName, setItemName] = useState<string>("");
  const [condition, setCondition] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>([]);
  const [comment, setComment] = useState<string>("");

  const [useAIHelper, setUseAIHelper] = useState(false);

  // MEDIA STATES
  const [selectedMedia, setSelectedMedia] = useState<
    ImagePicker.ImagePickerAsset[]
  >([]);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);

  // MULTI-CAMERA STATES
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [cameraCaptures, setCameraCaptures] = useState<
    ImagePicker.ImagePickerAsset[]
  >([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [isTakingPicture, setIsTakingPicture] = useState(false);
  const [cameraZoom, setCameraZoom] = useState<0 | 0.5>(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- FETCH DYNAMIC OPTIONS ---
  const fetchAreaLocations = async () => {
    try {
      const response = await api.get("/pm/item-settings/area-location");

      const areas = response.data
        .map((item: any) => item.area_name)
        .filter(Boolean);

      setAreaOptions(areas);

      if (!area && areas.length > 0) {
        setArea(areas[0]);
      }
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

  // --- MEDIA CONVERSION HELPER ---
  const processMediaAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    if (asset.type === "video") return asset;

    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );

      const newFileName = asset.fileName
        ? asset.fileName.replace(/\.[^/.]+$/, ".jpg")
        : `image_${Date.now()}.jpg`;

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
        const remainingSlots = MAX_MEDIA_FILES - selectedMedia.length;

        if (remainingSlots <= 0) {
          Alert.alert(
            "Limit Reached",
            "You can only upload up to 3 files per item.",
          );
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images", "videos"],
          allowsEditing: false,
          allowsMultipleSelection: true,
          selectionLimit: remainingSlots,
          quality: 1,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const selectedAssets = result.assets.slice(0, remainingSlots);

          const processedMediaList = await Promise.all(
            selectedAssets.map((asset) => processMediaAsset(asset)),
          );

          setSelectedMedia((prev) => [...prev, ...processedMediaList]);

          if (useAIHelper) {
            const firstVideo = processedMediaList.find(
              (media) => media.type === "video",
            );

            if (firstVideo) {
              runAIAnalysis(firstVideo);
            }
          }
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
        if (selectedMedia.length >= MAX_MEDIA_FILES) {
          Alert.alert(
            "Limit Reached",
            "You can only upload up to 3 files per item.",
          );
          return;
        }

        let permissionStatus = cameraPermission?.status;

        if (permissionStatus !== "granted") {
          const permissionResult = await requestCameraPermission();
          permissionStatus = permissionResult.status;
        }

        if (permissionStatus !== "granted") {
          Alert.alert(
            "Permission Denied",
            "Please go to your phone settings and enable Camera access.",
          );
          return;
        }

        setCameraCaptures([]);
        setCameraZoom(0);
        setCameraReady(false);
        setCameraModalVisible(true);
      } catch (error: any) {
        console.error("Camera Open Error:", error);
      }
    }, 300);
  };

  const capturePhotoInCamera = async () => {
    try {
      const remainingSlots = MAX_MEDIA_FILES - selectedMedia.length;

      if (cameraCaptures.length >= remainingSlots) {
        Alert.alert(
          "Limit Reached",
          `You can only take ${remainingSlots} more photo${
            remainingSlots > 1 ? "s" : ""
          }.`,
        );
        return;
      }

      if (!cameraRef.current || !cameraReady || isTakingPicture) return;

      setIsTakingPicture(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (!photo?.uri) return;

      const processedPhoto = await processMediaAsset({
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
        type: "image",
        fileName: `camera_${Date.now()}.jpg`,
        mimeType: "image/jpeg",
      } as ImagePicker.ImagePickerAsset);

      setCameraCaptures((prev) => [...prev, processedPhoto]);
    } catch (error: any) {
      console.error("Capture Photo Error:", error);
      Alert.alert("Camera Error", "Failed to capture photo.");
    } finally {
      setIsTakingPicture(false);
    }
  };

  const confirmCameraCaptures = () => {
    if (cameraCaptures.length === 0) {
      Alert.alert("No Photos", "Please take at least one photo.");
      return;
    }

    setSelectedMedia((prev) => [...prev, ...cameraCaptures]);
    setCameraCaptures([]);
    setCameraModalVisible(false);
  };

  const closeCameraModal = () => {
    setCameraCaptures([]);
    setCameraModalVisible(false);
  };

  const removeCameraCapture = (indexToRemove: number) => {
    setCameraCaptures((prev) =>
      prev.filter((_, index) => index !== indexToRemove),
    );
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
          console.error("AI JSON Parse Failed. Raw String:", stringToParse);
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

      if (aiData.area) setArea(exactMatch(String(aiData.area), areaOptions));
      if (aiData.itemname) setItemName(String(aiData.itemname));

      if (aiData.itemtype) {
        setItemType(exactMatchArray(aiData.itemtype, ITEM_TYPES));
      }

      if (aiData.condition) {
        setCondition(exactMatchArray(aiData.condition, conditionOptions));
      }

      if (aiData.status) {
        setStatus(exactMatchArray(aiData.status, statusOptions));
      }

      if (aiData.rawtranscript) {
        setComment(String(aiData.rawtranscript));
      }
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
    if (!area || itemType.length === 0 || !itemName) {
      Alert.alert(
        "Validation Error",
        "Please fill out Area Location, Item Type, and Item Name.",
      );
      return;
    }

    const conditionPayload = condition.length > 0 ? condition : [];
    const statusPayload = status.length > 0 ? status : [];

    let rawPayload: any;

    try {
      setIsSubmitting(true);

      rawPayload = {
        property_id: String(property_id),
        report_id: String(report_id),
        area,
        item_type: itemType,
        item_name: itemName,
        created_by: String(user?.id),
        comment,
        condition: conditionPayload,
        status: statusPayload,
        images: selectedMedia.map((mediaItem, index) => ({
          uri:
            Platform.OS === "ios"
              ? mediaItem.uri.replace("file://", "")
              : mediaItem.uri,
          name:
            mediaItem.fileName ||
            `media_${Date.now()}_${index}.${
              mediaItem.type === "video" ? "mp4" : "jpg"
            }`,
          type: mediaItem.type === "video" ? "video/mp4" : "image/jpeg",
        })),
      };

      const networkState = await NetInfo.fetch();

      if (!networkState.isConnected) {
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

        return;
      }

      const formData = new FormData();

      formData.append("property_id", String(property_id));
      formData.append("report_id", String(report_id));
      formData.append("area", area);
      formData.append("item_type", JSON.stringify(itemType));
      formData.append("item_name", itemName);
      formData.append("created_by", String(user?.id));
      formData.append("comment", comment);
      formData.append("condition", JSON.stringify(conditionPayload));
      formData.append("status", JSON.stringify(statusPayload));

      selectedMedia.forEach((mediaItem, index) => {
        const fileUri =
          Platform.OS === "ios"
            ? mediaItem.uri.replace("file://", "")
            : mediaItem.uri;

        const fileType =
          mediaItem.type === "video" ? "video/mp4" : "image/jpeg";

        const fileName =
          mediaItem.fileName ||
          `media_${Date.now()}_${index}.${
            mediaItem.type === "video" ? "mp4" : "jpg"
          }`;

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
          onPress={() =>
            router.push({
              pathname: "/property/view-all-reports",
              params: { property_id: property_id },
            })
          }
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
                property_id,
              },
            });
          }}
        >
          <Text style={styles.doneBtnText}>DONE</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.aiHelperRow}>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => setUseAIHelper(!useAIHelper)}
          >
            {useAIHelper && (
              <Ionicons name="checkmark" size={14} color="#333" />
            )}
          </TouchableOpacity>

          <Text style={styles.aiHelperText}>AI Helper</Text>
        </View>

        <Text style={styles.inputLabel}>Area Location</Text>
        <SingleSelectPicker
          onSelect={setArea}
          options={areaOptions}
          placeholder="Select Area"
          value={area}
          onAddOption={addAreaLocation}
          title="AREA LOCATION"
        />

        <Text style={styles.inputLabel}>Item Type</Text>
        <View style={styles.itemTypePickerSpacing}>
          <MultiSelectPicker
            onAdd={(val: string) => setItemType([...itemType, val])}
            options={ITEM_TYPES}
            selectedValues={itemType}
            onRemove={(val: string) =>
              setItemType(itemType.filter((t) => t !== val))
            }
            placeholder="Select Item Types"
          />
        </View>

        <Text style={styles.inputLabel}>Item Name</Text>
        <View style={styles.inputBox}>
          <SmartTextInput
            onChangeText={setItemName}
            suggestions={AUTO_COMPLETE_SUGGESTIONS}
            placeholder="e.g. Electric Fan"
            placeholderTextColor="#999"
            style={styles.textInput}
            value={itemName}
          />
        </View>

        <Text style={styles.inputLabel}>Condition</Text>
        <DynamicMultiSelectPicker
          onAdd={(val: string) => setCondition([...condition, val])}
          options={conditionOptions}
          selectedValues={condition}
          onRemove={(val: string) =>
            setCondition(condition.filter((c) => c !== val))
          }
          placeholder="Select Conditions"
          onAddOption={addItemCondition}
          title="CONDITION"
        />

        <Text style={styles.inputLabel}>Status</Text>
        <DynamicMultiSelectPicker
          onAdd={(val: string) => setStatus([...status, val])}
          options={statusOptions}
          selectedValues={status}
          onRemove={(val: string) => setStatus(status.filter((s) => s !== val))}
          placeholder="Select Statuses"
          onAddOption={addItemStatus}
          title="STATUS"
        />

        <Text style={styles.inputLabel}>Comment</Text>
        <View style={[styles.inputBox, styles.commentBox]}>
          <SmartTextInput
            multiline
            onChangeText={setComment}
            suggestions={AUTO_COMPLETE_SUGGESTIONS}
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

          {selectedMedia.length < MAX_MEDIA_FILES && (
            <TouchableOpacity
              onPress={() => setMediaModalVisible(true)}
              style={styles.imagePlaceholder}
            >
              <Ionicons color="#999" name="camera-outline" size={32} />
              <Text style={styles.addMediaText}>Add Media</Text>
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

      <Modal animationType="slide" transparent visible={mediaModalVisible}>
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

      <Modal animationType="slide" visible={cameraModalVisible}>
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.cameraPreview}
            facing="back"
            mode="picture"
            zoom={cameraZoom}
            onCameraReady={() => setCameraReady(true)}
          >
            <View style={styles.cameraTopBar}>
              <TouchableOpacity
                onPress={closeCameraModal}
                style={styles.cameraCloseButton}
              >
                <Ionicons name="close" size={28} color="#FFF" />
              </TouchableOpacity>

              <View style={styles.cameraCounterPill}>
                <Text style={styles.cameraCounterText}>
                  {cameraCaptures.length}/
                  {MAX_MEDIA_FILES - selectedMedia.length}
                </Text>
              </View>
            </View>

            <View style={styles.cameraBottomPanel}>
              <FlatList
                data={cameraCaptures}
                horizontal
                keyExtractor={(item, index) => `${item.uri}-${index}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cameraThumbnailList}
                renderItem={({ item, index }) => (
                  <View style={styles.cameraThumbnailWrapper}>
                    <Image
                      source={{ uri: item.uri }}
                      style={styles.cameraThumbnail}
                    />

                    <TouchableOpacity
                      onPress={() => removeCameraCapture(index)}
                      style={styles.cameraThumbnailRemove}
                    >
                      <Ionicons name="close-circle" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={styles.cameraHintText}>
                    Take up to {MAX_MEDIA_FILES - selectedMedia.length} photos
                  </Text>
                }
              />

              <View style={styles.cameraZoomControls}>
                <TouchableOpacity
                  onPress={() => setCameraZoom(0)}
                  style={[
                    styles.cameraZoomButton,
                    cameraZoom === 0 && styles.cameraZoomButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.cameraZoomText,
                      cameraZoom === 0 && styles.cameraZoomTextActive,
                    ]}
                  >
                    0.5x
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setCameraZoom(0.5)}
                  style={[
                    styles.cameraZoomButton,
                    cameraZoom === 0.5 && styles.cameraZoomButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.cameraZoomText,
                      cameraZoom === 0.5 && styles.cameraZoomTextActive,
                    ]}
                  >
                    1x
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.cameraControls}>
                <TouchableOpacity
                  onPress={confirmCameraCaptures}
                  style={[
                    styles.cameraDoneButton,
                    cameraCaptures.length === 0 && styles.cameraDisabledButton,
                  ]}
                  disabled={cameraCaptures.length === 0}
                >
                  <Text style={styles.cameraDoneText}>OK</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={capturePhotoInCamera}
                  style={[
                    styles.cameraShutterButton,
                    (!cameraReady ||
                      isTakingPicture ||
                      cameraCaptures.length >=
                        MAX_MEDIA_FILES - selectedMedia.length) &&
                      styles.cameraDisabledButton,
                  ]}
                  disabled={
                    !cameraReady ||
                    isTakingPicture ||
                    cameraCaptures.length >=
                      MAX_MEDIA_FILES - selectedMedia.length
                  }
                >
                  {isTakingPicture ? (
                    <ActivityIndicator color="#333" />
                  ) : (
                    <View style={styles.cameraShutterInner} />
                  )}
                </TouchableOpacity>

                <View style={styles.cameraControlSpacer} />
              </View>
            </View>
          </CameraView>
        </View>
      </Modal>

      {isAnalyzing && (
        <View style={styles.analyzingOverlay}>
          <ActivityIndicator color="#8BC34A" size="large" />
          <Text style={styles.analyzingText}>
            AI is analyzing your video...
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

  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 15,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 18,
    color: "#666",
    letterSpacing: 1,
  },
  backButton: {
    padding: 5,
  },
  doneBtn: {
    backgroundColor: "#8BC34A",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  doneBtnText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 14,
  },

  scrollContent: {
    paddingHorizontal: 25,
    paddingBottom: 100,
  },

  aiHelperRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: "#777",
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  aiHelperText: {
    fontSize: 12,
    color: "#333",
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

  inputLabel: {
    fontSize: 12,
    color: "#333",
    marginBottom: 6,
    marginLeft: 2,
  },
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
  inputText: {
    color: "#333",
    fontSize: 14,
    flex: 1,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    padding: 0,
  },
  placeholderText: {
    color: "#999",
    fontSize: 14,
  },

  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    flex: 1,
    gap: 6,
  },
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
  chipText: {
    fontSize: 12,
    color: "#333",
    marginRight: 5,
  },
  chipRemove: {
    marginLeft: 2,
  },

  commentBox: {
    alignItems: "flex-end",
    paddingVertical: 15,
    minHeight: 100,
  },
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
  mediaThumbnailWrapper: {
    position: "relative",
  },
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
  addMediaText: {
    color: "#999",
    fontSize: 12,
    marginTop: 5,
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
  addItemBtnText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    letterSpacing: 0.5,
  },

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
  modalItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  modalItemText: {
    fontSize: 16,
    color: "#333",
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

  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  cameraPreview: {
    flex: 1,
  },
  cameraTopBar: {
    position: "absolute",
    top: 45,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  cameraCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraCounterPill: {
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  cameraCounterText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  cameraBottomPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingTop: 12,
    paddingBottom: 35,
  },
  cameraThumbnailList: {
    minHeight: 72,
    paddingHorizontal: 15,
    alignItems: "center",
  },
  cameraThumbnailWrapper: {
    marginRight: 10,
    position: "relative",
  },
  cameraThumbnail: {
    width: 62,
    height: 62,
    borderRadius: 8,
    backgroundColor: "#222",
  },
  cameraThumbnailRemove: {
    position: "absolute",
    top: -7,
    right: -7,
    backgroundColor: "#FFF",
    borderRadius: 10,
  },
  cameraHintText: {
    color: "#FFF",
    fontSize: 13,
    opacity: 0.8,
    paddingVertical: 20,
  },
  cameraZoomControls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  cameraZoomButton: {
    minWidth: 58,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraZoomButtonActive: {
    backgroundColor: "#FFF",
  },
  cameraZoomText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  cameraZoomTextActive: {
    color: "#000",
  },
  cameraControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 35,
    marginTop: 12,
  },
  cameraDoneButton: {
    width: 58,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#8BC34A",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraDoneText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  cameraShutterButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#DDD",
  },
  cameraShutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFF",
    borderWidth: 2,
    borderColor: "#333",
  },
  cameraDisabledButton: {
    opacity: 0.5,
  },
  cameraControlSpacer: {
    width: 58,
  },

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
  actionButtonText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  cancelButton: {
    backgroundColor: "#FFF",
    marginTop: 5,
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#FF3B30",
    fontWeight: "bold",
  },
});
