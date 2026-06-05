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
  MapPin,
  Menu,
  MessageCircle,
  Milk,
  PackageCheck,
  Send,
  Sparkles,
  ThumbsDown,
  Truck,
  Utensils,
  Wheat,
  Wine,
  X,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type ProfileKey = "product" | "quantity" | "location" | "range" | "days";

type Profile = Partial<Record<ProfileKey, string>>;

type ChatMessage =
  | {
      id: string;
      role: "agent" | "user";
      kind: "text";
      text: string;
      time: string;
    }
  | {
      id: string;
      role: "agent";
      kind: "lead";
      leadId: string;
      time: string;
    };

type LeadStatus = "Bun" | "Nu e potrivit" | "Contactat" | "A răspuns" | "A cumpărat";

type Lead = {
  id: string;
  name: string;
  type: string;
  location: string;
  distance: string;
  match: number;
  reason: string;
  sell: string;
  bestDay: string;
  contact: string;
  tone: string;
  icon: "restaurant" | "hotel" | "cafe" | "shop" | "deli";
};

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

const demoLeads: Lead[] = [
  {
    id: "lead-1",
    name: "Casa Dobrogeană",
    type: "restaurant cu meniu local",
    location: "Constanța, zona Peninsulă",
    distance: "28 km",
    match: 94,
    reason: "are mic dejun local și menționează furnizori din Dobrogea în meniu.",
    sell: "borcane mici pentru mic dejun, platouri cu brânzeturi sau cadouri pentru turiști.",
    bestDay: "Marți dimineața, înainte de pregătirea meniului de prânz.",
    contact:
      "Bună ziua, sunt producător local din Dobrogea și am văzut că puneți accent pe produse locale în meniu. Săptămâna aceasta am disponibilă miere proaspătă, potrivită pentru mic dejun și deserturi. Dacă vă este util, vă pot trimite o listă scurtă cu cantități și prețuri.",
    tone: "cald, direct, potrivit pentru un restaurant care lucrează cu produse locale",
    icon: "restaurant",
  },
  {
    id: "lead-2",
    name: "Hotel Sulina International",
    type: "hotel de litoral",
    location: "Mamaia",
    distance: "34 km",
    match: 89,
    reason: "servește turiști la mic dejun și poate cumpăra produse locale ambalate simplu.",
    sell: "miere porționată, brânzeturi pentru bufet sau pachete de bun venit.",
    bestDay: "Joi după-amiază, când pregătesc aprovizionarea pentru weekend.",
    contact:
      "Bună ziua, sunt producător local din Dobrogea. Am văzut că primiți mulți turiști pe litoral și cred că produsele locale ar merge bine la micul dejun sau în pachete de bun venit. Săptămâna aceasta am marfă disponibilă și pot livra în Mamaia. Vă pot trimite câteva opțiuni simple?",
    tone: "politicos, orientat spre sezon și turiști",
    icon: "hotel",
  },
  {
    id: "lead-3",
    name: "Cafeneaua Arabica",
    type: "cafenea",
    location: "Constanța, Tomis Nord",
    distance: "24 km",
    match: 83,
    reason: "vinde cafea, deserturi și produse mici de luat acasă pentru clienți fideli.",
    sell: "miere pentru ceai, prăjituri, cutii mici sau borcane la raft.",
    bestDay: "Vineri dimineața, când traficul de weekend crește.",
    contact:
      "Bună ziua, sunt producător local din Dobrogea. Am văzut că aveți cafenea în Constanța și cred că mierea locală ar merge bine lângă ceai, cafea sau deserturi. Am câteva borcane pregătite pentru livrare săptămâna aceasta. Pot să vă trimit detaliile?",
    tone: "scurt, uman, fără presiune",
    icon: "cafe",
  },
  {
    id: "lead-4",
    name: "Băcănia Pontica",
    type: "băcănie cu produse locale",
    location: "Eforie Nord",
    distance: "41 km",
    match: 81,
    reason: "vinde produse pentru turiști și are raft dedicat pentru producători locali.",
    sell: "borcane etichetate, loturi mici pentru test sau pachete mixte.",
    bestDay: "Miercuri, înainte de aprovizionarea pentru final de săptămână.",
    contact:
      "Bună ziua, sunt producător local din Dobrogea și am produse disponibile pentru livrare săptămâna aceasta. Am văzut că lucrați cu produse locale pentru turiști și cred că mierea mea s-ar potrivi bine la raft. Vă pot trimite cantitățile și câteva poze?",
    tone: "practic, bun pentru un magazin care testează loturi mici",
    icon: "shop",
  },
  {
    id: "lead-5",
    name: "Delicatese Tomitana",
    type: "delicatese și vinuri",
    location: "Mangalia",
    distance: "56 km",
    match: 76,
    reason: "asociază vinuri dobrogene cu brânzeturi, miere și produse cadou.",
    sell: "pachete cu miere, brânzeturi maturate sau recomandări pentru degustări.",
    bestDay: "Luni sau joi, când pregătesc comenzile pentru clienți.",
    contact:
      "Bună ziua, sunt producător local din Dobrogea. Am văzut că aveți delicatese și vinuri, iar produsele mele s-ar putea potrivi în pachete locale sau degustări. Săptămâna aceasta pot livra în Mangalia. Vă pot trimite o ofertă scurtă?",
    tone: "premium, dar simplu și natural",
    icon: "deli",
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

function App() {
  const [activeConversation, setActiveConversation] = useState("warm");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "m-1",
      role: "agent",
      kind: "text",
      text: "Bună! Eu sunt Warm Leads. Te ajut să găsești afaceri locale care ar putea cumpăra de la tine săptămâna asta.",
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
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messageLead, setMessageLead] = useState<Lead | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const onboardingDone = currentStep >= onboardingSteps.length;
  const step = onboardingSteps[currentStep];

  const activeLeadCount = useMemo(
    () => Object.values(leadStatuses).filter((status) => status !== "Nu e potrivit").length,
    [leadStatuses],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing, leadStatuses]);

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

  function addRecommendations(delay = 740) {
    setTyping(true);
    window.setTimeout(() => {
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "agent",
          kind: "text",
          text: "Am găsit câteva locuri bune. Îți las mai jos lead-urile și de ce cred că merită încercate.",
          time: now(),
        },
        ...demoLeads.map<ChatMessage>((lead) => ({
          id: crypto.randomUUID(),
          role: "agent",
          kind: "lead",
          leadId: lead.id,
          time: now(),
        })),
      ]);
      setTyping(false);
    }, delay);
  }

  function handleAnswer(value: string) {
    const cleanValue = value.trim();
    if (!cleanValue || !step || typing) return;

    const answeredStep = step;
    const nextStepIndex = currentStep + 1;
    const nextProfile = { ...profile, [answeredStep.key]: cleanValue };

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
      addAgentText(onboardingSteps[nextStepIndex].question);
      return;
    }

    addAgentText(
      `Perfect. Am notat: ${nextProfile.product}, ${nextProfile.quantity}, din ${nextProfile.location}, livrare ${nextProfile.range}, în zilele ${nextProfile.days}.`,
      520,
    );
    addRecommendations(1100);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleAnswer(input);
  }

  function updateLeadStatus(lead: Lead, status: LeadStatus) {
    setLeadStatuses((current) => ({ ...current, [lead.id]: status }));

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
    navigator.clipboard?.writeText(messageLead.contact);
  }

  return (
    <main className="min-h-[100dvh] bg-[#eef2e7] p-0 text-foreground md:p-4">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1440px] overflow-hidden border-[#d9d0b8] bg-card shadow-warm md:min-h-[calc(100dvh-2rem)] md:rounded-[28px] md:border">
        <aside
          className={cn(
            "min-h-[100dvh] w-full flex-col border-r border-[#ded5bf] bg-[#fbf7ed] md:flex md:min-h-0 md:w-[380px]",
            mobileChatOpen ? "hidden" : "flex",
          )}
        >
          <SidebarHeader />
          <ScrollArea className="flex-1">
            <div className="px-3 pb-4">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => {
                    setActiveConversation(conversation.id);
                    setMobileChatOpen(true);
                  }}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[#f1eadb]",
                    activeConversation === conversation.id && "bg-[#eaf0df]",
                  )}
                >
                  <AgentAvatar small={conversation.id !== "warm"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-bold text-[#25311f]">{conversation.title}</p>
                      <span className="text-xs text-muted-foreground">{conversation.time}</span>
                    </div>
                    <p className="truncate text-xs font-semibold text-[#6d735e]">{conversation.subtitle}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{conversation.preview}</p>
                  </div>
                  {conversation.unread > 0 ? (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e3a72f] px-1.5 text-xs font-bold text-[#24311f]">
                      {conversation.unread}
                    </span>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
          <ProducerSnapshot profile={profile} activeLeadCount={activeLeadCount} />
        </aside>

        <section
          className={cn(
            "min-h-[100dvh] w-full flex-1 flex-col bg-[#f7f3e8] md:flex md:min-h-0",
            mobileChatOpen ? "flex" : "hidden",
          )}
        >
          <ChatHeader
            onBack={() => setMobileChatOpen(false)}
            profile={profile}
            activeLeadCount={activeLeadCount}
          />

          <ScrollArea className="chat-pattern flex-1">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-3 py-5 sm:px-5 lg:px-8">
              <DatePill />
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  lead={message.kind === "lead" ? demoLeads.find((item) => item.id === message.leadId) : undefined}
                  status={message.kind === "lead" ? leadStatuses[message.leadId] : undefined}
                  onDetails={setSelectedLead}
                  onMessage={setMessageLead}
                  onStatus={updateLeadStatus}
                />
              ))}
              {typing ? <TypingBubble /> : null}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-[#d7ccb3] bg-[#f8f4ea]/95 px-3 py-3 backdrop-blur sm:px-5">
            {!onboardingDone && step ? (
              <div className="mx-auto mb-2 flex max-w-4xl gap-2 overflow-x-auto pb-1 no-scrollbar">
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
              <div className="mx-auto mb-2 flex max-w-4xl gap-2 overflow-x-auto pb-1 no-scrollbar">
                {demoLeads.slice(0, 3).map((lead) => (
                  <Button
                    key={lead.id}
                    type="button"
                    size="sm"
                    variant="chip"
                    onClick={() => setMessageLead(lead)}
                    className="shrink-0"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Scrie către {lead.name}
                  </Button>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mx-auto flex max-w-4xl items-center gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={onboardingDone || typing}
                placeholder={onboardingDone ? "Alege un lead sau marchează ce s-a întâmplat" : step?.placeholder}
                className="bg-white/90"
              />
              <Button type="submit" size="icon" variant="honey" disabled={!input.trim() || onboardingDone || typing}>
                <Send className="h-4 w-4" />
                <span className="sr-only">Trimite</span>
              </Button>
            </form>
          </div>
        </section>
      </div>

      <LeadDetailsSheet lead={selectedLead} open={Boolean(selectedLead)} onOpenChange={(open) => !open && setSelectedLead(null)} />
      <ContactMessageDialog
        lead={messageLead}
        open={Boolean(messageLead)}
        onOpenChange={(open) => !open && setMessageLead(null)}
        onCopy={copySuggestedMessage}
      />
    </main>
  );
}

function SidebarHeader() {
  return (
    <div className="border-b border-[#ded5bf] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xl font-extrabold text-[#263421]">Warm Leads</p>
          <p className="text-sm text-muted-foreground">Lead-uri locale, pe înțelesul tău</p>
        </div>
        <Button size="icon" variant="outline" aria-label="Meniu">
          <Menu className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {productIcons.map(({ label, icon: Icon, className }) => (
          <div
            key={label}
            title={label}
            className={cn("flex h-11 items-center justify-center rounded-2xl", className)}
          >
            <Icon className="h-5 w-5" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProducerSnapshot({ profile, activeLeadCount }: { profile: Profile; activeLeadCount: number }) {
  const items = [
    { icon: Wheat, label: profile.product || "produsul tău" },
    { icon: PackageCheck, label: profile.quantity || "cantitate" },
    { icon: MapPin, label: profile.location || "localitate" },
  ];

  return (
    <div className="border-t border-[#ded5bf] p-4">
      <Card className="border-[#d7ccb3] bg-[#fffaf0] shadow-none">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm">Profil rapid</CardTitle>
            <Badge variant="warm">{activeLeadCount || demoLeads.length} lead-uri</Badge>
          </div>
          <CardDescription>Se completează din conversație.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 p-4 pt-0">
          {items.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-sm text-[#526047]">
              <Icon className="h-4 w-4 text-[#6d823c]" />
              <span className="truncate">{label}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ChatHeader({
  onBack,
  profile,
  activeLeadCount,
}: {
  onBack: () => void;
  profile: Profile;
  activeLeadCount: number;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-[#d7ccb3] bg-[#f8f4ea] px-3 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Button size="icon" variant="ghost" className="md:hidden" onClick={onBack} aria-label="Înapoi">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <AgentAvatar />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-extrabold text-[#24311f]">Warm Leads</h1>
            <Badge variant="olive" className="border-[#c8d9aa] bg-[#e8f0d7]">
              online
            </Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">Îți găsește clienți locali și îți scrie mesajul.</p>
        </div>
      </div>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Profil</span>
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Profilul producătorului</SheetTitle>
            <SheetDescription>Warm Leads îl folosește ca să explice recomandările simplu.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            <ProfileRow label="Ce vinzi" value={profile.product} icon={Wheat} />
            <ProfileRow label="Disponibil" value={profile.quantity} icon={PackageCheck} />
            <ProfileRow label="Localitate" value={profile.location} icon={MapPin} />
            <ProfileRow label="Livrare" value={profile.range} icon={Truck} />
            <ProfileRow label="Zile bune" value={profile.days} icon={CalendarDays} />
          </div>
          <div className="mt-6 rounded-2xl border border-[#d7ccb3] bg-[#fffaf0] p-4">
            <p className="text-sm font-bold text-[#263421]">Recomandări active</p>
            <p className="mt-1 text-3xl font-extrabold text-[#4b6134]">{activeLeadCount || demoLeads.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">Se ajustează când marchezi ce e bun și ce nu.</p>
          </div>
        </SheetContent>
      </Sheet>
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
        Azi, 5 iunie
      </span>
    </div>
  );
}

function AgentAvatar({ small = false }: { small?: boolean }) {
  return (
    <Avatar className={cn("border border-[#d7ccb3] bg-[#eaf0df]", small ? "h-10 w-10" : "h-11 w-11")}>
      <AvatarFallback className="bg-[#4d6638] text-[#fff7df]">
        <Handshake className={cn(small ? "h-4 w-4" : "h-5 w-5")} />
      </AvatarFallback>
    </Avatar>
  );
}

function MessageBubble({
  message,
  lead,
  status,
  onDetails,
  onMessage,
  onStatus,
}: {
  message: ChatMessage;
  lead?: Lead;
  status?: LeadStatus;
  onDetails: (lead: Lead) => void;
  onMessage: (lead: Lead) => void;
  onStatus: (lead: Lead, status: LeadStatus) => void;
}) {
  if (message.kind === "lead" && lead) {
    return (
      <div className="flex items-end gap-2">
        <AgentAvatar small />
        <div className="max-w-[760px]">
          <LeadCard lead={lead} status={status} onDetails={onDetails} onMessage={onMessage} onStatus={onStatus} />
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
  onDetails,
  onMessage,
  onStatus,
}: {
  lead: Lead;
  status?: LeadStatus;
  onDetails: (lead: Lead) => void;
  onMessage: (lead: Lead) => void;
  onStatus: (lead: Lead, status: LeadStatus) => void;
}) {
  const Icon = leadIcon(lead.icon);

  return (
    <Card className="max-w-[760px] overflow-hidden border-[#d7ccb3] bg-[#fffdf7]/95 shadow-bubble">
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

        <p className="text-sm text-[#44533d]">
          <span className="font-bold">Ai putea să-i vinzi:</span> {lead.sell}
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant="outline" size="sm" onClick={() => onDetails(lead)}>
            <BadgeCheck className="h-4 w-4" />
            Vezi detalii
          </Button>
          <Button variant="honey" size="sm" onClick={() => onMessage(lead)}>
            <MessageCircle className="h-4 w-4" />
            Scrie mesaj
          </Button>
          <Button variant="outline" size="sm" onClick={() => onStatus(lead, "Nu e potrivit")}>
            <ThumbsDown className="h-4 w-4" />
            Nu e potrivit
          </Button>
          <Button variant="default" size="sm" onClick={() => onStatus(lead, "Contactat")}>
            <Check className="h-4 w-4" />
            Am contactat
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

function StatusBadge({ status }: { status: LeadStatus }) {
  const classNameByStatus: Record<LeadStatus, string> = {
    Bun: "border-[#c8d9aa] bg-[#e8f0d7] text-[#3f532c]",
    "Nu e potrivit": "border-[#ead2cc] bg-[#fae8e4] text-[#884636]",
    Contactat: "border-[#d6c28b] bg-[#fff0bc] text-[#6f5114]",
    "A răspuns": "border-[#c7dbe3] bg-[#e7f1f4] text-[#315765]",
    "A cumpărat": "border-[#bcd5b6] bg-[#dbefd7] text-[#2f643b]",
  };

  return <Badge className={classNameByStatus[status]}>{status}</Badge>;
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

function LeadDetailsSheet({
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e9f0dc] text-[#4d6638]">
            <Icon className="h-6 w-6" />
          </div>
          <SheetTitle>{lead.name}</SheetTitle>
          <SheetDescription>
            {lead.type} · {lead.location}
          </SheetDescription>
        </SheetHeader>

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
      </SheetContent>
    </Sheet>
  );
}

function ContactMessageDialog({
  lead,
  open,
  onOpenChange,
  onCopy,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopy: () => void;
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
          </div>
          <p className="text-sm leading-relaxed text-[#2b3725]">{lead.contact}</p>
        </div>
        <div className="rounded-2xl bg-[#e9f0dc] p-3 text-sm text-[#405235]">
          Ton: {lead.tone}. Poți să-l trimiți așa sau să-l scurtezi cu detaliile tale.
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
            Închide
          </Button>
          <Button variant="honey" onClick={onCopy}>
            <Clipboard className="h-4 w-4" />
            Copiază mesajul
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
