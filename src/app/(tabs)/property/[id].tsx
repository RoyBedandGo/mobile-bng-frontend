import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../lib/api";

const CustomCheckbox = ({
  label,
  isChecked,
}: {
  label: string;
  isChecked: boolean;
}) => (
  <View style={styles.checkboxContainer}>
    <Ionicons
      name={isChecked ? "checkbox" : "square-outline"}
      size={20}
      color={isChecked ? "#A0C4FF" : "#CCC"}
    />
    <Text style={styles.checkboxLabel}>{label}</Text>
  </View>
);

export default function PropertyDetails() {
  const { id } = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [propertyData, setPropertyData] = useState<any>(null);
  console.log("Received ID from params:", id);
  useEffect(() => {
    const fetchPropertyDetails = async () => {
      try {
        setIsLoading(true);
        const response = await api.get(`/pm/properties/${id}`);
        setPropertyData(response.data.property);
        console.log("property details:", response.data.property);
      } catch (error) {
        console.error("Error fetching property details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPropertyDetails();
  }, [id]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  // --- Parse Strings and MySQL TINYINTs (1 or 0) into React Booleans ---
  const remarksString = propertyData?.remarks_pm || "";
  const isForSale = remarksString.includes("For Sale");
  const isForLease = remarksString.includes("For Lease");
  const isForAirbnb = remarksString.includes("For Airbnb");

  const isPM = propertyData?.is_pm === 1;
  const isCondotel = propertyData?.is_condotel === 1;

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Two Action Buttons */}
        <View style={styles.actionRow}>
          {/* --- ADDED onPress HERE --- */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.btnView]}
            onPress={() =>
              router.push(`/property/view-all-reports?property_id=${id}`)
            }
          >
            <Text style={styles.txtView}>VIEW REPORTS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.btnCreate]}
            onPress={() =>
              router.push(`/(tabs)/property/create-report?property_id=${id}`)
            }
          >
            <Text style={styles.txtCreate}>CREATE REPORT</Text>
          </TouchableOpacity>
        </View>

        {/* Database Mapped Fields */}
        <Text style={styles.inputLabel}>Property Name</Text>
        <View style={styles.readOnlyInput}>
          <Text>{propertyData?.property_name}</Text>
        </View>

        <Text style={styles.inputLabel}>Unit No.</Text>
        <View style={styles.readOnlyInput}>
          <Text>{propertyData?.unit_number}</Text>
        </View>

        <Text style={styles.inputLabel}>Property Address</Text>
        <View style={styles.readOnlyInput}>
          <Text>{propertyData?.unit_address || "No Address Provided"}</Text>
        </View>

        <Text style={styles.inputLabel}>Owner Name</Text>
        <View style={styles.readOnlyInput}>
          <Text>
            {propertyData?.owner_type === "Corporation"
              ? propertyData?.company_name
              : propertyData?.english_first_name +
                " " +
                propertyData?.english_last_name}
          </Text>
        </View>

        <Text style={styles.inputLabel}>Owner Email</Text>
        <View style={styles.readOnlyInput}>
          {/* Fallback added since email isn't in this specific join query */}
          <Text>{propertyData?.email || "Not Provided"}</Text>
        </View>

        {/* Checkbox Grids using parsed data */}
        <View style={styles.checkboxSection}>
          <View style={styles.checkboxColumn}>
            <Text style={styles.inputLabel}>Remarks PM</Text>
            <CustomCheckbox label="For Sale" isChecked={isForSale} />
            <CustomCheckbox label="For Lease" isChecked={isForLease} />
            <CustomCheckbox label="For Airbnb" isChecked={isForAirbnb} />
          </View>
          <View style={styles.checkboxColumn}>
            <Text style={styles.inputLabel}>PM and Condotel</Text>
            <CustomCheckbox label="Is PM?" isChecked={isPM} />
            <CustomCheckbox label="Is Condotel?" isChecked={isCondotel} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 15, paddingVertical: 10 },
  backButton: { padding: 5 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 4,
    borderWidth: 1,
    width: "48%",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  btnView: { borderColor: "#A0C4FF" },
  txtView: { color: "#66BAFF", fontWeight: "bold", fontSize: 12 },
  btnCreate: { borderColor: "#A5D6A7" },
  txtCreate: { color: "#81C784", fontWeight: "bold", fontSize: 12 },

  inputLabel: { fontSize: 12, color: "#333", marginBottom: 4, marginLeft: 2 },
  readOnlyInput: {
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 6,
    marginBottom: 15,
  },

  checkboxSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  checkboxColumn: { width: "48%" },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 4,
  },
  checkboxLabel: { marginLeft: 8, fontSize: 13, color: "#333" },
});
