import dotenv from 'dotenv';

dotenv.config();

import { feedReconciliationService } from './services/feed-reconciliation.service';

const parseUserId = (): number => {
  const input = process.argv[2] ?? process.env.FEED_RECONCILE_USER_ID;
  const parsed = Number(input);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('Provide a valid feed user id as argv[2] or FEED_RECONCILE_USER_ID');
  }

  return parsed;
};

const run = async () => {
  const feedUserId = parseUserId();
  const result = await feedReconciliationService.reconcileUserFeed({ feedUserId });
  console.log(JSON.stringify(result, null, 2));
};

run().catch((error) => {
  console.error('[feed-reconcile] failed', error);
  process.exitCode = 1;
});
