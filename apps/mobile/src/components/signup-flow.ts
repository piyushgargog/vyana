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

// One fixed text for every other sign-up failure: never echo the provider's
// words, so the reply cannot show whether an address already has an account.
export const SIGNUP_ERROR_MESSAGE =
  'We could not create your account. Check your details and try again.';
export const SIGNUP_PASSWORD_ERROR_MESSAGE =
  'Your password is too short. Use at least 8 characters.';
export const SIGNUP_EMAIL_ERROR_MESSAGE =
  'Enter a valid email address.';

interface SignupProviderError {
  message?: string;
  code?: string;
}

function isAlreadyRegistered(error: SignupProviderError): boolean {
  return (
    error.code === 'user_already_exists' ||
    error.code === 'email_exists' ||
    /already (registered|exists|been registered)/i.test(error.message ?? '')
  );
}

function signupErrorMessage(error: SignupProviderError): string {
  if (
    error.code === 'weak_password' ||
    /password.*(at least|short|characters)/i.test(error.message ?? '')
  ) {
    return SIGNUP_PASSWORD_ERROR_MESSAGE;
  }
  if (
    error.code === 'email_address_invalid' ||
    /invalid.*email|email.*invalid|validate email/i.test(error.message ?? '')
  ) {
    return SIGNUP_EMAIL_ERROR_MESSAGE;
  }
  return SIGNUP_ERROR_MESSAGE;
}

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

    if (error) {
      // A taken address looks exactly like a new one: same inbox state.
      if (isAlreadyRegistered(error)) return { status: 'confirmation', email };
      return { status: 'error', message: signupErrorMessage(error) };
    }
    if (data.session) return { status: 'session' };
    return { status: 'confirmation', email };
  } catch {
    return {
      status: 'error',
      message: SIGNUP_ERROR_MESSAGE,
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
