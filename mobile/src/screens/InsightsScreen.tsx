import React from "react";
import { View, Text, ScrollView } from "react-native";

interface CategoryItem {
  category: string;
  amount: number;
}

interface Summary {
  total_spending: number;
  category_breakdown: CategoryItem[];
}

interface Props {
  summary: Summary | null;
}

export default function InsightsScreen({ summary }: Props) {

  return (
    <ScrollView style={{ padding: 20 }}>

      <Text style={{ fontSize: 24, fontWeight: "bold" }}>
        Spending Insights
      </Text>

      {summary?.category_breakdown.map((item, index) => (
        <View
          key={index}
          style={{
            marginTop: 15,
            padding: 15,
            backgroundColor: "#eef6ff",
            borderRadius: 10
          }}
        >
          <Text>
            {item.category}
          </Text>

          <Text>
            ₹ {item.amount}
          </Text>

        </View>
      ))}

    </ScrollView>
  );
}