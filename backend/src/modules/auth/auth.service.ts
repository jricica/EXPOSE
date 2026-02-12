import { AuthRepository } from './auth.repository';

export class AuthService {
  private authRepository: AuthRepository;

  constructor() {
    this.authRepository = new AuthRepository();
  }

  async login(email: string, password: string) {
    return { message: 'Login service ready' };
  }

  async register(userData: any) {
    return { message: 'Register service ready' };
  }
}
