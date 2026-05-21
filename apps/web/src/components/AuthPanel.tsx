import { FormEvent, useState } from "react";
import type { AuthStatus } from "@myusic/shared";

export interface AuthPanelProps {
  status: AuthStatus;
  onSetup: (username: string, password: string) => Promise<void>;
  onLogin: (username: string, password: string) => Promise<void>;
}

export function AuthPanel(props: AuthPanelProps) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const mode = props.status.setupRequired ? "setup" : "login";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    await (mode === "setup" ? props.onSetup(username, password) : props.onLogin(username, password))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "\u8ba4\u8bc1\u5931\u8d25"))
      .finally(() => setSubmitting(false));
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div>
          <h1>MYusic</h1>
          <p>{mode === "setup" ? "创建管理员账号" : "登录控制台"}</p>
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
            autoComplete={mode === "setup" ? "new-password" : "current-password"}
          />
        </label>

        <button className="button" type="submit" disabled={submitting}>
          {submitting ? "处理中..." : mode === "setup" ? "创建并登录" : "登录"}
        </button>
      </form>
    </main>
  );
}
