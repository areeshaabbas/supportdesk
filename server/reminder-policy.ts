export function needsReminder(
  conversation: {
    status?: string | null;
    lastCustomerAt?: Date | null;
    lastAgentAt?: Date | null;
  } | null,
  trigger: Date,
) {
  return Boolean(
    conversation &&
      conversation.status === "open" &&
      conversation.lastCustomerAt &&
      conversation.lastCustomerAt.getTime() === trigger.getTime() &&
      (!conversation.lastAgentAt || conversation.lastAgentAt < trigger),
  );
}
