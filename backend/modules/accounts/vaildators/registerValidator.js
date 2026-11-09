const {
    getPasswordError
} = require("../services/passwordPolicy");

function getEmailError(email) {
    if (!email) {
        return "Email is required";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return "Invalid email format";
    }

    return "";
}

function validateRegisterInput(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return ["Registration data must be a JSON object"];
    }

    const username = typeof data.username === "string"
        ? data.username.trim()
        : "";

    const email = typeof data.email === "string"
        ? data.email.trim()
        : "";

    const password = data.password;

    const confirmPassword = typeof data.confirmPassword === "string"
        ? data.confirmPassword
        : "";

    const confirmationError = !confirmPassword
        ? "Confirm password is required"
        : password !== confirmPassword
            ? "Passwords do not match"
            : "";

    return [
        username ? "" : "Username is required",
        getEmailError(email),
        getPasswordError(password),
        confirmationError
    ].filter(Boolean);
}

module.exports = validateRegisterInput;