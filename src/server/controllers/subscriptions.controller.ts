import { PaymentProvider } from '@prisma/client';
import { env } from '~/env/server.mjs';
import { Context } from '~/server/createContext';
import { GetPlansSchema } from '~/server/schema/subscriptions.schema';
import { getFeatureFlags } from '~/server/services/feature-flags.service';
import { getPlans, getUserSubscription } from '~/server/services/subscriptions.service';

export const getPlansHandler = async ({ input, ctx }: { input: GetPlansSchema; ctx: Context }) => {
  const features = getFeatureFlags({ user: ctx.user });

  const paddleSupported =
    env.NEXT_PUBLIC_DEFAULT_PAYMENT_PROVIDER === PaymentProvider.Paddle &&
    !!env.NEXT_PUBLIC_PADDLE_TOKEN &&
    !!env.PADDLE_SECRET_KEY;

  const fallbackToStripe = !features.customPaymentProvider || !paddleSupported;

  const defaultPaymentProvider = fallbackToStripe
    ? PaymentProvider.Stripe
    : (env.NEXT_PUBLIC_DEFAULT_PAYMENT_PROVIDER as PaymentProvider);

  return await getPlans({
    paymentProvider: input.paymentProvider ?? defaultPaymentProvider,
  });
};

export const getUserSubscriptionHandler = async ({ ctx }: { ctx: Context }) => {
  if (!ctx.user?.id || !ctx.user.subscriptionId) return null;
  return await getUserSubscription({ userId: ctx.user.id });
};