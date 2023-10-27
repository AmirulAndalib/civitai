import React, { forwardRef } from 'react';
import { AutocompleteItem, Badge, BadgeProps, Center, Group, Stack, Text } from '@mantine/core';
import { EdgeMedia } from '~/components/EdgeMedia/EdgeMedia';
import { IconMessageCircle2, IconMoodSmile } from '@tabler/icons-react';
import { Highlight } from 'react-instantsearch';
import { UserAvatar } from '~/components/UserAvatar/UserAvatar';
import { abbreviateNumber } from '~/utils/number-helpers';
import { Hit } from 'instantsearch.js';
import { ImageSearchIndexRecord } from '~/server/search-index/images.search-index';
import {
  ActionIconBadge,
  useSearchItemStyles,
  ViewMoreItem,
} from '~/components/AutocompleteSearch/renderItems/common';
import { MediaHash } from '~/components/ImageHash/ImageHash';

export const ImagesSearchItem = forwardRef<
  HTMLDivElement,
  AutocompleteItem & { hit: Hit<ImageSearchIndexRecord> }
>(({ value, hit, ...props }, ref) => {
  const { theme } = useSearchItemStyles();

  if (!hit) return <ViewMoreItem ref={ref} value={value} {...props} />;

  const { user, tags, stats } = hit;
  const { commentCountAllTime, ...reactionStats } = stats || {
    commentCountAllTime: 0,
    viewCountAllTime: 0,
    favoriteCountAllTime: 0,
    likeCountAllTime: 0,
  };
  const reactionCount = Object.values(reactionStats).reduce((a, b) => a + b, 0);
  const tagsMax = tags?.slice(0, 3);
  const remainingTagsCount = tags?.slice(3).length;

  const tagBadgeProps: BadgeProps = {
    radius: 'xl',
    size: 'xs',
    color: 'gray',
    variant: theme.colorScheme === 'dark' ? 'filled' : 'light',
  };

  return (
    <Group ref={ref} {...props} key={hit.id} spacing="md" align="flex-start" noWrap>
      <Center
        sx={{
          width: 64,
          height: 64,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '10px',
        }}
      >
        {hit.nsfw !== 'None' ? (
          <MediaHash {...hit} cropFocus="top" />
        ) : (
          <EdgeMedia
            src={hit.url}
            name={hit.name ?? hit.id.toString()}
            type={hit.type}
            anim={false}
            width={450}
            style={{
              minWidth: '100%',
              minHeight: '100%',
              objectFit: 'cover',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />
        )}
      </Center>
      <Stack spacing={8} sx={{ flex: '1 !important' }}>
        {hit.meta && (
          <Text lineClamp={2} size="sm" inline>
            <Text weight={600} ml={1} span>
              Positive prompt:{' '}
            </Text>

            {hit.meta?.prompt ?? ''}
          </Text>
        )}
        <UserAvatar size="xs" user={user} withUsername />
        <Group spacing={8}>
          {tagsMax?.map((tag) => (
            <Badge key={tag.id} {...tagBadgeProps}>
              {tag.name}
            </Badge>
          ))}
          {remainingTagsCount > 0 && <Badge {...tagBadgeProps}>+{remainingTagsCount}</Badge>}
        </Group>
        {stats && (
          <Group spacing={4}>
            <ActionIconBadge icon={<IconMoodSmile size={12} stroke={2.5} />}>
              {abbreviateNumber(reactionCount)}
            </ActionIconBadge>
            <ActionIconBadge icon={<IconMessageCircle2 size={12} stroke={2.5} />}>
              {abbreviateNumber(commentCountAllTime)}
            </ActionIconBadge>
          </Group>
        )}
      </Stack>
    </Group>
  );
});

ImagesSearchItem.displayName = 'ImagesSearchItem';
