"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import React from "react";
import Link from "next/link";

type MainLayoutProps = {
  children: React.ReactNode;
};

const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <>
      <AuthLoading>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-500">Loading...</p>
        </div>
      </AuthLoading>

      <Unauthenticated>
        <div className="flex flex-col items-center justify-center min-h-screen text-center">
          <h2 className="text-xl font-semibold mb-4">
            You must be signed in to access this page
          </h2>
          <Link
            href="/sign-in"
            className="rounded-lg bg-indigo-600 px-6 py-3 text-white font-medium hover:bg-indigo-700"
          >
            Sign in
          </Link>
        </div>
      </Unauthenticated>

      <Authenticated>
        <div className="container mx-auto mt-24 mb-20 px-4">
          {children}
        </div>
      </Authenticated>
    </>
  );
};

export default MainLayout;
