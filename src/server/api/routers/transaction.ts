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
        type: z.enum(["DEPOSIT", "WITHDRAW", "REMAINDER"]),
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
            {
              usedAt: null,
              type: { not: "WITHDRAW" },
            },
            { OR: [{ sourceTransactionId: null }, { type: "REMAINDER" }] },
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
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // eslint-disable-next-line
      const rates = await freecurrencyapi.latest({
        base_currency: input.currency,
        currencies: "USD,EUR,GBP",
      });

      const transactions = await ctx.db.transaction.findMany({
        orderBy: [{ expiryAt: "asc" }, { createdAt: "asc" }],
        where: {
          AND: [
            { OR: [{ expiryAt: null }, { expiryAt: { gte: new Date() } }] },
            {
              usedAt: null,
              type: { not: "WITHDRAW" },
            },
            { OR: [{ sourceTransactionId: null }, { type: "REMAINDER" }] },
          ],
        },
      });

      let total = input.amount * 100;

      for (const transaction of transactions) {
        // all paid
        if (total <= 0) break;

        const amount = Math.min(
          total,
          Math.round(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (transaction.amount / rates.data[transaction.currency]) * 100,
          ) / 100,
        );

        // Mark transaction as used
        await ctx.db.transaction.update({
          where: { id: transaction.id },
          data: {
            usedAt: new Date(),
          },
        });

        // Create a new transaction for the withdrawal
        await ctx.db.transaction.create({
          data: {
            amount: -amount,
            currency: input.currency,
            type: "WITHDRAW",
            sourceTransactionId: transaction.id,
            source: transaction.source,
            usedAt: new Date(),
          },
        });

        // Create a new transaction for the remainder if any
        if (amount < transaction.amount) {
          await ctx.db.transaction.create({
            data: {
              amount:
                Math.round(
                  (transaction.amount -
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    amount * rates.data[transaction.currency]) *
                    100,
                ) / 100,
              currency: transaction.currency,
              type: "REMAINDER",
              source: transaction.source,
              sourceTransactionId: transaction.id,
              expiryAt: transaction.expiryAt,
            },
          });
        }

        total -= amount;
      }
    }),

  getTransactions: publicProcedure.query(async ({ ctx }) => {
    try {
      const transactions = await ctx.db.transaction.findMany({
        orderBy: { createdAt: "desc" },
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

      const transactions = await ctx.db.transaction.findMany({
        orderBy: [{ createdAt: "asc" }, { expiryAt: "asc" }],
        where: {
          AND: [
            { OR: [{ expiryAt: null }, { expiryAt: { gte: new Date() } }] },
            {
              usedAt: null,
              type: { not: "WITHDRAW" },
            },
            { OR: [{ sourceTransactionId: null }, { type: "REMAINDER" }] },
          ],
        },
      });

      return (
        transactions.reduce(
          (acc, curr) =>
            (acc =
              acc +
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              Math.round(curr.amount / (rates.data?.[curr.currency] ?? 1)) /
                100),
          0,
        ) ?? null
      );
    }),
});
