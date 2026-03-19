import React, { useEffect, useState } from 'react';
import { PermissionsAndroid } from 'react-native';
import axios from 'axios';
import notifee from '@notifee/react-native';

import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import BottomTabs from "./src/navigation/BottomTabs";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";

// 👇 Create Stack
const Stack = createNativeStackNavigator();

interface CategoryItem {
  category: string;
  amount: number;
}

interface Summary {
  total_spending: number;
  category_breakdown: CategoryItem[];
}

interface Transaction {
  id: number;
  amount: number;
  merchant: string;
  category: string;
}

export default function App() {

  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [nudges, setNudges] = useState<string[]>([]);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const BASE_URL = "http://172.20.10.2:5000";

  // 🔥 Request SMS Permission
  const requestSMSPermission = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        {
          title: "SMS Permission",
          message: "App needs access to SMS to detect transactions",
          buttonPositive: "OK"
        }
      );

      console.log(
        granted === PermissionsAndroid.RESULTS.GRANTED
          ? "✅ SMS Permission Granted"
          : "❌ SMS Permission Denied"
      );

    } catch (err) {
      console.warn("Permission Error:", err);
    }
  };

  // 🔔 Notification
  const showNotification = async (message: string) => {
    try {
      await notifee.requestPermission();

      const channelId = await notifee.createChannel({
        id: 'finance',
        name: 'Finance Alerts',
      });

      await notifee.displayNotification({
        title: 'Smart Finance Insight',
        body: message,
        android: {
          channelId,
          smallIcon: 'ic_launcher',
        },
      });

    } catch (err) {
      console.log("Notification Error:", err);
    }
  };

  // 📊 Fetch Data
  const fetchData = async () => {
    try {
      setLoading(true);

      const [summaryRes, transactionRes] = await Promise.all([
        axios.get(`${BASE_URL}/spending-summary`),
        axios.get(`${BASE_URL}/get-transactions`)
      ]);

      setSummary(summaryRes.data || null);
      setTransactions(transactionRes.data || []);

    } catch (error) {
      console.log("❌ FETCH ERROR:", error);
    } finally {
      setLoading(false);
    }
  };

  // 🧠 Nudges
  const fetchNudges = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/weekly-analysis`);
      const weeklyNudges = response.data.nudges || [];

      setNudges(weeklyNudges);

      if (weeklyNudges.length > 0) {
        showNotification(weeklyNudges[0]);
      }

    } catch (error) {
      console.log("❌ NUDGE ERROR:", error);
    }
  };

  // 🔮 Prediction
  const fetchPrediction = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/predict-next-week`);
      setPrediction(response.data.predicted_next_week_spending || null);

    } catch (error) {
      console.log("❌ PREDICTION ERROR:", error);
    }
  };

  // 🚀 Load Data
  useEffect(() => {
    requestSMSPermission();
    fetchData();
    fetchNudges();
    fetchPrediction();

    const interval = setInterval(() => {
      fetchData();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">

        {/* 🔐 LOGIN FIRST */}
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />

        {/* 📝 REGISTER */}
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ headerShown: false }}
        />

        {/* 🏠 MAIN APP */}
        <Stack.Screen name="Home" options={{ headerShown: false }}>
          {() => (
            <BottomTabs
              summary={summary}
              transactions={transactions}
              nudges={nudges}
              prediction={prediction}
              loading={loading}
            />
          )}
        </Stack.Screen>

      </Stack.Navigator>
    </NavigationContainer>
  );
}