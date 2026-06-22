export interface ParsedTransaction {
  type: 'Pengeluaran' | 'Pemasukan';
  item: string;
  nominal: number;
  kategori: string;
  pembayaran: 'Cash' | 'Paylater';
}

export class SumopodAiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SumopodAiError';
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
  apiKey: string | undefined
): Promise<ParsedTransaction> {
  if (!apiKey || apiKey.startsWith('placeholder') || apiKey.trim() === '') {
    throw new SumopodAiError('MISSING_API_KEY');
  }

  const url = 'https://ai.sumopod.com/v1/chat/completions';
  const systemPrompt = `You are a precise financial parser assistant. Parse the input Indonesian text describing a transaction into a JSON object with the following fields:
- type: 'Pengeluaran' or 'Pemasukan'
- item: Description of the transaction item (e.g. 'Bensin')
- nominal: Amount as an integer (e.g. 50000)
- kategori: Map to exactly one of these categories:
  - For 'Pengeluaran': 'Makanan & Minuman', 'Transportasi', 'Belanja', 'Tagihan & Utilitas', 'Hiburan', 'Lainnya'
  - For 'Pemasukan': 'Gaji', 'Investasi', 'Sampingan', 'Hadiah', 'Lainnya'
- pembayaran: 'Cash' or 'Paylater' (default to 'Cash' if not specified)

Return ONLY the raw JSON object. Do not include markdown code block formatting (like \`\`\`json) or explanations. Just return the JSON object directly.`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `Parse this text: "${text}"`,
          },
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new SumopodAiError(`SumoPod AI API failed: ${errText}`, response.status);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new SumopodAiError('SumoPod AI returned an empty response.');
    }

    // Clean up code block markup if returned by the LLM
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
    }

    const parsed = JSON.parse(cleanedContent.trim()) as ParsedTransaction;

    // Normalize category to Indonesian translation if the AI returned English names
    const categoryMapping: { [key: string]: string } = {
      'Food & Beverage': 'Makanan & Minuman',
      'Transportation': 'Transportasi',
      'Shopping': 'Belanja',
      'Bills & Utilities': 'Tagihan & Utilitas',
      'Entertainment': 'Hiburan',
      'Others': 'Lainnya',
      'Salary': 'Gaji',
      'Investment': 'Investasi',
      'Side Hustle': 'Sampingan',
      'Gift': 'Hadiah'
    };

    if (parsed.kategori) {
      let cleanCat = parsed.kategori.replace(/^(Pemasukan|Pengeluaran):\s*/, '').trim();
      if (categoryMapping[cleanCat]) {
        cleanCat = categoryMapping[cleanCat];
      }
      parsed.kategori = cleanCat;
    }

    return parsed;
  } catch (error) {
    console.warn('Error parsing with SumoPod AI:', error);
    throw error;
  }
}

