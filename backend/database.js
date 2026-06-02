const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'white-pigeon-command-hub-secret-key-32chars!'; // Must be 32 bytes

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial DB structure
const initialDb = {
  config: {
    botToken: '',
    guildId: '',
    clientId: '',
    clientSecret: '',
    webhooks: {}
  },
  familyStats: {
    totalMembers: 403,
    totalGiveaways: 7,
    totalBonuses: 118920000,
    hcWorkDone: 97,
    totalStrikes: 57,
    totalBlacklisted: 20,
    rpWon: 133,
    eventsWon: 928,
    familyRankingPoints: 2168,
    familyRank: '#1',
    updatedAt: '2026-06-02T06:30:00Z'
  },
  members: [
  {
    "discordId": "mock-admin",
    "username": "PigeonBoss",
    "nickname": "WP | PigeonBoss",
    "roles": [
      "Leadership",
      "Admin"
    ],
    "kills": 542,
    "weeklyKills": 38,
    "balance": 15400000,
    "strikes": [],
    "points": 2450,
    "isTop10": true,
    "activityScore": 92,
    "weeklyPoints": 0
  },
  {
    "discordId": "mock-member1",
    "username": "VitoScaletta",
    "nickname": "WP | VitoScaletta",
    "roles": [
      "Member"
    ],
    "kills": 310,
    "weeklyKills": 15,
    "balance": 4200000,
    "strikes": [
      {
        "id": "str-1",
        "reason": "Missed Informal battle without notice",
        "date": "2026-05-28T18:00:00Z",
        "issuedBy": "PigeonBoss"
      }
    ],
    "points": 850,
    "isTop10": true,
    "activityScore": 75,
    "weeklyPoints": 0
  },
  {
    "discordId": "mock-member2",
    "username": "TonyMontana",
    "nickname": "WP | TonyMontana",
    "roles": [
      "Member"
    ],
    "kills": 890,
    "weeklyKills": 67,
    "balance": 8900000,
    "strikes": [],
    "points": 1200,
    "isTop10": true,
    "activityScore": 88,
    "weeklyPoints": 0
  },
  {
    "discordId": "123-xan",
    "username": "Xan Envision",
    "nickname": "@Xan Envision",
    "roles": [
      "Member"
    ],
    "kills": 12,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [
      {
        "id": "str-xan-1",
        "reason": "Unexcused absence from event",
        "date": "2026-05-20T10:00:00Z",
        "issuedBy": "PigeonBoss"
      },
      {
        "id": "str-xan-2",
        "reason": "Failed to collect bizwar task",
        "date": "2026-05-22T14:30:00Z",
        "issuedBy": "PigeonBoss"
      }
    ],
    "points": 50,
    "isTop10": false,
    "activityScore": 60,
    "weeklyPoints": 0
  },
  {
    "discordId": "123-kagaya",
    "username": "kagaya ubuyashiki",
    "nickname": "@kagaya ubuyashiki | 77658",
    "roles": [
      "Member"
    ],
    "kills": 8,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [
      {
        "id": "str-kag-1",
        "reason": "Unexcused absence from event",
        "date": "2026-05-20T10:00:00Z",
        "issuedBy": "PigeonBoss"
      },
      {
        "id": "str-kag-2",
        "reason": "Rule infraction",
        "date": "2026-05-23T11:00:00Z",
        "issuedBy": "PigeonBoss"
      }
    ],
    "points": 40,
    "isTop10": false,
    "activityScore": 55,
    "weeklyPoints": 0
  },
  {
    "discordId": "123-trolix",
    "username": "Trolix Amphetamine123",
    "nickname": "@Trolix Amphetamine123",
    "roles": [
      "Member"
    ],
    "kills": 15,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [
      {
        "id": "str-trol-1",
        "reason": "Warning issued for behavior",
        "date": "2026-05-20T10:00:00Z",
        "issuedBy": "PigeonBoss"
      }
    ],
    "points": 90,
    "isTop10": false,
    "activityScore": 70,
    "weeklyPoints": 0
  },
  {
    "discordId": "123-tom",
    "username": "tom scofielt",
    "nickname": "@tom scofielt/118681",
    "roles": [
      "Member"
    ],
    "kills": 4,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [
      {
        "id": "str-tom-1",
        "reason": "Warning issued for behavior",
        "date": "2026-05-20T10:00:00Z",
        "issuedBy": "PigeonBoss"
      }
    ],
    "points": 30,
    "isTop10": false,
    "activityScore": 65,
    "weeklyPoints": 52.5
  },
  {
    "discordId": "123-zayed",
    "username": "Zayed Masood",
    "nickname": "@Zayed Masood | 116523",
    "roles": [
      "Member"
    ],
    "kills": 10,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [
      {
        "id": "str-zay-1",
        "reason": "Warning issued for behavior",
        "date": "2026-05-20T10:00:00Z",
        "issuedBy": "PigeonBoss"
      }
    ],
    "points": 70,
    "isTop10": false,
    "activityScore": 80,
    "weeklyPoints": 0
  },
  {
    "discordId": "1186312745910550610",
    "username": "Player_118631",
    "nickname": "<@1186312745910550610>",
    "roles": [
      "Member"
    ],
    "kills": 2,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [
      {
        "id": "str-118-1",
        "reason": "Warning issued for behavior",
        "date": "2026-05-20T10:00:00Z",
        "issuedBy": "PigeonBoss"
      }
    ],
    "points": 20,
    "isTop10": false,
    "activityScore": 50,
    "weeklyPoints": 0
  },
  {
    "discordId": "1289935268400467979",
    "username": "Player_128993",
    "nickname": "<@1289935268400467979>",
    "roles": [
      "Member"
    ],
    "kills": 0,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [
      {
        "id": "str-128-1",
        "reason": "Warning issued for behavior",
        "date": "2026-05-20T10:00:00Z",
        "issuedBy": "PigeonBoss"
      }
    ],
    "points": 10,
    "isTop10": false,
    "activityScore": 40,
    "weeklyPoints": 0
  },
  {
    "discordId": "123-akash",
    "username": "Akash",
    "nickname": "@Akash | 155077",
    "roles": [
      "Member"
    ],
    "kills": 9,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [
      {
        "id": "str-aka-1",
        "reason": "Warning issued for behavior",
        "date": "2026-05-20T10:00:00Z",
        "issuedBy": "PigeonBoss"
      }
    ],
    "points": 65,
    "isTop10": false,
    "activityScore": 75,
    "weeklyPoints": 38.5
  },
  {
    "discordId": "123-tekila",
    "username": "Tekila Edge",
    "nickname": "@Tekila Edge | 112356",
    "roles": [
      "Member"
    ],
    "kills": 14,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [
      {
        "id": "str-tek-1",
        "reason": "Warning issued for behavior",
        "date": "2026-05-20T10:00:00Z",
        "issuedBy": "PigeonBoss"
      }
    ],
    "points": 80,
    "isTop10": false,
    "activityScore": 85,
    "weeklyPoints": 0
  },
  {
    "discordId": "123-rohat",
    "username": "rohat solar",
    "nickname": "@rohat solar 91226",
    "roles": [
      "Member"
    ],
    "kills": 3,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [
      {
        "id": "str-roh-1",
        "reason": "Warning issued for behavior",
        "date": "2026-05-20T10:00:00Z",
        "issuedBy": "PigeonBoss"
      }
    ],
    "points": 25,
    "isTop10": false,
    "activityScore": 55,
    "weeklyPoints": 0
  },
  {
    "discordId": "123-sergej",
    "username": "Sergej Kuznecov",
    "nickname": "@Sergej Kuznecov | 133578",
    "roles": [
      "Member"
    ],
    "kills": 7,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [
      {
        "id": "str-serg-1",
        "reason": "Warning issued for behavior",
        "date": "2026-05-20T10:00:00Z",
        "issuedBy": "PigeonBoss"
      }
    ],
    "points": 50,
    "isTop10": false,
    "activityScore": 60,
    "weeklyPoints": 0
  },
  {
    "discordId": "110116",
    "username": "Prem Cullen",
    "nickname": "@Prem Cullen | 110116",
    "roles": [
      "Member"
    ],
    "kills": 70,
    "weeklyKills": 24,
    "balance": 0,
    "strikes": [],
    "points": 500,
    "weeklyPoints": 62.5,
    "isTop10": false,
    "activityScore": 90
  },
  {
    "discordId": "70941",
    "username": "Chloe Veneta",
    "nickname": "@Chloe Veneta | 70941",
    "roles": [
      "Member"
    ],
    "kills": 100,
    "weeklyKills": 60,
    "balance": 0,
    "strikes": [],
    "points": 480,
    "weeklyPoints": 62,
    "isTop10": false,
    "activityScore": 88
  },
  {
    "discordId": "101254",
    "username": "Melissa MakarovVicious",
    "nickname": "@Melissa MakarovVicious | 101254",
    "roles": [
      "Member"
    ],
    "kills": 81,
    "weeklyKills": 49,
    "balance": 0,
    "strikes": [],
    "points": 510,
    "weeklyPoints": 61,
    "isTop10": false,
    "activityScore": 91
  },
  {
    "discordId": "133338",
    "username": "Aayush MakarovVicious",
    "nickname": "@Aayush MakarovVicious | 133338",
    "roles": [
      "Member"
    ],
    "kills": 40,
    "weeklyKills": 25,
    "balance": 0,
    "strikes": [],
    "points": 400,
    "weeklyPoints": 60.5,
    "isTop10": false,
    "activityScore": 85
  },
  {
    "discordId": "144778",
    "username": "Evan Verlice",
    "nickname": "@Evan Verlice | 144778",
    "roles": [
      "Member"
    ],
    "kills": 35,
    "weeklyKills": 7,
    "balance": 0,
    "strikes": [],
    "points": 380,
    "weeklyPoints": 60,
    "isTop10": false,
    "activityScore": 82
  },
  {
    "discordId": "61783",
    "username": "Quaresma | Dona ~",
    "nickname": "@Quaresma | Dona ~ 61783",
    "roles": [
      "Member"
    ],
    "kills": 89,
    "weeklyKills": 29,
    "balance": 0,
    "strikes": [],
    "points": 350,
    "weeklyPoints": 57,
    "isTop10": false,
    "activityScore": 80
  },
  {
    "discordId": "151867",
    "username": "Rex Nocap",
    "nickname": "@Rex Nocap | 151867",
    "roles": [
      "Member"
    ],
    "kills": 28,
    "weeklyKills": 6,
    "balance": 0,
    "strikes": [],
    "points": 310,
    "weeklyPoints": 55.5,
    "isTop10": false,
    "activityScore": 78
  },
  {
    "discordId": "anvy-mock",
    "username": "Anvy",
    "nickname": "@Anvy",
    "roles": [
      "Leadership"
    ],
    "kills": 55,
    "weeklyKills": 15,
    "balance": 1200000,
    "strikes": [],
    "points": 540,
    "weeklyPoints": 54,
    "isTop10": false,
    "activityScore": 92
  },
  {
    "discordId": "60696",
    "username": "Eve Riviera",
    "nickname": "@Eve Riviera | 60696",
    "roles": [
      "Member"
    ],
    "kills": 22,
    "weeklyKills": 4,
    "balance": 0,
    "strikes": [],
    "points": 290,
    "weeklyPoints": 52.5,
    "isTop10": false,
    "activityScore": 75
  },
  {
    "discordId": "82934",
    "username": "SUKUNA MAKAROVVICIOUS",
    "nickname": "@SUKUNA MAKAROVVICIOUS | 82934",
    "roles": [
      "Member"
    ],
    "kills": 86,
    "weeklyKills": 37,
    "balance": 0,
    "strikes": [],
    "points": 300,
    "weeklyPoints": 50.5,
    "isTop10": false,
    "activityScore": 77
  },
  {
    "discordId": "48079",
    "username": "Yasseen Riviera",
    "nickname": "@Yasseen Riviera | 48079",
    "roles": [
      "Member"
    ],
    "kills": 103,
    "weeklyKills": 19,
    "balance": 0,
    "strikes": [],
    "points": 250,
    "weeklyPoints": 45.5,
    "isTop10": true,
    "activityScore": 72
  },
  {
    "discordId": "alikagan-mock",
    "username": "Alikagan",
    "nickname": "@Alikagan",
    "roles": [
      "Member"
    ],
    "kills": 93,
    "weeklyKills": 33,
    "balance": 0,
    "strikes": [],
    "points": 200,
    "weeklyPoints": 45,
    "isTop10": false,
    "activityScore": 70
  },
  {
    "discordId": "52589",
    "username": "Fred Riviera",
    "nickname": "@Fred Riviera 52589",
    "roles": [
      "Member"
    ],
    "kills": 18,
    "weeklyKills": 3,
    "balance": 0,
    "strikes": [],
    "points": 220,
    "weeklyPoints": 44.5,
    "isTop10": false,
    "activityScore": 71
  },
  {
    "discordId": "24644",
    "username": "Yash Riviera",
    "nickname": "@Yash Riviera 24644",
    "roles": [
      "Member"
    ],
    "kills": 45,
    "weeklyKills": 30,
    "balance": 0,
    "strikes": [],
    "points": 210,
    "weeklyPoints": 44,
    "isTop10": false,
    "activityScore": 68
  },
  {
    "discordId": "68192",
    "username": "Ace Verlice",
    "nickname": "@Ace Verlice | 68192",
    "roles": [
      "Member"
    ],
    "kills": 14,
    "weeklyKills": 1,
    "balance": 0,
    "strikes": [],
    "points": 180,
    "weeklyPoints": 40,
    "isTop10": false,
    "activityScore": 65
  },
  {
    "discordId": "cobra-mock",
    "username": "Cobra Entity",
    "nickname": "@Cobra Entity",
    "roles": [
      "Member"
    ],
    "kills": 116,
    "weeklyKills": 46,
    "balance": 0,
    "strikes": [],
    "points": 150,
    "weeklyPoints": 38,
    "isTop10": true,
    "activityScore": 60
  },
  {
    "discordId": "105776",
    "username": "Rjay Entity",
    "nickname": "@Rjay Entity | 105776",
    "roles": [
      "Member"
    ],
    "kills": 11,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [],
    "points": 140,
    "weeklyPoints": 38,
    "isTop10": false,
    "activityScore": 59
  },
  {
    "discordId": "171896",
    "username": "Louis Silva",
    "nickname": "@Louis Silva | 171896",
    "roles": [
      "Member"
    ],
    "kills": 137,
    "weeklyKills": 20,
    "balance": 0,
    "strikes": [],
    "points": 130,
    "weeklyPoints": 38,
    "isTop10": true,
    "activityScore": 58
  },
  {
    "discordId": "155077",
    "username": "Akash",
    "nickname": "@Akash | 155077",
    "roles": [
      "Member"
    ],
    "kills": 134,
    "weeklyKills": 50,
    "balance": 0,
    "strikes": [],
    "points": 100,
    "weeklyPoints": 38.5,
    "isTop10": true,
    "activityScore": 70
  },
  {
    "discordId": "130686",
    "username": "Mikey Bonz",
    "nickname": "@Mikey Bonz | 130686",
    "roles": [
      "Member"
    ],
    "kills": 132,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [],
    "points": 100,
    "weeklyPoints": 0,
    "isTop10": true,
    "activityScore": 70
  },
  {
    "discordId": "48888",
    "username": "Michael Makarovvicious 48888",
    "nickname": "@Michael Makarovvicious 48888",
    "roles": [
      "Member"
    ],
    "kills": 110,
    "weeklyKills": 36,
    "balance": 0,
    "strikes": [],
    "points": 100,
    "weeklyPoints": 0,
    "isTop10": true,
    "activityScore": 70
  },
  {
    "discordId": "170715",
    "username": "Clark Turechad 170715",
    "nickname": "@Clark Turechad 170715",
    "roles": [
      "Member"
    ],
    "kills": 107,
    "weeklyKills": 56,
    "balance": 0,
    "strikes": [],
    "points": 100,
    "weeklyPoints": 0,
    "isTop10": true,
    "activityScore": 70
  },
  {
    "discordId": "12623",
    "username": "winston wir",
    "nickname": "@winston wir | 12623",
    "roles": [
      "Member"
    ],
    "kills": 101,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [],
    "points": 100,
    "weeklyPoints": 0,
    "isTop10": false,
    "activityScore": 70
  },
  {
    "discordId": "dick-supplier-mock",
    "username": "Dick Supplier",
    "nickname": "@Dick Supplier",
    "roles": [
      "Member"
    ],
    "kills": 86,
    "weeklyKills": 23,
    "balance": 0,
    "strikes": [],
    "points": 100,
    "weeklyPoints": 0,
    "isTop10": false,
    "activityScore": 70
  },
  {
    "discordId": "172247",
    "username": "Dryhes Mattis 172247",
    "nickname": "@Dryhes Mattis 172247",
    "roles": [
      "Member"
    ],
    "kills": 81,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [],
    "points": 100,
    "weeklyPoints": 0,
    "isTop10": false,
    "activityScore": 70
  },
  {
    "discordId": "3572",
    "username": "Lokmane Bonz",
    "nickname": "@Lokmane Bonz | 3572",
    "roles": [
      "Member"
    ],
    "kills": 77,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [],
    "points": 100,
    "weeklyPoints": 0,
    "isTop10": false,
    "activityScore": 70
  },
  {
    "discordId": "116365",
    "username": "Calm Vicious",
    "nickname": "@Calm Vicious 116365",
    "roles": [
      "Member"
    ],
    "kills": 74,
    "weeklyKills": 19,
    "balance": 0,
    "strikes": [],
    "points": 100,
    "weeklyPoints": 0,
    "isTop10": false,
    "activityScore": 70
  },
  {
    "discordId": "127353",
    "username": "Franz Barnicht",
    "nickname": "@Franz Barnicht | 127353",
    "roles": [
      "Member"
    ],
    "kills": 72,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [],
    "points": 100,
    "weeklyPoints": 0,
    "isTop10": false,
    "activityScore": 70
  },
  {
    "discordId": "gardy-mock",
    "username": "Gardy",
    "nickname": "@Gardy",
    "roles": [
      "Member"
    ],
    "kills": 71,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [],
    "points": 100,
    "weeklyPoints": 0,
    "isTop10": false,
    "activityScore": 70
  },
  {
    "discordId": "7386",
    "username": "Bruno Dior",
    "nickname": "@Bruno Dior | 7386",
    "roles": [
      "Member"
    ],
    "kills": 70,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [],
    "points": 100,
    "weeklyPoints": 0,
    "isTop10": false,
    "activityScore": 70
  },
  {
    "discordId": "152194",
    "username": "Calvin Reyy",
    "nickname": "@Calvin Reyy | 152194",
    "roles": [
      "Member"
    ],
    "kills": 68,
    "weeklyKills": 26,
    "balance": 0,
    "strikes": [],
    "points": 100,
    "weeklyPoints": 0,
    "isTop10": false,
    "activityScore": 70
  },
  {
    "discordId": "43022",
    "username": "Aditya/Fake Vicious 43022",
    "nickname": "@Aditya/Fake Vicious 43022",
    "roles": [
      "Member"
    ],
    "kills": 67,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [],
    "points": 100,
    "weeklyPoints": 0,
    "isTop10": false,
    "activityScore": 70
  },
  {
    "discordId": "can-mock",
    "username": "can",
    "nickname": "@can",
    "roles": [
      "Member"
    ],
    "kills": 64,
    "weeklyKills": 0,
    "balance": 0,
    "strikes": [],
    "points": 100,
    "weeklyPoints": 0,
    "isTop10": false,
    "activityScore": 70
  },
  {
    "discordId": "harry-mock",
    "username": "[Harry]",
    "nickname": "@[Harry]",
    "roles": [
      "Member"
    ],
    "kills": 64,
    "weeklyKills": 33,
    "balance": 0,
    "strikes": [],
    "points": 100,
    "weeklyPoints": 0,
    "isTop10": false,
    "activityScore": 70
  }
],
  tickets: [
    {
      id: 'tkt-101',
      memberId: 'mock-member1',
      username: 'VitoScaletta',
      type: 'complaint',
      subject: 'Car stolen by green family',
      description: 'They stole my sports car during a non-RP event. Need backup to retrieve it or file a complaint.',
      status: 'open',
      response: '',
      createdAt: '2026-06-01T12:00:00Z'
    }
  ],
  activities: [
    {
      id: 'act-201',
      memberId: 'mock-member1',
      username: 'VitoScaletta',
      description: 'Collected BizWar profits from the hotel factory.',
      mediaUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500',
      pointsAwarded: 150,
      status: 'approved',
      reason: 'Valid proof, well done.',
      reviewedBy: 'PigeonBoss',
      createdAt: '2026-05-30T10:00:00Z'
    }
  ],
  orders: [],
  bizwarLogs: [
    {
      id: 'biz-301',
      memberId: 'mock-member2',
      username: 'TonyMontana',
      businessName: 'Hotel Factory',
      amount: 450000,
      timeCollected: '2026-06-02T01:00:00Z',
      createdAt: '2026-06-02T01:05:00Z'
    }
  ],
  rpTicketLogs: [
    {
      id: 'rp-401',
      memberId: 'mock-member2',
      username: 'TonyMontana',
      ticketsCollected: 5,
      timeCollected: '2026-06-02T02:00:00Z',
      createdAt: '2026-06-02T02:02:00Z'
    }
  ],
  signups: [],
  wins: [
    {
      id: 'win-501',
      type: 'event',
      title: 'BizWar Win vs Marabunta',
      description: 'Captured the docks area. Full team coordination was flawless.',
      date: '2026-06-01T20:00:00Z',
      participants: 'PigeonBoss, VitoScaletta, TonyMontana, and 12 others',
      mediaUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800',
      createdAt: '2026-06-01T20:30:00Z'
    }
  ],
  roleRequests: []
};

// Encryption Helper
function encrypt(text) {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(16);
    // Ensure key is exactly 32 bytes
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (err) {
    console.error('Encryption failed:', err);
    return '';
  }
}

function decrypt(text) {
  if (!text) return '';
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err);
    return '';
  }
}

// Read DB file
function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
    return initialDb;
  }
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading JSON DB, returning defaults:', err);
    return initialDb;
  }
}

// Write DB file
function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('Error writing JSON DB:', err);
    return false;
  }
}

// Public DB API
// Initialize Firebase Admin for Firestore
let firebaseDb = null;
if (process.env.NODE_ENV === 'production' || process.env.USE_FIRESTORE === 'true') {
  try {
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    firebaseDb = admin.firestore();
    console.log('[Database] Firestore initialized successfully.');
  } catch (err) {
    console.error('[Database] Failed to initialize Firestore, falling back to local JSON:', err.message);
  }
}

// Public DB API
const db = {
  // Config
  getConfig: async () => {
    if (firebaseDb) {
      try {
        const doc = await firebaseDb.collection('settings').doc('discord').get();
        const config = doc.exists ? doc.data() : { ...initialDb.config };
        if (config.botToken) config.botToken = decrypt(config.botToken);
        if (config.clientSecret) config.clientSecret = decrypt(config.clientSecret);
        if (config.adminPassword) {
          config.adminPassword = decrypt(config.adminPassword);
        } else {
          config.adminPassword = 'anvy2026';
        }
        return config;
      } catch (err) {
        console.error('Firestore getConfig failed, fallback to initial:', err.message);
        return { ...initialDb.config, adminPassword: 'anvy2026' };
      }
    }
    const data = readDb();
    const config = { ...data.config };
    // Decrypt credentials before returning
    if (config.botToken) config.botToken = decrypt(config.botToken);
    if (config.clientSecret) config.clientSecret = decrypt(config.clientSecret);
    if (config.adminPassword) {
      config.adminPassword = decrypt(config.adminPassword);
    } else {
      config.adminPassword = 'anvy2026';
    }
    return config;
  },
  
  saveConfig: async (newConfig) => {
    // Encrypt sensitive fields
    const encryptedConfig = {
      botToken: newConfig.botToken ? encrypt(newConfig.botToken) : '',
      guildId: newConfig.guildId || '',
      clientId: newConfig.clientId || '',
      clientSecret: newConfig.clientSecret ? encrypt(newConfig.clientSecret) : '',
      adminPassword: newConfig.adminPassword ? encrypt(newConfig.adminPassword) : encrypt('anvy2026'),
      webhooks: newConfig.webhooks || {}
    };

    if (firebaseDb) {
      try {
        await firebaseDb.collection('settings').doc('discord').set(encryptedConfig);
        return true;
      } catch (err) {
        console.error('Firestore saveConfig failed:', err.message);
      }
    }
    
    const data = readDb();
    data.config = encryptedConfig;
    writeDb(data);
    return true;
  },

  // Members
  getMembers: async () => {
    if (firebaseDb) {
      try {
        const snapshot = await firebaseDb.collection('members').get();
        const members = snapshot.docs.map(doc => doc.data());
        return members.length > 0 ? members : [...initialDb.members];
      } catch (err) {
        console.error('Firestore getMembers failed:', err.message);
      }
    }
    return readDb().members;
  },
  
  getMember: async (discordId) => {
    if (firebaseDb) {
      try {
        const doc = await firebaseDb.collection('members').doc(discordId).get();
        return doc.exists ? doc.data() : null;
      } catch (err) {
        console.error('Firestore getMember failed:', err.message);
      }
    }
    const members = readDb().members;
    return members.find(m => m.discordId === discordId) || null;
  },
  
  updateMember: async (discordId, updateData) => {
    if (firebaseDb) {
      try {
        const docRef = firebaseDb.collection('members').doc(discordId);
        const doc = await docRef.get();
        let currentData = {};
        if (doc.exists) {
          currentData = doc.data();
        } else {
          currentData = {
            discordId,
            username: updateData.username || 'Unknown',
            nickname: updateData.nickname || `WP | ${updateData.username || 'Unknown'}`,
            roles: updateData.roles || ['Member'],
            kills: updateData.kills || 0,
            weeklyKills: updateData.weeklyKills || 0,
            balance: updateData.balance || 0,
            strikes: updateData.strikes || [],
            points: updateData.points || 0,
            isTop10: updateData.isTop10 || false,
            activityScore: updateData.activityScore || 0
          };
        }
        const finalData = { ...currentData, ...updateData };
        await docRef.set(finalData);
        return finalData;
      } catch (err) {
        console.error('Firestore updateMember failed:', err.message);
      }
    }

    const data = readDb();
    const idx = data.members.findIndex(m => m.discordId === discordId);
    let finalMember = null;
    if (idx !== -1) {
      data.members[idx] = { ...data.members[idx], ...updateData };
      finalMember = data.members[idx];
    } else {
      // Create new member if not found
      finalMember = {
        discordId,
        username: updateData.username || 'Unknown',
        nickname: updateData.nickname || `WP | ${updateData.username || 'Unknown'}`,
        roles: updateData.roles || ['Member'],
        kills: updateData.kills || 0,
        weeklyKills: updateData.weeklyKills || 0,
        balance: updateData.balance || 0,
        strikes: updateData.strikes || [],
        points: updateData.points || 0,
        isTop10: updateData.isTop10 || false,
        activityScore: updateData.activityScore || 0,
        ...updateData
      };
      data.members.push(finalMember);
    }
    writeDb(data);
    return finalMember;
  },

  // Tickets
  getTickets: async () => {
    if (firebaseDb) {
      try {
        const snapshot = await firebaseDb.collection('tickets').orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => doc.data());
      } catch (err) {
        console.error('Firestore getTickets failed:', err.message);
      }
    }
    return readDb().tickets;
  },
  
  createTicket: async (ticketData) => {
    const id = `tkt-${Math.floor(100 + Math.random() * 900)}`;
    const newTicket = {
      id,
      status: 'open',
      response: '',
      createdAt: new Date().toISOString(),
      ...ticketData
    };

    if (firebaseDb) {
      try {
        await firebaseDb.collection('tickets').doc(id).set(newTicket);
        return newTicket;
      } catch (err) {
        console.error('Firestore createTicket failed:', err.message);
      }
    }

    const data = readDb();
    data.tickets.unshift(newTicket);
    writeDb(data);
    return newTicket;
  },
  
  updateTicket: async (id, updateData) => {
    if (firebaseDb) {
      try {
        const docRef = firebaseDb.collection('tickets').doc(id);
        const doc = await docRef.get();
        if (doc.exists) {
          const finalData = { ...doc.data(), ...updateData };
          await docRef.set(finalData);
          return finalData;
        }
        return null;
      } catch (err) {
        console.error('Firestore updateTicket failed:', err.message);
      }
    }

    const data = readDb();
    const idx = data.tickets.findIndex(t => t.id === id);
    if (idx !== -1) {
      data.tickets[idx] = { ...data.tickets[idx], ...updateData };
      writeDb(data);
      return data.tickets[idx];
    }
    return null;
  },

  // Activities
  getActivities: async () => {
    if (firebaseDb) {
      try {
        const snapshot = await firebaseDb.collection('activities').orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => doc.data());
      } catch (err) {
        console.error('Firestore getActivities failed:', err.message);
      }
    }
    return readDb().activities;
  },
  
  createActivity: async (actData) => {
    const id = `act-${Math.floor(100 + Math.random() * 900)}`;
    const newAct = {
      id,
      status: 'pending',
      pointsAwarded: 0,
      reason: '',
      createdAt: new Date().toISOString(),
      ...actData
    };

    if (firebaseDb) {
      try {
        await firebaseDb.collection('activities').doc(id).set(newAct);
        return newAct;
      } catch (err) {
        console.error('Firestore createActivity failed:', err.message);
      }
    }

    const data = readDb();
    data.activities.unshift(newAct);
    writeDb(data);
    return newAct;
  },
  
  updateActivity: async (id, updateData) => {
    if (firebaseDb) {
      try {
        const docRef = firebaseDb.collection('activities').doc(id);
        const doc = await docRef.get();
        if (doc.exists) {
          const finalData = { ...doc.data(), ...updateData };
          await docRef.set(finalData);
          return finalData;
        }
        return null;
      } catch (err) {
        console.error('Firestore updateActivity failed:', err.message);
      }
    }

    const data = readDb();
    const idx = data.activities.findIndex(a => a.id === id);
    if (idx !== -1) {
      data.activities[idx] = { ...data.activities[idx], ...updateData };
      writeDb(data);
      return data.activities[idx];
    }
    return null;
  },

  // Point Shop Orders
  getOrders: async () => {
    if (firebaseDb) {
      try {
        const snapshot = await firebaseDb.collection('orders').orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => doc.data());
      } catch (err) {
        console.error('Firestore getOrders failed:', err.message);
      }
    }
    return readDb().orders;
  },
  
  createOrder: async (orderData) => {
    const id = `ord-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder = {
      id,
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...orderData
    };

    if (firebaseDb) {
      try {
        await firebaseDb.collection('orders').doc(id).set(newOrder);
        return newOrder;
      } catch (err) {
        console.error('Firestore createOrder failed:', err.message);
      }
    }

    const data = readDb();
    data.orders.unshift(newOrder);
    writeDb(data);
    return newOrder;
  },
  
  updateOrder: async (id, updateData) => {
    if (firebaseDb) {
      try {
        const docRef = firebaseDb.collection('orders').doc(id);
        const doc = await docRef.get();
        if (doc.exists) {
          const finalData = { ...doc.data(), ...updateData };
          await docRef.set(finalData);
          return finalData;
        }
        return null;
      } catch (err) {
        console.error('Firestore updateOrder failed:', err.message);
      }
    }

    const data = readDb();
    const idx = data.orders.findIndex(o => o.id === id);
    if (idx !== -1) {
      data.orders[idx] = { ...data.orders[idx], ...updateData };
      writeDb(data);
      return data.orders[idx];
    }
    return null;
  },

  // BizWar
  getBizWarLogs: async () => {
    if (firebaseDb) {
      try {
        const snapshot = await firebaseDb.collection('bizwarLogs').orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => doc.data());
      } catch (err) {
        console.error('Firestore getBizWarLogs failed:', err.message);
      }
    }
    return readDb().bizwarLogs;
  },
  
  createBizWarLog: async (logData) => {
    const id = `biz-${Math.floor(100 + Math.random() * 900)}`;
    const newLog = {
      id,
      createdAt: new Date().toISOString(),
      ...logData
    };

    if (firebaseDb) {
      try {
        await firebaseDb.collection('bizwarLogs').doc(id).set(newLog);
        return newLog;
      } catch (err) {
        console.error('Firestore createBizWarLog failed:', err.message);
      }
    }

    const data = readDb();
    data.bizwarLogs.unshift(newLog);
    writeDb(data);
    return newLog;
  },

  // RP Ticket Collect
  getRpTicketLogs: async () => {
    if (firebaseDb) {
      try {
        const snapshot = await firebaseDb.collection('rpTicketLogs').orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => doc.data());
      } catch (err) {
        console.error('Firestore getRpTicketLogs failed:', err.message);
      }
    }
    return readDb().rpTicketLogs;
  },
  
  createRpTicketLog: async (logData) => {
    const id = `rp-${Math.floor(100 + Math.random() * 900)}`;
    const newLog = {
      id,
      createdAt: new Date().toISOString(),
      ...logData
    };

    if (firebaseDb) {
      try {
        await firebaseDb.collection('rpTicketLogs').doc(id).set(newLog);
        return newLog;
      } catch (err) {
        console.error('Firestore createRpTicketLog failed:', err.message);
      }
    }

    const data = readDb();
    data.rpTicketLogs.unshift(newLog);
    writeDb(data);
    return newLog;
  },
  
  getRpTicketStats: async () => {
    const logs = await db.getRpTicketLogs();
    const totalCollected = logs.reduce((acc, curr) => acc + (curr.ticketsCollected || 0), 0);
    const lastCollect = logs.length > 0 ? logs[0] : null;
    return {
      totalCollected,
      lastCollect
    };
  },

  // Signups
  getSignups: async (eventId) => {
    if (firebaseDb) {
      try {
        const snapshot = await firebaseDb.collection('signups').where('eventId', '==', eventId).get();
        return snapshot.docs.map(doc => doc.data());
      } catch (err) {
        console.error('Firestore getSignups failed:', err.message);
      }
    }
    const data = readDb();
    return data.signups.filter(s => s.eventId === eventId);
  },
  
  createSignup: async (eventId, memberId, username, isTop10) => {
    const eventSignups = await db.getSignups(eventId);
    
    // Check if user already signed up
    const existing = eventSignups.find(s => s.memberId === memberId);
    if (existing) {
      return { success: false, message: 'Already signed up!' };
    }

    const id = `${eventId}-${memberId}`;
    const newSignup = {
      eventId,
      memberId,
      username,
      signedUpAt: new Date().toISOString(),
      isTop10,
      status: 'confirmed'
    };

    const confirmedCount = eventSignups.filter(s => s.status === 'confirmed').length;
    if (confirmedCount < 25) {
      // Free slot available
      if (firebaseDb) {
        try {
          await firebaseDb.collection('signups').doc(id).set(newSignup);
          return { success: true, signup: newSignup, action: 'confirmed' };
        } catch (err) {
          console.error('Firestore createSignup failed:', err.message);
        }
      }
      
      const data = readDb();
      data.signups.push(newSignup);
      writeDb(data);
      return { success: true, signup: newSignup, action: 'confirmed' };
    }

    // Slots are full (>= 25)
    if (isTop10) {
      // Top 10 priority: find the last signed up non-Top-10 member to displace
      const nonTop10s = eventSignups
        .filter(s => !s.isTop10 && s.status === 'confirmed')
        .sort((a, b) => new Date(b.signedUpAt) - new Date(a.signedUpAt));

      if (nonTop10s.length > 0) {
        const displacedMember = nonTop10s[0];
        
        if (firebaseDb) {
          try {
            // Update displaced member's status to 'displaced' / reserve
            const displacedId = `${eventId}-${displacedMember.memberId}`;
            await firebaseDb.collection('signups').doc(displacedId).update({ status: 'displaced' });
            
            // Add the new Top 10 member as confirmed
            await firebaseDb.collection('signups').doc(id).set(newSignup);
            return { 
              success: true, 
              signup: newSignup, 
              action: 'displaced', 
              displaced: displacedMember 
            };
          } catch (err) {
            console.error('Firestore createSignup top10 displace failed:', err.message);
          }
        }

        const data = readDb();
        const displacedIdx = data.signups.findIndex(
          s => s.eventId === eventId && s.memberId === displacedMember.memberId
        );
        if (displacedIdx !== -1) {
          data.signups[displacedIdx].status = 'displaced';
        }

        // Add the new Top 10 member as confirmed
        data.signups.push(newSignup);
        writeDb(data);
        
        return { 
          success: true, 
          signup: newSignup, 
          action: 'displaced', 
          displaced: displacedMember 
        };
      }
    }

    // No non-Top-10 to displace, or this user is not Top 10. Put in reserve queue.
    newSignup.status = 'reserve';

    if (firebaseDb) {
      try {
        await firebaseDb.collection('signups').doc(id).set(newSignup);
        return { success: true, signup: newSignup, action: 'reserve' };
      } catch (err) {
        console.error('Firestore createSignup reserve failed:', err.message);
      }
    }

    const data = readDb();
    data.signups.push(newSignup);
    writeDb(data);
    return { success: true, signup: newSignup, action: 'reserve' };
  },
  
  clearSignups: async (eventId) => {
    if (firebaseDb) {
      try {
        const snapshot = await firebaseDb.collection('signups').where('eventId', '==', eventId).get();
        const batch = firebaseDb.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        return true;
      } catch (err) {
        console.error('Firestore clearSignups failed:', err.message);
      }
    }
    const data = readDb();
    data.signups = data.signups.filter(s => s.eventId !== eventId);
    writeDb(data);
    return true;
  },

  // Wins Log
  getWins: async () => {
    if (firebaseDb) {
      try {
        const snapshot = await firebaseDb.collection('wins').orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => doc.data());
      } catch (err) {
        console.error('Firestore getWins failed:', err.message);
      }
    }
    return readDb().wins;
  },
  
  createWin: async (winData) => {
    const id = `win-${Math.floor(100 + Math.random() * 900)}`;
    const newWin = {
      id,
      createdAt: new Date().toISOString(),
      ...winData
    };

    if (firebaseDb) {
      try {
        await firebaseDb.collection('wins').doc(id).set(newWin);
        return newWin;
      } catch (err) {
        console.error('Firestore createWin failed:', err.message);
      }
    }

    const data = readDb();
    data.wins.unshift(newWin);
    writeDb(data);
    return newWin;
  },

  getEventState: async (eventId) => {
    if (firebaseDb) {
      try {
        const doc = await firebaseDb.collection('event_states').doc(eventId).get();
        if (doc.exists) {
          return doc.data().state || 'closed';
        }
        return 'closed';
      } catch (err) {
        console.error('Firestore getEventState failed:', err.message);
      }
    }
    const data = readDb();
    if (!data.eventStates) {
      data.eventStates = {};
    }
    return data.eventStates[eventId] || 'closed';
  },

  setEventState: async (eventId, state) => {
    if (firebaseDb) {
      try {
        await firebaseDb.collection('event_states').doc(eventId).set({ state });
        return true;
      } catch (err) {
        console.error('Firestore setEventState failed:', err.message);
      }
    }
    const data = readDb();
    if (!data.eventStates) {
      data.eventStates = {};
    }
    data.eventStates[eventId] = state;
    writeDb(data);
    return true;
  },

  // Role Requests
  getRoleRequests: async () => {
    if (firebaseDb) {
      try {
        const snapshot = await firebaseDb.collection('role_requests').orderBy('requestedAt', 'desc').get();
        return snapshot.docs.map(doc => doc.data());
      } catch (err) {
        console.error('Firestore getRoleRequests failed:', err.message);
      }
    }
    const dbData = readDb();
    if (!dbData.roleRequests) {
      dbData.roleRequests = [];
    }
    return dbData.roleRequests;
  },

  createRoleRequest: async (requestData) => {
    const id = requestData.id || `req-${Math.floor(100000 + Math.random() * 900000)}`;
    const newRequest = {
      id,
      requestedAt: new Date().toISOString(),
      status: 'pending',
      ...requestData
    };

    if (firebaseDb) {
      try {
        await firebaseDb.collection('role_requests').doc(id).set(newRequest);
        return newRequest;
      } catch (err) {
        console.error('Firestore createRoleRequest failed:', err.message);
      }
    }

    const data = readDb();
    if (!data.roleRequests) {
      data.roleRequests = [];
    }
    data.roleRequests.unshift(newRequest);
    writeDb(data);
    return newRequest;
  },

  updateRoleRequest: async (id, updateData) => {
    if (firebaseDb) {
      try {
        await firebaseDb.collection('role_requests').doc(id).update(updateData);
        return true;
      } catch (err) {
        console.error('Firestore updateRoleRequest failed:', err.message);
      }
    }

    const data = readDb();
    if (!data.roleRequests) {
      data.roleRequests = [];
    }
    const idx = data.roleRequests.findIndex(r => r.id === id);
    if (idx !== -1) {
      data.roleRequests[idx] = { ...data.roleRequests[idx], ...updateData };
      writeDb(data);
      return true;
    }
    return false;
  },

  getFamilyStats: async () => {
    if (firebaseDb) {
      try {
        const doc = await firebaseDb.collection('settings').doc('family_stats').get();
        if (doc.exists) {
          return doc.data();
        }
      } catch (err) {
        console.error('Firestore getFamilyStats failed:', err.message);
      }
    }
    const dbData = readDb();
    if (!dbData.familyStats) {
      dbData.familyStats = { ...initialDb.familyStats };
    }
    return dbData.familyStats;
  },

  saveFamilyStats: async (stats) => {
    const updatedStats = {
      ...stats,
      updatedAt: new Date().toISOString()
    };
    if (firebaseDb) {
      try {
        await firebaseDb.collection('settings').doc('family_stats').set(updatedStats);
        return updatedStats;
      } catch (err) {
        console.error('Firestore saveFamilyStats failed:', err.message);
      }
    }
    const dbData = readDb();
    dbData.familyStats = updatedStats;
    writeDb(dbData);
    return updatedStats;
  },

  resetWeeklyPoints: async () => {
    if (firebaseDb) {
      try {
        const snapshot = await firebaseDb.collection('members').get();
        const batch = firebaseDb.batch();
        snapshot.docs.forEach(doc => {
          batch.update(doc.ref, { weeklyPoints: 0 });
        });
        await batch.commit();
      } catch (err) {
        console.error('Firestore resetWeeklyPoints failed:', err.message);
      }
    }
    const data = readDb();
    data.members = data.members.map(m => ({ ...m, weeklyPoints: 0 }));
    writeDb(data);
    return true;
  },

  getPriorityList: async () => {
    if (firebaseDb) {
      try {
        const doc = await firebaseDb.collection('settings').doc('priority_list').get();
        if (doc.exists) {
          return doc.data();
        }
      } catch (err) {
        console.error('Firestore getPriorityList failed:', err.message);
      }
    }
    const data = readDb();
    if (!data.priorityList) {
      data.priorityList = {
        top5: [],
        top10: []
      };
    }
    return data.priorityList;
  },

  savePriorityList: async (priorityList) => {
    if (firebaseDb) {
      try {
        await firebaseDb.collection('settings').doc('priority_list').set(priorityList);
        return priorityList;
      } catch (err) {
        console.error('Firestore savePriorityList failed:', err.message);
      }
    }
    const data = readDb();
    data.priorityList = priorityList;
    writeDb(data);
    return priorityList;
  }
};

module.exports = db;
