import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '../../../theme/colors';

export default function HealthcareLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          height: 70,
          paddingBottom: 10,
          paddingTop: 10,
          backgroundColor: colors.backgroundAlt,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="medicines/index"
        options={{
          title: 'Medicines',
          tabBarIcon: ({ color, size }) => <Ionicons name="medkit-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="medicines/today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="schedules/index"
        options={{
          title: 'Schedules',
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="records/index"
        options={{
          title: 'Records',
          tabBarIcon: ({ color, size }) => <Ionicons name="folder-open-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="medicines/add" options={{ href: null }} />
      <Tabs.Screen name="inventory/index" options={{ href: null }} />
      <Tabs.Screen name="missed-dose/index" options={{ href: null }} />
      <Tabs.Screen name="reminders/index" options={{ href: null }} />
    </Tabs>
  );
}

