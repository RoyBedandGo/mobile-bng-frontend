import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export interface PropertyCardProps {
  id: string;
  propertyName: string;
  ownerName: string;
  date: string;
  onPress?: () => void;
}

export default function PropertyCard({
  propertyName,
  ownerName,
  date,
  onPress,
}: PropertyCardProps) {
  // Clean up the MySQL date to match your mockup (MM-DD-YYYY or similar)
  // If date is missing, we provide a safe fallback
  const formattedDate = date ? new Date(date).toLocaleDateString() : "No Date";

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.topRow}>
        <Text style={styles.title}>{propertyName}</Text>
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.ownerText}>{ownerName}</Text>
        {/* Stray "tex" removed, formattedDate applied */}
        <Text style={styles.dateText}>{formattedDate}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    textTransform: "uppercase",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  ownerText: {
    fontSize: 12,
    color: "#666",
  },
  dateText: {
    fontSize: 12,
    color: "#666",
  },
});
