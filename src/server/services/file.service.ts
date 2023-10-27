import { Prisma } from '@prisma/client';
import { BaseFileSchema, GetFilesByEntitySchema } from '~/server/schema/file.schema';
import { getBountyEntryFilteredFiles } from '~/server/services/bountyEntry.service';
import { isDefined } from '~/utils/type-guards';
import { dbRead } from '../db/client';

export const getFilesByEntity = async ({ id, ids, type }: GetFilesByEntitySchema) => {
  if (!id && (!ids || ids.length === 0)) {
    return [];
  }

  const files = await dbRead.file.findMany({
    where: { entityId: ids ? { in: ids } : id, entityType: type },
    select: { id: true, name: true, url: true, sizeKB: true, metadata: true, entityId: true },
  });

  return files.map(({ metadata, ...file }) => ({
    ...file,
    metadata: (metadata as Prisma.JsonObject) ?? {},
  }));
};

export const updateEntityFiles = async ({
  tx,
  entityId,
  entityType,
  files,
  ownRights,
}: {
  tx: Prisma.TransactionClient;
  entityId: number;
  entityType: string;
  files: BaseFileSchema[];
  ownRights: boolean;
}) => {
  const updatedFiles = files.filter((f) => f.id);

  if (updatedFiles.length > 0) {
    await Promise.all(
      updatedFiles.map((file) => {
        return tx.file.update({
          where: { id: file.id },
          data: {
            ...file,
            metadata: { ...(file.metadata ?? {}), ownRights },
          },
        });
      })
    );
  }

  // Delete any files that were removed.
  const deletedFileIds = files.map((x) => x.id).filter(isDefined);

  if (deletedFileIds.length >= 0) {
    await tx.file.deleteMany({
      where: {
        entityId,
        entityType,
        id: { notIn: deletedFileIds },
      },
    });
  }

  const newFiles = files.filter((x) => !x.id);

  if (newFiles.length > 0) {
    // Create any new files.
    await tx.file.createMany({
      data: newFiles.map((file) => ({
        ...file,
        entityId,
        entityType,
        metadata: { ...(file.metadata ?? {}), ownRights },
      })),
    });
  }
};

export const getFileWithPermission = async ({
  fileId,
  userId,
  isModerator,
}: {
  fileId: number;
  userId?: number;
  isModerator?: boolean;
}) => {
  const file = await dbRead.file.findUnique({
    where: { id: fileId },
    select: { url: true, name: true, metadata: true, entityId: true, entityType: true },
  });

  if (!file) return null;

  switch (file.entityType) {
    case 'BountyEntry': {
      const bountyEntryFiles = await getBountyEntryFilteredFiles({
        id: file.entityId,
        userId,
        isModerator,
      });
      if (!bountyEntryFiles.some((x) => x.id === fileId && !!x.url)) {
        return null;
      }

      return file;
    }
    default:
      return file;
  }
};
