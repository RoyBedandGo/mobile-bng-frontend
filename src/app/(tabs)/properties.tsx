import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PropertyCard from "../../components/PropertyCard";
import { api } from "../../lib/api";

export interface BackendPropertyData {
  id: string;
  unit_number: string;
  property_name: string;
  english_fullname: string;
  english_first_name: string;
  english_last_name: string;
  owner_type: string;
  company_name: string;
  updated_at: string;
  created_at?: string;
  property_created_at?: string;
  remarks_pm?: string;
}

type PropertyFilterType = "PM" | "NOT_PM";
type PmRemarksFilterType = "" | "For Lease" | "For Sale" | "For Airbnb";

const PM_REMARKS_OPTIONS: {
  label: string;
  value: PmRemarksFilterType;
}[] = [
  { label: "None", value: "" },
  { label: "For Lease", value: "For Lease" },
  { label: "For Sale", value: "For Sale" },
  { label: "For Airbnb", value: "For Airbnb" },
];

export default function PropertiesScreen() {
  const [properties, setProperties] = useState<BackendPropertyData[]>([]);
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);

  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const [selectedPropertyFilter, setSelectedPropertyFilter] =
    useState<PropertyFilterType>("PM");
  const [activePropertyFilter, setActivePropertyFilter] =
    useState<PropertyFilterType>("PM");

  const [selectedPmRemarks, setSelectedPmRemarks] =
    useState<PmRemarksFilterType>("");
  const [activePmRemarks, setActivePmRemarks] =
    useState<PmRemarksFilterType>("");

  const getPropertiesEndpoint = (filterType: PropertyFilterType) => {
    return filterType === "PM" ? "/pm/pmProperties" : "/pm/notPmProperties";
  };

  const isNewProperty = (item: BackendPropertyData) => {
    const createdValue = item.property_created_at || item.created_at;

    if (!createdValue) return false;

    const createdDate = new Date(createdValue);

    if (Number.isNaN(createdDate.getTime())) return false;

    const now = new Date();
    const diffMs = now.getTime() - createdDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    return diffDays >= 0 && diffDays <= 20;
  };

  const fetchProperties = async (
    pageNumber: number,
    searchTerm: string = "",
    filterType: PropertyFilterType = activePropertyFilter,
    pmRemarks: PmRemarksFilterType = activePmRemarks,
  ) => {
    if (isLoadingMore || (!hasMoreData && pageNumber !== 1)) return;

    setIsLoadingMore(true);

    try {
      const endpoint = getPropertiesEndpoint(filterType);

      const params = new URLSearchParams({
        page: String(pageNumber),
        limit: "10",
        search: searchTerm,
      });

      if (pmRemarks) {
        params.append("pm_remarks", pmRemarks);
      }

      const response = await api.get(`${endpoint}?${params.toString()}`);

      const newProperties = response.data.properties || [];

      if (pageNumber === 1) {
        setProperties(newProperties);
      } else {
        setProperties((prev) => [...prev, ...newProperties]);
      }

      setHasMoreData(newProperties.length >= 10);
      setPage(pageNumber + 1);
    } catch (error) {
      console.error("Failed to load properties", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchProperties(1, activeSearch, activePropertyFilter, activePmRemarks);
  }, []);

  const handleApplyFilter = () => {
    setActiveSearch(searchInput);
    setActivePropertyFilter(selectedPropertyFilter);
    setActivePmRemarks(selectedPmRemarks);
    setHasMoreData(true);
    setPage(1);
    setProperties([]);

    fetchProperties(1, searchInput, selectedPropertyFilter, selectedPmRemarks);

    setIsFilterModalVisible(false);
  };

  const handleResetFilter = () => {
    setSearchInput("");
    setActiveSearch("");
    setSelectedPropertyFilter("PM");
    setActivePropertyFilter("PM");
    setSelectedPmRemarks("");
    setActivePmRemarks("");
    setHasMoreData(true);
    setPage(1);
    setProperties([]);

    fetchProperties(1, "", "PM", "");

    setIsFilterModalVisible(false);
  };

  const renderFooter = () => {
    if (!isLoadingMore) return null;

    return (
      <View style={{ paddingVertical: 20 }}>
        <ActivityIndicator size="large" color="#003366" />
      </View>
    );
  };

  const activeFilterLabel = activePropertyFilter === "PM" ? "PM" : "Not PM";

  const filterIsActive =
    activeSearch !== "" ||
    activePropertyFilter !== "PM" ||
    activePmRemarks !== "";

  const badgeLabel = [
    activeFilterLabel,
    activePmRemarks || "",
    activeSearch || "",
  ]
    .filter(Boolean)
    .join(": ");

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>PROPERTIES</Text>

        <View style={styles.headerRightControls}>
          {filterIsActive && (
            <TouchableOpacity
              style={styles.activeSearchBadge}
              onPress={handleResetFilter}
            >
              <Text style={styles.activeSearchText} numberOfLines={1}>
                {badgeLabel}
              </Text>

              <Ionicons
                name="close-circle"
                size={14}
                color="#003380"
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.filterIconBtn}
            onPress={() => {
              setSearchInput(activeSearch);
              setSelectedPropertyFilter(activePropertyFilter);
              setSelectedPmRemarks(activePmRemarks);
              setIsFilterModalVisible(true);
            }}
          >
            <Ionicons name="options-outline" size={22} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={properties}
        keyExtractor={(item, index) => item.id.toString() + index}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isNew = isNewProperty(item);

          return (
            <View style={[styles.propertyCardWrap]}>
              {isNew && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>NEW</Text>
                </View>
              )}

              <PropertyCard
                id={item.id}
                propertyName={`${item.unit_number || ""} ${
                  item.property_name || ""
                }`.trim()}
                ownerName={
                  item.owner_type === "Corporation"
                    ? item.company_name
                    : `${item.english_first_name || ""} ${
                        item.english_last_name || ""
                      }`.trim()
                }
                date={item.updated_at}
                onPress={() => router.push(`/(tabs)/property/${item.id}`)}
              />
            </View>
          );
        }}
        onEndReached={() =>
          fetchProperties(
            page,
            activeSearch,
            activePropertyFilter,
            activePmRemarks,
          )
        }
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          !isLoadingMore ? (
            <Text style={styles.emptyText}>
              No properties found matching your filter.
            </Text>
          ) : null
        }
      />

      <Modal
        visible={isFilterModalVisible}
        animationType="fade"
        transparent={true}
      >
        <View style={styles.modalOverlayFilter}>
          <View style={styles.filterModalContent}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterTitle}>Properties Filter</Text>

              <TouchableOpacity
                onPress={() => setIsFilterModalVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.searchLabel}>Property Type</Text>

            <View style={styles.propertyTypeDropdown}>
              <TouchableOpacity
                style={[
                  styles.propertyTypeOption,
                  selectedPropertyFilter === "PM" &&
                    styles.propertyTypeOptionActive,
                ]}
                onPress={() => setSelectedPropertyFilter("PM")}
              >
                <Text
                  style={[
                    styles.propertyTypeText,
                    selectedPropertyFilter === "PM" &&
                      styles.propertyTypeTextActive,
                  ]}
                >
                  PM
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.propertyTypeOption,
                  selectedPropertyFilter === "NOT_PM" &&
                    styles.propertyTypeOptionActive,
                ]}
                onPress={() => setSelectedPropertyFilter("NOT_PM")}
              >
                <Text
                  style={[
                    styles.propertyTypeText,
                    selectedPropertyFilter === "NOT_PM" &&
                      styles.propertyTypeTextActive,
                  ]}
                >
                  Not PM
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.searchLabel}>PM Remarks</Text>

            <View style={styles.pmRemarksDropdown}>
              {PM_REMARKS_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.pmRemarksOption,
                    selectedPmRemarks === option.value &&
                      styles.pmRemarksOptionActive,
                  ]}
                  onPress={() => setSelectedPmRemarks(option.value)}
                >
                  <Text
                    style={[
                      styles.pmRemarksText,
                      selectedPmRemarks === option.value &&
                        styles.pmRemarksTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.searchLabel}>Search Owner or Properties</Text>

            <View style={styles.searchBox}>
              <Ionicons
                name="search-outline"
                size={18}
                color="#999"
                style={styles.searchIcon}
              />

              <TextInput
                style={styles.searchInput}
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder="e.g. John Doe, Makati, 1941"
                placeholderTextColor="#999"
                returnKeyType="search"
                onSubmitEditing={handleApplyFilter}
                autoFocus={true}
              />

              {searchInput.length > 0 && (
                <TouchableOpacity onPress={() => setSearchInput("")}>
                  <Ionicons name="close-circle" size={18} color="#CCC" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.applyFilterBtn}
              onPress={handleApplyFilter}
            >
              <Text style={styles.applyFilterBtnText}>Apply Filter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resetFilterBtn}
              onPress={handleResetFilter}
            >
              <Text style={styles.resetFilterBtnText}>Reset to PM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E5E5E5" },

  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },

  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },

  headerRightControls: {
    flexDirection: "row",
    alignItems: "center",
  },

  filterIconBtn: {
    padding: 6,
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DDD",
  },

  activeSearchBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 10,
    maxWidth: 190,
  },

  activeSearchText: {
    color: "#003380",
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
  },

  listContent: {
    paddingHorizontal: 15,
    paddingBottom: 20,
    paddingTop: 5,
  },

  propertyCardWrap: {
    borderRadius: 12,
    marginBottom: 10,
    position: "relative",
  },

  // newPropertyHighlight: {
  //   backgroundColor: "#ffffff",
  //   borderWidth: 0,
  //   borderColor: "#ffffff",
  //   padding: 1,
  // },

  newBadge: {
    position: "absolute",
    top: 6,
    right: 8,
    backgroundColor: "#4CAF50",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 10,
  },

  newBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },

  emptyText: {
    textAlign: "center",
    color: "#666",
    marginTop: 40,
    fontSize: 14,
  },

  modalOverlayFilter: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-start",
  },

  filterModalContent: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 25,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 25,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },

  filterModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  filterTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
  },

  closeBtn: { padding: 4 },

  searchLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 5,
    marginLeft: 2,
  },

  propertyTypeDropdown: {
    flexDirection: "row",
    backgroundColor: "#F5F5F5",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#EEE",
    padding: 4,
    marginBottom: 18,
  },

  propertyTypeOption: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 5,
    alignItems: "center",
  },

  propertyTypeOptionActive: {
    backgroundColor: "#003380",
  },

  propertyTypeText: {
    fontSize: 14,
    color: "#555",
    fontWeight: "600",
  },

  propertyTypeTextActive: {
    color: "#FFFFFF",
  },

  pmRemarksDropdown: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#F5F5F5",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#EEE",
    padding: 4,
    marginBottom: 18,
    gap: 6,
  },

  pmRemarksOption: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 5,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },

  pmRemarksOptionActive: {
    backgroundColor: "#003380",
    borderColor: "#003380",
  },

  pmRemarksText: {
    fontSize: 13,
    color: "#555",
    fontWeight: "600",
  },

  pmRemarksTextActive: {
    color: "#FFFFFF",
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 45,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#EEE",
  },

  searchIcon: { marginRight: 8 },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },

  applyFilterBtn: {
    backgroundColor: "#003380",
    paddingVertical: 15,
    borderRadius: 6,
    alignItems: "center",
  },

  applyFilterBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },

  resetFilterBtn: {
    paddingVertical: 13,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#DDD",
    backgroundColor: "#FFF",
  },

  resetFilterBtnText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "600",
  },
});
