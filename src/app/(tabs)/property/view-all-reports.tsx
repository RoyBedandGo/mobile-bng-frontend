import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
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
import { useAuth } from "../../../hooks/useAuth";
import { api } from "../../../lib/api";

const REPORT_CATEGORIES = [
  { name: "Turnover Report", requiresContract: false },
  { name: "Unit Report", requiresContract: false },
  { name: "Move-In Report", requiresContract: true },
  { name: "Move-Out Report", requiresContract: true },
  { name: "Annex-A", requiresContract: false },
];

export default function ViewAllReportsScreen() {
  const { property_id } = useLocalSearchParams();
  const { user } = useAuth();

  const [isChecking, setIsChecking] = useState(false);

  const userDepartment = String(
    user?.department || user?.department_name || "",
  ).trim();

  const visibleReportCategories = useMemo(() => {
    if (
      userDepartment === "Property Management" ||
      userDepartment === "Administration"
    ) {
      return REPORT_CATEGORIES;
    }

    if (userDepartment === "Leasing") {
      return REPORT_CATEGORIES.filter(
        (report) => report.name !== "Turnover Report",
      );
    }

    // Default fallback if department is missing:
    // hide Turnover Report to avoid unauthorized access.
    return REPORT_CATEGORIES.filter(
      (report) => report.name !== "Turnover Report",
    );
  }, [userDepartment]);

  const navigateToReport = (reportName: string, hasContract: boolean) => {
    router.push(
      `/(tabs)/property/view-report?property_id=${property_id}&report_type=${encodeURIComponent(
        reportName,
      )}&requires_contract=${hasContract}`,
    );
  };

  const checkReportExistsAndNavigate = async (
    reportName: string,
    hasContract: boolean,
  ) => {
    try {
      setIsChecking(true);

      const cleanReportType = reportName.replace(" Report", "");

      await api.get(`/pm/reports/latest-id`, {
        params: {
          property_id,
          report_type: cleanReportType,
        },
      });

      navigateToReport(reportName, hasContract);
    } catch (error: any) {
      if (error.response?.status === 404) {
        Alert.alert(
          "No Report Found",
          `There is no ${reportName} recorded yet. Please create one first.`,
          [
            {
              text: "Cancel",
              style: "cancel",
            },
            {
              text: "Create Report",
              onPress: () =>
                router.push(
                  `/(tabs)/property/create-report?property_id=${property_id}`,
                ),
            },
          ],
        );
      } else {
        console.error("Report check error:", error);
        Alert.alert(
          "Error",
          "Could not check report status. Please try again.",
        );
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleReportClick = (report: {
    name: string;
    requiresContract: boolean;
  }) => {
    if (isChecking) return;

    checkReportExistsAndNavigate(report.name, report.requiresContract);
  };

  return (
    <SafeAreaView style={styles.container}>
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

        {userDepartment ? (
          <Text style={styles.departmentText}>{userDepartment}</Text>
        ) : null}
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
        {visibleReportCategories.map((report, index) => (
          <TouchableOpacity
            key={`${report.name}-${index}`}
            style={styles.reportCard}
            activeOpacity={0.8}
            onPress={() => handleReportClick(report)}
          >
            <Text style={styles.reportCardText}>{report.name}</Text>
          </TouchableOpacity>
        ))}

        {visibleReportCategories.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No report categories available for your department.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

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

  departmentText: {
    marginTop: 5,
    fontSize: 12,
    color: "#888888",
    fontWeight: "500",
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

  emptyState: {
    paddingVertical: 30,
    alignItems: "center",
  },

  emptyStateText: {
    fontSize: 14,
    color: "#777777",
    textAlign: "center",
  },
});
