import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
} from "react-native";
import { Portal, Modal, Text, Button, TextInput } from "react-native-paper";
import { Audio } from "expo-av";
import { MotiView, MotiText } from "moti";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../stores/useAuthStore";
import { useSheetStore } from "../stores/useSheetStore";
import { transcribeAudio, SpeechApiError } from "../services/speechToText";
import {
  parseTransactionWithSumopod,
  SumopodAiError,
  ParsedTransaction,
} from "../services/aiParser";

interface VoiceInputSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

const EXPENSE_CATEGORIES = [
  "Makanan & Minuman",
  "Transportasi",
  "Belanja",
  "Tagihan & Utilitas",
  "Hiburan",
  "Lainnya",
];
const INCOME_CATEGORIES = [
  "Gaji",
  "Investasi",
  "Sampingan",
  "Hadiah",
  "Lainnya",
];

const MOCK_PHRASES = [
  {
    phrase: "Beli nasi goreng 18 ribu cash",
    parsed: {
      type: "Pengeluaran",
      item: "Nasi Goreng",
      nominal: 18000,
      kategori: "Makanan & Minuman",
      pembayaran: "Cash",
    },
  },
  {
    phrase: "Bayar tagihan listrik 150 ribu pakai paylater",
    parsed: {
      type: "Pengeluaran",
      item: "Tagihan Listrik",
      nominal: 150000,
      kategori: "Tagihan & Utilitas",
      pembayaran: "Paylater",
    },
  },
  {
    phrase: "Dapat gaji bulanan 5 juta masuk cash",
    parsed: {
      type: "Pemasukan",
      item: "Gaji Bulanan",
      nominal: 5000000,
      kategori: "Gaji",
      pembayaran: "Cash",
    },
  },
  {
    phrase: "Beli bensin motor 25 ribu pakai uang cash",
    parsed: {
      type: "Pengeluaran",
      item: "Bensin Motor",
      nominal: 25000,
      kategori: "Transportasi",
      pembayaran: "Cash",
    },
  },
];

const getUserMediaWithTimeout = (
  constraints: MediaStreamConstraints,
  timeoutMs: number,
): Promise<MediaStream> => {
  return new Promise<MediaStream>((resolve, reject) => {
    let timer = setTimeout(() => {
      timer = 0;
      reject(new Error("TIMEOUT"));
    }, timeoutMs);

    const nav = (window as any).navigator;
    nav.mediaDevices
      .getUserMedia(constraints)
      .then((stream: MediaStream) => {
        if (timer) {
          clearTimeout(timer);
          resolve(stream);
        } else {
          // If resolved after timeout, stop the stream tracks to avoid resource leak
          stream.getTracks().forEach((track: any) => track.stop());
        }
      })
      .catch((err: any) => {
        if (timer) {
          clearTimeout(timer);
          reject(err);
        }
      });
  });
};

export default function VoiceInputSheet({
  visible,
  onDismiss,
}: VoiceInputSheetProps) {
  const { token } = useAuthStore();
  const { addTransaction } = useSheetStore();

  const [status, setStatus] = useState<
    "idle" | "recording" | "transcribing" | "parsing" | "preview" | "error"
  >("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordDuration, setRecordDuration] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([
    0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1,
  ]);

  const [transcription, setTranscription] = useState("");
  const [parsedData, setParsedData] = useState<ParsedTransaction | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Demo Mode Flags (activated if API keys are missing)
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Fields for Editable Preview Card
  const [editItem, setEditItem] = useState("");
  const [editNominal, setEditNominal] = useState("");
  const [editType, setEditType] = useState<"Pengeluaran" | "Pemasukan">(
    "Pengeluaran",
  );
  const [editCategory, setEditCategory] = useState("");
  const [editPembayaran, setEditPembayaran] = useState<"Cash" | "Paylater">(
    "Cash",
  );
  const [editCatatan, setEditCatatan] = useState("");

  const timerRef = useRef<any>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  // useRef<any> untuk MediaRecorder agar tidak error TypeScript di environment React Native
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<any[]>([]);
  const prevVisibleRef = useRef(false);
  const isDemoModeRef = useRef(false);

  // Voice assistant animations using Reanimated
  const orbScale = useSharedValue(1);
  const orbPulseScale = useSharedValue(1);
  const orbPulseOpacity = useSharedValue(0.6);

  const animatedOrbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  const animatedPulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbPulseScale.value }],
    opacity: orbPulseOpacity.value,
  }));

  // ─── Helper: animasi waveform dari volume level (0.0–1.0) ───────────────────
  const updateWaveform = (normalized: number) => {
    setWaveform((prev) =>
      prev.map((_, i) => {
        if (i === prev.length - 1) return normalized;
        return prev[i + 1] * 0.85 + Math.random() * 0.15 * normalized;
      }),
    );
  };

  // ─── Start timer ─────────────────────────────────────────────────────────────
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRecordDuration((prev) => prev + 1);
    }, 1000);
  };

  // ─── Reset semua state ke kondisi awal ───────────────────────────────────────
  const resetAll = () => {
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus("idle");
    setIsRecording(false);
    setRecording(null);
    setRecordDuration(0);
    setWaveform([
      0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1,
    ]);
    setTranscription("");
    setParsedData(null);
    setErrorMsg(null);
    setIsDemoMode(false);
    isDemoModeRef.current = false;
  };

  // ─── Effects ─────────────────────────────────────────────────────────────────

  // Animasi orb saat status recording berubah
  useEffect(() => {
    if (status === "recording") {
      orbScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 750 }),
          withTiming(1.0, { duration: 750 }),
        ),
        -1,
        true,
      );
      orbPulseScale.value = withRepeat(
        withTiming(1.3, { duration: 1500 }),
        -1,
        false,
      );
      orbPulseOpacity.value = withRepeat(
        withTiming(0, { duration: 1500 }),
        -1,
        false,
      );
    } else {
      orbScale.value = 1;
      orbPulseScale.value = 1;
      orbPulseOpacity.value = 0.6;
    }
  }, [status]);

  // Cleanup saat unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Reset state setiap kali modal dibuka (dari tertutup → terbuka)
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      if (Platform.OS !== "web") {
        Audio.requestPermissionsAsync().catch((err) => {
          console.warn("Audio permissions request error:", err);
        });
      }
      resetAll();
    }
    prevVisibleRef.current = visible;
  }, [visible]);

  // ─── WEB: rekam pakai MediaRecorder API (browser native) ─────────────────────
  const startRecordingWeb = async () => {
    try {
      // Akses semua Web API lewat window untuk menghindari TypeScript error di RN compiler
      const nav = (window as any).navigator;
      if (!nav || !nav.mediaDevices) {
        console.warn(
          "[VoiceInputSheet] Web: navigator.mediaDevices tidak tersedia. Apakah koneksi tidak aman (non-HTTPS)?",
        );
        throw new Error(
          "Mikrofon tidak dapat diakses di browser (memerlukan HTTPS atau localhost).",
        );
      }

      const stream = await getUserMediaWithTimeout({ audio: true }, 5000);
      if (isDemoModeRef.current) {
        console.log(
          "[VoiceInputSheet] Web: Mengabaikan stream karena pengguna memilih Mode Demo.",
        );
        stream.getTracks().forEach((t: any) => t.stop());
        return;
      }

      // Waveform via AnalyserNode (Web Audio API)
      const AudioCtx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const waveformInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const avg =
          dataArray.reduce((a: number, b: number) => a + b, 0) /
          dataArray.length;
        const normalized = Math.max(0.1, Math.min(1.0, avg / 128));
        updateWaveform(normalized);
      }, 100);

      audioChunksRef.current = [];

      const MR = (window as any).MediaRecorder;
      const mimeType = MR.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const mediaRecorder = new MR(stream, { mimeType });

      mediaRecorder.ondataavailable = (e: any) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        clearInterval(waveformInterval);
        stream.getTracks().forEach((t: any) => t.stop());
        audioCtx.close();

        const blob = new (window as any).Blob(audioChunksRef.current, {
          type: mimeType,
        });
        const uri = (window as any).URL.createObjectURL(blob);
        await processAudioUri(uri);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);

      setStatus("recording");
      setIsRecording(true);
      setRecordDuration(0);
      startTimer();
    } catch (err: any) {
      if (isDemoModeRef.current) {
        console.log(
          "[VoiceInputSheet] Web: Mengabaikan error perekaman karena sedang berjalan dalam Mode Demo.",
        );
        return;
      }
      console.warn("[VoiceInputSheet] Web recording failed:", err);
      setStatus("error");
      if (err) {
        setErrorMsg(
          err.message ||
            "Tidak dapat mengakses mikrofon di browser. Pastikan izin mikrofon sudah diberikan.",
        );
      }
    }
  };

  // ─── NATIVE: rekam pakai expo-av (iOS & Android) ─────────────────────────────
  const startRecordingNative = async () => {
    console.log("[VoiceInputSheet] startRecordingNative dipanggil");
    try {
      console.log("[VoiceInputSheet] Native: Memeriksa izin mikrofon...");
      const permission = await Audio.getPermissionsAsync();
      console.log(
        "[VoiceInputSheet] Native: Hasil getPermissionsAsync:",
        permission,
      );
      if (permission.status !== "granted") {
        console.log("[VoiceInputSheet] Native: Meminta izin mikrofon...");
        const ask = await Audio.requestPermissionsAsync();
        console.log(
          "[VoiceInputSheet] Native: Hasil requestPermissionsAsync:",
          ask,
        );
        if (ask.status !== "granted") {
          setStatus("error");
          setErrorMsg("Izin mikrofon diperlukan.");
          return;
        }
      }

      console.log("[VoiceInputSheet] Native: Mengatur Audio Mode...");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const onRecordingStatusUpdate = (recStatus: Audio.RecordingStatus) => {
        if (recStatus.metering !== undefined) {
          const normalized = Math.max(
            0.1,
            Math.min(1.0, (recStatus.metering + 160) / 160),
          );
          updateWaveform(normalized);
        }
      };

      console.log(
        "[VoiceInputSheet] Native: Menyiapkan dan memulai perekaman...",
      );
      const { recording: newRecording } = await Audio.Recording.createAsync(
        {
          android: {
            extension: ".m4a",
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            extension: ".m4a",
            audioQuality: Audio.IOSAudioQuality.HIGH,
            outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: { mimeType: "audio/webm", bitsPerSecond: 128000 },
          isMeteringEnabled: true,
        },
        onRecordingStatusUpdate,
        100,
      );

      if (isDemoModeRef.current) {
        console.log(
          "[VoiceInputSheet] Native: Mengabaikan recording karena pengguna memilih Mode Demo.",
        );
        newRecording.stopAndUnloadAsync().catch(() => {});
        return;
      }

      recordingRef.current = newRecording;
      setRecording(newRecording);
      console.log("[VoiceInputSheet] Native: Perekaman berhasil dimulai");
      setStatus("recording");
      setIsRecording(true);
      setRecordDuration(0);
      startTimer();
    } catch (err: any) {
      if (isDemoModeRef.current) {
        console.log(
          "[VoiceInputSheet] Native: Mengabaikan error perekaman karena sedang berjalan dalam Mode Demo.",
        );
        return;
      }
      console.warn("[VoiceInputSheet] Native recording failed:", err);
      setStatus("error");
      setErrorMsg(err.message || "Tidak dapat memulai perekaman mikrofon.");
    }
  };

  // ─── Entry point: deteksi platform lalu panggil yang sesuai ──────────────────
  const startRecording = async () => {
    console.log(
      "[VoiceInputSheet] Platform:",
      Platform.OS,
    );
    if (Platform.OS === "web") {
      await startRecordingWeb();
    } else {
      await startRecordingNative();
    }
  };

  // ─── Proses URI audio (shared antara web & native) ───────────────────────────
  const processAudioUri = async (uri: string) => {
    try {
      setStatus("transcribing");

      const groqApiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
      const sumopodApiKey = process.env.EXPO_PUBLIC_SUMOPOD_AI_API_KEY;

      if (
        !groqApiKey ||
        groqApiKey.startsWith("placeholder") ||
        !sumopodApiKey ||
        sumopodApiKey.startsWith("placeholder")
      ) {
        throw new Error("MISSING_API_KEY")
      }

      const textResult = await transcribeAudio(uri, groqApiKey);
      setTranscription(textResult);

      setStatus("parsing");
      const parsed = await parseTransactionWithSumopod(
        textResult,
        sumopodApiKey,
      );

      // Validasi data hasil parsing AI
      if (!parsed || typeof parsed !== "object") {
        throw new Error("JSON_PARSE_FAILED");
      }
      if (!parsed.item || parsed.item.trim() === "") {
        throw new Error("INVALID_ITEM");
      }
      if (
        parsed.nominal === undefined ||
        parsed.nominal === null ||
        isNaN(parsed.nominal) ||
        parsed.nominal <= 0
      ) {
        throw new Error("INVALID_NOMINAL");
      }

      setupForm(parsed);
      setStatus("preview");
    } catch (err: any) {
      // console.error('Audio processing failed:', err);
      if (err instanceof SpeechApiError && err.message === "MISSING_API_KEY") {
        throw new Error("MISSING_API_KEY")
      } else {
        setStatus("error");

        let friendlyMessage =
          "Gagal memproses transaksi suara. Harap ulangi rekaman Anda.";
        const errorMessage = String(err.message || err);

        if (
          errorMessage.includes("Load failed") ||
          errorMessage.includes("Failed to fetch") ||
          errorMessage.includes("Network request failed") ||
          errorMessage.includes("TypeError")
        ) {
          friendlyMessage =
            "Koneksi internet bermasalah atau Server AI tidak dapat dijangkau. Harap periksa jaringan internet Anda dan coba lagi.";
        } else if (
          errorMessage.includes("NO_SPEECH_DETECTED") ||
          errorMessage.includes("empty response")
        ) {
          friendlyMessage =
            "Suara tidak terdeteksi atau kosong. Harap berbicara lebih dekat ke mikrofon dan ulangi rekaman.";
        } else if (errorMessage.includes("INVALID_NOMINAL")) {
          friendlyMessage =
            'AI tidak dapat mendeteksi nominal transaksi yang jelas. Harap ulangi rekaman lagi (contoh: "beli kopi 25 ribu").';
        } else if (errorMessage.includes("INVALID_ITEM")) {
          friendlyMessage =
            'AI tidak dapat mendeteksi deskripsi barang/transaksi. Harap ulangi rekaman lagi (contoh: "beli bensin 20 ribu").';
        } else if (
          errorMessage.includes("JSON_PARSE_FAILED") ||
          err instanceof SyntaxError
        ) {
          friendlyMessage =
            'Gagal menganalisis data transaksi. Harap ulangi rekaman dengan kalimat yang lebih jelas (contoh: "Bayar bakso 15 ribu tunai").';
        } else if (
          errorMessage.includes("Groq Audio Transcription API failed") ||
          errorMessage.includes("SumoPod AI API failed")
        ) {
          friendlyMessage =
            "Gagal menghubungi server AI untuk memproses suara/teks. Harap periksa koneksi internet, kunci API Anda, atau coba lagi beberapa saat lagi.";
        } else if (err.message) {
          friendlyMessage = err.message;
        }

        setErrorMsg(friendlyMessage);
      }
    }
  };

  // ─── Stop recording: deteksi platform ────────────────────────────────────────
  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);

    if (Platform.OS === "web") {
      // Web: cukup panggil .stop() — onstop handler akan lanjutkan ke processAudioUri
      const mr = mediaRecorderRef.current;
      if (!mr || mr.state === "inactive") return;
      mr.stop(); // onstop dipanggil async setelah semua chunk terkumpul
    } else {
      // Native (iOS/Android): pakai expo-av
      const activeRecording = recordingRef.current;
      if (!activeRecording) return;

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: false,
        });
        await activeRecording.stopAndUnloadAsync();
        const uri = activeRecording.getURI();
        recordingRef.current = null;
        setRecording(null);

        if (!uri) throw new Error("File rekaman tidak ditemukan.");
        await processAudioUri(uri);
      } catch (err: any) {
        console.warn("Stop native recording failed:", err);
        setStatus("error");
        setErrorMsg(err.message || "Gagal menghentikan perekaman.");
      }
    }
  };

  const setupForm = (parsed: ParsedTransaction) => {
    setParsedData(parsed);
    setEditItem(parsed.item);
    setEditNominal(
      parsed.nominal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."),
    );
    setEditType(parsed.type);
    setEditCategory(parsed.kategori);
    setEditPembayaran(parsed.pembayaran);
    setEditCatatan("");
  };

  const handleSaveParsed = async () => {
    setErrorMsg(null);
    const cleanNominal = Number(editNominal.replace(/[^0-9]/g, ""));

    if (!editItem.trim()) {
      setErrorMsg("Deskripsi item wajib diisi.");
      return;
    }
    if (cleanNominal <= 0) {
      setErrorMsg("Nominal harus lebih besar dari Rp 0.");
      return;
    }

    if (!token) {
      setErrorMsg("Sesi login kedaluwarsa.");
      return;
    }

    setStatus("parsing"); // reuse parsing as submitting loading state
    try {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;

      await addTransaction(token, {
        tanggal: dateStr,
        kategori: `${editType === "Pemasukan" ? "Pemasukan" : "Pengeluaran"}: ${editCategory}`,
        keterangan: editItem.trim(),
        nominal: cleanNominal,
        pembayaran: editPembayaran,
        catatan: editCatatan.trim(),
        sumberInput: "Voice",
      });

      onDismiss();
    } catch (err: any) {
      console.warn("Failed to save parsed voice transaction:", err);
      setErrorMsg(err.message || "Gagal memasukkan data ke Google Sheets.");
      setStatus("preview");
    }
  };

  const formatDuration = (sec: number) => {
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const handleNominalChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, "");
    const formatted = clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    setEditNominal(formatted);
  };

  const handleTypeChange = (newType: "Pengeluaran" | "Pemasukan") => {
    setEditType(newType);
    setEditCategory(
      newType === "Pengeluaran" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0],
    );
  };

  const categories =
    editType === "Pengeluaran" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={isRecording ? undefined : onDismiss} // Prevent accidental close while recording
        contentContainerStyle={styles.modal}
      >
        <View style={styles.sheetContainer}>
          {/* 1. Voice Assistant Recording / Listening State */}
          {(status === "idle" || status === "recording") && (
            <View style={styles.assistantContainer}>
              {/* Drag Handle */}
              <View style={styles.sheetIndicator} />

              {/* Voice Orb */}
              <View style={styles.orbContainer}>
                {status === "recording" && (
                  // FIX Bug #5: pointerEvents="none" pastikan pulse ring tidak menelan touch event
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.orbPulseRing, animatedPulseRingStyle]}
                  />
                )}
                <TouchableOpacity
                  onPress={
                    status === "recording" ? stopRecording : startRecording
                  }
                  activeOpacity={0.85}
                  style={styles.orbPressable}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.voiceOrb, animatedOrbStyle]}
                  >
                    <Ionicons name="mic" size={40} color="#FFFFFF" />
                  </Animated.View>
                </TouchableOpacity>
              </View>

              {/* Status Text */}
              <Text style={styles.assistantStatus}>
                {status === "recording"
                  ? "Sedang mendengarkan..."
                  : "Ceritakan transaksi Anda"}
              </Text>

              <Text style={styles.assistantHint}>
                {status === "recording"
                  ? "Katakan item belanja, nominal, dan cara bayar..."
                  : 'Katakan sesuatu seperti "Beli kopi 25 ribu cash"'}
              </Text>

              {/* Timer Badge */}
              {status === "recording" && (
                <View style={styles.timerBadge}>
                  <Text style={styles.timerBadgeText}>
                    {formatDuration(recordDuration)}
                  </Text>
                </View>
              )}

              {/* Live Waveform Equalizer */}
              {/* FIX Bug #4: Hapus pointerEvents="none" dari container waveform agar tidak memblokir touch tombol stop di bawahnya */}
              {status === "recording" ? (
                <View style={styles.waveformContainer}>
                  {waveform.map((val, idx) => (
                    <MotiView
                      key={idx}
                      from={{ height: 8 }}
                      animate={{ height: val * 44 + 8 }}
                      transition={{ type: "timing", duration: 100 }}
                      style={[
                        styles.waveBar,
                        {
                          backgroundColor:
                            idx % 2 === 0 ? "#FF90BB" : "#FFC1DA",
                        },
                      ]}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.waveformPlaceholder} />
              )}

              {/* Stop Button or Start Button Text */}
              {status === "recording" ? (
                <TouchableOpacity
                  onPress={stopRecording}
                  activeOpacity={0.85}
                  style={styles.stopCircleBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="stop" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <View style={{ alignItems: "center", gap: 4 }}>
                  <Button
                    mode="text"
                    onPress={startRecording}
                    textColor="#FF90BB"
                    labelStyle={{
                      fontFamily: "Poppins_600SemiBold",
                      fontSize: 13,
                    }}
                  >
                    Mulai Merekam
                  </Button>
                </View>
              )}
            </View>
          )}

          {/* 2. Voice Assistant Processing State */}
          {(status === "transcribing" || status === "parsing") && (
            <View style={styles.processingContainer}>
              {/* Drag Handle */}
              <View style={styles.sheetIndicator} />

              {/* Sparkle Glow Rotation */}
              <MotiView
                from={{ rotate: "0deg", scale: 0.95 }}
                animate={{ rotate: "360deg", scale: 1.05 }}
                transition={{
                  loop: true,
                  type: "timing",
                  duration: 2500,
                }}
                style={styles.processingIconContainer}
              >
                <Text style={styles.sparkleEmoji}>✨</Text>
              </MotiView>

              <Text style={styles.processingTitle}>Memproses transaksi...</Text>
              <Text style={styles.processingSubtitle}>
                Mohon tunggu sebentar
              </Text>

              {/* Real-time transcription feedback */}
              {transcription !== "" && (
                <View style={styles.processingTranscriptCard}>
                  <Text style={styles.processingTranscriptLabel}>
                    Suara Anda:
                  </Text>
                  <Text style={styles.processingTranscriptText}>
                    "{transcription}"
                  </Text>
                </View>
              )}

              <ActivityIndicator
                size="small"
                color="#FF90BB"
                style={{ marginTop: 24 }}
              />
            </View>
          )}

          {/* 3. Transaction Preview / Edit Form */}
          {status === "preview" && (
            <ScrollView
              style={{ width: "100%" }}
              contentContainerStyle={styles.previewContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sheetIndicator} />

              <Text style={styles.previewTitle}>Hasil Analisis AI</Text>
              <Text style={styles.transcriptionText}>"{transcription}"</Text>

              {isDemoMode && (
                <View style={styles.demoBanner}>
                  <Text style={styles.demoText}>
                    ℹ️ Menjalankan Mode Demo Offline (API Key tidak ditemukan)
                  </Text>
                </View>
              )}

              {errorMsg && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              )}

              {/* Editable Form Card */}
              <View style={styles.formCard}>
                {/* Type selector */}
                <View style={styles.rowToggles}>
                  <TouchableOpacity
                    onPress={() => handleTypeChange("Pengeluaran")}
                    activeOpacity={0.8}
                    style={[
                      styles.toggleBtn,
                      editType === "Pengeluaran" && styles.toggleActiveExpense,
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        editType === "Pengeluaran" && styles.toggleActiveText,
                      ]}
                    >
                      Pengeluaran
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleTypeChange("Pemasukan")}
                    activeOpacity={0.8}
                    style={[
                      styles.toggleBtn,
                      editType === "Pemasukan" && styles.toggleActiveIncome,
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        editType === "Pemasukan" && styles.toggleActiveText,
                      ]}
                    >
                      Pemasukan
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Item Name */}
                <TextInput
                  mode="outlined"
                  label="Item / Deskripsi"
                  value={editItem}
                  onChangeText={setEditItem}
                  outlineColor="#E2E8F0"
                  activeOutlineColor="#FF90BB"
                  style={styles.formInput}
                  outlineStyle={{ borderRadius: 12 }}
                />

                {/* Nominal */}
                <TextInput
                  mode="outlined"
                  label="Nominal"
                  value={editNominal}
                  onChangeText={handleNominalChange}
                  keyboardType="numeric"
                  left={<TextInput.Affix text="Rp " />}
                  outlineColor="#E2E8F0"
                  activeOutlineColor="#FF90BB"
                  style={styles.formInput}
                  outlineStyle={{ borderRadius: 12 }}
                />

                {/* Category Selection */}
                <Text style={styles.sectionLabel}>Kategori</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryScroll}
                >
                  {categories.map((cat) => {
                    const isSelected = editCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setEditCategory(cat)}
                        activeOpacity={0.8}
                        style={[
                          styles.categoryChip,
                          isSelected && styles.categoryChipSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isSelected && styles.chipTextSelected,
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Payment Method */}
                <Text style={styles.sectionLabel}>Metode Pembayaran</Text>
                <View style={styles.payToggles}>
                  <TouchableOpacity
                    onPress={() => setEditPembayaran("Cash")}
                    activeOpacity={0.8}
                    style={[
                      styles.payBtn,
                      editPembayaran === "Cash" && styles.payBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.payText,
                        editPembayaran === "Cash" && styles.payTextActive,
                      ]}
                    >
                      Tunai / Debit
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setEditPembayaran("Paylater")}
                    activeOpacity={0.8}
                    style={[
                      styles.payBtn,
                      editPembayaran === "Paylater" && styles.payBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.payText,
                        editPembayaran === "Paylater" && styles.payTextActive,
                      ]}
                    >
                      Paylater
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Notes (Optional) */}
                <TextInput
                  mode="outlined"
                  label="Catatan (Opsional)"
                  value={editCatatan}
                  onChangeText={setEditCatatan}
                  multiline
                  outlineColor="#E2E8F0"
                  activeOutlineColor="#FF90BB"
                  style={[styles.formInput, { minHeight: 60 }]}
                  outlineStyle={{ borderRadius: 12 }}
                />
              </View>

              {/* Form Buttons */}
              <View style={styles.buttonRow}>
                <Button
                  mode="outlined"
                  onPress={resetAll}
                  style={[styles.cancelBtn, { borderColor: "#CBD5E1" }]}
                  textColor="#64748B"
                >
                  Ulangi
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSaveParsed}
                  style={styles.saveBtn}
                  labelStyle={styles.saveBtnLabel}
                >
                  Simpan Transaksi
                </Button>
              </View>
            </ScrollView>
          )}

          {/* 4. Error Screen */}
          {status === "error" && (
            <View style={styles.actionContainer}>
              <View style={styles.sheetIndicator} />

              <Text style={styles.errorTitle}>Terjadi Kesalahan</Text>
              <Text style={styles.errorDesc}>
                {errorMsg ||
                  "Terjadi kesalahan tidak dikenal saat menganalisis."}
              </Text>

              <Button
                mode="contained"
                onPress={resetAll}
                style={styles.retryBtn}
              >
                Coba Lagi
              </Button>

              <Button
                mode="text"
                onPress={onDismiss}
                textColor="#64748B"
                style={{ marginTop: 8 }}
              >
                Batal
              </Button>
            </View>
          )}
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    margin: 0,
  },
  sheetContainer: {
    width: "100%",
    backgroundColor: "#FFFFFF", // White background
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 44 : 28,
    maxHeight: Dimensions.get("window").height * 0.9,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 20,
  },
  sheetIndicator: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 20,
  },
  assistantContainer: {
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  orbContainer: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    position: "relative",
    // FIX Bug #5: zIndex pada container agar stacking context jelas
    zIndex: 10,
  },
  orbPressable: {
    zIndex: 10,
    // Pastikan Pressable selalu di atas pulse ring
    elevation: 10,
  },
  voiceOrb: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FF90BB", // Primary
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF90BB",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  orbPulseRing: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#FFC1DA", // Secondary
    backgroundColor: "rgba(255, 193, 218, 0.35)",
    zIndex: 1,
  },
  assistantStatus: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 4,
  },
  assistantHint: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  timerBadge: {
    backgroundColor: "#FFF0F5",
    borderWidth: 1.5,
    borderColor: "#FF90BB",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
    shadowColor: "#FF90BB",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  timerBadgeText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 12,
    color: "#FF90BB",
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 60,
    gap: 4,
    marginBottom: 20,
    width: "100%",
  },
  waveformPlaceholder: {
    height: 60,
    marginBottom: 20,
  },
  waveBar: {
    width: 5,
    borderRadius: 2.5,
  },
  stopCircleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FF90BB",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF90BB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  processingContainer: {
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  processingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F8F8E1", // Surface
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#8ACCD5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  sparkleEmoji: {
    fontSize: 36,
  },
  processingTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: "#1E293B",
    marginBottom: 4,
    textAlign: "center",
  },
  processingSubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: "#64748B",
    marginBottom: 24,
    textAlign: "center",
  },
  processingTranscriptCard: {
    backgroundColor: "#FFF8E1",
    borderWidth: 1,
    borderColor: "rgba(255, 144, 187, 0.15)",
    borderRadius: 16,
    padding: 16,
    width: "90%",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  processingTranscriptLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: "#FF90BB",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  processingTranscriptText: {
    fontFamily: "Poppins_400Regular_Italic",
    fontSize: 13,
    color: "#475569",
    fontStyle: "italic",
    lineHeight: 18,
  },
  actionContainer: {
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  previewContainer: {
    width: "100%",
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  previewTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 20,
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 4,
  },
  transcriptionText: {
    fontFamily: "Poppins_400Regular_Italic",
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  demoBanner: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
  },
  demoText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: "#B45309",
    textAlign: "center",
  },
  errorBox: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: "#B91C1C",
    textAlign: "center",
  },
  formCard: {
    width: "100%",
    marginBottom: 20,
  },
  rowToggles: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  toggleActiveExpense: {
    backgroundColor: "#FF90BB",
  },
  toggleActiveIncome: {
    backgroundColor: "#8ACCD5",
  },
  toggleText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: "#64748B",
  },
  toggleActiveText: {
    color: "#FFFFFF",
  },
  formInput: {
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
    fontSize: 14,
  },
  sectionLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: "#1E293B",
    marginTop: 8,
    marginBottom: 8,
  },
  categoryScroll: {
    marginBottom: 16,
  },
  categoryChip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  categoryChipSelected: {
    backgroundColor: "#FFC1DA",
    borderColor: "#FF90BB",
  },
  chipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: "#64748B",
  },
  chipTextSelected: {
    color: "#1E293B",
  },
  payToggles: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  payBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  payBtnActive: {
    backgroundColor: "#E6F4F8",
    borderColor: "#8ACCD5",
  },
  payText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: "#64748B",
  },
  payTextActive: {
    color: "#1E293B",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: "#FF90BB",
    borderRadius: 12,
  },
  saveBtnLabel: {
    fontFamily: "Poppins_600SemiBold",
    color: "#FFFFFF",
  },
  errorTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 20,
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 12,
  },
  errorDesc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    paddingHorizontal: 24,
    lineHeight: 18,
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: "#FF90BB",
    borderRadius: 12,
    width: "100%",
  },
});
