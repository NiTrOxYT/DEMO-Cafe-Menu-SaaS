import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8F5EF]">
      <Card className="w-full max-w-md mx-4 border-[#E5DDD1] bg-[#FFFDF9]">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <AlertCircle className="h-6 w-6 text-[#7B4E35]" />
            <h1 className="text-xl font-bold text-[#29231F]">Page Not Found</h1>
          </div>

          <p className="mt-2 text-sm text-[#766B61]">
            The requested page does not exist.
          </p>
          <div className="mt-4">
            <a href="/" className="text-xs font-semibold uppercase tracking-wider text-[#7B4E35] underline">
              Return to Menu
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

