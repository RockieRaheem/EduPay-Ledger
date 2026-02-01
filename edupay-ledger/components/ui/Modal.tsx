"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
  /** Accessible description for screen readers */
  "aria-describedby"?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  className,
  "aria-describedby": ariaDescribedBy,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2)}`);

  // Handle escape key and focus trap
  useEffect(() => {
    if (!isOpen) return;

    // Store current focus
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the modal
    const timer = setTimeout(() => {
      modalRef.current?.focus();
    }, 0);

    // Handle escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }

      // Focus trap
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements =
          modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Prevent body scroll
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";

      // Restore focus
      previousActiveElement.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    full: "max-w-4xl",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId.current : undefined}
      aria-describedby={ariaDescribedBy}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={cn(
          "relative w-full bg-white dark:bg-slate-900 rounded-xl shadow-2xl focus:outline-none max-h-[90vh] flex flex-col",
          sizes[size],
          className,
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
            <h2
              id={titleId.current}
              className="text-lg font-bold text-primary dark:text-white"
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>
        )}

        {/* Body with scroll */}
        <div className="p-6 overflow-y-auto overflow-x-hidden flex-1 scroll-smooth">
          {children}
        </div>
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "info",
  loading = false,
}: ConfirmModalProps) {
  const variantStyles = {
    danger: {
      icon: "warning",
      iconBg: "bg-red-100 text-red-600",
      button: "bg-red-500 hover:bg-red-600",
    },
    warning: {
      icon: "info",
      iconBg: "bg-amber-100 text-amber-600",
      button: "bg-amber-500 hover:bg-amber-600",
    },
    info: {
      icon: "help",
      iconBg: "bg-blue-100 text-blue-600",
      button: "bg-primary hover:bg-primary/90",
    },
  };

  const style = variantStyles[variant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="text-center">
        <div
          className={cn(
            "mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4",
            style.iconBg,
          )}
        >
          <span className="material-symbols-outlined text-2xl">
            {style.icon}
          </span>
        </div>
        <h3 className="text-lg font-bold text-primary dark:text-white mb-2">
          {title}
        </h3>
        <p className="text-gray-500 mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2.5 rounded-lg font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "px-6 py-2.5 rounded-lg font-semibold text-white transition-colors flex items-center gap-2",
              style.button,
              loading && "opacity-50 cursor-not-allowed",
            )}
          >
            {loading && (
              <span className="material-symbols-outlined animate-spin text-lg">
                progress_activity
              </span>
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
