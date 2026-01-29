import { Request, Response } from "express";
import { postService } from "../services/post.service"; 

export const createPost = async (req: Request, res: Response) => { // Crea un nuevo post
  try {
    const { content, ttl } = req.body;  

    if (!content) { // Validación simple
      return res.status(400).json({ message: "El contenido es obligatorio para realizar un post." }); 
    }

    const userId = "mock-user-id"; 

    const post = postService.createPost({
      userId,
      content,
      ttl,
    });

    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: "Error al crear un nuevo post." });
  }
};
