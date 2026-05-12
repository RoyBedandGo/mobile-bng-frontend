// src/app/(tabs)/_layout.tsx
import { Ionicons } from "@expo/vector-icons"; // Expo's built-in icon library
import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "blue" }}>
      <Tabs.Screen
        name="properties"
        options={{
          title: "Properties",
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="property/[id]" // Matches your folder and filename
        options={{
          href: null, // <--- This perfectly hides the icon from the bottom bar
          headerShown: false, // <--- This perfectly hides the ugly text header at the top
        }}
      />
      <Tabs.Screen
        name="property/create-report" // Matches your folder and filename
        options={{
          href: null, // <--- This perfectly hides the icon from the bottom bar
          headerShown: false, // <--- This perfectly hides the ugly text header at the top
        }}
      />
      <Tabs.Screen
        name="property/create-items" // Matches your folder and filename
        options={{
          href: null, // <--- This perfectly hides the icon from the bottom bar
          headerShown: false, // <--- This perfectly hides the ugly text header at the top
        }}
      />

      <Tabs.Screen
        name="property/view-all-reports" // Matches your folder and filename
        options={{
          href: null, // <--- This perfectly hides the icon from the bottom bar
          headerShown: false, // <--- This perfectly hides the ugly text header at the top
        }}
      />

      <Tabs.Screen
        name="property/view-report" // Matches your folder and filename
        options={{
          href: null, // <--- This perfectly hides the icon from the bottom bar
          headerShown: false, // <--- This perfectly hides the ugly text header at the top
        }}
      />

      <Tabs.Screen
        name="property/area-items" // Matches your folder and filename
        options={{
          href: null, // <--- This perfectly hides the icon from the bottom bar
          headerShown: false, // <--- This perfectly hides the ugly text header at the top
        }}
      />

      <Tabs.Screen
        name="property/item-details" // Matches your folder and filename
        options={{
          href: null,
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="property/recovery-report" // Matches your folder and filename
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
