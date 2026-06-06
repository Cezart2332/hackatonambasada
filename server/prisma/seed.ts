import { LeadIcon, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const demoLeads: Array<{
  id: string;
  name: string;
  type: string;
  location: string;
  latitude: number;
  longitude: number;
  baseMatch: number;
  reason: string;
  sell: string;
  bestDay: string;
  contact: string;
  tone: string;
  icon: LeadIcon;
}> = [
  {
    id: "lead-1",
    name: "Casa Dobrogean\u0103",
    type: "restaurant cu meniu local",
    location: "Constan\u021ba, zona Peninsul\u0103",
    latitude: 44.1787,
    longitude: 28.6538,
    baseMatch: 94,
    reason:
      "are mic dejun local \u0219i men\u021bioneaz\u0103 furnizori din Dobrogea \u00een meniu.",
    sell: "borcane mici pentru mic dejun, platouri cu br\u00e2nzeturi sau cadouri pentru turi\u0219ti.",
    bestDay: "Mar\u021bi diminea\u021ba, \u00eenainte de preg\u0103tirea meniului de pr\u00e2nz.",
    contact:
      "Bun\u0103 ziua, sunt produc\u0103tor local din Dobrogea \u0219i am v\u0103zut c\u0103 pune\u021bi accent pe produse locale \u00een meniu. S\u0103pt\u0103m\u00e2na aceasta am disponibil\u0103 miere proasp\u0103t\u0103, potrivit\u0103 pentru mic dejun \u0219i deserturi. Dac\u0103 v\u0103 este util, v\u0103 pot trimite o list\u0103 scurt\u0103 cu cantit\u0103\u021bi \u0219i pre\u021buri.",
    tone: "cald, direct, potrivit pentru un restaurant care lucreaz\u0103 cu produse locale",
    icon: LeadIcon.restaurant,
  },
  {
    id: "lead-2",
    name: "Hotel Sulina International",
    type: "hotel de litoral",
    location: "Mamaia",
    latitude: 44.2482,
    longitude: 28.6201,
    baseMatch: 89,
    reason:
      "serve\u0219te turi\u0219ti la mic dejun \u0219i poate cump\u0103ra produse locale ambalate simplu.",
    sell: "miere por\u021bionat\u0103, br\u00e2nzeturi pentru bufet sau pachete de bun venit.",
    bestDay: "Joi dup\u0103-amiaz\u0103, c\u00e2nd preg\u0103tesc aprovizionarea pentru weekend.",
    contact:
      "Bun\u0103 ziua, sunt produc\u0103tor local din Dobrogea. Am v\u0103zut c\u0103 primi\u021bi mul\u021bi turi\u0219ti pe litoral \u0219i cred c\u0103 produsele locale ar merge bine la micul dejun sau \u00een pachete de bun venit. S\u0103pt\u0103m\u00e2na aceasta am marf\u0103 disponibil\u0103 \u0219i pot livra \u00een Mamaia. V\u0103 pot trimite c\u00e2teva op\u021biuni simple?",
    tone: "politicos, orientat spre sezon \u0219i turi\u0219ti",
    icon: LeadIcon.hotel,
  },
  {
    id: "lead-3",
    name: "Cafeneaua Arabica",
    type: "cafenea",
    location: "Constan\u021ba, Tomis Nord",
    latitude: 44.2047,
    longitude: 28.6204,
    baseMatch: 83,
    reason:
      "vinde cafea, deserturi \u0219i produse mici de luat acas\u0103 pentru clien\u021bi fideli.",
    sell: "miere pentru ceai, pr\u0103jituri, cutii mici sau borcane la raft.",
    bestDay: "Vineri diminea\u021ba, c\u00e2nd traficul de weekend cre\u0219te.",
    contact:
      "Bun\u0103 ziua, sunt produc\u0103tor local din Dobrogea. Am v\u0103zut c\u0103 ave\u021bi cafenea \u00een Constan\u021ba \u0219i cred c\u0103 mierea local\u0103 ar merge bine l\u00e2ng\u0103 ceai, cafea sau deserturi. Am c\u00e2teva borcane preg\u0103tite pentru livrare s\u0103pt\u0103m\u00e2na aceasta. Pot s\u0103 v\u0103 trimit detaliile?",
    tone: "scurt, uman, f\u0103r\u0103 presiune",
    icon: LeadIcon.cafe,
  },
  {
    id: "lead-4",
    name: "B\u0103c\u0103nia Pontica",
    type: "b\u0103c\u0103nie cu produse locale",
    location: "Eforie Nord",
    latitude: 44.0667,
    longitude: 28.6333,
    baseMatch: 81,
    reason:
      "vinde produse pentru turi\u0219ti \u0219i are raft dedicat pentru produc\u0103tori locali.",
    sell: "borcane etichetate, loturi mici pentru test sau pachete mixte.",
    bestDay: "Miercuri, \u00eenainte de aprovizionarea pentru final de s\u0103pt\u0103m\u00e2n\u0103.",
    contact:
      "Bun\u0103 ziua, sunt produc\u0103tor local din Dobrogea \u0219i am produse disponibile pentru livrare s\u0103pt\u0103m\u00e2na aceasta. Am v\u0103zut c\u0103 lucra\u021bi cu produse locale pentru turi\u0219ti \u0219i cred c\u0103 mierea mea s-ar potrivi bine la raft. V\u0103 pot trimite cantit\u0103\u021bile \u0219i c\u00e2teva poze?",
    tone: "practic, bun pentru un magazin care testeaz\u0103 loturi mici",
    icon: LeadIcon.shop,
  },
  {
    id: "lead-5",
    name: "Delicatese Tomitana",
    type: "delicatese \u0219i vinuri",
    location: "Mangalia",
    latitude: 43.8151,
    longitude: 28.5747,
    baseMatch: 76,
    reason:
      "asociaz\u0103 vinuri dobrogene cu br\u00e2nzeturi, miere \u0219i produse cadou.",
    sell: "pachete cu miere, br\u00e2nzeturi maturate sau recomand\u0103ri pentru degust\u0103ri.",
    bestDay: "Luni sau joi, c\u00e2nd preg\u0103tesc comenzile pentru clien\u021bi.",
    contact:
      "Bun\u0103 ziua, sunt produc\u0103tor local din Dobrogea. Am v\u0103zut c\u0103 ave\u021bi delicatese \u0219i vinuri, iar produsele mele s-ar putea potrivi \u00een pachete locale sau degust\u0103ri. S\u0103pt\u0103m\u00e2na aceasta pot livra \u00een Mangalia. V\u0103 pot trimite o ofert\u0103 scurt\u0103?",
    tone: "premium, dar simplu \u0219i natural",
    icon: LeadIcon.deli,
  },
];

async function main() {
  for (const lead of demoLeads) {
    await prisma.lead.upsert({
      where: { id: lead.id },
      create: lead,
      update: lead,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });