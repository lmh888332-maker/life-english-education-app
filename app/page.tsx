"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Screen =
  | "auth"
  | "signedout"
  | "home"
  | "world"
  | "lab"
  | "series"
  | "dialogue"
  | "words"
  | "review"
  | "growth"
  | "profile"
  | "account"
  | "logout";

type Level = "foundation" | "intermediate" | "advanced";

type RouteDays = Record<Level, number>;
type RouteCheckinDates = Record<Level, string | null>;

type SceneKey =
  | "cafe"
  | "convenience"
  | "restaurant"
  | "directions"
  | "supermarket"
  | "clinic"
  | "campus"
  | "hotel"
  | "airport"
  | "customs"
  | "lost"
  | "roommate"
  | "refund"
  | "groupwork"
  | "interview"
  | "project"
  | "briefing"
  | "salary"
  | "debate"
  | "crisis";

type DialogueTurn = {
  npc: string;
  cn: string;
  choices: string[];
  correct: number;
  tip: string;
  phrase: string;
};

type LabScene = "hotel" | "airport" | "interview" | "crisis";

type LabMessage = {
  role: "assistant" | "user";
  text: string;
  cn?: string;
  feedback?: string;
};

type AdaptiveLabReply = {
  text: string;
  cn: string;
};

type LabCloudStatus = "checking" | "ready" | "missing" | "unavailable";

type LabApiReply = {
  reply?: string;
  translation?: string;
  feedback?: string;
  code?: string;
  message?: string;
};

type SeriesSubtitleMode = "bilingual" | "english" | "hidden";
type SeriesPanelTab = "mission" | "roleplay" | "report";
type SeriesPracticeMode = "phrase" | "sentence";

type SeriesLine = {
  speaker: string;
  en: string;
  cn: string;
  phrase: string;
  meaning: string;
  usage: string;
};

type SeriesEpisode = {
  id: string;
  number: string;
  title: string;
  image: string;
  route: Level;
  level: string;
  goal: string;
  role: string;
  roleOpening: string;
  roleOpeningCn: string;
  quickReplies: string[];
  lines: SeriesLine[];
};

type PersistedLearningData = {
  registered?: boolean;
  signedIn?: boolean;
  name?: string;
  level?: Level;
  xp?: number;
  streak?: number;
  lastCheckinDate?: string | null;
  routeDays?: Partial<RouteDays>;
  routeCheckinDates?: Partial<RouteCheckinDates>;
  completedScenes?: SceneKey[];
  savedPhrases?: string[];
  watchedSeriesEpisodes?: string[];
  practicedSeriesEpisodes?: string[];
  roleplayedSeriesEpisodes?: string[];
  completedSeriesEpisodes?: string[];
  seriesBestScores?: Record<string, number>;
};

type AccountApiResponse = {
  ok?: boolean;
  created?: boolean;
  token?: string;
  data?: PersistedLearningData;
  code?: string;
  message?: string;
};

type SpeechRecognitionResultLike = {
  [index: number]: { transcript: string };
};

type SpeechRecognitionEventLike = {
  results: { [index: number]: SpeechRecognitionResultLike; length: number };
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
  message?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const labScenarioData: Record<LabScene, {
  title: string;
  role: string;
  goal: string;
  goalEn: string;
  opening: string;
  openingCn: string;
  replies: Array<{ text: string; cn: string }>;
}> = {
  hotel: {
    title: "酒店前台自由协商",
    role: "Nora · 酒店经理",
    goal: "找回预订，并协商同等房型或补偿",
    goalEn: "Recover the booking and negotiate an equivalent room or fair compensation",
    opening: "Good evening. I’m sorry, but I still can’t find a reservation under your name. How would you like us to proceed?",
    openingCn: "晚上好，很抱歉，我仍然找不到你的预订。你希望我们如何处理？",
    replies: [
      { text: "I understand. Could you show me the confirmation email so I can search by the booking reference?", cn: "我明白。可以给我看确认邮件吗？我可以用预订编号搜索。" },
      { text: "I’ve located the booking, but the original room type is unavailable. What outcome would feel fair to you?", cn: "我找到预订了，但原房型已经没有了。你认为怎样处理比较合理？" },
      { text: "I can offer a suite at no extra charge and include breakfast. Would that resolve the issue?", cn: "我可以免费升级套房并包含早餐。这样可以解决问题吗？" },
    ],
  },
  airport: {
    title: "航班超售现场改签",
    role: "Alex · 航空服务专员",
    goal: "说明不可妥协的行程限制并争取替代方案",
    goalEn: "Explain your non-negotiable travel constraints and secure an alternative route",
    opening: "Your flight is overbooked. The next direct service leaves tomorrow morning. What constraints should I consider before I look for alternatives?",
    openingCn: "你的航班超售了。下一班直飞是明早。寻找替代方案前，我需要考虑你的哪些限制？",
    replies: [
      { text: "Thanks for explaining. I can check partner airlines if you tell me your latest acceptable arrival time.", cn: "谢谢说明。如果你告诉我最晚可接受的到达时间，我可以查询合作航空公司。" },
      { text: "There is one route via Seoul, but it adds a connection. Would you like me to protect that seat while we compare options?", cn: "有一条经首尔的路线，但会增加一次转机。比较方案时，需要我先保留这个座位吗？" },
      { text: "The change fee can be waived because the disruption is on our side. Is there anything else you need confirmed?", cn: "由于问题由航空公司造成，改签费可以免除。还有什么需要确认的吗？" },
    ],
  },
  interview: {
    title: "英文面试连续追问",
    role: "Jordan · 产品负责人",
    goal: "用具体事例回答，并承接不可预测的追问",
    goalEn: "Answer with a concrete example and handle unpredictable follow-up questions",
    opening: "Tell me about a decision you made with incomplete information, and how you managed the risk.",
    openingCn: "请谈谈一次你在信息不完整时做出的决定，以及你如何管理风险。",
    replies: [
      { text: "What evidence did you rely on, and what assumption turned out to be wrong?", cn: "你依靠了哪些证据？哪个假设后来被证明是错误的？" },
      { text: "How did you communicate that uncertainty to stakeholders without losing their confidence?", cn: "你如何向利益相关者说明不确定性，同时不失去他们的信任？" },
      { text: "If you faced the same situation again, what would you change first?", cn: "如果再次遇到相同情况，你首先会改变什么？" },
    ],
  },
  crisis: {
    title: "数据事故危机沟通",
    role: "Reese · 媒体记者",
    goal: "在信息不完整时区分已知、未知与下一步行动",
    goalEn: "Separate verified facts, unknowns and next actions while information is incomplete",
    opening: "Customers say private files appeared in shared search results. Can you guarantee that no sensitive data was accessed?",
    openingCn: "客户称私人文件出现在共享搜索结果中。你能保证没有敏感数据被访问吗？",
    replies: [
      { text: "What have you done immediately to contain the issue, and when will customers hear from you again?", cn: "你们立即采取了什么措施控制问题？客户何时会再次收到更新？" },
      { text: "Why should users trust your statement if the investigation is still incomplete?", cn: "如果调查尚未完成，用户为什么应该相信你们的声明？" },
      { text: "Will you commit to publishing verified findings, even if they are unfavorable?", cn: "即使结果不利，你们是否承诺公布经核实的调查结论？" },
    ],
  },
};

const labFocusWords: Record<LabScene, string[]> = {
  hotel: ["booking", "reservation", "confirmation", "room", "upgrade", "refund", "charge"],
  airport: ["flight", "arrival", "connection", "baggage", "fee", "route", "ticket"],
  interview: ["example", "decision", "evidence", "risk", "team", "result", "learned"],
  crisis: ["known", "confirm", "investigation", "audit", "contain", "update", "customers"],
};

function buildLabFeedback(scene: LabScene, text: string, messages: LabMessage[]) {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
  const previousUserMessages = messages.filter((message) => message.role === "user");
  const previous = previousUserMessages[previousUserMessages.length - 1]?.text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const hasPoliteFrame = /could|would|may|i understand|thanks|thank you|appreciate|provided|if possible/i.test(text);
  const hasSceneDetail = labFocusWords[scene].some((word) => normalized.includes(word));

  if (previous === normalized) {
    return "你重复了上一句话。真实沟通需要补充一个新信息，例如证据、时间限制或希望得到的结果。";
  }
  if (/^(could you )?help me(,? please)?[.!?]*$/i.test(text) || wordCount < 5) {
    return "表达能被听懂，但信息不足。请补充“发生了什么 + 你的限制 + 你希望对方怎么处理”。";
  }
  if (hasSceneDetail && hasPoliteFrame) {
    return "回应很完整：既有场景关键信息，也给出了礼貌、可执行的下一步。";
  }
  if (hasSceneDetail) {
    return "内容具体，已经能推动事情继续。再加入 could / would，语气会更专业自然。";
  }
  if (hasPoliteFrame) {
    return "语气自然，但还可以加入一个场景细节，让对方知道下一步该查什么或做什么。";
  }
  return "意思基本清楚。建议补充关键事实，并用 could / would 提出明确诉求。";
}

function buildAdaptiveLabReply(scene: LabScene, text: string, messages: LabMessage[]): AdaptiveLabReply {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
  const previousUserMessages = messages.filter((message) => message.role === "user");
  const previous = previousUserMessages[previousUserMessages.length - 1]?.text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const turnNumber = previousUserMessages.length;
  const repeated = previous === normalized;
  const vagueHelp = /^(could you )?help me(,? please)?[.!?]*$/i.test(text)
    || /^(what (can|should) i do|i don['’]t know)[.!?]*$/i.test(text);

  if (repeated) {
    const prompts: Record<LabScene, AdaptiveLabReply> = {
      hotel: {
        text: "I heard your request, but I need one new detail to act on it. Do you have a booking reference, and what outcome would you accept?",
        cn: "我听到了你的请求，但还需要一个新信息才能处理：你有预订编号吗？你能接受怎样的解决方案？",
      },
      airport: {
        text: "I understand you need help. Please add one constraint: your latest arrival time, baggage needs, or whether a connection is acceptable.",
        cn: "我明白你需要帮助。请补充一个限制：最晚到达时间、行李需求，或是否能接受转机。",
      },
      interview: {
        text: "Let’s move beyond the same sentence. Give me one real example: what decision did you make, and what was at risk?",
        cn: "我们不要重复同一句话。请给出一个真实例子：你做了什么决定？当时有什么风险？",
      },
      crisis: {
        text: "Repeating the request does not reduce the uncertainty. Tell me one verified fact and one immediate action your team has taken.",
        cn: "重复请求并不能减少不确定性。请告诉我一个已经核实的事实，以及团队立即采取的一项行动。",
      },
    };
    return prompts[scene];
  }

  if (vagueHelp) {
    const prompts: Record<LabScene, AdaptiveLabReply> = {
      hotel: {
        text: "Of course. To help with the missing reservation, I need your booking reference, check-in date, and the solution you want. Which one can you give me first?",
        cn: "当然可以。为了处理找不到的预订，我需要预订编号、入住日期，以及你希望的解决方案。你可以先提供哪一项？",
      },
      airport: {
        text: "I can help, but I need your travel constraint first. What is the latest time you can arrive, and can you accept one connection?",
        cn: "我可以帮忙，但要先知道你的行程限制。你最晚几点必须到达？能接受一次转机吗？",
      },
      interview: {
        text: "I can guide you. Start with one specific situation: what decision did you make with incomplete information, and why did it matter?",
        cn: "我可以引导你。先说一个具体情境：你在信息不完整时做了什么决定？为什么这件事重要？",
      },
      crisis: {
        text: "I can help you structure the response. First separate what is verified, what is still unknown, and what action has already been taken.",
        cn: "我可以帮你组织回应。先区分：已经核实的事实、仍未知的部分，以及已经采取的行动。",
      },
    };
    return prompts[scene];
  }

  if (scene === "hotel") {
    if (/accept|works for me|thank|that['’]s fine|sounds good/.test(normalized) && turnNumber > 0) {
      return {
        text: "Great. I’ll document the solution with no additional charge and send written confirmation. Which email address should receive it?",
        cn: "好的。我会记录这个无需额外付费的方案并发送书面确认。请问确认邮件应发送到哪个邮箱？",
      };
    }
    if (/upgrade|equivalent|same room|no (extra|additional) charge|refund|breakfast|late checkout/.test(normalized)) {
      return {
        text: "Your requested outcome is clear. I can offer an equivalent room tonight or a complimentary upgrade with no additional charge. Which should I confirm?",
        cn: "你的诉求很明确。我可以安排今晚的同等房型，或免费升级且不收取额外费用。你希望我确认哪一种？",
      };
    }
    if (/booking|reservation|confirmation|reference|email|check-in|check in/.test(normalized)) {
      return turnNumber === 0
        ? {
            text: "That gives me something concrete to verify. Please share the booking reference and check-in date; I’ll search both our direct and partner systems.",
            cn: "这提供了可以核实的线索。请告诉我预订编号和入住日期，我会同时查询直营和合作渠道系统。",
          }
        : {
            text: "I’ve matched the reference to a valid booking. The original room is unavailable, so what would be fairer for you: a free upgrade or a full refund?",
            cn: "我已经用编号匹配到有效预订。原房型无法提供，你认为免费升级和全额退款哪种更合适？",
          };
    }
    return {
      text: "I want to solve the right problem. Could you tell me what proof of booking you have and the exact outcome you want tonight?",
      cn: "我想准确解决问题。请告诉我你持有什么预订凭证，以及你今晚希望得到的具体处理结果。",
    };
  }

  if (scene === "airport") {
    if (/accept|book it|protect (the )?seat|works|thank/.test(normalized) && turnNumber > 0) {
      return {
        text: "I’ll protect that seat now and waive the change fee. Before I issue it, should your checked baggage be transferred automatically?",
        cn: "我现在为你保留座位并免除改签费。出票前确认一下：托运行李需要自动转运吗？",
      };
    }
    if (/baggage|bag|fee|charge|cost|pay/.test(normalized)) {
      return {
        text: "Because the disruption is on our side, there will be no change fee, and your checked baggage can be transferred. Shall I confirm that itinerary?",
        cn: "由于问题由航空公司造成，不会收取改签费，托运行李也可以转运。需要我确认这条行程吗？",
      };
    }
    if (/arriv|latest|before|meeting|connection|direct|route|tomorrow|today/.test(normalized)) {
      return {
        text: "Based on that timing, I found a partner-airline route with one connection that arrives today. Would one connection be acceptable if I waive all change fees?",
        cn: "根据你的时间限制，我找到了一条合作航空公司的当日到达路线，需要转机一次。如果免除全部改签费，你能接受吗？",
      };
    }
    return {
      text: "To compare real alternatives, I need your latest acceptable arrival time and whether a connection is possible. What are those two constraints?",
      cn: "为了比较可行方案，我需要知道最晚可接受到达时间，以及是否能接受转机。这两个限制分别是什么？",
    };
  }

  if (scene === "interview") {
    if (/result|outcome|learned|next time|would change|improved/.test(normalized) && turnNumber > 0) {
      return {
        text: "That reflection is useful. What measurable result followed, and what would you change first if you faced the same uncertainty again?",
        cn: "这个反思很有价值。最终产生了什么可衡量结果？如果再次面对同样的不确定性，你首先会改变什么？",
      };
    }
    if (/team|stakeholder|communicat|manager|client|confidence/.test(normalized)) {
      return {
        text: "How did you communicate the uncertainty without sounding indecisive, and what did you ask stakeholders to approve?",
        cn: "你如何说明不确定性而不显得犹豫？你具体请利益相关者批准了什么？",
      };
    }
    if (/data|evidence|research|feedback|assumption|risk|test/.test(normalized)) {
      return {
        text: "Which piece of evidence influenced you most, and which assumption later turned out to be wrong?",
        cn: "哪一项证据对你的决定影响最大？后来哪个假设被证明是错误的？",
      };
    }
    return {
      text: "Give me the answer as a concrete story: the situation, the decision you owned, the risk, and the result. Which part can you make more specific?",
      cn: "请把答案讲成一个具体故事：情境、你负责的决定、风险和结果。你最能把哪一部分说具体？",
    };
  }

  if (/publish|transparent|verified findings|disclose|report/.test(normalized) && turnNumber > 0) {
    return {
      text: "Will you commit to publishing verified findings even if they are unfavorable, and what remedy will affected customers receive?",
      cn: "即使结果不利，你是否承诺公布经核实的结论？受影响客户将得到什么补救？",
    };
  }
  if (/contain|disable|audit|logs|isolate|immediate|action/.test(normalized)) {
    return {
      text: "Those containment steps are specific. When will customers receive the next verified update, and who is accountable for it?",
      cn: "这些控制措施很具体。客户何时会收到下一次经核实的更新？由谁负责？",
    };
  }
  if (/can['’]t confirm|cannot confirm|unknown|investigat|not sure|no guarantee|verify/.test(normalized)) {
    return {
      text: "That distinction is responsible, but users still need action. What have you contained already, and when will you publish the next update?",
      cn: "这样的事实边界是负责任的，但用户仍需要看到行动。你们已经控制了什么？下次更新时间是什么时候？",
    };
  }
  return {
    text: "Please separate your answer into three parts: what is verified, what remains unknown, and what action customers can expect next.",
    cn: "请把回应分成三部分：已经核实的事实、仍然未知的部分，以及客户接下来可以期待的行动。",
  };
}

const foundationDialogueData: Partial<Record<SceneKey, DialogueTurn[]>> = {
  cafe: [
    {
      npc: "Hi! What can I get for you today?",
      cn: "你好！今天想喝点什么？",
      choices: [
        "I'd like an oat latte, please.",
        "I am an oat latte, please.",
        "Give me coffee right now.",
      ],
      correct: 0,
      tip: "“I'd like…” 比 “I want…” 更自然礼貌。",
      phrase: "I'd like…",
    },
    {
      npc: "Sure. What size would you like?",
      cn: "好的。你想要什么杯型？",
      choices: [
        "A medium one, please.",
        "I have medium.",
        "Medium is me.",
      ],
      correct: 0,
      tip: "one 可以代替前面提到的 latte，避免重复。",
      phrase: "A medium one",
    },
    {
      npc: "Would you like it hot or iced?",
      cn: "想要热的还是冰的？",
      choices: [
        "Iced, please. That's all, thank you.",
        "I am ice.",
        "No temperature.",
      ],
      correct: 0,
      tip: "That's all 表示“就这些”，点单结束时非常实用。",
      phrase: "That's all",
    },
  ],
  airport: [
    {
      npc: "Good morning. May I see your passport?",
      cn: "早上好，可以看一下你的护照吗？",
      choices: ["Sure, here you are.", "My passport sees you.", "No see."],
      correct: 0,
      tip: "递给别人东西时，用 Here you are 最自然。",
      phrase: "Here you are",
    },
    {
      npc: "Are you checking any bags today?",
      cn: "今天有要托运的行李吗？",
      choices: [
        "Yes, one suitcase.",
        "My suitcase is yes.",
        "I check the airport.",
      ],
      correct: 0,
      tip: "check a bag 在机场语境中表示“托运行李”。",
      phrase: "check a bag",
    },
    {
      npc: "Would you prefer an aisle or a window seat?",
      cn: "你想要靠过道还是靠窗的座位？",
      choices: [
        "A window seat, please.",
        "I sit the window.",
        "The window likes me.",
      ],
      correct: 0,
      tip: "window seat 是靠窗座位，aisle seat 是靠过道座位。",
      phrase: "a window seat",
    },
  ],
};

const dialogueData: Partial<Record<SceneKey, DialogueTurn[]>> = {
  cafe: [
    {
      npc: "I'm afraid we're out of oat milk. Would almond milk work instead?",
      cn: "不好意思，燕麦奶没有了。换成杏仁奶可以吗？",
      choices: [
        "No, because oat milk is the only correct milk.",
        "Almond milk would be fine, provided there's no extra charge.",
        "I'd rather you didn't run out of it.",
      ],
      correct: 1,
      tip: "provided 表达附带条件，比单纯说 yes 更完整、自然。",
      phrase: "provided there's no extra charge",
    },
    {
      npc: "I may have made that hot instead of iced. Would you like me to remake it?",
      cn: "我可能把冰饮做成热饮了。需要我重新做一杯吗？",
      choices: [
        "If it isn't too much trouble, that would be great.",
        "You should remake it because mistakes are bad.",
        "I was wanting it to be remade by you.",
      ],
      correct: 0,
      tip: "If it isn't too much trouble 能在提出要求时缓和语气。",
      phrase: "If it isn't too much trouble",
    },
    {
      npc: "Of course. It'll take about eight minutes. Is that all right?",
      cn: "当然可以，大约需要八分钟。你能接受吗？",
      choices: [
        "Eight minutes have no problem to me.",
        "I will be waited at the counter.",
        "That's fine; I'll wait by the pickup counter.",
      ],
      correct: 2,
      tip: "That's fine 先回应对方，再说明下一步行动，信息最完整。",
      phrase: "I'll wait by the pickup counter",
    },
  ],
  airport: [
    {
      npc: "The flight is overbooked. I can offer you a seat on the 6 p.m. service.",
      cn: "本次航班超售，我可以为你安排下午六点的航班。",
      choices: [
        "That schedule is impossible and unacceptable to my person.",
        "I have a connection I can't miss. Are there any seats available through another hub?",
        "Put me on any plane that leaves this airport.",
      ],
      correct: 1,
      tip: "先交代不可妥协的限制，再提出替代方案，更利于协商。",
      phrase: "a connection I can't miss",
    },
    {
      npc: "I can reroute you via Seoul, but you'd arrive two hours later.",
      cn: "我可以让你经首尔转机，但会晚到两个小时。",
      choices: [
        "Rerouting has been accepted by me.",
        "Two hours later is not what I had booked originally.",
        "That works, provided my checked bag is transferred automatically.",
      ],
      correct: 2,
      tip: "接受方案的同时确认行李条件，避免后续风险。",
      phrase: "provided my bag is transferred",
    },
    {
      npc: "There may be a fare difference for that itinerary.",
      cn: "这条行程可能会产生票价差额。",
      choices: [
        "Since the change is due to overbooking, could you confirm the fee will be waived?",
        "I refuse every difference of your fare.",
        "The airline needs to pay differences instead of passengers always.",
      ],
      correct: 0,
      tip: "指出责任原因并礼貌确认规则，比直接拒绝更专业。",
      phrase: "could you confirm the fee will be waived",
    },
  ],
  hotel: [
    {
      npc: "I'm sorry, but I can't seem to find your reservation in our system.",
      cn: "很抱歉，我在系统里似乎找不到你的预订。",
      choices: [
        "Then your system must be completely broken.",
        "I booked through your website. Would the confirmation number help you locate it?",
        "My reservation should have been found already.",
      ],
      correct: 1,
      tip: "说明预订渠道并主动提供确认号，能推动问题解决。",
      phrase: "Would the confirmation number help?",
    },
    {
      npc: "I found it, but the room type you booked is no longer available tonight.",
      cn: "找到了，但你预订的房型今晚已经没有了。",
      choices: [
        "I don't accept rooms which are not mine.",
        "You need to give me the most expensive room now.",
        "What comparable options can you offer without an additional charge?",
      ],
      correct: 2,
      tip: "comparable options 明确要求同等替代方案，同时限定不加价。",
      phrase: "comparable options",
    },
    {
      npc: "We can upgrade you to a suite, though breakfast isn't included.",
      cn: "我们可以升级为套房，不过不含早餐。",
      choices: [
        "Given the inconvenience, would it be possible to include breakfast as well?",
        "Breakfast should be included because I like it.",
        "The inconvenience makes breakfast necessary for me.",
      ],
      correct: 0,
      tip: "Given the inconvenience 合理连接补偿诉求与问题原因。",
      phrase: "Given the inconvenience",
    },
  ],
  interview: [
    {
      npc: "Tell me about a project that didn't go as planned.",
      cn: "请谈谈一个没有按计划推进的项目。",
      choices: [
        "None of my projects have really failed so far.",
        "The deadline was missed because the team didn't cooperate.",
        "We missed an early milestone, so I reset priorities and introduced weekly risk reviews.",
      ],
      correct: 2,
      tip: "用问题—行动—结果结构回答，比回避失败或归责他人更有说服力。",
      phrase: "I reset priorities",
    },
    {
      npc: "How did you handle resistance from stakeholders?",
      cn: "你是如何处理利益相关者的反对意见的？",
      choices: [
        "I mapped their concerns to data, then proposed a small pilot before full rollout.",
        "I persuaded them until they eventually agreed with me.",
        "Stakeholders usually resist because they don't understand the details.",
      ],
      correct: 0,
      tip: "用具体方法和低风险试点展示协商能力，而不是强调说服。",
      phrase: "proposed a small pilot",
    },
    {
      npc: "What would you do differently if you faced the same situation again?",
      cn: "如果再次面对同样的情况，你会有什么不同做法？",
      choices: [
        "I would try much harder from the very beginning.",
        "I'd surface the risk earlier and agree on decision criteria before execution.",
        "I wouldn't choose a project with that level of uncertainty.",
      ],
      correct: 1,
      tip: "具体说明提前识别风险与决策标准，体现可迁移的反思。",
      phrase: "surface the risk earlier",
    },
  ],
};

const extraDialogueData: Record<Exclude<SceneKey, "cafe" | "airport" | "hotel" | "interview">, DialogueTurn[]> = {
  convenience: [
    {
      npc: "Would you like a bag for that?",
      cn: "这些需要袋子吗？",
      choices: ["No, thank you. I brought my own.", "I am not a bag.", "You don't give bag."],
      correct: 0,
      tip: "先礼貌拒绝，再补充原因，表达清楚又自然。",
      phrase: "I brought my own",
    },
    {
      npc: "Will you be paying by cash or card?",
      cn: "请问现金还是刷卡？",
      choices: ["My card will pay you.", "By card, please. Can I tap here?", "I choose the money machine."],
      correct: 1,
      tip: "By card 是最简洁自然的回应，tap 表示感应支付。",
      phrase: "Can I tap here?",
    },
  ],
  restaurant: [
    {
      npc: "Does anyone at the table have any allergies?",
      cn: "桌上有人对食物过敏吗？",
      choices: ["Peanuts are not for my body.", "I don't eat all allergy food.", "Yes, I'm allergic to peanuts."],
      correct: 2,
      tip: "be allergic to 是说明过敏最常用的搭配。",
      phrase: "I'm allergic to…",
    },
    {
      npc: "The curry is usually quite spicy. Is that okay?",
      cn: "咖喱通常比较辣，可以吗？",
      choices: ["Could you make it mild, please?", "Please delete the spicy.", "I can only eat a little fire."],
      correct: 0,
      tip: "make it mild 能清楚表达少辣要求。",
      phrase: "Could you make it mild?",
    },
  ],
  directions: [
    {
      npc: "Where are you trying to get to?",
      cn: "你想去哪里？",
      choices: ["I lose my subway.", "I'm looking for the nearest subway station.", "Where subway is becoming?"],
      correct: 1,
      tip: "I'm looking for… 是问路时非常实用的开场。",
      phrase: "I'm looking for…",
    },
    {
      npc: "Take the second left after the bank.",
      cn: "经过银行后，在第二个路口左转。",
      choices: ["So I turn left at the second street after the bank, right?", "The bank takes me left.", "Second left is not a direction."],
      correct: 0,
      tip: "复述路线并用 right? 确认，可以避免听错。",
      phrase: "So I…, right?",
    },
  ],
  supermarket: [
    {
      npc: "Could you tell me what's wrong with the item?",
      cn: "可以告诉我商品有什么问题吗？",
      choices: ["This item is a bad one.", "It was damaged when I opened the package.", "The package made damage for me."],
      correct: 1,
      tip: "说明发现问题的时间和具体状态，更便于售后处理。",
      phrase: "It was damaged when…",
    },
    {
      npc: "Do you have the receipt with you?",
      cn: "你带收据了吗？",
      choices: ["Receipt is here and exchange it.", "I have receipt yesterday.", "Yes, here it is. Could I exchange it for a new one?"],
      correct: 2,
      tip: "递交收据后明确提出 exchange，信息完整。",
      phrase: "Could I exchange it?",
    },
  ],
  clinic: [
    {
      npc: "What seems to be the problem today?",
      cn: "今天哪里不舒服？",
      choices: ["I've had a sore throat for three days.", "My throat is doing pain.", "Three days are sick to me."],
      correct: 0,
      tip: "现在完成时可以自然说明症状持续了多久。",
      phrase: "I've had… for three days",
    },
    {
      npc: "Have you had a fever as well?",
      cn: "也有发烧吗？",
      choices: ["Fever was a little to me.", "A slight fever last night, but it has gone down.", "I am no fever person."],
      correct: 1,
      tip: "slight 表示轻微，gone down 表示体温已经下降。",
      phrase: "a slight fever",
    },
  ],
  campus: [
    {
      npc: "Are you looking for a particular classroom?",
      cn: "你在找某一间教室吗？",
      choices: ["Yes, I'm trying to find Room 204.", "The classroom has lost me.", "I need a room of two zero four."],
      correct: 0,
      tip: "I'm trying to find… 既自然又能说明当前目的。",
      phrase: "I'm trying to find…",
    },
    {
      npc: "That class was moved online this morning.",
      cn: "那门课今天早上改为线上了。",
      choices: ["Online moved the classroom.", "Thanks for letting me know. Where can I check the notice?", "Nobody told this thing to me."],
      correct: 1,
      tip: "先回应信息，再询问通知渠道，能解决后续问题。",
      phrase: "Thanks for letting me know",
    },
  ],
  customs: [
    {
      npc: "What is the purpose of your visit?",
      cn: "你此次入境的目的是什么？",
      choices: ["I visit because I want.", "I'm here for tourism and will stay for nine days.", "My purpose is entering this country."],
      correct: 1,
      tip: "同时说明目的和停留时间，回答更完整。",
      phrase: "I'm here for tourism",
    },
    {
      npc: "Where will you be staying during your trip?",
      cn: "旅行期间你住在哪里？",
      choices: ["I'll be staying at the Harbor Hotel in central Tokyo.", "The hotel will stay me.", "I have somewhere in the city."],
      correct: 0,
      tip: "用 will be staying 表达已经安排好的临时住宿。",
      phrase: "I'll be staying at…",
    },
  ],
  lost: [
    {
      npc: "Can you describe the item you lost?",
      cn: "可以描述一下你丢失的物品吗？",
      choices: ["It is lost and belongs to me.", "It's a small black wallet with a silver zipper.", "A wallet is looking black."],
      correct: 1,
      tip: "颜色、大小和明显特征能帮助工作人员识别物品。",
      phrase: "with a silver zipper",
    },
    {
      npc: "Where did you last see it?",
      cn: "你最后在哪里见到它？",
      choices: ["It was most recently before now.", "I lost where the ticket machines are.", "I last used it near the ticket machines around 3 p.m."],
      correct: 2,
      tip: "地点加时间是最有效的遗失线索。",
      phrase: "I last used it near…",
    },
  ],
  roommate: [
    {
      npc: "Is the music bothering you while you study?",
      cn: "我放音乐会打扰你学习吗？",
      choices: ["A little. Could we keep it down after ten?", "Your music is always a problem.", "I forbid loud sounds in this house."],
      correct: 0,
      tip: "承认影响程度，并提出明确时间边界，利于协商。",
      phrase: "Could we keep it down?",
    },
    {
      npc: "I sometimes work late. Would headphones solve it?",
      cn: "我偶尔工作到很晚，戴耳机可以解决吗？",
      choices: ["Headphones must be used forever.", "That would work. I'll let you know if I have an early exam.", "Your work should finish earlier."],
      correct: 1,
      tip: "接受方案并补充特殊情况，体现双向协商。",
      phrase: "That would work",
    },
  ],
  refund: [
    {
      npc: "I can see the subscription was cancelled after the renewal date.",
      cn: "我看到订阅是在续费日期之后取消的。",
      choices: ["Your renewal steals my money.", "I understand, but I submitted the cancellation request two days earlier. Could you check the timestamp?", "Refund it because I don't use it."],
      correct: 1,
      tip: "先承接对方信息，再提供可核查证据，协商更有力。",
      phrase: "Could you check the timestamp?",
    },
    {
      npc: "You're right—the request was delayed in our system.",
      cn: "你说得对，请求在系统中延迟了。",
      choices: ["In that case, could you confirm the full refund and when it will arrive?", "Then the problem is completely yours.", "I knew your system had failed me."],
      correct: 0,
      tip: "确认金额和到账时间，让解决方案真正闭环。",
      phrase: "could you confirm the full refund",
    },
  ],
  groupwork: [
    {
      npc: "I think we should add every feature before the presentation.",
      cn: "我认为演示前应该把所有功能都加上。",
      choices: ["That's unrealistic and won't work.", "We don't have enough time, obviously.", "I see the ambition, but could we prioritise the two features that prove our idea?"],
      correct: 2,
      tip: "先认可动机，再用问题引导优先级，比直接否定更利于合作。",
      phrase: "could we prioritise…",
    },
    {
      npc: "How would we decide which two matter most?",
      cn: "我们如何决定哪两个最重要？",
      choices: ["Let's score them by user value and effort, then test the top two.", "I will choose because I know the product.", "We can vote without discussing it."],
      correct: 0,
      tip: "提出透明的评价标准和验证动作，体现团队决策能力。",
      phrase: "score them by user value and effort",
    },
  ],
  project: [
    {
      npc: "The client now wants delivery a week earlier, with the full scope unchanged.",
      cn: "客户现在要求提前一周交付，范围保持不变。",
      choices: ["That's impossible, so the date must stay.", "We can meet the date if we phase the non-critical features into a second release.", "The team will work harder and see what happens."],
      correct: 1,
      tip: "把时间、范围和资源的取舍说清楚，才能形成可执行方案。",
      phrase: "phase the features into a second release",
    },
    {
      npc: "They may view that as an incomplete delivery. How would you frame it?",
      cn: "客户可能认为那是不完整交付，你会如何表述？",
      choices: ["I'd position it as an earlier launch of the core value, followed by measured expansion.", "I would avoid mentioning the missing features.", "They should understand that development takes time."],
      correct: 0,
      tip: "用核心价值和可衡量的后续扩展重构叙事。",
      phrase: "an earlier launch of the core value",
    },
  ],
  briefing: [
    {
      npc: "Your forecast assumes adoption will double. What evidence supports that?",
      cn: "你的预测假设采用率会翻倍，有什么证据？",
      choices: ["The market looks very positive at the moment.", "It's a directional estimate based on two pilots; I'd present a base case and a downside case as well.", "Forecasts are never completely accurate anyway."],
      correct: 1,
      tip: "承认不确定性，同时说明证据范围和多情景预测，更可信。",
      phrase: "a base case and a downside case",
    },
    {
      npc: "What would trigger a change in your recommendation?",
      cn: "什么情况会让你改变建议？",
      choices: ["If week-four retention falls below 25%, I'd pause expansion and revisit onboarding.", "I would change it if the results were bad.", "The recommendation should not need changing."],
      correct: 0,
      tip: "用具体指标、阈值和动作定义决策条件。",
      phrase: "What would trigger a change",
    },
  ],
  salary: [
    {
      npc: "What compensation range are you considering?",
      cn: "你期望的薪酬范围是多少？",
      choices: ["I want the highest amount in your budget.", "Based on the scope and market data, I'm targeting 70 to 78, while staying open to the total package.", "Salary isn't important, but I need more money."],
      correct: 1,
      tip: "给出依据、区间，并保留整体薪酬的协商空间。",
      phrase: "I'm open to the total package",
    },
    {
      npc: "Our base salary may be lower, but the role includes equity.",
      cn: "我们的基本工资可能较低，但岗位包含股权。",
      choices: ["Could we compare the vesting schedule and review point before I evaluate the trade-off?", "Equity is not real salary.", "Then increase both base and equity."],
      correct: 0,
      tip: "先询问归属周期和复审节点，再评估取舍。",
      phrase: "evaluate the trade-off",
    },
  ],
  debate: [
    {
      npc: "If AI saves time, why shouldn't schools use it for every assignment?",
      cn: "如果 AI 能节省时间，学校为什么不该在所有作业中使用它？",
      choices: ["Because AI is dangerous for students.", "Efficiency matters, but universal use could remove the productive struggle some learning goals require.", "Schools should ban it until everyone agrees."],
      correct: 1,
      tip: "承认对方价值，再指出适用边界，论证更有层次。",
      phrase: "the productive struggle",
    },
    {
      npc: "Isn't that boundary too subjective to enforce?",
      cn: "这个边界是否过于主观，难以执行？",
      choices: ["We can tie it to the assessed skill: use AI for feedback, but not when independent reasoning is the target.", "Teachers can decide whatever they want.", "Every rule is subjective in some way."],
      correct: 0,
      tip: "把边界与考核目标绑定，能将抽象原则变成规则。",
      phrase: "tie it to the assessed skill",
    },
  ],
  crisis: [
    {
      npc: "Customers are reporting that private files appeared in shared search results.",
      cn: "客户报告称私人文件出现在共享搜索结果中。",
      choices: ["We should wait until we know every detail.", "We've disabled the affected search path, begun an audit, and will update customers within two hours.", "The issue probably affects very few users."],
      correct: 1,
      tip: "危机沟通要同时说明已采取动作、调查状态和下一次更新时间。",
      phrase: "the affected search path",
    },
    {
      npc: "Can you guarantee no data was accessed?",
      cn: "你能保证没有数据被访问吗？",
      choices: ["Yes, I guarantee it was safe.", "No comment until the investigation ends.", "We can't confirm that yet; logs are being reviewed, and we'll share verified findings rather than speculate."],
      correct: 2,
      tip: "不虚假保证，也不回避；清楚划分已知、未知与验证动作。",
      phrase: "share verified findings",
    },
  ],
};

const allDialogueData = { ...dialogueData, ...extraDialogueData } as Record<SceneKey, DialogueTurn[]>;

const sceneMeta = {
  cafe: {
    route: "foundation", chapter: "01 · 生活起步", unlockDays: 0, eyebrow: "生活沟通 · 约 5 分钟",
    title: "第一次独立完成咖啡点单", shortTitle: "咖啡店点单", goal: "完成杯型、温度和结账表达",
    image: "/assets/cafe-scene.png", color: "coral", duration: "5 分钟", description: "从礼貌开口开始，完成一整次点单",
    cardClass: "coral-card", worldClass: "featured-cafe", levels: { foundation: "A1", intermediate: "A1", advanced: "A1" },
  },
  convenience: {
    route: "foundation", chapter: "01 · 生活起步", unlockDays: 1, eyebrow: "生活沟通 · 约 4 分钟",
    title: "在便利店结账并拒绝塑料袋", shortTitle: "便利店结账", goal: "听懂袋子与支付方式的问题并自然回应",
    image: "/assets/cafe-scene.png", color: "mint", duration: "4 分钟", description: "袋子、现金、刷卡，完成柜台快速交流",
    cardClass: "mint-card", worldClass: "featured-airport", levels: { foundation: "A1", intermediate: "A1", advanced: "A1" },
  },
  restaurant: {
    route: "foundation", chapter: "01 · 生活起步", unlockDays: 2, eyebrow: "餐饮沟通 · 约 5 分钟",
    title: "说明过敏并调整菜品口味", shortTitle: "餐厅特殊需求", goal: "清楚说明过敏原并提出少辣要求",
    image: "/assets/cafe-scene.png", color: "violet", duration: "5 分钟", description: "把健康限制和口味偏好准确说出来",
    cardClass: "violet-card", worldClass: "featured-hotel", levels: { foundation: "A1–A2", intermediate: "A1–A2", advanced: "A1–A2" },
  },
  directions: {
    route: "foundation", chapter: "02 · 城市探索", unlockDays: 3, eyebrow: "出行沟通 · 约 5 分钟",
    title: "在陌生城市问路并复述路线", shortTitle: "问路与换乘", goal: "问到最近地铁站并确认关键转弯信息",
    image: "/assets/airport-scene.png", color: "blue", duration: "5 分钟", description: "不只听懂路线，还能复述确认避免走错",
    cardClass: "blue-card", worldClass: "featured-interview", levels: { foundation: "A2", intermediate: "A2", advanced: "A2" },
  },
  supermarket: {
    route: "foundation", chapter: "02 · 城市探索", unlockDays: 5, eyebrow: "问题处理 · 约 6 分钟",
    title: "拿着损坏商品去超市退换", shortTitle: "超市退换货", goal: "描述商品问题、出示凭证并提出换货",
    image: "/assets/hotel-scene.png", color: "coral", duration: "6 分钟", description: "第一次用英语把售后问题完整办妥",
    cardClass: "coral-card", worldClass: "featured-cafe", levels: { foundation: "A2", intermediate: "A2", advanced: "A2" },
  },
  clinic: {
    route: "foundation", chapter: "02 · 城市探索", unlockDays: 7, eyebrow: "健康沟通 · 约 6 分钟",
    title: "在诊所说明症状和持续时间", shortTitle: "诊所看病", goal: "说明喉咙痛、发烧程度与持续时间",
    image: "/assets/hotel-scene.png", color: "mint", duration: "6 分钟", description: "把身体感受转化成医生能理解的信息",
    cardClass: "mint-card", worldClass: "featured-airport", levels: { foundation: "A2", intermediate: "A2", advanced: "A2" },
  },
  campus: {
    route: "foundation", chapter: "02 · 城市探索", unlockDays: 10, eyebrow: "校园沟通 · 约 6 分钟",
    title: "找到教室并处理临时课程变更", shortTitle: "校园找课", goal: "询问教室位置并确认线上通知渠道",
    image: "/assets/mascot-hero.png", color: "violet", duration: "6 分钟", description: "应对校园里最常见的临时变化",
    cardClass: "violet-card", worldClass: "featured-hotel", levels: { foundation: "A2", intermediate: "A2", advanced: "A2" },
  },
  hotel: {
    route: "intermediate", chapter: "03 · 独立解决", unlockDays: 0, eyebrow: "问题协商 · 约 7 分钟",
    title: "酒店说没有你的预订", shortTitle: "酒店预订协商", goal: "找回预订并争取同等房型与合理补偿",
    image: "/assets/hotel-scene.png", color: "violet", duration: "7 分钟", description: "确认订单、协商房型并争取合理补偿",
    cardClass: "violet-card", worldClass: "featured-hotel", levels: { foundation: "B1", intermediate: "B1", advanced: "B1" },
  },
  airport: {
    route: "intermediate", chapter: "03 · 独立解决", unlockDays: 1, eyebrow: "旅行协商 · 约 8 分钟",
    title: "处理航班超售与改签", shortTitle: "航班改签谈判", goal: "在不耽误转机的前提下协商航线和费用",
    image: "/assets/airport-scene.png", color: "mint", duration: "8 分钟", description: "超售、转机和行李条件，一次说清楚",
    cardClass: "mint-card", worldClass: "featured-airport", levels: { foundation: "B1", intermediate: "B1–B2", advanced: "B1–B2" },
  },
  customs: {
    route: "intermediate", chapter: "03 · 独立解决", unlockDays: 2, eyebrow: "旅行问答 · 约 5 分钟",
    title: "在海关清楚说明入境计划", shortTitle: "海关入境问答", goal: "说明旅行目的、时间与住宿地址",
    image: "/assets/airport-scene.png", color: "blue", duration: "5 分钟", description: "面对连续提问，保持简洁、准确和一致",
    cardClass: "blue-card", worldClass: "featured-interview", levels: { foundation: "B1", intermediate: "B1", advanced: "B1" },
  },
  lost: {
    route: "intermediate", chapter: "03 · 独立解决", unlockDays: 3, eyebrow: "求助沟通 · 约 6 分钟",
    title: "描述丢失物品并提供有效线索", shortTitle: "失物招领求助", goal: "准确描述外观、时间和最后出现地点",
    image: "/assets/airport-scene.png", color: "coral", duration: "6 分钟", description: "把模糊的着急变成工作人员可行动的线索",
    cardClass: "coral-card", worldClass: "featured-cafe", levels: { foundation: "B1", intermediate: "B1", advanced: "B1" },
  },
  roommate: {
    route: "intermediate", chapter: "04 · 关系协商", unlockDays: 5, eyebrow: "关系沟通 · 约 7 分钟",
    title: "和室友协商噪音与作息边界", shortTitle: "合租规则协商", goal: "表达影响、提出边界并接受合理替代方案",
    image: "/assets/series-flatmate.png", color: "violet", duration: "7 分钟", description: "不回避冲突，也不让表达变成指责",
    cardClass: "violet-card", worldClass: "featured-hotel", levels: { foundation: "B1", intermediate: "B1–B2", advanced: "B1–B2" },
  },
  refund: {
    route: "intermediate", chapter: "04 · 关系协商", unlockDays: 7, eyebrow: "权益协商 · 约 8 分钟",
    title: "处理误扣费并争取完整退款", shortTitle: "投诉与退款", goal: "用证据说明问题并确认金额和到账时间",
    image: "/assets/hotel-scene.png", color: "coral", duration: "8 分钟", description: "把情绪转化为证据、诉求和闭环确认",
    cardClass: "coral-card", worldClass: "featured-cafe", levels: { foundation: "B2", intermediate: "B2", advanced: "B2" },
  },
  groupwork: {
    route: "intermediate", chapter: "04 · 关系协商", unlockDays: 10, eyebrow: "团队沟通 · 约 8 分钟",
    title: "在小组讨论中礼貌反对并推动决策", shortTitle: "课程小组讨论", goal: "认可动机、提出优先级并建立评价标准",
    image: "/assets/mascot-hero.png", color: "blue", duration: "8 分钟", description: "不是只会同意，而是能推动团队形成结论",
    cardClass: "blue-card", worldClass: "featured-interview", levels: { foundation: "B2", intermediate: "B2", advanced: "B2" },
  },
  interview: {
    route: "advanced", chapter: "05 · 职场跃迁", unlockDays: 0, eyebrow: "职场挑战 · 约 9 分钟",
    title: "回答一次有连续追问的英文面试", shortTitle: "英文面试追问", goal: "用具体事例说明失败、协商与复盘能力",
    image: "/assets/mascot-hero.png", color: "blue", duration: "9 分钟", description: "不背模板，完成三轮连续追问",
    cardClass: "blue-card", worldClass: "featured-interview", levels: { foundation: "C1", intermediate: "C1", advanced: "C1" },
  },
  project: {
    route: "advanced", chapter: "05 · 职场跃迁", unlockDays: 1, eyebrow: "项目谈判 · 约 9 分钟",
    title: "客户要求提前交付但不愿缩小范围", shortTitle: "项目截止期谈判", goal: "通过分阶段交付重新协商时间与范围",
    image: "/assets/series-flatmate.png", color: "coral", duration: "9 分钟", description: "不只说做不到，而是提出可执行的取舍方案",
    cardClass: "coral-card", worldClass: "featured-cafe", levels: { foundation: "C1", intermediate: "C1", advanced: "C1" },
  },
  briefing: {
    route: "advanced", chapter: "05 · 职场跃迁", unlockDays: 2, eyebrow: "数据表达 · 约 9 分钟",
    title: "在管理层追问下捍卫你的预测", shortTitle: "高层数据汇报", goal: "说明证据边界、风险情景和决策阈值",
    image: "/assets/series-flatmate.png", color: "mint", duration: "9 分钟", description: "既不虚张声势，也不因为不确定而失去立场",
    cardClass: "mint-card", worldClass: "featured-airport", levels: { foundation: "C1", intermediate: "C1", advanced: "C1" },
  },
  salary: {
    route: "advanced", chapter: "05 · 职场跃迁", unlockDays: 3, eyebrow: "职业谈判 · 约 8 分钟",
    title: "谈薪时比较基本工资与股权取舍", shortTitle: "薪酬方案谈判", goal: "给出有依据的区间并追问整体薪酬条件",
    image: "/assets/mascot-hero.png", color: "violet", duration: "8 分钟", description: "把敏感话题说得专业、明确且保留空间",
    cardClass: "violet-card", worldClass: "featured-hotel", levels: { foundation: "C1", intermediate: "C1", advanced: "C1" },
  },
  debate: {
    route: "advanced", chapter: "06 · 复杂表达", unlockDays: 5, eyebrow: "观点论证 · 约 10 分钟",
    title: "就 AI 教育应用完成一轮观点辩论", shortTitle: "英文观点辩论", goal: "承认对方价值、定义边界并回应反驳",
    image: "/assets/mascot-hero.png", color: "mint", duration: "10 分钟", description: "把复杂立场表达得有层次、可执行",
    cardClass: "mint-card", worldClass: "featured-airport", levels: { foundation: "C1", intermediate: "C1", advanced: "C1" },
  },
  crisis: {
    route: "advanced", chapter: "06 · 复杂表达", unlockDays: 7, eyebrow: "危机沟通 · 约 10 分钟",
    title: "在信息不完整时回应一次数据事故", shortTitle: "危机沟通发布", goal: "区分已知与未知，说明行动和更新时间",
    image: "/assets/hotel-scene.png", color: "coral", duration: "10 分钟", description: "不轻率保证、不回避问题，稳定传递可信信息",
    cardClass: "coral-card", worldClass: "featured-cafe", levels: { foundation: "C1+", intermediate: "C1+", advanced: "C1+" },
  },
} as const;

const sceneOrder = [
  "cafe", "convenience", "restaurant", "directions", "supermarket", "clinic", "campus",
  "hotel", "airport", "customs", "lost", "roommate", "refund", "groupwork",
  "interview", "project", "briefing", "salary", "debate", "crisis",
] as const satisfies readonly SceneKey[];

const sceneNpc: Record<SceneKey, string> = {
  cafe: "Mika · 店员", convenience: "Aki · 收银员", restaurant: "Sam · 服务员",
  directions: "Chris · 路人", supermarket: "Robin · 售后专员", clinic: "Dr. Lee · 医生", campus: "Taylor · 校园助手",
  hotel: "Nora · 酒店前台", airport: "Alex · 航空服务专员", customs: "Morgan · 入境官",
  lost: "Jamie · 失物招领员", roommate: "Leo · 室友", refund: "Casey · 客服专员", groupwork: "Maya · 小组成员",
  interview: "Jordan · 面试官", project: "Riley · 客户负责人", briefing: "Avery · 业务负责人",
  salary: "Quinn · 招聘经理", debate: "Cameron · 辩论对手", crisis: "Reese · 媒体记者",
};

const levelConfig: Record<Level, {
  label: string;
  code: string;
  description: string;
  dailyScene: SceneKey;
  recommended: SceneKey[];
}> = {
  foundation: {
    label: "基础生活英语",
    code: "A1–A2",
    description: "能读懂简单句，希望先完成旅行和生活沟通",
    dailyScene: "cafe",
    recommended: ["cafe", "convenience"],
  },
  intermediate: {
    label: "进阶真实交流",
    code: "B1–B2",
    description: "基础对话没问题，想练协商、解释和临场反应",
    dailyScene: "hotel",
    recommended: ["hotel", "airport"],
  },
  advanced: {
    label: "高阶学习与职场",
    code: "C1",
    description: "希望训练复杂表达、谈判、面试与观点组织",
    dailyScene: "interview",
    recommended: ["interview", "project"],
  },
};

const seriesEpisodes: SeriesEpisode[] = [
  {
    id: "foundation-01",
    number: "01",
    title: "新室友见面",
    image: "/assets/series/foundation-01.webp",
    route: "foundation",
    level: "A1–A2",
    goal: "完成自我介绍，并询问房间和行李可以放在哪里",
    role: "Maya · 新室友",
    roleOpening: "Hi again! We still need to decide where these boxes should go. What do you think?",
    roleOpeningCn: "又见面啦！我们还要决定这些箱子放在哪里。你觉得呢？",
    quickReplies: [
      "You can put them beside the sofa for now.",
      "Let’s move the small boxes to your room.",
      "Could we keep the door clear, please?",
    ],
    lines: [
      { speaker: "Maya", en: "Hi, I'm Maya. I moved in today.", cn: "你好，我是Maya。我今天刚搬进来。", phrase: "move in", meaning: "搬进新住处", usage: "介绍自己刚刚搬家时使用。" },
      { speaker: "Leo", en: "Nice to meet you. Your room is down the hall.", cn: "很高兴认识你。你的房间在走廊那边。", phrase: "down the hall", meaning: "沿着走廊往前", usage: "说明同一层楼内的位置。" },
      { speaker: "Maya", en: "Thanks. Can I leave these boxes here for now?", cn: "谢谢。我可以先把这些箱子放在这里吗？", phrase: "for now", meaning: "暂时；目前", usage: "表达现在先这样，之后可能改变。" },
    ],
  },
  {
    id: "foundation-02",
    number: "02",
    title: "一起整理客厅",
    image: "/assets/series/foundation-02.webp",
    route: "foundation",
    level: "A1–A2",
    goal: "听懂位置表达，并礼貌提出简单的整理建议",
    role: "Maya · 新室友",
    roleOpening: "The living room is almost ready. Where should we put the lamp?",
    roleOpeningCn: "客厅快整理好了。我们应该把灯放在哪里？",
    quickReplies: [
      "Please put it beside the sofa.",
      "Let’s move it next to the window.",
      "I think the table should stay here.",
    ],
    lines: [
      { speaker: "Maya", en: "Can we move this chair next to the window?", cn: "我们可以把这把椅子移到窗边吗？", phrase: "next to", meaning: "紧挨着；在旁边", usage: "描述两个物体的位置关系。" },
      { speaker: "Leo", en: "Sure. Please put the lamp beside the sofa.", cn: "当然。请把灯放在沙发旁边。", phrase: "beside the sofa", meaning: "在沙发旁边", usage: "给出简单清楚的位置指令。" },
      { speaker: "Maya", en: "Great. Let's keep the middle of the room clear.", cn: "很好。我们把房间中间留空吧。", phrase: "keep it clear", meaning: "保持畅通；不要堆东西", usage: "提醒某个区域不要被占用。" },
    ],
  },
  {
    id: "foundation-03",
    number: "03",
    title: "约好一起吃饭",
    image: "/assets/series/foundation-03.webp",
    route: "foundation",
    level: "A1–A2",
    goal: "询问时间、确认安排并接受邀请",
    role: "Maya · 新室友",
    roleOpening: "I'm free this evening. What time would you like to have dinner?",
    roleOpeningCn: "我今晚有空。你想几点吃晚饭？",
    quickReplies: [
      "How about seven o’clock?",
      "Seven works for me.",
      "Let’s meet in the kitchen at seven.",
    ],
    lines: [
      { speaker: "Maya", en: "Would you like to have dinner together tonight?", cn: "你今晚愿意一起吃晚饭吗？", phrase: "Would you like to…", meaning: "你愿意……吗", usage: "比 Do you want to 更礼貌地发出邀请。" },
      { speaker: "Leo", en: "Sure. How about seven o'clock?", cn: "当然。七点怎么样？", phrase: "How about…", meaning: "……怎么样", usage: "提出时间或方案。" },
      { speaker: "Maya", en: "Seven works for me. I'll meet you in the kitchen.", cn: "七点我可以。我们厨房见。", phrase: "works for me", meaning: "我方便；我可以", usage: "自然地接受时间或安排。" },
    ],
  },
  {
    id: "intermediate-01",
    number: "01",
    title: "合租公寓的第一晚",
    image: "/assets/series/intermediate-01.webp",
    route: "intermediate",
    level: "B1–B2",
    goal: "礼貌讨论公共空间，并共同约定合租规则",
    role: "Maya · 新室友",
    roleOpening: "Before we finish unpacking, could we agree on how to use the shared space?",
    roleOpeningCn: "在拆完行李前，我们可以先约定一下公共空间怎么使用吗？",
    quickReplies: [
      "That makes sense. Let’s keep the entrance clear.",
      "Could we divide the shelves equally?",
      "I’d also like us to agree on quiet hours.",
    ],
    lines: [
      { speaker: "Maya", en: "I hope I haven't taken over the living room with all these boxes.", cn: "希望我这些箱子没有把客厅全占了。", phrase: "take over the living room", meaning: "占用了整个客厅", usage: "委婉承认自己可能占用了公共空间。" },
      { speaker: "Leo", en: "Not at all. I was going to clear that corner for you anyway.", cn: "完全没有。我本来就打算把那个角落腾给你。", phrase: "Not at all", meaning: "完全没有；一点也不", usage: "礼貌否定对方的担心。" },
      { speaker: "Maya", en: "That's a relief. Shall we agree on a few house rules before we unpack?", cn: "那我放心了。要不要趁拆箱前先定几条合租规则？", phrase: "Shall we agree on…", meaning: "我们是否可以约定……", usage: "邀请对方共同制定规则。" },
    ],
  },
  {
    id: "intermediate-02",
    number: "02",
    title: "深夜噪声怎么说",
    image: "/assets/series/intermediate-02.webp",
    route: "intermediate",
    level: "B1–B2",
    goal: "不指责对方，清楚说明影响并提出解决办法",
    role: "Maya · 新室友",
    roleOpening: "Thanks for bringing it up. What would make the evenings work better for both of us?",
    roleOpeningCn: "谢谢你提出来。怎样做才能让我们两个人晚上都更舒服？",
    quickReplies: [
      "Would you mind using headphones after eleven?",
      "I have early classes, so I need to sleep by midnight.",
      "We could agree on quiet hours during the week.",
    ],
    lines: [
      { speaker: "Maya", en: "Could we talk about the music last night? I had an early start this morning.", cn: "我们能谈谈昨晚的音乐吗？我今天一早有安排。", phrase: "Could we talk about…", meaning: "我们能谈谈……吗", usage: "以不带指责的方式开启敏感话题。" },
      { speaker: "Leo", en: "I'm sorry. I didn't realize the sound carried through the wall.", cn: "抱歉，我没意识到声音会穿过墙传过去。", phrase: "I didn't realize…", meaning: "我之前没有意识到……", usage: "承认自己忽略了某个影响。" },
      { speaker: "Maya", en: "Would you mind using headphones after eleven?", cn: "十一点后你介意戴耳机吗？", phrase: "Would you mind…", meaning: "你介意……吗", usage: "礼貌提出可能给对方带来不便的请求。" },
    ],
  },
  {
    id: "intermediate-03",
    number: "03",
    title: "分摊生活费用",
    image: "/assets/series/intermediate-03.webp",
    route: "intermediate",
    level: "B1–B2",
    goal: "解释费用变化，并协商双方都能接受的分摊方式",
    role: "Maya · 新室友",
    roleOpening: "The bill is higher than usual. How do you think we should divide it this month?",
    roleOpeningCn: "这次账单比平时高。你觉得这个月应该怎么分？",
    quickReplies: [
      "I worked from home more, so I can pay a larger share.",
      "Could we compare it with last month first?",
      "Let’s review the arrangement again next month.",
    ],
    lines: [
      { speaker: "Maya", en: "The electricity bill is much higher this month.", cn: "这个月的电费高了很多。", phrase: "much higher", meaning: "高出许多", usage: "比较账单、价格或数量的变化。" },
      { speaker: "Leo", en: "Since I worked from home every day, I can cover a larger share.", cn: "因为我每天在家办公，所以我可以多承担一些。", phrase: "cover a larger share", meaning: "承担更大的份额", usage: "主动提出承担更多费用或责任。" },
      { speaker: "Maya", en: "That seems fair. Let's review the split again next month.", cn: "这样很公平。我们下个月再看看分摊比例。", phrase: "That seems fair", meaning: "这样似乎很公平", usage: "接受一个合理方案，同时保留调整空间。" },
    ],
  },
  {
    id: "advanced-01",
    number: "01",
    title: "公共空间的边界",
    image: "/assets/series/advanced-01.webp",
    route: "advanced",
    level: "C1",
    goal: "以克制、准确的方式提出边界问题，并协商临时方案",
    role: "Maya · 新室友",
    roleOpening: "I appreciate you raising this carefully. What temporary arrangement would feel workable to you?",
    roleOpeningCn: "谢谢你谨慎地提出这个问题。你觉得怎样的临时安排比较可行？",
    quickReplies: [
      "Could we keep one half of the room completely equipment-free?",
      "I’d prefer a temporary arrangement that we review next week.",
      "My concern is access, rather than the equipment itself.",
    ],
    lines: [
      { speaker: "Maya", en: "I don't want to overstate the issue, but the shared space has gradually become difficult to use.", cn: "我不想把问题说得太严重，但公共空间确实逐渐变得不太好用了。", phrase: "I don't want to overstate the issue", meaning: "我不想夸大问题", usage: "在提出批评前先控制语气，适合敏感协商。" },
      { speaker: "Leo", en: "That's fair. I may have underestimated how much room the equipment would take up.", cn: "你说得有道理。我可能低估了这些设备会占多大空间。", phrase: "underestimated how much…", meaning: "低估了……的程度", usage: "承认自己的判断不足，而不是简单道歉。" },
      { speaker: "Maya", en: "Could we agree on a temporary arrangement and revisit it next week?", cn: "我们能否先定一个临时方案，下周再重新讨论？", phrase: "revisit it next week", meaning: "下周重新讨论这件事", usage: "在暂时无法一次解决时约定复盘。" },
    ],
  },
  {
    id: "advanced-02",
    number: "02",
    title: "费用分配的争议",
    image: "/assets/series/advanced-02.webp",
    route: "advanced",
    level: "C1",
    goal: "区分固定成本与个人消耗，并提出可执行的长期方案",
    role: "Maya · 新室友",
    roleOpening: "Equal sounds simple, but it may not always be equitable. How would you structure the split?",
    roleOpeningCn: "平均分很简单，但未必总是公平。你会怎样设计分摊方式？",
    quickReplies: [
      "I’d separate fixed costs from usage-based expenses.",
      "We need a fair system that is still easy to track.",
      "Could we review utility usage once every quarter?",
    ],
    lines: [
      { speaker: "Maya", en: "Rather than dividing every expense equally, we should distinguish fixed costs from individual consumption.", cn: "与其把所有支出平均分，我们应该区分固定成本和个人消耗。", phrase: "Rather than…", meaning: "与其……不如……", usage: "对比两个方案并提出更合适的选择。" },
      { speaker: "Leo", en: "I see the logic, though I don't want the system to become impossible to track.", cn: "我理解这个逻辑，但我不希望制度复杂到无法记录。", phrase: "I see the logic, though…", meaning: "我理解其中的道理，不过……", usage: "先认可对方，再提出保留意见。" },
      { speaker: "Maya", en: "What if we keep rent and internet equal, then adjust utilities quarterly?", cn: "如果房租和网费平分，水电费每季度调整一次怎么样？", phrase: "What if we…", meaning: "如果我们……怎么样", usage: "提出一个可讨论的折中方案。" },
    ],
  },
  {
    id: "advanced-03",
    number: "03",
    title: "访客规则的分歧",
    image: "/assets/series/advanced-03.webp",
    route: "advanced",
    level: "C1",
    goal: "解释长期影响，反驳过度限制，并达成比例适当的规则",
    role: "Maya · 新室友",
    roleOpening: "I don't want either of us to feel controlled. What limits would protect the shared space without being excessive?",
    roleOpeningCn: "我不希望任何一方觉得被控制。怎样的限制既能保护公共空间，又不过度？",
    quickReplies: [
      "A notice period would be more reasonable than a blanket ban.",
      "Could we agree on a monthly limit for overnight guests?",
      "The rule should address repeated stays, not occasional visits.",
    ],
    lines: [
      { speaker: "Maya", en: "I'm comfortable with occasional guests, but repeated overnight stays change the nature of the arrangement.", cn: "偶尔来客我可以接受，但频繁过夜会改变合租关系的性质。", phrase: "change the nature of…", meaning: "改变……的性质", usage: "说明数量累积后带来的本质影响。" },
      { speaker: "Leo", en: "I understand the concern, though a blanket restriction would feel disproportionate.", cn: "我理解你的担忧，但全面禁止似乎有些过度。", phrase: "a blanket restriction", meaning: "一刀切的全面限制", usage: "批评规则覆盖过广、缺乏区分。" },
      { speaker: "Maya", en: "Could we set a notice period and a reasonable monthly limit instead?", cn: "我们能否改为设置提前通知期和合理的每月次数限制？", phrase: "set a notice period", meaning: "设置提前通知期", usage: "把抽象分歧转化为具体可执行规则。" },
    ],
  },
];

type CollectedPhraseDetails = {
  meaning: string;
  usage: string;
  example: string;
  scene: string;
};

function normalizePhraseKey(value: string) {
  return value.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
}

const phraseDetails = new Map<string, CollectedPhraseDetails>();

for (const scene of sceneOrder) {
  const dialogueVariants = [
    allDialogueData[scene],
    foundationDialogueData[scene] ?? [],
  ];

  for (const dialogue of dialogueVariants) {
    for (const turn of dialogue) {
      phraseDetails.set(normalizePhraseKey(turn.phrase), {
        meaning: turn.tip,
        usage: "在相同情境中，可以用这句话推动对话继续并完成任务。",
        example: turn.choices[turn.correct],
        scene: sceneMeta[scene].shortTitle,
      });
    }
  }
}

for (const episode of seriesEpisodes) {
  for (const line of episode.lines) {
    phraseDetails.set(normalizePhraseKey(line.phrase), {
      meaning: line.meaning,
      usage: line.usage,
      example: line.en,
      scene: episode.title,
    });
  }
}

type SeriesWordAlignment = {
  target: string;
  heard?: string;
  status: "correct" | "incorrect" | "missed";
};

function splitEnglishWords(value: string) {
  return value.match(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*/g) ?? [];
}

function comparableWord(value: string) {
  return value.toLowerCase().replace(/[’']/g, "");
}

function alignSpokenSentence(target: string, transcript: string) {
  const targetWords = splitEnglishWords(target);
  const spokenWords = splitEnglishWords(transcript);
  const rows = targetWords.length + 1;
  const columns = spokenWords.length + 1;
  const costs = Array.from({ length: rows }, () => Array<number>(columns).fill(0));

  for (let row = 0; row < rows; row += 1) costs[row][0] = row;
  for (let column = 0; column < columns; column += 1) costs[0][column] = column;

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const sameWord = comparableWord(targetWords[row - 1]) === comparableWord(spokenWords[column - 1]);
      costs[row][column] = Math.min(
        costs[row - 1][column] + 1,
        costs[row][column - 1] + 1,
        costs[row - 1][column - 1] + (sameWord ? 0 : 1),
      );
    }
  }

  const words: SeriesWordAlignment[] = [];
  const extraWords: string[] = [];
  let row = targetWords.length;
  let column = spokenWords.length;

  while (row > 0 || column > 0) {
    if (row > 0 && column > 0) {
      const sameWord = comparableWord(targetWords[row - 1]) === comparableWord(spokenWords[column - 1]);
      const substitutionCost = sameWord ? 0 : 1;
      if (costs[row][column] === costs[row - 1][column - 1] + substitutionCost) {
        words.unshift({
          target: targetWords[row - 1],
          heard: spokenWords[column - 1],
          status: sameWord ? "correct" : "incorrect",
        });
        row -= 1;
        column -= 1;
        continue;
      }
    }

    if (row > 0 && costs[row][column] === costs[row - 1][column] + 1) {
      words.unshift({ target: targetWords[row - 1], status: "missed" });
      row -= 1;
      continue;
    }

    if (column > 0) {
      extraWords.unshift(spokenWords[column - 1]);
      column -= 1;
    }
  }

  return { words, extraWords };
}

function scoreSpokenSentence(target: string, transcript: string) {
  const alignment = alignSpokenSentence(target, transcript);
  if (!alignment.words.length) return 0;
  const correct = alignment.words.filter((word) => word.status === "correct").length;
  const accuracy = correct / alignment.words.length;
  const extraPenalty = Math.min(12, alignment.extraWords.length * 3);
  return Math.max(0, Math.round(accuracy * 100 - extraPenalty));
}

function buildSeriesRoleFeedback(text: string) {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const hasPoliteFrame = /could|would|may|i understand|i appreciate|rather than|what if|if possible/i.test(text);
  const hasConcreteDetail = /after|before|week|month|room|space|cost|bill|guest|headphones|box|sofa|window|seven|limit/i.test(text);
  if (wordCount < 5) return "意思可以理解，但信息还不够。补充一个具体安排或理由，角色才知道下一步如何回应。";
  if (hasPoliteFrame && hasConcreteDetail) return "表达既礼貌又具体，已经能够推动协商继续。";
  if (hasPoliteFrame) return "语气自然。再补充时间、位置或限制条件，回应会更有执行性。";
  if (hasConcreteDetail) return "信息很具体。加入 could / would 或 What if we…，语气会更适合协商。";
  return "意思清楚，但可以补充你的理由和希望达成的结果。";
}

function buildSeriesFallbackReply(level: Level) {
  if (level === "advanced") {
    return {
      text: "That distinction is helpful. I could work with it, provided we make the rule specific enough for both of us to follow. What exact limit or review point would you suggest?",
      cn: "这个区分很有帮助。如果规则足够具体、双方都能遵守，我可以接受。你建议设置怎样的明确限制或复盘节点？",
    };
  }
  if (level === "intermediate") {
    return {
      text: "That sounds reasonable. I’d like the arrangement to work for both of us. Could you suggest one clear rule we can start using this week?",
      cn: "听起来很合理。我希望这个安排对我们双方都适用。你能提出一条本周就能开始执行的明确规则吗？",
    };
  }
  return {
    text: "Good idea. That works for me. Where should we put it, and when should we do it?",
    cn: "好主意，我可以。我们应该把它放在哪里，什么时候做？",
  };
}

const weeklyData = [
  { day: "一", value: 0 },
  { day: "二", value: 0 },
  { day: "三", value: 0 },
  { day: "四", value: 0 },
  { day: "五", value: 0 },
  { day: "六", value: 0 },
  { day: "日", value: 0 },
];

const STORAGE_KEY = "life-english-zero-start-v1";
const ACCOUNT_TOKEN_KEY = "life-english-account-token-v1";

const medalCatalog = [
  { id: "first-day", icon: "✦", title: "第一天出发", description: "完成第一次打卡", kind: "streak", target: 1 },
  { id: "three-days", icon: "△", title: "三日连击", description: "连续打卡 3 天", kind: "streak", target: 3 },
  { id: "week", icon: "7", title: "一周不掉线", description: "连续打卡 7 天", kind: "streak", target: 7 },
  { id: "two-weeks", icon: "14", title: "稳定探索者", description: "连续打卡 14 天", kind: "streak", target: 14 },
  { id: "month", icon: "30", title: "月度人生玩家", description: "连续打卡 30 天", kind: "streak", target: 30 },
  { id: "first-scene", icon: "→", title: "第一次办成", description: "完成 1 个真实场景", kind: "scene", target: 1 },
  { id: "three-scenes", icon: "3", title: "城市初探者", description: "完成 3 个真实场景", kind: "scene", target: 3 },
  { id: "seven-scenes", icon: "7", title: "独立生活家", description: "完成 7 个真实场景", kind: "scene", target: 7 },
  { id: "ten-scenes", icon: "10", title: "跨城沟通者", description: "完成 10 个真实场景", kind: "scene", target: 10 },
  { id: "all-scenes", icon: "20", title: "全域人生玩家", description: "完成全部 20 个场景", kind: "scene", target: 20 },
  { id: "five-phrases", icon: "▣", title: "表达收藏家", description: "收藏 5 个真实表达", kind: "phrase", target: 5 },
  { id: "ten-phrases", icon: "★", title: "开口有底气", description: "收藏 10 个真实表达", kind: "phrase", target: 10 },
] as const;

const navItems: { id: Screen; label: string; icon: string }[] = [
  { id: "home", label: "首页", icon: "⌂" },
  { id: "world", label: "情境", icon: "↗" },
  { id: "lab", label: "实验室", icon: "✦" },
  { id: "series", label: "短剧", icon: "▷" },
  { id: "words", label: "词库", icon: "▣" },
  { id: "profile", label: "我的", icon: "◔" },
];

function selectEnglishVoice(speaker?: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices().filter((voice) => /^en([_-]|$)/i.test(voice.lang));
  if (!voices.length) return null;
  const wantsFemaleVoice = /maya|nora|mika/i.test(speaker ?? "");
  const wantsMaleVoice = /leo|alex|jordan/i.test(speaker ?? "");
  const femaleNames = /aria|jenny|zira|samantha|victoria|karen|moira|susan|female/i;
  const maleNames = /guy|david|mark|daniel|alex|fred|thomas|male/i;
  const qualityNames = /natural|online|premium|enhanced|google/i;

  return [...voices].sort((first, second) => {
    const score = (voice: SpeechSynthesisVoice) => {
      const identity = `${voice.name} ${voice.voiceURI}`;
      let value = voice.lang.toLowerCase() === "en-us" ? 10 : 5;
      if (qualityNames.test(identity)) value += 8;
      if (wantsFemaleVoice && femaleNames.test(identity)) value += 7;
      if (wantsMaleVoice && maleNames.test(identity)) value += 7;
      if (voice.default) value += 1;
      return value;
    };
    return score(second) - score(first);
  })[0];
}

function configureEnglishVoice(utterance: SpeechSynthesisUtterance, speaker?: string) {
  const voice = selectEnglishVoice(speaker);
  utterance.lang = voice?.lang || "en-US";
  if (voice) utterance.voice = voice;
  utterance.pitch = 1;
}

function SpeakButton({ text, compact = false }: { text: string; compact?: boolean }) {
  const speak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    configureEnglishVoice(utterance);
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <button
      type="button"
      className={compact ? "sound-button compact" : "sound-button"}
      onClick={speak}
      aria-label={`播放英文：${text}`}
    >
      <span aria-hidden="true">◖</span>
      {!compact && "听一遍"}
    </button>
  );
}

function ProgressBar({ value, light = false }: { value: number; light?: boolean }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <div className={`progress-track ${light ? "light" : ""}`} aria-label={`完成度 ${Math.round(safeValue)}%`}>
      <span style={{ width: `${safeValue}%` }} />
    </div>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("auth");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [level, setLevel] = useState<Level>("intermediate");
  const [activeScene, setActiveScene] = useState<SceneKey>("hotel");
  const [dialogueStep, setDialogueStep] = useState(0);
  const [answerState, setAnswerState] = useState<"idle" | "wrong" | "correct">("idle");
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [missionDone, setMissionDone] = useState(false);
  const [xp, setXp] = useState(0);
  const [routeDays, setRouteDays] = useState<RouteDays>({ foundation: 0, intermediate: 0, advanced: 0 });
  const [routeCheckinDates, setRouteCheckinDates] = useState<RouteCheckinDates>({ foundation: null, intermediate: null, advanced: null });
  const [completedScenes, setCompletedScenes] = useState<SceneKey[]>([]);
  const [savedPhrases, setSavedPhrases] = useState<string[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewRevealed, setReviewRevealed] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [seriesLine, setSeriesLine] = useState(0);
  const [selectedEpisode, setSelectedEpisode] = useState(0);
  const [seriesSubtitleMode, setSeriesSubtitleMode] = useState<SeriesSubtitleMode>("bilingual");
  const [seriesPanelTab, setSeriesPanelTab] = useState<SeriesPanelTab>("mission");
  const [seriesSpeed, setSeriesSpeed] = useState<0.75 | 1 | 1.25>(1);
  const [seriesSpeaking, setSeriesSpeaking] = useState(false);
  const [seriesRecording, setSeriesRecording] = useState(false);
  const [seriesPracticeMode, setSeriesPracticeMode] = useState<SeriesPracticeMode>("phrase");
  const [seriesTranscript, setSeriesTranscript] = useState("");
  const [seriesAttemptScore, setSeriesAttemptScore] = useState<number | null>(null);
  const [seriesPracticeMessage, setSeriesPracticeMessage] = useState("");
  const [seriesRoleInput, setSeriesRoleInput] = useState("");
  const [seriesRoleThinking, setSeriesRoleThinking] = useState(false);
  const [seriesRoleMessages, setSeriesRoleMessages] = useState<LabMessage[]>([]);
  const [watchedSeriesEpisodes, setWatchedSeriesEpisodes] = useState<string[]>([]);
  const [practicedSeriesEpisodes, setPracticedSeriesEpisodes] = useState<string[]>([]);
  const [roleplayedSeriesEpisodes, setRoleplayedSeriesEpisodes] = useState<string[]>([]);
  const [completedSeriesEpisodes, setCompletedSeriesEpisodes] = useState<string[]>([]);
  const [seriesBestScores, setSeriesBestScores] = useState<Record<string, number>>({});
  const [registered, setRegistered] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [accountToken, setAccountToken] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [pendingMigrationData, setPendingMigrationData] = useState<PersistedLearningData | null>(null);
  const [labScene, setLabScene] = useState<LabScene>("hotel");
  const [labInput, setLabInput] = useState("");
  const [labCoachMode, setLabCoachMode] = useState(true);
  const [labThinking, setLabThinking] = useState(false);
  const [labCloudStatus, setLabCloudStatus] = useState<LabCloudStatus>("checking");
  const [labMessages, setLabMessages] = useState<LabMessage[]>([
    {
      role: "assistant",
      text: labScenarioData.hotel.opening,
      cn: labScenarioData.hotel.openingCn,
    },
  ]);

  const currentDialogue =
    level === "foundation" && foundationDialogueData[activeScene]
      ? foundationDialogueData[activeScene]!
      : allDialogueData[activeScene];
  const turn = currentDialogue[dialogueStep];
  const meta = sceneMeta[activeScene];
  const currentLevel = levelConfig[level];
  const currentSeriesEpisodes = seriesEpisodes.filter((episode) => episode.route === level);
  const currentSeriesEpisode = currentSeriesEpisodes[selectedEpisode] ?? currentSeriesEpisodes[0];
  const today = new Date().toLocaleDateString("sv-SE");
  const streak = routeDays[level];
  const checkedIn = routeCheckinDates[level] === today;
  const totalRouteDays = routeDays.foundation + routeDays.intermediate + routeDays.advanced;
  const dailyScene = currentLevel.dailyScene;
  const routeScenes = sceneOrder.filter((scene) => sceneMeta[scene].route === level);
  const completedRouteCount = routeScenes.filter((scene) => completedScenes.includes(scene)).length;
  const unlockedRouteScenes = routeScenes.filter((scene) => streak >= sceneMeta[scene].unlockDays);
  const pendingUnlockedScene = unlockedRouteScenes.find((scene) => !completedScenes.includes(scene));
  const pendingLockedScene = routeScenes.find((scene) => streak < sceneMeta[scene].unlockDays);
  const latestCompletedScene = [...completedScenes]
    .reverse()
    .find((scene) => sceneMeta[scene].route === level);
  const homeScene = pendingUnlockedScene ?? pendingLockedScene ?? latestCompletedScene ?? dailyScene;
  const homeMeta = sceneMeta[homeScene];
  const homeSceneUnlocked = streak >= homeMeta.unlockDays;
  const homeSceneCompleted = completedScenes.includes(homeScene);
  const pendingRouteScenes = routeScenes.filter((scene) => !completedScenes.includes(scene));
  const recommendedScenes = [
    ...pendingRouteScenes,
    ...[...routeScenes].reverse().filter((scene) => completedScenes.includes(scene)),
  ].filter((scene, index, scenes) => scenes.indexOf(scene) === index).slice(0, 2);
  const homeScenePosition = routeScenes.indexOf(homeScene) + 1;
  const nextSceneKey = routeScenes.find((scene) => streak < sceneMeta[scene].unlockDays);
  const routeFinalDays = sceneMeta[routeScenes[routeScenes.length - 1]].unlockDays;
  const nextUnlock = nextSceneKey
    ? { days: sceneMeta[nextSceneKey].unlockDays, label: sceneMeta[nextSceneKey].shortTitle, complete: false }
    : { days: routeFinalDays, label: "本路线场景已全部解锁", complete: true };
  const canRegister = name.trim().length > 0 && password.length >= 8;
  const collectedWordItems = savedPhrases.map((phrase, index) => {
    const details = phraseDetails.get(normalizePhraseKey(phrase));
    return {
      word: phrase,
      meaning: details?.meaning ?? "这是你在真实任务中收藏的表达。",
      usage: details?.usage ?? "结合下方完整例句复习，并在相似情境中再次使用。",
      example: details?.example ?? phrase,
      scene: details?.scene ?? "真实任务",
      mastery: Math.min(90, 20 + index * 7),
    };
  });
  const medals = medalCatalog.map((medal) => {
    const current = medal.kind === "streak"
      ? Math.max(routeDays.foundation, routeDays.intermediate, routeDays.advanced)
      : medal.kind === "scene"
        ? completedScenes.length
        : savedPhrases.length;
    return { ...medal, earned: current >= medal.target, current };
  });
  const earnedMedalCount = medals.filter((medal) => medal.earned).length;
  const latestEarnedMedal = [...medals].reverse().find((medal) => medal.earned);
  const weekdayIndex = (new Date().getDay() + 6) % 7;
  const activityData = weeklyData.map((item, index) => ({
    ...item,
    value: index === weekdayIndex && checkedIn ? Math.min(100, 20 + completedScenes.length * 12) : 0,
  }));

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 11) return "早上好";
    if (hour < 18) return "下午好";
    return "晚上好";
  }, []);

  const applySavedLearningData = useCallback((
    saved: PersistedLearningData,
    signedInOverride?: boolean,
  ) => {
    if (!saved.registered || !saved.name) return false;
    const savedLevel = saved.level && levelConfig[saved.level] ? saved.level : "intermediate";
    const migratedRouteDays: RouteDays = saved.routeDays
      ? {
          foundation: Math.max(0, Number(saved.routeDays.foundation ?? 0)),
          intermediate: Math.max(0, Number(saved.routeDays.intermediate ?? 0)),
          advanced: Math.max(0, Number(saved.routeDays.advanced ?? 0)),
        }
      : {
          foundation: savedLevel === "foundation" ? Math.max(0, saved.streak ?? 0) : 0,
          intermediate: savedLevel === "intermediate" ? Math.max(0, saved.streak ?? 0) : 0,
          advanced: savedLevel === "advanced" ? Math.max(0, saved.streak ?? 0) : 0,
        };
    const migratedCheckinDates: RouteCheckinDates = saved.routeCheckinDates
      ? {
          foundation: saved.routeCheckinDates.foundation ?? null,
          intermediate: saved.routeCheckinDates.intermediate ?? null,
          advanced: saved.routeCheckinDates.advanced ?? null,
        }
      : {
          foundation: savedLevel === "foundation" ? saved.lastCheckinDate ?? null : null,
          intermediate: savedLevel === "intermediate" ? saved.lastCheckinDate ?? null : null,
          advanced: savedLevel === "advanced" ? saved.lastCheckinDate ?? null : null,
        };

    setName(saved.name);
    setLevel(savedLevel);
    setXp(Math.max(0, Number(saved.xp ?? 0)));
    setRouteDays(migratedRouteDays);
    setRouteCheckinDates(migratedCheckinDates);
    setCompletedScenes((saved.completedScenes ?? []).filter((scene) => sceneOrder.includes(scene)));
    setSavedPhrases((saved.savedPhrases ?? []).filter((phrase) => typeof phrase === "string"));
    const validEpisodeIds = new Set(seriesEpisodes.map((episode) => episode.id));
    setWatchedSeriesEpisodes((saved.watchedSeriesEpisodes ?? []).filter((id) => validEpisodeIds.has(id)));
    setPracticedSeriesEpisodes((saved.practicedSeriesEpisodes ?? []).filter((id) => validEpisodeIds.has(id)));
    setRoleplayedSeriesEpisodes((saved.roleplayedSeriesEpisodes ?? []).filter((id) => validEpisodeIds.has(id)));
    setCompletedSeriesEpisodes((saved.completedSeriesEpisodes ?? []).filter((id) => validEpisodeIds.has(id)));
    setSeriesBestScores(Object.fromEntries(
      Object.entries(saved.seriesBestScores ?? {}).filter(
        ([id, score]) => validEpisodeIds.has(id) && Number.isFinite(score),
      ),
    ));
    setRegistered(true);
    const shouldEnter = signedInOverride ?? saved.signedIn !== false;
    setSignedIn(shouldEnter);
    setScreen(shouldEnter ? "home" : "signedout");
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      let localSaved: PersistedLearningData | null = null;
      let savedToken = "";
      try {
        const storage = window.localStorage;
        if (!storage) return;
        const raw = storage.getItem(STORAGE_KEY);
        if (raw) localSaved = JSON.parse(raw) as PersistedLearningData;
        savedToken = storage.getItem(ACCOUNT_TOKEN_KEY) ?? "";
      } catch {
        // Some embedded preview browsers disable local storage.
      }

      if (savedToken) {
        try {
          const response = await fetch("/api/account", {
            headers: { Authorization: `Bearer ${savedToken}` },
            cache: "no-store",
          });
          const payload = await response.json() as AccountApiResponse;
          if (cancelled) return;
          if (response.ok && payload.data) {
            setAccountToken(savedToken);
            applySavedLearningData(payload.data);
            return;
          }
          if (response.status === 401) {
            window.localStorage?.removeItem(ACCOUNT_TOKEN_KEY);
            savedToken = "";
          }
        } catch {
          if (cancelled) return;
          if (localSaved?.registered && localSaved.name) {
            setAccountToken(savedToken);
            applySavedLearningData(localSaved);
            return;
          }
        }
      }

      if (cancelled) return;
      if (localSaved?.registered && localSaved.name) {
        applySavedLearningData(localSaved, false);
        setPendingMigrationData(localSaved);
        setRegistered(false);
        setSignedIn(false);
        setScreen("auth");
      }
    };

    const run = async () => {
      try {
        await hydrate();
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [applySavedLearningData]);

  useEffect(() => {
    if (!hydrated || !registered) return;
    if (!window.localStorage) return;
    const learningData: PersistedLearningData = {
      registered: true,
      signedIn,
      name,
      level,
      xp,
      streak,
      lastCheckinDate: routeCheckinDates[level],
      routeDays,
      routeCheckinDates,
      completedScenes,
      savedPhrases,
      watchedSeriesEpisodes,
      practicedSeriesEpisodes,
      roleplayedSeriesEpisodes,
      completedSeriesEpisodes,
      seriesBestScores,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(learningData));
    if (!accountToken) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/account", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accountToken}`,
          },
          body: JSON.stringify({ initialData: learningData }),
          signal: controller.signal,
        });
        if (response.status === 401) {
          window.localStorage?.removeItem(ACCOUNT_TOKEN_KEY);
          setAccountToken("");
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Learning data sync failed", error);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [accountToken, hydrated, registered, signedIn, name, level, xp, streak, routeDays, routeCheckinDates, completedScenes, savedPhrases, watchedSeriesEpisodes, practicedSeriesEpisodes, roleplayedSeriesEpisodes, completedSeriesEpisodes, seriesBestScores]);

  useEffect(() => {
    let cancelled = false;
    const checkCloudModel = async () => {
      try {
        const response = await fetch("/api/qwen", { cache: "no-store" });
        const data = await response.json() as { configured?: boolean };
        if (!cancelled) setLabCloudStatus(data.configured ? "ready" : "missing");
      } catch {
        if (!cancelled) setLabCloudStatus("unavailable");
      }
    };
    void checkCloudModel();
    return () => { cancelled = true; };
  }, []);

  const enterApp = async () => {
    if (!canRegister || authBusy) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      const response = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          password,
          level,
          initialData: pendingMigrationData,
        }),
      });
      const payload = await response.json() as AccountApiResponse;
      if (!response.ok || !payload.token || !payload.data) {
        setAuthError(payload.message ?? "账号连接失败，请稍后重试。");
        return;
      }

      window.localStorage?.setItem(ACCOUNT_TOKEN_KEY, payload.token);
      setAccountToken(payload.token);
      setPendingMigrationData(null);
      applySavedLearningData({ ...payload.data, signedIn: true }, true);
      setActiveScene(levelConfig[payload.data.level ?? level].dailyScene);
      setPassword("");
    } catch {
      setAuthError("暂时无法连接账号服务器，请检查腾讯云服务后重试。");
    } finally {
      setAuthBusy(false);
    }
  };

  const openScene = (scene: SceneKey) => {
    if (sceneMeta[scene].route !== level || streak < sceneMeta[scene].unlockDays) return;
    setActiveScene(scene);
    setDialogueStep(0);
    setAnswerState("idle");
    setSelectedAnswer(null);
    setMissionDone(false);
    setScreen("dialogue");
  };

  const chooseAnswer = (index: number) => {
    setSelectedAnswer(index);
    if (index === turn.correct) {
      setAnswerState("correct");
      setSavedPhrases((current) =>
        current.includes(turn.phrase) ? current : [...current, turn.phrase],
      );
    } else {
      setAnswerState("wrong");
    }
  };

  const continueDialogue = () => {
    if (dialogueStep < currentDialogue.length - 1) {
      setDialogueStep((step) => step + 1);
      setSelectedAnswer(null);
      setAnswerState("idle");
      return;
    }

    if (!completedScenes.includes(activeScene)) {
      setCompletedScenes((current) => [...current, activeScene]);
      setXp((current) => current + 20);
    }
    setMissionDone(true);
  };

  const resetAccount = async () => {
    if (!window.confirm("确定删除当前账号和全部学习档案吗？打卡、场景、词库和勋章将无法恢复。")) return;
    if (accountToken) {
      try {
        const response = await fetch("/api/account", {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accountToken}` },
        });
        if (!response.ok && response.status !== 401) {
          window.alert("服务器暂时无法删除账号，请稍后重试。学习档案尚未清空。");
          return;
        }
      } catch {
        window.alert("服务器暂时无法删除账号，请检查网络后重试。学习档案尚未清空。");
        return;
      }
    }
    window.localStorage?.removeItem(STORAGE_KEY);
    window.localStorage?.removeItem(ACCOUNT_TOKEN_KEY);
    setAccountToken("");
    setPendingMigrationData(null);
    setAuthError("");
    setRegistered(false);
    setSignedIn(false);
    setName("");
    setPassword("");
    setLevel("intermediate");
    setActiveScene("hotel");
    setXp(0);
    setRouteDays({ foundation: 0, intermediate: 0, advanced: 0 });
    setRouteCheckinDates({ foundation: null, intermediate: null, advanced: null });
    setCompletedScenes([]);
    setSavedPhrases([]);
    setWatchedSeriesEpisodes([]);
    setPracticedSeriesEpisodes([]);
    setRoleplayedSeriesEpisodes([]);
    setCompletedSeriesEpisodes([]);
    setSeriesBestScores({});
    setSelectedEpisode(0);
    setSeriesLine(0);
    setScreen("auth");
  };

  const changeLabScene = (scene: LabScene) => {
    const scenario = labScenarioData[scene];
    setLabScene(scene);
    setLabInput("");
    setLabThinking(false);
    setLabMessages([{ role: "assistant", text: scenario.opening, cn: scenario.openingCn }]);
  };

  const sendLabMessage = async () => {
    const text = labInput.trim();
    if (!text || labThinking) return;
    const sceneAtSend = labScene;
    const coachModeAtSend = labCoachMode;
    const historyAtSend = [...labMessages, { role: "user" as const, text }];
    const localReply = buildAdaptiveLabReply(sceneAtSend, text, labMessages);
    const localFeedback = buildLabFeedback(sceneAtSend, text, labMessages);

    setLabMessages((messages) => [
      ...messages,
      {
        role: "user",
        text,
        feedback: coachModeAtSend ? "AI 正在结合本轮上下文分析表达…" : undefined,
      },
    ]);
    setLabInput("");
    setLabThinking(true);

    try {
      const response = await fetch("/api/qwen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scene: sceneAtSend,
          level: currentLevel.code,
          coachMode: coachModeAtSend,
          messages: historyAtSend.map((message) => ({ role: message.role, text: message.text })),
        }),
      });
      const data = await response.json() as LabApiReply;
      if (!response.ok || !data.reply) {
        const error = new Error(data.message || "Qwen request failed") as Error & { code?: string };
        error.code = data.code;
        throw error;
      }

      setLabCloudStatus("ready");
      setLabMessages((messages) => {
        const updated = [...messages];
        for (let index = updated.length - 1; index >= 0; index -= 1) {
          if (updated[index].role === "user" && updated[index].text === text) {
            updated[index] = {
              ...updated[index],
              feedback: coachModeAtSend ? (data.feedback || localFeedback) : undefined,
            };
            break;
          }
        }
        return [...updated, {
          role: "assistant",
          text: data.reply!,
          cn: coachModeAtSend ? data.translation : undefined,
        }];
      });
    } catch (error) {
      const requestError = error as Error & { code?: string };
      setLabCloudStatus(requestError.code === "MISSING_API_KEY" ? "missing" : "unavailable");
      setLabMessages((messages) => {
        const updated = [...messages];
        for (let index = updated.length - 1; index >= 0; index -= 1) {
          if (updated[index].role === "user" && updated[index].text === text) {
            updated[index] = {
              ...updated[index],
              feedback: coachModeAtSend ? localFeedback : undefined,
            };
            break;
          }
        }
        return [...updated, {
          role: "assistant",
          text: localReply.text,
          cn: coachModeAtSend ? localReply.cn : undefined,
        }];
      });
    } finally {
      setLabThinking(false);
    }
  };

  const resetSeriesSession = (episode: SeriesEpisode) => {
    setSeriesLine(0);
    setSeriesPanelTab("mission");
    setSeriesPracticeMode("phrase");
    setSeriesTranscript("");
    setSeriesAttemptScore(null);
    setSeriesPracticeMessage("");
    setSeriesRoleInput("");
    setSeriesRoleThinking(false);
    setSeriesRoleMessages([{ role: "assistant", text: episode.roleOpening, cn: episode.roleOpeningCn }]);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSeriesSpeaking(false);
  };

  const changeLearningLevel = (nextLevel: Level) => {
    setLevel(nextLevel);
    setSelectedEpisode(0);
    const firstEpisode = seriesEpisodes.find((episode) => episode.route === nextLevel);
    if (firstEpisode) resetSeriesSession(firstEpisode);
  };

  const selectSeriesEpisode = (episodeIndex: number) => {
    const episode = currentSeriesEpisodes[episodeIndex];
    if (!episode) return;
    setSelectedEpisode(episodeIndex);
    resetSeriesSession(episode);
  };

  const goToSeriesLine = (nextLine: number) => {
    if (!currentSeriesEpisode) return;
    const boundedLine = Math.max(0, Math.min(nextLine, currentSeriesEpisode.lines.length - 1));
    setSeriesLine(boundedLine);
    setSeriesTranscript("");
    setSeriesAttemptScore(null);
    setSeriesPracticeMessage("");
    if (boundedLine === currentSeriesEpisode.lines.length - 1) {
      setWatchedSeriesEpisodes((items) => items.includes(currentSeriesEpisode.id) ? items : [...items, currentSeriesEpisode.id]);
    }
  };

  const changeSeriesPracticeMode = (nextMode: SeriesPracticeMode) => {
    if (seriesRecording || nextMode === seriesPracticeMode) return;
    setSeriesPracticeMode(nextMode);
    setSeriesTranscript("");
    setSeriesAttemptScore(null);
    setSeriesPracticeMessage("");
  };

  const playSeriesAudio = (repeatCount = 1) => {
    if (!currentSeriesEpisode || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (seriesSpeaking) {
      window.speechSynthesis.cancel();
      setSeriesSpeaking(false);
      return;
    }
    const currentLine = currentSeriesEpisode.lines[seriesLine];
    const text = currentLine?.en;
    if (!text) return;
    window.speechSynthesis.cancel();
    const speakOnce = (remaining: number) => {
      const utterance = new SpeechSynthesisUtterance(text);
      configureEnglishVoice(utterance, currentLine.speaker);
      utterance.rate = seriesSpeed;
      utterance.onend = () => {
        if (remaining > 1) {
          speakOnce(remaining - 1);
        } else {
          setSeriesSpeaking(false);
        }
      };
      utterance.onerror = () => setSeriesSpeaking(false);
      setSeriesSpeaking(true);
      window.speechSynthesis.speak(utterance);
    };
    speakOnce(repeatCount);
  };

  const focusSeriesViewing = () => {
    if (typeof document === "undefined") return;
    document.querySelector<HTMLElement>(".interactive-series-player")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const startSeriesPronunciation = async () => {
    if (!currentSeriesEpisode || seriesRecording || typeof window === "undefined") return;
    if (!window.isSecureContext) {
      setSeriesPracticeMessage("当前页面使用 HTTP，浏览器会阻止麦克风。请改用 HTTPS 地址后再跟读。");
      return;
    }

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setSeriesPracticeMessage("当前浏览器不支持语音识别，请使用最新版 Chrome 再试。你仍可使用原声和单句循环练习。");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setSeriesPracticeMessage("当前浏览器无法访问麦克风，请使用最新版 Chrome 并确认页面为 HTTPS。");
      return;
    }

    try {
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      const permissionError = error as DOMException;
      const denied = permissionError.name === "NotAllowedError" || permissionError.name === "SecurityError";
      setSeriesPracticeMessage(denied
        ? "麦克风权限未开启。请点击地址栏左侧的权限图标，允许麦克风后重试。"
        : "没有检测到可用麦克风，请检查设备连接和系统录音权限后重试。"
      );
      return;
    }

    const practiceModeAtStart = seriesPracticeMode;
    const currentLine = currentSeriesEpisode.lines[seriesLine];
    const target = practiceModeAtStart === "phrase" ? currentLine.phrase : currentLine.en;
    const episodeId = currentSeriesEpisode.id;
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let latestTranscript = "";
    let settled = false;
    let silenceTimer: number | null = null;
    let hardStopTimer: number | null = null;

    const clearRecognitionTimers = () => {
      if (silenceTimer !== null) window.clearTimeout(silenceTimer);
      if (hardStopTimer !== null) window.clearTimeout(hardStopTimer);
    };

    const finishPronunciation = () => {
      if (settled) return;
      settled = true;
      clearRecognitionTimers();
      const transcript = latestTranscript.trim();
      if (!transcript) {
        setSeriesPracticeMessage("没有听到清晰语音。请靠近麦克风，听完原声后再读一次。");
        setSeriesRecording(false);
        return;
      }
      const score = scoreSpokenSentence(target, transcript);
      setSeriesTranscript(transcript);
      setSeriesAttemptScore(score);
      setSeriesBestScores((scores) => ({ ...scores, [episodeId]: Math.max(scores[episodeId] ?? 0, score) }));
      setPracticedSeriesEpisodes((items) => items.includes(episodeId) ? items : [...items, episodeId]);
      setSeriesPracticeMessage(score >= 85
        ? practiceModeAtStart === "phrase"
          ? "重点表达读得很完整。可以切换到“完整台词”继续挑战。"
          : "整句发音和完整度很好，可以尝试关闭字幕再说一次。"
        : score >= 70
          ? "整体清楚，再注意标出的读错词和漏读词。"
          : "已经完成一次开口。建议先听原声，再放慢速度重读标出的词。"
      );
      setSeriesRecording(false);
    };

    recognition.onresult = (event) => {
      const chunks: string[] = [];
      for (let index = 0; index < event.results.length; index += 1) {
        const chunk = event.results[index]?.[0]?.transcript?.trim();
        if (chunk) chunks.push(chunk);
      }
      latestTranscript = chunks.join(" ").replace(/\s+/g, " ").trim();
      setSeriesTranscript(latestTranscript);
      setSeriesPracticeMessage(`正在识别${practiceModeAtStart === "phrase" ? "重点表达" : "完整台词"}，停顿后自动评分……`);
      if (silenceTimer !== null) window.clearTimeout(silenceTimer);
      silenceTimer = window.setTimeout(
        () => recognition.stop(),
        practiceModeAtStart === "phrase" ? 1200 : 1900,
      );
    };
    recognition.onerror = (event) => {
      if (event.error === "aborted" && latestTranscript.trim()) {
        finishPronunciation();
        return;
      }
      settled = true;
      clearRecognitionTimers();
      const errorMessage = event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "麦克风权限未开启。请点击地址栏左侧的权限图标，允许麦克风后重试。"
        : event.error === "audio-capture"
          ? "没有检测到可用麦克风，请检查设备连接和系统录音权限。"
          : event.error === "no-speech"
            ? "没有听到语音。请靠近麦克风，按下跟读后立即朗读。"
            : event.error === "network"
              ? "语音识别服务暂时不可用，请检查网络后重试。"
              : "语音识别没有成功，请刷新页面后再试一次。";
      setSeriesPracticeMessage(errorMessage);
      setSeriesRecording(false);
    };
    recognition.onend = finishPronunciation;
    setSeriesTranscript("");
    setSeriesAttemptScore(null);
    setSeriesPracticeMessage(`正在听你朗读${practiceModeAtStart === "phrase" ? "重点表达" : "完整台词"}……`);
    setSeriesRecording(true);
    try {
      recognition.start();
    } catch {
      settled = true;
      clearRecognitionTimers();
      setSeriesPracticeMessage("麦克风启动失败，请刷新页面并重新允许麦克风权限。");
      setSeriesRecording(false);
      return;
    }
    hardStopTimer = window.setTimeout(
      () => recognition.stop(),
      practiceModeAtStart === "phrase" ? 9000 : 20000,
    );
  };

  const sendSeriesRoleMessage = async () => {
    const text = seriesRoleInput.trim();
    if (!text || seriesRoleThinking || !currentSeriesEpisode) return;
    const episodeAtSend = currentSeriesEpisode;
    const openingMessages = seriesRoleMessages.length > 0
      ? seriesRoleMessages
      : [{ role: "assistant" as const, text: episodeAtSend.roleOpening, cn: episodeAtSend.roleOpeningCn }];
    const historyAtSend = [...openingMessages, { role: "user" as const, text }];
    const localFeedback = buildSeriesRoleFeedback(text);
    const localReply = buildSeriesFallbackReply(level);

    setSeriesRoleMessages([
      ...openingMessages,
      { role: "user", text, feedback: "正在结合本集剧情分析你的表达……" },
    ]);
    setSeriesRoleInput("");
    setSeriesRoleThinking(true);

    try {
      const response = await fetch("/api/qwen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scene: "roommate",
          level: currentLevel.code,
          coachMode: true,
          messages: historyAtSend.map((message) => ({ role: message.role, text: message.text })),
        }),
      });
      const data = await response.json() as LabApiReply;
      if (!response.ok || !data.reply) throw new Error(data.message || "Role-play request failed");
      setLabCloudStatus("ready");
      setSeriesRoleMessages((messages) => {
        const updated = [...messages];
        for (let index = updated.length - 1; index >= 0; index -= 1) {
          if (updated[index].role === "user" && updated[index].text === text) {
            updated[index] = { ...updated[index], feedback: data.feedback || localFeedback };
            break;
          }
        }
        return [...updated, { role: "assistant", text: data.reply!, cn: data.translation }];
      });
    } catch {
      setSeriesRoleMessages((messages) => {
        const updated = [...messages];
        for (let index = updated.length - 1; index >= 0; index -= 1) {
          if (updated[index].role === "user" && updated[index].text === text) {
            updated[index] = { ...updated[index], feedback: localFeedback };
            break;
          }
        }
        return [...updated, { role: "assistant", text: localReply.text, cn: localReply.cn }];
      });
    } finally {
      setRoleplayedSeriesEpisodes((items) => items.includes(episodeAtSend.id) ? items : [...items, episodeAtSend.id]);
      setSeriesRoleThinking(false);
    }
  };

  const completeSeriesEpisode = () => {
    if (!currentSeriesEpisode) return;
    const episodeId = currentSeriesEpisode.id;
    const requirementsDone = watchedSeriesEpisodes.includes(episodeId)
      && practicedSeriesEpisodes.includes(episodeId)
      && roleplayedSeriesEpisodes.includes(episodeId);
    if (!requirementsDone) return;
    if (!completedSeriesEpisodes.includes(episodeId)) {
      setCompletedSeriesEpisodes((items) => [...items, episodeId]);
      setXp((current) => current + 30);
    }
    setSeriesPanelTab("report");
  };

  const continueSeries = () => {
    if (selectedEpisode < currentSeriesEpisodes.length - 1) {
      selectSeriesEpisode(selectedEpisode + 1);
      return;
    }
    setScreen("home");
  };

  const confirmLogout = () => {
    setSignedIn(false);
    setScreen("signedout");
  };

  const resumeAccount = () => {
    if (!accountToken) {
      setRegistered(false);
      setSignedIn(false);
      setScreen("auth");
      setAuthError("请使用登录名和密码重新进入，学习档案会从服务器恢复。");
      return;
    }
    setSignedIn(true);
    setScreen("home");
  };

  const checkIn = () => {
    if (checkedIn) return;
    setRouteCheckinDates((current) => ({ ...current, [level]: today }));
    setRouteDays((current) => ({ ...current, [level]: current[level] + 1 }));
    setXp((value) => value + 5);
  };

  if (screen === "auth") {
    return (
      <main className="auth-page">
        <section className="auth-art" aria-label="Life English 产品介绍">
          <div className="auth-brand-row">
            <div className="brand-mark large">LE</div>
            <div><strong>Life English</strong><small>AI 人生英语</small></div>
          </div>
          <div className="auth-copy">
            <span className="auth-eyebrow">LEARN ENGLISH BY LIVING IT</span>
            <h1>别再背单词，<br />去过一次英语人生。</h1>
            <p>在咖啡店、机场、酒店和职场里真正开口。场景会随着你的学习进度逐步解锁。</p>
            <div className="auth-benefits" aria-label="产品特点">
              <span>真实情境</span><span>AI 陪练</span><span>循序解锁</span>
            </div>
          </div>
          <img
            className="auth-mascot"
            src="/assets/mascot-hero.png"
            alt="背着小包准备出发的黑猫英语伙伴"
          />
        </section>

        <section className="auth-panel">
          <div className="mobile-brand">
            <div className="brand-mark">LE</div>
            <strong>Life English</strong>
          </div>
          <div className="auth-form-wrap">
            <span className="auth-form-kicker">登录 / 创建账号</span>
            <h2>继续你的英语人生</h2>
            <p className="muted">同一登录名会恢复原有档案；新登录名会直接创建账号。</p>
            {pendingMigrationData && (
              <p className="auth-sync-notice" role="status">检测到旧版本的本机学习档案，登录后会自动同步到服务器。</p>
            )}
            {authError && <p className="auth-error" role="alert">{authError}</p>}

            <label className="field-label">
              昵称 / 登录名
              <input
                value={name}
                onChange={(event) => { setName(event.target.value); setAuthError(""); }}
                placeholder="输入你想使用的名字"
                autoComplete="username"
              />
            </label>
            <label className="field-label">
              密码
              <input
                type="password"
                value={password}
                onChange={(event) => { setPassword(event.target.value); setAuthError(""); }}
                placeholder="至少输入 8 位"
                autoComplete="current-password"
              />
            </label>
            <fieldset className="level-fieldset">
              <legend>选择你的当前英语水平</legend>
              <p>以后可以在「我的」中随时调整。</p>
              <div className="level-picker">
                {(Object.keys(levelConfig) as Level[]).map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={level === item ? "active" : ""}
                    onClick={() => changeLearningLevel(item)}
                    aria-pressed={level === item}
                  >
                    <span>{levelConfig[item].code}</span>
                    <strong>{levelConfig[item].label}</strong>
                    <small>{levelConfig[item].description}</small>
                    {item === "intermediate" && <em>推荐</em>}
                  </button>
                ))}
              </div>
            </fieldset>
            <button type="button" className="primary-button wide" onClick={enterApp} disabled={!canRegister || authBusy}>
              {authBusy ? "正在连接账号…" : "登录 / 创建账号并开始"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "signedout") {
    return (
      <main className="signedout-page">
        <section className="signedout-card">
          <div className="signedout-art">
            <img src="/assets/mascot-hero.png" alt="准备下次继续英语旅程的黑猫伙伴" />
            <span>SEE YOU NEXT TIME</span>
          </div>
          <div className="signedout-copy">
            <span className="tiny-label">ACCOUNT SIGNED OUT</span>
            <h1>你已退出，<br />学习进度还在。</h1>
            <p>{name || "学习者"} 的 {totalRouteDays} 次路线打卡、{xp} XP、{earnedMedalCount} 枚勋章都已保存。</p>
            <button type="button" className="primary-button wide" onClick={resumeAccount}>重新进入 Life English →</button>
            <button type="button" className="secondary-button wide" onClick={resetAccount}>删除账号与档案并重新注册</button>
          </div>
        </section>
      </main>
    );
  }

  const renderHome = () => (
    <div className="screen-content home-screen">
      <header className="mobile-topbar">
        <div>
          <span className="tiny-label">{greeting.toUpperCase()}</span>
          <h1>{greeting}，{name}！</h1>
        </div>
        <button type="button" className="avatar-button" onClick={() => setScreen("profile")} aria-label="打开个人中心">
          {name.slice(0, 1) || "我"}
        </button>
      </header>

      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow-pill">
            {currentLevel.code} · {homeSceneCompleted ? "本路线已完成" : homeSceneUnlocked ? `第 ${homeScenePosition} 个进度任务` : "下一项待解锁"}
          </span>
          <h2>{homeMeta.title}</h2>
          <p>
            {homeSceneUnlocked
              ? `${homeMeta.goal}。完成后首页会自动切换到下一项，不再重复展示已经完成的场景。`
              : `${currentLevel.code} 路线再打卡 ${Math.max(0, homeMeta.unlockDays - streak)} 天即可解锁，A、B、C 进度互不影响。`}
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => homeSceneUnlocked ? openScene(homeScene) : setScreen("world")}
            >
              {homeSceneUnlocked
                ? `${homeSceneCompleted ? "重新挑战" : "开始"} ${homeMeta.duration}任务`
                : "查看解锁路线"} <span aria-hidden="true">→</span>
            </button>
            <button type="button" className={`checkin-button ${checkedIn ? "done" : ""}`} onClick={checkIn} disabled={checkedIn}>
              {checkedIn ? `${currentLevel.code} 今日已打卡 ✓` : `${currentLevel.code} 路线打卡 · +1 天`}
            </button>
          </div>
        </div>
        <div className="hero-art-wrap">
          <img src={homeMeta.image} alt={`${homeMeta.shortTitle}插画`} />
          <span className="speech-bubble">{currentLevel.code}</span>
        </div>
      </section>

      <section className="quick-stats" aria-label="学习概览">
        <article>
          <span className="round-icon yellow">↗</span>
          <div><strong>{streak}</strong><small>{currentLevel.code} 路线打卡</small></div>
        </article>
        <article>
          <span className="round-icon coral">★</span>
          <div><strong>{xp}</strong><small>成长 XP</small></div>
        </article>
        <article>
          <span className="round-icon mint">▣</span>
          <div><strong>{savedPhrases.length}</strong><small>已会表达</small></div>
        </article>
      </section>

      <div className="section-heading">
        <div>
          <span className="tiny-label">YOUR NEXT LIFE</span>
          <h2>接下来想去哪？</h2>
        </div>
        <button type="button" className="link-button" onClick={() => setScreen("world")}>全部情境 →</button>
      </div>

      <section className="scene-grid compact-grid">
        {recommendedScenes.map((scene, index) => {
          const item = sceneMeta[scene];
          const unlocked = streak >= item.unlockDays;
          return (
            <button
              type="button"
              key={scene}
              className={`scene-card ${item.cardClass} ${unlocked ? "" : "locked-card"}`}
              onClick={() => openScene(scene)}
              disabled={!unlocked}
            >
              <div className="scene-card-top">
                <span className="scene-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="level-pill">{item.levels[level]}</span>
              </div>
              <img src={item.image} alt={`${item.shortTitle}场景`} />
              <div className="scene-card-copy">
                <small>{unlocked ? item.eyebrow : `${currentLevel.code} 路线打卡 ${item.unlockDays} 天解锁`}</small>
                <h3>{item.shortTitle}</h3>
                <p>{unlocked ? item.description : `还差 ${Math.max(0, item.unlockDays - streak)} 天`}</p>
              </div>
              {!unlocked && <span className="card-lock-badge">LOCK</span>}
            </button>
          );
        })}
      </section>

      <section className="journey-card">
        <div className="journey-main">
          <span className="round-icon black">⌁</span>
          <div>
            <small>{currentLevel.code} 路线下一项解锁</small>
            <h3>{nextUnlock.complete ? nextUnlock.label : `${nextUnlock.label} · 还差 ${Math.max(0, nextUnlock.days - streak)} 天`}</h3>
          </div>
          <strong>{nextUnlock.complete ? "ALL" : `${streak}/${nextUnlock.days}`}</strong>
        </div>
        <ProgressBar value={nextUnlock.complete ? 100 : Math.min(100, (streak / nextUnlock.days) * 100)} />
      </section>
    </div>
  );

  const renderWorld = () => (
    <div className="screen-content">
      <header className="page-title-row">
        <div>
          <span className="tiny-label">20-SCENE LIFE MAP</span>
          <h1>20 个场景，一级一级走出来</h1>
          <p>三条路线分别对应基础生活、真实协商和高阶职场，并拥有独立打卡天数。当前路线是 {currentLevel.code}「{currentLevel.label}」，在 A 打卡不会解锁 B 或 C。</p>
        </div>
        <div className="map-progress"><strong>{completedRouteCount}</strong><span>/ {routeScenes.length}<br />本路线完成</span></div>
      </header>

      <section className="route-selector" aria-label="选择场景路线">
        {(Object.keys(levelConfig) as Level[]).map((route) => (
          <button
            type="button"
            key={route}
            className={level === route ? "active" : ""}
            onClick={() => changeLearningLevel(route)}
            aria-pressed={level === route}
          >
            <span>{levelConfig[route].code}</span>
            <div><strong>{levelConfig[route].label}</strong><small>{routeDays[route]} DAYS · {sceneOrder.filter((scene) => sceneMeta[scene].route === route).length} 个递进场景</small></div>
            <em>{level === route ? "当前路线" : "切换"}</em>
          </button>
        ))}
      </section>

      {(Object.keys(levelConfig) as Level[]).map((route) => {
        const chapterScenes = sceneOrder.filter((scene) => sceneMeta[scene].route === route);
        const isCurrentRoute = route === level;
        const routeUnlockedCount = isCurrentRoute
          ? chapterScenes.filter((scene) => streak >= sceneMeta[scene].unlockDays).length
          : 0;
        return (
          <section className={`scene-chapter-block ${isCurrentRoute ? "active-route" : "other-route"}`} key={route}>
            <div className="chapter-heading">
              <div>
                <span>{levelConfig[route].code}</span>
                <div><small>{isCurrentRoute ? "CURRENT LEARNING ROUTE" : "AVAILABLE LEVEL ROUTE"}</small><h2>{levelConfig[route].label}</h2></div>
              </div>
              <strong>{isCurrentRoute ? `${routeUnlockedCount}/${chapterScenes.length} 已解锁` : `${chapterScenes.length} 个场景`}</strong>
            </div>

            <div className="world-scene-grid">
              {chapterScenes.map((scene, index) => {
                const item = sceneMeta[scene];
                const unlocked = isCurrentRoute && streak >= item.unlockDays;
                const completed = completedScenes.includes(scene);
                const recommended = isCurrentRoute && recommendedScenes.includes(scene);
                return (
                  <article key={scene} className={`world-card ${item.worldClass} ${unlocked ? "" : "world-locked"} ${completed ? "world-completed" : ""}`}>
                    <div className="world-image-wrap">
                      <img src={item.image} alt={`${item.shortTitle}场景`} />
                      <span className="scene-sequence">{String(sceneOrder.indexOf(scene) + 1).padStart(2, "0")}</span>
                      {!unlocked && (
                        <div className="world-lock-overlay">
                          <strong>{isCurrentRoute ? item.unlockDays : levelConfig[route].code}</strong>
                          <span>{isCurrentRoute ? (item.unlockDays === 0 ? "注册后即可开始" : "天打卡解锁") : "切换到该路线"}</span>
                        </div>
                      )}
                    </div>
                    <div className="world-card-content">
                      <span className="eyebrow-pill">
                        {completed ? "已完成 · 可重练" : recommended ? "为你推荐" : unlocked ? "已解锁" : isCurrentRoute ? `还差 ${item.unlockDays - streak} 天` : "其他等级路线"}
                      </span>
                      <small className="chapter-label">{item.chapter} · 第 {index + 1} 关</small>
                      <h2>{item.shortTitle}</h2>
                      <p>{item.description}</p>
                      <div className="world-card-footer">
                        <span>难度 {item.levels[level]} · {item.duration}</span>
                        <button
                          type="button"
                          className="circle-arrow"
                          onClick={() => openScene(scene)}
                          disabled={!unlocked}
                          aria-label={unlocked ? `进入${item.shortTitle}任务` : `${item.shortTitle}尚未解锁`}
                        >
                          {unlocked ? "→" : "×"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="section-heading small-gap">
        <div><span className="tiny-label">INDEPENDENT CHECK-IN ROAD</span><h2>{currentLevel.code} 独立打卡解锁路线</h2></div>
        <button type="button" className={`checkin-button compact-checkin ${checkedIn ? "done" : ""}`} onClick={checkIn} disabled={checkedIn}>
          {checkedIn ? `${currentLevel.code} 今天已完成 ✓` : `${currentLevel.code} 路线今日打卡 +1`}
        </button>
      </div>
      <section className="unlock-road extended-road">
        {routeScenes.map((scene) => {
          const item = sceneMeta[scene];
          const reached = streak >= item.unlockDays;
          return (
            <article key={scene} className={reached ? "reached" : ""}>
              <span>{reached ? "✓" : item.unlockDays}</span>
              <small>{item.unlockDays === 0 ? "起点" : `${item.unlockDays} DAYS`}</small>
              <h3>{item.shortTitle}</h3>
              <p>{completedScenes.includes(scene) ? "任务已完成" : reached ? "等待你挑战" : "继续打卡解锁"}</p>
            </article>
          );
        })}
      </section>
    </div>
  );

  const renderLab = () => {
    const scenario = labScenarioData[labScene];
    const immersiveRole = scenario.role.split(" · ")[0];
    const cloudStatusCopy: Record<LabCloudStatus, { badge: string; title: string; detail: string }> = {
      checking: {
        badge: "正在准备智能对话",
        title: "角色正在准备",
        detail: "稍等片刻，就可以开始自由对话。",
      },
      ready: {
        badge: "智能对话已开启",
        title: "角色会记住前面的对话",
        detail: "你可以自由表达，角色会根据上下文继续追问，不会机械重复答案。",
      },
      missing: {
        badge: "对话练习可用",
        title: "自由对话已经开启",
        detail: "选择一个场景，用自己的英语推动任务继续。",
      },
      unavailable: {
        badge: "已自动切换稳定模式",
        title: "练习可以继续",
        detail: "当前回复可能更简洁，但不会影响你完成本轮任务。",
      },
    };
    const cloudStatus = cloudStatusCopy[labCloudStatus];
    const quickReplies: Record<LabScene, string[]> = {
      hotel: [
        "I have a confirmation email. Could you check the booking reference?",
        "Could you offer an equivalent room without an additional charge?",
        "A complimentary upgrade would work. Could you confirm it in writing?",
      ],
      airport: [
        "I need to arrive before 8 p.m. Could you check a partner airline?",
        "One connection is acceptable if there is no change fee.",
        "Could you confirm whether my checked baggage will be transferred?",
      ],
      interview: [
        "I used customer interviews and usage data to make the decision.",
        "I explained the uncertainty and proposed a small reversible test.",
        "The result improved retention, but I would validate the key assumption earlier next time.",
      ],
      crisis: [
        "We cannot confirm the full impact yet, so we are reviewing access logs.",
        "We disabled the affected search path and started an independent audit.",
        "We will publish verified findings and update customers within two hours.",
      ],
    };

    return (
      <div className="screen-content lab-screen">
        <header className="page-title-row lab-title-row">
          <div>
            <span className="tiny-label">FREE-TALK SIMULATION LAB</span>
            <h1>AI 对话实验室</h1>
            <p>不再只有三个固定选项。你可以自由输入任何英文，角色会继续追问，教练模式会分析表达是否完整、自然和得体。</p>
          </div>
          <span className={`lab-model-status status-${labCloudStatus}`}><i /> {cloudStatus.badge}</span>
        </header>

        <section className="lab-layout">
          <aside className="lab-settings-card">
            <div className="lab-setting-heading"><span>01</span><div><small>CHOOSE A WORLD</small><h2>选择实验场景</h2></div></div>
            <div className="lab-scene-picker">
              {(Object.keys(labScenarioData) as LabScene[]).map((scene) => (
                <button
                  type="button"
                  key={scene}
                  className={labScene === scene ? "active" : ""}
                  onClick={() => changeLabScene(scene)}
                  aria-pressed={labScene === scene}
                >
                  <span>{scene === "hotel" ? "H" : scene === "airport" ? "A" : scene === "interview" ? "I" : "C"}</span>
                  <div><strong>{labScenarioData[scene].title}</strong><small>{labScenarioData[scene].role}</small></div>
                </button>
              ))}
            </div>

            <div className="lab-setting-heading mode-heading"><span>02</span><div><small>COACHING MODE</small><h2>选择反馈方式</h2></div></div>
            <div className="lab-mode-switch" role="group" aria-label="选择实验室模式">
              <button type="button" className={labCoachMode ? "active" : ""} onClick={() => setLabCoachMode(true)} aria-pressed={labCoachMode}>教练模式<small>每轮给中文反馈</small></button>
              <button type="button" className={!labCoachMode ? "active" : ""} onClick={() => setLabCoachMode(false)} aria-pressed={!labCoachMode}>沉浸模式<small>只进行英文对话</small></button>
            </div>

            <article className="lab-connection-note">
              <span>AI</span>
              <div><strong>{cloudStatus.title}</strong><p>{cloudStatus.detail}</p></div>
            </article>
          </aside>

          <section className={`lab-chat-card ${labCoachMode ? "coach-mode" : "immersive-mode"}`}>
            <header className="lab-chat-header">
              <div className="npc-avatar">AI</div>
              <div><small>{currentLevel.code} · {labCoachMode ? "角色正在等待" : "LIVE ROLEPLAY"}</small><strong>{labCoachMode ? scenario.role : immersiveRole}</strong></div>
              <span>{labCoachMode ? "教练模式" : "IMMERSION"}</span>
            </header>

            <div className="lab-mission-strip">
              <span>{labCoachMode ? "本轮目标" : "GOAL"}</span>
              <strong>{labCoachMode ? scenario.goal : scenario.goalEn}</strong>
              <em>{labCoachMode ? "可自由发挥，不限答案" : "Stay in character · English only"}</em>
            </div>

            <div className={`lab-mode-banner ${labCoachMode ? "coach" : "immersive"}`} role="status">
              <strong>{labCoachMode ? "教练辅助已开启" : "FULL IMMERSION ACTIVE"}</strong>
              <span>{labCoachMode ? "显示中文翻译、逐轮表达分析和可修改提示句" : "Translations, coaching feedback and suggested replies are hidden"}</span>
            </div>

            <div className="lab-message-list" aria-live="polite">
              {labMessages.map((message, index) => (
                <article key={`${message.role}-${index}`} className={`lab-message ${message.role}`}>
                  <div className="lab-message-bubble">
                    <small>{message.role === "assistant" ? (labCoachMode ? scenario.role : immersiveRole) : (labCoachMode ? "你" : "YOU")}</small>
                    <p>{message.text}</p>
                    {message.role === "assistant" && <SpeakButton text={message.text} compact />}
                    {labCoachMode && message.role === "assistant" && message.cn && <em>{message.cn}</em>}
                  </div>
                  {labCoachMode && message.feedback && <div className="lab-feedback"><span>✓</span><p>{message.feedback}</p></div>}
                </article>
              ))}
              {labThinking && <div className="lab-typing"><span /><span /><span /> {labCoachMode ? "角色正在回应" : "Thinking in character…"}</div>}
            </div>

            {labCoachMode && (
              <div className="lab-quick-replies">
                <small>需要灵感？点一句再修改</small>
                <div>
                  {quickReplies[labScene].map((reply) => (
                    <button type="button" key={reply} onClick={() => setLabInput(reply)}>{reply}</button>
                  ))}
                </div>
              </div>
            )}

            <form className="lab-composer" onSubmit={(event) => { event.preventDefault(); sendLabMessage(); }}>
              <label htmlFor="lab-input">{labCoachMode ? "输入你真正想说的话" : "YOUR RESPONSE"}</label>
              <div>
                <textarea
                  id="lab-input"
                  value={labInput}
                  onChange={(event) => setLabInput(event.target.value)}
                  placeholder={labCoachMode ? "Type freely in English…" : "Reply in English — no hints…"}
                  rows={3}
                />
                <button type="submit" className="primary-button" disabled={!labInput.trim() || labThinking}>{labCoachMode ? "发送并继续" : "SEND"} →</button>
              </div>
            </form>
          </section>
        </section>
      </div>
    );
  };

  const renderSeries = () => {
    if (!currentSeriesEpisode) return null;
    const line = currentSeriesEpisode.lines[seriesLine % currentSeriesEpisode.lines.length];
    const phraseSaved = savedPhrases.includes(line.phrase);
    const practiceTarget = seriesPracticeMode === "phrase" ? line.phrase : line.en;
    const pronunciationAlignment = seriesTranscript ? alignSpokenSentence(practiceTarget, seriesTranscript) : null;
    const pronunciationIssues = pronunciationAlignment
      ? pronunciationAlignment.words.filter((word) => word.status !== "correct").length + pronunciationAlignment.extraWords.length
      : 0;
    const episodeWatched = watchedSeriesEpisodes.includes(currentSeriesEpisode.id);
    const episodePracticed = practicedSeriesEpisodes.includes(currentSeriesEpisode.id);
    const episodeRoleplayed = roleplayedSeriesEpisodes.includes(currentSeriesEpisode.id);
    const episodeCompleted = completedSeriesEpisodes.includes(currentSeriesEpisode.id);
    const requirementsDone = episodeWatched && episodePracticed && episodeRoleplayed;
    const completedOnRoute = currentSeriesEpisodes.filter((episode) => completedSeriesEpisodes.includes(episode.id)).length;
    const bestScore = seriesBestScores[currentSeriesEpisode.id] ?? 0;
    const visibleRoleMessages = seriesRoleMessages.length > 0
      ? seriesRoleMessages
      : [{ role: "assistant" as const, text: currentSeriesEpisode.roleOpening, cn: currentSeriesEpisode.roleOpeningCn }];
    const roleTurnCount = visibleRoleMessages.filter((message) => message.role === "user").length;

    return (
      <div className="screen-content series-page">
        <header className="page-title-row">
          <div>
            <span className="tiny-label">互动短剧 · {currentLevel.code}</span>
            <h1>看懂一句，跟读一句，再自己接话</h1>
            <p>每集都要完成观看、跟读和AI角色对话，才能解锁下一段剧情。</p>
          </div>
          <span className="series-level-pill">本路线 {completedOnRoute} / {currentSeriesEpisodes.length} 集</span>
        </header>

        <section className="interactive-series-workspace">
          <div className="interactive-series-main">
            <div className="interactive-series-player">
              <div className="interactive-series-screen">
                <img
                  key={`${currentSeriesEpisode.id}-${seriesLine}`}
                  className={`series-camera-beat beat-${seriesLine % 3}`}
                  src={currentSeriesEpisode.image}
                  alt={`${currentSeriesEpisode.title}英语互动短剧场景`}
                  onError={(event) => { event.currentTarget.src = "/assets/series-flatmate.png"; }}
                />
                <div className="episode-badge"><span>EP.{currentSeriesEpisode.number} · {currentSeriesEpisode.level}</span><strong>{currentSeriesEpisode.title}</strong></div>
                <div className={`interactive-series-subtitle mode-${seriesSubtitleMode}`}>
                  {seriesSubtitleMode === "hidden" ? (
                    <h2>字幕已隐藏，先听原声再打开</h2>
                  ) : (
                    <>
                      <small>{line.speaker}</small>
                      <h2>{line.en}</h2>
                      {seriesSubtitleMode === "bilingual" && <p>{line.cn}</p>}
                      <button type="button" onClick={() => setSeriesPanelTab("mission")}>重点表达：{line.phrase}</button>
                    </>
                  )}
                </div>
              </div>

              <div className="interactive-series-controls">
                <button type="button" onClick={() => goToSeriesLine(seriesLine - 1)} disabled={seriesLine === 0} aria-label="上一句">←</button>
                <button type="button" className="series-play-button" onClick={() => playSeriesAudio(1)}>{seriesSpeaking ? "停止" : "▶ 听原声"}</button>
                <button type="button" className="series-repeat-button" onClick={() => playSeriesAudio(2)}>↻ 循环 2 次</button>
                <div className="series-speed-picker" aria-label="播放速度">
                  {([0.75, 1, 1.25] as const).map((speed) => (
                    <button type="button" key={speed} className={seriesSpeed === speed ? "active" : ""} onClick={() => setSeriesSpeed(speed)}>{speed}×</button>
                  ))}
                </div>
                <span>{seriesLine + 1} / {currentSeriesEpisode.lines.length}</span>
                <ProgressBar value={((seriesLine + 1) / currentSeriesEpisode.lines.length) * 100} />
                <button type="button" onClick={() => goToSeriesLine(seriesLine + 1)} disabled={seriesLine === currentSeriesEpisode.lines.length - 1} aria-label="下一句">→</button>
              </div>
            </div>

            <article className="series-practice-card">
              <div className="series-current-expression">
                <small>当前重点表达</small>
                <strong>{line.phrase}</strong>
                <p><b>{line.meaning}</b> · {line.usage}</p>
              </div>
              <div className="series-practice-actions">
                <button
                  type="button"
                  className={phraseSaved ? "saved" : ""}
                  disabled={phraseSaved}
                  onClick={() => setSavedPhrases((items) => items.includes(line.phrase) ? items : [...items, line.phrase])}
                >
                  {phraseSaved ? "已收入词库 ✓" : "＋ 收入词库"}
                </button>
                <button type="button" className={seriesRecording ? "recording" : ""} onClick={startSeriesPronunciation} disabled={seriesRecording}>
                  {seriesRecording ? "正在听……" : seriesPracticeMode === "phrase" ? "● 跟读重点" : "● 跟读整句"}
                </button>
              </div>
              <div className="series-practice-mode">
                <span>选择评分范围</span>
                <div role="group" aria-label="选择跟读评分范围">
                  <button type="button" className={seriesPracticeMode === "phrase" ? "active" : ""} disabled={seriesRecording} onClick={() => changeSeriesPracticeMode("phrase")}>重点短语</button>
                  <button type="button" className={seriesPracticeMode === "sentence" ? "active" : ""} disabled={seriesRecording} onClick={() => changeSeriesPracticeMode("sentence")}>完整台词</button>
                </div>
                <small>{seriesPracticeMode === "phrase" ? `本次只评分：${line.phrase}` : "本次评分整句；逗号处可以自然停顿，系统会继续聆听。"}</small>
              </div>
              {(seriesPracticeMessage || seriesTranscript) && (
                <div className="series-practice-feedback">
                  {seriesAttemptScore !== null && <strong>{seriesAttemptScore}<small>分</small></strong>}
                  <div className="series-pronunciation-result">
                    {pronunciationAlignment && (
                      <>
                        <div className="series-word-result-heading">
                          <small>逐词对照 · {seriesPracticeMode === "phrase" ? "重点短语" : "完整台词"}</small>
                          <span>{pronunciationIssues === 0 ? "全部匹配 ✓" : `${pronunciationIssues} 处需要重读`}</span>
                        </div>
                        <p className="series-spoken-sentence"><b>识别到：</b>{seriesTranscript}</p>
                        <div className="series-word-alignment" aria-label="跟读逐词识别结果">
                          {pronunciationAlignment.words.map((word, index) => (
                            <span key={`${word.target}-${index}`} className={word.status}>
                              <b>{word.target}</b>
                              {word.status === "incorrect" && <small>听成 {word.heard}</small>}
                              {word.status === "missed" && <small>未识别</small>}
                            </span>
                          ))}
                        </div>
                        {pronunciationAlignment.extraWords.length > 0 && (
                          <p className="series-extra-words">多读了：{pronunciationAlignment.extraWords.join(" · ")}</p>
                        )}
                        <div className="series-word-legend"><span className="correct">读对</span><span className="incorrect">读错</span><span className="missed">漏读</span></div>
                      </>
                    )}
                    <p>{seriesPracticeMessage}</p>
                  </div>
                </div>
              )}
            </article>
          </div>

          <aside className="series-coach-panel">
            <header>
              <small>本集任务</small>
              <h2>{currentSeriesEpisode.goal}</h2>
              <span>{episodeCompleted ? "已完成" : `${[episodeWatched, episodePracticed, episodeRoleplayed].filter(Boolean).length} / 3`}</span>
            </header>

            <div className="series-panel-tabs" role="tablist" aria-label="短剧学习功能">
              <button type="button" className={seriesPanelTab === "mission" ? "active" : ""} onClick={() => setSeriesPanelTab("mission")}>学习任务</button>
              <button type="button" className={seriesPanelTab === "roleplay" ? "active" : ""} onClick={() => setSeriesPanelTab("roleplay")}>AI角色对话</button>
              <button type="button" className={seriesPanelTab === "report" ? "active" : ""} onClick={() => setSeriesPanelTab("report")} disabled={!episodeCompleted}>学习报告</button>
            </div>

            {seriesPanelTab === "mission" && (
              <div className="series-mission-panel">
                <div className="series-task-list">
                  <button type="button" className={episodeWatched ? "done" : ""} onClick={focusSeriesViewing}>
                    <span>{episodeWatched ? "✓" : "1"}</span><div><strong>逐句看完本集</strong><small>{episodeWatched ? "已完成；点击可返回播放器" : "请使用播放器的“听原声”和下一句按钮"}</small></div>
                  </button>
                  <button type="button" className={episodePracticed ? "done" : ""} onClick={startSeriesPronunciation}>
                    <span>{episodePracticed ? "✓" : "2"}</span><div><strong>完成一次跟读</strong><small>{episodePracticed ? `最佳 ${bestScore} 分` : "可跟读重点短语，也可挑战完整台词"}</small></div>
                  </button>
                  <button type="button" className={episodeRoleplayed ? "done" : ""} onClick={() => setSeriesPanelTab("roleplay")}>
                    <span>{episodeRoleplayed ? "✓" : "3"}</span><div><strong>进入剧情接话</strong><small>{episodeRoleplayed ? "已完成AI角色对话" : "由你扮演Leo，自由回复Maya"}</small></div>
                  </button>
                </div>

                <div className="series-subtitle-picker">
                  <small>字幕模式</small>
                  <div>
                    {([
                      ["bilingual", "中英双语"],
                      ["english", "只看英文"],
                      ["hidden", "隐藏字幕"],
                    ] as const).map(([mode, label]) => (
                      <button type="button" key={mode} className={seriesSubtitleMode === mode ? "active" : ""} onClick={() => setSeriesSubtitleMode(mode)}>{label}</button>
                    ))}
                  </div>
                </div>

                <button type="button" className="series-complete-button" disabled={!requirementsDone} onClick={completeSeriesEpisode}>
                  {episodeCompleted ? "查看本集报告 →" : requirementsDone ? "完成本集并解锁下一集 →" : "完成上面 3 项后解锁"}
                </button>
              </div>
            )}

            {seriesPanelTab === "roleplay" && (
              <div className="series-roleplay-panel">
                <div className="series-role-heading"><span>AI</span><div><strong>{currentSeriesEpisode.role}</strong><small>你扮演 Leo · AI 会根据上下文继续追问</small></div></div>
                <div className="series-role-messages">
                  {visibleRoleMessages.slice(-5).map((message, index) => (
                    <div key={`${message.role}-${index}`} className={`series-role-message ${message.role}`}>
                      <small>{message.role === "assistant" ? "Maya" : "你"}</small>
                      <p>{message.text}</p>
                      {message.cn && <span>{message.cn}</span>}
                      {message.feedback && <em>{message.feedback}</em>}
                    </div>
                  ))}
                  {seriesRoleThinking && <div className="series-role-thinking">Maya 正在回应你的具体表达……</div>}
                </div>
                <div className="series-quick-replies">
                  <small>参考回答（点击后仍可修改）</small>
                  {currentSeriesEpisode.quickReplies.map((reply) => (
                    <button type="button" key={reply} onClick={() => setSeriesRoleInput(reply)}>{reply}</button>
                  ))}
                </div>
                <form className="series-role-composer" onSubmit={(event) => { event.preventDefault(); sendSeriesRoleMessage(); }}>
                  <textarea value={seriesRoleInput} onChange={(event) => setSeriesRoleInput(event.target.value)} rows={2} placeholder="用英语自由回复，不必照着选项……" />
                  <button type="submit" disabled={!seriesRoleInput.trim() || seriesRoleThinking}>发送 →</button>
                </form>
                {episodeRoleplayed && <button type="button" className="back-to-mission" onClick={() => setSeriesPanelTab("mission")}>对话已计入任务，返回完成本集 →</button>}
              </div>
            )}

            {seriesPanelTab === "report" && (
              <div className="series-report-panel">
                <span className="series-report-badge">EPISODE COMPLETE</span>
                <h2>你不是“看完了”，<br />而是真的用出了一次英语。</h2>
                <div className="series-report-stats">
                  <article><strong>{currentSeriesEpisode.lines.length}</strong><small>接触表达</small></article>
                  <article><strong>{bestScore || "—"}</strong><small>跟读最佳分</small></article>
                  <article><strong>{Math.max(1, roleTurnCount)}</strong><small>自主回复</small></article>
                </div>
                <div className="series-report-phrases">
                  {currentSeriesEpisode.lines.map((item) => <span key={item.phrase}>{item.phrase}</span>)}
                </div>
                <p>已获得 <b>+30 XP</b>，下一集已独立解锁。</p>
                <button type="button" onClick={continueSeries}>{selectedEpisode < currentSeriesEpisodes.length - 1 ? "进入下一集 →" : "本路线已完成，返回首页 →"}</button>
              </div>
            )}
          </aside>
        </section>

        <div className="section-heading small-gap">
          <div><span className="tiny-label">本等级连续剧情</span><h2>《合租生活》· {currentLevel.code}</h2></div>
          <span className="series-streak-label">完成本集，独立解锁下一集</span>
        </div>
        <section className="interactive-episode-grid">
          {currentSeriesEpisodes.map((episode, index) => {
            const unlocked = index === 0 || completedSeriesEpisodes.includes(currentSeriesEpisodes[index - 1].id);
            const completed = completedSeriesEpisodes.includes(episode.id);
            const taskCount = [
              watchedSeriesEpisodes.includes(episode.id),
              practicedSeriesEpisodes.includes(episode.id),
              roleplayedSeriesEpisodes.includes(episode.id),
            ].filter(Boolean).length;
            return (
              <button
                type="button"
                key={episode.id}
                className={`${selectedEpisode === index ? "active" : ""} ${unlocked ? "" : "locked"} ${completed ? "completed" : ""}`}
                disabled={!unlocked}
                onClick={() => selectSeriesEpisode(index)}
              >
                <span>{episode.number}</span>
                <div><small>{episode.level} · {completed ? "已完成" : unlocked ? `${taskCount}/3 项任务` : "完成上一集后解锁"}</small><strong>{episode.title}</strong></div>
                <em>{completed ? "✓" : unlocked ? "进入 →" : "锁定"}</em>
              </button>
            );
          })}
        </section>
      </div>
    );
  };

  const renderDialogue = () => {
    if (missionDone) {
      return (
        <div className="screen-content result-screen">
          <button type="button" className="back-button" onClick={() => setScreen("world")}>← 情境地图</button>
          <section className="result-card">
            <div className="result-confetti" aria-hidden="true"><span>★</span><span>●</span><span>◆</span></div>
            <span className="result-stamp">MISSION COMPLETE</span>
            <h1>你真的完成了<br />{meta.shortTitle}！</h1>
            <p>这不是“背过 {currentDialogue.length} 个句型”，而是你已经能在真实情境里把事情办成。</p>
            <div className="result-xp"><small>本次获得</small><strong>+20 XP</strong></div>
            <div className="result-summary">
              <article><span>✓</span><div><small>任务完成度</small><strong>100%</strong></div></article>
              <article><span>▣</span><div><small>收入个人词库</small><strong>{currentDialogue.length} 个表达</strong></div></article>
              <article><span>↗</span><div><small>明日复习</small><strong>已自动安排</strong></div></article>
            </div>
            <div className="learned-phrases">
              <small>本次带走的表达</small>
              {currentDialogue.map((item) => (
                <div key={item.phrase}><strong>{item.phrase}</strong><SpeakButton text={item.phrase} compact /></div>
              ))}
            </div>
            <div className="result-actions">
              <button type="button" className="primary-button" onClick={() => setScreen("home")}>回到首页</button>
              <button type="button" className="secondary-button" onClick={() => setScreen("words")}>查看个人词库</button>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className="screen-content dialogue-screen">
        <header className="dialogue-topbar">
          <button type="button" className="back-button" onClick={() => setScreen("world")}>← 退出任务</button>
          <div className="dialogue-progress-wrap">
            <span>第 {dialogueStep + 1} / {currentDialogue.length} 轮</span>
            <ProgressBar value={((dialogueStep + 1) / currentDialogue.length) * 100} />
          </div>
          <span className="xp-pill">★ {xp} XP</span>
        </header>

        <section className={`dialogue-stage ${meta.color}-stage`}>
          <img src={meta.image} alt={`${meta.shortTitle}插画`} />
          <div className="mission-chip">
            <span>你的任务</span>
            <strong>{meta.goal}</strong>
          </div>
        </section>

        <section className="conversation-card">
          <div className="npc-row">
            <div className="npc-avatar">AI</div>
            <div><small>{currentLevel.code} · 场景角色</small><strong>{sceneNpc[activeScene]}</strong></div>
            <SpeakButton text={turn.npc} />
          </div>
          <div className="npc-speech">
            <h2>{turn.npc}</h2>
            <p>{turn.cn}</p>
          </div>

          <div className="answer-label"><span>选择你要说的话</span><small>答错可以重试</small></div>
          <div className="answer-list">
            {turn.choices.map((choice, index) => {
              const isSelected = selectedAnswer === index;
              const stateClass = isSelected ? answerState : "idle";
              return (
                <div key={choice} className={`answer-option ${stateClass}`}>
                  <button
                    type="button"
                    className="answer-select"
                    onClick={() => chooseAnswer(index)}
                    disabled={answerState === "correct"}
                  >
                    <span>{String.fromCharCode(65 + index)}</span>
                    <strong>{choice}</strong>
                    <em>{isSelected && answerState === "correct" ? "✓" : isSelected && answerState === "wrong" ? "×" : "→"}</em>
                  </button>
                  <SpeakButton text={choice} compact />
                </div>
              );
            })}
          </div>

          {answerState !== "idle" && (
            <div className={`feedback-box ${answerState}`} role="status">
              <span>{answerState === "correct" ? "✓" : "!"}</span>
              <div>
                <strong>{answerState === "correct" ? "表达自然，任务继续！" : "这句话听起来有点奇怪，再选一次吧。"}</strong>
                <p>{answerState === "correct" ? turn.tip : "再听一遍三个选项，检查语气、搭配和是否完整回应了对方的问题。"}</p>
              </div>
              {answerState === "correct" && (
                <button type="button" className="primary-button small" onClick={continueDialogue}>
                  {dialogueStep === currentDialogue.length - 1 ? "查看任务结果" : "继续对话"} →
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    );
  };

  const renderWords = () => (
    <div className="screen-content">
      <header className="page-title-row word-header">
        <div>
          <span className="tiny-label">MY REAL-LIFE WORDS</span>
          <h1>我的表达背包</h1>
          <p>这里只收录你在真实任务里遇到过、用过的词与表达。</p>
        </div>
        <button type="button" className="primary-button" disabled={collectedWordItems.length === 0} onClick={() => { setReviewIndex(0); setReviewCount(0); setReviewRevealed(false); setScreen("review"); }}>
          {collectedWordItems.length === 0 ? "暂无可复习表达" : "开始 AI 复习 →"}
        </button>
      </header>

      <section className="word-overview">
        <div className="word-bag-art"><span>▣</span><strong>{savedPhrases.length}</strong><small>个真实表达</small></div>
        <div className="word-overview-copy">
          <span className="eyebrow-pill pale">{savedPhrases.length === 0 ? "背包还是空的" : "今日复习建议"}</span>
          <h2>{savedPhrases.length === 0 ? <>先完成一个场景，<br />表达才会真正属于你。</> : <>趁还记得，复习 {Math.min(4, savedPhrases.length)} 个<br />刚刚用过的表达。</>}</h2>
          <div className="review-mini-stats"><span><strong>{savedPhrases.length}</strong> 已收录</span><span><strong>{completedScenes.length}</strong> 场景来源</span><span><strong>{savedPhrases.length === 0 ? 0 : 3}m</strong> 预计用时</span></div>
        </div>
      </section>

      <div className="section-heading small-gap">
        <div><span className="tiny-label">COLLECTED IN SCENES</span><h2>最近收录</h2></div>
        <span className="scene-tag">从 0 开始积累</span>
      </div>

      {collectedWordItems.length === 0 ? (
        <section className="empty-state-card">
          <span>▣</span><div><small>MY PHRASES</small><h2>你的词库还是空的</h2><p>完成一个情境练习后，收藏的表达会自动出现在这里。</p></div>
          <button type="button" className="primary-button" onClick={() => openScene(dailyScene)}>完成第一个场景 →</button>
        </section>
      ) : (
        <section className="word-list">
          {collectedWordItems.map((item, index) => (
            <article key={item.word}>
              <span className="word-index">{String(index + 1).padStart(2, "0")}</span>
              <div className="word-main"><div><h3>{item.word}</h3><p>{item.meaning}</p></div><SpeakButton text={item.word} compact /></div>
              <span className="scene-tag">{item.scene}</span>
              <div className="mastery"><span><small>掌握度</small><strong>{item.mastery}%</strong></span><ProgressBar value={item.mastery} /></div>
            </article>
          ))}
        </section>
      )}
    </div>
  );

  const renderReview = () => {
    const reviewTarget = Math.min(4, collectedWordItems.length);
    const current = collectedWordItems[reviewIndex % Math.max(1, collectedWordItems.length)];
    const reviewFinished = reviewTarget > 0 && reviewCount >= reviewTarget;

    if (!current) {
      return (
        <div className="screen-content review-screen">
          <button type="button" className="back-button" onClick={() => setScreen("words")}>← 返回词库</button>
          <section className="empty-state-card review-empty">
            <span>0</span><div><small>NOTHING TO REVIEW</small><h2>先去场景里真正用一次英语。</h2><p>完成对话后，这里才会生成属于你的复习卡。</p></div>
            <button type="button" className="primary-button" onClick={() => setScreen("world")}>去情境地图 →</button>
          </section>
        </div>
      );
    }

    return (
      <div className="screen-content review-screen">
        <header className="dialogue-topbar">
          <button type="button" className="back-button" onClick={() => setScreen("words")}>← 返回词库</button>
          <div className="dialogue-progress-wrap"><span>今日复习 {Math.min(reviewCount, reviewTarget)} / {reviewTarget}</span><ProgressBar value={(Math.min(reviewCount, reviewTarget) / reviewTarget) * 100} /></div>
          <span className="xp-pill">AI 自适应</span>
        </header>

        {reviewFinished ? (
          <section className="review-complete">
            <div className="complete-icon">✓</div>
            <span className="tiny-label">REVIEW COMPLETE</span>
            <h1>今天的记忆已经加固。</h1>
            <p>你复习了 {reviewTarget} 个来自真实任务的表达，薄弱词会在之后再次出现。</p>
            <div className="review-result-row"><span><strong>{reviewTarget}</strong><small>完成复习</small></span><span><strong>+10</strong><small>获得 XP</small></span><span><strong>2天</strong><small>下次复习</small></span></div>
            <button type="button" className="primary-button" onClick={() => { setXp((value) => value + 10); setScreen("growth"); }}>查看成长变化 →</button>
          </section>
        ) : (
          <section className="flashcard-wrap">
            <div className="review-context"><span>{current.scene}情境</span><small>先回忆它在任务中怎样使用</small></div>
            <article className={`flashcard ${reviewRevealed ? "revealed" : ""}`}>
              <span className="card-corner">{String(reviewIndex + 1).padStart(2, "0")}</span>
              <small>这个表达该怎样正确使用？</small>
              <h1>{current.word}</h1>
              <SpeakButton text={current.word} />
              <div className="flashcard-answer">
                <span>参考答案</span>
                <strong>{current.example}</strong>
                <p><b>含义 / 用法：</b>{current.meaning}</p>
                <p><b>使用提示：</b>{current.usage}</p>
              </div>
              {!reviewRevealed && (
                <button type="button" className="reveal-button" onClick={() => setReviewRevealed(true)}>
                  点击卡片查看答案
                </button>
              )}
            </article>
            {reviewRevealed && (
              <div className="review-actions">
                <button type="button" className="secondary-button" onClick={() => { setReviewIndex((value) => value + 1); setReviewCount((value) => value + 1); setReviewRevealed(false); }}>还不熟，再练</button>
                <button type="button" className="primary-button" onClick={() => { setReviewIndex((value) => value + 1); setReviewCount((value) => value + 1); setReviewRevealed(false); }}>记得很清楚 ✓</button>
              </div>
            )}
          </section>
        )}
      </div>
    );
  };

  const renderGrowth = () => (
    <div className="screen-content growth-screen">
      <header className="page-title-row">
        <div><span className="tiny-label">YOUR GROWTH</span><h1>不是打卡，是你做到的事</h1><p>数据只记录你真正完成的场景任务与可用表达。</p></div>
        <select aria-label="选择数据周期" defaultValue="week"><option value="week">本周</option><option value="month">本月</option></select>
      </header>

      <section className="growth-stats">
        <article className="black-stat"><small>{currentLevel.code} 路线打卡</small><strong>{streak} <em>天</em></strong><p>{nextUnlock.complete ? "当前路线已全部解锁" : `本路线下个场景还差 ${Math.max(0, nextUnlock.days - streak)} 天解锁`}</p></article>
        <article><span className="round-icon coral">★</span><small>总成长值</small><strong>{xp} XP</strong><p>距离下一级还差 {100 - (xp % 100)} XP</p></article>
        <article><span className="round-icon mint">✓</span><small>真实任务</small><strong>{completedScenes.length} 个</strong><p>从 0 开始，完成才计入</p></article>
        <article><span className="round-icon yellow">▣</span><small>可用表达</small><strong>{savedPhrases.length} 个</strong><p>{savedPhrases.length === 0 ? "还没有收藏表达" : `平均掌握率 ${Math.min(90, 20 + savedPhrases.length * 5)}%`}</p></article>
      </section>

      <section className="chart-card">
        <div className="chart-heading"><div><small>本周学习活跃度</small><h2>{checkedIn ? "今天是你的第一个数据点" : "还没有活动记录"}</h2></div><span className="trend-pill">{checkedIn ? "已完成今日打卡" : "从今天开始"}</span></div>
        <div className="bar-chart" aria-label="本周学习活跃度柱状图">
          {activityData.map((item) => (
            <div className="bar-column" key={item.day}><span className="bar-value">{item.value}</span><div className="bar" style={{ height: `${item.value}%` }} /><small>{item.day}</small></div>
          ))}
        </div>
      </section>

      <section className="growth-bottom-grid">
        <article className="skill-card">
          <div><small>能力画像</small><h2>你的英语生存力</h2></div>
          <div className="skill-list">
            <span><small>礼貌表达</small><strong>{Math.min(100, completedScenes.length * 12)}%</strong><ProgressBar value={Math.min(100, completedScenes.length * 12)} /></span>
            <span><small>旅行沟通</small><strong>{Math.min(100, completedScenes.length * 9)}%</strong><ProgressBar value={Math.min(100, completedScenes.length * 9)} /></span>
            <span><small>即时反应</small><strong>{Math.min(100, savedPhrases.length * 6)}%</strong><ProgressBar value={Math.min(100, savedPhrases.length * 6)} /></span>
            <span><small>职场表达</small><strong>{Math.min(100, completedScenes.filter((scene) => sceneMeta[scene].route === "advanced").length * 17)}%</strong><ProgressBar value={Math.min(100, completedScenes.filter((scene) => sceneMeta[scene].route === "advanced").length * 17)} /></span>
          </div>
        </article>
        <article className={`achievement-card ${latestEarnedMedal ? "" : "empty-achievement"}`}>
          <small>{latestEarnedMedal ? "最新成就" : "等待点亮"}</small><div className="badge-art">{latestEarnedMedal?.icon ?? "?"}</div><h2>{latestEarnedMedal?.title ?? "第一枚勋章还未获得"}</h2><p>{latestEarnedMedal?.description ?? "完成第一次打卡，就会在勋章排点亮你的第一枚勋章。"}</p><span>{latestEarnedMedal ? "已收入我的勋章排" : "当前 0 / 12"}</span>
        </article>
      </section>
    </div>
  );

  const renderAccount = () => (
    <div className="screen-content account-screen">
      <button type="button" className="back-button" onClick={() => setScreen("home")}>← 返回首页</button>
      <section className="account-hero-card">
        <div className="account-avatar">{name.slice(0, 1) || "我"}</div>
        <div><span className="tiny-label">ACCOUNT CENTER</span><h1>{name || "学习者"}</h1><p>{currentLevel.code} 路线 {streak} 天 · 三路线累计 {totalRouteDays} 次 · {xp} XP</p></div>
        <button type="button" className="secondary-button" onClick={() => setScreen("profile")}>查看个人主页 →</button>
      </section>

      <div className="section-heading small-gap">
        <div><span className="tiny-label">QUICK ACTIONS</span><h2>账号与学习入口</h2></div>
      </div>
      <section className="account-action-grid">
        <button type="button" onClick={() => setScreen("lab")}><span className="coral">✦</span><div><strong>AI 对话实验室</strong><small>自由输入、角色追问与表达反馈</small></div><em>→</em></button>
        <button type="button" onClick={() => setScreen("profile")}><span className="mint">◔</span><div><strong>成长档案</strong><small>等级、打卡、场景与勋章排</small></div><em>→</em></button>
        <button type="button" onClick={() => setScreen("words")}><span className="yellow">▣</span><div><strong>表达背包</strong><small>查看真实任务中收藏的表达</small></div><em>→</em></button>
        <button type="button" onClick={() => setScreen("series")}><span className="blue">▷</span><div><strong>英语互动短剧</strong><small>逐句听、字幕切换与表达收藏</small></div><em>→</em></button>
      </section>

      <section className="account-session-card">
        <div><small>CURRENT SESSION</small><h2>退出不会清空学习数据</h2><p>退出后会进入独立的已退出界面。再次进入时，打卡、经验、词库和勋章仍然保留。</p></div>
        <button type="button" className="logout-primary" onClick={() => setScreen("logout")}>退出当前账号 →</button>
      </section>
    </div>
  );

  const renderLogout = () => (
    <div className="screen-content logout-screen">
      <button type="button" className="back-button" onClick={() => setScreen("account")}>← 返回账号菜单</button>
      <section className="logout-confirm-card">
        <div className="logout-mascot-wrap"><img src="/assets/mascot-hero.png" alt="挥手告别的黑猫英语伙伴" /><span>今天辛苦了！</span></div>
        <div className="logout-confirm-copy">
          <span className="tiny-label">SIGN OUT</span>
          <h1>确定要退出<br />Life English 吗？</h1>
          <p>退出只结束当前使用状态，不会删除你的学习档案。</p>
          <div className="logout-preserve-grid">
            <span><strong>{totalRouteDays}</strong><small>累计路线打卡</small></span>
            <span><strong>{xp}</strong><small>成长 XP</small></span>
            <span><strong>{earnedMedalCount}</strong><small>已获勋章</small></span>
          </div>
          <button type="button" className="logout-confirm-button" onClick={confirmLogout}>确认退出账号</button>
          <button type="button" className="secondary-button wide" onClick={() => setScreen("account")}>暂不退出，继续学习</button>
        </div>
      </section>
    </div>
  );

  const renderProfile = () => (
    <div className="screen-content profile-screen">
      <button type="button" className="back-button" onClick={() => setScreen("home")}>← 返回首页</button>
      <section className="profile-hero">
        <div className="profile-avatar">{name.slice(0, 1) || "我"}</div>
        <span className="tiny-label">LIFE EXPLORER · LV. {Math.floor(xp / 100) + 1} · {currentLevel.code}</span>
        <h1>{name}</h1>
        <p>当前路线：{currentLevel.label} · {currentLevel.description}</p>
        <div className="profile-level"><span>{xp % 100} / 100 XP</span><ProgressBar value={xp % 100} /></div>
      </section>

      <section className="profile-level-card">
        <div className="profile-card-heading"><div><small>MY ENGLISH LEVEL</small><h2>我的学习难度</h2></div><span>{currentLevel.code}</span></div>
        <p>可随时切换；三条路线分别累计打卡，切换难度不会复制或清空其他路线进度。</p>
        <div className="profile-level-options">
          {(Object.keys(levelConfig) as Level[]).map((item) => (
            <button type="button" key={item} className={level === item ? "active" : ""} onClick={() => changeLearningLevel(item)}>
              <strong>{levelConfig[item].code}</strong><small>{levelConfig[item].label} · {routeDays[item]} 天</small>
            </button>
          ))}
        </div>
      </section>

      <section className="profile-unlock-card">
        <div className="profile-card-heading">
          <div><small>INDEPENDENT CHECK-IN</small><h2>{currentLevel.code} 路线解锁进度</h2></div>
          <strong>{streak} DAYS</strong>
        </div>
        <div className="next-unlock-copy"><span>下一项</span><strong>{nextUnlock.label}</strong><em>{nextUnlock.complete ? "路线全部解锁" : `还差 ${Math.max(0, nextUnlock.days - streak)} 天`}</em></div>
        <ProgressBar value={nextUnlock.complete ? 100 : Math.min(100, (streak / nextUnlock.days) * 100)} />
        <div className="profile-milestones extended-milestones">
          {routeScenes.map((scene) => (
            <div key={scene} className={streak >= sceneMeta[scene].unlockDays ? "reached" : ""}>
              <span>{streak >= sceneMeta[scene].unlockDays ? "✓" : sceneMeta[scene].unlockDays}</span><small>{sceneMeta[scene].shortTitle}</small>
            </div>
          ))}
        </div>
        <button type="button" className={`checkin-button profile-checkin ${checkedIn ? "done" : ""}`} onClick={checkIn} disabled={checkedIn}>
          {checkedIn ? `${currentLevel.code} 今天已打卡，明天继续 ✓` : `${currentLevel.code} 路线今日打卡 · 仅本路线 +1`}
        </button>
      </section>

      <section className="medal-rack-card">
        <div className="profile-card-heading">
          <div><small>MY MEDAL RACK</small><h2>我的勋章排</h2></div>
          <strong>{earnedMedalCount} / {medals.length}</strong>
        </div>
        <p>没有赠送勋章。打卡、完成场景、收藏表达，都会一点一点把这里点亮。</p>
        <div className="medal-rack-grid">
          {medals.map((medal) => (
            <article key={medal.id} className={medal.earned ? "earned" : "locked"}>
              <div>{medal.earned ? medal.icon : "·"}</div>
              <strong>{medal.title}</strong>
              <small>{medal.description}</small>
              <span>{medal.earned ? "已获得" : `${Math.min(medal.current, medal.target)} / ${medal.target}`}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="profile-menu">
        <button type="button" onClick={() => setScreen("growth")}><span>◎</span><div><strong>查看完整成长报告</strong><small>任务、表达、能力画像和每周趋势</small></div><em>→</em></button>
        <button type="button" onClick={() => setScreen("lab")}><span>✦</span><div><strong>进入 AI 对话实验室</strong><small>自由输入英文，进行连续角色对话</small></div><em>→</em></button>
        <button type="button" onClick={() => setScreen("series")}><span>▷</span><div><strong>我的短剧学习</strong><small>本等级已完成 {currentSeriesEpisodes.filter((episode) => completedSeriesEpisodes.includes(episode.id)).length}/{currentSeriesEpisodes.length} 集 · 收藏 {savedPhrases.length} 个表达</small></div><em>→</em></button>
        <button type="button" onClick={() => setScreen("words")}><span>▣</span><div><strong>词库与复习设置</strong><small>AI 自适应安排已开启</small></div><em>→</em></button>
        <button type="button" onClick={() => setScreen("account")}><span>•••</span><div><strong>账号与退出</strong><small>打开账号菜单或退出当前账号</small></div><em>→</em></button>
      </section>
      <button type="button" className="logout-button" onClick={resetAccount}>删除账号与全部学习档案，重新从 0 开始</button>
    </div>
  );

  const renderScreen = () => {
    if (screen === "home") return renderHome();
    if (screen === "world") return renderWorld();
    if (screen === "lab") return renderLab();
    if (screen === "series") return renderSeries();
    if (screen === "dialogue") return renderDialogue();
    if (screen === "words") return renderWords();
    if (screen === "review") return renderReview();
    if (screen === "growth") return renderGrowth();
    if (screen === "account") return renderAccount();
    if (screen === "logout") return renderLogout();
    return renderProfile();
  };

  const navScreen = screen === "dialogue" || screen === "review"
    ? ""
    : screen === "growth" || screen === "account" || screen === "logout"
      ? "profile"
      : screen;
  const sideMiniLabel = screen === "series" && currentSeriesEpisode
    ? `${currentLevel.code} 短剧 · 第 ${selectedEpisode + 1}/${currentSeriesEpisodes.length} 集`
    : screen === "lab"
      ? `${currentLevel.code} · AI 对话实验室`
      : screen === "dialogue"
        ? `${currentLevel.code} · 当前情境任务`
        : `${currentLevel.code} 路线 · ${streak} DAYS`;
  const sideMiniTitle = screen === "series" && currentSeriesEpisode
    ? currentSeriesEpisode.title
    : screen === "lab"
      ? labScenarioData[labScene].title
      : screen === "dialogue"
        ? meta.shortTitle
        : homeMeta.shortTitle;

  return (
    <main className="app-root">
      <div className="app-shell">
        <aside className="side-nav">
          <button type="button" className="side-brand" onClick={() => setScreen("home")}>
            <span className="brand-mark">LE</span>
            <span><strong>Life English</strong><small>AI 人生英语</small></span>
          </button>
          <nav aria-label="主导航">
            {navItems.map((item) => (
              <button type="button" key={item.id} className={navScreen === item.id ? "active" : ""} onClick={() => setScreen(item.id)}>
                <span>{item.icon}</span>{item.label}
              </button>
            ))}
          </nav>
          <div className="side-mini-card">
            <img src="/assets/mascot-hero.png" alt="黑猫伙伴" />
            <span><small>{sideMiniLabel}</small><strong>{sideMiniTitle}</strong></span>
          </div>
          <div className="side-account-dock">
            <button type="button" className="side-profile" onClick={() => setScreen("profile")}>
              <span>{name.slice(0, 1) || "我"}</span><div><strong>{name}</strong><small>{currentLevel.code} · {xp} XP</small></div>
            </button>
            <button type="button" className="side-more-button" onClick={() => setScreen("account")} aria-label="打开账号与退出菜单">•••</button>
          </div>
        </aside>

        <section className="app-main">{renderScreen()}</section>

        <nav className="bottom-nav" aria-label="移动端主导航">
          {navItems.map((item) => (
            <button type="button" key={item.id} className={navScreen === item.id ? "active" : ""} onClick={() => setScreen(item.id)}>
              <span>{item.icon}</span><small>{item.label}</small>
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}
