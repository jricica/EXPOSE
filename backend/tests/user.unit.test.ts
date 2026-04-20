import { UserRepository } from '../src/repositories/user.repository';
import { UserService } from '../src/services/user.service';

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    const userRepository = new UserRepository();
    userService = new UserService(userRepository);
  });

  describe('registerUserAsync', () => {
    it('should return a new User', async () => {
      const user: any = {
        email: 'testname@gmail.com',
        password: 'encrypted',
        name: 'testname',
        id: 100,
        role: 1,
        friends: [],
      };

      const result = await userService.registerUserAsync(user);

      expect(result).toMatchObject({
        email: user.email,
        username: user.name,
        password: user.password,
        id: user.id,
        role: user.role,
        friends: user.friends,
      });

      expect(result.password).toEqual('encrypted');
      expect(result.id).toBeGreaterThan(0);
      expect(result.friends.length).toBe(0);
    });

    it('should throw error if email is missing', async () => {
      const user: any = {
        email: '',
        password: 'encrypted',
        name: 'testname',
      };

      await expect(userService.registerUserAsync(user)).rejects.toThrow();
    });

    it('should throw error if name is missing', async () => {
      const user: any = {
        email: 'test@mail.com',
        password: 'encrypted',
        name: '',
      };

      await expect(userService.registerUserAsync(user)).rejects.toThrow();
    });

    it('should initialize empty friends array if not provided', async () => {
      const user: any = {
        email: 'test@mail.com',
        password: 'encrypted',
        name: 'test',
      };

      const result = await userService.registerUserAsync(user);

      expect(Array.isArray(result.friends)).toBe(true);
    });
  });
});