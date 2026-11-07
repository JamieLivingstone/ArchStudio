import { ExternalLink, Eye, EyeOff, KeyRound, Monitor, Moon, Sun, X } from "lucide-react";
import { useRef, useState } from "react";
import { repository, version } from "../../../package.json";
import { type ModelProvider, providers } from "../../providers";
import { isDesktop } from "../../tauri/providers";
import { Dialog } from "../components/Dialog";
import { IconButton } from "../components/IconButton";
import { Link } from "../components/Link";
import { type Segment, SegmentedControl } from "../components/SegmentedControl";
import { reason } from "../errorReason";
import type { ModelSelection } from "./useModelSelection";
import type { Theme } from "./useTheme";

const themes: Segment<Theme>[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const primaryButton =
  "rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-surface hover:opacity-90 disabled:opacity-35";
const quietButton = "rounded-lg px-2.5 py-1.5 text-xs text-muted hover:bg-hover hover:text-fg";
const BEST_PRACTICES = `${repository}#api-key-best-practices`;
const link = "inline-flex items-center gap-1 font-medium text-accent hover:underline";

// The same test the native layer applies before a key reaches the keychain.
const looksLikeAKey = (text: string) => /^[\x21-\x7e]{20,512}$/.test(text);

function KeyForm({
  provider,
  onSave,
  onCancel,
}: {
  provider: ModelProvider;
  onSave: (key: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [shown, setShown] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = draft.trim();
  const unusual = key && !key.startsWith(provider.keyPrefix);

  async function submit() {
    if (!looksLikeAKey(key)) {
      setError("That does not look like an API key. Paste the whole key, with no spaces.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(key);
      setDraft("");
    } catch (cause) {
      setError(reason(cause));
      field.current?.focus();
      field.current?.select();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center rounded-lg bg-canvas focus-within:ring-1 focus-within:ring-accent">
          <input
            ref={field}
            type={shown ? "text" : "password"}
            aria-label={`${provider.label} API key`}
            placeholder={`${provider.keyPrefix}…`}
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setError("");
            }}
            className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 font-mono text-xs outline-none placeholder:text-muted"
          />
          <IconButton
            label={shown ? "Hide key" : "Show key"}
            icon={shown ? EyeOff : Eye}
            size="sm"
            onClick={() => setShown(!shown)}
          />
        </div>
        <button type="submit" disabled={!key || busy} className={primaryButton}>
          {busy ? "Checking…" : isDesktop() ? "Check and save" : "Check and connect"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={quietButton}>
            Cancel
          </button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-red-500">
          {error}
          {onCancel && " The key you connected before is still the one in use."}
        </p>
      ) : (
        unusual && (
          <p className="text-xs text-muted">
            {provider.label} keys usually start with <span className="font-mono">{provider.keyPrefix}</span>
          </p>
        )
      )}
      <p className="text-xs">
        <Link href={provider.keysUrl} className={link}>
          Get a key
          <ExternalLink size={11} />
        </Link>
      </p>
    </form>
  );
}

function ProviderRow({ provider, modelSelection }: { provider: ModelProvider; modelSelection: ModelSelection }) {
  const connected = modelSelection.connected.includes(provider.id);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState("");

  const attempt = useRef<AbortController | null>(null);
  const connect = async (value: string) => {
    attempt.current = new AbortController();
    await modelSelection.connect(provider.id, value, attempt.current.signal);
    setReplacing(false);
  };
  const cancel = () => {
    attempt.current?.abort();
    setReplacing(false);
  };
  const remove = () => {
    setError("");
    modelSelection.disconnect(provider.id).catch((cause: unknown) => setError(reason(cause)));
  };

  return (
    <section aria-label={provider.label} className="flex flex-col gap-2.5 py-4">
      <div className="flex items-center gap-2">
        <h4 className="font-medium">{provider.label}</h4>
        <span className="flex-1" />
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span className={`size-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-line"}`} />
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>

      {connected && !replacing ? (
        <div className="flex items-center gap-1">
          <p className="flex min-w-0 flex-1 items-center gap-2 truncate rounded-lg bg-canvas px-2.5 py-1.5 text-muted">
            <KeyRound size={13} className="shrink-0" />
            {isDesktop() ? "Key saved in your system keychain" : "Key kept in this tab until you close it"}
          </p>
          <button type="button" onClick={() => setReplacing(true)} className={quietButton}>
            Replace
          </button>
          <button
            type="button"
            onClick={remove}
            className="rounded-lg px-2.5 py-1.5 text-xs text-muted hover:bg-red-500/10 hover:text-red-500"
          >
            Remove
          </button>
        </div>
      ) : (
        <KeyForm provider={provider} onSave={connect} onCancel={replacing ? cancel : undefined} />
      )}
      {error && (
        <p role="alert" className="text-xs text-red-500">
          {error}
        </p>
      )}
    </section>
  );
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  modelSelection: ModelSelection;
}

export function SettingsDialog({ open, onClose, theme, onThemeChange, modelSelection }: SettingsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="settings-title" className="w-120">
      <header className="flex items-center border-b border-line py-2 pr-2 pl-5">
        <h2 id="settings-title" className="font-medium">
          Settings
        </h2>
        <span className="ml-2 flex-1 text-xs text-muted">Version {version}</span>
        <IconButton label="Close settings" icon={X} size="sm" onClick={onClose} />
      </header>

      <div className="max-h-[70vh] overflow-y-auto px-5 pt-4 pb-5">
        <h3 className="text-base font-medium">Appearance</h3>
        <div className="mt-2 mb-6">
          <SegmentedControl segments={themes} value={theme} onChange={onThemeChange} />
        </div>

        <h3 className="text-base font-medium">Models</h3>
        <p className="text-muted">Connect the providers the AI Assistant can use.</p>
        <div className="mt-1 divide-y divide-line">
          {providers.map((provider) => (
            <ProviderRow key={provider.id} provider={provider} modelSelection={modelSelection} />
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">
          {isDesktop()
            ? "Your diagram and key only go to the provider you use. Keys are kept in your system keychain."
            : "Your diagram and key only go to the provider you use. Keys stay in this tab until you close it."}{" "}
          <Link href={BEST_PRACTICES} className={link}>
            Key best practices
            <ExternalLink size={11} />
          </Link>
        </p>
      </div>
    </Dialog>
  );
}
