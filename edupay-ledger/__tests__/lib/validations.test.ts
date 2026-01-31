/**
 * Validation Schemas Tests
 * 
 * Tests for Zod validation schemas used throughout EduPay Ledger
 * Ensures data integrity for Ugandan school fee management
 */

import {
  phoneNumberSchema,
  emailSchema,
  amountSchema,
  positiveAmountSchema,
  dateRangeSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  newPasswordSchema,
  studentSchema,
  studentSearchSchema,
  paymentMethodSchema,
  mobileMoneyProviderSchema,
  paymentSchema,
  bulkPaymentRowSchema,
  bulkPaymentImportSchema,
  feeCategorySchema,
  feeStructureSchema,
  installmentRuleSchema,
  promiseToPaySchema,
  schoolOnboardingSchema,
  academicYearSchema,
  termSchema,
  classSchema,
  streamSchema,
  userSchema,
  reportFilterSchema,
  scheduledReportSchema,
  notificationSettingsSchema,
  systemSettingsSchema,
} from "@/lib/validations";

// ============================================================================
// PHONE NUMBER VALIDATION TESTS (Uganda)
// ============================================================================

describe("phoneNumberSchema", () => {
  describe("valid Ugandan phone numbers", () => {
    test("should accept MTN format 077xxxxxxx", () => {
      expect(phoneNumberSchema.safeParse("0771234567").success).toBe(true);
      expect(phoneNumberSchema.safeParse("0772345678").success).toBe(true);
      expect(phoneNumberSchema.safeParse("0773456789").success).toBe(true);
      expect(phoneNumberSchema.safeParse("0774567890").success).toBe(true);
      expect(phoneNumberSchema.safeParse("0775678901").success).toBe(true);
      expect(phoneNumberSchema.safeParse("0776789012").success).toBe(true);
      expect(phoneNumberSchema.safeParse("0778901234").success).toBe(true);
    });

    test("should accept Airtel format 070xxxxxxx and 075xxxxxxx", () => {
      expect(phoneNumberSchema.safeParse("0701234567").success).toBe(true);
      expect(phoneNumberSchema.safeParse("0702345678").success).toBe(true);
      expect(phoneNumberSchema.safeParse("0751234567").success).toBe(true);
    });

    test("should accept Africell format 079xxxxxxx", () => {
      expect(phoneNumberSchema.safeParse("0791234567").success).toBe(true);
    });

    test("should accept +256 international format", () => {
      expect(phoneNumberSchema.safeParse("+256771234567").success).toBe(true);
      expect(phoneNumberSchema.safeParse("+256701234567").success).toBe(true);
      expect(phoneNumberSchema.safeParse("+256791234567").success).toBe(true);
    });

    test("should accept 03x landline format", () => {
      expect(phoneNumberSchema.safeParse("0312345678").success).toBe(true);
      expect(phoneNumberSchema.safeParse("0392345678").success).toBe(true);
    });
  });

  describe("invalid phone numbers", () => {
    test("should reject numbers with wrong length", () => {
      expect(phoneNumberSchema.safeParse("077123456").success).toBe(false); // 9 digits
      expect(phoneNumberSchema.safeParse("07712345678").success).toBe(false); // 11 digits
    });

    test("should reject numbers with invalid prefix", () => {
      expect(phoneNumberSchema.safeParse("0811234567").success).toBe(false);
      expect(phoneNumberSchema.safeParse("0611234567").success).toBe(false);
    });

    test("should reject international formats without +256", () => {
      expect(phoneNumberSchema.safeParse("256771234567").success).toBe(false);
      expect(phoneNumberSchema.safeParse("+254771234567").success).toBe(false); // Kenya
    });

    test("should reject non-numeric characters", () => {
      expect(phoneNumberSchema.safeParse("077-123-4567").success).toBe(false);
      expect(phoneNumberSchema.safeParse("077 123 4567").success).toBe(false);
    });
  });
});

// ============================================================================
// EMAIL VALIDATION TESTS
// ============================================================================

describe("emailSchema", () => {
  describe("valid emails", () => {
    test("should accept standard email formats", () => {
      expect(emailSchema.safeParse("user@example.com").success).toBe(true);
      expect(emailSchema.safeParse("bursar@school.ac.ug").success).toBe(true);
      expect(emailSchema.safeParse("admin@edupay.co.ug").success).toBe(true);
    });

    test("should accept emails with subdomains", () => {
      expect(emailSchema.safeParse("user@mail.school.ac.ug").success).toBe(true);
    });

    test("should accept emails with numbers", () => {
      expect(emailSchema.safeParse("user123@school.com").success).toBe(true);
    });

    test("should accept emails with dots and plus", () => {
      expect(emailSchema.safeParse("first.last@school.com").success).toBe(true);
    });
  });

  describe("invalid emails", () => {
    test("should reject emails without @", () => {
      expect(emailSchema.safeParse("userexample.com").success).toBe(false);
    });

    test("should reject emails without domain", () => {
      expect(emailSchema.safeParse("user@").success).toBe(false);
    });

    test("should reject emails too short", () => {
      expect(emailSchema.safeParse("a@b").success).toBe(false);
    });

    test("should reject emails too long", () => {
      const longEmail = "a".repeat(90) + "@example.com";
      expect(emailSchema.safeParse(longEmail).success).toBe(false);
    });
  });
});

// ============================================================================
// AMOUNT VALIDATION TESTS (UGX Currency)
// ============================================================================

describe("amountSchema", () => {
  describe("valid UGX amounts", () => {
    test("should accept zero", () => {
      expect(amountSchema.safeParse(0).success).toBe(true);
    });

    test("should accept typical school fee amounts", () => {
      expect(amountSchema.safeParse(500000).success).toBe(true); // 500K UGX
      expect(amountSchema.safeParse(750000).success).toBe(true); // 750K UGX
      expect(amountSchema.safeParse(1000000).success).toBe(true); // 1M UGX
      expect(amountSchema.safeParse(1500000).success).toBe(true); // 1.5M UGX
      expect(amountSchema.safeParse(2500000).success).toBe(true); // 2.5M UGX
    });

    test("should accept maximum amount (100M UGX)", () => {
      expect(amountSchema.safeParse(100000000).success).toBe(true);
    });
  });

  describe("invalid amounts", () => {
    test("should reject negative amounts", () => {
      expect(amountSchema.safeParse(-1).success).toBe(false);
      expect(amountSchema.safeParse(-500000).success).toBe(false);
    });

    test("should reject amounts exceeding maximum", () => {
      expect(amountSchema.safeParse(100000001).success).toBe(false);
      expect(amountSchema.safeParse(1000000000).success).toBe(false);
    });
  });
});

describe("positiveAmountSchema", () => {
  test("should reject zero", () => {
    expect(positiveAmountSchema.safeParse(0).success).toBe(false);
  });

  test("should accept minimum of 1 UGX", () => {
    expect(positiveAmountSchema.safeParse(1).success).toBe(true);
  });

  test("should accept typical payment amounts", () => {
    expect(positiveAmountSchema.safeParse(10000).success).toBe(true);
    expect(positiveAmountSchema.safeParse(500000).success).toBe(true);
  });
});

// ============================================================================
// DATE RANGE VALIDATION TESTS
// ============================================================================

describe("dateRangeSchema", () => {
  test("should accept valid date range", () => {
    const validRange = {
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-03-31"),
    };
    expect(dateRangeSchema.safeParse(validRange).success).toBe(true);
  });

  test("should accept same day range", () => {
    const sameDay = {
      startDate: new Date("2024-01-15"),
      endDate: new Date("2024-01-15"),
    };
    expect(dateRangeSchema.safeParse(sameDay).success).toBe(true);
  });

  test("should reject end date before start date", () => {
    const invalidRange = {
      startDate: new Date("2024-03-31"),
      endDate: new Date("2024-01-01"),
    };
    const result = dateRangeSchema.safeParse(invalidRange);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// LOGIN SCHEMA TESTS
// ============================================================================

describe("loginSchema", () => {
  test("should accept valid login credentials", () => {
    const validLogin = {
      email: "bursar@school.ac.ug",
      password: "SecurePass123",
      rememberMe: true,
    };
    expect(loginSchema.safeParse(validLogin).success).toBe(true);
  });

  test("should accept login without rememberMe", () => {
    const validLogin = {
      email: "admin@school.com",
      password: "Password123",
    };
    expect(loginSchema.safeParse(validLogin).success).toBe(true);
  });

  test("should reject short password", () => {
    const invalidLogin = {
      email: "user@school.com",
      password: "short",
    };
    expect(loginSchema.safeParse(invalidLogin).success).toBe(false);
  });

  test("should reject invalid email", () => {
    const invalidLogin = {
      email: "notanemail",
      password: "Password123",
    };
    expect(loginSchema.safeParse(invalidLogin).success).toBe(false);
  });
});

// ============================================================================
// REGISTER SCHEMA TESTS
// ============================================================================

describe("registerSchema", () => {
  const validRegistration = {
    email: "newuser@school.ac.ug",
    password: "SecurePass123",
    confirmPassword: "SecurePass123",
    firstName: "John",
    lastName: "Mukasa",
    acceptTerms: true as const,
  };

  test("should accept valid registration", () => {
    expect(registerSchema.safeParse(validRegistration).success).toBe(true);
  });

  test("should reject mismatched passwords", () => {
    const invalid = {
      ...validRegistration,
      confirmPassword: "DifferentPass123",
    };
    expect(registerSchema.safeParse(invalid).success).toBe(false);
  });

  test("should reject weak password (no uppercase)", () => {
    const invalid = {
      ...validRegistration,
      password: "lowercase123",
      confirmPassword: "lowercase123",
    };
    expect(registerSchema.safeParse(invalid).success).toBe(false);
  });

  test("should reject weak password (no number)", () => {
    const invalid = {
      ...validRegistration,
      password: "NoNumbersHere",
      confirmPassword: "NoNumbersHere",
    };
    expect(registerSchema.safeParse(invalid).success).toBe(false);
  });

  test("should reject without accepting terms", () => {
    const invalid = {
      email: "user@school.com",
      password: "Password123",
      confirmPassword: "Password123",
      firstName: "John",
      lastName: "Doe",
      // Missing acceptTerms
    };
    expect(registerSchema.safeParse(invalid).success).toBe(false);
  });
});

// ============================================================================
// STUDENT SCHEMA TESTS
// ============================================================================

describe("studentSchema", () => {
  const validStudent = {
    firstName: "Nakato",
    lastName: "Kisakye",
    dateOfBirth: new Date("2010-05-15"),
    gender: "female" as const,
    classId: "class-001",
    admissionNumber: "ADM-2024-001",
    admissionDate: new Date("2024-01-15"),
    status: "active" as const,
    residenceStatus: "day" as const,
    guardianName: "Wasswa Kisakye",
    guardianRelationship: "parent" as const,
    guardianPhone: "0771234567",
  };

  test("should accept valid student data", () => {
    expect(studentSchema.safeParse(validStudent).success).toBe(true);
  });

  test("should accept student with middle name", () => {
    const withMiddle = { ...validStudent, middleName: "Babirye" };
    expect(studentSchema.safeParse(withMiddle).success).toBe(true);
  });

  test("should accept boarding student", () => {
    const boarding = { ...validStudent, residenceStatus: "boarding" as const };
    expect(studentSchema.safeParse(boarding).success).toBe(true);
  });

  test("should reject future date of birth", () => {
    const future = { ...validStudent, dateOfBirth: new Date("2030-01-01") };
    expect(studentSchema.safeParse(future).success).toBe(false);
  });

  test("should reject invalid gender", () => {
    const invalid = { ...validStudent, gender: "unknown" };
    expect(studentSchema.safeParse(invalid).success).toBe(false);
  });

  test("should reject short first name", () => {
    const invalid = { ...validStudent, firstName: "N" };
    expect(studentSchema.safeParse(invalid).success).toBe(false);
  });

  test("should accept all guardian relationships", () => {
    const relationships = ["parent", "guardian", "relative", "sponsor"] as const;
    relationships.forEach((rel) => {
      const student = { ...validStudent, guardianRelationship: rel };
      expect(studentSchema.safeParse(student).success).toBe(true);
    });
  });

  test("should accept optional guardian email", () => {
    const withEmail = { ...validStudent, guardianEmail: "guardian@email.com" };
    expect(studentSchema.safeParse(withEmail).success).toBe(true);
  });

  test("should accept empty guardian email", () => {
    const emptyEmail = { ...validStudent, guardianEmail: "" };
    expect(studentSchema.safeParse(emptyEmail).success).toBe(true);
  });
});

// ============================================================================
// PAYMENT SCHEMA TESTS
// ============================================================================

describe("paymentSchema", () => {
  const validCashPayment = {
    studentId: "student-001",
    amount: 500000,
    paymentMethod: "cash" as const,
    feeCategoryId: "fee-001",
    termId: "term-001",
    payerName: "Wasswa Kisakye",
  };

  test("should accept valid cash payment", () => {
    expect(paymentSchema.safeParse(validCashPayment).success).toBe(true);
  });

  test("should accept valid mobile money payment", () => {
    const mobilePayment = {
      ...validCashPayment,
      paymentMethod: "mobile_money" as const,
      mobileMoneyProvider: "mtn" as const,
      mobileMoneyNumber: "0771234567",
    };
    expect(paymentSchema.safeParse(mobilePayment).success).toBe(true);
  });

  test("should reject mobile money without provider", () => {
    const invalid = {
      ...validCashPayment,
      paymentMethod: "mobile_money" as const,
      mobileMoneyNumber: "0771234567",
      // Missing mobileMoneyProvider
    };
    expect(paymentSchema.safeParse(invalid).success).toBe(false);
  });

  test("should reject mobile money without number", () => {
    const invalid = {
      ...validCashPayment,
      paymentMethod: "mobile_money" as const,
      mobileMoneyProvider: "mtn" as const,
      // Missing mobileMoneyNumber
    };
    expect(paymentSchema.safeParse(invalid).success).toBe(false);
  });

  test("should accept valid bank transfer", () => {
    const bankPayment = {
      ...validCashPayment,
      paymentMethod: "bank_transfer" as const,
      bankName: "Stanbic Bank",
      transactionReference: "TXN123456",
    };
    expect(paymentSchema.safeParse(bankPayment).success).toBe(true);
  });

  test("should reject bank transfer without bank name", () => {
    const invalid = {
      ...validCashPayment,
      paymentMethod: "bank_transfer" as const,
      // Missing bankName
    };
    expect(paymentSchema.safeParse(invalid).success).toBe(false);
  });

  test("should accept valid cheque payment", () => {
    const chequePayment = {
      ...validCashPayment,
      paymentMethod: "cheque" as const,
      chequeNumber: "CHQ001234",
      chequeDate: new Date("2024-01-20"),
    };
    expect(paymentSchema.safeParse(chequePayment).success).toBe(true);
  });

  test("should reject cheque without number", () => {
    const invalid = {
      ...validCashPayment,
      paymentMethod: "cheque" as const,
      chequeDate: new Date("2024-01-20"),
      // Missing chequeNumber
    };
    expect(paymentSchema.safeParse(invalid).success).toBe(false);
  });

  test("should reject zero amount", () => {
    const invalid = { ...validCashPayment, amount: 0 };
    expect(paymentSchema.safeParse(invalid).success).toBe(false);
  });

  test("should reject negative amount", () => {
    const invalid = { ...validCashPayment, amount: -500000 };
    expect(paymentSchema.safeParse(invalid).success).toBe(false);
  });
});

// ============================================================================
// PAYMENT METHOD SCHEMA TESTS
// ============================================================================

describe("paymentMethodSchema", () => {
  test("should accept all valid payment methods", () => {
    const methods = ["cash", "mobile_money", "bank_transfer", "cheque", "card", "other"];
    methods.forEach((method) => {
      expect(paymentMethodSchema.safeParse(method).success).toBe(true);
    });
  });

  test("should reject invalid payment method", () => {
    expect(paymentMethodSchema.safeParse("crypto").success).toBe(false);
    expect(paymentMethodSchema.safeParse("paypal").success).toBe(false);
  });
});

describe("mobileMoneyProviderSchema", () => {
  test("should accept MTN and Airtel", () => {
    expect(mobileMoneyProviderSchema.safeParse("mtn").success).toBe(true);
    expect(mobileMoneyProviderSchema.safeParse("airtel").success).toBe(true);
  });

  test("should reject other providers", () => {
    expect(mobileMoneyProviderSchema.safeParse("safaricom").success).toBe(false);
    expect(mobileMoneyProviderSchema.safeParse("africell").success).toBe(false);
  });
});

// ============================================================================
// FEE CATEGORY SCHEMA TESTS
// ============================================================================

describe("feeCategorySchema", () => {
  test("should accept valid fee category", () => {
    const validCategory = {
      name: "Tuition Fees",
      description: "Main school fees for academic instruction",
      isRequired: true,
      appliesToResidence: "all" as const,
      frequency: "termly" as const,
    };
    expect(feeCategorySchema.safeParse(validCategory).success).toBe(true);
  });

  test("should accept category for boarding only", () => {
    const boardingCategory = {
      name: "Boarding Fees",
      appliesToResidence: "boarding" as const,
    };
    expect(feeCategorySchema.safeParse(boardingCategory).success).toBe(true);
  });

  test("should accept annual fee category", () => {
    const annualCategory = {
      name: "Development Fund",
      frequency: "annually" as const,
    };
    expect(feeCategorySchema.safeParse(annualCategory).success).toBe(true);
  });

  test("should accept one-time fee category", () => {
    const onceCategory = {
      name: "Admission Fee",
      frequency: "once" as const,
      isRequired: true,
    };
    expect(feeCategorySchema.safeParse(onceCategory).success).toBe(true);
  });
});

// ============================================================================
// INSTALLMENT RULE SCHEMA TESTS
// ============================================================================

describe("installmentRuleSchema", () => {
  test("should accept valid installment rule with 100% total", () => {
    const validRule = {
      name: "Three Installments",
      numberOfInstallments: 3,
      installments: [
        { installmentNumber: 1, percentage: 40, dueDaysFromStart: 0 },
        { installmentNumber: 2, percentage: 30, dueDaysFromStart: 30 },
        { installmentNumber: 3, percentage: 30, dueDaysFromStart: 60 },
      ],
    };
    expect(installmentRuleSchema.safeParse(validRule).success).toBe(true);
  });

  test("should reject if percentages don't total 100", () => {
    const invalidRule = {
      name: "Invalid Rule",
      numberOfInstallments: 2,
      installments: [
        { installmentNumber: 1, percentage: 50, dueDaysFromStart: 0 },
        { installmentNumber: 2, percentage: 40, dueDaysFromStart: 30 },
      ],
    };
    expect(installmentRuleSchema.safeParse(invalidRule).success).toBe(false);
  });

  test("should reject less than 2 installments", () => {
    const invalidRule = {
      name: "Single Payment",
      numberOfInstallments: 1,
      installments: [{ installmentNumber: 1, percentage: 100, dueDaysFromStart: 0 }],
    };
    expect(installmentRuleSchema.safeParse(invalidRule).success).toBe(false);
  });

  test("should reject more than 12 installments", () => {
    const invalidRule = {
      name: "Too Many",
      numberOfInstallments: 15,
      installments: [],
    };
    expect(installmentRuleSchema.safeParse(invalidRule).success).toBe(false);
  });
});

// ============================================================================
// PROMISE TO PAY SCHEMA TESTS
// ============================================================================

describe("promiseToPaySchema", () => {
  const validPromise = {
    studentId: "student-001",
    promisedAmount: 500000,
    promiseDate: new Date("2024-01-15"),
    dueDate: new Date("2024-02-15"),
    guarantorName: "Wasswa Kisakye",
    guarantorPhone: "0771234567",
    reason: "Parent awaiting salary payment from government teaching service",
  };

  test("should accept valid promise to pay", () => {
    expect(promiseToPaySchema.safeParse(validPromise).success).toBe(true);
  });

  test("should reject due date before promise date", () => {
    const invalid = {
      ...validPromise,
      promiseDate: new Date("2024-02-15"),
      dueDate: new Date("2024-01-15"),
    };
    expect(promiseToPaySchema.safeParse(invalid).success).toBe(false);
  });

  test("should reject short reason", () => {
    const invalid = {
      ...validPromise,
      reason: "No money",
    };
    expect(promiseToPaySchema.safeParse(invalid).success).toBe(false);
  });
});

// ============================================================================
// SCHOOL ONBOARDING SCHEMA TESTS
// ============================================================================

describe("schoolOnboardingSchema", () => {
  const validSchool = {
    name: "Kampala Junior School",
    email: "info@kjs.ac.ug",
    phone: "0312345678",
    district: "Kampala",
    educationLevel: "primary" as const,
    ownership: "private" as const,
    foundedYear: 1990,
    currency: "UGX" as const,
    academicYearStart: "february" as const,
    termsPerYear: 3,
  };

  test("should accept valid school data", () => {
    expect(schoolOnboardingSchema.safeParse(validSchool).success).toBe(true);
  });

  test("should accept all education levels", () => {
    const levels = ["nursery", "primary", "secondary", "tertiary", "mixed"] as const;
    levels.forEach((level) => {
      const school = { ...validSchool, educationLevel: level };
      expect(schoolOnboardingSchema.safeParse(school).success).toBe(true);
    });
  });

  test("should accept all ownership types", () => {
    const types = ["government", "private", "community", "religious"] as const;
    types.forEach((type) => {
      const school = { ...validSchool, ownership: type };
      expect(schoolOnboardingSchema.safeParse(school).success).toBe(true);
    });
  });

  test("should reject future founded year", () => {
    const invalid = { ...validSchool, foundedYear: 2030 };
    expect(schoolOnboardingSchema.safeParse(invalid).success).toBe(false);
  });

  test("should reject very old founded year", () => {
    const invalid = { ...validSchool, foundedYear: 1800 };
    expect(schoolOnboardingSchema.safeParse(invalid).success).toBe(false);
  });

  test("should accept optional mobile money", () => {
    const withMoMo = { ...validSchool, mobileMoneyNumber: "0771234567" };
    expect(schoolOnboardingSchema.safeParse(withMoMo).success).toBe(true);
  });
});

// ============================================================================
// ACADEMIC YEAR & TERM SCHEMA TESTS
// ============================================================================

describe("academicYearSchema", () => {
  test("should accept valid academic year", () => {
    const validYear = {
      name: "2024",
      startDate: new Date("2024-02-01"),
      endDate: new Date("2024-12-15"),
    };
    expect(academicYearSchema.safeParse(validYear).success).toBe(true);
  });

  test("should reject end date before start date", () => {
    const invalid = {
      name: "2024",
      startDate: new Date("2024-12-15"),
      endDate: new Date("2024-02-01"),
    };
    expect(academicYearSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("termSchema", () => {
  test("should accept valid term", () => {
    const validTerm = {
      name: "Term 1",
      academicYearId: "year-2024",
      termNumber: 1,
      startDate: new Date("2024-02-05"),
      endDate: new Date("2024-05-03"),
      feeDeadline: new Date("2024-02-28"),
    };
    expect(termSchema.safeParse(validTerm).success).toBe(true);
  });

  test("should accept term numbers 1-4", () => {
    [1, 2, 3, 4].forEach((num) => {
      const term = {
        name: `Term ${num}`,
        academicYearId: "year-2024",
        termNumber: num,
        startDate: new Date("2024-02-05"),
        endDate: new Date("2024-05-03"),
        feeDeadline: new Date("2024-02-28"),
      };
      expect(termSchema.safeParse(term).success).toBe(true);
    });
  });

  test("should reject term number > 4", () => {
    const invalid = {
      name: "Term 5",
      academicYearId: "year-2024",
      termNumber: 5,
      startDate: new Date("2024-02-05"),
      endDate: new Date("2024-05-03"),
      feeDeadline: new Date("2024-02-28"),
    };
    expect(termSchema.safeParse(invalid).success).toBe(false);
  });
});

// ============================================================================
// CLASS & STREAM SCHEMA TESTS
// ============================================================================

describe("classSchema", () => {
  test("should accept valid class", () => {
    const validClass = {
      name: "Primary 5",
      level: 5,
      section: "primary" as const,
      capacity: 40,
    };
    expect(classSchema.safeParse(validClass).success).toBe(true);
  });

  test("should accept all sections", () => {
    const sections = ["nursery", "primary", "secondary", "tertiary"] as const;
    sections.forEach((section) => {
      const cls = {
        name: "Test Class",
        level: 1,
        section,
      };
      expect(classSchema.safeParse(cls).success).toBe(true);
    });
  });
});

describe("streamSchema", () => {
  test("should accept valid stream", () => {
    const validStream = {
      name: "Stream A",
      classId: "class-001",
    };
    expect(streamSchema.safeParse(validStream).success).toBe(true);
  });
});

// ============================================================================
// USER SCHEMA TESTS
// ============================================================================

describe("userSchema", () => {
  test("should accept valid user", () => {
    const validUser = {
      email: "bursar@school.ac.ug",
      firstName: "Grace",
      lastName: "Namugga",
      role: "bursar" as const,
    };
    expect(userSchema.safeParse(validUser).success).toBe(true);
  });

  test("should accept all roles", () => {
    const roles = ["admin", "bursar", "teacher", "accountant", "head_teacher"] as const;
    roles.forEach((role) => {
      const user = {
        email: "test@school.com",
        firstName: "Test",
        lastName: "User",
        role,
      };
      expect(userSchema.safeParse(user).success).toBe(true);
    });
  });

  test("should accept optional phone", () => {
    const withPhone = {
      email: "user@school.com",
      firstName: "Test",
      lastName: "User",
      role: "teacher" as const,
      phone: "0771234567",
    };
    expect(userSchema.safeParse(withPhone).success).toBe(true);
  });
});

// ============================================================================
// REPORT FILTER SCHEMA TESTS
// ============================================================================

describe("reportFilterSchema", () => {
  test("should accept valid report filter", () => {
    const validFilter = {
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-03-31"),
      classId: "class-001",
      status: "all" as const,
    };
    expect(reportFilterSchema.safeParse(validFilter).success).toBe(true);
  });

  test("should reject end date before start date", () => {
    const invalid = {
      startDate: new Date("2024-03-31"),
      endDate: new Date("2024-01-01"),
    };
    expect(reportFilterSchema.safeParse(invalid).success).toBe(false);
  });

  test("should accept all status values", () => {
    const statuses = ["paid", "partial", "unpaid", "all"] as const;
    statuses.forEach((status) => {
      const filter = {
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-03-31"),
        status,
      };
      expect(reportFilterSchema.safeParse(filter).success).toBe(true);
    });
  });
});

// ============================================================================
// SETTINGS SCHEMA TESTS
// ============================================================================

describe("notificationSettingsSchema", () => {
  test("should accept valid notification settings", () => {
    const validSettings = {
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
      paymentReminders: true,
      arrearAlerts: true,
      dailyDigest: false,
      weeklyReport: true,
    };
    expect(notificationSettingsSchema.safeParse(validSettings).success).toBe(true);
  });

  test("should use defaults for missing values", () => {
    const partial = {};
    const result = notificationSettingsSchema.safeParse(partial);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.emailNotifications).toBe(true);
      expect(result.data.smsNotifications).toBe(false);
    }
  });
});

describe("systemSettingsSchema", () => {
  test("should accept valid system settings", () => {
    const validSettings = {
      schoolName: "Kampala Junior School",
      currency: "UGX" as const,
      dateFormat: "dd/MM/yyyy" as const,
      autoGenerateReceipts: true,
      allowPartialPayments: true,
      minimumPaymentPercent: 10,
      overdueGraceDays: 7,
    };
    expect(systemSettingsSchema.safeParse(validSettings).success).toBe(true);
  });

  test("should accept all date formats", () => {
    const formats = ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"] as const;
    formats.forEach((dateFormat) => {
      const settings = {
        schoolName: "Test School",
        currency: "UGX" as const,
        dateFormat,
      };
      expect(systemSettingsSchema.safeParse(settings).success).toBe(true);
    });
  });

  test("should reject minimum payment percent > 100", () => {
    const invalid = {
      schoolName: "Test School",
      currency: "UGX" as const,
      dateFormat: "dd/MM/yyyy" as const,
      minimumPaymentPercent: 150,
    };
    expect(systemSettingsSchema.safeParse(invalid).success).toBe(false);
  });
});
