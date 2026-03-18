import React, { useEffect, useState } from 'react';
import { PermissionsAndroid } from 'react-native';
import axios from 'axios';
import notifee from '@notifee/react-native';
import { NavigationContainer } from "@react-navigation/native";
import BottomTabs from "./src/navigation/BottomTabs";

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

  const BASE_URL = "http://192.168.1.34:5000";

  // 🔐 SMS Permission
  const requestSMSPermission = async () => {
    try {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
      );
    } catch (err) {
      console.warn(err);
    }
  };

  // 🔔 Notification
  const showNotification = async (message: string) => {
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

  useEffect(() => {
    requestSMSPermission();
    fetchData();
    fetchNudges();
    fetchPrediction();
  }, []);

  return (
    <NavigationContainer>
      <BottomTabs
        summary={summary}
        transactions={transactions}
        nudges={nudges}
        prediction={prediction}
        loading={loading}
      />
    </NavigationContainer>
  );
}