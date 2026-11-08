const express = require("express");
const request = require("supertest");

const {
    receiveAvatar,
    avatarUploadLimiter
} = require("../middleware/avatarUpload");

function createApp({
    authenticated = true,
    limited = false,
    userId = "upload-test-user"
} = {}) {
    const app = express();

    app.use((req, res, next) => {
        if (authenticated) {
            req.user = { id: userId };
        }

        next();
    });

    const handlers = limited
        ? [avatarUploadLimiter, receiveAvatar]
        : [receiveAvatar];

    app.post("/avatar", ...handlers, (req, res) => {
        res.json({
            size: req.file.size,
            type: req.file.mimetype
        });
    });

    return app;
}

describe("Avatar upload validation", () => {
    test("requires authentication", async () => {
        const response = await request(
            createApp({ authenticated: false })
        )
            .post("/avatar")
            .attach("avatar", Buffer.from("image"), {
                filename: "photo.png",
                contentType: "image/png"
            });

        expect(response.status).toBe(401);
    });

    test("rejects JSON instead of multipart data", async () => {
        const response = await request(createApp())
            .post("/avatar")
            .send({ avatar: "not-a-file" });

        expect(response.status).toBe(415);
    });

    test.each([
        ["image/png", "photo.png"],
        ["image/jpeg", "photo.jpg"],
        ["image/webp", "photo.webp"]
    ])("accepts a single %s file", async (type, filename) => {
        const buffer = Buffer.from("test-upload-bytes");

        const response = await request(createApp())
            .post("/avatar")
            .attach("avatar", buffer, {
                filename,
                contentType: type
            });

        expect(response.status).toBe(200);
        expect(response.body.size).toBe(buffer.length);
        expect(response.body.type).toBe(type);
    });

    test("rejects an unsupported file type", async () => {
        const response = await request(createApp())
            .post("/avatar")
            .attach("avatar", Buffer.from("text"), {
                filename: "file.txt",
                contentType: "text/plain"
            });

        expect(response.status).toBe(415);
    });

    test("rejects an empty file", async () => {
        const response = await request(createApp())
            .post("/avatar")
            .attach("avatar", Buffer.alloc(0), {
                filename: "empty.png",
                contentType: "image/png"
            });

        expect(response.status).toBe(400);
    });

    test("rejects a file larger than 5 MB", async () => {
        const response = await request(createApp())
            .post("/avatar")
            .attach(
                "avatar",
                Buffer.alloc(5 * 1024 * 1024 + 1),
                {
                    filename: "large.png",
                    contentType: "image/png"
                }
            );

        expect(response.status).toBe(413);
    });

    test("rejects the wrong upload field name", async () => {
        const response = await request(createApp())
            .post("/avatar")
            .attach("other", Buffer.from("image"), {
                filename: "photo.png",
                contentType: "image/png"
            });

        expect(response.status).toBe(400);
    });

    test("rejects multiple uploaded files", async () => {
        const response = await request(createApp())
            .post("/avatar")
            .attach("avatar", Buffer.from("first"), {
                filename: "first.png",
                contentType: "image/png"
            })
            .attach("avatar", Buffer.from("second"), {
                filename: "second.png",
                contentType: "image/png"
            });

        expect(response.status).toBe(400);
    });
});

describe("Avatar upload rate limit", () => {
    test("requires authentication before limiting", async () => {
        const response = await request(createApp({
            authenticated: false,
            limited: true
        }))
            .post("/avatar");

        expect(response.status).toBe(401);
    });

    test("blocks the sixth upload attempt for one user", async () => {
        const app = createApp({
            limited: true,
            userId: "rate-limit-test-user"
        });

        for (let attempt = 0; attempt < 5; attempt++) {
            const response = await request(app)
                .post("/avatar")
                .attach("avatar", Buffer.from("image"), {
                    filename: "photo.png",
                    contentType: "image/png"
                });

            expect(response.status).toBe(200);
        }

        const blocked = await request(app)
            .post("/avatar")
            .attach("avatar", Buffer.from("image"), {
                filename: "photo.png",
                contentType: "image/png"
            });

        expect(blocked.status).toBe(429);
    });
});