import React from "react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import { Download, ArrowLeft } from "lucide-react";
import autoTable from "jspdf-autotable";

const BillPage: React.FC = () => {
    const [order, setOrder] = useState<any>(null);

    useEffect(() => {
        loadOrder();
    }, []);

    async function loadOrder() {
        const id = new URLSearchParams(window.location.search).get("id");

        const { data } = await supabase
            .from("orders")
            .select(
                `
        *,
        order_items(*)
      `,
            )
            .eq("id", id)
            .single();

        setOrder(data);
    }

    async function downloadBill() {
        // Check if order data is available
        if (!order) {
            console.error("Order data not available");
            return;
        }

        const pdf = new jsPDF();

        // Header with decorative elements
        pdf.setDrawColor(201, 169, 110);
        pdf.setLineWidth(0.5);

        pdf.setFont("times", "bold");
        pdf.setFontSize(28);

        pdf.text("The Golden Brew", 105, 25, {
            align: "center",
        });

        pdf.setFont("times", "italic");
        pdf.setFontSize(14);

        pdf.text("Tax Invoice", 105, 34, {
            align: "center",
        });

        // Decorative line
        pdf.setLineWidth(0.2);
        pdf.line(20, 40, 190, 40);
        
        // Remove gradient and use solid color instead
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);

        pdf.text(`Invoice #TT-${order.id}`, 105, 48, {
            align: "center",
        });

        pdf.setFont("times", "italic");
        pdf.setFontSize(11);

        pdf.text("Crafted with passion • Served with love", 105, 55, {
            align: "center",
        });

        // Order Info Section
        pdf.setFont("times", "normal");
        pdf.setFontSize(11);
        
        // Add a decorative border around order info
        pdf.setLineWidth(0.3);
        pdf.roundedRect(20, 65, 170, 25, 4, 4, "S");
        
        pdf.text(
            `Date: ${new Date(order.created_at).toLocaleString()}`,
            25,
            75,
        );

        // Status badge with better styling
        const statusColor: [number, number, number] = order.is_paid ? [34, 197, 94] : [220, 53, 69];
        const statusTextColor: [number, number, number] = [255, 255, 255];
        
        pdf.setFillColor(...statusColor);
        pdf.roundedRect(150, 68, 30, 10, 2, 2, "F");
        
        pdf.setTextColor(...statusTextColor);
        pdf.text(order.is_paid ? "PAID" : "UNPAID", 165, 75, {
            align: "center",
        });
        
        pdf.setTextColor(0, 0, 0);

        // Enhanced table with better styling
        autoTable(pdf, {
            startY: 100,
            head: [["Item", "Qty", "Amount"]],
            body:
                order.order_items?.map((item: any) => [
                    item.item_name,
                    item.quantity,
                    `Rs. ${item.price * item.quantity}`,
                ]) || [],
            theme: "grid",
            headStyles: {
                fillColor: [201, 169, 110],
                textColor: [20, 20, 20],
                fontStyle: "bold",
                fontSize: 12,
                cellPadding: { top: 8, bottom: 8, left: 5, right: 5 },
            },
            bodyStyles: {
                fontSize: 11,
                cellPadding: { top: 6, bottom: 6, left: 5, right: 5 },
            },
            alternateRowStyles: {
                fillColor: [248, 248, 248],
            },
            margin: {
                left: 20,
                right: 20,
            },
            tableWidth: "wrap",
            columnStyles: {
                0: { cellWidth: 70 },
                1: { cellWidth: 20 },
                2: { cellWidth: 40 }
            }
        });

        const finalY = (pdf as any).lastAutoTable.finalY + 15;

        // Premium total card with enhanced styling
        pdf.setDrawColor(201, 169, 110);
        pdf.setLineWidth(1.5);

        // Luxury border with gold accent - using solid color instead of gradient
        pdf.roundedRect(102, finalY, 90, 48, 6, 6, "S");
        
        // Solid background color instead of gradient-like effect
        pdf.setFillColor(252, 249, 244);
        pdf.roundedRect(102, finalY, 90, 48, 6, 6, "F");

        pdf.setFont("times", "normal");
        pdf.setFontSize(11);

        // Enhanced total calculations
        pdf.text("Subtotal", 118, finalY + 12);
        pdf.text(`Rs. ${order.subtotal}`, 168, finalY + 12);

        pdf.text("Tax", 118, finalY + 22);
        pdf.text(`Rs. ${order.tax}`, 168, finalY + 22);

        pdf.setFont("times", "bold");
        pdf.setFontSize(15);

        pdf.text("Grand Total", 118, finalY + 36);
        pdf.text(`Rs. ${order.total}`, 168, finalY + 36);

        // Enhanced footer with decorative elements
        pdf.setFont("times", "italic");
        pdf.setFontSize(12);

        const footerY = finalY + 70;

        pdf.text("Crafted with passion • Served with love", 105, footerY, {
            align: "center",
        });

        pdf.text("Thank you for choosing The Golden Brew", 105, footerY + 10, {
            align: "center",
        });

        // Add decorative elements
        pdf.setLineWidth(0.3);
        pdf.line(20, footerY + 18, 190, footerY + 18);
        
        pdf.setFont("times", "bold");
        pdf.setFontSize(10);
        pdf.text("GSTIN: 12ABCDE1234567890", 105, footerY + 25, {
            align: "center",
        });

        pdf.save(`Invoice-Order-${order.id}.pdf`);
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-[#FAF8F5] text-[#1F1B18] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#FAF3E6] border border-[#ECD7A9] flex items-center justify-center text-sm animate-pulse">
                        ☕
                    </div>
                    <p className="text-xs uppercase tracking-[0.18em] font-semibold text-[#78716A]">Loading Bill...</p>
                </div>
            </div>
        );
    }
    return (
        <div className="min-h-screen bg-[#FAF8F5] text-[#1F1B18] font-sans pb-24">
            {/* Top App Bar */}
            <header className="sticky top-0 z-50 flex items-center w-full h-16 px-4 border-b bg-[#FAF8F5]/95 backdrop-blur-md border-[#E8E2D8]">
                <button
                    onClick={() => window.history.back()}
                    className="p-2 transition-colors hover:bg-muted/70 rounded-full"
                >
                    <ArrowLeft className="w-5 h-5 text-[#B58428]" />
                </button>

                <div className="flex-1 text-center">
                    <h1 className="text-lg font-serif font-bold text-[#B58428]">
                        Invoice Details
                    </h1>
                </div>

                <div className="w-10" />
            </header>

            <main className="max-w-md mx-auto p-4 space-y-6">
                {/* Invoice Card */}
                <div
                    id="invoice-card"
                    className="relative overflow-hidden border rounded-2xl bg-white border-[#E8E2D8] shadow-xs"
                >
                    {/* Decorative Gradient Background */}
                    <div className="absolute inset-0 opacity-20 bg-gradient-to-b from-[#B58428]/15 to-transparent pointer-events-none" />

                    <div className="relative p-6 space-y-7">
                        {/* Logo & Branding */}
                        <div className="flex flex-col items-center text-center space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-[#FAF3E6] border border-[#ECD7A9] flex items-center justify-center text-lg shadow-2xs">
                                ☕
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold font-serif text-[#1F1B18] tracking-tight">
                                    The Golden Brew
                                </h2>
                                <p className="text-[11px] tracking-[0.2em] uppercase text-[#78716A] mt-0.5">
                                    Crafted with passion, served with love
                                </p>
                            </div>
                            <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#B58428]/30 to-transparent" />
                            <h3 className="text-base font-serif italic text-[#78716A]">
                                Bill of Services
                            </h3>
                        </div>

                        {/* Metadata Grid */}
                        <div className="grid grid-cols-2 gap-y-5 text-sm bg-[#FAF8F5] p-4 rounded-xl border border-[#E8E2D8]">
                            <div className="space-y-0.5">
                                <p className="text-[10px] uppercase font-bold tracking-wider text-[#78716A]">
                                    Order Reference
                                </p>
                                <p className="font-mono font-bold text-[#1F1B18]">
                                    #{order.id}
                                </p>
                            </div>
                            <div className="space-y-0.5 text-right">
                                <p className="text-[10px] uppercase font-bold tracking-wider text-[#78716A]">
                                    Table
                                </p>
                                <p className="font-bold text-[#1F1B18]">
                                    Table {order.table_id || "-"}
                                </p>
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-[10px] uppercase font-bold tracking-wider text-[#78716A]">
                                    Date & Time
                                </p>
                                <p className="text-xs text-[#78716A] font-medium">
                                    {new Date(
                                        order.created_at,
                                    ).toLocaleString("en-IN", {
                                        day: "numeric",
                                        month: "short",
                                        hour: "numeric",
                                        minute: "2-digit",
                                    })}
                                </p>
                            </div>
                            <div className="space-y-0.5 text-right">
                                <p className="text-[10px] uppercase font-bold tracking-wider text-[#78716A]">
                                    Status
                                </p>
                                <span
                                    className={`inline-block px-2.5 py-0.5 text-[10px] font-bold border rounded-full ${
                                        order.is_paid
                                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                                            : "border-amber-500/40 bg-amber-500/10 text-amber-800"
                                    }`}
                                >
                                    {order.is_paid ? "PAID" : "UNPAID"}
                                </span>
                            </div>
                        </div>

                        {/* Itemized List */}
                        <div className="space-y-3.5">
                            {order.order_items?.map((item: any) => (
                                <div
                                    key={item.id}
                                    className="flex items-baseline justify-between text-sm"
                                >
                                    <div className="flex items-baseline space-x-2">
                                        <span className="text-[#B58428] font-bold text-xs">
                                            {item.quantity}x
                                        </span>

                                        <span className="text-[#1F1B18] font-medium">
                                            {item.item_name}
                                        </span>
                                    </div>

                                    <div className="flex-1 mx-3 border-b border-dotted border-[#E8E2D8]" />

                                    <span className="font-serif font-bold text-[#1F1B18]">
                                        ₹{item.price * item.quantity}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="h-px bg-[#E8E2D8]" />

                        {/* Totals Section */}
                        <div className="space-y-2.5">
                            <div className="flex justify-between text-sm text-[#78716A]">
                                <span className="font-medium text-xs uppercase tracking-wider">Subtotal</span>
                                <span className="text-[#1F1B18] font-serif font-bold">
                                    ₹{order.subtotal}
                                </span>
                            </div>
                            {order.tax > 0 && (
                                <div className="flex justify-between text-sm text-[#78716A]">
                                    <span className="font-medium text-xs uppercase tracking-wider">Tax</span>
                                    <span className="text-[#1F1B18] font-serif font-bold">
                                        ₹{order.tax}
                                    </span>
                                </div>
                            )}
                            <div className="pt-3 border-t border-[#E8E2D8] flex justify-between items-baseline">
                                <span className="text-base font-serif font-bold text-[#1F1B18]">
                                    GRAND TOTAL
                                </span>
                                <span className="text-2xl font-serif font-bold text-[#B58428]">
                                    ₹{order.total}
                                </span>
                            </div>
                        </div>

                        {/* Footer Message */}
                        <div className="pt-4 text-center border-t border-dashed border-[#E8E2D8]">
                            <p className="text-xs italic text-[#78716A] font-serif">
                                "Thank you for dining with us"
                            </p>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                    <div
                        className={`grid gap-3 ${order.is_paid ? "grid-cols-1" : "grid-cols-2"}`}
                    >
                        <button
                            onClick={downloadBill}
                            className="flex items-center justify-center py-3.5 space-x-2 border rounded-xl border-[#E8E2D8] bg-white hover:bg-[#FAF8F5] text-[#1F1B18] text-sm font-bold shadow-xs transition-colors"
                        >
                            <Download className="w-4 h-4 text-[#B58428]" />
                            <span>Download Bill</span>
                        </button>

                        {!order.is_paid && (
                            <button className="flex items-center justify-center py-3.5 space-x-2 border rounded-xl border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-xs transition-colors">
                                <span>💳</span>
                                <span>Pay Now</span>
                            </button>
                        )}
                    </div>
                </div>
            </main>

            {/* Bottom Navigation */}
            {/* <nav className="fixed bottom-0 left-0 flex items-center justify-around w-full h-16 py-2 border-t bg-[#1c1b1b] border-white/5 pb-safe">
                <button className="flex flex-col items-center justify-center space-y-1 text-gray-400 hover:text-[#c9a96e] transition-colors">
                    <Utensils className="w-5 h-5" />
                    <span className="text-[10px]">Menus</span>
                </button>
                <button className="flex flex-col items-center justify-center space-y-1 text-gray-400 hover:text-[#c9a96e] transition-colors">
                    <ClipboardList className="w-5 h-5" />
                    <span className="text-[10px]">Orders</span>
                </button>
                <button className="flex flex-col items-center justify-center px-3 py-1 space-y-1 rounded-xl bg-[#c9a96e]/10 text-[#c9a96e]">
                    <Wallet className="w-5 h-5" />
                    <span className="text-[10px]">Invoices</span>
                </button>
                <button className="flex flex-col items-center justify-center space-y-1 text-gray-400 hover:text-[#c9a96e] transition-colors">
                    <Settings className="w-5 h-5" />
                    <span className="text-[10px]">Settings</span>
                </button>
            </nav> */}
        </div>
    );
};

export default BillPage;
