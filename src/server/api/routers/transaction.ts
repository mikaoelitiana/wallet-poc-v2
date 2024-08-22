import { z } from "zod";
import { DateTime } from "luxon";
// @ts-expect-error no types provided for the library
import FreeCurrencyAPI from "@everapi/freecurrencyapi-js";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { env } from "~/env";

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const freecurrencyapi = new FreeCurrencyAPI(env.FREEEXCHANGERATE_API_KEY);

export const transactionRouter = createTRPCRouter({
  ping: publicProcedure.query(({}) => {
    return {};
  }),

  create: publicProcedure
    .input(
      z.object({
        amount: z.number().min(1),
        source: z.string(),
        type: z.enum(["DEPOSIT"]),
        currency: z.enum(["USD", "EUR", "GBP"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction.create({
        data: {
          amount: Math.round(input.amount * 100),
          type: input.type,
          source: input.source,
          currency: input.currency,
          expiryAt:
            input.source == "CFAR"
              ? DateTime.now().plus({ years: 1 }).toJSDate()
              : null,
        },
      });
    }),

  getBreakdown: publicProcedure
    .input(
      z.object({
        currency: z.enum(["USD", "EUR", "GBP"]),
      }),
    )
    .query(async ({ ctx, input }) => {
      // eslint-disable-next-line
      const rates: { data?: Record<string, number> } =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await freecurrencyapi.latest({
          base_currency: input.currency,
          currencies: "USD,EUR,GBP",
        });

      const transactions = await ctx.db.transaction.findMany({
        orderBy: [{ expiryAt: "asc" }, { createdAt: "asc" }],
        where: {
          AND: [
            { OR: [{ expiryAt: null }, { expiryAt: { gte: new Date() } }] },
          ],
        },
      });

      return transactions.reduce<Record<string, number>>((acc, curr) => {
        if (!acc[curr.source]) {
          acc[curr.source] = 0;
        }
        acc[curr.source] =
          (acc[curr.source] ?? 0) +
          Math.round(curr.amount / (rates.data?.[curr.currency] ?? 1)) / 100;
        return acc;
      }, {});
    }),

  withdraw: publicProcedure
    .input(
      z.object({
        amount: z.number().min(1),
        currency: z.enum(["USD", "EUR", "GBP"]),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // eslint-disable-next-line
      const rates = await freecurrencyapi.latest({
        base_currency: input.currency,
        currencies: "USD,EUR,GBP",
      });

      const usable_deposit_transactions = await ctx.db.$queryRaw<
        {
          id: number;
          remainder: number;
          currency: "USD" | "EUR" | "GBP";
          source: string;
          priority: number;
        }[]
      >`WITH prio AS (
SELECT 'CFAR' as source, 1 as priority
UNION ALL SELECT 'LOYALTY' as source, 2 as priority
UNION ALL SELECT 'CX' as source, 3 as priority
)
, balances AS (
SELECT id, currency, amount, prio.priority, t."expiryAt"
FROM "Transaction" t 
JOIN prio ON prio.source = t.source
WHERE type = 'DEPOSIT'

UNION ALL

SELECT "sourceTransactionId" as id, currency, amount, prio.priority, t."expiryAt"
FROM "Transaction" t
JOIN prio ON prio.source = t.source
WHERE type = 'WITHDRAW'
)
, balances_remaining AS (
SELECT id, currency, SUM(amount) as remainder
FROM balances
GROUP BY 1,2
)

SELECT tr.id, tr.currency, br.remainder, tr.source, prio.priority, tr."expiryAt" as "expiryAt" 
FROM balances_remaining br
JOIN "Transaction" tr ON tr.id = br.id
JOIN prio ON prio.source = tr.source
WHERE br.remainder > 0 and ("expiryAt" >= NOW() or "expiryAt" is null)
ORDER by prio.priority ASC`;

      let total = input.amount * 100;

      for (const transaction of usable_deposit_transactions) {
        // all paid
        if (total <= 0) break;

        const amount = Math.min(
          Math.round(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            total * rates.data[transaction.currency] * 100,
          ) / 100,
          Math.round(Number(transaction.remainder) * 100) / 100,
        );

        // Create a new transaction for the withdrawal
        await ctx.db.transaction.create({
          data: {
            amount: -amount,
            currency: transaction.currency,
            type: "WITHDRAW",
            sourceTransactionId: transaction.id,
            source: transaction.source,
            description:
              input.description ??
              `Withdrawing ${input.currency} ${input.amount}`,
          },
        });

        total -= amount;
      }
    }),

  getTransactions: publicProcedure.query(async ({ ctx }) => {
    try {
      const transactions = await ctx.db.transaction.findMany({
        orderBy: { id: "desc" },
      });

      return (
        transactions.map((transaction) => ({
          ...transaction,
          amount: transaction.amount / 100,
        })) || 0
      );
    } catch (e) {
      console.error(e);
      return 0;
    }
  }),

  getBalance: publicProcedure
    .input(z.object({ currency: z.enum(["USD", "EUR", "GBP"]) }))
    .query(async ({ ctx, input }) => {
      // eslint-disable-next-line
      const rates = await freecurrencyapi.latest({
        base_currency: input.currency,
        currencies: "USD,EUR,GBP",
      });

      const transactions = await ctx.db.$queryRaw<
        {
          id: number;
          remainder: number;
          currency: "USD" | "EUR" | "GBP";
          source: string;
          priority: number;
        }[]
      >`WITH prio AS (
SELECT 'CFAR' as source, 1 as priority
UNION ALL SELECT 'LOYALTY' as source, 2 as priority
UNION ALL SELECT 'CX' as source, 3 as priority
)
, balances AS (
SELECT id, currency, amount, prio.priority, t."expiryAt"
FROM "Transaction" t 
JOIN prio ON prio.source = t.source
WHERE type = 'DEPOSIT'

UNION ALL

SELECT "sourceTransactionId" as id, currency, amount, prio.priority, t."expiryAt"
FROM "Transaction" t
JOIN prio ON prio.source = t.source
WHERE type = 'WITHDRAW'
)
, balances_remaining AS (
SELECT id, currency, SUM(amount) as remainder
FROM balances
GROUP BY 1,2
)

SELECT tr.id, tr.currency, br.remainder, tr.source, prio.priority, tr."expiryAt" as "expiryAt" 
FROM balances_remaining br
JOIN "Transaction" tr ON tr.id = br.id
JOIN prio ON prio.source = tr.source
WHERE br.remainder > 0 and ("expiryAt" >= NOW() or "expiryAt" is null)
ORDER by prio.priority ASC`;

      return (
        transactions.reduce(
          (acc, curr) =>
            (acc =
              acc +
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              Math.round(
                Number(curr.remainder) / (rates.data?.[curr.currency] ?? 1),
              ) /
                100),
          0,
        ) ?? null
      );
    }),
});
