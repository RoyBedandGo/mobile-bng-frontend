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

export default function PropertiesScreen() {
  const [properties, setProperties] = useState<BackendPropertyData[]>([]);
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);

  // Search & Modal States
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const fetchProperties = async (
    pageNumber: number,
    searchTerm: string = "",
  ) => {
    console.log(`Search-1: "${searchTerm}"`);
    if (isLoadingMore || (!hasMoreData && pageNumber !== 1)) return;

    setIsLoadingMore(true);
    try {
      console.log(`Search-2: "${searchTerm}"`);
      const response = await api.get(
        `/pm/pmProperties?page=${pageNumber}&limit=10&search=${encodeURIComponent(searchTerm)}`,
      );

      const newProperties = response.data.properties;

      if (newProperties.length === 0) {
        setHasMoreData(false);
      } else {
        if (pageNumber === 1) {
          setProperties(newProperties);
        } else {
          setProperties((prev) => [...prev, ...newProperties]);
        }
        setPage(pageNumber + 1);
      }
    } catch (error) {
      console.error("Failed to load properties", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchProperties(1, activeSearch);
  }, []);

  const handleApplyFilter = () => {
    setActiveSearch(searchInput);
    setHasMoreData(true);
    fetchProperties(1, searchInput);
    setIsFilterModalVisible(false); // Close modal on search
  };

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={{ paddingVertical: 20 }}>
        <ActivityIndicator size="large" color="#003366" />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* --- HEADER WITH FILTER ICON --- */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>PROPERTIES</Text>

        <View style={styles.headerRightControls}>
          {/* Show active search term badge if searching */}
          {activeSearch !== "" && (
            <TouchableOpacity
              style={styles.activeSearchBadge}
              onPress={() => {
                setSearchInput("");
                setActiveSearch("");
                setHasMoreData(true);
                fetchProperties(1, ""); // Reset list
              }}
            >
              <Text style={styles.activeSearchText} numberOfLines={1}>
                {activeSearch}
              </Text>
              <Ionicons
                name="close-circle"
                size={14}
                color="#003380"
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>
          )}

          {/* Icon matches the 3-line filter button in your screenshot */}
          <TouchableOpacity
            style={styles.filterIconBtn}
            onPress={() => setIsFilterModalVisible(true)}
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
            // Safely fall back to empty strings if data is missing
            propertyName={`${item.unit_number || ""} ${item.property_name || ""}`.trim()}
            ownerName={
              item.owner_type === "Corporation"
                ? item.company_name
                : `${item.english_first_name || ""} ${item.english_last_name || ""}`.trim()
            }
            date={item.updated_at}
            onPress={() => router.push(`/(tabs)/property/${item.id}`)}
          />
        )}
        onEndReached={() => fetchProperties(page, activeSearch)}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          !isLoadingMore ? (
            <Text style={styles.emptyText}>
              No properties found matching your search.
            </Text>
          ) : null
        }
      />

      {/* --- FILTER MODAL --- */}
      {/* Find your Modal tag and change "slide" to "fade" */}
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
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E5E5E5" }, // Matching your light gray background

  // Header
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
    backgroundColor: "#E3F2FD", // Light blue pill
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 10,
    maxWidth: 160,
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

  // --- Modal Styles ---
  modalOverlayFilter: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-start",
  },
  filterModalContent: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 20, // <--- CHANGED: Rounded corners on bottom now
    borderBottomRightRadius: 20,
    padding: 25,
    paddingTop: Platform.OS === "ios" ? 60 : 40, // <--- CHANGED: Adds space for notch/status bar
    paddingBottom: 25,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 }, // <--- CHANGED: Shadow points down
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

  searchLabel: { fontSize: 12, color: "#666", marginBottom: 5, marginLeft: 2 },
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
    backgroundColor: "#003380", // Dark blue from your screenshot
    paddingVertical: 15,
    borderRadius: 6,
    alignItems: "center",
  },
  applyFilterBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
});
