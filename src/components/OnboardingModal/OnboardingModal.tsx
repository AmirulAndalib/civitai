import {
  Button,
  Stack,
  Text,
  Alert,
  Stepper,
  Title,
  Group,
  Center,
  Container,
  ScrollArea,
  Loader,
  createStyles,
  StackProps,
  ThemeIcon,
  Badge,
  TextInput,
  ButtonProps,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';

import { Form, InputText, useForm } from '~/libs/form';
import { trpc } from '~/utils/trpc';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { LogoBadge } from '~/components/Logo/LogoBadge';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { IconCheck, IconX, IconAlertCircle, IconProgressBolt } from '@tabler/icons-react';
import { signOut } from 'next-auth/react';
import { useDebouncedValue } from '@mantine/hooks';
import { ModerationCard } from '~/components/Account/ModerationCard';
import { invalidateModeratedContent } from '~/utils/query-invalidation-utils';
import { AlertWithIcon } from '~/components/AlertWithIcon/AlertWithIcon';
import { usernameInputSchema } from '~/server/schema/user.schema';
import { NewsletterToggle } from '~/components/Account/NewsletterToggle';
import { useReferralsContext } from '~/components/Referrals/ReferralsProvider';
import { constants } from '~/server/common/constants';
import { useFeatureFlags } from '~/providers/FeatureFlagsProvider';
import { Currency, OnboardingStep } from '@prisma/client';
import { EarningBuzz, SpendingBuzz } from '../Buzz/FeatureCards/FeatureCards';
import { CurrencyBadge } from '../Currency/CurrencyBadge';
import {
  checkUserCreatedAfterBuzzLaunch,
  getUserBuzzBonusAmount,
} from '~/server/common/user-helpers';
import { showErrorNotification } from '~/utils/notifications';

const schema = z.object({
  username: usernameInputSchema,
  email: z
    .string({
      invalid_type_error: 'Please provide an email',
      required_error: 'Please provide an email',
    })
    .email(),
});

const referralSchema = z.object({
  code: z
    .string()
    .trim()
    .refine((code) => !code || code.length > constants.referrals.referralCodeMinLength, {
      message: `Referral codes must be at least ${
        constants.referrals.referralCodeMinLength + 1
      } characters long`,
    })
    .optional(),
  source: z.string().optional(),
});

export default function OnboardingModal() {
  const user = useCurrentUser();
  const utils = trpc.useContext();
  const { code, source } = useReferralsContext();
  const { classes, theme } = useStyles();
  const features = useFeatureFlags();

  const [userReferral, setUserReferral] = useState(
    !user?.referral
      ? { code, source, showInput: false }
      : { code: '', source: '', showInput: false }
  );
  const [referralError, setReferralError] = useState('');

  const form = useForm({
    schema,
    mode: 'onChange',
    shouldUnregister: false,
    defaultValues: { ...user },
  });
  const username = form.watch('username');
  const [debounced] = useDebouncedValue(username, 300);
  const [debouncedUserReferralCode] = useDebouncedValue(userReferral.code, 300);

  const onboarded = {
    tos: !!user?.tos,
    profile: !!user?.username && !!user?.email,
    content: !user?.onboardingSteps?.includes(OnboardingStep.Moderation),
    buzz: !user?.onboardingSteps?.includes(OnboardingStep.Buzz),
  };
  const stepCount = Object.keys(onboarded).length;
  const [activeStep, setActiveStep] = useState(Object.values(onboarded).indexOf(false));

  const { data: terms, isLoading: termsLoading } = trpc.content.get.useQuery(
    { slug: 'tos' },
    { enabled: !onboarded.tos }
  );
  // Check if username is available
  const { data: usernameAvailable, isRefetching: usernameAvailableLoading } =
    trpc.user.usernameAvailable.useQuery(
      { username: debounced },
      { enabled: !!username && username.length >= 3 }
    );
  // Confirm user referral code:
  const {
    data: referrer,
    isLoading: referrerLoading,
    isRefetching: referrerRefetching,
  } = trpc.user.userByReferralCode.useQuery(
    { userReferralCode: debouncedUserReferralCode as string },
    {
      enabled:
        features.buzz &&
        !user?.referral &&
        !!debouncedUserReferralCode &&
        debouncedUserReferralCode.length > constants.referrals.referralCodeMinLength,
    }
  );

  const { mutate, isLoading, error } = trpc.user.update.useMutation();
  const { mutate: acceptTOS, isLoading: acceptTOSLoading } = trpc.user.acceptTOS.useMutation();
  const { mutate: completeStep, isLoading: completeStepLoading } =
    trpc.user.completeOnboardingStep.useMutation({
      async onSuccess() {
        await user?.refresh();
        await invalidateModeratedContent(utils);
        // context.closeModal(id);
      },
      onError(error) {
        showErrorNotification({
          title: 'Cannot save',
          error: new Error(error.message),
          reason: 'An unknown error occurred. Please try again later',
        });
      },
    });

  const goNext = () => {
    if (activeStep >= stepCount) return;
    setActiveStep((x) => x + 1);
  };

  const handleSubmit = (values: z.infer<typeof schema>) => {
    if (!user) return;
    // TOS is true here because it was already accepted
    mutate(
      { ...user, ...values, tos: true },
      {
        async onSuccess() {
          await user?.refresh();
          goNext();
        },
      }
    );
  };

  const handleAcceptTOS = () => {
    acceptTOS(undefined, {
      async onSuccess() {
        await user?.refresh();
        goNext();
      },
    });
  };
  const handleCompleteStep = (step: OnboardingStep) => {
    completeStep(
      { step },
      {
        onSuccess: (result) => {
          if (result.onboardingSteps.length > 0) {
            goNext();
            return;
          }

          if (user)
            mutate({
              ...user,
              userReferralCode: showReferral ? userReferral.code : undefined,
              source: showReferral ? userReferral.source : undefined,
            });
        },
      }
    );
  };
  const handleCompleteBuzzStep = () => {
    if (referrerRefetching) return;
    setReferralError('');

    const result = referralSchema.safeParse(userReferral);
    if (!result.success)
      return setReferralError(result.error.format().code?._errors[0] ?? 'Invalid value');

    handleCompleteStep(OnboardingStep.Buzz);
  };

  useEffect(() => {
    if (activeStep === 1 && user) form.reset({ email: user.email, username: user.username });
    // Don't remove the eslint disable below, it's needed to prevent infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, user?.username]);

  const showReferral = !!user && !user.referral && checkUserCreatedAfterBuzzLaunch(user);

  return (
    <Container size="lg" px={0}>
      <Center>
        <Group spacing="xs">
          <LogoBadge w={86} />
          <Stack spacing={0} mt={-5}>
            <Title sx={{ lineHeight: 1 }}>Welcome!</Title>
            <Text>{`Let's setup your account`}</Text>
          </Stack>
        </Group>
      </Center>
      <Stepper
        active={activeStep > -1 ? activeStep : 0}
        color="green"
        allowNextStepsSelect={false}
        classNames={classes}
      >
        <Stepper.Step label="Terms" description="Review our terms">
          <Stack>
            <StepperTitle
              title="Terms of Service"
              description="Please take a moment to review and accept our terms of service."
            />
            <ScrollArea
              style={{ height: 400 }}
              type="auto"
              p="md"
              sx={(theme) => ({
                border: `1px solid ${
                  theme.colorScheme === 'light' ? theme.colors.gray[9] : theme.colors.gray[7]
                }`,
              })}
            >
              {termsLoading || !terms ? (
                <Center py="lg">
                  <Loader size="lg" />
                </Center>
              ) : (
                <>
                  <Title order={1}>{terms.title}</Title>
                  <ReactMarkdown rehypePlugins={[rehypeRaw]} className="markdown-content">
                    {terms.content}
                  </ReactMarkdown>
                </>
              )}
            </ScrollArea>
            <Group position="apart" align="flex-start">
              <CancelButton showWarning>Decline</CancelButton>
              <Button
                rightIcon={<IconCheck />}
                size="lg"
                onClick={handleAcceptTOS}
                loading={acceptTOSLoading}
              >
                Accept
              </Button>
            </Group>
          </Stack>
        </Stepper.Step>
        <Stepper.Step label="Account" description="Verify your details">
          <Container size="xs" px={0}>
            <Stack>
              <StepperTitle
                title="Account Details"
                description="Please verify your account details"
              />
              <Form form={form} onSubmit={handleSubmit}>
                <Stack>
                  <InputText size="lg" name="email" label="Email" type="email" withAsterisk />
                  <InputText
                    size="lg"
                    name="username"
                    label="Username"
                    clearable={false}
                    rightSection={
                      usernameAvailableLoading ? (
                        <Loader size="sm" mr="xs" />
                      ) : (
                        usernameAvailable !== undefined && (
                          <ThemeIcon
                            variant="outline"
                            color={!!username && usernameAvailable ? 'green' : 'red'}
                            radius="xl"
                            mr="xs"
                          >
                            {!!username && usernameAvailable ? (
                              <IconCheck size="1.25rem" />
                            ) : (
                              <IconX size="1.25rem" />
                            )}
                          </ThemeIcon>
                        )
                      )
                    }
                    withAsterisk
                  />
                  {error && (
                    <Alert color="red" variant="light">
                      {error.data?.code === 'CONFLICT'
                        ? 'That username is already taken'
                        : error.message}
                    </Alert>
                  )}
                  <Group position="apart">
                    <CancelButton size="lg">Sign Out</CancelButton>
                    <Button
                      disabled={
                        !usernameAvailable ||
                        !username ||
                        usernameAvailableLoading ||
                        !(form.formState.isValid || !form.formState.isDirty)
                      }
                      size="lg"
                      type="submit"
                      loading={isLoading}
                    >
                      Save
                    </Button>
                  </Group>
                </Stack>
              </Form>
            </Stack>
          </Container>
        </Stepper.Step>
        <Stepper.Step label="Experience" description="Personalize your experience">
          <Container size="xs" px={0}>
            <Stack>
              <StepperTitle
                title={
                  <Group spacing="xs">
                    <Title order={2}>Content Experience</Title>
                    <Badge color="yellow" size="xs">
                      Beta
                    </Badge>
                  </Group>
                }
                description="Personalize your AI content exploration! Fine-tune preferences for a delightful and safe browsing experience."
              />
              <Text color="dimmed" size="xs">
                You can adjust these preferences at any time from your account page.
              </Text>
              <ModerationCard cardless sections={['tags', 'nsfw']} instantRefresh={false} />
              <AlertWithIcon
                color="yellow"
                icon={<IconAlertCircle />}
                iconColor="yellow"
                size="sm"
              >{`Despite AI and community moderation efforts, things are not always tagged correctly so you may still see content you wanted hidden.`}</AlertWithIcon>
              <NewsletterToggle
                label="Send me the Civitai Newsletter"
                description="We'll send you model and creator highlights, AI news, as well as comprehensive guides from
                leaders in the AI Content Universe. We hate spam as much as you do."
              />
              <Group position="apart">
                <CancelButton size="lg">Sign Out</CancelButton>
                <Button
                  size="lg"
                  onClick={() => handleCompleteStep(OnboardingStep.Moderation)}
                  loading={completeStepLoading}
                >
                  Save
                </Button>
              </Group>
            </Stack>
          </Container>
        </Stepper.Step>
        <Stepper.Step label="Buzz" description="Power-up your experience">
          <Container size="sm" px={0}>
            <Stack spacing="xl">
              <Text>
                {`On Civitai, we have something special called ⚡Buzz! It's our way of rewarding you for engaging with the community and you can use it to show love to your favorite creators and more. Learn more about it below, or whenever you need a refresher from your `}
                <IconProgressBolt
                  color={theme.colors.yellow[7]}
                  size={20}
                  style={{ verticalAlign: 'middle' }}
                />
                {` Buzz Dashboard.`}
              </Text>
              <Group align="start" sx={{ ['&>*']: { flexGrow: 1 } }}>
                <SpendingBuzz asList />
                <EarningBuzz asList />
              </Group>
              <StepperTitle
                title="Getting Started"
                description={
                  <Text>
                    To get you started, we will grant you{' '}
                    <Text span>
                      {user && (
                        <CurrencyBadge
                          currency={Currency.BUZZ}
                          unitAmount={getUserBuzzBonusAmount(user)}
                        />
                      )}
                    </Text>
                    {user?.isMember ? ' as a gift for being a supporter.' : ' as a gift.'}
                  </Text>
                }
              />
              <Group position="apart">
                <CancelButton size="lg">Sign Out</CancelButton>
                <Button
                  size="lg"
                  onClick={handleCompleteBuzzStep}
                  loading={completeStepLoading || referrerRefetching}
                >
                  Done
                </Button>
              </Group>
              {showReferral && (
                <Button
                  variant="subtle"
                  mt="-md"
                  onClick={() =>
                    setUserReferral((current) => ({
                      ...current,
                      showInput: !current.showInput,
                      code,
                    }))
                  }
                >
                  Have a referral code? Click here to claim a bonus
                </Button>
              )}

              {showReferral && userReferral.showInput && (
                <TextInput
                  size="lg"
                  label="Referral Code"
                  description={
                    <Text size="sm">
                      Both you and the person who referred you will receive{' '}
                      <Text span>
                        <CurrencyBadge
                          currency={Currency.BUZZ}
                          unitAmount={constants.buzz.referralBonusAmount}
                        />
                      </Text>{' '}
                      bonus with a valid referral code.
                    </Text>
                  }
                  error={referralError}
                  value={userReferral.code ?? ''}
                  onChange={(e) =>
                    setUserReferral((current) => ({ ...current, code: e.target.value }))
                  }
                  rightSection={
                    userReferral.code &&
                    userReferral.code.length > constants.referrals.referralCodeMinLength &&
                    (referrerLoading || referrerRefetching) ? (
                      <Loader size="sm" mr="xs" />
                    ) : (
                      userReferral.code &&
                      userReferral.code.length > constants.referrals.referralCodeMinLength && (
                        <ThemeIcon
                          variant="outline"
                          color={referrer ? 'green' : 'red'}
                          radius="xl"
                          mr="xs"
                        >
                          {!!referrer ? <IconCheck size="1.25rem" /> : <IconX size="1.25rem" />}
                        </ThemeIcon>
                      )
                    )
                  }
                  autoFocus
                />
              )}
            </Stack>
          </Container>
        </Stepper.Step>
      </Stepper>
    </Container>
  );
}

const StepperTitle = ({
  title,
  description,
  ...props
}: { title: React.ReactNode; description: React.ReactNode } & Omit<StackProps, 'title'>) => {
  return (
    <Stack spacing={4} {...props}>
      <Title order={3} sx={{ lineHeight: 1.1 }}>
        {title}
      </Title>
      <Text>{description}</Text>
    </Stack>
  );
};

const CancelButton = ({
  children,
  showWarning,
  ...props
}: ButtonProps & { showWarning?: boolean }) => {
  const handleCancelOnboarding = () => signOut();

  return (
    <Stack spacing={0}>
      <Button {...props} variant="default" onClick={handleCancelOnboarding}>
        {children}
      </Button>
      {showWarning && (
        <Text size="xs" color="dimmed">
          You will be logged out.
        </Text>
      )}
    </Stack>
  );
};

const useStyles = createStyles((theme, _params, getRef) => ({
  steps: {
    marginTop: 20,
    marginBottom: 20,
    [theme.fn.smallerThan('xs')]: {
      marginTop: 0,
      marginBottom: 0,
    },
  },
  step: {
    [theme.fn.smallerThan('md')]: {
      '&[data-progress]': {
        display: 'flex',
        [`& .${getRef('stepBody')}`]: {
          display: 'block',
        },
      },
    },
  },
  stepBody: {
    ref: getRef('stepBody'),
    [theme.fn.smallerThan('md')]: {
      display: 'none',
    },
  },
  stepDescription: {
    whiteSpace: 'nowrap',
  },
  stepIcon: {
    [theme.fn.smallerThan('sm')]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 24,
      height: 24,
      minWidth: 24,
    },
  },
  stepCompletedIcon: {
    [theme.fn.smallerThan('sm')]: {
      width: 14,
      height: 14,
      minWidth: 14,
      position: 'relative',
    },
  },
  separator: {
    [theme.fn.smallerThan('xs')]: {
      marginLeft: 4,
      marginRight: 4,
      minWidth: 10,
      // display: 'none',
    },
  },
}));
