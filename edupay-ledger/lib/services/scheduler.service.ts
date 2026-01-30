/**
 * Scheduled Reminder Service
 *
 * This module handles automatic deadline reminders and overdue alerts.
 * In production, these would be Firebase Cloud Functions running on a schedule.
 *
 * Schedule:
 * - Daily at 8:00 AM: Check for upcoming deadlines (7 days, 3 days)
 * - Daily at 8:00 AM: Check for newly overdue installments
 * - Weekly: Send summary to school admins
 */

import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db, initializeFirebase, COLLECTIONS } from "@/lib/firebase";
import { Student } from "@/types/student";
import {
  sendDeadlineReminderSMS,
  sendOverdueAlertSMS,
} from "./notification.service";
import { updateInstallmentDeadlineStatus } from "./student.service";

interface ReminderResult {
  studentsProcessed: number;
  remindersSent: number;
  errors: number;
}

/**
 * Gets the number of days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((date2.getTime() - date1.getTime()) / oneDay);
}

/**
 * Processes deadline reminders for a school
 * Should be called daily via Cloud Functions scheduler
 */
export async function processDeadlineReminders(
  schoolId: string,
): Promise<ReminderResult> {
  initializeFirebase();

  const result: ReminderResult = {
    studentsProcessed: 0,
    remindersSent: 0,
    errors: 0,
  };

  try {
    // Get all active students with outstanding balances
    const studentsQuery = query(
      collection(db, COLLECTIONS.STUDENTS),
      where("schoolId", "==", schoolId),
      where("status", "==", "active"),
      where("balance", ">", 0),
    );

    const snapshot = await getDocs(studentsQuery);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const doc of snapshot.docs) {
      const student = { id: doc.id, ...doc.data() } as Student;
      result.studentsProcessed++;

      // Check each incomplete installment
      for (const installment of student.installmentProgress || []) {
        if (installment.status === "completed") continue;

        const deadline = installment.deadline.toDate();
        const daysUntil = daysBetween(today, deadline);
        const amountDue = installment.amountDue - installment.amountPaid;

        // Only send reminders at specific intervals
        const shouldRemind =
          daysUntil === 7 || daysUntil === 3 || daysUntil === 0;

        if (shouldRemind && student.guardian?.phone) {
          try {
            await sendDeadlineReminderSMS({
              phoneNumber: student.guardian.phone,
              studentName: `${student.firstName} ${student.lastName}`,
              installmentName: installment.installmentName,
              amountDue,
              deadline,
              daysUntilDeadline: daysUntil,
            });
            result.remindersSent++;
          } catch (error) {
            console.error(
              `Failed to send reminder for student ${student.id}:`,
              error,
            );
            result.errors++;
          }
        }
      }
    }

    return result;
  } catch (error) {
    console.error("Failed to process deadline reminders:", error);
    throw error;
  }
}

/**
 * Processes overdue alerts and updates student status
 * Should be called daily via Cloud Functions scheduler
 */
export async function processOverdueAlerts(
  schoolId: string,
): Promise<ReminderResult> {
  initializeFirebase();

  const result: ReminderResult = {
    studentsProcessed: 0,
    remindersSent: 0,
    errors: 0,
  };

  try {
    // Get all active students
    const studentsQuery = query(
      collection(db, COLLECTIONS.STUDENTS),
      where("schoolId", "==", schoolId),
      where("status", "==", "active"),
      where("balance", ">", 0),
    );

    const snapshot = await getDocs(studentsQuery);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const doc of snapshot.docs) {
      const student = { id: doc.id, ...doc.data() } as Student;
      result.studentsProcessed++;

      // Update installment status in database
      await updateInstallmentDeadlineStatus(student.id);

      // Check for newly overdue installments
      for (const installment of student.installmentProgress || []) {
        if (installment.status !== "overdue") continue;

        const deadline = installment.deadline.toDate();
        const daysOverdue = daysBetween(deadline, today);
        const amountDue = installment.amountDue - installment.amountPaid;

        // Send alerts at specific overdue intervals: 1, 7, 14, 30 days
        const shouldAlert = [1, 7, 14, 30].includes(daysOverdue);

        if (shouldAlert && student.guardian?.phone) {
          try {
            await sendOverdueAlertSMS({
              phoneNumber: student.guardian.phone,
              studentName: `${student.firstName} ${student.lastName}`,
              installmentName: installment.installmentName,
              amountOverdue: amountDue,
              daysOverdue,
            });
            result.remindersSent++;
          } catch (error) {
            console.error(
              `Failed to send overdue alert for student ${student.id}:`,
              error,
            );
            result.errors++;
          }
        }
      }
    }

    return result;
  } catch (error) {
    console.error("Failed to process overdue alerts:", error);
    throw error;
  }
}

/**
 * Gets students with deadlines in the specified number of days
 */
export async function getStudentsWithUpcomingDeadlines(
  schoolId: string,
  daysAhead: number,
): Promise<Student[]> {
  initializeFirebase();

  const studentsQuery = query(
    collection(db, COLLECTIONS.STUDENTS),
    where("schoolId", "==", schoolId),
    where("status", "==", "active"),
    where("balance", ">", 0),
  );

  const snapshot = await getDocs(studentsQuery);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(today);
  targetDate.setDate(targetDate.getDate() + daysAhead);

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Student)
    .filter((student) =>
      (student.installmentProgress || []).some((i) => {
        if (i.status === "completed") return false;
        const deadline = i.deadline.toDate();
        const days = daysBetween(today, deadline);
        return days >= 0 && days <= daysAhead;
      }),
    );
}

/**
 * Gets summary of deadline status for admin dashboard
 */
export async function getDeadlineSummary(schoolId: string): Promise<{
  dueSoon: number; // Within 7 days
  dueToday: number; // Due today
  overdue: number; // Past deadline
  cleared: number; // No outstanding
}> {
  initializeFirebase();

  const studentsQuery = query(
    collection(db, COLLECTIONS.STUDENTS),
    where("schoolId", "==", schoolId),
    where("status", "==", "active"),
  );

  const snapshot = await getDocs(studentsQuery);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let dueSoon = 0;
  let dueToday = 0;
  let overdue = 0;
  let cleared = 0;

  for (const doc of snapshot.docs) {
    const student = doc.data() as Student;

    if (student.balance === 0) {
      cleared++;
      continue;
    }

    // Find the current active installment
    const activeInstallment = (student.installmentProgress || []).find(
      (i) => i.status !== "completed",
    );

    if (!activeInstallment) {
      cleared++;
      continue;
    }

    const deadline = activeInstallment.deadline.toDate();
    const daysUntil = daysBetween(today, deadline);

    if (daysUntil < 0) {
      overdue++;
    } else if (daysUntil === 0) {
      dueToday++;
    } else if (daysUntil <= 7) {
      dueSoon++;
    }
  }

  return { dueSoon, dueToday, overdue, cleared };
}
