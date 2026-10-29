"use client";

/**
 * Mango x RDEP: Smart receipt, Option 2 "The Lookbook"
 *
 * Concept: the receipt is a fashion lookbook, not a till slip. Every section is its own colour story
 * (black, saffron gold, bone, espresso, bordeaux, sand) so the page stays rich from the first screen to the last.
 *
 *  1. Cover: black with a Mediterranean "sun" glow. Giant serif first name, invoice + date, and the TOTAL PAID
 *     counts up on load (the one animated moment). QR sits next to the total.
 *  2. The pieces: items as lookbook rows. Each piece has a round size tag (like a garment label), the MRP
 *     struck through with the % off, tap to open SKU / HSN / UoM. Totals, tax and payment close in a black band.
 *  3. Action pill (history, email, download). Once it scrolls away a floating dock keeps the total and the
 *     same three actions one tap away.
 *  4. Feedback on a saffron gold card (stars flash until the first tap).
 *  5. Espresso band: swipeable offer tickets (the centred one turns gold) and the Mango Club card as a real
 *     foil metal card with tier progress underneath.
 *  6. Video, profile, exchange (sand), Reach us, store finder (bordeaux), store "pass" with an abstract map,
 *     black closing block and the "Powered by" strip.
 *
 * Phone first: hover styles only on devices that can hover; on touch every button dips while pressed.
 * Fixed layout: designed at 400px wide. On phones (<= 520px) it is scaled with CSS `zoom` to fill the screen,
 * on larger screens it stays a centred 400px column, so it looks identical everywhere.
 *
 * FONTS: MangoSans (in /public/fonts): "MangoSans Regular.ttf" (400), "MangoSans-Bold.ttf" (700)
 *        Instrument Serif (next/font/google) for the cover name, big numbers and section titles.
 * ASSETS (in /public/images/design-mode): mango.png, RDEP-logo.png
 * Stack: Next.js (app router) + Tailwind. No other dependencies.
 *
 * Usage:  app/mango-receipt-2/page.tsx
 *   import MangoReceiptV2 from "@/components/MangoReceiptV2";
 *   export default function Page() { return <MangoReceiptV2 />; }
 *
 * With real data: <MangoReceiptV2 receipts={[...]} data={currentReceipt} />
 *   Same props and data shape as the first Mango receipt, so it is a drop-in swap.
 *   `club` (tier, points, coupons) is optional on each receipt; the offers band and the hero chip hide without it.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import Image from "next/image";
import { Instrument_Serif } from "next/font/google";

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", display: "swap" });
const sf = `${serif.className} font-normal`;

const BRAND_STACK = `"MangoSans", Arial, "Helvetica Neue", Helvetica, sans-serif`;

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const FONT_FACES = `
@font-face{font-family:"MangoSans";font-weight:400;font-style:normal;font-display:swap;src:url("/fonts/MangoSans%20Regular.ttf") format("truetype")}
@font-face{font-family:"MangoSans";font-weight:700;font-style:normal;font-display:swap;src:url("/fonts/MangoSans-Bold.ttf") format("truetype")}
.mg-root{font-family:${BRAND_STACK}}
.mg-bold{font-family:${BRAND_STACK};font-weight:700}

/* Phone press feedback: every button and link dips slightly while touched */
.mg-root a,.mg-root button{-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.mg-root a,.mg-root button:not(:disabled){transition:transform .12s ease,background-color .2s ease,color .2s ease,border-color .2s ease,opacity .2s ease}
.mg-root a:active,.mg-root button:not(:disabled):active{transform:scale(.97)}

/* Film grain on the dark blocks */
.mg-grain{position:relative}
.mg-grain::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:${GRAIN};opacity:.09;mix-blend-mode:overlay}

/* Cover entrance: one orchestrated moment */
@keyframes mg-rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.mg-rise{opacity:0;animation:mg-rise .8s cubic-bezier(.2,.7,.2,1) forwards}

/* Slow breathing of the cover sun */
@keyframes mg-sun{0%,100%{transform:scale(1);opacity:.95}50%{transform:scale(1.07);opacity:1}}
.mg-sun{animation:mg-sun 7s ease-in-out infinite}

/* Rating stars flash in a wave until the first tap */
@keyframes mg-star-flash{0%,100%{fill:rgba(20,16,14,.1);transform:scale(1)}45%{fill:#14100E;transform:scale(1.2)}}
.mg-star-flash{animation:mg-star-flash 1.6s ease-in-out infinite}

/* Light sweep across the club card */
@keyframes mg-sheen{0%,55%{left:-60%}100%{left:130%}}
.mg-sheen{position:relative;overflow:hidden}
.mg-sheen::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:40%;pointer-events:none;background:linear-gradient(100deg,transparent,rgba(255,255,255,.4),transparent);transform:skewX(-18deg);animation:mg-sheen 5s ease-in-out infinite}

/* Floating dock slides up */
@keyframes mg-dock{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
.mg-dock{animation:mg-dock .35s cubic-bezier(.2,.7,.2,1) both}

@media (prefers-reduced-motion:reduce){
  .mg-rise{opacity:1;animation:none}
  .mg-sun,.mg-star-flash,.mg-dock{animation:none}
  .mg-sheen::after{animation:none;display:none}
  .mg-root a,.mg-root button:not(:disabled){transition:none}
  .mg-root a:active,.mg-root button:not(:disabled):active{transform:none}
}
`;

/* Brand tokens: Mango's black and brown, pushed richer with saffron gold, espresso and bordeaux. */
const theme = {
  "--mg-noir": "#14100E",
  "--mg-espresso": "#1E1511",
  "--mg-bordeaux": "#3B0F1D",
  "--mg-bone": "#F3EEE7",
  "--mg-paper": "#FBF9F6",
  "--mg-sand": "#D8C3B4",
  "--mg-sand-soft": "#E9DDD2",
  "--mg-cognac": "#8B6F5E",
  "--mg-muted": "#6E5445",
  "--mg-gold": "#E5A93C",
  "--mg-line": "rgba(20,16,14,0.12)",
} as CSSProperties;

const GOLD_FOIL = "linear-gradient(115deg,#FFF1C2 0%,#F7B733 34%,#B97A12 64%,#FFE08A 100%)";
const GOLD_FLAT = "linear-gradient(135deg,#FBC24A 0%,#F2A71B 55%,#E08E0B 100%)";

/* Assets + links */
const DEFAULT_MANGO_LOGO = "/images/design-mode/mango.png";
const DEFAULT_RDEP_LOGO = "/images/design-mode/RDEP-logo.png";
const DEFAULT_INSTAGRAM_URL = "https://www.instagram.com/mango/";
const DEFAULT_STORE_LOCATOR_URL = "https://shop.mango.com/in";

/* Marketing video: https://youtu.be/NOWWhR1JlGQ */
const MARKETING_VIDEO_ID = "NOWWhR1JlGQ";

/* Club tiers, lowest to highest. `foil` is the metallic gradient used on the card and chips. */
export type TierName = "Silver" | "Gold" | "Platinum";
const TIERS: { name: TierName; foil: string }[] = [
  { name: "Silver", foil: "linear-gradient(120deg,#FFFFFF 0%,#C9CED6 35%,#8D949E 62%,#EEF0F3 100%)" },
  { name: "Gold", foil: "linear-gradient(120deg,#FFF3C4 0%,#E5BD52 38%,#A67C1A 62%,#F7E08F 100%)" },
  { name: "Platinum", foil: "linear-gradient(120deg,#FFFFFF 0%,#D6E2F2 32%,#93A9C9 62%,#F1F6FD 100%)" },
];
const foilText = (foil: string): CSSProperties => ({
  backgroundImage: foil,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
});

/* ------------------------------- types ------------------------------------------- */
export interface MangoItem {
  name: string;
  size: string;
  sku: string;
  hsn: string;
  qty: number;
  mrp: number;
  discount: number;
}

export interface MangoCoupon {
  code: string;
  /** Big headline, e.g. "20% OFF" or "₹500 OFF" */
  value: string;
  title: string;
  description: string;
  validTill: string;
}

export interface MangoClub {
  tier: TierName;
  points: number;
  /** Points still needed for the next tier. null / omitted at the top tier. */
  pointsToNext?: number | null;
  coupons: MangoCoupon[];
}

export interface MangoReceiptData {
  invoiceNo: string;
  date: string;
  customer: { name: string; mobile: string; email: string };
  items: MangoItem[];
  sgst: number;
  cgst: number;
  payment: { mode: string; ref: string };
  store: { name: string; address: string; email: string; phone: string; gstin: string; associate: string };
  registeredOffice: string;
  exchange: { days: number; points: string[] };
  callTo: string;
  emailTo: string;
  /** Customer tier + coupons. Optional: the offers band and the hero chip are hidden without it. */
  club?: MangoClub;
}

export interface ProfileValues {
  name: string;
  email: string;
  gender: string;
  birthday: string;
  anniversary: string;
  offers: boolean;
}

export interface FeedbackValues {
  invoiceNo: string;
  overall: number;
  categories: { service: number; product: number; sizes: number; value: number };
  comment: string;
}

export interface MangoReceiptProps {
  data?: MangoReceiptData;
  receipts?: MangoReceiptData[];
  qrSrc?: string;
  logoSrc?: string;
  rdepLogoSrc?: string;
  instagramUrl?: string;
  storeLocatorUrl?: string;
  onDownload?: (receipt: MangoReceiptData) => void;
  onSendEmail?: (email: string, receipt: MangoReceiptData) => void;
  onSaveProfile?: (values: ProfileValues) => void;
  onSubmitFeedback?: (values: FeedbackValues) => void;
  onSelectReceipt?: (invoiceNo: string) => void;
}

type IconName =
  | "history" | "mail" | "download" | "phone" | "instagram" | "pin" | "store"
  | "close" | "check" | "arrow" | "chevron" | "user" | "tax" | "directions" | "call"
  | "star" | "ticket" | "qr";
type ModalId = "history" | "email" | "qr" | null;

interface HistoryRow {
  invoiceNo: string;
  date: string;
  storeName: string;
  amount: number;
  items: number;
  current: boolean;
}

/* ------------------------------- helpers ----------------------------------------- */
const inr = (n: number): string => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const trim = (n: number): string => String(Number(n.toFixed(2)));
const round2 = (n: number): number => Math.round(n * 100) / 100;
const netOf = (i: MangoItem): number => round2(i.mrp * i.qty - i.discount);
const emailOk = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function totalsOf(r: MangoReceiptData) {
  const subtotal = round2(r.items.reduce((a, i) => a + i.mrp * i.qty, 0));
  const discount = round2(r.items.reduce((a, i) => a + i.discount, 0));
  return { subtotal, discount, total: round2(subtotal - discount), pieces: r.items.reduce((a, i) => a + i.qty, 0) };
}

function dateValue(d: string): number {
  const [dd, mm, yyyy] = d.split(" ")[0].split("-").map(Number);
  return Date.UTC(yyyy, (mm || 1) - 1, dd || 1);
}

function seeded(seed: string): () => number {
  let s = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    s ^= seed.charCodeAt(i);
    s = Math.imul(s, 16777619);
  }
  s = s || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/* ---------------------------- downloadable receipt ------------------------------- */
const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function buildReceiptHtml(r: MangoReceiptData, logoSrc: string, rdepLogoSrc: string): string {
  const abs = (p: string) => (/^(https?:|data:)/.test(p) ? p : `${window.location.origin}${encodeURI(p)}`);
  const t = totalsOf(r);
  const rows = r.items
    .map(
      (i) => `<tr>
      <td><div class="n">${esc(i.name)}</div><div class="s">Size ${esc(i.size)} &middot; SKU ${esc(i.sku)} &middot; HSN ${esc(i.hsn)}</div></td>
      <td class="r">${i.qty}</td><td class="r">${inr(i.mrp)}</td><td class="r">&minus;${inr(i.discount)}</td><td class="r b">${inr(netOf(i))}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mango Receipt ${esc(r.invoiceNo)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,'Helvetica Neue',sans-serif;font-size:14px;color:#6E5445;background:#F3EEE7;max-width:760px;margin:0 auto;padding:24px}
.bar{display:flex;justify-content:flex-end;margin-bottom:16px}
.bar button{background:#14100E;color:#fff;border:0;border-radius:999px;padding:10px 20px;font:700 13px Arial,sans-serif;cursor:pointer}
.sheet{background:#fff;border-radius:20px;padding:28px}
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding-bottom:16px;border-bottom:3px solid #14100E}
.head img{height:34px;width:auto}
h1{font-size:22px;color:#14100E;text-transform:uppercase;letter-spacing:1px;margin-top:12px}
.meta{text-align:right;font-size:12px;line-height:1.8}
table{width:100%;border-collapse:collapse;margin-top:20px}
th{text-align:left;font-size:11px;letter-spacing:.8px;padding:8px;background:#F3EEE7;border-bottom:1px solid rgba(139,111,94,.3)}
td{padding:12px 8px;border-bottom:1px solid rgba(139,111,94,.3);vertical-align:top;font-size:13px}
.r{text-align:right}.b{font-weight:700;color:#14100E}.n{text-transform:uppercase;font-weight:700;color:#14100E}.s{font-size:11px;margin-top:3px}
.sum{margin:18px 0 0 auto;width:300px}
.row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px}
.total{display:flex;justify-content:space-between;align-items:baseline;border-top:3px solid #14100E;margin-top:10px;padding-top:12px;color:#14100E;font-weight:700}
.total strong{font-size:26px}
.pay{margin-top:18px;background:#14100E;color:#fff;border-radius:14px;padding:14px 16px;display:flex;justify-content:space-between;font-size:14px}
.store{margin-top:24px;font-size:12px;line-height:1.7;border-top:1px solid rgba(139,111,94,.3);padding-top:14px}
.foot{margin-top:22px;text-align:center;font-size:12px}.foot img{height:20px;vertical-align:middle;margin-left:6px}
@media print{.bar{display:none}body{max-width:none;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{border-radius:0}}
</style></head><body>
<div class="bar"><button onclick="window.print()">Save as PDF</button></div>
<div class="sheet">
<div class="head"><div><img src="${esc(abs(logoSrc))}" alt="Mango" onerror="this.style.display='none'"><h1>Tax invoice</h1></div>
<div class="meta"><div><b>Invoice no:</b> ${esc(r.invoiceNo)}</div><div><b>Date:</b> ${esc(r.date)}</div><div><b>Customer:</b> ${esc(r.customer.name)}</div><div><b>Mobile:</b> ${esc(r.customer.mobile)}</div></div></div>
<table><thead><tr><th style="width:44%">ITEM</th><th class="r">QTY</th><th class="r">UNIT PRICE</th><th class="r">DISCOUNT</th><th class="r">NET AMOUNT</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sum">
<div class="row"><span>Subtotal (MRP)</span><b>&#8377;${inr(t.subtotal)}</b></div>
<div class="row"><span>Discount</span><b>&minus;&#8377;${inr(t.discount)}</b></div>
<div class="row"><span>Includes SGST</span><b>&#8377;${inr(r.sgst)}</b></div>
<div class="row"><span>Includes CGST</span><b>&#8377;${inr(r.cgst)}</b></div>
<div class="total"><span>Total paid</span><strong>&#8377;${inr(t.total)}</strong></div></div>
<div class="pay"><span>Payment method &middot; ${esc(r.payment.mode)} &ndash; ${esc(r.payment.ref)}</span><b>&#8377;${inr(t.total)}</b></div>
<div class="store"><b>${esc(r.store.name)}</b><br>${esc(r.store.address)}<br>${esc(r.store.email)} &middot; ${esc(r.store.phone)}<br>GSTIN: ${esc(r.store.gstin)}<br>Registered office: ${esc(r.registeredOffice)}</div>
<div class="foot">Thank you for shopping at Mango<br><br>Powered by <img src="${esc(abs(rdepLogoSrc))}" alt="rdep" onerror="this.style.display='none'"></div>
</div></body></html>`;
}

function downloadReceipt(r: MangoReceiptData, logoSrc: string, rdepLogoSrc: string) {
  const blob = new Blob([buildReceiptHtml(r, logoSrc, rdepLogoSrc)], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Mango_Receipt_${r.invoiceNo}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* -------------------------------- Sample Data ----------------------------------- */
const halfTax = (total: number): number => Math.floor(((total - total / 1.18) / 2) * 100) / 100;

/* SAMPLE club data. Replace with the real tier, points and coupons from the Mango loyalty API. */
const SAMPLE_CLUB: MangoClub = {
  tier: "Gold",
  points: 3240,
  pointsToNext: 1760,
  coupons: [
    { code: "MANGO20", value: "20% OFF", title: "Welcome back offer", description: "On your next purchase of ₹3,999 or more.", validTill: "30 Nov 2026" },
    { code: "GOLD500", value: "₹500 OFF", title: "Gold member reward", description: "On any order above ₹2,999.", validTill: "31 Dec 2026" },
    { code: "FESTIVE10", value: "10% OFF", title: "Festive edit", description: "On new arrivals. One use only.", validTill: "15 Nov 2026" },
  ],
};

const SAMPLE_COMMON = {
  customer: { name: "Sagar H P", mobile: "9620921294", email: "sagar.p@proenx.com" },
  store: {
    name: "Mango Store Ambience Mall",
    address: "C-36, Ambience Mall, Gurgaon, NH-8 122010, Gurugram, Haryana",
    email: "contact@mango.com",
    phone: "01244665318",
    gstin: "06AAOCR0097H1Z4",
    associate: "Rohit",
  },
  registeredOffice:
    "1/1, 4th Floor, Cabin 1, Vinayaka Towers, Gandhinagar, K. G. Road, Bangalore, Bangalore North, Karnataka, India, 560009",
  exchange: {
    days: 30,
    points: [
      "Items can be exchanged within 30 days of purchase with this receipt.",
      "Products must be unworn, unwashed and carry all original tags.",
      "Exchange is for the same or a higher value item; any price difference is payable.",
      "Items bought during the end of season sale, innerwear and accessories are not exchangeable.",
    ],
  },
  callTo: "+911244665318",
  emailTo: "contact@mango.com",
  club: SAMPLE_CLUB,
};

export const sampleMangoReceipts: MangoReceiptData[] = [
  {
    ...SAMPLE_COMMON,
    invoiceNo: "20260626000154",
    date: "14-07-2026 11:14:04",
    items: [{ name: "LINEN-COTTON BLEND STRIPE SHIRT", size: "M", sku: "27061231", hsn: "62032090", qty: 1, mrp: 4290, discount: 1716 }],
    sgst: halfTax(2574),
    cgst: halfTax(2574),
    payment: { mode: "CASH", ref: "REF98765" },
  },
  {
    ...SAMPLE_COMMON,
    invoiceNo: "20260526000112",
    date: "26-05-2026 18:41:22",
    store: { ...SAMPLE_COMMON.store, name: "Mango Junction Mall", address: "Junction Mall, City Center, Durgapur, WB" },
    items: [
      { name: "RELAXED FIT STRAIGHT JEANS", size: "32", sku: "17081052", hsn: "62034200", qty: 1, mrp: 5990, discount: 1200 },
      { name: "TEXTURED COTTON T-SHIRT", size: "L", sku: "27045518", hsn: "61091000", qty: 1, mrp: 2290, discount: 0 },
    ],
    sgst: halfTax(7080),
    cgst: halfTax(7080),
    payment: { mode: "CARD", ref: "REF40211" },
  },
  {
    ...SAMPLE_COMMON,
    invoiceNo: "20260203000047",
    date: "03-02-2026 14:09:50",
    store: { ...SAMPLE_COMMON.store, name: "Mango Quest Mall", address: "33, Syed Amir Ali Ave, Park Circus, Kolkata, WB" },
    items: [{ name: "BELTED MIDI DRESS", size: "S", sku: "37057903", hsn: "62044990", qty: 1, mrp: 7990, discount: 0 }],
    sgst: halfTax(7990),
    cgst: halfTax(7990),
    payment: { mode: "UPI", ref: "REF77310" },
  },
];

/* -------------------------------- icons ------------------------------------------ */
const STAR_PATH = "m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2 2 9.3l6.9-1z";
const PHONE_PATH =
  "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z";
const PATHS: Record<IconName, ReactNode> = {
  history: (<><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 2" /></>),
  mail: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
  download: (<><path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></>),
  phone: <path d={PHONE_PATH} />,
  call: <path d={PHONE_PATH} />,
  instagram: (<><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></>),
  pin: (<><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>),
  store: (<><path d="M3 9 4.5 4h15L21 9" /><path d="M4 9v11h16V9" /><path d="M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3" /><path d="M10 20v-5h4v5" /></>),
  user: (<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  tax: (<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h10M7 12h10M7 16h6" /></>),
  directions: <path d="M9 18l6-6-6-6" />,
  star: <path d={STAR_PATH} />,
  ticket: (<><path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z" /><path d="M9 9h6M9 12h6M9 15h3" /></>),
  qr: (<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h3M20 18v3" /></>),
  close: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="m5 12 5 5 9-10" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  chevron: <path d="m6 9 6 6 6-6" />,
};

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/* ------------------------- placeholder QR ---------------------------------------- */
function PlaceholderQR({ seed }: { seed: string }) {
  const N = 25;
  const cells = useMemo(() => {
    const rnd = seeded(seed);
    const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
    const out: [number, number][] = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!inFinder(x, y) && rnd() > 0.5) out.push([x, y]);
    return out;
  }, [seed]);
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" />
    </g>
  );
  return (
    <svg viewBox={`-1 -1 ${N + 2} ${N + 2}`} fill="#14100E" shapeRendering="crispEdges" role="img" aria-label="Receipt QR code" className="h-full w-full">
      <rect x="-1" y="-1" width={N + 2} height={N + 2} fill="#fff" />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />
      ))}
      {finder(0, 0)}
      {finder(N - 7, 0)}
      {finder(0, N - 7)}
    </svg>
  );
}

/* --------------------------------- shared ---------------------------------------- */
const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mg-gold)]";
const card = "rounded-[28px] bg-white shadow-[0_18px_36px_-22px_rgba(20,16,14,0.45)]";

const fieldInput =
  "w-full rounded-2xl border border-black/10 bg-[var(--mg-bone)] px-4 py-3.5 text-base text-[var(--mg-noir)] outline-none transition-colors [-webkit-appearance:none] [appearance:none] placeholder:text-[var(--mg-cognac)] focus:border-[var(--mg-noir)] focus:bg-white";
const fieldLabel = "mb-1.5 block text-[13px] font-bold text-[var(--mg-muted)]";
const solidBtn = `flex w-full items-center justify-center gap-2 rounded-full bg-[var(--mg-noir)] py-4 text-[15px] font-bold text-white transition-colors active:bg-[var(--mg-cognac)] [@media(hover:hover)]:hover:bg-[var(--mg-cognac)] motion-reduce:transition-none ${focusRing}`;

const DESIGN_W = 400;
const PHONE_MAX = 520;
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function useFitScale(): number {
  const [scale, setScale] = useState(1);
  useIsoLayoutEffect(() => {
    const update = () => {
      const w = document.documentElement.clientWidth;
      setScale(w <= PHONE_MAX ? w / DESIGN_W : 1);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
  return scale;
}
const zoomStyle = (scale: number): CSSProperties | undefined => (scale === 1 ? undefined : ({ zoom: scale } as CSSProperties));

/** True while the element is inside the viewport (expanded by `rootMargin`, needs `threshold` visible). */
function useInView<T extends Element>(ref: RefObject<T | null>, rootMargin: string, threshold: number): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin, threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin, threshold]);
  return inView;
}

/** Counts from 0 up to `target` once on mount (eased). Jumps straight to the value for reduced motion. */
function useCountUp(target: number, ms = 1200): number {
  const [v, setV] = useState(target);
  useIsoLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      return;
    }
    setV(0);
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function BrandImage({
  src, alt, width, height, className, fallbackClassName, priority = false,
}: {
  src: string; alt: string; width: number; height: number; className: string; fallbackClassName: string; priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={fallbackClassName}>{alt}</span>;
  return (
    <Image
      ref={(img: HTMLImageElement | null) => {
        if (img && img.complete && img.naturalWidth === 0) setFailed(true);
      }}
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

function Leader({ label, value, strong = false, className = "" }: { label: ReactNode; value: ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={`flex items-baseline gap-2 ${className}`}>
      <dt className="flex min-w-0 flex-1 items-baseline gap-2 after:mb-[3px] after:h-0 after:min-w-3 after:flex-1 after:border-b after:border-dotted after:border-current after:opacity-40 after:content-['']">
        {label}
      </dt>
      <dd className={`shrink-0 text-right tabular-nums ${strong ? "font-bold text-[var(--mg-noir)]" : ""}`}>{value}</dd>
    </div>
  );
}

function Collapse({ open, id, children }: { open: boolean; id: string; children: ReactNode }) {
  return (
    <div
      id={id}
      aria-hidden={!open}
      className={`grid transition-[grid-template-rows,visibility] duration-300 motion-reduce:transition-none ${
        open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"
      }`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

function SectionTitle({ children, sub, light = false }: { children: ReactNode; sub?: string; light?: boolean }) {
  return (
    <div>
      <h2 className={`${sf} text-[34px] leading-[1] tracking-[-0.01em] ${light ? "text-[var(--mg-bone)]" : "text-[var(--mg-noir)]"}`}>{children}</h2>
      {sub && <p className={`mt-2 text-[14px] leading-snug ${light ? "text-[var(--mg-sand)]" : "text-[var(--mg-muted)]"}`}>{sub}</p>}
    </div>
  );
}

/* Popups: bone sheets */
function Modal({ title, onClose, scale, children }: { title: string; onClose: () => void; scale: number; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      (previous as HTMLElement | null)?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#14100E]/70 backdrop-blur-[3px] sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={theme}
        className="mg-root max-h-[88vh] w-full overflow-y-auto rounded-t-[36px] bg-[var(--mg-bone)] outline-none sm:w-[400px] sm:rounded-[36px]"
      >
        <div className="w-full sm:w-[400px]" style={zoomStyle(scale)}>
          <div className="p-6 text-[var(--mg-muted)]">
            <div className="flex items-center justify-between gap-4">
              <h2 id={titleId} className={`${sf} text-[32px] leading-none text-[var(--mg-noir)]`}>
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[var(--mg-noir)] shadow-sm active:bg-[var(--mg-sand-soft)] ${focusRing}`}
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ a piece (item row) ------------------------------- */
function PieceRow({ item, open, onToggle }: { item: MangoItem; open: boolean; onToggle: () => void }) {
  const panelId = useId();
  const net = netOf(item);
  const gross = item.mrp * item.qty;
  const pct = gross > 0 ? (item.discount / gross) * 100 : 0;
  return (
    <li className="border-b border-[var(--mg-line)] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={`grid w-full grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-2xl py-4 text-left ${focusRing}`}
      >
        <span
          aria-label={`Size ${item.size}`}
          className="mg-bold grid h-12 w-12 place-items-center rounded-full bg-[var(--mg-noir)] text-[15px] text-[var(--mg-noir)] ring-2 ring-[var(--mg-gold)] ring-offset-2 ring-offset-white"
          style={{ backgroundImage: GOLD_FLAT }}
        >
          {item.size}
        </span>
        <span className="min-w-0">
          <span className="mg-bold block text-[16px] capitalize leading-snug text-[var(--mg-noir)]">{item.name.toLowerCase()}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-[var(--mg-muted)]">
            <span>Qty {item.qty}</span>
            {pct > 0 && (
              <span className="mg-bold rounded-full px-2 py-0.5 text-[12px] text-[var(--mg-noir)]" style={{ backgroundImage: GOLD_FLAT }}>
                {trim(pct)}% off
              </span>
            )}
            <span className="flex items-center gap-1 font-bold text-[var(--mg-noir)]">
              Details
              <Icon name="chevron" className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
            </span>
          </span>
        </span>
        <span className="text-right">
          <span className="mg-bold block text-[17px] tabular-nums text-[var(--mg-noir)]">₹{inr(net)}</span>
          {item.discount > 0 && <s className="block text-[12px] tabular-nums text-[var(--mg-cognac)]">₹{inr(gross)}</s>}
        </span>
      </button>

      <Collapse open={open} id={panelId}>
        <div className="mb-4 rounded-2xl bg-[var(--mg-bone)] p-3.5 text-[13px]">
          <dl className="grid grid-cols-3 gap-2">
            {(
              [
                ["SKU", item.sku],
                ["HSN", item.hsn],
                ["UoM", "Pcs"],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[var(--mg-muted)]">{k}</dt>
                <dd className="mg-bold mt-0.5 break-words tabular-nums text-[var(--mg-noir)]">{v}</dd>
              </div>
            ))}
          </dl>
          <dl className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--mg-line)] pt-3">
            <div>
              <dt className="text-[var(--mg-muted)]">Discount</dt>
              <dd className="mg-bold mt-0.5 tabular-nums text-[var(--mg-noir)]">{trim(pct)}%</dd>
            </div>
            <div className="text-right">
              <dt className="text-[var(--mg-muted)]">Discount amount</dt>
              <dd className="mg-bold mt-0.5 tabular-nums text-[var(--mg-noir)]">₹{trim(item.discount)}</dd>
            </div>
          </dl>
        </div>
      </Collapse>
    </li>
  );
}

/* ------------------------------- feedback card ------------------------------------ */
const RATING_WORDS = ["Poor", "Fair", "Good", "Very good", "Excellent"];
const FEEDBACK_CATEGORIES = [
  { key: "service", label: "Service quality" },
  { key: "product", label: "Product offering" },
  { key: "sizes", label: "Sizes availability" },
  { key: "value", label: "Value for money" },
] as const;

function FeedbackCard({ data, onSubmit }: { data: MangoReceiptData; onSubmit?: (v: FeedbackValues) => void }) {
  const [overall, setOverall] = useState(0);
  const [hover, setHover] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [cats, setCats] = useState({ service: 0, product: 0, sizes: 0, value: 0 });
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const commentId = useId();
  const detailId = useId();
  const shown = hover || overall;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit?.({ invoiceNo: data.invoiceNo, overall, categories: cats, comment: comment.trim() });
    setSubmitted(true);
  };

  return (
    <section aria-label="Rate your visit" className="relative overflow-hidden rounded-[28px] p-5 text-[var(--mg-noir)] shadow-[0_22px_40px_-22px_rgba(185,122,18,0.75)]" style={{ backgroundImage: GOLD_FLAT }}>
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full border-[16px] border-black/[0.07]" />
      <h2 className={`${sf} relative text-[34px] leading-[1]`}>How was your visit?</h2>
      <p className="relative mt-1.5 text-[14px] text-[var(--mg-noir)]/75">Two taps and Mango knows what to do better.</p>

      {submitted ? (
        <div className="relative mt-4 flex items-start gap-3 rounded-2xl bg-[var(--mg-noir)] p-4 text-white" aria-live="polite">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--mg-noir)]" style={{ backgroundImage: GOLD_FOIL }}>
            <Icon name="check" className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="mg-bold text-[16px]">Thank you for rating</p>
            <p className="mt-0.5 text-[13px] text-white/70">
              You gave {overall} {overall === 1 ? "star" : "stars"} ({RATING_WORDS[overall - 1].toLowerCase()}).
            </p>
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setExpanded(false);
                setOverall(0);
              }}
              className="mg-bold mt-2 text-[13px] text-[var(--mg-gold)] underline underline-offset-4"
            >
              Edit rating
            </button>
          </div>
        </div>
      ) : (
        <div className="relative mt-4">
          <div className="flex items-center justify-between rounded-2xl bg-white/45 px-3.5 py-3 backdrop-blur-sm">
            <div role="radiogroup" aria-label="Overall rating" className="flex gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={overall === n}
                  aria-label={`${n} ${n === 1 ? "star" : "stars"}, ${RATING_WORDS[n - 1]}`}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => {
                    setOverall(n);
                    setExpanded(true);
                  }}
                  className={`grid h-10 w-10 place-items-center rounded-lg ${focusRing}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    className={`h-7 w-7 stroke-[var(--mg-noir)] transition-colors ${n <= shown ? "fill-[var(--mg-noir)]" : "fill-black/10"} ${!overall && !hover ? "mg-star-flash" : ""}`}
                    style={!overall && !hover ? { animationDelay: `${(n - 1) * 0.18}s` } : undefined}
                  >
                    <path d={STAR_PATH} />
                  </svg>
                </button>
              ))}
            </div>
            <div className="pl-2 text-right">
              <p className="mg-bold text-[14px]">{overall ? RATING_WORDS[overall - 1] : "Tap to rate"}</p>
              <p className="text-[12px] text-[var(--mg-noir)]/70">{overall ? `${overall} of 5` : "Takes 10 seconds"}</p>
            </div>
          </div>

          <Collapse open={expanded} id={detailId}>
            <form onSubmit={submit} noValidate className="space-y-3 pt-3">
              <div className="space-y-2">
                {FEEDBACK_CATEGORIES.map((c) => (
                  <div key={c.key} className="flex items-center justify-between rounded-xl bg-white/45 px-3 py-1.5">
                    <span className="mg-bold text-[13px]">{c.label}</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} type="button" onClick={() => setCats((p) => ({ ...p, [c.key]: star }))} className="p-1.5" aria-label={`${star} stars for ${c.label}`}>
                          <svg viewBox="0 0 24 24" strokeWidth="1.5" className={`h-[18px] w-[18px] stroke-[var(--mg-noir)] ${star <= cats[c.key] ? "fill-[var(--mg-noir)]" : "fill-transparent"}`}>
                            <path d={STAR_PATH} />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label htmlFor={commentId} className="mg-bold mb-1.5 block text-[13px]">
                  Anything else? (optional)
                </label>
                <textarea
                  id={commentId}
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us what you liked or how we can improve"
                  className="w-full resize-none rounded-2xl border-0 bg-white/60 px-4 py-3 text-base text-[var(--mg-noir)] outline-none placeholder:text-[var(--mg-noir)]/55 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <button type="submit" className={`${solidBtn} !py-3.5`}>
                  Send rating
                </button>
                <button type="button" onClick={() => setExpanded(false)} className="mg-bold shrink-0 rounded-full bg-white/50 px-5 py-3.5 text-[14px] active:bg-white/80">
                  Cancel
                </button>
              </div>
            </form>
          </Collapse>
        </div>
      )}
    </section>
  );
}

/* ------------------------------- video card --------------------------------------- */
/** YouTube embed that autoplays muted while at least half of it is on screen and pauses when it leaves. */
function VideoCard() {
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const near = useInView(sectionRef, "300px 0px", 0);
  const visible = useInView(sectionRef, "0px", 0.5);

  useEffect(() => {
    if (near) setMounted(true);
  }, [near]);

  const command = useCallback((func: string) => {
    frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: "" }), "*");
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const func = visible ? "playVideo" : "pauseVideo";
    const timers = [0, 600, 1500].map((ms) => window.setTimeout(() => command(func), ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [loaded, visible, command]);

  const src = mounted
    ? `https://www.youtube-nocookie.com/embed/${MARKETING_VIDEO_ID}?enablejsapi=1&mute=1&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=${MARKETING_VIDEO_ID}&origin=${encodeURIComponent(window.location.origin)}`
    : "";

  return (
    <section ref={sectionRef} aria-label="Mango video">
      <div
        className="relative aspect-video w-full overflow-hidden rounded-[28px] bg-[var(--mg-noir)] bg-cover bg-center shadow-[0_22px_40px_-22px_rgba(20,16,14,0.7)] ring-1 ring-black/10"
        style={{ backgroundImage: `url(https://i.ytimg.com/vi/${MARKETING_VIDEO_ID}/hqdefault.jpg)` }}
      >
        {mounted && (
          <iframe
            ref={frameRef}
            src={src}
            title="Mango video"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            onLoad={() => setLoaded(true)}
            className="absolute inset-0 h-full w-full border-0"
          />
        )}
      </div>
    </section>
  );
}

/* ------------------------------ coupons (swipeable, centred ticket turns gold) ----- */
const BAND = "#1E1511";

function CouponCard({
  coupon, active, wide, copied, onCopy,
}: {
  coupon: MangoCoupon; active: boolean; wide: boolean; copied: boolean; onCopy: (code: string) => void;
}) {
  return (
    <li className={`shrink-0 snap-center ${wide ? "w-[78%]" : "w-full"}`}>
      <div
        className={`relative overflow-hidden rounded-[26px] transition-all duration-300 motion-reduce:transition-none ${
          active ? "scale-100 shadow-[0_18px_34px_-14px_rgba(242,167,27,0.55)]" : "scale-[0.96] bg-[var(--mg-bone)] opacity-90"
        }`}
        style={active ? { backgroundImage: GOLD_FOIL } : undefined}
      >
        <div className="p-4 pb-4 text-[var(--mg-noir)]">
          <div className="flex items-start justify-between gap-3">
            <p className={`${sf} text-[44px] leading-[0.95]`}>{coupon.value}</p>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${active ? "bg-[var(--mg-noir)] text-[var(--mg-gold)]" : "bg-white text-[var(--mg-cognac)]"}`}>
              <Icon name="ticket" className="h-4 w-4" />
            </span>
          </div>
          <p className="mg-bold mt-2.5 text-[15px]">{coupon.title}</p>
          <p className="mt-1 text-[13px] leading-snug text-[var(--mg-noir)]/75">{coupon.description}</p>
        </div>

        <div className="relative">
          <span aria-hidden="true" className="absolute -left-3 -top-3 h-6 w-6 rounded-full" style={{ background: BAND }} />
          <span aria-hidden="true" className="absolute -right-3 -top-3 h-6 w-6 rounded-full" style={{ background: BAND }} />
          <div className="border-t-2 border-dashed border-[var(--mg-noir)]/25" />
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 text-[var(--mg-noir)]">
          <div className="min-w-0">
            <p className="mg-bold truncate text-[16px] tracking-[0.08em]">{coupon.code}</p>
            <p className="mt-0.5 text-[12px] text-[var(--mg-noir)]/70">Valid till {coupon.validTill}</p>
          </div>
          <button
            type="button"
            onClick={() => onCopy(coupon.code)}
            aria-live="polite"
            className="mg-bold shrink-0 rounded-full bg-[var(--mg-noir)] px-4 py-2 text-[13px] text-white active:bg-[var(--mg-cognac)]"
          >
            {copied ? "Copied" : "Copy code"}
          </button>
        </div>
      </div>
    </li>
  );
}

function CouponsSection({ coupons }: { coupons: MangoCoupon[] }) {
  const [copied, setCopied] = useState("");
  const [active, setActive] = useState(0);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLUListElement>(null);
  const activeRef = useRef(0);
  const drag = useRef({ down: false, x: 0, left: 0, moved: false });
  const count = coupons.length;

  /* the ticket sitting in the middle strip of the track is the active one */
  useEffect(() => {
    const root = trackRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const items = Array.from(root.children);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const i = items.indexOf(e.target);
            if (i >= 0) {
              activeRef.current = i;
              setActive(i);
            }
          }
        });
      },
      { root, rootMargin: "0px -45% 0px -45%", threshold: 0 },
    );
    items.forEach((i) => io.observe(i));
    return () => io.disconnect();
  }, [count]);

  const goTo = useCallback((i: number) => {
    const el = trackRef.current;
    const child = el?.children[i] as HTMLElement | undefined;
    if (!el || !child) return;
    el.scrollTo({ left: child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2, behavior: "smooth" });
  }, []);

  /* mouse drag-to-scroll (touch screens scroll natively) */
  const onPointerDown = (e: ReactPointerEvent<HTMLUListElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = trackRef.current;
    if (!el) return;
    drag.current = { down: true, x: e.clientX, left: el.scrollLeft, moved: false };
    setDragging(true);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLUListElement>) => {
    const d = drag.current;
    const el = trackRef.current;
    if (!d.down || !el) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 5) d.moved = true;
    el.scrollLeft = d.left - dx;
  };
  const endDrag = () => {
    if (!drag.current.down) return;
    drag.current.down = false;
    setDragging(false);
    goTo(activeRef.current);
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      /* clipboard blocked: ignore */
    }
  };

  return (
    <section aria-label="Coupons">
      <div className="flex items-end justify-between gap-3">
        <SectionTitle light>Offers for you</SectionTitle>
        <span className="mg-bold mb-1 shrink-0 rounded-full bg-white/10 px-3 py-1 text-[13px] text-[var(--mg-sand)]">{count} available</span>
      </div>

      {count === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-[26px] border-2 border-dashed border-white/20 px-6 py-8 text-center">
          <Icon name="ticket" className="h-8 w-8 text-[var(--mg-gold)]" />
          <p className={`${sf} mt-2 text-[24px] text-[var(--mg-bone)]`}>No offers right now</p>
          <p className="mt-1 text-[14px] text-[var(--mg-sand)]">Please check this section later.</p>
        </div>
      ) : (
        <>
          <ul
            ref={trackRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
            onPointerCancel={endDrag}
            onClickCapture={(e) => {
              if (drag.current.moved) {
                e.preventDefault();
                e.stopPropagation();
                drag.current.moved = false;
              }
            }}
            className={`relative -mx-4 mt-5 flex select-none gap-3 overflow-x-auto overscroll-x-contain px-4 pb-5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              dragging ? "cursor-grabbing snap-none" : "cursor-grab snap-x snap-mandatory"
            }`}
          >
            {coupons.map((c, i) => (
              <CouponCard key={c.code} coupon={c} active={i === active} wide={count > 1} copied={copied === c.code} onCopy={copy} />
            ))}
          </ul>

          {count > 1 && (
            <div className="-mt-2 flex justify-center gap-0.5">
              {coupons.map((c, i) => (
                <button key={c.code} type="button" aria-label={`Show offer ${i + 1} of ${count}`} aria-current={i === active ? "true" : undefined} onClick={() => goTo(i)} className="grid h-6 w-7 place-items-center">
                  <span className={`block h-1.5 rounded-full transition-all duration-300 ${i === active ? "w-6 bg-[var(--mg-gold)]" : "w-1.5 bg-white/30"}`} />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ------------------------------ Mango Club: foil metal card ----------------------- */
function ClubCard({ club, mobile, sectionRef, logoSrc }: { club: MangoClub; mobile: string; sectionRef: RefObject<HTMLElement | null>; logoSrc: string }) {
  const idx = Math.max(0, TIERS.findIndex((t) => t.name === club.tier));
  const tier = TIERS[idx];
  const next = TIERS[idx + 1];
  const toNext = club.pointsToNext ?? null;
  const total = toNext != null ? club.points + toNext : club.points;
  const pct = !next || toNext == null || total <= 0 ? 100 : Math.min(100, Math.round((club.points / total) * 100));
  /* nodes sit at 0%, 50%, 100%; the fill runs up to the current tier plus progress to the next */
  const fill = idx * 50 + (next ? pct / 2 : 0);

  return (
    <section ref={sectionRef} aria-label="Mango Club" className="scroll-mt-4">
      <SectionTitle light sub="Your tier, your points, your perks.">Mango Club</SectionTitle>

      <div className="mg-sheen mt-5 aspect-[1.586] w-full rounded-[22px] p-5 text-[var(--mg-noir)] shadow-[0_26px_44px_-18px_rgba(0,0,0,0.9)]" style={{ backgroundImage: tier.foil }}>
        <svg aria-hidden="true" viewBox="0 0 368 232" className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16]" fill="none" stroke="#14100E" strokeWidth="1">
          {[60, 90, 120, 150, 180, 210].map((r) => (
            <circle key={r} cx="330" cy="30" r={r} />
          ))}
        </svg>

        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <BrandImage src={logoSrc} alt="MANGO" width={320} height={80} className="h-6 w-auto object-contain object-left brightness-0" fallbackClassName="mg-bold text-[20px] tracking-[0.12em]" />
            <span className="mg-bold text-[13px] tabular-nums tracking-[0.12em]">•••• {mobile.slice(-4)}</span>
          </div>

          <span aria-hidden="true" className="block h-8 w-11 rounded-md border border-black/25 bg-black/10" />

          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[13px] text-[var(--mg-noir)]/75">Club tier</p>
              <p className={`${sf} text-[46px] leading-[0.9]`}>{tier.name}</p>
            </div>
            <div className="text-right">
              <p className={`${sf} text-[40px] leading-[0.9] tabular-nums`}>{club.points.toLocaleString("en-IN")}</p>
              <p className="text-[13px] text-[var(--mg-noir)]/75">points</p>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-5 text-[14px] leading-snug text-[var(--mg-sand)]">
        {next && toNext != null ? (
          <>
            <span className="mg-bold tabular-nums text-white">{toNext.toLocaleString("en-IN")}</span> more points to reach <span className="mg-bold text-white">{next.name}</span>
          </>
        ) : (
          "You are at the top tier"
        )}
      </p>

      <div className="mt-3 px-2">
        <div className="relative h-1.5 rounded-full bg-white/15">
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${fill}%`, background: tier.foil }} />
          {TIERS.map((t, i) => (
            <span
              key={t.name}
              aria-hidden="true"
              className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${i <= idx ? "border-[var(--mg-espresso)]" : "border-[var(--mg-espresso)] bg-white/25"}`}
              style={{ left: `${i * 50}%`, ...(i <= idx ? { background: t.foil } : null) }}
            />
          ))}
        </div>
        <div className="mt-2.5 grid grid-cols-3 text-[13px]">
          {TIERS.map((t, i) => (
            <span key={t.name} className={`mg-bold ${i === 0 ? "text-left" : i === 1 ? "text-center" : "text-right"} ${i === idx ? "text-white" : "text-white/45"}`}>
              {t.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- profile ----------------------------------------- */
const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];

function Toggle({ checked, onChange, disabled = false, label }: { checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative h-8 w-[56px] shrink-0 rounded-full transition-colors motion-reduce:transition-none ${checked ? "bg-[var(--mg-noir)]" : "bg-[var(--mg-sand)]"} ${disabled ? "opacity-70" : ""} ${focusRing}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-1 h-6 w-6 rounded-full transition-all motion-reduce:transition-none ${checked ? "left-[28px]" : "left-1 bg-white"}`}
        style={checked ? { backgroundImage: GOLD_FLAT } : undefined}
      />
    </button>
  );
}

function ProfileCard({ data, onSave }: { data: MangoReceiptData; onSave?: (v: ProfileValues) => void }) {
  const [form, setForm] = useState<ProfileValues>({
    name: data.customer.name,
    email: data.customer.email,
    gender: "",
    birthday: "",
    anniversary: "",
    offers: false,
  });
  const [saved, setSaved] = useState(false);
  const [emailErr, setEmailErr] = useState("");
  const upd = <K extends keyof ProfileValues>(k: K, v: ProfileValues[K]) => {
    setSaved(false);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (form.email && !emailOk(form.email)) {
      setEmailErr("Enter a valid email address, like name@example.com.");
      return;
    }
    setEmailErr("");
    onSave?.(form);
    setSaved(true);
  };

  return (
    <section aria-label="Your profile" className={`${card} p-5 text-[var(--mg-muted)]`}>
      <SectionTitle sub="Faster service and personalised updates.">Your profile</SectionTitle>
      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        <label className="block">
          <span className={fieldLabel}>Full name</span>
          <input className={fieldInput} value={form.name} onChange={(e) => upd("name", e.target.value)} autoComplete="name" />
        </label>

        <label className="block">
          <span className={fieldLabel}>Email address</span>
          <input
            type="email"
            className={fieldInput}
            value={form.email}
            onChange={(e) => {
              setEmailErr("");
              upd("email", e.target.value);
            }}
            autoComplete="email"
            aria-invalid={!!emailErr}
          />
          {emailErr && (
            <span role="alert" className="mg-bold mt-1.5 block text-[13px] text-[var(--mg-noir)]">
              {emailErr}
            </span>
          )}
        </label>

        <div className="flex items-center justify-between rounded-2xl bg-[var(--mg-bone)] px-4 py-3">
          <span className="text-[13px] font-bold text-[var(--mg-muted)]">Mobile number</span>
          <span className="mg-bold text-base tabular-nums text-[var(--mg-noir)]">{data.customer.mobile}</span>
        </div>

        <fieldset>
          <legend className={`${fieldLabel} mb-2`}>Gender</legend>
          <div className="flex flex-wrap gap-2">
            {GENDERS.map((g) => {
              const on = form.gender === g;
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={on}
                  onClick={() => upd("gender", on ? "" : g)}
                  className={`rounded-full px-4 py-2 text-[14px] transition-colors motion-reduce:transition-none ${focusRing} ${
                    on ? "mg-bold bg-[var(--mg-noir)] text-white" : "bg-[var(--mg-bone)] text-[var(--mg-muted)] active:bg-[var(--mg-sand-soft)]"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          <label className="block min-w-0">
            <span className={fieldLabel}>Birthday</span>
            <input type="date" className={fieldInput} value={form.birthday} onChange={(e) => upd("birthday", e.target.value)} autoComplete="bday" />
            <span className="mt-1 block text-[12px]">For birthday offers</span>
          </label>
          <label className="block min-w-0">
            <span className={fieldLabel}>Anniversary</span>
            <input type="date" className={fieldInput} value={form.anniversary} onChange={(e) => upd("anniversary", e.target.value)} />
            <span className="mt-1 block text-[12px]">Optional</span>
          </label>
        </div>

        <fieldset>
          <legend className={`${fieldLabel} mb-1`}>Communication preferences</legend>
          <ul className="divide-y divide-[var(--mg-line)] rounded-2xl bg-[var(--mg-bone)] px-4">
            <li className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <p className="mg-bold text-[15px] text-[var(--mg-noir)]">Purchase and order updates</p>
                <p className="mt-0.5 text-[13px] leading-snug">Receipts and return confirmations. Always on.</p>
              </div>
              <Toggle checked disabled label="Purchase and order updates, always on" />
            </li>
            <li className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <p className="mg-bold text-[15px] text-[var(--mg-noir)]">New arrivals and offers</p>
                <p className="mt-0.5 text-[13px] leading-snug">Collections, member offers and seasonal edits.</p>
              </div>
              <Toggle checked={form.offers} onChange={(v) => upd("offers", v)} label="New arrivals and offers" />
            </li>
          </ul>
        </fieldset>

        <div>
          <button type="submit" className={solidBtn}>
            {saved ? (
              <>
                <Icon name="check" className="h-4 w-4" /> Details saved
              </>
            ) : (
              "Save details"
            )}
          </button>
          <p className="mt-3 text-center text-[12px] leading-relaxed">
            Your information is used only for purchase communication and personalisation. We never share your data with third parties.
          </p>
          <span className="sr-only" aria-live="polite">
            {saved ? "Details saved" : ""}
          </span>
        </div>
      </form>
    </section>
  );
}

/* ------------------------- abstract street map for the store pass ------------------- */
function MiniMap({ seed }: { seed: string }) {
  const lines = useMemo(() => {
    const rnd = seeded(seed);
    const out: { d: string; w: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const y = 10 + i * 18 + rnd() * 8;
      out.push({ d: `M-10 ${y.toFixed(1)} Q ${(120 + rnd() * 60).toFixed(1)} ${(y + rnd() * 30 - 15).toFixed(1)} 380 ${(y + rnd() * 24 - 12).toFixed(1)}`, w: i % 3 === 0 ? 5 : 2.5 });
    }
    for (let i = 0; i < 6; i++) {
      const x = 25 + i * 62 + rnd() * 20;
      out.push({ d: `M${x.toFixed(1)} -10 Q ${(x + rnd() * 40 - 20).toFixed(1)} 55 ${(x + rnd() * 50 - 25).toFixed(1)} 130`, w: i % 2 === 0 ? 4 : 2.5 });
    }
    return out;
  }, [seed]);
  return (
    <div className="relative h-[116px] w-full overflow-hidden bg-[var(--mg-sand-soft)]" aria-hidden="true">
      <svg viewBox="0 0 368 116" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" fill="none" stroke="#fff" strokeLinecap="round">
        {lines.map((l, i) => (
          <path key={i} d={l.d} strokeWidth={l.w} />
        ))}
      </svg>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[60%]">
        <span className="relative grid h-11 w-11 place-items-center rounded-full text-[var(--mg-noir)] shadow-[0_10px_20px_-6px_rgba(20,16,14,0.6)] ring-4 ring-white" style={{ backgroundImage: GOLD_FLAT }}>
          <Icon name="pin" className="h-5 w-5" />
        </span>
      </span>
    </div>
  );
}

/* ------------------------------ receipt view ------------------------------------- */
interface ReceiptViewProps extends Omit<MangoReceiptProps, "data" | "receipts" | "onSelectReceipt"> {
  data: MangoReceiptData;
  history: HistoryRow[];
  onSelect: (invoiceNo: string) => void;
}

function ReceiptView({
  data,
  history,
  onSelect,
  qrSrc,
  logoSrc = DEFAULT_MANGO_LOGO,
  rdepLogoSrc = DEFAULT_RDEP_LOGO,
  instagramUrl = DEFAULT_INSTAGRAM_URL,
  storeLocatorUrl = DEFAULT_STORE_LOCATOR_URL,
  onDownload,
  onSendEmail,
  onSaveProfile,
  onSubmitFeedback,
}: ReceiptViewProps) {
  const [openItem, setOpenItem] = useState(-1);
  const [modal, setModal] = useState<ModalId>(null);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [passed, setPassed] = useState(false);
  const closeModal = useCallback(() => setModal(null), []);
  const exchangeId = useId();
  const contactId = useId();
  const clubRef = useRef<HTMLElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const scale = useFitScale();

  const { store, exchange, club } = data;
  const t = useMemo(() => totalsOf(data), [data]);
  const shownTotal = useCountUp(t.total);
  const firstName = data.customer.name.trim().split(/\s+/)[0] || data.customer.name;
  const nameSize = Math.min(124, Math.max(60, Math.floor(330 / (0.5 * firstName.length))));
  const tier = club ? TIERS.find((x) => x.name === club.tier) ?? TIERS[0] : null;
  const handleDownload = () => (onDownload ? onDownload(data) : downloadReceipt(data, logoSrc, rdepLogoSrc));
  const footerInView = useInView(footerRef, "0px", 0);

  /* the floating dock appears once the action pill has scrolled off the top */
  useEffect(() => {
    const el = actionsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setPassed(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const actions: { icon: IconName; label: string; onClick: () => void }[] = [
    { icon: "history", label: "History", onClick: () => setModal("history") },
    { icon: "mail", label: "Email", onClick: () => setModal("email") },
    { icon: "download", label: "Download", onClick: handleDownload },
  ];

  const dateShort = data.date.split(" ")[0];

  return (
    <div
      style={theme}
      onTouchStart={() => {}} /* lets :active press states fire on iOS Safari */
      className="mg-root min-h-screen overflow-x-hidden bg-[#E4DDD3] text-[var(--mg-muted)] antialiased [-webkit-text-size-adjust:100%] sm:py-8"
    >
      <style>{FONT_FACES}</style>

      <main
        style={zoomStyle(scale)}
        className="mx-auto w-[400px] overflow-hidden bg-[var(--mg-bone)] sm:rounded-[36px] sm:shadow-[0_30px_70px_-26px_rgba(20,16,14,0.45)]"
      >
        {/* ---------- 1. Cover ---------- */}
        <header className="mg-grain relative overflow-hidden rounded-b-[40px] bg-[var(--mg-noir)] px-5 pb-16 pt-5 text-white">
          <span
            aria-hidden="true"
            className="mg-sun pointer-events-none absolute -bottom-24 -right-24 h-[330px] w-[330px] rounded-full"
            style={{ background: "radial-gradient(circle at 50% 50%, #FFD36E 0%, #F2A71B 28%, rgba(190,90,20,0.55) 52%, rgba(20,16,14,0) 72%)" }}
          />
          <span aria-hidden="true" className="pointer-events-none absolute -bottom-10 -right-10 h-[230px] w-[230px] rounded-full border border-white/15" />
          <span aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(139,111,94,0.5), rgba(20,16,14,0) 68%)" }} />

          <div className="mg-rise relative flex items-center justify-between gap-4" style={{ animationDelay: "0s" }}>
            <BrandImage
              src={logoSrc}
              alt="MANGO"
              width={320}
              height={80}
              priority
              className="h-8 w-auto max-w-[46%] shrink-0 object-contain object-left brightness-0 invert"
              fallbackClassName="mg-bold inline-block text-[24px] uppercase leading-none tracking-[0.12em] text-white"
            />
            {club && tier && (
              <button
                type="button"
                onClick={() => clubRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                aria-label={`${club.tier} member. View Mango Club`}
                className="mg-bold inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] text-[var(--mg-noir)]"
                style={{ background: tier.foil }}
              >
                <Icon name="star" className="h-3.5 w-3.5" />
                {club.tier} member
              </button>
            )}
          </div>

          <div className="mg-rise relative mt-9" style={{ animationDelay: "0.12s" }}>
            <p className="text-[16px] text-[var(--mg-sand)]">Thank you,</p>
            <h1 className={`${sf} mt-1 leading-[0.86] tracking-[-0.025em] text-[var(--mg-bone)] [overflow-wrap:anywhere]`} style={{ fontSize: nameSize }}>
              {firstName}
            </h1>
            <p className="mt-3 truncate text-[14px] text-white/70">Your smart receipt from {store.name}</p>
          </div>

          <div className="mg-rise relative mt-7 flex items-stretch divide-x divide-white/15 rounded-2xl border border-white/15 bg-white/[0.07] py-2.5 backdrop-blur-md" style={{ animationDelay: "0.24s" }}>
            <div className="min-w-0 flex-1 px-3.5">
              <p className="text-[12px] text-white/60">Invoice no</p>
              <p className="mg-bold truncate text-[13px] tabular-nums">{data.invoiceNo}</p>
            </div>
            <div className="shrink-0 px-3.5 text-right">
              <p className="text-[12px] text-white/60">Date</p>
              <p className="mg-bold text-[13px] tabular-nums">{data.date}</p>
            </div>
          </div>

          <div className="mg-rise relative mt-7 flex items-end justify-between gap-3" style={{ animationDelay: "0.36s" }}>
            <div className="min-w-0">
              <p className="text-[15px] text-[var(--mg-sand)]">Total paid</p>
              <p className={`${sf} mt-1 whitespace-nowrap text-[64px] leading-[0.9] tabular-nums tracking-[-0.01em]`} style={foilText(GOLD_FOIL)}>
                <span aria-hidden="true">₹{inr(shownTotal)}</span>
                <span className="sr-only">₹{inr(t.total)}</span>
              </p>
              {t.discount > 0 && (
                <p className="mg-bold mt-3 inline-flex rounded-full bg-[var(--mg-gold)]/20 px-3 py-1 text-[13px] text-[#FFD36E]">You saved ₹{inr(t.discount)}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setModal("qr")}
              aria-label="View QR code"
              className="grid h-[68px] w-[68px] shrink-0 place-items-center rounded-2xl bg-white/95 text-[var(--mg-noir)] shadow-[0_14px_26px_-10px_rgba(0,0,0,0.8)]"
            >
              <span className="block h-[46px] w-[46px] overflow-hidden rounded-md">
                {qrSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrSrc} alt="Receipt QR code" className="h-full w-full object-contain" />
                ) : (
                  <PlaceholderQR seed={data.invoiceNo} />
                )}
              </span>
            </button>
          </div>
        </header>

        {/* ---------- 2. The pieces (receipt) ---------- */}
        <section aria-label="Purchase summary" className="relative z-10 -mt-8 px-4">
          <div className={`${card} p-5 text-[var(--mg-muted)]`}>
            <div className="flex items-end justify-between gap-3">
              <h2 className={`${sf} text-[34px] leading-none text-[var(--mg-noir)]`}>Your pieces</h2>
              <p className="mg-bold mb-0.5 text-[14px] text-[var(--mg-muted)]">
                {t.pieces} {t.pieces === 1 ? "item" : "items"} on {dateShort}
              </p>
            </div>

            <ul aria-label="Items purchased" className="mt-2">
              {data.items.map((item, i) => (
                <PieceRow key={`${item.sku}-${i}`} item={item} open={openItem === i} onToggle={() => setOpenItem(openItem === i ? -1 : i)} />
              ))}
            </ul>

            <dl className="space-y-2 border-t-2 border-[var(--mg-noir)] pt-4 text-[15px]">
              <Leader label="Subtotal (MRP)" value={`₹${inr(t.subtotal)}`} strong />
              <Leader label="Discount" value={`− ₹${inr(t.discount)}`} strong />
              <Leader label="SGST" value={`₹${inr(data.sgst)}`} strong />
              <Leader label="CGST" value={`₹${inr(data.cgst)}`} strong />
            </dl>

            <div className="mg-grain relative mt-5 overflow-hidden rounded-3xl bg-[var(--mg-noir)] p-5 text-white">
              <span aria-hidden="true" className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full" style={{ background: "radial-gradient(circle, rgba(242,167,27,0.5), rgba(20,16,14,0) 68%)" }} />
              <div className="relative flex items-end justify-between gap-3">
                <span className="mg-bold text-[15px] text-[var(--mg-sand)]">Total paid</span>
                <span className={`${sf} text-[46px] leading-[0.9] tabular-nums`} style={foilText(GOLD_FOIL)}>₹{inr(t.total)}</span>
              </div>
              <div className="relative mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3">
                <div>
                  <p className="text-[12px] text-white/60">Payment method</p>
                  <p className="mg-bold text-[14px]">
                    {data.payment.mode} &ndash; {data.payment.ref}
                  </p>
                </div>
                <span className="mg-bold text-[16px] tabular-nums">₹{inr(t.total)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- 3. Action pill ---------- */}
        <div ref={actionsRef} className="mt-4 px-4">
          <div className="grid grid-cols-3 divide-x divide-white/15 overflow-hidden rounded-full bg-[var(--mg-noir)] text-white shadow-[0_18px_30px_-16px_rgba(20,16,14,0.9)]">
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                className={`mg-bold flex items-center justify-center gap-2 py-4 text-[14px] active:bg-white/15 [@media(hover:hover)]:hover:bg-white/10 ${focusRing}`}
              >
                <Icon name={a.icon} className="h-[18px] w-[18px] text-[var(--mg-gold)]" />
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6 px-4 pt-6">
          {/* ---------- 4. Feedback ---------- */}
          <FeedbackCard data={data} onSubmit={onSubmitFeedback} />
        </div>

        {/* ---------- 5. Espresso band: offers + club ---------- */}
        {club && (
          <div
            className="mg-grain relative mt-8 overflow-hidden rounded-[40px] px-4 pb-9 pt-9"
            style={{ background: `radial-gradient(90% 38% at 100% 0%, rgba(242,167,27,0.2), rgba(30,21,17,0) 70%), ${BAND}` }}
          >
            <div className="relative space-y-10">
              <CouponsSection coupons={club.coupons} />
              <ClubCard club={club} mobile={data.customer.mobile} sectionRef={clubRef} logoSrc={logoSrc} />
            </div>
          </div>
        )}

        <div className="space-y-6 px-4 pt-8">
          {/* ---------- 6. Video, profile, exchange ---------- */}
          <VideoCard />

          <ProfileCard data={data} onSave={onSaveProfile} />

          <section aria-label="Exchange" className="rounded-[28px] bg-[var(--mg-sand)] text-[var(--mg-noir)]">
            <h2>
              <button
                type="button"
                onClick={() => setExchangeOpen((o) => !o)}
                aria-expanded={exchangeOpen}
                aria-controls={exchangeId}
                className={`flex w-full items-center justify-between gap-4 rounded-[28px] p-5 text-left ${focusRing}`}
              >
                <span>
                  <span className={`${sf} block text-[34px] leading-none`}>Exchange</span>
                  <span className="mt-2 block text-[14px] font-normal text-[var(--mg-noir)]/75">{exchange.days}-day exchange policy</span>
                </span>
                <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--mg-noir)] text-white">
                  <Icon name="chevron" className={`h-4 w-4 transition-transform duration-300 ${exchangeOpen ? "rotate-180" : ""}`} />
                </span>
              </button>
            </h2>
            <Collapse open={exchangeOpen} id={exchangeId}>
              <ul className="space-y-3 border-t border-[var(--mg-noir)]/15 px-5 py-5">
                {exchange.points.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-[14px] leading-snug">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--mg-noir)] text-[var(--mg-gold)]">
                      <Icon name="check" className="h-3 w-3" />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </Collapse>
          </section>

          {/* ---------- 7. Reach us ---------- */}
          <section aria-label="Reach us">
            <SectionTitle sub="Get in touch or find us online.">Reach us</SectionTitle>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {(
                [
                  { icon: "instagram", label: "Instagram", href: instagramUrl, ext: true },
                  { icon: "phone", label: "Call us", href: `tel:${data.callTo}`, ext: false },
                  { icon: "mail", label: "Email us", href: `mailto:${data.emailTo}`, ext: false },
                ] as { icon: IconName; label: string; href: string; ext: boolean }[]
              ).map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  {...(l.ext ? { target: "_blank", rel: "noopener noreferrer" } : null)}
                  className={`group flex flex-col items-center gap-2 rounded-3xl bg-white px-1 py-4 text-center text-[13px] font-bold text-[var(--mg-noir)] shadow-[0_14px_28px_-20px_rgba(20,16,14,0.5)] active:bg-[var(--mg-noir)] active:text-white [@media(hover:hover)]:hover:bg-[var(--mg-noir)] [@media(hover:hover)]:hover:text-white ${focusRing}`}
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full text-[var(--mg-noir)]" style={{ backgroundImage: GOLD_FLAT }}>
                    <Icon name={l.icon} className="h-[18px] w-[18px]" />
                  </span>
                  {l.label}
                </a>
              ))}
            </div>

            <a
              href={storeLocatorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative mt-3 flex items-center justify-between gap-4 overflow-hidden rounded-[28px] p-5 text-white shadow-[0_22px_40px_-20px_rgba(59,15,29,0.9)]"
              style={{ background: "radial-gradient(120% 140% at 100% 0%, #7A1D3A 0%, #3B0F1D 60%)" }}
            >
              <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border-[14px] border-white/[0.07]" />
              <span className="relative">
                <span className={`${sf} block text-[30px] leading-[1]`}>Find a Mango store</span>
                <span className="mt-1.5 block text-[14px] text-[var(--mg-sand)]">Locate your nearest store in India</span>
              </span>
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--mg-noir)]" style={{ backgroundImage: GOLD_FLAT }}>
                <Icon name="arrow" className="h-5 w-5" />
              </span>
            </a>
          </section>

          {/* ---------- 8. Store pass ---------- */}
          <section aria-label="Store" className={`${card} overflow-hidden`}>
            <MiniMap seed={store.name} />
            <div className="p-5 text-[var(--mg-noir)]">
              <p className="text-[14px] text-[var(--mg-muted)]">You shopped at</p>
              <h2 className={`${sf} mt-1 text-[32px] leading-[1]`}>{store.name}</h2>
              <p className="mt-3 flex items-start gap-2.5 text-[14px] leading-relaxed text-[var(--mg-muted)]">
                <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--mg-cognac)]" />
                {store.address}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${store.name}, ${store.address}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mg-bold flex items-center justify-center gap-2 rounded-full bg-[var(--mg-noir)] py-3.5 text-[14px] text-white active:bg-[var(--mg-cognac)]"
                >
                  <Icon name="directions" className="h-4 w-4 text-[var(--mg-gold)]" />
                  Directions
                </a>
                <a href={`tel:${store.phone}`} className="mg-bold flex items-center justify-center gap-2 rounded-full bg-[var(--mg-bone)] py-3.5 text-[14px] text-[var(--mg-noir)] active:bg-[var(--mg-sand-soft)]">
                  <Icon name="call" className="h-4 w-4 text-[var(--mg-cognac)]" />
                  Call store
                </a>
              </div>

              <button
                type="button"
                onClick={() => setContactOpen((o) => !o)}
                aria-expanded={contactOpen}
                aria-controls={contactId}
                className={`mt-4 flex w-full items-center justify-between gap-2 rounded-2xl border-t border-[var(--mg-line)] pt-4 ${focusRing}`}
              >
                <span className="mg-bold text-[14px]">{contactOpen ? "Hide contact and tax info" : "View contact and tax info"}</span>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--mg-noir)] text-white">
                  <Icon name="chevron" className={`h-4 w-4 transition-transform duration-300 ${contactOpen ? "rotate-180" : ""}`} />
                </span>
              </button>

              <Collapse open={contactOpen} id={contactId}>
                <div className="mt-3 space-y-2.5">
                  <a href={`mailto:${store.email}`} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--mg-bone)] p-3.5 active:bg-[var(--mg-sand-soft)]">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[var(--mg-cognac)]">
                        <Icon name="mail" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12px] text-[var(--mg-muted)]">Email support</span>
                        <span className="mg-bold block truncate text-[14px]">{store.email}</span>
                      </span>
                    </span>
                    <Icon name="arrow" className="h-4 w-4 shrink-0 text-[var(--mg-cognac)]" />
                  </a>

                  <a href={`tel:${store.phone}`} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--mg-bone)] p-3.5 active:bg-[var(--mg-sand-soft)]">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[var(--mg-cognac)]">
                        <Icon name="phone" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12px] text-[var(--mg-muted)]">Store phone</span>
                        <span className="mg-bold block truncate text-[14px] tabular-nums">{store.phone}</span>
                      </span>
                    </span>
                    <Icon name="arrow" className="h-4 w-4 shrink-0 text-[var(--mg-cognac)]" />
                  </a>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-2xl bg-[var(--mg-bone)] p-3.5">
                      <p className="flex items-center gap-1.5 text-[12px] text-[var(--mg-muted)]">
                        <Icon name="user" className="h-3.5 w-3.5" /> Associate
                      </p>
                      <p className="mg-bold mt-1 text-[14px]">{store.associate}</p>
                    </div>
                    <div className="min-w-0 rounded-2xl bg-[var(--mg-bone)] p-3.5">
                      <p className="flex items-center gap-1.5 text-[12px] text-[var(--mg-muted)]">
                        <Icon name="tax" className="h-3.5 w-3.5" /> GSTIN
                      </p>
                      <p className="mg-bold mt-1 truncate text-[13px] tabular-nums" title={store.gstin}>
                        {store.gstin}
                      </p>
                    </div>
                  </div>
                </div>
              </Collapse>
            </div>
          </section>
        </div>

        {/* ---------- 9. Closing block ---------- */}
        <footer ref={footerRef} className="mt-10">
          <div className="mg-grain relative overflow-hidden rounded-t-[40px] bg-[var(--mg-noir)] px-5 pb-8 pt-9 text-white">
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-28 -right-20 h-[280px] w-[280px] rounded-full" style={{ background: "radial-gradient(circle, rgba(242,167,27,0.5), rgba(20,16,14,0) 68%)" }} />
            <div className="relative">
              <BrandImage
                src={logoSrc}
                alt="MANGO"
                width={320}
                height={80}
                className="h-10 w-auto max-w-[60%] object-contain object-left brightness-0 invert"
                fallbackClassName="mg-bold inline-block text-[28px] uppercase leading-none tracking-[0.12em] text-white"
              />
              <h2 className={`${sf} mt-7 text-[52px] leading-[0.9] tracking-[-0.02em] text-[var(--mg-bone)]`}>Thank you</h2>
              <p className="mt-2 text-[15px] text-[var(--mg-sand)]">For shopping with us. See you in store soon.</p>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <h3 className="mg-bold text-[13px] text-[var(--mg-sand)]">Registered office</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/80">{data.registeredOffice}</p>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-[13px] text-white/65">
                  Invoice <strong className="mg-bold tabular-nums text-white">{data.invoiceNo}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  aria-label="Back to top"
                  className={`mg-bold flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] text-[var(--mg-noir)] ${focusRing}`}
                  style={{ backgroundImage: GOLD_FLAT }}
                >
                  Top <Icon name="arrow" className="h-3.5 w-3.5 -rotate-90" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2.5 bg-white px-5 py-4 text-[13px] text-[var(--mg-muted)]">
            <span>Powered by</span>
            <BrandImage src={rdepLogoSrc} alt="rdep" width={240} height={80} className="h-7 w-auto" fallbackClassName="text-lg font-bold tracking-tight text-[var(--mg-noir)]" />
          </div>
        </footer>
      </main>

      {/* ---------------------------- Floating dock ---------------------------- */}
      {passed && !footerInView && !modal && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
          <div style={zoomStyle(scale)} className="w-[400px] px-4 pb-[max(14px,env(safe-area-inset-bottom))]">
            <div className="mg-dock pointer-events-auto flex items-center justify-between gap-3 rounded-full bg-[var(--mg-noir)]/95 py-2 pl-5 pr-2 text-white shadow-[0_22px_40px_-12px_rgba(0,0,0,0.75)] ring-1 ring-white/10 backdrop-blur-md">
              <div className="min-w-0">
                <p className="text-[12px] leading-none text-[var(--mg-sand)]">Total paid</p>
                <p className="mg-bold mt-1 text-[17px] leading-none tabular-nums" style={foilText(GOLD_FOIL)}>₹{inr(t.total)}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {actions.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={a.onClick}
                    aria-label={a.label}
                    className={`grid h-11 w-11 place-items-center rounded-full bg-white/10 text-[var(--mg-gold)] active:bg-white/25 ${focusRing}`}
                  >
                    <Icon name={a.icon} className="h-[18px] w-[18px]" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------- Transaction History Popup ---------------------------- */}
      {modal === "history" && (
        <Modal title="Transaction history" onClose={closeModal} scale={scale}>
          <div className="mb-4 flex items-center justify-between rounded-2xl bg-white p-4">
            <div>
              <p className="text-[13px] text-[var(--mg-muted)]">Total receipts</p>
              <p className={`${sf} text-[28px] leading-none text-[var(--mg-noir)]`}>{history.length} recorded</p>
            </div>
            <div className="text-right">
              <p className="text-[13px] text-[var(--mg-muted)]">Viewing</p>
              <p className="mg-bold text-[15px] tabular-nums text-[var(--mg-noir)]">#{data.invoiceNo.slice(-4)}</p>
            </div>
          </div>

          <ol className="space-y-3">
            {history.map((h) => (
              <li key={h.invoiceNo}>
                <div
                  className={`flex items-center justify-between gap-3 rounded-2xl p-4 transition-colors ${
                    h.current ? "bg-[var(--mg-noir)] text-white shadow-md" : "bg-white text-[var(--mg-noir)] [@media(hover:hover)]:hover:bg-[var(--mg-sand-soft)]"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="mg-bold text-[14px] tabular-nums">No. {h.invoiceNo}</span>
                      {h.current && <span className="mg-bold rounded-full px-2 py-0.5 text-[11px] text-[var(--mg-noir)]" style={{ backgroundImage: GOLD_FLAT }}>Current</span>}
                    </div>
                    <p className={`mt-1 truncate text-[13px] ${h.current ? "text-white/75" : "text-[var(--mg-muted)]"}`}>
                      {h.date} &middot; {h.storeName}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <span className="mg-bold block text-[16px] tabular-nums">₹{inr(h.amount)}</span>
                      <span className={`block text-[12px] ${h.current ? "text-white/70" : "text-[var(--mg-muted)]"}`}>
                        {h.items} {h.items === 1 ? "piece" : "pieces"}
                      </span>
                    </div>

                    {!h.current && (
                      <button
                        type="button"
                        onClick={() => {
                          closeModal();
                          onSelect(h.invoiceNo);
                        }}
                        aria-label={`Open receipt ${h.invoiceNo}`}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--mg-noir)] text-[var(--mg-gold)]"
                      >
                        <Icon name="arrow" className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Modal>
      )}

      {/* ---------------------------- QR Code Popup ---------------------------- */}
      {modal === "qr" && (
        <Modal title="Receipt QR code" onClose={closeModal} scale={scale}>
          <div className="flex flex-col items-center py-2 text-center">
            <div className="mb-5 flex h-52 w-52 items-center justify-center rounded-3xl bg-white p-4 shadow-[0_20px_36px_-20px_rgba(20,16,14,0.6)] ring-4 ring-[var(--mg-gold)]/60">
              {qrSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrSrc} alt="Receipt QR code" className="h-full w-full object-contain" />
              ) : (
                <PlaceholderQR seed={data.invoiceNo} />
              )}
            </div>
            <p className="mg-bold text-[16px] tabular-nums text-[var(--mg-noir)]">Invoice #{data.invoiceNo}</p>
            <p className="mt-1 max-w-[280px] text-[14px] text-[var(--mg-muted)]">Scan this code at the store counter for instant returns or inquiries.</p>
          </div>
        </Modal>
      )}

      {/* ---------------------------- Email Popup ---------------------------- */}
      {modal === "email" && (
        <Modal title="Email this receipt" onClose={closeModal} scale={scale}>
          <form
            className="space-y-5"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!emailOk(email)) {
                setEmailErr("Enter a valid email address, like name@example.com.");
                return;
              }
              setEmailErr("");
              onSendEmail?.(email, data);
              setSentTo(email);
            }}
          >
            <label className="block">
              <span className={fieldLabel}>Email address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setSentTo("");
                  setEmailErr("");
                  setEmail(e.target.value);
                }}
                className={`${fieldInput} !bg-white`}
                autoComplete="email"
                aria-invalid={!!emailErr}
              />
              {emailErr && (
                <span role="alert" className="mg-bold mt-1.5 block text-[13px] text-[var(--mg-noir)]">
                  {emailErr}
                </span>
              )}
            </label>
            <button type="submit" className={solidBtn}>
              Send receipt
            </button>
            <p aria-live="polite" className={sentTo ? "mg-bold flex items-center justify-center gap-1.5 text-sm text-[var(--mg-noir)]" : "sr-only"}>
              {sentTo && (
                <>
                  <Icon name="check" className="h-4 w-4 text-[var(--mg-cognac)]" /> Receipt sent to {sentTo}
                </>
              )}
            </p>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* --------------------------------- main ------------------------------------------ */
export default function MangoReceiptV2({ data, receipts, onSelectReceipt, ...rest }: MangoReceiptProps) {
  const list = useMemo(() => {
    const base = receipts ?? (data ? [data] : sampleMangoReceipts);
    const merged = data && !base.some((r) => r.invoiceNo === data.invoiceNo) ? [data, ...base] : base;
    return [...merged].sort((a, b) => dateValue(b.date) - dateValue(a.date));
  }, [data, receipts]);

  const [currentId, setCurrentId] = useState(data?.invoiceNo ?? list[0].invoiceNo);
  const current = list.find((r) => r.invoiceNo === currentId) ?? list[0];

  const history = useMemo<HistoryRow[]>(
    () =>
      list.map((r) => {
        const t = totalsOf(r);
        return {
          invoiceNo: r.invoiceNo,
          date: r.date.split(" ")[0],
          storeName: r.store.name.replace(/^Mango\s*/i, ""),
          amount: t.total,
          items: t.pieces,
          current: r.invoiceNo === current.invoiceNo,
        };
      }),
    [list, current.invoiceNo],
  );

  const select = useCallback(
    (invoiceNo: string) => {
      setCurrentId(invoiceNo);
      onSelectReceipt?.(invoiceNo);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [onSelectReceipt],
  );

  return <ReceiptView key={current.invoiceNo} data={current} history={history} onSelect={select} {...rest} />;
}
