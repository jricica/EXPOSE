import { PostId } from '../models/post.model';
import { UserId } from '../models/user.model';
import {
  feedTimelineRepository,
  FeedTimelineItem,
  FeedTimelineUpsertItem,
} from '../repositories/feed-timeline.repository';
import { postRepository } from '../repositories/post.repository';
import { relationshipRepository } from '../repositories/relationship.repository';

export interface ReconcileFeedInput {
  feedUserId: UserId;
  now?: Date;
}

export interface ReconcileFeedResult {
  feedUserId: UserId;
  scannedTimelineEntries: number;
  expectedPosts: number;
  missingEventsFixed: number;
  duplicateEventsRemoved: number;
  staleEventsRemoved: number;
  canonicalEventsRepaired: number;
}

interface ExpectedPostEvent {
  postId: PostId;
  actorUserId: UserId;
  createdAt: Date;
  expectedSk: string;
}

export class FeedReconciliationService {
  async reconcileUserFeed(input: ReconcileFeedInput): Promise<ReconcileFeedResult> {
    if (!Number.isInteger(input.feedUserId) || input.feedUserId <= 0) {
      throw new Error('feedUserId must be a positive integer');
    }

    const now = input.now ?? new Date();
    const following = await relationshipRepository.listFollowing(input.feedUserId);
    const actorUserIds = Array.from(
      new Set([
        input.feedUserId,
        ...following
          .filter((relationship) => relationship.relationshipType === 'follow')
          .map((relationship) => relationship.targetUserId),
      ]),
    );

    const expectedReferences = await postRepository.listVisiblePostReferencesByAuthors(actorUserIds, now);
    const expectedByPostId = this.buildExpectedByPostId(expectedReferences);

    const timelineEntries = await feedTimelineRepository.listEntries(input.feedUserId);
    const timelineByPostId = this.groupTimelineByPostId(timelineEntries);

    const staleSortKeys = new Set<string>();
    const upserts = new Map<PostId, FeedTimelineUpsertItem>();

    let missingEventsFixed = 0;
    let duplicateEventsRemoved = 0;
    let staleEventsRemoved = 0;
    let canonicalEventsRepaired = 0;

    for (const [postId, expected] of expectedByPostId.entries()) {
      const existingEntries = timelineByPostId.get(postId) ?? [];
      const canonicalEntryExists = existingEntries.some((entry) => entry.sk === expected.expectedSk);

      if (!canonicalEntryExists) {
        upserts.set(postId, {
          feedUserId: input.feedUserId,
          postId: expected.postId,
          actorUserId: expected.actorUserId,
          createdAt: expected.createdAt,
        });

        if (existingEntries.length === 0) {
          missingEventsFixed += 1;
        } else {
          canonicalEventsRepaired += 1;
        }
      }

      for (const entry of existingEntries) {
        if (entry.sk !== expected.expectedSk) {
          staleSortKeys.add(entry.sk);
          duplicateEventsRemoved += 1;
        }
      }
    }

    for (const [postId, entries] of timelineByPostId.entries()) {
      if (expectedByPostId.has(postId)) {
        continue;
      }

      for (const entry of entries) {
        staleSortKeys.add(entry.sk);
        staleEventsRemoved += 1;
      }
    }

    await feedTimelineRepository.reconcileEntries({
      feedUserId: input.feedUserId,
      staleSortKeys: Array.from(staleSortKeys),
      upserts: Array.from(upserts.values()),
    });

    return {
      feedUserId: input.feedUserId,
      scannedTimelineEntries: timelineEntries.length,
      expectedPosts: expectedByPostId.size,
      missingEventsFixed,
      duplicateEventsRemoved,
      staleEventsRemoved,
      canonicalEventsRepaired,
    };
  }

  private buildExpectedByPostId(
    references: Array<{ postId: PostId; userId: UserId; createdAt: Date }>,
  ): Map<PostId, ExpectedPostEvent> {
    const expectedByPostId = new Map<PostId, ExpectedPostEvent>();

    for (const reference of references) {
      const expectedSk = feedTimelineRepository.buildSortKey(reference.createdAt, reference.postId);
      const current = expectedByPostId.get(reference.postId);

      if (!current || reference.createdAt > current.createdAt) {
        expectedByPostId.set(reference.postId, {
          postId: reference.postId,
          actorUserId: reference.userId,
          createdAt: reference.createdAt,
          expectedSk,
        });
      }
    }

    return expectedByPostId;
  }

  private groupTimelineByPostId(entries: FeedTimelineItem[]): Map<PostId, FeedTimelineItem[]> {
    const grouped = new Map<PostId, FeedTimelineItem[]>();

    for (const entry of entries) {
      const postId = Number(entry.postId);
      const current = grouped.get(postId);
      if (current) {
        current.push(entry);
      } else {
        grouped.set(postId, [entry]);
      }
    }

    return grouped;
  }
}

export const feedReconciliationService = new FeedReconciliationService();
