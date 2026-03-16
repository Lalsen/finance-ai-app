import React from "react";
import { View, Text, ScrollView } from "react-native";

interface Transaction {
  id: number;
  amount: number;
  merchant: string;
  category: string;
}

interface Props {
  transactions: Transaction[];
}

export default function TransactionsScreen({ transactions }: Props) {

  return (
    <ScrollView style={{ padding: 20 }}>

      <Text style={{ fontSize: 24, fontWeight: "bold" }}>
        Transactions
      </Text>

      {transactions.map((txn) => (
        <View
          key={txn.id}
          style={{
            marginTop: 15,
            padding: 15,
            backgroundColor: "#f2f2f2",
            borderRadius: 10
          }}
        >
          <Text style={{ fontSize: 16 }}>
            {txn.merchant}
          </Text>

          <Text style={{ marginTop: 5 }}>
            ₹ {txn.amount}
          </Text>

          <Text style={{ color: "gray" }}>
            {txn.category}
          </Text>

        </View>
      ))}

    </ScrollView>
  );
}