import React from "react";
import { View, Text } from "react-native";

export default function ChatbotScreen() {

  return (
    <View style={{ flex:1, justifyContent:"center", alignItems:"center" }}>
      
      <Text style={{ fontSize:22 }}>
        AI Finance Assistant
      </Text>

      <Text style={{ marginTop:10 }}>
        Chatbot will appear here
      </Text>

    </View>
  );
}