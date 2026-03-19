import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet
} from "react-native";

export default function LoginScreen({ navigation, setIsLoggedIn }: any) {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

const handleLogin = () => {
  if (email && password) {
    setIsLoggedIn(true); // 🔥 THIS opens your app
  } else {
    alert("Enter valid credentials");
  }
};

  return (
    <View style={styles.container}>

      <Text style={styles.title}>SmartFin</Text>

      <Text style={styles.subtitle}>
        Welcome Back
      </Text>

      {/* Email */}
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />

      {/* Password */}
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      {/* Button */}
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>

     <Text style={styles.footer}>
  Don’t have an account?{" "}
  <Text
    style={{ color: "#4F46E5", fontWeight: "bold" }}
    onPress={() => navigation.navigate("Signup")}
  >
    Sign up
  </Text>
</Text>

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#F4F6FB",
    justifyContent: "center",
    padding: 25
  },

  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#4F46E5",
    textAlign: "center"
  },

  subtitle: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 30,
    color: "#6B7280"
  },

  input: {
    backgroundColor: "white",
    padding: 14,
    borderRadius: 10,
    marginBottom: 15
  },

  button: {
    backgroundColor: "#4F46E5",
    padding: 15,
    borderRadius: 10,
    alignItems: "center"
  },

  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16
  },

  footer: {
    textAlign: "center",
    marginTop: 20,
    color: "gray"
  }

});
