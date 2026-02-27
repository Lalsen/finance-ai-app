import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, PermissionsAndroid } from 'react-native';
import axios from 'axios';

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

  useEffect(() => {
    requestSMSPermission();
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const summaryRes = await axios.get('http://192.168.18.245:5000/spending-summary');
      const transactionRes = await axios.get('http://192.168.18.245:5000/get-transactions');

      setSummary(summaryRes.data);
      setTransactions(transactionRes.data);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <ScrollView style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
        Finance Dashboard
      </Text>

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
  );
}
