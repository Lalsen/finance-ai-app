import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { COLORS } from "../styles/colors";

export default function HomeScreen({
  transactions,
  nudges,
  prediction,
  predictionWeek,
}: any) {

  const [summary, setSummary] = useState<any>(null);
  const [selectedRange, setSelectedRange] = useState("last_week");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ============================
  // Fetch Data
  // ============================
  const fetchData = async (range: string) => {
    try {
      setSelectedRange(range);
      setLoading(true);
      setError("");

      const response = await fetch(
        `https://finance-ai-backend-pkjk.onrender.com/spending-summary?range=${range}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }

      const data = await response.json();
      setSummary(data);

    } catch (err: any) {
      console.error(err);
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Default load
  useEffect(() => {
    fetchData("last_week");
  }, []);

  return (
    <ScrollView style={styles.container}>

      <Text style={styles.title}>Finance Dashboard</Text>

      {/* ============================
          🔥 TIME FILTER TOGGLE
      ============================ */}
      <View style={styles.toggleContainer}>

        {["this_week", "last_week", "this_month", "all"].map((item) => {

          const labelMap: any = {
            this_week: "This Week",
            last_week: "Last Week",
            this_month: "Month",
            all: "All",
          };

          const isActive = selectedRange === item;

          return (
            <TouchableOpacity
              key={item}
              onPress={() => fetchData(item)}
              style={[
                styles.toggleButton,
                isActive && styles.activeButton
              ]}
            >
              <Text
                style={[
                  styles.toggleText,
                  isActive && styles.activeText
                ]}
              >
                {labelMap[item]}
              </Text>
            </TouchableOpacity>
          );
        })}

      </View>

      {/* ============================
          🔄 LOADING
      ============================ */}
      {loading && (
        <ActivityIndicator size="large" color={COLORS.primary} />
      )}

      {/* ============================
          ❌ ERROR
      ============================ */}
      {error !== "" && (
        <Text style={{ color: "red", marginBottom: 10 }}>
          {error}
        </Text>
      )}

      {/* ============================
          TOTAL SPENDING
      ============================ */}
      {summary && !loading && (
        <View style={styles.primaryCard}>
          <Text style={styles.cardLabel}>Total Spending</Text>
          <Text style={styles.bigAmount}>
            ₹ {summary.total_spending}
          </Text>
        </View>
      )}

      {/* ============================
          PREDICTION
      ============================ */}
      {prediction !== null && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            AI Spending Prediction
          </Text>

          {predictionWeek && (
            <Text style={styles.weekDate}>
              Week starting: {predictionWeek}
            </Text>
          )}

          <Text style={styles.amount}>
            ₹ {prediction.toFixed(2)}
          </Text>
        </View>
      )}

      {/* ============================
          WEEKLY INSIGHTS
      ============================ */}
      {nudges.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly Insights</Text>

          {nudges.map((nudge: string, index: number) => (
            <Text key={index} style={styles.nudge}>
              ✔ {nudge}
            </Text>
          ))}
        </View>
      )}

      {/* ============================
          CATEGORY SPENDING
      ============================ */}
      {summary && !loading && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Spending by Category
          </Text>

          {summary.category_breakdown.length === 0 ? (
            <Text style={{ marginTop: 10, color: COLORS.subtext }}>
              No data available for this period
            </Text>
          ) : (
            summary.category_breakdown.map((item: any, index: number) => {

              const percentage =
                summary.total_spending > 0
                  ? (item.amount / summary.total_spending) * 100
                  : 0;

              return (
                <View key={index} style={{ marginTop: 12 }}>

                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text>
                      {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                    </Text>

                    <Text>
                      ₹ {item.amount}
                    </Text>
                  </View>

                  <View style={styles.progressBackground}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${percentage}%` }
                      ]}
                    />
                  </View>

                </View>
              );
            })
          )}
        </View>
      )}

      {/* ============================
          RECENT TRANSACTIONS
      ============================ */}
      <Text style={styles.sectionTitle}>
        Recent Transactions
      </Text>

      {transactions.slice(0, 3).map((txn: any) => (
        <View key={txn.id} style={styles.transactionCard}>

          <Text style={styles.merchant}>
            {txn.merchant}
          </Text>

          <Text style={styles.amount}>
            ₹ {txn.amount}
          </Text>

          <Text style={styles.category}>
            {txn.category}
          </Text>

        </View>
      ))}

    </ScrollView>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20
  },

  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 20
  },

  toggleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15
  },

  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#E5E7EB"
  },

  activeButton: {
    backgroundColor: COLORS.primary
  },

  toggleText: {
    fontSize: 12,
    color: "#333"
  },

  activeText: {
    color: "white",
    fontWeight: "bold"
  },

  primaryCard: {
    backgroundColor: COLORS.primary,
    padding: 20,
    borderRadius: 14,
    marginBottom: 15
  },

  card: {
    backgroundColor: COLORS.card,
    padding: 18,
    borderRadius: 14,
    marginBottom: 15,
    elevation: 3
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text
  },

  weekDate: {
    fontSize: 14,
    color: COLORS.subtext,
    marginTop: 4
  },

  cardLabel: {
    fontSize: 14,
    color: "#E0E7FF"
  },

  bigAmount: {
    fontSize: 30,
    fontWeight: "bold",
    color: "white",
    marginTop: 6
  },

  amount: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 5
  },

  nudge: {
    marginTop: 6,
    color: COLORS.subtext
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10
  },

  transactionCard: {
    backgroundColor: COLORS.card,
    padding: 15,
    borderRadius: 12,
    marginBottom: 10
  },

  merchant: {
    fontSize: 16,
    fontWeight: "600"
  },

  category: {
    color: COLORS.subtext,
    marginTop: 3
  },

  progressBackground: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 5,
    marginTop: 5
  },

  progressFill: {
    height: 8,
    backgroundColor: "#4F46E5",
    borderRadius: 5
  },

});