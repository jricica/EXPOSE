import { Request, Response } from 'express';
import { AuthService } from './auth.service';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  async login(req: Request, res: Response): Promise<Response> {
    const { email, password } = req.body;

    const result = await this.authService.login(email, password);

    return res.status(200).json(result);
  }

  async register(req: Request, res: Response): Promise<Response> {
    const result = await this.authService.register(req.body);

    return res.status(201).json(result);
  }
}
