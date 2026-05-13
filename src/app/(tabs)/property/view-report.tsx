import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../lib/api";

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

// --- CONSTANTS ---
const AREAS = [
  "All",
  "Living Room",
  "Bathroom",
  "Master Bedroom",
  "Bedroom",
  "Kitchen Area",
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
const MultiSelectDropdown = ({
  label,
  options,
  selectedValues,
  toggleValue,
}: {
  label: string;
  options: string[];
  selectedValues: string[];
  toggleValue: (val: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdownBox}
        activeOpacity={0.8}
        onPress={() => setIsOpen(true)}
      >
        <View style={styles.pillsContainer}>
          {selectedValues.length === 0 && (
            <Text style={styles.placeholderText}>Select {label}...</Text>
          )}
          {selectedValues.map((val) => (
            <TouchableOpacity
              key={val}
              style={styles.pill}
              onPress={() => toggleValue(val)}
            >
              <Text style={styles.pillText}>{val}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Ionicons
          name="caret-down"
          size={16}
          color="#666"
          style={{ padding: 5 }}
        />
      </TouchableOpacity>

      <Modal visible={isOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.optionsModalContent}>
            <Text style={styles.modalHeader}>Select {label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isSelected = selectedValues.includes(item);
                return (
                  <TouchableOpacity
                    style={styles.optionItem}
                    onPress={() => {
                      toggleValue(item);
                      setIsOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color="#003366" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default function ViewReportScreen() {
  const { property_id, report_type, requires_contract } =
    useLocalSearchParams();

  const isContractRequired = requires_contract === "true";
  const title = report_type ? String(report_type).toUpperCase() : "REPORT";
  const isUnitReport =
    String(report_type).replace(" Report", "").trim() === "Unit";

  // --- REPORT STATES ---
  const [reportId, setReportId] = useState<string | null>(null);
  const [isLoadingId, setIsLoadingId] = useState(true);

  // --- CONTRACT STATES ---
  const [contracts, setContracts] = useState<any[]>([]);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [showContractModal, setShowContractModal] = useState(false);

  // --- ITEMS & FILTER STATES ---
  const [items, setItems] = useState<any[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [selectedArea, setSelectedArea] = useState("All");
  const [showAreaModal, setShowAreaModal] = useState(false);

  // FILTER STATES
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [showPicker, setShowPicker] = useState<"from" | "to" | null>(null);

  const [filterDateFrom, setFilterDateFrom] = useState<Date | null>(null);
  const [filterDateTo, setFilterDateTo] = useState<Date | null>(null);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterConditions, setFilterConditions] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);

  // Add this state to show a loading spinner on the buttons
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  // ---> NEW: PDF MODAL STATE <---
  const [isPdfModalVisible, setIsPdfModalVisible] = useState(false);

  // --- EFFECT 1: FETCH CONTRACTS ---
  useEffect(() => {
    const fetchContracts = async () => {
      try {
        const res = await api.get(
          `/leasing/contract-period/view-all-contracts/${property_id}`,
        );
        const data = res.data.contracts || res.data;

        if (Array.isArray(data) && data.length > 0) {
          const formatted = data.map((c: any) => ({
            label: `${new Date(c.contract_period_from).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${new Date(c.contract_period_to).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
            value: c.id,
          }));
          setContracts(formatted);
          setSelectedContract(formatted[0]);
        }
      } catch (e) {
        console.error("Failed to fetch contracts:", e);
      }
    };

    if (isContractRequired) {
      fetchContracts();
    }
  }, [property_id, isContractRequired]);

  // --- EFFECT 2: FETCH REPORT ID ---
  useEffect(() => {
    const fetchReportId = async () => {
      if (isContractRequired && !selectedContract) {
        return;
      }

      try {
        setIsLoadingId(true);
        const cleanReportType = String(report_type).replace(" Report", "");

        const response = await api.get(`/pm/reports/latest-id`, {
          params: {
            property_id: property_id,
            report_type: cleanReportType,
            contract_id: selectedContract ? selectedContract.value : null,
          },
        });

        setReportId(response.data.report_id);
      } catch (error: any) {
        console.error("Failed to fetch report ID:", error);

        // ---> FIX: Instantly clear everything if no report exists for this contract <---
        setReportId(null);
        setItems([]);

        if (error.response?.status === 404) {
          // We keep the alert so the user knows they need to create a report first
          Alert.alert(
            "Notice",
            `No ${report_type} found for this contract date. Please create one first.`,
          );
        }
      } finally {
        setIsLoadingId(false);
      }
    };

    fetchReportId();
  }, [property_id, report_type, selectedContract, isContractRequired]);

  // --- EFFECT 3: FETCH ALL ITEMS FOR REPORT ---
  useFocusEffect(
    useCallback(() => {
      const fetchAllItems = async () => {
        const cleanReportType = String(report_type).replace(" Report", "");

        if (cleanReportType !== "Unit" && !reportId) {
          // ---> FIX: Prevent stale data from showing by clearing the items array <---
          setItems([]);
          return;
        }

        try {
          setIsLoadingItems(true);
          let response;

          if (cleanReportType === "Unit") {
            response = await api.get(`/pm/items/unit-report/${property_id}`);
          } else {
            response = await api.get(`/pm/items/report/${reportId}`);
          }

          setItems(response.data);
        } catch (error) {
          console.error("Failed to fetch report items:", error);
          setItems([]); // Clear items on error too
          Alert.alert("Error", "Could not load report items.");
        } finally {
          setIsLoadingItems(false);
        }
      };

      fetchAllItems();
    }, [reportId, property_id, report_type]),
  );

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

  // --- HANDLERS FOR FILTER MODAL ---
  const toggleArrayItem = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    val: string,
  ) => {
    setter((prev) =>
      prev.includes(val) ? prev.filter((i) => i !== val) : [...prev, val],
    );
  };

  const clearFilters = () => {
    setFilterDateFrom(null);
    setFilterDateTo(null);
    setFilterTypes([]);
    setFilterConditions([]);
    setFilterStatuses([]);
    setIsFilterModalVisible(false);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowPicker(null);
    if (selectedDate) {
      if (showPicker === "from") setFilterDateFrom(selectedDate);
      if (showPicker === "to") setFilterDateTo(selectedDate);
    }
    if (Platform.OS === "ios") setShowPicker(null);
  };

  // --- CLIENT-SIDE FILTERING ---
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedArea !== "All" && item.area !== selectedArea) return false;

      if (filterDateFrom && new Date(item.created_at) < filterDateFrom)
        return false;
      if (filterDateTo && new Date(item.created_at) > filterDateTo)
        return false;

      if (filterTypes.length > 0 && !filterTypes.includes(item.type))
        return false;

      if (filterConditions.length > 0) {
        const itemConditions = safeParse(item.condition);
        const hasMatchingCondition = filterConditions.some((c) =>
          itemConditions.includes(c),
        );
        if (!hasMatchingCondition) return false;
      }

      if (filterStatuses.length > 0) {
        const itemStatuses = safeParse(item.status);
        const hasMatchingStatus = filterStatuses.some((s) =>
          itemStatuses.includes(s),
        );
        if (!hasMatchingStatus) return false;
      }

      return true;
    });
  }, [
    items,
    selectedArea,
    filterDateFrom,
    filterDateTo,
    filterTypes,
    filterConditions,
    filterStatuses,
  ]);

  // --- ACTIONS ---
  const handleAddItem = () => {
    if (!reportId) {
      Alert.alert(
        "Wait",
        "Still loading report details, please wait a moment.",
      );
      return;
    }

    router.push({
      pathname: "/property/create-items",
      params: {
        property_id: property_id,
        report_id: reportId,
        default_area: selectedArea !== "All" ? selectedArea : "",
      },
    });
  };

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
              await api.delete(`/pm/items/delete/${itemId}`);
              setItems((prevItems) =>
                prevItems.filter((item) => item.report_item_id !== itemId),
              );
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

  // --- PDF GENERATION HELPER ---
  const generateAndCachePdf = async (overrideReportType?: string) => {
    // If override is provided, use it. Otherwise, fallback to the default route param
    const cleanReportType =
      overrideReportType || String(report_type).replace(" Report", "");

    setIsGeneratingPdf(true);

    try {
      // 1. Fetch Property Name and Unit Number for a clean filename
      let propNameStr = "Property";
      let unitStr = String(property_id); // Fallback to ID if the API fails

      try {
        const propResponse = await api.get(`/pm/properties/${property_id}`);
        const propData = propResponse.data.property || propResponse.data; // Adjust based on your API wrapper

        if (propData.property_name) propNameStr = propData.property_name;
        if (propData.unit_number) unitStr = propData.unit_number;
      } catch (err) {
        console.warn(
          "Failed to fetch property details for filename, falling back to ID.",
        );
      }

      // Sanitize the strings (remove spaces and special characters so it saves safely on mobile)
      const safePropName = propNameStr.replace(/[^a-z0-9]/gi, "_");
      const safeUnit = String(unitStr).replace(/[^a-z0-9]/gi, "_");

      // 2. Build the URL and append all active filters dynamically
      const baseUrl = api.defaults.baseURL || "http://your-production-url.com";
      let pdfUrl = `${baseUrl}/pm/reports/generate-pdf?property_id=${property_id}&report_type=${encodeURIComponent(cleanReportType)}`;

      if (filterDateFrom)
        pdfUrl += `&item_date_from=${filterDateFrom.toISOString()}`;
      if (filterDateTo) pdfUrl += `&item_date_to=${filterDateTo.toISOString()}`;
      if (filterTypes.length > 0)
        pdfUrl += `&item_type=${encodeURIComponent(JSON.stringify(filterTypes))}`;
      if (filterConditions.length > 0)
        pdfUrl += `&condition=${encodeURIComponent(JSON.stringify(filterConditions))}`;
      if (filterStatuses.length > 0)
        pdfUrl += `&status=${encodeURIComponent(JSON.stringify(filterStatuses))}`;

      if (selectedArea && selectedArea !== "All") {
        pdfUrl += `&area=${encodeURIComponent(selectedArea)}`;
      }

      // 3. Define where the file will be temporarily saved on the phone
      const fileName = `${cleanReportType.replace(" ", "_")}_Report_${safePropName}_Unit_${safeUnit}.pdf`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // 4. Get the Auth Token from your Axios api instance
      const token =
        api.defaults.headers.common["Authorization"] ||
        api.defaults.headers.Authorization ||
        "";

      // 5. Download the PDF from your Node.js backend
      const downloadRes = await FileSystem.downloadAsync(pdfUrl, fileUri, {
        headers: { Authorization: String(token) },
      });

      if (downloadRes.status !== 200) {
        Alert.alert("Error", "Failed to generate PDF. Please try again.");
        return null;
      }

      return { uri: downloadRes.uri, name: fileName };
    } catch (error) {
      console.error("PDF Download Error:", error);
      Alert.alert("Error", "Something went wrong while generating the PDF.");
      return null;
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Passes the optional override string down into the generator
  const handleDownloadPdf = async (overrideReportType?: string) => {
    const file = await generateAndCachePdf(overrideReportType);
    if (!file) return;

    try {
      // Use Expo Sharing for BOTH Android and iOS!
      // This will pop up the phone's native Share menu (Viber, Messenger, Gmail, etc.)
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/pdf",
        dialogTitle: "Share BedandGo Report", // Android specific title
        UTI: "com.adobe.pdf", // iOS specific
      });
    } catch (error) {
      console.error("Share PDF Error:", error);
      Alert.alert("Error", "Could not share the PDF.");
    }

    setIsPdfModalVisible(false);
  };

  // --- RENDER ITEM CARD ---
  const renderItemCard = ({ item }: { item: any }) => {
    const parsedImages = safeParse(item.images);
    const parsedCondition = safeParse(item.condition);
    const parsedStatus = safeParse(item.status);

    const validImageExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".webp",
      ".heic",
      ".heif",
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

    const conditionText =
      parsedCondition.length > 0 ? parsedCondition.join(", ") : "Unknown";
    const statusText =
      parsedStatus.length > 0 ? parsedStatus.join(", ") : "Unknown";

    // Check if the item has recovery data attached
    const isRecovered = !!item.recovery_id || !!item.recovery_title;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => {
          router.push({
            pathname: "/property/item-details",
            params: {
              item_id: item.item_id,
              report_id: report_type === "Unit" ? reportId : item.report_id,
              property_id: property_id,
              area_name: item.area || selectedArea,
              report_type: report_type,
              requires_contract: requires_contract,
              report_item_id: item.report_item_id || item.id,
            },
          });
        }}
      >
        <View style={styles.cardLeft}>
          <Text style={styles.itemName}>
            {item.item_name}
            {selectedArea === "All" && item.area ? (
              <Text style={styles.itemAreaBadge}> ({item.area})</Text>
            ) : null}
          </Text>
          {hasValidImage ? (
            <Image source={{ uri: displayImageUrl }} style={styles.itemImage} />
          ) : (
            <View style={[styles.itemImage, styles.placeholderBox]}>
              <Text style={styles.noImageText}>No image</Text>
            </View>
          )}
        </View>

        <View style={styles.cardRight}>
          <View style={styles.detailsContainer}>
            <Text style={styles.itemDetailText}>{conditionText}</Text>
            <Text style={styles.itemDetailText}>{statusText}</Text>
            <Text style={styles.itemDetailDate}>
              {new Date(item.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>

            {/* Render "Recovered" text if Unit Report and item is recovered */}
            {isUnitReport && isRecovered && (
              <Text style={styles.itemRecoveredText}>Recovered</Text>
            )}
          </View>

          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(item.report_item_id || item.id)}
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
      {/* --- HEADER --- */}
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
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={styles.headerTitle}>{title}</Text>
          {isLoadingId && (
            <ActivityIndicator
              size="small"
              color="#8BC34A"
              style={{ marginLeft: 8 }}
            />
          )}
        </View>

        <View style={{ width: 38 }} />
      </View>

      {/* --- AREA FILTER BAR --- */}
      <TouchableOpacity
        style={styles.filterRow}
        activeOpacity={0.7}
        onPress={() => setShowAreaModal(true)}
      >
        <Text style={styles.filterText}>{selectedArea}</Text>
        <Ionicons
          name="caret-down"
          size={16}
          color="#333"
          style={{ marginLeft: 8 }}
        />
      </TouchableOpacity>

      {/* --- ACTION ROW --- */}
      <View style={styles.actionRow}>
        {isContractRequired ? (
          <TouchableOpacity
            style={styles.contractDropdown}
            onPress={() => setShowContractModal(true)}
          >
            <Text style={styles.contractText} numberOfLines={1}>
              {selectedContract
                ? selectedContract.label
                : "Loading Contracts..."}
            </Text>
            <Ionicons
              name="caret-down"
              size={14}
              color="#666"
              style={{ marginLeft: 5 }}
            />
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <TouchableOpacity
          style={styles.addItemBtn}
          onPress={handleAddItem}
          disabled={isLoadingId || !reportId}
        >
          <Text style={styles.addItemBtnText}>ADD ITEM</Text>
        </TouchableOpacity>

        {/* ---> NEW: PDF BUTTON <--- */}
        <TouchableOpacity
          style={styles.pdfBtn}
          onPress={() => setIsPdfModalVisible(true)}
        >
          <Text style={styles.pdfBtnText}>PDF</Text>
        </TouchableOpacity>

        {/* --- FILTER MODAL TRIGGER --- */}
        <TouchableOpacity
          style={styles.filterIconBtn}
          onPress={() => setIsFilterModalVisible(true)}
        >
          <Ionicons name="filter" size={20} color="#333" />
        </TouchableOpacity>
      </View>

      {/* --- ITEM LIST --- */}
      <View style={styles.listContainer}>
        {isLoadingItems ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#42A5F5" />
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.centerContent}>
            <Text style={styles.emptyText}>
              No items recorded{" "}
              {selectedArea !== "All" ? `in ${selectedArea}` : "yet"}.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(item, index) =>
              (item.report_item_id || item.id || index).toString()
            }
            renderItem={renderItemCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* --- MODAL: ADVANCED ITEM FILTER --- */}
      <Modal
        visible={isFilterModalVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlayFilter}>
          <View style={styles.filterModalContent}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Item Filter</Text>
            </View>

            {/* Date Pickers */}
            <View style={styles.dateRow}>
              <View style={styles.dateInputWrapper}>
                <Text style={styles.inputLabel}>Item Date From</Text>
                <TouchableOpacity
                  style={styles.dateBox}
                  onPress={() => setShowPicker("from")}
                >
                  <Text style={styles.dateText}>
                    {filterDateFrom
                      ? filterDateFrom.toLocaleDateString()
                      : "Select Date"}
                  </Text>
                  <Ionicons name="calendar" size={18} color="#333" />
                </TouchableOpacity>
              </View>

              <View style={styles.dateInputWrapper}>
                <Text style={styles.inputLabel}>Item Date To</Text>
                <TouchableOpacity
                  style={styles.dateBox}
                  onPress={() => setShowPicker("to")}
                >
                  <Text style={styles.dateText}>
                    {filterDateTo
                      ? filterDateTo.toLocaleDateString()
                      : "Select Date"}
                  </Text>
                  <Ionicons name="calendar" size={18} color="#333" />
                </TouchableOpacity>
              </View>
            </View>

            {/* DateTimePicker component */}
            {showPicker && (
              <DateTimePicker
                value={
                  showPicker === "from"
                    ? filterDateFrom || new Date()
                    : filterDateTo || new Date()
                }
                mode="date"
                display="default"
                onChange={handleDateChange}
              />
            )}

            {/* Dropdowns Using Your Custom Options */}
            <MultiSelectDropdown
              label="Item Type"
              options={ITEM_TYPES}
              selectedValues={filterTypes}
              toggleValue={(val) => toggleArrayItem(setFilterTypes, val)}
            />
            <MultiSelectDropdown
              label="Condition"
              options={CONDITIONS}
              selectedValues={filterConditions}
              toggleValue={(val) => toggleArrayItem(setFilterConditions, val)}
            />
            <MultiSelectDropdown
              label="Status"
              options={STATUSES}
              selectedValues={filterStatuses}
              toggleValue={(val) => toggleArrayItem(setFilterStatuses, val)}
            />

            {/* Buttons */}
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => setIsFilterModalVisible(false)}
            >
              <Text style={styles.applyBtnText}>Apply Filter</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.removeBtn} onPress={clearFilters}>
              <Text style={styles.removeBtnText}>Remove Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- MODAL: CONTRACT SELECTION --- */}
      <Modal
        visible={showContractModal}
        transparent={true}
        animationType="fade"
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowContractModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Select Contract</Text>
            <FlatList
              data={contracts}
              keyExtractor={(item) => item.value.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedContract(item);
                    setShowContractModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      selectedContract?.value === item.value &&
                        styles.modalItemTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No contracts found.</Text>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* --- MODAL: AREA SELECTION --- */}
      <Modal visible={showAreaModal} transparent={true} animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAreaModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Select Area</Text>
            <FlatList
              data={AREAS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedArea(item);
                    setShowAreaModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      selectedArea === item && styles.modalItemTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ---> NEW: PDF ACTIONS MODAL <--- */}
      <Modal
        visible={isPdfModalVisible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlayFilter}>
          <View style={styles.pdfModalContent}>
            <Text style={styles.pdfModalTitle}>Convert To PDF</Text>

            <TouchableOpacity
              style={styles.pdfActionBtn}
              onPress={() => handleDownloadPdf()}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? (
                <ActivityIndicator
                  size="small"
                  color="#333"
                  style={{ flex: 1 }}
                />
              ) : (
                <>
                  <Ionicons
                    name="download-outline"
                    size={20}
                    color="transparent"
                  />
                  <Text style={styles.pdfActionBtnText}>
                    Download PDF Report
                  </Text>
                  <Ionicons name="download-outline" size={20} color="#333" />
                </>
              )}
            </TouchableOpacity>

            {/* Conditionally Render Recovery Report Button ONLY for Unit Reports */}
            {isUnitReport && (
              <TouchableOpacity
                style={styles.pdfActionBtn}
                onPress={() => handleDownloadPdf("Recovery Report")}
                disabled={isGeneratingPdf}
              >
                {isGeneratingPdf ? (
                  <ActivityIndicator
                    size="small"
                    color="#333"
                    style={{ flex: 1 }}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="document-text-outline"
                      size={20}
                      color="transparent"
                    />
                    <Text style={styles.pdfActionBtnText}>
                      Generate Recovery Report
                    </Text>
                    <Ionicons
                      name="document-text-outline"
                      size={20}
                      color="#333"
                    />
                  </>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.pdfCancelBtn}
              onPress={() => setIsPdfModalVisible(false)}
            >
              <Text style={styles.pdfCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#999", textAlign: "center", padding: 20 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 15,
  },
  backButton: { padding: 5 },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333333",
    letterSpacing: 0.5,
  },

  filterRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E0E0E0",
  },
  filterText: { fontSize: 16, fontWeight: "bold", color: "#333" },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: "#E0E0E0",
  },
  contractDropdown: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEEEEE",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flex: 1,
    marginRight: 15,
  },
  contractText: { fontSize: 11, color: "#333", flexShrink: 1 },

  addItemBtn: {
    backgroundColor: "#689F38",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 4,
    marginRight: 10,
  },
  addItemBtnText: { color: "#FFFFFF", fontSize: 10, fontWeight: "bold" },

  // --- NEW PDF BUTTON STYLES ---
  pdfBtn: {
    backgroundColor: "#E3F2FD",
    borderWidth: 1,
    borderColor: "#64B5F6",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginRight: 10,
  },
  pdfBtnText: { color: "#1976D2", fontSize: 10, fontWeight: "bold" },

  filterIconBtn: {
    backgroundColor: "#E0E0E0",
    padding: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#999",
  },

  listContainer: { flex: 1, backgroundColor: "#C0C0C0" },
  listContent: { paddingHorizontal: 15, paddingTop: 15, paddingBottom: 50 },

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
      android: { elevation: 3 },
    }),
  },
  cardLeft: { flex: 1 },
  itemName: {
    fontSize: 12,
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
  placeholderBox: { justifyContent: "center", alignItems: "center" },
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
  detailsContainer: { alignItems: "flex-end", width: "100%" },
  itemDetailText: {
    fontSize: 11,
    color: "#333",
    marginBottom: 4,
    textAlign: "right",
  },
  itemDetailDate: {
    fontSize: 10,
    color: "#003366",
    marginBottom: 4,
    textAlign: "right",
  },
  itemAreaBadge: { color: "#689F38", fontWeight: "bold", marginTop: 4 },

  actionContainer: {
    alignItems: "flex-end",
    justifyContent: "flex-end",
    width: "100%",
  },
  deleteBtn: {
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#EF9A9A",
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderRadius: 4,
    marginTop: 10,
  },
  deleteBtnText: { color: "#E53935", fontSize: 11, fontWeight: "500" },

  // Base Modals
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    maxHeight: "60%",
    paddingVertical: 10,
  },
  modalHeader: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 15,
    color: "#333",
  },
  modalItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  modalItemText: { fontSize: 16, textAlign: "center", color: "#555" },
  modalItemTextActive: { fontWeight: "bold", color: "#42A5F5" },

  // --- Advanced Filter Bottom Sheet UI Styles ---
  modalOverlayFilter: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  optionsModalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingVertical: 20,
    maxHeight: "50%",
  },
  optionItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: "#EEE",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  optionText: { fontSize: 16, color: "#333" },
  optionTextActive: { fontWeight: "bold", color: "#003366" },

  filterModalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 25,
  },
  filterModalHeader: { alignItems: "center", marginBottom: 20 },
  filterModalTitle: { fontSize: 18, fontWeight: "bold", color: "#000" },

  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  dateInputWrapper: { flex: 0.48 },
  dateBox: {
    backgroundColor: "#F5F5F5",
    padding: 12,
    borderRadius: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dateText: { color: "#333", fontSize: 12 },

  inputGroup: { marginBottom: 15 },
  inputLabel: { fontSize: 12, color: "#333", marginBottom: 6 },
  dropdownBox: {
    backgroundColor: "#F5F5F5",
    borderRadius: 6,
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  pillsContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: 5,
  },
  placeholderText: {
    color: "#999",
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
  },

  pill: {
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    margin: 4,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  pillText: { fontSize: 12, color: "#333" },

  applyBtn: {
    backgroundColor: "#003366",
    padding: 15,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 10,
  },
  applyBtnText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  removeBtn: {
    backgroundColor: "#FFF",
    padding: 15,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#999",
  },
  removeBtnText: { color: "#666", fontSize: 16 },

  // --- NEW PDF MODAL STYLES ---
  pdfModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 25,
    paddingBottom: Platform.OS === "ios" ? 40 : 25,
  },
  pdfModalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
    textAlign: "center",
    marginBottom: 25,
  },

  // ---> ADD THIS NEW STYLE <---
  itemRecoveredText: {
    fontSize: 12,
    color: "#4CAF50", // Green color
    fontWeight: "600",
    marginTop: 4,
    textAlign: "right",
  },

  pdfActionBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#999",
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  pdfActionBtnText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
    textAlign: "center",
  },
  pdfCancelBtn: {
    borderWidth: 1,
    borderColor: "#999",
    borderRadius: 4,
    paddingVertical: 12,
    marginBottom: 10,
  },
  pdfCancelBtnText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
});
