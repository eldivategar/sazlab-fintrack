import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export class SpeechApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SpeechApiError';
    this.status = status;
  }
}

/**
 * Maps a file URI extension to the correct MIME type accepted by Groq.
 * Groq accepts: flac, mp3, mp4, mpeg, mpga, m4a, ogg, opus, wav, webm
 */
function getMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.wav'))  return 'audio/wav';
  if (lower.endsWith('.mp3'))  return 'audio/mpeg';
  if (lower.endsWith('.mp4'))  return 'audio/mp4';
  if (lower.endsWith('.m4a'))  return 'audio/mp4';  // .m4a MIME type is audio/mp4 (RFC standard)
  if (lower.endsWith('.ogg'))  return 'audio/ogg';
  if (lower.endsWith('.opus')) return 'audio/opus';
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.webm')) return 'audio/webm';
  if (lower.endsWith('.caf'))  return 'audio/x-caf';
  if (lower.endsWith('.3gp'))  return 'audio/3gpp';
  // Default fallback: treat as m4a (most common Android expo-audio output)
  return 'audio/mp4';
}

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

/**
 * Transcribes audio file using Groq's Whisper API.
 * Uses FileSystem.uploadAsync on native (Android/iOS) for reliable binary upload,
 * and fetch + Blob on web.
 *
 * @param uri   Local file URI from expo-audio recording.
 * @param apiKey Groq API Key.
 * @returns Transcribed text.
 */
export async function transcribeAudio(uri: string, apiKey: string | undefined): Promise<string> {
  if (!apiKey || apiKey.startsWith('placeholder') || apiKey.trim() === '') {
    throw new SpeechApiError('MISSING_API_KEY');
  }

  const originalFileName = uri.split('/').pop() || 'recording.m4a';
  let uploadUri = uri;
  let finalFileName = originalFileName;

  // Pre-process for Native (copy to a path with valid extension if needed)
  if (Platform.OS !== 'web') {
    const lowerUri = uri.toLowerCase();
    const hasValidNativeExt = ['.flac', '.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.ogg', '.opus', '.wav', '.webm'].some(ext => lowerUri.endsWith(ext));
    if (!hasValidNativeExt) {
      const tempUri = `${FileSystem.cacheDirectory}recording_upload.m4a`;
      try {
        const fileInfo = await FileSystem.getInfoAsync(tempUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(tempUri, { idempotent: true });
        }
        await FileSystem.copyAsync({
          from: uri,
          to: tempUri
        });
        uploadUri = tempUri;
        finalFileName = 'recording_upload.m4a';
      } catch (err) {
        console.warn('Failed to copy file to temp path with extension, proceeding with original URI:', err);
      }
    }
  }

  const mimeType = getMimeType(finalFileName);

  try {
    let responseText: string;

    if (Platform.OS === 'web') {
      // ── Web ──────────────────────────────────────────────────────────────────
      // fetch the local blob URL directly, then use FormData
      const fileResponse = await fetch(uri);
      const blob = await fileResponse.blob();

      // Determine extension from blob.type
      let ext = '.webm'; // default fallback for web
      if (blob.type) {
        const typeLower = blob.type.toLowerCase();
        if (typeLower.includes('audio/wav') || typeLower.includes('audio/x-wav')) {
          ext = '.wav';
        } else if (typeLower.includes('audio/mp4') || typeLower.includes('audio/m4a') || typeLower.includes('audio/aac')) {
          ext = '.m4a';
        } else if (typeLower.includes('audio/ogg')) {
          ext = '.ogg';
        } else if (typeLower.includes('audio/mpeg') || typeLower.includes('audio/mp3')) {
          ext = '.mp3';
        } else if (typeLower.includes('audio/webm')) {
          ext = '.webm';
        }
      }

      // Ensure the web file name ends with a supported extension
      const supportedExtensions = ['.flac', '.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.ogg', '.opus', '.wav', '.webm'];
      const webFileName = supportedExtensions.some(e => finalFileName.toLowerCase().endsWith(e))
        ? finalFileName
        : `${finalFileName}${ext}`;

      const formData = new FormData();
      formData.append('file', blob, webFileName);
      formData.append('model', 'whisper-large-v3');
      formData.append('language', 'id');
      formData.append('prompt', 'ketoprak, es teh, paylater, cash, tunai, bon, utang, cicilan, gopay, ovo, dana, shopeepay, gofood, grabfood, gojek, grab, bensin, parkir, indomaret, alfamart');

      const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.text();
        throw new SpeechApiError(`Groq Audio Transcription API failed: ${err}`, response.status);
      }

      responseText = await response.text();
    } else {
      // ── Android / iOS ─────────────────────────────────────────────────────────
      // FileSystem.uploadAsync sends the file as raw binary multipart — no base64 needed.
      const uploadResult = await FileSystem.uploadAsync(GROQ_URL, uploadUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType,
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        parameters: {
          model: 'whisper-large-v3',
          language: 'id',
          prompt: 'ketoprak, es teh, paylater, cash, tunai, bon, utang, cicilan, gopay, ovo, dana, shopeepay, gofood, grabfood, gojek, grab, bensin, parkir, indomaret, alfamart',
          temperature: '0',
        },
      });

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new SpeechApiError(
          `Groq Audio Transcription API failed: ${uploadResult.body}`,
          uploadResult.status,
        );
      }

      responseText = uploadResult.body;
    }

    const data = JSON.parse(responseText);
    const transcript: string = data.text;

    if (!transcript || transcript.trim() === '') {
      throw new SpeechApiError('NO_SPEECH_DETECTED');
    }

    const cleanText = transcript.trim();
    // Filter halusinasi umum dari Whisper saat audio kosong/noise
    const hallucinationRegex = /^(terima kasih(\s*(sudah|telah)\s*menonton)?|thank you(\s*for\s*watching)?|subtitles?\s*by.*|diterjemahkan\s*oleh.*)[.!]*$/i;
    if (hallucinationRegex.test(cleanText) || cleanText.length < 3) {
      throw new SpeechApiError('NO_SPEECH_DETECTED');
    }

    return cleanText;

  } catch (error) {
    console.warn('Error in transcribeAudio with Groq:', error);
    throw error;
  } finally {
    // Cleanup temporary file on Native if it was created
    if (Platform.OS !== 'web' && uploadUri !== uri) {
      try {
        await FileSystem.deleteAsync(uploadUri, { idempotent: true });
      } catch (e) {
        console.warn('Failed to delete temp recording file:', e);
      }
    }
  }
}
