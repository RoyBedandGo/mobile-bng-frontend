import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../hooks/useAuth";
import { api } from "../../../lib/api";

// --- CUSTOM UI COMPONENTS ---
const CustomCheckbox = ({
  label,
  isChecked,
  onPress,
}: {
  label: string;
  isChecked: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={styles.checkboxContainer}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Ionicons
      name={isChecked ? "checkbox" : "square-outline"}
      size={20}
      color={isChecked ? "#666" : "#CCC"}
    />
    <Text style={styles.checkboxLabel}>{label}</Text>
  </TouchableOpacity>
);

const CustomPicker = ({
  value,
  options,
  onSelect,
  placeholder,
}: {
  value: string;
  options: any[];
  onSelect: (val: any) => void;
  placeholder: string;
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  return (
    <>
      <TouchableOpacity
        style={styles.inputBox}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.inputText, !value && { color: "#999" }]}>
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
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    onSelect(item);
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.label}</Text>
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
export default function CreateReportScreen() {
  const { property_id } = useLocalSearchParams();
  const { user } = useAuth();

  // 1. Raw Data States (From Backend)
  const [propertyReports, setPropertyReports] = useState<any[]>([]); // All reports for property
  const [contractReports, setContractReports] = useState<any[]>([]); // Linked reports

  // 2. Dropdown List States
  const [contractsList, setContractsList] = useState<any[]>([]);
  const [oicList, setOicList] = useState<any[]>([]);
  const [previousReports, setPreviousReports] = useState<any[]>([]);
  const [availableReportTypes, setAvailableReportTypes] = useState<any[]>([]);

  // 3. Form Selection States
  const [selectedContract, setSelectedContract] = useState<any>(null); // MOVED TO TOP
  const [selectedReportType, setSelectedReportType] = useState<any>(null);
  const [selectedOIC, setSelectedOIC] = useState<any>(null);

  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isCopyReport, setIsCopyReport] = useState(false);
  const [selectedReportToCopy, setSelectedReportToCopy] = useState<any>(null);

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCopying, setIsCopying] = useState(false); // NEW STATE FOR COPY OVERLAY

  // --- INITIAL DATA FETCH ---
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setIsLoadingData(true);

        // A. Fetch Users
        const userRes = await api.get("/users/allUsers");
        const pmUsers = userRes.data.users
          .filter((user: any) => user.department === "Property Management")
          .map((user: any) => ({ label: user.name, value: user.id }));
        setOicList(pmUsers);

        // B. Fetch Previous Reports (For Copying & Turnover validation)
        let allReports: any[] = [];
        try {
          const reportsRes = await api.get(
            `/pm/reports/allReports?property_id=${property_id}`,
          );
          if (reportsRes.data.reports) {
            allReports = reportsRes.data.reports;
            setPropertyReports(allReports);
            setPreviousReports(
              allReports.map((rep: any) => ({
                label: `${rep.report_type} - ${new Date(rep.report_date).toLocaleDateString()}`,
                value: rep.id,
              })),
            );
          }
        } catch (e) {
          console.error("Error fetching allReports:", e);
        }

        // C. Fetch Contracts
        try {
          const contractRes = await api.get(
            `/leasing/contract-period/view-all-contracts/${property_id}`,
          );
          if (contractRes.data) {
            const contractData = contractRes.data.contracts || contractRes.data;
            if (Array.isArray(contractData)) {
              // Add a default "No Contract" option at the very top for Turnovers/Units
              const mappedContracts = [
                { label: "No Contract Selected", value: null },
                ...contractData.map((c: any) => ({
                  label: `${new Date(c.contract_period_from).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${new Date(c.contract_period_to).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
                  value: c.id,
                })),
              ];
              setContractsList(mappedContracts);
              setSelectedContract(mappedContracts[0]); // Auto-select "No Contract"
            }
          }
        } catch (e) {
          console.error("Error fetching contracts:", e);
        }

        // D. Fetch Linked Contract Reports API
        try {
          const crRes = await api.get(
            `/pm/reports/contract-reports/${property_id}`,
          );
          if (crRes.data?.contract_reports) {
            setContractReports(crRes.data.contract_reports);
          }
        } catch (e) {
          console.error("Error fetching contract-reports:", e);
        }
      } catch (error) {
        console.error("Failed to fetch form data", error);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchInitialData();
  }, [property_id]);

  // --- DYNAMIC REPORT TYPE FILTERING ---
  // Every time the user changes the Contract, recalculate what Reports they are allowed to make!
  useEffect(() => {
    let dynamicTypes = [];

    // 1. TURNOVER Check (Global: Only 1 per property allowed)
    const hasTurnover = propertyReports.some(
      (r) => r.report_type === "Turnover",
    );
    if (!hasTurnover) {
      dynamicTypes.push({ label: "Turnover Report", value: "Turnover" });
    }

    // 2. UNIT Check (Global: Only 1 per property allowed)
    // ---> UPDATED: Now checks if a Unit report already exists <---
    const hasUnit = propertyReports.some((r) => r.report_type === "Unit");
    if (!hasUnit) {
      dynamicTypes.push({ label: "Unit Report", value: "Unit" });
    }

    // 3. MOVE-IN & MOVE-OUT Check (Contract Specific)
    // ONLY show these if a specific contract is selected (value is not null)
    if (selectedContract && selectedContract.value !== null) {
      const hasMoveIn = contractReports.some(
        (cr) =>
          cr.contract_id === selectedContract.value &&
          cr.report_type === "Move-in",
      );
      if (!hasMoveIn) {
        dynamicTypes.push({ label: "Move-in Report", value: "Move-in" });
      }

      const hasMoveOut = contractReports.some(
        (cr) =>
          cr.contract_id === selectedContract.value &&
          cr.report_type === "Move-out",
      );
      if (!hasMoveOut) {
        dynamicTypes.push({ label: "Move-out Report", value: "Move-out" });
      }
    }

    setAvailableReportTypes(dynamicTypes);

    // Safety check: If they change contracts, and their currently selected report type
    // is no longer valid (e.g., they had Move-in selected, but switched to a contract
    // that already has a Move-in), reset the Report Type dropdown to null!
    if (selectedReportType) {
      const stillValid = dynamicTypes.some(
        (t) => t.value === selectedReportType.value,
      );
      if (!stillValid) setSelectedReportType(null);
    }
  }, [selectedContract, propertyReports, contractReports]);

  const onChangeDate = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === "ios");
    setDate(currentDate);
  };

  const handleCreateReport = async () => {
    if (!selectedReportType) {
      Alert.alert("Validation", "Please select a Report Type.");
      return;
    }

    // Validation: Enforce contract selection if they chose Move-in or Move-out
    const isMoveInOrOut = ["Move-in", "Move-out"].includes(
      selectedReportType.value,
    );
    if (isMoveInOrOut && !selectedContract?.value) {
      Alert.alert(
        "Validation",
        `Please select a valid Contract to create a ${selectedReportType.value} report.`,
      );
      return;
    }

    if (!selectedOIC) {
      Alert.alert("Validation", "Please select a Report OIC.");
      return;
    }

    if (isCopyReport && !selectedReportToCopy?.value) {
      Alert.alert("Validation", "Please select a report to copy from.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        property_id: Number(property_id),
        report_type: selectedReportType.value,
        report_oic: selectedOIC.value,
        report_date: date.toISOString().split("T")[0],
        created_by: user?.id,
        copied_from_id: isCopyReport ? selectedReportToCopy?.value : null,
        contract_id: selectedContract?.value || null, // Send contract ID if selected
      };

      // 1. Create the base report
      const response = await api.post("/pm/reports/addReport", payload);

      if (response.status === 201) {
        const newReportId = response.data.report_id;

        // 2. Determine if it needs a contract for the next screen
        const requiresContract = ["Move-in", "Move-out"].includes(
          selectedReportType.value,
        );

        if (isCopyReport) {
          // --- COPY LOGIC FLIGHT PATH ---
          setIsSubmitting(false); // Stop standard spinner
          setIsCopying(true); // Start full-screen copy overlay
          console.log(
            "Copying items from report ID:",
            selectedReportToCopy.value,
            "to new report ID:",
            newReportId,
          );
          try {
            await api.post("/pm/items/copy_items", {
              new_report_id: newReportId,
              old_report_id: selectedReportToCopy.value,
              created_by: user?.id,
            });

            Alert.alert("Success", "Report and items copied successfully!");
            console.log(
              "Finished copying items, navigating to view report with params:",
              {
                property_id,
                report_type: selectedReportType.value,
                requires_contract: requiresContract ? "true" : "false",
              },
            );
            // Navigate directly to view-report with all the necessary parameters
            router.replace({
              pathname: "/property/view-report",
              params: {
                property_id: property_id,
                report_type: selectedReportType.value,
                requires_contract: requiresContract ? "true" : "false",
              },
            });
          } catch (copyError) {
            console.error("Failed to copy items:", copyError);
            Alert.alert(
              "Error",
              "Report was created, but failed to copy the items.",
            );
          } finally {
            setIsCopying(false);
          }
        } else {
          // --- STANDARD LOGIC FLIGHT PATH ---
          Alert.alert("Success", "Report created! Now let's add items.");
          router.replace({
            pathname: "/property/create-items",
            params: {
              property_id: property_id,
              report_id: newReportId,
            },
          });
        }
      }
    } catch (error: any) {
      console.error("Failed to create report", error);
      Alert.alert(
        "Error",
        error.response?.data?.Error || "Failed to create report.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingData) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#666" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* --- COPYING OVERLAY --- */}
      {isCopying && (
        <View style={styles.copyingOverlay}>
          <ActivityIndicator size="large" color="#8BC34A" />
          <Text style={styles.overlayText}>Copying Report...</Text>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CREATE REPORT</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.checkboxWrapper}>
          <CustomCheckbox
            label="Similar Report"
            isChecked={isCopyReport}
            onPress={() => setIsCopyReport(!isCopyReport)}
          />
        </View>

        {/* 1. Select Contract */}
        <Text style={styles.inputLabel}>Select Contract</Text>
        <CustomPicker
          value={selectedContract?.label}
          options={contractsList}
          onSelect={setSelectedContract}
          placeholder="Select a contract"
        />

        {/* 2. Type of Report */}
        <Text style={styles.inputLabel}>Type Of Report</Text>
        <CustomPicker
          value={selectedReportType?.label}
          options={
            availableReportTypes.length > 0
              ? availableReportTypes
              : [
                  {
                    label: "All reports completed for this contract",
                    value: null,
                  },
                ]
          }
          onSelect={setSelectedReportType}
          placeholder="Select Report Type"
        />

        {/* 3. Report OIC */}
        <Text style={styles.inputLabel}>Report OIC</Text>
        <CustomPicker
          value={selectedOIC?.label}
          options={oicList}
          onSelect={setSelectedOIC}
          placeholder="Select OIC"
        />

        {/* 4. Report Date */}
        <Text style={styles.inputLabel}>Report Date</Text>
        <TouchableOpacity
          style={styles.inputBox}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.inputText}>
            {date.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
          <Ionicons name="calendar" size={20} color="#333" />
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={onChangeDate}
          />
        )}

        {/* 5. Copy Report From */}
        {isCopyReport && (
          <View style={styles.fadeContainer}>
            <Text style={styles.inputLabel}>Copy Report From</Text>
            <CustomPicker
              value={selectedReportToCopy?.label}
              options={
                previousReports.length > 0
                  ? previousReports
                  : [{ label: "No previous reports found", value: null }]
              }
              onSelect={setSelectedReportToCopy}
              placeholder="Select a previous report"
            />
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleCreateReport}
          disabled={isSubmitting || availableReportTypes.length === 0}
        >
          {isSubmitting && !isCopying ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitBtnText}>
              {availableReportTypes.length === 0
                ? "REPORTS COMPLETED"
                : `CREATE ${selectedReportType?.value?.toUpperCase() || ""} REPORT`}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  // New Copying Overlay Styles
  copyingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  overlayText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 15,
    marginBottom: 20,
  },
  headerTitle: { fontSize: 18, color: "#666", letterSpacing: 1 },
  backButton: { padding: 5 },
  scrollContent: { paddingHorizontal: 25 },
  checkboxWrapper: { alignItems: "flex-end", marginBottom: 10 },
  checkboxContainer: { flexDirection: "row", alignItems: "center" },
  checkboxLabel: { marginLeft: 8, fontSize: 12, color: "#333" },
  inputLabel: { fontSize: 12, color: "#333", marginBottom: 6, marginLeft: 2 },
  inputBox: {
    backgroundColor: "#F0F0F0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 6,
    marginBottom: 20,
  },
  inputText: { color: "#555", fontSize: 14 },
  fadeContainer: { marginTop: 5 },
  submitBtn: {
    backgroundColor: "#777777",
    paddingVertical: 15,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    marginBottom: 40,
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
});
