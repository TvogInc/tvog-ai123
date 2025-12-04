import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Lock, Sparkles, AlertTriangle, Shield, QrCode } from "lucide-react";
import { z } from "zod";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import QRCode from "qrcode";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const profileSchema = z.object({
  display_name: z.string().trim().min(1, "Display name cannot be empty").max(50, "Display name must be less than 50 characters"),
});

const passwordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const Profile = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      loadProfile(session.user.id);
      checkTwoFactorStatus();
    };

    checkAuth();
  }, [navigate]);

  const checkTwoFactorStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setTwoFactorEnabled(data?.totp?.length > 0);
    } catch (error) {
      console.error("Error checking 2FA status:", error);
    }
  };

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error loading profile:", error);
      return;
    }

    if (data) {
      setProfile(data);
      setDisplayName(data.display_name || "");
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const validated = profileSchema.parse({ display_name: displayName });
      setLoading(true);

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          display_name: validated.display_name,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });

      loadProfile(user.id);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const validated = passwordSchema.parse({ newPassword, confirmPassword });
      setPasswordLoading(true);

      const { error } = await supabase.auth.updateUser({
        password: validated.newPassword,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password changed successfully",
      });

      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAccountDeletion = async () => {
    if (!user) return;

    try {
      setDeleteLoading(true);

      // Schedule deletion by updating the profiles table
      const { error } = await supabase
        .from("profiles")
        .update({
          deletion_scheduled_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Account deletion scheduled",
        description: "Your account will be permanently deleted in 7 days. Sign in again to cancel.",
      });

      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEnable2FA = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });

      if (error) throw error;

      // Store the factor ID for verification
      setPendingFactorId(data.id);
      setTotpSecret(data.totp.secret);
      const qrCode = await QRCode.toDataURL(data.totp.uri);
      setQrCodeUrl(qrCode);
      setShowQRCode(true);

      toast({
        title: "Scan QR Code",
        description: "Use your authenticator app to scan the QR code.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    setLoading(true);
    try {
      // Use the pending factor ID from enrollment
      const factorId = pendingFactorId;
      if (!factorId) throw new Error("No pending 2FA setup found. Please start again.");

      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: verificationCode,
      });

      if (error) throw error;

      setTwoFactorEnabled(true);
      setShowQRCode(false);
      setVerificationCode("");
      setPendingFactorId(null);

      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication has been successfully enabled.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    setLoading(true);
    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;

      const totpFactor = factors.data?.totp?.[0];
      if (!totpFactor) throw new Error("No TOTP factor found");

      const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
      if (error) throw error;

      setTwoFactorEnabled(false);

      toast({
        title: "2FA Disabled",
        description: "Two-factor authentication has been disabled.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isAnonymous = user?.is_anonymous;

  return (
    <div className="min-h-screen bg-gradient-bg">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(20,184,166,0.1),transparent_50%)]" />
      
      <div className="relative max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="hover:bg-primary/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold">Profile Settings</h1>
          </div>
        </div>

        {/* Profile Information */}
        <Card className="p-6 space-y-4 border-border/50 shadow-glow backdrop-blur-sm bg-card/95">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Account Information</h2>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={user?.email || "Guest User"}
              disabled
              className="bg-muted/50"
            />
            <p className="text-xs text-muted-foreground">
              {isAnonymous ? "You're using guest mode" : "Email cannot be changed"}
            </p>
          </div>

          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                maxLength={50}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:opacity-90"
              disabled={loading || isAnonymous}
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
            {isAnonymous && (
              <p className="text-xs text-muted-foreground text-center">
                Profile changes are not available in guest mode
              </p>
            )}
          </form>
        </Card>

        {/* Password Change */}
        {!isAnonymous && (
          <Card className="p-6 space-y-4 border-border/50 shadow-glow backdrop-blur-sm bg-card/95">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Change Password</h2>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  minLength={6}
                />
                <PasswordStrengthIndicator password={newPassword} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  minLength={6}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:opacity-90"
                disabled={passwordLoading || !newPassword || !confirmPassword}
              >
                {passwordLoading ? "Changing..." : "Change Password"}
              </Button>
            </form>
          </Card>
        )}

        {/* Two-Factor Authentication */}
        {!isAnonymous && (
          <Card className="p-6 space-y-4 border-border/50 shadow-glow backdrop-blur-sm bg-card/95">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Two-Factor Authentication</h2>
            </div>

            {!showQRCode ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {twoFactorEnabled
                    ? "Two-factor authentication is currently enabled on your account."
                    : "Add an extra layer of security to your account by enabling two-factor authentication."}
                </p>
                
                {twoFactorEnabled ? (
                  <Button
                    variant="destructive"
                    onClick={handleDisable2FA}
                    disabled={loading}
                  >
                    {loading ? "Disabling..." : "Disable 2FA"}
                  </Button>
                ) : (
                  <Button
                    onClick={handleEnable2FA}
                    disabled={loading}
                    className="bg-gradient-primary hover:opacity-90"
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    {loading ? "Setting up..." : "Enable 2FA"}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>
                
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
                </div>

                <div className="space-y-2">
                  <Label>Manual Entry Code</Label>
                  <code className="block p-2 bg-muted rounded text-xs break-all">
                    {totpSecret}
                  </code>
                </div>

                <div className="space-y-2">
                  <Label>Enter verification code</Label>
                  <InputOTP
                    maxLength={6}
                    value={verificationCode}
                    onChange={setVerificationCode}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowQRCode(false);
                      setVerificationCode("");
                      setPendingFactorId(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleVerify2FA}
                    disabled={loading || verificationCode.length !== 6}
                    className="bg-gradient-primary hover:opacity-90"
                  >
                    {loading ? "Verifying..." : "Verify & Enable"}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Account Stats */}
        <Card className="p-6 border-border/50 shadow-glow backdrop-blur-sm bg-card/95">
          <h2 className="text-xl font-semibold mb-4">Account Details</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account Type</span>
              <span className="font-medium">{isAnonymous ? "Guest" : "Registered"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Member Since</span>
              <span className="font-medium">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
              </span>
            </div>
          </div>
        </Card>

        {/* Delete Account Section */}
        {!isAnonymous && (
          <Card className="p-6 border-destructive/50 shadow-glow backdrop-blur-sm bg-card/95">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <h2 className="text-xl font-semibold">Danger Zone</h2>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Once you delete your account, there is a 7-day grace period. You can cancel the deletion
                by signing in again within this period. After 7 days, all your data will be permanently deleted.
              </p>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deleteLoading}>
                    {deleteLoading ? "Processing..." : "Delete Account"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will schedule your account for deletion. You have 7 days to change your mind
                      by signing in again. After 7 days, your account and all associated data will be
                      permanently deleted and cannot be recovered.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleAccountDeletion}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Yes, delete my account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Profile;
