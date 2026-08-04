"use server";

import { user } from "@/db/schema";
import { db } from "@/db/drizzle";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { headers } from "next/headers";


type SignInInput = {
  email: string;
  password: string;
};

export const signIn = async ({ email, password }: SignInInput) => {
  return auth.api.signInEmail({
    body: {
      email,
      password,
    },
  });
};

export const signUp = async ({ email, password }: SignInInput) => {
  return auth.api.signUpEmail({
    body: {
      email,
      password,
      name: email.split("@")[0] ?? "User",
    },
  });
};

export const getCurrentUser = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
  });

  if (!currentUser) {
    redirect("/login");
  }

  return {
    ...session,
    currentUser,
  };
};