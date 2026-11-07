import { useCallback, useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";

import {
    ApiError,
    getMyProfile,
    loginUser,
    logoutUser,
    updateMyProfile,
    uploadMyAvatar
} from "../services/authApi";

const TOKEN_KEY = "foodmap.auth.token";

export default function useAuthSession() {
    const [auth, setAuth] = useState({ phase: "restoring" });
    const [restoreAttempt, setRestoreAttempt] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const mounted = useRef(true);
    const operation = useRef(null);
    const storageQueue = useRef(Promise.resolve());

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
            operation.current = null;
        };
    }, []);

    const begin = useCallback(() => {
        if (!mounted.current || operation.current) {
            return null;
        }

        const id = Symbol("auth-operation");
        operation.current = id;
        return id;
    }, []);

    const isCurrent = useCallback(id => (
        mounted.current && operation.current === id
    ), []);

    const finish = useCallback(id => {
        if (operation.current === id) {
            operation.current = null;
        }
    }, []);

    const withStorage = useCallback(async (id, action) => {
        const previous = storageQueue.current;
        let release;

        storageQueue.current = new Promise(resolve => {
            release = resolve;
        });

        await previous;

        try {
            if (!isCurrent(id)) {
                return;
            }

            return await action();
        } finally {
            release();
        }
    }, [isCurrent]);

    const clearLocalSession = useCallback(async id => {
        if (!isCurrent(id)) {
            return;
        }

        setAuth({ phase: "clearing" });

        try {
            await withStorage(
                id,
                () => SecureStore.deleteItemAsync(TOKEN_KEY)
            );

            if (isCurrent(id)) {
                setAuth({ phase: "signedOut" });
            }
        } catch {
            if (isCurrent(id)) {
                setAuth({
                    phase: "cleanupError",
                    message:
                        "Your session has ended. Please retry to finish signing out."
                });
            }
        }
    }, [isCurrent, withStorage]);

    useEffect(() => {
        const id = begin();

        if (!id) {
            return;
        }

        setIsSaving(false);
        setIsUploading(false);

        async function restore() {
            try {
                const token = await withStorage(
                    id,
                    () => SecureStore.getItemAsync(TOKEN_KEY)
                );

                if (!isCurrent(id)) {
                    return;
                }

                if (!token) {
                    setAuth({ phase: "signedOut" });
                    return;
                }

                const result = await getMyProfile(token);

                if (isCurrent(id)) {
                    setAuth({
                        phase: "signedIn",
                        token,
                        user: result.user
                    });
                }
            } catch (error) {
                if (!isCurrent(id)) {
                    return;
                }

                if (
                    error instanceof ApiError &&
                    error.status === 401
                ) {
                    await clearLocalSession(id);
                } else {
                    setAuth({
                        phase: "restoreError",
                        message: error instanceof ApiError
                            ? error.message
                            : "Could not read your saved sign-in. Please try again."
                    });
                }
            } finally {
                finish(id);
            }
        }

        restore();

        return () => {
            finish(id);
        };
    }, [
        restoreAttempt,
        begin,
        isCurrent,
        finish,
        clearLocalSession,
        withStorage
    ]);

    async function login(credentials) {
        if (auth.phase !== "signedOut") {
            return;
        }

        const id = begin();

        if (!id) {
            return;
        }

        setAuth({ phase: "signingIn" });

        try {
            const result = await loginUser(credentials);

            if (!isCurrent(id)) {
                return;
            }

            const profile = await getMyProfile(result.token);

            if (!isCurrent(id)) {
                return;
            }

            if (profile.user.id !== result.user.id) {
                throw new ApiError(
                    "Server returned inconsistent user information."
                );
            }

            await withStorage(
                id,
                () => SecureStore.setItemAsync(
                    TOKEN_KEY,
                    result.token,
                    {
                        keychainAccessible:
                            SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
                    }
                )
            );

            if (isCurrent(id)) {
                setAuth({
                    phase: "signedIn",
                    token: result.token,
                    user: profile.user
                });
            }
        } catch (error) {
            if (!isCurrent(id)) {
                return;
            }

            if (error instanceof ApiError) {
                setAuth({ phase: "signedOut" });
                throw error;
            }

            await clearLocalSession(id);

            if (isCurrent(id)) {
                throw new Error(
                    "Could not save your sign-in. Please try again."
                );
            }
        } finally {
            finish(id);
        }
    }

    async function saveProfile(
        sendRequest,
        data,
        uploadingAvatar = false
    ) {
        if (auth.phase !== "signedIn") {
            return null;
        }

        const id = begin();

        if (!id) {
            return null;
        }

        const session = auth;

        setIsSaving(true);
        setIsUploading(uploadingAvatar);

        try {
            const result = await sendRequest(
                session.token,
                data
            );

            if (!isCurrent(id)) {
                return null;
            }

            if (result.user.id !== session.user.id) {
                throw new ApiError(
                    "Server returned inconsistent user information."
                );
            }

            const updatedUser = {
                ...session.user,
                ...result.user
            };

            setAuth({
                ...session,
                user: updatedUser
            });

            return updatedUser;
        } catch (error) {
            if (!isCurrent(id)) {
                return null;
            }

            if (
                error instanceof ApiError &&
                error.status === 401
            ) {
                await clearLocalSession(id);
                return null;
            }

            throw error;
        } finally {
            if (isCurrent(id)) {
                setIsSaving(false);
                setIsUploading(false);
            }

            finish(id);
        }
    }

    function updateProfile(data) {
        return saveProfile(updateMyProfile, data);
    }

    function updateAvatar(asset) {
        return saveProfile(uploadMyAvatar, asset, true);
    }

    async function logout() {
        if (auth.phase !== "signedIn") {
            return;
        }

        const id = begin();

        if (!id) {
            return;
        }

        const session = auth;

        setAuth({
            ...session,
            phase: "signingOut"
        });

        try {
            try {
                await logoutUser(session.token);
            } catch (error) {
                if (!isCurrent(id)) {
                    return;
                }

                if (!(
                    error instanceof ApiError &&
                    error.status === 401
                )) {
                    setAuth({
                        ...session,
                        phase: "signedIn"
                    });

                    throw error;
                }
            }

            if (isCurrent(id)) {
                await clearLocalSession(id);
            }
        } finally {
            finish(id);
        }
    }

    function retryRestore() {
        if (auth.phase !== "restoreError") {
            return;
        }

        setAuth({ phase: "restoring" });
        setRestoreAttempt(value => value + 1);
    }

    async function retryCleanup() {
        if (auth.phase !== "cleanupError") {
            return;
        }

        const id = begin();

        if (!id) {
            return;
        }

        try {
            await clearLocalSession(id);
        } finally {
            finish(id);
        }
    }

    return {
        auth,
        login,
        logout,
        updateProfile,
        updateAvatar,
        isSaving,
        isUploading,
        retryRestore,
        retryCleanup
    };
}