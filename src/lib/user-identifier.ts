const EMAIL_REGEX = /^[^\s@]+@[^\s@]+$/;
const PHONE_REGEX = /^\+?\d{6,20}$/;

export function normalizeUserIdentifier(value: string) {
    const trimmed = value.trim();
    if (trimmed.includes("@")) {
        return trimmed;
    }
    return trimmed.replace(/[\s-]/g, "");
}

export function isValidUserIdentifier(value: string) {
    const normalized = normalizeUserIdentifier(value);
    return EMAIL_REGEX.test(normalized) || PHONE_REGEX.test(normalized);
}

export function userIdentifierErrorMessage() {
    return "Invalid email or phone format";
}
