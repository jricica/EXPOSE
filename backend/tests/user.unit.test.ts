import { UserRepository } from '../src/repositories/user.repository';
import { UserService } from '../src/services/user.service';
import type { User } from '../src/models/user.model';

describe('UserService', () => {
    it('should return a new User', async () => {
        const userRepository = new UserRepository();
        const userService = new UserService(userRepository);

        let user: any = {
            email: "testname@gmail.com",
            password: "encrypted",
            name: "testname",
            id: 100,
            role: 1,
            friends: []
        };
        const result = await userService.registerUserAsync(user);

        expect(result).toMatchObject({
            email: user.email,
            username: user.name,
            password: user.password,
            id: user.id,
            role: user.role,
            friends: user.friends
        });

        expect(result.password).toEqual("encrypted");

        expect(result.id).toBeGreaterThan(0);

        expect(result.friends.length).toBe(0);
    });
});
