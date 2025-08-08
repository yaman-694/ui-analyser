import {
    SignInButton,
    SignOutButton,
    SignUpButton,
    SignedIn,
    SignedOut,
} from "@clerk/nextjs";
import Link from "next/link";

export default function Header() {
  return (
    <header className="fixed z-10 w-full text-input backdrop-blur-md">
      <div className="lg:max-w-[90rem] mx-auto flex w-full justify-between items-center px-6 py-4">
        <Link
          className="font-growigh text-[28px] lg:text-3xl text-nowrap"
          href="/"
        >
          UI Analyzer
        </Link>
        <div className="flex items-center gap-4">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-6 py-2 bg-white rounded-full text-black font-medium hover:bg-white/90 transition">
                Log in
              </button>
            </SignInButton>
            <div className="hidden lg:block">
              <SignUpButton mode="modal">
                <button className="px-6 py-2 border border-white rounded-full text-white hover:bg-white/10 transition">
                  Sign up
                </button>
              </SignUpButton>
            </div>
          </SignedOut>
          <SignedIn>
            <SignOutButton>
              <button className="px-6 py-2 border border-white rounded-full text-white hover:bg-white/10 transition">
                Log out
              </button>
            </SignOutButton>
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
