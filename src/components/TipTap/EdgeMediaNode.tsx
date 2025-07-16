import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import type { MediaType } from '~/shared/utils/prisma/enums';
import { Plugin, PluginKey } from '@tiptap/pm/state';

import { constants } from '~/server/common/constants';
import { useEffect, useRef } from 'react';
import { useCFImageUpload } from '~/hooks/useCFImageUpload';
import { fetchBlobAsFile } from '~/utils/file-utils';
import { Loader } from '@mantine/core';
import { hideNotification, showNotification } from '@mantine/notifications';
import { MEDIA_TYPE } from '~/shared/constants/mime-types';
import { useEdgeUrl } from '~/client-utils/cf-images-utils';
import { EdgeMediaNode } from '~/shared/tiptap/edge-media.node';
import { showWarningNotification } from '~/utils/notifications';

type NodeOptions = {
  accepts: MediaType[];
};

interface SetMediaOptions {
  url: string;
  type: MediaType;
  filename?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    media: {
      addMedia: (file: File) => ReturnType;
    };
  }
}

export const EdgeMediaEditNode = EdgeMediaNode.extend<NodeOptions>({
  addOptions() {
    return { ...this.parent?.(), accepts: ['image'] };
  },
  addNodeView() {
    return ReactNodeViewRenderer(EdgeMediaEditComponent);
  },
  addCommands() {
    return {
      addMedia:
        // @ts-ignore


          (file) =>
          // @ts-ignore
          ({ commands }) => {
            const type = MEDIA_TYPE[file.type];
            if (!this.options.accepts.includes(type)) {
              showWarningNotification({ message: `invalid file type: ${file.type}` });
              return true;
            } else {
              return commands.insertContent({
                type: this.name,
                attrs: {
                  url: URL.createObjectURL(file),
                  type,
                  filename: file.name,
                },
              });
            }
          },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('mediaUpload'),
        props: {
          handlePaste: (view, event) => {
            const items = event.clipboardData?.items;
            if (!items) return false;

            for (const item of items) {
              if (!(constants.richTextEditor.accept as string[]).includes(item.type)) return false;

              const file = item.getAsFile();
              if (file) {
                this.editor.commands.addMedia(file);
              }
            }

            return true;
          },
          handleDrop: (view, event) => {
            const files = event.dataTransfer?.files;
            if (!files) return false;

            for (const file of files) {
              this.editor.commands.addMedia(file);
            }
            return true;
          },
        },
      }),
    ];
  },
});

const UPLOAD_NOTIFICATION_ID = 'upload-image-notification';

function EdgeMediaEditComponent({
  node,
  selected,
  ref,
  updateAttributes,
}: ReactNodeViewProps<HTMLDivElement>) {
  const { url, type, filename } = node.attrs as SetMediaOptions;
  const { uploadToCF } = useCFImageUpload();
  const isObjectUrl = url?.startsWith('blob');
  const uploadingRef = useRef(false);

  useEffect(() => {
    if (isObjectUrl && !uploadingRef.current) {
      uploadingRef.current = true;
      showNotification({
        id: UPLOAD_NOTIFICATION_ID,
        loading: true,
        withCloseButton: false,
        autoClose: false,
        message: `Uploading ${type}...`,
      });
      fetchBlobAsFile(url, filename).then((file) => {
        if (!file) return;
        uploadToCF(file)
          .then((result) => {
            updateAttributes({
              url: result.id,
              type,
              filename,
            });
            hideNotification(UPLOAD_NOTIFICATION_ID);
          })
          .catch(() => window.alert(`Failed to upload ${type}. Please try again`));
      });
    }
  }, [url, isObjectUrl]);

  if (!url) return null;

  return (
    <NodeViewWrapper>
      <div ref={ref as any} data-drag-handle>
        {isObjectUrl ? (
          <Loader type="dots" />
        ) : (
          <EdgeMediaComponent url={url} type={type} filename={filename} />
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const EdgeMediaLayoutNode = EdgeMediaNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(EdgeMediaLayoutComponent);
  },
});

export function EdgeMediaLayoutComponent({ node }: ReactNodeViewProps<HTMLDivElement>) {
  const { url, type, filename } = node.attrs as SetMediaOptions;
  const { url: src } = useEdgeUrl(url, { original: true });
  if (!url) return null;
  return (
    <NodeViewWrapper>
      {type === 'image' ? (
        // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
        <img src={src} alt={filename} />
      ) : type === 'video' ? (
        <video playsInline disablePictureInPicture controls preload="metadata">
          <source src={src?.replace('.mp4', '.webm')} type="video/webm" />
          <source src={src} type="video/mp4" />
        </video>
      ) : null}
    </NodeViewWrapper>
  );
}

export function EdgeMediaComponent({ url, type, filename }: SetMediaOptions) {
  const { url: src } = useEdgeUrl(url, { original: true });
  return type === 'image' ? (
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    <img src={src} alt={filename} />
  ) : type === 'video' ? (
    <video playsInline disablePictureInPicture controls preload="metadata">
      <source src={src?.replace('.mp4', '.webm')} type="video/webm" />
      <source src={src} type="video/mp4" />
    </video>
  ) : null;
}
