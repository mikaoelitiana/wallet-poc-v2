"use client";

import { useState } from "react";

import { api } from "~/trpc/react";

export function Transactions() {
  const utils = api.useUtils();

  const [currency, setCurrency] = useState<"USD" | "EUR" | "GBP">("EUR");
  const [transactions] = api.transaction.getTransactions.useSuspenseQuery();
  const [balance] = api.transaction.getBalance.useSuspenseQuery({ currency });
  const [breakdown] = api.transaction.getBreakdown.useSuspenseQuery({
    currency,
  });

  const [amount, setAmount] = useState("100");
  const [withdrawAmount, setWithdrawAmount] = useState("100");
  const [source, setSource] = useState("CFAR");
  const createTransaction = api.transaction.create.useMutation({
    onSuccess: async () => {
      await utils.transaction.invalidate();
      setAmount("100");
      setCurrency("EUR");
      setSource("CFAR");
    },
  });
  const withdraw = api.transaction.withdraw.useMutation({
    onSuccess: async () => {
      await utils.transaction.invalidate();
    },
  });

  return (
    <div className="w-4/5">
      <div className="my-2 justify-center self-center text-2xl font-bold">
        Balance: {balance}
        <select
          value={currency}
          // @ts-expect-error enum to string
          onChange={(e) => setCurrency(e.target.value)}
          className="ml-2 rounded-lg border-gray-200 px-4 py-3 pe-9 text-sm text-black"
        >
          <option value="USD" selected>
            USD
          </option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </select>
      </div>

      <div className="flex flex-grow gap-4">
        <div className="flex-grow">
          <h2 className="text-xl font-semibold">Breakdown</h2>

          <table className="min-w-full table-auto divide-y divide-gray-200 dark:divide-neutral-700">
            {Object.keys(breakdown).length > 0
              ? Object.keys(breakdown).map((key) => (
                  <tr key={key}>
                    <td className="whitespace-nowrap p-2">{key}</td>
                    <td className="whitespace-nowrap p-2">{breakdown[key]}</td>
                  </tr>
                ))
              : null}
          </table>
        </div>

        <div className="flex-grow">
          <h2 className="text-xl font-semibold">Deposit</h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createTransaction.mutate({
                amount: parseFloat(amount),
                currency,
                type: "DEPOSIT",
                source,
              });
            }}
            className="flex flex-col gap-2"
          >
            <div className="flex">
              <span className="inline-flex min-w-fit items-center rounded-s-full border border-e-0 border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-500 dark:border-neutral-700 dark:bg-neutral-700 dark:text-neutral-400">
                {currency}
              </span>
              <input
                type="number"
                className="block w-full rounded-e-full px-4 py-2 pe-11 text-sm text-black focus:z-10 focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full rounded-full px-4 py-2 text-black"
            >
              <option value="CFAR">CFAR</option>
              <option value="LOYALTY">LOYALTY</option>
              <option value="CX">CX</option>
            </select>

            <button
              type="submit"
              className="rounded-full bg-white/10 px-10 py-3 font-semibold transition hover:bg-white/20"
              disabled={createTransaction.isPending}
            >
              {createTransaction.isPending ? "Depositing..." : "Deposit"}
            </button>
          </form>
        </div>

        <div className="flex-grow">
          <h2 className="text-xl font-semibold">Withdraw</h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              withdraw.mutate({
                amount: parseFloat(withdrawAmount),
                currency,
              });
            }}
            className="flex flex-col gap-2"
          >
            <div className="flex">
              <span className="inline-flex min-w-fit items-center rounded-s-full border border-e-0 border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-500 dark:border-neutral-700 dark:bg-neutral-700 dark:text-neutral-400">
                {currency}
              </span>
              <input
                type="number"
                className="block w-full rounded-e-full px-4 py-2 pe-11 text-sm text-black focus:z-10 focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="rounded-full bg-white/10 px-10 py-3 font-semibold transition hover:bg-white/20"
              disabled={createTransaction.isPending}
            >
              {withdraw.isPending ? "Withdrawing..." : "Withdraw"}
            </button>
          </form>
        </div>
      </div>

      <div className="my-6">
        <table className="min-w-full table-auto divide-y divide-gray-200 dark:divide-neutral-700">
          <thead className="table-header-group">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-start text-xs font-medium uppercase"
              >
                Transaction
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-start text-xs font-medium uppercase"
              >
                Amount
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-start text-xs font-medium uppercase"
              >
                Currency
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-start text-xs font-medium uppercase"
              >
                Type
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-start text-xs font-medium uppercase"
              >
                Source
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-start text-xs font-medium uppercase"
              >
                Expiration
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
            {!!transactions &&
              transactions?.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                    {transaction.id}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                    {transaction.amount}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                    {transaction.currency}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                    {transaction.type}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                    {transaction.source}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                    {transaction.expiryAt
                      ? transaction.expiryAt.toISOString()
                      : ""}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
