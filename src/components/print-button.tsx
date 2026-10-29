"use client";

import React from "react";
import { Printer } from "lucide-react";
import { Button } from "./ui/button";

export default function PrintButton() {
  return (
    <Button
      size="sm"
      onClick={() => window.print()}
      className="gap-1.5 shadow-sm"
    >
      <Printer className="h-4 w-4" />
      <span>Print Receipt</span>
    </Button>
  );
}
