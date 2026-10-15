"use client";
import { useActionState } from "react";
import { signIn } from "../actions";
import { ErrorText } from "@/components/ui";

export default function LoginForm() {
  const [state, action, pending] = useActionState(signIn, {});
  return (
    <form action={action} className="space-y-3">
      <div><label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" /></div>
      <div><label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" /></div>
      <ErrorText error={state.error ?? null} />
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
