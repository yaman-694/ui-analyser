'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface CheckSessionProps {
    children: React.ReactNode;
}

const CheckSession = ({ children }: CheckSessionProps) => {
    const { isLoaded, isSignedIn } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Only check after Clerk has loaded the session state
        if (isLoaded && !isSignedIn) {
            router.push('/'); // Redirect to home page if not signed in
        }
    }, [isLoaded, isSignedIn, router]);

    // Show nothing while loading to prevent flash of content
    if (!isLoaded) {
        return null;
    }

    // If signed in, render children
    if (isSignedIn) {
        return <>{children}</>;
    }

    // If not signed in, render nothing (redirect will happen)
    return null;
};

export default CheckSession;
