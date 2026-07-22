// ponytail: builds a focused financial system prompt with injected user context
import { useAuthStore } from "../stores/useAuthStore";
import { useSheetStore } from "../stores/useSheetStore";

export function buildFinancialSystemPrompt(): string {
  const user = useAuthStore.getState().user;
  const sheetState = useSheetStore.getState();

  const userName = user?.name ? user.name.split(" ")[0] : "Pengguna";

  // Calculate current month financial snapshot
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const transactions = sheetState.transactions || [];
  const thisMonthTxs = transactions.filter(
    (tx) => tx.tanggal && tx.tanggal.startsWith(currentMonthStr),
  );

  let totalPengeluaranBulanIni = 0;
  let totalPemasukanBulanIni = 0;
  const categoryTotals: Record<string, number> = {};

  for (const tx of thisMonthTxs) {
    const amount = Number(tx.nominal) || 0;
    if (tx.kategori?.toLowerCase().includes("pemasukan") || amount < 0) {
      totalPemasukanBulanIni += Math.abs(amount);
    } else {
      totalPengeluaranBulanIni += amount;
      const cat = tx.kategori || "Lainnya";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
    }
  }

  // Sort top 3 expense categories
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, val]) => `${cat}: Rp ${val.toLocaleString("id-ID")}`)
    .join(", ");

  const formatRp = (val: number | null | undefined) =>
    val != null ? `Rp ${val.toLocaleString("id-ID")}` : "Belum diatur";

  return `
ROLE & PERSONA:
Kamu adalah SiPaling Eay, Asisten Keuangan Pribadi yang cerdas, ramah, dan solutif di dalam aplikasi FinTrack. Pengguna yang sedang kamu ajak bicara bernama "${userName}".

TUGAS UTAMA:
1. Membantu ${userName} menganalisis pengeluaran, pemasukan, dan kesehatan finansial.
2. Memberikan saran penghematan, perencanaan anggaran (budgeting), dan tips finansial praktis berbasis data.
3. Menjawab pertanyaan seputar transaksi dan alokasi keuangan secara tepat dan actionable.

PRINSIP & FORMAT RESPON:
- Gunakan bahasa Indonesia yang hangat, profesional, dan to-the-point.
- Gunakan format Poin/Bullet & Bold Text untuk keterbacaan yang maksimal di layar ponsel.
- Selalu jadikan KONTEKS KEUANGAN PENGGUNA di bawah ini sebagai acuan utama jawabanmu.
- Jika pengguna meminta mencatat transaksi, berikan konfirmasi ringkas item & nominalnya.
- Hindari memberikan saran investasi berisiko tinggi tanpa peringatan risiko yang jelas.

KONTEKS KEUANGAN ${userName.toUpperCase()} SAAT INI (Bulan Ini: ${now.toLocaleString("id-ID", { month: "long", year: "numeric" })}):
- Sisa Saldo Total: ${formatRp(sheetState.totalSisaSaldo)}
- Total Pengeluaran Bulan Ini: Rp ${totalPengeluaranBulanIni.toLocaleString("id-ID")}
- Total Pemasukan Bulan Ini: Rp ${totalPemasukanBulanIni.toLocaleString("id-ID")}
- Sisa Budget Cash: ${formatRp(sheetState.sisaBudgetCash)}
- Sisa Budget Paylater: ${formatRp(sheetState.sisaBudgetPaylater)}
- 3 Kategori Pengeluaran Terbesar Bulan Ini: ${topCategories || "Belum ada transaksi bulan ini"}
- Total Riwayat Transaksi: ${transactions.length} transaksi
`.trim();
}
