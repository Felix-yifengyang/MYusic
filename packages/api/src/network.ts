import os from "node:os";

export function getLanAddresses(): string[] {
  const addresses: string[] = [];
  const interfaces = os.networkInterfaces();

  for (const values of Object.values(interfaces)) {
    for (const item of values || []) {
      if (item.family === "IPv4" && !item.internal) {
        addresses.push(item.address);
      }
    }
  }

  return addresses;
}
