import { Link, NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  ArrowUpRight,
  GraduationCap,
  ShieldCheck,
  Wallet,
  LogOut,
  Building2,
  UserRound,
} from 'lucide-react';
import { Button } from './ui/button';
import { requireSupabase, type Profile } from '../lib/supabase/client';

export function Shell({
  children,
  profile,
}: {
  children: ReactNode;
  profile: Profile | null;
}) {
  const isUniversity = profile?.role === 'university';
  const isStudent = profile?.role === 'student';

  const navigation = [
    { label: 'Home', to: '/' },
    { label: 'Verify certificate', to: '/verify' },
    ...(isUniversity
      ? [
          { label: 'University', to: '/university' },
          { label: 'Students', to: '/university/students' },
          { label: 'Credentials', to: '/university/history' },
        ]
      : []),
    ...(isStudent
      ? [
          { label: 'My credentials', to: '/student' },
          { label: 'My identity', to: '/student/onboarding' },
        ]
      : []),
  ];

  const roleLabel = isUniversity
    ? 'University issuer'
    : isStudent
      ? 'Student holder'
      : 'Guest';

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-800">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-3 md:px-8">

          <Link to="/" className="flex shrink-0 items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-teal-300 shadow-sm">
              <ShieldCheck size={25} strokeWidth={2.2} />
            </span>

            <span className="flex flex-col">
              <span className="text-xl font-extrabold leading-tight tracking-tight text-slate-950">
                DID<span className="text-teal-600">-Chain</span>
              </span>
              <span className="hidden text-[10px] font-semibold tracking-wide text-slate-500 sm:block">
                DECENTRALIZED CREDENTIAL VERIFICATION
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-5 lg:flex">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `text-sm font-semibold transition-colors ${
                    isActive
                      ? 'text-teal-700'
                      : 'text-slate-600 hover:text-slate-950'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            {profile ? (
              <>
                <div className="hidden items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 sm:flex">
                  {isUniversity ? (
                    <Building2 size={15} className="text-teal-700" />
                  ) : (
                    <UserRound size={15} className="text-teal-700" />
                  )}
                  {roleLabel}
                </div>

                <Button
                  size="sm"
                  variant="subtle"
                  onClick={async () => {
                    await requireSupabase().auth.signOut();
                    location.assign('/');
                  }}
                >
                  <LogOut size={15} />
                  Logout
                </Button>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Log in
              </Link>
            )}
          </div>
        </div>

        <nav className="flex items-center gap-5 overflow-x-auto border-t border-slate-100 px-5 py-3 text-xs font-semibold lg:hidden">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `shrink-0 ${
                  isActive
                    ? 'text-teal-700'
                    : 'text-slate-600 hover:text-slate-950'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto min-h-[calc(100vh-200px)] max-w-7xl px-5 py-9 md:px-8">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-8 py-7 text-xs text-slate-500">
          <span className="flex items-center gap-2">
            <GraduationCap size={16} />
            DID-Chain · Modern Cryptography Research Prototype
          </span>

          <span className="flex items-center gap-1">
            <Wallet size={13} />
            Ethereum / EIP-712 / AES-GCM
            <ArrowUpRight size={12} />
          </span>
        </div>
      </footer>
    </div>
  );
}
