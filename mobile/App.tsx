import React, { useEffect, useState } from 'react';
import { PermissionsAndroid, View, ActivityIndicator } from 'react-native';
import axios from 'axios';
import notifee from '@notifee/react-native';
import { NavigationContainer } from '@react-navigation/native';
import BottomTabs from './src/navigation/BottomTabs';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';

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

// ── Auth state ────────────────────────────────────────────────────────────────
interface AuthState {
  token: string;
  userId: number;
  name: string;
}

const BASE_URL = 'https://finance-ai-backend-pkjk.onrender.com';

export default function App() {
  // Auth
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');

  // Data
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [nudges, setNudges] = useState<string[]>([]);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

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

  // Helper: axios headers with token
  const authHeaders = (token: string) => ({
    headers: { Authorization: `Bearer ${token}` },
  });

  // 📊 Fetch Data
  const fetchData = async (token: string) => {
    try {
      setLoading(true);

      const [summaryRes, transactionRes] = await Promise.all([
        axios.get(`${BASE_URL}/spending-summary`, authHeaders(token)),
        axios.get(`${BASE_URL}/get-transactions`, authHeaders(token)),
      ]);

      setSummary(summaryRes.data || null);
      setTransactions(transactionRes.data || []);
    } catch (error) {
      console.log('❌ FETCH ERROR:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🧠 Nudges
  const fetchNudges = async (token: string) => {
    try {
      const response = await axios.get(
        `${BASE_URL}/weekly-analysis`,
        authHeaders(token)
      );
      const weeklyNudges = response.data.nudges || [];
      setNudges(weeklyNudges);

      if (weeklyNudges.length > 0) {
        showNotification(weeklyNudges[0]);
      }
    } catch (error) {
      console.log('❌ NUDGE ERROR:', error);
    }
  };

  // 🔮 Prediction
  const fetchPrediction = async (token: string) => {
    try {
      const response = await axios.get(
        `${BASE_URL}/predict-next-week`,
        authHeaders(token)
      );
      setPrediction(response.data.prediction || null);
    } catch (error) {
      console.log('❌ PREDICTION ERROR:', error);
    }
  };

  // Called after successful login or register
  const handleAuthSuccess = (token: string, userId: number, name: string) => {
    setAuth({ token, userId, name });
    requestSMSPermission();
    fetchData(token);
    fetchNudges(token);
    fetchPrediction(token);
  };

  // Logout
  const handleLogout = () => {
    setAuth(null);
    setSummary(null);
    setTransactions([]);
    setNudges([]);
    setPrediction(null);
    setAuthScreen('login');
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Not logged in → show auth screens
  // ────────────────────────────────────────────────────────────────────────────
  if (!auth) {
    if (authScreen === 'login') {
      return (
        <LoginScreen
          onLoginSuccess={handleAuthSuccess}
          onGoRegister={() => setAuthScreen('register')}
        />
      );
    }
    return (
      <RegisterScreen
        onRegisterSuccess={handleAuthSuccess}
        onGoLogin={() => setAuthScreen('login')}
      />
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Logged in → main app
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <NavigationContainer>
      <BottomTabs
        summary={summary}
        transactions={transactions}
        nudges={nudges}
        prediction={prediction}
        loading={loading}
        token={auth.token}
        userId={auth.userId}
        userName={auth.name}
        onLogout={handleLogout}
      />
    </NavigationContainer>
  );
}