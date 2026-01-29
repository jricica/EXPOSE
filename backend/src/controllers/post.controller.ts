import { Request, Response } from "express";
import { postService } from "../services/post.service"; 
import * as Sentry from "@sentry/node";

export const createPost = async (req: Request, res: Response) => { // Crea un nuevo post
  try {
    const { content, ttl } = req.body;  

    if (!content) { // Validación simple
      return res.status(400).json({ message: "El contenido es obligatorio para realizar un post." }); 
    }

    const userId = "mock-user-id"; 

    const post = await postService.createPost({
      userId,
      content,
      ttl,
    });

    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: "Error al crear un nuevo post." });
  }
};

export const listPosts = async (req: Request, res: Response) => {
	try {
		const {
			userId,
			limit,
			cursor,
			includeExpired,
			order = "desc",
		} = req.query;

		const posts = await postService.listPosts({
			filters: {
				userId: userId as string | undefined,
			},
			includeExpired: includeExpired === "true",
			limit: limit ? Number(limit) : 20,
			cursor: cursor as string | undefined,
		});

		res.json({
			data: posts,
			meta: {
				limit: limit ? Number(limit) : 20,
				order,
			},
		});
	} catch (err) {
		Sentry.captureException(err);
		res.status(500).json({ message: "Error listando posts" });
	}
};
