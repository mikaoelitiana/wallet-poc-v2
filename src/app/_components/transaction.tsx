"use client";

// import { useState } from "react";

import { api } from "~/trpc/react";

export function Transactions() {
  const [transactions] = api.transaction.getTransactions.useSuspenseQuery();

  // const utils = api.useUtils();

  return (
    <div className="w-full max-w-xs">
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
