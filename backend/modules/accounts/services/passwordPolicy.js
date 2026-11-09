const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

function getPasswordError(
    password,
    { requireMinimum = true } = {}
) {
    if (typeof password !== "string" || password.length === 0) {
        return "Password is required";
    }

    if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
        return "Password is too long (maximum 72 UTF-8 bytes)";
    }

    if (requireMinimum && password.length < MIN_PASSWORD_LENGTH) {
        return "Password must be at least 8 characters";
    }

    return "";
}

module.exports = {
    getPasswordError
};