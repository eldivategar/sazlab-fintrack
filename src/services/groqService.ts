// ponytail: minimal Groq API streaming client (OpenAI compatible)
export interface ChatMessagePayload {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamGroqOptions {
  messages: ChatMessagePayload[];
  systemPrompt?: string;
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

const GROQ_API_URL =
  process.env.EXPO_PUBLIC_GROQ_BASE_URL ||
  "https://api.groq.com/openai/v1/chat/completions";

export function streamGroqChat({
  messages,
  systemPrompt,
  onChunk,
  onComplete,
  onError,
}: StreamGroqOptions): () => void {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    onError(new Error("API Key Groq (EXPO_PUBLIC_GROQ_API_KEY) belum dikonfigurasi di .env"));
    return () => {};
  }

  if (!messages || messages.length === 0) {
    onError(new Error("Pesan masukan tidak boleh kosong"));
    return () => {};
  }

  const payloadMessages: ChatMessagePayload[] = [];
  if (systemPrompt) {
    payloadMessages.push({ role: "system", content: systemPrompt });
  }
  payloadMessages.push(...messages);

  let isAborted = false;
  const xhr = new XMLHttpRequest();
  let processedIndex = 0;
  let fullAccumulatedText = "";

  xhr.open("POST", GROQ_API_URL, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.setRequestHeader("Authorization", `Bearer ${apiKey}`);

  xhr.onreadystatechange = () => {
    if (isAborted) return;

    if (xhr.readyState === 3 || xhr.readyState === 4) {
      const responseText = xhr.responseText || "";
      const newText = responseText.substring(processedIndex);
      processedIndex = responseText.length;

      const lines = newText.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;

        if (trimmed === "data: [DONE]") {
          continue;
        }

        if (trimmed.startsWith("data: ")) {
          try {
            const jsonStr = trimmed.replace(/^data:\s*/, "");
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content || "";
            if (content) {
              fullAccumulatedText += content;
              onChunk(content);
            }
          } catch (e) {
            // Ignore partial SSE chunk parse errors
          }
        }
      }
    }

    if (xhr.readyState === 4) {
      if (xhr.status >= 200 && xhr.status < 300) {
        onComplete(fullAccumulatedText);
      } else if (!isAborted) {
        let errMessage = `Groq API Error (Status ${xhr.status})`;
        if (xhr.status === 429) {
          errMessage = "Batas penggunaan API AI tercapai. Silakan coba beberapa saat lagi.";
        } else if (xhr.status === 401) {
          errMessage = "API Key Groq tidak valid atau telah kedaluwarsa.";
        } else {
          try {
            const errObj = JSON.parse(xhr.responseText);
            if (errObj.error?.message) errMessage = errObj.error.message;
          } catch (_) {}
        }
        onError(new Error(errMessage));
      }
    }
  };

  xhr.onerror = () => {
    if (!isAborted) {
      onError(new Error("Gagal terhubung ke server Groq API. Periksa koneksi internet Anda."));
    }
  };

  xhr.send(
    JSON.stringify({
      model: process.env.EXPO_PUBLIC_GROQ_MODEL || "llama-3.1-8b-instant",
      messages: payloadMessages,
      stream: true,
      temperature: 0.7,
    })
  );

  return () => {
    isAborted = true;
    xhr.abort();
  };
}
