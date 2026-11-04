
function validateRegisterInput(data) {
    const errors = [];

    const username = typeof data.username === "string"
        ? data.username.trim() : "";

    const email = typeof data.email === "string"
        ? data.email.trim() : "";

    const password = typeof data.password === "string"
        ? data.password : "";

    const confirmPassword = typeof data.confirmPassword === "string"
        ? data.confirmPassword : "";

    if (!username) {
        errors.push("Username is required");
    }

    if (!email) {
        errors.push("Email is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push("Invalid email format");
    }

    if (!password) {
        errors.push("Password is required");
    } else if (password.length < 8) {
        errors.push("Password must be at least 8 characters");
    }

    if (password !== confirmPassword) {
        errors.push("Passwords do not match");
    }

    return errors;
}

module.exports = validateRegisterInput;
