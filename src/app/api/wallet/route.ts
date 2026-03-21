import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, err, parseQuery, PaginationSchema } from "@/lib/validations";
import { getWalletWithTransactions } from "@/lib/services/wallet.service";

// GET /api/wallet — current user's wallet + transaction history
export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof Response) return user;

  const query = parseQuery(request, PaginationSchema);
  if (query instanceof Response) return query;

  const data = await getWalletWithTransactions(user.id, query.limit, query.offset);
  if (!data) return err("Wallet not found", 404);

  return ok({
    balance: {
      mb:  data.wallet.balanceMb,
      inr: (data.wallet.balanceMb / 100).toFixed(2),
      display: `₥${data.wallet.balanceMb.toLocaleString("en-IN")}`,
    },
    transactions: data.transactions.map((tx) => ({
      id:          tx.id,
      amountMb:    tx.amountMb,
      type:        tx.type,
      source:      tx.source,
      description: tx.description,
      createdAt:   tx.createdAt,
      isCredit:    tx.amountMb > 0,
    })),
  });
}
