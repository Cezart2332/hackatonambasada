import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Beef,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Clipboard,
  Coffee,
  Droplets,
  Handshake,
  Home,
  KeyRound,
  Leaf,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Milk,
  Navigation,
  PackageCheck,
  Phone,
  Plus,
  Send,
  ShieldCheck,
  Search,
  Sparkles,
  Store,
  ThumbsDown,
  Trash2,
  Truck,
  Utensils,
  UserRound,
  Wheat,
  Wine,
  X,
  AlertTriangle,
  Globe,
  ExternalLink,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { api, apiProfileToFrontend, parseRangeKm, setupToApiPayload, summarizeProducts } from "@/lib/api";
import { messageFromAuthError, messageFromUnknownError } from "@/lib/errors";
import type {
  AppScreen,
  ChatMessage,
  DashboardView,
  Lead,
  LeadStatus,
  LocationChoice,
  ProducerAccount,
  ProducerProduct,
  ProducerSetup,
  Profile,
  ProfileKey,
  SimulatedCampaignStep,
} from "@/lib/types";

// Page and Component Imports
import { AuthScreen } from "@/pages/AuthScreen";
import { ProducerOnboardingScreen } from "@/pages/ProducerOnboardingScreen";
import { ProfilePage } from "@/pages/ProfilePage";
import { LeadMapPanel, StatusBadge } from "@/pages/LeadMapPanel";
import { CampaignSimPanel } from "@/pages/CampaignSimPanel";
import { AgentAvatar } from "@/components/AgentAvatar";
import { createProduct } from "@/components/ProductEditor";
import { LocationSearch } from "@/components/LocationSearch";
import { SectionLabel, FieldBlock, QuickChoiceRow } from "@/components/FormBlocks";

const onboardingSteps: Array<{
  key: ProfileKey;
  question: string;
  placeholder: string;
  quickReplies: string[];
}> = [
  {
    key: "product",
    question: "Ce vinzi săptămâna asta?",
    placeholder: "Scrie, de exemplu: miere de salcâm și polifloră",
    quickReplies: ["Miere de salcâm", "Brânză de capră", "Vin alb", "Legume de sezon"],
  },
  {
    key: "quantity",
    question: "Cam cât ai disponibil pentru livrare?",
    placeholder: "Ex: 40 borcane, 25 kg, 12 lăzi",
    quickReplies: ["40 borcane", "25 kg", "12 lăzi", "80 sticle"],
  },
  {
    key: "location",
    question: "Din ce localitate ești?",
    placeholder: "Ex: Babadag, Murfatlar, Năvodari",
    quickReplies: ["Murfatlar", "Babadag", "Năvodari", "Adamclisi"],
  },
  {
    key: "range",
    question: "Cât de departe poți livra fără să te încurce?",
    placeholder: "Ex: 35 km sau până în Constanța",
    quickReplies: ["20 km", "35 km", "60 km", "Pe tot litoralul"],
  },
  {
    key: "days",
    question: "În ce zile poți livra cel mai ușor?",
    placeholder: "Ex: marți și vineri dimineața",
    quickReplies: ["Marți dimineața", "Joi după-amiază", "Vineri dimineața", "Weekend"],
  },
];

const conversations = [
  {
    id: "warm",
    title: "Warm Leads",
    subtitle: "Asistentul tău de vânzări",
    preview: "Uite cine ar putea cumpăra săptămâna asta.",
    time: "acum",
    unread: 2,
  },
];

const feedbackOptions: LeadStatus[] = ["Bun", "Nu e potrivit", "Contactat", "A răspuns", "A cumpărat"];

const productIcons = [
  { label: "miere", icon: Droplets, className: "bg-amber-100 text-amber-800" },
  { label: "brânză", icon: Milk, className: "bg-stone-100 text-stone-700" },
  { label: "vin", icon: Wine, className: "bg-rose-100 text-rose-800" },
  { label: "livrare", icon: Truck, className: "bg-sky-100 text-sky-800" },
  { label: "hartă", icon: MapPin, className: "bg-[#e9efd8] text-[#4e6536]" },
];

function findNextStepIndex(nextProfile: Profile, startIndex: number) {
  const nextIndex = onboardingSteps.findIndex((item, index) => index >= startIndex && !nextProfile[item.key]);
  return nextIndex === -1 ? onboardingSteps.length : nextIndex;
}

function profileToChatSnapshot(profile: Profile) {
  const summary = summarizeProducts(profile.products);
  return {
    product: profile.product || summary.product,
    quantity: profile.quantity || summary.quantity,
    products: (profile.products ?? []).map((p) => p.name.trim()).filter(Boolean),
    location: profile.location ?? "",
    latitude: profile.locationChoice?.lat ? Number.parseFloat(profile.locationChoice.lat) : null,
    longitude: profile.locationChoice?.lon ? Number.parseFloat(profile.locationChoice.lon) : null,
    rangeKm: parseRangeKm(profile.range ?? "35 km"),
    range: profile.range ?? "",
    days: profile.days ?? "",
    deliveryDays: profile.days ?? "",
  };
}

function mergeAgentProfileUpdates(current: Profile, updates: Record<string, unknown>): Profile {
  const next: Profile = { ...current };

  if (typeof updates.product === "string") next.product = updates.product;
  if (typeof updates.quantity === "string") next.quantity = updates.quantity;
  if (typeof updates.location === "string") next.location = updates.location;
  if (typeof updates.range === "string") next.range = updates.range;
  if (typeof updates.days === "string") next.days = updates.days;
  if (typeof updates.deliveryDays === "string") next.days = updates.deliveryDays;

  if (Array.isArray(updates.products) && updates.products.length) {
    const names = updates.products.map(String).filter(Boolean);
    next.products = names.map((name) => createProduct({ name }));
    next.product = names.join(", ");
  }

  return next;
}

function App() {
  const [screen, setScreen] = useState<AppScreen>("auth");
  const [account, setAccount] = useState<ProducerAccount | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [dashboardView, setDashboardView] = useState<DashboardView>("chat");
  const [activeConversation, setActiveConversation] = useState("warm");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "m-1",
      role: "agent",
      kind: "text",
      text: "Bună! Te ajut să găsești afaceri locale care ar putea cumpăra de la tine săptămâna asta.",
      time: "09:30",
    },
    {
      id: "m-2",
      role: "agent",
      kind: "text",
      text: onboardingSteps[0].question,
      time: "09:30",
    },
  ]);
  const [profile, setProfile] = useState<Profile>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [leadStatuses, setLeadStatuses] = useState<Record<string, LeadStatus>>({});
  const [leads, setLeads] = useState<Lead[]>([]);
  const [authChecking, setAuthChecking] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messageLead, setMessageLead] = useState<Lead | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [messageDraftLoading, setMessageDraftLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [failedFeedbacks, setFailedFeedbacks] = useState<Record<string, string>>({});
  const [failedLeadDialog, setFailedLeadDialog] = useState<Lead | null>(null);
  const [customFailedReason, setCustomFailedReason] = useState("");
  const [searchingMoreLeads, setSearchingMoreLeads] = useState(false);
  const [campaignSimOpen, setCampaignSimOpen] = useState(false);
  const [campaignSimLoading, setCampaignSimLoading] = useState(false);
  const [campaignSimSteps, setCampaignSimSteps] = useState<SimulatedCampaignStep[]>([]);
  const [campaignSimDisclaimer, setCampaignSimDisclaimer] = useState("");

  const onboardingDone = currentStep >= onboardingSteps.length;
  const activeStepIndex = findNextStepIndex(profile, 0);
  const step = onboardingDone ? undefined : onboardingSteps[activeStepIndex] ?? onboardingSteps[currentStep];

  const activeLeadCount = useMemo(
    () => Object.values(leadStatuses).filter((status) => status !== "Nu e potrivit").length,
    [leadStatuses],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing, leadStatuses]);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const sessionResult = await Promise.race([
          authClient.getSession(),
          new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 8_000)),
        ]);

        if (cancelled) return;

        const data =
          sessionResult && typeof sessionResult === "object" && "data" in sessionResult
            ? sessionResult.data
            : null;

        if (!data?.user) {
          setScreen("auth");
          return;
        }

        const user = data.user;
        setUserId(user.id);
        setAccount({ name: user.name, email: user.email });

        try {
          const dto = await api.getProfile();
          if (!cancelled) {
            const restoredProfile = apiProfileToFrontend(dto, { producerName: user.name });
            setProfile(restoredProfile);
            setCurrentStep(findNextStepIndex(restoredProfile, 0));
          }
        } catch {
          // profile optional on restore — user can still enter the app
        }

        setScreen("chat");
        setDashboardView("chat");

        // Load leads in background — never block the initial render on discovery/AI.
        void api
          .listLeads()
          .then(({ leads: storedLeads }) => {
            if (cancelled) return;
            setLeads(storedLeads);
            const statuses: Record<string, LeadStatus> = {};
            for (const lead of storedLeads) {
              if (lead.status) statuses[lead.id] = lead.status;
            }
            setLeadStatuses(statuses);
          })
          .catch(() => undefined);
      } catch {
        setScreen("auth");
      } finally {
        setAuthChecking(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayLeadCount = activeLeadCount || leads.length;

  function now() {
    return new Intl.DateTimeFormat("ro-RO", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
  }

  function addAgentText(text: string, delay = 420) {
    setTyping(true);
    window.setTimeout(() => {
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "agent",
          kind: "text",
          text,
          time: now(),
        },
      ]);
      setTyping(false);
    }, delay);
  }

  async function handleWhatsAppRedirect(lead: Lead) {
    let textMsg = lead.contact;
    if (messageLead?.id === lead.id && messageDraft) {
      textMsg = messageDraft;
    } else {
      const productSummary = summarizeProducts(profile.products);
      try {
        const { message } = await api.draftMessage({
          businessName: lead.name,
          productSummary: productSummary.full || profile.product || "",
          locality: profile.location || "",
          tone: lead.tone,
          leadType: lead.type,
          website: lead.website || "",
          menuItems: lead.menuItems || "",
          notes: lead.notes || "",
        });
        textMsg = message;
      } catch {
        textMsg = lead.contact;
      }
    }
    const phoneNum = lead.phone?.replace(/[+\s-]/g, "") ?? "";
    if (phoneNum.length < 10) {
      addAgentText(
        `${lead.name} nu are un număr de telefon public găsit online. Poți folosi mesajul sugerat și contacta prin site sau sursele din Detalii.`,
        400,
      );
      return;
    }
    window.open(`https://wa.me/${phoneNum}?text=${encodeURIComponent(textMsg)}`, "_blank");
  }

  function handleFailedContactSubmit(leadId: string, reason: string) {
    if (!reason.trim()) return;
    setFailedFeedbacks((prev) => ({ ...prev, [leadId]: reason }));
    setLeadStatuses((prev) => ({ ...prev, [leadId]: "Nu e potrivit" }));
    void api.updateLeadStatus(leadId, "Nu e potrivit", reason).catch(() => undefined);

    const targetLead = leads.find((l) => l.id === leadId);
    if (targetLead) {
      addAgentText(
        `Am înțeles. Am marcat ${targetLead.name} ca fiind nepotrivit deoarece: "${reason}". Am stocat acest feedback în memoria AI ca să excludem afaceri similare din recomandările viitoare.`,
        360
      );
    }
    setFailedLeadDialog(null);
    setCustomFailedReason("");
  }

  async function sendAgentMessage(text: string, profileSnapshot?: Profile) {
    const snapshot = profileSnapshot ?? profile;

    if (!userId) {
      addAgentText("Conectează-te pentru a folosi agentul AI.", 200);
      return;
    }

    setTyping(true);
    try {
      const { reply, profileUpdates, leads: agentLeads, onboardingComplete } = await api.chatReply({
        userId,
        message: text,
        profile: profileToChatSnapshot(snapshot),
      });

      let mergedProfile = snapshot;
      if (profileUpdates && Object.keys(profileUpdates).length) {
        mergedProfile = mergeAgentProfileUpdates(snapshot, profileUpdates);
        setProfile(mergedProfile);
        void api.updateProfile(setupToApiPayload(mergedProfile)).catch(() => undefined);
      }

      if (onboardingComplete || findNextStepIndex(mergedProfile, 0) >= onboardingSteps.length) {
        setCurrentStep(onboardingSteps.length);
      } else {
        setCurrentStep(findNextStepIndex(mergedProfile, 0));
      }

      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "agent",
          kind: "text",
          text: reply,
          time: now(),
        },
      ]);

      if (agentLeads?.length) {
        const existingIds = new Set(leads.map((l) => l.id));
        const newLeads = agentLeads.filter((l) => !existingIds.has(l.id));
        if (newLeads.length) {
          setLeads((current) => [...current, ...newLeads]);
          setMessages((items) => [
            ...items,
            ...newLeads.map<ChatMessage>((lead) => ({
              id: crypto.randomUUID(),
              role: "agent",
              kind: "lead",
              leadId: lead.id,
              time: now(),
            })),
          ]);
        }
      }
    } catch {
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "agent",
          kind: "text",
          text: "Nu am putut contacta agentul acum. Încearcă din nou.",
          time: now(),
        },
      ]);
    } finally {
      setTyping(false);
    }
  }

  async function addOnboardingAgentReply(_stepKey: string, _userAnswer: string, fallback: string) {
    if (userId) {
      await sendAgentMessage(_userAnswer);
      return;
    }

    setTyping(true);
    window.setTimeout(() => {
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "agent",
          kind: "text",
          text: fallback,
          time: now(),
        },
      ]);
      setTyping(false);
    }, 420);
  }

  async function runCampaignSimulation() {
    if (campaignSimLoading || !leads.length) return;
    setCampaignSimOpen(true);
    setCampaignSimLoading(true);
    setCampaignSimSteps([]);
    try {
      const { steps, disclaimer } = await api.simulateCampaign({ maxLeads: 3 });
      setCampaignSimSteps(steps);
      setCampaignSimDisclaimer(disclaimer);
      addAgentText(
        `Am rulat o simulare pentru ${steps.length} lead-uri reale. Nicio trimitere reală — vezi panoul „Simulare campanie”.`,
        300,
      );
    } catch (error) {
      setCampaignSimOpen(false);
      addAgentText(
        messageFromUnknownError(error, "Simularea campaniei nu a putut rula acum."),
        300,
      );
    } finally {
      setCampaignSimLoading(false);
    }
  }

  function openMessageLead(lead: Lead) {
    setMessageLead(lead);
    setMessageDraft(lead.contact);
    setMessageDraftLoading(true);

    const productSummary = summarizeProducts(profile.products);
    void api
      .draftMessage({
        businessName: lead.name,
        productSummary: productSummary.full || profile.product || "",
        locality: profile.location || "",
        tone: lead.tone,
        leadType: lead.type,
        website: lead.website || "",
        menuItems: lead.menuItems || "",
        notes: lead.notes || "",
      })
      .then(({ message }) => setMessageDraft(message))
      .catch(() => setMessageDraft(lead.contact))
      .finally(() => setMessageDraftLoading(false));
  }

  async function saveProfile() {
    setProfileSaving(true);
    setProfileSaved(false);
    setProfileSaveError(null);
    try {
      const dto = await api.updateProfile(setupToApiPayload(profile));
      setProfile((current) =>
        apiProfileToFrontend(dto, {
          producerName: current.producerName,
          businessName: current.businessName,
          phone: current.phone,
        }),
      );
      setProfileSaved(true);
    } catch (error) {
      setProfileSaved(false);
      setProfileSaveError(messageFromUnknownError(error, "Nu am putut salva profilul. Încearcă din nou."));
    } finally {
      setProfileSaving(false);
    }
  }

  function addRecommendations(delay = 740) {
    setTyping(true);
    window.setTimeout(async () => {
      try {
        const { leads: matchedLeads } = await api.matchLeads();
        setLeads(matchedLeads);
        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            role: "agent",
            kind: "text",
            text:
              matchedLeads.length > 0
                ? "Am găsit câteva locuri bune. Îți las mai jos lead-urile și de ce cred că merită încercate."
                : "Nu am găsit lead-uri în raza ta acum. Mărește raza de livrare sau actualizează localitatea din profil.",
            time: now(),
          },
          ...matchedLeads.map<ChatMessage>((lead) => ({
            id: crypto.randomUUID(),
            role: "agent",
            kind: "lead",
            leadId: lead.id,
            time: now(),
          })),
        ]);
      } catch (error) {
        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            role: "agent",
            kind: "text",
            text: messageFromUnknownError(
              error,
              "Nu am putut încărca lead-urile. Verifică conexiunea la server.",
            ),
            time: now(),
          },
        ]);
      } finally {
        setTyping(false);
      }
    }, delay);
  }

  async function searchMoreLeads() {
    if (searchingMoreLeads || typing) return;
    setSearchingMoreLeads(true);
    setTyping(true);
    try {
      const { leads: freshLeads } = await api.matchMoreLeads();
      const existingIds = new Set(leads.map((l) => l.id));
      const newLeads = freshLeads.filter((l) => !existingIds.has(l.id));

      if (newLeads.length === 0) {
        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            role: "agent",
            kind: "text",
            text: "Am căutat din nou pe internet, dar nu am găsit alte lead-uri noi în raza ta acum. Poți mări raza sau reîncerca mai târziu.",
            time: now(),
          },
        ]);
        return;
      }

      setLeads((current) => [...current, ...newLeads]);
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "agent",
          kind: "text",
          text: `Am găsit încă ${newLeads.length} lead-uri noi. Agentul a exclus afacerile deja afișate.`,
          time: now(),
        },
        ...newLeads.map<ChatMessage>((lead) => ({
          id: crypto.randomUUID(),
          role: "agent",
          kind: "lead",
          leadId: lead.id,
          time: now(),
        })),
      ]);
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "agent",
          kind: "text",
          text: messageFromUnknownError(
            error,
            "Nu am putut căuta alte lead-uri acum. Încearcă din nou.",
          ),
          time: now(),
        },
      ]);
    } finally {
      setSearchingMoreLeads(false);
      setTyping(false);
    }
  }

  function startChatWithProfile(nextProfile: Profile, producerName?: string) {
    const firstStepIndex = findNextStepIndex(nextProfile, 0);
    const greetingName = producerName ? `, ${producerName}` : "";
    const productSummary = summarizeProducts(nextProfile.products);
    const introMessages: ChatMessage[] = [
      {
        id: crypto.randomUUID(),
        role: "agent",
        kind: "text",
        text: `Bun venit${greetingName}. Am pregătit profilul tău de producător și îl folosesc ca să caut lead-uri potrivite.`,
        time: now(),
      },
    ];

    if (nextProfile.product || nextProfile.location || nextProfile.range) {
      introMessages.push({
        id: crypto.randomUUID(),
        role: "agent",
        kind: "text",
        text: `Am notat: ${productSummary.full || nextProfile.product || "produse locale"} din ${nextProfile.location || "Dobrogea"}, cu livrare până la ${nextProfile.range || "în apropiere"}.`,
        time: now(),
      });
    }

    if (firstStepIndex < onboardingSteps.length) {
      introMessages.push({
        id: crypto.randomUUID(),
        role: "agent",
        kind: "text",
        text: onboardingSteps[firstStepIndex].question,
        time: now(),
      });
    } else {
      introMessages.push({
        id: crypto.randomUUID(),
        role: "agent",
        kind: "text",
        text: "Profilul e complet. Îți arăt câteva locuri care ar putea cumpăra de la tine săptămâna asta.",
        time: now(),
      });
    }

    setProfile(nextProfile);
    setMessages(introMessages);
    setCurrentStep(firstStepIndex);
    setTyping(false);
    setMobileChatOpen(false);
    setDashboardView("chat");
    setScreen("chat");

    if (firstStepIndex >= onboardingSteps.length) {
      addRecommendations(680);
    }
  }

  async function handleLogin(email: string, password: string) {
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      throw new Error(messageFromAuthError(result.error));
    }

    const user = result.data!.user;
    setUserId(user.id);
    setAccount({ name: user.name, email: user.email });

    const dto = await api.getProfile();
    const restoredProfile = apiProfileToFrontend(dto, { producerName: user.name });
    startChatWithProfile(restoredProfile, user.name);
  }

  async function handleRegister(email: string, password: string, setup: ProducerSetup) {
    const name = setup.producerName.trim() || "Producător local";
    const result = await authClient.signUp.email({ email, password, name });
    if (result.error) {
      throw new Error(messageFromAuthError(result.error));
    }

    setAccount({ name, email });
    const signedUpUser = result.data?.user;
    if (signedUpUser?.id) setUserId(signedUpUser.id);
    await api.updateProfile(setupToApiPayload(setup));

    const productSummary = summarizeProducts(setup.products);
    startChatWithProfile(
      {
        producerName: setup.producerName,
        businessName: setup.businessName,
        phone: setup.phone,
        products: setup.products,
        product: productSummary.product,
        quantity: productSummary.quantity,
        location: setup.location,
        locationChoice: setup.locationChoice,
        range: setup.range,
        days: setup.days,
      },
      name,
    );
  }

  function handleProducerOnboarding(setup: ProducerSetup) {
    const productSummary = summarizeProducts(setup.products);

    startChatWithProfile(
      {
        producerName: setup.producerName,
        businessName: setup.businessName,
        phone: setup.phone,
        products: setup.products,
        product: productSummary.product,
        quantity: productSummary.quantity,
        location: setup.location,
        locationChoice: setup.locationChoice,
        range: setup.range,
        days: setup.days,
      },
      setup.producerName || account?.name,
    );
  }

  function applyProfileProducts(nextProducts: ProducerProduct[]) {
    const safeProducts = nextProducts.length ? nextProducts : [createProduct({ name: "Produs local" })];
    const productSummary = summarizeProducts(safeProducts);

    setProfile((current) => ({
      ...current,
      products: safeProducts,
      product: productSummary.product,
      quantity: productSummary.quantity,
    }));
  }

  function updateProfileProduct(productId: string, key: keyof ProducerProduct, value: string) {
    const nextProducts = (profile.products || []).map((product) =>
      product.id === productId ? { ...product, [key]: value } : product,
    );
    applyProfileProducts(nextProducts);
  }

  function addProfileProduct() {
    applyProfileProducts([...(profile.products || []), createProduct({ availableFrom: profile.days || "Săptămâna asta" })]);
  }

  function removeProfileProduct(productId: string) {
    applyProfileProducts((profile.products || []).filter((product) => product.id !== productId));
  }

  function updateProfileField(key: "location" | "range" | "days", value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function handleAnswer(value: string) {
    const cleanValue = value.trim();
    if (!cleanValue || typing) return;
    if (!onboardingDone && !step) return;

    const answeredStep = step!;
    const nextProfile = { ...profile, [answeredStep.key]: cleanValue };
    const nextStepIndex = findNextStepIndex(nextProfile, currentStep + 1);

    setInput("");
    setProfile(nextProfile);
    setMessages((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        role: "user",
        kind: "text",
        text: cleanValue,
        time: now(),
      },
    ]);
    setCurrentStep(nextStepIndex);

    if (nextStepIndex < onboardingSteps.length) {
      void addOnboardingAgentReply(
        answeredStep.key,
        cleanValue,
        onboardingSteps[nextStepIndex].question,
      );
      return;
    }

    void api.updateProfile(setupToApiPayload(nextProfile)).catch(() => undefined);
    void addOnboardingAgentReply(
      answeredStep.key,
      cleanValue,
      `Perfect. Am notat: ${nextProfile.product}, ${nextProfile.quantity}, din ${nextProfile.location}, livrare ${nextProfile.range}, în zilele ${nextProfile.days}.`,
    );
    if (!userId) {
      addRecommendations(1100);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanValue = input.trim();
    if (!cleanValue || typing) return;

    if (onboardingDone) {
      setInput("");
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "user",
          kind: "text",
          text: cleanValue,
          time: now(),
        },
      ]);
      void sendAgentMessage(cleanValue);
      return;
    }

    handleAnswer(input);
  }

  function updateLeadStatus(lead: Lead, status: LeadStatus) {
    setLeadStatuses((current) => ({ ...current, [lead.id]: status }));
    void api.updateLeadStatus(lead.id, status).catch(() => undefined);

    const textByStatus: Record<LeadStatus, string> = {
      Bun: `Am notat că ${lead.name} pare bun. Voi căuta mai multe locuri asemănătoare.`,
      "Nu e potrivit": `În regulă, scot ${lead.name} din lista bună și caut recomandări mai apropiate de stilul tău.`,
      Contactat: `Bravo. Am marcat ${lead.name} ca fiind contactat.`,
      "A răspuns": `Excelent. Pentru ${lead.name}, următorul pas bun este să trimiți cantitatea disponibilă și ziua de livrare.`,
      "A cumpărat": `Foarte bine. Am marcat ${lead.name} ca vânzare și voi ține minte tipul acesta de client.`,
    };

    addAgentText(textByStatus[status], 260);
  }

  function copySuggestedMessage() {
    if (!messageLead) return;
    navigator.clipboard?.writeText(messageDraft || messageLead.contact);
  }

  if (authChecking) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#eef2e7]">
        <Loader2 className="h-8 w-8 animate-spin text-[#526b36]" />
      </main>
    );
  }

  if (screen === "auth") {
    return <AuthScreen onLogin={handleLogin} onRegister={handleRegister} />;
  }

  if (screen === "producer-onboarding") {
    return (
      <ProducerOnboardingScreen
        accountName={account?.name}
        onBack={() => setScreen("auth")}
        onComplete={handleProducerOnboarding}
      />
    );
  }

  return (
    <main className="h-[100dvh] overflow-hidden bg-[#eef2e7] p-2 pb-[86px] text-foreground md:p-4 md:pb-4">
      <div className="mx-auto flex h-full w-full max-w-[1360px] flex-col overflow-hidden border border-[#d9d0b8] bg-card shadow-warm md:rounded-[24px]">
        <DashboardHeader
          profile={profile}
          activeLeadCount={displayLeadCount}
          activeView={dashboardView}
          onViewChange={setDashboardView}
        />

        {dashboardView === "profile" ? (
          <ProfilePage
            profile={profile}
            activeLeadCount={displayLeadCount}
            saving={profileSaving}
            saved={profileSaved}
            saveError={profileSaveError}
            onSave={() => void saveProfile()}
            onProductAdd={addProfileProduct}
            onProductRemove={removeProfileProduct}
            onProductUpdate={updateProfileProduct}
            onProfileFieldChange={updateProfileField}
          />
        ) : (
          <div
            className={cn(
              "grid min-h-0 flex-1 overflow-hidden bg-[#f7f3e8]",
              dashboardView === "chat" ? "lg:grid-cols-[minmax(0,1fr)_420px]" : "grid-cols-1",
            )}
          >
            <section
              className={cn(
                "min-h-0 flex-1 flex-col overflow-hidden border-b border-[#d7ccb3] lg:border-b-0 lg:border-r",
                dashboardView === "chat" ? "flex lg:flex" : "hidden lg:hidden",
              )}
            >
              <ChatHeader
                profile={profile}
                activeLeadCount={displayLeadCount}
              />

              <ScrollArea className="chat-pattern min-h-0 flex-1">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-4 sm:px-5 lg:px-6">
                  <DatePill />
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      lead={message.kind === "lead" ? leads.find((item) => item.id === message.leadId) : undefined}
                      status={message.kind === "lead" ? leadStatuses[message.leadId] : undefined}
                      failedFeedback={message.kind === "lead" ? failedFeedbacks[message.leadId] : undefined}
                      onDetails={setSelectedLead}
                      onMessage={openMessageLead}
                      onStatus={updateLeadStatus}
                      onWhatsAppClick={handleWhatsAppRedirect}
                      onFailedClick={setFailedLeadDialog}
                    />
                  ))}
                  {typing ? <TypingBubble /> : null}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>

              <div className="shrink-0 border-t border-[#d7ccb3] bg-[#f8f4ea]/95 px-3 py-3 backdrop-blur sm:px-5">
                {!onboardingDone && step ? (
                  <div className="mx-auto mb-2 flex max-w-3xl gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {step.quickReplies.map((reply) => (
                      <Button
                        key={reply}
                        type="button"
                        size="sm"
                        variant="chip"
                        onClick={() => handleAnswer(reply)}
                        disabled={typing}
                        className="shrink-0"
                      >
                        {reply}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-2 pb-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={campaignSimLoading || typing || !leads.length}
                      onClick={() => void runCampaignSimulation()}
                      className="shrink-0 border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                    >
                      {campaignSimLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Simulare campanie
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={searchingMoreLeads || typing}
                      onClick={() => void searchMoreLeads()}
                      className="shrink-0 border-[#c8d9aa] bg-[#f0f5e8] text-[#3f532c] hover:bg-[#e3edd4]"
                    >
                      {searchingMoreLeads ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Search className="h-3.5 w-3.5" />
                      )}
                      Caută alte lead-uri
                    </Button>
                    {leads.slice(0, 3).map((lead) => (
                      <Button
                        key={lead.id}
                        type="button"
                        size="sm"
                        variant="chip"
                        onClick={() => openMessageLead(lead)}
                        className="shrink-0"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Scrie către {lead.name}
                      </Button>
                    ))}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-center gap-2">
                  <Input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    disabled={typing}
                    placeholder={
                      onboardingDone
                        ? "Întreabă agentul, cere alte lead-uri sau ajutor cu mesaje..."
                        : step?.placeholder
                    }
                    className="bg-white/90"
                  />
                  <Button type="submit" size="icon" variant="honey" disabled={!input.trim() || typing}>
                    <Send className="h-4 w-4" />
                    <span className="sr-only">Trimite</span>
                  </Button>
                </form>
              </div>
            </section>

            <div
              key={dashboardView}
              className={cn(
                "min-h-0 overflow-hidden",
                dashboardView === "map" ? "flex lg:flex flex-1" : "hidden lg:flex",
              )}
            >
              <LeadMapPanel
                leads={leads}
                statuses={leadStatuses}
                failedFeedbacks={failedFeedbacks}
                activeLeadCount={displayLeadCount}
                searchingMore={searchingMoreLeads}
                onSearchMore={() => void searchMoreLeads()}
                onDetails={setSelectedLead}
                onMessage={openMessageLead}
                onStatus={updateLeadStatus}
                onWhatsAppClick={handleWhatsAppRedirect}
                onFailedClick={setFailedLeadDialog}
              />
            </div>
          </div>
        )}
      </div>

      <MobileBottomNav activeView={dashboardView} onViewChange={setDashboardView} />
      <LeadDetailsDialog lead={selectedLead} open={Boolean(selectedLead)} onOpenChange={(open) => !open && setSelectedLead(null)} />
      <ContactMessageDialog
        lead={messageLead}
        draft={messageDraft}
        loading={messageDraftLoading}
        open={Boolean(messageLead)}
        onOpenChange={(open) => !open && setMessageLead(null)}
        onCopy={copySuggestedMessage}
        onWhatsAppSend={() => handleWhatsAppRedirect(messageLead!)}
      />

      <CampaignSimPanel
        open={campaignSimOpen}
        loading={campaignSimLoading}
        disclaimer={campaignSimDisclaimer}
        steps={campaignSimSteps}
        onClose={() => setCampaignSimOpen(false)}
      />

      <Dialog open={Boolean(failedLeadDialog)} onOpenChange={(open) => !open && setFailedLeadDialog(null)}>
        <DialogContent className="max-w-md bg-[#fffdfa] border-[#d7ccb3]">
          <DialogHeader>
            <DialogTitle className="text-[#263421] font-extrabold text-xl">De ce nu a mers contactarea?</DialogTitle>
            <DialogDescription className="text-[#62705a]">
              AI-ul va stoca acest motiv pentru a exclude recomandările similare în viitor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-xs font-bold uppercase text-[#5a654f] tracking-wider">Sugestii rapide de feedback</p>
            <div className="flex flex-col gap-2">
              {[
                "Vor brânză de capră, deși în meniu scrie 'brânză' (noi vindem doar de vacă)",
                "Doresc livrare zilnică, iar noi livrăm doar vinerea",
                "Prețul produselor noastre (34 lei/kg) este considerat prea mare",
                "Au deja contract exclusiv stabil cu alt furnizor local"
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="text-left text-xs bg-[#f4ebd9] hover:bg-[#ebdcb9] text-[#423118] font-semibold p-2.5 rounded-xl border border-[#ded5bf] transition-colors"
                  onClick={() => {
                    if (failedLeadDialog) {
                      handleFailedContactSubmit(failedLeadDialog.id, suggestion);
                    }
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            
            <div className="space-y-2 pt-3 border-t border-[#eadfca] flex flex-col">
              <label className="text-xs font-bold uppercase text-[#5a654f] tracking-wider">Scrie un alt motiv custom</label>
              <Input
                value={customFailedReason}
                onChange={(e) => setCustomFailedReason(e.target.value)}
                placeholder="Ex: Au închis temporar sau meniul s-a schimbat..."
                className="bg-white/80 border-[#ded5bf]"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setFailedLeadDialog(null)}>
              Anulează
            </Button>
            <Button
              variant="honey"
              disabled={!customFailedReason.trim()}
              onClick={() => {
                if (failedLeadDialog) {
                  handleFailedContactSubmit(failedLeadDialog.id, customFailedReason);
                }
              }}
            >
              Salvează feedback AI
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}


function DashboardHeader({
  profile,
  activeLeadCount,
  activeView,
  onViewChange,
}: {
  profile: Profile;
  activeLeadCount: number;
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
}) {
  const productSummary = summarizeProducts(profile.products);
  const activeTitle: Record<DashboardView, string> = {
    chat: "Chat",
    map: "Hartă",
    profile: "Profil",
  };

  return (
    <header className="shrink-0 border-b border-[#d7ccb3] bg-[#fbf7ed] px-3 py-2.5 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AgentAvatar small />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-lg font-extrabold text-[#263421]">Warm Leads</p>
              <Badge variant="olive" className="hidden sm:inline-flex">
                {activeTitle[activeView]}
              </Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {productSummary.product || "Produse"} · {profile.location || "Dobrogea"} · {activeLeadCount} lead-uri
            </p>
          </div>
        </div>

        <div className="hidden shrink-0 rounded-full border border-[#ded5bf] bg-[#fffaf0] p-1 md:flex">
          <DashboardNavButton active={activeView === "chat"} icon={MessageCircle} label="Chat" onClick={() => onViewChange("chat")} />
          <DashboardNavButton active={activeView === "map"} icon={MapPin} label="Hartă" onClick={() => onViewChange("map")} />
          <DashboardNavButton active={activeView === "profile"} icon={UserRound} label="Profil" onClick={() => onViewChange("profile")} />
        </div>
      </div>
    </header>
  );
}

function DashboardNavButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof MessageCircle;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition",
        active ? "bg-[#4d6638] text-white shadow-sm" : "text-[#526047] hover:bg-[#f1eadb]",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function DashboardStat({ icon: Icon, label, value }: { icon: typeof Wheat; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#ded5bf] bg-[#fffaf0] px-3 py-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e9f0dc] text-[#4d6638]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-bold text-[#263421]">{value}</p>
      </div>
    </div>
  );
}

function MobileBottomNav({
  activeView,
  onViewChange,
}: {
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
}) {
  const items: Array<{ id: DashboardView; label: string; icon: typeof MessageCircle }> = [
    { id: "chat", label: "Chat", icon: MessageCircle },
    { id: "map", label: "Hartă", icon: MapPin },
    { id: "profile", label: "Profil", icon: UserRound },
  ];

  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 rounded-[24px] border border-[#d7ccb3] bg-[#fffaf0]/95 p-2 shadow-warm backdrop-blur md:hidden">
      <div className="grid grid-cols-3 gap-1">
        {items.map(({ id, label, icon: Icon }) => {
          const active = activeView === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onViewChange(id)}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-1 rounded-[18px] text-xs font-extrabold transition",
                active ? "bg-[#4d6638] text-white" : "text-[#526047] hover:bg-[#f1eadb]",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}


function ChatHeader({
  onBack,
  profile,
  activeLeadCount,
}: {
  onBack?: () => void;
  profile: Profile;
  activeLeadCount: number;
}) {
  return (
    <header className="shrink-0 border-b border-[#d7ccb3] bg-[#f8f4ea] px-3 py-2.5 sm:px-5">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 lg:max-w-none">
      <div className="flex min-w-0 items-center gap-3">
        {onBack ? (
          <Button size="icon" variant="ghost" className="md:hidden" onClick={onBack} aria-label="Înapoi">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : null}
        <AgentAvatar />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-extrabold text-[#24311f]">Asistent de vânzări</h1>
            <Badge variant="olive" className="border-[#c8d9aa] bg-[#e8f0d7]">
              online
            </Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">Recomandări locale și mesaje gata de trimis.</p>
        </div>
      </div>

      <Badge variant="warm">{activeLeadCount} lead-uri</Badge>
      </div>
    </header>
  );
}

function ProfileRow({ label, value, icon: Icon }: { label: string; value?: string; icon: typeof Wheat }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#ded5bf] bg-[#fffaf0] p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf0df] text-[#526b36]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-[#263421]">{value || "Încă nu am întrebat"}</p>
      </div>
    </div>
  );
}

function DatePill() {
  return (
    <div className="flex justify-center">
      <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-[#6b715f] shadow-sm">
        Azi, 6 iunie
      </span>
    </div>
  );
}


function MessageBubble({
  message,
  lead,
  status,
  failedFeedback,
  onDetails,
  onMessage,
  onStatus,
  onWhatsAppClick,
  onFailedClick,
}: {
  message: ChatMessage;
  lead?: Lead;
  status?: LeadStatus;
  failedFeedback?: string;
  onDetails: (lead: Lead) => void;
  onMessage: (lead: Lead) => void;
  onStatus: (lead: Lead, status: LeadStatus) => void;
  onWhatsAppClick: (lead: Lead) => void;
  onFailedClick: (lead: Lead) => void;
}) {
  if (message.kind === "lead" && lead) {
    return (
      <div className="flex items-end gap-2">
        <AgentAvatar small />
        <div className="max-w-[760px]">
          <LeadCard
            lead={lead}
            status={status}
            failedFeedback={failedFeedback}
            onDetails={onDetails}
            onMessage={onMessage}
            onStatus={onStatus}
            onWhatsAppClick={onWhatsAppClick}
            onFailedClick={onFailedClick}
          />
          <p className="mt-1 pl-2 text-xs text-muted-foreground">{message.time}</p>
        </div>
      </div>
    );
  }

  if (message.kind === "lead") {
    return null;
  }

  const isUser = message.role === "user";

  return (
    <div className={cn("flex items-end gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser ? <AgentAvatar small /> : null}
      <div
        className={cn(
          "max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-bubble sm:max-w-[620px]",
          isUser
            ? "rounded-br-md bg-[#dcecc8] text-[#24311f]"
            : "rounded-bl-md border border-[#eadfca] bg-white/92 text-[#283421]",
        )}
      >
        <p>{message.text}</p>
        <div className={cn("mt-1 flex items-center gap-1 text-[11px]", isUser ? "justify-end text-[#647653]" : "text-muted-foreground")}>
          <span>{message.time}</span>
          {isUser ? <CheckCheck className="h-3.5 w-3.5 text-[#5c7f96]" /> : null}
        </div>
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  status,
  failedFeedback,
  onDetails,
  onMessage,
  onStatus,
  onWhatsAppClick,
  onFailedClick,
}: {
  lead: Lead;
  status?: LeadStatus;
  failedFeedback?: string;
  onDetails: (lead: Lead) => void;
  onMessage: (lead: Lead) => void;
  onStatus: (lead: Lead, status: LeadStatus) => void;
  onWhatsAppClick: (lead: Lead) => void;
  onFailedClick: (lead: Lead) => void;
}) {
  const Icon = leadIcon(lead.icon);

  return (
    <Card className={cn(
      "max-w-[760px] overflow-hidden border bg-[#fffdf7]/95 shadow-bubble transition-colors",
      failedFeedback ? "border-[#ead2cc] bg-[#fffbf9]/95" : "border-[#d7ccb3]"
    )}>
      <CardHeader className="p-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e9f0dc] text-[#4d6638]">
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="truncate text-base">{lead.name}</CardTitle>
              <Badge variant="blue" className="border-[#c8dde5] bg-[#e6f1f4]">
                {lead.match}% potrivire
              </Badge>
              {status ? <StatusBadge status={status} /> : null}
            </div>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{lead.type}</span>
              <span className="text-[#b3a887]">•</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {lead.distance}
              </span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        <div className="rounded-2xl bg-[#f5f0e5] p-3">
          <p className="text-sm font-semibold text-[#29361f]">Îl recomand pentru că...</p>
          <p className="mt-1 text-sm text-[#5a654f]">{lead.reason}</p>
        </div>

        {failedFeedback ? (
          <div className="rounded-2xl border border-[#ead2cc] bg-[#fdf0ec] p-3 text-sm font-semibold text-[#884636] flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[#884636] mt-0.5" />
            <div>
              <p className="font-bold">Contact eșuat</p>
              <p className="text-xs mt-0.5 text-[#9a5141] font-medium">{failedFeedback}</p>
            </div>
          </div>
        ) : null}

        <p className="text-sm text-[#44533d]">
          <span className="font-bold">Ai putea să-i vinzi:</span> {lead.sell}
        </p>

        <div className="grid gap-2 sm:grid-cols-2 text-xs border-t border-[#eadfca] pt-3">
          {lead.website && (
            <div className="sm:col-span-2">
              <span className="font-bold text-[#33412c]">🌐 Website:</span>{" "}
              <a
                href={normalizeUrl(lead.website)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#4d6638] underline-offset-2 hover:underline"
              >
                {lead.website}
              </a>
            </div>
          )}
          {lead.phone && (
            <div>
              <span className="font-bold text-[#33412c]">📞 Contact:</span>{" "}
              <span className="text-[#5a654f]">{lead.phone} ({lead.contactPerson || "Manager"})</span>
            </div>
          )}
          {lead.supplyFrequency && (
            <div>
              <span className="font-bold text-[#33412c]">🚚 Livrare:</span>{" "}
              <span className="text-[#5a654f]">{lead.supplyFrequency}</span>
            </div>
          )}
          {lead.menuItems && (
            <div className="sm:col-span-2">
              <span className="font-bold text-[#33412c]">🍽️ În meniu:</span>{" "}
              <span className="text-[#5a654f]">{lead.menuItems}</span>
            </div>
          )}
          {lead.notes && (
            <div className="sm:col-span-2 bg-[#fffbf2] border border-[#eadfca] rounded-xl p-2 mt-1">
              <span className="font-bold text-[#33412c] block mb-0.5">ℹ️ AI Context:</span>
              <span className="text-[#5a654f] italic">{lead.notes}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant="outline" size="sm" onClick={() => onDetails(lead)}>
            <BadgeCheck className="h-4 w-4" />
            Detalii
          </Button>
          <Button variant="honey" size="sm" onClick={() => onMessage(lead)}>
            <MessageCircle className="h-4 w-4" />
            Scrie mesaj
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onWhatsAppClick(lead)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onFailedClick(lead)}
            className="text-rose-700 hover:bg-rose-50 border-rose-200 hover:border-rose-300"
          >
            Ceva n-a mers
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[#eadfca] pt-3">
          {feedbackOptions.map((option) => (
            <Button
              key={option}
              variant={status === option ? "default" : "chip"}
              size="sm"
              onClick={() => onStatus(lead, option)}
              className="h-8"
            >
              {option}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}


function TypingBubble() {
  return (
    <div className="flex items-end gap-2">
      <AgentAvatar small />
      <div className="flex items-center gap-1 rounded-3xl rounded-bl-md border border-[#eadfca] bg-white/90 px-4 py-3 shadow-bubble">
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#9aa587]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#9aa587] [animation-delay:120ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#9aa587] [animation-delay:240ms]" />
      </div>
    </div>
  );
}

function LeadDetailsDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!lead) return null;
  const Icon = leadIcon(lead.icon);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e9f0dc] text-[#4d6638]">
            <Icon className="h-6 w-6" />
          </div>
          <DialogTitle>{lead.name}</DialogTitle>
          <DialogDescription>
            {lead.type} · {lead.location}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="short" className="mt-6">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="short">Pe scurt</TabsTrigger>
            <TabsTrigger value="why">De ce</TabsTrigger>
            <TabsTrigger value="message">Mesaj</TabsTrigger>
          </TabsList>
          <TabsContent value="short" className="space-y-3">
            <DetailRow icon={MapPin} label="Distanță" value={lead.distance} />
            <DetailRow icon={BadgeCheck} label="Potrivire" value={`${lead.match}%`} />
            <DetailRow icon={CalendarDays} label="Moment bun" value={lead.bestDay} />
            {lead.website ? (
              <DetailLinkRow icon={Globe} label="Website" href={normalizeUrl(lead.website)} text={lead.website} />
            ) : null}
            {lead.phone ? (
              <DetailRow
                icon={Phone}
                label="Telefon"
                value={lead.contactPerson ? `${lead.phone} · ${lead.contactPerson}` : lead.phone}
              />
            ) : null}
            {lead.menuItems ? <InfoBlock title="Meniu / ofertă" text={lead.menuItems} /> : null}
            {lead.notes ? <InfoBlock title="Informații din surse web" text={lead.notes} /> : null}
            {lead.sourceUrls?.length ? (
              <div className="rounded-2xl border border-[#ded5bf] bg-[#fffaf0] p-4">
                <p className="text-sm font-bold text-[#263421]">Surse online</p>
                <ul className="mt-2 space-y-1.5">
                  {lead.sourceUrls.map((url, index) => (
                    <li key={`${url}-${index}`}>
                      <a
                        href={normalizeUrl(url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-[#4d6638] underline-offset-2 hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        {url.includes("vertexaisearch.cloud.google.com")
                          ? `Sursă web ${index + 1}`
                          : url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </TabsContent>
          <TabsContent value="why" className="space-y-4">
            <InfoBlock title="Îl recomand pentru că" text={lead.reason} />
            {lead.needs?.length ? (
              <InfoBlock
                title="Nevoi estimate"
                text={lead.needs.join(", ")}
              />
            ) : null}
            {lead.matchedNeeds?.length ? (
              <InfoBlock
                title="Potrivire cu produsele tale"
                text={lead.matchedNeeds.join(", ")}
              />
            ) : null}
            <InfoBlock title="Ai putea să-i vinzi" text={lead.sell} />
          </TabsContent>
          <TabsContent value="message">
            <div className="rounded-2xl border border-[#ded5bf] bg-[#fffaf0] p-4">
              <p className="text-xs font-bold uppercase text-muted-foreground">Mesaj sugerat</p>
              <p className="mt-2 text-sm leading-relaxed text-[#34422d]">{lead.contact}</p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ContactMessageDialog({
  lead,
  draft,
  loading,
  open,
  onOpenChange,
  onCopy,
  onWhatsAppSend,
}: {
  lead: Lead | null;
  draft: string;
  loading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopy: () => void;
  onWhatsAppSend: () => void;
}) {
  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mesaj pentru {lead.name}</DialogTitle>
          <DialogDescription>Scurt, uman și potrivit pentru WhatsApp.</DialogDescription>
        </DialogHeader>
        <div className="rounded-3xl border border-[#d7ccb3] bg-[#f6f1e6] p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
            <MessageCircle className="h-4 w-4" />
            Mesaj sugerat
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          </div>
          <p className="text-sm leading-relaxed text-[#2b3725]">{loading ? "Generez mesajul..." : draft}</p>
        </div>
        <div className="rounded-2xl bg-[#e9f0dc] p-3 text-sm text-[#405235]">
          Ton: {lead.tone}. Poți să-l trimiți așa sau să-l scurtezi cu detaliile tale.
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
            Închide
          </Button>
          <Button variant="outline" onClick={onCopy} className="border-[#eadfca] text-[#2b3725] hover:bg-[#fff9eb]">
            <Clipboard className="h-4 w-4" />
            Copiază mesajul
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5"
            onClick={onWhatsAppSend}
          >
            <MessageCircle className="h-4 w-4" />
            Trimite pe WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#ded5bf] bg-[#fffaf0] p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e9f0dc] text-[#4d6638]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-[#263421]">{value}</p>
      </div>
    </div>
  );
}

function DetailLinkRow({
  icon: Icon,
  label,
  href,
  text,
}: {
  icon: typeof MapPin;
  label: string;
  href: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#ded5bf] bg-[#fffaf0] p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e9f0dc] text-[#4d6638]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#4d6638] underline-offset-2 hover:underline break-all"
        >
          {text}
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
      </div>
    </div>
  );
}

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url.replace(/^\/+/, "")}`;
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-[#ded5bf] bg-[#fffaf0] p-4">
      <p className="text-sm font-bold text-[#263421]">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-[#58644f]">{text}</p>
    </div>
  );
}

function leadIcon(icon: Lead["icon"]) {
  const icons = {
    restaurant: Utensils,
    hotel: Building2,
    cafe: Coffee,
    shop: Beef,
    deli: Wine,
  };

  return icons[icon];
}

export default App;
