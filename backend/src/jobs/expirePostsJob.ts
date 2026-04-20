import cron, { ScheduledTask } from 'node-cron';
import * as Sentry from "@sentry/node";
import { postRepository } from '../repositories/post.repository';
import { EXPIRE_JOB_INTERVAL_MINUTES, EXPIRE_JOB_PHYSICAL_DELETE } from '../config/env';

let task: ScheduledTask | null = null;

export function startExpirePostsJob() {
  if (task) return;

  const minutes = Number(EXPIRE_JOB_INTERVAL_MINUTES) || 5;
  const schedule = `*/${minutes} * * * *`;

  task = cron.schedule(schedule, async () => {
    try {
      const affected = await postRepository.markExpiredPosts(EXPIRE_JOB_PHYSICAL_DELETE);
      if (affected > 0) {
        Sentry.captureMessage(`ExpireJob: processed ${affected} posts (physicalDelete=${EXPIRE_JOB_PHYSICAL_DELETE})`, 'info');
      }
    } catch (err) {
      Sentry.captureException(err);
    }
  });

  task.start();
  Sentry.captureMessage(`Expire job started: interval ${minutes} minute(s)`, 'info');
}

export function stopExpirePostsJob() {
  if (!task) return;
  task.stop();
  task = null;
}
