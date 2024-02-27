import { NsfwLevel } from '~/server/common/enums';
import { Flags } from '~/shared/utils';

export function parseBitwiseBrowsingLevel(level: number): BrowsingLevel[] {
  return Flags.instanceToArray(level);
}

export function flagifyBrowsingLevel(levels: BrowsingLevel[]) {
  return Flags.arrayToInstance(levels);
}

export type BrowsingLevels = typeof browsingLevels;
export type BrowsingLevel = BrowsingLevels[number];
export const browsingLevels = [
  NsfwLevel.PG,
  NsfwLevel.PG13,
  NsfwLevel.R,
  NsfwLevel.X,
  NsfwLevel.XXX,
] as const;

export const browsingLevelLabels = {
  [NsfwLevel.PG]: 'PG',
  [NsfwLevel.PG13]: 'PG-13',
  [NsfwLevel.R]: 'R',
  [NsfwLevel.X]: 'X',
  [NsfwLevel.XXX]: 'XXX',
} as const;

export const browsingLevelDescriptions = {
  [NsfwLevel.PG]: 'Some explanation',
  [NsfwLevel.PG13]: 'Some explanation',
  [NsfwLevel.R]: 'Some explanation',
  [NsfwLevel.X]: 'Some explanation',
  [NsfwLevel.XXX]: 'Some explanation',
} as const;

// public browsing levels
export const publicBrowsingLevelsArray: BrowsingLevel[] = [NsfwLevel.PG, NsfwLevel.PG13];
export const publicBrowsingLevelsFlag = flagifyBrowsingLevel(publicBrowsingLevelsArray);

// nsfw browsing levels
export const nsfwBrowsingLevelsArray: BrowsingLevel[] = [NsfwLevel.R, NsfwLevel.X, NsfwLevel.XXX];
export const nsfwBrowsingLevelsFlag = flagifyBrowsingLevel(nsfwBrowsingLevelsArray);

// all browsing levels
export const allBrowsingLevelsFlag = flagifyBrowsingLevel([...browsingLevels]);

export function getIsPublicBrowsingLevel(level: number) {
  const levels = parseBitwiseBrowsingLevel(level);
  return levels.every((level) => publicBrowsingLevelsArray.includes(level));
}