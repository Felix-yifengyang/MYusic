import type { ReactNode } from "react";
import type { AuthStatus } from "@myusic/shared";

export function ManagedPage({
  title,
  subtitle,
  authStatus,
  onBack,
  onLogout,
  children
}: {
  title: string;
  subtitle: string;
  authStatus: AuthStatus;
  onBack: () => void;
  onLogout: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <main className="managed-page">
      <header className="managed-topbar">
        <button className="managed-brand" type="button" onClick={onBack}>MYusic</button>
        <div className="managed-actions">
          {authStatus.user && <span>{authStatus.user.username}</span>}
          <button type="button" onClick={onBack}>播放</button>
          {authStatus.enabled && <button type="button" onClick={() => void onLogout()}>退出</button>}
        </div>
      </header>
      <section className="managed-head">
        <p>{subtitle}</p>
        <h1>{title}</h1>
      </section>
      {children}
    </main>
  );
}
