import { ImageMetaProps } from '~/server/schema/image.schema';
import {
  Stack,
  Text,
  Code,
  Popover,
  PopoverProps,
  Group,
  SimpleGrid,
  Button,
  Badge,
} from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { IconCheck, IconCopy } from '@tabler/icons';
import { useMemo } from 'react';
import { encodeMetadata } from '~/utils/image-metadata';
import { useAutomaticSDContext } from '~/hooks/useAutomaticSD';
import { RunButton } from '~/components/RunStrategy/RunButton';

type Props = {
  meta: ImageMetaProps;
  modelVersionId?: number | null;
};
type MetaDisplay = {
  label: string;
  value: string;
};

const labelDictionary: Record<keyof ImageMetaProps, string> = {
  prompt: 'Prompt',
  negativePrompt: 'Negative prompt',
  cfgScale: 'CFG scale',
  steps: 'Steps',
  sampler: 'Sampler',
  seed: 'Seed',
};

export function ImageMeta({ meta, modelVersionId }: Props) {
  const { copied, copy } = useClipboard();
  const { connected } = useAutomaticSDContext();
  // TODO only show keys in our meta list
  const metas = useMemo(() => {
    const long: MetaDisplay[] = [];
    const short: MetaDisplay[] = [];
    for (const key of Object.keys(labelDictionary)) {
      const value = meta[key]?.toString();
      if (!value) continue;
      (value.length > 15 || key === 'prompt' ? long : short).push({
        label: labelDictionary[key],
        value,
      });
    }
    return { long, short };
  }, [meta]);

  const type = useMemo(() => {
    if (meta['Mask blur'] != null) return 'inpainting';
    if (meta['Denoise strength'] != null && !meta['First pass strength']) return 'img2img';
    if (meta['Denoise strength'] != null && meta['First pass strength']) return 'txt2img + hi-res';
    return 'txt2img';
  }, [meta]);

  return (
    <Stack spacing="xs">
      {metas.long.map(({ label, value }) => (
        <Stack key={label} spacing={0}>
          <Text size="sm" weight={500}>
            {label}{' '}
            {label === 'Prompt' && (
              <Badge size="xs" radius="sm" ml={4}>
                {type}
              </Badge>
            )}
          </Text>
          <Code block sx={{ whiteSpace: 'normal', maxHeight: 150, overflowY: 'auto' }}>
            {value}
          </Code>
        </Stack>
      ))}
      <SimpleGrid cols={2} verticalSpacing="xs">
        {metas.short.map(({ label, value }) => (
          <Group key={label} spacing={0}>
            <Text size="sm" mr="xs" weight={500}>
              {label}
            </Text>
            <Code sx={{ flex: '1', textAlign: 'right', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {value}
            </Code>
          </Group>
        ))}
      </SimpleGrid>
      <Group spacing="xs">
        <Button
          style={{ flex: 1 }}
          color={copied ? 'teal' : 'blue'}
          variant="light"
          leftIcon={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          onClick={() => {
            copy(encodeMetadata(meta));
          }}
        >
          {copied ? 'Copied' : 'Copy Generation Data'}
        </Button>
        {modelVersionId && connected && (
          <RunButton
            modelVersionId={modelVersionId}
            generationParams={encodeMetadata(meta)}
            label="Run Generation"
          />
        )}
      </Group>
    </Stack>
  );
}

export function ImageMetaPopover({
  meta,
  modelVersionId,
  children,
  ...popoverProps
}: Props & { children: React.ReactElement } & PopoverProps) {
  return (
    <Popover width={350} shadow="md" position="top-end" withArrow withinPortal {...popoverProps}>
      <Popover.Target>{children}</Popover.Target>
      <Popover.Dropdown>
        <ImageMeta meta={meta} modelVersionId={modelVersionId} />
      </Popover.Dropdown>
    </Popover>
  );
}
