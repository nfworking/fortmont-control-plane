"use server";

import { auth } from "@/lib/auth";


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