import type { Message } from "./demo";
export const initials = (name: string) =>
  name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
export const time = (date: string) =>
  new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export const relative = (date: string) => {
  const m = Math.max(
    1,
    Math.floor((Date.now() - new Date(date).getTime()) / 60000),
  );
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`;
};
export const Avatar = ({
  name,
  small = false,
}: {
  name: string;
  small?: boolean;
}) => (
  <span className={`avatar ${small ? "small" : ""} color-${name.length % 4}`}>
    {initials(name)}
  </span>
);
export const merge = (old: Message[], incoming: Message[]) => {
  const map = new Map(old.map((m) => [`${m.senderType}:${m.clientId}`, m]));
  incoming.forEach((m) =>
    map.set(`${m.senderType}:${m.clientId}`, { ...m, state: "sent" }),
  );
  return [...map.values()].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
};
