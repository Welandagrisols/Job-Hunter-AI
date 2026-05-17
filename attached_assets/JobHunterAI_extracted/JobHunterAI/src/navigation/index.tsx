import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

import DashboardScreen from "../screens/DashboardScreen";
import ApplicationsScreen from "../screens/ApplicationsScreen";
import AddApplicationScreen from "../screens/AddApplicationScreen";
import AIWriterScreen from "../screens/AIWriterScreen";
import AlertsScreen from "../screens/AlertsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import StatisticsScreen from "../screens/StatisticsScreen";
import KanbanScreen from "../screens/KanbanScreen";
import CVVaultScreen from "../screens/CVVaultScreen";
import JobCaptureScreen from "../screens/JobCaptureScreen";
import JobFeedScreen from "../screens/JobFeedScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="AddApplication" component={AddApplicationScreen} />
      <Stack.Screen name="ApplicationDetail" component={AddApplicationScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Alerts" component={AlertsScreen} />
      <Stack.Screen name="Statistics" component={StatisticsScreen} />
    </Stack.Navigator>
  );
}

function TrackStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ApplicationsList" component={ApplicationsScreen} />
      <Stack.Screen name="KanbanBoard" component={KanbanScreen} />
      <Stack.Screen name="AddApplication" component={AddApplicationScreen} />
      <Stack.Screen name="ApplicationDetail" component={AddApplicationScreen} />
    </Stack.Navigator>
  );
}

function FeedStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="JobFeed" component={JobFeedScreen} />
    </Stack.Navigator>
  );
}

function CaptureStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="JobCapture" component={JobCaptureScreen} />
    </Stack.Navigator>
  );
}

function AIStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AIWriter" component={AIWriterScreen} />
      <Stack.Screen name="CVVault" component={CVVaultScreen} />
    </Stack.Navigator>
  );
}

export default function Navigation() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.colors.bg.secondary,
            borderTopColor: theme.colors.bg.border,
            borderTopWidth: 1,
            height: 80,
            paddingBottom: 20,
          },
          tabBarActiveTintColor: theme.colors.accent.cyan,
          tabBarInactiveTintColor: theme.colors.text.muted,
          tabBarLabelStyle: {
            fontSize: theme.font.sizes.xs,
            fontWeight: theme.font.weights.medium,
          },
          tabBarIcon: ({ focused, color, size }) => {
            const icons: Record<string, [string, string]> = {
              Home: ["home", "home-outline"],
              Feed: ["newspaper", "newspaper-outline"],
              Track: ["briefcase", "briefcase-outline"],
              Capture: ["scan-circle", "scan-circle-outline"],
              "AI Writer": ["sparkles", "sparkles-outline"],
            };
            const [active, inactive] = icons[route.name] || ["ellipse", "ellipse-outline"];
            return <Ionicons name={(focused ? active : inactive) as any} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeStack} />
        <Tab.Screen name="Feed" component={FeedStack} />
        <Tab.Screen name="Capture" component={CaptureStack} />
        <Tab.Screen name="Track" component={TrackStack} />
        <Tab.Screen name="AI Writer" component={AIStack} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
