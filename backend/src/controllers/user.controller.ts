import { Request, Response } from "express";
import { UserService } from "../services/user.service";
import { userRepository } from "../repositories/user.repository";

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
    const updated = await userService.updateUser(id, req.body);
    res.json(updated);
  } catch {
    res.status(404).json({ message: "User not found" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await userService.deleteUser(id);
    res.status(204).send();
  } catch {
    res.status(404).json({ message: "User not found" });
  }
};
