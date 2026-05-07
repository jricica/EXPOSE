import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import prisma from './lib/prisma';

dotenv.config();

const SEED_PASSWORD = 'QaSeedPass123!';
const SALT_ROUNDS = 10;

const SEED_USERS = [
  {
    username: 'qa_alice',
    email: 'qa.alice@ufm.edu',
    display_name: 'QA Alice',
    bio: 'Seed user for QA integration flows',
    avatar_url: null as string | null,
  },
  {
    username: 'qa_bob',
    email: 'qa.bob@ufm.edu',
    display_name: 'QA Bob',
    bio: 'Seed user for auth and profile tests',
    avatar_url: null as string | null,
  },
  {
    username: 'qa_carla',
    email: 'qa.carla@ufm.edu',
    display_name: 'QA Carla',
    bio: 'Seed user for feed and interaction tests',
    avatar_url: null as string | null,
  },
] as const;

const SEED_POSTS = [
  {
    authorEmail: 'qa.alice@ufm.edu',
    content: '[seed:qa] post-1 welcome',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
  },
  {
    authorEmail: 'qa.bob@ufm.edu',
    content: '[seed:qa] post-2 release-check',
    createdAt: new Date('2026-01-02T10:00:00.000Z'),
  },
  {
    authorEmail: 'qa.carla@ufm.edu',
    content: '[seed:qa] post-3 regression-check',
    createdAt: new Date('2026-01-03T10:00:00.000Z'),
  },
] as const;

const SEED_LIKES = [
  { postContent: '[seed:qa] post-1 welcome', userEmail: 'qa.bob@ufm.edu' },
  { postContent: '[seed:qa] post-1 welcome', userEmail: 'qa.carla@ufm.edu' },
  { postContent: '[seed:qa] post-2 release-check', userEmail: 'qa.alice@ufm.edu' },
] as const;

const PRODUCTION_GUARD_ENVS = new Set([
  process.env.NODE_ENV,
  process.env.APP_ENV,
  process.env.ENVIRONMENT,
].map((value) => (value || '').toLowerCase()));

const isProductionLike = PRODUCTION_GUARD_ENVS.has('production');

async function seed() {
  if (isProductionLike) {
    throw new Error('Seed deshabilitado en producción. Ejecuta solo en entornos no productivos.');
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);

  const usersByEmail = new Map<string, { id: number; email: string }>();

  for (const user of SEED_USERS) {
    const upserted = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        username: user.username,
        passwordHash,
        bio: user.bio,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      },
      create: {
        username: user.username,
        email: user.email,
        passwordHash,
        bio: user.bio,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      },
      select: {
        id: true,
        email: true,
      },
    });

    usersByEmail.set(upserted.email, upserted);
  }

  const expiresAt = new Date('2099-12-31T23:59:59.000Z');
  const postsByContent = new Map<string, { id: number; content: string }>();

  for (const post of SEED_POSTS) {
    const author = usersByEmail.get(post.authorEmail);
    if (!author) {
      throw new Error(`Usuario seed no encontrado para post: ${post.authorEmail}`);
    }

    const existing = await prisma.post.findFirst({
      where: {
        userId: author.id,
        content: post.content,
      },
      select: { id: true },
    });

    const savedPost = existing
      ? await prisma.post.update({
          where: { id: existing.id },
          data: {
            media_url: null,
            createdAt: post.createdAt,
            expiresAt,
            is_deleted: false,
          },
          select: { id: true, content: true },
        })
      : await prisma.post.create({
          data: {
            userId: author.id,
            content: post.content,
            media_url: null,
            createdAt: post.createdAt,
            expiresAt,
            is_deleted: false,
          },
          select: { id: true, content: true },
        });

    postsByContent.set(savedPost.content, savedPost);
  }

  for (const like of SEED_LIKES) {
    const post = postsByContent.get(like.postContent);
    const user = usersByEmail.get(like.userEmail);

    if (!post || !user) {
      throw new Error(`Relación de like inválida en seed: ${JSON.stringify(like)}`);
    }

    await prisma.postLike.upsert({
      where: {
        unique_like: {
          postId: post.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        postId: post.id,
        userId: user.id,
      },
    });
  }

  for (const post of postsByContent.values()) {
    const likes = await prisma.postLike.count({
      where: { postId: post.id },
    });

    await prisma.post.update({
      where: { id: post.id },
      data: { likes },
    });
  }

  console.log('✅ Seed idempotente aplicado para entorno no productivo.');
  console.log(`Usuarios seed: ${SEED_USERS.map((user) => user.email).join(', ')}`);
  console.log(`Password seed de prueba: ${SEED_PASSWORD}`);
}

seed()
  .catch((error) => {
    console.error('❌ Error durante el seeding:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
