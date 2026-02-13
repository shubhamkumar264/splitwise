// "use client";

// import { useState } from "react";
// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import * as z from "zod";
// import { api } from "@/convex/_generated/api";
// import { useConvexMutation, useConvexQuery } from "@/hooks/use-convex-query";
// import { Input } from "@/components/ui/input";
// import { Button } from "@/components/ui/button";
// import { Label } from "@/components/ui/label";
// import { Textarea } from "@/components/ui/textarea";
// import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// import { toast } from "sonner";
// import { useAction } from "convex/react";

// // ─── Form schema ─────────────────────────────────────────────
// const settlementSchema = z.object({
//   amount: z
//     .string()
//     .min(1, "Amount is required")
//     .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
//       message: "Amount must be a positive number",
//     }),
//   note: z.string().optional(),
//   paymentType: z.enum(["youPaid", "theyPaid"]),
// });

// const PAYMENT_METHODS = [
//   { id: "manual",   label: "Manual",   icon: "✏️" },
//   { id: "upi",      label: "UPI",      icon: "📲" },
//   { id: "razorpay", label: "Razorpay", icon: "💳" },
// ];

// function loadRazorpayScript() {
//   return new Promise((resolve) => {
//     if (typeof window !== "undefined" && window.Razorpay) return resolve(true);
//     const script = document.createElement("script");
//     script.src = "https://checkout.razorpay.com/v1/checkout.js";
//     script.onload = () => resolve(true);
//     script.onerror = () => resolve(false);
//     document.body.appendChild(script);
//   });
// }

// // ─── Main Component ───────────────────────────────────────────
// export default function SettlementForm({ entityType, entityData, onSuccess }) {
//   // ══ ALL hooks at the very top — no early returns above this block ══

//   const { data: currentUser } = useConvexQuery(api.users.getCurrentUser);
//   const createSettlement    = useConvexMutation(api.settlements.createSettlement);
//   const createPayment       = useConvexMutation(api.payments.createPayment);
//   const confirmPayment      = useConvexMutation(api.payments.confirmPayment);
//   const completeRazorpay    = useConvexMutation(api.payments.completeRazorpayPayment);
//   const createRazorpayOrder = useAction(api.razorpay.createRazorpayOrder);

//   // All useState — BEFORE any conditional return
//   const [paymentMethod,         setPaymentMethod]         = useState("manual");
//   const [selectedGroupMemberId, setSelectedGroupMemberId] = useState(null);
//   const [upiConfirmed,          setUpiConfirmed]          = useState(false);
//   const [upiPendingPaymentId,   setUpiPendingPaymentId]   = useState(null);

//   const {
//     register,
//     handleSubmit,
//     watch,
//     setValue,
//     formState: { errors, isSubmitting },
//   } = useForm({
//     resolver: zodResolver(settlementSchema),
//     defaultValues: { amount: "", note: "", paymentType: "youPaid" },
//   });

//   const paymentType = watch("paymentType");

//   // ── Early return only AFTER all hooks ────────────────────
//   if (!currentUser) return null;

//   // ── Derived values ────────────────────────────────────────
//   const otherUser =
//     entityType === "user"
//       ? entityData.counterpart
//       : entityData.balances?.find((m) => m.userId === selectedGroupMemberId) ?? null;

//   const otherUserId = otherUser?.userId ?? otherUser?.id;

//   // ── Helpers ───────────────────────────────────────────────
//   const resolvePayerReceiver = (data, targetUserId) => ({
//     paidByUserId:     data.paymentType === "youPaid" ? currentUser._id : targetUserId,
//     receivedByUserId: data.paymentType === "youPaid" ? targetUserId    : currentUser._id,
//   });

//   const recordSettlement = async (data, paidByUserId, receivedByUserId) => {
//     await createSettlement.mutate({
//       amount: parseFloat(data.amount),
//       note: data.note,
//       paidByUserId,
//       receivedByUserId,
//       ...(entityType === "group" && { groupId: entityData.group.id }),
//     });
//   };

//   // ── UPI handlers ─────────────────────────────────────────
//   const handleUpiSubmit = async (data) => {
//     if (!otherUser?.upiId) {
//       toast.error(`${otherUser?.name} has not set a UPI ID yet.`);
//       return;
//     }
//     const { receivedByUserId } = resolvePayerReceiver(data, otherUserId);
//     const upiUrl = `upi://pay?pa=${otherUser.upiId}&pn=${encodeURIComponent(otherUser.name)}&am=${parseFloat(data.amount).toFixed(2)}&cu=INR`;
//     window.open(upiUrl, "_blank");

//     const paymentId = await createPayment.mutate({
//       toUserId: receivedByUserId,
//       amount: parseFloat(data.amount),
//       method: "upi",
//     });

//     setUpiPendingPaymentId(paymentId);
//     setUpiConfirmed(true);
//     toast.info("Complete the UPI payment, then click Confirm below.");
//   };

//   const handleUpiConfirm = async (data) => {
//     try {
//       await confirmPayment.mutate({ paymentId: upiPendingPaymentId });
//       const { paidByUserId, receivedByUserId } = resolvePayerReceiver(data, otherUserId);
//       await recordSettlement(data, paidByUserId, receivedByUserId);
//       toast.success("UPI payment confirmed & settlement recorded!");
//       if (onSuccess) onSuccess();
//     } catch (err) {
//       toast.error("Failed to confirm: " + err.message);
//     }
//   };

//   // ── Razorpay handler ─────────────────────────────────────
//   const handleRazorpaySubmit = async (data) => {
//     const loaded = await loadRazorpayScript();
//     if (!loaded) { toast.error("Failed to load Razorpay SDK."); return; }

//     const amountInINR = parseFloat(data.amount);
//     try {
//       const order = await createRazorpayOrder({ amount: amountInINR });
//       const paymentId = await createPayment.mutate({
//         toUserId: otherUserId,
//         amount: amountInINR,
//         method: "razorpay",
//         razorpayOrderId: order.id,
//       });

//       const rzp = new window.Razorpay({
//         key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
//         amount: order.amount,
//         currency: order.currency,
//         order_id: order.id,
//         name: "Splitr",
//         description: data.note || "Settlement payment",
//         handler: async (response) => {
//           try {
//             await completeRazorpay.mutate({
//               paymentId,
//               razorpayPaymentId: response.razorpay_payment_id,
//             });
//             const { paidByUserId, receivedByUserId } = resolvePayerReceiver(data, otherUserId);
//             await recordSettlement(data, paidByUserId, receivedByUserId);
//             toast.success("Razorpay payment successful & settlement recorded!");
//             if (onSuccess) onSuccess();
//           } catch (err) {
//             toast.error("Payment succeeded but settlement failed: " + err.message);
//           }
//         },
//         prefill: { name: currentUser.name, email: currentUser.email },
//         theme: { color: "#000000" },
//         modal: { ondismiss: () => toast.info("Payment cancelled.") },
//       });
//       rzp.open();
//     } catch (err) {
//       toast.error("Razorpay order creation failed: " + err.message);
//     }
//   };

//   // ── Submit dispatcher ────────────────────────────────────
//   const onSubmit = async (data) => {
//     if (entityType === "group" && !selectedGroupMemberId) {
//       toast.error("Please select a group member to settle with");
//       return;
//     }
//     if (paymentMethod === "manual") {
//       try {
//         const { paidByUserId, receivedByUserId } = resolvePayerReceiver(data, otherUserId);
//         await recordSettlement(data, paidByUserId, receivedByUserId);
//         toast.success("Settlement recorded!");
//         if (onSuccess) onSuccess();
//       } catch (err) {
//         toast.error("Failed to record settlement: " + err.message);
//       }
//     } else if (paymentMethod === "upi") {
//       upiConfirmed ? await handleUpiConfirm(data) : await handleUpiSubmit(data);
//     } else if (paymentMethod === "razorpay") {
//       await handleRazorpaySubmit(data);
//     }
//   };

//   const submitLabel = isSubmitting
//     ? "Processing..."
//     : paymentMethod === "upi" && upiConfirmed
//     ? "Confirm Payment ✓"
//     : paymentMethod === "upi"
//     ? "Open UPI App →"
//     : paymentMethod === "razorpay"
//     ? "Pay with Razorpay →"
//     : "Record Settlement";

//   // ══════════════════════════════════════════════════════════
//   // JSX render functions (NOT React components — no PascalCase,
//   // no hooks inside, so they never affect the hook call count)
//   // ══════════════════════════════════════════════════════════

//   const renderPaymentMethodTabs = () => (
//     <div className="flex gap-2 p-1 bg-muted rounded-lg">
//       {PAYMENT_METHODS.map((m) => (
//         <button
//           key={m.id}
//           type="button"
//           onClick={() => {
//             setPaymentMethod(m.id);
//             setUpiConfirmed(false);
//             setUpiPendingPaymentId(null);
//           }}
//           className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all
//             ${paymentMethod === m.id
//               ? "bg-background shadow-sm text-foreground"
//               : "text-muted-foreground hover:text-foreground"}`}
//         >
//           <span>{m.icon}</span>
//           <span>{m.label}</span>
//         </button>
//       ))}
//     </div>
//   );

//   const renderWhoPaySection = (displayUser) => (
//     <div className="space-y-2">
//       <Label>Who paid?</Label>
//       <RadioGroup
//         value={paymentType}
//         className="flex flex-col space-y-2"
//         onValueChange={(value) => setValue("paymentType", value)}
//       >
//         <div className={`flex items-center space-x-2 border rounded-md p-3 transition-colors ${paymentType === "youPaid" ? "border-primary bg-primary/5" : ""}`}>
//           <RadioGroupItem value="youPaid" id="youPaid" />
//           <Label htmlFor="youPaid" className="flex-grow cursor-pointer">
//             <div className="flex items-center">
//               <Avatar className="h-6 w-6 mr-2">
//                 <AvatarImage src={currentUser.imageUrl} />
//                 <AvatarFallback>{currentUser.name?.charAt(0)}</AvatarFallback>
//               </Avatar>
//               <span>You paid {displayUser?.name}</span>
//             </div>
//           </Label>
//         </div>
//         <div className={`flex items-center space-x-2 border rounded-md p-3 transition-colors ${paymentType === "theyPaid" ? "border-primary bg-primary/5" : ""}`}>
//           <RadioGroupItem value="theyPaid" id="theyPaid" />
//           <Label htmlFor="theyPaid" className="flex-grow cursor-pointer">
//             <div className="flex items-center">
//               <Avatar className="h-6 w-6 mr-2">
//                 <AvatarImage src={displayUser?.imageUrl} />
//                 <AvatarFallback>{displayUser?.name?.charAt(0)}</AvatarFallback>
//               </Avatar>
//               <span>{displayUser?.name} paid you</span>
//             </div>
//           </Label>
//         </div>
//       </RadioGroup>
//     </div>
//   );

//   const renderAmountField = () => (
//     <div className="space-y-2">
//       <Label htmlFor="amount">Amount</Label>
//       <div className="relative">
//         <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
//         <Input
//           id="amount"
//           placeholder="0.00"
//           type="number"
//           step="0.01"
//           min="0.01"
//           className="pl-7"
//           {...register("amount")}
//         />
//       </div>
//       {errors.amount && <p className="text-sm text-red-500">{errors.amount.message}</p>}
//     </div>
//   );

//   const renderNoteField = () => (
//     <div className="space-y-2">
//       <Label htmlFor="note">Note (optional)</Label>
//       <Textarea id="note" placeholder="Dinner, rent, etc." {...register("note")} />
//     </div>
//   );

//   const renderUpiSection = (displayUser) => {
//     if (!displayUser?.upiId) {
//       return (
//         <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
//           ⚠️ <span className="font-medium">{displayUser?.name}</span> hasn't added a UPI ID yet.
//           They need to set one in their profile first.
//         </div>
//       );
//     }
//     return (
//       <div className="bg-muted/50 border rounded-lg p-4 space-y-2">
//         <p className="text-sm font-medium">Paying to UPI ID</p>
//         <div className="flex items-center gap-2">
//           <Avatar className="h-7 w-7">
//             <AvatarImage src={displayUser?.imageUrl} />
//             <AvatarFallback>{displayUser?.name?.charAt(0)}</AvatarFallback>
//           </Avatar>
//           <div>
//             <p className="text-sm font-semibold">{displayUser?.name}</p>
//             <p className="text-xs text-muted-foreground font-mono">{displayUser?.upiId}</p>
//           </div>
//         </div>
//         {upiConfirmed && (
//           <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-800 mt-2">
//             ✅ UPI app opened. Complete the payment then click <strong>Confirm Payment</strong>.
//           </div>
//         )}
//       </div>
//     );
//   };

//   const renderRazorpaySection = () => (
//     <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
//       💳 You'll be redirected to Razorpay's secure checkout. Cards, UPI, wallets & netbanking accepted.
//     </div>
//   );

//   const renderBalanceBanner = (netBalance, displayUser) => (
//     <div className="bg-muted p-4 rounded-lg">
//       <h3 className="font-medium mb-2">Current balance</h3>
//       {netBalance === 0 ? (
//         <p className="text-sm text-muted-foreground">You are settled up with {displayUser?.name}</p>
//       ) : netBalance > 0 ? (
//         <div className="flex justify-between items-center">
//           <p className="text-sm"><span className="font-medium">{displayUser?.name}</span> owes you</p>
//           <span className="text-xl font-bold text-green-600">₹{netBalance.toFixed(2)}</span>
//         </div>
//       ) : (
//         <div className="flex justify-between items-center">
//           <p className="text-sm">You owe <span className="font-medium">{displayUser?.name}</span></p>
//           <span className="text-xl font-bold text-red-600">₹{Math.abs(netBalance).toFixed(2)}</span>
//         </div>
//       )}
//     </div>
//   );

//   // ══════════════════════════════════════════════════════════
//   // RENDER: User settlement
//   // ══════════════════════════════════════════════════════════
//   if (entityType === "user") {
//     return (
//       <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
//         {renderBalanceBanner(entityData.netBalance, otherUser)}
//         {renderPaymentMethodTabs()}
//         {paymentMethod === "upi"      && renderUpiSection(otherUser)}
//         {paymentMethod === "razorpay" && renderRazorpaySection()}
//         {renderWhoPaySection(otherUser)}
//         {renderAmountField()}
//         {renderNoteField()}
//         <Button
//           type="submit"
//           className="w-full"
//           disabled={isSubmitting || (paymentMethod === "upi" && !otherUser?.upiId)}
//         >
//           {submitLabel}
//         </Button>
//       </form>
//     );
//   }

//   // ══════════════════════════════════════════════════════════
//   // RENDER: Group settlement
//   // ══════════════════════════════════════════════════════════
//   if (entityType === "group") {
//     const groupMembers   = entityData.balances;
//     const selectedMember = groupMembers.find((m) => m.userId === selectedGroupMemberId);

//     return (
//       <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
//         <div className="space-y-2">
//           <Label>Who are you settling with?</Label>
//           <div className="space-y-2">
//             {groupMembers.map((member) => {
//               const isSelected = selectedGroupMemberId === member.userId;
//               const isOwing    = member.netBalance < 0;
//               const isOwed     = member.netBalance > 0;
//               return (
//                 <div
//                   key={member.userId}
//                   className={`border rounded-md p-3 cursor-pointer transition-colors ${
//                     isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
//                   }`}
//                   onClick={() => {
//                     setSelectedGroupMemberId(member.userId);
//                     setUpiConfirmed(false);
//                     setUpiPendingPaymentId(null);
//                   }}
//                 >
//                   <div className="flex items-center justify-between">
//                     <div className="flex items-center gap-2">
//                       <Avatar className="h-8 w-8">
//                         <AvatarImage src={member.imageUrl} />
//                         <AvatarFallback>{member.name?.charAt(0)}</AvatarFallback>
//                       </Avatar>
//                       <span className="font-medium">{member.name}</span>
//                     </div>
//                     <div className={`text-sm font-medium ${isOwing ? "text-green-600" : isOwed ? "text-red-600" : "text-muted-foreground"}`}>
//                       {isOwing
//                         ? `They owe you ₹${Math.abs(member.netBalance).toFixed(2)}`
//                         : isOwed
//                         ? `You owe ₹${Math.abs(member.netBalance).toFixed(2)}`
//                         : "Settled up"}
//                     </div>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//           {!selectedGroupMemberId && (
//             <p className="text-sm text-amber-600">Please select a member to settle with</p>
//           )}
//         </div>

//         {selectedGroupMemberId && (
//           <>
//             {renderPaymentMethodTabs()}
//             {paymentMethod === "upi"      && renderUpiSection(selectedMember)}
//             {paymentMethod === "razorpay" && renderRazorpaySection()}
//             {renderWhoPaySection(selectedMember)}
//             {renderAmountField()}
//             {renderNoteField()}
//           </>
//         )}

//         <Button
//           type="submit"
//           className="w-full"
//           disabled={
//             isSubmitting ||
//             !selectedGroupMemberId ||
//             (paymentMethod === "upi" && !selectedMember?.upiId)
//           }
//         >
//           {submitLabel}
//         </Button>
//       </form>
//     );
//   }

//   return null;
// }
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/hooks/use-convex-query";
import { useAction } from "convex/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Smartphone, QrCode, CheckCircle2, ExternalLink } from "lucide-react";

// ─── Form schema ─────────────────────────────────────────────
const settlementSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: "Amount must be a positive number",
    }),
  note: z.string().optional(),
  paymentType: z.enum(["youPaid", "theyPaid"]),
});

const PAYMENT_METHODS = [
  { id: "manual",   label: "Manual",   icon: "✏️" },
  { id: "upi",      label: "UPI",      icon: "📲" },
  { id: "razorpay", label: "Razorpay", icon: "💳" },
];

// Popular UPI apps with their deep-link schemes
const UPI_APPS = [
  {
    name: "GPay",
    scheme: "gpay://upi/pay",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Google_Pay_Logo.svg/120px-Google_Pay_Logo.svg.png",
    color: "#4285F4",
  },
  {
    name: "PhonePe",
    scheme: "phonepe://pay",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/PhonePe_Logo.svg/120px-PhonePe_Logo.svg.png",
    color: "#5F259F",
  },
  {
    name: "Paytm",
    scheme: "paytm://upi/pay",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Paytm_Logo_%28standalone%29.svg/120px-Paytm_Logo_%28standalone%29.svg.png",
    color: "#00B9F1",
  },
  {
    name: "BHIM",
    scheme: "upi://pay",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/BHIM_logo.svg/120px-BHIM_logo.svg.png",
    color: "#004C97",
  },
];

function buildUpiUrl(upiId, name, amount, note = "") {
  const params = new URLSearchParams({
    pa: upiId,
    pn: name,
    am: parseFloat(amount).toFixed(2),
    cu: "INR",
    ...(note && { tn: note }),
  });
  return `upi://pay?${params.toString()}`;
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ─── UPI Payment Modal ────────────────────────────────────────
function UpiPaymentModal({ open, onClose, onConfirm, upiUrl, otherUser, amount, note }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [confirming, setConfirming] = useState(false);

  // Generate QR code when modal opens
  useEffect(() => {
    if (!open || !upiUrl) return;
    let cancelled = false;

    async function generateQr() {
      try {
        // Dynamically import qrcode to keep bundle lean
        const QRCode = (await import("qrcode")).default;
        const dataUrl = await QRCode.toDataURL(upiUrl, {
          width: 200,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        // qrcode not installed — skip QR silently, app buttons still work
        if (!cancelled) setQrDataUrl(null);
      }
    }

    generateQr();
    return () => { cancelled = true; };
  }, [open, upiUrl]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  if (!open) return null;

  return (
    // ── Full-screen backdrop ──────────────────────────────────
    <div
      className="fixed inset-0 z-50 bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* ── Sheet: scrollable, centered on desktop / bottom on mobile ── */}
      <div
        className="absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4"
        style={{ pointerEvents: "none" }}
      >
        <div
          className="bg-background w-full sm:max-w-sm sm:rounded-xl rounded-t-xl shadow-xl flex flex-col"
          style={{
            maxHeight: "90dvh",
            pointerEvents: "auto",
          }}
        >
          {/* ── Fixed header ── */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b shrink-0">
            <div className="flex items-center gap-2 font-semibold text-base">
              <Smartphone className="h-5 w-5" />
              Pay via UPI
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            >
              ✕
            </button>
          </div>

          {/* ── Scrollable content ── */}
          <div
            className="px-5 py-4 space-y-5"
            style={{ overflowY: "auto", flex: 1 }}
          >
            {/* Recipient info */}
            <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={otherUser?.imageUrl} />
                <AvatarFallback>{otherUser?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{otherUser?.name}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{otherUser?.upiId}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-base">₹{parseFloat(amount || 0).toFixed(2)}</p>
                {note && <p className="text-xs text-muted-foreground">{note}</p>}
              </div>
            </div>

            {/* UPI App buttons */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Open with app
              </p>
              <div className="grid grid-cols-4 gap-2">
                {UPI_APPS.map((app) => {
                  const appUrl = upiUrl.replace("upi://pay", app.scheme);
                  return (
                    <a
                      key={app.name}
                      href={appUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1.5 p-2 rounded-lg border hover:bg-muted/60 transition-colors"
                    >
                      <img
                        src={app.icon}
                        alt={app.name}
                        className="h-8 w-8 object-contain rounded"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "flex";
                        }}
                      />
                      <div
                        className="h-8 w-8 rounded items-center justify-center text-white text-xs font-bold hidden"
                        style={{ backgroundColor: app.color }}
                      >
                        {app.name[0]}
                      </div>
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">
                        {app.name}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Any UPI app fallback */}
            <a
              href={upiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full border rounded-md py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open any UPI app
            </a>

            {/* QR Code */}
            {qrDataUrl && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <QrCode className="h-3.5 w-3.5" />
                  Or scan QR code
                </div>
                <div className="border rounded-lg p-3 bg-white">
                  <img src={qrDataUrl} alt="UPI QR Code" className="h-40 w-40" />
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  Scan with GPay, PhonePe, Paytm, BHIM or any UPI app
                </p>
              </div>
            )}
          </div>

          {/* ── Sticky footer ── */}
          <div className="px-5 py-4 border-t bg-background shrink-0 space-y-2">
            <p className="text-xs text-muted-foreground text-center">
              Once payment is done, confirm to record the settlement.
            </p>
            <Button className="w-full" onClick={handleConfirm} disabled={confirming}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {confirming ? "Recording..." : "I've paid — Confirm Settlement"}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground text-sm"
              onClick={onClose}
              disabled={confirming}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function SettlementForm({ entityType, entityData, onSuccess }) {
  const { data: currentUser } = useConvexQuery(api.users.getCurrentUser);
  const createSettlement    = useConvexMutation(api.settlements.createSettlement);
  const createPayment       = useConvexMutation(api.payments.createPayment);
  const confirmPayment      = useConvexMutation(api.payments.confirmPayment);
  const completeRazorpay    = useConvexMutation(api.payments.completeRazorpayPayment);
  const createRazorpayOrder = useAction(api.razorpay.createRazorpayOrder);

  const [paymentMethod,         setPaymentMethod]         = useState("manual");
  const [selectedGroupMemberId, setSelectedGroupMemberId] = useState(null);
  const [upiModalOpen,          setUpiModalOpen]          = useState(false);
  const [upiPendingPaymentId,   setUpiPendingPaymentId]   = useState(null);
  const [upiUrl,                setUpiUrl]                = useState("");
  const [pendingFormData,       setPendingFormData]       = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(settlementSchema),
    defaultValues: { amount: "", note: "", paymentType: "youPaid" },
  });

  const paymentType = watch("paymentType");
  const amountValue = watch("amount");

  if (!currentUser) return null;

  const otherUser =
    entityType === "user"
      ? entityData.counterpart
      : entityData.balances?.find((m) => m.userId === selectedGroupMemberId) ?? null;

  const otherUserId = otherUser?.userId ?? otherUser?.id;

  const resolvePayerReceiver = (data, targetUserId) => ({
    paidByUserId:     data.paymentType === "youPaid" ? currentUser._id : targetUserId,
    receivedByUserId: data.paymentType === "youPaid" ? targetUserId    : currentUser._id,
  });

  const recordSettlement = async (data, paidByUserId, receivedByUserId) => {
    await createSettlement.mutate({
      amount: parseFloat(data.amount),
      note: data.note,
      paidByUserId,
      receivedByUserId,
      ...(entityType === "group" && { groupId: entityData.group.id }),
    });
  };

  // ── UPI: open modal with QR + app links ──────────────────
  const handleUpiSubmit = async (data) => {
    const { receivedByUserId } = resolvePayerReceiver(data, otherUserId);

    // Create payment record first
    const paymentId = await createPayment.mutate({
      toUserId: receivedByUserId,
      amount: parseFloat(data.amount),
      method: "upi",
    });

    const url = buildUpiUrl(otherUser.upiId, otherUser.name, data.amount, data.note);
    setUpiUrl(url);
    setUpiPendingPaymentId(paymentId);
    setPendingFormData(data);
    setUpiModalOpen(true);
  };

  // ── UPI: user confirmed payment in modal ──────────────────
  const handleUpiConfirm = async () => {
    try {
      await confirmPayment.mutate({ paymentId: upiPendingPaymentId });
      const { paidByUserId, receivedByUserId } = resolvePayerReceiver(pendingFormData, otherUserId);
      await recordSettlement(pendingFormData, paidByUserId, receivedByUserId);
      setUpiModalOpen(false);
      toast.success("UPI payment confirmed & settlement recorded!");
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error("Failed to confirm: " + err.message);
    }
  };

  // ── Razorpay ──────────────────────────────────────────────
  const handleRazorpaySubmit = async (data) => {
    const loaded = await loadRazorpayScript();
    if (!loaded) { toast.error("Failed to load Razorpay SDK."); return; }

    const amountInINR = parseFloat(data.amount);
    try {
      const order = await createRazorpayOrder({ amount: amountInINR });
      const paymentId = await createPayment.mutate({
        toUserId: otherUserId,
        amount: amountInINR,
        method: "razorpay",
        razorpayOrderId: order.id,
      });

      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "Splitr",
        description: data.note || "Settlement payment",
        handler: async (response) => {
          try {
            await completeRazorpay.mutate({
              paymentId,
              razorpayPaymentId: response.razorpay_payment_id,
            });
            const { paidByUserId, receivedByUserId } = resolvePayerReceiver(data, otherUserId);
            await recordSettlement(data, paidByUserId, receivedByUserId);
            toast.success("Razorpay payment successful & settlement recorded!");
            if (onSuccess) onSuccess();
          } catch (err) {
            toast.error("Payment succeeded but settlement failed: " + err.message);
          }
        },
        prefill: { name: currentUser.name, email: currentUser.email },
        theme: { color: "#000000" },
        modal: { ondismiss: () => toast.info("Payment cancelled.") },
      });
      rzp.open();
    } catch (err) {
      toast.error("Razorpay order creation failed: " + err.message);
    }
  };

  // ── Submit dispatcher ────────────────────────────────────
  const onSubmit = async (data) => {
    if (entityType === "group" && !selectedGroupMemberId) {
      toast.error("Please select a group member to settle with");
      return;
    }
    if (paymentMethod === "manual") {
      try {
        const { paidByUserId, receivedByUserId } = resolvePayerReceiver(data, otherUserId);
        await recordSettlement(data, paidByUserId, receivedByUserId);
        toast.success("Settlement recorded!");
        if (onSuccess) onSuccess();
      } catch (err) {
        toast.error("Failed to record settlement: " + err.message);
      }
    } else if (paymentMethod === "upi") {
      await handleUpiSubmit(data);
    } else if (paymentMethod === "razorpay") {
      await handleRazorpaySubmit(data);
    }
  };

  const submitLabel = isSubmitting
    ? "Processing..."
    : paymentMethod === "upi"
    ? "Continue to UPI Payment →"
    : paymentMethod === "razorpay"
    ? "Pay with Razorpay →"
    : "Record Settlement";

  // ── JSX render helpers ───────────────────────────────────

  const renderPaymentMethodTabs = () => (
    <div className="flex gap-2 p-1 bg-muted rounded-lg">
      {PAYMENT_METHODS.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => setPaymentMethod(m.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all
            ${paymentMethod === m.id
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"}`}
        >
          <span>{m.icon}</span>
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  );

  const renderWhoPaySection = (displayUser) => (
    <div className="space-y-2">
      <Label>Who paid?</Label>
      <RadioGroup
        value={paymentType}
        className="flex flex-col space-y-2"
        onValueChange={(value) => setValue("paymentType", value)}
      >
        <div className={`flex items-center space-x-2 border rounded-md p-3 transition-colors ${paymentType === "youPaid" ? "border-primary bg-primary/5" : ""}`}>
          <RadioGroupItem value="youPaid" id="youPaid" />
          <Label htmlFor="youPaid" className="flex-grow cursor-pointer">
            <div className="flex items-center">
              <Avatar className="h-6 w-6 mr-2">
                <AvatarImage src={currentUser.imageUrl} />
                <AvatarFallback>{currentUser.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <span>You paid {displayUser?.name}</span>
            </div>
          </Label>
        </div>
        <div className={`flex items-center space-x-2 border rounded-md p-3 transition-colors ${paymentType === "theyPaid" ? "border-primary bg-primary/5" : ""}`}>
          <RadioGroupItem value="theyPaid" id="theyPaid" />
          <Label htmlFor="theyPaid" className="flex-grow cursor-pointer">
            <div className="flex items-center">
              <Avatar className="h-6 w-6 mr-2">
                <AvatarImage src={displayUser?.imageUrl} />
                <AvatarFallback>{displayUser?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <span>{displayUser?.name} paid you</span>
            </div>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );

  const renderAmountField = () => (
    <div className="space-y-2">
      <Label htmlFor="amount">Amount</Label>
      <div className="relative">
        <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
        <Input
          id="amount"
          placeholder="0.00"
          type="number"
          step="0.01"
          min="0.01"
          className="pl-7"
          {...register("amount")}
        />
      </div>
      {errors.amount && <p className="text-sm text-red-500">{errors.amount.message}</p>}
    </div>
  );

  const renderNoteField = () => (
    <div className="space-y-2">
      <Label htmlFor="note">Note (optional)</Label>
      <Textarea id="note" placeholder="Dinner, rent, etc." {...register("note")} />
    </div>
  );

  const renderUpiSection = (displayUser) => {
    if (!displayUser?.upiId) {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          ⚠️ <span className="font-medium">{displayUser?.name}</span> hasn't added a UPI ID yet.
          They need to set one in their profile first.
        </div>
      );
    }
    return (
      <div className="bg-muted/50 border rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium">Paying to</p>
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={displayUser?.imageUrl} />
            <AvatarFallback>{displayUser?.name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold">{displayUser?.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{displayUser?.upiId}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          After clicking continue, you'll see UPI app options and a QR code to complete the payment.
        </p>
      </div>
    );
  };

  const renderRazorpaySection = () => (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
      💳 You'll be redirected to Razorpay's secure checkout. Cards, UPI, wallets & netbanking accepted.
    </div>
  );

  const renderBalanceBanner = (netBalance, displayUser) => (
    <div className="bg-muted p-4 rounded-lg">
      <h3 className="font-medium mb-2">Current balance</h3>
      {netBalance === 0 ? (
        <p className="text-sm text-muted-foreground">You are settled up with {displayUser?.name}</p>
      ) : netBalance > 0 ? (
        <div className="flex justify-between items-center">
          <p className="text-sm"><span className="font-medium">{displayUser?.name}</span> owes you</p>
          <span className="text-xl font-bold text-green-600">₹{netBalance.toFixed(2)}</span>
        </div>
      ) : (
        <div className="flex justify-between items-center">
          <p className="text-sm">You owe <span className="font-medium">{displayUser?.name}</span></p>
          <span className="text-xl font-bold text-red-600">₹{Math.abs(netBalance).toFixed(2)}</span>
        </div>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // RENDER: User settlement
  // ══════════════════════════════════════════════════════════
  if (entityType === "user") {
    return (
      <>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {renderBalanceBanner(entityData.netBalance, otherUser)}
          {renderPaymentMethodTabs()}
          {paymentMethod === "upi"      && renderUpiSection(otherUser)}
          {paymentMethod === "razorpay" && renderRazorpaySection()}
          {renderWhoPaySection(otherUser)}
          {renderAmountField()}
          {renderNoteField()}
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || (paymentMethod === "upi" && !otherUser?.upiId)}
          >
            {submitLabel}
          </Button>
        </form>

        <UpiPaymentModal
          open={upiModalOpen}
          onClose={() => setUpiModalOpen(false)}
          onConfirm={handleUpiConfirm}
          upiUrl={upiUrl}
          otherUser={otherUser}
          amount={pendingFormData?.amount ?? ""}
          note={pendingFormData?.note ?? ""}
        />
      </>
    );
  }

  // ══════════════════════════════════════════════════════════
  // RENDER: Group settlement
  // ══════════════════════════════════════════════════════════
  if (entityType === "group") {
    const groupMembers   = entityData.balances;
    const selectedMember = groupMembers.find((m) => m.userId === selectedGroupMemberId);

    return (
      <>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label>Who are you settling with?</Label>
            <div className="space-y-2">
              {groupMembers.map((member) => {
                const isSelected = selectedGroupMemberId === member.userId;
                const isOwing    = member.netBalance < 0;
                const isOwed     = member.netBalance > 0;
                return (
                  <div
                    key={member.userId}
                    className={`border rounded-md p-3 cursor-pointer transition-colors ${
                      isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedGroupMemberId(member.userId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.imageUrl} />
                          <AvatarFallback>{member.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{member.name}</span>
                      </div>
                      <div className={`text-sm font-medium ${isOwing ? "text-green-600" : isOwed ? "text-red-600" : "text-muted-foreground"}`}>
                        {isOwing
                          ? `They owe you ₹${Math.abs(member.netBalance).toFixed(2)}`
                          : isOwed
                          ? `You owe ₹${Math.abs(member.netBalance).toFixed(2)}`
                          : "Settled up"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {!selectedGroupMemberId && (
              <p className="text-sm text-amber-600">Please select a member to settle with</p>
            )}
          </div>

          {selectedGroupMemberId && (
            <>
              {renderPaymentMethodTabs()}
              {paymentMethod === "upi"      && renderUpiSection(selectedMember)}
              {paymentMethod === "razorpay" && renderRazorpaySection()}
              {renderWhoPaySection(selectedMember)}
              {renderAmountField()}
              {renderNoteField()}
            </>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={
              isSubmitting ||
              !selectedGroupMemberId ||
              (paymentMethod === "upi" && !selectedMember?.upiId)
            }
          >
            {submitLabel}
          </Button>
        </form>

        <UpiPaymentModal
          open={upiModalOpen}
          onClose={() => setUpiModalOpen(false)}
          onConfirm={handleUpiConfirm}
          upiUrl={upiUrl}
          otherUser={selectedMember}
          amount={pendingFormData?.amount ?? ""}
          note={pendingFormData?.note ?? ""}
        />
      </>
    );
  }

  return null;
}