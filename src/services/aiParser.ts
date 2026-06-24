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

export class SumopodAiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "SumopodAiError";
    this.status = status;
  }
}

/**
 * Sends transaction natural language text to SumoPod AI API for structural parsing into JSON.
 * @param text The natural language string (e.g. 'beli bensin 50rb pakai cash')
 * @param apiKey SumoPod AI API Key
 */
export async function parseTransactionWithSumopod(
  text: string,
  apiKey: string | undefined,
): Promise<ParsedTransactionResponse> {
  if (!apiKey || apiKey.startsWith("placeholder") || apiKey.trim() === "") {
    throw new SumopodAiError("MISSING_API_KEY");
  }

  const url = "https://ai.sumopod.com/v1/chat/completions";
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
- Return ONLY JSON.
`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new SumopodAiError(
        `SumoPod AI API failed: ${errText}`,
        response.status,
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new SumopodAiError("SumoPod AI returned an empty response.");
    }

    // Clean up code block markup if returned by the LLM
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent
        .replace(/^```(?:json)?\n/, "")
        .replace(/\n```$/, "");
    }

    const parsed = JSON.parse(cleanedContent.trim()) as ParsedTransactionResponse;

    if (!parsed || !Array.isArray(parsed.transactions)) {
      throw new SumopodAiError("JSON_PARSE_FAILED");
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
    console.warn("Error parsing with SumoPod AI:", error);
    throw error;
  }
}
