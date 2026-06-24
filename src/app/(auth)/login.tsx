import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Platform,
  Image,
  useWindowDimensions,
  ScrollView,
  Pressable,
} from "react-native";
import { Text } from "react-native-paper";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { MotiView } from "moti";
import { useAuthStore } from "../../stores/useAuthStore";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import GoogleLogo from "../../components/GoogleLogo";

// Complete the authentication session if redirecting back to the app
WebBrowser.maybeCompleteAuthSession();

// Safely require GoogleSignin for native platforms only
let GoogleSignin: any = null;
if (Platform.OS !== "web") {
  try {
    GoogleSignin =
      require("@react-native-google-signin/google-signin").GoogleSignin;
  } catch (error) {
    console.log(
      "[SiPaling Hemat] Native Google Sign-In module not found. Falling back to AuthSession. This is expected in Expo Go or if native binaries have not been rebuilt yet.",
    );
  }
}

const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

// Decorative dot grid pattern component
const DotGrid = ({ color = "#E2E8F0" }) => (
  <View style={{ flexDirection: "row", gap: 6 }}>
    <View style={{ gap: 6 }}>
      {[...Array(5)].map((_, i) => (
        <View
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
    <View style={{ gap: 6 }}>
      {[...Array(5)].map((_, i) => (
        <View
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  </View>
);

export default function LoginScreen() {
  const { login } = useAuthStore();
  const { width } = useWindowDimensions();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // makeRedirectUri generates different URIs per platform
  const redirectUri = AuthSession.makeRedirectUri(
    Platform.OS === "web"
      ? {}
      : {
          scheme: "sipaling-hemat",
          preferLocalhost: true,
          native: "sipaling-hemat://oauth2redirect",
        },
  );

  // If native SDK fails to load (e.g. running in Expo Go or native module not linked),
  // we fallback to the web client ID for the AuthSession browser flow.
  const clientId =
    Platform.select({
      web: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
      android: GoogleSignin
        ? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID
        : process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
      ios: GoogleSignin
        ? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS
        : process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
      default: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
    }) || "";

  // Configure Google SDK for native platforms if available
  useEffect(() => {
    if (Platform.OS !== "web" && GoogleSignin) {
      GoogleSignin.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/drive.file",
        ],
      });
    }
  }, []);

  useEffect(() => {
    console.log("[SiPaling Hemat] OAuth Redirect URI:", redirectUri);
  }, [redirectUri]);

  // Fallback to AuthSession if on Web or if native SDK is not loaded (e.g. Expo Go)
  const useAuthSessionFallback = Platform.OS === "web" || !GoogleSignin;

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      scopes: [
        "openid",
        "profile",
        "email",
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.file",
      ],
      responseType: AuthSession.ResponseType.Token,
      redirectUri,
      usePKCE: false,
    },
    useAuthSessionFallback && clientId ? discovery : null,
  );

  const isButtonDisabled = useAuthSessionFallback ? !request : false;

  useEffect(() => {
    if (response) {
      if (response.type === "success") {
        const token = response.authentication?.accessToken;
        if (token) {
          fetchUserInfo(token);
        } else {
          setErrorMsg("Token autentikasi tidak ditemukan.");
          setIsAuthenticating(false);
        }
      } else if (response.type === "error" || response.type === "cancel") {
        setErrorMsg(
          response.type === "cancel"
            ? "Login dibatalkan oleh pengguna."
            : "Autentikasi gagal.",
        );
        setIsAuthenticating(false);
      }
    }
  }, [response]);

  const fetchUserInfo = async (token: string) => {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const userData = await res.json();
        const user = {
          name: userData.name || "",
          email: userData.email || "",
          picture: userData.picture || "",
        };
        await login(token, user);
      } else {
        const errorText = await res.text();
        console.error("Google profile fetch failed:", errorText);
        setErrorMsg("Gagal mengambil profil pengguna dari Google.");
        setIsAuthenticating(false);
      }
    } catch (err) {
      console.error("Error fetching Google profile:", err);
      setErrorMsg("Terjadi kesalahan saat mengambil profil pengguna.");
      setIsAuthenticating(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setErrorMsg(null);
      setIsAuthenticating(true);

      if (useAuthSessionFallback) {
        const result = await promptAsync();
        if (result.type !== "success") {
          setIsAuthenticating(false);
        }
      } else {
        if (!GoogleSignin) {
          throw new Error("SDK Sign-In Native tidak termuat.");
        }
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const signInResponse = await GoogleSignin.signIn();

        if (signInResponse?.type === "cancelled") {
          setErrorMsg("Login dibatalkan oleh pengguna.");
          setIsAuthenticating(false);
          return;
        }

        const googleUser = signInResponse?.data?.user ?? (signInResponse as any)?.user;
        const tokens = await GoogleSignin.getTokens();
        const token = tokens.accessToken;

        if (token && googleUser) {
          const user = {
            name: googleUser.name || "",
            email: googleUser.email || "",
            picture: googleUser.photo || "",
          };
          await login(token, user);
        } else {
          setErrorMsg("Gagal mendapatkan data login dari Google.");
          setIsAuthenticating(false);
        }
      }
    } catch (err: any) {
      console.error("Google login error:", err);
      if (err.code === "ASYNC_OP_IN_PROGRESS") {
        setErrorMsg("Proses login sedang berjalan.");
      } else if (err.code === "PLAY_SERVICES_NOT_AVAILABLE") {
        setErrorMsg("Google Play Services tidak tersedia.");
      } else {
        setErrorMsg("Tidak dapat masuk dengan Google. Silakan coba lagi.");
      }
      setIsAuthenticating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Decorative colored blobs for a premium modern aesthetic */}
      <View
        style={[styles.blob, styles.blobTop, { backgroundColor: "#FFE5EC" }]}
      />
      <View
        style={[styles.blob, styles.blobBottom, { backgroundColor: "#E0F7FA" }]}
      />

      {/* Decorative dot grids */}
      <View style={styles.dotGridTopLeft}>
        <DotGrid color="#CBD5E1" />
      </View>
      <View style={styles.dotGridMidRight}>
        <DotGrid color="#FFE1EB" />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <View style={styles.content}>
          {/* Animated logo and header */}
          <MotiView
            from={{ opacity: 0, scale: 0.92, translateY: -10 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 600 }}
            style={styles.logoContainer}
          >
            <Image
              source={require("../../../assets/images/sipaling-hemat-logo.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </MotiView>

          {/* Heading text block */}
          <MotiView
            from={{ opacity: 0, translateY: 15 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 700, delay: 150 }}
            style={styles.textContainer}
          >
            <Text style={styles.headerTitle}>
              Kelola keuangan Anda dengan mudah
            </Text>
            <Text style={styles.headerSub}>menggunakan AI & Google Sheets</Text>
          </MotiView>

          {/* 3-Column Features Section */}
          <MotiView
            from={{ opacity: 0, translateY: 25 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 800, delay: 300 }}
            style={styles.featuresRow}
          >
            {/* Feature 1 */}
            <View style={styles.featureCol}>
              <View
                style={[
                  styles.featureIconContainer,
                  { backgroundColor: "#FFEBF0" },
                ]}
              >
                <Ionicons name="stats-chart" size={20} color="#FF90BB" />
              </View>
              <Text style={styles.featureTitle}>Insight Cerdas</Text>
              <Text style={styles.featureDesc}>Analisis otomatis & akurat</Text>
            </View>

            {/* Feature 2 */}
            <View style={styles.featureCol}>
              <View
                style={[
                  styles.featureIconContainer,
                  { backgroundColor: "#ECFDF5" },
                ]}
              >
                <Ionicons name="grid-outline" size={18} color="#10B981" />
              </View>
              <Text style={styles.featureTitle}>Google Sheets</Text>
              <Text style={styles.featureDesc}>
                Data tersimpan aman di spreadsheet Anda
              </Text>
            </View>

            {/* Feature 3 */}
            <View style={styles.featureCol}>
              <View
                style={[
                  styles.featureIconContainer,
                  { backgroundColor: "#EEF2FF" },
                ]}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color="#6366F1"
                />
              </View>
              <Text style={styles.featureTitle}>Aman & Terpercaya</Text>
              <Text style={styles.featureDesc}>
                Login dengan Google, data tetap milik Anda
              </Text>
            </View>
          </MotiView>

          {/* Login Card */}
          <MotiView
            from={{ opacity: 0, translateY: 35 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 900, delay: 450 }}
            style={styles.card}
          >
            <View style={styles.handContainer}>
              <Text style={styles.handEmoji}>👋</Text>
            </View>

            <Text style={styles.cardTitle}>Selamat Datang</Text>
            <Text style={styles.cardDesc}>
              Masuk dengan Google untuk menghubungkan database Spreadsheet Anda
            </Text>

            {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

            {isAuthenticating ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator
                  size="small"
                  color="#FF90BB"
                  style={{ marginBottom: 12 }}
                />
                <Text style={styles.loadingText}>
                  Menghubungkan ke Google...
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={handleGoogleLogin}
                disabled={isButtonDisabled}
                style={({ pressed }) => [
                  styles.googleButton,
                  pressed && { backgroundColor: "#F8FAFC" },
                  isButtonDisabled && { opacity: 0.6 },
                ]}
              >
                <GoogleLogo size={18} style={{ marginRight: 12 }} />
                <Text style={styles.googleButtonText}>Masuk dengan Google</Text>
              </Pressable>
            )}

            <View style={styles.cardFooterContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={12}
                color="#94A3B8"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.cardFooterText}>
                Penyimpanan aman dikelola via SecureStore.
              </Text>
            </View>
          </MotiView>

          {/* Bottom App Version */}
          <Text style={styles.appVersion}>SiPaling Hemat v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 24,
  },
  content: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
  },
  blob: {
    position: "absolute",
    borderRadius: 200,
  },
  blobTop: {
    width: 320,
    height: 320,
    top: -80,
    right: -80,
    opacity: 0.8,
  },
  blobBottom: {
    width: 280,
    height: 280,
    bottom: 120,
    left: -140,
    opacity: 0.6,
  },
  dotGridTopLeft: {
    position: "absolute",
    top: 130,
    left: 28,
    opacity: 0.35,
  },
  dotGridMidRight: {
    position: "absolute",
    top: 370,
    right: 28,
    opacity: 0.35,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 30,
    marginBottom: -10,
  },
  logoImage: {
    width: 250,
    height: 250,
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 32,
    width: "100%",
    zIndex: 1,
  },
  headerTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: "#1E293B",
    textAlign: "center",
  },
  headerSub: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
  },
  featuresRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 36,
  },
  featureCol: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 6,
  },
  featureIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  featureTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 10,
    color: "#1E293B",
    textAlign: "center",
  },
  featureDesc: {
    fontFamily: "Poppins_500Medium",
    fontSize: 8.5,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 12,
  },
  card: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 32,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 32,
  },
  handContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  handEmoji: {
    fontSize: 20,
  },
  cardTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: "#1E293B",
    marginBottom: 10,
  },
  cardDesc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12.5,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingVertical: 12,
    width: "100%",
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  googleButtonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#1E293B",
  },
  cardFooterContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  cardFooterText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 10,
    color: "#94A3B8",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  loadingText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: "#64748B",
  },
  errorText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: "#EF4444",
    marginBottom: 12,
    textAlign: "center",
  },
  appVersion: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 10,
  },
});
