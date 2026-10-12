// supabase/seed/seed-users.ts
// Creates demo auth users via Supabase Admin API
// Owner: Vaibhav Parmar

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const seedPassword = process.env.SEED_PASSWORD;

if (!seedPassword) {
  console.error('Error: SEED_PASSWORD environment variable is required.');
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface SeedUser {
  id: string;
  email: string;
  role: 'patient' | 'doctor' | 'admin';
  fullName: string;
}

const DEMO_USERS: SeedUser[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'patient@vyana.test',
    role: 'patient',
    fullName: 'Aryan Sharma',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'doctor@vyana.test',
    role: 'doctor',
    fullName: 'Dr. Rajesh Mehta',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'doctor2@vyana.test',
    role: 'doctor',
    fullName: 'Dr. Sneha Gupta',
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'admin@vyana.test',
    role: 'admin',
    fullName: 'Vyana Admin',
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    email: 'caregiver@vyana.test',
    role: 'patient',
    fullName: 'Neha Sharma',
  },
];

async function seed() {
  let failed = 0;
  console.log(`🌱 Seeding demo auth users to ${supabaseUrl}...`);

  for (const user of DEMO_USERS) {
    try {
      const { data: existing, error: getError } = await supabaseAdmin.auth.admin.getUserById(user.id);

      if (existing?.user) {
        console.log(`ℹ️ User ${user.email} (${user.id}) already exists. Updating password & metadata...`);
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          email: user.email,
          password: seedPassword,
          email_confirm: true,
          user_metadata: {
            full_name: user.fullName,
            role: user.role,
          },
        });
        if (updateError) {
          failed++;
          console.error(`❌ Failed to update ${user.email}:`, updateError.message);
        } else {
          console.log(`✅ Updated ${user.email}`);
        }
      } else {
        const { error: createError } = await supabaseAdmin.auth.admin.createUser({
          id: user.id,
          email: user.email,
          password: seedPassword,
          email_confirm: true,
          user_metadata: {
            full_name: user.fullName,
            role: user.role,
          },
        });

        if (createError) {
          failed++;
          console.error(`❌ Failed to create ${user.email}:`, createError.message);
        } else {
          console.log(`✅ Created ${user.email} (${user.role})`);
        }
      }
    } catch (err) {
      failed++;
      console.error(`❌ Unexpected error with ${user.email}:`, err);
    }
  }

  if (failed > 0) {
    console.error(`❌ ${failed} demo user(s) failed; do not run seed.sql until this is fixed.`);
    process.exit(1);
  }
  console.log('🎉 Seed users script completed!');
}

seed().catch((err) => {
  console.error('Fatal error during seed execution:', err);
  process.exit(1);
});
