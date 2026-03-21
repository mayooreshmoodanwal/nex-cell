import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth";
import { getWalletWithTransactions } from "@/lib/services/wallet.service";
import { getUserPaymentRequests } from "@/lib/services/treasurer.service";
import WalletClient from "./WalletClient";
export const metadata = { title: "Wallet" };

export default async function WalletPage() {
  const token = cookies().get("access_token")?.value!;
  const payload = await verifyAccessToken(token);
  const [walletData, paymentRequests] = await Promise.all([
    getWalletWithTransactions(payload.sub, 50, 0),
    getUserPaymentRequests(payload.sub),
  ]);
  return <WalletClient walletData={walletData} paymentRequests={paymentRequests} />;
}
