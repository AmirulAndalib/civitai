import type {
  OpenAiGpt1CreateImageInput,
  OpenAiGpt1EditImageInput,
  OpenAiGpt1ImageGenInput,
} from '@civitai/client';
import { ImageGenConfig } from '~/shared/orchestrator/ImageGen/ImageGenConfig';
import { findClosestAspectRatio } from '~/utils/aspect-ratio-helpers';

const openAISizes = [
  { width: 1024, height: 1024 },
  { width: 1536, height: 1024 },
  { width: 1024, height: 1536 },
];

type OpenaiModel = (typeof openaiModels)[number];
export const openaiModels = ['gpt-image-1'] as const;

export const openaiModelVersionToModelMap = new Map<number, OpenaiModel>([
  [1733399, 'gpt-image-1'],
]);

export const openaiConfig = ImageGenConfig({
  metadataFn: (params) => {
    const { width, height } = findClosestAspectRatio(params.sourceImage ?? params, openAISizes);

    return {
      engine: 'openai',
      baseModel: params.baseModel,
      process: !params.sourceImage ? 'txt2img' : 'img2img',
      prompt: params.prompt,
      // quality: params.openAIQuality,
      background: params.openAITransparentBackground ? 'transparent' : 'opaque',
      quality: params.openAIQuality,
      quantity: Math.min(params.quantity, 10),
      sourceImage: params.sourceImage,
      width,
      height,
    };
  },
  inputFn: ({ params }): OpenAiGpt1CreateImageInput | OpenAiGpt1EditImageInput => {
    const baseData = {
      engine: params.engine,
      model: 'gpt-image-1',
      prompt: params.prompt,
      background: params.background,
      quantity: params.quantity,
      quality: params.quality,
      size: `${params.width}x${params.height}`,
    } as Omit<OpenAiGpt1ImageGenInput, 'operation'>;
    if (!params.sourceImage) {
      return {
        ...baseData,
        operation: 'createImage',
      } satisfies OpenAiGpt1CreateImageInput;
    } else {
      return {
        ...baseData,
        operation: 'editImage',
        images: [params.sourceImage.url],
      } satisfies OpenAiGpt1EditImageInput;
    }
  },
});
