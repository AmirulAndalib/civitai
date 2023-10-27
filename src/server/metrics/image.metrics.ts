import { createMetricProcessor } from '~/server/metrics/base.metrics';
import { Prisma, SearchIndexUpdateQueueAction } from '@prisma/client';
import { imagesSearchIndex } from '~/server/search-index';

export const imageMetrics = createMetricProcessor({
  name: 'Image',
  async update({ db, lastUpdate }) {
    const recentEngagementSubquery = Prisma.sql`
    WITH recent_engagements AS
      (
        SELECT
          "imageId" AS id
        FROM "ImageReaction"
        WHERE "createdAt" > ${lastUpdate}

        UNION

        SELECT t."imageId" as id
        FROM "Thread" t
        JOIN "CommentV2" c ON c."threadId" = t.id
        WHERE t."imageId" IS NOT NULL AND c."createdAt" > ${lastUpdate}

        UNION

        SELECT ci."imageId" as id
        FROM "CollectionItem" ci
        WHERE ci."imageId" IS NOT NULL AND ci."createdAt" > ${lastUpdate}

        UNION
        
        SELECT bt."entityId" as id
        FROM "BuzzTip" bt
        WHERE bt."entityId" IS NOT NULL AND bt."entityType" = 'Image'
          AND (bt."createdAt" > ${lastUpdate} OR bt."updatedAt" > ${lastUpdate})
  
        UNION

        SELECT
          "id"
        FROM "MetricUpdateQueue"
        WHERE type = 'Image'
      )
      `;

    await db.$executeRaw`
    ${recentEngagementSubquery},
      -- Get all affected users
      affected AS
      (
          SELECT DISTINCT
              r.id
          FROM recent_engagements r
          JOIN "Image" i ON i.id = r.id
          WHERE r.id IS NOT NULL
      )

      -- upsert metrics for all affected users
      -- perform a one-pass table scan producing all metrics for all affected users
      INSERT INTO "ImageMetric" ("imageId", timeframe, "likeCount", "dislikeCount", "heartCount", "laughCount", "cryCount", "commentCount", "collectedCount", "tippedCount", "tippedAmountCount") 
      SELECT
        m.id,
        tf.timeframe,
        CASE
          WHEN tf.timeframe = 'AllTime' THEN like_count
          WHEN tf.timeframe = 'Year' THEN year_like_count
          WHEN tf.timeframe = 'Month' THEN month_like_count
          WHEN tf.timeframe = 'Week' THEN week_like_count
          WHEN tf.timeframe = 'Day' THEN day_like_count
        END AS like_count,
        CASE
          WHEN tf.timeframe = 'AllTime' THEN dislike_count
          WHEN tf.timeframe = 'Year' THEN year_dislike_count
          WHEN tf.timeframe = 'Month' THEN month_dislike_count
          WHEN tf.timeframe = 'Week' THEN week_dislike_count
          WHEN tf.timeframe = 'Day' THEN day_dislike_count
        END AS dislike_count,
        CASE
          WHEN tf.timeframe = 'AllTime' THEN heart_count
          WHEN tf.timeframe = 'Year' THEN year_heart_count
          WHEN tf.timeframe = 'Month' THEN month_heart_count
          WHEN tf.timeframe = 'Week' THEN week_heart_count
          WHEN tf.timeframe = 'Day' THEN day_heart_count
        END AS heart_count,
        CASE
          WHEN tf.timeframe = 'AllTime' THEN laugh_count
          WHEN tf.timeframe = 'Year' THEN year_laugh_count
          WHEN tf.timeframe = 'Month' THEN month_laugh_count
          WHEN tf.timeframe = 'Week' THEN week_laugh_count
          WHEN tf.timeframe = 'Day' THEN day_laugh_count
        END AS laugh_count,
        CASE
          WHEN tf.timeframe = 'AllTime' THEN cry_count
          WHEN tf.timeframe = 'Year' THEN year_cry_count
          WHEN tf.timeframe = 'Month' THEN month_cry_count
          WHEN tf.timeframe = 'Week' THEN week_cry_count
          WHEN tf.timeframe = 'Day' THEN day_cry_count
        END AS cry_count,
        CASE
          WHEN tf.timeframe = 'AllTime' THEN comment_count
          WHEN tf.timeframe = 'Year' THEN year_comment_count
          WHEN tf.timeframe = 'Month' THEN month_comment_count
          WHEN tf.timeframe = 'Week' THEN week_comment_count
          WHEN tf.timeframe = 'Day' THEN day_comment_count
        END AS comment_count,
        CASE
          WHEN tf.timeframe = 'AllTime' THEN collected_count
          WHEN tf.timeframe = 'Year' THEN year_collected_count
          WHEN tf.timeframe = 'Month' THEN month_collected_count
          WHEN tf.timeframe = 'Week' THEN week_collected_count
          WHEN tf.timeframe = 'Day' THEN day_collected_count
        END AS collected_count,
        CASE
          WHEN tf.timeframe = 'AllTime' THEN tipped_count
          WHEN tf.timeframe = 'Year' THEN year_tipped_count
          WHEN tf.timeframe = 'Month' THEN month_tipped_count
          WHEN tf.timeframe = 'Week' THEN week_tipped_count
          WHEN tf.timeframe = 'Day' THEN day_tipped_count
        END AS tipped_count,
        CASE
          WHEN tf.timeframe = 'AllTime' THEN tipped_amount_count
          WHEN tf.timeframe = 'Year' THEN year_tipped_amount_count
          WHEN tf.timeframe = 'Month' THEN month_tipped_amount_count
          WHEN tf.timeframe = 'Week' THEN week_tipped_amount_count
          WHEN tf.timeframe = 'Day' THEN day_tipped_amount_count
        END AS tipped_amount_count
      FROM
      (
        SELECT
          q.id,
          COALESCE(r.heart_count, 0) AS heart_count,
          COALESCE(r.year_heart_count, 0) AS year_heart_count,
          COALESCE(r.month_heart_count, 0) AS month_heart_count,
          COALESCE(r.week_heart_count, 0) AS week_heart_count,
          COALESCE(r.day_heart_count, 0) AS day_heart_count,
          COALESCE(r.laugh_count, 0) AS laugh_count,
          COALESCE(r.year_laugh_count, 0) AS year_laugh_count,
          COALESCE(r.month_laugh_count, 0) AS month_laugh_count,
          COALESCE(r.week_laugh_count, 0) AS week_laugh_count,
          COALESCE(r.day_laugh_count, 0) AS day_laugh_count,
          COALESCE(r.cry_count, 0) AS cry_count,
          COALESCE(r.year_cry_count, 0) AS year_cry_count,
          COALESCE(r.month_cry_count, 0) AS month_cry_count,
          COALESCE(r.week_cry_count, 0) AS week_cry_count,
          COALESCE(r.day_cry_count, 0) AS day_cry_count,
          COALESCE(r.dislike_count, 0) AS dislike_count,
          COALESCE(r.year_dislike_count, 0) AS year_dislike_count,
          COALESCE(r.month_dislike_count, 0) AS month_dislike_count,
          COALESCE(r.week_dislike_count, 0) AS week_dislike_count,
          COALESCE(r.day_dislike_count, 0) AS day_dislike_count,
          COALESCE(r.like_count, 0) AS like_count,
          COALESCE(r.year_like_count, 0) AS year_like_count,
          COALESCE(r.month_like_count, 0) AS month_like_count,
          COALESCE(r.week_like_count, 0) AS week_like_count,
          COALESCE(r.day_like_count, 0) AS day_like_count,
          COALESCE(c.comment_count, 0) AS comment_count,
          COALESCE(c.year_comment_count, 0) AS year_comment_count,
          COALESCE(c.month_comment_count, 0) AS month_comment_count,
          COALESCE(c.week_comment_count, 0) AS week_comment_count,
          COALESCE(c.day_comment_count, 0) AS day_comment_count,
          COALESCE(ci.collected_count, 0) AS collected_count,
          COALESCE(ci.year_collected_count, 0) AS year_collected_count,
          COALESCE(ci.month_collected_count, 0) AS month_collected_count,
          COALESCE(ci.week_collected_count, 0) AS week_collected_count,
          COALESCE(ci.day_collected_count, 0) AS day_collected_count,
          COALESCE(bt.tipped_count, 0) AS tipped_count,
          COALESCE(bt.year_tipped_count, 0) AS year_tipped_count,
          COALESCE(bt.month_tipped_count, 0) AS month_tipped_count,
          COALESCE(bt.week_tipped_count, 0) AS week_tipped_count,
          COALESCE(bt.day_tipped_count, 0) AS day_tipped_count,
          COALESCE(bt.tipped_amount_count, 0) AS tipped_amount_count,
          COALESCE(bt.year_tipped_amount_count, 0) AS year_tipped_amount_count,
          COALESCE(bt.month_tipped_amount_count, 0) AS month_tipped_amount_count,
          COALESCE(bt.week_tipped_amount_count, 0) AS week_tipped_amount_count,
          COALESCE(bt.day_tipped_amount_count, 0) AS day_tipped_amount_count
        FROM affected q
        LEFT JOIN (
          SELECT
            ic."imageId" AS id,
            COUNT(*) AS comment_count,
            SUM(IIF(v."createdAt" >= (NOW() - interval '365 days'), 1, 0)) AS year_comment_count,
            SUM(IIF(v."createdAt" >= (NOW() - interval '30 days'), 1, 0)) AS month_comment_count,
            SUM(IIF(v."createdAt" >= (NOW() - interval '7 days'), 1, 0)) AS week_comment_count,
            SUM(IIF(v."createdAt" >= (NOW() - interval '1 days'), 1, 0)) AS day_comment_count
          FROM "Thread" ic
          JOIN "CommentV2" v ON ic."id" = v."threadId"
          WHERE ic."imageId" IS NOT NULL
          GROUP BY ic."imageId"
        ) c ON q.id = c.id
        LEFT JOIN (
          SELECT
            ir."imageId" AS id,
            SUM(IIF(ir.reaction = 'Heart', 1, 0)) AS heart_count,
            SUM(IIF(ir.reaction = 'Heart' AND ir."createdAt" >= (NOW() - interval '365 days'), 1, 0)) AS year_heart_count,
            SUM(IIF(ir.reaction = 'Heart' AND ir."createdAt" >= (NOW() - interval '30 days'), 1, 0)) AS month_heart_count,
            SUM(IIF(ir.reaction = 'Heart' AND ir."createdAt" >= (NOW() - interval '7 days'), 1, 0)) AS week_heart_count,
            SUM(IIF(ir.reaction = 'Heart' AND ir."createdAt" >= (NOW() - interval '1 days'), 1, 0)) AS day_heart_count,
            SUM(IIF(ir.reaction = 'Like', 1, 0)) AS like_count,
            SUM(IIF(ir.reaction = 'Like' AND ir."createdAt" >= (NOW() - interval '365 days'), 1, 0)) AS year_like_count,
            SUM(IIF(ir.reaction = 'Like' AND ir."createdAt" >= (NOW() - interval '30 days'), 1, 0)) AS month_like_count,
            SUM(IIF(ir.reaction = 'Like' AND ir."createdAt" >= (NOW() - interval '7 days'), 1, 0)) AS week_like_count,
            SUM(IIF(ir.reaction = 'Like' AND ir."createdAt" >= (NOW() - interval '1 days'), 1, 0)) AS day_like_count,
            SUM(IIF(ir.reaction = 'Dislike', 1, 0)) AS dislike_count,
            SUM(IIF(ir.reaction = 'Dislike' AND ir."createdAt" >= (NOW() - interval '365 days'), 1, 0)) AS year_dislike_count,
            SUM(IIF(ir.reaction = 'Dislike' AND ir."createdAt" >= (NOW() - interval '30 days'), 1, 0)) AS month_dislike_count,
            SUM(IIF(ir.reaction = 'Dislike' AND ir."createdAt" >= (NOW() - interval '7 days'), 1, 0)) AS week_dislike_count,
            SUM(IIF(ir.reaction = 'Dislike' AND ir."createdAt" >= (NOW() - interval '1 days'), 1, 0)) AS day_dislike_count,
            SUM(IIF(ir.reaction = 'Cry', 1, 0)) AS cry_count,
            SUM(IIF(ir.reaction = 'Cry' AND ir."createdAt" >= (NOW() - interval '365 days'), 1, 0)) AS year_cry_count,
            SUM(IIF(ir.reaction = 'Cry' AND ir."createdAt" >= (NOW() - interval '30 days'), 1, 0)) AS month_cry_count,
            SUM(IIF(ir.reaction = 'Cry' AND ir."createdAt" >= (NOW() - interval '7 days'), 1, 0)) AS week_cry_count,
            SUM(IIF(ir.reaction = 'Cry' AND ir."createdAt" >= (NOW() - interval '1 days'), 1, 0)) AS day_cry_count,
            SUM(IIF(ir.reaction = 'Laugh', 1, 0)) AS laugh_count,
            SUM(IIF(ir.reaction = 'Laugh' AND ir."createdAt" >= (NOW() - interval '365 days'), 1, 0)) AS year_laugh_count,
            SUM(IIF(ir.reaction = 'Laugh' AND ir."createdAt" >= (NOW() - interval '30 days'), 1, 0)) AS month_laugh_count,
            SUM(IIF(ir.reaction = 'Laugh' AND ir."createdAt" >= (NOW() - interval '7 days'), 1, 0)) AS week_laugh_count,
            SUM(IIF(ir.reaction = 'Laugh' AND ir."createdAt" >= (NOW() - interval '1 days'), 1, 0)) AS day_laugh_count
          FROM "ImageReaction" ir
          GROUP BY ir."imageId"
        ) r ON q.id = r.id
        LEFT JOIN (
          SELECT
            ici."imageId" AS id,
            COUNT(*) AS collected_count,
            SUM(IIF(ici."createdAt" >= (NOW() - interval '365 days'), 1, 0)) AS year_collected_count,
            SUM(IIF(ici."createdAt" >= (NOW() - interval '30 days'), 1, 0)) AS month_collected_count,
            SUM(IIF(ici."createdAt" >= (NOW() - interval '7 days'), 1, 0)) AS week_collected_count,
            SUM(IIF(ici."createdAt" >= (NOW() - interval '1 days'), 1, 0)) AS day_collected_count
          FROM "CollectionItem" ici
          WHERE ici."imageId" IS NOT NULL
          GROUP BY ici."imageId"
        ) ci ON q.id = ci.id
        LEFT JOIN (
          SELECT
            abt."entityId" AS id,
            COALESCE(COUNT(*), 0) AS tipped_count,
            SUM(IIF(abt."updatedAt" >= (NOW() - interval '365 days'), 1, 0)) AS year_tipped_count,
            SUM(IIF(abt."updatedAt" >= (NOW() - interval '30 days'), 1, 0)) AS month_tipped_count,
            SUM(IIF(abt."updatedAt" >= (NOW() - interval '7 days'), 1, 0)) AS week_tipped_count,
            SUM(IIF(abt."updatedAt" >= (NOW() - interval '1 days'), 1, 0)) AS day_tipped_count,
            COALESCE(SUM(abt.amount), 0) AS tipped_amount_count,
            SUM(IIF(abt."updatedAt" >= (NOW() - interval '365 days'), abt.amount, 0)) AS year_tipped_amount_count,
            SUM(IIF(abt."updatedAt" >= (NOW() - interval '30 days'), abt.amount, 0)) AS month_tipped_amount_count,
            SUM(IIF(abt."updatedAt" >= (NOW() - interval '7 days'), abt.amount, 0)) AS week_tipped_amount_count,
            SUM(IIF(abt."updatedAt" >= (NOW() - interval '1 days'), abt.amount, 0)) AS day_tipped_amount_count
          FROM "BuzzTip" abt
          WHERE abt."entityType" = 'Image' AND abt."entityId" IS NOT NULL
          GROUP BY abt."entityId"
        ) bt ON q.id = bt.id
      ) m
      CROSS JOIN (
        SELECT unnest(enum_range(NULL::"MetricTimeframe")) AS timeframe
      ) tf
      ON CONFLICT ("imageId", timeframe) DO UPDATE
        SET "commentCount" = EXCLUDED."commentCount", "heartCount" = EXCLUDED."heartCount", "likeCount" = EXCLUDED."likeCount", "dislikeCount" = EXCLUDED."dislikeCount", "laughCount" = EXCLUDED."laughCount", "cryCount" = EXCLUDED."cryCount", "collectedCount" = EXCLUDED."collectedCount", "tippedCount" = EXCLUDED."tippedCount", "tippedAmountCount" = EXCLUDED."tippedAmountCount";
  `;

    const affectedImages: Array<{ id: number }> = await db.$queryRaw`
      ${recentEngagementSubquery}
      SELECT DISTINCT
            i.id  
      FROM recent_engagements r
      JOIN "Image" i ON i.id = r.id
      WHERE r.id IS NOT NULL
    `;

    await imagesSearchIndex.queueUpdate(
      affectedImages.map(({ id }) => ({ id, action: SearchIndexUpdateQueueAction.Update }))
    );
  },
  async clearDay({ db }) {
    await db.$executeRaw`
      UPDATE "ImageMetric" SET "heartCount" = 0, "likeCount" = 0, "dislikeCount" = 0, "laughCount" = 0, "cryCount" = 0, "commentCount" = 0, "collectedCount" = 0, "tippedCount" = 0, "tippedAmountCount" = 0 WHERE timeframe = 'Day';
    `;
  },
  rank: {
    table: 'ImageRank',
    primaryKey: 'imageId',
    indexes: [
      'reactionCountAllTimeRank',
      'reactionCountDayRank',
      'reactionCountWeekRank',
      'reactionCountMonthRank',
      'reactionCountYearRank',
      'commentCountAllTimeRank',
      'commentCountDayRank',
      'commentCountWeekRank',
      'commentCountMonthRank',
      'commentCountYearRank',
      'collectedCountAllTimeRank',
      'collectedCountDayRank',
      'collectedCountWeekRank',
      'collectedCountMonthRank',
      'collectedCountYearRank',
      'tippedCountAllTimeRank',
      'tippedCountDayRank',
      'tippedCountWeekRank',
      'tippedCountMonthRank',
      'tippedCountYearRank',
      'tippedAmountCountAllTimeRank',
      'tippedAmountCountDayRank',
      'tippedAmountCountWeekRank',
      'tippedAmountCountMonthRank',
      'tippedAmountCountYearRank',
    ],
  },
});
