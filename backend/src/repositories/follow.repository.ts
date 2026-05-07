import pool from '../db/pool';

export const followUser = async (followerId: number, followingId: number) => {
  const query = `
    INSERT INTO followers (follower_id, following_id)
    VALUES (?, ?)
  `;
  const values = [followerId, followingId];

  const [result]: any = await pool.query(query, values);

  return {
    id: result.insertId,
    follower_id: followerId,
    following_id: followingId,
  };
};

export const unfollowUser = async (followerId: number, followingId: number) => {
  const query = `
    DELETE FROM followers
    WHERE follower_id = ? AND following_id = ?
  `;
  const values = [followerId, followingId];

  await pool.query(query, values);
};

export const isFollowing = async (followerId: number, followingId: number): Promise<boolean> => {
  const query = `
    SELECT 1
    FROM followers
    WHERE follower_id = ? AND following_id = ?
    LIMIT 1
  `;
  const values = [followerId, followingId];
  const [rows]: any = await pool.query(query, values);
  return Array.isArray(rows) && rows.length > 0;
};

export const areMutualFollowers = async (userA: number, userB: number): Promise<boolean> => {
  const query = `
    SELECT COUNT(*) AS total
    FROM followers
    WHERE (follower_id = ? AND following_id = ?)
       OR (follower_id = ? AND following_id = ?)
  `;
  const values = [userA, userB, userB, userA];
  const [rows]: any = await pool.query(query, values);
  return Number(rows?.[0]?.total ?? 0) >= 2;
};