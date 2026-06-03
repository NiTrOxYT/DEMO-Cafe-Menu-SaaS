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
        const pdf = new jsPDF();

        // Header
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

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);

        pdf.text(`Invoice #TT-${order.id}`, 105, 42, {
            align: "center",
        });

        pdf.setFont("times", "italic");
        pdf.setFontSize(11);

        pdf.text("Crafted with passion • Served with love", 105, 49, {
            align: "center",
        });

        pdf.line(20, 56, 190, 56);

        // Order Info
        pdf.setFont("times", "normal");
        pdf.setFontSize(11);

        pdf.text(
            `Date: ${new Date(order.created_at).toLocaleString()}`,
            25,
            63,
        );

        pdf.setFillColor(
            order.is_paid ? 34 : 220,
            order.is_paid ? 197 : 53,
            order.is_paid ? 94 : 69,
        );

        pdf.roundedRect(150, 60, 30, 10, 2, 2, "F");

        pdf.setTextColor(255, 255, 255);

        pdf.text(order.is_paid ? "PAID" : "UNPAID", 165, 67, {
            align: "center",
        });

        pdf.setTextColor(0, 0, 0);

        autoTable(pdf, {
            startY: 85,

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
            },

            bodyStyles: {
                fontSize: 11,
            },

            alternateRowStyles: {
                fillColor: [248, 248, 248],
            },

            margin: {
                left: 20,
                right: 20,
            },
        });

        const finalY = (pdf as any).lastAutoTable.finalY + 15;

        pdf.setDrawColor(201, 169, 110);
        pdf.setLineWidth(1);

        pdf.setDrawColor(201, 169, 110);
        pdf.setLineWidth(1.5);

        // Luxury total card background
        pdf.setFillColor(252, 249, 244);

        pdf.roundedRect(102, finalY, 90, 48, 6, 6, "F");

        // Luxury border
        pdf.setDrawColor(201, 169, 110);
        pdf.setLineWidth(1.5);

        pdf.roundedRect(102, finalY, 90, 48, 6, 6);

        pdf.setFont("times", "normal");
        pdf.setFontSize(11);

        pdf.text("Subtotal", 118, finalY + 12);
        pdf.text(`Rs. ${order.subtotal}`, 168, finalY + 12);

        pdf.text("Tax", 118, finalY + 22);
        pdf.text(`Rs. ${order.tax}`, 168, finalY + 22);

        pdf.setFont("times", "bold");
        pdf.setFontSize(15);

        pdf.text("Grand Total", 118, finalY + 36);
        pdf.text(`Rs. ${order.total}`, 168, finalY + 36);

        // Footer
        pdf.setFont("times", "italic");
        pdf.setFontSize(12);

        const footerY = finalY + 70;

        pdf.text("Crafted with passion • Served with love", 105, footerY, {
            align: "center",
        });

        pdf.text("Thank you for choosing The Golden Brew", 105, footerY + 10, {
            align: "center",
        });

        pdf.save(`Invoice-Order-${order.id}.pdf`);
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-[#131313] text-white flex items-center justify-center">
                Loading Bill...
            </div>
        );
    }
    return (
        <div className="min-h-screen bg-[#131313] text-white font-sans pb-24">
            {/* Top App Bar */}
            <header className="sticky top-0 z-50 flex items-center w-full h-16 px-4 border-b bg-[#131313] border-white/10">
                <button
                    onClick={() => window.history.back()}
                    className="p-2 transition-colors hover:bg-white/5 rounded-full"
                >
                    <ArrowLeft className="w-6 h-6 text-[#c9a96e]" />
                </button>

                <div className="flex-1 text-center">
                    <h1 className="text-xl font-medium font-serif text-[#c9a96e]">
                        Invoice Details
                    </h1>
                </div>

                <div className="w-10" />
            </header>

            <main className="p-4 space-y-6">
                {/* Invoice Card */}
                <div
                    id="invoice-card"
                    className="relative overflow-hidden border rounded-2xl bg-[#0e0e0e] border-white/10 shadow-2xl"
                >
                    {/* Decorative Gradient Background */}
                    <div className="absolute inset-0 opacity-10 bg-gradient-to-b from-[#c9a96e]/20 to-transparent pointer-events-none" />

                    <div className="relative p-6 space-y-8">
                        {/* Logo & Branding */}
                        <div className="flex flex-col items-center text-center space-y-4">
                            {/* <div className="flex items-center justify-center w-20 h-20 border rounded-lg bg-[#1c1b1b] border-[#c9a96e]/30"> */}
                            {/* <img
                                    src="/logo.png"
                                    alt="Cafe Logo"
                                    className="w-12 h-12 object-contain"
                                /> */}
                            {/* </div> */}
                            <div>
                                <h2 className="text-3xl font-bold font-serif text-[#c9a96e] tracking-tight">
                                    The Golden Brew
                                </h2>
                                <p className="text-xs tracking-[0.2em] uppercase text-gray-400">
                                    Crafted with passion, served with love
                                </p>
                            </div>
                            <div className="w-24 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                            <h3 className="text-2xl font-serif italic text-white/90">
                                Bill of Services
                            </h3>
                        </div>

                        {/* Metadata Grid */}
                        <div className="grid grid-cols-2 gap-y-6 text-sm">
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase tracking-wider text-gray-500">
                                    Order Reference
                                </p>
                                <p className="font-mono font-bold text-white">
                                    #{order.id}
                                </p>
                            </div>
                            <div className="space-y-1 text-right">
                                <p className="text-[10px] uppercase tracking-wider text-gray-500">
                                    Table
                                </p>
                                <p className="font-bold text-white">
                                    Table {order.table_id || "-"}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase tracking-wider text-gray-500">
                                    Date & Time
                                </p>
                                <p className="text-white">
                                    {new Date(
                                        order.created_at,
                                    ).toLocaleString()}
                                </p>
                            </div>
                            <div className="space-y-1 text-right">
                                <p className="text-[10px] uppercase tracking-wider text-gray-500">
                                    Status
                                </p>
                                <span
                                    className={`inline-block px-2 py-0.5 text-[10px] font-bold border rounded ${
                                        order.is_paid
                                            ? "border-green-500/50 text-green-400"
                                            : "border-red-500/50 text-red-400"
                                    }`}
                                >
                                    {order.is_paid ? "PAID" : "UNPAID"}
                                </span>
                            </div>
                        </div>

                        <div className="h-px bg-white/10" />

                        {/* Itemized List */}
                        <div className="space-y-4">
                            {order.order_items?.map((item: any) => (
                                <div
                                    key={item.id}
                                    className="flex items-baseline justify-between text-sm"
                                >
                                    <div className="flex items-baseline space-x-2">
                                        <span className="text-[#c9a96e] font-medium">
                                            {item.quantity}x
                                        </span>

                                        <span className="text-white/90">
                                            {item.item_name}
                                        </span>
                                    </div>

                                    <div className="flex-1 mx-4 border-b border-dotted border-white/10" />

                                    <span className="font-medium text-white">
                                        ₹{item.price * item.quantity}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="h-px bg-white/10" />

                        {/* Totals Section */}
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm text-gray-400">
                                <span>SUBTOTAL</span>
                                <span className="text-white font-medium">
                                    ₹{order.subtotal}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-400">
                                <span>TAX (8%)</span>
                                <span className="text-white font-medium">
                                    ₹{order.tax}
                                </span>
                            </div>
                            {/* <div className="flex justify-between text-sm text-red-400">
                                <span>DISCOUNT</span>
                                <span className="font-medium">-$5.00</span>
                            </div> */}
                            <div className="pt-4 flex justify-between items-baseline">
                                <span className="text-xl font-serif text-[#c9a96e]">
                                    GRAND TOTAL
                                </span>
                                <span className="text-2xl font-serif font-bold text-[#c9a96e]">
                                    ₹{order.total}
                                </span>
                            </div>
                        </div>

                        {/* Footer Message */}
                        <div className="pt-8 text-center">
                            <p className="text-xs italic text-gray-500">
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
                            className="flex items-center justify-center py-3 space-x-2 border rounded-xl border-white/10 bg-[#1c1b1b] hover:bg-[#252424] text-white text-sm font-medium transition-colors"
                        >
                            <Download className="w-4 h-4 text-[#c9a96e]" />
                            <span>Download Bill</span>
                        </button>

                        {!order.is_paid && (
                            <button className="flex items-center justify-center py-3 space-x-2 border rounded-xl border-green-500/20 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-sm font-medium transition-colors">
                                <span>💳</span>
                                <span>Pay Now</span>
                            </button>
                        )}
                    </div>

                    {/* <div className="grid grid-cols-2 gap-3">
                        <button className="flex items-center justify-center py-3 space-x-2 border rounded-xl border-white/10 bg-[#1c1b1b] hover:bg-[#252424] text-white text-sm font-medium transition-colors">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span>Email Receipt</span>
                        </button>
                        <button className="flex items-center justify-center py-3 space-x-2 border rounded-xl border-white/10 bg-[#1c1b1b] hover:bg-[#252424] text-white text-sm font-medium transition-colors">
                            <Printer className="w-4 h-4 text-gray-400" />
                            <span>Print</span>
                        </button>
                    </div> */}
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
