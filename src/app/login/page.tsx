import LoginForm from "./LoginForm";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="mb-1 text-xl font-bold">Next Level Web Solutions</h1>
        <p className="mb-5 text-sm text-muted">Sign in to the CRM</p>
        {error === "not-authorised" && <p role="alert" className="mb-3 text-sm text-bad">This account is not authorised.</p>}
        <LoginForm />
      </div>
    </div>
  );
}
