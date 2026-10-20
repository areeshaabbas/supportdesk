export type Agent = { _id: string; name: string; email: string; role: string };
export type Conversation = {
  _id: string;
  subject: string;
  customer: { name: string; email: string };
  assignedTo: Agent | null;
  status: "open" | "pending" | "resolved";
  lastMessage: string;
  createdAt: string;
  updatedAt: string;
};
export type Message = {
  _id: string;
  conversation: string;
  content: string;
  senderType: "staff" | "customer";
  senderName: string;
  createdAt: string;
  clientId: string;
  state?: "sending" | "failed" | "sent";
};
export const demoAgents: Agent[] = [
  {
    _id: "a1",
    name: "Alex Morgan",
    email: "alex@supportdesk.local",
    role: "admin",
  },
  {
    _id: "a2",
    name: "Jamie Chen",
    email: "jamie@supportdesk.local",
    role: "agent",
  },
  {
    _id: "a3",
    name: "Sam Rivera",
    email: "sam@supportdesk.local",
    role: "agent",
  },
];
const people = [
  [
    "Maya Patel",
    "maya@formandfield.co",
    "A quick question about our team plan",
    "We’re adding a few new people next week.",
    "open",
    "a1",
  ],
  [
    "Oliver Brooks",
    "oliver@northline.studio",
    "Invoice for September",
    "Could you send that over when you get a chance?",
    "open",
    "",
  ],
  [
    "Sofia Andersson",
    "sofia@ordinary.se",
    "Connecting our custom domain",
    "That worked, thank you! One last thing…",
    "open",
    "a2",
  ],
  [
    "Ethan Williams",
    "ethan@madebyarc.com",
    "Trouble inviting a teammate",
    "The invitation link seems to have expired.",
    "open",
    "",
  ],
  [
    "Amara Okafor",
    "amara@daybreak.design",
    "Can we export our project history?",
    "A CSV would be perfect for our records.",
    "pending",
    "a1",
  ],
  [
    "Lucas Martin",
    "lucas@kindred.fr",
    "Updating our billing details",
    "I’ll check with our finance team and get back to you.",
    "pending",
    "a3",
  ],
  [
    "Isabella Rossi",
    "isabella@folio.it",
    "Thanks for your help today",
    "Everything is working beautifully now.",
    "resolved",
    "a2",
  ],
  [
    "Noah Kim",
    "noah@commonplace.co",
    "Account access restored",
    "I’m back in. Really appreciate the quick reply.",
    "resolved",
    "a1",
  ],
];
export const demoConversations: Conversation[] = people.map((p, i) => ({
  _id: `c${i + 1}`,
  subject: p[2],
  customer: { name: p[0], email: p[1] },
  assignedTo: demoAgents.find((a) => a._id === p[5]) || null,
  status: p[4] as Conversation["status"],
  lastMessage: p[3],
  createdAt: new Date(Date.now() - (i + 1) * 720000).toISOString(),
  updatedAt: new Date(Date.now() - (i + 1) * 180000).toISOString(),
}));
export const demoMessages: Message[] = demoConversations.flatMap((c, i) => [
  {
    _id: `m${i}1`,
    conversation: c._id,
    content:
      i === 0
        ? "Hi there! We’ve been really enjoying SupportDesk. I had a quick question about adding more people to our team."
        : c.subject,
    senderType: "customer" as const,
    senderName: c.customer.name,
    createdAt: c.createdAt,
    clientId: `d${i}1`,
  },
  {
    _id: `m${i}2`,
    conversation: c._id,
    content:
      i === 0
        ? "Hi Maya! Happy to help. You can invite new teammates from Settings → Team. Is there something specific you’d like to know about the plan?"
        : "Thanks for reaching out. I’m looking into this for you.",
    senderType: "staff" as const,
    senderName: "Alex Morgan",
    createdAt: new Date(new Date(c.createdAt).getTime() + 120000).toISOString(),
    clientId: `d${i}2`,
  },
  {
    _id: `m${i}3`,
    conversation: c._id,
    content:
      i === 0
        ? "Yes! We’re on the Studio plan with 5 seats right now. If we add 3 more people, will the extra seats be prorated for the rest of the month?"
        : c.lastMessage,
    senderType: "customer" as const,
    senderName: c.customer.name,
    createdAt: c.updatedAt,
    clientId: `d${i}3`,
  },
]);
