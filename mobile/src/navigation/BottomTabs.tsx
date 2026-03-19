import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import HomeScreen from "../screens/HomeScreen";
import TransactionsScreen from "../screens/TransactionsScreen";
import InsightsScreen from "../screens/InsightsScreen";
import ChatbotScreen from "../screens/ChatbotScreen";

const Tab = createBottomTabNavigator();

export default function BottomTabs(props:any) {

  return (
    <Tab.Navigator>

      <Tab.Screen name="Home">
        {() => <HomeScreen {...props} />}
      </Tab.Screen>

      <Tab.Screen name="Transactions">
        {() => <TransactionsScreen transactions={props.transactions} />}
      </Tab.Screen>

      <Tab.Screen name="Insights">
        {() => <InsightsScreen summary={props.summary} />}
      </Tab.Screen>

      <Tab.Screen name="Chatbot" component={ChatbotScreen} />

    </Tab.Navigator>
  );
}