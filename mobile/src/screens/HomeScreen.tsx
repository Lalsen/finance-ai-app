import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { COLORS } from "../styles/colors";

export default function HomeScreen({
  transactions,
  prediction,
  predictionWeek,
  token,
  nudges,
  userName,
  onLogout,
}: any) {

  const [summary, setSummary] = useState<any>(null);
  const [selectedRange, setSelectedRange] = useState("last_week");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [weeklyData, setWeeklyData] = useState<any>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [txnStatus, setTxnStatus] = useState("");

  // ============================
  // Fetch Data
  // ============================
  const fetchData = async (range: string) => {
    try {
      setSelectedRange(range);
      setLoading(true);
      setError("");

      const response = await fetch(
        `https://finance-ai-backend-pkjk.onrender.com/spending-summary?range=${range}`,
        { headers: { Authorization: `Bearer ${token}` } }
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

  // Fetch weekly analysis
  const fetchWeeklyData = async () => {
    try {
      setWeeklyLoading(true);
      const response = await fetch(
        `https://finance-ai-backend-pkjk.onrender.com/weekly-analysis`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setWeeklyData(data);
      }
    } catch (err) {
      console.error("Weekly analysis error:", err);
    } finally {
      setWeeklyLoading(false);
    }
  };

  // Fetch recent transactions independently
  const fetchRecentTxns = async () => {
    try {
      const res = await fetch(
        `https://finance-ai-backend-pkjk.onrender.com/get-transactions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setRecentTxns(list);
        setTxnStatus(`${list.length} transaction${list.length !== 1 ? 's' : ''} loaded`);
      } else {
        setTxnStatus(`Error ${res.status} loading transactions`);
      }
    } catch (err: any) {
      setTxnStatus(`Network error: ${err.message}`);
    }
  };

  // Pull-to-refresh — re-fetches everything
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchData(selectedRange), fetchWeeklyData(), fetchRecentTxns()]);
    setRefreshing(false);
  }, [selectedRange]);

  // Default load
  useEffect(() => {
    fetchData("last_week");
    fetchWeeklyData();
    fetchRecentTxns();
  }, []);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={["#4F46E5"]}
          tintColor="#4F46E5"
        />
      }
    >

      {/* Header Row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.greeting}>Hello, {userName || 'there'} 👋</Text>
          <Text style={styles.title}>Finance Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

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
            ₹ {Number(summary.total_spending).toFixed(2)}
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
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly Insights</Text>

        {weeklyLoading && (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 10 }} />
        )}

        {!weeklyLoading && weeklyData && (() => {
          const { current_week, last_week, current_total, last_total, nudges: weekNudges } = weeklyData;
          const allCategories = Array.from(
            new Set([...Object.keys(current_week || {}), ...Object.keys(last_week || {})])
          );

          const hasAnyData = (current_total || 0) > 0 || (last_total || 0) > 0;

          if (!hasAnyData && allCategories.length === 0) {
            return (
              <Text style={{ color: COLORS.subtext, marginTop: 10 }}>
                No weekly data yet. Add transactions to see insights.
              </Text>
            );
          }

          // Overall week-over-week % change
          const overallPct = last_total > 0
            ? ((current_total - last_total) / last_total) * 100
            : null;
          const overallUp = overallPct !== null && overallPct > 0;
          const overallDown = overallPct !== null && overallPct < 0;

          return (
            <View>
              {/* Nudge messages — prominently styled as alert cards */}
              {weekNudges && weekNudges.length > 0 ? (
                <View style={{ marginTop: 12 }}>
                  {weekNudges.map((nudge: string, i: number) => {
                    const isWarning = nudge.includes('increased') || nudge.includes('up') || nudge.startsWith('⚠');
                    const isSuccess = nudge.includes('decreased') || nudge.includes('down') || nudge.startsWith('✅');
                    return (
                      <View
                        key={i}
                        style={[
                          styles.nudgeCard,
                          isWarning ? styles.nudgeCardWarning
                            : isSuccess ? styles.nudgeCardSuccess
                            : styles.nudgeCardInfo,
                        ]}
                      >
                        <Text style={[
                          styles.nudgeCardText,
                          isWarning ? styles.nudgeTextWarning
                            : isSuccess ? styles.nudgeTextSuccess
                            : styles.nudgeTextInfo,
                        ]}>
                          {nudge}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={{ color: COLORS.subtext, marginTop: 10, fontSize: 13 }}>
                  No significant changes this week vs last week.
                </Text>
              )}

              {/* Overall this week vs last week totals */}
              <View style={[styles.insightRow, { marginTop: 12, backgroundColor: '#F8F9FF', borderRadius: 8, padding: 8 }]}>
                <Text style={[styles.insightCat, { fontWeight: '700' }]}>📊 This Week Total</Text>
                <View style={styles.insightAmounts}>
                  <Text style={[styles.insightAmount, { fontSize: 15 }]}>₹{(current_total || 0).toFixed(0)}</Text>
                  {overallPct !== null ? (
                    <Text style={[styles.insightPct, overallUp ? styles.pctUp : overallDown ? styles.pctDown : styles.pctNeutral]}>
                      {overallUp ? '▲' : '▼'} {Math.abs(overallPct).toFixed(1)}%
                    </Text>
                  ) : (
                    <Text style={styles.pctNeutral}>{last_total > 0 ? '' : 'No prior week'}</Text>
                  )}
                </View>
              </View>

              {/* Per-category this week vs last week */}
              <Text style={[styles.cardTitle, { marginTop: 14, marginBottom: 6 }]}>
                Category Breakdown
              </Text>
              {allCategories.length === 0 ? (
                <Text style={{ color: COLORS.subtext, marginTop: 6 }}>No category data this week.</Text>
              ) : (
                allCategories.map((cat, i) => {
                  const curr = current_week[cat] || 0;
                  const prev = last_week[cat] || 0;
                  const pct = prev > 0 ? ((curr - prev) / prev) * 100 : null;
                  const isUp = pct !== null && pct > 0;
                  const isDown = pct !== null && pct < 0;

                  return (
                    <View key={i} style={styles.insightRow}>
                      <Text style={styles.insightCat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Text>
                      <View style={styles.insightAmounts}>
                        <Text style={styles.insightAmount}>₹{curr.toFixed(0)}</Text>
                        {pct !== null ? (
                          <Text style={[styles.insightPct, isUp ? styles.pctUp : isDown ? styles.pctDown : styles.pctNeutral]}>
                            {isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
                          </Text>
                        ) : (
                          <Text style={styles.pctNeutral}>New</Text>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          );
        })()}

        {!weeklyLoading && !weeklyData && (
          <Text style={{ color: COLORS.subtext, marginTop: 10 }}>
            Could not load weekly data.
          </Text>
        )}
      </View>

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
                      ₹ {Number(item.amount).toFixed(2)}
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
      <Text style={styles.sectionTitle}>Recent Transactions</Text>

      {/* Fetch status — helps debug empty states */}
      <Text style={{ fontSize: 11, color: COLORS.subtext, marginBottom: 6, marginLeft: 2 }}>
        {txnStatus}
      </Text>

      {recentTxns.length === 0 ? (
        <Text style={{ color: COLORS.subtext, marginTop: 6, marginBottom: 16 }}>
          No transactions found. Pull down to refresh.
        </Text>
      ) : (
        recentTxns.slice(0, 5).map((txn: any) => (
          <View key={txn.id} style={styles.transactionCard}>
            <Text style={styles.merchant}>{txn.merchant}</Text>
            <Text style={styles.amount}>₹ {Number(txn.amount).toFixed(2)}</Text>
            <Text style={styles.category}>{txn.category}</Text>
          </View>
        ))
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 20,
  },

  greeting: {
    fontSize: 13,
    color: COLORS.subtext,
    marginBottom: 2,
  },

  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.text,
  },

  logoutBtn: {
    backgroundColor: "rgba(255,70,70,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,70,70,0.3)",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },

  logoutText: {
    color: "#FF7070",
    fontWeight: "700",
    fontSize: 13,
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

  insightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },

  insightCat: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },

  insightAmounts: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  insightAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },

  insightPct: {
    fontSize: 12,
    fontWeight: "700",
    minWidth: 60,
    textAlign: "right",
  },

  pctUp: {
    color: "#EF4444",
  },

  pctDown: {
    color: "#22C55E",
  },

  pctNeutral: {
    color: COLORS.subtext,
    fontSize: 12,
  },

  // ── Nudge alert cards ──
  nudgeCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
  },

  nudgeCardWarning: {
    backgroundColor: "#FFF5F5",
    borderLeftColor: "#EF4444",
  },

  nudgeCardSuccess: {
    backgroundColor: "#F0FDF4",
    borderLeftColor: "#22C55E",
  },

  nudgeCardInfo: {
    backgroundColor: "#EFF6FF",
    borderLeftColor: "#3B82F6",
  },

  nudgeCardText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20,
  },

  nudgeTextWarning: {
    color: "#B91C1C",
  },

  nudgeTextSuccess: {
    color: "#15803D",
  },

  nudgeTextInfo: {
    color: "#1D4ED8",
  },

});