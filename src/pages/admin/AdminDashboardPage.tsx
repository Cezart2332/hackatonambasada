import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Building2,
  Check,
  Leaf,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldOff,
  Store,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import { api, type AdminRegistration } from "@/lib/api";
import { formatAvailableFromDisplay } from "@/lib/availableFrom";
import { messageFromUnknownError } from "@/lib/errors";
import type { ApprovalStatus } from "@/lib/types";

type AdminSection = "registrations" | "active";
type ActiveFilter = "all" | "producer" | "venue";

const venueTypeLabels: Record<string, string> = {
  restaurant: "Restaurant",
  hotel: "Hotel",
  cafe: "Cafenea",
  shop: "Magazin",
  deli: "Delicatese",
};

function statusBadge(status: ApprovalStatus) {
  if (status === "approved") return <Badge variant="olive">Aprobat</Badge>;
  if (status === "rejected") return <Badge className="border-[#e8b4a8] bg-[#fdf0ec] text-[#884636]">Respins</Badge>;
  return <Badge variant="warm">În așteptare</Badge>;
}

function AccountDetails({ registration }: { registration: AdminRegistration }) {
  const isProducer = registration.accountType === "producer";
  const phoneHref = registration.phone ? `tel:${registration.phone.replace(/\s/g, "")}` : undefined;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2 text-[#526047]">
          <Mail className="h-4 w-4 shrink-0 text-[#4d6638]" />
          <a href={`mailto:${registration.email}`} className="font-medium text-[#263421] hover:underline">
            {registration.email}
          </a>
        </div>
        <div className="flex items-center gap-2 text-[#526047]">
          <Phone className="h-4 w-4 shrink-0 text-[#4d6638]" />
          {phoneHref ? (
            <a href={phoneHref} className="font-semibold text-[#263421] hover:underline">
              {registration.phone}
            </a>
          ) : (
            <span className="text-muted-foreground">Fără telefon</span>
          )}
        </div>
        <div className="flex items-start gap-2 text-[#526047] sm:col-span-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#4d6638]" />
          <span>
            {registration.location || "Localitate nespecificată"}
            {registration.locationChoice ? ` (${registration.locationChoice})` : ""}
          </span>
        </div>
      </div>

      {isProducer && registration.producer ? (
        <div className="rounded-2xl border border-[#ded5bf] bg-[#fbf7ed] p-4">
          <p className="mb-2 flex items-center gap-2 font-bold text-[#263421]">
            <Building2 className="h-4 w-4" />
            Detalii producător
          </p>
          <p className="text-[#526047]">
            Livrare până la {Math.round(registration.producer.rangeKm)} km · zile:{" "}
            {registration.producer.deliveryDays || "nespecificate"}
          </p>
            {registration.producer.extraDetails ? (
              <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-[#526047]">
                <span className="font-semibold text-[#263421]">Detalii suplimentare:</span>{" "}
                {registration.producer.extraDetails}
              </p>
            ) : null}
            <div className="mt-3 space-y-2">
              {registration.producer.products.map((product, index) => (
              <div key={`${product.name}-${index}`} className="rounded-xl bg-white/70 px-3 py-2">
                <p className="font-semibold text-[#263421]">{product.name}</p>
                <p className="text-[#62705a]">
                  {product.estimatedQuantity} {product.unit}
                  {product.pricePerKg ? ` · ${product.pricePerKg} lei/kg` : ""}
                  {product.availableFrom
                    ? ` · disponibil: ${formatAvailableFromDisplay(product.availableFrom)}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!isProducer && registration.venue ? (
        <div className="rounded-2xl border border-[#ded5bf] bg-[#fbf7ed] p-4">
          <p className="mb-2 flex items-center gap-2 font-bold text-[#263421]">
            <Store className="h-4 w-4" />
            Detalii local
          </p>
          <p className="text-[#526047]">
            Tip: {venueTypeLabels[registration.venue.venueType] || registration.venue.venueType}
          </p>
          <p className="mt-2 text-[#526047]">
            <span className="font-semibold text-[#263421]">Caută:</span>{" "}
            {registration.venue.productsNeeded || "—"}
          </p>
          <p className="mt-2 text-[#526047]">
            Frecvență: {registration.venue.supplyFrequency || "—"} · livrare preferată:{" "}
            {registration.venue.preferredDays || "—"}
          </p>
        </div>
      ) : null}
    </>
  );
}

function RegistrationCard({
  registration,
  onReview,
  busy,
}: {
  registration: AdminRegistration;
  onReview: (userId: string, status: "approved" | "rejected") => Promise<void>;
  busy: string | null;
}) {
  const isProducer = registration.accountType === "producer";

  return (
    <Card className="border-[#d7ccb3] bg-[#fffdf7] shadow-sm">
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {isProducer ? (
                <Badge variant="olive">
                  <Leaf className="mr-1 h-3 w-3" />
                  Producător
                </Badge>
              ) : (
                <Badge variant="blue">
                  <Store className="mr-1 h-3 w-3" />
                  Local
                </Badge>
              )}
              {statusBadge(registration.approvalStatus)}
            </div>
            <CardTitle className="text-xl text-[#263421]">
              {registration.businessName || registration.contactName}
            </CardTitle>
            <CardDescription>
              {registration.contactName} · înregistrat{" "}
              {new Date(registration.registeredAt).toLocaleString("ro-RO")}
            </CardDescription>
          </div>
          {registration.approvalStatus === "pending" ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="honey"
                disabled={busy === registration.userId}
                onClick={() => void onReview(registration.userId, "approved")}
              >
                {busy === registration.userId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Aprobă
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy === registration.userId}
                onClick={() => void onReview(registration.userId, "rejected")}
              >
                <X className="h-4 w-4" />
                Respinge
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <AccountDetails registration={registration} />
      </CardContent>
    </Card>
  );
}

function ActiveAccountCard({
  registration,
  onSuspend,
  busy,
}: {
  registration: AdminRegistration;
  onSuspend: (userId: string) => Promise<void>;
  busy: string | null;
}) {
  const isProducer = registration.accountType === "producer";

  return (
    <Card className="border-[#c8d9aa] bg-[#fffdf7] shadow-sm">
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {isProducer ? (
                <Badge variant="olive">
                  <Leaf className="mr-1 h-3 w-3" />
                  Producător activ
                </Badge>
              ) : (
                <Badge variant="blue">
                  <Store className="mr-1 h-3 w-3" />
                  Local activ
                </Badge>
              )}
              <Badge className="border-[#bcd5b6] bg-[#dbefd7] text-[#2f643b]">Live în platformă</Badge>
            </div>
            <CardTitle className="text-xl text-[#263421]">
              {registration.businessName || registration.contactName}
            </CardTitle>
            <CardDescription>
              {registration.contactName} · actualizat{" "}
              {new Date(registration.updatedAt).toLocaleString("ro-RO")}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={busy === registration.userId}
            className="border-[#e8b4a8] text-[#884636] hover:bg-[#fdf0ec]"
            onClick={() => void onSuspend(registration.userId)}
          >
            {busy === registration.userId ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldOff className="h-4 w-4" />
            )}
            Suspendă acces
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <AccountDetails registration={registration} />
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <Card className="border-[#d7ccb3] bg-[#fffdf7]">
      <CardContent className="flex items-center gap-4 p-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e9f0dc] text-[#4d6638]">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-2xl font-extrabold text-[#263421]">{value}</p>
          <p className="text-sm text-[#62705a]">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminDashboardPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [section, setSection] = useState<AdminSection>("registrations");
  const [registrations, setRegistrations] = useState<AdminRegistration[]>([]);
  const [activeAccounts, setActiveAccounts] = useState<AdminRegistration[]>([]);
  const [filter, setFilter] = useState<ApprovalStatus | "all">("pending");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [activeSearch, setActiveSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeLoading, setActiveLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadRegistrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { registrations: rows } = await api.listAdminRegistrations(
        filter === "all" ? undefined : filter,
      );
      setRegistrations(rows);
    } catch (caught) {
      setError(messageFromUnknownError(caught, "Nu am putut încărca înregistrările."));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadActiveAccounts = useCallback(async () => {
    setActiveLoading(true);
    setError(null);
    try {
      const { accounts } = await api.listAdminActiveAccounts(activeFilter);
      setActiveAccounts(accounts);
    } catch (caught) {
      setError(messageFromUnknownError(caught, "Nu am putut încărca conturile active."));
    } finally {
      setActiveLoading(false);
    }
  }, [activeFilter]);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadRegistrations(), loadActiveAccounts()]);
  }, [loadRegistrations, loadActiveAccounts]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const { data } = await authClient.getSession();
        if (!data?.user || cancelled) {
          setAuthorized(false);
          return;
        }
        const { accountType } = await api.getAccount();
        if (accountType !== "admin") {
          setAuthorized(false);
          return;
        }
        setAuthorized(true);
        await reloadAll();
      } catch {
        if (!cancelled) setAuthorized(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [reloadAll]);

  useEffect(() => {
    if (authorized) {
      void loadRegistrations();
    }
  }, [authorized, filter, loadRegistrations]);

  useEffect(() => {
    if (authorized) {
      void loadActiveAccounts();
    }
  }, [authorized, activeFilter, loadActiveAccounts]);

  const pendingCount = useMemo(
    () => registrations.filter((item) => item.approvalStatus === "pending").length,
    [registrations],
  );

  const activeStats = useMemo(() => {
    const producers = activeAccounts.filter((item) => item.accountType === "producer").length;
    const venues = activeAccounts.filter((item) => item.accountType === "venue").length;
    return { producers, venues, total: activeAccounts.length };
  }, [activeAccounts]);

  const filteredActiveAccounts = useMemo(() => {
    const query = activeSearch.trim().toLowerCase();
    if (!query) return activeAccounts;

    return activeAccounts.filter((account) => {
      const haystack = [
        account.businessName,
        account.contactName,
        account.email,
        account.phone,
        account.location,
        account.producer?.products.map((product) => product.name).join(" "),
        account.venue?.productsNeeded,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [activeAccounts, activeSearch]);

  async function review(userId: string, status: "approved" | "rejected") {
    setBusyId(userId);
    setError(null);
    try {
      await api.reviewRegistration(userId, status);
      await reloadAll();
    } catch (caught) {
      setError(messageFromUnknownError(caught, "Nu am putut actualiza înregistrarea."));
    } finally {
      setBusyId(null);
    }
  }

  async function suspendAccount(userId: string) {
    setBusyId(userId);
    setError(null);
    try {
      await api.updateAdminActiveAccount(userId, "rejected");
      await reloadAll();
    } catch (caught) {
      setError(messageFromUnknownError(caught, "Nu am putut suspenda contul."));
    } finally {
      setBusyId(null);
    }
  }

  async function logout() {
    await authClient.signOut();
    setAuthorized(false);
  }

  if (authorized === null) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#1f2618]">
        <Loader2 className="h-8 w-8 animate-spin text-[#d8e7b8]" />
      </main>
    );
  }

  if (!authorized) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <main className="min-h-[100dvh] bg-[#eef2e7] text-foreground">
      <header className="border-b border-[#d7ccb3] bg-[#fffdf7]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#4d6638]">
              Flavours of Dobrogea
            </p>
            <h1 className="text-2xl font-extrabold text-[#263421]">Panou administrator</h1>
            <p className="text-sm text-[#62705a]">
              Verifică înregistrările noi și gestionează producătorii și localurile active în platformă.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => void reloadAll()}
              disabled={loading || activeLoading}
            >
              <RefreshCw className={`h-4 w-4 ${loading || activeLoading ? "animate-spin" : ""}`} />
              Reîncarcă
            </Button>
            <Button variant="outline" onClick={() => void logout()}>
              <LogOut className="h-4 w-4" />
              Ieși
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {error ? (
          <p className="mb-4 rounded-xl border border-[#e8b4a8] bg-[#fdf0ec] px-3 py-2 text-sm font-medium text-[#884636]">
            {error}
          </p>
        ) : null}

        <Tabs value={section} onValueChange={(value) => setSection(value as AdminSection)}>
          <TabsList className="mb-6 grid w-full max-w-xl grid-cols-2">
            <TabsTrigger value="registrations">Înregistrări noi</TabsTrigger>
            <TabsTrigger value="active">Conturi active</TabsTrigger>
          </TabsList>

          <TabsContent value="registrations" className="space-y-4">
            <Tabs value={filter} onValueChange={(value) => setFilter(value as ApprovalStatus | "all")}>
              <TabsList className="mb-5 grid w-full max-w-2xl grid-cols-4">
                <TabsTrigger value="pending">În așteptare</TabsTrigger>
                <TabsTrigger value="approved">Aprobate</TabsTrigger>
                <TabsTrigger value="rejected">Respinse</TabsTrigger>
                <TabsTrigger value="all">Toate</TabsTrigger>
              </TabsList>

              {(["pending", "approved", "rejected", "all"] as const).map((tab) => (
                <TabsContent key={tab} value={tab} className="space-y-4">
                  {loading ? (
                    <div className="flex justify-center py-16">
                      <Loader2 className="h-8 w-8 animate-spin text-[#526b36]" />
                    </div>
                  ) : registrations.length === 0 ? (
                    <Card className="border-dashed border-[#d7ccb3] bg-[#fffdf7]">
                      <CardContent className="py-12 text-center text-[#62705a]">
                        {tab === "pending"
                          ? "Nu există înregistrări în așteptare."
                          : "Nu există înregistrări în această categorie."}
                      </CardContent>
                    </Card>
                  ) : (
                    registrations.map((registration) => (
                      <RegistrationCard
                        key={registration.userId}
                        registration={registration}
                        onReview={review}
                        busy={busyId}
                      />
                    ))
                  )}
                </TabsContent>
              ))}
            </Tabs>

            {filter === "pending" && pendingCount > 0 ? (
              <p className="mt-2 text-center text-sm text-[#62705a]">
                {pendingCount} înregistrări așteaptă verificarea ta.
              </p>
            ) : null}
          </TabsContent>

          <TabsContent value="active" className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Conturi active" value={activeStats.total} icon={Users} />
              <StatCard label="Producători activi" value={activeStats.producers} icon={Leaf} />
              <StatCard label="Localuri active" value={activeStats.venues} icon={Store} />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Tabs
                value={activeFilter}
                onValueChange={(value) => setActiveFilter(value as ActiveFilter)}
              >
                <TabsList className="grid w-full grid-cols-3 sm:w-auto">
                  <TabsTrigger value="all">Toate</TabsTrigger>
                  <TabsTrigger value="producer">Producători</TabsTrigger>
                  <TabsTrigger value="venue">Localuri</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={activeSearch}
                  onChange={(event) => setActiveSearch(event.target.value)}
                  placeholder="Caută după nume, email, locație..."
                  className="pl-10"
                />
              </div>
            </div>

            {activeLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-[#526b36]" />
              </div>
            ) : filteredActiveAccounts.length === 0 ? (
              <Card className="border-dashed border-[#d7ccb3] bg-[#fffdf7]">
                <CardContent className="py-12 text-center text-[#62705a]">
                  {activeSearch.trim()
                    ? "Niciun cont activ nu corespunde căutării."
                    : "Nu există conturi active în această categorie."}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredActiveAccounts.map((registration) => (
                  <ActiveAccountCard
                    key={registration.userId}
                    registration={registration}
                    onSuspend={suspendAccount}
                    busy={busyId}
                  />
                ))}
              </div>
            )}

            <p className="text-center text-sm text-[#62705a]">
              Suspendarea unui cont îl mută în „Respinse” și îi blochează accesul în platformă.
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

export default AdminDashboardPage;
