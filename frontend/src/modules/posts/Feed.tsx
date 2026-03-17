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



    setContent("");
  };

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={MAX_CHARACTERS}
        placeholder="¿Qué estás pensando?"
      />

      <div
        style={{
          textAlign: "right",
          fontSize: "0.85rem",
          color:
            remaining < 0
              ? "red"
              : remaining < 20
              ? "orange"
              : "gray",
        }}
      >
        {remaining} caracteres restantes
      </div>

      <button type="submit" disabled={isEmpty || isTooLong}>
        Publicar
      </button>
    </form>
  );
};