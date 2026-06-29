import { useEffect } from "react";
import type { ReactNode } from "react";

export type ComputerView = "agent" | "collect" | "ingestions" | "settings";

interface ComputerPageProps {
  active: boolean;
  activeView: ComputerView;
  children: ReactNode;
  onNavigate: (view: ComputerView) => void;
  onExitToRoom: () => void;
}

const computerNavItems: Array<{ view: ComputerView; label: string }> = [
  { view: "collect", label: "收集" },
  { view: "agent", label: "问答" },
  { view: "ingestions", label: "入库" },
  { view: "settings", label: "设置" }
];

export function ComputerPage({ active, activeView, children, onNavigate, onExitToRoom }: ComputerPageProps) {
  useEffect(() => {
    if (!active) return;

    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExitToRoom();
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [active, onExitToRoom]);

  return (
    <main className={`computer-page ${!active ? "is-inactive" : ""}`} aria-hidden={!active}>
      <div className="computer-workbench">
        <section className="computer-terminal-shell" aria-label="Monitor">
          <div className="computer-monitor">
            <div className="computer-bezel">
              <div className="computer-screen">
                <div className="computer-screen-inner">
                  <nav className="computer-nav" aria-label="Computer functions">
                    {computerNavItems.map((item) => (
                      <button
                        className={activeView === item.view ? "active" : ""}
                        key={item.view}
                        type="button"
                        onClick={() => onNavigate(item.view)}
                      >
                        {item.label}
                      </button>
                    ))}
                    <button className="computer-back-button" type="button" onClick={onExitToRoom}>
                      返回
                    </button>
                  </nav>
                  <div className="computer-crt-content">
                    {children}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
