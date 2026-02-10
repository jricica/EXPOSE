import { authService, RegisterInput } from '../src/services/auth.service';
import { UserRepository } from '../src/repositories/user.repository';

jest.mock('../src/repositories/user.repository');

describe('AuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should register a new User', async () => {
        const newUserInput: RegisterInput = {
            email: "joseguzman@gmail.com",
            password: "encrypted_password",
            username: "JoseGuzman",
        };

        const mockUser = {
            id: 100,
            email: newUserInput.email,
            username: newUserInput.username,
            passwordHash: "hashed_password",
            createdAt: new Date()
        };

        (UserRepository.findByEmail as jest.Mock).mockResolvedValue(null);
        (UserRepository.create as jest.Mock).mockResolvedValue(mockUser.id);
        (UserRepository.findById as jest.Mock).mockResolvedValue(mockUser);

        const result = await authService.register(newUserInput);

        expect(UserRepository.findByEmail).toHaveBeenCalledWith(newUserInput.email);
        expect(UserRepository.create).toHaveBeenCalled();
        expect(result).toHaveProperty('id', mockUser.id);
        expect(result).toHaveProperty('email', newUserInput.email);
        expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw error if email already exists', async () => {
        const existingInput: RegisterInput = {
            email: "existing@example.com",
            password: "password",
            username: "ExistingUser"
        };

        (UserRepository.findByEmail as jest.Mock).mockResolvedValue({ id: 1, email: existingInput.email });

        await expect(authService.register(existingInput)).rejects.toThrow("El email ya está registrado");
    });
});