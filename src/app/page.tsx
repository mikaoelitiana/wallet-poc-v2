import { LatestPost } from "~/app/_components/post";
import { api, HydrateClient } from "~/trpc/server";
import { Transactions } from "./_components/transaction";

export default async function Home() {
  const hello = await api.post.hello({ text: "from tRPC" });

  void api.post.getLatest.prefetch();
  void api.transaction.getTransactions.prefetch();

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-4xl font-extrabold tracking-tight">My Wallet</h1>
          <Transactions />

          <div className="flex flex-col items-center gap-2">
            <p className="text-2xl text-white">
              {hello ? hello.greeting : "Loading tRPC query..."}
            </p>
          </div>

          <LatestPost />
          <Transactions />
        </div>
      </main>
    </HydrateClient>
  );
}
