import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const amountSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d{1,2})?$/, "Use a positive amount with at most 2 decimal places.")
    .transform(Number)
    .pipe(
      z
        .number()
        .positive("Amount must be greater than zero.")
        .max(9999999999.99, "Amount is too large."),
    ),
});

export type Credentials = z.infer<typeof credentialsSchema>;
