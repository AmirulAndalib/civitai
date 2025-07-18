import { trpc } from '~/utils/trpc';
import type { ButtonProps } from '@mantine/core';
import { Button, Menu } from '@mantine/core';
import { IconEye, IconEyeOff } from '@tabler/icons-react';
import type { MouseEventHandler } from 'react';
import { LoginRedirect } from '~/components/LoginRedirect/LoginRedirect';
import { useHiddenPreferencesData, useToggleHiddenPreferences } from '~/hooks/hidden-preferences';

import { useCurrentUser } from '~/hooks/useCurrentUser';
import { showSuccessNotification } from '~/utils/notifications';

export function HideModelButton({ modelId, as = 'button', onToggleHide, ...props }: Props) {
  const currentUser = useCurrentUser();
  const utils = trpc.useUtils();

  const models = useHiddenPreferencesData().hiddenModels;
  const hiddenModels = models.filter((x) => x.hidden);
  const alreadyHiding = hiddenModels.some((x) => x.id === modelId);

  const toggleHiddenMutation = useToggleHiddenPreferences();

  const handleHideClick: MouseEventHandler<HTMLElement> = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!alreadyHiding) await utils.model.getAll.invalidate({ hidden: true }, { exact: false });
    toggleHiddenMutation.mutateAsync({ kind: 'model', data: [{ id: modelId }] }).then(() => {
      showSuccessNotification({
        title: `Model ${alreadyHiding ? 'unhidden' : 'hidden'}`,
        message: `This model will${alreadyHiding ? ' ' : ' not '}show up in your feed`,
      });
    });
    onToggleHide?.();
  };

  if (currentUser != null && modelId === currentUser.id) return null;

  return as === 'button' ? (
    <LoginRedirect reason="hide-content">
      <Button
        variant={alreadyHiding ? 'outline' : 'filled'}
        onClick={handleHideClick}
        loading={toggleHiddenMutation.isLoading}
        {...props}
      >
        {alreadyHiding ? 'Unhide' : 'Hide'}
      </Button>
    </LoginRedirect>
  ) : (
    <LoginRedirect reason="hide-content">
      <Menu.Item
        onClick={handleHideClick}
        leftSection={
          alreadyHiding ? <IconEye size={16} stroke={1.5} /> : <IconEyeOff size={16} stroke={1.5} />
        }
      >
        {alreadyHiding ? 'Unhide ' : 'Hide '}this model
      </Menu.Item>
    </LoginRedirect>
  );
}

type Props = Omit<ButtonProps, 'onClick'> & {
  modelId: number;
  as?: 'menu-item' | 'button';
  onToggleHide?: () => void;
};
