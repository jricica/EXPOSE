import cron from 'node-cron';
import { postRepository } from '../repositories/post.repository';
import { EXPIRE_JOB_INTERVAL_MINUTES, EXPIRE_JOB_PHYSICAL_DELETE } from '../config/env';

let task: cron.ScheduledTask | null = null;

export function startExpirePostsJob() {
  if (task) return;

  const minutes = Number(EXPIRE_JOB_INTERVAL_MINUTES) || 5;
  const schedule = `*/${minutes} * * * *`;

  task = cron.schedule(schedule, async () => {
    try {
      const affected = await postRepository.markExpiredPosts(EXPIRE_JOB_PHYSICAL_DELETE);
      if (affected > 0) {
        console.log(`ExpireJob: processed ${affected} posts (physicalDelete=${EXPIRE_JOB_PHYSICAL_DELETE})`);
      }
    } catch (err) {
      console.error('ExpireJob error', err);
    }
  });

  task.start();
  console.log(`Expire job started: interval ${minutes} minute(s)`);
}

export function stopExpirePostsJob() {
  if (!task) return;
  task.stop();
  task = null;
}
