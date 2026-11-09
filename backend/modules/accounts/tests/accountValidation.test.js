const validateRegisterInput = require(
    "../vaildators/registerValidator"
);

const {
    getPasswordError
} = require("../services/passwordPolicy");

function validRegistration(changes = {}) {
    return {
        username: "AccountTest",
        email: "account-test@example.com",
        password: "ExamplePass123!",
        confirmPassword: "ExamplePass123!",
        ...changes
    };
}

describe("Account registration validation", () => {
    test("accepts valid registration information", () => {
        expect(
            validateRegisterInput(validRegistration())
        ).toEqual([]);
    });

    test.each([null, undefined, [], "invalid"])(
        "rejects a non-object request: %p",
        data => {
            expect(validateRegisterInput(data)).toContain(
                "Registration data must be a JSON object"
            );
        }
    );

    test("rejects a blank username", () => {
        expect(
            validateRegisterInput(
                validRegistration({ username: "   " })
            )
        ).toContain("Username is required");
    });

    test("rejects a missing email", () => {
        expect(
            validateRegisterInput(
                validRegistration({ email: "" })
            )
        ).toContain("Email is required");
    });

    test.each([
        "not-an-email",
        "user@example",
        "user name@example.com",
        "user@@example.com"
    ])("rejects invalid email: %s", email => {
        expect(
            validateRegisterInput(
                validRegistration({ email })
            )
        ).toContain("Invalid email format");
    });

    test("rejects a short registration password", () => {
        expect(
            validateRegisterInput(
                validRegistration({
                    password: "short",
                    confirmPassword: "short"
                })
            )
        ).toContain("Password must be at least 8 characters");
    });

    test("requires password confirmation", () => {
        expect(
            validateRegisterInput(
                validRegistration({ confirmPassword: "" })
            )
        ).toContain("Confirm password is required");
    });

    test("rejects mismatched passwords", () => {
        expect(
            validateRegisterInput(
                validRegistration({
                    confirmPassword: "DifferentPass123!"
                })
            )
        ).toContain("Passwords do not match");
    });
});

describe("Account password policy", () => {
    test.each(["", null, undefined, 12345678])(
        "rejects a missing or non-string password: %p",
        password => {
            expect(getPasswordError(password)).toBe(
                "Password is required"
            );
        }
    );

    test("accepts a password at the minimum length", () => {
        expect(getPasswordError("abcdefgh")).toBe("");
    });

    test("accepts exactly 72 UTF-8 bytes", () => {
        expect(getPasswordError("a".repeat(72))).toBe("");
    });

    test("rejects more than 72 ASCII bytes", () => {
        expect(getPasswordError("a".repeat(73))).toBe(
            "Password is too long (maximum 72 UTF-8 bytes)"
        );
    });

    test("checks UTF-8 bytes for non-ASCII passwords", () => {
        expect(getPasswordError("中".repeat(24))).toBe("");

        expect(getPasswordError("中".repeat(25))).toBe(
            "Password is too long (maximum 72 UTF-8 bytes)"
        );
    });

    test("login can verify an existing short password", () => {
        expect(
            getPasswordError("short", {
                requireMinimum: false
            })
        ).toBe("");
    });

    test("login still rejects passwords exceeding 72 bytes", () => {
        expect(
            getPasswordError("a".repeat(73), {
                requireMinimum: false
            })
        ).toBe(
            "Password is too long (maximum 72 UTF-8 bytes)"
        );
    });
});