import { initializeApp, getApps } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

let authInstance = null;
let recaptchaVerifier = null;
let confirmationResult = null;

const firebasePhoneErrorMessages = {
  'auth/app-not-authorized': 'This website domain is not authorized in Firebase Authentication settings.',
  'auth/billing-not-enabled': 'Firebase billing is not enabled for phone SMS authentication.',
  'auth/captcha-check-failed': 'Firebase reCAPTCHA check failed. Refresh the page and try again.',
  'auth/invalid-app-credential': 'Firebase rejected the app credential. Check authorized domains, API key restrictions, and reCAPTCHA settings.',
  'auth/invalid-phone-number': 'Please enter a valid Philippine mobile number.',
  'auth/missing-phone-number': 'Phone number is missing.',
  'auth/operation-not-allowed': 'Firebase Phone sign-in is not enabled, or SMS region policy is blocking this number.',
  'auth/quota-exceeded': 'Firebase SMS quota was exceeded. Try again later or check Firebase billing/limits.',
  'auth/too-many-requests': 'Too many SMS requests were made. Please wait before trying again.',
};

export const normalizePhilippinePhoneE164 = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');

  if (/^09\d{9}$/.test(digits)) {
    return `+63${digits.slice(1)}`;
  }

  if (/^639\d{9}$/.test(digits)) {
    return `+${digits}`;
  }

  return '';
};

export const isFirebasePhoneConfigEnabled = (config = {}) => Boolean(
  config.enabled
  && config.apiKey
  && config.authDomain
  && config.projectId
  && config.appId
);

const firebaseAppConfig = (config) => ({
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket || undefined,
  messagingSenderId: config.messagingSenderId || undefined,
  appId: config.appId,
});

const getFirebaseAuth = (config) => {
  if (!authInstance) {
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseAppConfig(config));
    authInstance = getAuth(app);
    authInstance.languageCode = 'en';
  }

  return authInstance;
};

export const resetFirebaseRecaptcha = () => {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch {
      // Firebase may already have cleared this verifier after a failed attempt.
    }
  }

  recaptchaVerifier = null;
};

export const startFirebasePhoneVerification = async (
  phone,
  config,
  containerId = 'firebase-recaptcha-container', 
  recaptchaOptions = {}
) => {
  const e164Phone = normalizePhilippinePhoneE164(phone);

  if (!isFirebasePhoneConfigEnabled(config)) {
    throw new Error('Firebase phone authentication is not configured.');
  }

  if (!e164Phone) {
    throw new Error('Please enter a valid Philippine mobile number using 09XXXXXXXXX or 639XXXXXXXXX.');
  }

  const auth = getFirebaseAuth(config);

  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: recaptchaOptions.size || 'normal',
    });
  }

  try {
    confirmationResult = await signInWithPhoneNumber(auth, e164Phone, recaptchaVerifier);
    return confirmationResult;
  } catch (error) {
    resetFirebaseRecaptcha();
    if (error?.code && firebasePhoneErrorMessages[error.code]) {
      throw new Error(firebasePhoneErrorMessages[error.code]);
    }
    throw error;
  }
};

export const confirmFirebasePhoneCode = async (code) => {
  if (!confirmationResult) {
    throw new Error('Please send a new SMS code first.');
  }

  let credential;
  try {
    credential = await confirmationResult.confirm(code);
  } catch (error) {
    if (error?.code === 'auth/invalid-verification-code') {
      throw new Error('Invalid SMS verification code.');
    }

    if (error?.code === 'auth/code-expired') {
      throw new Error('SMS verification code expired. Please request a new one.');
    }

    throw error;
  }
  const idToken = await credential.user.getIdToken();
  return {
    idToken,
    phoneNumber: credential.user.phoneNumber || '',
  };
};
