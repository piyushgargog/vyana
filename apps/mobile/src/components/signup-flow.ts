import type {
  AuthResponse,
  ResendParams,
  SignUpWithPasswordCredentials,
} from '@supabase/supabase-js';

export const SIGNUP_CONFIRMATION_PATH = '/auth/confirmed';
export const RESEND_CONFIRMATION_COOLDOWN_SECONDS = 60;

// One fixed text for every resend failure: never echo the provider's words,
// so the reply cannot show whether an address has an account.
export const RESEND_ERROR_MESSAGE =
  'We could not resend the email. Please wait a minute and try again.';

export type SignupRole = 'patient' | 'doctor';

export interface SignupDetails {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: SignupRole;
}

export interface SignupAuthClient {
  signUp: (
    credentials: SignUpWithPasswordCredentials,
  ) => Promise<AuthResponse>;
  resend: (credentials: ResendParams) => Promise<AuthResponse>;
}

export type SignupResult =
  | { status: 'session' }
  | { status: 'confirmation'; email: string }
  | { status: 'error'; message: string };

export type ResendConfirmationResult =
  | { status: 'sent'; email: string }
  | { status: 'error'; message: string };

/** The one confirmation landing used by both signup forms. */
export function signupConfirmationUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${SIGNUP_CONFIRMATION_PATH}`;
}

export async function submitSignup(
  auth: SignupAuthClient,
  details: SignupDetails,
  confirmationUrl: string,
): Promise<SignupResult> {
  const email = details.email.trim();

  try {
    const { data, error } = await auth.signUp({
      email,
      password: details.password,
      options: {
        emailRedirectTo: confirmationUrl,
        data: {
          full_name: details.fullName.trim(),
          phone: details.phone?.trim() || undefined,
          role: details.role,
        },
      },
    });

    if (error) return { status: 'error', message: error.message };
    if (data.session) return { status: 'session' };
    return { status: 'confirmation', email };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Signup failed',
    };
  }
}

export async function resendSignupConfirmation(
  auth: SignupAuthClient,
  email: string,
  confirmationUrl: string,
): Promise<ResendConfirmationResult> {
  const trimmedEmail = email.trim();

  try {
    const { error } = await auth.resend({
      type: 'signup',
      email: trimmedEmail,
      options: { emailRedirectTo: confirmationUrl },
    });

    if (error) return { status: 'error', message: RESEND_ERROR_MESSAGE };
    return { status: 'sent', email: trimmedEmail };
  } catch {
    return {
      status: 'error',
      message: RESEND_ERROR_MESSAGE,
    };
  }
}

export function resendConfirmationLabel(secondsRemaining: number): string {
  if (secondsRemaining <= 0) return 'Resend confirmation email';
  return `Resend in ${secondsRemaining} ${
    secondsRemaining === 1 ? 'second' : 'seconds'
  }`;
}
