// src/app/api/auth/[...nextauth]/route.ts

import NextAuth from "next-auth";
import { authOptions } from "@/lib/nextauth";

const handler = NextAuth(authOptions);

// Next.js 15 App Router compatibility
export { handler as GET, handler as POST };
