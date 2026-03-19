import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  Animated,
} from 'react-native';

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface HistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatBotProps {
  userId?: string;                         // pass the logged-in user's ID
  apiBaseUrl?: string;                     // e.g. "http://192.168.1.10:5000"
  onClose?: () => void;
}

// ── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "What's my total balance?",
  "How much did I spend this month?",
  "Show my recent transactions",
  "Am I over budget anywhere?",
];

// ── Sub-components ───────────────────────────────────────────────────────────

const TypingDots = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -6, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 150);
    const a3 = anim(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={styles.typingContainer}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[styles.typingDot, { transform: [{ translateY: dot }] }]}
        />
      ))}
    </View>
  );
};

const MessageBubble = ({ message }: { message: Message }) => {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowBot]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>✦</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextBot]}>
          {message.content}
        </Text>
        <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampBot]}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
};

// ── Main component ───────────────────────────────────────────────────────────

export default function ChatBot({
  userId,
  apiBaseUrl = 'https://finance-ai-backend-pkjk.onrender.com',
  onClose,
}: ChatBotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hi! I'm your financial assistant. I have access to your account data — ask me anything about your spending, balances, or budgets! 💰",
      timestamp: new Date(),
    },
  ]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const scrollToBottom = () =>
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}-${Math.random()}`,  // ✅ unique ID
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    scrollToBottom();

    try {
      const res = await fetch(`${apiBaseUrl}/chat`, {  // ✅ fixed: was /api/chat
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          user_id: userId,
        }),
      });

      const data = await res.json();

      if (data.error) throw new Error(data.error);

      const botMsg: Message = {
        id: `bot-${Date.now()}-${Math.random()}`,  // ✅ unique ID
        role: 'assistant',
        content: data.reply,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMsg]);
      scrollToBottom();
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}-${Math.random()}`,  // ✅ unique ID
          role: 'assistant',
          content: `Sorry, something went wrong: ${err.message}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, userId, apiBaseUrl]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>✦</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Finance AI</Text>
            <Text style={styles.headerSub}>Connected to your data</Text>
          </View>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={scrollToBottom}
          showsVerticalScrollIndicator={false}
        />

        {/* Typing indicator */}
        {loading && (
          <View style={styles.typingRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>✦</Text>
            </View>
            <View style={styles.bubbleBot}>
              <TypingDots />
            </View>
          </View>
        )}

        {/* Suggestions (only shown when no history) */}
        {messages.length === 1 && !loading && (
          <View style={styles.suggestions}>
            {SUGGESTIONS.map(s => (
              <TouchableOpacity
                key={s}
                style={styles.suggestionChip}
                onPress={() => sendMessage(s)}
              >
                <Text style={styles.suggestionText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your finances…"
            placeholderTextColor="#8A99B3"
            multiline
            maxLength={500}
            onSubmitEditing={() => sendMessage(input)}
            returnKeyType="send"
            blurOnSubmit
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || loading}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.sendBtnText}>↑</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const TEAL = '#00C9A7';
const NAVY = '#0A1628';
const CARD = '#111D30';
const BORDER = '#1E2D45';
const WHITE = '#F0F4FF';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: CARD,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: TEAL,
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconText: { color: NAVY, fontSize: 16, fontWeight: '700' },
  headerTitle: { color: WHITE, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  headerSub: { color: TEAL, fontSize: 11, marginTop: 1 },
  closeBtn: { padding: 6 },
  closeBtnText: { color: '#8A99B3', fontSize: 16 },

  // Messages
  messageList: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },

  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowBot: { justifyContent: 'flex-start' },

  avatar: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: TEAL,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  avatarText: { color: NAVY, fontSize: 12, fontWeight: '800' },

  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: TEAL,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextUser: { color: NAVY, fontWeight: '500' },
  bubbleTextBot: { color: WHITE },

  timestamp: { fontSize: 10, marginTop: 4 },
  timestampUser: { color: 'rgba(10,22,40,0.55)', textAlign: 'right' },
  timestampBot: { color: '#8A99B3' },

  // Typing
  typingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  typingContainer: { flexDirection: 'row', gap: 4, paddingHorizontal: 4, paddingVertical: 6 },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: TEAL },

  // Suggestions
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  suggestionChip: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: TEAL,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  suggestionText: { color: TEAL, fontSize: 13, fontWeight: '500' },

  // Input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: CARD,
  },
  input: {
    flex: 1,
    backgroundColor: NAVY,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: WHITE,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: NAVY, fontSize: 20, fontWeight: '800', marginTop: -2 },
});
