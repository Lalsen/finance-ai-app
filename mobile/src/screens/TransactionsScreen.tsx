import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity
} from "react-native";

interface Transaction {
  id: number;
  amount: number;
  merchant: string;
  category: string;
}

interface Props {
  transactions: Transaction[];
  token?: string;
}

export default function TransactionsScreen({ transactions, token }: Props) {

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", "food", "transportation","shopping"];

  // 🔍 Filter logic
  const filteredTransactions = transactions.filter((txn) => {

    const matchesSearch =
      txn.merchant.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      selectedCategory === "All" ||
      txn.category.toLowerCase() === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case "food":
        return "#F59E0B";
      case "transport":
        return "#3B82F6";
      case "shopping":
        return "#EC4899";
      default:
        return "#6B7280";
    }
  };

  const renderItem = ({ item }: { item: Transaction }) => (
    <View style={styles.card}>

      {/* Icon */}
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: getCategoryColor(item.category) }
        ]}
      >
        <Text style={styles.iconText}>
          {item.category.charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.merchant}>{item.merchant}</Text>
        <Text style={styles.category}>{item.category}</Text>
      </View>

      {/* Amount */}
      <Text
        style={[
          styles.amount,
          { color: item.amount > 0 ? "green" : "red" }
        ]}
      >
        ₹ {item.amount}
      </Text>

    </View>
  );

  return (
    <View style={styles.container}>

      <Text style={styles.title}>Transactions</Text>

      {/* 🔍 Search Bar */}
      <TextInput
        placeholder="Search by merchant..."
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      {/* 🎯 Category Filter */}
      <View style={styles.filterRow}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => setSelectedCategory(cat)}
            style={[
              styles.filterBtn,
              selectedCategory === cat && styles.activeFilter
            ]}
          >
            <Text
              style={{
                color: selectedCategory === cat ? "white" : "#333"
              }}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />

    </View>
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
    marginBottom: 10
  },

  search: {
    backgroundColor: "white",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10
  },

  filterRow: {
    flexDirection: "row",
    marginBottom: 15
  },

  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
    marginRight: 8
  },

  activeFilter: {
    backgroundColor: "#4F46E5"
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 15,
    borderRadius: 14,
    marginBottom: 12,
    elevation: 3
  },

  iconCircle: {
    width: 45,
    height: 45,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12
  },

  iconText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16
  },

  info: {
    flex: 1
  },

  merchant: {
    fontSize: 16,
    fontWeight: "600"
  },

  category: {
    color: "gray",
    marginTop: 3
  },

  amount: {
    fontSize: 16,
    fontWeight: "bold"
  }

});