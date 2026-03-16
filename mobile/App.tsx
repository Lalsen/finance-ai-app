import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  PermissionsAndroid,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import axios from 'axios';
import notifee from '@notifee/react-native';
import ChatComponent from './ChatComponent';

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

type Tab = 'dashboard' | 'chat';

export default function App() {

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [nudges, setNudges] = useState<string[]>([]);
  const [prediction, setPrediction] = useState<number | null>(null);

  const BASE_URL = "http://192.168.11.128:5000";

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
    <SafeAreaView style={appStyles.safeArea}>

      {/* Tab Bar */}
      <View style={appStyles.tabBar}>
        <TouchableOpacity
          style={[appStyles.tabButton, activeTab === 'dashboard' && appStyles.tabButtonActive]}
          onPress={() => setActiveTab('dashboard')}>
          <Text style={[appStyles.tabText, activeTab === 'dashboard' && appStyles.tabTextActive]}>
            📊 Dashboard
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[appStyles.tabButton, activeTab === 'chat' && appStyles.tabButtonActive]}
          onPress={() => setActiveTab('chat')}>
          <Text style={[appStyles.tabText, activeTab === 'chat' && appStyles.tabTextActive]}>
            🤖 AI Chat
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <ScrollView style={{ padding: 20 }}>

          <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
            Finance Dashboard
          </Text>

          {/* Weekly Nudges Section */}
          {nudges.length > 0 && (
            <View style={{ marginTop: 20, padding: 12, backgroundColor: '#fff3cd', borderRadius: 10 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
                Weekly Insights
              </Text>
              {nudges.map((nudge, index) => (
                <Text key={index} style={{ marginTop: 6 }}>
                  {nudge}
                </Text>
              ))}
            </View>
          )}

          {/* ML Prediction Section */}
          {prediction !== null && (
            <View style={{ marginTop: 20, padding: 15, backgroundColor: '#eef6ff', borderRadius: 10 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
                🔮 Predicted Next Week Spending
              </Text>
              <Text style={{ fontSize: 22, marginTop: 8 }}>
                ₹ {prediction.toFixed(2)}
              </Text>
            </View>
          )}

          {/* Summary Section */}
          {summary && (
            <>
              <Text style={{ fontSize: 18, marginTop: 20 }}>
                Total Spending: ₹ {summary.total_spending}
              </Text>
              <Text style={{ fontSize: 18, marginTop: 20 }}>
                Category Breakdown:
              </Text>
              {summary.category_breakdown.map((item, index) => (
                <Text key={index}>
                  {item.category}: ₹ {item.amount}
                </Text>
              ))}
            </>
          )}

          {/* Transactions */}
          <Text style={{ fontSize: 20, marginTop: 30 }}>
            Transactions
          </Text>
          {transactions.map((txn) => (
            <View key={txn.id} style={{ marginTop: 10 }}>
              <Text>
                {txn.merchant} - ₹ {txn.amount}
              </Text>
              <Text style={{ color: 'gray' }}>
                {txn.category}
              </Text>
            </View>
          ))}

        </ScrollView>
      )}

      {/* AI Chat Tab */}
      {activeTab === 'chat' && (
        <View style={{ flex: 1 }}>
          <ChatComponent />
        </View>
      )}

    </SafeAreaView>
  );
}

const appStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0FF',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#6C63FF',
  },
  tabText: {
    fontSize: 15,
    color: '#999',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#6C63FF',
    fontWeight: '700',
  },
});
