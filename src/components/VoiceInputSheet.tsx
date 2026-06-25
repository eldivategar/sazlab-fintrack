import React, { useState, useEffect, useRef, useCallback } from "react";
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

import { MotiView, MotiText } from "moti";

import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorderState,
} from "expo-audio";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  cancelAnimation,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../stores/useAuthStore";
import { useSheetStore } from "../stores/useSheetStore";
import { transcribeAudio, SpeechApiError } from "../services/speechToText";
import {
  parseTransactionWithSumopod,
  SumopodAiError,
  ParsedTransaction,
  ParsedTransactionResponse,
} from "../services/aiParser";

export interface EditableTransaction {
  id: string;
  item: string;
  nominal: string;
  type: "Pengeluaran" | "Pemasukan";
  kategori: string;
  pembayaran: "Cash" | "Paylater";
  catatan: string;
}

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

const LEFT_SCALES = [0.1, 0.15, 0.2, 0.25, 0.3, 0.5, 0.8, 1.2, 1.0, 0.6];
const RIGHT_SCALES = [0.6, 1.0, 1.2, 0.8, 0.5, 0.3, 0.25, 0.2, 0.15, 0.1];

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
    let timer: any = window.setTimeout(() => {
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
  const audioRecorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const audioRecorderState = useAudioRecorderState(audioRecorder, 100);
  const [recordDuration, setRecordDuration] = useState(0);

  // ─── Waveform: simple state array, diupdate tiap metering tick ───────────────
  const BAR_COUNT = 28;
  const [waveHeights, setWaveHeights] = useState<number[]>(
    Array(BAR_COUNT).fill(4),
  );
  const waveBufferRef = useRef<number[]>(Array(BAR_COUNT).fill(0.04));
  const waveIntervalRef = useRef<any>(null);
  const currentVolRef = useRef(0);
  const isRecordingRef = useRef(false);

  const startWaveInterval = useCallback(() => {
    if (waveIntervalRef.current) clearInterval(waveIntervalRef.current);
    waveIntervalRef.current = setInterval(() => {
      if (!isRecordingRef.current) return;
      const vol = currentVolRef.current;
      const buf = waveBufferRef.current;
      const center = (BAR_COUNT - 1) / 2;
      // Scroll kiri, push nilai baru di kanan
      for (let i = 0; i < BAR_COUNT - 1; i++) buf[i] = buf[i + 1];
      buf[BAR_COUNT - 1] = Math.min(
        1,
        Math.max(0.04, vol * (0.8 + Math.random() * 0.4)),
      );
      // Hitung tinggi bar dengan bell-curve shape
      const heights = buf.map((v, i) => {
        const dist = Math.abs(i - center) / center;
        const shape = 1 - dist * 0.45;
        return Math.max(4, v * 60 * shape);
      });
      setWaveHeights([...heights]);
    }, 60);
  }, []);

  const stopWaveInterval = useCallback(() => {
    isRecordingRef.current = false;
    if (waveIntervalRef.current) {
      clearInterval(waveIntervalRef.current);
      waveIntervalRef.current = null;
    }
    waveBufferRef.current = Array(BAR_COUNT).fill(0.04);
    currentVolRef.current = 0;
    setWaveHeights(Array(BAR_COUNT).fill(4));
  }, []);

  const [transcription, setTranscription] = useState("");
  const [parsedTransactions, setParsedTransactions] = useState<
    EditableTransaction[]
  >([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Demo Mode Flags (activated if API keys are missing)
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Editable array managed in parsedTransactions state

  const timerRef = useRef<any>(null);
  // useRef<any> untuk MediaRecorder agar tidak error TypeScript di environment React Native
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<any[]>([]);
  const prevVisibleRef = useRef(false);
  const isDemoModeRef = useRef(false);

  // Voice assistant animations using Reanimated (orb + pulse rings saja)
  const orbScale = useSharedValue(1);
  const pulseScale1 = useSharedValue(1);
  const pulseOpacity1 = useSharedValue(0);
  const pulseScale2 = useSharedValue(1);
  const pulseOpacity2 = useSharedValue(0);

  const animatedOrbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  const animatedPulseRingStyle1 = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale1.value }],
    opacity: pulseOpacity1.value,
  }));

  const animatedPulseRingStyle2 = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale2.value }],
    opacity: pulseOpacity2.value,
  }));

  const handleCancel = () => {
    resetAll();
    onDismiss();
  };

  // ─── Helper: terima volume dari audio source ──────────────────────────────────
  const updateVolume = useCallback(
    (normalized: number) => {
      // Simpan ke ref — interval waveform akan pakai ini tiap tick
      currentVolRef.current = normalized;

      // Orb scale reaktif via withSpring
      orbScale.value = withSpring(1.0 + normalized * 0.22, {
        damping: 7,
        stiffness: 160,
      });

      // Pulse rings reaktif
      const dur = Math.max(350, 1100 - normalized * 750);
      const maxScale = 1.5 + normalized * 0.55;
      const maxOpacity = 0.12 + normalized * 0.38;

      pulseScale1.value = withTiming(maxScale, { duration: dur }, () => {
        "worklet";
        pulseScale1.value = 1.0;
      });
      pulseOpacity1.value = withSequence(
        withTiming(maxOpacity, { duration: 60 }),
        withTiming(0, { duration: dur - 60 }),
      );
      pulseScale2.value = withTiming(
        maxScale * 1.18,
        { duration: dur * 1.35 },
        () => {
          "worklet";
          pulseScale2.value = 1.0;
        },
      );
      pulseOpacity2.value = withSequence(
        withTiming(maxOpacity * 0.55, { duration: 60 }),
        withTiming(0, { duration: dur * 1.35 - 60 }),
      );
    },
    [orbScale, pulseScale1, pulseOpacity1, pulseScale2, pulseOpacity2],
  );

  const updateVolumeRef = useRef(updateVolume);
  useEffect(() => {
    updateVolumeRef.current = updateVolume;
  }, [updateVolume]);
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRecordDuration((prev) => prev + 1);
    }, 1000);
  };

  // ─── Reset semua state ke kondisi awal ───────────────────────────────────────
  const resetAll = () => {
    if (audioRecorder.isRecording) {
      try {
        audioRecorder.stop();
      } catch (e) {}
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
    setRecordDuration(0);
    stopWaveInterval();
    setTranscription("");
    setParsedTransactions([]);
    setErrorMsg(null);
    setIsDemoMode(false);
    isDemoModeRef.current = false;
  };

  // ─── Effects ─────────────────────────────────────────────────────────────────

  // Waveform + orb via expo-audio metering (native)
  useEffect(() => {
    if (status === "recording" && audioRecorderState?.metering !== undefined) {
      // expo-audio metering range: -160 (silent) to 0 (max)
      const normalized = Math.max(
        0.04,
        Math.min(1.0, (audioRecorderState.metering + 160) / 160),
      );
      updateVolume(normalized);
    }
  }, [audioRecorderState?.metering, status, updateVolume]);

  // Animasi orb & wave interval saat status recording berubah
  const idleWaveIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (status === "recording") {
      isRecordingRef.current = true;
      startWaveInterval();

      // Orb breathing baseline
      orbScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 650 }),
          withTiming(1.0, { duration: 650 }),
        ),
        -1,
        true,
      );
      pulseScale1.value = withRepeat(
        withTiming(1.6, { duration: 1600 }),
        -1,
        false,
      );
      pulseOpacity1.value = withRepeat(
        withSequence(
          withTiming(0.15, { duration: 0 }),
          withTiming(0, { duration: 1600 }),
        ),
        -1,
        false,
      );
      pulseScale2.value = withRepeat(
        withSequence(
          withTiming(1.0, { duration: 650 }),
          withTiming(1.8, { duration: 950 }),
        ),
        -1,
        false,
      );
      pulseOpacity2.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 650 }),
          withTiming(0.08, { duration: 0 }),
          withTiming(0, { duration: 950 }),
        ),
        -1,
        false,
      );
    } else {
      stopWaveInterval();
      cancelAnimation(orbScale);
      cancelAnimation(pulseScale1);
      cancelAnimation(pulseOpacity1);
      cancelAnimation(pulseScale2);
      cancelAnimation(pulseOpacity2);
      orbScale.value = withTiming(1, { duration: 200 });
      pulseScale1.value = 1;
      pulseOpacity1.value = 0;
      pulseScale2.value = 1;
      pulseOpacity2.value = 0;
    }
  }, [status]);

  // Cleanup saat unmount
  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (waveIntervalRef.current) clearInterval(waveIntervalRef.current);
    };
  }, []);

  // Reset state setiap kali modal dibuka (dari tertutup → terbuka)
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      if (Platform.OS !== "web") {
        AudioModule.requestRecordingPermissionsAsync().catch((err: any) => {
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

      // Waveform via AnalyserNode (Web Audio API) — pakai rAF agar smooth
      const AudioCtx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let webRaf: any = null;

      const webAudioTick = () => {
        if (!isRecordingRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        // Fokus ke frekuensi suara manusia (~80Hz–3kHz = bin 1..~60 dari 256 bin)
        let sum = 0;
        const voiceBins = Math.floor(dataArray.length * 0.25);
        for (let i = 1; i < voiceBins; i++) sum += dataArray[i];
        const avg = sum / (voiceBins - 1);
        const normalized = Math.max(0.04, Math.min(1.0, avg / 100));
        updateVolumeRef.current(normalized);
        webRaf = requestAnimationFrame(webAudioTick);
      };
      webRaf = requestAnimationFrame(webAudioTick);

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
        if (webRaf) cancelAnimationFrame(webRaf);
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

      isRecordingRef.current = true;
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

  // ─── NATIVE: rekam pakai expo-audio (iOS & Android) ─────────────────────────────
  const startRecordingNative = async () => {
    console.log("[VoiceInputSheet] startRecordingNative dipanggil");
    try {
      console.log("[VoiceInputSheet] Native: Meminta izin mikrofon...");
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setStatus("error");
        setErrorMsg("Izin mikrofon diperlukan.");
        return;
      }

      console.log("[VoiceInputSheet] Native: Mengatur Audio Mode...");
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      console.log(
        "[VoiceInputSheet] Native: Menyiapkan dan memulai perekaman...",
      );
      await audioRecorder.prepareToRecordAsync();

      if (isDemoModeRef.current) {
        console.log(
          "[VoiceInputSheet] Native: Mengabaikan recording karena pengguna memilih Mode Demo.",
        );
        return;
      }

      audioRecorder.record();
      console.log("[VoiceInputSheet] Native: Perekaman berhasil dimulai");
      isRecordingRef.current = true;
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
    console.log("[VoiceInputSheet] Platform:", Platform.OS);
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
        throw new Error("MISSING_API_KEY");
      }

      const textResult = await transcribeAudio(uri, groqApiKey);
      setTranscription(textResult);

      setStatus("parsing");
      const parsed = await parseTransactionWithSumopod(
        textResult,
        sumopodApiKey,
      );

      // Validasi data hasil parsing AI
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray(parsed.transactions) ||
        parsed.transactions.length === 0
      ) {
        throw new Error("JSON_PARSE_FAILED");
      }

      const firstValid = parsed.transactions.find(
        (t) => t.item && t.item.trim() !== "",
      );
      if (!firstValid) {
        throw new Error("INVALID_ITEM");
      }

      const firstValidNominal = parsed.transactions.find(
        (t) =>
          t.nominal !== undefined &&
          t.nominal !== null &&
          !isNaN(t.nominal) &&
          t.nominal > 0,
      );
      if (!firstValidNominal) {
        throw new Error("INVALID_NOMINAL");
      }

      setupForm(parsed);
      setStatus("preview");
    } catch (err: any) {
      // console.error('Audio processing failed:', err);
      if (err instanceof SpeechApiError && err.message === "MISSING_API_KEY") {
        throw new Error("MISSING_API_KEY");
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
      // Native (iOS/Android): pakai expo-audio
      try {
        await audioRecorder.stop();
        const uri = audioRecorder.uri;
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: false,
        });

        if (!uri) throw new Error("File rekaman tidak ditemukan.");
        await processAudioUri(uri);
      } catch (err: any) {
        console.warn("Stop native recording failed:", err);
        setStatus("error");
        setErrorMsg(err.message || "Gagal menghentikan perekaman.");
      }
    }
  };

  const setupForm = (parsed: ParsedTransactionResponse) => {
    const edits = parsed.transactions.map((t, idx) => ({
      id: `tx-${idx}-${Date.now()}`,
      item: t.item || "",
      nominal: t.nominal
        ? t.nominal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
        : "",
      type: t.type || "Pengeluaran",
      kategori:
        t.kategori ||
        (t.type === "Pemasukan" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]),
      pembayaran: t.pembayaran || "Cash",
      catatan: "",
    }));
    setParsedTransactions(edits);
  };

  const handleSaveParsed = async () => {
    setErrorMsg(null);

    if (parsedTransactions.length === 0) {
      setErrorMsg("Tidak ada transaksi untuk disimpan.");
      return;
    }

    for (let i = 0; i < parsedTransactions.length; i++) {
      const tx = parsedTransactions[i];
      const cleanNominal = Number(tx.nominal.replace(/[^0-9]/g, ""));
      if (!tx.item.trim()) {
        setErrorMsg(`Deskripsi item pada transaksi ke-${i + 1} wajib diisi.`);
        return;
      }
      if (cleanNominal <= 0) {
        setErrorMsg(
          `Nominal pada transaksi ke-${i + 1} harus lebih besar dari Rp 0.`,
        );
        return;
      }
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

      for (const tx of parsedTransactions) {
        const cleanNominal = Number(tx.nominal.replace(/[^0-9]/g, ""));
        await addTransaction(token, {
          tanggal: dateStr,
          kategori: `${tx.type === "Pemasukan" ? "Pemasukan" : "Pengeluaran"}: ${tx.kategori}`,
          keterangan: tx.item.trim(),
          nominal: cleanNominal,
          pembayaran: tx.pembayaran,
          catatan: tx.catatan.trim(),
          sumberInput: "Voice",
        });
      }

      onDismiss();
    } catch (err: any) {
      console.warn("Failed to save parsed voice transaction:", err);
      setErrorMsg(err.message || "Gagal memasukkan data ke Google Sheets.");
      setStatus("preview");
    }
  };

  const updateTransaction = (
    id: string,
    field: keyof EditableTransaction,
    value: any,
  ) => {
    setParsedTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id === id) {
          if (field === "type" && tx.type !== value) {
            return {
              ...tx,
              type: value,
              kategori:
                value === "Pengeluaran"
                  ? EXPENSE_CATEGORIES[0]
                  : INCOME_CATEGORIES[0],
            };
          }
          if (field === "nominal") {
            const clean = value.replace(/[^0-9]/g, "");
            const formatted = clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            return { ...tx, nominal: formatted };
          }
          return { ...tx, [field]: value };
        }
        return tx;
      }),
    );
  };

  const removeTransaction = (id: string) => {
    setParsedTransactions((prev) => prev.filter((tx) => tx.id !== id));
  };

  const formatDuration = (sec: number) => {
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  // categories and handlers removed since they are handled per transaction in updateTransaction

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

              {/* Title & Hint */}
              <Text style={styles.assistantStatus}>
                Ceritakan transaksi Anda
              </Text>
              <Text style={styles.assistantHint}>
                Katakan sesuatu seperti{"\n"}"Beli kopi 25 ribu cash"
              </Text>

              {/* Main Center Area: Orb */}
              <View style={styles.orbWrapper}>
                {status === "recording" && (
                  <>
                    <Animated.View
                      pointerEvents="none"
                      style={[styles.orbPulseRing, animatedPulseRingStyle1]}
                    />
                    <Animated.View
                      pointerEvents="none"
                      style={[styles.orbPulseRing, animatedPulseRingStyle2]}
                    />
                  </>
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
                    <Ionicons
                      name={status === "recording" ? "stop" : "mic"}
                      size={40}
                      color="#FFFFFF"
                    />
                  </Animated.View>
                </TouchableOpacity>
              </View>

              {/* Full-width Waveform */}
              <View style={styles.waveformContainer}>
                {waveHeights.map((h, idx) => {
                  const center = (BAR_COUNT - 1) / 2;
                  const dist = Math.abs(idx - center) / center;
                  const opacity = 0.28 + (1 - dist) * 0.72;
                  return (
                    <MotiView
                      key={`bar-${idx}`}
                      animate={{ height: h }}
                      transition={{
                        type: "spring",
                        damping: 12,
                        stiffness: 220,
                        mass: 0.6,
                      }}
                      style={[
                        styles.waveBar,
                        { opacity, backgroundColor: "#FF7096" },
                      ]}
                    />
                  );
                })}
              </View>

              {/* Timer Duration */}
              <Text style={styles.durationTimerText}>
                {formatDuration(recordDuration)}
              </Text>

              {/* Status Capsule */}
              <View
                style={[
                  styles.statusCapsule,
                  status === "recording"
                    ? styles.statusCapsuleListening
                    : styles.statusCapsuleIdle,
                ]}
              >
                {status === "recording" ? (
                  <MotiView
                    from={{ opacity: 0.3 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      type: "timing",
                      duration: 800,
                      loop: true,
                      repeatReverse: true,
                    }}
                    style={[styles.statusDot, { backgroundColor: "#10B981" }]}
                  />
                ) : (
                  <View
                    style={[styles.statusDot, { backgroundColor: "#94A3B8" }]}
                  />
                )}
                <Text
                  style={[
                    styles.statusCapsuleText,
                    status === "recording"
                      ? { color: "#10B981" }
                      : { color: "#64748B" },
                  ]}
                >
                  {status === "recording"
                    ? "Sedang mendengarkan..."
                    : "Tekan mic untuk mulai"}
                </Text>
              </View>

              {/* Cancel Button */}
              <TouchableOpacity
                onPress={handleCancel}
                activeOpacity={0.8}
                style={styles.cancelBtnCapsule}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={20}
                  color="#FF7096"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.cancelBtnCapsuleText}>Batalkan</Text>
              </TouchableOpacity>
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
            <View style={{ width: "100%", flexShrink: 1 }}>
              <View
                style={{
                  width: "100%",
                  paddingHorizontal: 24,
                  alignItems: "center",
                }}
              >
                <View style={styles.sheetIndicator} />

                <Text style={styles.previewTitle}>Hasil Analisis AI</Text>
                <Text style={styles.transcriptionText}>"{transcription}"</Text>
              </View>

              <ScrollView
                style={{ width: "100%" }}
                contentContainerStyle={styles.previewContainer}
                showsVerticalScrollIndicator={false}
              >
                {errorMsg && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                )}

                {/* Editable Form Cards */}
                {parsedTransactions.map((tx, index) => {
                  const txCategories =
                    tx.type === "Pengeluaran"
                      ? EXPENSE_CATEGORIES
                      : INCOME_CATEGORIES;

                  return (
                    <View key={tx.id} style={styles.formCard}>
                      <View style={styles.txHeaderRow}>
                        <Text style={styles.txHeaderLabel}>
                          Transaksi {index + 1}
                        </Text>
                        {parsedTransactions.length > 1 && (
                          <TouchableOpacity
                            onPress={() => removeTransaction(tx.id)}
                            style={styles.txRemoveBtn}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={18}
                              color="#EF4444"
                            />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Type selector */}
                      <View style={styles.rowToggles}>
                        <TouchableOpacity
                          onPress={() =>
                            updateTransaction(tx.id, "type", "Pengeluaran")
                          }
                          activeOpacity={0.8}
                          style={[
                            styles.toggleBtn,
                            tx.type === "Pengeluaran" &&
                              styles.toggleActiveExpense,
                          ]}
                        >
                          <Text
                            style={[
                              styles.toggleText,
                              tx.type === "Pengeluaran" &&
                                styles.toggleActiveText,
                            ]}
                          >
                            Pengeluaran
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() =>
                            updateTransaction(tx.id, "type", "Pemasukan")
                          }
                          activeOpacity={0.8}
                          style={[
                            styles.toggleBtn,
                            tx.type === "Pemasukan" &&
                              styles.toggleActiveIncome,
                          ]}
                        >
                          <Text
                            style={[
                              styles.toggleText,
                              tx.type === "Pemasukan" &&
                                styles.toggleActiveText,
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
                        value={tx.item}
                        onChangeText={(val) =>
                          updateTransaction(tx.id, "item", val)
                        }
                        outlineColor="#E2E8F0"
                        activeOutlineColor="#FF90BB"
                        style={styles.formInput}
                        outlineStyle={{ borderRadius: 12 }}
                      />

                      {/* Nominal */}
                      <TextInput
                        mode="outlined"
                        label="Nominal"
                        value={tx.nominal}
                        onChangeText={(val) =>
                          updateTransaction(tx.id, "nominal", val)
                        }
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
                        {txCategories.map((cat) => {
                          const isSelected = tx.kategori === cat;
                          return (
                            <TouchableOpacity
                              key={cat}
                              onPress={() =>
                                updateTransaction(tx.id, "kategori", cat)
                              }
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
                          onPress={() =>
                            updateTransaction(tx.id, "pembayaran", "Cash")
                          }
                          activeOpacity={0.8}
                          style={[
                            styles.payBtn,
                            tx.pembayaran === "Cash" && styles.payBtnActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.payText,
                              tx.pembayaran === "Cash" && styles.payTextActive,
                            ]}
                          >
                            Tunai / Debit
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() =>
                            updateTransaction(tx.id, "pembayaran", "Paylater")
                          }
                          activeOpacity={0.8}
                          style={[
                            styles.payBtn,
                            tx.pembayaran === "Paylater" && styles.payBtnActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.payText,
                              tx.pembayaran === "Paylater" &&
                                styles.payTextActive,
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
                        value={tx.catatan}
                        onChangeText={(val) =>
                          updateTransaction(tx.id, "catatan", val)
                        }
                        multiline
                        outlineColor="#E2E8F0"
                        activeOutlineColor="#FF90BB"
                        style={[styles.formInput, { minHeight: 60 }]}
                        outlineStyle={{ borderRadius: 12 }}
                      />
                    </View>
                  );
                })}

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
            </View>
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
  centerWaveRow: {
    // kept for backward compat if referenced elsewhere
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: 140,
    gap: 8,
  },
  waveformSide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 60,
    gap: 4,
  },
  orbWrapper: {
    width: 140,
    height: 140,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginVertical: 8,
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: 70,
    paddingHorizontal: 16,
    gap: 3,
    marginBottom: 8,
  },
  orbPressable: {
    zIndex: 10,
    // Pastikan Pressable selalu di atas pulse ring
    elevation: 10,
  },
  voiceOrb: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#FF7096",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF7096",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  orbPulseRing: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1.5,
    borderColor: "#FFC1DA",
    backgroundColor: "rgba(255, 193, 218, 0.15)",
    zIndex: 1,
  },
  assistantStatus: {
    fontFamily: "Poppins_700Bold",
    fontSize: 20,
    color: "#273240",
    textAlign: "center",
    marginBottom: 8,
    marginTop: 8,
  },
  assistantHint: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#7F8E9C",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  durationTimerText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 16,
    color: "#7F8E9C",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  statusCapsule: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusCapsuleListening: {
    borderColor: "rgba(16, 185, 129, 0.2)",
    backgroundColor: "rgba(16, 185, 129, 0.05)",
  },
  statusCapsuleIdle: {
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusCapsuleText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  cancelBtnCapsule: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cancelBtnCapsuleText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#FF7096",
  },
  waveBar: {
    width: 4,
    borderRadius: 3,
    minHeight: 4,
  },
  stopCircleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FF7096",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF7096",
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
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  txHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  txHeaderLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#334155",
  },
  txRemoveBtn: {
    padding: 4,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
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
