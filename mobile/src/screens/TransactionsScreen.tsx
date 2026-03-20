import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";

const BASE_URL = "https://finance-ai-backend-pkjk.onrender.com";

interface Transaction {
  id: number;
  amount: number;
  merchant: string;
  category: string;
  date: string;
}

interface Props {
  token?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  food:           "#F59E0B",
  transportation: "#3B82F6",
  transport:      "#3B82F6",
  shopping:       "#EC4899",
  entertainment:  "#8B5CF6",
  health:         "#22C55E",
  utilities:      "#06B6D4",
  others:         "#6B7280",
};

const ALL_CATEGORIES = ["All", "food", "transportation", "shopping", "entertainment", "health", "others"];

export default function TransactionsScreen({ token }: Props) {

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState("");
  const [search, setSearch]             = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // ── Fetch from API ────────────────────────────────────────────────────────
  const fetchTransactions = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else           setLoading(true);
      setError("");

      const res = await fetch(`${BASE_URL}/get-transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("TransactionsScreen fetch error:", err);
      setError("Could not load transactions. Pull down to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = transactions.filter((txn) => {
    const matchSearch   = txn.merchant.toLowerCase().includes(search.toLowerCase());
    const matchCategory = selectedCategory === "All" ||
                          txn.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchSearch && matchCategory;
  });

  const getCategoryColor = (cat: string) =>
    CATEGORY_COLORS[cat.toLowerCase()] ?? "#6B7280";

  // ── Render item ───────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Transaction }) => (
    <View style={styles.card}>
      <View style={[styles.iconCircle, { backgroundColor: getCategoryColor(item.category) }]}>
        <Text style={styles.iconText}>
          {item.category.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.merchant}>{item.merchant}</Text>
        <Text style={styles.category}>{item.category}</Text>
        {item.date ? (
          <Text style={styles.date}>{new Date(item.date).toLocaleDateString("en-IN")}</Text>
        ) : null}
      </View>

      <Text style={styles.amount}>₹ {Number(item.amount).toFixed(2)}</Text>
    </View>
  );

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transactions</Text>

      {/* Search */}
      <TextInput
        placeholder="Search by merchant..."
        value={search}
        onChangeText={setSearch}
        style={styles.search}
        placeholderTextColor="#9CA3AF"
      />

      {/* Category filter */}
      <FlatList
        data={ALL_CATEGORIES}
        horizontal
        keyExtractor={(c) => c}
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: 14 }}
        renderItem={({ item: cat }) => (
          <TouchableOpacity
            onPress={() => setSelectedCategory(cat)}
            style={[styles.filterBtn, selectedCategory === cat && styles.activeFilter]}
          >
            <Text style={{ color: selectedCategory === cat ? "white" : "#333", fontSize: 12, fontWeight: "600" }}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Loading */}
      {loading && <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 30 }} />}

      {/* Error */}
      {!loading && error !== "" && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {/* Transaction list with pull-to-refresh */}
      {!loading && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchTransactions(true)}
              colors={["#4F46E5"]}
              tintColor="#4F46E5"
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {search || selectedCategory !== "All"
                ? "No transactions match your filter."
                : "No transactions yet. They appear here after bank SMS."}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F6FB",
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#1A1A2E",
  },
  search: {
    backgroundColor: "white",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    color: "#1A1A2E",
    elevation: 2,
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
    marginRight: 8,
  },
  activeFilter: {
    backgroundColor: "#4F46E5",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 15,
    borderRadius: 14,
    marginBottom: 12,
    elevation: 3,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  iconText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 17,
  },
  info: {
    flex: 1,
  },
  merchant: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A2E",
    textTransform: "capitalize",
  },
  category: {
    color: "#6B7280",
    marginTop: 2,
    fontSize: 12,
    textTransform: "capitalize",
  },
  date: {
    color: "#9CA3AF",
    fontSize: 11,
    marginTop: 2,
  },
  amount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#EF4444",
  },
  errorText: {
    color: "#EF4444",
    textAlign: "center",
    marginTop: 30,
  },
  emptyText: {
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
  },
});