import { Check, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface Requirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: Requirement[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "Contains uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "Contains lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "Contains number", test: (p) => /\d/.test(p) },
  { label: "Contains special character", test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  const metRequirements = requirements.filter((req) => req.test(password));
  const strength = (metRequirements.length / requirements.length) * 100;

  const getStrengthLabel = () => {
    if (strength === 0) return { label: "No password", color: "text-muted-foreground" };
    if (strength < 40) return { label: "Weak", color: "text-destructive" };
    if (strength < 80) return { label: "Medium", color: "text-yellow-500" };
    return { label: "Strong", color: "text-green-500" };
  };

  const strengthInfo = getStrengthLabel();

  if (!password) return null;

  return (
    <div className="space-y-3 mt-2">
      <div className="space-y-1">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Password strength:</span>
          <span className={cn("font-medium", strengthInfo.color)}>{strengthInfo.label}</span>
        </div>
        <Progress value={strength} className="h-2" />
      </div>
      
      <div className="space-y-1.5">
        {requirements.map((req, index) => {
          const isMet = req.test(password);
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              {isMet ? (
                <Check className="w-4 h-4 text-green-500 shrink-0" />
              ) : (
                <X className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <span className={cn(isMet ? "text-foreground" : "text-muted-foreground")}>
                {req.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
