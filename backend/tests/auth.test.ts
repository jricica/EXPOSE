import { authService } from '../modules/auth/auth.service';

describe('Auth Service', () => {
  describe('login', () => {
    it('should throw error if email is missing', async () => {
      await expect(
        authService.login('', 'password')
      ).rejects.toThrow();
    });

    it('should throw error if password is missing', async () => {
      await expect(
        authService.login('test@mail.com', '')
      ).rejects.toThrow();
    });

    it('should throw error for invalid email format', async () => {
      await expect(
        authService.login('invalid-email', 'password')
      ).rejects.toThrow();
    });
  });

  describe('register', () => {
    it('should throw error if username is missing', async () => {
      await expect(
        authService.register('', 'test@mail.com', 'password')
      ).rejects.toThrow();
    });

    it('should throw error if email is missing', async () => {
      await expect(
        authService.register('user', '', 'password')
      ).rejects.toThrow();
    });

    it('should throw error if password is missing', async () => {
      await expect(
        authService.register('user', 'test@mail.com', '')
      ).rejects.toThrow();
    });
  });
});