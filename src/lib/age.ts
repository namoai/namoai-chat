import { PrismaClient, users } from "@prisma/client";

export type AgeStatus = {
  isMinor: boolean;
  age: number | null;
  source: "birthdate" | "declaration" | "unknown";
  declaredAdult: boolean | null;
};

const ADULT_AGE = 18;

function calculateAge(birthdate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthdate.getFullYear();
  const monthDiff = today.getMonth() - birthdate.getMonth();
  const dayDiff = today.getDate() - birthdate.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age;
}

export function deriveAgeStatus(user?: Pick<users, "dateOfBirth" | "declaredAdult">): AgeStatus {
  if (user?.dateOfBirth) {
    const age = calculateAge(new Date(user.dateOfBirth));
    return {
      isMinor: age < ADULT_AGE,
      age,
      source: "birthdate",
      declaredAdult: user.declaredAdult ?? null,
    };
  }

  if (typeof user?.declaredAdult === "boolean") {
    return {
      isMinor: user.declaredAdult === false,
      age: null,
      source: "declaration",
      declaredAdult: user.declaredAdult,
    };
  }

  return {
    isMinor: true,
    age: null,
    source: "unknown",
    declaredAdult: null,
  };
}

type SafetySourceUser = Pick<users, "safetyFilter" | "dateOfBirth" | "declaredAdult">;

export function resolveSafetyFilter(user?: SafetySourceUser): { safetyFilter: boolean; ageStatus: AgeStatus } {
  const ageStatus = deriveAgeStatus(user);
  const safetyFilter = ageStatus.isMinor ? true : (user?.safetyFilter ?? true);

  return { safetyFilter, ageStatus };
}

export async function getUserSafetyContext(prisma: PrismaClient, userId: number) {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      safetyFilter: true,
      dateOfBirth: true,
      declaredAdult: true,
    },
  });

  return resolveSafetyFilter(user as SafetySourceUser | undefined);
}





