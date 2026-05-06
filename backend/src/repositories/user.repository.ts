import { Prisma } from '@prisma/client';
import { CreateUserInput, User, UserId } from '../models/user.model';
import prisma from '../lib/prisma';

export interface PublicUserProfile {
  id: UserId;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const normalizeUsername = (username: string): string => username.trim();

const USER_SELECT = {
  id: true,
  username: true,
  email: true,
  passwordHash: true,
  bio: true,
  display_name: true,
  avatar_url: true,
  createdAt: true,
  lastLogin: true,
} satisfies Prisma.UserSelect;

type UserRecord = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

const mapUser = (user: UserRecord): User => ({
  id: user.id,
  username: user.username,
  email: user.email,
  passwordHash: user.passwordHash,
  bio: user.bio ?? undefined,
  display_name: user.display_name ?? undefined,
  avatar_url: user.avatar_url ?? undefined,
  role: (user as UserRecord & { role?: number }).role ?? 1,
  createdAt: user.createdAt,
  lastLogin: user.lastLogin,
  friends: [],
});

const mapPublicUser = (user: {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}): PublicUserProfile => ({
  id: user.id,
  username: user.username,
  display_name: user.display_name ?? undefined,
  avatar_url: user.avatar_url ?? undefined,
});

const toRepositoryError = (error: unknown, operation: string): Error => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const rawTarget = (error.meta as { target?: string | string[] } | undefined)?.target;
      const targets = Array.isArray(rawTarget)
        ? rawTarget
        : typeof rawTarget === 'string'
          ? [rawTarget]
          : [];
      const targetText = targets.join(',').toLowerCase();

      if (targetText.includes('email')) {
        return new Error('El email ya está registrado');
      }
      if (targetText.includes('username')) {
        return new Error('El username ya está registrado');
      }

      return new Error('Registro de usuario duplicado');
    }

    if (error.code === 'P2025') {
      return new Error('User not found');
    }
  }

  return new Error(`Database error in users.${operation}`);
};

const runWithRepositoryErrorHandling = async <T>(
  operation: string,
  action: () => Promise<T>,
): Promise<T> => {
  try {
    return await action();
  } catch (error) {
    throw toRepositoryError(error, operation);
  }
};

export class UserRepository {
  static async findById(id: UserId): Promise<User | null> {
    return runWithRepositoryErrorHandling('findById', async () => {
      const user = await prisma.user.findUnique({
        where: { id },
        select: USER_SELECT,
      });
      return user ? mapUser(user) : null;
    });
  }

  static async findByEmail(email: string): Promise<User | null> {
    return runWithRepositoryErrorHandling('findByEmail', async () => {
      const user = await prisma.user.findUnique({
        where: { email: normalizeEmail(email) },
        select: USER_SELECT,
      });
      return user ? mapUser(user) : null;
    });
  }

  static async findByUsername(username: string): Promise<User | null> {
    return runWithRepositoryErrorHandling('findByUsername', async () => {
      const user = await prisma.user.findUnique({
        where: { username: normalizeUsername(username) },
        select: USER_SELECT,
      });
      return user ? mapUser(user) : null;
    });
  }

  static async findPublicByIds(ids: UserId[]): Promise<PublicUserProfile[]> {
    const uniqueIds = Array.from(new Set(ids)).filter((id) => Number.isInteger(id) && id > 0);
    if (uniqueIds.length === 0) {
      return [];
    }

    return runWithRepositoryErrorHandling('findPublicByIds', async () => {
      const users = await prisma.user.findMany({
        where: {
          id: {
            in: uniqueIds,
          },
        },
        select: {
          id: true,
          username: true,
          display_name: true,
          avatar_url: true,
        },
      });

      return users.map(mapPublicUser);
    });
  }

  static async create(data: CreateUserInput): Promise<UserId> {
    return runWithRepositoryErrorHandling('create', async () => {
      const created = await prisma.user.create({
        data: {
          username: data.username,
          email: normalizeEmail(data.email),
          passwordHash: data.passwordHash,
          lastLogin: data.lastLogin ?? null,
        },
        select: { id: true },
      });
      return created.id;
    });
  }

  static async update(id: UserId, data: Partial<User>): Promise<void> {
    const payload: Prisma.UserUpdateInput = {};

    if (data.username) payload.username = normalizeUsername(data.username);
    if (data.email) payload.email = normalizeEmail(data.email);
    if (data.bio !== undefined) payload.bio = data.bio;
    if (data.display_name !== undefined) payload.display_name = data.display_name;
    if (data.avatar_url !== undefined) payload.avatar_url = data.avatar_url;

    if (Object.keys(payload).length === 0) {
      return;
    }

    await runWithRepositoryErrorHandling('update', async () => {
      await prisma.user.update({
        where: { id },
        data: payload,
      });
    });
  }

  static async updateLastLogin(id: UserId, date: Date): Promise<void> {
    await runWithRepositoryErrorHandling('updateLastLogin', async () => {
      await prisma.user.update({
        where: { id },
        data: { lastLogin: date },
      });
    });
  }

  static async delete(id: UserId): Promise<void> {
    await runWithRepositoryErrorHandling('delete', async () => {
      await prisma.user.delete({
        where: { id },
      });
    });
  }

  async findById(id: UserId): Promise<User | null> {
    return UserRepository.findById(id);
  }

  async findByEmail(email: string): Promise<User | null> {
    return UserRepository.findByEmail(email);
  }

  async findByUsername(username: string): Promise<User | null> {
    return UserRepository.findByUsername(username);
  }

  async findPublicByIds(ids: UserId[]): Promise<PublicUserProfile[]> {
    return UserRepository.findPublicByIds(ids);
  }

  async create(data: CreateUserInput): Promise<UserId> {
    return UserRepository.create(data);
  }

  async update(id: UserId, data: Partial<User>): Promise<void> {
    return UserRepository.update(id, data);
  }

  async updateLastLogin(id: UserId, date: Date): Promise<void> {
    return UserRepository.updateLastLogin(id, date);
  }

  async delete(id: UserId): Promise<void> {
    return UserRepository.delete(id);
  }
}

export const userRepository = new UserRepository();
