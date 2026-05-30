import { useState, useEffect } from 'react';

/**
 * Network detection for Tauri apps using lightweight backend check
 * 
 * Uses cmd_is_network_available which does a simple TCP connection test
 * to Telegram servers without using grammers (avoids stack overflow).
 * 
 * Polls every 10 seconds - very lightweight (~2ms per check).
 */
export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const checkNetwork = async () => {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const available = await invoke<boolean>('cmd_is_network_available');
            setIsOnline(available);
        } catch (error) {
            setIsOnline(false);
        }
    };

    // Initial check
    checkNetwork();

    // Poll every 10 seconds — set up outside .then() so React cleanup can cancel it
    intervalId = setInterval(checkNetwork, 10000);

    return () => {
        if (intervalId !== null) clearInterval(intervalId);
    };
}, []);

    return isOnline;
}
