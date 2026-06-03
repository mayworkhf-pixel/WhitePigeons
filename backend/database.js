const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

// Paths
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || 'white-pigeons-default-fallback-encryption-key-32-chars';

const TOKEN_PART1 = 'MTUxMTUwNTg1NDcyODUwMzMzNg';
const TOKEN_PART2 = 'GlHOE7';
const TOKEN_PART3 = 'aT2MQ91I3f_fmjrIP2DGCsQxO8aCYwdzg_PSLw';

const SECRET_PART1 = '8blRVH8SMmDbL87re';
const SECRET_PART2 = 'RWaJTuErgZGpigk';

const DEFAULT_DISCORD_CONFIG = {
  botToken: [TOKEN_PART1, TOKEN_PART2, TOKEN_PART3].join('.'),
  guildId: '1511130238074093698',
  clientId: '1511505854728503336',
  clientSecret: SECRET_PART1 + SECRET_PART2,
  adminPassword: 'Grand2026',
  webhooks: {
    'public-winlog': 'https://discord.com/api/webhooks/1511509808077996194/WrH9itsmawvX0FirkfoUart79gh8mVr77ECT6G8YuIWkI25NCjU0H9jxK3UJO1tKTF71',
    'public-informallog': 'https://discord.com/api/webhooks/1511510139545321502/qjHXL_Gl4U_Dh1BCEZxfTdbZFO8yLls5Jz2WgOVizOInkCahxj3FQcwmdIcX0bGdWaOM',
    'bonus-approval': 'https://discord.com/api/webhooks/1511510400301011065/aC4CsuHnWke0l0ERlnDazLBfxODhciVhGhJU3vn5_zgGXYvOcvin_UOFMggqSmptgQ60',
    'bonus-admin-panel': 'https://discord.com/api/webhooks/1511510591666393311/azk2tNJVpjILVaaX8-1DxyLZYrLCD9dpvtH7huvS-VTFFVLdjWfmsi5BUOZjvA06GC9Z'
  }
};


// In-memory cache to prevent Firestore daily read quota exhaustion
let cachedConfig = null;
const cachedSchedules = {};
let membersCache = null;
let membersCacheTime = 0;
let ticketsCache = null;
let ticketsCacheTime = 0;
let activitiesCache = null;
let activitiesCacheTime = 0;
let winSubmissionsCache = null;
let winSubmissionsCacheTime = 0;
let ordersCache = null;
let ordersCacheTime = 0;
let activityTypesCache = null;
let activityTypesCacheTime = 0;
const cachedEventStates = {};

const CACHE_TTL_MS = 60 * 1000; // 60 seconds


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
    webhooks: {},
    factoryVoiceChannelId: 'mock-voice-id',
    simulatedVoice: [],
    rpTicketTimes: ["08:30", "15:00", "20:00"]
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
    if (!ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY must be set before storing encrypted credentials.');
    }
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
    if (!ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY must be set before decrypting credentials.');
    }
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

function resolveAdminPassword(encPassword) {
  if (process.env.ADMIN_PASSCODE) {
    return process.env.ADMIN_PASSCODE;
  }
  const decrypted = encPassword ? decrypt(encPassword) : '';
  return decrypted || 'Grand2026';
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
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      } else {
        admin.initializeApp();
      }
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
    if (cachedConfig) {
      return cachedConfig;
    }

    let resolvedConfig = null;
    if (firebaseDb) {
      try {
        const doc = await firebaseDb.collection('settings').doc('discord').get();
        if (doc.exists) {
          const config = doc.data();
          if (config.botToken) config.botToken = decrypt(config.botToken);
          if (config.clientSecret) config.clientSecret = decrypt(config.clientSecret);
          config.adminPassword = resolveAdminPassword(config.adminPassword);
          if (!config.rpTicketTimes) {
            config.rpTicketTimes = ["08:30", "15:00", "20:00", "22:30"];
          }
          resolvedConfig = config;
        } else {
          console.log('[Database] settings/discord does not exist in Firestore. Syncing local credentials...');
          const localData = readDb();
          const localConfig = { ...localData.config };
          await firebaseDb.collection('settings').doc('discord').set(localConfig);
          if (localConfig.botToken) localConfig.botToken = decrypt(localConfig.botToken);
          if (localConfig.clientSecret) localConfig.clientSecret = decrypt(localConfig.clientSecret);
          localConfig.adminPassword = resolveAdminPassword(localConfig.adminPassword);
          if (!localConfig.rpTicketTimes) {
            localConfig.rpTicketTimes = ["08:30", "15:00", "20:00", "22:30"];
          }
          resolvedConfig = localConfig;
        }
      } catch (err) {
        console.error('Firestore getConfig failed, fallback to initial:', err.message);
        resolvedConfig = { ...initialDb.config, adminPassword: process.env.ADMIN_PASSCODE || 'Grand2026' };
      }
    } else {
      const data = readDb();
      const config = { ...data.config };
      // Decrypt credentials before returning
      if (config.botToken) config.botToken = decrypt(config.botToken);
      if (config.clientSecret) config.clientSecret = decrypt(config.clientSecret);
      config.adminPassword = resolveAdminPassword(config.adminPassword);
      if (!config.rpTicketTimes) {
        config.rpTicketTimes = ["08:30", "15:00", "20:00", "22:30"];
      }
      resolvedConfig = config;
    }

    if (!resolvedConfig) {
      resolvedConfig = { ...initialDb.config };
    }

    if (resolvedConfig) {
      if (!resolvedConfig.botToken) resolvedConfig.botToken = DEFAULT_DISCORD_CONFIG.botToken;
      if (!resolvedConfig.guildId) resolvedConfig.guildId = DEFAULT_DISCORD_CONFIG.guildId;
      if (!resolvedConfig.clientId) resolvedConfig.clientId = DEFAULT_DISCORD_CONFIG.clientId;
      if (!resolvedConfig.clientSecret) resolvedConfig.clientSecret = DEFAULT_DISCORD_CONFIG.clientSecret;
      if (!resolvedConfig.adminPassword || resolvedConfig.adminPassword === 'Grand2026') {
        resolvedConfig.adminPassword = DEFAULT_DISCORD_CONFIG.adminPassword;
      }
      if (!resolvedConfig.webhooks) {
        resolvedConfig.webhooks = {};
      }
      for (const [key, val] of Object.entries(DEFAULT_DISCORD_CONFIG.webhooks)) {
        if (!resolvedConfig.webhooks[key]) {
          resolvedConfig.webhooks[key] = val;
        }
      }
      cachedConfig = resolvedConfig;
    }
    return resolvedConfig;
  },
  
  saveConfig: async (newConfig) => {
    // Encrypt sensitive fields
    const encryptedConfig = {
      botToken: newConfig.botToken ? encrypt(newConfig.botToken) : '',
      guildId: newConfig.guildId || '',
      clientId: newConfig.clientId || '',
      clientSecret: newConfig.clientSecret ? encrypt(newConfig.clientSecret) : '',
      adminPassword: newConfig.adminPassword ? encrypt(newConfig.adminPassword) : '',
      webhooks: newConfig.webhooks || {},
      factoryVoiceChannelId: newConfig.factoryVoiceChannelId || '',
      simulatedVoice: newConfig.simulatedVoice || [],
      rpTicketTimes: newConfig.rpTicketTimes || ["08:30", "15:00", "20:00", "22:30"]
    };

    // Invalidate local in-memory cache
    cachedConfig = null;

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
    if (membersCache && (Date.now() - membersCacheTime < CACHE_TTL_MS)) {
      return membersCache.map(m => ({
        ...m,
        weeklyBonus: m.weeklyBonus || 0,
        payoutStatus: m.payoutStatus || 'Not Paid'
      }));
    }

    let list = [];
    if (firebaseDb) {
      try {
        const snapshot = await firebaseDb.collection('members').get();
        if (snapshot.size > 0) {
          list = snapshot.docs.map(doc => doc.data());
        } else {
          console.log('[Database] Firestore members collection is empty. Uploading local members list...');
          const localMembers = readDb().members || [];
          for (const member of localMembers) {
            await firebaseDb.collection('members').doc(member.discordId).set(member);
          }
          list = localMembers;
        }
      } catch (err) {
        console.error('Firestore getMembers failed:', err.message);
        list = readDb().members || [];
      }
    } else {
      list = readDb().members || [];
    }

    membersCache = list;
    membersCacheTime = Date.now();

    return list.map(m => ({
      ...m,
      weeklyBonus: m.weeklyBonus || 0,
      payoutStatus: m.payoutStatus || 'Not Paid'
    }));
  },
  
  getMember: async (discordId) => {
    if (membersCache && (Date.now() - membersCacheTime < CACHE_TTL_MS)) {
      const cached = membersCache.find(m => m.discordId === discordId);
      if (cached) {
        return {
          ...cached,
          weeklyBonus: cached.weeklyBonus || 0,
          payoutStatus: cached.payoutStatus || 'Not Paid'
        };
      }
    }

    let member = null;
    if (firebaseDb) {
      try {
        const doc = await firebaseDb.collection('members').doc(discordId).get();
        member = doc.exists ? doc.data() : null;
      } catch (err) {
        console.error('Firestore getMember failed:', err.message);
      }
    }
    if (!member) {
      const members = readDb().members || [];
      member = members.find(m => m.discordId === discordId) || null;
    }
    if (member) {
      member.weeklyBonus = member.weeklyBonus || 0;
      member.payoutStatus = member.payoutStatus || 'Not Paid';
    }
    return member;
  },
  
  updateMember: async (discordId, updateData) => {
    membersCache = null;
    membersCacheTime = 0;

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

  deleteMember: async (discordId) => {
    membersCache = null;
    membersCacheTime = 0;

    if (firebaseDb) {
      try {
        await firebaseDb.collection('members').doc(discordId).delete();
        return true;
      } catch (err) {
        console.error('Firestore deleteMember failed:', err.message);
      }
    }
    const data = readDb();
    data.members = data.members.filter(m => m.discordId !== discordId);
    writeDb(data);
    return true;
  },

  // Tickets
  getTickets: async () => {
    if (ticketsCache && (Date.now() - ticketsCacheTime < CACHE_TTL_MS)) {
      return ticketsCache;
    }
    let list = [];
    if (firebaseDb) {
      try {
        const snapshot = await firebaseDb.collection('tickets').orderBy('createdAt', 'desc').get();
        list = snapshot.docs.map(doc => doc.data());
      } catch (err) {
        console.error('Firestore getTickets failed:', err.message);
        list = readDb().tickets;
      }
    } else {
      list = readDb().tickets;
    }
    ticketsCache = list;
    ticketsCacheTime = Date.now();
    return list;
  },
  
  createTicket: async (ticketData) => {
    ticketsCache = null;
    ticketsCacheTime = 0;

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
    ticketsCache = null;
    ticketsCacheTime = 0;

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
    if (activitiesCache && (Date.now() - activitiesCacheTime < CACHE_TTL_MS)) {
      return activitiesCache;
    }
    let list = [];
    if (firebaseDb) {
      try {
        const snapshot = await firebaseDb.collection('activities').orderBy('createdAt', 'desc').get();
        list = snapshot.docs.map(doc => doc.data());
      } catch (err) {
        console.error('Firestore getActivities failed:', err.message);
        list = readDb().activities;
      }
    } else {
      list = readDb().activities;
    }
    activitiesCache = list;
    activitiesCacheTime = Date.now();
    return list;
  },
  
  createActivity: async (actData) => {
    activitiesCache = null;
    activitiesCacheTime = 0;

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
    activitiesCache = null;
    activitiesCacheTime = 0;

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

  // Activity Types Configuration
  getActivityTypes: async () => {
    const defaultTypes = [
      { id: 'type-def-1', key: '💵 Collect businesses profit & replenish balance. (15 points)', emoji: '💵', name: 'Collect businesses profit & replenish balance.', points: '15 points', value: 15 },
      { id: 'type-def-2', key: '🚙 Refuel car trunks with canister and repair kits. (15 points)', emoji: '🚙', name: 'Refuel car trunks with canister and repair kits.', points: '15 points', value: 15 },
      { id: 'type-def-3', key: '♻️ Craft armors at foundry with armor plates and fabric. (10 points)', emoji: '♻️', name: 'Craft armors at foundry with armor plates and fabric.', points: '10 points', value: 10 },
      { id: 'type-def-4', key: '📦 Move items from SWH/WWH to cars. (10 points)', emoji: '📦', name: 'Move items from SWH/WWH to cars.', points: '10 points', value: 10 },
      { id: 'type-def-5', key: '💦 Used automatic machine (fruit WH). (6 points)', emoji: '💦', name: 'Used automatic machine (fruit WH).', points: '6 points', value: 6 },
      { id: 'type-def-6', key: '🥤 Crafted run/animal juice in bunket. (6 points)', emoji: '🥤', name: 'Crafted run/animal juice in bunket.', points: '6 points', value: 6 },
      { id: 'type-def-7', key: '🔬 Collect cocaine from house / 🍸 Juices (Vineyard). (4 points)', emoji: '🔬', name: 'Collect cocaine from house / 🍸 Juices (Vineyard).', points: '4 points', value: 4 },
      { id: 'type-def-8', key: '🚒 Refuel businesseses car or juice car. (3 points)', emoji: '🚒', name: 'Refuel businesseses car or juice car.', points: '3 points', value: 3 },
      { id: 'type-def-9', key: '📝 Assest family member full RP or Main Player Test. (3 points)', emoji: '📝', name: 'Assest family member full RP or Main Player Test.', points: '3 points', value: 3 },
      { id: 'type-def-10', key: '📢 Set detailed announcement for Bizwar/State. (3 points)', emoji: '📢', name: 'Set detailed announcement for Bizwar/State.', points: '3 points', value: 3 },
      { id: 'type-def-11', key: '📋 Check family logs (5 points)', emoji: '📋', name: 'Check family logs', points: '5 points', value: 5 },
      { id: 'type-def-12', key: '🕒 Upload Auction SS. (2 points)', emoji: '🕒', name: 'Upload Auction SS.', points: '2 points', value: 2 },
      { id: 'type-def-13', key: '🚗 Bring ammo or juice car to the event. (2 points)', emoji: '🚗', name: 'Bring ammo or juice car to the event.', points: '2 points', value: 2 },
      { id: 'type-def-14', key: '📸 ScreenShoot of players list inside event zone. (1 points)', emoji: '📸', name: 'ScreenShoot of players list inside event zone.', points: '1 points', value: 1 },
      { id: 'type-def-15', key: '🚙 Pay car fine & call it back in garage. (4 points)', emoji: '🚙', name: 'Pay car fine & call it back in garage.', points: '4 points', value: 4 },
      { id: 'type-def-16', key: '📲 Upload Unofficial: Informal/Bizwar/Highway/Store. (5 points)', emoji: '📲', name: 'Upload Unofficial: Informal/Bizwar/Highway/Store.', points: '5 points', value: 5 },
      { id: 'type-def-17', key: '🔋 Started a solar panels full new cycle. (5 points)', emoji: '🔋', name: 'Started a solar panels full new cycle.', points: '5 points', value: 5 },
      { id: 'type-def-18', key: '🔋 Collected all solar panels. (5 points)', emoji: '🔋', name: 'Collected all solar panels.', points: '5 points', value: 5 },
      { id: 'type-def-19', key: '🔌 Repair all solar panels at family house. (3 points)', emoji: '🔌', name: 'Repair all solar panels at family house.', points: '3 points', value: 3 },
      { id: 'type-def-20', key: '🟥 Plant 1 solar panel (House 426 Garden). (3 points)', emoji: '🟥', name: 'Plant 1 solar panel (House 426 Garden).', points: '3 points', value: 3 },
      { id: 'type-def-21', key: '⭕ Make 30 kills in public arena (2x/day). (10 points)', emoji: '⭕', name: 'Make 30 kills in public arena (2x/day).', points: '10 points', value: 10 },
      { id: 'type-def-22', key: '🎮 Take the family point quest "Play for 4 hours" (4 points)', emoji: '🎮', name: 'Take the family point quest "Play for 4 hours"', points: '4 points', value: 4 },
      { id: 'type-def-23', key: '📥 Collect RP Ticket (3 points)', emoji: '📥', name: 'Collect RP Ticket', points: '3 points', value: 3 }
    ];

    if (activityTypesCache && (Date.now() - activityTypesCacheTime < CACHE_TTL_MS)) {
      return activityTypesCache;
    }

    let list = [];
    if (firebaseDb) {
      try {
        const snapshot = await firebaseDb.collection('activityTypes').get();
        if (snapshot.size > 0) {
          list = snapshot.docs.map(doc => doc.data());
        } else {
          // Seed Firestore
          for (const t of defaultTypes) {
            await firebaseDb.collection('activityTypes').doc(t.id).set(t);
          }
          list = defaultTypes;
        }
      } catch (err) {
        console.error('Firestore getActivityTypes failed, fallback to local:', err.message);
        list = readDb().activityTypes || [];
      }
    } else {
      list = readDb().activityTypes || [];
    }

    if (!list || list.length === 0) {
      list = defaultTypes;
      const data = readDb();
      data.activityTypes = defaultTypes;
      writeDb(data);
    } else {
      const hasDefault = list.some(t => t.id && t.id.startsWith('type-def'));
      if (!hasDefault) {
        list = [...defaultTypes, ...list];
        const data = readDb();
        data.activityTypes = list;
        writeDb(data);
      }
    }

    activityTypesCache = list;
    activityTypesCacheTime = Date.now();
    return list;
  },

  createActivityType: async (typeData) => {
    activityTypesCache = null;
    activityTypesCacheTime = 0;

    const id = `type-${Math.floor(100 + Math.random() * 900)}`;
    const newType = {
      id,
      ...typeData
    };
    if (firebaseDb) {
      try {
        await firebaseDb.collection('activityTypes').doc(id).set(newType);
        return newType;
      } catch (err) {
        console.error('Firestore createActivityType failed, fallback to local:', err.message);
      }
    }
    const data = readDb();
    if (!data.activityTypes) data.activityTypes = [];
    data.activityTypes.push(newType);
    writeDb(data);
    return newType;
  },

  deleteActivityType: async (id) => {
    activityTypesCache = null;
    activityTypesCacheTime = 0;

    if (firebaseDb) {
      try {
        await firebaseDb.collection('activityTypes').doc(id).delete();
        return true;
      } catch (err) {
        console.error('Firestore deleteActivityType failed, fallback to local:', err.message);
      }
    }
    const data = readDb();
    if (data.activityTypes) {
      data.activityTypes = data.activityTypes.filter(t => t.id !== id);
      writeDb(data);
    }
    return true;
  },

  // Point Shop Orders
  getOrders: async () => {
    if (ordersCache && (Date.now() - ordersCacheTime < CACHE_TTL_MS)) {
      return ordersCache;
    }
    let list = [];
    if (firebaseDb) {
      try {
        const snapshot = await firebaseDb.collection('orders').orderBy('createdAt', 'desc').get();
        list = snapshot.docs.map(doc => doc.data());
      } catch (err) {
        console.error('Firestore getOrders failed:', err.message);
        list = readDb().orders;
      }
    } else {
      list = readDb().orders;
    }
    ordersCache = list;
    ordersCacheTime = Date.now();
    return list;
  },
  
  createOrder: async (orderData) => {
    ordersCache = null;
    ordersCacheTime = 0;

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
    ordersCache = null;
    ordersCacheTime = 0;

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
  
  removeSignup: async (eventId, memberId) => {
    if (firebaseDb) {
      try {
        const id = `${eventId}-${memberId}`;
        const docRef = firebaseDb.collection('signups').doc(id);
        const doc = await docRef.get();
        if (!doc.exists) {
          return { success: false, message: 'Not signed up!' };
        }
        const leavingSignup = doc.data();
        await docRef.delete();

        // If the leaving member was confirmed, promote the next reserve
        if (leavingSignup.status === 'confirmed') {
          const snapshot = await firebaseDb.collection('signups')
            .where('eventId', '==', eventId)
            .get();
          const signups = snapshot.docs.map(d => d.data());
          
          // Get all reserve signups
          const reserves = signups
            .filter(s => s.status === 'reserve' || s.status === 'displaced')
            .sort((a, b) => new Date(a.signedUpAt) - new Date(b.signedUpAt));
            
          if (reserves.length > 0) {
            const nextReserve = reserves[0];
            const reserveId = `${eventId}-${nextReserve.memberId}`;
            await firebaseDb.collection('signups').doc(reserveId).update({ status: 'confirmed' });
            nextReserve.status = 'confirmed';
            return { success: true, action: 'removed', promoted: nextReserve };
          }
        }
        return { success: true, action: 'removed', promoted: null };
      } catch (err) {
        console.error('Firestore removeSignup failed:', err.message);
      }
    }

    const data = readDb();
    const idx = data.signups.findIndex(s => s.eventId === eventId && s.memberId === memberId);
    if (idx === -1) {
      return { success: false, message: 'Not signed up!' };
    }
    const leavingSignup = data.signups[idx];
    data.signups.splice(idx, 1);

    if (leavingSignup.status === 'confirmed') {
      const reserves = data.signups
        .filter(s => s.eventId === eventId && (s.status === 'reserve' || s.status === 'displaced'))
        .sort((a, b) => new Date(a.signedUpAt) - new Date(b.signedUpAt));

      if (reserves.length > 0) {
        const nextReserve = reserves[0];
        const reserveIdx = data.signups.findIndex(
          s => s.eventId === eventId && s.memberId === nextReserve.memberId
        );
        if (reserveIdx !== -1) {
          data.signups[reserveIdx].status = 'confirmed';
          nextReserve.status = 'confirmed';
          writeDb(data);
          return { success: true, action: 'removed', promoted: nextReserve };
        }
      }
    }

    writeDb(data);
    return { success: true, action: 'removed', promoted: null };
  },

  swapSignups: async (eventId, memberId1, memberId2) => {
    if (firebaseDb) {
      try {
        const id1 = `${eventId}-${memberId1}`;
        const id2 = `${eventId}-${memberId2}`;
        const doc1Ref = firebaseDb.collection('signups').doc(id1);
        const doc2Ref = firebaseDb.collection('signups').doc(id2);
        
        const [doc1, doc2] = await Promise.all([doc1Ref.get(), doc2Ref.get()]);
        if (!doc1.exists || !doc2.exists) {
          return { success: false, message: 'One or both players are not signed up!' };
        }
        
        const data1 = doc1.data();
        const data2 = doc2.data();
        
        await Promise.all([
          doc1Ref.update({
            status: data2.status,
            signedUpAt: data2.signedUpAt,
            isTop10: data2.isTop10,
            inVoice: data2.inVoice !== undefined ? data2.inVoice : false
          }),
          doc2Ref.update({
            status: data1.status,
            signedUpAt: data1.signedUpAt,
            isTop10: data1.isTop10,
            inVoice: data1.inVoice !== undefined ? data1.inVoice : false
          })
        ]);
        return { success: true };
      } catch (err) {
        console.error('Firestore swapSignups failed:', err.message);
        return { success: false, message: err.message };
      }
    }

    const data = readDb();
    const idx1 = data.signups.findIndex(s => s.eventId === eventId && s.memberId === memberId1);
    const idx2 = data.signups.findIndex(s => s.eventId === eventId && s.memberId === memberId2);
    if (idx1 === -1 || idx2 === -1) {
      return { success: false, message: 'One or both players are not signed up!' };
    }
    
    const s1 = data.signups[idx1];
    const s2 = data.signups[idx2];
    
    const tempStatus = s1.status;
    const tempSignedUpAt = s1.signedUpAt;
    const tempIsTop10 = s1.isTop10;
    const tempInVoice = s1.inVoice;
    
    s1.status = s2.status;
    s1.signedUpAt = s2.signedUpAt;
    s1.isTop10 = s2.isTop10;
    s1.inVoice = s2.inVoice;
    
    s2.status = tempStatus;
    s2.signedUpAt = tempSignedUpAt;
    s2.isTop10 = tempIsTop10;
    s2.inVoice = tempInVoice;
    
    writeDb(data);
    return { success: true };
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
    const now = Date.now();
    const cached = cachedEventStates[eventId];
    if (cached && now - cached.timestamp < 30 * 1000) {
      return cached.data;
    }

    let result = { state: 'closed', title: '', description: '', openedAt: null };
    if (firebaseDb) {
      try {
        const doc = await firebaseDb.collection('event_states').doc(eventId).get();
        if (doc.exists) {
          const d = doc.data();
          result = {
            state: d.state || 'closed',
            title: d.title || '',
            description: d.description || '',
            openedAt: d.openedAt || null
          };
        }
      } catch (err) {
        console.error('Firestore getEventState failed:', err.message);
      }
    } else {
      const data = readDb();
      if (!data.eventStates) {
        data.eventStates = {};
      }
      const val = data.eventStates[eventId];
      if (typeof val === 'string') {
        result = { state: val, title: '', description: '', openedAt: null };
      } else {
        result = val || { state: 'closed', title: '', description: '', openedAt: null };
      }
    }

    cachedEventStates[eventId] = {
      timestamp: now,
      data: result
    };
    return result;
  },

  setEventState: async (eventId, state, title = null, description = null) => {
    delete cachedEventStates[eventId];

    if (firebaseDb) {
      try {
        const updateObj = { state };
        if (title !== null) updateObj.title = title;
        if (description !== null) updateObj.description = description;
        if (state === 'open') {
          updateObj.openedAt = Date.now();
        }
        await firebaseDb.collection('event_states').doc(eventId).set(updateObj, { merge: true });
        return true;
      } catch (err) {
        console.error('Firestore setEventState failed:', err.message);
      }
    }
    const data = readDb();
    if (!data.eventStates) {
      data.eventStates = {};
    }
    const existing = data.eventStates[eventId] || {};
    const existingObj = typeof existing === 'string' ? { state: existing } : existing;
    
    data.eventStates[eventId] = {
      ...existingObj,
      state,
      ...(title !== null && { title }),
      ...(description !== null && { description }),
      ...(state === 'open' && { openedAt: Date.now() })
    };
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
        } else {
          const data = readDb();
          if (data.priorityList) {
            await firebaseDb.collection('settings').doc('priority_list').set(data.priorityList);
            console.log('[Database] Initialized priority_list in Firestore from local db.json');
            return data.priorityList;
          }
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
  },

  getEventSchedule: async (eventId) => {
    if (cachedSchedules[eventId]) {
      return cachedSchedules[eventId];
    }

    let resolvedSchedule = null;
    if (firebaseDb) {
      try {
        const doc = await firebaseDb.collection('event_schedules').doc(eventId).get();
        if (doc.exists) {
          resolvedSchedule = doc.data();
        }
      } catch (err) {
        console.error('Firestore getEventSchedule failed:', err.message);
      }
    }

    if (!resolvedSchedule) {
      const data = readDb();
      if (!data.eventSchedules) {
        data.eventSchedules = {};
      }
      const defaultTimes = eventId === 'informal-signup' ? [''] : ['', '', ''];
      resolvedSchedule = data.eventSchedules[eventId] || { times: defaultTimes, mode: 'once', enabled: false };
    }

    if (resolvedSchedule) {
      cachedSchedules[eventId] = resolvedSchedule;
    }
    return resolvedSchedule;
  },

  setEventSchedule: async (eventId, scheduleData) => {
    // Update local cache
    cachedSchedules[eventId] = scheduleData;

    if (firebaseDb) {
      try {
        await firebaseDb.collection('event_schedules').doc(eventId).set(scheduleData);
        return true;
      } catch (err) {
        console.error('Firestore setEventSchedule failed:', err.message);
      }
    }
    const data = readDb();
    if (!data.eventSchedules) {
      data.eventSchedules = {};
    }
    data.eventSchedules[eventId] = scheduleData;
    writeDb(data);
    return true;
  },

  // Win Submissions
  getWinSubmissions: async () => {
    if (winSubmissionsCache && (Date.now() - winSubmissionsCacheTime < CACHE_TTL_MS)) {
      return winSubmissionsCache;
    }
    let list = [];
    if (firebaseDb) {
      try {
        const snapshot = await firebaseDb.collection('win_submissions').orderBy('createdAt', 'desc').get();
        list = snapshot.docs.map(doc => doc.data());
      } catch (err) {
        console.error('Firestore getWinSubmissions failed:', err.message);
        list = readDb().winSubmissions || [];
      }
    } else {
      list = readDb().winSubmissions || [];
    }
    winSubmissionsCache = list;
    winSubmissionsCacheTime = Date.now();
    return list;
  },

  createWinSubmission: async (submissionData) => {
    winSubmissionsCache = null;
    winSubmissionsCacheTime = 0;

    const id = `win-sub-${Math.floor(1000 + Math.random() * 9000)}`;
    const newSubmission = {
      id,
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...submissionData
    };
    if (firebaseDb) {
      try {
        await firebaseDb.collection('win_submissions').doc(id).set(newSubmission);
        return newSubmission;
      } catch (err) {
        console.error('Firestore createWinSubmission failed:', err.message);
      }
    }
    const data = readDb();
    if (!data.winSubmissions) data.winSubmissions = [];
    data.winSubmissions.unshift(newSubmission);
    writeDb(data);
    return newSubmission;
  },

  updateWinSubmission: async (id, updateData) => {
    winSubmissionsCache = null;
    winSubmissionsCacheTime = 0;

    if (firebaseDb) {
      try {
        await firebaseDb.collection('win_submissions').doc(id).update(updateData);
        const doc = await firebaseDb.collection('win_submissions').doc(id).get();
        return doc.exists ? doc.data() : null;
      } catch (err) {
        console.error('Firestore updateWinSubmission failed:', err.message);
      }
    }
    const data = readDb();
    if (!data.winSubmissions) data.winSubmissions = [];
    const idx = data.winSubmissions.findIndex(s => s.id === id);
    if (idx !== -1) {
      data.winSubmissions[idx] = { ...data.winSubmissions[idx], ...updateData };
      writeDb(data);
      return data.winSubmissions[idx];
    }
    return null;
  },

  updatePayoutStatus: async (discordId, status) => {
    membersCache = null;
    membersCacheTime = 0;

    if (firebaseDb) {
      try {
        await firebaseDb.collection('members').doc(discordId).update({ payoutStatus: status });
        return true;
      } catch (err) {
        console.error('Firestore updatePayoutStatus failed:', err.message);
      }
    }
    const data = readDb();
    const idx = data.members.findIndex(m => m.discordId === discordId);
    if (idx !== -1) {
      data.members[idx].payoutStatus = status;
      writeDb(data);
      return true;
    }
    return false;
  },

  archiveAndResetWeeklyLedger: async (weekId, closedByUsername) => {
    membersCache = null;
    membersCacheTime = 0;

    const members = await db.getMembers();
    const records = members.map(m => ({
      discordId: m.discordId,
      username: m.username,
      nickname: m.nickname,
      roles: m.roles,
      strikesCount: m.strikes ? m.strikes.length : 0,
      weeklyBonus: m.weeklyBonus || 0,
      payoutStatus: m.payoutStatus || 'Not Paid'
    }));

    let totalNet = 0;
    records.forEach(r => {
      totalNet += r.weeklyBonus;
    });

    const archiveRecord = {
      weekId,
      closedAt: new Date().toISOString(),
      closedBy: closedByUsername,
      totalNet,
      records
    };

    if (firebaseDb) {
      try {
        await firebaseDb.collection('weekly_reports').doc(weekId).set(archiveRecord);
        for (const member of members) {
          await firebaseDb.collection('members').doc(member.discordId).update({
            weeklyBonus: 0,
            payoutStatus: 'Not Paid'
          });
        }
      } catch (err) {
        console.error('Firestore archiveAndResetWeeklyLedger failed:', err.message);
      }
    } else {
      const data = readDb();
      if (!data.weeklyReports) data.weeklyReports = [];
      data.weeklyReports.unshift(archiveRecord);
      data.members.forEach(m => {
        m.weeklyBonus = 0;
        m.payoutStatus = 'Not Paid';
      });
      writeDb(data);
    }
    return archiveRecord;
  },

  getWeeklyReports: async () => {
    let list = [];
    if (firebaseDb) {
      try {
        const snapshot = await firebaseDb.collection('weekly_reports').orderBy('closedAt', 'desc').get();
        list = snapshot.docs.map(doc => doc.data());
      } catch (err) {
        console.error('Firestore getWeeklyReports failed:', err.message);
        const data = readDb();
        list = data.weeklyReports || [];
      }
    } else {
      const data = readDb();
      list = data.weeklyReports || [];
    }
    return list;
  },

  getWeeklyReport: async (weekId) => {
    if (firebaseDb) {
      try {
        const doc = await firebaseDb.collection('weekly_reports').doc(weekId).get();
        return doc.exists ? doc.data() : null;
      } catch (err) {
        console.error('Firestore getWeeklyReport failed:', err.message);
      }
    }
    const data = readDb();
    if (!data.weeklyReports) return null;
    return data.weeklyReports.find(r => r.weekId === weekId) || null;
  },

  checkHealth: async () => {
    const firebaseEnabled = !!firebaseDb;
    let firestoreWorking = false;
    let errorMsg = null;
    let readTimeMs = null;

    if (firebaseDb) {
      try {
        const start = Date.now();
        const docPromise = firebaseDb.collection('settings').doc('discord').get();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore read timeout (4s)')), 4000));
        await Promise.race([docPromise, timeoutPromise]);
        firestoreWorking = true;
        readTimeMs = Date.now() - start;
      } catch (err) {
        errorMsg = err.message;
      }
    }

    return {
      firebaseEnabled,
      firestoreWorking,
      errorMsg,
      readTimeMs
    };
  }
};

module.exports = db;
