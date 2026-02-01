"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  shadow?: boolean;
  onClick?: () => void;
}

export function Card({
  children,
  className,
  padding = "md",
  shadow = true,
  onClick,
}: CardProps) {
  const paddingStyles = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <div
      className={cn(
        "bg-white dark:bg-slate-900 rounded-xl border border-border-light dark:border-slate-800",
        shadow && "shadow-sm",
        paddingStyles[padding],
        onClick && "cursor-pointer",
        className,
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children?: React.ReactNode;
  title?: string;
  className?: string;
  action?: React.ReactNode;
}

export function CardHeader({
  children,
  title,
  className,
  action,
}: CardHeaderProps) {
  return (
    <div className={cn("flex justify-between items-start mb-4", className)}>
      <div>
        {children ||
          (title && (
            <h3 className="text-lg font-bold text-primary dark:text-white">
              {title}
            </h3>
          ))}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
  subtitle?: string;
}

export function CardTitle({ children, className, subtitle }: CardTitleProps) {
  return (
    <div className={className}>
      <h3 className="text-lg font-bold text-primary dark:text-white">
        {children}
      </h3>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn("", className)}>{children}</div>;
}

// Scrollable Card Content - for long content areas
interface ScrollableCardContentProps {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}

export function ScrollableCardContent({
  children,
  className,
  maxHeight = "max-h-96",
}: ScrollableCardContentProps) {
  return (
    <div
      className={cn(
        "overflow-y-auto overflow-x-hidden scroll-smooth",
        maxHeight,
        className,
      )}
    >
      {children}
    </div>
  );
}

// Alias for CardContent
export const CardBody = CardContent;

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div
      className={cn(
        "mt-6 pt-4 border-t border-slate-100 dark:border-slate-800",
        className,
      )}
    >
      {children}
    </div>
  );
}

// Stats Card
interface StatsCardProps {
  title?: string;
  label?: string; // Alias for title
  value: string | number;
  subtitle?: string;
  icon?: string | React.ReactNode;
  iconBg?: string;
  trend?: {
    value: string | number;
    direction?: "up" | "down" | "neutral";
    isPositive?: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  className?: string;
}

export function StatsCard({
  title,
  label,
  value,
  subtitle,
  icon,
  iconBg,
  trend,
  variant = "default",
  className,
}: StatsCardProps) {
  const displayTitle = title || label || "";
  const trendDirection =
    trend?.direction ||
    (trend?.isPositive === true
      ? "up"
      : trend?.isPositive === false
        ? "down"
        : "neutral");
  const variantStyles = {
    default: "",
    primary: "bg-primary/5 dark:bg-primary/10 border-primary/10",
    success: "bg-status-green/5 border-status-green/10",
    warning: "bg-status-yellow/5 border-status-yellow/10",
    danger: "bg-status-red/5 border-status-red/10",
  };

  const trendColors = {
    up: "text-green-600",
    down: "text-red-600",
    neutral: "text-gray-500",
  };

  const trendIcons = {
    up: "trending_up",
    down: "trending_down",
    neutral: "trending_flat",
  };

  return (
    <Card className={cn(variantStyles[variant], className)}>
      <div className="flex justify-between items-start mb-4">
        {icon && (
          <div
            className={cn(
              "p-2 bg-slate-100 dark:bg-slate-800 rounded-lg",
              iconBg,
            )}
          >
            {typeof icon === "string" ? (
              <span className="material-symbols-outlined text-primary dark:text-blue-400">
                {icon}
              </span>
            ) : (
              icon
            )}
          </div>
        )}
        {trend && (
          <div
            className={cn(
              "flex items-center gap-1 text-sm font-bold",
              trendColors[trendDirection],
            )}
          >
            <span className="material-symbols-outlined text-sm">
              {trendIcons[trendDirection]}
            </span>
            <span>{trend.value}</span>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500">{displayTitle}</p>
      <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
        {value}
      </h3>
      {subtitle && <p className="text-xs text-gray-400 mt-2">{subtitle}</p>}
    </Card>
  );
}
