import React, { useState, useEffect } from 'react';
import { Onboarding } from './components/Onboarding';
import { Auth } from './components/Auth';
import { StudentApp } from './components/StudentApp';
import { AdminApp } from './components/AdminApp';
import { dataService } from './services/dataService';
import { Profile, UserRole } from './types';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [onboarded, setOnboarded] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('student');
  const [loading, setLoading] = useState<boolean>(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('ingenium_theme') as 'light' | 'dark') || 'dark';
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

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Initialize session and onboarding preference
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Read onboarding state
        const hasOnboarded = localStorage.getItem('ingenium_onboarded') === 'true';
        setOnboarded(hasOnboarded);

        // Fetch current session from dataService
        const user = await dataService.auth.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          setCurrentRole(user.role);
        }
      } catch (e) {
        console.error('Session initialisation failed', e);
      } finally {
        setLoading(false);
      }
    };
    
    checkSession();
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
  };

  const handleProfileUpdate = (updatedProfile: Profile) => {
    setCurrentUser(updatedProfile);
    setCurrentRole(updatedProfile.role);
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen dot-grid text-white font-sans">
        <Loader2 className="w-8 h-8 text-[#00B074] animate-spin mb-3" />
        <span className="text-xs uppercase font-extrabold tracking-[0.2em] text-zinc-400">
          Ingenium Tech Academy
        </span>
      </div>
    );
  }

  // 1. Onboarding Flow (Exactly 4 screens)
  if (!onboarded) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // 2. Authentication Flow (Clean, un-tabbed)
  if (!currentUser) {
    return (
      <Auth 
        onSuccess={handleAuthSuccess} 
        onBackToOnboarding={() => {
          localStorage.removeItem('ingenium_onboarded');
          setOnboarded(false);
        }} 
      />
    );
  }

  // 3. Authenticated Role views
  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-[#00B074]/20 font-sans">
      
      {currentRole === 'admin' ? (
        <AdminApp 
          currentUser={currentUser} 
          onLogout={handleLogout} 
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      ) : (
        <StudentApp 
          currentUser={currentUser} 
          onLogout={handleLogout}
          onProfileUpdate={handleProfileUpdate}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}
      
    </div>
  );
}
