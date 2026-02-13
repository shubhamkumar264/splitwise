"use client";

import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { useConvexQuery, useConvexMutation } from "@/hooks/use-convex-query";
import { BarLoader } from "react-spinners";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Users, ChevronRight, Pencil, Check, X } from "lucide-react";
import Link from "next/link";
import { ExpenseSummary } from "./components/expense-summary";
import { BalanceSummary } from "./components/balance-summary";
import { GroupList } from "./components/group-list";
import { toast } from "sonner";

export default function Dashboard() {
  const { data: balances, isLoading: balancesLoading } = useConvexQuery(
    api.dashboard.getUserBalances
  );
  const { data: currentUser } = useConvexQuery(api.users.getCurrentUser);
  const { data: groups, isLoading: groupsLoading } = useConvexQuery(
    api.dashboard.getUserGroups
  );
  const { data: totalSpent, isLoading: totalSpentLoading } = useConvexQuery(
    api.dashboard.getTotalSpent
  );
  const { data: monthlySpending, isLoading: monthlySpendingLoading } =
    useConvexQuery(api.dashboard.getMonthlySpending);

  const updateUpiId = useConvexMutation(api.users.updateUpiId);

  // UPI edit state
  const [isEditingUpi, setIsEditingUpi] = useState(false);
  const [upiInput, setUpiInput]         = useState("");
  const [upiSaving, setUpiSaving]       = useState(false);

  const isLoading =
    balancesLoading || groupsLoading || totalSpentLoading || monthlySpendingLoading;

  const handleEditUpi = () => {
    setUpiInput(currentUser?.upiId ?? "");
    setIsEditingUpi(true);
  };

  const handleCancelUpi = () => {
    setIsEditingUpi(false);
    setUpiInput("");
  };

  const handleSaveUpi = async () => {
    const trimmed = upiInput.trim();
    if (!trimmed) {
      toast.error("Please enter a valid UPI ID");
      return;
    }
    // Basic UPI format check: something@something
    if (!/^[\w.\-]+@[\w.\-]+$/.test(trimmed)) {
      toast.error("Enter a valid UPI ID (e.g. name@upi)");
      return;
    }
    setUpiSaving(true);
    try {
      await updateUpiId.mutate({ upiId: trimmed });
      toast.success("UPI ID saved successfully!");
      setIsEditingUpi(false);
      setUpiInput("");
    } catch (err) {
      toast.error("Failed to save UPI ID: " + err.message);
    } finally {
      setUpiSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {isLoading ? (
        <div className="w-full py-12 flex justify-center">
          <BarLoader width={"100%"} color="#36d7b7" />
        </div>
      ) : (
        <>
          <div className="flex justify-between flex-col sm:flex-row sm:items-center gap-4">
            <h1 className="text-5xl gradient-title">Dashboard</h1>
            <Button asChild>
              <Link href="/expenses/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add expense
              </Link>
            </Button>
          </div>

          {/* Balance overview cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Balance */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {balances?.totalBalance > 0 ? (
                    <span className="text-green-600">
                      +₹{balances?.totalBalance.toFixed(2)}
                    </span>
                  ) : balances?.totalBalance < 0 ? (
                    <span className="text-red-600">
                      -₹{Math.abs(balances?.totalBalance).toFixed(2)}
                    </span>
                  ) : (
                    <span>₹0.00</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {balances?.totalBalance > 0
                    ? "You are owed money"
                    : balances?.totalBalance < 0
                    ? "You owe money"
                    : "All settled up!"}
                </p>
              </CardContent>
            </Card>

            {/* Payment Methods / UPI ID */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  UPI ID
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isEditingUpi ? (
                  /* ── Edit mode ── */
                  <div className="space-y-2">
                    <Input
                      value={upiInput}
                      onChange={(e) => setUpiInput(e.target.value)}
                      placeholder="yourname@upi"
                      className="font-mono text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveUpi();
                        if (e.key === "Escape") handleCancelUpi();
                      }}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={handleSaveUpi}
                        disabled={upiSaving}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        {upiSaving ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelUpi}
                        disabled={upiSaving}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : currentUser?.upiId ? (
                  /* ── Has UPI ID ── */
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-mono font-medium truncate">
                        {currentUser.upiId}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Used for settlements
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleEditUpi}
                      className="shrink-0"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                  </div>
                ) : (
                  /* ── No UPI ID ── */
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-muted-foreground">No UPI ID added</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Add one so others can pay you
                      </p>
                    </div>
                    <Button size="sm" onClick={handleEditUpi} className="shrink-0">
                      <PlusCircle className="h-3.5 w-3.5 mr-1" />
                      Add
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* You are owed */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  You are owed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ₹{balances?.youAreOwed.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  From {balances?.oweDetails?.youAreOwedBy?.length || 0} people
                </p>
              </CardContent>
            </Card>

            {/* You owe */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  You owe
                </CardTitle>
              </CardHeader>
              <CardContent>
                {balances?.oweDetails?.youOwe?.length > 0 ? (
                  <>
                    <div className="text-2xl font-bold text-red-600">
                      ₹{balances?.youOwe.toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      To {balances?.oweDetails?.youOwe?.length || 0} people
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold">₹0.00</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      You don't owe anyone
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main dashboard content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              <ExpenseSummary
                monthlySpending={monthlySpending}
                totalSpent={totalSpent}
              />
            </div>

            {/* Right column */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle>Balance Details</CardTitle>
                    <Button variant="link" asChild className="p-0">
                      <Link href="/contacts">
                        View all
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <BalanceSummary balances={balances} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle>Your Groups</CardTitle>
                    <Button variant="link" asChild className="p-0">
                      <Link href="/contacts">
                        View all
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <GroupList groups={groups} />
                </CardContent>
                <CardFooter>
                  <Button variant="outline" asChild className="w-full">
                    <Link href="/contacts?createGroup=true">
                      <Users className="mr-2 h-4 w-4" />
                      Create new group
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}