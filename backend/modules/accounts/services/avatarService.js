const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const sharp = require("sharp");

const AVATAR_DIRECTORY = path.resolve(
    __dirname,
    "../../../uploads/avatars"
);

const AVATAR_URL_PREFIX = "/uploads/avatars/";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_INPUT_PIXELS = 16_000_000;
const MAX_CONVERSIONS = 2;

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const FILE_NAME_PATTERN = /^([a-f0-9]{24})-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.jpg$/;

let activeConversions = 0;

class AvatarInputError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = "AvatarInputError";
        this.status = status;
    }
}

function getOwnerId(userId) {
    if (
        typeof userId !== "string" ||
        userId.length !== 24 ||
        !/^[a-f0-9]{24}$/i.test(userId)
    ) {
        throw new TypeError("Invalid avatar owner ID.");
    }

    return userId.toLowerCase();
}

function getInputFormat(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new AvatarInputError("Please select a non-empty image.");
    }

    if (buffer.length > MAX_AVATAR_BYTES) {
        throw new AvatarInputError(
            "Please choose an image no larger than 5 MB.",
            413
        );
    }

    if (
        buffer.length >= 3 &&
        buffer[0] === 255 &&
        buffer[1] === 216 &&
        buffer[2] === 255
    ) {
        return "jpeg";
    }

    if (
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(PNG_SIGNATURE)
    ) {
        return "png";
    }

    if (
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
    ) {
        return "webp";
    }

    throw new AvatarInputError(
        "Please choose a valid JPG, PNG, or WebP image.",
        415
    );
}

async function renderAvatar(buffer) {
    const format = getInputFormat(buffer);
    if (activeConversions >= MAX_CONVERSIONS) {
        throw new AvatarInputError(
            "Image processing is busy. Please try again shortly.",
            503
        );
    }

    activeConversions += 1;
    try {
        const image = sharp(buffer, {
            limitInputPixels: MAX_INPUT_PIXELS,
            failOn: "warning",
            pages: 1
        }).timeout({ seconds: 5 });
        const metadata = await image.metadata();

        if (
            metadata.format !== format ||
            !metadata.width ||
            !metadata.height ||
            (metadata.pages || 1) !== 1 ||
            metadata.width * metadata.height > MAX_INPUT_PIXELS
        ) {
            throw new AvatarInputError(
                "Please choose a valid, non-animated image up to 16 megapixels."
            );
        }

        return await image
            .autoOrient()
            .resize(512, 512, { fit: "cover" })
            .flatten({ background: "#ffffff" })
            .jpeg({ quality: 85 })
            .toBuffer();
    } catch (error) {
        if (error instanceof AvatarInputError) {
            throw error;
        }

        console.error("Avatar image decoding failed:", error);
        throw new AvatarInputError(
            "Please choose a valid, non-animated image up to 16 megapixels."
        );
    } finally {
        activeConversions -= 1;
    }
}

async function writeAvatarFile(filePath, buffer) {
    const file = await fs.open(filePath, "wx", 0o600);

    try {
        await file.writeFile(buffer);
        await file.close();
    } catch (error) {
        const closed = await Promise.allSettled([file.close()]);
        const removed = await Promise.allSettled([fs.unlink(filePath)]);

        for (const result of [...closed, ...removed]) {
            if (
                result.status === "rejected" &&
                result.reason?.code !== "ENOENT"
            ) {
                console.error(
                    "Incomplete avatar cleanup failed:",
                    result.reason
                );
            }
        }

        throw error;
    }
}

async function createAvatar(userId, buffer) {
    const owner = getOwnerId(userId);
    const output = await renderAvatar(buffer);
    const filename = owner + "-" + randomUUID() + ".jpg";

    await fs.mkdir(AVATAR_DIRECTORY, {
        recursive: true,
        mode: 0o700
    });

    await writeAvatarFile(path.join(AVATAR_DIRECTORY, filename), output);

    return {
        profileImage: AVATAR_URL_PREFIX + filename
    };
}

async function deleteAvatar(userId, profileImage) {
    const owner = getOwnerId(userId);

    if (
        typeof profileImage !== "string" ||
        !profileImage.startsWith(AVATAR_URL_PREFIX)
    ) {
        return false;
    }

    const filename = profileImage.slice(AVATAR_URL_PREFIX.length);
    const match = FILE_NAME_PATTERN.exec(filename);

    if (!match || match[0] !== filename || match[1] !== owner) {
        return false;
    }

    try {
        await fs.unlink(path.join(AVATAR_DIRECTORY, filename));
        return true;
    } catch (error) {
        if (error.code === "ENOENT") {
            return false;
        }

        throw error;
    }
}

module.exports = {
    AVATAR_DIRECTORY,
    AvatarInputError,
    createAvatar,
    deleteAvatar
};