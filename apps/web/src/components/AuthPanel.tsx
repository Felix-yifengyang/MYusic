import { FormEvent, useState } from "react";
import type { AuthStatus } from "@myusic/shared";

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

        <label>
          <span>用户名</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>

        <label>
          <span>密码</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete={initializing ? "new-password" : "current-password"}
          />
        </label>

        <button className="button" type="submit" disabled={submitting}>
          {submitting ? "处理中..." : initializing ? "初始化并登录" : "登录"}
        </button>
      </form>
    </main>
  );
}
