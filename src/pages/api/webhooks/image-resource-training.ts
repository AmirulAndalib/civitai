import { TrainingStatus } from '@prisma/client';
import * as z from 'zod';
import { dbWrite } from '~/server/db/client';
import { trainingCompleteEmail } from '~/server/email/templates';
import { WebhookEndpoint } from '~/server/utils/endpoint-helpers';

export type EpochSchema = z.infer<typeof epoch_schema>;

const epoch_schema = z.object({
  epoch_number: z.number(),
  model_url: z.string(),
  sample_images: z
    .array(
      z.object({
        image_url: z.string(),
        prompt: z.string(),
      })
    )
    .optional(),
});

type ContextProps = z.infer<typeof context>;
const context = z.object({
  modelFileId: z.number().gt(0),
  status: z.string(),
  message: z.string().optional(),
  model: z.string(),
  start_time: z.number(),
  end_time: z.number().optional(),
  duration: z.number().optional(),
  epochs: z.array(epoch_schema).optional(),
  upload_duration: z.number().optional(),
  sample_prompts: z.array(z.string()).optional(),
  logs: z
    .object({
      stdout: z.string().optional(),
      stderr: z.string().optional(),
    })
    .optional(),
});

type OrchestratorEvent = z.infer<typeof OrchestratorEventSchema>;
export const OrchestratorEventSchema = z.object({
  type: z.string(),
  jobId: z.string(),
  date: z.string(),
  duration: z.string().optional(),
  totalDuration: z.string().optional(),
  workerId: z.string().optional(),
  attempt: z.number().optional(),
  context: context.nullable(),
});

export default WebhookEndpoint(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bodyResults = OrchestratorEventSchema.safeParse(req.body);
  if (!bodyResults.success) {
    return res.status(400).json({ ok: false, errors: bodyResults.error });
  }

  if (!bodyResults.data.context) {
    return res.status(400).json({ ok: false, error: 'context is undefined' });
  }

  await handleOrchestratorEvent(bodyResults.data);
});

export async function handleOrchestratorEvent({
  jobId,
  type: eventType,
  context,
}: OrchestratorEvent) {
  const status = {
    Success: TrainingStatus.InReview,
    Update: TrainingStatus.Processing,
    Fail: TrainingStatus.Failed,
    Reject: TrainingStatus.Failed,
    LateReject: TrainingStatus.Failed,
  }[eventType];

  switch (eventType) {
    case 'Success':
    case 'Fail':
    case 'Reject':
    case 'LateReject':
    case 'Update':
      if (!context) {
        throw new Error('context is undefined');
      }

      await updateRecords({ ...context, jobId: jobId }, status as TrainingStatus);

      break;
    case 'Expire':
    case 'Claim':
      // TODO: handle these now that we have the job id
      break;
    default:
      throw new Error(`Unknown event type: ${eventType}`);
  }
}

async function updateRecords(
  { modelFileId, message, epochs, start_time, end_time, jobId }: ContextProps & { jobId: string },
  status: TrainingStatus
) {
  const modelFile = await dbWrite.modelFile.findFirst({
    where: { id: modelFileId },
  });

  if (!modelFile) {
    throw new Error('ModelFile not found');
  }

  const thisMetadata = (modelFile.metadata ?? {}) as FileMetadata;
  const trainingResults = thisMetadata.trainingResults || {};
  const history = trainingResults.history || [];

  const last = history[history.length - 1];
  if (!last || last.status !== status) {
    // push to history
    history.push({
      jobId: jobId,
      // last should always be present for new jobs and have a jobToken
      jobToken: last?.jobToken || '',
      time: new Date().toISOString(),
      status,
      message,
    });
  }

  let attempts = trainingResults.attempts || 0;
  if (status === TrainingStatus.Failed) {
    attempts += 1;
  }

  const metadata = {
    ...thisMetadata,
    trainingResults: {
      ...trainingResults,
      epochs: epochs,
      attempts: attempts,
      history: history,
      start_time: trainingResults.start_time || new Date(start_time * 1000).toISOString(),
      end_time: end_time && new Date(end_time * 1000).toISOString(),
    },
  };

  await dbWrite.modelFile.update({
    where: { id: modelFile.id },
    data: {
      metadata,
    },
  });

  const modelVersion = await dbWrite.modelVersion.update({
    where: { id: modelFile.modelVersionId },
    data: {
      trainingStatus: status,
    },
  });

  if (status === 'InReview') {
    const model = await dbWrite.model.findFirst({
      where: { id: modelVersion.modelId },
      select: {
        id: true,
        name: true,
        user: {
          select: {
            email: true,
            username: true,
          },
        },
      },
    });
    if (!model || !model.user) return;

    await trainingCompleteEmail.send({
      model,
      user: model.user,
    });
  }
}
