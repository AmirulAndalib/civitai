import { getTRPCErrorFromUnknown } from '@trpc/server';
import { Context } from '~/server/createContext';
import {
  CompleteStripeBuzzPurchaseTransactionInput,
  CreateBuzzTransactionInput,
  GetUserBuzzTransactionsSchema,
  TransactionType,
  UserBuzzTransactionInputSchema,
} from '~/server/schema/buzz.schema';
import {
  completeStripeBuzzTransaction,
  createBuzzTransaction,
  getUserBuzzAccount,
  getUserBuzzTransactions,
} from '~/server/services/buzz.service';
import { throwBadRequestError } from '../utils/errorHandling';
import { DEFAULT_PAGE_SIZE } from '../utils/pagination-helpers';

export function getUserAccountHandler({ ctx }: { ctx: DeepNonNullable<Context> }) {
  try {
    return getUserBuzzAccount({ accountId: ctx.user.id });
  } catch (error) {
    throw getTRPCErrorFromUnknown(error);
  }
}

export async function getUserTransactionsHandler({
  input,
  ctx,
}: {
  input: GetUserBuzzTransactionsSchema;
  ctx: DeepNonNullable<Context>;
}) {
  try {
    input.limit ??= DEFAULT_PAGE_SIZE;

    const result = await getUserBuzzTransactions({ ...input, accountId: ctx.user.id });
    return result;
  } catch (error) {
    throw getTRPCErrorFromUnknown(error);
  }
}

export function completeStripeBuzzPurchaseHandler({
  input,
  ctx,
}: {
  input: CompleteStripeBuzzPurchaseTransactionInput;
  ctx: DeepNonNullable<Context>;
}) {
  try {
    const { id } = ctx.user;

    return completeStripeBuzzTransaction({ ...input, userId: id });
  } catch (error) {
    throw getTRPCErrorFromUnknown(error);
  }
}

export function createBuzzTipTransactionHandler({
  input,
  ctx,
}: {
  input: UserBuzzTransactionInputSchema;
  ctx: DeepNonNullable<Context>;
}) {
  try {
    const { id: fromAccountId } = ctx.user;
    if (fromAccountId === input.toAccountId)
      throw throwBadRequestError('You cannot send buzz to the same account');

    return createBuzzTransaction({
      ...input,
      fromAccountId: ctx.user.id,
      type: TransactionType.Tip,
    });
  } catch (error) {
    throw getTRPCErrorFromUnknown(error);
  }
}
