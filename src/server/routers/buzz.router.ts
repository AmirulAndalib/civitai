import {
  completeStripeBuzzPurchaseHandler,
  createBuzzTipTransactionHandler,
  getUserAccountHandler,
  getUserTransactionsHandler,
} from '~/server/controllers/buzz.controller';
import {
  completeStripeBuzzPurchaseTransactionInput,
  getUserBuzzTransactionsSchema,
  userBuzzTransactionInputSchema,
} from '~/server/schema/buzz.schema';
import { isFlagProtected, protectedProcedure, router } from '~/server/trpc';

export const buzzRouter = router({
  getUserAccount: protectedProcedure.use(isFlagProtected('buzz')).query(getUserAccountHandler),
  // TODO.buzz: add another endpoint only available for mods to fetch transactions from other users
  getUserTransactions: protectedProcedure
    .input(getUserBuzzTransactionsSchema)
    .use(isFlagProtected('buzz'))
    .query(getUserTransactionsHandler),
  tipUser: protectedProcedure
    .input(userBuzzTransactionInputSchema)
    .use(isFlagProtected('buzz'))
    .mutation(createBuzzTipTransactionHandler),
  completeStripeBuzzPurchase: protectedProcedure
    .input(completeStripeBuzzPurchaseTransactionInput)
    .use(isFlagProtected('buzz'))
    .mutation(completeStripeBuzzPurchaseHandler),
});
