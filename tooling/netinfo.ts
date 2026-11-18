import { networkInterfaces } from "node:os";

/** 局域网 IPv4（状态面板展示）。多个时取第一个非回环。 */
export const LAN_IP: string | undefined = (() => {
  for (const list of Object.values(networkInterfaces())) {
    for (const entry of list ?? []) {
      if (entry.family === "IPv4" && !entry.internal) return entry.address;
    }
  }
  return undefined;
})();
