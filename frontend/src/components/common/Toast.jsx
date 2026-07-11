import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Minimal event-driven toast. Anything can call showToast("message") — no
 * context wiring needed. Replaces blocking alert() calls, which freeze the
 * WebView and break D-pad flow on TV.
 */
const TOAST_EVENT = "app-toast";

export function showToast(message, kind = "error") {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, kind } }));
}

export default function Toast() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let timer;
    const onToast = (e) => {
      setToast({ ...e.detail, id: Date.now() });
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 3500);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      clearTimeout(timer);
    };
  }, []);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.18 }}
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: toast.kind === "success" ? "rgba(29,185,84,0.95)" : "rgba(30,30,30,0.97)",
            border: toast.kind === "error" ? "1px solid rgba(229,9,20,0.6)" : "1px solid rgba(255,255,255,0.12)",
            color: "#fff",
            padding: "10px 18px",
            borderRadius: 10,
            fontSize: 14,
            maxWidth: "86vw",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            pointerEvents: "none",
          }}
        >
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
