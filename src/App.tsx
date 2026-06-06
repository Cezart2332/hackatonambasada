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
import {
  api,
  apiProfileToFrontend,
  apiVenueProfileToFrontend,
  setupToApiPayload,
  setupVenueToApiPayload,
  summarizeProducts,
} from "@/lib/api";
import { messageFromAuthError, messageFromUnknownError } from "@/lib/errors";
import type {
  AccountType,
  ApprovalStatus,
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
  VenueSetup,
} from "@/lib/types";

// Page and Component Imports
import { AuthScreen } from "@/pages/AuthScreen";
import { PendingApprovalScreen } from "@/pages/PendingApprovalScreen";
import { ProducerOnboardingScreen } from "@/pages/ProducerOnboardingScreen";
import { ProfilePage } from "@/pages/ProfilePage";
import { VenueProfilePage } from "@/pages/VenueProfilePage";
import { LeadMapPanel, StatusBadge } from "@/pages/LeadMapPanel";
import { AgentAvatar } from "@/components/AgentAvatar";
import { createProduct, patchProducerProduct } from "@/components/ProductEditor";
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
  {
    id: "casa",
    title: "Casa Dobrogeană",
    subtitle: "restaurant",
    preview: "Lead recomandat pentru produse locale.",
    time: "09:42",
    unread: 0,
  },
  {
    id: "sulina",
    title: "Hotel Sulina",
    subtitle: "hotel",
    preview: "Potrivit pentru mic dejun și turiști.",
    time: "ieri",
    unread: 0,
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


const enrichedMockDetails: Record<string, Partial<Lead>> = {
  "lead-1": {
    phone: "+40 722 334 455",
    contactPerson: "Alexandru Radu (Manager)",
    menuItems: "Clătite dobrogene, mic dejun tradițional, platou brânzeturi, salate",
    supplyFrequency: "Săptămânal (preferă Marțea și Vinerea)",
    notes: "Prețuiesc ingredientele autohtone cu poveste locală."
  },
  "lead-2": {
    phone: "+40 733 445 566",
    contactPerson: "Elena Sandu (Aprovizionare)",
    menuItems: "Mic dejun bufet suedez, restaurant interior, bar piscină",
    supplyFrequency: "Bilunar în cantități mari (minim 100 kg/livrare)",
    notes: "Au nevoie de facturare rapidă și livrări programate exact dimineața."
  },
  "lead-3": {
    phone: "+40 744 556 677",
    contactPerson: "Mihai Popa (Proprietar)",
    menuItems: "Cafea de origine, cheesecake, tarte, ceaiuri bio",
    supplyFrequency: "Săptămânal (livrări de 10-15 borcane)",
    notes: "Folosesc miere ca îndulcitor natural premium pentru specialități de cafea și ceai."
  },
  "lead-4": {
    phone: "+40 755 667 788",
    contactPerson: "Ioana Radu (Magazin)",
    menuItems: "Brânzeturi maturate, vinuri locale, dulcețuri artizanale, miere",
    supplyFrequency: "La nevoie (refacere stoc o dată la 2-3 săptămâni)",
    notes: "Magazin boutique. Preferă borcane etichetate curat și ambalaje aspectuoase pentru cadouri."
  },
  "lead-5": {
    phone: "+40 766 778 899",
    contactPerson: "Andrei Stan (Chef Bucătar)",
    menuItems: "Platouri gourmet, sosuri glaze cu miere, deserturi fine, brânzeturi",
    supplyFrequency: "Săptămânal, preferă livrarea joia",
    notes: "Caută brânzeturi premium de vacă sau oaie și miere de salcâm pentru sosuri caramelizate."
  }
};

const enrichLeads = (rawLeads: Lead[]): Lead[] => {
  return rawLeads.map(lead => ({
    ...lead,
    ...(enrichedMockDetails[lead.id] || {
      phone: "+40 722 000 000",
      contactPerson: "Manager Aprovizionare",
      menuItems: "Preparate generale din meniu",
      supplyFrequency: "De stabilit",
      notes: "Interesat de testarea calității produselor."
    })
  }));
};

function App() {
  const [screen, setScreen] = useState<AppScreen>("auth");
  const [account, setAccount] = useState<ProducerAccount | null>(null);
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
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(null);
  const [approvalRefreshing, setApprovalRefreshing] = useState(false);
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

  const onboardingDone = currentStep >= onboardingSteps.length;
  const step = onboardingSteps[currentStep];
  const isVenue = account?.accountType === "venue";

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
        const { data } = await authClient.getSession();
        if (!data?.user || cancelled) {
          return;
        }

        const user = data.user;
        const { accountType, approvalStatus: nextApprovalStatus } = await api.getAccount();
        setAccount({ name: user.name, email: user.email, accountType });

        if (accountType === "admin") {
          window.location.href = "/admin";
          return;
        }

        if (nextApprovalStatus === "pending" || nextApprovalStatus === "rejected") {
          setApprovalStatus(nextApprovalStatus);
          setScreen("pending-approval");
          return;
        }

        if (accountType === "venue") {
          const venueDto = await api.getVenueProfile();
          const restoredProfile = apiVenueProfileToFrontend(venueDto, { contactName: user.name });
          setProfile(restoredProfile);

          const { producers: matchedProducers } = await api.listMatchedProducers();
          if (!cancelled) {
            setLeads(matchedProducers);
            const statuses: Record<string, LeadStatus> = {};
            for (const producer of matchedProducers) {
              if (producer.status) statuses[producer.id] = producer.status;
            }
            setLeadStatuses(statuses);
          }
        } else {
          const dto = await api.getProfile();
          const restoredProfile = apiProfileToFrontend(dto, { producerName: user.name });
          setProfile(restoredProfile);

          const { leads: storedLeads } = await api.listLeads();
          if (!cancelled) {
            setLeads(enrichLeads(storedLeads));
            const statuses: Record<string, LeadStatus> = {};
            for (const lead of storedLeads) {
              if (lead.status) statuses[lead.id] = lead.status;
            }
            setLeadStatuses(statuses);
          }
        }

        setScreen("chat");
        setDashboardView("chat");
      } catch {
        // stay on auth screen
      } finally {
        if (!cancelled) setAuthChecking(false);
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
      const productSummary = isVenue
        ? profile.product || ""
        : summarizeProducts(profile.products).full || profile.product || "";
      try {
        const { message } = await api.draftMessage({
          businessName: lead.name,
          productSummary,
          locality: profile.location || "",
          tone: lead.tone,
        });
        textMsg = message;
      } catch {
        textMsg = lead.contact;
      }
    }
    const phoneNum = lead.phone?.replace(/[+\s-]/g, "") || "40722123456";
    window.open(`https://wa.me/${phoneNum}?text=${encodeURIComponent(textMsg)}`, "_blank");
  }

  function handleFailedContactSubmit(leadId: string, reason: string) {
    if (!reason.trim()) return;
    setFailedFeedbacks((prev) => ({ ...prev, [leadId]: reason }));
    setLeadStatuses((prev) => ({ ...prev, [leadId]: "Nu e potrivit" }));
    void (isVenue
      ? api.updateProducerMatchStatus(leadId, "Nu e potrivit")
      : api.updateLeadStatus(leadId, "Nu e potrivit")
    ).catch(() => undefined);

    const targetLead = leads.find((l) => l.id === leadId);
    if (targetLead) {
      addAgentText(
        isVenue
          ? `Am înțeles. Am marcat ${targetLead.name} ca nepotrivit deoarece: "${reason}". Voi prioritiza alți producători pentru următoarele recomandări.`
          : `Am înțeles. Am marcat ${targetLead.name} ca fiind nepotrivit deoarece: "${reason}". Am stocat acest feedback în memoria AI ca să excludem afaceri similare din recomandările viitoare.`,
        360
      );
    }
    setFailedLeadDialog(null);
    setCustomFailedReason("");
  }

  async function addOnboardingAgentReply(stepKey: string, userAnswer: string, fallback: string) {
    setTyping(true);
    try {
      const productSummary = summarizeProducts(profile.products);
      const { reply } = await api.chatReply({
        step: stepKey,
        userAnswer,
        profileHint: productSummary.full || profile.product,
      });
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
    } catch {
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
    } finally {
      setTyping(false);
    }
  }

  function openMessageLead(lead: Lead) {
    setMessageLead(lead);
    setMessageDraft(lead.contact);
    setMessageDraftLoading(true);

    const productSummary = isVenue
      ? profile.product || ""
      : summarizeProducts(profile.products).full || profile.product || "";
    void api
      .draftMessage({
        businessName: lead.name,
        productSummary,
        locality: profile.location || "",
        tone: lead.tone,
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

  async function saveVenueProfile() {
    setProfileSaving(true);
    setProfileSaved(false);
    setProfileSaveError(null);
    try {
      const dto = await api.updateVenueProfile({
        businessName: profile.businessName || "",
        venueType: profile.venueType || "restaurant",
        phone: profile.phone || "",
        location: profile.location || "",
        locationChoice: profile.locationChoice?.label ?? null,
        latitude: profile.locationChoice?.lat ? Number.parseFloat(profile.locationChoice.lat) : null,
        longitude: profile.locationChoice?.lon ? Number.parseFloat(profile.locationChoice.lon) : null,
        productsNeeded: profile.product || "",
        supplyFrequency: profile.quantity || "",
        preferredDays: profile.days || "",
      });
      setProfile((current) =>
        apiVenueProfileToFrontend(dto, { contactName: current.producerName }),
      );
      setProfileSaved(true);

      const { producers: matchedProducers } = await api.listMatchedProducers();
      setLeads(matchedProducers);
      const statuses: Record<string, LeadStatus> = {};
      for (const producer of matchedProducers) {
        if (producer.status) statuses[producer.id] = producer.status;
      }
      setLeadStatuses(statuses);
    } catch (error) {
      setProfileSaved(false);
      setProfileSaveError(messageFromUnknownError(error, "Nu am putut salva profilul. Încearcă din nou."));
    } finally {
      setProfileSaving(false);
    }
  }

  function addVenueRecommendations(delay = 740) {
    setTyping(true);
    window.setTimeout(async () => {
      try {
        const { producers: matchedProducers } = await api.listMatchedProducers();
        setLeads(matchedProducers);
        const statuses: Record<string, LeadStatus> = {};
        for (const producer of matchedProducers) {
          if (producer.status) statuses[producer.id] = producer.status;
        }
        setLeadStatuses(statuses);

        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            role: "agent",
            kind: "text",
            text:
              matchedProducers.length > 0
                ? "Am găsit câțiva producători locali potriviți. Îți las mai jos recomandările și de ce merită contactați."
                : "Nu am găsit producători în zona ta acum. Actualizează produsele căutate sau localitatea din profil.",
            time: now(),
          },
          ...matchedProducers.map<ChatMessage>((producer) => ({
            id: crypto.randomUUID(),
            role: "agent",
            kind: "lead",
            leadId: producer.id,
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
              "Nu am putut încărca producătorii. Verifică conexiunea la server.",
            ),
            time: now(),
          },
        ]);
      } finally {
        setTyping(false);
      }
    }, delay);
  }

  function addRecommendations(delay = 740) {
    setTyping(true);
    window.setTimeout(async () => {
      try {
        const { leads: matchedLeads } = await api.matchLeads();
        setLeads(enrichLeads(matchedLeads));
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

  function findNextStepIndex(nextProfile: Profile, startIndex: number) {
    const nextIndex = onboardingSteps.findIndex((item, index) => index >= startIndex && !nextProfile[item.key]);
    return nextIndex === -1 ? onboardingSteps.length : nextIndex;
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

  function startVenueChat(nextProfile: Profile, contactName?: string) {
    const greetingName = contactName ? `, ${contactName}` : "";
    const introMessages: ChatMessage[] = [
      {
        id: crypto.randomUUID(),
        role: "agent",
        kind: "text",
        text: `Bun venit${greetingName}. Am salvat profilul localului tău și îl folosesc ca să găsim producători potriviți din Dobrogea.`,
        time: now(),
      },
    ];

    if (nextProfile.product || nextProfile.location) {
      introMessages.push({
        id: crypto.randomUUID(),
        role: "agent",
        kind: "text",
        text: `Cauți ${nextProfile.product || "produse locale"} în zona ${nextProfile.location || "Dobrogea"}${nextProfile.days ? `, cu livrare preferată ${nextProfile.days}` : ""}.`,
        time: now(),
      });
    }

    setProfile(nextProfile);
    setMessages(introMessages);
    setCurrentStep(onboardingSteps.length);
    setTyping(false);
    setMobileChatOpen(false);
    setDashboardView("chat");
    setScreen("chat");
    addVenueRecommendations(680);
  }

  async function restoreAuthenticatedSession(user: { name: string; email: string }) {
    const { accountType, approvalStatus: nextApprovalStatus } = await api.getAccount();
    setAccount({ name: user.name, email: user.email, accountType });

    if (accountType === "admin") {
      window.location.href = "/admin";
      return;
    }

    if (nextApprovalStatus === "pending" || nextApprovalStatus === "rejected") {
      setApprovalStatus(nextApprovalStatus);
      setScreen("pending-approval");
      return;
    }

    if (accountType === "venue") {
      const venueDto = await api.getVenueProfile();
      const restoredProfile = apiVenueProfileToFrontend(venueDto, { contactName: user.name });
      const { producers: matchedProducers } = await api.listMatchedProducers();
      setLeads(matchedProducers);
      const statuses: Record<string, LeadStatus> = {};
      for (const producer of matchedProducers) {
        if (producer.status) statuses[producer.id] = producer.status;
      }
      setLeadStatuses(statuses);
      startVenueChat(restoredProfile, user.name);
      return;
    }

    const dto = await api.getProfile();
    const restoredProfile = apiProfileToFrontend(dto, { producerName: user.name });
    startChatWithProfile(restoredProfile, user.name);
  }

  async function handleLogout() {
    await authClient.signOut();
    setAccount(null);
    setApprovalStatus(null);
    setScreen("auth");
  }

  async function handleRefreshApproval() {
    if (!account) return;
    setApprovalRefreshing(true);
    try {
      const { approvalStatus: nextApprovalStatus } = await api.getAccount();
      if (nextApprovalStatus === "approved") {
        setApprovalStatus(null);
        await restoreAuthenticatedSession({ name: account.name, email: account.email });
        return;
      }
      if (nextApprovalStatus) {
        setApprovalStatus(nextApprovalStatus);
      }
    } finally {
      setApprovalRefreshing(false);
    }
  }

  async function handleLogin(email: string, password: string) {
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      throw new Error(messageFromAuthError(result.error));
    }

    await restoreAuthenticatedSession(result.data!.user);
  }

  async function handleRegister(
    email: string,
    password: string,
    accountType: AccountType,
    setup: ProducerSetup | VenueSetup,
  ) {
    const name =
      accountType === "producer"
        ? (setup as ProducerSetup).producerName.trim() || "Producător local"
        : (setup as VenueSetup).contactName.trim() || "Local din Dobrogea";
    const result = await authClient.signUp.email({ email, password, name });
    if (result.error) {
      throw new Error(messageFromAuthError(result.error));
    }

    setAccount({ name, email, accountType });

    if (accountType === "venue") {
      const venueSetup = setup as VenueSetup;
      await api.updateVenueProfile(setupVenueToApiPayload(venueSetup));
      const { approvalStatus: nextApprovalStatus } = await api.getAccount();
      if (nextApprovalStatus !== "approved") {
        setApprovalStatus(nextApprovalStatus || "pending");
        setScreen("pending-approval");
        return;
      }
      startVenueChat(
        {
          producerName: venueSetup.contactName,
          businessName: venueSetup.businessName,
          phone: venueSetup.phone,
          product: venueSetup.productsNeeded,
          quantity: venueSetup.supplyFrequency,
          location: venueSetup.location,
          locationChoice: venueSetup.locationChoice,
          days: venueSetup.preferredDays,
        },
        name,
      );
      return;
    }

    const producerSetup = setup as ProducerSetup;
    await api.updateProfile(setupToApiPayload(producerSetup));
    const { approvalStatus: nextApprovalStatus } = await api.getAccount();
    if (nextApprovalStatus !== "approved") {
      setApprovalStatus(nextApprovalStatus || "pending");
      setScreen("pending-approval");
      return;
    }

    const productSummary = summarizeProducts(producerSetup.products);
    startChatWithProfile(
      {
        producerName: producerSetup.producerName,
        businessName: producerSetup.businessName,
        phone: producerSetup.phone,
        products: producerSetup.products,
        product: productSummary.product,
        quantity: productSummary.quantity,
        location: producerSetup.location,
        locationChoice: producerSetup.locationChoice,
        range: producerSetup.range,
        days: producerSetup.days,
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

  function patchProfileProduct(productId: string, patch: Partial<ProducerProduct>) {
    const nextProducts = (profile.products || []).map((product) =>
      product.id === productId ? patchProducerProduct(product, patch) : product,
    );
    applyProfileProducts(nextProducts);
  }

  function addProfileProduct() {
    applyProfileProducts([...(profile.products || []), createProduct()]);
  }

  function removeProfileProduct(productId: string) {
    applyProfileProducts((profile.products || []).filter((product) => product.id !== productId));
  }

  function updateProfileField(key: "location" | "range" | "days", value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function updateVenueProfileField(
    key: "businessName" | "phone" | "location" | "product" | "quantity" | "days" | "venueType",
    value: string,
  ) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function handleAnswer(value: string) {
    const cleanValue = value.trim();
    if (!cleanValue || !step || typing) return;

    const answeredStep = step;
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

    void addOnboardingAgentReply(
      answeredStep.key,
      cleanValue,
      `Perfect. Am notat: ${nextProfile.product}, ${nextProfile.quantity}, din ${nextProfile.location}, livrare ${nextProfile.range}, în zilele ${nextProfile.days}.`,
    );
    void api.updateProfile(setupToApiPayload(nextProfile)).catch(() => undefined);
    addRecommendations(1100);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleAnswer(input);
  }

  function updateLeadStatus(lead: Lead, status: LeadStatus) {
    setLeadStatuses((current) => ({ ...current, [lead.id]: status }));
    void (isVenue
      ? api.updateProducerMatchStatus(lead.id, status)
      : api.updateLeadStatus(lead.id, status)
    ).catch(() => undefined);

    const textByStatus: Record<LeadStatus, string> = isVenue
      ? {
          Bun: `Am notat că ${lead.name} pare potrivit. Voi prioritiza producători similari.`,
          "Nu e potrivit": `În regulă, scot ${lead.name} din lista bună și caut alți producători mai potriviți.`,
          Contactat: `Bravo. Am marcat ${lead.name} ca fiind contactat.`,
          "A răspuns": `Excelent. Pentru ${lead.name}, următorul pas bun este să confirmi cantitățile și ziua de livrare.`,
          "A cumpărat": `Foarte bine. Am marcat ${lead.name} ca furnizor activ și voi ține minte acest tip de colaborare.`,
        }
      : {
          Bun: `Am notat că ${lead.name} pare bun. Voi căuta mai multe locuri asemănătoare.`,
          "Nu e potrivit": `În regulă, scot ${lead.name} din lista bună și caut recomandări mai apropiate de stilul tău.`,
          Contactat: `Bravo. Am marcat ${lead.name} ca fiind contactat.`,
          "A răspuns": `Excelent. Pentru ${lead.name}, următorul pas bun este să trimiți cantitatea disponibilă și ziua de livrare.`,
          "A cumpărat": `Foarte bine. Am marcat ${lead.name} ca vânzare și voi ține minte tipul acesta de client.`,
        };

    addAgentText(textByStatus[status], 260);
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

  if (screen === "pending-approval" && approvalStatus) {
    return (
      <PendingApprovalScreen
        status={approvalStatus}
        accountLabel={account?.accountType === "venue" ? "local" : "producător"}
        onRefresh={handleRefreshApproval}
        onLogout={handleLogout}
        refreshing={approvalRefreshing}
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
          isVenue={isVenue}
        />

        {dashboardView === "profile" ? (
          isVenue ? (
            <VenueProfilePage
              profile={profile}
              activeMatchCount={displayLeadCount}
              saving={profileSaving}
              saved={profileSaved}
              saveError={profileSaveError}
              onSave={() => void saveVenueProfile()}
              onProfileFieldChange={updateVenueProfileField}
            />
          ) : (
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
              onProductPatch={patchProfileProduct}
              onProfileFieldChange={updateProfileField}
            />
          )
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
                isVenue={isVenue}
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
                      isVenue={isVenue}
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
                  <div className="mx-auto mb-2 flex max-w-3xl gap-2 overflow-x-auto pb-1 no-scrollbar">
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
                    disabled={onboardingDone || typing}
                    placeholder={
                      onboardingDone
                        ? isVenue
                          ? "Alege un producător sau marchează ce s-a întâmplat"
                          : "Alege un lead sau marchează ce s-a întâmplat"
                        : step?.placeholder
                    }
                    className="bg-white/90"
                  />
                  <Button type="submit" size="icon" variant="honey" disabled={!input.trim() || onboardingDone || typing}>
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
                onDetails={setSelectedLead}
                onMessage={openMessageLead}
                onStatus={updateLeadStatus}
                onWhatsAppClick={handleWhatsAppRedirect}
                onFailedClick={setFailedLeadDialog}
                isVenue={isVenue}
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
        onWhatsAppSend={() => handleWhatsAppRedirect(messageLead!)}
      />

      <Dialog open={Boolean(failedLeadDialog)} onOpenChange={(open) => !open && setFailedLeadDialog(null)}>
        <DialogContent className="max-w-md bg-[#fffdfa] border-[#d7ccb3]">
          <DialogHeader className="text-left">
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
  isVenue = false,
}: {
  profile: Profile;
  activeLeadCount: number;
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  isVenue?: boolean;
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
              <p className="truncate text-lg font-extrabold text-[#263421]">
                {isVenue ? "Producători locali" : "Warm Leads"}
              </p>
              <Badge variant="olive" className="hidden sm:inline-flex">
                {activeTitle[activeView]}
              </Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {(isVenue ? profile.product : productSummary.product) || "Produse"} · {profile.location || "Dobrogea"} ·{" "}
              {activeLeadCount} {isVenue ? "producători" : "lead-uri"}
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
  isVenue = false,
}: {
  onBack?: () => void;
  profile: Profile;
  activeLeadCount: number;
  isVenue?: boolean;
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
            <h1 className="truncate text-base font-extrabold text-[#24311f]">
              {isVenue ? "Asistent de aprovizionare" : "Asistent de vânzări"}
            </h1>
            <Badge variant="olive" className="border-[#c8d9aa] bg-[#e8f0d7]">
              online
            </Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {isVenue
              ? "Producători locali și mesaje gata de trimis."
              : "Recomandări locale și mesaje gata de trimis."}
          </p>
        </div>
      </div>

      <Badge variant="warm">
        {activeLeadCount} {isVenue ? "producători" : "lead-uri"}
      </Badge>
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
  isVenue = false,
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
  isVenue?: boolean;
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
            isVenue={isVenue}
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
  isVenue = false,
}: {
  lead: Lead;
  status?: LeadStatus;
  failedFeedback?: string;
  onDetails: (lead: Lead) => void;
  onMessage: (lead: Lead) => void;
  onStatus: (lead: Lead, status: LeadStatus) => void;
  onWhatsAppClick: (lead: Lead) => void;
  onFailedClick: (lead: Lead) => void;
  isVenue?: boolean;
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
          <span className="font-bold">{isVenue ? "Oferă:" : "Ai putea să-i vinzi:"}</span> {lead.sell}
        </p>

        <div className="grid gap-2 sm:grid-cols-2 text-xs border-t border-[#eadfca] pt-3">
          {lead.phone && (
            <div>
              <span className="font-bold text-[#33412c]">📞 Contact:</span>{" "}
              <span className="text-[#5a654f]">{lead.phone} ({lead.contactPerson || (isVenue ? "Producător" : "Manager")})</span>
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
              <span className="font-bold text-[#33412c]">{isVenue ? "📦 Produse:" : "🍽️ În meniu:"}</span>{" "}
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader className="text-left">
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
          </TabsContent>
          <TabsContent value="why" className="space-y-4">
            <InfoBlock title="Îl recomand pentru că" text={lead.reason} />
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
  onWhatsAppSend,
}: {
  lead: Lead | null;
  draft: string;
  loading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWhatsAppSend: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  if (!lead) return null;

  async function handleCopy() {
    const text = draft || lead!.contact;
    if (!text.trim()) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden border-[#d7ccb3] bg-[#fffdfa] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mesaj pentru {lead.name}</DialogTitle>
          <DialogDescription>Scurt, uman și potrivit pentru WhatsApp.</DialogDescription>
        </DialogHeader>
        <div className="w-full overflow-hidden rounded-3xl border border-[#d7ccb3] bg-[#f6f1e6] px-5 py-4 text-center">
          <div className="mb-3 flex items-center justify-center gap-2 text-xs font-bold uppercase text-muted-foreground">
            <MessageCircle className="h-4 w-4" />
            Mesaj sugerat
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          </div>
          <p className="mx-auto w-full max-w-prose text-sm leading-relaxed text-[#2b3725]">
            {loading ? "Generez mesajul..." : draft}
          </p>
        </div>
        <div className="w-full overflow-hidden rounded-2xl bg-[#e9f0dc] px-5 py-3 text-center text-sm text-[#405235]">
          Ton: {lead.tone}. Poți să-l trimiți așa sau să-l scurtezi cu detaliile tale.
        </div>
        <div className="flex w-full flex-col items-center justify-center gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
            Închide
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleCopy()}
            className={cn(
              copied
                ? "border-[#bcd5b6] bg-[#dbefd7] text-[#2f643b]"
                : "border-[#eadfca] text-[#2b3725] hover:bg-[#fff9eb]",
            )}
          >
            {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
            {copied ? "Mesajul a fost copiat" : "Copiază mesajul"}
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
