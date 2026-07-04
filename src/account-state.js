const STORAGE_KEY = 'blue-song-profile';

export function validateRegistration(input) {
  if (!input.email || !input.password || !input.confirmPassword) {
    return { ok: false, error: 'missing-fields' };
  }

  if (input.password !== input.confirmPassword) {
    return { ok: false, error: 'password-mismatch' };
  }

  return { ok: true, error: null };
}

export function validateAddress(input) {
  const requiredFields = ['recipientName', 'phone', 'province', 'city', 'detail'];
  const hasAllFields = requiredFields.every((field) => String(input[field] || '').trim().length > 0);

  if (!hasAllFields) {
    return { ok: false, error: 'missing-fields' };
  }

  return { ok: true, error: null };
}

export function saveStoredProfile(storage, profile) {
  storage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function loadStoredProfile(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
