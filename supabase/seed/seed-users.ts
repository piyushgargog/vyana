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
  // Two fictional doctors for each hospital in seed.sql (verified there).
  { id: '00000000-0000-0000-0000-000000000101', email: 'doc01@vyana.test', role: 'doctor', fullName: 'Dr. Kavita Nair' },
  { id: '00000000-0000-0000-0000-000000000102', email: 'doc02@vyana.test', role: 'doctor', fullName: 'Dr. Sandeep Bhatia' },
  { id: '00000000-0000-0000-0000-000000000103', email: 'doc03@vyana.test', role: 'doctor', fullName: 'Dr. Meenal Joshi' },
  { id: '00000000-0000-0000-0000-000000000104', email: 'doc04@vyana.test', role: 'doctor', fullName: 'Dr. Harpreet Gill' },
  { id: '00000000-0000-0000-0000-000000000105', email: 'doc05@vyana.test', role: 'doctor', fullName: 'Dr. Farhan Siddiqui' },
  { id: '00000000-0000-0000-0000-000000000106', email: 'doc06@vyana.test', role: 'doctor', fullName: 'Dr. Lata Menon' },
  { id: '00000000-0000-0000-0000-000000000107', email: 'doc07@vyana.test', role: 'doctor', fullName: 'Dr. Arjun Pillai' },
  { id: '00000000-0000-0000-0000-000000000108', email: 'doc08@vyana.test', role: 'doctor', fullName: 'Dr. Ritu Saxena' },
  { id: '00000000-0000-0000-0000-000000000109', email: 'doc09@vyana.test', role: 'doctor', fullName: 'Dr. Manoj Tiwari' },
  { id: '00000000-0000-0000-0000-000000000110', email: 'doc10@vyana.test', role: 'doctor', fullName: 'Dr. Shweta Kulkarni' },
  { id: '00000000-0000-0000-0000-000000000111', email: 'doc11@vyana.test', role: 'doctor', fullName: 'Dr. Vikram Malhotra' },
  { id: '00000000-0000-0000-0000-000000000112', email: 'doc12@vyana.test', role: 'doctor', fullName: 'Dr. Anjali Deshmukh' },
  { id: '00000000-0000-0000-0000-000000000113', email: 'doc13@vyana.test', role: 'doctor', fullName: 'Dr. Rohit Verma' },
  { id: '00000000-0000-0000-0000-000000000114', email: 'doc14@vyana.test', role: 'doctor', fullName: 'Dr. Nandini Iyer' },
  { id: '00000000-0000-0000-0000-000000000115', email: 'doc15@vyana.test', role: 'doctor', fullName: 'Dr. Imran Qureshi' },
  { id: '00000000-0000-0000-0000-000000000116', email: 'doc16@vyana.test', role: 'doctor', fullName: 'Dr. Pooja Chawla' },
  { id: '00000000-0000-0000-0000-000000000117', email: 'doc17@vyana.test', role: 'doctor', fullName: 'Dr. Tarun Bansal' },
  { id: '00000000-0000-0000-0000-000000000118', email: 'doc18@vyana.test', role: 'doctor', fullName: 'Dr. Divya Krishnan' },
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
