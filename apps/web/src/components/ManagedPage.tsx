import type { ReactNode } from "react";

export function ManagedPage({
  title,
  onBack,
  children
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <main className="managed-page">
      <section className="managed-head">
        <button className="managed-return" type="button" onClick={onBack}>MYusic</button>
        <h1>{title}</h1>
      </section>
      {children}
    </main>
  );
}
