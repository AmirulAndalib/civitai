import { GetInfiniteBountySchema } from '~/server/schema/bounty.schema';
import { Center, Loader, LoadingOverlay } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { debounce, isEqual } from 'lodash-es';
import { useEffect, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';
import { EndOfFeed } from '~/components/EndOfFeed/EndOfFeed';
import { NoContent } from '~/components/NoContent/NoContent';
import { removeEmpty } from '~/utils/object-helpers';
import { MasonryGrid } from '~/components/MasonryColumns/MasonryGrid';
import { BountyCard } from '~/components/Cards/BountyCard';
import { useBountyFilters, useQueryBounties } from '../bounty.utils';

export function BountiesInfinite({ filters: filterOverrides, showEof = true }: Props) {
  const { ref, inView } = useInView();
  const bountiesFilters = useBountyFilters();

  const filters = removeEmpty({ ...bountiesFilters, ...filterOverrides });
  const [debouncedFilters, cancel] = useDebouncedValue(filters, 500);

  const { bounties, isLoading, fetchNextPage, hasNextPage, isRefetching, isFetching } =
    useQueryBounties(debouncedFilters, { keepPreviousData: true });
  const debouncedFetchNextPage = useMemo(() => debounce(fetchNextPage, 500), [fetchNextPage]);

  // #region [infinite data fetching]
  useEffect(() => {
    if (inView && !isFetching) {
      debouncedFetchNextPage();
    }
  }, [debouncedFetchNextPage, inView, isFetching]);
  // #endregion

  //#region [useEffect] cancel debounced filters
  useEffect(() => {
    if (isEqual(filters, debouncedFilters)) cancel();
  }, [cancel, debouncedFilters, filters]);
  //#endregion

  return (
    <>
      {isLoading ? (
        <Center p="xl">
          <Loader size="xl" />
        </Center>
      ) : !!bounties.length ? (
        <div style={{ position: 'relative' }}>
          <LoadingOverlay visible={isRefetching ?? false} zIndex={9} />
          <MasonryGrid
            data={bounties}
            render={BountyCard}
            itemId={(x) => x.id}
            empty={<NoContent />}
          />
          {hasNextPage && !isLoading && !isRefetching && (
            <Center ref={ref} sx={{ height: 36 }} mt="md">
              {inView && <Loader />}
            </Center>
          )}
          {!hasNextPage && showEof && <EndOfFeed />}
        </div>
      ) : (
        <NoContent />
      )}
    </>
  );
}

type Props = { filters?: Partial<GetInfiniteBountySchema>; showEof?: boolean };
