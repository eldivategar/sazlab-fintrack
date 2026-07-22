import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Portal, Text } from "react-native-paper";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { buildFinancialSystemPrompt } from "../services/aiContextBuilder";
import { ChatMessagePayload, streamGroqChat } from "../services/groqService";
import { AiChatMessage, useAiChatStore } from "../stores/useAiChatStore";
import { useAuthStore } from "../stores/useAuthStore";

const COLORS = {
  primary: "#FF4D6D",
  primaryLight: "#FFF0F4",
  secondary: "#8ACCD5",
  bg: "#FAFAFC",
  white: "#FFFFFF",
  text: "#1E293B",
  subtext: "#64748B",
  border: "#F1F5F9",
  userBubble: "#FF4D6D",
  aiBubble: "#F8FAFC",
  errorText: "#EF4444",
};

// 4-Point Sparkle Star
function SparkleStar({
  size = 16,
  color = "#FF4D6D",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M 12 0 C 12 7, 17 12, 24 12 C 17 12, 12 17, 12 24 C 12 17, 7 12, 0 12 C 7 12, 12 7, 12 0 Z"
        fill={color}
      />
    </Svg>
  );
}

// Hand-drawn Pink Wavy Underline under "hari ini?"
function PinkWavyUnderline({
  width = 120,
  height = 8,
}: {
  width?: number;
  height?: number;
}) {
  return (
    <View
      style={{
        height: 10,
        alignItems: "center",
        marginTop: -2,
        marginBottom: 8,
      }}
    >
      <Svg width={width} height={height} viewBox="0 0 120 8">
        <Path
          d="M 2 4 C 35 7, 85 1, 118 5"
          stroke="#FF4D6D"
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

// Helper SVG Dot Grid Pattern
function DotGrid({ color = "#CBD5E1" }: { color?: string }) {
  return (
    <Svg width={40} height={40} viewBox="0 0 40 40">
      {Array.from({ length: 4 }).map((_, r) =>
        Array.from({ length: 4 }).map((_, c) => (
          <Circle
            key={`${r}-${c}`}
            cx={c * 9 + 5}
            cy={r * 9 + 5}
            r={1.4}
            fill={color}
            opacity={0.6}
          />
        )),
      )}
    </Svg>
  );
}

// Center Organic Connecting Curved Lines
function CenterConnectingLines() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 320 260">
        {/* Pink Curve connecting Card 1 & 4 */}
        <Path
          d="M 120 70 C 200 80, 150 180, 220 200"
          stroke="#FFB6C1"
          strokeWidth={1.4}
          fill="none"
          strokeDasharray="4 2"
          opacity={0.7}
        />
        {/* Green Curve connecting Card 2 & 3 */}
        <Path
          d="M 210 60 C 130 110, 180 160, 100 190"
          stroke="#A7F3D0"
          strokeWidth={1.4}
          fill="none"
          opacity={0.8}
        />
        {/* Purple Curve connecting Card 3 & 4 */}
        <Path
          d="M 110 180 C 180 150, 190 220, 240 210"
          stroke="#E9D5FF"
          strokeWidth={1.4}
          fill="none"
          opacity={0.8}
        />
      </Svg>
    </View>
  );
}

interface AiAssistantSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function AiAssistantSheet({
  visible,
  onDismiss,
}: AiAssistantSheetProps) {
  const { user } = useAuthStore();
  const {
    messages,
    isStreaming,
    error,
    addMessage,
    updateLastAssistantMessage,
    setStreaming,
    setError,
    clearHistory,
  } = useAiChatStore();

  const animatedValue = useSharedValue(0);
  const [shouldRender, setShouldRender] = useState(visible);
  const [inputText, setInputText] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);
  const activeStreamCleanup = useRef<(() => void) | null>(null);

  // Floating Shared Values for the 4 Cards
  const float1 = useSharedValue(0);
  const float2 = useSharedValue(0);
  const float3 = useSharedValue(0);
  const float4 = useSharedValue(0);

  const dragY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      dragY.value = 0;
      animatedValue.value = withSpring(1, {
        damping: 20,
        stiffness: 180,
        mass: 0.8,
      });

      // Start continuous floating motion for 4 cards in opposite phases
      float1.value = withRepeat(
        withSequence(
          withTiming(-8, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(2, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );

      float2.value = withRepeat(
        withSequence(
          withTiming(6, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
          withTiming(-5, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );

      float3.value = withRepeat(
        withSequence(
          withTiming(-6, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
          withTiming(4, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );

      float4.value = withRepeat(
        withSequence(
          withTiming(5, { duration: 1700, easing: Easing.inOut(Easing.ease) }),
          withTiming(-6, { duration: 1700, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      animatedValue.value = withTiming(0, { duration: 220 }, (finished) => {
        if (finished) {
          runOnJS(setShouldRender)(false);
        }
      });
    }
  }, [visible]);

  const screenHeight = Dimensions.get("window").height;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 4,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dragY.value = gestureState.dy;
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          dragY.value = withTiming(screenHeight, { duration: 180 }, () => {
            runOnJS(onDismiss)();
          });
        } else {
          dragY.value = withSpring(0, { damping: 15 });
        }
      },
    })
  ).current;

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: animatedValue.value,
  }));

  const sheetAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: (1 - animatedValue.value) * screenHeight + dragY.value },
      ],
    };
  });

  // Animated Styles with Card Rotations matching the image
  const card1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: float1.value }, { rotate: "-2.5deg" }],
  }));
  const card2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: float2.value }, { rotate: "2.5deg" }],
  }));
  const card3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: float3.value }, { rotate: "-2deg" }],
  }));
  const card4Style = useAnimatedStyle(() => ({
    transform: [{ translateY: float4.value }, { rotate: "2.5deg" }],
  }));

  if (!shouldRender) return null;

  const CARDS = [
    {
      id: 1,
      title: "Analisis\npengeluaran",
      subtitle: "Ringkasan dan insight pengeluaran bulan ini.",
      icon: "stats-chart" as const,
      color: "#FF3B6B",
      bgColor: "#FFF2F5",
      borderColor: "#FFE0E8",
      animatedStyle: card1Style,
      prompt:
        "Tolong berikan analisis singkat pengeluaranku bulan ini dan mana kategori yang paling banyak menguras budget?",
    },
    {
      id: 2,
      title: "Tips hemat\nuang",
      subtitle: "Dapatkan tips praktis setiap hari.",
      icon: "bulb-outline" as const,
      color: "#22C55E",
      bgColor: "#F2FDF5",
      borderColor: "#D1F4D9",
      animatedStyle: card2Style,
      prompt:
        "Berdasarkan sisa saldo dan pengeluaranku saat ini, berikan 3 tips hemat praktis yang bisa langsung kupraktekkan.",
    },
    {
      id: 3,
      title: "Cek sisa\nbudget",
      subtitle: "Lihat sisa budget dan kategorimu saat ini.",
      icon: "wallet-outline" as const,
      color: "#2563EB",
      bgColor: "#F0F7FF",
      borderColor: "#D0E5FF",
      animatedStyle: card3Style,
      prompt:
        "Berapa sisa budget cash dan paylater-ku sekarang? Apakah pengeluaranku masih aman?",
    },
    {
      id: 4,
      title: "Bantu rencana\nbudget",
      subtitle: "Buat rencana budget yang sesuai tujuanmu.",
      icon: "document-text-outline" as const,
      color: "#9333EA",
      bgColor: "#FAF5FF",
      borderColor: "#E9D5FF",
      animatedStyle: card4Style,
      prompt:
        "Bagaimana rekomendasi pembagian budget yang baik (50/30/20) untuk keuanganku bulan ini?",
    },
  ];

  const handleSend = (textToSend?: string) => {
    const prompt = (textToSend || inputText).trim();
    if (!prompt || isStreaming) return;

    setInputText("");
    setError(null);

    // 1. Add User Message
    addMessage("user", prompt);

    // 2. Add Empty Assistant Message Placeholder for Streaming
    addMessage("assistant", "");
    setStreaming(true);

    // 3. Prepare System Prompt & Chat Payload
    const systemPrompt = buildFinancialSystemPrompt();
    const currentMessages = useAiChatStore.getState().messages;

    // Filter out the last empty assistant placeholder for request payload
    const payloadMessages: ChatMessagePayload[] = currentMessages
      .slice(0, currentMessages.length - 1)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    // 4. Trigger Groq API Stream
    if (activeStreamCleanup.current) {
      activeStreamCleanup.current();
    }

    activeStreamCleanup.current = streamGroqChat({
      messages: payloadMessages,
      systemPrompt,
      onChunk: (chunk) => {
        updateLastAssistantMessage(chunk);
      },
      onComplete: () => {
        setStreaming(false);
        activeStreamCleanup.current = null;
      },
      onError: (err) => {
        setStreaming(false);
        setError(err.message);
        activeStreamCleanup.current = null;

        // If assistant message was empty when error occurred, show error message
        const lastMsg = useAiChatStore.getState().messages.slice(-1)[0];
        if (lastMsg && lastMsg.role === "assistant" && !lastMsg.content) {
          updateLastAssistantMessage(
            `⚠️ Gagal terhubung ke SiPaling Eay (${err.message}). Silakan periksa koneksi internet atau EXPO_PUBLIC_GROQ_API_KEY di .env.`,
          );
        }
      },
    });
  };

  const handleResetChat = () => {
    if (activeStreamCleanup.current) {
      activeStreamCleanup.current();
      activeStreamCleanup.current = null;
    }
    clearHistory();
  };

  // Simple Markdown-like formatter for bold text and bullet points
  const renderFormattedText = (text: string, isUser: boolean) => {
    if (!text) return null;

    const textColor = isUser ? COLORS.white : COLORS.text;
    const lines = text.split("\n");

    return lines.map((line, lineIdx) => {
      const isBullet =
        line.trim().startsWith("- ") || line.trim().startsWith("* ");
      const cleanLine = isBullet ? line.trim().substring(2) : line;

      // Parse bold segments (**text**)
      const parts = cleanLine.split(/(\*\*.*?\*\*)/g);

      return (
        <Text
          key={lineIdx}
          style={[
            styles.messageLine,
            { color: textColor },
            isBullet && styles.bulletLine,
          ]}
        >
          {isBullet ? "• " : ""}
          {parts.map((part, partIdx) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <Text
                  key={partIdx}
                  style={[styles.boldText, { color: textColor }]}
                >
                  {part.slice(2, -2)}
                </Text>
              );
            }
            return part;
          })}
        </Text>
      );
    });
  };

  const userName = user?.name ? user.name.split(" ")[0] : "Teman";

  return (
    <Portal>
      <View style={StyleSheet.absoluteFill}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        </Animated.View>

        {/* Sheet */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={StyleSheet.absoluteFill}
          pointerEvents="box-none"
        >
          <Animated.View style={[styles.sheetContainer, sheetAnimatedStyle]}>
            <View
              style={styles.dragHandleContainer}
              {...panResponder.panHandlers}
            >
              <View style={styles.sheetIndicator} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <View style={styles.headerBadgeIcon}>
                  <Ionicons name="sparkles" size={14} color={COLORS.white} />
                </View>
                <View>
                  <Text style={styles.headerTitleText}>SiPaling Eay</Text>
                  <Text style={styles.headerSubtitleText}>
                    AI Assistant Keuangan
                  </Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                {messages.length > 0 && (
                  <Pressable
                    onPress={handleResetChat}
                    style={styles.iconButton}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={20}
                      color={COLORS.subtext}
                    />
                  </Pressable>
                )}
                <Pressable
                  onPress={onDismiss}
                  style={styles.iconButton}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={20} color={COLORS.subtext} />
                </Pressable>
              </View>
            </View>

            {/* Content Body */}
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={[
                styles.content,
                messages.length === 0 && styles.contentEmpty,
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {messages.length === 0 ? (
                /* Empty / Redesigned Welcome State */
                <>
                  <View style={styles.welcomeContainer}>
                    {/* Floating Sparkle Stars matching the image */}
                    <View style={styles.sparkleLeft1} pointerEvents="none">
                      <SparkleStar size={18} color="#FF4D6D" />
                    </View>
                    <View style={styles.sparkleLeft2} pointerEvents="none">
                      <SparkleStar size={10} color="#D97706" />
                    </View>
                    <View style={styles.sparkleLeft3} pointerEvents="none">
                      <SparkleStar size={8} color="#FF809B" />
                    </View>
                    <View style={styles.sparkleRight1} pointerEvents="none">
                      <SparkleStar size={10} color="#D97706" />
                    </View>
                    <View style={styles.sparkleRight2} pointerEvents="none">
                      <SparkleStar size={15} color="#FF4D6D" />
                    </View>

                    <Text style={styles.greetingText}>Halo {userName},</Text>
                    <Text style={styles.welcomeTitle}>
                      Ada cerita apa{"\n"}hari ini?
                    </Text>

                    {/* Hand-drawn Pink Wavy Underline */}
                    <PinkWavyUnderline />

                    <Text style={styles.welcomeSubtitle}>
                      Tanyakan seputar keuangan, analisis pengeluaran,{"\n"}atau
                      minta saran hemat maksimal.
                    </Text>
                  </View>

                  {/* Section Divider Badge */}
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionHeaderBadge}>
                      <Text style={styles.sectionHeaderBadgeText}>
                        Yang bisa aku bantu ✦
                      </Text>
                    </View>
                    <View style={styles.sectionHeaderLine} />
                  </View>

                  {/* Floating Asymmetric 2x2 Cards Grid with Rotations & Organic Lines */}
                  <View style={styles.floatingGridContainer}>
                    {/* Background Pastel Orbs */}
                    <View style={[styles.orb, styles.orbTopLeft]} />
                    <View style={[styles.orb, styles.orbTopRight]} />
                    <View style={[styles.orb, styles.orbBottomLeft]} />
                    <View style={[styles.orb, styles.orbBottomRight]} />

                    {/* SVG Dot Grids */}
                    <View style={styles.dotGridTopLeft} pointerEvents="none">
                      <DotGrid color="#FDA4AF" />
                    </View>
                    <View style={styles.dotGridTopRight} pointerEvents="none">
                      <DotGrid color="#86EFAC" />
                    </View>
                    <View style={styles.dotGridBottomLeft} pointerEvents="none">
                      <DotGrid color="#93C5FD" />
                    </View>
                    <View
                      style={styles.dotGridBottomRight}
                      pointerEvents="none"
                    >
                      <DotGrid color="#C084FC" />
                    </View>

                    {/* Center Organic Connecting Curves */}
                    <CenterConnectingLines />

                    {/* Cards Row 1 */}
                    <View style={styles.gridRow}>
                      {CARDS.slice(0, 2).map((card) => (
                        <Animated.View
                          key={card.id}
                          style={[styles.gridCardWrapper, card.animatedStyle]}
                        >
                          <Pressable
                            style={[
                              styles.cardInner,
                              {
                                backgroundColor: card.bgColor,
                                borderColor: card.borderColor,
                              },
                            ]}
                            onPress={() => handleSend(card.prompt)}
                          >
                            <Ionicons
                              name={card.icon}
                              size={24}
                              color={card.color}
                              style={styles.cardIcon}
                            />
                            <Text style={styles.cardTitle}>{card.title}</Text>
                            <Text style={styles.cardSubtitle}>
                              {card.subtitle}
                            </Text>

                            <Ionicons
                              name="arrow-forward"
                              size={18}
                              color={card.color}
                              style={styles.cardArrow}
                            />
                          </Pressable>
                        </Animated.View>
                      ))}
                    </View>

                    {/* Cards Row 2 */}
                    <View style={styles.gridRow}>
                      {CARDS.slice(2, 4).map((card) => (
                        <Animated.View
                          key={card.id}
                          style={[styles.gridCardWrapper, card.animatedStyle]}
                        >
                          <Pressable
                            style={[
                              styles.cardInner,
                              {
                                backgroundColor: card.bgColor,
                                borderColor: card.borderColor,
                              },
                            ]}
                            onPress={() => handleSend(card.prompt)}
                          >
                            <Ionicons
                              name={card.icon}
                              size={24}
                              color={card.color}
                              style={styles.cardIcon}
                            />
                            <Text style={styles.cardTitle}>{card.title}</Text>
                            <Text style={styles.cardSubtitle}>
                              {card.subtitle}
                            </Text>

                            <Ionicons
                              name="arrow-forward"
                              size={18}
                              color={card.color}
                              style={styles.cardArrow}
                            />
                          </Pressable>
                        </Animated.View>
                      ))}
                    </View>
                  </View>
                </>
              ) : (
                /* Chat Messages History */
                <View style={styles.messagesList}>
                  {messages.map((msg: AiChatMessage) => {
                    const isUser = msg.role === "user";
                    const isLastAssistant =
                      !isUser && msg.id === messages[messages.length - 1]?.id;

                    return (
                      <View
                        key={msg.id}
                        style={[
                          styles.messageRow,
                          isUser ? styles.userRow : styles.assistantRow,
                        ]}
                      >
                        {!isUser && (
                          <View style={styles.aiAvatar}>
                            <Ionicons
                              name="sparkles"
                              size={14}
                              color={COLORS.white}
                            />
                          </View>
                        )}

                        <View
                          style={[
                            styles.messageBubble,
                            isUser ? styles.userBubble : styles.assistantBubble,
                          ]}
                        >
                          {msg.content ? (
                            renderFormattedText(msg.content, isUser)
                          ) : isStreaming && isLastAssistant ? (
                            <View style={styles.typingRow}>
                              <ActivityIndicator
                                size="small"
                                color={COLORS.primary}
                              />
                              <Text style={styles.typingText}>
                                SiPaling Eay sedang berpikir...
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}

                  {error && (
                    <View style={styles.errorContainer}>
                      <Ionicons
                        name="alert-circle-outline"
                        size={16}
                        color={COLORS.errorText}
                      />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Input Section */}
            <View style={styles.inputSection}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  placeholder={`Tanya SiPaling Eay apa ajah...`}
                  placeholderTextColor={COLORS.subtext}
                  multiline
                  value={inputText}
                  onChangeText={setInputText}
                  editable={!isStreaming}
                />
                <Pressable
                  style={[
                    styles.sendButton,
                    inputText.trim().length > 0 &&
                      !isStreaming &&
                      styles.sendButtonActive,
                  ]}
                  onPress={() => handleSend()}
                  disabled={inputText.trim().length === 0 || isStreaming}
                >
                  {isStreaming ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Ionicons
                      name="paper-plane"
                      size={16}
                      color={
                        inputText.trim().length > 0
                          ? COLORS.white
                          : COLORS.subtext
                      }
                    />
                  )}
                </Pressable>
              </View>

              {/* Gen Z Trendy Security Privacy Note */}
              <View style={styles.securityRow}>
                <Ionicons
                  name="lock-closed-outline"
                  size={12}
                  color="#94A3B8"
                />
                <Text style={styles.securityText}>
                  Safe space buat curhat dompet. 100% rahasia, no cap! ✨
                </Text>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "90%",
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    paddingBottom: Platform.OS === "ios" ? 20 : 8,
  },
  sheetIndicator: {
    width: 38,
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    alignSelf: "center",
  },
  dragHandleContainer: {
    width: "100%",
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
    ...(Platform.OS === "web" ? ({ cursor: "grab" } as any) : {}),
  },
  header: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
  headerSubtitleText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.subtext,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  contentEmpty: {
    paddingTop: 10,
  },
  welcomeContainer: {
    position: "relative",
    alignItems: "center",
    marginBottom: 16,
    paddingTop: 10,
  },
  sparkleLeft1: {
    position: "absolute",
    left: 20,
    top: 38,
  },
  sparkleLeft2: {
    position: "absolute",
    left: 48,
    top: 22,
  },
  sparkleLeft3: {
    position: "absolute",
    left: 12,
    top: 80,
  },
  sparkleRight1: {
    position: "absolute",
    right: 25,
    top: 24,
  },
  sparkleRight2: {
    position: "absolute",
    right: 35,
    top: 48,
  },
  greetingText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 16,
    color: COLORS.primary,
    marginBottom: 6,
  },
  welcomeTitle: {
    fontFamily: Platform.OS === "web" ? "'Playfair Display', PlayfairDisplay_600SemiBold, Georgia, serif" : "PlayfairDisplay_600SemiBold",
    fontSize: 32,
    color: "#0F1A30",
    textAlign: "center",
    lineHeight: 40,
    letterSpacing: -0.3,
  },
  welcomeSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.subtext,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 14,
    gap: 12,
  },
  sectionHeaderBadge: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: "#FFE0EB",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  sectionHeaderBadgeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.primary,
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#FFE0EB",
  },
  floatingGridContainer: {
    position: "relative",
    width: "100%",
    gap: 16,
    paddingVertical: 12,
  },
  orb: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.45,
  },
  orbTopLeft: {
    width: 110,
    height: 110,
    backgroundColor: "#FFEBF0",
    top: -15,
    left: -20,
  },
  orbTopRight: {
    width: 110,
    height: 110,
    backgroundColor: "#E8F8EC",
    top: -15,
    right: -20,
  },
  orbBottomLeft: {
    width: 100,
    height: 100,
    backgroundColor: "#E5F1FF",
    bottom: -15,
    left: -15,
  },
  orbBottomRight: {
    width: 100,
    height: 100,
    backgroundColor: "#F3E8FF",
    bottom: -15,
    right: -15,
  },
  dotGridTopLeft: {
    position: "absolute",
    top: -10,
    left: -10,
  },
  dotGridTopRight: {
    position: "absolute",
    top: -10,
    right: -10,
  },
  dotGridBottomLeft: {
    position: "absolute",
    bottom: -10,
    left: -10,
  },
  dotGridBottomRight: {
    position: "absolute",
    bottom: -10,
    right: -10,
  },
  gridRow: {
    flexDirection: "row",
    gap: 14,
  },
  gridCardWrapper: {
    flex: 1,
  },
  cardInner: {
    position: "relative",
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 16,
    minHeight: 140,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  cardIcon: {
    marginBottom: 8,
  },
  cardTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#0F172A",
    lineHeight: 18,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.subtext,
    lineHeight: 15,
    paddingRight: 16,
  },
  cardArrow: {
    position: "absolute",
    bottom: 14,
    right: 14,
  },
  messagesList: {
    width: "100%",
    gap: 12,
    paddingBottom: 12,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginVertical: 2,
  },
  userRow: {
    justifyContent: "flex-end",
  },
  assistantRow: {
    justifyContent: "flex-start",
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  messageBubble: {
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: COLORS.userBubble,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: COLORS.aiBubble,
    borderBottomLeftRadius: 4,
  },
  messageLine: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    lineHeight: 20,
  },
  bulletLine: {
    marginLeft: 4,
  },
  boldText: {
    fontFamily: "Poppins_600SemiBold",
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  typingText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.subtext,
    fontStyle: "italic",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    padding: 10,
    borderRadius: 10,
    gap: 6,
    marginTop: 6,
  },
  errorText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.errorText,
    flex: 1,
  },
  inputSection: {
    paddingHorizontal: 18,
    paddingBottom: 8,
    paddingTop: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.text,
    paddingTop: 8,
    paddingBottom: 8,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendButtonActive: {
    backgroundColor: COLORS.primary,
  },
  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  securityText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11.5,
    color: "#94A3B8",
    textAlign: "center",
  },
});
