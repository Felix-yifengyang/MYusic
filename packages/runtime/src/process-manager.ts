import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { isPortOpen } from "./ports";

export interface RuntimeLogger {
  log(message: string): void;
}

export interface ServiceDefinition {
  name: string;
  port: number;
  url: string;
  command: string;
  args: string[];
  cwd: string;
  requiredFile?: string;
}

export class ProcessManager {
  private readonly children: ChildProcess[] = [];

  constructor(private readonly logger: RuntimeLogger) {}

  async startService(service: ServiceDefinition) {
    if (await isPortOpen(service.port)) {
      this.logger.log(`${service.name} already running at ${service.url}`);
      return;
    }

    if (service.requiredFile && !fs.existsSync(service.requiredFile)) {
      this.logger.log(`${service.name} not installed: ${service.requiredFile}`);
      return;
    }

    const child = spawn(service.command, service.args, {
      cwd: service.cwd,
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });

    this.children.push(child);
    this.pipeOutput(service.name, child.stdout);
    this.pipeOutput(service.name, child.stderr);

    child.on("exit", (code) => {
      this.logger.log(`${service.name} exited with code ${code}`);
    });

    this.logger.log(`${service.name} starting at ${service.url}`);
  }

  stop() {
    for (const child of this.children) {
      if (!child.killed) {
        child.kill();
      }
    }
    this.children.length = 0;
  }

  private pipeOutput(name: string, stream: NodeJS.ReadableStream) {
    stream.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/)) {
        if (line.trim()) {
          this.logger.log(`[${name}] ${line}`);
        }
      }
    });
  }
}
