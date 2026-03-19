import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

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

  const getPercentage = (amount: number) => {
    if (!summary) return 0;
    return (amount / summary.total_spending) * 100;
  };

  const getTopCategory = () => {
    if (!summary) return null;
    return summary.category_breakdown.reduce((max, item) =>
      item.amount > max.amount ? item : max
    );
  };

  const topCategory = getTopCategory();

  return (
    <ScrollView style={styles.container}>

      <Text style={styles.title}>Spending Insights</Text>

      {/* Total Spending Card */}
      {summary && (
        <View style={styles.totalCard}>
          <Text style={styles.label}>Total Spending</Text>
          <Text style={styles.totalAmount}>
            ₹ {summary.total_spending}
          </Text>
        </View>
      )}

      {/* Top Category Highlight */}
      {topCategory && (
        <View style={styles.highlightCard}>
          <Text style={styles.cardTitle}>Top Category</Text>
          <Text style={styles.highlightText}>
            {topCategory.category} - ₹ {topCategory.amount}
          </Text>
        </View>
      )}

      {/* Category Breakdown */}
      {summary?.category_breakdown.map((item, index) => {

        const percentage = getPercentage(item.amount);

        return (
          <View key={index} style={styles.card}>

            <View style={styles.row}>
              <Text style={styles.category}>
                {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
              </Text>

              <Text style={styles.amount}>
                ₹ {item.amount}
              </Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${percentage}%` }
                ]}
              />
            </View>

            <Text style={styles.percentText}>
              {percentage.toFixed(1)}%
            </Text>

          </View>
        );
      })}

    </ScrollView>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#F4F6FB",
    padding: 20
  },

  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 20
  },

  totalCard: {
    backgroundColor: "#4F46E5",
    padding: 20,
    borderRadius: 14,
    marginBottom: 15
  },

  label: {
    color: "#E0E7FF"
  },

  totalAmount: {
    fontSize: 28,
    color: "white",
    fontWeight: "bold",
    marginTop: 5
  },

  highlightCard: {
    backgroundColor: "#ECFDF5",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15
  },

  // ✅ FIX ADDED HERE
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#065F46"
  },

  highlightText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 5
  },

  card: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 3
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between"
  },

  category: {
    fontSize: 16,
    fontWeight: "600"
  },

  amount: {
    fontWeight: "bold"
  },

  progressBg: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 5,
    marginTop: 8
  },

  progressFill: {
    height: 8,
    backgroundColor: "#4F46E5",
    borderRadius: 5
  },

  percentText: {
    marginTop: 5,
    color: "gray",
    fontSize: 12
  }

});