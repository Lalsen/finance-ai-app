import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";

const BASE_URL = "https://finance-ai-backend-pkjk.onrender.com";

const COLORS = {
  primary: "#4F46E5",
  background: "#F4F6FB",
  card: "#FFFFFF",
  text: "#1A1A2E",
  subtext: "#6B7280",
  green: "#22C55E",
  red: "#EF4444",
};

const RANGE_OPTIONS = [
  { label: "This Week", value: "this_week" },
  { label: "Last Week", value: "last_week" },
  { label: "Month", value: "this_month" },
  { label: "All Time", value: "all" },
];

const CATEGORY_COLORS = [
  "#4F46E5", "#06B6D4", "#F59E0B", "#EF4444",
  "#22C55E", "#EC4899", "#8B5CF6", "#F97316",
];

interface CategoryItem {
  category: string;
  amount: number;
}

interface Summary {
  total_spending: number;
  category_breakdown: CategoryItem[];
}

export default function InsightsScreen({ token }: { token?: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [range, setRange] = useState("this_month");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchSummary = async (selectedRange: string) => {
    try {
      setLoading(true);
      setError("");

      const headers: any = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(
        `${BASE_URL}/spending-summary?range=${selectedRange}`,
        { headers }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setSummary(data);
    } catch (err: any) {
      console.error("InsightsScreen fetch error:", err);
      setError(err.message || "Failed to load insights. Please try again.");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(range);
  }, []);

  const handleRangeChange = (newRange: string) => {
    setRange(newRange);
    fetchSummary(newRange);
  };

  // Safe top-category finder (handles empty array)
  const topCategory =
    summary && summary.category_breakdown && summary.category_breakdown.length > 0
      ? summary.category_breakdown.reduce((max, item) =>
          item.amount > max.amount ? item : max
        )
      : null;

  const total = summary?.total_spending ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Spending Insights</Text>

      {/* Range Selector */}
      <View style={styles.toggleRow}>
        {RANGE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => handleRangeChange(opt.value)}
            style={[styles.toggleBtn, range === opt.value && styles.toggleBtnActive]}
          >
            <Text style={[styles.toggleLabel, range === opt.value && styles.toggleLabelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Loading */}
      {loading && (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 30 }} />
      )}

      {/* Error */}
      {!loading && error !== "" && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity onPress={() => fetchSummary(range)} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {!loading && !error && summary && (
        <>
          {/* Total Spending Card */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total Spending</Text>
            <Text style={styles.totalAmount}>₹ {Number(total).toFixed(2)}</Text>
            <Text style={styles.totalSub}>
              {RANGE_OPTIONS.find((o) => o.value === range)?.label ?? ""}
            </Text>
          </View>

          {/* Top Category */}
          {topCategory && (
            <View style={styles.highlightCard}>
              <Text style={styles.highlightTitle}>🏆 Top Category</Text>
              <Text style={styles.highlightCat}>
                {topCategory.category.charAt(0).toUpperCase() + topCategory.category.slice(1)}
              </Text>
              <Text style={styles.highlightAmt}>₹ {Number(topCategory.amount).toFixed(2)}</Text>
              <Text style={styles.highlightPct}>
                {total > 0 ? ((topCategory.amount / total) * 100).toFixed(1) : "0"}% of total
              </Text>
            </View>
          )}

          {/* Category Breakdown */}
          {summary.category_breakdown.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No spending data for this period.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Category Breakdown</Text>
              {summary.category_breakdown
                .sort((a, b) => b.amount - a.amount)
                .map((item, index) => {
                  const pct = total > 0 ? (item.amount / total) * 100 : 0;
                  const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];

                  return (
                    <View key={index} style={styles.catCard}>
                      <View style={styles.catHeader}>
                        <View style={[styles.catDot, { backgroundColor: color }]} />
                        <Text style={styles.catName}>
                          {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                        </Text>
                        <Text style={styles.catAmt}>
                          ₹ {Number(item.amount).toFixed(2)}
                        </Text>
                      </View>

                      {/* Progress bar */}
                      <View style={styles.barBg}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${pct}%` as any, backgroundColor: color },
                          ]}
                        />
                      </View>

                      <Text style={styles.pctLabel}>{pct.toFixed(1)}%</Text>
                    </View>
                  );
                })}
            </>
          )}
        </>
      )}

      {/* No data */}
      {!loading && !error && !summary && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No data available.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 16,
  },

  toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },

  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
  },

  toggleBtnActive: {
    backgroundColor: COLORS.primary,
  },

  toggleLabel: {
    fontSize: 12,
    color: "#333",
    fontWeight: "600",
  },

  toggleLabelActive: {
    color: "white",
  },

  totalCard: {
    backgroundColor: COLORS.primary,
    padding: 22,
    borderRadius: 16,
    marginBottom: 16,
  },

  totalLabel: {
    color: "#C7D2FE",
    fontSize: 13,
  },

  totalAmount: {
    fontSize: 34,
    fontWeight: "bold",
    color: "white",
    marginTop: 4,
  },

  totalSub: {
    color: "#A5B4FC",
    fontSize: 12,
    marginTop: 4,
  },

  highlightCard: {
    backgroundColor: "#ECFDF5",
    padding: 18,
    borderRadius: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.green,
  },

  highlightTitle: {
    fontSize: 13,
    color: "#065F46",
    fontWeight: "600",
    marginBottom: 4,
  },

  highlightCat: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text,
  },

  highlightAmt: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.primary,
    marginTop: 2,
  },

  highlightPct: {
    fontSize: 12,
    color: COLORS.subtext,
    marginTop: 2,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
  },

  catCard: {
    backgroundColor: COLORS.card,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
  },

  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },

  catName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },

  catAmt: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },

  barBg: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
  },

  barFill: {
    height: 8,
    borderRadius: 4,
  },

  pctLabel: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.subtext,
    textAlign: "right",
  },

  errorBox: {
    backgroundColor: "#FEF2F2",
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    alignItems: "center",
  },

  errorText: {
    color: COLORS.red,
    textAlign: "center",
    marginBottom: 10,
  },

  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },

  retryText: {
    color: "white",
    fontWeight: "700",
  },

  emptyBox: {
    alignItems: "center",
    marginTop: 40,
  },

  emptyText: {
    color: COLORS.subtext,
    fontSize: 15,
  },
});