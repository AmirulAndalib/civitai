import {
  Button,
  Group,
  Radio,
  Stack,
  Text,
  CloseButton,
  ActionIcon,
  Loader,
  Center,
} from '@mantine/core';

import { showNotification, hideNotification } from '@mantine/notifications';
import { NsfwLevel, ReportReason } from '@prisma/client';
import { IconArrowLeft } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { AdminAttentionForm } from '~/components/Report/AdminAttentionForm';
import { ClaimForm } from '~/components/Report/ClaimForm';
import { ArticleNsfwForm, ImageNsfwForm, ModelNsfwForm } from '~/components/Report/NsfwForm';
import { OwnershipForm } from '~/components/Report/OwnershipForm';
import { TosViolationForm } from '~/components/Report/TosViolationForm';
import { ReportEntity } from '~/server/schema/report.schema';
import { showSuccessNotification, showErrorNotification } from '~/utils/notifications';
import { createContextModal } from '~/components/Modals/utils/createContextModal';
import { trpc } from '~/utils/trpc';
import produce from 'immer';
import { useRouter } from 'next/router';
import { getLoginLink } from '~/utils/login-helpers';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { useEffect } from 'react';
import { useVoteForTags } from '~/components/VotableTags/votableTag.utils';

const reports = [
  {
    reason: ReportReason.NSFW,
    label: 'Mature Content',
    Element: ModelNsfwForm,
    availableFor: [ReportEntity.Model],
  },
  {
    reason: ReportReason.NSFW,
    label: 'Mature Content',
    Element: ImageNsfwForm,
    availableFor: [ReportEntity.Image],
  },
  {
    reason: ReportReason.NSFW,
    label: 'Mature Content',
    Element: ArticleNsfwForm,
    availableFor: [
      ReportEntity.Article,
      ReportEntity.Post,
      ReportEntity.Collection,
      ReportEntity.Bounty,
      ReportEntity.BountyEntry,
    ],
  },
  {
    reason: ReportReason.TOSViolation,
    label: 'TOS Violation',
    Element: TosViolationForm,
    availableFor: [
      ReportEntity.Model,
      ReportEntity.Comment,
      ReportEntity.CommentV2,
      ReportEntity.Image,
      ReportEntity.ResourceReview,
      ReportEntity.Article,
      ReportEntity.Post,
      ReportEntity.User,
      ReportEntity.Collection,
      ReportEntity.Bounty,
      ReportEntity.BountyEntry,
    ],
  },
  {
    reason: ReportReason.AdminAttention,
    label: 'Needs Moderator Review',
    Element: AdminAttentionForm,
    availableFor: [
      ReportEntity.Model,
      ReportEntity.Comment,
      ReportEntity.CommentV2,
      ReportEntity.Image,
      ReportEntity.ResourceReview,
      ReportEntity.Article,
      ReportEntity.Post,
      ReportEntity.User,
      ReportEntity.Collection,
      ReportEntity.Bounty,
      ReportEntity.BountyEntry,
    ],
  },
  {
    reason: ReportReason.Claim,
    label: 'Claim imported model',
    Element: ClaimForm,
    availableFor: [ReportEntity.Model], // TODO only available if model creator/userId === -1
  },
  {
    reason: ReportReason.Ownership,
    label: 'This uses my art',
    Element: OwnershipForm,
    availableFor: [ReportEntity.Model, ReportEntity.BountyEntry],
  },
];

const invalidateReasons = [ReportReason.NSFW, ReportReason.Ownership];
const SEND_REPORT_ID = 'sending-report';

const { openModal, Modal } = createContextModal<{ entityType: ReportEntity; entityId: number }>({
  name: 'report',
  withCloseButton: false,
  Element: ({ context, props: { entityType, entityId } }) => {
    // #region [temp for gallery image reports]
    const router = useRouter();
    const modelId = router.query.modelId ? Number(router.query.modelId) : undefined;
    // #endregion

    //TODO - redirect if no user is authenticated
    const [reason, setReason] = useState<ReportReason>();
    const [uploading, setUploading] = useState(false);
    const ReportForm = useMemo(
      () =>
        reports.find((x) => x.reason === reason && x.availableFor.includes(entityType))?.Element ??
        null,
      [reason]
    );
    const title = useMemo(
      () =>
        reports.find((x) => x.reason === reason && x.availableFor.includes(entityType))?.label ??
        `Report ${entityType}`,
      [reason, entityType]
    );
    const handleVote = useVoteForTags({ entityType: entityType as 'image' | 'model', entityId });

    const queryUtils = trpc.useContext();
    const { data, isInitialLoading } = trpc.model.getModelReportDetails.useQuery(
      { id: entityId },
      { enabled: entityType === ReportEntity.Model }
    );
    const { mutate, isLoading: isLoading } = trpc.report.create.useMutation({
      onMutate() {
        showNotification({
          id: SEND_REPORT_ID,
          loading: true,
          disallowClose: true,
          autoClose: false,
          message: 'Sending report...',
        });
      },
      async onSuccess(_, variables) {
        showSuccessNotification({
          title: 'Resource reported',
          message: 'Your request has been received',
        });
        context.close();
        if (invalidateReasons.some((reason) => reason === variables.reason)) {
          switch (entityType) {
            case ReportEntity.Model:
              queryUtils.model.getById.setData(
                { id: variables.id },
                produce((old) => {
                  if (old) {
                    if (variables.reason === ReportReason.NSFW) {
                      old.nsfw = true;
                    } else if (variables.reason === ReportReason.Ownership) {
                      old.reportStats = { ...old.reportStats, ownershipProcessing: 1 };
                    }
                  }
                })
              );
              await queryUtils.model.getAll.invalidate();
              break;

            case ReportEntity.Image:
              if (variables.reason === ReportReason.NSFW) {
                const { tags } = variables.details;
                if (tags) handleVote({ tags, vote: 1 });
              }
              // // model invalidate
              // if (modelId) {
              //   await queryUtils.model.getAll.invalidate();
              // }
              break;
            case ReportEntity.Article:
              if (variables.reason === ReportReason.NSFW) {
                queryUtils.article.getById.setData(
                  { id: variables.id },
                  produce((old) => {
                    if (old) old.nsfw = true;
                  })
                );
              }
              await queryUtils.article.getInfinite.invalidate();
              await queryUtils.article.getByCategory.invalidate();
              break;
            case ReportEntity.Bounty:
              if (variables.reason === ReportReason.NSFW) {
                queryUtils.bounty.getById.setData(
                  { id: variables.id },
                  produce((old) => {
                    if (old) old.nsfw = true;
                  })
                );
              }
              await queryUtils.bounty.getInfinite.invalidate();
              break;
            // Nothing changes here so nothing to invalidate...
            case ReportEntity.Comment:
            case ReportEntity.CommentV2:
            default:
              break;
          }
        }
      },
      onError(error) {
        showErrorNotification({
          error: new Error(error.message),
          title: 'Unable to send report',
          reason: error.message ?? 'An unexpected error occurred, please try again',
        });
      },
      onSettled() {
        hideNotification(SEND_REPORT_ID);
      },
    });

    const handleSubmit = (data: Record<string, unknown>) => {
      const details: any = Object.fromEntries(Object.entries(data).filter(([_, v]) => v != null));
      if (!reason) return;
      mutate({
        type: entityType,
        reason,
        id: entityId,
        details,
      });
    };

    const currentUser = useCurrentUser();
    useEffect(() => {
      if (currentUser) return;
      router.push(getLoginLink({ returnUrl: router.asPath, reason: 'report-content' }));
      context.close();
    }, [currentUser]);

    return (
      <Stack>
        <Group position="apart" noWrap>
          <Group spacing={4}>
            {!!reason && (
              <ActionIcon onClick={() => setReason(undefined)}>
                <IconArrowLeft size={16} />
              </ActionIcon>
            )}
            <Text>{title}</Text>
          </Group>
          <CloseButton onClick={context.close} />
        </Group>
        {isInitialLoading ? (
          <Center p="xl">
            <Loader />
          </Center>
        ) : (
          !reason && (
            <Radio.Group
              orientation="vertical"
              value={reason}
              onChange={(reason) => setReason(reason as ReportReason)}
              // label="Report reason"
              pb="xs"
            >
              {reports
                .filter(({ availableFor }) => availableFor.includes(entityType))
                .filter((item) => {
                  if (entityType === ReportEntity.Model) {
                    if (item.reason === ReportReason.Claim) return data?.userId !== -1;
                    if (item.reason === ReportReason.Ownership) {
                      return !data?.reportStats?.ownershipPending;
                    }
                  }
                  return true;
                }) // TEMP FIX
                .map(({ reason, label }, index) => (
                  <Radio key={index} value={reason} label={label} />
                ))}
            </Radio.Group>
          )
        )}
        {ReportForm && (
          <ReportForm onSubmit={handleSubmit} setUploading={setUploading}>
            <Group grow>
              <Button variant="default" onClick={context.close}>
                Cancel
              </Button>
              <Button type="submit" loading={isLoading} disabled={uploading}>
                Submit
              </Button>
            </Group>
          </ReportForm>
        )}
      </Stack>
    );
  },
});

export const openReportModal = openModal;
export default Modal;
