import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldBlock } from "@/components/FormBlocks";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { messageFromAuthError, messageFromUnknownError } from "@/lib/errors";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@flavours-of-dobrogea.ro");
  const [password, setPassword] = useState("flavours-admin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const { data } = await authClient.getSession();
        if (!data?.user || cancelled) return;
        const { accountType } = await api.getAccount();
        if (accountType === "admin") {
          navigate("/admin", { replace: true });
        }
      } catch {
        // stay on login
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void checkSession();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        throw new Error(messageFromAuthError(result.error));
      }

      const { accountType } = await api.getAccount();
      if (accountType !== "admin") {
        await authClient.signOut();
        throw new Error("Acest cont nu are drepturi de administrator.");
      }

      navigate("/admin", { replace: true });
    } catch (caught) {
      setError(messageFromUnknownError(caught, "Autentificare eșuată."));
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#1f2618]">
        <Loader2 className="h-8 w-8 animate-spin text-[#d8e7b8]" />
      </main>
    );
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#1f2618] p-4 text-[#f4f7ee]">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#4d6638] text-[#fff7df]">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-extrabold">Flavours of Dobrogea</h1>
          <p className="mt-2 text-sm text-[#b8c7a4]">Panou administrator — aprobă înregistrările din platformă</p>
        </div>

        <Card className="border-[#3d4d31] bg-[#2a3422] text-[#f4f7ee] shadow-xl">
          <CardHeader>
            <CardTitle>Autentificare admin</CardTitle>
            <CardDescription className="text-[#b8c7a4]">
              Doar echipa Flavours of Dobrogea poate accesa acest panou.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="mb-4 rounded-xl border border-[#8f4f45] bg-[#3a2a28] px-3 py-2 text-sm text-[#f0cbc4]">
                {error}
              </p>
            ) : null}
            <form onSubmit={submit} className="space-y-4">
              <FieldBlock label="Email admin">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8fa07d]" />
                  <Input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    className="border-[#4a5a3d] bg-[#1f2618] pl-11 text-[#f4f7ee] placeholder:text-[#7f9070]"
                    placeholder="admin@flavours-of-dobrogea.ro"
                  />
                </div>
              </FieldBlock>
              <FieldBlock label="Parolă">
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8fa07d]" />
                  <Input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    className="border-[#4a5a3d] bg-[#1f2618] pl-11 text-[#f4f7ee] placeholder:text-[#7f9070]"
                    placeholder="Parola admin"
                  />
                </div>
              </FieldBlock>
              <Button type="submit" variant="honey" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {loading ? "Se conectează..." : "Intră în panou"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default AdminLoginPage;
