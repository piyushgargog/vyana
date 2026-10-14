// supabase/seed/seed-users.ts
// Creates demo auth users via Supabase Admin API
// Owner: Vaibhav Parmar
//
// One password per role (issue #153). The script refuses to run unless every
// role password is set and at least 16 characters long. It only ever creates
// or updates @vyana.test accounts, and it refuses to touch a non-local
// Supabase project unless ALLOW_LIVE_SEED=yes is set on purpose.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// --- Per-role passwords (each must be set and at least 16 characters) ------
type PasswordRole = 'patient' | 'doctor' | 'caregiver' | 'admin';

function requiredPassword(envName: string, value: string | undefined): string {
  if (!value || value.length < 16) {
    console.error(`Error: ${envName} must be set and at least 16 characters long.`);
    process.exit(1);
  }
  return value;
}

const PASSWORDS: Record<PasswordRole, string> = {
  patient: requiredPassword('SEED_PASSWORD_PATIENT', process.env.SEED_PASSWORD_PATIENT),
  doctor: requiredPassword('SEED_PASSWORD_DOCTOR', process.env.SEED_PASSWORD_DOCTOR),
  caregiver: requiredPassword('SEED_PASSWORD_CAREGIVER', process.env.SEED_PASSWORD_CAREGIVER),
  admin: requiredPassword('SEED_PASSWORD_ADMIN', process.env.SEED_PASSWORD_ADMIN),
};

if (!serviceRoleKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required.');
  process.exit(1);
}

// --- Live guard: the demo accounts live on the live database on purpose, ---
// --- so the seed may run there, but only on purpose. -----------------------
function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

/** The Supabase project ref (subdomain), never a key. */
function projectRef(url: string): string {
  try {
    return new URL(url).hostname.split('.')[0] || '(unknown)';
  } catch {
    return '(unparseable url)';
  }
}

if (!isLocalUrl(supabaseUrl) && process.env.ALLOW_LIVE_SEED !== 'yes') {
  console.error(
    `Refusing: ${supabaseUrl} is not a local Supabase URL. ` +
      `This would seed the live project "${projectRef(supabaseUrl)}". ` +
      `Set ALLOW_LIVE_SEED=yes to do it on purpose.`,
  );
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
  /** Which per-role password this account gets. Defaults to `role`. */
  passwordRole?: PasswordRole;
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
    passwordRole: 'caregiver',
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

// The script only ever touches @vyana.test accounts. Anything else fails fast.
for (const user of DEMO_USERS) {
  if (!user.email.endsWith('@vyana.test')) {
    console.error(`Refusing: ${user.email} is not a @vyana.test account. The seed only manages demo accounts.`);
    process.exit(1);
  }
}

async function seed() {
  let failed = 0;
  const target = isLocalUrl(supabaseUrl) ? supabaseUrl : `live project "${projectRef(supabaseUrl)}"`;
  console.log(`🌱 Seeding demo auth users to ${target}...`);

  for (const user of DEMO_USERS) {
    const password = PASSWORDS[user.passwordRole ?? user.role];
    try {
      const { data: existing, error: getError } = await supabaseAdmin.auth.admin.getUserById(user.id);

      if (existing?.user) {
        console.log(`ℹ️ User ${user.email} (${user.id}) already exists. Updating password & metadata...`);
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          email: user.email,
          password,
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
          password,
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
