import { create } from "zustand";
import type {
  ConnectionInput,
  EntryInput,
  LoanEventInput,
  LoanTermsInput,
} from "@/hooks/use-ledger";

/** Global add/edit sheets so the FAB, lists and detail pages share one form each. */

type EntryState =
  | { mode: "new"; prefill: Partial<EntryInput> }
  | { mode: "edit"; id: number; value: EntryInput };

type LoanState =
  | {
      mode: "new";
      prefill: { connectionId?: number; direction?: "lent" | "borrowed" };
    }
  | {
      mode: "edit";
      id: number;
      value: LoanTermsInput & {
        connectionId: number;
        direction: "lent" | "borrowed";
      };
    };

type EventState = {
  loanId: number;
  direction: "lent" | "borrowed";
  title: string;
  id?: number;
  value: Partial<LoanEventInput>;
  /** One-tap amounts. */
  suggest?: {
    monthlyInterest: number;
    interestDue: number;
    principalOut: number;
  };
};

interface SheetsState {
  quickAdd: boolean;
  entry: EntryState | null;
  loan: LoanState | null;
  connection: (ConnectionInput & { id?: number }) | null;
  /** Called with the saved connection (e.g. to navigate to a new person). */
  onConnectionSaved?: (c: { id: number; name: string }) => void;
  event: EventState | null;
  openQuickAdd: () => void;
  openEntry: (s: EntryState) => void;
  openLoan: (s: LoanState) => void;
  openConnection: (
    c?: ConnectionInput & { id?: number },
    onSaved?: (c: { id: number; name: string }) => void,
  ) => void;
  openEvent: (s: EventState) => void;
  close: (
    which: "quickAdd" | "entry" | "loan" | "connection" | "event",
  ) => void;
}

export const useSheets = create<SheetsState>((set) => ({
  quickAdd: false,
  entry: null,
  loan: null,
  connection: null,
  event: null,
  openQuickAdd: () => set({ quickAdd: true }),
  openEntry: (entry) => set({ entry, quickAdd: false }),
  openLoan: (loan) => set({ loan, quickAdd: false }),
  openConnection: (c, onSaved) =>
    set({
      connection: c ?? { name: "", relation: "friend" },
      onConnectionSaved: onSaved,
      quickAdd: false,
    }),
  openEvent: (event) => set({ event }),
  close: (which) =>
    set(
      which === "quickAdd"
        ? { quickAdd: false }
        : ({ [which]: null } as Partial<SheetsState>),
    ),
}));
