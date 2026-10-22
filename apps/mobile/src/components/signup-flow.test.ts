import type { AuthResponse } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import {
  RESEND_CONFIRMATION_COOLDOWN_SECONDS,
  resendConfirmationLabel,
  RESEND_ERROR_MESSAGE,
  resendSignupConfirmation,
  signupConfirmationUrl,
  SIGNUP_ERROR_MESSAGE,
  submitSignup,
  type SignupAuthClient,
} from './signup-flow';

const CONFIRMATION_URL = 'https://vyanahealth.app/auth/confirmed';
const DETAILS = {
  email: '  person@example.com  ',
  password: 'password123',
  fullName: '  Test Person  ',
  phone: '  +91 98111 22334  ',
  role: 'patient' as const,
};

const response = (session: boolean): AuthResponse =>
  ({
    data: {
      user: { id: 'user-1', email: DETAILS.email.trim() },
      session: session ? { access_token: 'token' } : null,
    },
    error: null,
  }) as unknown as AuthResponse;

const errorResponse = (message: string, code?: string): AuthResponse =>
  ({
    data: { user: null, session: null },
    error: { message, ...(code ? { code } : {}) },
  }) as unknown as AuthResponse;

describe('mobile signup confirmation flow', () => {
  it('builds the shared confirmation landing URL from the app base URL', () => {
    expect(signupConfirmationUrl('https://vyanahealth.app/')).toBe(
      CONFIRMATION_URL,
    );
  });

  it('keeps the session case on the straight-to-consent path', async () => {
    const auth: SignupAuthClient = {
      signUp: vi.fn(async () => response(true)),
      resend: vi.fn(async () => response(false)),
    };

    await expect(submitSignup(auth, DETAILS, CONFIRMATION_URL)).resolves.toEqual({
      status: 'session',
    });
    expect(auth.signUp).toHaveBeenCalledExactlyOnceWith({
      email: 'person@example.com',
      password: DETAILS.password,
      options: {
        emailRedirectTo: CONFIRMATION_URL,
        data: {
          full_name: 'Test Person',
          phone: '+91 98111 22334',
          role: 'patient',
        },
      },
    });
  });

  it('returns the inbox state when signup has no session', async () => {
    const auth: SignupAuthClient = {
      signUp: vi.fn(async () => response(false)),
      resend: vi.fn(async () => response(false)),
    };

    await expect(submitSignup(auth, DETAILS, CONFIRMATION_URL)).resolves.toEqual({
      status: 'confirmation',
      email: 'person@example.com',
    });
  });

  it('surfaces a signup error instead of treating it as a pending confirmation', async () => {
    const auth: SignupAuthClient = {
      signUp: vi.fn(async () => errorResponse('Error sending confirmation email')),
      resend: vi.fn(async () => response(false)),
    };

    await expect(submitSignup(auth, DETAILS, CONFIRMATION_URL)).resolves.toEqual({
      status: 'error',
      message: SIGNUP_ERROR_MESSAGE,
    });
  });

  it('shows the same inbox state when the address is already registered', async () => {
    const auth: SignupAuthClient = {
      signUp: vi.fn(async () =>
        errorResponse('User already registered', 'user_already_exists'),
      ),
      resend: vi.fn(async () => response(false)),
    };

    await expect(submitSignup(auth, DETAILS, CONFIRMATION_URL)).resolves.toEqual({
      status: 'confirmation',
      email: 'person@example.com',
    });
  });

  it('keeps the password and email messages and hides other provider text', async () => {
    const run = (message: string, code?: string) =>
      submitSignup(
        {
          signUp: vi.fn(async () => errorResponse(message, code)),
          resend: vi.fn(async () => response(false)),
        },
        DETAILS,
        CONFIRMATION_URL,
      );

    await expect(run('Password should be at least 8 characters', 'weak_password')).resolves.toMatchObject({
      status: 'error',
      message: 'Your password is too short. Use at least 8 characters.',
    });
    await expect(run('Unable to validate email address: invalid format')).resolves.toMatchObject({
      status: 'error',
      message: 'Enter a valid email address.',
    });
    await expect(run('database exploded for person@example.com')).resolves.toEqual({
      status: 'error',
      message: SIGNUP_ERROR_MESSAGE,
    });
  });

  it('resends a signup confirmation to the same landing page', async () => {
    const auth: SignupAuthClient = {
      signUp: vi.fn(async () => response(false)),
      resend: vi.fn(async () => response(false)),
    };

    await expect(
      resendSignupConfirmation(auth, ' person@example.com ', CONFIRMATION_URL),
    ).resolves.toEqual({ status: 'sent', email: 'person@example.com' });
    expect(auth.resend).toHaveBeenCalledExactlyOnceWith({
      type: 'signup',
      email: 'person@example.com',
      options: { emailRedirectTo: CONFIRMATION_URL },
    });
  });

  it('uses a one-minute resend cooldown label', () => {
    expect(RESEND_CONFIRMATION_COOLDOWN_SECONDS).toBe(60);
    expect(resendConfirmationLabel(42)).toBe('Resend in 42 seconds');
    expect(resendConfirmationLabel(1)).toBe('Resend in 1 second');
    expect(resendConfirmationLabel(0)).toBe('Resend confirmation email');
  });

  it('shows one generic message for every resend failure', async () => {
    const rejected = {
      signUp: vi.fn(),
      resend: vi.fn(async () => {
        throw new Error('User not found');
      }),
    };
    const failed = {
      signUp: vi.fn(),
      resend: vi.fn(async () => errorResponse('Email rate limit exceeded')),
    };
    const a = await resendSignupConfirmation(rejected, 'a@example.com', CONFIRMATION_URL);
    const b = await resendSignupConfirmation(failed, 'b@example.com', CONFIRMATION_URL);
    expect(a).toEqual({ status: 'error', message: RESEND_ERROR_MESSAGE });
    expect(b).toEqual(a);
  });
});
