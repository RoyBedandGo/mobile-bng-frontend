import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../lib/api"; // Make sure this path is correct!

const REPORT_CATEGORIES = [
  { name: "Turnover Report", requiresContract: false },
  { name: "Unit Report", requiresContract: false },
  { name: "Move-In Report", requiresContract: true },
  { name: "Move-Out Report", requiresContract: true },
  { name: "Annex-A", requiresContract: false },
];

export default function ViewAllReportsScreen() {
  const { property_id } = useLocalSearchParams();
  const [isChecking, setIsChecking] = useState(false); // To prevent spam-clicking

  // 1. The actual navigation function (only called if the report exists!)
  const navigateToReport = (reportName: string, hasContract: boolean) => {
    router.push(
      `/(tabs)/property/view-report?property_id=${property_id}&report_type=${encodeURIComponent(
        reportName,
      )}&requires_contract=${hasContract}`,
    );
  };

  // 2. NEW FUNCTION: Check database before navigating
  const checkReportExistsAndNavigate = async (
    reportName: string,
    hasContract: boolean,
  ) => {
    try {
      setIsChecking(true);
      // Clean the name (e.g., "Turnover Report" -> "Turnover") to match DB ENUM
      const cleanReportType = reportName.replace(" Report", "");

      await api.get(`/pm/reports/latest-id`, {
        params: {
          property_id: property_id,
          report_type: cleanReportType,
        },
      });

      // If the API doesn't throw a 404 error, the report exists! We can navigate.
      navigateToReport(reportName, hasContract);
    } catch (error: any) {
      // If it's a 404, it means no report was found in the database
      if (error.response?.status === 404) {
        Alert.alert(
          "No Report Found",
          `There is no ${reportName} recorded yet. Please create one first.`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Create Report",
              // Conveniently route them straight to the creation screen!
              onPress: () =>
                router.push(
                  `/(tabs)/property/create-report?property_id=${property_id}`,
                ),
            },
          ],
        );
      } else {
        Alert.alert(
          "Error",
          "Could not check report status. Please try again.",
        );
      }
    } finally {
      setIsChecking(false);
    }
  };

  // 3. Handle the initial click
  const handleReportClick = (report: any) => {
    if (isChecking) return; // Prevent double-clicks

    // Check existence and navigate immediately for ALL reports
    checkReportExistsAndNavigate(report.name, report.requiresContract);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Show a full-screen loading overlay if checking the database */}
      {isChecking && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#8BC34A" />
        </View>
      )}

      <View style={styles.topNav}>
        <TouchableOpacity
          onPress={() => router.push(`/(tabs)/property/${property_id}`)}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>
      </View>

      <View style={styles.titleContainer}>
        <Text style={styles.titleText}>ALL REPORTS</Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.createReportBtn}
          onPress={() =>
            router.push(
              `/(tabs)/property/create-report?property_id=${property_id}`,
            )
          }
        >
          <Text style={styles.createReportBtnText}>CREATE REPORT</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {REPORT_CATEGORIES.map((report, index) => (
          <TouchableOpacity
            key={index}
            style={styles.reportCard}
            activeOpacity={0.8}
            onPress={() => handleReportClick(report)}
          >
            <Text style={styles.reportCardText}>{report.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  topNav: {
    paddingHorizontal: 15,
    paddingTop: 10,
    alignItems: "flex-start",
  },
  backButton: {
    padding: 5,
  },
  titleContainer: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  titleText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#666666",
    letterSpacing: 0.5,
  },
  actionRow: {
    alignItems: "flex-end",
    paddingHorizontal: 25,
    marginBottom: 20,
  },
  createReportBtn: {
    borderWidth: 1.5,
    borderColor: "#8BC34A",
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  createReportBtnText: {
    color: "#8BC34A",
    fontSize: 12,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingBottom: 50,
  },
  reportCard: {
    backgroundColor: "#64B5F6",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 6,
    marginBottom: 15,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  reportCardText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
});
