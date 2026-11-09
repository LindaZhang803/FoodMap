const path = require("node:path");
const sharp = require("sharp");

jest.mock("node:fs/promises", () => ({
    mkdir: jest.fn(),
    open: jest.fn(),
    unlink: jest.fn()
}));

const fs = require("node:fs/promises");

const {
    AVATAR_DIRECTORY,
    createAvatar,
    deleteAvatar
} = require("../services/avatarService");

const OWNER = "507f1f77bcf86cd799439011";
const OTHER = "507f191e810c19729de860ea";

const OWN_URL =
    "/uploads/avatars/" +
    OWNER +
    "-12345678-1234-4123-8123-123456789abc.jpg";

let handle;

beforeEach(() => {
    jest.resetAllMocks();

    handle = {
        writeFile: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined)
    };

    fs.mkdir.mockResolvedValue(undefined);
    fs.open.mockResolvedValue(handle);
    fs.unlink.mockResolvedValue(undefined);
});

describe("Avatar image processing", () => {
    test.each(["png", "jpeg", "webp"])(
        "converts %s input to a 512px JPEG with a private file",
        async format => {
            const input = await sharp({
                create: {
                    width: 40,
                    height: 30,
                    channels: 3,
                    background: "#3377aa"
                }
            }).toFormat(format).toBuffer();

            const result = await createAvatar(OWNER, input);

            expect(result.profileImage).toMatch(
                new RegExp(
                    "^/uploads/avatars/" + OWNER +
                    "-[a-f0-9-]+\\.jpg$"
                )
            );

            expect(fs.open).toHaveBeenCalledWith(
                path.join(
                    AVATAR_DIRECTORY,
                    path.basename(result.profileImage)
                ),
                "wx",
                0o600
            );

            const output = handle.writeFile.mock.calls[0][0];
            const metadata = await sharp(output).metadata();

            expect(metadata.format).toBe("jpeg");
            expect(metadata.width).toBe(512);
            expect(metadata.height).toBe(512);
            expect(handle.close).toHaveBeenCalled();
        }
    );

    test("rejects invalid owner IDs before writing", async () => {
        await expect(
            createAvatar("../other-user", Buffer.from("image"))
        ).rejects.toThrow("Invalid avatar owner ID");

        expect(fs.open).not.toHaveBeenCalled();
    });

    test.each([null, Buffer.alloc(0)])(
        "rejects empty or invalid image input: %p",
        async input => {
            await expect(
                createAvatar(OWNER, input)
            ).rejects.toMatchObject({ status: 400 });

            expect(fs.open).not.toHaveBeenCalled();
        }
    );

    test("rejects an oversized image", async () => {
        await expect(
            createAvatar(
                OWNER,
                Buffer.alloc(5 * 1024 * 1024 + 1)
            )
        ).rejects.toMatchObject({ status: 413 });

        expect(fs.open).not.toHaveBeenCalled();
    });

    test("rejects unsupported content", async () => {
        await expect(
            createAvatar(OWNER, Buffer.from("not an image"))
        ).rejects.toMatchObject({ status: 415 });

        expect(fs.open).not.toHaveBeenCalled();
    });

    test("cleans up a partial file when writing fails", async () => {
        const input = await sharp({
            create: {
                width: 10,
                height: 10,
                channels: 3,
                background: "#ffffff"
            }
        }).png().toBuffer();

        handle.writeFile.mockRejectedValue(
            new Error("Simulated write failure")
        );

        await expect(
            createAvatar(OWNER, input)
        ).rejects.toThrow("Simulated write failure");

        expect(fs.unlink).toHaveBeenCalledWith(
            fs.open.mock.calls[0][0]
        );
        expect(handle.close).toHaveBeenCalled();
    });
});

describe("Avatar deletion safety", () => {
    test("deletes an owned avatar", async () => {
        await expect(
            deleteAvatar(OWNER, OWN_URL)
        ).resolves.toBe(true);

        expect(fs.unlink).toHaveBeenCalledWith(
            path.join(
                AVATAR_DIRECTORY,
                path.basename(OWN_URL)
            )
        );
    });

    test("does not delete another user's avatar", async () => {
        await expect(
            deleteAvatar(OTHER, OWN_URL)
        ).resolves.toBe(false);

        expect(fs.unlink).not.toHaveBeenCalled();
    });

    test.each([
        "",
        null,
        "https://example.com/photo.jpg",
        "/uploads/avatars/../../private.jpg",
        OWN_URL + "?extra=1"
    ])("refuses an unsafe path: %p", async value => {
        await expect(
            deleteAvatar(OWNER, value)
        ).resolves.toBe(false);

        expect(fs.unlink).not.toHaveBeenCalled();
    });

    test("handles an already missing avatar", async () => {
        fs.unlink.mockRejectedValue(
            Object.assign(new Error("Missing"), {
                code: "ENOENT"
            })
        );

        await expect(
            deleteAvatar(OWNER, OWN_URL)
        ).resolves.toBe(false);
    });

    test("reports unexpected deletion failures", async () => {
        fs.unlink.mockRejectedValue(
            new Error("Simulated permission failure")
        );

        await expect(
            deleteAvatar(OWNER, OWN_URL)
        ).rejects.toThrow("Simulated permission failure");
    });
});