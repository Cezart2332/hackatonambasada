import { LeadIcon, PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@flavours-of-dobrogea.ro";
const ADMIN_PASSWORD = "flavours-admin";

const DEMO_PRODUCER_EMAIL = "ana@stupina-dobrogea.ro";
const DEMO_PRODUCER_PASSWORD = "demo1234";

const DEMO_VENUE_EMAIL = "casa@dobrogea-demo.ro";
const DEMO_VENUE_PASSWORD = "demo1234";

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

async function seedAdmin() {
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      name: "Flavours of Dobrogea",
      email: ADMIN_EMAIL,
      emailVerified: true,
      accountType: "ADMIN",
      accounts: {
        create: {
          accountId: ADMIN_EMAIL,
          providerId: "credential",
          password: passwordHash,
        },
      },
    },
    update: {
      accountType: "ADMIN",
      name: "Flavours of Dobrogea",
    },
  });

  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
  const existingAccount = await prisma.account.findFirst({
    where: { userId: adminUser.id, providerId: "credential" },
  });

  if (!existingAccount) {
    await prisma.account.create({
      data: {
        userId: adminUser.id,
        accountId: ADMIN_EMAIL,
        providerId: "credential",
        password: passwordHash,
      },
    });
  } else if (!existingAccount.password) {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: { password: passwordHash },
    });
  }
}

async function upsertCredentialUser(params: {
  email: string;
  password: string;
  name: string;
  accountType: "PRODUCER" | "VENUE";
}) {
  const passwordHash = await hashPassword(params.password);

  const user = await prisma.user.upsert({
    where: { email: params.email },
    create: {
      name: params.name,
      email: params.email,
      emailVerified: true,
      accountType: params.accountType,
      accounts: {
        create: {
          accountId: params.email,
          providerId: "credential",
          password: passwordHash,
        },
      },
    },
    update: {
      name: params.name,
      accountType: params.accountType,
    },
  });

  const existingAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });

  if (!existingAccount) {
    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: params.email,
        providerId: "credential",
        password: passwordHash,
      },
    });
  } else if (!existingAccount.password) {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: { password: passwordHash },
    });
  }

  return user;
}

async function seedDemoProducer() {
  const user = await upsertCredentialUser({
    email: DEMO_PRODUCER_EMAIL,
    password: DEMO_PRODUCER_PASSWORD,
    name: "Ana Popescu",
    accountType: "PRODUCER",
  });

  await prisma.producerProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      businessName: "Stupina Dobrogea",
      phone: "+40 722 334 100",
      location: "Murfatlar",
      locationChoice: "Murfatlar, Constanța, România",
      latitude: 44.1833,
      longitude: 28.4167,
      rangeKm: 60,
      deliveryDays: "Marți și vineri dimineața",
      approvalStatus: "APPROVED",
      products: {
        create: [
          {
            name: "Miere de salcâm",
            estimatedQuantity: "40",
            unit: "borcan 400g",
            pricePerKg: "34",
            availableFrom: "2026-06-01",
          },
          {
            name: "Miere polifloră",
            estimatedQuantity: "25",
            unit: "borcan 400g",
            pricePerKg: "28",
            availableFrom: "2026-06-01",
          },
        ],
      },
    },
    update: {
      businessName: "Stupina Dobrogea",
      phone: "+40 722 334 100",
      location: "Murfatlar",
      locationChoice: "Murfatlar, Constanța, România",
      latitude: 44.1833,
      longitude: 28.4167,
      rangeKm: 60,
      deliveryDays: "Marți și vineri dimineața",
      approvalStatus: "APPROVED",
    },
  });

  const profile = await prisma.producerProfile.findUniqueOrThrow({ where: { userId: user.id } });
  await prisma.producerProduct.deleteMany({ where: { profileId: profile.id } });
  await prisma.producerProduct.createMany({
    data: [
      {
        profileId: profile.id,
        name: "Miere de salcâm",
        estimatedQuantity: "40",
        unit: "borcan 400g",
        pricePerKg: "34",
        availableFrom: "2026-06-01",
      },
      {
        profileId: profile.id,
        name: "Miere polifloră",
        estimatedQuantity: "25",
        unit: "borcan 400g",
        pricePerKg: "28",
        availableFrom: "2026-06-01",
      },
    ],
  });
}

async function seedDemoVenue() {
  const user = await upsertCredentialUser({
    email: DEMO_VENUE_EMAIL,
    password: DEMO_VENUE_PASSWORD,
    name: "Alexandru Radu",
    accountType: "VENUE",
  });

  await prisma.venueProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      businessName: "Casa Dobrogeană",
      venueType: LeadIcon.restaurant,
      phone: "+40 722 334 455",
      location: "Constanța, zona Peninsulă",
      locationChoice: "Constanța, Constanța, România",
      latitude: 44.1787,
      longitude: 28.6538,
      productsNeeded: "miere de salcâm, brânzeturi locale, legume de sezon",
      supplyFrequency: "Săptămânal",
      preferredDays: "Marți și vineri dimineața",
      approvalStatus: "APPROVED",
    },
    update: {
      businessName: "Casa Dobrogeană",
      venueType: LeadIcon.restaurant,
      phone: "+40 722 334 455",
      location: "Constanța, zona Peninsulă",
      locationChoice: "Constanța, Constanța, România",
      latitude: 44.1787,
      longitude: 28.6538,
      productsNeeded: "miere de salcâm, brânzeturi locale, legume de sezon",
      supplyFrequency: "Săptămânal",
      preferredDays: "Marți și vineri dimineața",
      approvalStatus: "APPROVED",
    },
  });
}

async function seedDemoProducer2() {
  const user = await upsertCredentialUser({
    email: "branza@babadag-demo.ro",
    password: DEMO_PRODUCER_PASSWORD,
    name: "Ion Marin",
    accountType: "PRODUCER",
  });

  await prisma.producerProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      businessName: "Brânzăria din Babadag",
      phone: "+40 733 445 200",
      location: "Babadag",
      locationChoice: "Babadag, Tulcea, România",
      latitude: 44.8972,
      longitude: 28.7233,
      rangeKm: 80,
      deliveryDays: "Joi după-amiază",
      approvalStatus: "APPROVED",
      products: {
        create: [
          {
            name: "Brânză de capră",
            estimatedQuantity: "30",
            unit: "kg",
            pricePerKg: "42",
            availableFrom: "2026-06-01",
          },
          {
            name: "Telemea de vacă",
            estimatedQuantity: "50",
            unit: "kg",
            pricePerKg: "28",
            availableFrom: "2026-06-01",
          },
        ],
      },
    },
    update: {
      businessName: "Brânzăria din Babadag",
      phone: "+40 733 445 200",
      location: "Babadag",
      locationChoice: "Babadag, Tulcea, România",
      latitude: 44.8972,
      longitude: 28.7233,
      rangeKm: 80,
      deliveryDays: "Joi după-amiază",
      approvalStatus: "APPROVED",
    },
  });

  const profile = await prisma.producerProfile.findUniqueOrThrow({ where: { userId: user.id } });
  await prisma.producerProduct.deleteMany({ where: { profileId: profile.id } });
  await prisma.producerProduct.createMany({
    data: [
      {
        profileId: profile.id,
        name: "Brânză de capră",
        estimatedQuantity: "30",
        unit: "kg",
        pricePerKg: "42",
        availableFrom: "2026-06-01",
      },
      {
        profileId: profile.id,
        name: "Telemea de vacă",
        estimatedQuantity: "50",
        unit: "kg",
        pricePerKg: "28",
        availableFrom: "2026-06-01",
      },
    ],
  });
}

async function main() {
  await seedAdmin();
  await seedDemoProducer();
  await seedDemoProducer2();
  await seedDemoVenue();

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
