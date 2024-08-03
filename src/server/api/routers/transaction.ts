// import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const transactionRouter = createTRPCRouter({
  getTransactions: publicProcedure.query(async ({ ctx }) => {
    try {
      const transactions = await ctx.db.transaction.findMany({
        orderBy: { createdAt: "desc" },
      });

      return (
        transactions.map((transaction) => ({
          ...transaction,
          amount: transaction.amount / 100,
        })) || []
      );
    } catch (e) {
      console.error(e);
      return [];
    }
  }),
});
