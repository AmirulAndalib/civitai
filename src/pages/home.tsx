import {
  ActionIcon,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Popover,
  Text,
  Title,
} from '@mantine/core';
import { FullHomeContentToggle } from '~/components/HomeContentToggle/FullHomeContentToggle';
import { createServerSideProps } from '~/server/utils/server-side-helpers';
import { trpc } from '~/utils/trpc';
import { HomeBlockType, MetricTimeframe } from '@prisma/client';
import { CollectionHomeBlock } from '~/components/HomeBlocks/CollectionHomeBlock';
import { AnnouncementHomeBlock } from '~/components/HomeBlocks/AnnouncementHomeBlock';
import { LeaderboardsHomeBlock } from '~/components/HomeBlocks/LeaderboardsHomeBlock';
import { IconArrowRight, IconInfoCircle, IconSettings } from '@tabler/icons-react';
import React, { useEffect, useState } from 'react';
import { openContext } from '~/providers/CustomModalsProvider';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { useInView } from 'react-intersection-observer';
import { ModelsInfinite } from '~/components/Model/Infinite/ModelsInfinite';
import { IsClient } from '~/components/IsClient/IsClient';
import { constants } from '~/server/common/constants';
import { MasonryProvider } from '~/components/MasonryColumns/MasonryProvider';
import { BrowsingMode, ImageSort, ModelSort } from '~/server/common/enums';
import { HomeBlockWrapper } from '~/components/HomeBlocks/HomeBlockWrapper';
import { MasonryContainer } from '~/components/MasonryColumns/MasonryContainer';
import Link from 'next/link';
import { useHiddenPreferencesData } from '~/hooks/hidden-preferences';
import { SocialHomeBlock } from '~/components/HomeBlocks/SocialHomeBlock';
import { Meta } from '~/components/Meta/Meta';
import { env } from '~/env/client.mjs';
import ImagesInfinite from '~/components/Image/Infinite/ImagesInfinite';

export const getServerSideProps = createServerSideProps({
  resolver: async () => {
    // TODO.homepage: always return 404 not found until we migrate new homepage to index
    return { notFound: true };
  },
});

export default function Home() {
  const { data: homeBlocks = [], isLoading } = trpc.homeBlock.getHomeBlocks.useQuery();
  const { data: homeExcludedTags = [], isLoading: isLoadingExcludedTags } =
    trpc.tag.getHomeExcluded.useQuery();

  const [displayModelsInfiniteFeed, setDisplayModelsInfiniteFeed] = useState(false);
  const { ref, inView } = useInView();
  const user = useCurrentUser();

  const moderatedTagIds = useHiddenPreferencesData()
    .tag.filter((x) => x.type === 'moderated' || x.type === 'always')
    .map((x) => x.id);

  useEffect(() => {
    if (inView && !displayModelsInfiniteFeed) {
      setDisplayModelsInfiniteFeed(true);
    }
  }, [inView, displayModelsInfiniteFeed, setDisplayModelsInfiniteFeed]);

  return (
    <>
      <Meta
        title="Civitai: The Home of Open-Source Generative AI"
        description="Explore thousands of high-quality Stable Diffusion models, share your AI-generated art, and engage with a vibrant community of creators"
        links={[{ href: `${env.NEXT_PUBLIC_BASE_URL}/`, rel: 'canonical' }]}
      />
      <MasonryProvider
        columnWidth={constants.cardSizes.model}
        maxColumnCount={7}
        maxSingleColumnWidth={450}
      >
        <MasonryContainer fluid sx={{ overflow: 'hidden' }}>
          <Group position="apart" noWrap>
            <FullHomeContentToggle />
            {user && (
              <ActionIcon
                size="sm"
                variant="light"
                color="dark"
                onClick={() => openContext('manageHomeBlocks', {})}
              >
                <IconSettings />
              </ActionIcon>
            )}
          </Group>
        </MasonryContainer>

        {isLoading && (
          <Center sx={{ height: 36 }} mt="md">
            <Loader />
          </Center>
        )}

        <Box
          sx={(theme) => ({
            '& > *:nth-of-type(even)': {
              background:
                theme.colorScheme === 'dark'
                  ? theme.colors.dark[8]
                  : theme.fn.darken(theme.colors.gray[0], 0.01),
            },
          })}
        >
          {homeBlocks.map((homeBlock) => {
            switch (homeBlock.type) {
              case HomeBlockType.Collection:
                return (
                  <CollectionHomeBlock
                    key={homeBlock.id}
                    homeBlockId={homeBlock.id}
                    metadata={homeBlock.metadata}
                  />
                );
              case HomeBlockType.Announcement:
                return <AnnouncementHomeBlock key={homeBlock.id} homeBlockId={homeBlock.id} />;
              case HomeBlockType.Leaderboard:
                return (
                  <LeaderboardsHomeBlock
                    key={homeBlock.id}
                    homeBlockId={homeBlock.id}
                    metadata={homeBlock.metadata}
                  />
                );
              case HomeBlockType.Social:
                return <SocialHomeBlock key={homeBlock.id} metadata={homeBlock.metadata} />;
            }
          })}

          {env.NEXT_PUBLIC_UI_HOMEPAGE_IMAGES ? (
            <Box ref={ref}>
              <HomeBlockWrapper py={32}>
                {displayModelsInfiniteFeed && !isLoadingExcludedTags && (
                  <IsClient>
                    <Group mb="md" position="apart">
                      <Group>
                        <Title
                          sx={(theme) => ({
                            fontSize: 32,

                            [theme.fn.smallerThan('sm')]: {
                              fontSize: 24,
                            },
                          })}
                        >
                          Images
                        </Title>
                        <Popover withArrow width={380}>
                          <Popover.Target>
                            <Box
                              display="inline-block"
                              sx={{ lineHeight: 0.3, cursor: 'pointer' }}
                              color="white"
                            >
                              <IconInfoCircle size={20} />
                            </Box>
                          </Popover.Target>
                          <Popover.Dropdown maw="100%">
                            <Text size="sm" mb="xs">
                              Pre-filtered list of the highest rated images post by the community
                              over the last week
                            </Text>
                          </Popover.Dropdown>
                        </Popover>
                      </Group>

                      <Link href="/images" passHref>
                        <Button
                          h={34}
                          component="a"
                          variant="subtle"
                          rightIcon={<IconArrowRight size={16} />}
                        >
                          View all
                        </Button>
                      </Link>
                    </Group>

                    <ImagesInfinite
                      filters={{
                        // Required to override localStorage filters
                        period: MetricTimeframe.Week,
                        sort: ImageSort.MostReactions,
                        browsingMode: BrowsingMode.SFW,
                        types: undefined,
                        followed: false,
                        withMeta: true,
                      }}
                    />
                  </IsClient>
                )}
              </HomeBlockWrapper>
            </Box>
          ) : (
            <Box ref={ref}>
              <HomeBlockWrapper py={32}>
                {displayModelsInfiniteFeed && !isLoadingExcludedTags && (
                  <IsClient>
                    <Group mb="md" position="apart">
                      <Group>
                        <Title
                          sx={(theme) => ({
                            fontSize: 32,

                            [theme.fn.smallerThan('sm')]: {
                              fontSize: 24,
                            },
                          })}
                        >
                          Models
                        </Title>
                        <Popover withArrow width={380}>
                          <Popover.Target>
                            <Box
                              display="inline-block"
                              sx={{ lineHeight: 0.3, cursor: 'pointer' }}
                              color="white"
                            >
                              <IconInfoCircle size={20} />
                            </Box>
                          </Popover.Target>
                          <Popover.Dropdown maw="100%">
                            <Text size="sm" mb="xs">
                              Pre-filtered list of models upload by the community that are the
                              highest rated over the last week
                            </Text>
                          </Popover.Dropdown>
                        </Popover>
                      </Group>

                      <Link href="/models" passHref>
                        <Button
                          h={34}
                          component="a"
                          variant="subtle"
                          rightIcon={<IconArrowRight size={16} />}
                        >
                          View all
                        </Button>
                      </Link>
                    </Group>

                    <ModelsInfinite
                      filters={{
                        excludedImageTagIds: [
                          ...homeExcludedTags.map((tag) => tag.id),
                          ...moderatedTagIds,
                        ],
                        excludedTagIds: homeExcludedTags.map((tag) => tag.id),
                        // Required to override localStorage filters
                        period: MetricTimeframe.Week,
                        sort: ModelSort.HighestRated,
                        browsingMode: BrowsingMode.SFW,
                        types: undefined,
                        collectionId: undefined,
                        earlyAccess: false,
                        status: undefined,
                        checkpointType: undefined,
                        baseModels: undefined,
                      }}
                    />
                  </IsClient>
                )}
              </HomeBlockWrapper>
            </Box>
          )}
        </Box>
      </MasonryProvider>
    </>
  );
}
