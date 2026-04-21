import React from "react";
import "./PostCard.css";

type Props = {
  post: {
    id: number;
    username: string;
    content: string;
    image_url?: string;
    created_at: string;
  };
};

const PostCard: React.FC<Props> = ({ post }) => {
  return (
    <div className="post-card">

      {/* HEADER */}
      <div className="post-header">
        <span className="post-user">@{post.username}</span>
        <span className="post-time">
          {new Date(post.created_at).toLocaleTimeString()}
        </span>
      </div>

      {/* CONTENT */}
      <div className="post-content">
        <p>{post.content}</p>
      </div>

      {/* IMAGE */}
      {post.image_url && (
        <img src={post.image_url} alt="post" className="post-image" />
      )}

      {/* ACTIONS */}
      <div className="post-actions">
        <button>❤️</button>
        <button>💬</button>
        <button>↗</button>
      </div>

    </div>
  );
};

export default PostCard;