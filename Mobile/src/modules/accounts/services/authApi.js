const API_BASE_URL = "http://127.0.0.1:3002";

export async function registerUser(data) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/auth/register`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.errors?.join(", ") ||
                result.message ||
                "Registration failed"
            );
        }

        return result;

    } catch (error) {
        throw error;
    }
}
