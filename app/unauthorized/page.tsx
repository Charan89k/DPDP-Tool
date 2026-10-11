import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <Card className="max-w-md w-full border-slate-800 bg-white shadow-xl">
        <CardContent className="p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-700">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-slate-900">
            403 — Access Restricted
          </h2>

          <p className="text-xs text-slate-600 leading-relaxed">
            You do not possess the required role permissions or assessment assignment scoping to access this compliance resource.
            Multi-tenant Row-Level Security policies prevent unauthorized cross-tenant operations.
          </p>

          <div className="pt-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-md hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-2" />
              Return to Safe Workspace
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

