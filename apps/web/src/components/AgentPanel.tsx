import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { chatWithAgent, type AgentChatMessage } from "../api/client";
import { Button, EmptyState } from "./ui";

interface AgentTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const PROMPTS = [
  "推荐 5 首最近适合通勤听的中文歌。",
  "找几首类似《凄美地》的歌。",
  "今天有什么值得听的新歌？"
];

export function AgentPanel({ preview = false }: { preview?: boolean }) {
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;

    const userTurn: AgentTurn = {
      id: createTurnId(),
      role: "user",
      content
    };
    const nextTurns = [...turns, userTurn];
    setTurns(nextTurns);
    setDraft("");
    setError("");

    if (preview) {
      setTurns([
        ...nextTurns,
        {
          id: createTurnId(),
          role: "assistant",
          content: "前端预览模式还没有连接音乐助手。这里保留对话界面，启动完整服务后会发送真实请求。"
        }
      ]);
      inputRef.current?.focus();
      return;
    }

    setSending(true);

    await chatWithAgent(
      nextTurns.map((turn): AgentChatMessage => ({
        role: turn.role,
        content: turn.content
      }))
    )
      .then((body) => {
        setTurns((current) => [
          ...current,
          {
            id: createTurnId(),
            role: "assistant",
            content: body.reply
          }
        ]);
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "音乐助手暂时没有回应。");
      })
      .finally(() => {
        setSending(false);
        inputRef.current?.focus();
      });
  }

  function applyPrompt(prompt: string) {
    setDraft(prompt);
    inputRef.current?.focus();
  }

  return (
    <section className="agent-panel">
      <div className="agent-thread" aria-live="polite">
        {turns.length ? turns.map((turn) => (
          <article className={`agent-bubble ${turn.role}`} key={turn.id}>
            {turn.content.split("\n").map((line, index) => (
              <p key={`${turn.id}:${index}`}>{line || "\u00a0"}</p>
            ))}
          </article>
        )) : (
          <EmptyState>问我歌曲推荐、歌手、歌单或者最近流行趋势。</EmptyState>
        )}
        {sending ? <div className="agent-loading">正在思考...</div> : null}
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="agent-prompts">
        {PROMPTS.map((prompt) => (
          <button type="button" key={prompt} onClick={() => applyPrompt(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      <form className="agent-composer" onSubmit={submit}>
        <textarea
          ref={inputRef}
          aria-label="音乐问题"
          placeholder="问一个音乐问题..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="agent-actions">
          <Button type="submit" disabled={sending || !draft.trim()}>
            {sending ? "发送中" : "发送"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function createTurnId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `turn:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}
