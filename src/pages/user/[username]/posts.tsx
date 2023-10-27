import { Group, Stack, Tabs } from '@mantine/core';
import { MetricTimeframe } from '@prisma/client';
import { useState } from 'react';

import { NotFound } from '~/components/AppLayout/NotFound';
import { SortFilter } from '~/components/Filters';
import { MasonryContainer } from '~/components/MasonryColumns/MasonryContainer';
import { MasonryProvider } from '~/components/MasonryColumns/MasonryProvider';
import PostsInfinite from '~/components/Post/Infinite/PostsInfinite';
import { usePostQueryParams } from '~/components/Post/post.utils';
import { constants } from '~/server/common/constants';
import { PostSort } from '~/server/common/enums';
import { postgresSlugify } from '~/utils/string-helpers';

import { UserProfileLayout } from './';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { FeedContentToggle } from '~/components/FeedContentToggle/FeedContentToggle';
import { PostFiltersDropdown } from '~/components/Post/Infinite/PostFiltersDropdown';

export default function UserPostsPage() {
  const currentUser = useCurrentUser();
  const {
    replace,
    query: { followed = undefined, ...query },
  } = usePostQueryParams();
  // const { replace, section: querySection, ...queryFilters } = usePostQueryParams();
  const period = query.period ?? MetricTimeframe.AllTime;
  const sort = query.sort ?? PostSort.Newest;
  const selfView =
    !!currentUser &&
    !!query.username &&
    postgresSlugify(currentUser.username) === postgresSlugify(query.username);

  const [section, setSection] = useState<'published' | 'draft'>(
    selfView ? query.section ?? 'published' : 'published'
  );
  const viewingDraft = section === 'draft';

  if (!query.username) return <NotFound />;

  return (
    <Tabs.Panel value="/posts">
      <MasonryProvider
        columnWidth={constants.cardSizes.image}
        maxColumnCount={7}
        maxSingleColumnWidth={450}
      >
        <MasonryContainer fluid>
          <Stack spacing="xs">
            <Group spacing={8} position="apart">
              {selfView && (
                <FeedContentToggle
                  size="xs"
                  value={section}
                  onChange={(section) => {
                    setSection(section);
                    replace({ section });
                  }}
                />
              )}
              <Group spacing={8} noWrap>
                <SortFilter
                  type="posts"
                  variant="button"
                  value={sort}
                  onChange={(x) => replace({ sort: x as PostSort })}
                />
                <PostFiltersDropdown
                  query={{ ...query, followed }}
                  onChange={(filters) => replace(filters)}
                />
              </Group>
            </Group>
            <PostsInfinite
              filters={{ ...query, followed, period, sort, draftOnly: viewingDraft }}
            />
          </Stack>
        </MasonryContainer>
      </MasonryProvider>
    </Tabs.Panel>
  );
}

UserPostsPage.getLayout = UserProfileLayout;
