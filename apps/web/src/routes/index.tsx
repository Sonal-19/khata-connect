import { createFileRoute, Navigate } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Calculator,
  Check,
  FileSpreadsheet,
  FileText,
  HandCoins,
  Landmark,
  Lock,
  Moon,
  Percent,
  Plus,
  Smartphone,
  Sun,
  Users,
  Wallet,
} from "lucide-react";
import {
  AnimatePresence,
  animate,
  MotionConfig,
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/common/logo";
import { AuthCard, type AuthMode } from "@/components/landing/auth-card";
import { InterestCalculator } from "@/components/ledger/interest-calculator";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/theme-store";

export const Route = createFileRoute("/")({
  component: Landing,
});

const FEATURES = [
  {
    icon: ArrowUpRight,
    title: "You gave · You got",
    body: "Record cash, UPI or bank money with anyone in two taps. A running balance per person tells you who owes whom.",
    tone: "bg-gave/12 text-gave",
  },
  {
    icon: Percent,
    title: "Loans with byaaj",
    body: "Lend or borrow at ₹1 sainkda a month or any yearly rate. Top-ups, part repayments and waivers are handled automatically.",
    tone: "bg-accent text-accent-foreground",
  },
  {
    icon: Wallet,
    title: "Money kept with others",
    body: "Cash with a brother, savings with mummy, funds lent out of that pool — see exactly how much each person holds for you.",
    tone: "bg-got/12 text-got",
  },
  {
    icon: BellRing,
    title: "Interest due dates",
    body: "Set “interest on the 15th” and see what's coming up or overdue. Send a polite WhatsApp reminder with the exact amount.",
    tone: "bg-gold/15 text-gold",
  },
  {
    icon: FileText,
    title: "Statements & CSV",
    body: "Share a clean statement per person, print it as PDF, or export everything to CSV for your CA.",
    tone: "bg-accent text-accent-foreground",
  },
  {
    icon: FileSpreadsheet,
    title: "Import your Excel khata",
    body: "Upload the sheet you already keep. Dates, amounts, notes and interest rows are mapped for you — totals match to the rupee.",
    tone: "bg-got/12 text-got",
  },
  {
    icon: Landmark,
    title: "Interest by financial year",
    body: "Interest earned and received for every FY (April–March), ready for “income from other sources” at ITR time.",
    tone: "bg-gold/15 text-gold",
  },
  {
    icon: Smartphone,
    title: "Phone-first, works everywhere",
    body: "Install it like an app, use it on any screen, light or dark. Your data stays private — no SMS or contacts reading.",
    tone: "bg-gave/12 text-gave",
  },
];

const STEPS = [
  {
    title: "Add your people",
    body: "Family, friends, shopkeepers — they don't need an account.",
  },
  {
    title: "Record money and loans",
    body: "You gave, you got, or a loan with interest. Old Excel sheet? Import it.",
  },
  {
    title: "Always know the balance",
    body: "Live balances, interest till today, upcoming dues and statements.",
  },
];

const FAQS = [
  {
    q: "How is interest calculated?",
    a: "Simple interest on the amount that is still outstanding. Choose a monthly rate (1% a month = ₹1 sainkda) or a yearly rate, and whether time counts in completed months — like most khatas and Excel's DATEDIF — or every single day like a bank. Each top-up starts earning from its own date and each repayment stops interest only on the part repaid.",
  },
  {
    q: "What does “money held by” mean?",
    a: "Often money isn't with you — it's kept with a relative who lends part of it out. Mark that person as the holder of a loan and their balance automatically goes down when the loan is paid out and up when repayments come back to them.",
  },
  {
    q: "Do the people I add need to sign up?",
    a: "No. Only you can see your records. You can share a statement or a WhatsApp reminder whenever you like.",
  },
  {
    q: "Can I bring my existing Excel sheet?",
    a: "Yes. Upload .xlsx or .csv, check the column mapping and the preview totals, then import. Rows marked as interest become a loan with the right rate.",
  },
  {
    q: "Is it free?",
    a: "Yes — no card, no ads, no limits on people or entries.",
  },
];

const HERO_POINTS = [
  "Monthly or yearly interest, auto-calculated",
  "Know who holds how much of your money",
  "Interest due dates & WhatsApp reminders",
  "Import your existing Excel in a minute",
];

const NAV = [
  ["features", "Features"],
  ["calculator", "Interest calculator"],
  ["how", "How it works"],
  ["faq", "FAQ"],
] as const;

const FLOW_ROWS = [
  {
    icon: ArrowUpRight,
    t: "Cash given to Ravi",
    d: "10 Mar",
    a: "+₹50,000",
    c: "text-got",
  },
  {
    icon: HandCoins,
    t: "Loan to Amit · from Ravi's cash",
    d: "15 Feb",
    a: "₹2,00,000",
    c: "text-foreground",
  },
  {
    icon: ArrowDownLeft,
    t: "Interest received",
    d: "15 Sep",
    a: "+₹2,000",
    c: "text-got",
  },
];

const inr = new Intl.NumberFormat("en-IN");

/** "₹4,32,500" counts up from ₹0 the first time it scrolls into view. */
function CountUp({ value }: { value: string }) {
  const target = Number(value.replace(/\D/g, ""));
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, target, {
      duration: 1.4,
      ease: "easeOut",
      onUpdate: (v) => setN(Math.round(v)),
    });
    return () => c.stop();
  }, [inView, target]);
  return <span ref={ref}>₹{inr.format(n)}</span>;
}

/** Card that tilts toward the cursor (no-op on touch). */
function Tilt({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), {
    stiffness: 150,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), {
    stiffness: 150,
    damping: 18,
  });
  return (
    <motion.div
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - r.left) / r.width - 0.5);
        y.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Animated "how your money flows" illustration (sample names). */
function FlowCard() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(
      () => setActive((i) => (i + 1) % FLOW_ROWS.length),
      2200,
    );
    return () => clearInterval(id);
  }, [paused]);

  const node =
    "relative z-10 flex flex-col items-center gap-1 rounded-2xl border bg-card px-3 py-2.5 text-center shadow-sm sm:px-4";
  return (
    <Tilt className="relative overflow-hidden rounded-3xl border bg-card p-4 shadow-2xl shadow-primary/10 sm:p-6">
      <div className="bg-dot-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          How your money flows
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-got/12 px-2 py-0.5 text-[11px] font-semibold text-got">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-got opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-got" />
          </span>
          Live balance
        </span>
      </div>

      <div className="relative mt-5 grid grid-cols-3 items-center gap-2">
        <div className="pointer-events-none absolute inset-x-[16%] top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-primary/15">
          {[0, 1].map((i) => (
            <motion.span
              key={i}
              className="absolute top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gold text-[10px] font-bold text-white shadow-md shadow-gold/40"
              initial={{ left: "0%", opacity: 0 }}
              animate={{ left: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
              transition={{
                duration: 3,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
                delay: i * 1.5,
              }}
            >
              ₹
            </motion.span>
          ))}
        </div>
        <motion.div whileHover={{ y: -3 }} className={node}>
          <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            You
          </span>
          <span className="text-[11px] text-muted-foreground">gave cash</span>
        </motion.div>
        <motion.div whileHover={{ y: -3 }} className={node}>
          <span className="grid size-9 place-items-center rounded-full bg-got/15 text-sm font-bold text-got">
            RS
          </span>
          <span className="text-xs font-semibold">Ravi</span>
          <span className="tabular text-[11px] text-got">holds ₹4.3L</span>
        </motion.div>
        <motion.div whileHover={{ y: -3 }} className={node}>
          <span className="grid size-9 place-items-center rounded-full bg-gold/15 text-sm font-bold text-gold">
            AV
          </span>
          <span className="text-xs font-semibold">Amit</span>
          <span className="tabular text-[11px] text-gold">1% / month</span>
        </motion.div>
      </div>

      <div
        className="relative mt-5 space-y-2"
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
      >
        {FLOW_ROWS.map((r, i) => (
          <motion.div
            key={r.t}
            onPointerEnter={() => setActive(i)}
            animate={{ scale: active === i ? 1.02 : 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className={cn(
              "relative flex items-center gap-3 rounded-xl border bg-background/70 px-3 py-2 transition-colors",
              active === i && "border-primary/40 bg-card",
            )}
          >
            {active === i && (
              <motion.span
                layoutId="flow-active"
                className="absolute inset-y-2 left-0 w-1 rounded-full bg-primary"
              />
            )}
            <r.icon
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-colors",
                active === i && "text-primary",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.t}</p>
              <p className="text-[11px] text-muted-foreground">{r.d}</p>
            </div>
            <span className={cn("tabular text-sm font-semibold", r.c)}>
              {r.a}
            </span>
          </motion.div>
        ))}
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-accent/70 p-3 text-center">
        {[
          ["With Ravi", "₹4,32,500"],
          ["Lent out", "₹2,00,000"],
          ["Interest due", "₹73,000"],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-[10px] text-muted-foreground sm:text-[11px]">
              {k}
            </p>
            <p className="tabular text-sm font-bold sm:text-base">
              <CountUp value={v!} />
            </p>
          </div>
        ))}
      </div>
    </Tilt>
  );
}

function SectionTitle({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-2xl text-center"
    >
      <p className="text-xs font-bold tracking-widest text-primary uppercase">
        {kicker}
      </p>
      <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {sub && (
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">{sub}</p>
      )}
    </motion.div>
  );
}

function FeatureCard({ f, i }: { f: (typeof FEATURES)[number]; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: (i % 4) * 0.06, duration: 0.45 }}
      whileHover={{ y: -4 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
      }}
      className="group spotlight relative rounded-2xl border bg-card p-5 transition-[box-shadow,border-color] hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10"
    >
      <motion.span
        whileHover={{ rotate: [0, -10, 10, 0] }}
        transition={{ duration: 0.5 }}
        className={cn(
          "grid size-11 place-items-center rounded-xl transition-transform group-hover:scale-110",
          f.tone,
        )}
      >
        <f.icon className="size-5.5" />
      </motion.span>
      <h3 className="mt-4 font-bold">{f.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {f.body}
      </p>
    </motion.div>
  );
}

function Steps() {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 85%", "end 55%"],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });
  return (
    <ol ref={ref} className="relative mt-10 grid gap-4 md:grid-cols-3">
      {/* Connector that fills as you scroll: vertical on phones, horizontal on desktop. */}
      <div className="absolute top-5 bottom-5 left-[2.375rem] w-0.5 rounded-full bg-border md:hidden">
        <motion.div
          style={{ scaleY: progress }}
          className="size-full origin-top rounded-full bg-primary"
        />
      </div>
      <div className="absolute top-[2.375rem] right-[16%] left-[16%] hidden h-0.5 rounded-full bg-border md:block">
        <motion.div
          style={{ scaleX: progress }}
          className="size-full origin-left rounded-full bg-primary"
        />
      </div>
      {STEPS.map((s, i) => (
        <motion.li
          key={s.title}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ delay: i * 0.12, duration: 0.45 }}
          className="relative flex gap-4 rounded-2xl border bg-card p-5 md:flex-col md:items-center md:gap-0 md:text-center"
        >
          <motion.span
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{
              delay: 0.15 + i * 0.12,
              type: "spring",
              stiffness: 260,
              damping: 14,
            }}
            className="relative z-10 grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground ring-4 ring-card"
          >
            {i + 1}
          </motion.span>
          <div>
            <h3 className="font-bold md:mt-3">{s.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mt-8 space-y-2.5">
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <motion.div
            key={f.q}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              "overflow-hidden rounded-2xl border bg-card transition-colors",
              isOpen && "border-primary/30 shadow-lg shadow-primary/5",
            )}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left font-semibold sm:px-5"
            >
              {f.q}
              <motion.span
                animate={{ rotate: isOpen ? 45 : 0 }}
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-colors",
                  isOpen && "bg-primary text-primary-foreground",
                )}
              >
                <Plus className="size-4" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground sm:px-5">
                    {f.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

const HEADLINE = "Every rupee between you and your people,".split(" ");

function Landing() {
  const { user, isLoading } = useAuth();
  const [mode, setMode] = useState<AuthMode>("register");
  const authRef = useRef<HTMLDivElement>(null);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const { scrollYProgress } = useScroll();
  const bar = useSpring(scrollYProgress, { stiffness: 140, damping: 26 });

  if (!isLoading && user) return <Navigate to="/dashboard" replace />;

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const goAuth = (m: AuthMode) => {
    setMode(m);
    authRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const goTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-dvh overflow-x-clip bg-background text-foreground">
        {/* ---------------- Header ---------------- */}
        <header className="pt-safe sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6 lg:px-8">
            <Logo className="min-w-0" />
            <nav className="hidden items-center gap-1 text-sm font-medium text-muted-foreground lg:flex">
              {NAV.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => goTo(id)}
                  className="group relative rounded-full px-3 py-1.5 transition-colors hover:text-foreground"
                >
                  {label}
                  <span className="absolute inset-x-3 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full bg-primary transition-transform duration-300 group-hover:scale-x-100" />
                </button>
              ))}
            </nav>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="size-9 overflow-hidden rounded-full"
                aria-label="Toggle theme"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isDark ? "sun" : "moon"}
                    initial={{ y: 14, rotate: -90, opacity: 0 }}
                    animate={{ y: 0, rotate: 0, opacity: 1 }}
                    exit={{ y: -14, rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {isDark ? (
                      <Sun className="size-4 text-gold" />
                    ) : (
                      <Moon className="size-4 text-primary" />
                    )}
                  </motion.span>
                </AnimatePresence>
              </Button>
              <Button
                size="sm"
                onClick={() => goAuth("register")}
                className="h-9 rounded-full px-3.5 font-semibold shadow-md shadow-primary/25 transition-transform active:scale-95 sm:px-4"
              >
                Get Started
              </Button>
            </div>
          </div>
          <motion.div
            style={{ scaleX: bar }}
            className="absolute inset-x-0 -bottom-px h-0.5 origin-left bg-linear-to-r from-primary to-gold"
          />
        </header>

        {/* ---------------- Hero + auth ---------------- */}
        <section className="relative isolate">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="animate-orb absolute -top-32 -left-24 size-[28rem] rounded-full bg-primary/20 blur-3xl" />
            <div className="animate-orb absolute top-10 -right-24 size-[22rem] rounded-full bg-gold/15 blur-3xl [animation-delay:-6s]" />
            <div className="bg-dot-grid absolute inset-0 [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />
          </div>
          <div className="mx-auto grid max-w-7xl items-start gap-8 px-4 pt-2 pb-12 sm:px-6 sm:pt-14 lg:grid-cols-[1.05fr_minmax(0,460px)] lg:gap-14 lg:px-8 lg:pt-20 lg:pb-20">
            <div className="min-w-0">
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="hidden items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary md:inline-flex"
              >
                <Users className="size-3.5" /> Smart khata for lena-dena
              </motion.span>
              <h1 className="mt-4 text-[2rem] leading-[1.1] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                {HEADLINE.map((w, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ delay: 0.05 * i, duration: 0.5 }}
                    className="inline-block"
                  >
                    {w}&nbsp;
                  </motion.span>
                ))}
                <motion.span
                  initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: 0.05 * HEADLINE.length, duration: 0.5 }}
                  className="relative inline-block"
                >
                  <span className="text-gradient-brand">remembered.</span>
                  <svg
                    viewBox="0 0 200 12"
                    preserveAspectRatio="none"
                    className="absolute -bottom-1.5 left-0 h-2.5 w-full text-primary/60 sm:-bottom-2.5 sm:h-3"
                    aria-hidden="true"
                  >
                    <motion.path
                      d="M2 9 C 50 2, 120 2, 198 7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{
                        delay: 0.05 * HEADLINE.length + 0.35,
                        duration: 0.7,
                        ease: "easeInOut",
                      }}
                    />
                  </svg>
                </motion.span>
              </h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.5 }}
                className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg"
              >
                {BRAND.name} keeps track of money you give, get back, lend at
                interest or keep with family — with interest worked out to the
                rupee, exactly like your Excel sheet, minus the formulas.
              </motion.p>
              <ul className="mt-6 grid gap-2.5 text-sm sm:grid-cols-2">
                {HERO_POINTS.map((t, i) => (
                  <motion.li
                    key={t}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + i * 0.08 }}
                    className="flex items-start gap-2"
                  >
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        delay: 0.7 + i * 0.08,
                        type: "spring",
                        stiffness: 400,
                        damping: 15,
                      }}
                      className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-got/15 text-got"
                    >
                      <Check className="size-3.5" />
                    </motion.span>
                    {t}
                  </motion.li>
                ))}
              </ul>
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="mt-8  max-w-xl"
              >
                <FlowCard />
              </motion.div>
            </div>

            <motion.div
              ref={authRef}
              id="auth"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="min-w-0 scroll-mt-20 lg:sticky lg:top-24"
            >
              <AuthCard mode={mode} onModeChange={setMode} />
            </motion.div>
          </div>
        </section>

        {/* ---------------- Features ---------------- */}
        <section
          id="features"
          className="scroll-mt-16 border-t bg-card/40 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionTitle
              kicker="Everything in one place"
              title="Built for how money really moves in Indian families"
              sub="Udhaar with friends, byaaj on loans, cash kept with relatives — not just bank transactions."
            />
            <div className="mt-10 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {FEATURES.map((f, i) => (
                <FeatureCard key={f.title} f={f} i={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Calculator ---------------- */}
        <section
          id="calculator"
          className="scroll-mt-16 border-t py-14 sm:py-20"
        >
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <SectionTitle
              kicker="Try it now"
              title="How much byaaj is due?"
              sub="The same calculation the app uses for every loan. Change the numbers and see."
            />
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
              className="relative mt-10 rounded-3xl bg-linear-135 from-primary/40 via-border to-gold/40 p-px shadow-xl shadow-primary/10"
            >
              <div className="rounded-[calc(1.5rem-1px)] bg-card p-4 sm:p-7">
                <div className="mb-5 flex items-center gap-2 text-sm font-semibold">
                  <Calculator className="size-4 text-primary" /> Interest
                  calculator
                </div>
                <InterestCalculator />
              </div>
            </motion.div>
          </div>
        </section>

        {/* ---------------- How it works ---------------- */}
        <section
          id="how"
          className="scroll-mt-16 border-t bg-card/40 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionTitle
              kicker="Three steps"
              title="Start in under a minute"
            />
            <Steps />
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section id="faq" className="scroll-mt-16 border-t py-14 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <SectionTitle kicker="Questions" title="Good to know" />
            <Faq />
          </div>
        </section>

        {/* ---------------- CTA ---------------- */}
        <section className="border-t py-14 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
              className="relative isolate overflow-hidden rounded-3xl bg-linear-135 from-(--hero-from) to-(--hero-to) px-5 py-12 text-center text-(--hero-foreground) shadow-2xl shadow-black/15 sm:px-10 sm:py-16"
            >
              <div className="animate-orb pointer-events-none absolute -top-24 -right-16 -z-10 size-72 rounded-full bg-white/15 blur-3xl" />
              <div className="animate-orb pointer-events-none absolute -bottom-24 -left-16 -z-10 size-72 rounded-full bg-gold/30 blur-3xl [animation-delay:-9s]" />
              <h2 className="text-2xl font-extrabold tracking-tight text-balance sm:text-4xl">
                Stop doing byaaj maths on paper.
              </h2>
              <p className="mx-auto mt-3 max-w-xl opacity-85">
                Your khata, your people, your numbers — always up to date.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <motion.div
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button
                    size="lg"
                    onClick={() => goAuth("register")}
                    className="group w-full rounded-full bg-white px-7 font-semibold text-(--hero-to) shadow-lg hover:bg-white/90 sm:w-auto"
                  >
                    Create free account{" "}
                    <ArrowRight className="transition-transform group-hover:translate-x-1" />
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => goAuth("login")}
                    className="w-full rounded-full border-white/40 bg-white/10 px-7 font-semibold text-white hover:bg-white/20 hover:text-white sm:w-auto dark:border-white/30 dark:bg-white/10 dark:hover:bg-white/20"
                  >
                    I already have an account
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>

        <footer className="pb-safe border-t">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <Logo className="text-foreground" />
            </div>
            <p className="flex items-center gap-1.5">
              <Lock className="size-3.5" /> © {new Date().getFullYear()}{" "}
              {BRAND.name} · {BRAND.tagline}
            </p>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
