import { useState } from "react";

const MAX_CHARACTERS = 280;

export const CreatePost = () => {
  const [content, setContent] = useState("");

  const remaining = MAX_CHARACTERS - content.length;
  const isTooLong = remaining < 0;
  const isEmpty = !content.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEmpty || isTooLong) return;

    // aquí luego irá tu API

    setContent("");
  };

  return (
    <form className="create-post" onSubmit={handleSubmit}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={MAX_CHARACTERS}
        placeholder="¿Qué estás pensando?"
        className="create-post-textarea"
      />

      <div className="create-post-footer">
        <span
          className={`char-count ${
            remaining < 0
              ? "danger"
              : remaining < 20
              ? "warning"
              : ""
          }`}
        >
          {remaining}
        </span>

        <button
          type="submit"
          className="create-post-button"
          disabled={isEmpty || isTooLong}
        >
          Publicar
        </button>
      </div>
    </form>
  );
};