import React, { useState, type FormEvent } from "react";
import {
  Mail,
  LockKeyhole,
  Loader2,
  KeyRound,
  UserRound,
  Home,
  Phone,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { messageFromUnknownError } from "@/lib/errors";
import { AgentAvatar } from "@/components/AgentAvatar";
import { LocationSearch } from "@/components/LocationSearch";
import { ProductEditorCard, createProduct } from "@/components/ProductEditor";
import { SectionLabel, FieldBlock, QuickChoiceRow } from "@/components/FormBlocks";
import type { ProducerSetup, LocationChoice, ProducerProduct } from "@/lib/types";

export function AuthScreen({
  onLogin,
  onRegister,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, setup: ProducerSetup) => Promise<void>;
}) {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
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
    range: "",
    days: "",
  });

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

  const addRegisterProduct = () => {
    setRegisterSetup((current) => ({
      ...current,
      products: [...current.products, createProduct({ availableFrom: current.days || "Săptămâna asta" })],
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

  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const email = registerEmail.trim();
    const cleanProducts = registerSetup.products.map((product, index) => ({
      ...product,
      name: product.name.trim(),
      estimatedQuantity: product.estimatedQuantity.trim(),
      unit: product.unit.trim(),
      pricePerKg: product.pricePerKg.trim(),
      availableFrom: product.availableFrom.trim() || registerSetup.days,
    }));

    const setup: ProducerSetup = {
      ...registerSetup,
      producerName: registerSetup.producerName.trim() || registerName.trim(),
      businessName: registerSetup.businessName.trim(),
      products: cleanProducts,
      location: registerSetup.location.trim(),
      range: registerSetup.range.trim(),
      days: registerSetup.days.trim(),
    };

    try {
      await onRegister(email, registerPassword, setup);
    } catch (error) {
      setAuthError(messageFromUnknownError(error, "Nu am putut crea contul. Verifică datele și încearcă din nou."));
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#eef2e7] p-4 text-foreground">
      <div className="w-full max-w-6xl">
        <div className="mx-auto mb-6 flex max-w-2xl flex-col items-center text-center">
          <AgentAvatar />
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-[#263421]">Warm Leads</p>
            <p className="mt-1 text-sm text-muted-foreground">Găsește cumpărători locali pentru ce produci săptămâna asta.</p>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Badge variant="warm">Dobrogea</Badge>
            <Badge variant="olive">Mesaje WhatsApp</Badge>
            <Badge variant="blue">Lead-uri locale</Badge>
          </div>
        </div>

        <div className="flex justify-center">
          <Card
            className={cn(
              "w-full border-[#d7ccb3] bg-[#fffdf7] shadow-warm transition-all",
              authMode === "register" ? "max-w-5xl" : "max-w-md",
            )}
          >
            <CardHeader>
              <CardTitle>{authMode === "register" ? "Creează contul și profilul" : "Intră în cont"}</CardTitle>
              <CardDescription>
                {authMode === "register"
                  ? "Completezi totul aici, apoi intri direct în chat."
                  : "Cont securizat cu email și parolă."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {authError ? (
                <p className="mb-4 rounded-xl border border-[#e8b4a8] bg-[#fdf0ec] px-3 py-2 text-sm font-medium text-[#884636]">
                  {authError}
                </p>
              ) : null}
              <Tabs value={authMode} onValueChange={(value) => setAuthMode(value as "login" | "register")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={submitLogin} className="space-y-4">
                    <FieldBlock label="Email">
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={loginEmail}
                          onChange={(event) => setLoginEmail(event.target.value)}
                          type="email"
                          className="pl-11"
                          placeholder="nume@ferma.ro"
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
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={submitRegister} className="space-y-6">
                    <section className="space-y-4">
                      <SectionLabel eyebrow="1" title="Cont" />
                      <div className="grid gap-4 md:grid-cols-3">
                        <FieldBlock label="Numele tău">
                          <div className="relative">
                            <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={registerName}
                              onChange={(event) => {
                                setRegisterName(event.target.value);
                                setRegisterSetup((current) => ({ ...current, producerName: event.target.value }));
                              }}
                              className="pl-11"
                              placeholder="Ex: Ana Popescu"
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
                              placeholder="nume@ferma.ro"
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

                    <section className="space-y-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                        <SectionLabel eyebrow="3" title="Ce vinzi" />
                        <Button type="button" variant="outline" size="sm" onClick={addRegisterProduct}>
                          <Plus className="h-4 w-4" />
                          Adaugă produs
                        </Button>
                      </div>
                      <QuickChoiceRow
                        choices={["Miere de salcâm", "Brânză de capră", "Vin dobrogean", "Roșii și verdețuri"]}
                        onChoose={(choice) => {
                          const firstProduct = registerSetup.products[0];
                          if (firstProduct) {
                            updateRegisterProduct(firstProduct.id, "name", choice);
                          }
                        }}
                      />
                      <div className="space-y-3">
                        {registerSetup.products.map((product, index) => (
                          <ProductEditorCard
                            key={product.id}
                            product={product}
                            index={index}
                            canRemove={registerSetup.products.length > 1}
                            onUpdate={updateRegisterProduct}
                            onRemove={removeRegisterProduct}
                          />
                        ))}
                      </div>
                    </section>

                    <section className="space-y-4">
                      <SectionLabel eyebrow="4" title="Livrare" />
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
                            <Input
                              value={registerSetup.range}
                              onChange={(event) => updateRegisterSetup("range", event.target.value)}
                              placeholder="Ex: 35 km"
                            />
                            <QuickChoiceRow
                              choices={["20 km", "35 km", "60 km", "Pe tot litoralul"]}
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

                    <Button type="submit" variant="honey" className="w-full" disabled={authLoading}>
                      {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {authLoading ? "Se creează contul..." : "Creează cont și intră în chat"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
export default AuthScreen;
