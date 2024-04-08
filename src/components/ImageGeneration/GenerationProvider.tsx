import { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { GenerationRequestStatus } from '~/server/common/enums';
import { Generation } from '~/server/services/generation/generation.types';
import { produce } from 'immer';
import {
  updateGenerationRequest,
  useGetGenerationRequests,
} from '~/components/ImageGeneration/utils/generationRequestHooks';
import { useGenerationStatus } from '~/components/ImageGeneration/GenerationForm/generation.utils';
import { createStore, useStore } from 'zustand';
import { useSignalContext } from '~/components/Signals/SignalsProvider';
import { useDebouncer } from '~/utils/debouncer';
import { GenerationLimits } from '~/server/schema/generation.schema';
import { UserTier } from '~/server/schema/user.schema';

const POLLABLE_STATUSES = [GenerationRequestStatus.Pending, GenerationRequestStatus.Processing];

type GenerationState = {
  queued: { id: number; count: number; quantity: number; status: GenerationRequestStatus }[];
  queuedImages: Generation.Image[];
  queueStatus?: GenerationRequestStatus;
  requestLimit: number;
  requestsRemaining: number;
  canGenerate: boolean;
  userLimits?: GenerationLimits;
  userTier: UserTier;
};

type GenerationStore = ReturnType<typeof createGenerationStore>;
const createGenerationStore = () =>
  createStore<GenerationState>(() => ({
    queued: [],
    queuedImages: [],
    requestLimit: 0,
    requestsRemaining: 0,
    canGenerate: false,
    userTier: 'free',
  }));

const GenerationContext = createContext<GenerationStore | null>(null);
export function useGenerationContext<T>(selector: (state: GenerationState) => T) {
  const store = useContext(GenerationContext);
  if (!store) throw new Error('missing GenerationProvider');
  return useStore(store, selector);
}

export function GenerationProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<GenerationStore>();
  const { connected } = useSignalContext();
  const { requests } = useGetGenerationRequests();
  const generationStatus = useGenerationStatus();

  // #region [queue state]
  const [queued, setQueued] = useState<Generation.Request[]>([]);
  const pendingProcessingQueued = requests.filter(
    (request) =>
      POLLABLE_STATUSES.includes(request.status) || queued.some((x) => x.id === request.id)
  );

  const handleSetQueued = (cb: (draft: Generation.Request[]) => void) => setQueued(produce(cb));

  const deleteQueueItem = (id: number) => {
    handleSetQueued((draft) => {
      const index = draft.findIndex((x) => x.id === id);
      if (index > -1) draft.splice(index, 1);
    });
  };

  const setQueueItem = (request: Generation.Request) => {
    handleSetQueued((draft) => {
      const index = draft.findIndex((x) => x.id === request.id);
      if (index > -1) draft[index] = request;
      else draft.push(request);
    });
    if (!POLLABLE_STATUSES.includes(request.status)) {
      setTimeout(() => deleteQueueItem(request.id), 3000);
    }
  };

  useEffect(() => {
    for (const request of pendingProcessingQueued) setQueueItem(request);
    for (const item of queued) {
      if (!requests.find((x) => x.id === item.id)) deleteQueueItem(item.id);
    }
  }, [requests]); // eslint-disable-line
  // #endregion

  // #region [context state]
  useEffect(() => {
    const store = storeRef.current;
    if (!store) return;
    const { limits, available } = generationStatus;
    const queuedRequests = queued.map((request) => ({
      id: request.id,
      count: request.images?.filter((x) => x.available).length ?? 0,
      quantity: request.quantity,
      status: request.status,
    }));

    const queueStatus = queuedRequests.some((x) => x.status === GenerationRequestStatus.Processing)
      ? GenerationRequestStatus.Processing
      : queuedRequests[0]?.status;

    const requestsRemaining = limits.queue - queuedRequests.length;
    const images = queued
      .flatMap(
        (x) =>
          x.images?.map((image) => ({
            ...image,
            createdAt: new Date(x.createdAt).getTime() + (image.duration ?? 0),
          })) ?? []
      )
      .filter((x) => x.available)
      .sort((a, b) => (b?.duration ?? 0) - (a?.duration ?? 0));

    store.setState({
      queued: queuedRequests,
      queuedImages: images,
      queueStatus,
      requestsRemaining: requestsRemaining > 0 ? requestsRemaining : 0,
      canGenerate: requestsRemaining > 0 && available,
    });
  }, [queued, generationStatus]);

  useEffect(() => {
    const store = storeRef.current;
    if (!store) return;
    const { limits, tier } = generationStatus;
    store.setState({
      requestLimit: limits.quantity,
      userLimits: limits,
      userTier: tier,
    });
  }, [generationStatus]);
  // #endregion

  // #region [polling]
  const pollableIds = pendingProcessingQueued.map((x) => x.id);
  const hasPollableIds = pollableIds.length > 0;
  const debouncer = useDebouncer(1000 * (!connected ? 5 : 60));
  const pollable = useGetGenerationRequests(
    {
      requestId: pollableIds,
      take: 100,
      detailed: true,
    },
    {
      enabled: false,
    }
  );

  useEffect(() => {
    debouncer(() => {
      hasPollableIds ? pollable.refetch() : undefined;
    });
  }, [hasPollableIds]); // eslint-disable-line

  useEffect(() => {
    updateGenerationRequest((old) => {
      for (const request of pollable.requests) {
        pages: for (const page of old.pages) {
          const index = page.items.findIndex((x) => x.id === request.id);
          if (index > -1) {
            page.items[index] = request;
            break pages;
          }
        }
      }
    });
  }, [pollable.requests]);
  // #endregion

  if (!storeRef.current) storeRef.current = createGenerationStore();

  return (
    <GenerationContext.Provider value={storeRef.current}>{children}</GenerationContext.Provider>
  );
}
