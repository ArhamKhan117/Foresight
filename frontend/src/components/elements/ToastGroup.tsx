"use client";
import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { FiCheckCircle, FiAlertCircle, FiAlertTriangle, FiInfo, FiX, FiExternalLink } from "react-icons/fi";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
  createdAt: number;
  txHash?: string;
}

interface ToastOptions {
  txHash?: string;
  duration?: number;
}

let toastId = 0;
let listeners: Array<() => void> = [];
let toasts: Toast[] = [];

const HASHSCAN_BASE = "https://hashscan.io/testnet/transaction/";

const addToast = (type: ToastType, message: string, opts?: ToastOptions) => {
  const duration = opts?.duration ?? (type === "error" ? 4500 : 3500);
  toasts = [...toasts, { id: ++toastId, type, message, duration, createdAt: Date.now(), txHash: opts?.txHash }];
  listeners.forEach((l) => l());
};

const removeToast = (id: number) => {
  toasts = toasts.filter((t) => t.id !== id);
  listeners.forEach((l) => l());
};

const subscribe = (listener: () => void) => {
  listeners.push(listener);
  return () => { listeners = listeners.filter((l) => l !== listener); };
};

export const errorAlert = (text: string, opts?: ToastOptions) => addToast("error", text, { duration: 4500, ...opts });
export const errorAlertCenter = (text: string, opts?: ToastOptions) => addToast("error", text, { duration: 6000, ...opts });
export const warningAlert = (text: string, opts?: ToastOptions) => addToast("warning", text, { duration: 3500, ...opts });
export const successAlert = (text: string, opts?: ToastOptions) => addToast("success", text, { duration: 3500, ...opts });
export const infoAlert = (text: string, opts?: ToastOptions) => addToast("info", text, { duration: 3000, ...opts });

const barColors: Record<ToastType, string> = {
  success: "#3fd145",
  error: "#ff6464",
  warning: "#ffd600",
  info: "#07b3ff",
};

const icons: Record<ToastType, React.ElementType> = {
  success: FiCheckCircle,
  error: FiAlertCircle,
  warning: FiAlertTriangle,
  info: FiInfo,
};

const ToastItem: React.FC<{ toast: Toast; onClose: (id: number) => void }> = ({ toast: t, onClose }) => {
  const [progress, setProgress] = useState(100);
  const [exiting, setExiting] = useState(false);
  const Icon = icons[t.type];
  const barColor = barColors[t.type];

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / t.duration) * 100);
      setProgress(remaining);
      if (remaining > 0) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    const timeout = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onClose(t.id), 350);
    }, t.duration);
    return () => { cancelAnimationFrame(raf); clearTimeout(timeout); };
  }, [t.duration, t.id, onClose]);

  const handleClose = () => {
    setExiting(true);
    setTimeout(() => onClose(t.id), 350);
  };

  return (
    <div
      className={`relative w-[420px] max-w-[calc(100vw-32px)] rounded-2xl bg-[#111111] border border-[#2a2a2a] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-350 ease-out ${exiting ? "opacity-0 translate-x-12 scale-95" : "opacity-100 translate-x-0 scale-100"}`}
      style={{ animation: exiting ? undefined : "toastSlideIn 0.35s cubic-bezier(0.16,1,0.3,1)" }}
    >
      <div className="flex items-start gap-3.5 px-5 py-4">
        <Icon className="text-white/60 mt-0.5 flex-shrink-0" size={22} />
        <div className="flex-1 min-w-0">
          <p className="text-white text-[15px] font-medium font-satoshi leading-relaxed">{t.message}</p>
          {t.txHash && (
            <a
              href={`${HASHSCAN_BASE}${t.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-[13px] font-medium font-satoshi text-white/40 hover:text-white/70 transition-colors"
            >
              View txn <FiExternalLink size={12} />
            </a>
          )}
        </div>
        <button onClick={handleClose} className="text-white/20 hover:text-white/60 transition-colors flex-shrink-0 mt-0.5 cursor-pointer">
          <FiX size={18} />
        </button>
      </div>
      {/* Progress bar — only color element */}
      <div className="h-[3px] w-full bg-white/5">
        <div
          className="h-full rounded-full"
          style={{
            width: `${progress}%`,
            backgroundColor: barColor,
            transition: "width 50ms linear",
          }}
        />
      </div>
    </div>
  );
};

export const CustomToastContainer: React.FC = () => {
  const [, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);

  const handleClose = useCallback((id: number) => removeToast(id), []);

  if (!mounted) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(50px) scale(0.95); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onClose={handleClose} />
          </div>
        ))}
      </div>
    </>,
    document.body
  );
};
