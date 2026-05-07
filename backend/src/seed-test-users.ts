import bcrypt from 'bcrypt';
import { userRepository } from './repositories/user.repository';

const DEFAULT_PASSWORD = 'Abcd1234!';

const TEST_USERS = [
  { username: 'neonwolf', email: 'neonwolf@ufm.edu', display_name: 'Neon Wolf' },
  { username: 'solarsage', email: 'solarsage@ufm.edu', display_name: 'Solar Sage' },
  { username: 'velvetbyte', email: 'velvetbyte@ufm.edu', display_name: 'Velvet Byte' },
  { username: 'echoluna', email: 'echoluna@ufm.edu', display_name: 'Echo Luna' },
  { username: 'driftnova', email: 'driftnova@ufm.edu', display_name: 'Drift Nova' },
];

async function seedTestUsers(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const testUser of TEST_USERS) {
    const existingByEmail = await userRepository.findByEmail(testUser.email);
    const existingByUsername = await userRepository.findByUsername(testUser.username);

    if (existingByEmail || existingByUsername) {
      continue;
    }

    const userId = await userRepository.create({
      username: testUser.username,
      email: testUser.email,
      passwordHash,
      lastLogin: null,
    });

    await userRepository.update(userId, {
      display_name: testUser.display_name,
      bio: `Cuenta de prueba para validar follows y mensajes directos (${testUser.username}).`,
    });
  }
}

seedTestUsers()
  .then(() => {
    console.log('Test users ready. Password for all: Abcd1234!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to seed test users', error);
    process.exit(1);
  });
