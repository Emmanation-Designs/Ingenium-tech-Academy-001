import React, { useState, useEffect } from 'react';
import { Onboarding } from './components/Onboarding';
import { Auth } from './components/Auth';
import { StudentApp } from './components/StudentApp';
import { AdminApp } from './components/AdminApp';
import { TeacherApp } from './components/TeacherApp';
import { TeacherInviteAccept } from './components/teacher/TeacherInviteAccept';
import { dataService } from './services/dataService';
import { Profile, UserRole } from './types';
import { Loader2 } from 'lucide-react';

const getInviteTokenFromUrl = (): string | null => {
  try {
    const url = new URL(window.location.href);
    const paramToken = url.searchParams.get('invite') || url.searchParams.get('token') || url.searchParams.get('teacher_invite');
    if (paramToken) return paramToken;

    const path = url.pathname;
    const match = path.match(/\/teacher\/invite\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return match[1];

    const hash = url.hash;
    const hashMatch = hash.match(/teacher\/invite\/([a-zA-Z0-9_-]+)/);
    if (hashMatch && hashMatch[1]) return hashMatch[1];
    if (hash.includes('invite=')) {
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
      const hToken = hashParams.get('invite') || hashParams.get('token');
      if (hToken) return hToken;
    }
  } catch (e) {
    console.error('Error parsing invite token:', e);
  }
  return null;
};

export default function App() {
  const [onboarded, setOnboarded] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('student');
  const [loading, setLoading] = useState<boolean>(true);
  const [inviteToken, setInviteToken] = useState<string | null>(() => getInviteTokenFromUrl());
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('ingenium_theme') as 'light' | 'dark') || 'light';
  });

  // Apply theme class on root element
  useEffect(() => {
    localStorage.setItem('ingenium_theme', theme);
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [theme]);

  // Listen for browser URL changes (back/forward or navigation with invite params)
  useEffect(() => {
    const handleUrlChange = () => {
      const token = getInviteTokenFromUrl();
      if (token !== inviteToken) {
        setInviteToken(token);
      }
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, [inviteToken]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Initialize session, auth listeners, and onboarding preference
  useEffect(() => {
    let isMounted = true;

    // Read onboarding state
    const hasOnboarded = localStorage.getItem('ingenium_onboarded') === 'true';
    setOnboarded(hasOnboarded);

    // Initial session fetch
    const initAuth = async () => {
      try {
        const user = await dataService.auth.getCurrentUser();
        if (isMounted) {
          if (user) {
            setCurrentUser(user);
            setCurrentRole(user.role);
          }
          setLoading(false);
        }
      } catch (e) {
        console.error('Session initialisation failed', e);
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    // Listen to Supabase Auth state changes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED)
    const subscription = dataService.auth.onAuthStateChange(
      (event, session, profile) => {
        if (!isMounted) return;
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (profile) {
            setCurrentUser(profile);
            setCurrentRole(profile.role);
          } else if (!session) {
            setCurrentUser(null);
            setCurrentRole('student');
          }
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setCurrentRole('student');
        }
      }
    );

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('ingenium_onboarded', 'true');
    setOnboarded(true);
  };

  const handleAuthSuccess = (user: Profile) => {
    setCurrentUser(user);
    setCurrentRole(user.role);
  };

  const handleLogout = async () => {
    await dataService.auth.signOut();
    setCurrentUser(null);
    setCurrentRole('student');
    // Keep onboarding marked as completed so the user is directly returned to the sign-in screen
  };

  const handleProfileUpdate = (updatedProfile: Profile) => {
    setCurrentUser(updatedProfile);
    setCurrentRole(updatedProfile.role);
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen dot-grid text-white font-sans">
        <Loader2 className="w-8 h-8 text-[#0A9D8F] animate-spin mb-3" />
        <span className="text-xs uppercase font-extrabold tracking-[0.2em] text-zinc-400">
          Ingenium Tech Academy
        </span>
      </div>
    );
  }

  // 0. Teacher Invitation Acceptance Link Screen (if token present in URL)
  if (inviteToken) {
    return (
      <TeacherInviteAccept
        token={inviteToken}
        currentUser={currentUser}
        onSuccess={(profile) => {
          setInviteToken(null);
          try {
            window.history.replaceState({}, '', '/');
          } catch (e) {}
          handleAuthSuccess(profile);
        }}
        onGoToSignIn={() => {
          setInviteToken(null);
          try {
            window.history.replaceState({}, '', '/');
          } catch (e) {}
        }}
        onContinueToDashboard={() => {
          setInviteToken(null);
          try {
            window.history.replaceState({}, '', '/');
          } catch (e) {}
        }}
      />
    );
  }

  // 1. Authenticated users go straight to their role-specific dashboard
  if (currentUser) {
    if (currentRole === 'admin') {
      return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#111827] selection:bg-[#0A9D8F]/20 font-sans">
          <AdminApp 
            currentUser={currentUser} 
            onLogout={handleLogout} 
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        </div>
      );
    }

    if (currentRole === 'teacher') {
      return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#111827] selection:bg-[#0A9D8F]/20 font-sans">
          <TeacherApp 
            currentUser={currentUser} 
            onLogout={handleLogout}
          />
        </div>
      );
    }

    return (
      <div className={`min-h-screen ${theme === 'light' ? 'bg-[#f8fafc] text-zinc-900' : 'bg-zinc-950 text-white'} selection:bg-[#0A9D8F]/20 font-sans`}>
        <StudentApp 
          currentUser={currentUser} 
          onLogout={handleLogout}
          onProfileUpdate={handleProfileUpdate}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      </div>
    );
  }

  // 2. Onboarding Flow (for new first-time visitors)
  if (!onboarded) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // 3. Authentication Flow (Clean, direct Supabase auth)
  return (
    <Auth 
      onSuccess={handleAuthSuccess} 
      onBackToOnboarding={() => {
        setOnboarded(false);
      }} 
    />
  );
}
