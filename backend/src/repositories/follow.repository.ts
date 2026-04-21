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