import { QS } from '~/utils/qs';

export const loginRedirectReasons = {
  'download-auth': 'You need to be logged in to download this model',
  'report-model': 'You need to be logged in to report this model',
  'report-review': 'You need to be logged in to report this review',
  'create-review': 'You need to be logged in to add a review',
  'upload-model': 'You need to be logged in to upload a model',
  'favorite-model': 'You need to be logged in to like a model',
  'create-comment': 'You need to be logged in to add a comment',
  'report-comment': 'You need to be logged in to report this comment',
  'follow-user': 'You need to be logged in to follow a user',
};

export type LoginRedirectReason = keyof typeof loginRedirectReasons;

export function getLoginLink({
  returnUrl,
  reason,
}: {
  returnUrl?: string;
  reason?: LoginRedirectReason;
}) {
  return `/login?${QS.stringify({ returnUrl, reason })}`;
  // return `/login?returnUrl=${encodeURIComponent(returnUrl)}`;
}
