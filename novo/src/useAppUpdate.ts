import { useEffect, useState } from "react";
import release from "../public/version.json";

/** Verifica a versão publicada de verdade. Atualiza somente após uma pausa,
 * sem modal, campo em edição ou chamada não salva. Não usa service worker. */
export function useAppUpdate() {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let stopped = false;
    let newer = false;
    let lastAction = Date.now();
    const activity = () => {
      lastAction = Date.now();
    };
    const check = async () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const next = await response.json();
        if (!stopped && next.build && next.build !== release.build) {
          newer = true;
          setPending(true);
        }
      } catch {
        /* Rede indisponível: mantém a sessão aberta. */
      }
    };
    const apply = () => {
      if (
        !newer ||
        document.visibilityState !== "visible" ||
        Date.now() - lastAction < 15000
      )
        return;
      const editing = document.querySelector(
        'dialog[open], [data-unsaved="true"]',
      );
      const field = document.activeElement?.matches(
        'input,select,textarea,[contenteditable="true"]',
      );
      if (!editing && !field) location.reload();
    };
    const visible = () => {
      if (document.visibilityState === "visible") {
        lastAction = Date.now();
        void check();
      }
    };
    window.addEventListener("pointerdown", activity, { passive: true });
    window.addEventListener("keydown", activity);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", check);
    const timer = setInterval(check, 60000),
      idle = setInterval(apply, 2000);
    void check();
    return () => {
      stopped = true;
      clearInterval(timer);
      clearInterval(idle);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", check);
    };
  }, []);
  return pending;
}
