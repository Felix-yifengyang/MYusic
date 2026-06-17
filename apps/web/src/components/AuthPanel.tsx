import { FormEvent, useState } from "react";
import type { AuthStatus } from "@myusic/shared";
import { Button, Field } from "./ui";

export interface AuthPanelProps {
  status: AuthStatus;
  onInitializeAdmin: (username: string, password: string) => Promise<void>;
  onLogin: (username: string, password: string) => Promise<void>;
}

export function AuthPanel(props: AuthPanelProps) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const initializing = props.status.setupRequired;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    await (initializing ? props.onInitializeAdmin(username, password) : props.onLogin(username, password))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "\u8ba4\u8bc1\u5931\u8d25"))
      .finally(() => setSubmitting(false));
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div>
          <h1>MYusic</h1>
          <p>{initializing ? "初始化管理员" : "登录控制台"}</p>
        </div>

        {error && <div className="error">{error}</div>}

        <Field label="用户名">
          <input
            aria-label="用户名"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
          />
        </Field>

        <Field label="密码">
          <input
            aria-label="密码"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete={initializing ? "new-password" : "current-password"}
          />
        </Field>

        <Button type="submit" disabled={submitting}>
          {submitting ? "处理中..." : initializing ? "初始化并登录" : "登录"}
        </Button>
      </form>
    </main>
  );
}
