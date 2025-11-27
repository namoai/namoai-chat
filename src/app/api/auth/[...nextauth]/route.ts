// src/app/api/auth/[...nextauth]/route.ts

export const runtime = 'nodejs'; // Prisma를 사용하므로 Node.js runtime 필요

import NextAuth from "next-auth";
import { authOptions } from "@/lib/nextauth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
