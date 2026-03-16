import React, { useEffect, useState } from 'react';
import { PermissionsAndroid } from 'react-native';
import axios from 'axios';
import notifee from '@notifee/react-native';
import { NavigationContainer } from "@react-navigation/native";
import BottomTabs from "./src/navigation/BottomTabs";
import HomeScreen from './src/screens/HomeScreen';

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

  const BASE_URL = "http://192.168.11.52:5000";


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

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log("SMS Permission Granted");
      } else {
        console.log("SMS Permission Denied");
      }

    } catch (err) {
      console.warn(err);
    }
  };


  // 🔔 Show Local Notification
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


  // 📊 Fetch Summary + Transactions
  const fetchData = async () => {
    try {

      const summaryRes = await axios.get(`${BASE_URL}/spending-summary`);
      const transactionRes = await axios.get(`${BASE_URL}/get-transactions`);

      setSummary(summaryRes.data);
      setTransactions(transactionRes.data);

    } catch (error) {
      console.log(error);
    }
  };


  // 🧠 Fetch Weekly Nudges
  const fetchNudges = async () => {
    try {

      const response = await axios.get(`${BASE_URL}/weekly-analysis`);
      const weeklyNudges = response.data.nudges;

      setNudges(weeklyNudges);

      if (weeklyNudges.length > 0) {
        showNotification(weeklyNudges[0]);
      }

    } catch (error) {
      console.log(error);
    }
  };


  // 🔮 Fetch ML Prediction
  const fetchPrediction = async () => {
    try {

      const response = await axios.get(`${BASE_URL}/predict-next-week`);
      setPrediction(response.data.predicted_next_week_spending);

    } catch (error) {
      console.log(error);
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
    />
  </NavigationContainer>
);

}