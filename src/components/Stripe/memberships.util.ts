import { useCurrentUser } from '~/hooks/useCurrentUser';
import { useFeatureFlags } from '~/providers/FeatureFlagsProvider';
import { constants } from '~/server/common/constants';
import { SubscriptionProductMetadata } from '~/server/schema/subscriptions.schema';
import { trpc } from '~/utils/trpc';

export const useActiveSubscription = ({
  checkWhenInBadState,
}: {
  checkWhenInBadState?: boolean;
} = {}) => {
  const currentUser = useCurrentUser();
  const isMember = currentUser?.tier !== undefined;

  const {
    data: subscription,
    isLoading,
    isFetching,
  } = trpc.subscriptions.getUserSubscription.useQuery(undefined, {
    enabled:
      !!currentUser && !!(isMember || (checkWhenInBadState && currentUser?.memberInBadState)),
  });

  const meta = subscription?.product?.metadata as SubscriptionProductMetadata;

  return {
    subscription,
    subscriptionLoading: !isMember ? false : isLoading || isFetching,
    subscriptionPaymentProvider: subscription?.product?.provider,
    isFreeTier: !subscription || meta?.tier === 'free',
  };
};

export const useCanUpgrade = () => {
  const currentUser = useCurrentUser();
  const { subscription, subscriptionLoading, subscriptionPaymentProvider } =
    useActiveSubscription();
  const { data: products = [], isLoading: productsLoading } = trpc.subscriptions.getPlans.useQuery(
    {}
  );
  const features = useFeatureFlags();

  if (!currentUser || subscriptionLoading || productsLoading || !features.membershipsV2) {
    return false;
  }

  if (!subscription) {
    return true;
  }

  const availableProducts = products.filter((p) => p.provider === subscriptionPaymentProvider);

  if (availableProducts.length <= 1) {
    return false;
  }

  const metadata = subscription?.product?.metadata as SubscriptionProductMetadata;

  return (
    constants.memberships.tierOrder.indexOf(metadata.tier) + 1 <
    constants.memberships.tierOrder.length
  );
};

export const appliesForFounderDiscount = (tier?: string) => {
  const appliesForDiscount =
    !!tier &&
    tier === constants.memberships.founderDiscount.tier &&
    new Date() < constants.memberships.founderDiscount.maxDiscountDate;

  return appliesForDiscount;
};
