import React, { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Mail,
  LockKeyhole,
  Loader2,
  KeyRound,
  UserRound,
  Home,
  Phone,
  Plus,
  Leaf,
  Store,
  ShoppingBasket,
  CalendarDays,
  MessageCircle,
  ScrollText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normalizeAvailableFrom } from "@/lib/availableFrom";
import { parseRangeKm } from "@/lib/api";
import { messageFromUnknownError } from "@/lib/errors";
import { AgentAvatar } from "@/components/AgentAvatar";
import { LocationSearch } from "@/components/LocationSearch";
import { ProductEditorCard, createProduct, patchProducerProduct } from "@/components/ProductEditor";
import { SectionLabel, FieldBlock, QuickChoiceRow, RangeKmInput } from "@/components/FormBlocks";
import type {
  AccountType,
  ProducerSetup,
  VenueSetup,
  VenueType,
  LocationChoice,
  ProducerProduct,
} from "@/lib/types";

const registerTypeOptions = [
  { value: "producer" as const, icon: Leaf, label: "Producător" },
  { value: "venue" as const, icon: Store, label: "Local / Restaurant" },
] as const;

const venueTypeOptions: Array<{ value: VenueType; label: string }> = [
  { value: "restaurant", label: "Restaurant" },
  { value: "hotel", label: "Hotel" },
  { value: "cafe", label: "Cafenea" },
  { value: "shop", label: "Magazin" },
  { value: "deli", label: "Delicatese" },
];

const selectClassName =
  "flex h-11 w-full rounded-full border border-input bg-card px-4 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10;
}

function ProducerWhatsAppNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-2xl border border-[#d7ccb3] bg-[#fbf7ed] px-4 py-3",
        compact ? "text-xs" : "text-sm",
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e9f0dc] text-[#4d6638]">
        <MessageCircle className="h-4 w-4" />
      </span>
      <p className="leading-relaxed text-[#526047]">
        <span className="font-bold text-[#263421]">Producători:</span> după ce trimiți formularul de
        înregistrare, echipa{" "}
        <span className="font-semibold text-[#263421]">Flavours of Dobrogea</span> te va contacta pe{" "}
        <span className="font-semibold text-[#263421]">numărul de WhatsApp declarat</span> pentru a revizui și
        confirma datele înainte de accesul complet în platformă.
      </p>
    </div>
  );
}

export function AuthScreen({
  onLogin,
  onRegister,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (
    email: string,
    password: string,
    accountType: AccountType,
    setup: ProducerSetup | VenueSetup,
  ) => Promise<void>;
}) {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [registerAccountType, setRegisterAccountType] = useState<AccountType>("producer");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerSetup, setRegisterSetup] = useState<ProducerSetup>({
    producerName: "",
    businessName: "",
    phone: "",
    products: [createProduct()],
    location: "",
    range: "35 km",
    days: "",
    extraDetails: "",
  });
  const [venueSetup, setVenueSetup] = useState<VenueSetup>({
    contactName: "",
    businessName: "",
    venueType: "restaurant",
    phone: "",
    location: "",
  });
  const [producerRegisterStep, setProducerRegisterStep] = useState<1 | 2>(1);

  function resetProducerRegisterStep() {
    setProducerRegisterStep(1);
  }

  function validateProducerRegisterStep1(): string | null {
    if (registerName.trim().length < 2) return "Introdu numele tău (minim 2 caractere).";
    const email = registerEmail.trim();
    if (!email) return "Introdu un email valid.";
    if (!isValidEmail(email)) return "Adresa de email nu pare validă.";
    if (registerPassword.length < 8) return "Parola trebuie să aibă cel puțin 8 caractere.";
    if (registerSetup.businessName.trim().length < 2) {
      return "Introdu numele fermei sau gospodăriei (minim 2 caractere).";
    }
    if (!isValidPhone(registerSetup.phone)) {
      return "Introdu un număr de WhatsApp valid (minim 10 cifre).";
    }
    return null;
  }

  function validateProducerRegisterStep2(): string | null {
    const namedProducts = registerSetup.products.filter((product) => product.name.trim().length >= 2);
    if (!namedProducts.length) return "Adaugă cel puțin un produs cu nume (minim 2 caractere).";
    if (!registerSetup.location.trim()) return "Alege localitatea din listă.";
    if (!registerSetup.locationChoice?.lat || !registerSetup.locationChoice?.lon) {
      return "Selectează localitatea din sugestiile de căutare (nu doar text liber).";
    }
    if (parseRangeKm(registerSetup.range) <= 0) return "Aria de livrare trebuie să fie mai mare decât 0 km.";
    return null;
  }

  function continueProducerRegister() {
    const error = validateProducerRegisterStep1();
    if (error) {
      setAuthError(error);
      return;
    }
    setAuthError(null);
    setProducerRegisterStep(2);
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      await onLogin(loginEmail.trim(), loginPassword);
    } catch (error) {
      setAuthError(messageFromUnknownError(error, "Autentificare eșuată. Verifică emailul și parola."));
    } finally {
      setAuthLoading(false);
    }
  }

  const updateRegisterSetup = (key: keyof ProducerSetup, value: string) => {
    setRegisterSetup((current) => ({ ...current, [key]: value }));
  };

  const updateRegisterLocation = (value: string, locationChoice?: LocationChoice) => {
    setRegisterSetup((current) => ({ ...current, location: value, locationChoice }));
  };

  const updateRegisterProduct = (productId: string, key: keyof ProducerProduct, value: string) => {
    setRegisterSetup((current) => ({
      ...current,
      products: current.products.map((product) =>
        product.id === productId ? { ...product, [key]: value } : product,
      ),
    }));
  };

  const patchRegisterProduct = (productId: string, patch: Partial<ProducerProduct>) => {
    setRegisterSetup((current) => ({
      ...current,
      products: current.products.map((product) =>
        product.id === productId ? patchProducerProduct(product, patch) : product,
      ),
    }));
  };

  const addRegisterProduct = () => {
    setRegisterSetup((current) => ({
      ...current,
      products: [...current.products, createProduct()],
    }));
  };

  const removeRegisterProduct = (productId: string) => {
    setRegisterSetup((current) => ({
      ...current,
      products:
        current.products.length > 1
          ? current.products.filter((product) => product.id !== productId)
          : current.products,
    }));
  };

  const updateVenueSetup = (key: keyof VenueSetup, value: string) => {
    setVenueSetup((current) => ({ ...current, [key]: value }));
  };

  const updateVenueLocation = (value: string, locationChoice?: LocationChoice) => {
    setVenueSetup((current) => ({ ...current, location: value, locationChoice }));
  };

  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);

    if (isProducerRegister && producerRegisterStep === 1) {
      continueProducerRegister();
      return;
    }

    setAuthLoading(true);

    const email = registerEmail.trim();
    if (!email) {
      setAuthError("Introdu un email valid.");
      setAuthLoading(false);
      return;
    }

    try {
      if (registerAccountType === "producer") {
        const step1Error = validateProducerRegisterStep1();
        if (step1Error) {
          setAuthError(step1Error);
          setProducerRegisterStep(1);
          setAuthLoading(false);
          return;
        }
        const step2Error = validateProducerRegisterStep2();
        if (step2Error) {
          setAuthError(step2Error);
          setAuthLoading(false);
          return;
        }

        const cleanProducts = registerSetup.products
          .filter((product) => product.name.trim().length >= 2)
          .map((product) =>
          patchProducerProduct(
            {
              ...product,
              name: product.name.trim(),
              estimatedQuantity: product.estimatedQuantity.trim(),
              pricePerKg: product.pricePerKg.trim(),
              availableFrom: normalizeAvailableFrom(product.availableFrom, registerSetup.days),
            },
            {},
          ),
          );

        const setup: ProducerSetup = {
          ...registerSetup,
          producerName: registerSetup.producerName.trim() || registerName.trim(),
          businessName: registerSetup.businessName.trim(),
          products: cleanProducts,
          location: registerSetup.location.trim(),
          range: registerSetup.range.trim() || "35 km",
          days: registerSetup.days.trim(),
          extraDetails: registerSetup.extraDetails?.trim() || "",
        };

        await onRegister(email, registerPassword, "producer", setup);
      } else {
        const setup: VenueSetup = {
          ...venueSetup,
          contactName: venueSetup.contactName.trim() || registerName.trim(),
          businessName: venueSetup.businessName.trim(),
          phone: venueSetup.phone.trim(),
          location: venueSetup.location.trim(),
        };

        await onRegister(email, registerPassword, "venue", setup);
      }
    } catch (error) {
      setAuthError(messageFromUnknownError(error, "Nu am putut crea contul. Verifică datele și încearcă din nou."));
    } finally {
      setAuthLoading(false);
    }
  }

  const isProducerRegister = registerAccountType === "producer";

  const heroSubtitle =
    authMode === "login"
      ? "Producători și localuri HoReCa din Dobrogea — potriviri clare, contact direct, fără marketplace complicat."
      : isProducerRegister
        ? "Îți completezi profilul o dată → Asistentul îți găsește localuri potrivite în Dobrogea → contact direct și mesaje, fără marketplace complicat."
        : "Spui ce cauți în Asistent → te legăm de producători verificați din Dobrogea → contact direct și mesaje în platformă, fără marketplace complicat.";

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#eef2e7] p-4 text-foreground">
      <div className="w-full max-w-5xl">
        <div className="mx-auto mb-5 flex max-w-xl flex-col items-center text-center">
          <AgentAvatar />
          <p className="mt-3 text-3xl font-extrabold text-[#263421]">Warm Leads</p>
          <p className="mt-2 text-sm leading-relaxed text-[#62705a]">{heroSubtitle}</p>
        </div>

        <div className="flex justify-center">
          <div
            className={cn(
              "auth-card-shell w-full",
              authMode === "login" ? "auth-card-shell--compact" : "auth-card-shell--expanded",
            )}
          >
            <Card className="w-full overflow-hidden border-[#d7ccb3] bg-[#fffdf7] shadow-warm">
            <CardHeader className="pb-3">
              <div key={authMode} className="auth-card-header-enter space-y-1">
                <CardTitle>{authMode === "login" ? "Intră în cont" : "Creează cont nou"}</CardTitle>
                <CardDescription>
                  {authMode === "login"
                    ? "Bine ai revenit — continuă cu recomandările și mesajele tale."
                    : isProducerRegister
                      ? "Înregistrare pentru fermieri și producători locali."
                      : "Pentru restaurante și hoteluri — nevoile le declari în Asistent după înregistrare."}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {authError ? (
                <p className="mb-4 rounded-xl border border-[#e8b4a8] bg-[#fdf0ec] px-3 py-2 text-sm font-medium text-[#884636]">
                  {authError}
                </p>
              ) : null}
              <Tabs
                value={authMode}
                onValueChange={(value) => {
                  setAuthMode(value as "login" | "register");
                  resetProducerRegisterStep();
                  setAuthError(null);
                }}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>

                <TabsContent
                  value="login"
                  className="data-[state=active]:auth-panel-enter data-[state=inactive]:hidden"
                >
                  <form onSubmit={submitLogin} className="space-y-4">
                    <div className="rounded-2xl border border-[#ded5bf] bg-[#f3f7ea] px-4 py-3">
                      <p className="text-sm leading-relaxed text-[#526047]">
                        <span className="font-bold text-[#263421]">Producător sau HoReCa?</span> Nu contează
                        aici — introdu emailul și parola contului tău, indiferent cum te-ai înregistrat.
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <Badge variant="olive" className="gap-1">
                          <Leaf className="h-3 w-3" />
                          Producător
                        </Badge>
                        <Badge variant="blue" className="gap-1">
                          <Store className="h-3 w-3" />
                          HoReCa
                        </Badge>
                      </div>
                    </div>
                    <FieldBlock label="Email">
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={loginEmail}
                          onChange={(event) => setLoginEmail(event.target.value)}
                          type="email"
                          className="pl-11"
                          placeholder="nume@ferma.ro sau local@restaurant.ro"
                        />
                      </div>
                    </FieldBlock>
                    <FieldBlock label="Parolă">
                      <div className="relative">
                        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={loginPassword}
                          onChange={(event) => setLoginPassword(event.target.value)}
                          type="password"
                          className="pl-11"
                          placeholder="Parola ta"
                        />
                      </div>
                    </FieldBlock>
                    <Button type="submit" variant="honey" className="w-full" disabled={authLoading}>
                      {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                      {authLoading ? "Se conectează..." : "Intră în cont"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={authLoading}
                      onClick={async () => {
                        setAuthLoading(true);
                        setAuthError(null);
                        const email = "ana@stupina-dobrogea.ro";
                        const password = "demo1234";
                        setLoginEmail(email);
                        setLoginPassword(password);
                        try {
                          await onLogin(email, password);
                        } catch {
                          try {
                            await onRegister(email, password, "producer", {
                              producerName: "Ana Popescu",
                              businessName: "Stupina Dobrogea",
                              phone: "",
                              products: [
                                createProduct({
                                  category: "miere_gemuri",
                                  name: "Miere de salcâm",
                                  estimatedQuantity: "40",
                                  packaging: "borcan_400",
                                  baseUnit: "piece",
                                  pricePerKg: "34",
                                }),
                              ],
                              location: "Murfatlar",
                              locationChoice: {
                                label: "Murfatlar, Constanța, România",
                                lat: "44.1833",
                                lon: "28.4167",
                              },
                              range: "35 km",
                              days: "Marți și vineri dimineața",
                            });
                          } catch (error) {
                            setAuthError(
                              messageFromUnknownError(error, "Contul demo nu este disponibil momentan."),
                            );
                          }
                        } finally {
                          setAuthLoading(false);
                        }
                      }}
                    >
                      Folosește cont demo producător
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={authLoading}
                      onClick={async () => {
                        setAuthLoading(true);
                        setAuthError(null);
                        const email = "casa@dobrogea-demo.ro";
                        const password = "demo1234";
                        setLoginEmail(email);
                        setLoginPassword(password);
                        try {
                          await onLogin(email, password);
                        } catch {
                          try {
                            await onRegister(email, password, "venue", {
                              contactName: "Alexandru Radu",
                              businessName: "Casa Dobrogeană",
                              venueType: "restaurant",
                              phone: "+40 722 334 455",
                              location: "Constanța, zona Peninsulă",
                              locationChoice: {
                                label: "Constanța, Constanța, România",
                                lat: "44.1787",
                                lon: "28.6538",
                              },
                            });
                          } catch (error) {
                            setAuthError(
                              messageFromUnknownError(error, "Contul demo HoReCa nu este disponibil momentan."),
                            );
                          }
                        } finally {
                          setAuthLoading(false);
                        }
                      }}
                    >
                      Folosește cont demo HoReCa
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent
                  value="register"
                  className="data-[state=active]:auth-panel-enter data-[state=inactive]:hidden"
                >
                  <div className="mb-5 space-y-2">
                    <p className="text-sm font-bold text-[#33412c]">Te înregistrezi ca:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {registerTypeOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setRegisterAccountType(option.value);
                            resetProducerRegisterStep();
                            setAuthError(null);
                          }}
                          className={cn(
                            "flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition-colors",
                            registerAccountType === option.value
                              ? "border-[#4d6638] bg-[#4d6638] text-white shadow-sm"
                              : "border-[#ded5bf] bg-white text-[#526047] hover:border-[#c8bb9d]",
                          )}
                        >
                          <option.icon className="h-4 w-4" />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {isProducerRegister ? (
                    <Badge variant="olive" className="mb-4">
                      Pasul {producerRegisterStep} din 2
                    </Badge>
                  ) : null}
                  <form onSubmit={submitRegister} className="space-y-6">
                    {isProducerRegister && producerRegisterStep === 2 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="-ml-2 mb-2"
                        onClick={() => {
                          setProducerRegisterStep(1);
                          setAuthError(null);
                        }}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Înapoi
                      </Button>
                    ) : null}

                    {(isProducerRegister && producerRegisterStep === 1) || !isProducerRegister ? (
                      <section className="space-y-4">
                        <SectionLabel eyebrow="1" title="Date de autentificare" />
                        <div className="grid gap-4 md:grid-cols-3">
                          <FieldBlock label="Numele tău">
                            <div className="relative">
                              <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                value={registerName}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setRegisterName(value);
                                  if (isProducerRegister) {
                                    setRegisterSetup((current) => ({ ...current, producerName: value }));
                                  } else {
                                    setVenueSetup((current) => ({ ...current, contactName: value }));
                                  }
                                }}
                                className="pl-11"
                                placeholder={isProducerRegister ? "Ex: Ana Popescu" : "Ex: Mihai Ionescu"}
                              />
                            </div>
                          </FieldBlock>
                          <FieldBlock label="Email">
                            <div className="relative">
                              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                value={registerEmail}
                                onChange={(event) => setRegisterEmail(event.target.value)}
                                type="email"
                                className="pl-11"
                                placeholder={isProducerRegister ? "nume@ferma.ro" : "contact@restaurant.ro"}
                              />
                            </div>
                          </FieldBlock>
                          <FieldBlock label="Parolă">
                            <div className="relative">
                              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                value={registerPassword}
                                onChange={(event) => setRegisterPassword(event.target.value)}
                                type="password"
                                className="pl-11"
                                placeholder="Alege o parolă"
                              />
                            </div>
                          </FieldBlock>
                        </div>
                      </section>
                    ) : null}

                    {isProducerRegister && producerRegisterStep === 1 ? (
                      <section className="space-y-4">
                        <SectionLabel eyebrow="2" title="Producător" />
                        <div className="grid gap-4 md:grid-cols-2">
                          <FieldBlock label="Numele fermei sau gospodăriei">
                            <div className="relative">
                              <Home className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                value={registerSetup.businessName}
                                onChange={(event) => updateRegisterSetup("businessName", event.target.value)}
                                className="pl-11"
                                placeholder="Ex: Stupina de la Murfatlar"
                              />
                            </div>
                          </FieldBlock>
                          <FieldBlock label="Telefon WhatsApp">
                            <div className="relative">
                              <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                value={registerSetup.phone}
                                onChange={(event) => updateRegisterSetup("phone", event.target.value)}
                                className="pl-11"
                                placeholder="Ex: 07xx xxx xxx"
                              />
                            </div>
                          </FieldBlock>
                        </div>
                      </section>
                    ) : null}

                    {isProducerRegister && producerRegisterStep === 2 ? (
                      <>
                        <section className="space-y-3">
                          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                            <SectionLabel eyebrow="1" title="Ce vinzi" />
                            <Button type="button" variant="outline" size="sm" onClick={addRegisterProduct}>
                              <Plus className="h-4 w-4" />
                              Adaugă produs
                            </Button>
                          </div>
                          <div className="space-y-5">
                            {registerSetup.products.map((product, index) => (
                              <ProductEditorCard
                                key={product.id}
                                product={product}
                                index={index}
                                canRemove={registerSetup.products.length > 1}
                                onUpdate={updateRegisterProduct}
                                onPatch={patchRegisterProduct}
                                onRemove={removeRegisterProduct}
                              />
                            ))}
                          </div>
                        </section>

                        <section className="space-y-4">
                          <SectionLabel eyebrow="2" title="Livrare" />
                          <div className="grid gap-4 md:grid-cols-2">
                            <FieldBlock label="Localitate">
                              <LocationSearch
                                value={registerSetup.location}
                                selectedLocation={registerSetup.locationChoice}
                                onChange={updateRegisterLocation}
                              />
                            </FieldBlock>
                            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
                              <FieldBlock label="Aria maximă de livrare">
                                <RangeKmInput
                                  value={registerSetup.range}
                                  onChange={(value) => updateRegisterSetup("range", value)}
                                />
                                <QuickChoiceRow
                                  choices={["20 km", "35 km", "60 km"]}
                                  onChoose={(choice) => updateRegisterSetup("range", choice)}
                                />
                              </FieldBlock>
                              <FieldBlock label="Zile bune de livrare">
                                <Input
                                  value={registerSetup.days}
                                  onChange={(event) => updateRegisterSetup("days", event.target.value)}
                                  placeholder="Ex: vineri dimineața"
                                />
                              </FieldBlock>
                            </div>
                          </div>
                        </section>

                        <section className="space-y-4">
                          <SectionLabel eyebrow="3" title="Detalii suplimentare" />
                          <FieldBlock label="Povestea ta, produsul și cum este produs (opțional)">
                            <div className="relative">
                              <ScrollText className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-muted-foreground" />
                              <textarea
                                value={registerSetup.extraDetails || ""}
                                onChange={(event) => updateRegisterSetup("extraDetails", event.target.value)}
                                className={cn(selectClassName, "min-h-[112px] resize-y rounded-3xl py-3 pl-11")}
                                placeholder="Ex: miere crudă din stupi proprii, fără adaosuri; procesare artizanală; certificare bio; produse chimice utilizate în producție..."
                              />
                            </div>
                          </FieldBlock>
                        </section>
                      </>
                    ) : !isProducerRegister ? (
                      <>
                        <section className="space-y-4">
                          <SectionLabel eyebrow="2" title="Localul tău" />
                          <div className="grid gap-4 md:grid-cols-2">
                            <FieldBlock label="Numele localului">
                              <div className="relative">
                                <Store className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                  value={venueSetup.businessName}
                                  onChange={(event) => updateVenueSetup("businessName", event.target.value)}
                                  className="pl-11"
                                  placeholder="Ex: Casa Dobrogeană"
                                />
                              </div>
                            </FieldBlock>
                            <FieldBlock label="Tip de local">
                              <select
                                value={venueSetup.venueType}
                                onChange={(event) => updateVenueSetup("venueType", event.target.value)}
                                className={selectClassName}
                              >
                                {venueTypeOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </FieldBlock>
                            <FieldBlock label="Telefon WhatsApp">
                              <div className="relative">
                                <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                  value={venueSetup.phone}
                                  onChange={(event) => updateVenueSetup("phone", event.target.value)}
                                  className="pl-11"
                                  placeholder="Ex: 07xx xxx xxx"
                                />
                              </div>
                            </FieldBlock>
                            <FieldBlock label="Localitate">
                              <LocationSearch
                                value={venueSetup.location}
                                selectedLocation={venueSetup.locationChoice}
                                onChange={updateVenueLocation}
                              />
                            </FieldBlock>
                          </div>
                        </section>

                        <p className="rounded-2xl border border-[#c8d9aa] bg-[#f0f5e8] px-4 py-3 text-sm text-[#405235]">
                          După înregistrare, spui în Asistent ce produse cauți — acolo actualizezi nevoile și vezi producătorii potriviți.
                        </p>
                      </>
                    ) : null}

                    {isProducerRegister && producerRegisterStep === 2 ? <ProducerWhatsAppNotice compact /> : null}

                    {isProducerRegister && producerRegisterStep === 1 ? (
                      <Button type="button" variant="honey" className="w-full" onClick={continueProducerRegister}>
                        Continuă
                      </Button>
                    ) : (
                      <Button type="submit" variant="honey" className="w-full" disabled={authLoading}>
                        {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {authLoading
                          ? "Se creează contul..."
                          : isProducerRegister
                            ? "Creează cont de producător"
                            : "Creează cont de local"}
                      </Button>
                    )}
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

export default AuthScreen;
