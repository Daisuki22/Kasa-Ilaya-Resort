import React, { createContext, useContext, useEffect, useState } from 'react';
import { baseClient } from '@/api/baseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
    const [authError, setAuthError] = useState(null);
    const [appPublicSettings, setAppPublicSettings] = useState(null);

    const navigateToLogin = () => {
        baseClient.auth.redirectToLogin(window.location.href);
    };

    const resetAuthState = () => {
        setUser(null);
        setIsAuthenticated(false);
    };

    const checkUserAuth = async () => {
        setIsLoadingAuth(true);

        try {
            const currentUser = await baseClient.auth.me();
            setUser(currentUser);
            setIsAuthenticated(true);
            setAuthError(null);
            return currentUser;
        } catch {
            resetAuthState();
            setAuthError(null);
            return null;
        } finally {
            setIsLoadingAuth(false);
        }
    };

    const checkAppState = async () => {
        setIsLoadingAuth(true);
        setIsLoadingPublicSettings(true);
        setAuthError(null);
        setAppPublicSettings({
            id: 'local-kasa-ilaya',
            public_settings: {
                mode: 'local',
                requires_auth: false,
            },
        });

        try {
            await checkUserAuth();
        } catch {
            resetAuthState();
            setAuthError(null);
        } finally {
            setIsLoadingPublicSettings(false);
        }
    };

    useEffect(() => {
        checkAppState();

        const syncAuthState = () => {
            checkAppState();
        };

        window.addEventListener('auth-changed', syncAuthState);
        window.addEventListener('local-auth-changed', syncAuthState);
        window.addEventListener('storage', syncAuthState);

        return () => {
            window.removeEventListener('auth-changed', syncAuthState);
            window.removeEventListener('local-auth-changed', syncAuthState);
            window.removeEventListener('storage', syncAuthState);
        };
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated,
                isLoadingAuth,
                isLoadingPublicSettings,
                authError,
                appPublicSettings,
                navigateToLogin,
                refreshAuthState: checkAppState,
                checkUserAuth,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
};
