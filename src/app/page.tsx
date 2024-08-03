import { api, HydrateClient } from "~/trpc/server";
import { Transactions } from "./_components/transaction";

export default async function Home() {
  await api.transaction.ping();

  void api.transaction.getTransactions.prefetch();

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center gap-6 px-1 py-4">
          <h1 className="text-4xl font-extrabold tracking-tight">My Wallet</h1>
          <Transactions />
        </div>
      </main>
    </HydrateClient>
  );
}
