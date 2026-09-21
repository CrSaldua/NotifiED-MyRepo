import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import DashboardScreen from './DashboardScreen';
import EventsScreen from './EventsScreen';
import ProfileScreen from './ProfileScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#1E293B', borderTopColor: '#374151' },
        tabBarActiveTintColor: '#FFC107',
        tabBarInactiveTintColor: '#6B7280',
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }}
      />
      <Tab.Screen
        name="Events"
        component={EventsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} /> }}
      />
      <Tab.Screen
         name="Profile"
         component={ProfileScreen}
         options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }}
       />
    </Tab.Navigator>
  );
}