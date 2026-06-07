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
  Inbox,
  KeyRound,
  LayoutGrid,
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
import { VenueChatProgress } from "@/components/VenueChatProgress";
import { VenueMatchDiagnosticsPanel } from "@/components/VenueMatchDiagnosticsPanel";
import { MatchWhySection } from "@/components/MatchWhySection";
import { ProducerOfferList } from "@/components/ProducerOfferList";
import { useVenueChatSession } from "@/hooks/useVenueChatSession";
import { cn } from "@/lib/utils";
import {
  buildVenueZeroMatchMessage,
  extractVenueNeedsFromMessage,
  isVenueReadyForMatching,
  mergeVenueProductNeeds,
  readVenueSessionFromStorage,
  venueLeadsFromChat,
  venueProfileToChatSnapshot,
} from "@/lib/venueChatUtils";
import { authClient } from "@/lib/auth-client";
import {
  api,
  apiProfileToFrontend,
  apiVenueProfileToFrontend,
  parseRangeKm,
  setupToApiPayload,
  setupVenueToApiPayload,
  summarizeProducts,
} from "@/lib/api";
import { isPlanLimitError, messageFromAuthError, messageFromUnknownError } from "@/lib/errors";
import type {
  AccountType,
  ApprovalStatus,
  AppScreen,
  ChatMessage,
  DashboardView,
  Lead,
  LeadStatus,
  LocationChoice,
  PlanContext,
  ProducerAccount,
  ProducerProduct,
  ProducerSetup,
  Profile,
  ProfileKey,
  SimulatedCampaignStep,
  VenueSetup,
} from "@/lib/types";

// Page and Component Imports
import { AuthScreen } from "@/pages/AuthScreen";
import { PendingApprovalScreen } from "@/pages/PendingApprovalScreen";
import { ProducerOnboardingScreen } from "@/pages/ProducerOnboardingScreen";
import { PlanBanner } from "@/components/PlanBanner";
import { ProPaywallDialog } from "@/components/ProPaywallDialog";
import { ProfilePage } from "@/pages/ProfilePage";
import { VenueProfilePage } from "@/pages/VenueProfilePage";
import { DirectorPage } from "@/pages/DirectorPage";
import { MessagesPage } from "@/pages/MessagesPage";
import { StatusBadge } from "@/pages/LeadMapPanel";
import { CampaignSimPanel } from "@/pages/CampaignSimPanel";
import { AgentAvatar } from "@/components/AgentAvatar";
import { PlatformRegisteredBadge } from "@/components/PlatformRegisteredBadge";
import { createProduct, patchProducerProduct } from "@/components/ProductEditor";
import { LocationSearch } from "@/components/LocationSearch";
import { SectionLabel, FieldBlock, QuickChoiceRow } from "@/components/FormBlocks";

type OnboardingStep = {
  key: ProfileKey;
  question: string;
  placeholder: string;
  quickReplies: string[];
};

const producerOnboardingSteps: OnboardingStep[] = [
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

const venueOnboardingSteps: OnboardingStep[] = [
  {
    key: "product",
    question: "Ce produse cauți de la producători locali?",
    placeholder: "Ex: miere, brânzeturi, legume de sezon",
    quickReplies: ["Miere de salcâm", "Brânzeturi locale", "Legume de sezon", "Ouă și lactate"],
  },
  {
    key: "quantity",
    question: "Ce cantități sau frecvență de aprovizionare ai nevoie?",
    placeholder: "Ex: 20 kg/săptămână, 40 borcane/lună",
    quickReplies: ["10 kg/săptămână", "20 kg/săptămână", "Comandă lunară", "Sezonier"],
  },
  {
    key: "location",
    question: "Unde e localul tău?",
    placeholder: "Ex: Constanța, Mamaia, Mangalia",
    quickReplies: ["Constanța", "Mamaia", "Mangalia", "Năvodari"],
  },
  {
    key: "days",
    question: "În ce zile preferi livrarea?",
    placeholder: "Ex: marți și vineri dimineața",
    quickReplies: ["Marți dimineața", "Joi după-amiază", "Vineri dimineața", "Weekend"],
  },
];

const producerFailedSuggestions = [
  "Vor brânză de capră, deși în meniu scrie 'brânză' (noi vindem doar de vacă)",
  "Doresc livrare zilnică, iar noi livrăm doar vinerea",
  "Prețul produselor noastre (34 lei/kg) este considerat prea mare",
  "Au deja contract exclusiv stabil cu alt furnizor local",
];

const venueFailedSuggestions = [
  "Prețul este prea mare pentru bugetul nostru",
  "Nu livrează în zilele în care avem nevoie",
  "Produsele nu se potrivesc cu ce căutăm acum",
  "Avem deja un furnizor stabil pentru această categorie",
];

const feedbackOptions: LeadStatus[] = ["Nu e potrivit", "Contactat", "A răspuns", "A cumpărat"];

const productIcons = [
  { label: "miere", icon: Droplets, className: "bg-amber-100 text-amber-800" },
  { label: "brânză", icon: Milk, className: "bg-stone-100 text-stone-700" },
  { label: "vin", icon: Wine, className: "bg-rose-100 text-rose-800" },
  { label: "livrare", icon: Truck, className: "bg-sky-100 text-sky-800" },
  { label: "hartă", icon: MapPin, className: "bg-[#e9efd8] text-[#4e6536]" },
];

function getOnboardingSteps(venue: boolean): OnboardingStep[] {
  return venue ? venueOnboardingSteps : producerOnboardingSteps;
}

function findNextStepIndex(nextProfile: Profile, startIndex: number, venue = false) {
  const steps = getOnboardingSteps(venue);
  const nextIndex = steps.findIndex((item, index) => index >= startIndex && !nextProfile[item.key]);
  return nextIndex === -1 ? steps.length : nextIndex;
}

function profileToChatSnapshot(profile: Profile) {
  const summary = summarizeProducts(profile.products);
  return {
    product: profile.product || summary.product,
    quantity: profile.quantity || summary.quantity,
    products: (profile.products ?? [])
      .filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name.trim(),
        estimatedQuantity: p.estimatedQuantity,
        unit: p.unit,
        pricePerKg: p.pricePerKg,
        availableFrom: p.availableFrom,
      })),
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
  if (typeof updates.productsNeeded === "string") next.product = updates.productsNeeded;
  if (typeof updates.quantity === "string") next.quantity = updates.quantity;
  if (typeof updates.supplyFrequency === "string") next.quantity = updates.supplyFrequency;
  if (typeof updates.location === "string") next.location = updates.location;
  if (typeof updates.range === "string") next.range = updates.range;
  if (typeof updates.days === "string") next.days = updates.days;
  if (typeof updates.deliveryDays === "string") next.days = updates.deliveryDays;
  if (typeof updates.preferredDays === "string") next.days = updates.preferredDays;
  if (Array.isArray(updates.products) && updates.products.length) {
    const products = updates.products
      .map((item) => {
        if (typeof item === "string") {
          return createProduct({ name: item });
        }
        if (!item || typeof item !== "object") return null;
        const product = item as Partial<ProducerProduct> & {
          estimatedQuantity?: string;
          pricePerKg?: string;
          availableFrom?: string;
          unit?: string;
        };
        if (!product.name?.trim()) return null;
        return createProduct({
          name: product.name,
          estimatedQuantity: product.estimatedQuantity ?? "",
          unit: product.unit ?? "kg",
          pricePerKg: product.pricePerKg ?? "",
          availableFrom: product.availableFrom ?? "Saptamana asta",
        });
      })
      .filter((item): item is ProducerProduct => Boolean(item));
    const names = products.map((product) => product.name).filter(Boolean);
    next.products = products;
    next.product = names.join(", ");
    const quantities = products
      .map((product) =>
        product.estimatedQuantity.trim()
          ? `${product.estimatedQuantity.trim()} ${product.unit.trim() || "kg"}`
          : "",
      )
      .filter(Boolean);
    if (quantities.length) next.quantity = quantities.join("; ");
  }
  return next;
}

function venueProfileToApiPayload(profile: Profile) {
  return {
    businessName: profile.businessName || "",
    venueType: profile.venueType || "restaurant",
    phone: profile.phone || "",
    location: profile.location || "",
    locationChoice: profile.locationChoice?.label ?? null,
    latitude: profile.locationChoice?.lat ? Number.parseFloat(profile.locationChoice.lat) : null,
    longitude: profile.locationChoice?.lon ? Number.parseFloat(profile.locationChoice.lon) : null,
  };
}

function App() {
  const [screen, setScreen] = useState<AppScreen>("auth");
  const [account, setAccount] = useState<ProducerAccount | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [dashboardView, setDashboardView] = useState<DashboardView>("chat");
  const [activeConversation, setActiveConversation] = useState("warm");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profile, setProfile] = useState<Profile>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [leadStatuses, setLeadStatuses] = useState<Record<string, LeadStatus>>({});
  const [leads, setLeads] = useState<Lead[]>([]);
  const [newLeadIds, setNewLeadIds] = useState<Set<string>>(() => new Set());
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
  const venueSearchSyncTimer = useRef<number | null>(null);
  const [failedFeedbacks, setFailedFeedbacks] = useState<Record<string, string>>({});
  const [failedLeadDialog, setFailedLeadDialog] = useState<Lead | null>(null);
  const [customFailedReason, setCustomFailedReason] = useState("");
  const [searchingMoreLeads, setSearchingMoreLeads] = useState(false);
  const [campaignSimOpen, setCampaignSimOpen] = useState(false);
  const [campaignSimLoading, setCampaignSimLoading] = useState(false);
  const [campaignSimSteps, setCampaignSimSteps] = useState<SimulatedCampaignStep[]>([]);
  const [campaignSimDisclaimer, setCampaignSimDisclaimer] = useState("");
  const [plan, setPlan] = useState<PlanContext | null>(null);
  const [planUpgrading, setPlanUpgrading] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallMessage, setPaywallMessage] = useState("");
  const [venueProducerScope, setVenueProducerScope] = useState<"matched" | "all">("matched");
  const [venueMatchDiagnostics, setVenueMatchDiagnostics] = useState<import("@/lib/venueChatUtils").VenueMatchDiagnostics | undefined>();
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [pendingChatCounterpartId, setPendingChatCounterpartId] = useState<string | null>(null);
  const venueChat = useVenueChatSession(userId);

  const isVenue = account?.accountType === "venue";
  const venueSessionNeeds = venueChat.needs;
  const venueSessionSupplyFrequency = venueChat.supplyFrequency;
  const venueSessionPreferredDays = venueChat.preferredDays;
  const activeOnboardingSteps = getOnboardingSteps(isVenue);
  const onboardingDone = currentStep >= activeOnboardingSteps.length;
  const activeStepIndex = findNextStepIndex(profile, 0, isVenue);

  const step = onboardingDone
    ? undefined
    : activeOnboardingSteps[activeStepIndex] ?? activeOnboardingSteps[currentStep];

  const activeLeadCount = useMemo(
    () => Object.values(leadStatuses).filter((status) => status !== "Nu e potrivit").length,
    [leadStatuses],
  );

  function scheduleVenueSearchIntentSync(session: {
    needs: string;
    supplyFrequency: string;
    preferredDays: string;
  }) {
    if (!userId || account?.accountType !== "venue") return;
    if (venueSearchSyncTimer.current) {
      window.clearTimeout(venueSearchSyncTimer.current);
    }
    venueSearchSyncTimer.current = window.setTimeout(() => {
      void api
        .updateVenueSearchIntent({
          productsNeeded: session.needs,
          supplyFrequency: session.supplyFrequency,
          preferredDays: session.preferredDays,
        })
        .catch(() => undefined);
    }, 600);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing, leadStatuses]);

  useEffect(() => {
    if (screen !== "chat" || !userId) return;

    async function refreshUnreadMessages() {
      try {
        const { unreadCount } = await api.getUnreadMessageCount();
        setMessageUnreadCount(unreadCount);
      } catch {
        // optional badge
      }
    }

    void refreshUnreadMessages();
    const interval = window.setInterval(() => void refreshUnreadMessages(), 30_000);
    return () => window.clearInterval(interval);
  }, [screen, userId]);

  async function refreshPlan() {
    if (isVenue) return;
    try {
      const { plan: nextPlan } = await api.getPlan();
      setPlan(nextPlan);
    } catch {
      // plan optional for UI
    }
  }

  function openPaywall(message: string) {
    setPaywallMessage(message);
    setPaywallOpen(true);
  }

  function handlePlanLimit(error: unknown): boolean {
    if (!isPlanLimitError(error) || isVenue) return false;
    openPaywall(error.message);
    return true;
  }

  async function handleUpgradePro() {
    if (planUpgrading || isVenue) return;
    setPlanUpgrading(true);
    try {
      const { plan: nextPlan } = await api.upgradePro();
      setPlan(nextPlan);
      setPaywallOpen(false);
      addAgentText(
        "Pro activ (demo). Poți genera lead-uri nelimitat — câte 10 per căutare — plus detalii bogate în Director.",
        280,
      );
      const { leads: refreshedLeads } = await api.listLeads();
      setLeads(refreshedLeads);
      setNewLeadIds(new Set());
    } catch (error) {
      addAgentText(messageFromUnknownError(error, "Nu am putut activa Pro acum."), 260);
    } finally {
      setPlanUpgrading(false);
    }
  }

  async function handleDowngradeFree() {
    if (planUpgrading || isVenue) return;
    setPlanUpgrading(true);
    try {
      const { plan: nextPlan } = await api.downgradeFree();
      setPlan(nextPlan);
      addAgentText("Ai revenit la planul Free (demo).", 260);
    } catch (error) {
      addAgentText(messageFromUnknownError(error, "Nu am putut reveni la Free acum."), 260);
    } finally {
      setPlanUpgrading(false);
    }
  }

  useEffect(() => {
    if (!isVenue && screen === "chat") {
      void refreshPlan();
    }
  }, [isVenue, screen, leads.length, leadStatuses]);

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

        await restoreAuthenticatedSession(data.user);
      } catch {
        setScreen("auth");
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayLeadCount = activeLeadCount || leads.length;
  const venueProducerCount = leads.length;

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
        ? venueSessionNeeds
        : summarizeProducts(profile.products).full || profile.product || "";
      try {
        const { message } = await api.draftMessage({
          businessName: lead.name,
          productSummary,
          locality: profile.location || "",
          tone: lead.tone,
          leadType: lead.type,
          website: lead.website || "",
          menuItems: lead.menuItems || "",
          notes: lead.notes || "",
          accountType: isVenue ? "venue" : "producer",
          venueBusinessName: profile.businessName || profile.producerName || "",
          supplyFrequency: venueSessionSupplyFrequency,
          preferredDays: venueSessionPreferredDays,
        });
        textMsg = message;
      } catch {
        textMsg = lead.contact;
      }
    }
    const phoneNum = lead.phone?.replace(/[+\s-]/g, "") ?? "";
    if (phoneNum.length < 10) {
      addAgentText(
        isVenue
          ? `${lead.name} nu are telefon în profilul din platformă. Poți folosi mesajul sugerat sau contacta prin Detalii.`
          : `${lead.name} nu are un număr de telefon public găsit online. Poți folosi mesajul sugerat și contacta prin site sau sursele din Detalii.`,
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
    void (isVenue
      ? api.updateProducerMatchStatus(leadId, "Nu e potrivit")
      : api.updateLeadStatus(leadId, "Nu e potrivit", reason)
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

  async function loadVenueProducers(
    scope: "matched" | "all" = venueProducerScope,
    needs: string = venueSessionNeeds,
  ) {
    const { producers, diagnostics } = await api.listMatchedProducers(scope, needs || undefined);
    setLeads(producers);
    setVenueMatchDiagnostics(diagnostics);
    const statuses: Record<string, LeadStatus> = {};
    for (const producer of producers) {
      if (producer.status) statuses[producer.id] = producer.status;
    }
    setLeadStatuses(statuses);
    return { producers, diagnostics };
  }

  async function sendAgentMessage(text: string, profileSnapshot?: Profile) {
    const snapshot = profileSnapshot ?? profile;

    if (!userId) {
      addAgentText("Conectează-te pentru a folosi agentul AI.", 200);
      return;
    }

    setTyping(true);
    try {
      const {
        reply,
        profileUpdates,
        profile: persistedProfile,
        leads: agentLeads,
        onboardingComplete,
      } = await api.chatReply({
        userId,
        message: text,
        accountType: isVenue ? "venue" : "producer",
        profile: isVenue
          ? venueProfileToChatSnapshot(snapshot, venueChat.session)
          : profileToChatSnapshot(snapshot),
      });

      let mergedProfile = persistedProfile
        ? apiProfileToFrontend(persistedProfile, {
            producerName: snapshot.producerName,
            businessName: snapshot.businessName,
            phone: snapshot.phone,
          })
        : snapshot;
      if (!persistedProfile && profileUpdates && Object.keys(profileUpdates).length) {
        mergedProfile = mergeAgentProfileUpdates(snapshot, profileUpdates);
      }

      if (isVenue) {
        let sessionNeeds = venueSessionNeeds;
        let sessionFrequency = venueSessionSupplyFrequency;
        let sessionDays = venueSessionPreferredDays;

        if (typeof profileUpdates?.productsNeeded === "string") {
          sessionNeeds = profileUpdates.productsNeeded;
        } else if (typeof profileUpdates?.product === "string") {
          sessionNeeds = profileUpdates.product;
        }
        if (typeof profileUpdates?.supplyFrequency === "string") {
          sessionFrequency = profileUpdates.supplyFrequency;
        } else if (typeof profileUpdates?.quantity === "string") {
          sessionFrequency = profileUpdates.quantity;
        }
        if (typeof profileUpdates?.preferredDays === "string") {
          sessionDays = profileUpdates.preferredDays;
        } else if (typeof profileUpdates?.days === "string") {
          sessionDays = profileUpdates.days;
        }

        const clientNeeds = mergeVenueProductNeeds(sessionNeeds, extractVenueNeedsFromMessage(text));
        if (clientNeeds) {
          sessionNeeds = clientNeeds;
        }

        venueChat.updateSession({
          needs: sessionNeeds,
          supplyFrequency: sessionFrequency,
          preferredDays: sessionDays,
        });
        scheduleVenueSearchIntentSync({
          needs: sessionNeeds,
          supplyFrequency: sessionFrequency,
          preferredDays: sessionDays,
        });

        const sessionSnapshot = {
          needs: sessionNeeds,
          supplyFrequency: sessionFrequency,
          preferredDays: sessionDays,
        };
        const readyForMatching = isVenueReadyForMatching(
          sessionSnapshot,
          snapshot.location,
          onboardingComplete,
        );

        const previousIds = new Set(leads.map((item) => item.id));
        const followUp: ChatMessage[] = [];

        if (readyForMatching) {
          const { producers: refreshed, diagnostics } = await loadVenueProducers("matched", sessionNeeds);
          setVenueProducerScope("matched");
          const productLabel = sessionNeeds.trim() || "produsele căutate";

          if (refreshed.length === 0) {
            followUp.push({
              id: crypto.randomUUID(),
              role: "agent",
              kind: "text",
              text: buildVenueZeroMatchMessage(productLabel, diagnostics),
              time: now(),
            });
          } else {
            const newProducers = refreshed.filter((producer) => !previousIds.has(producer.id));
            followUp.push({
              id: crypto.randomUUID(),
              role: "agent",
              kind: "text",
              text:
                newProducers.length > 0
                  ? `Am actualizat lista — ${newProducers.length} producători noi potriviți pentru ${productLabel}.`
                  : `Am găsit ${refreshed.length} producători potriviți pentru ${productLabel}.`,
              time: now(),
            });
            const cardsToShow = newProducers.length > 0 ? newProducers : refreshed;
            followUp.push(
              ...cardsToShow.map<ChatMessage>((producer) => ({
                id: crypto.randomUUID(),
                role: "agent",
                kind: "lead",
                leadId: producer.id,
                time: now(),
              })),
            );
          }
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
          ...followUp,
        ]);
        setTyping(false);
        return;
      }

      if (persistedProfile) {
        setProfile(mergedProfile);
      } else if (profileUpdates && Object.keys(profileUpdates).length) {
        setProfile(mergedProfile);
        void api.updateProfile(setupToApiPayload(mergedProfile)).catch(() => undefined);
      }

      const steps = getOnboardingSteps(isVenue);
      if (onboardingComplete || findNextStepIndex(mergedProfile, 0, isVenue) >= steps.length) {
        setCurrentStep(steps.length);
      } else {
        setCurrentStep(findNextStepIndex(mergedProfile, 0, isVenue));
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

      if (!isVenue && agentLeads?.length) {
        const existingIds = new Set(leads.map((l) => l.id));
        const newLeads = agentLeads.filter((l) => !existingIds.has(l.id));
        if (newLeads.length) {
          setLeads((current) => [...current, ...newLeads]);
          setNewLeadIds(new Set(newLeads.map((l) => l.id)));
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
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "agent",
          kind: "text",
          text: messageFromUnknownError(
            error,
            "Nu am putut contacta agentul acum. Încearcă din nou.",
          ),
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
      if (!handlePlanLimit(error)) {
        addAgentText(
          messageFromUnknownError(error, "Simularea campaniei nu a putut rula acum."),
          300,
        );
      }
    } finally {
      setCampaignSimLoading(false);
      void refreshPlan();
    }
  }

  function openPlatformChat(counterpartUserId: string) {
    setPendingChatCounterpartId(counterpartUserId);
    setDashboardView("messages");
  }

  function openMessageLead(lead: Lead) {
    const isPlatformPeer = Boolean(lead.platformRegistered) || isVenue;

    if (isPlatformPeer) {
      openPlatformChat(lead.id);
      return;
    }

    setMessageLead(lead);
    setMessageDraft(lead.contact);
    setMessageDraftLoading(true);

    const productSummary = isVenue
      ? venueSessionNeeds
      : summarizeProducts(profile.products).full || profile.product || "";
    void api
      .draftMessage({
        businessName: lead.name,
        productSummary,
        locality: profile.location || "",
        tone: lead.tone,
        leadType: lead.type,
        website: lead.website || "",
        menuItems: lead.menuItems || "",
        notes: lead.notes || "",
        accountType: isVenue ? "venue" : "producer",
        venueBusinessName: profile.businessName || profile.producerName || "",
        supplyFrequency: venueSessionSupplyFrequency,
        preferredDays: venueSessionPreferredDays,
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
      const dto = await api.updateVenueProfile(venueProfileToApiPayload(profile));
      setProfile((current) =>
        apiVenueProfileToFrontend(dto, { contactName: current.producerName }),
      );
      setProfileSaved(true);
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
        const { producers: matchedProducers } = await loadVenueProducers("matched");
        setVenueProducerScope("matched");

        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            role: "agent",
            kind: "text",
            text:
              matchedProducers.length > 0
                ? `Am găsit ${matchedProducers.length} producători înregistrați care se potrivesc cu ${venueSessionNeeds.trim() || "ce cauți"}.`
                : `Nu am găsit producători potriviți pentru ${venueSessionNeeds.trim() || "produsele menționate"}. Deschide tab-ul Director pentru lista completă.`,
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

  async function searchMoreLeads() {
    if (searchingMoreLeads || typing) return;
    setSearchingMoreLeads(true);
    setTyping(true);
    try {
      if (isVenue) {
        const { producers: allProducers } = await loadVenueProducers("all");
        setVenueProducerScope("all");
        const openingDirector = dashboardView !== "director";
        if (openingDirector) {
          setDashboardView("director");
          setMessages((items) => [
            ...items,
            {
              id: crypto.randomUUID(),
              role: "agent",
              kind: "text",
              text:
                allProducers.length > 0
                  ? `Lista completă (${allProducers.length} producători) e în Director — poți filtra după distanță acolo.`
                  : "Nu există încă producători înregistrați în platformă.",
              time: now(),
            },
          ]);
        }
        return;
      }

      if (leads.length === 0) {
        const { leads: matchedLeads } = await api.matchLeads();
        setLeads(matchedLeads);
        setNewLeadIds(new Set(matchedLeads.map((l) => l.id)));
        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            role: "agent",
            kind: "text",
            text:
              matchedLeads.length > 0
                ? `Am găsit ${matchedLeads.length} lead-uri. Le vezi mai jos și în Director.`
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
        return;
      }

      const { leads: freshLeads } = await api.matchMoreLeads();
      const existingIds = new Set(leads.map((l) => l.id));
      const newLeads = freshLeads.filter((l) => !existingIds.has(l.id));

      if (newLeads.length === 0) {
        setNewLeadIds(new Set());
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
      setNewLeadIds(new Set(newLeads.map((l) => l.id)));
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
      if (!handlePlanLimit(error)) {
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
      }
    } finally {
      setSearchingMoreLeads(false);
      setTyping(false);
      void refreshPlan();
    }
  }

  function initProducerChat(nextProfile: Profile, producerName?: string) {
    const firstStepIndex = findNextStepIndex(nextProfile, 0, false);
    const greetingName = producerName ? `, ${producerName}` : "";
    const productSummary = summarizeProducts(nextProfile.products);
    const introMessages: ChatMessage[] = [
      {
        id: crypto.randomUUID(),
        role: "agent",
        kind: "text",
        text: `Bun venit${greetingName}. Profilul tău de producător e salvat — când vrei lead-uri noi, le ceri explicit din Director sau din Asistent.`,
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

    if (firstStepIndex < producerOnboardingSteps.length) {
      introMessages.push({
        id: crypto.randomUUID(),
        role: "agent",
        kind: "text",
        text: producerOnboardingSteps[firstStepIndex].question,
        time: now(),
      });
    } else {
      introMessages.push({
        id: crypto.randomUUID(),
        role: "agent",
        kind: "text",
        text: "Profilul e complet. Deschide Director și apasă «Caută alte lead-uri» când vrei recomandări noi, sau spune-mi în Asistent să caut.",
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
  }

  function initVenueChat(nextProfile: Profile, contactName?: string, freshSession = false) {
    if (freshSession) venueChat.reset(userId);
    const greetingName = contactName ? `, ${contactName}` : "";
    const introMessages: ChatMessage[] = [
      {
        id: crypto.randomUUID(),
        role: "agent",
        kind: "text",
        text: `Bun venit${greetingName}. Am salvat profilul localului tău din ${nextProfile.location || "Dobrogea"}. Spune-mi ce produse cauți, apoi cantitatea/frecvența și zilele preferate de livrare — abia după aceea îți arăt producătorii potriviți.`,
        time: now(),
      },
    ];

    setProfile(nextProfile);
    setMessages(introMessages);
    setCurrentStep(venueOnboardingSteps.length);
    setTyping(false);
    setMobileChatOpen(false);
    setDashboardView("chat");
    setScreen("chat");
  }

  async function restoreAuthenticatedSession(user: { id?: string; name: string; email: string }) {
    if (user.id) setUserId(user.id);
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
      initVenueChat(restoredProfile, user.name, false);
      if (user.id) {
        venueChat.hydrate(user.id);
        const localSession = readVenueSessionFromStorage(user.id);
        const serverHasIntent = Boolean(
          venueDto.productsNeeded.trim() ||
            venueDto.supplyFrequency.trim() ||
            venueDto.preferredDays.trim(),
        );
        if (serverHasIntent && !localSession.needs.trim()) {
          venueChat.updateSession({
            needs: venueDto.productsNeeded,
            supplyFrequency: venueDto.supplyFrequency,
            preferredDays: venueDto.preferredDays,
          });
        }
      }

      void api
        .listMatchedProducers()
        .then(({ producers: matchedProducers }) => {
          setLeads(matchedProducers);
          const statuses: Record<string, LeadStatus> = {};
          for (const producer of matchedProducers) {
            if (producer.status) statuses[producer.id] = producer.status;
          }
          setLeadStatuses(statuses);
        })
        .catch(() => undefined);
      return;
    }

    const dto = await api.getProfile();
    let restoredProfile = apiProfileToFrontend(dto, { producerName: user.name });

    // Auto-geocode: if profile has a location string but no coordinates, fetch them silently
    if (restoredProfile.location && !restoredProfile.locationChoice) {
      try {
        const geoResults = await api.geoSearch(restoredProfile.location + ", Romania");
        if (geoResults.length > 0) {
          const top = geoResults[0];
          restoredProfile = {
            ...restoredProfile,
            locationChoice: {
              label: top.display_name,
              lat: top.lat,
              lon: top.lon,
            },
          };
          // Persist the geocoded coordinates back to the server
          void api.updateProfile({
            ...setupToApiPayload(restoredProfile),
            latitude: Number.parseFloat(top.lat),
            longitude: Number.parseFloat(top.lon),
            locationChoice: top.display_name,
          }).catch(() => undefined);
        }
      } catch {
        // geo lookup optional — silent fail
      }
    }

    initProducerChat(restoredProfile, user.name);

    void api
      .listLeads()
      .then(({ leads: storedLeads }) => {
        setLeads(storedLeads);
        const statuses: Record<string, LeadStatus> = {};
        for (const lead of storedLeads) {
          if (lead.status) statuses[lead.id] = lead.status;
        }
        setLeadStatuses(statuses);
      })
      .catch(() => undefined);

    void api
      .getPlan()
      .then(({ plan: restoredPlan }) => setPlan(restoredPlan))
      .catch(() => undefined);
  }

  async function handleLogout() {
    await authClient.signOut();
    setAccount(null);
    setUserId(null);
    setApprovalStatus(null);
    setMessages([]);
    setLeads([]);
    setNewLeadIds(new Set());
    setLeadStatuses({});
    venueChat.reset(userId);
    setCurrentStep(0);
    setDashboardView("chat");
    setScreen("auth");
  }

  async function handleRefreshApproval() {
    if (!account) return;
    setApprovalRefreshing(true);
    try {
      const { approvalStatus: nextApprovalStatus } = await api.getAccount();
      if (nextApprovalStatus === "approved") {
        setApprovalStatus(null);
        await restoreAuthenticatedSession({
          id: userId ?? undefined,
          name: account.name,
          email: account.email,
        });
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

    const signedUpUser = result.data?.user;
    if (!signedUpUser?.id) {
      throw new Error("Contul a fost creat, dar sesiunea nu a putut fi pornită. Încearcă să te loghezi.");
    }

    setUserId(signedUpUser.id);

    try {
      if (accountType === "venue") {
        const venueSetup = setup as VenueSetup;
        await api.updateVenueProfile(setupVenueToApiPayload(venueSetup));
      } else {
        const producerSetup = setup as ProducerSetup;
        await api.updateProfile(setupToApiPayload(producerSetup));
      }
    } catch (error) {
      await authClient.signOut();
      setUserId(null);
      throw error;
    }

    setAccount({ name, email, accountType });

    if (accountType === "venue") {
      const venueSetup = setup as VenueSetup;
      const { approvalStatus: nextApprovalStatus } = await api.getAccount();
      if (nextApprovalStatus !== "approved") {
        setApprovalStatus(nextApprovalStatus || "pending");
        setScreen("pending-approval");
        return;
      }
      initVenueChat(
        {
          producerName: venueSetup.contactName,
          businessName: venueSetup.businessName,
          phone: venueSetup.phone,
          location: venueSetup.location,
          locationChoice: venueSetup.locationChoice,
        },
        name,
        true,
      );
      return;
    }

    const producerSetup = setup as ProducerSetup;
    const { approvalStatus: nextApprovalStatus } = await api.getAccount();
    if (nextApprovalStatus !== "approved") {
      setApprovalStatus(nextApprovalStatus || "pending");
      setScreen("pending-approval");
      return;
    }

    const productSummary = summarizeProducts(producerSetup.products);
    initProducerChat(
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

    initProducerChat(
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

  function updateProfileField(key: "businessName" | "phone" | "location" | "range" | "days", value: string) {
    setProfile((current) => ({ ...current, [key]: value }));

    // Auto-geocode when location text changes and no coordinates exist yet
    if (key === "location" && value.trim().length > 3) {
      void (async () => {
        try {
          const results = await api.geoSearch(value.trim() + ", Romania");
          if (results.length > 0) {
            const top = results[0];
            setProfile((current) => ({
              ...current,
              locationChoice: {
                label: top.display_name,
                lat: top.lat,
                lon: top.lon,
              },
            }));
          }
        } catch {
          // geo lookup optional — silent fail
        }
      })();
    }
  }

  function updateVenueProfileField(
    key: "businessName" | "phone" | "location" | "venueType",
    value: string,
  ) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function handleAnswer(value: string) {
    const cleanValue = value.trim();
    if (!cleanValue || typing) return;
    if (!onboardingDone && !step) return;

    const steps = getOnboardingSteps(isVenue);
    const answeredStep = step!;
    const nextProfile = { ...profile, [answeredStep.key]: cleanValue };
    const nextStepIndex = findNextStepIndex(nextProfile, currentStep + 1, isVenue);

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

    if (nextStepIndex < steps.length) {
      void addOnboardingAgentReply(answeredStep.key, cleanValue, steps[nextStepIndex].question);
      return;
    }

    if (isVenue) {
      if (answeredStep.key === "product") {
        venueChat.setNeeds(cleanValue);
      }
      void addOnboardingAgentReply(
        answeredStep.key,
        cleanValue,
        `Perfect. Cauți ${nextProfile.product || "produse locale"} în ${nextProfile.location || "Dobrogea"}.`,
      );
      if (userId && answeredStep.key === "days") {
        void loadVenueProducers("matched", nextProfile.product || cleanValue);
      }
      return;
    }

    void api.updateProfile(setupToApiPayload(nextProfile)).catch(() => undefined);
    void addOnboardingAgentReply(
      answeredStep.key,
      cleanValue,
      `Perfect. Am notat: ${nextProfile.product}, ${nextProfile.quantity}, din ${nextProfile.location}, livrare ${nextProfile.range}, în zilele ${nextProfile.days}. Deschide Director când vrei să cauți lead-uri.`,
    );
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
          activeLeadCount={isVenue ? venueProducerCount : displayLeadCount}
          activeView={dashboardView}
          onViewChange={setDashboardView}
          isVenue={isVenue}
          venueSessionNeeds={venueSessionNeeds}
          messageUnreadCount={messageUnreadCount}
          planTier={!isVenue ? (plan?.tier ?? "free") : undefined}
        />

        {dashboardView === "profile" ? (
          isVenue ? (
            <VenueProfilePage
              profile={profile}
              activeMatchCount={venueProducerCount}
              sessionNeeds={venueSessionNeeds}
              sessionFrequency={venueSessionSupplyFrequency}
              sessionPreferredDays={venueSessionPreferredDays}
              saving={profileSaving}
              saved={profileSaved}
              saveError={profileSaveError}
              onSave={() => void saveVenueProfile()}
              onLogout={() => void handleLogout()}
              onProfileFieldChange={updateVenueProfileField}
            />
          ) : (
            <ProfilePage
              profile={profile}
              activeLeadCount={displayLeadCount}
              plan={plan}
              planUpgrading={planUpgrading}
              saving={profileSaving}
              saved={profileSaved}
              saveError={profileSaveError}
              onSave={() => void saveProfile()}
              onLogout={() => void handleLogout()}
              onUpgradePro={() => void handleUpgradePro()}
              onDowngradeFree={() => void handleDowngradeFree()}
              onProductAdd={addProfileProduct}
              onProductRemove={removeProfileProduct}
              onProductUpdate={updateProfileProduct}
              onProductPatch={patchProfileProduct}
              onProfileFieldChange={updateProfileField}
            />
          )
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden bg-[#f7f3e8]">
            <section
              className={cn(
                "min-h-0 flex-1 flex-col overflow-hidden",
                dashboardView === "chat" ? "flex" : "hidden",
              )}
            >
              {!isVenue ? (
                <ChatHeader profile={profile} activeLeadCount={displayLeadCount} />
              ) : null}

              <ScrollArea className="chat-pattern min-h-0 flex-1">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-4 sm:px-5 lg:px-6">
                  <PlanBanner
                    plan={plan}
                    isVenue={isVenue}
                    onUpgrade={() => openPaywall("Treci la Pro pentru mai multe recomandări și funcții avansate.")}
                  />
                  <DatePill />
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      lead={message.kind === "lead" ? leads.find((item) => item.id === message.leadId) : undefined}
                      status={message.kind === "lead" ? leadStatuses[message.leadId] : undefined}
                      failedFeedback={message.kind === "lead" ? failedFeedbacks[message.leadId] : undefined}
                      isNewLead={
                        !isVenue &&
                        message.kind === "lead" &&
                        Boolean(message.leadId && newLeadIds.has(message.leadId))
                      }
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
                  <>
                    {isVenue && dashboardView === "chat" ? (
                      <VenueChatProgress />
                    ) : null}
                    {isVenue && onboardingDone && leads.length === 0 && venueMatchDiagnostics ? (
                      <div className="mx-auto mb-2 max-w-3xl">
                        <VenueMatchDiagnosticsPanel
                          diagnostics={venueMatchDiagnostics}
                          productLabel={venueSessionNeeds.trim() || undefined}
                          scope={venueProducerScope}
                          onShowAll={
                            venueProducerScope === "matched"
                              ? () => void searchMoreLeads()
                              : undefined
                          }
                          compact
                        />
                      </div>
                    ) : null}
                  <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-2 pb-1">
                    {!isVenue ? (
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
                    ) : null}
                    {!isVenue ? (
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
                        {leads.length === 0 ? "Caută lead-uri" : "Caută alte lead-uri"}
                      </Button>
                    ) : null}
                    {(isVenue ? venueLeadsFromChat(messages, leads) : leads.slice(0, 3)).map((lead) => (
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
                  </>
                )}

                <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-center gap-2">
                  <Input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    disabled={typing}
                    placeholder={
                      onboardingDone
                        ? isVenue
                          ? "Alege un producător sau marchează ce s-a întâmplat"
                          : "Întreabă agentul, cere alte lead-uri sau ajutor cu mesaje..."
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

            {dashboardView === "messages" ? (
              <MessagesPage
                isVenue={isVenue}
                isActive={dashboardView === "messages"}
                pendingCounterpartId={pendingChatCounterpartId}
                onPendingCounterpartHandled={() => setPendingChatCounterpartId(null)}
                onUnreadCountChange={setMessageUnreadCount}
              />
            ) : null}

            {dashboardView === "director" ? (
              <div className="flex min-h-0 flex-1 overflow-hidden">
                <DirectorPage
                  leads={leads}
                  statuses={leadStatuses}
                  failedFeedbacks={failedFeedbacks}
                  newLeadIds={!isVenue ? newLeadIds : undefined}
                  searchingMore={searchingMoreLeads}
                  products={profile.products ?? []}
                  productChips={
                    isVenue
                      ? venueSessionNeeds
                          .split(/[,;]+/)
                          .map((item) => item.trim())
                          .filter(Boolean)
                          .slice(0, 6)
                      : undefined
                  }
                  isVenue={isVenue}
                  venueProducerScope={venueProducerScope}
                  onVenueProducerScopeChange={(scope) => {
                    setVenueProducerScope(scope);
                    void loadVenueProducers(scope);
                  }}
                  onSearchMore={
                    isVenue
                      ? venueProducerScope === "matched"
                        ? () => void searchMoreLeads()
                        : undefined
                      : () => void searchMoreLeads()
                  }
                  searchMoreLabel={
                    !isVenue && leads.length === 0 ? "Caută lead-uri" : undefined
                  }
                  onDetails={setSelectedLead}
                  onMessage={openMessageLead}
                  onStatus={updateLeadStatus}
                  onWhatsAppClick={handleWhatsAppRedirect}
                  onFailedClick={setFailedLeadDialog}
                  matchDiagnostics={isVenue ? venueMatchDiagnostics : undefined}
                  matchProductLabel={isVenue ? venueSessionNeeds.trim() || undefined : undefined}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>

      <MobileBottomNav
        activeView={dashboardView}
        onViewChange={setDashboardView}
        messageUnreadCount={messageUnreadCount}
      />
      <ProPaywallDialog
        open={paywallOpen}
        message={paywallMessage}
        upgrading={planUpgrading}
        onOpenChange={setPaywallOpen}
        onUpgrade={() => void handleUpgradePro()}
      />
      <LeadDetailsDialog
        lead={selectedLead}
        planTier={plan?.tier ?? "free"}
        isVenue={isVenue}
        open={Boolean(selectedLead)}
        onOpenChange={(open) => !open && setSelectedLead(null)}
      />
      <ContactMessageDialog
        lead={messageLead}
        draft={messageDraft}
        loading={messageDraftLoading}
        open={Boolean(messageLead)}
        onOpenChange={(open) => !open && setMessageLead(null)}
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
          <DialogHeader className="text-left">
            <DialogTitle className="text-[#263421] font-extrabold text-xl">De ce nu a mers contactarea?</DialogTitle>
            <DialogDescription className="text-[#62705a]">
              {isVenue
                ? "Vom ține cont de acest motiv la recomandările viitoare de producători."
                : "AI-ul va stoca acest motiv pentru a exclude recomandările similare în viitor."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-xs font-bold uppercase text-[#5a654f] tracking-wider">Sugestii rapide de feedback</p>
            <div className="flex flex-col gap-2">
              {(isVenue ? venueFailedSuggestions : producerFailedSuggestions).map((suggestion) => (
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


function venueDashboardTitle(activeView: DashboardView, profile: Profile) {
  if (activeView === "director") return "Director producători";
  if (activeView === "messages") return "Mesaje";
  if (activeView === "profile") return "Profil local";
  return profile.businessName?.trim() || "Localul tău";
}

function venueDashboardIcon(activeView: DashboardView, venueType?: Profile["venueType"]) {
  if (activeView === "director") return LayoutGrid;
  if (activeView === "messages") return Inbox;
  if (activeView === "profile") return UserRound;
  const icons = {
    restaurant: Utensils,
    hotel: Building2,
    cafe: Coffee,
    shop: Store,
    deli: Wine,
  } as const;
  return icons[venueType ?? "restaurant"] ?? Store;
}

function venueDashboardSubtitle(activeView: DashboardView, profile: Profile, producerCount: number) {
  const location = profile.location?.trim() || "Dobrogea";
  if (activeView === "director") {
    return `${producerCount} potriviți · ${location}`;
  }
  if (activeView === "messages") {
    return "Conversații directe cu producători înregistrați";
  }
  if (activeView === "profile") {
    return [profile.businessName, location].filter(Boolean).join(" · ");
  }
  return `${location} · spune asistentului ce produse cauți`;
}

function DashboardHeader({
  profile,
  activeLeadCount,
  activeView,
  onViewChange,
  isVenue = false,
  venueSessionNeeds = "",
  messageUnreadCount = 0,
  planTier,
}: {
  profile: Profile;
  activeLeadCount: number;
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  isVenue?: boolean;
  venueSessionNeeds?: string;
  messageUnreadCount?: number;
  planTier?: "free" | "pro";
}) {
  const productSummary = summarizeProducts(profile.products);
  const title = isVenue
    ? venueDashboardTitle(activeView, profile)
    : "Warm Leads";
  const subtitle = isVenue
    ? venueDashboardSubtitle(activeView, profile, activeLeadCount)
    : activeView === "messages"
      ? "Conversații directe cu localuri înregistrate"
      : `${productSummary.product || "Produse"} · ${profile.location || "Dobrogea"} · ${activeLeadCount} lead-uri`;
  const HeaderIcon = isVenue ? venueDashboardIcon(activeView, profile.venueType) : Wheat;

  return (
    <header className="shrink-0 border-b border-[#d7ccb3] bg-[#fbf7ed] px-3 py-2.5 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9f0dc] text-[#4d6638]">
            <HeaderIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold text-[#263421]">{title}</p>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {!isVenue && planTier ? (
            <Badge variant={planTier === "pro" ? "olive" : "warm"}>
              {planTier === "pro" ? "Pro plan" : "Free plan"}
            </Badge>
          ) : null}
          <div className="hidden rounded-full border border-[#ded5bf] bg-[#fffaf0] p-1 md:flex">
            <DashboardNavButton active={activeView === "chat"} icon={MessageCircle} label="Asistent" onClick={() => onViewChange("chat")} />
            <DashboardNavButton active={activeView === "director"} icon={LayoutGrid} label="Director" onClick={() => onViewChange("director")} />
            <DashboardNavButton
              active={activeView === "messages"}
              icon={Inbox}
              label="Mesaje"
              badge={messageUnreadCount}
              onClick={() => onViewChange("messages")}
            />
            <DashboardNavButton active={activeView === "profile"} icon={UserRound} label="Profil" onClick={() => onViewChange("profile")} />
          </div>
        </div>
      </div>
    </header>
  );
}

function DashboardNavButton({
  active,
  icon: Icon,
  label,
  badge = 0,
  onClick,
}: {
  active: boolean;
  icon: typeof MessageCircle;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition",
        active ? "bg-[#4d6638] text-white shadow-sm" : "text-[#526047] hover:bg-[#f1eadb]",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
      {badge > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
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
  messageUnreadCount = 0,
}: {
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  messageUnreadCount?: number;
}) {
  const items: Array<{ id: DashboardView; label: string; icon: typeof MessageCircle; badge?: number }> = [
    { id: "chat", label: "Asistent", icon: MessageCircle },
    { id: "director", label: "Director", icon: LayoutGrid },
    { id: "messages", label: "Mesaje", icon: Inbox, badge: messageUnreadCount },
    { id: "profile", label: "Profil", icon: UserRound },
  ];

  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 rounded-[24px] border border-[#d7ccb3] bg-[#fffaf0]/95 p-2 shadow-warm backdrop-blur md:hidden">
      <div className="grid grid-cols-4 gap-1">
        {items.map(({ id, label, icon: Icon, badge = 0 }) => {
          const active = activeView === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onViewChange(id)}
              className={cn(
                "relative flex h-14 flex-col items-center justify-center gap-1 rounded-[18px] text-[10px] font-extrabold transition",
                active ? "bg-[#4d6638] text-white" : "text-[#526047] hover:bg-[#f1eadb]",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
              {badge > 0 ? (
                <span className="absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
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
            <h1 className="truncate text-base font-extrabold text-[#24311f]">Asistent de vânzări</h1>
            <p className="truncate text-sm text-muted-foreground">
              {profile.location || "Dobrogea"} · recomandări și contact lead-uri
            </p>
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
  const label = new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="flex justify-center">
      <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-[#6b715f] shadow-sm">
        Azi, {label}
      </span>
    </div>
  );
}


function MessageBubble({
  message,
  lead,
  status,
  failedFeedback,
  isNewLead = false,
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
  isNewLead?: boolean;
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
            isNewLead={isNewLead}
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
  isNewLead = false,
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
  isNewLead?: boolean;
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
              {!isVenue && isNewLead ? (
                <Badge variant="warm" className="shrink-0">Lead nou</Badge>
              ) : null}
              {!isVenue && lead.platformRegistered ? <PlatformRegisteredBadge /> : null}
              {lead.verified ? (
                <Badge variant="olive" className="shrink-0">Verificat</Badge>
              ) : null}
              {lead.match >= 85 ? (
                <Badge variant="warm" className="shrink-0">Top match</Badge>
              ) : null}
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
        {!isVenue ? (
          <div className="rounded-2xl bg-[#f5f0e5] p-3">
            <p className="text-sm font-semibold text-[#29361f]">Îl recomand pentru că...</p>
            <p className="mt-1 text-sm text-[#5a654f]">{lead.reason}</p>
          </div>
        ) : null}

        {failedFeedback ? (
          <div className="rounded-2xl border border-[#ead2cc] bg-[#fdf0ec] p-3 text-sm font-semibold text-[#884636] flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[#884636] mt-0.5" />
            <div>
              <p className="font-bold">Contact eșuat</p>
              <p className="text-xs mt-0.5 text-[#9a5141] font-medium">{failedFeedback}</p>
            </div>
          </div>
        ) : null}

        {isVenue ? (
          <ProducerOfferList sell={lead.sell} />
        ) : (
          <p className="text-sm text-[#44533d]">
            <span className="font-bold">Ai putea să-i vinzi:</span> {lead.sell}
          </p>
        )}

        {isVenue ? <MatchWhySection lead={lead} isVenue /> : null}

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
          {lead.notes && isVenue ? (
            <div className="sm:col-span-2 rounded-xl border border-[#eadfca] bg-[#fffbf2] p-2 mt-1">
              <span className="mb-0.5 block font-bold text-[#33412c]">ℹ️ Detalii platformă:</span>
              <span className="text-[#5a654f] italic">{lead.notes}</span>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant="outline" size="sm" className="min-h-11" onClick={() => onDetails(lead)}>
            <BadgeCheck className="h-4 w-4" />
            Detalii
          </Button>
          <Button variant="honey" size="sm" className="min-h-11" onClick={() => onMessage(lead)}>
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
  planTier,
  isVenue = false,
  open,
  onOpenChange,
}: {
  lead: Lead | null;
  planTier: "free" | "pro";
  isVenue?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!lead) return null;
  const Icon = leadIcon(lead.icon);
  const isPro = planTier === "pro";
  const pro = lead.proDetails;
  const sources = isPro && pro?.sourceUrls.length ? pro.sourceUrls : lead.sourceUrls ?? [];
  const notes = isPro && pro?.notes ? pro.notes : lead.notes;
  const menuText = isPro && pro?.menuItems ? pro.menuItems : lead.menuItems;
  const reasonText = isPro && pro?.extendedReason ? pro.extendedReason : lead.reason;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,760px)] w-[calc(100vw-1rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-[24px] border-[#d7ccb3] bg-[#fffdfa] p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 space-y-2 border-b border-[#eadfca] px-4 py-4 pr-12 text-left sm:px-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e9f0dc] text-[#4d6638]">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-base font-extrabold leading-tight sm:text-lg">
                  {lead.name}
                </DialogTitle>
                {!isVenue && lead.platformRegistered ? <PlatformRegisteredBadge /> : null}
              </div>
              <DialogDescription className="mt-1 line-clamp-2 text-xs sm:text-sm">
                {lead.type} · {lead.location}
              </DialogDescription>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="blue">{lead.match}% potrivire</Badge>
                <Badge variant="warm">{lead.distance}</Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <DetailRow icon={CalendarDays} label="Moment bun" value={lead.bestDay} />
            {lead.phone ? (
              <DetailRow
                icon={Phone}
                label="Telefon"
                value={lead.contactPerson ? `${lead.phone} · ${lead.contactPerson}` : lead.phone}
              />
            ) : isPro && pro?.contactPerson ? (
              <DetailRow icon={UserRound} label="Persoană contact" value={pro.contactPerson} />
            ) : null}
          </div>

          {lead.website ? (
            <DetailLinkRow icon={Globe} label="Website" href={normalizeUrl(lead.website)} text={lead.website} />
          ) : null}

          <InfoBlock
            title={isVenue ? "Recomand pentru că" : "Îl recomand pentru că"}
            text={reasonText}
            collapsible
          />

          <InfoBlock title={isVenue ? "Oferă" : "Ai putea să-i vinzi"} text={lead.sell} />

          {menuText ? (
            <InfoBlock
              title={isVenue ? "Produse disponibile" : "Meniu / ofertă"}
              text={menuText}
              collapsible
            />
          ) : null}

          {notes ? (
            <InfoBlock
              title={isVenue ? "Detalii platformă" : "Informații din surse web"}
              text={notes}
              collapsible={!isVenue}
            />
          ) : null}

          {isPro && pro?.statusTimeline.length ? <StatusTimeline steps={pro.statusTimeline} /> : null}

          {sources.length && !isVenue ? (
            <SourceUrlsList urls={sources} title="Surse online" initialCount={3} />
          ) : null}

          <div className="rounded-2xl border border-[#ded5bf] bg-[#fffaf0] p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#6b715f]">
              Mesaj sugerat
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[#34422d]">{lead.contact}</p>
          </div>
        </div>
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
    <div className="flex items-start gap-2.5 rounded-xl bg-[#f6f1e6] px-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e9f0dc] text-[#4d6638]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#6b715f]">{label}</p>
        <p className="text-sm font-semibold leading-snug text-[#263421]">{value}</p>
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
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 rounded-xl bg-[#f6f1e6] px-3 py-2.5 transition hover:bg-[#efe8d8]"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e9f0dc] text-[#4d6638]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#6b715f]">{label}</p>
        <p className="truncate text-sm font-semibold text-[#4d6638]">{shortenUrl(text)}</p>
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 text-[#4d6638]" />
    </a>
  );
}

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url.replace(/^\/+/, "")}`;
}

function shortenUrl(url: string): string {
  try {
    const parsed = new URL(normalizeUrl(url));
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    const label = `${host}${path}`;
    return label.length > 48 ? `${label.slice(0, 48)}…` : label;
  } catch {
    return url.length > 48 ? `${url.slice(0, 48)}…` : url;
  }
}

function formatSourceLabel(url: string, index: number): string {
  if (url.includes("vertexaisearch.cloud.google.com")) {
    return `Sursă web ${index + 1}`;
  }
  return shortenUrl(url);
}

function InfoBlock({
  title,
  text,
  collapsible = false,
}: {
  title: string;
  text: string;
  collapsible?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 180;

  return (
    <section className="rounded-xl bg-[#f6f1e6] px-3 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#6b715f]">{title}</p>
      <p
        className={cn(
          "mt-1.5 text-sm leading-relaxed text-[#34422d]",
          collapsible && isLong && !expanded && "line-clamp-4",
        )}
      >
        {text}
      </p>
      {collapsible && isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-xs font-bold text-[#4d6638] hover:underline"
        >
          {expanded ? "Arată mai puțin" : "Citește tot"}
        </button>
      ) : null}
    </section>
  );
}

function SourceUrlsList({
  urls,
  title,
  initialCount = 3,
}: {
  urls: string[];
  title: string;
  initialCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? urls : urls.slice(0, initialCount);
  const hiddenCount = Math.max(0, urls.length - initialCount);

  return (
    <section className="rounded-xl bg-[#f6f1e6] px-3 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#6b715f]">
        {title} ({urls.length})
      </p>
      <ul className="mt-2 space-y-1.5">
        {visible.map((url, index) => (
          <li key={`${url}-${index}`}>
            <a
              href={normalizeUrl(url)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-[#e5dcc8] bg-white/80 px-2.5 py-2 text-sm font-semibold text-[#4d6638] transition hover:bg-white"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">{formatSourceLabel(url, index)}</span>
            </a>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-xs font-bold text-[#4d6638] hover:underline"
        >
          {expanded ? "Ascunde sursele" : `Arată toate (${urls.length})`}
        </button>
      ) : null}
    </section>
  );
}

function StatusTimeline({
  steps,
}: {
  steps: Array<{ step: LeadStatus; reached: boolean; current: boolean }>;
}) {
  return (
    <section className="rounded-xl border border-[#c8d9aa] bg-[#f0f5e8] px-3 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#5a7150]">Istoric status</p>
      <ol className="mt-3 space-y-2">
        {steps.map((item) => (
          <li
            key={item.step}
            className={cn(
              "flex items-center gap-2 text-sm",
              item.current
                ? "font-bold text-[#3f532c]"
                : item.reached
                  ? "text-[#526047]"
                  : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                item.current ? "bg-[#4d6638]" : item.reached ? "bg-[#9aa587]" : "bg-[#d7ccb3]",
              )}
            />
            {item.step}
          </li>
        ))}
      </ol>
    </section>
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
