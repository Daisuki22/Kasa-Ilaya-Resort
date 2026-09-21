import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, KeyRound, TimerReset, LockKeyhole, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { baseClient } from "@/api/baseClient";
import { useAuth } from "@/lib/AuthContext";
import { defaultSiteSettings, useSiteSettings } from "@/hooks/useSiteSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const DEFAULT_SECURITY_SETTINGS = {
  require_strong_password: true,
  min_password_length: 8,
  session_timeout_minutes: 120,
  max_login_attempts: 5,
  lockout_minutes: 15,
  enable_login_notifications: true,
};

const getNumberOrDefault = (value, fallback) => {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : fallback;
};

const buildForm = (settings) => ({
  require_strong_password:
    settings?.require_strong_password !== undefined
      ? Boolean(settings.require_strong_password)
      : DEFAULT_SECURITY_SETTINGS.require_strong_password,
  min_password_length: getNumberOrDefault(settings?.min_password_length, DEFAULT_SECURITY_SETTINGS.min_password_length),
  session_timeout_minutes: getNumberOrDefault(settings?.session_timeout_minutes, DEFAULT_SECURITY_SETTINGS.session_timeout_minutes),
  max_login_attempts: getNumberOrDefault(settings?.max_login_attempts, DEFAULT_SECURITY_SETTINGS.max_login_attempts),
  lockout_minutes: getNumberOrDefault(settings?.lockout_minutes, DEFAULT_SECURITY_SETTINGS.lockout_minutes),
  enable_login_notifications:
    settings?.enable_login_notifications !== undefined
      ? Boolean(settings.enable_login_notifications)
      : DEFAULT_SECURITY_SETTINGS.enable_login_notifications,
});

export default function AdminSecuritySettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { settings, settingRecord, isLoading } = useSiteSettings();

  const [form, setForm] = useState(buildForm(settings));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm(buildForm(settings));
  }, [settings]);

  const validationMessage = useMemo(() => {
    if (form.min_password_length < 6 || form.min_password_length > 32) {
      return "Password length must be between 6 and 32 characters.";
    }

    if (form.session_timeout_minutes < 10 || form.session_timeout_minutes > 1440) {
      return "Session timeout must be between 10 and 1440 minutes.";
    }

    if (form.max_login_attempts < 1 || form.max_login_attempts > 20) {
      return "Max login attempts must be between 1 and 20.";
    }

    if (form.lockout_minutes < 1 || form.lockout_minutes > 240) {
      return "Lockout duration must be between 1 and 240 minutes.";
    }

    return "";
  }, [form.lockout_minutes, form.max_login_attempts, form.min_password_length, form.session_timeout_minutes]);

  const handleNumberChange = (key, fallback) => (event) => {
    const nextValue = Number(event.target.value);
    setForm((prev) => ({
      ...prev,
      [key]: Number.isFinite(nextValue) ? nextValue : fallback,
    }));
  };

  const handleSave = async () => {
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    setIsSaving(true);

    const payload = {
      require_strong_password: Boolean(form.require_strong_password),
      min_password_length: Number(form.min_password_length),
      session_timeout_minutes: Number(form.session_timeout_minutes),
      max_login_attempts: Number(form.max_login_attempts),
      lockout_minutes: Number(form.lockout_minutes),
      enable_login_notifications: Boolean(form.enable_login_notifications),
    };

    const savePayload = settingRecord?.id
      ? { ...settingRecord, ...payload }
      : {
          id: "site-settings-main",
          ...defaultSiteSettings,
          ...payload,
        };

    try {
      if (settingRecord?.id) {
        await baseClient.entities.SiteSetting.update(settingRecord.id, savePayload);
      } else {
        await baseClient.entities.SiteSetting.create(savePayload);
      }

      await baseClient.entities.ActivityLog.create({
        user_email: user?.email || null,
        user_name: user?.full_name || "Admin",
        action: "Updated Security Settings",
        entity_type: "SiteSetting",
        entity_id: settingRecord?.id || "site-settings-main",
        details: "Updated authentication and account protection settings.",
      });

      await queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
      toast.success("Security settings saved.");
    } catch (error) {
      toast.error(error?.message || "Unable to save security settings.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-28">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-none space-y-6 px-2 py-6 sm:px-3 lg:px-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Security Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage password policy, session controls, and account protection defaults.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Password Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 px-4 py-3">
            <div>
              <p className="font-medium text-foreground">Require strong passwords</p>
              <p className="text-sm text-muted-foreground">
                Enforce mixed-case, numbers, and symbols when users create or reset passwords.
              </p>
            </div>
            <Switch
              checked={form.require_strong_password}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, require_strong_password: checked }))
              }
              aria-label="Toggle strong password requirement"
            />
          </div>

          <div>
            <Label htmlFor="min-password-length">Minimum password length</Label>
            <Input
              id="min-password-length"
              type="number"
              min={6}
              max={32}
              value={form.min_password_length}
              onChange={handleNumberChange("min_password_length", DEFAULT_SECURITY_SETTINGS.min_password_length)}
              className="max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl flex items-center gap-2">
              <TimerReset className="h-5 w-5 text-primary" />
              Session Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="session-timeout-minutes">Session timeout (minutes)</Label>
              <Input
                id="session-timeout-minutes"
                type="number"
                min={10}
                max={1440}
                value={form.session_timeout_minutes}
                onChange={handleNumberChange("session_timeout_minutes", DEFAULT_SECURITY_SETTINGS.session_timeout_minutes)}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 px-4 py-3">
              <div>
                <p className="font-medium text-foreground">Login alert notifications</p>
                <p className="text-sm text-muted-foreground">
                  Send account owner notifications for successful sign-ins.
                </p>
              </div>
              <Switch
                checked={form.enable_login_notifications}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, enable_login_notifications: checked }))
                }
                aria-label="Toggle login alert notifications"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-primary" />
              Account Protection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="max-login-attempts">Max failed login attempts</Label>
              <Input
                id="max-login-attempts"
                type="number"
                min={1}
                max={20}
                value={form.max_login_attempts}
                onChange={handleNumberChange("max_login_attempts", DEFAULT_SECURITY_SETTINGS.max_login_attempts)}
              />
            </div>
            <div>
              <Label htmlFor="lockout-minutes">Temporary lockout duration (minutes)</Label>
              <Input
                id="lockout-minutes"
                type="number"
                min={1}
                max={240}
                value={form.lockout_minutes}
                onChange={handleNumberChange("lockout_minutes", DEFAULT_SECURITY_SETTINGS.lockout_minutes)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground flex items-start gap-2">
        <Shield className="h-4 w-4 mt-0.5 text-primary" />
        These settings are saved globally and can be used by authentication flows and future security enforcement.
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || Boolean(validationMessage)} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? "Saving..." : "Save Security Settings"}
        </Button>
      </div>
    </div>
  );
}
