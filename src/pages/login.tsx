import {
  Container,
  Paper,
  Stack,
  Text,
  Alert,
  Group,
  ThemeIcon,
  Divider,
  Code,
} from '@mantine/core';
import { IconExclamationMark } from '@tabler/icons-react';
import { BuiltInProviderType } from 'next-auth/providers';
import { getCsrfToken, getProviders, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import { EmailLogin } from '~/components/EmailLogin/EmailLogin';
import { SignInError } from '~/components/SignInError/SignInError';
import { SocialButton } from '~/components/Social/SocialButton';

import { createServerSideProps } from '~/server/utils/server-side-helpers';
import { loginRedirectReasons, LoginRedirectReason } from '~/utils/login-helpers';
import { useReferralsContext } from '~/components/Referrals/ReferralsProvider';
import { trpc } from '~/utils/trpc';
import { CreatorCard } from '~/components/CreatorCard/CreatorCard';
import { Meta } from '~/components/Meta/Meta';
import { env } from '~/env/client.mjs';
import { CurrencyBadge } from '~/components/Currency/CurrencyBadge';
import { Currency } from '@prisma/client';

export default function Login({ providers }: Props) {
  const router = useRouter();
  const {
    error,
    returnUrl = '/',
    reason,
  } = router.query as {
    error: string;
    returnUrl: string;
    reason: LoginRedirectReason;
  };
  const { code } = useReferralsContext();
  const { data: referrer } = trpc.user.userByReferralCode.useQuery(
    { userReferralCode: code as string },
    { enabled: !!code }
  );

  const redirectReason = loginRedirectReasons[reason];

  return (
    <>
      <Meta
        title="Sign in to Civitai"
        links={[{ href: `${env.NEXT_PUBLIC_BASE_URL}/login`, rel: 'canonical' }]}
      />
      <Container size="xs">
        <Stack>
          {!!redirectReason && (
            <Alert color="yellow">
              <Group position="center" spacing="xs" noWrap align="flex-start">
                <ThemeIcon color="yellow">
                  <IconExclamationMark />
                </ThemeIcon>
                <Text size="md">{redirectReason}</Text>
              </Group>
            </Alert>
          )}
          {referrer && (
            <Paper withBorder>
              <Stack spacing="xs" p="md">
                <Text color="dimmed" size="sm">
                  You have been referred by
                </Text>
                <CreatorCard user={referrer} withActions={false} />
                <Text size="sm">
                  By signing up with the referral code <Code>{code}</Code> both you and the user who
                  referred you will be awarded{' '}
                  <Text span inline>
                    <CurrencyBadge currency={Currency.BUZZ} unitAmount={500} />
                  </Text>
                  . This code will be automatically applied during your username selection process.
                </Text>
              </Stack>
            </Paper>
          )}
          <Paper radius="md" p="xl" withBorder>
            <Text size="lg" weight={500}>
              Welcome to Civitai, sign in with
            </Text>

            <Stack mb={error ? 'md' : undefined} mt="md">
              {providers
                ? Object.values(providers)
                    .filter((x) => x.id !== 'email')
                    .map((provider) => {
                      return (
                        <SocialButton
                          key={provider.name}
                          provider={provider.id as BuiltInProviderType}
                          onClick={() => signIn(provider.id, { callbackUrl: returnUrl })}
                        />
                      );
                    })
                : null}
              <Divider label="Or" labelPosition="center" />
              <EmailLogin />
            </Stack>
            {error && (
              <SignInError
                color="yellow"
                title="Login Error"
                mt="lg"
                variant="outline"
                error={error}
              />
            )}
          </Paper>
        </Stack>
      </Container>
    </>
  );
}

type NextAuthProviders = AsyncReturnType<typeof getProviders>;
type NextAuthCsrfToken = AsyncReturnType<typeof getCsrfToken>;
type Props = {
  providers: NextAuthProviders;
  csrfToken: NextAuthCsrfToken;
};

export const getServerSideProps = createServerSideProps({
  useSession: true,
  resolver: async ({ session, ctx }) => {
    if (session) {
      return {
        redirect: {
          destination: '/',
          permanent: false,
        },
      };
    }

    const providers = await getProviders();
    const csrfToken = await getCsrfToken();

    return {
      props: { providers, csrfToken },
    };
  },
});
