import { Request, Response } from "express";
import { UserService } from "../services/user.service";
import { userRepository } from "../repositories/user.repository";
import { getUserId } from "../utils/auth";

const userService = new UserService(userRepository);

export const getUser = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const user = await userService.getUserById(id);
    res.json(user);
  } catch {
    res.status(404).json({ message: "User not found" });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const actorUserId = getUserId(req);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (actorUserId !== id) {
      return res.status(403).json({ message: "No autorizado para modificar este usuario" });
    }

    const updated = await userService.updateUser(id, req.body);
    res.json(updated);
  } catch {
    res.status(404).json({ message: "User not found" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const actorUserId = getUserId(req);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (actorUserId !== id) {
      return res.status(403).json({ message: "No autorizado para eliminar este usuario" });
    }

    await userService.deleteUser(id);
    res.status(204).send();
  } catch {
    res.status(404).json({ message: "User not found" });
  }
};
