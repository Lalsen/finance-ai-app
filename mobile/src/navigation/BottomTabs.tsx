import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import HomeScreen from '../screens/HomeScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import InsightsScreen from '../screens/InsightsScreen';
import ChatbotScreen from '../screens/ChatbotScreen';

const Tab = createBottomTabNavigator();

const TEAL = '#00C9A7';
const NAVY = '#0A1628';
const CARD = '#111D30';
const BORDER = '#1E2D45';

export default function BottomTabs(props: any) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: CARD,
          borderTopColor: BORDER,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: TEAL,
        tabBarInactiveTintColor: '#8A99B3',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>🏠</Text>
          ),
        }}
      >
        {() => (
          <HomeScreen
            {...props}
            token={props.token}
            onLogout={props.onLogout}
            userName={props.userName}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Transactions"
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>💳</Text>
          ),
        }}
      >
        {() => (
          <TransactionsScreen
            transactions={props.transactions}
            token={props.token}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Insights"
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📊</Text>
          ),
        }}
      >
        {() => <InsightsScreen summary={props.summary} />}
      </Tab.Screen>

      <Tab.Screen
        name="Chat"
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>🤖</Text>
          ),
        }}
      >
        {() => (
          <ChatbotScreen
            userId={String(props.userId)}
            apiBaseUrl="https://finance-ai-backend-pkjk.onrender.com"
            token={props.token}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}