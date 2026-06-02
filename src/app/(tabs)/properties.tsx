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
}

type PropertyFilterType = "PM" | "NOT_PM";

export default function PropertiesScreen() {
  const [properties, setProperties] = useState<BackendPropertyData[]>([]);
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);

  // Search & Modal States
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  // Default is PM
  const [selectedPropertyFilter, setSelectedPropertyFilter] =
    useState<PropertyFilterType>("PM");
  const [activePropertyFilter, setActivePropertyFilter] =
    useState<PropertyFilterType>("PM");

  const getPropertiesEndpoint = (filterType: PropertyFilterType) => {
    return filterType === "PM" ? "/pm/pmProperties" : "/pm/notPmProperties";
  };

  const fetchProperties = async (
    pageNumber: number,
    searchTerm: string = "",
    filterType: PropertyFilterType = activePropertyFilter,
  ) => {
    if (isLoadingMore || (!hasMoreData && pageNumber !== 1)) return;

    setIsLoadingMore(true);

    try {
      const endpoint = getPropertiesEndpoint(filterType);

      const response = await api.get(
        `${endpoint}?page=${pageNumber}&limit=10&search=${encodeURIComponent(
          searchTerm,
        )}`,
      );

      const newProperties = response.data.properties || [];

      if (pageNumber === 1) {
        setProperties(newProperties);
      } else {
        setProperties((prev) => [...prev, ...newProperties]);
      }

      if (newProperties.length < 10) {
        setHasMoreData(false);
      } else {
        setHasMoreData(true);
      }

      setPage(pageNumber + 1);
    } catch (error) {
      console.error("Failed to load properties", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchProperties(1, activeSearch, activePropertyFilter);
  }, []);

  const handleApplyFilter = () => {
    setActiveSearch(searchInput);
    setActivePropertyFilter(selectedPropertyFilter);
    setHasMoreData(true);
    setPage(1);
    setProperties([]);
    fetchProperties(1, searchInput, selectedPropertyFilter);
    setIsFilterModalVisible(false);
  };

  const handleResetFilter = () => {
    setSearchInput("");
    setActiveSearch("");
    setSelectedPropertyFilter("PM");
    setActivePropertyFilter("PM");
    setHasMoreData(true);
    setPage(1);
    setProperties([]);
    fetchProperties(1, "", "PM");
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

  return (
    <SafeAreaView style={styles.container}>
      {/* --- HEADER WITH FILTER ICON --- */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>PROPERTIES</Text>

        <View style={styles.headerRightControls}>
          {(activeSearch !== "" || activePropertyFilter !== "PM") && (
            <TouchableOpacity
              style={styles.activeSearchBadge}
              onPress={handleResetFilter}
            >
              <Text style={styles.activeSearchText} numberOfLines={1}>
                {activeSearch
                  ? `${activeFilterLabel}: ${activeSearch}`
                  : activeFilterLabel}
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
        renderItem={({ item }) => (
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
        )}
        onEndReached={() =>
          fetchProperties(page, activeSearch, activePropertyFilter)
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

      {/* --- FILTER MODAL --- */}
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
  headerRightControls: { flexDirection: "row", alignItems: "center" },

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
    maxWidth: 180,
  },
  activeSearchText: {
    color: "#003380",
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
  },

  listContent: { paddingHorizontal: 15, paddingBottom: 20, paddingTop: 5 },
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
  filterTitle: { fontSize: 18, fontWeight: "bold", color: "#000" },
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
  searchInput: { flex: 1, fontSize: 14, color: "#333" },

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
