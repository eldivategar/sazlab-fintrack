export interface ParsedTransaction {
  type: "Pengeluaran" | "Pemasukan";
  item: string;
  nominal: number;
  kategori: string;
  pembayaran: "Cash" | "Paylater";
}

export interface ParsedTransactionResponse {
  transactions: ParsedTransaction[];
}

export class AIParserError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AIParserError";
    this.status = status;
  }
}

/**
 * Sends transaction natural language text to Groq API for structural parsing into JSON.
 * @param text The natural language string (e.g. 'beli bensin 50rb pakai cash')
 * @param apiKey Groq API Key
 */
export async function parseTransactionWithAI(
  text: string,
  apiKey: string | undefined,
): Promise<ParsedTransactionResponse> {
  const effectiveApiKey = apiKey || process.env.EXPO_PUBLIC_GROQ_API_KEY;

  if (
    !effectiveApiKey ||
    effectiveApiKey.startsWith("placeholder") ||
    effectiveApiKey.trim() === ""
  ) {
    throw new AIParserError("MISSING_API_KEY");
  }

  const url =
    process.env.EXPO_PUBLIC_GROQ_BASE_URL ||
    "https://api.groq.com/openai/v1/chat/completions";
  const systemPrompt = `
You are a financial transaction parser.
The user may mention ONE OR MANY transactions.
The transcript comes from speech-to-text and may contain transcription mistakes.

Before extracting transactions:
- Correct words based on Indonesian financial context.
- Examples:
  - pen lighter → paylater
  - kiris → qris
  - go pay → gopay

Do NOT modify merchant names, food names, item names, or descriptions unless absolutely certain.
Preserve the original item name whenever possible.

Extract ALL transactions you can find.
Return JSON with this schema:
{
  "transactions": [
    {
      "type": "Pengeluaran" | "Pemasukan",
      "item": string,
      "nominal": number,
      "kategori": string,
      "pembayaran": "Cash" | "Paylater"
    }
  ]
}
Rules:
- Every purchase/payment mentioned becomes its own transaction.
- If multiple items have different amounts, create separate transactions.
- If payment method is only mentioned once at the end, apply it to all preceding transactions.
- Default payment method = Cash.
- The "kategori" MUST strictly be one of the following exact strings:
  For Pengeluaran: "Makanan & Minuman", "Transportasi", "Belanja", "Tagihan & Utilitas", "Hiburan", "Lainnya"
  For Pemasukan: "Gaji", "Investasi", "Sampingan", "Hadiah", "Lainnya"
- If you are unsure about the category, use "Lainnya".
- Return ONLY JSON.
`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${effectiveApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.EXPO_PUBLIC_GROQ_MODEL || "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Parse this text: "${text}"`,
          },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new AIParserError(
        `Groq AI API failed: ${errText}`,
        response.status,
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new AIParserError("Groq returned an empty response.");
    }

    // Clean up code block markup if returned by the LLM
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent
        .replace(/^```(?:json)?\n/, "")
        .replace(/\n```$/, "");
    }

    const parsed = JSON.parse(
      cleanedContent.trim(),
    ) as ParsedTransactionResponse;

    if (!parsed || !Array.isArray(parsed.transactions)) {
      throw new AIParserError("JSON_PARSE_FAILED");
    }

    // Normalize category to Indonesian translation if the AI returned English names
    const categoryMapping: { [key: string]: string } = {
      "Food & Beverage": "Makanan & Minuman",
      Transportation: "Transportasi",
      Shopping: "Belanja",
      "Bills & Utilities": "Tagihan & Utilitas",
      Entertainment: "Hiburan",
      Others: "Lainnya",
      Salary: "Gaji",
      Investment: "Investasi",
      "Side Hustle": "Sampingan",
      Gift: "Hadiah",
    };

    for (const transaction of parsed.transactions) {
      if (transaction.kategori) {
        let cleanCat = transaction.kategori
          .replace(/^(Pemasukan|Pengeluaran):\s*/, "")
          .trim();
        if (categoryMapping[cleanCat]) {
          cleanCat = categoryMapping[cleanCat];
        }
        transaction.kategori = cleanCat;
      }
    }

    return parsed;
  } catch (error) {
    console.warn("Error parsing with Groq:", error);
    throw error;
  }
}
