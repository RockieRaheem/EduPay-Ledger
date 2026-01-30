"use client";

import { useState, useCallback } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db, initializeFirebase, COLLECTIONS } from "@/lib/firebase";
import { InstallmentRule, FeeStructure } from "@/types";
import { Student, InstallmentProgress } from "@/types/student";

interface InstallmentValidation {
  isValid: boolean;
  canPay: boolean;
  message: string;
  currentInstallment: InstallmentProgress | null;
  nextInstallment: InstallmentProgress | null;
}

export function useInstallments() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Validates if a payment can be made for a student's installment
   * Rules:
   * - Cannot start next installment until current is complete
   * - Can pay early
   * - Can pay full amount upfront
   * - Partial payments allowed within an installment
   */
  const validateInstallmentPayment = useCallback(
    async (
      studentId: string,
      amount: number,
    ): Promise<InstallmentValidation> => {
      setLoading(true);
      setError(null);

      try {
        initializeFirebase();

        // Get student data
        const studentDoc = await getDoc(
          doc(db, COLLECTIONS.STUDENTS, studentId),
        );

        if (!studentDoc.exists()) {
          return {
            isValid: false,
            canPay: false,
            message: "Student not found",
            currentInstallment: null,
            nextInstallment: null,
          };
        }

        const student = { id: studentDoc.id, ...studentDoc.data() } as Student;

        // If balance is 0, no payment needed
        if (student.balance <= 0) {
          return {
            isValid: false,
            canPay: false,
            message: "Student has no outstanding balance",
            currentInstallment: null,
            nextInstallment: null,
          };
        }

        // Check if amount exceeds balance
        if (amount > student.balance) {
          return {
            isValid: false,
            canPay: false,
            message: `Amount (${amount.toLocaleString()}) exceeds outstanding balance (${student.balance.toLocaleString()})`,
            currentInstallment: null,
            nextInstallment: null,
          };
        }

        // Find current and next installments
        const installments = (student.installmentProgress || []).sort(
          (a, b) => a.installmentOrder - b.installmentOrder,
        );

        let currentInstallment: InstallmentProgress | null = null;
        let nextInstallment: InstallmentProgress | null = null;

        for (const inst of installments) {
          if (inst.status !== "completed") {
            if (!currentInstallment) {
              currentInstallment = inst;
            } else if (!nextInstallment) {
              nextInstallment = inst;
              break;
            }
          }
        }

        // If paying full amount upfront, always valid
        if (amount === student.balance) {
          return {
            isValid: true,
            canPay: true,
            message: "Full payment - all installments will be cleared",
            currentInstallment,
            nextInstallment,
          };
        }

        // Check if current installment is unlocked
        if (currentInstallment && !currentInstallment.isUnlocked) {
          return {
            isValid: false,
            canPay: false,
            message: "Current installment is not yet unlocked",
            currentInstallment,
            nextInstallment,
          };
        }

        // Payment within current installment is valid
        if (currentInstallment) {
          const remainingInInstallment =
            currentInstallment.amountDue - currentInstallment.amountPaid;

          if (amount <= remainingInInstallment) {
            return {
              isValid: true,
              canPay: true,
              message: `Payment towards ${currentInstallment.installmentName}`,
              currentInstallment,
              nextInstallment,
            };
          } else {
            // Amount exceeds current installment - check if it's early payment
            const wouldCompleteCurrentAmount = remainingInInstallment;
            const overage = amount - wouldCompleteCurrentAmount;

            if (nextInstallment) {
              return {
                isValid: true,
                canPay: true,
                message: `This payment will complete ${currentInstallment.installmentName} and apply ${overage.toLocaleString()} to ${nextInstallment.installmentName}`,
                currentInstallment,
                nextInstallment,
              };
            } else {
              return {
                isValid: true,
                canPay: true,
                message: `Payment will complete all remaining fees`,
                currentInstallment,
                nextInstallment,
              };
            }
          }
        }

        return {
          isValid: true,
          canPay: true,
          message: "Payment is valid",
          currentInstallment,
          nextInstallment,
        };
      } catch (err: any) {
        setError(err.message);
        return {
          isValid: false,
          canPay: false,
          message: err.message,
          currentInstallment: null,
          nextInstallment: null,
        };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Gets installment rules for a fee structure
   */
  const getInstallmentRules = useCallback(
    async (feeStructureId: string): Promise<InstallmentRule[]> => {
      setLoading(true);
      setError(null);

      try {
        initializeFirebase();

        const feeStructureDoc = await getDoc(
          doc(db, COLLECTIONS.FEE_STRUCTURES, feeStructureId),
        );

        if (!feeStructureDoc.exists()) {
          throw new Error("Fee structure not found");
        }

        const feeStructure = feeStructureDoc.data() as FeeStructure;
        return feeStructure.installmentRules.sort((a, b) => a.order - b.order);
      } catch (err: any) {
        setError(err.message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Calculates the breakdown of how a payment will be applied across installments
   */
  const calculatePaymentBreakdown = useCallback(
    (student: Student, amount: number) => {
      const breakdown: Array<{
        installmentId: string;
        installmentName: string;
        amountApplied: number;
        willComplete: boolean;
      }> = [];

      let remainingAmount = amount;
      const sortedInstallments = [...(student.installmentProgress || [])].sort(
        (a, b) => a.installmentOrder - b.installmentOrder,
      );

      for (const installment of sortedInstallments) {
        if (remainingAmount <= 0) break;
        if (installment.status === "completed") continue;

        const outstandingInInstallment =
          installment.amountDue - installment.amountPaid;
        const amountToApply = Math.min(
          remainingAmount,
          outstandingInInstallment,
        );

        if (amountToApply > 0) {
          breakdown.push({
            installmentId: installment.installmentId,
            installmentName: installment.installmentName,
            amountApplied: amountToApply,
            willComplete: amountToApply >= outstandingInInstallment,
          });
          remainingAmount -= amountToApply;
        }
      }

      return breakdown;
    },
    [],
  );

  return {
    loading,
    error,
    validateInstallmentPayment,
    getInstallmentRules,
    calculatePaymentBreakdown,
  };
}
